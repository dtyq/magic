"""IM channel ServerMessage reply content extraction."""
from __future__ import annotations

from typing import Any


def extract_v1_reply_content(payload: dict[str, Any]) -> str:
    """从 v1 agent_reply 消息提取 assistant 正文。"""
    if payload.get("type") != "agent_reply":
        return ""

    content = payload.get("content")
    return content if isinstance(content, str) else ""


def extract_v1_reasoning_content(payload: dict[str, Any]) -> str:
    """从 v1 agent_reply 消息提取 reasoning 正文。"""
    if payload.get("type") != "agent_reply":
        return ""

    content = payload.get("content")
    return content if isinstance(content, str) else ""


def _get_v2_super_magic_message(payload: dict[str, Any]) -> dict[str, Any] | None:
    raw_content = payload.get("raw_content")
    if not isinstance(raw_content, dict):
        return None

    super_magic_message = raw_content.get("super_magic_message")
    return super_magic_message if isinstance(super_magic_message, dict) else None


def extract_v2_reply_content(payload: dict[str, Any]) -> str:
    """从 v2 super_magic_message 消息提取 assistant 正文。"""
    super_magic_message = _get_v2_super_magic_message(payload)
    if super_magic_message is None:
        return ""

    if super_magic_message.get("role") != "assistant":
        return ""

    content = super_magic_message.get("content")
    return content if isinstance(content, str) else ""


def extract_v2_reasoning_content(payload: dict[str, Any]) -> str:
    """从 v2 super_magic_message 消息提取 assistant reasoning 正文。"""
    super_magic_message = _get_v2_super_magic_message(payload)
    if super_magic_message is None:
        return ""

    if super_magic_message.get("role") != "assistant":
        return ""

    reasoning_content = super_magic_message.get("reasoning_content")
    return reasoning_content if isinstance(reasoning_content, str) else ""


def extract_reply_content(payload: dict[str, Any]) -> str:
    """兼容 v1/v2 ServerMessage，提取可发给 IM 用户的 assistant 正文。"""
    if payload.get("content_type") != "content":
        return ""

    # v1 兼容只集中在这里；未来废弃 v1 时删除 extract_v1_* 并移除此分支即可。
    return extract_v1_reply_content(payload) or extract_v2_reply_content(payload)


def extract_reasoning_content(payload: dict[str, Any]) -> str:
    """兼容 v1/v2 ServerMessage，提取可发给 IM 用户的 assistant reasoning。"""
    if payload.get("content_type") != "reasoning":
        return ""

    # v1 兼容只集中在这里；未来废弃 v1 时删除 extract_v1_* 并移除此分支即可。
    return extract_v1_reasoning_content(payload) or extract_v2_reasoning_content(payload)
