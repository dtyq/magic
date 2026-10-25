"""当前服务对象的查询结果；与消息 metadata.user 分开维护。"""

from enum import StrEnum
from typing import Self

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator


class UserAccountDataStatus(StrEnum):
    AVAILABLE = "available"
    NONE = "none"
    UNSUPPORTED = "unsupported"
    UNAVAILABLE = "unavailable"


class UserContextModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="ignore", coerce_numbers_to_str=True)


class UserDepartment(UserContextModel):
    id: str
    name: str = ""
    path: str = ""


class UserProfile(UserContextModel):
    """认证账户的基础资料与当前组织来源身份。"""

    id: str = Field(min_length=1)
    magic_id: str = Field(min_length=1)
    third_platform_id: str = Field(default="", strict=True)
    nickname: str = ""
    real_name: str = ""
    avatar_url: str = ""
    work_number: str = ""
    position: str = ""
    email: str = ""
    phone: str = ""
    departments: tuple[UserDepartment, ...] = ()

    @field_validator("third_platform_id", mode="before")
    @classmethod
    def normalize_third_platform_id(cls, value: object) -> object:
        """兼容历史空值，其他非法类型仍交由模型拒绝。"""
        return "" if value is None else value


class OrganizationContext(UserContextModel):
    code: str = Field(min_length=1)
    name: str = ""


class SubscriptionContext(UserContextModel):
    status: UserAccountDataStatus
    scope: str = "organization"
    captured_at: AwareDatetime | None = None
    id: str | None = None
    name: str | None = None
    plan_type: str | None = None
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None

    @model_validator(mode="after")
    def validate_status(self) -> Self:
        queried = self.status in (UserAccountDataStatus.AVAILABLE, UserAccountDataStatus.NONE)
        if queried != (self.captured_at is not None):
            raise ValueError("Subscription query time does not match status")
        if self.status == UserAccountDataStatus.AVAILABLE:
            if not self.id and not self.name:
                raise ValueError("Available subscription requires an ID or name")
        elif any(value is not None for value in (self.id, self.name, self.plan_type, self.starts_at, self.ends_at)):
            raise ValueError("Subscription details require available status")
        return self


class PointsContext(UserContextModel):
    status: UserAccountDataStatus
    scope: str = "current_user_visible"
    captured_at: AwareDatetime | None = None
    available: int | float | None = Field(default=None, allow_inf_nan=False)

    @field_validator("available", mode="before")
    @classmethod
    def validate_amount_type(cls, value: object) -> object:
        if isinstance(value, bool) or (value is not None and not isinstance(value, (int, float))):
            raise ValueError("Points amount must be numeric")
        return value

    @model_validator(mode="after")
    def validate_status(self) -> Self:
        if self.status == UserAccountDataStatus.NONE:
            raise ValueError("Points cannot have none status")
        if self.status == UserAccountDataStatus.AVAILABLE:
            if self.captured_at is None or self.available is None:
                raise ValueError("Available points require a value and query time")
        elif self.captured_at is not None or self.available is not None:
            raise ValueError("Unavailable points cannot contain a balance or query time")
        return self


class UserContext(UserContextModel):
    captured_at: AwareDatetime
    user: UserProfile
    organization: OrganizationContext
    subscription: SubscriptionContext
    points: PointsContext


class UserContextSnapshot(UserContextModel):
    """失败可保留同一主体的旧资料和旧时间；不能把旧余额当作新查询结果。"""

    user_id: str
    organization_code: str
    context: UserContext | None = None
    status: UserAccountDataStatus
    attempted_at: AwareDatetime

    @model_validator(mode="after")
    def validate_subject(self) -> Self:
        if self.status not in (UserAccountDataStatus.AVAILABLE, UserAccountDataStatus.UNAVAILABLE):
            raise ValueError("Invalid user context query status")
        if self.status == UserAccountDataStatus.AVAILABLE and self.context is None:
            raise ValueError("Successful user context query requires a profile")
        if self.context is not None and (
            self.context.user.id != self.user_id
            or self.context.organization.code != self.organization_code
        ):
            raise ValueError("Snapshot subject does not match user context")
        return self
