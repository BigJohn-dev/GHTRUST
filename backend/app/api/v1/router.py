from fastapi import APIRouter

from app.modules.admin.router import router as admin_router
from app.modules.auth.router import router as auth_router
from app.modules.loans.admin_router import router as admin_loans_router
from app.modules.contributions.router import router as contributions_router
from app.modules.food_basket.router import router as food_basket_router
from app.modules.payments.router import router as wallet_router
from app.modules.payments.webhook_router import router as paystack_webhook_router
from app.modules.investments.router import router as investments_router
from app.modules.loans.router import router as loans_router
from app.modules.admin.settings_router import router as admin_settings_router
from app.modules.savings.router import router as savings_router
from app.modules.users.admin_router import router as admin_customers_router

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router)
api_v1_router.include_router(admin_router)
api_v1_router.include_router(admin_settings_router)
api_v1_router.include_router(admin_customers_router)
api_v1_router.include_router(admin_loans_router)
api_v1_router.include_router(savings_router)
api_v1_router.include_router(loans_router)
api_v1_router.include_router(investments_router)
api_v1_router.include_router(contributions_router)
api_v1_router.include_router(food_basket_router)
api_v1_router.include_router(wallet_router)
api_v1_router.include_router(paystack_webhook_router)


@api_v1_router.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "service": "ghtrust-mfb-api", "version": "0.1.0"}
