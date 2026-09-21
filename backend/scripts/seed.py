"""Seed default products and super admin staff."""

import asyncio
import sys
from decimal import Decimal
from pathlib import Path

# Allow `python scripts/seed.py` without PYTHONPATH
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.models import Base
from app.modules.admin.service import seed_super_admin
from app.modules.food_basket.models import FoodBasketPlan
from app.modules.food_basket.schemas import FoodBasketPlanType
from app.modules.investments.models import InvestmentPlan
from app.modules.investments.schemas import RiskLevel
from app.modules.loans.service import seed_loan_products
from app.modules.loans.workflow_seed import seed_default_workflows
from app.modules.savings.models import SavingsProduct
from app.modules.savings.schemas import SavingsProductType
from scripts.sync_schema import sync_loan_workflow_schema


async def seed() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await sync_loan_workflow_schema(conn)

    async with AsyncSessionLocal() as session:
        await seed_super_admin(
            session,
            full_name=settings.seed_super_admin_name,
            email=settings.seed_super_admin_email,
            phone=settings.seed_super_admin_phone,
        )

        await seed_loan_products(session)
        await seed_default_workflows(session)

        savings_products = [
            SavingsProduct(name="Yearly Thrift", product_type=SavingsProductType.YEARLY_THRIFT, interest_rate=Decimal("12"), min_deposit=Decimal("5000"), description="12-month locked savings"),
            SavingsProduct(name="Regular Savings", product_type=SavingsProductType.REGULAR, interest_rate=Decimal("8"), min_deposit=Decimal("1000"), description="Flexible access savings"),
            SavingsProduct(name="Fixed Savings", product_type=SavingsProductType.FIXED, interest_rate=Decimal("15"), min_deposit=Decimal("50000"), description="Premium fixed deposit"),
            SavingsProduct(name="Save to Invest", product_type=SavingsProductType.SAVE_TO_INVEST, interest_rate=Decimal("7.5"), min_deposit=Decimal("10000"), description="Interest converts to investment capital"),
        ]
        investment_plans = [
            InvestmentPlan(name="Secure Growth Fund", min_amount=Decimal("50000"), return_rate=Decimal("14"), tenure_months=12, risk=RiskLevel.LOW, description="Conservative treasury-backed fund"),
            InvestmentPlan(name="Balanced Portfolio", min_amount=Decimal("100000"), return_rate=Decimal("18"), tenure_months=18, risk=RiskLevel.MEDIUM, description="Mixed bonds and commercial paper"),
            InvestmentPlan(name="High Yield Fund", min_amount=Decimal("250000"), return_rate=Decimal("24"), tenure_months=24, risk=RiskLevel.HIGH, description="SME lending returns"),
        ]
        food_plans = [
            FoodBasketPlan(name="Basic Basket", plan_type=FoodBasketPlanType.BASIC, monthly_price=Decimal("15000"), description="Essential household items", items_included=["Rice 5kg", "Oil 1L", "Tomato paste", "Spaghetti"]),
            FoodBasketPlan(name="Standard Basket", plan_type=FoodBasketPlanType.STANDARD, monthly_price=Decimal("25000"), description="Family essentials pack", items_included=["Rice 10kg", "Oil 2L", "Protein", "Vegetables"]),
            FoodBasketPlan(name="Premium Basket", plan_type=FoodBasketPlanType.PREMIUM, monthly_price=Decimal("45000"), description="Full household nutrition plan", items_included=["Rice 10kg", "Oil 3L", "Protein", "Vegetables", "Snacks", "Beverages"]),
        ]

        for item in savings_products + investment_plans + food_plans:
            session.add(item)

        await session.commit()
        print(
            "Seed complete: super admin, loan products, workflows, savings, investments, food basket"
        )


if __name__ == "__main__":
    asyncio.run(seed())
