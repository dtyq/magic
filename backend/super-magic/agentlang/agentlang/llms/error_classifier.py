from dataclasses import dataclass, field
import json
from typing import Any, Optional


@dataclass
class LLMErrorSnapshot:
    """归一化后的 LLM 错误快照"""
    status_code: Optional[int] = None
    primary_message: str = ""
    candidate_texts: list[str] = field(default_factory=list)


class LLMErrorClassifier:
    """集中处理 LLM 厂商错误归类，避免异常定义与检测逻辑耦合"""

    SNAPSHOT_ATTR = "_llm_error_snapshot"
    CONTEXT_WINDOW_STATUS_CODES = {400, 413, 422}
    CONTEXT_WINDOW_STRONG_MARKERS = (
        "messages prompt is too long",
        "prompt is too long",
        "maximum context length",
        "context length exceeded",
        "context window",
        "context_length_exceeded",
        "prompt is longer than the maximum",
        "requested tokens exceed",
        "please reduce the length of the messages",
        "input length and max_tokens exceed context limit",
        "input is too long for requested model",
        "the input token count",
        "exceeds the maximum number of tokens allowed",
        "your input exceeds the context window of this model",
        "please reduce the length of the messages or completion",
    )
    CONTEXT_WINDOW_SOFT_MARKERS = (
        "too many tokens",
        "token limit",
        "request too large",
        "payload too large",
        "input too long",
        "prompt tokens",
        "max context",
        "reduce the length",
    )

    @classmethod
    def extract_snapshot(cls, exception: Exception) -> LLMErrorSnapshot:
        """从异常中提取统一错误快照，兼容不同厂商 SDK 的字段差异"""
        attached_snapshot = cls.get_attached_snapshot(exception)
        if attached_snapshot is not None:
            return attached_snapshot

        response = getattr(exception, "response", None)

        if hasattr(exception, "message"):
            error_message = str(exception.message)
        elif hasattr(exception, "body"):
            error_message = str(exception.body)
        else:
            error_message = str(exception)

        candidate_texts = cls._collect_candidate_error_texts(response=response, error_message=error_message)
        return LLMErrorSnapshot(
            status_code=getattr(response, "status_code", None),
            primary_message=candidate_texts[0] if candidate_texts else error_message,
            candidate_texts=candidate_texts,
        )

    @classmethod
    def attach_snapshot(cls, exception: BaseException, snapshot: LLMErrorSnapshot) -> None:
        """把归一化快照挂到原始异常上，避免深层逻辑再造一层业务异常。"""
        try:
            setattr(exception, cls.SNAPSHOT_ATTR, snapshot)
        except Exception:
            pass

    @classmethod
    def get_attached_snapshot(cls, exception: BaseException) -> LLMErrorSnapshot | None:
        """读取已挂载的快照。"""
        snapshot = getattr(exception, cls.SNAPSHOT_ATTR, None)
        return snapshot if isinstance(snapshot, LLMErrorSnapshot) else None

    @classmethod
    def is_context_window_exceeded(cls, snapshot: LLMErrorSnapshot) -> bool:
        """判断是否为上下文过长/请求体过大的不可恢复错误"""
        normalized_text = "\n".join(snapshot.candidate_texts).lower()

        if any(marker in normalized_text for marker in cls.CONTEXT_WINDOW_STRONG_MARKERS):
            return True

        if snapshot.status_code in cls.CONTEXT_WINDOW_STATUS_CODES:
            soft_hit_count = sum(marker in normalized_text for marker in cls.CONTEXT_WINDOW_SOFT_MARKERS)
            if soft_hit_count >= 2:
                return True

        return False

    @classmethod
    def _collect_candidate_error_texts(cls, response=None, error_message: str = "") -> list[str]:
        """收集可用于错误归类的文本片段"""
        candidates: list[str] = []

        if error_message:
            candidates.append(str(error_message))

        if response is not None:
            text = getattr(response, "text", None)
            if text:
                candidates.append(str(text))

            if hasattr(response, "json"):
                try:
                    payload = response.json()
                    candidates.extend(cls._collect_strings_from_payload(payload))
                except Exception:
                    pass

        return [item for item in candidates if item]

    @classmethod
    def _collect_strings_from_payload(cls, payload: Any) -> list[str]:
        """递归提取响应体中的字符串，兼容不同厂商字段结构"""
        if isinstance(payload, str):
            return [payload]
        if isinstance(payload, dict):
            values: list[str] = []
            for value in payload.values():
                values.extend(cls._collect_strings_from_payload(value))
            return values
        if isinstance(payload, list):
            values: list[str] = []
            for item in payload:
                values.extend(cls._collect_strings_from_payload(item))
            return values
        return []

    @classmethod
    def from_json_payload(cls, json_str: str) -> dict[str, Any]:
        """解析 JSON 字符串，失败时返回空字典"""
        try:
            data = json.loads(json_str)
            return data if isinstance(data, dict) else {}
        except (json.JSONDecodeError, TypeError):
            return {}
