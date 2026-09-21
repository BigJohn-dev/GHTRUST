from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.loans.models import LoanApplication
from app.modules.loans.schemas import ApplicationStatus
from app.modules.loans.service import LoanService
from app.modules.users.models import Customer, CustomerStatus
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
    ) -> list[CustomerSummaryResponse]:
        query = select(Customer).order_by(Customer.created_at.desc())
        if search:
            term = f"%{search.strip()}%"
            query = query.where(
                or_(
                    Customer.first_name.ilike(term),
                    Customer.last_name.ilike(term),
                    Customer.middle_name.ilike(term),
                    Customer.email.ilike(term),
                    Customer.account_number.ilike(term),
                    Customer.phone_primary.ilike(term),
                    Customer.bvn.ilike(term),
                )
            )
        if status:
            query = query.where(Customer.status == status)

        query = query.limit(min(limit, 100)).offset(max(offset, 0))
        result = await self.db.execute(query)
        customers = result.scalars().all()

        if not customers:
            return []

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
        ]

    async def get_customer(self, customer_id: str) -> CustomerDetailResponse:
        customer = await self._get_customer(customer_id)
        loan_svc = LoanService(self.db)
        applications = await loan_svc.list_applications(customer_id=customer_id)

        active_statuses = {
            ApplicationStatus.SUBMITTED,
            ApplicationStatus.UNDER_REVIEW,
            ApplicationStatus.APPROVED,
        }
        disbursed = [a for a in applications if a.status == ApplicationStatus.DISBURSED]
        total_disbursed = sum(
            float(a.approved_amount or a.requested_amount or 0) for a in disbursed
        )

        stats = CustomerStatsResponse(
            total_applications=len(applications),
            active_applications=sum(1 for a in applications if a.status in active_statuses),
            disbursed_count=len(disbursed),
            total_disbursed_amount=total_disbursed,
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
