# -*- coding: utf-8 -*-
"""
此模块定义了聊天记录相关的数据结构和模型。
包含消息类型、压缩配置、Token使用信息等与聊天记录相关的类。
"""

import json
import re
import uuid
from enum import StrEnum
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Literal, Optional, TypedDict, Union

from agentlang.config.config import config
from agentlang.config.models.model_config import model_config_utils
from agentlang.logger import get_logger
from agentlang.llms.token_usage.models import TokenUsage  # 导入统一的 TokenUsage 类

logger = get_logger(__name__)

# Content constant for LLM API compatibility
# LLM APIs do not allow empty content, so we use a single space as placeholder
# when content is missing or empty to ensure API compliance
EMPTY_CONTENT_PLACEHOLDER = " "

# Content constant for assistant messages with tool calls
# When AssistantMessage has tool calls but empty content, use meaningful placeholder
ASSISTANT_TOOL_CONTENT_PLACEHOLDER = "我将继续执行任务"

# ==============================================================================
# 聊天记录压缩配置数据类
# ==============================================================================
FALLBACK_USER_FACING_MAX_CONTEXT_TOKENS = 300_000
FALLBACK_DEFAULT_COMPACTION_THRESHOLD_TOKENS = 180_000
FALLBACK_MIN_COMPACTION_THRESHOLD_TOKENS = 100_000
FALLBACK_MAX_COMPACTION_THRESHOLD_TOKENS = 180_000
FALLBACK_CONTEXT_USAGE_RATIO = 0.9


@dataclass(frozen=True)
class ContextWindowRule:
    """同一模型名称的关键词、版本共同决定旧模型或成本例外窗口。"""

    name: str
    user_facing_max_context_tokens: int
    model_keywords: tuple[str, ...]
    version_patterns: tuple[re.Pattern[str], ...]
    version_lt: tuple[int, ...] | None = None
    versions: tuple[tuple[int, ...], ...] = ()


def _parse_model_version(value: str) -> tuple[int, ...]:
    """按整数分段比较；4 与 4.0 等价，4.10 大于 4.6，不能使用浮点数。"""
    if not re.fullmatch(r"[0-9]+(?:[.-][0-9]+)*", value):
        raise ValueError(f"Invalid model version: {value}")
    parts = [int(part) for part in re.split(r"[.-]", value)]
    while len(parts) > 1 and parts[-1] == 0:
        parts.pop()
    return tuple(parts)


def _parse_token_count(value: Any) -> Optional[int]:
    """解析 token 数量，兼容 200000、"200K"、"1M" 等配置写法。"""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if not isinstance(value, str):
        return None

    text = value.strip().upper()
    if not text:
        return None
    try:
        if text.endswith("K"):
            return int(float(text[:-1]) * 1000)
        if text.endswith("M"):
            return int(float(text[:-1]) * 1_000_000)
        return int(float(text))
    except Exception:
        return None


def _load_token_config(key_path: str, default: int) -> int:
    value = _parse_token_count(config.get(key_path, default))
    if value is None or value <= 0:
        raise ValueError(f"{key_path} must be a positive token count")
    return value


def _load_float_config(key_path: str, default: float) -> float:
    value = config.get(key_path, default)
    try:
        return float(value)
    except (TypeError, ValueError) as e:
        raise ValueError(f"{key_path} must be a number") from e


def _load_context_window_rules_from_config() -> List[ContextWindowRule]:
    """从 config.yaml 读取用户可见上下文窗口规则。"""
    raw_rules = config.get("context_window.tiers", [])
    if raw_rules is None:
        return []
    if not isinstance(raw_rules, list):
        raise ValueError("context_window.tiers must be a list")

    rules: List[ContextWindowRule] = []
    for index, raw_rule in enumerate(raw_rules):
        if not isinstance(raw_rule, dict):
            raise ValueError(f"context_window.tiers[{index}] must be a dict")

        name = str(raw_rule.get("name") or "").strip()
        if not name:
            raise ValueError(f"context_window.tiers[{index}].name cannot be empty")

        user_facing_max_context_tokens = _parse_token_count(
            raw_rule.get("user_facing_max_context_tokens")
        )
        if user_facing_max_context_tokens is None or user_facing_max_context_tokens <= 0:
            raise ValueError(
                f"context_window.tiers[{index}].user_facing_max_context_tokens "
                "must be a positive token count"
            )

        raw_keywords = raw_rule.get("model_keywords")
        if not isinstance(raw_keywords, (list, tuple)):
            raise ValueError(f"context_window.tiers[{index}].model_keywords must be a list")
        model_keywords = tuple(
            str(keyword).strip()
            for keyword in raw_keywords
            if str(keyword).strip()
        )
        if not model_keywords:
            raise ValueError(f"context_window.tiers[{index}].model_keywords cannot be empty")

        raw_patterns = raw_rule.get("version_patterns")
        if not isinstance(raw_patterns, list) or not raw_patterns:
            raise ValueError(f"context_window.tiers[{index}].version_patterns must be a nonempty list")
        patterns: list[re.Pattern[str]] = []
        for pattern in raw_patterns:
            if not isinstance(pattern, str) or not pattern.strip():
                raise ValueError(f"context_window.tiers[{index}].version_patterns must contain strings")
            patterns.append(re.compile(pattern, re.IGNORECASE))

        raw_version_lt = raw_rule.get("version_lt")
        version_lt: tuple[int, ...] | None = None
        if raw_version_lt is not None:
            if not isinstance(raw_version_lt, str):
                raise ValueError(f"context_window.tiers[{index}].version_lt must be a string")
            version_lt = _parse_model_version(raw_version_lt)
        raw_versions = raw_rule.get("versions", [])
        if not isinstance(raw_versions, list) or any(not isinstance(v, str) for v in raw_versions):
            raise ValueError(f"context_window.tiers[{index}].versions must be a list of strings")
        versions = tuple(_parse_model_version(version) for version in raw_versions)
        if version_lt is not None or versions:
            if any("version" not in pattern.groupindex for pattern in patterns):
                raise ValueError(f"context_window.tiers[{index}] patterns must capture 'version'")

        rules.append(
            ContextWindowRule(
                name=name,
                user_facing_max_context_tokens=user_facing_max_context_tokens,
                model_keywords=model_keywords,
                version_patterns=tuple(patterns),
                version_lt=version_lt,
                versions=versions,
            )
        )

    return rules


