"""Loan product codes, document types, and seed definitions."""

from decimal import Decimal

BUSINESS_LOAN = "business_loan"
PAYDAY_LOAN = "payday_loan"
STUDY_LOAN = "study_loan"
ASSET_LOAN = "asset_loan"
LPO_LOAN = "lpo_invoice_financing"

# Universal + product-specific document type codes
DOC_VALID_ID = "valid_id"
DOC_BVN = "bvn"
DOC_PASSPORT_PHOTO = "passport_photo"
DOC_PASSPORT_PHOTO_2 = "passport_photo_2"
DOC_SHOP_RENT_RECEIPT = "shop_rent_receipt"
DOC_CASH_FLOW_PROOF = "cash_flow_proof"
DOC_SALARY_STATEMENT_6M = "salary_statement_6m"
DOC_STAFF_ID = "staff_id"
DOC_UTILITY_BILL = "utility_bill"
DOC_PRESIGNED_CHEQUE = "presigned_cheque"
DOC_COLLATERAL_AFFIDAVIT = "collateral_affidavit"
DOC_COLLATERAL_ORIGINAL = "collateral_original"
DOC_GUARANTOR_ID = "guarantor_id"
DOC_GUARANTOR_PHOTO = "guarantor_photo"
DOC_GUARANTOR_PHOTO_2 = "guarantor_photo_2"
DOC_ADMISSION_LETTER = "admission_letter"
DOC_RELATIONSHIP_PROOF = "relationship_proof"
DOC_COLLATERAL_C_OF_O = "collateral_c_of_o"
DOC_OFFER_LETTER_SIGNED = "offer_letter_signed"
DOC_COURT_AFFIDAVIT = "court_affidavit"
DOC_INCOME_PROOF = "income_proof"

UNIVERSAL_DOCUMENT_TYPES = (
    DOC_VALID_ID,
    DOC_BVN,
)

PRODUCT_DOCUMENTS: dict[str, tuple[str, ...]] = {
    BUSINESS_LOAN: (
        DOC_VALID_ID,
        DOC_BVN,
        DOC_PASSPORT_PHOTO,
        DOC_PASSPORT_PHOTO_2,
        DOC_SHOP_RENT_RECEIPT,
        DOC_CASH_FLOW_PROOF,
        DOC_GUARANTOR_ID,
        DOC_GUARANTOR_PHOTO,
        DOC_COLLATERAL_ORIGINAL,
    ),
    PAYDAY_LOAN: (
        DOC_VALID_ID,
        DOC_BVN,
        DOC_PASSPORT_PHOTO,
        DOC_SALARY_STATEMENT_6M,
        DOC_STAFF_ID,
        DOC_UTILITY_BILL,
        DOC_PRESIGNED_CHEQUE,
        DOC_COLLATERAL_AFFIDAVIT,
        DOC_COLLATERAL_ORIGINAL,
        DOC_GUARANTOR_ID,
        DOC_GUARANTOR_PHOTO,
    ),
    STUDY_LOAN: (
        DOC_VALID_ID,
        DOC_ADMISSION_LETTER,
        DOC_RELATIONSHIP_PROOF,
        DOC_STAFF_ID,
        DOC_UTILITY_BILL,
        DOC_SALARY_STATEMENT_6M,
        DOC_PRESIGNED_CHEQUE,
        DOC_COLLATERAL_C_OF_O,
        DOC_GUARANTOR_ID,
        DOC_GUARANTOR_PHOTO,
    ),
    ASSET_LOAN: (
        DOC_VALID_ID,
        DOC_PASSPORT_PHOTO,
        DOC_PASSPORT_PHOTO_2,
        DOC_INCOME_PROOF,
        DOC_GUARANTOR_ID,
        DOC_GUARANTOR_PHOTO,
        DOC_GUARANTOR_PHOTO_2,
        DOC_COURT_AFFIDAVIT,
    ),
}

PRODUCT_WIZARD_STEPS: dict[str, list[str]] = {
    BUSINESS_LOAN: [
        "product_selection",
        "universal_form",
        "business_details",
        "guarantor_collateral",
        "documents",
        "review_submit",
    ],
    PAYDAY_LOAN: [
        "product_selection",
        "universal_form",
        "employment_details",
        "guarantor_collateral",
        "documents",
        "review_submit",
    ],
    STUDY_LOAN: [
        "product_selection",
        "universal_form",
        "student_school_details",
        "guardian_details",
        "guarantor_collateral",
        "documents",
        "review_submit",
    ],
    ASSET_LOAN: [
        "product_selection",
        "universal_form",
        "asset_details",
        "guarantor_collateral",
        "documents",
        "review_submit",
    ],
}

# Every application step the customer apps have screens for, in their usual order.
WIZARD_STEPS: tuple[str, ...] = (
    "product_selection",
    "universal_form",
    "business_details",
    "employment_details",
    "student_school_details",
    "guardian_details",
    "asset_details",
    "guarantor_collateral",
    "documents",
    "review_submit",
)

