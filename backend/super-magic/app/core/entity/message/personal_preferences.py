"""客户端消息中的个人偏好配置。"""

from typing import Any

from pydantic import BaseModel, Field, validator


class PersonalPreferences(BaseModel):
    """用户个人偏好配置。"""

    long_term_memory_enabled: bool = Field(
        default=True,
        description="是否启用通用长期记忆自动功能",
    )
    show_follow_up_suggestions: bool = Field(
        default=True,
        description="是否在主任务中触发追加问题生成",
    )

    @validator("long_term_memory_enabled", pre=True, always=True)
    def validate_long_term_memory_enabled(cls, value: Any) -> bool:
        """缺失或非法值按开启处理，兼容旧消息和脏数据。"""
        return value if isinstance(value, bool) else True

    @validator("show_follow_up_suggestions", pre=True, always=True)
    def validate_show_follow_up_suggestions(cls, value: Any) -> bool:
        """缺失或非法值按开启处理；明确的 false 必须保留。"""
        return value if isinstance(value, bool) else True
