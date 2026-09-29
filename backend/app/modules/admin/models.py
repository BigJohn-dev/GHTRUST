import enum

from sqlalchemy import Boolean, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import StrEnum, TimestampMixin, UUIDPrimaryKeyMixin


class StaffStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class Role(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    permissions: Mapped[list[str]] = mapped_column(JSON, default=list)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)

    staff_members: Mapped[list["Staff"]] = relationship("Staff", back_populates="role")


class Staff(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "staff"

    full_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    # Self-service profile (PATCH /admin/auth/me).
    job_title: Mapped[str | None] = mapped_column(String(100), nullable=True)
    avatar_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    role_id: Mapped[str | None] = mapped_column(
        ForeignKey("roles.id", ondelete="SET NULL"), nullable=True, index=True
    )
    is_super_admin: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    status: Mapped[StaffStatus] = mapped_column(
        StrEnum(StaffStatus), default=StaffStatus.INACTIVE, index=True
    )

    role: Mapped[Role | None] = relationship("Role", back_populates="staff_members", lazy="joined")

    @property
    def effective_permissions(self) -> set[str]:
        if self.is_super_admin:
            from app.modules.admin.permissions import ALL_PERMISSIONS

            return set(ALL_PERMISSIONS)
        if self.role and self.role.permissions:
            return set(self.role.permissions)
        return set()

    def has_permission(self, permission: str) -> bool:
        return permission in self.effective_permissions
