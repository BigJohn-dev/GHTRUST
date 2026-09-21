from pydantic import BaseModel

from app.modules.loans.workflow_schemas import AuditLogResponse


class AdminSettingsResponse(BaseModel):
    app_name: str
    app_env: str
    debug: bool
    default_branch: str
    dojah_enabled: bool
    dojah_mock: bool
    sms_mock: bool
    rate_limits_active: bool
    otp_expire_seconds: int
    max_upload_size_mb: int


class BranchSummaryResponse(BaseModel):
    name: str
    customer_count: int


class GlobalAuditLogResponse(AuditLogResponse):
    application_id: str
