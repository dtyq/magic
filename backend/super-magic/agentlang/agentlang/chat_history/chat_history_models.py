# -*- coding: utf-8 -*-
"""
此模块定义了聊天记录相关的数据结构和模型。
包含消息类型、压缩配置、Token使用信息等与聊天记录相关的类。
"""

import json
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Literal, Optional, Union

from agentlang.config import model_config_utils
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
@dataclass(frozen=True)
class PricingTierCompactionRule:
    """按已知定价分区匹配压缩阈值规则（临时硬编码）"""
    # 说明：
    # 当前服务端未返回模型定价分区信息，无法在运行时精确判断价格跳档点。
    # 这里先基于已调研模型名做临时映射，避免在高价区间才触发压缩导致成本失控。
    # 后续若服务端提供定价分区元数据，应迁移为服务端驱动/配置驱动，移除此硬编码策略。
    name: str
    pricing_interval: str
    model_keywords: tuple[str, ...]
    token_threshold: int

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
    token_threshold: int = 0  # 触发压缩的 Token 阈值
    max_conversation_rounds: int = 300  # 触发压缩的消息数量阈值

    # Dynamic threshold calculation (kept for compatibility)
    default_token_threshold: int = 100_000
    min_token_threshold: int = 100_000
    max_token_threshold: int = 160_000
    context_usage_ratio: float = 0.75
    # FIXME: 临时措施：定价分区压缩策略表（硬编码）
    # 命中规则优先于 context_usage_ratio；未命中时回退到比例策略。
    pricing_tier_rules: List[PricingTierCompactionRule] = field(
        default_factory=lambda: [
            # 已知价格在 200K 输入附近跳档的模型，固定在 180K 触发压缩
            PricingTierCompactionRule(
                name="pricing_cliff_200k",
                pricing_interval="200K",
                model_keywords=(
                    "claude-sonnet-4.6",
                    "claude-sonnet-4.5",
                    "claude-sonnet-4",
                    "gemini-3-pro",
                    "gemini-3-pro-preview",
                    "gemini-3.1-pro",
                    "gemini-3.1-pro-preview",
                ),
                token_threshold=180_000,
            ),
            # 已知价格在 256K 输入附近跳档的模型，固定在 230K 触发压缩
            PricingTierCompactionRule(
                name="pricing_cliff_256k",
                pricing_interval="256K",
                model_keywords=(
                    "qwen3-max",
                    "qwen3-coder-plus",
                    "qwen3.5-plus",
                    "qwen3.5-flash",
                    "qwen-plus",
                    "seed-2.0-pro",
                    "seed-2.0-lite",
                    "doubao-seed-2.0-pro",
                    "doubao-seed-2.0-lite",
                ),
                token_threshold=230_000,
            ),
        ]
    )

    def __post_init__(self):
        """压缩配置的简化验证"""
        # Set default token threshold if needed (auto-calculate when 0)
        if self.token_threshold == 0:
            self.token_threshold = self._calculate_model_based_threshold()
            logger.info(f"Set token_threshold to {self.token_threshold} based on model {self.agent_model_id}")

        # Basic validation after auto-calculation
        if self.token_threshold <= 0:
            raise ValueError("Token threshold must be positive")
        if self.max_conversation_rounds <= 0:
            raise ValueError("Max conversation rounds must be positive")
        if not 0.01 <= self.context_usage_ratio <= 1.0:
            raise ValueError("Context usage ratio must be between 0.01 and 1.0")
        for rule in self.pricing_tier_rules:
            if not rule.model_keywords:
                raise ValueError("Pricing tier rule model_keywords cannot be empty")
            if rule.token_threshold <= 0:
                raise ValueError("Pricing tier rule token_threshold must be positive")

    def _get_model_match_texts(self) -> List[str]:
        """收集用于匹配策略规则的模型文本"""
        match_texts = [self.agent_model_id]
        model_config = model_config_utils.get_model_config(self.agent_model_id)
        if model_config:
            match_texts.extend([model_config.name, model_config.provider])
            metadata = model_config.metadata or {}
            label = metadata.get("label")
            if label:
                match_texts.append(str(label))
        return [text.lower() for text in match_texts if text]

    def _match_pricing_tier_rule(self, match_texts: List[str]) -> Optional[PricingTierCompactionRule]:
        """根据硬编码定价分区规则匹配命中项（命中即返回规则）"""
        for rule in self.pricing_tier_rules:
            for keyword in rule.model_keywords:
                keyword_lower = keyword.lower()
                if any(keyword_lower in text for text in match_texts):
                    logger.info(
                        f"模型 {self.agent_model_id} 命中定价区间 {rule.pricing_interval} "
                        f"(strategy={rule.name}, keyword={keyword}), "
                        f"token_threshold={rule.token_threshold:,}"
                    )
                    return rule
        return None

    def _calculate_model_based_threshold(self) -> int:
        """
        根据模型的上下文长度计算适当的token阈值

        Returns:
            int: 计算得到的token阈值
        """
        try:
            # 获取模型信息
            threshold = self.default_token_threshold  # 默认阈值
            dynamic_max_threshold = self.max_token_threshold  # 默认使用配置的上限

            if self.agent_model_id:
                # 使用统一的模型配置工具获取上下文 tokens
                max_context_tokens = model_config_utils.get_max_context_tokens(
                    self.agent_model_id,
                    default=0
                )

                if max_context_tokens > 0:
                    # 优先命中定价分区固定规则；未命中时回退到比例计算
                    match_texts = self._get_model_match_texts()
                    matched_rule = self._match_pricing_tier_rule(match_texts)
                    if matched_rule is not None:
                        # 命中规则时，同时更新触发阈值与最终上限钳制
                        threshold = matched_rule.token_threshold
                        dynamic_max_threshold = matched_rule.token_threshold
                        logger.info(
                            f"模型 {self.agent_model_id} 命中定价规则后更新上限钳制: "
                            f"dynamic_max_threshold={dynamic_max_threshold:,}"
                        )
                    else:
                        threshold = int(max_context_tokens * self.context_usage_ratio)
                        # 非命中规则模型使用比例阈值，避免被默认上限过早钳制
                        dynamic_max_threshold = max(dynamic_max_threshold, threshold)

            # 应用最小和最大限制（使用动态计算的上限）
            threshold = max(threshold, self.min_token_threshold)
            threshold = min(threshold, dynamic_max_threshold)
            return threshold

        except Exception as e:
            logger.error(f"设置token阈值时出错: {e}")
            return self.default_token_threshold  # 出错时返回默认值

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

@dataclass
class UserMessage:
    """用户消息"""
    content: str # 用户消息内容，不能为空
    role: Literal["user"] = "user"
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
    def from_dict(cls, data: Dict[str, Any]) -> "UserMessage":
        """从字典创建用户消息对象"""
        return cls(
            content=data.get("content", ""),
            role=data.get("role", "user"),
            show_in_ui=data.get("show_in_ui", True),
            created_at=data.get("timestamp", datetime.now().isoformat()),
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
            request_id=data.get("request_id"),  # 添加 request_id 字段的解析
            reasoning_content=data.get("reasoning_content"),  # 添加 reasoning_content 字段的解析
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

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "id": str(uuid.uuid4()), # 运行时 ID
            "timestamp": self.created_at,
            "role": self.role,
            "content": self.content,
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
            tool_call_id=data.get("tool_call_id", ""),
            role=data.get("role", "tool"),
            system=data.get("system"), # 可以为 None
            show_in_ui=data.get("show_in_ui", True),
            duration_ms=data.get("duration_ms"), # 可以为 None
            created_at=data.get("timestamp", datetime.now().isoformat()),
        )

# 所有可能的消息类型的联合类型
ChatMessage = Union[SystemMessage, UserMessage, AssistantMessage, ToolMessage]