def _resolve_default_user_facing_max_context_tokens() -> int:
    return _load_token_config(
        "context_window.default_user_facing_max_context_tokens",
        FALLBACK_USER_FACING_MAX_CONTEXT_TOKENS,
    )


def resolve_default_user_facing_max_context_tokens() -> int:
    """返回全局默认用户可见上下文上限。"""
    return _resolve_default_user_facing_max_context_tokens()


def _collect_model_match_texts(
    model_id: str,
    *,
    resolved_model_id: str | None = None,
    model_name: str | None = None,
) -> List[str]:
    """真实 ID／api_model／profile 优先，内部 ID 不可识别时再使用名称与 label。"""
    candidates: list[object] = [resolved_model_id]
    model_configs = [
        model_config_utils.get_model_config(candidate.strip())
        for candidate in (resolved_model_id, model_id)
        if candidate and candidate.strip()
    ]
    for model_config in model_configs:
        if model_config is not None:
            metadata = model_config.metadata or {}
            candidates.extend([
                model_config.resolved_model_id,
                metadata.get("api_model"),
                metadata.get("profile"),
            ])
    candidates.extend(
        model_config.model_id for model_config in model_configs if model_config is not None
    )
    candidates.extend([model_id, model_name])
    for model_config in model_configs:
        if model_config is not None:
            candidates.extend([
                model_config.name,
                (model_config.metadata or {}).get("label"),
            ])
    return list(dict.fromkeys(
        value.strip().lower()
        for value in candidates
        if isinstance(value, str) and value.strip()
    ))


def _match_context_window_rule(
    rules: List[ContextWindowRule],
    match_texts: List[str],
) -> ContextWindowRule | None:
    """先判断可信名称，再判断规则；新版本不能被低优先级的旧别名覆盖。"""
    for text in match_texts:
        recognized = False
        for rule in rules:
            keywords_match = all(keyword.lower() in text for keyword in rule.model_keywords)
            for pattern in rule.version_patterns:
                match = pattern.search(text)
                if match is None:
                    continue
                recognized = True
                if not keywords_match:
                    continue
                if rule.version_lt is not None or rule.versions:
                    version = _parse_model_version(match.group("version"))
                    if rule.version_lt is not None and version >= rule.version_lt:
                        continue
                    if rule.versions and version not in rule.versions:
                        continue
                return rule
            # 已识别型号但名称没有数字版本时使用默认，不能猜成旧版本。
            recognized = recognized or keywords_match
        if recognized:
            return None
    return None

@dataclass(frozen=True)
class CompactionThresholdResult:
    """模型压缩阈值解析结果。"""
    model_id: str
    compaction_threshold_tokens: int
    max_context_tokens: int
    matched_rule_name: Optional[str] = None
    used_default: bool = False


@dataclass(frozen=True)
class ManualContextWindowLimits:
    """当前模型允许用户手动设置的上下文上限范围。"""

    system_default_max_context_tokens: int
    max_allowed_context_tokens: int
    max_context_tokens: int
    max_output_tokens: int

    @property
    def has_valid_range(self) -> bool:
        return self.max_allowed_context_tokens >= self.system_default_max_context_tokens

    def contains(self, user_manual_max_context_tokens: int) -> bool:
        return (
            self.system_default_max_context_tokens
            <= user_manual_max_context_tokens
            <= self.max_allowed_context_tokens
        )


def resolve_manual_context_window_limits(
    *,
    max_context_tokens: int,
    max_output_tokens: int,
) -> ManualContextWindowLimits:
    """按当前真实文本模型计算手动上下文上限的合法范围。"""
    system_default_max_context_tokens = resolve_default_user_facing_max_context_tokens()
    eighty_percent_tokens = int(max_context_tokens * 0.8)
    output_reserved_tokens = max(0, max_context_tokens - max_output_tokens)
    return ManualContextWindowLimits(
        system_default_max_context_tokens=system_default_max_context_tokens,
        max_allowed_context_tokens=min(eighty_percent_tokens, output_reserved_tokens),
        max_context_tokens=max_context_tokens,
        max_output_tokens=max_output_tokens,
    )


