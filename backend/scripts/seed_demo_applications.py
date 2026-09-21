"""Seed submitted demo loan applications for admin UI testing."""

import asyncio
import io
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.core.database import AsyncSessionLocal, engine
from app.models import Base
from app.modules.loans.constants import PRODUCT_DOCUMENTS
from app.modules.loans.schemas import (
    ApplicationChannel,
    CreateApplicationRequest,
    GuarantorInput,
    LoanProductCode,
    UpdateApplicationStepRequest,
)
from app.modules.loans.service import LoanService, seed_loan_products
from app.modules.loans.workflow_seed import seed_default_workflows
from app.modules.users.models import Customer, CustomerStatus
from app.modules.admin.service import seed_super_admin
from app.core.config import settings
from scripts.sync_schema import sync_loan_workflow_schema

DEMO_APPLICANTS = [
    {"name": "Emeka Nwosu", "bvn": "22222222222", "phone": "08011111111", "product": "business_loan", "amount": "1500000", "gender": "Male", "dob": date(1992, 3, 14), "state_res": "LAGOS", "state_origin": "ANAMBRA"},
    {"name": "Fatima Abdullahi", "bvn": "33333333333", "phone": "08022222222", "product": "business_loan", "amount": "800000", "gender": "Female", "dob": date(1988, 7, 22), "state_res": "KANO", "state_origin": "KANO"},
    {"name": "Ibrahim Musa", "bvn": "44444444444", "phone": "08033333333", "product": "business_loan", "amount": "2200000", "gender": "Male", "dob": date(1985, 11, 5), "state_res": "ABUJA", "state_origin": "KADUNA"},
    {"name": "Grace Adeyemi", "bvn": "55555555555", "phone": "08044444444", "product": "payday_loan", "amount": "120000", "gender": "Female", "dob": date(1996, 1, 30), "state_res": "LAGOS", "state_origin": "OYO"},
    {"name": "Tunde Bakare", "bvn": "66666666666", "phone": "08055555555", "product": "payday_loan", "amount": "95000", "gender": "Male", "dob": date(1990, 9, 18), "state_res": "OGUN", "state_origin": "OGUN"},
    {"name": "Ngozi Okonkwo", "bvn": "77777777777", "phone": "08066666666", "product": "payday_loan", "amount": "200000", "gender": "Female", "dob": date(1994, 4, 8), "state_res": "ENUGU", "state_origin": "ENUGU"},
    {"name": "Chidi Eze", "bvn": "88888888888", "phone": "08077777777", "product": "study_loan", "amount": "3800000", "gender": "Male", "dob": date(2001, 6, 12), "state_res": "LAGOS", "state_origin": "IMO"},
    {"name": "Amina Hassan", "bvn": "99999999999", "phone": "08088888888", "product": "study_loan", "amount": "4200000", "gender": "Female", "dob": date(1999, 12, 2), "state_res": "KADUNA", "state_origin": "KATSINA"},
    {"name": "David Ojo", "bvn": "11111111111", "phone": "08099999999", "product": "asset_loan", "amount": "2100000", "gender": "Male", "dob": date(1987, 8, 25), "state_res": "RIVERS", "state_origin": "DELTA"},
    {"name": "Blessing Udo", "bvn": "12121212121", "phone": "08010101010", "product": "asset_loan", "amount": "1750000", "gender": "Female", "dob": date(1993, 2, 17), "state_res": "AKWA IBOM", "state_origin": "AKWA IBOM"},
]

PRODUCT_DATA = {
    "business_loan": {"years_in_operation": 5, "trade_type": "provisions", "monthly_cash_flow": 800000},
    "payday_loan": {"employer_name": "Lagos State Govt", "salary_pay_day": 25, "monthly_salary": 350000},
    "study_loan": {"student_full_name": "Student One", "school_name": "University of Lagos", "tuition_total": 5000000},
    "asset_loan": {"asset_description": "Toyota Corolla 2020", "asset_value": 8500000, "vendor_name": "Auto Dealer Ltd"},
}


async def _ensure_customer(session, *, name: str, bvn: str, phone: str, gender: str, dob: date, state_res: str, state_origin: str) -> Customer:
    result = await session.execute(select(Customer).where(Customer.bvn == bvn))
    existing = result.scalar_one_or_none()
    if existing:
        if not existing.gender:
            existing.gender = gender
            existing.date_of_birth = dob
            existing.state_of_residence = state_res
            existing.state_of_origin = state_origin
        return existing

    parts = name.split(" ", 1)
    first = parts[0]
    last = parts[1] if len(parts) > 1 else "Demo"
    customer = Customer(
        account_number=f"GH{ bvn[-8:] }",
        branch=settings.default_branch,
        status=CustomerStatus.ACTIVE,
        bvn=bvn,
        first_name=first,
        last_name=last,
        phone_primary=Customer.normalize_phone(phone),
        phone_verified=True,
        email=f"{first.lower()}.{last.lower()}@example.com",
        gender=gender,
        date_of_birth=dob,
        state_of_residence=state_res,
        state_of_origin=state_origin,
    )
    session.add(customer)
    await session.flush()
    return customer


class _FakeUpload:
    def __init__(self, filename: str = "demo.pdf"):
        self.file = io.BytesIO(b"%PDF-1.4 demo")
        self.filename = filename
        self.content_type = "application/pdf"

    async def read(self):
        return self.file.read()

    async def seek(self, pos: int):
        self.file.seek(pos)


async def _seed_one(session, applicant: dict) -> str:
    customer = await _ensure_customer(
        session,
        name=applicant["name"],
        bvn=applicant["bvn"],
        phone=applicant["phone"],
        gender=applicant["gender"],
        dob=applicant["dob"],
        state_res=applicant["state_res"],
        state_origin=applicant["state_origin"],
    )
    svc = LoanService(session)
    product_code = applicant["product"]

    app = await svc.create_application(
        customer,
        CreateApplicationRequest(product_code=LoanProductCode(product_code), channel=ApplicationChannel.WEB),
    )

    await svc.update_application_step(
        app.id,
        customer.id,
        UpdateApplicationStepRequest(
            step=6,
            total_steps=6,
            universal_form={
                "full_name": applicant["name"],
                "residential_address": "12 Demo Street, Lagos",
                "bank_name": "GTBank",
                "bank_account_name": applicant["name"],
                "bank_account_number": "0123456789",
                "next_of_kin_name": "Demo Kin",
                "next_of_kin_phone": "08030000000",
                "next_of_kin_relationship": "Sibling",
                "requested_amount": applicant["amount"],
                "purpose": "Demo application for testing",
                "monthly_income": "400000",
                "repayment_period": "6 months",
                "source_of_repayment": "Business income",
            },
            product_data=PRODUCT_DATA.get(product_code, {}),
            guarantors=[GuarantorInput(full_name="Demo Guarantor", phone="08021112222", relationship="Friend")],
        ),
    )

    for doc_type in PRODUCT_DOCUMENTS.get(product_code, ()):
        await svc.upload_document(app.id, customer.id, doc_type, _FakeUpload(f"{doc_type}.pdf"))

    submitted = await svc.submit_application(app.id, customer.id)
    return submitted.id


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

        ids: list[str] = []
        for applicant in DEMO_APPLICANTS:
            app_id = await _seed_one(session, applicant)
            ids.append(app_id)
            print(f"  ✓ {applicant['name']} — {applicant['product']} — {app_id}")

        await session.commit()
        print(f"\nSeeded {len(ids)} submitted loan applications.")


if __name__ == "__main__":
    asyncio.run(seed())
