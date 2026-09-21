import enum
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class GroupStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    SUSPENDED = "suspended"


class ContributionGroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    leader_id: str
    leader_name: str
    member_count: int
    target_amount: Decimal
    collected_amount: Decimal
    cycle: int
    branch: str
    next_meeting: date | None = None
    status: GroupStatus
    service_fee_percent: Decimal = Decimal("2")


class ContributionCreate(BaseModel):
    group_id: str
    amount: Decimal = Field(gt=0)
    cycle: int | None = None


class ContributionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    group_id: str
    member_id: str
    member_name: str
    amount: Decimal
    cycle: int
    contributed_at: date


class JoinGroupRequest(BaseModel):
    group_id: str
