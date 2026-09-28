from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import CurrentCustomer, DbSession
from app.modules.contributions.schemas import (
    ContributionCreate,
    ContributionGroupResponse,
    ContributionResponse,
)
from app.modules.contributions.service import ContributionService

router = APIRouter(prefix="/contributions", tags=["Group Contributions"])


@router.get("/groups", response_model=list[ContributionGroupResponse])
async def list_contribution_groups(
    db: DbSession,
    branch: str | None = Query(default=None),
):
    return await ContributionService(db).list_groups(branch=branch)


@router.post(
    "/me/contributions",
    response_model=ContributionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def record_my_contribution(
    payload: ContributionCreate, db: DbSession, customer: CurrentCustomer
):
    try:
        return await ContributionService(db).record_contribution(customer.id, payload)
    except NotImplementedError as e:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(e))
