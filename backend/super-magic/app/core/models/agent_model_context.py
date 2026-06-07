from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from agentlang.llms.factory import LLMClientConfig, LLMFactory
from agentlang.logger import get_logger
from app.core.models.agent_model_selection import AgentModelSelection
from app.core.models.media_model import ImageModelSpec, JsonObject, VideoModelSpec, normalize_model_id

logger = get_logger(__name__)


@dataclass(frozen=True)
class TextModelState:
    """已解析的文本模型运行时状态。

    这个结构保存 LLMFactory 解析后的模型配置结果，供一次运行中的 LLM 调用、
    token 预算和 horizon 展示复用。
    """

    model_id: str
    model_name: str
    resolved_model_id: Optional[str]
    max_output_tokens: int
    max_context_tokens: int
    config: LLMClientConfig

    @property
    def display_model_id(self) -> str:
        """返回对外展示使用的模型 ID，优先使用 provider 解析后的真实模型 ID。"""
        return self.resolved_model_id or self.model_id


@dataclass
class AgentModelContext:
    """AgentContext 内的运行时模型上下文。

    它负责保存当前 Agent 运行中已经选定的文本、图片、视频模型，并在真正调用
    LLM 时才解析文本模型配置。请求模型、会话模型、默认模型的优先级不在这里判断，
    而是交给 `ModelSelectionPolicy`。
    """

    configured_text_model_id: Optional[str] = None
    text_model_id: Optional[str] = None
    image: ImageModelSpec = field(default_factory=ImageModelSpec.empty)
    video: VideoModelSpec = field(default_factory=VideoModelSpec.empty)
    _resolved_text_model_id: Optional[str] = field(default=None, init=False, repr=False)
    _resolved_text_state: Optional[TextModelState] = field(default=None, init=False, repr=False)
    _pre_compact_text_model_id: Optional[str] = field(default=None, init=False, repr=False)
    _compact_text_model_active: bool = field(default=False, init=False, repr=False)
    _compact_text_model_fallback_consumed: bool = field(default=False, init=False, repr=False)
    _last_logged_text_model_id: Optional[str] = field(default=None, init=False, repr=False)

    def set_configured_text_model(self, model_id: str) -> None:
        """设置 Agent 文件中声明的默认文本模型 ID。"""
        normalized = normalize_model_id(model_id)
        if normalized is None:
            raise ValueError("Configured text model id cannot be empty")
        self.configured_text_model_id = normalized
        if self.text_model_id is None:
            self._set_text_model_id(normalized)

    def apply_selection(self, selection: AgentModelSelection) -> None:
        """应用一次模型选择结果，更新当前文本、图片、视频模型。"""
        configured = normalize_model_id(selection.configured_text_model_id)
        if configured:
            self.configured_text_model_id = configured

        text_model_id = normalize_model_id(selection.text_model_id)
        if text_model_id is None:
            text_model_id = self.configured_text_model_id
        if text_model_id is None:
            raise ValueError("Text model id cannot be empty")
        self._set_text_model_id(text_model_id)
        self.image = selection.image_model
        self.video = selection.video_model

    @property
    def current_text_model_id(self) -> Optional[str]:
        """返回当前生效文本模型 ID，未显式选择时回退到 Agent 默认模型。"""
        return self.text_model_id or self.configured_text_model_id

    @property
    def image_model_id(self) -> Optional[str]:
        """返回当前生效图片模型 ID。"""
        return self.image.model_id

    @property
    def video_model_id(self) -> Optional[str]:
        """返回当前生效视频模型 ID。"""
        return self.video.model_id

    def media_model_payload(self) -> JsonObject:
        """返回图片和视频模型合并后的媒体模型 payload。"""
        payload: JsonObject = {}
        image_payload = self.image.to_payload()
        if image_payload is not None:
            payload["image_model"] = image_payload
        video_payload = self.video.to_payload()
        if video_payload is not None:
            payload["video_model"] = video_payload
        return payload

    def activate_compact_text_model(self, model_id: str) -> None:
        """切换到 compact 专用文本模型，并保存切换前的文本模型。"""
        normalized = normalize_model_id(model_id)
        if normalized is None:
            raise ValueError("Compact text model id cannot be empty")
        if not self._compact_text_model_active:
            self._pre_compact_text_model_id = self.text_model_id
            self._compact_text_model_active = True
            self._compact_text_model_fallback_consumed = False
        self._set_text_model_id(normalized)

    def restore_pre_compact_text_model(self) -> bool:
        """恢复 compact 前的文本模型，未处于 compact 模型时返回 False。"""
        if not self._compact_text_model_active:
            return False
        previous_model_id = self._pre_compact_text_model_id
        self._pre_compact_text_model_id = None
        self._compact_text_model_active = False
        self._compact_text_model_fallback_consumed = False
        self._set_text_model_id(previous_model_id)
        return True

    def has_active_compact_text_model(self) -> bool:
        """判断当前是否已经切换到 compact 专用文本模型。"""
        return self._compact_text_model_active

    def consume_compact_text_model_fallback(self) -> bool:
        """消费一次 compact 临时模型失败后的回退机会。"""
        if not self._compact_text_model_active or self._compact_text_model_fallback_consumed:
            return False
        self._compact_text_model_fallback_consumed = True
        return True

    def resolve_text_model(self) -> TextModelState:
        """解析当前文本模型配置，并按模型 ID 缓存解析结果。"""
        model_id = self.current_text_model_id
        if not model_id:
            raise ValueError("Text model id is not configured")

        if self._resolved_text_model_id == model_id and self._resolved_text_state is not None:
            return self._resolved_text_state

        model_config = LLMFactory.get_model_config(model_id)
        effective_model_id = normalize_model_id(model_config.model_id) or model_id
        model_name = model_config.name or effective_model_id
        state = TextModelState(
            model_id=effective_model_id,
            model_name=model_name,
            resolved_model_id=model_config.resolved_model_id or None,
            max_output_tokens=model_config.max_output_tokens,
            max_context_tokens=model_config.max_context_tokens,
            config=model_config,
        )
        if effective_model_id != model_id:
            logger.warning(f"文本模型 {model_id} 不可用，已回退到 {effective_model_id}")
            self.text_model_id = effective_model_id

        self._resolved_text_model_id = effective_model_id
        self._resolved_text_state = state

        if self._last_logged_text_model_id != effective_model_id:
            logger.info(f"切换到运行时文本模型: {state.display_model_id} ({state.model_name})")
            self._last_logged_text_model_id = effective_model_id
        else:
            logger.debug(f"继续使用运行时文本模型: {state.display_model_id} ({state.model_name})")
        return state

    def get_output_token_budget(self, default: int = 4096) -> int:
        """获取当前文本模型的最大输出 token 数，解析失败时返回默认值。"""
        try:
            return self.resolve_text_model().max_output_tokens
        except Exception as e:
            logger.debug(f"获取运行时文本模型输出预算失败，使用默认值 {default}: {e}")
            return default

    def _set_text_model_id(self, model_id: Optional[str]) -> None:
        """设置当前文本模型 ID，并在模型变化时清理已解析的模型缓存。"""
        normalized = normalize_model_id(model_id)
        if normalized == self.text_model_id:
            return
        self.text_model_id = normalized
        self._resolved_text_model_id = None
        self._resolved_text_state = None