@dataclass
class CompactionConfig:
    """Simplified compaction configuration for agent-initiated compaction"""
    # 基础 Agent 信息
    agent_name: str = ""
    agent_id: str = ""
    agent_model_id: str = ""

    # 基础开关配置
    enable_compaction: bool = True  # 是否启用压缩（现在由 Agent 主动触发）

    # 触发阈值配置
    compaction_threshold_tokens: int = 0  # 触发压缩的 Token 阈值
    max_conversation_rounds: int = 500  # 触发压缩的消息数量阈值

    # 后台压缩提前比例（到达 compaction_threshold_tokens 的此比例时启动后台压缩）
    early_compact_ratio: float = 0.8

    @property
    def early_compact_threshold(self) -> int:
        """后台压缩触发阈值 = compaction_threshold_tokens × early_compact_ratio"""
        return max(
            self.min_compaction_threshold_tokens,
            int(self.compaction_threshold_tokens * self.early_compact_ratio),
        )

    # 模型缺失或没有 agent_model_id 时使用 default_compaction_threshold_tokens；有模型时先读取
    # max_context_tokens，再按「命中 context_window_rules 则使用该用户可见窗口，
    # 否则使用产品默认窗口，并限制到模型物理容量」乘以 context_usage_ratio 计算。若模型容量不小于
    # min_compaction_threshold_tokens，结果至少为 min_compaction_threshold_tokens，
    # 最后不超过模型物理窗口。
    default_compaction_threshold_tokens: int = FALLBACK_DEFAULT_COMPACTION_THRESHOLD_TOKENS
    min_compaction_threshold_tokens: int = FALLBACK_MIN_COMPACTION_THRESHOLD_TOKENS
    max_compaction_threshold_tokens: int = FALLBACK_MAX_COMPACTION_THRESHOLD_TOKENS
    context_usage_ratio: float = FALLBACK_CONTEXT_USAGE_RATIO
    context_window_rules: List[ContextWindowRule] = field(
        default_factory=_load_context_window_rules_from_config
    )
    _auto_compaction_threshold: bool = field(default=False, init=False, repr=False)
    _resolved_compaction_threshold_model_id: Optional[str] = field(default=None, init=False, repr=False)

    @classmethod
    def from_config(cls, **overrides: Any) -> "CompactionConfig":
        """从 config.yaml 读取上下文窗口相关配置，并允许调用方覆盖 Agent 字段。"""
        values: Dict[str, Any] = {
            "default_compaction_threshold_tokens": _load_token_config(
                "context_window.compaction.default_compaction_threshold_tokens",
                FALLBACK_DEFAULT_COMPACTION_THRESHOLD_TOKENS,
            ),
            "min_compaction_threshold_tokens": _load_token_config(
                "context_window.compaction.min_compaction_threshold_tokens",
                FALLBACK_MIN_COMPACTION_THRESHOLD_TOKENS,
            ),
            "max_compaction_threshold_tokens": _load_token_config(
                "context_window.compaction.max_compaction_threshold_tokens",
                FALLBACK_MAX_COMPACTION_THRESHOLD_TOKENS,
            ),
            "context_usage_ratio": _load_float_config(
                "context_window.compaction.context_usage_ratio",
                FALLBACK_CONTEXT_USAGE_RATIO,
            ),
            "context_window_rules": _load_context_window_rules_from_config(),
        }
        values.update(overrides)
        return cls(**values)

    def __post_init__(self):
        """压缩配置的简化验证"""
        self._auto_compaction_threshold = self.compaction_threshold_tokens == 0

        if self.compaction_threshold_tokens < 0:
            raise ValueError("Compaction threshold tokens cannot be negative")
        if self.max_conversation_rounds <= 0:
            raise ValueError("Max conversation rounds must be positive")
        if not 0.01 <= self.context_usage_ratio <= 1.0:
            raise ValueError("Context usage ratio must be between 0.01 and 1.0")
        for rule in self.context_window_rules:
            if not rule.model_keywords:
                raise ValueError("Context window rule model_keywords cannot be empty")
            if rule.user_facing_max_context_tokens <= 0:
                raise ValueError("Context window rule tokens must be positive")

    def resolve_compaction_threshold_tokens(self, agent_model_id: Optional[str] = None) -> int:
        """Resolve compaction threshold lazily, after the current text model is selected."""
        if agent_model_id and agent_model_id != self.agent_model_id:
            self.agent_model_id = agent_model_id
            if self._auto_compaction_threshold:
                self._resolved_compaction_threshold_model_id = None

        if self._auto_compaction_threshold:
            if (
                self._resolved_compaction_threshold_model_id != self.agent_model_id
                or self.compaction_threshold_tokens <= 0
            ):
                self.compaction_threshold_tokens = self._calculate_model_based_threshold()
                self._resolved_compaction_threshold_model_id = self.agent_model_id
                logger.info(
                    "Set compaction_threshold_tokens to "
                    f"{self.compaction_threshold_tokens} based on model {self.agent_model_id}"
                )

        return self.compaction_threshold_tokens or self.default_compaction_threshold_tokens

    def _get_model_match_texts_for_model(self, model_id: str) -> List[str]:
        """收集用于匹配上下文窗口规则的模型文本。"""
        return _collect_model_match_texts(model_id)

    def _match_context_window_rule_for_model(
        self,
        model_id: str,
        match_texts: List[str],
    ) -> Optional[ContextWindowRule]:
        """根据用户可见上下文窗口规则匹配命中项。"""
        rule = _match_context_window_rule(self.context_window_rules, match_texts)
        if rule is not None:
            logger.info(
                f"模型 {model_id} 命中上下文窗口 {rule.user_facing_max_context_tokens:,} "
                f"(strategy={rule.name})"
            )
        return rule

    def resolve_threshold_for_model(
        self,
        model_id: str,
        current_max_context_tokens: Optional[int] = None,
    ) -> CompactionThresholdResult:
        """按指定模型计算压缩阈值；模型缺失时显式返回默认阈值。"""
        if not model_id:
            return CompactionThresholdResult(
                model_id="",
                compaction_threshold_tokens=self.default_compaction_threshold_tokens,
                max_context_tokens=0,
                used_default=True,
            )

        max_context_tokens = model_config_utils.get_max_context_tokens(
            model_id or resolved_model_id or "", default=0,
        )
        if max_context_tokens <= 0:
            logger.warning(
                f"无法获取模型 {model_id} 的 max_context_tokens，"
                f"压缩阈值使用默认值 {self.default_compaction_threshold_tokens}"
            )
            return CompactionThresholdResult(
                model_id=model_id,
                compaction_threshold_tokens=self.default_compaction_threshold_tokens,
                max_context_tokens=0,
                used_default=True,
            )

        match_texts = self._get_model_match_texts_for_model(model_id)
        matched_rule = self._match_context_window_rule_for_model(model_id, match_texts)
        if current_max_context_tokens is not None and current_max_context_tokens > 0:
            threshold_context_tokens = current_max_context_tokens
            matched_rule_name = "current_max_context_tokens"
        else:
            threshold_context_tokens = (
                matched_rule.user_facing_max_context_tokens
                if matched_rule is not None
                else _resolve_default_user_facing_max_context_tokens()
            )
            matched_rule_name = matched_rule.name if matched_rule is not None else None
        threshold_context_tokens = min(threshold_context_tokens, max_context_tokens)
        threshold = int(threshold_context_tokens * self.context_usage_ratio)

        if max_context_tokens >= self.min_compaction_threshold_tokens:
            threshold = max(threshold, self.min_compaction_threshold_tokens)
        threshold = min(threshold, max_context_tokens)

        return CompactionThresholdResult(
            model_id=model_id,
            compaction_threshold_tokens=threshold,
            max_context_tokens=max_context_tokens,
            matched_rule_name=matched_rule_name,
            used_default=False,
        )

    def _calculate_model_based_threshold(self) -> int:
        """
        根据模型的上下文长度计算适当的token阈值

        Returns:
            int: 计算得到的token阈值
        """
        try:
            result = self.resolve_threshold_for_model(self.agent_model_id)
            return result.compaction_threshold_tokens

        except Exception as e:
            logger.error(f"设置token阈值时出错: {e}")
            return self.default_compaction_threshold_tokens  # 出错时返回默认值

