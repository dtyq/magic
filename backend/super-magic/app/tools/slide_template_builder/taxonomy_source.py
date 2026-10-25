"""Resolve the live slide template taxonomy, falling back to the bundled snapshot."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from app.infrastructure.magic_service.client import MagicServiceClient
from app.tools.slide_template_builder.taxonomy import catalog_from_payload, load_taxonomy

logger = get_logger(__name__)

TaxonomySource = Literal["live", "fallback"]


@dataclass(frozen=True)
class TaxonomySnapshot:
    catalog: dict[str, Any]
    source: TaxonomySource


def access_context_from_tool(tool_context: ToolContext) -> dict[str, Any]:
    task_id = str(tool_context.get_metadata("super_magic_task_id") or "").strip()
    if not task_id:
        task_id = str(tool_context.get_metadata("task_id") or "").strip()
    return {
        "topic_id": tool_context.get_metadata("topic_id"),
        "chat_topic_id": tool_context.get_metadata("chat_topic_id"),
        "project_id": tool_context.get_metadata("project_id"),
        "task_id": task_id,
        "message_id": tool_context.get_metadata("message_id"),
        "source": "super_magic_tool",
    }


async def resolve_taxonomy(access_context: dict[str, Any] | None = None) -> TaxonomySnapshot:
    try:
        async with MagicServiceClient() as client:
            payload = await client.get_slides_template_taxonomy(access_context)
        return TaxonomySnapshot(catalog=catalog_from_payload(payload), source="live")
    except Exception as exc:
        logger.warning("Live slide template taxonomy unavailable, using bundled snapshot: %s", exc)
        return TaxonomySnapshot(catalog=load_taxonomy(), source="fallback")
