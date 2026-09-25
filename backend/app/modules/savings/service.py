from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.savings.models import SavingsAccount, SavingsProduct
from app.modules.savings.schemas import (
    OpenSavingsAccountRequest,
    SavingsAccountResponse,
    SavingsProductResponse,
    SavingsSummaryResponse,
)


class SavingsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_products(self) -> list[SavingsProductResponse]:
        result = await self.db.execute(
            select(SavingsProduct).where(SavingsProduct.is_active.is_(True))
        )
        products = result.scalars().all()
        return [SavingsProductResponse.model_validate(p) for p in products]

    async def get_customer_summary(self, customer_id: str) -> SavingsSummaryResponse:
        result = await self.db.execute(
            select(SavingsAccount).where(SavingsAccount.customer_id == customer_id)
        )
        accounts = result.scalars().all()
        responses = [SavingsAccountResponse.model_validate(a) for a in accounts]
        total = sum((a.balance for a in responses), Decimal("0"))
        return SavingsSummaryResponse(
            total_balance=total,
            active_accounts=len(responses),
            accounts=responses,
        )

    async def open_account(
        self, customer_id: str, payload: OpenSavingsAccountRequest
    ) -> SavingsAccountResponse:
        # Scaffold — full ledger integration in Phase 2
        raise NotImplementedError("Connect wallet debit + ledger entry in next phase")