# ==============================================================================
# 聊天记录压缩信息元数据
# ==============================================================================
@dataclass
class CompactionInfo:
    """聊天消息压缩相关的元数据"""
    is_compacted: bool = False  # 是否为压缩后的消息
    original_message_count: int = 0  # 原始消息数量
    compaction_ratio: float = 0.0  # 实际压缩率
    compacted_at: str = ""  # 压缩时间
    message_spans: List[Dict[str, str]] = field(default_factory=list)  # 原始消息的时间跨度

    @classmethod
    def create(cls, message_count: int, original_tokens: int, compacted_tokens: int) -> 'CompactionInfo':
        """
        创建压缩信息实例

        Args:
            message_count: 被压缩的原始消息数量
            original_tokens: 压缩前的token数
            compacted_tokens: 压缩后的token数

        Returns:
            CompactionInfo: 压缩信息实例
        """
        compaction_ratio = 1.0
        if original_tokens > 0:
            compaction_ratio = 1.0 - (compacted_tokens / original_tokens)

        # 将压缩率限制在0-1之间
        compaction_ratio = max(0.0, min(1.0, compaction_ratio))

        return cls(
            is_compacted=True,
            original_message_count=message_count,
            compaction_ratio=compaction_ratio,
            compacted_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        )

    def to_dict(self) -> Dict[str, Any]:
        """将压缩信息转换为字典格式"""
        result = {
            "is_compacted": self.is_compacted,
            "original_message_count": self.original_message_count,
            "compaction_ratio": self.compaction_ratio,
            "compacted_at": self.compacted_at,
        }

        if self.message_spans:
            result["message_spans"] = self.message_spans

        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CompactionInfo':
        """从字典创建压缩信息对象"""
        compaction_info = cls(
            is_compacted=data.get("is_compacted", False),
            original_message_count=data.get("original_message_count", 0),
            compaction_ratio=data.get("compaction_ratio", 0.0),
            compacted_at=data.get("compacted_at", ""),
        )

        spans = data.get("message_spans")
        if spans and isinstance(spans, list):
            compaction_info.message_spans = spans

        return compaction_info

# ==============================================================================
# 辅助函数：耗时格式化与解析
# ==============================================================================

