"""Pilot metrics: every face check is recorded, and the admin report adds them up."""

from unittest.mock import AsyncMock, patch

from sqlalchemy import select

from app.integrations.dojah.schemas import DojahError, DojahSelfieVerification, LivenessResult
from app.modules.auth.models import SelfieAttempt
from tests.integration.test_registration_selfie import LIVENESS, VERIFY, _selfie, _selfie_on, _start
from tests.conftest import refresh_settings


def _liveness_on(monkeypatch):
    monkeypatch.setenv("DOJAH_LIVENESS_REQUIRED", "true")
    refresh_settings()


async def _attempts(db_session) -> list[SelfieAttempt]:
    db_session.expire_all()
    return list((await db_session.execute(select(SelfieAttempt).order_by(SelfieAttempt.created_at))).scalars())


async def test_failed_and_passed_checks_are_all_recorded(api_client, db_session, monkeypatch):
    _selfie_on(monkeypatch, attempts=3)
    _liveness_on(monkeypatch)
    token = (await _start(api_client))["registration_token"]

    # 1: a photo of a photo. Failed checks end in an error, yet must still be kept.
    with patch(LIVENESS, AsyncMock(return_value=LivenessResult(live=False, probability=0.21, reason="spoof"))):
        assert (await _selfie(api_client, token)).status_code == 400
    # 2: live, but not the BVN holder.
    with (
        patch(LIVENESS, AsyncMock(return_value=LivenessResult(live=True, probability=0.93))),
        patch(VERIFY, AsyncMock(return_value=DojahSelfieVerification(confidence_value=71.5, match=False))),
    ):
        assert (await _selfie(api_client, token)).status_code == 400
    # 3: Dojah can't read the image (doesn't use up an attempt).
    with (
        patch(LIVENESS, AsyncMock(return_value=LivenessResult(live=True, probability=0.9))),
        patch(VERIFY, AsyncMock(side_effect=DojahError("bad image", status_code=400))),
    ):
        assert (await _selfie(api_client, token)).status_code == 400
    # 4: passes; the account opens.
    with (
        patch(LIVENESS, AsyncMock(return_value=LivenessResult(live=True, probability=0.97))),
        patch(VERIFY, AsyncMock(return_value=DojahSelfieVerification(confidence_value=95.2, match=True))),
    ):
        assert (await _selfie(api_client, token)).status_code == 200

    rows = await _attempts(db_session)
    assert [(r.outcome, r.attempt_number) for r in rows] == [
        ("not_live", 1),
        ("no_match", 2),
        ("unreadable", 3),
        ("passed", 3),
    ]
    assert rows[0].liveness_probability == 0.21 and rows[0].liveness_reason == "spoof"
    assert rows[1].match_score == 71.5
    assert rows[3].match_score == 95.2
    assert all(r.threshold == 90 for r in rows)


async def test_report_adds_up_the_funnel_and_face_checks(api_client, db_session, admin_headers, monkeypatch):
    _selfie_on(monkeypatch, attempts=3)
    token = (await _start(api_client))["registration_token"]
    with patch(VERIFY, AsyncMock(return_value=DojahSelfieVerification(confidence_value=82.0, match=False))):
        await _selfie(api_client, token)
    with patch(VERIFY, AsyncMock(return_value=DojahSelfieVerification(confidence_value=96.0, match=True))):
        assert (await _selfie(api_client, token)).status_code == 200

    res = await api_client.get("/api/v1/admin/onboarding", params={"days": 7}, headers=admin_headers)
    assert res.status_code == 200, res.text
    report = res.json()

    funnel = {s["key"]: s["count"] for s in report["funnel"]}
    assert funnel["started"] == 1
    assert funnel["phone_verified"] == 1
    assert funnel["face_verified"] == 1
    assert funnel["account_open"] == 1
    assert funnel["applied"] == 0

    face = report["face_checks"]
    assert (face["attempts"], face["scored_attempts"], face["passed"]) == (2, 2, 1)
    assert face["pass_rate"] == 0.5
    assert face["customers"] == 1 and face["first_try_pass_rate"] == 0.0
    sim = {p["value"]: p["pass_rate"] for p in face["threshold_simulation"]}
    # Scores 82 and 96: at 80 both would pass, at the current 90 only one.
    assert sim[80] == 1.0 and sim[90] == 0.5 and sim[95] == 0.5
    assert [p["value"] for p in face["threshold_simulation"] if p["current"]] == [90]
    assert {b["label"]: b["count"] for b in face["score_histogram"]}["80–90"] == 1


async def test_report_needs_staff_sign_in(api_client):
    assert (await api_client.get("/api/v1/admin/onboarding")).status_code == 401
