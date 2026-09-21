from fastapi import APIRouter, HTTPException, status

from app.core.deps import DbSession
from app.modules.food_basket.schemas import (
    FoodBasketPlanResponse,
    FoodBasketSubscriptionResponse,
    SubscribeRequest,
)
from app.modules.food_basket.service import FoodBasketService

router = APIRouter(prefix="/food-basket", tags=["Food Basket"])


@router.get("/plans", response_model=list[FoodBasketPlanResponse])
async def list_food_basket_plans(db: DbSession):
    return await FoodBasketService(db).list_plans()


@router.get("/customers/{customer_id}/subscriptions", response_model=list[FoodBasketSubscriptionResponse])
async def list_subscriptions(customer_id: str, db: DbSession):
    return await FoodBasketService(db).list_subscriptions(customer_id)


@router.post(
    "/customers/{customer_id}/subscribe",
    response_model=FoodBasketSubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def subscribe_to_food_basket(
    customer_id: str, payload: SubscribeRequest, db: DbSession
):
    try:
        return await FoodBasketService(db).subscribe(customer_id, payload)
    except NotImplementedError as e:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(e))
