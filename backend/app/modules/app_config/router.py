from fastapi import APIRouter, Query

from app.modules.app_config.service import AppConfigResponse, Platform, build_config

router = APIRouter(prefix="/app", tags=["App config"])


@router.get(
    "/config",
    response_model=AppConfigResponse,
    summary="Mobile app remote config",
    description=(
        "Call on launch and on resume. If `update_required` is true, block the UI "
        "and send the user to the store. If `maintenance.enabled`, show the message. "
        "Always reachable — exempt from the version gate and maintenance mode."
    ),
)
async def get_app_config(
    platform: Platform = Query(...),
    version: str | None = Query(None, max_length=32, examples=["1.0.0"]),
):
    return build_config(platform, version)