LOAN_PRODUCT_SEED: list[dict] = [
    {
        "code": BUSINESS_LOAN,
        "name": "GH Trust Business Loan",
        "description": "For traders buying and selling products and commodities. Existing businesses only (3+ years).",
        "is_active": True,
        "processing_fee_pct": Decimal("3.00"),
        "interest_rate_pct_monthly": Decimal("8.00"),
        "max_tenure_days": None,
        "default_penalty_pct_daily": None,
        "repayment_cadence_options": ["daily", "weekly", "monthly"],
        "required_document_types": list(PRODUCT_DOCUMENTS[BUSINESS_LOAN]),
        "workflow_steps": PRODUCT_WIZARD_STEPS[BUSINESS_LOAN],
        "eligibility_rules": {
            "min_years_in_business": 3,
            "business_type": "trader",
            "requires_shop_proof": True,
            "requires_cash_flow_proof": True,
        },
    },
    {
        "code": PAYDAY_LOAN,
        "name": "Payday Loan",
        "description": "Salary earner loan with Remita direct debit on salary account.",
        "is_active": True,
        "processing_fee_pct": Decimal("3.00"),
        "interest_rate_pct_monthly": Decimal("8.00"),
        "max_tenure_days": 120,
        "default_penalty_pct_daily": Decimal("1.50"),
        "repayment_cadence_options": ["salary_date"],
        "required_document_types": list(PRODUCT_DOCUMENTS[PAYDAY_LOAN]),
        "workflow_steps": PRODUCT_WIZARD_STEPS[PAYDAY_LOAN],
        "eligibility_rules": {
            "borrower_type": "salary_earner",
            "min_salary_statement_months": 6,
            "requires_remita_mandate": True,
            "no_cash_repayment": True,
        },
    },
    {
        "code": STUDY_LOAN,
        "name": "GH Trust Study Loan",
        "description": "Study abroad tuition financing (Famolex affiliation). Guardian applies on behalf of student.",
        "is_active": True,
        "processing_fee_pct": Decimal("3.00"),
        "interest_rate_pct_monthly": Decimal("8.00"),
        "max_tenure_days": 180,
        "default_penalty_pct_daily": None,
        "repayment_cadence_options": ["monthly"],
        "required_document_types": list(PRODUCT_DOCUMENTS[STUDY_LOAN]),
        "workflow_steps": PRODUCT_WIZARD_STEPS[STUDY_LOAN],
        "eligibility_rules": {
            "ghtrust_contribution_pct": 70,
            "applicant_contribution_pct": 30,
            "tuition_year": 1,
            "guardian_min_years_employed": 5,
            "guardian_max_age": 50,
            "guardian_resident_nigeria": True,
            "disburse_to": "school_account",
            "processing_days": 7,
        },
    },
    {
        "code": ASSET_LOAN,
        "name": "Asset Loan",
        "description": "Asset financing — asset purchased in GH Trust name until fully repaid.",
        "is_active": True,
        "processing_fee_pct": Decimal("3.00"),
        "interest_rate_pct_monthly": Decimal("8.00"),
        "max_tenure_days": None,
        "default_penalty_pct_daily": None,
        "repayment_cadence_options": ["monthly"],
        "required_document_types": list(PRODUCT_DOCUMENTS[ASSET_LOAN]),
        "workflow_steps": PRODUCT_WIZARD_STEPS[ASSET_LOAN],
        "eligibility_rules": {
            "asset_owner_until_paid": "ghtrust_international_ltd",
            "requires_court_affidavit": True,
            "requires_verifiable_income": True,
        },
    },
    {
        "code": LPO_LOAN,
        "name": "LPO / Invoice Financing",
        "description": "Reserved for future release.",
        "is_active": False,
        "processing_fee_pct": Decimal("3.00"),
        "interest_rate_pct_monthly": Decimal("8.00"),
        "max_tenure_days": None,
        "default_penalty_pct_daily": None,
        "repayment_cadence_options": ["monthly"],
        "required_document_types": [],
        "workflow_steps": [],
        "eligibility_rules": {},
    },
]

DOCUMENT_LABELS: dict[str, str] = {
    DOC_VALID_ID: "Valid means of identification",
    DOC_BVN: "BVN verification",
    DOC_PASSPORT_PHOTO: "Recent passport photograph",
    DOC_PASSPORT_PHOTO_2: "Second passport photograph",
    DOC_SHOP_RENT_RECEIPT: "Shop rent receipt / proof of ownership",
    DOC_CASH_FLOW_PROOF: "Verifiable cash flow proof",
    DOC_SALARY_STATEMENT_6M: "6 months salary account statement",
    DOC_STAFF_ID: "Staff ID card",
    DOC_UTILITY_BILL: "Utility bill (not older than 3 months)",
    DOC_PRESIGNED_CHEQUE: "Pre-signed cheque on salary account",
    DOC_COLLATERAL_AFFIDAVIT: "Affidavit for collateral",
    DOC_COLLATERAL_ORIGINAL: "Original collateral documents",
    DOC_GUARANTOR_ID: "Guarantor valid ID",
    DOC_GUARANTOR_PHOTO: "Guarantor passport photograph",
    DOC_GUARANTOR_PHOTO_2: "Guarantor second passport photograph",
    DOC_ADMISSION_LETTER: "Student admission letter",
    DOC_RELATIONSHIP_PROOF: "Proof of relationship with student",
    DOC_COLLATERAL_C_OF_O: "Collateral C of O (Lagos property)",
    DOC_OFFER_LETTER_SIGNED: "Signed offer letter",
    DOC_COURT_AFFIDAVIT: "Court affidavit (asset as collateral)",
    DOC_INCOME_PROOF: "Proof of verifiable income",
}