def format_duration_to_str(duration_ms: Optional[float]) -> Optional[str]:
    """
    将毫秒数 (float) 格式化为人类可读的字符串 (方案二: HhMmS.fffS)。

    Args:
        duration_ms (Optional[float]): 耗时，单位毫秒。

    Returns:
        Optional[str]: 格式化后的字符串，或 None。
    """
    if duration_ms is None or duration_ms < 0:
        return None

    try:
        # 创建 timedelta 对象 (注意 timedelta 使用秒)
        delta = timedelta(milliseconds=duration_ms)

        total_seconds = delta.total_seconds()
        hours, remainder = divmod(total_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)

        hours = int(hours)
        minutes = int(minutes)
        # 秒数保留毫秒精度
        seconds_float = seconds

        parts = []
        if hours > 0:
            parts.append(f"{hours}h")
        if minutes > 0:
            parts.append(f"{minutes}m")

        # 秒数部分始终显示，并格式化为 xxx.fff
        # 使用 Decimal 或精确计算避免浮点误差，但这里简单处理应该足够
        parts.append(f"{seconds_float:.3f}s")

        return "".join(parts)

    except Exception as e:
        logger.warning(f"格式化耗时 {duration_ms}ms 时出错: {e}")
        return None

def parse_duration_from_str(duration_str: Optional[str]) -> Optional[float]:
    """
    从人类可读的字符串 (方案二: HhMmS.fffS) 解析回毫秒数 (float)。

    Args:
        duration_str (Optional[str]): 格式化的耗时字符串。

    Returns:
        Optional[float]: 耗时，单位毫秒，或 None (如果解析失败)。
    """
    if not duration_str or not isinstance(duration_str, str):
        return None

    total_milliseconds = 0.0
    pattern = re.compile(r"(?:(?P<hours>\d+)h)?(?:(?P<minutes>\d+)m)?(?:(?P<seconds>[\d.]+)s)?")
    match = pattern.fullmatch(duration_str)

    if not match:
        logger.warning(f"无法解析耗时字符串格式: {duration_str}")
        return None

    try:
        data = match.groupdict()
        if data["hours"]:
            total_milliseconds += float(data["hours"]) * 3600 * 1000
        if data["minutes"]:
            total_milliseconds += float(data["minutes"]) * 60 * 1000
        if data["seconds"]:
            total_milliseconds += float(data["seconds"]) * 1000

        return total_milliseconds
    except (ValueError, TypeError) as e:
        logger.warning(f"解析耗时字符串 {duration_str} 时数值转换错误: {e}")
        return None
    except Exception as e:
        logger.error(f"解析耗时字符串 {duration_str} 时未知错误: {e}", exc_info=True)
        return None

# ==============================================================================
# 数据类定义 (参考 openai.types.chat)
# ==============================================================================

@dataclass
class FunctionCall:
    """
    表示模型请求的函数调用信息。
    参考: openai.types.chat.ChatCompletionMessageToolCall.Function
    """
    name: str  # 要调用的函数名称
    arguments: str  # 函数参数，JSON格式的字符串

    def to_dict(self) -> Dict[str, Any]:
        """将函数调用信息转换为字典格式"""
        return {
            "name": self.name,
            "arguments": self.arguments
        }

@dataclass
class ToolCall:
    """
    表示模型生成的工具调用请求。
    参考: openai.types.chat.ChatCompletionMessageToolCall
    """
    id: str  # 工具调用的唯一标识符
    type: Literal["function"] = "function"  # 工具类型，目前仅支持 'function'
    function: FunctionCall = None # 函数调用详情

    def to_dict(self) -> Dict[str, Any]:
        """将工具调用信息转换为字典格式"""
        return {
            "id": self.id,
            "type": self.type,
            "function": self.function.to_dict() if self.function else None
        }

