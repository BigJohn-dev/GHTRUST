from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.loans.models import Loan, LoanApplication
from app.modules.loans.schemas import ApplicationStatus
from app.modules.loans.service import LoanService
from app.modules.users.models import Customer, CustomerStatus
from app.modules.users.search import customer_search_clause
from app.modules.users.schemas import (
    CustomerDetailResponse,
    CustomerStatsResponse,
    CustomerSummaryResponse,
)


class CustomerAdminService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_customers(
        self,
        *,
        search: str | None = None,
        status: CustomerStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[CustomerSummaryResponse], int]:
        conditions = []
        if search and search.strip():
            conditions.append(customer_search_clause(search))
        if status:
            conditions.append(Customer.status == status)

        total = await self.db.scalar(select(func.count()).select_from(Customer).where(*conditions))
        query = (
            select(Customer)
            .where(*conditions)
            .order_by(Customer.created_at.desc())
            .limit(min(limit, 100))
            .offset(max(offset, 0))
        )
        customers = (await self.db.execute(query)).scalars().all()

        if not customers:
            return [], int(total or 0)

        customer_ids = [c.id for c in customers]
        count_rows = await self.db.execute(
            select(LoanApplication.customer_id, func.count())
            .where(LoanApplication.customer_id.in_(customer_ids))
            .group_by(LoanApplication.customer_id)
        )
        counts = dict(count_rows.all())

        return [
            CustomerSummaryResponse.from_customer(c, application_count=counts.get(c.id, 0))
            for c in customers
        ], int(total or 0)

    async def get_customer(self, customer_id: str) -> CustomerDetailResponse:
        customer = await self._get_customer(customer_id)
        loan_svc = LoanService(self.db)
        applications = await loan_svc.list_applications(customer_id=customer_id)

        active_statuses = {
            ApplicationStatus.SUBMITTED,
            ApplicationStatus.UNDER_REVIEW,
            ApplicationStatus.DOCUMENTS_INCOMPLETE,
            ApplicationStatus.APPROVED,
            ApplicationStatus.READY_TO_DISBURSE,
        }
        disbursed = [a for a in applications if a.status == ApplicationStatus.DISBURSED]
        # What was actually paid out (loan book), not the application's requested/approved figure.
        total_disbursed = await self.db.scalar(
            select(func.coalesce(func.sum(Loan.disbursed_amount), 0)).where(Loan.customer_id == customer_id)
        )

        stats = CustomerStatsResponse(
            total_applications=len(applications),
            active_applications=sum(1 for a in applications if a.status in active_statuses),
            disbursed_count=len(disbursed),
            total_disbursed_amount=float(total_disbursed or 0),
        )

        return CustomerDetailResponse.from_customer(
            customer,
            stats=stats,
            loan_applications=applications,
        )

    async def _get_customer(self, customer_id: str) -> Customer:
        result = await self.db.execute(select(Customer).where(Customer.id == customer_id))
        customer = result.scalar_one_or_none()
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
        return customer
