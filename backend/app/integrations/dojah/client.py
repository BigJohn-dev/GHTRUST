import structlog
import httpx
from app.integrations.retry import transient_retry

from app.core.config import settings
from app.integrations.dojah.schemas import (
    DojahBvnEntity,
    DojahBvnResponse,
    DojahError,
    DojahSelfieEntity,
    DojahSelfieResponse,
    DojahLivenessResponse,
    DojahSelfieVerification,
    LivenessResult,
    TransientDojahError,
)

logger = structlog.get_logger()

SANDBOX_BVN = "22222222222"

MOCK_ENTITY = DojahBvnEntity(
    bvn=SANDBOX_BVN,
    first_name="ADAEZE",
    last_name="OKAFOR",
    middle_name="CHINWE",
    gender="Female",
    date_of_birth="1995-03-15",
    phone_number1="08035794364",
    phone_number2="08134709697",
    email="adaeze.okafor@email.com",
    enrollment_bank="GTB",
    enrollment_branch="OGBA",
    level_of_account="LEVEL 2",
    lga_of_origin="ONITSHA NORTH",
    lga_of_residence="IKEJA",
    marital_status="SINGLE",
    name_on_card="ADAEZE C OKAFOR",
    nationality="NIGERIAN",
    registration_date="15-MAR-2018",
    residential_address="52 Ijaye Road, Ogba, Lagos",
    state_of_origin="ANAMBRA",
    state_of_residence="LAGOS",
    title="MISS",
    watch_listed="NO",
    image=None,
)

UNAVAILABLE = "BVN verification is temporarily unavailable. Please try again shortly."


def _error_text(response: httpx.Response) -> str:
    try:
        body = response.json()
    except ValueError:
        return response.text[:200]
    if isinstance(body, dict):
        return str(body.get("error") or body.get("message") or body)[:200]
    return str(body)[:200]


class DojahClient:
    """
    Dojah KYC (Nigeria): BVN Advanced lookup, liveness check and BVN selfie verification.

    Auth: ``Authorization: <secret key>`` (sent as-is, no ``Bearer``) and ``AppId``.
    Sandbox: DOJAH_BASE_URL=https://sandbox.dojah.io with BVN 22222222222.

    How Dojah's statuses are handled:
      400  their answer: "BVN not found" → not found; otherwise a bad request (e.g. image)
      401  our keys are wrong · 402 our Dojah wallet is empty → ops alert, customer told
           to try later (not their fault, and retrying can't fix it)
      404  no record for that BVN
      424  upstream (NIBSS) unavailable · 429 rate limited · 5xx → retried, then "try later"
    """

    def __init__(self):
        self.base_url = settings.dojah_base_url.rstrip("/")
        self.app_id = settings.dojah_app_id
        self.secret_key = settings.dojah_secret_key

    @property
    def _mock(self) -> bool:
        return settings.dojah_mock or not settings.dojah_enabled

    async def _send(self, method: str, path: str, **kwargs) -> dict:
        headers = {"AppId": self.app_id, "Authorization": self.secret_key}
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.request(method, f"{self.base_url}{path}", headers=headers, **kwargs)
        except httpx.HTTPError as exc:
            logger.warning("dojah_transport_error", path=path, error=str(exc))
            raise TransientDojahError(UNAVAILABLE, status_code=503) from exc

        status = response.status_code
        if status < 400:
            return response.json()

        text = _error_text(response)
        if status == 404 or (status == 400 and "not found" in text.lower()):
            raise DojahError("BVN not found or invalid", status_code=404)
        if status == 400:
            raise DojahError(text or "Bad request", status_code=400)
        if status in (401, 403):
            logger.critical("dojah_auth_failed", path=path, status=status, detail=text)
            raise DojahError(UNAVAILABLE, status_code=503)
        if status == 402:
            logger.critical("dojah_wallet_insufficient", path=path, detail=text)
            raise DojahError(UNAVAILABLE, status_code=503)
        if status in (424, 429) or status >= 500:
            logger.error("dojah_unavailable", path=path, status=status, detail=text)
            raise TransientDojahError(UNAVAILABLE, status_code=503)
        logger.error("dojah_api_error", path=path, status=status, detail=text)
        raise DojahError(UNAVAILABLE, status_code=503)

    @transient_retry()
    async def lookup_bvn_advanced(self, bvn: str) -> DojahBvnEntity:
        """GET /api/v1/kyc/bvn/advance: the full record incl. enrollment, residence and origin."""
        if self._mock:
            logger.info("dojah_mock_lookup", bvn=bvn[:3] + "****")
            update = {"bvn": bvn}
            if settings.dojah_mock_phone:
                update["phone_number1"] = settings.dojah_mock_phone
            return MOCK_ENTITY.model_copy(update=update)

        data = await self._send("GET", "/api/v1/kyc/bvn/advance", params={"bvn": bvn})
        entity = DojahBvnResponse.model_validate(data).entity
        # Dojah masks the BVN in the response; keep the one we asked about.
        return entity.model_copy(update={"bvn": bvn})

    @transient_retry()
    async def verify_bvn_selfie(self, bvn: str, selfie_base64: str, threshold: int) -> DojahSelfieVerification:
        """
        POST /api/v1/kyc/bvn/verify: does this selfie match the BVN photo?
        ``match`` is true only when the confidence is at or above ``threshold`` (50–100).
        """
        if self._mock:
            logger.info("dojah_mock_selfie", bvn=bvn[:3] + "****")
            return DojahSelfieVerification(confidence_value=97.5, match=True)

        data = await self._send(
            "POST",
            "/api/v1/kyc/bvn/verify",
            json={"bvn": bvn, "selfie_image": selfie_base64, "threshold": threshold},
        )
        entity: DojahSelfieEntity = DojahSelfieResponse.model_validate(data).entity
        return entity.selfie_verification

    @transient_retry()
    async def check_liveness(self, image_base64: str, min_probability: float) -> LivenessResult:
        """
        POST /api/v1/ml/liveness: was this image taken of a live person (not a printed
        photo, a screen or a mask)? Exactly one face must be in the picture.
        """
        if self._mock:
            logger.info("dojah_mock_liveness")
            return LivenessResult(live=True, probability=0.99)

        data = await self._send("POST", "/api/v1/ml/liveness", json={"image": image_base64})
        entity = DojahLivenessResponse.model_validate(data).entity
        if entity.face.face_detected is False:
            return LivenessResult(live=False, reason="no_face")
        if entity.face.multiface_detected:
            return LivenessResult(live=False, reason="several_faces")
        probability = entity.liveness.liveness_probability
        if probability is not None and probability > 1:
            probability = probability / 100  # some responses give a percentage
        if entity.liveness.liveness_check is False:
            return LivenessResult(live=False, probability=probability, reason="spoof")
        if probability is not None and probability < min_probability:
            return LivenessResult(live=False, probability=probability, reason="low_probability")
        if entity.liveness.liveness_check is None and probability is None:
            return LivenessResult(live=False, reason="no_result")
        return LivenessResult(live=True, probability=probability)