@dataclass
class SystemMessage:
    """系统消息"""
    content: str # 系统消息内容，不能为空
    role: Literal["system"] = "system"
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    show_in_ui: bool = True # <--- 重命名并设置默认值

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(uuid.uuid4()), # 运行时 ID
            "timestamp": self.created_at,
            "role": self.role,
            "content": self.content,
            "show_in_ui": self.show_in_ui,
        }

    def to_llm_dict(self) -> Dict[str, Any]:
        """Convert to LLM API compatible format with whitelist fields only"""
        content = self.content if self.content and self.content.strip() else EMPTY_CONTENT_PLACEHOLDER
        return {
            "role": self.role,
            "content": content
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SystemMessage":
        """从字典创建系统消息对象"""
        return cls(
            content=data.get("content", ""),
            role=data.get("role", "system"),
            show_in_ui=data.get("show_in_ui", True),
            created_at=data.get("timestamp", datetime.now().isoformat()),
        )


class TextContentPartDict(TypedDict, total=False):
    """文本内容片段持久化后的字典结构。"""

    type: Literal["text"]
    text: str
    include_in_fallback: bool


class ImageRefContentPartDict(TypedDict):
    """本地图片引用内容片段持久化后的字典结构。"""

    type: Literal["image_ref"]
    path: str


UserMessageContentPartDict = Union[TextContentPartDict, ImageRefContentPartDict]


@dataclass
class UserMessageContentPart:
    """用户消息中的规范化内容片段，只承载文本或本地图片引用。"""

    type: Literal["text", "image_ref"]
    text: Optional[str] = None
    path: Optional[str] = None
    include_in_fallback: bool = True

    def __post_init__(self) -> None:
        """校验内容片段的固定字段，避免产生无法渲染的半结构化对象。"""
        if self.type == "text":
            if self.text is None:
                raise ValueError("text content part requires text")
            self.path = None
        elif self.type == "image_ref":
            if not self.path:
                raise ValueError("image_ref content part requires path")
            self.text = None
            self.include_in_fallback = True
        else:
            raise ValueError(f"Unsupported user message content part type: {self.type}")

    @classmethod
    def text_part(
        cls,
        text: str,
        *,
        include_in_fallback: bool = True,
    ) -> "UserMessageContentPart":
        """创建文本内容片段，并指定非原生视觉回退时是否保留。"""
        return cls(
            type="text",
            text=text,
            include_in_fallback=include_in_fallback,
        )

    @classmethod
    def image_ref(cls, path: str) -> "UserMessageContentPart":
        """创建本地图片引用；工作区内可转 URL，外部绝对路径使用 base64。"""
        return cls(type="image_ref", path=path)

    def to_dict(self) -> UserMessageContentPartDict:
        """将内容片段转换为历史文件使用的稳定字典格式。"""
        if self.type == "text":
            assert self.text is not None
            result: TextContentPartDict = {"type": "text", "text": self.text}
            if not self.include_in_fallback:
                result["include_in_fallback"] = False
            return result

        assert self.path is not None
        result: ImageRefContentPartDict = {"type": "image_ref", "path": self.path}
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "UserMessageContentPart":
        """从历史文件中的字典恢复内容片段。"""
        if not isinstance(data, dict):
            raise TypeError("content part must be a dictionary")
        part_type = data.get("type")
        if part_type == "text":
            text = data.get("text")
            if not isinstance(text, str):
                raise ValueError("text content part requires a string text")
            include_in_fallback = data.get("include_in_fallback", True)
            if not isinstance(include_in_fallback, bool):
                raise ValueError("include_in_fallback must be a boolean")
            return cls.text_part(text, include_in_fallback=include_in_fallback)
        if part_type == "image_ref":
            path = data.get("path")
            if not isinstance(path, str) or not path.strip():
                raise ValueError("image_ref content part requires a non-empty string path")
            return cls.image_ref(path)
        raise ValueError(f"Unsupported user message content part type: {part_type}")


@dataclass
class UserMessage:
    """用户消息"""
    content: str # 用户消息内容，不能为空
    role: Literal["user"] = "user"
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    show_in_ui: bool = True
    # 消息来源标记：None = 真实用户输入；"horizon" = AgentHorizon 注入；其他值供扩展使用
    source: Optional[str] = None
    # 规范化的多模态内容片段；历史只保存文本和 image_ref，不保存 Provider payload。
    # 放在既有字段之后，避免破坏外部对 UserMessage 的位置参数构造。
    content_parts: Optional[List[UserMessageContentPart]] = None
    # None 表示未做原生视觉裁剪；False 表示整个 user 消息不进入原生视觉请求。
    include_in_native_visual: Optional[bool] = None

    def __post_init__(self) -> None:
        """规范化内容片段对象，并兼容旧代码传入的历史字典结构。"""
        if self.content_parts is not None:
            normalized_parts: List[UserMessageContentPart] = []
            for part in self.content_parts:
                if isinstance(part, UserMessageContentPart):
                    normalized_parts.append(part)
                elif isinstance(part, dict):
                    normalized_parts.append(UserMessageContentPart.from_dict(part))
                else:
                    raise TypeError(f"Unsupported user message content part: {type(part)!r}")
            self.content_parts = normalized_parts
        if self.include_in_native_visual is not None and not isinstance(
            self.include_in_native_visual,
            bool,
        ):
            raise ValueError("include_in_native_visual must be a boolean or None")

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "id": str(uuid.uuid4()), # 运行时 ID
            "timestamp": self.created_at,
            "role": self.role,
            "content": self.content,
            "show_in_ui": self.show_in_ui,
        }
        if self.source is not None:
            d["source"] = self.source
        if self.content_parts is not None:
            d["content_parts"] = [part.to_dict() for part in self.content_parts]
        if self.include_in_native_visual is not None:
            d["include_in_native_visual"] = self.include_in_native_visual
        return d

    def to_llm_dict(self) -> Dict[str, Any]:
        """Convert to LLM API compatible format with whitelist fields only"""
        content = self.content if self.content and self.content.strip() else EMPTY_CONTENT_PLACEHOLDER
        return {
            "role": self.role,
            "content": content
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "UserMessage":
        """从字典创建用户消息对象"""
        raw_parts = data.get("content_parts")
        if raw_parts is not None and not isinstance(raw_parts, list):
            raise TypeError("content_parts must be a list")
        return cls(
            content=data.get("content", ""),
            role=data.get("role", "user"),
            show_in_ui=data.get("show_in_ui", True),
            created_at=data.get("timestamp", datetime.now().isoformat()),
            source=data.get("source"),
            content_parts=[UserMessageContentPart.from_dict(part) for part in (raw_parts or [])] or None,
            include_in_native_visual=data.get("include_in_native_visual"),
        )

@dataclass
class AssistantMessage:
    """助手消息 (模型的回应)"""
    content: str = ""
    role: Literal["assistant"] = "assistant"
    tool_calls: Optional[List[ToolCall]] = None # 模型请求的工具调用列表
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    show_in_ui: bool = True # <--- 重命名并设置默认值 (finish_task 会在 append 时设为 False)
    duration_ms: Optional[float] = None # 内部存储为毫秒 float
    # --- 使用统一的 TokenUsage 类型 ---
    token_usage: Optional[TokenUsage] = None
    # --- 新增压缩相关字段 ---
    compaction_info: Optional[CompactionInfo] = None
    # --- 新增请求ID字段 ---
    request_id: Optional[str] = None # LLM请求的唯一标识符
    # --- 新增思考内容字段（用于思考模型如 deepseek-reasoner, gemini-3-pro-preview）---
    reasoning_content: Optional[str] = None # 模型的思考过程内容
    # 标记此响应是否在 LLM 流式输出期间被用户中断，被中断意味着 tool call 参数可能不完整
    interrupted: bool = False

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "id": str(uuid.uuid4()), # 运行时 ID
            "timestamp": self.created_at,
            "role": self.role,
            "content": self.content,
            "show_in_ui": self.show_in_ui,
            "duration_ms": self.duration_ms, # 注意：这个字段在 save 时会被移除，转换成 duration 字符串
        }

        # 处理 token_usage
        if self.token_usage:
            result["token_usage"] = self.token_usage.to_dict()

        # 只有当 compaction_info 不为 None 时才添加
        if self.compaction_info:
            result["compaction_info"] = self.compaction_info.to_dict()

        # 添加 request_id
        if self.request_id:
            result["request_id"] = self.request_id

        # 添加 reasoning_content (思考内容)
        if self.reasoning_content:
            result["reasoning_content"] = self.reasoning_content

        if self.interrupted:
            result["interrupted"] = True

        if self.tool_calls:
            result["tool_calls"] = [tc.to_dict() for tc in self.tool_calls]

        # 清理值为 None 的顶级键 (除了 content 和 tool_calls，因为 assistant 可以只有其中一个)
        result = {k: v for k, v in result.items() if v is not None or k in ['content', 'tool_calls']}

        return result

    def to_llm_dict(self) -> Dict[str, Any]:
        """Convert to LLM API compatible format with whitelist fields only"""
        llm_msg = {"role": self.role}

        # Add content if present and non-empty
        has_content = False
        if self.content and self.content.strip():
            llm_msg["content"] = self.content
            has_content = True

        # Add tool_calls if present
        has_tool_calls = False
        if self.tool_calls:
            formatted_tool_calls = []
            for tc in self.tool_calls:
                # Ensure tc is ToolCall object with valid structure
                if isinstance(tc, ToolCall) and isinstance(tc.function, FunctionCall) and tc.id and tc.function.name:
                    arguments_str = tc.function.arguments
                    # Ensure arguments is string
                    if not isinstance(arguments_str, str):
                        try:
                            arguments_str = json.dumps(arguments_str, ensure_ascii=False)
                        except Exception:
                            arguments_str = "{}"

                    formatted_tool_calls.append({
                        "id": tc.id,
                        "type": tc.type,
                        "function": {
                            "name": tc.function.name,
                            "arguments": arguments_str
                        }
                    })

            if formatted_tool_calls:
                llm_msg["tool_calls"] = formatted_tool_calls
                has_tool_calls = True

        # Safety check: Content can not be empty
        if not has_content and not has_tool_calls:
            llm_msg["content"] = EMPTY_CONTENT_PLACEHOLDER
        # elif not has_content and has_tool_calls:
        #     # Use meaningful placeholder when assistant has tool calls but no content
        #     llm_msg["content"] = ASSISTANT_TOOL_CONTENT_PLACEHOLDER

        return llm_msg

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AssistantMessage":
        msg = cls(
            content=data.get("content", ""),
            role=data.get("role", "assistant"),
            show_in_ui=data.get("show_in_ui", True),
            duration_ms=data.get("duration_ms"),
            created_at=data.get("timestamp", datetime.now().isoformat()),
            request_id=data.get("request_id"),
            reasoning_content=data.get("reasoning_content"),
            interrupted=data.get("interrupted", False),
        )

        # --- 解析 token_usage ---
        token_usage_data = data.get("token_usage")
        if token_usage_data and isinstance(token_usage_data, dict):
            try:
                # Use from_dict to preserve model_id and model_name when loading from history
                token_usage_obj = TokenUsage.from_dict(token_usage_data)
                msg.token_usage = token_usage_obj
            except Exception as e:
                logger.warning(f"加载历史时解析 token_usage 失败: {token_usage_data}, 错误: {e}")

        # --- 解析 compaction_info ---
        compaction_info_data = data.get("compaction_info")
        if compaction_info_data and isinstance(compaction_info_data, dict):
            try:
                compaction_info_obj = CompactionInfo.from_dict(compaction_info_data)
                # 只有 is_compacted 为 True 的才保留
                if compaction_info_obj and compaction_info_obj.is_compacted:
                    msg.compaction_info = compaction_info_obj
                else:
                     logger.debug(f"加载时跳过空的或未压缩的 compaction_info: {compaction_info_data}")
            except Exception as e:
                logger.warning(f"加载历史时解析 compaction_info 失败: {compaction_info_data}, 错误: {e}")

        # --- 解析 tool_calls ---
        tool_calls_data = data.get("tool_calls")
        if tool_calls_data and isinstance(tool_calls_data, list):
            msg.tool_calls = []
            for tc_data in tool_calls_data:
                if isinstance(tc_data, dict):
                    try:
                        function_data = tc_data.get("function", {})
                        # 确保 arguments 是字符串
                        arguments_raw = function_data.get("arguments")
                        arguments_str = arguments_raw if isinstance(arguments_raw, str) else json.dumps(arguments_raw or {})

                        function_call = FunctionCall(
                            name=function_data.get("name", ""),
                            arguments=arguments_str
                        )
                        tool_call = ToolCall(
                            id=tc_data.get("id", str(uuid.uuid4())),
                            type=tc_data.get("type", "function"),
                            function=function_call
                        )
                        # 基本验证
                        if tool_call.id and tool_call.function and tool_call.function.name:
                            msg.tool_calls.append(tool_call)
                        else:
                            logger.warning(f"加载时跳过无效的 tool_call 结构 (缺少 id 或 function.name): {tc_data}")
                    except Exception as e:
                         logger.warning(f"加载时解析 tool_call 失败: {tc_data}, 错误: {e}")

        return msg

