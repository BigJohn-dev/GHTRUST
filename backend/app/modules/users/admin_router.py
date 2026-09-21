from fastapi import APIRouter, Depends, Query

from app.core.deps import DbSession
from app.modules.admin.deps import require_permission
from app.modules.admin.models import Staff
from app.modules.admin.permissions import LOAN_READ
from app.modules.users.models import CustomerStatus
from app.modules.users.schemas import CustomerDetailResponse, CustomerSummaryResponse
from app.modules.users.service import CustomerAdminService

router = APIRouter(prefix="/admin/customers", tags=["Admin — Customers"])


@router.get("", response_model=list[CustomerSummaryResponse], summary="List customers")
async def list_customers(
    db: DbSession,
    search: str | None = Query(None, min_length=1, max_length=100),
    status: CustomerStatus | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _: Staff = Depends(require_permission(LOAN_READ)),
):
    return await CustomerAdminService(db).list_customers(
        search=search,
        status=status,
        limit=limit,
        offset=offset,
    )


@router.get("/{customer_id}", response_model=CustomerDetailResponse, summary="Get customer detail")
async def get_customer(
    customer_id: str,
    db: DbSession,
    _: Staff = Depends(require_permission(LOAN_READ)),
):
    return await CustomerAdminService(db).get_customer(customer_id)
