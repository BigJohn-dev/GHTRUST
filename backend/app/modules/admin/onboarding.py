"""
Onboarding report for the pilot: where sign-ups drop off, and how the face check performs.

- Funnel: customers who started sign-up in the window, and how far each got.
- Face checks: pass rates, why checks fail, and what the pass rate would have been at
  other thresholds, which is the evidence for tuning DOJAH_SELFIE_THRESHOLD and
  DOJAH_LIVENESS_MIN_PROBABILITY.

Aggregates only: no names, phones or BVNs leave this endpoint.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.deps import DbSession
from app.modules.admin.deps import require_permission
from app.modules.admin.models import Staff
from app.modules.admin.permissions import LOAN_READ
from app.modules.auth.models import SelfieAttempt, SelfieOutcome
from app.modules.loans.models import LoanApplication
from app.modules.users.models import Customer, CustomerStatus

router = APIRouter(prefix="/admin/onboarding", tags=["Admin: Onboarding"])

THRESHOLDS = (60, 65, 70, 75, 80, 85, 90, 95)
LIVENESS_MINIMUMS = (0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9)
SCORE_BUCKETS = (
    (0, 60, "Below 60"),
    (60, 70, "60–70"),
    (70, 80, "70–80"),
    (80, 90, "80–90"),
    (90, 95, "90–95"),
    (95, 101, "95–100"),
)
OUTCOME_LABELS = {
    SelfieOutcome.PASSED: "Passed",
    SelfieOutcome.NO_MATCH: "Didn't match the BVN photo",
    SelfieOutcome.NOT_LIVE: "Liveness failed",
    SelfieOutcome.UNREADABLE: "Photo unreadable",
    SelfieOutcome.PROVIDER_ERROR: "Dojah unavailable",
}
_SCORED = {
    SelfieOutcome.PASSED.value,
    SelfieOutcome.NO_MATCH.value,
    SelfieOutcome.NOT_LIVE.value,
}
_FAILED = {SelfieOutcome.NO_MATCH.value, SelfieOutcome.NOT_LIVE.value}


class FunnelStep(BaseModel):
    key: str
    label: str
    count: int
    rate_from_start: float | None  # 0–1; None when nobody started


class OutcomeCount(BaseModel):
    outcome: str
    label: str
    count: int


class SimulationPoint(BaseModel):
    value: float
    pass_rate: float | None  # share of scored attempts that would pass at this setting
    current: bool


class Bucket(BaseModel):
    label: str
    count: int


class FaceCheckStats(BaseModel):
    attempts: int
    scored_attempts: int  # passed + no match + liveness failed (excludes unreadable / provider errors)
    passed: int
    pass_rate: float | None
    customers: int
    first_try_pass_rate: (
        float | None
    )  # of customers who tried, share who passed on attempt 1
    cooldowns: int  # customers locked out for DOJAH_SELFIE_COOLDOWN_MINUTES after the last attempt
    outcomes: list[OutcomeCount]
    threshold: int
    threshold_simulation: list[SimulationPoint]
    score_histogram: list[Bucket]
    liveness_min: float | None
    liveness_simulation: list[SimulationPoint]


class OnboardingReport(BaseModel):
    days: int
    since: datetime
    funnel: list[FunnelStep]
    face_checks: FaceCheckStats


def _rate(part: int, whole: int) -> float | None:
    return round(part / whole, 4) if whole else None


async def build_report(db, days: int) -> OnboardingReport:
    settings = get_settings()
    since = datetime.now(timezone.utc) - timedelta(days=days)

    started = select(Customer).where(Customer.created_at >= since).subquery()
    applied_ids = select(LoanApplication.customer_id).distinct()
    row = (
        await db.execute(
            select(
                func.count(),
                func.count().filter(started.c.phone_verified.is_(True)),
                func.count().filter(started.c.selfie_verified_at.is_not(None)),
                func.count().filter(started.c.status == CustomerStatus.ACTIVE),
                func.count().filter(started.c.login_pin_set_at.is_not(None)),
                func.count().filter(started.c.id.in_(applied_ids)),
            ).select_from(started)
        )
    ).one()
    total = row[0]
    steps = [
        ("started", "Entered BVN"),
        ("phone_verified", "Verified phone"),
        ("face_verified", "Passed face check"),
        ("account_open", "Account opened"),
        ("pin_set", "Set sign-in PIN"),
        ("applied", "Started a loan application"),
    ]
    funnel = [
        FunnelStep(
            key=key, label=label, count=count, rate_from_start=_rate(count, total)
        )
        for (key, label), count in zip(steps, row, strict=True)
    ]

    attempts = (
        await db.execute(
            select(
                SelfieAttempt.customer_id,
                SelfieAttempt.outcome,
                SelfieAttempt.attempt_number,
                SelfieAttempt.match_score,
                SelfieAttempt.liveness_probability,
            ).where(SelfieAttempt.created_at >= since)
        )
    ).all()

    counts = {o.value: 0 for o in SelfieOutcome}
    for a in attempts:
        counts[a.outcome] = counts.get(a.outcome, 0) + 1
    scored = sum(counts[o] for o in _SCORED)
    passed = counts[SelfieOutcome.PASSED.value]
    customers = {a.customer_id for a in attempts}
    first_try = {
        a.customer_id
        for a in attempts
        if a.outcome == SelfieOutcome.PASSED.value and a.attempt_number == 1
    }
    cooldowns = {
        a.customer_id
        for a in attempts
        if a.outcome in _FAILED
        and a.attempt_number >= settings.dojah_selfie_max_attempts
    }

    # Scores exist only for checks that reached face matching (passed or didn't match).
    scores = [a.match_score for a in attempts if a.match_score is not None]
    liveness = [
        a.liveness_probability for a in attempts if a.liveness_probability is not None
    ]

    return OnboardingReport(
        days=days,
        since=since,
        funnel=funnel,
        face_checks=FaceCheckStats(
            attempts=len(attempts),
            scored_attempts=scored,
            passed=passed,
            pass_rate=_rate(passed, scored),
            customers=len(customers),
            first_try_pass_rate=_rate(len(first_try), len(customers)),
            cooldowns=len(cooldowns),
            outcomes=[
                OutcomeCount(
                    outcome=o.value, label=OUTCOME_LABELS[o], count=counts[o.value]
                )
                for o in SelfieOutcome
            ],
            threshold=settings.dojah_selfie_threshold,
            threshold_simulation=[
                SimulationPoint(
                    value=t,
                    pass_rate=_rate(sum(s >= t for s in scores), len(scores)),
                    current=t == settings.dojah_selfie_threshold,
                )
                for t in THRESHOLDS
            ],
            score_histogram=[
                Bucket(label=label, count=sum(lo <= s < hi for s in scores))
                for lo, hi, label in SCORE_BUCKETS
            ],
            liveness_min=settings.dojah_liveness_min_probability
            if settings.dojah_liveness_required
            else None,
            liveness_simulation=[
                SimulationPoint(
                    value=m,
                    pass_rate=_rate(sum(p >= m for p in liveness), len(liveness)),
                    current=abs(m - settings.dojah_liveness_min_probability) < 1e-9,
                )
                for m in LIVENESS_MINIMUMS
            ],
        ),
    )


@router.get(
    "",
    response_model=OnboardingReport,
    summary="Sign-up funnel and face-check performance",
)
async def onboarding_report(
    db: DbSession,
    days: int = Query(30, ge=1, le=365),
    _: Staff = Depends(require_permission(LOAN_READ)),
):
    return await build_report(db, days)
