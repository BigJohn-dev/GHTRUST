"""Required documents must be verified by staff before a loan is approved or paid out.

Checked at final workflow approval and again immediately before any disbursement
(rail or manual), because a document can still be marked rejected after approval.
Callers must pass an application with ``product`` and ``documents`` loaded.
"""

from fastapi import status

from app.core.errors import AppError, ErrorCode
from app.modules.loans.constants import DOCUMENT_LABELS
from app.modules.loans.models import DocumentStatus, LoanApplication


def unverified_required_documents(application: LoanApplication) -> list[str]:
    """Labels of required documents that are missing or not yet verified."""
    by_type = {d.document_type: d for d in application.documents}
    outstanding = []
    for doc_type in application.product.required_document_types:
        doc = by_type.get(doc_type)
        if doc is None or doc.status != DocumentStatus.VERIFIED:
            outstanding.append(DOCUMENT_LABELS.get(doc_type, doc_type))
    return outstanding


def ensure_documents_verified(application: LoanApplication, *, action: str) -> None:
    outstanding = unverified_required_documents(application)
    if outstanding:
        raise AppError(
            status.HTTP_409_CONFLICT,
            ErrorCode.DOCUMENTS_NOT_VERIFIED,
            f"All required documents must be verified before {action}. Outstanding: {', '.join(outstanding)}.",
            errors=[{"field": "documents", "message": label} for label in outstanding],
        )
