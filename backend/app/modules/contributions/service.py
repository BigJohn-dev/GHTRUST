from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.contributions.models import ContributionGroup
from app.modules.contributions.schemas import (
    ContributionCreate,
    ContributionGroupResponse,
    ContributionResponse,
)


class ContributionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_groups(self, branch: str | None = None) -> list[ContributionGroupResponse]:
        query = select(ContributionGroup)
        if branch:
            query = query.where(ContributionGroup.branch == branch)
        result = await self.db.execute(query)
        groups = result.scalars().all()
        return [
            ContributionGroupResponse(
                id=g.id,
                name=g.name,
                leader_id=g.leader_id,
                leader_name="",  # join customer in implementation
                member_count=g.member_count,
                target_amount=g.target_amount,
                collected_amount=g.collected_amount,
                cycle=g.cycle,
                branch=g.branch,
                next_meeting=g.next_meeting,
                status=g.status,
                service_fee_percent=g.service_fee_percent,
            )
            for g in groups
        ]

    async def record_contribution(
        self, customer_id: str, payload: ContributionCreate
    ) -> ContributionResponse:
        raise NotImplementedError("Ledger + fee calculation in next phase")
