"""估算最终请求中的文本构成；只服务展示，不参与计费或整理决策。"""
from collections.abc import Mapping
from dataclasses import dataclass
import json

from agentlang.chat_history.chat_history_models import ContextSource
from agentlang.llms.token_usage.models import ContextInputBreakdown
from agentlang.utils.token_estimator import num_tokens_from_string


def estimate_tool_schema(schema: object) -> int:
    """定义生成／加载时计数，避免每个请求重新序列化同一 schema。"""
    return num_tokens_from_string(json.dumps(schema, ensure_ascii=False, separators=(",", ":")))


@dataclass(frozen=True, slots=True)
class ToolSchemaEstimate:
    """当前定义的 schema 引用与计数；定义替换时同步更新。"""
    schema: object
    tokens: int


@dataclass(frozen=True, slots=True)
class TextEstimate:
    text: str
    tokens: int
    skill_tokens: int = 0


class ContextUsageEstimator:
    """按不可变字符串引用复用计数；仅持有当前请求窗口的引用。

    同一文本可用于不同分类，缓存只保留计数，不缓存本次消息来源。
    例：MCP 输出被整理成摘要后，旧引用退出缓存，摘要重新计入对话。
    """
    def __init__(self) -> None:
        self._texts: dict[int, TextEstimate] = {}
        self._system_texts: dict[int, TextEstimate] = {}
        self._skill_blocks: tuple[str, ...] = ()

    def set_skill_blocks(self, blocks: tuple[str, ...]) -> None:
        self._skill_blocks = tuple(block for block in blocks if block)
        self._system_texts.clear()

    def clear(self) -> None:
        self._texts.clear()
        self._system_texts.clear()

    def _text(self, text: str, *, system: bool, used: set[int]) -> TextEstimate:
        key = id(text)
        used.add(key)
        cache = self._system_texts if system else self._texts
        cached = cache.get(key)
        if cached is not None and cached.text is text:
            return cached
        tokens = num_tokens_from_string(text)
        skill_tokens = 0
        if system:
            # 只识别提示组装阶段已知的技能块，不根据正文关键词猜测来源。
            spans: list[tuple[int, int]] = []
            for block in self._skill_blocks:
                start = text.find(block)
                while start >= 0:
                    spans.append((start, start + len(block)))
                    start = text.find(block, start + len(block))
            end = 0
            for start, stop in sorted(spans):
                start = max(start, end)
                if stop > start:
                    skill_tokens += num_tokens_from_string(text[start:stop])
                    end = stop
        result = TextEstimate(text, tokens, min(tokens, skill_tokens))
        cache[key] = result
        return result

    def estimate(
        self,
        request: Mapping[str, object],
        sources: Mapping[str, ContextSource | None],
        schema_estimates: Mapping[int, ToolSchemaEstimate],
    ) -> ContextInputBreakdown | None:
        used: set[int] = set()
        try:
            return self._estimate(request, sources, schema_estimates, used)
        finally:
            # 包括未知结构和失败路径，不能让连续失败累积旧字符串引用。
            self._texts = {key: value for key, value in self._texts.items() if key in used}
            self._system_texts = {key: value for key, value in self._system_texts.items() if key in used}

    def _estimate(
        self, request: Mapping[str, object], sources: Mapping[str, ContextSource | None],
        schema_estimates: Mapping[int, ToolSchemaEstimate], used: set[int],
    ) -> ContextInputBreakdown | None:
        messages = request.get("messages")
        tools = request.get("tools", [])
        if not isinstance(messages, list) or not isinstance(tools, list):
            return None
        counts = {name: 0 for name in (
            "system_tokens", "tool_definition_tokens", "skill_tokens", "mcp_tokens", "conversation_tokens", "tool_result_tokens",
        )}
        non_text = False
        partial = False

        def add(text: str, field: str, *, system: bool = False) -> None:
            estimate = self._text(text, system=system, used=used)
            counts[field] += estimate.tokens - estimate.skill_tokens
            counts["skill_tokens"] += estimate.skill_tokens

        for message in messages:
            if not isinstance(message, Mapping):
                return None
            role = message.get("role")
            if role in ("system", "developer"):
                field = "system_tokens"
            elif role in ("user", "assistant"):
                field = "conversation_tokens"
            elif role == "tool":
                call_id = message.get("tool_call_id")
                source = sources.get(call_id) if isinstance(call_id, str) else None
                field = ("skill_tokens" if source == ContextSource.SKILLS else "mcp_tokens" if source == ContextSource.MCP else "tool_result_tokens")
                partial |= source == ContextSource.MIXED or call_id not in sources
            else:
                return None
            content = message.get("content")
            if isinstance(content, str):
                add(content, field, system=role in ("system", "developer"))
            elif isinstance(content, list):
                for part in content:
                    if not isinstance(part, Mapping):
                        return None
                    if part.get("type") in ("text", "input_text") and isinstance(part.get("text"), str):
                        add(part["text"], field, system=role in ("system", "developer"))
                    else:
                        # 不把图片 URL、Base64 或音频字节数当成文本 Token。
                        non_text = True
            elif content is not None:
                return None
            calls = message.get("tool_calls", [])
            if not isinstance(calls, list):
                return None
            for call in calls:
                if not isinstance(call, Mapping) or not isinstance(call.get("function"), Mapping):
                    return None
                for key in ("name", "arguments"):
                    value = call["function"].get(key)
                    if isinstance(value, str):
                        add(value, "conversation_tokens")

        for tool in tools:
            if not isinstance(tool, Mapping) or not isinstance(tool.get("function"), Mapping):
                return None
            function = tool["function"]
            for key in ("name", "description"):
                value = function.get(key)
                if isinstance(value, str):
                    add(value, "tool_definition_tokens")
            schema = function.get("parameters")
            if schema is not None:
                cached = schema_estimates.get(id(schema))
                counts["tool_definition_tokens"] += cached.tokens if cached is not None and cached.schema is schema else estimate_tool_schema(schema)

        return ContextInputBreakdown(
            system_tokens=counts["system_tokens"],
            tool_definition_tokens=counts["tool_definition_tokens"],
            skill_tokens=counts["skill_tokens"],
            mcp_tokens=counts["mcp_tokens"],
            conversation_tokens=counts["conversation_tokens"],
            tool_result_tokens=counts["tool_result_tokens"],
            contains_non_text_content=non_text, partial_attribution=partial,
        )
