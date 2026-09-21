from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.modules.loans.workflow_models import AuditActorType, AuditEventType, StageDecisionAction


class WorkflowStageInput(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    slug: str | None = Field(None, max_length=80)
    description: str | None = Field(None, max_length=255)
    approver_role_id: str


class WorkflowStageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sort_order: int
    name: str
    slug: str
    description: str | None
    approver_role_id: str
    approver_role_name: str | None = None


class WorkflowResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    version: int
    is_published: bool
    published_at: datetime | None
    stages: list[WorkflowStageResponse]

    @classmethod
    def from_workflow(cls, workflow) -> "WorkflowResponse":
        return cls(
            id=workflow.id,
            product_id=workflow.product_id,
            version=workflow.version,
            is_published=workflow.is_published,
            published_at=workflow.published_at,
            stages=[
                WorkflowStageResponse(
                    id=s.id,
                    sort_order=s.sort_order,
                    name=s.name,
                    slug=s.slug,
                    description=s.description,
                    approver_role_id=s.approver_role_id,
                    approver_role_name=s.approver_role.name if s.approver_role else None,
                )
                for s in sorted(workflow.stages, key=lambda x: x.sort_order)
            ],
        )


class CreateWorkflowRequest(BaseModel):
    stages: list[WorkflowStageInput] = Field(..., min_length=1)


class UpdateWorkflowStagesRequest(BaseModel):
    stages: list[WorkflowStageInput] = Field(..., min_length=1)


class StageActionRequest(BaseModel):
    action: StageDecisionAction
    note: str | None = Field(None, max_length=500)


class DisburseApplicationRequest(BaseModel):
    note: str | None = Field(None, max_length=500)


class StageDecisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    stage_id: str
    stage_name: str | None = None
    staff_id: str
    staff_name: str | None = None
    action: StageDecisionAction
    note: str | None
    entered_at: datetime
    decided_at: datetime
    duration_seconds: int

    @classmethod
    def from_decision(cls, decision) -> "StageDecisionResponse":
        return cls(
            id=decision.id,
            stage_id=decision.stage_id,
            stage_name=decision.stage.name if decision.stage else None,
            staff_id=decision.staff_id,
            staff_name=decision.staff.full_name if decision.staff else None,
            action=decision.action,
            note=decision.note,
            entered_at=decision.entered_at,
            decided_at=decision.decided_at,
            duration_seconds=decision.duration_seconds,
        )


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_type: AuditEventType
    actor_type: AuditActorType
    actor_id: str | None
    actor_label: str | None
    message: str | None
    event_metadata: dict
    ip_address: str | None
    created_at: datetime


class PipelineStageSummary(BaseModel):
    id: str
    sort_order: int
    name: str
    approver_role_name: str | None = None
    status: str  # completed | current | upcoming | rejected


class ApplicationWorkflowStateResponse(BaseModel):
    workflow_id: str | None
    workflow_version: int | None
    current_stage: WorkflowStageResponse | None
    current_stage_entered_at: datetime | None
    pipeline_stages: list[PipelineStageSummary] = Field(default_factory=list)
    stage_decisions: list[StageDecisionResponse]
    processing_duration_seconds: int | None
    submitted_at: datetime | None
    approved_at: datetime | None
    rejected_at: datetime | None
    disbursed_at: datetime | None
