from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from app.i18n import i18n


@dataclass
class FinalErrorInfo:
    """任务终态错误信息

    只保存稳定错误码和排查信息，不直接耦合展示文案。
    """
    error_code: str
    vendor_message: str = ""
    status_code: Optional[int] = None
    i18n_params: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class FinalErrorRenderConfig:
    """错误码到最终展示文案的映射配置"""
    i18n_key: str
    i18n_category: str = "common.messages"


FINAL_ERROR_RENDER_REGISTRY: dict[str, FinalErrorRenderConfig] = {
    "context_window_exceeded": FinalErrorRenderConfig(
        i18n_key="messages.context_window_exceeded",
    ),
}


def render_final_error(error_info: Optional[FinalErrorInfo]) -> Optional[str]:
    """将终态错误信息渲染为用户可见文案"""
    if error_info is None:
        return None

    render_config = FINAL_ERROR_RENDER_REGISTRY.get(error_info.error_code)
    if render_config is None:
        return None

    return i18n.translate(
        render_config.i18n_key,
        category=render_config.i18n_category,
        **error_info.i18n_params,
    )
