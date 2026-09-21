from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.food_basket.models import FoodBasketPlan, FoodBasketSubscription
from app.modules.food_basket.schemas import (
    FoodBasketPlanResponse,
    FoodBasketSubscriptionResponse,
    SubscribeRequest,
)


class FoodBasketService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_plans(self) -> list[FoodBasketPlanResponse]:
        result = await self.db.execute(
            select(FoodBasketPlan).where(FoodBasketPlan.is_active.is_(True))
        )
        return [FoodBasketPlanResponse.model_validate(p) for p in result.scalars().all()]

    async def list_subscriptions(self, customer_id: str) -> list[FoodBasketSubscriptionResponse]:
        result = await self.db.execute(
            select(FoodBasketSubscription).where(
                FoodBasketSubscription.customer_id == customer_id
            )
        )
        rows = result.scalars().all()
        return [
            FoodBasketSubscriptionResponse(
                id=r.id,
                customer_id=r.customer_id,
                plan_name="",
                monthly_price=r.monthly_price,
                status=r.status,
                next_delivery_date=r.next_delivery_date,
                delivery_address=r.delivery_address,
            )
            for r in rows
        ]

    async def subscribe(self, customer_id: str, payload: SubscribeRequest) -> FoodBasketSubscriptionResponse:
        raise NotImplementedError("Billing + fulfillment partner integration in next phase")
