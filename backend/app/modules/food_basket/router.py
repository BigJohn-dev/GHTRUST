from fastapi import APIRouter, HTTPException, status

from app.core.deps import CurrentCustomer, DbSession
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


@router.get("/me/subscriptions", response_model=list[FoodBasketSubscriptionResponse])
async def list_my_subscriptions(db: DbSession, customer: CurrentCustomer):
    return await FoodBasketService(db).list_subscriptions(customer.id)


@router.post(
    "/me/subscriptions",
    response_model=FoodBasketSubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def subscribe_to_food_basket(
    payload: SubscribeRequest, db: DbSession, customer: CurrentCustomer
):
    try:
        return await FoodBasketService(db).subscribe(customer.id, payload)
    except NotImplementedError as e:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(e))