class ContextSource(StrEnum):
    """内部归类提示；不进入模型消息或改变工具执行语义。"""
    SKILLS = "skills"
    MCP = "mcp"
    MIXED = "mixed"

    @classmethod
    def from_value(cls, value: object) -> "ContextSource | None":
        if not isinstance(value, str):
            return None
        try:
            return cls(value)
        except ValueError:
            return None


@dataclass
class ToolMessage:
    """工具执行结果消息"""
    content: str # 工具执行结果内容，不能为空
    tool_call_id: str # 对应的工具调用 ID
    role: Literal["tool"] = "tool"
    system: Optional[str] = None # 内部使用的系统标志，例如标记中断
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    show_in_ui: bool = True # <--- 重命名并设置默认值 (中断提示会在 append 时设为 False)
    duration_ms: Optional[float] = None # 内部存储为毫秒 float

    context_source: ContextSource | None = None

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "id": str(uuid.uuid4()), # 运行时 ID
            "timestamp": self.created_at,
            "role": self.role,
            "content": self.content,
            "context_source": self.context_source,
            "tool_call_id": self.tool_call_id,
            "system": self.system,
            "show_in_ui": self.show_in_ui,
            "duration_ms": self.duration_ms, # 注意：这个字段在 save 时会被移除
        }
        # 清理值为 None 的顶级键 (system, duration_ms 可能为 None)
        return {k: v for k, v in result.items() if v is not None}

    def to_llm_dict(self) -> Dict[str, Any]:
        """Convert to LLM API compatible format with whitelist fields only"""
        content = self.content if self.content and self.content.strip() else EMPTY_CONTENT_PLACEHOLDER
        return {
            "role": self.role,
            "content": content,
            "tool_call_id": self.tool_call_id
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ToolMessage":
        """从字典创建工具消息对象"""
        return cls(
            content=data.get("content", ""),
            context_source=ContextSource.from_value(data.get("context_source")),
            tool_call_id=data.get("tool_call_id", ""),
            role=data.get("role", "tool"),
            system=data.get("system"), # 可以为 None
            show_in_ui=data.get("show_in_ui", True),
            duration_ms=data.get("duration_ms"), # 可以为 None
            created_at=data.get("timestamp", datetime.now().isoformat()),
        )

# 所有可能的消息类型的联合类型
ChatMessage = Union[SystemMessage, UserMessage, AssistantMessage, ToolMessage]


def chat_message_from_dict(data: Dict[str, Any]) -> Optional[ChatMessage]:
    """将聊天记录字典转换为对应的结构化消息对象。"""
    role = data.get("role")
    try:
        if role == "system":
            return SystemMessage.from_dict(data)
        if role == "user":
            return UserMessage.from_dict(data)
        if role == "assistant":
            return AssistantMessage.from_dict(data)
        if role == "tool":
            return ToolMessage.from_dict(data)
    except Exception as e:
        logger.warning(f"聊天记录消息结构化失败: {data}，错误: {e}")
        return None

    logger.warning(f"聊天记录消息角色未知: {role}")
    return None


# ==============================================================================
# 对外暴露的上下文容量查值入口
# ==============================================================================
def resolve_user_facing_max_context_tokens(
    model_id: str,
    *,
    resolved_model_id: Optional[str] = None,
    model_name: Optional[str] = None,
    max_context_tokens: int | None = None,
) -> Optional[int]:
    """计算 `model_id` 对外暴露的最大上下文 token 容量。

    与 [CompactionConfig._calculate_model_based_threshold] 保持取值口径一致：
      1. 优先命中 config.yaml 的 `context_window.tiers`，使用该规则的
         `user_facing_max_context_tokens`。
      2. 未命中时统一回退到 `context_window.default_user_facing_max_context_tokens`，
         避免使用模型原始物理窗口造成前端展示与系统对外口径不一致。
      3. 有有效物理容量时取较小值；运行时容量优先于静态配置。

    供压缩以外的消费者（如消息工厂的实时 token_usage 输出）复用，避免重复实现查表逻辑。
    """
    default_context_tokens = _resolve_default_user_facing_max_context_tokens()
    user_facing_context_tokens = default_context_tokens
    try:
        # auto 本身不表达具体模型，必须把运行时解析结果和配置别名都纳入匹配。
        match_texts = _collect_model_match_texts(
            model_id, resolved_model_id=resolved_model_id, model_name=model_name,
        )
        rules = _load_context_window_rules_from_config()
        rule = _match_context_window_rule(rules, match_texts)
        if rule is not None:
            user_facing_context_tokens = rule.user_facing_max_context_tokens
    except Exception as e:
        logger.warning(f"resolve_user_facing_max_context_tokens 失败 model_id={model_id}: {e}")
    if max_context_tokens is None:
        max_context_tokens = model_config_utils.get_max_context_tokens(model_id, default=0)
    if max_context_tokens > 0:
        return min(user_facing_context_tokens, max_context_tokens)
    return user_facing_context_tokens
