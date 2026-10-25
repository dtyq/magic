"""Plan the next progressive document reading step.

Internal responsibility:
- Reads existing sample/index/state artifacts and recommends the next bounded action.
- Does not extract, summarize, or visually understand content.
- Keeps the decision surface explicit for Code Mode agents.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from app.utils.async_file_utils import async_exists, async_try_read_json

from ..constants import DEFAULT_IMAGE_UNDERSTANDING_MAX_IMAGES, INDEX_FILENAME, READING_STATE_FILENAME
from .reading_range_parser import ReadingRangeParser
from .reading_state import ReadingStateStore


class DocumentReadingPlanner:
    """Recommend the next document-converter action from current artifacts."""

    async def plan(self, output_dir: Path, *, goal: str = "", budget: str | None = None) -> dict[str, Any]:
        state = await ReadingStateStore().load(output_dir)
        index = await async_try_read_json(output_dir / INDEX_FILENAME) if await async_exists(output_dir / INDEX_FILENAME) else None
        source = state or self._state_from_index(index or {}, output_dir)
        max_units = self._budget_number(budget, "page", "unit", default=10)
        action = self._choose_action(source, goal)
        next_range = self._next_range(source, max_units)
        strategy_context = self._strategy_context(source)
        plan = {
            "goal": goal,
            "output_dir": str(output_dir),
            "recommended_action": action,
            "recommended_range": next_range,
            "recommended_mode": self._mode_for_action(action),
            "recommended_asset_strategy": strategy_context.get("recommended_strategy", "auto"),
            "asset_strategy_reason": strategy_context.get("reason", ""),
            "asset_strategy_requires_confirmation": bool(strategy_context.get("requires_user_confirmation")),
            "asset_strategy_context": strategy_context,
            "reason": self._reason(source, action),
            "risks": self._risks(source, action),
            "state_path": str(output_dir / READING_STATE_FILENAME),
            "index_available": bool(index),
        }
        source["recommended_next_actions"] = [self._action_sentence(plan)]
        if plan["asset_strategy_requires_confirmation"]:
            source["recommended_next_actions"].append(
                "Call ask_user once to confirm the recommended asset strategy before extraction."
            )
        await ReadingStateStore().save(output_dir, source)
        return plan

    @staticmethod
    def _state_from_index(index: dict[str, Any], output_dir: Path) -> dict[str, Any]:
        return {
            "source_path": index.get("source_path", ""),
            "output_dir": str(output_dir),
            "file_type": index.get("file_type", ""),
            "unit_type": index.get("unit_type", ""),
            "total_units": index.get("total_units", 0),
            "sampled_ranges": [],
            "extracted_ranges": [str(chunk.get("source_range") or "") for chunk in index.get("chunks", []) if chunk.get("source_range")],
            "visually_understood_images": [],
            "unread_ranges": [],
            "discovered_sections": [],
            "recommended_next_actions": [],
            "current_reading_goal": "",
            "metadata": index.get("metadata", {}),
        }

    @staticmethod
    def _strategy_context(state: dict[str, Any]) -> dict[str, Any]:
        """从抽样状态读取资产策略上下文，供主 Agent 决定是否询问用户。"""

        metadata = state.get("metadata") or {}
        context = metadata.get("strategy_context")
        return dict(context) if isinstance(context, dict) else {}

    @staticmethod
    def _budget_number(budget: str | None, *keywords: str, default: int) -> int:
        if not budget:
            return default
        lowered = budget.lower()
        for keyword in keywords:
            match = re.search(rf"(\d+)\s*{re.escape(keyword)}", lowered)
            if match:
                return max(1, int(match.group(1)))
        match = re.search(r"\d+", lowered)
        return max(1, int(match.group(0))) if match else default

    @staticmethod
    def _choose_action(state: dict[str, Any], goal: str) -> str:
        metadata = state.get("metadata") or {}
        last_sample = metadata.get("last_sample") or {}
        if last_sample.get("image_dominant"):
            return "understand_document_images"
        if state.get("file_type") == "spreadsheet":
            return "extract_document_content"
        if state.get("unit_type") == "slide":
            return "extract_document_content"
        if last_sample.get("has_extractable_text") or state.get("file_type") in {"pdf", "word", "markdown", "text"}:
            return "extract_document_content"
        if "summary" in goal.lower() or "总结" in goal:
            return "sample_document_content"
        return "build_document_index"

    @staticmethod
    def _next_range(state: dict[str, Any], max_units: int) -> str:
        total = int(state.get("total_units") or 0)
        unit_type = str(state.get("unit_type") or "")
        consumed_ranges = (state.get("sampled_ranges") or []) + (state.get("extracted_ranges") or [])
        return ReadingRangeParser.next_unread_range(total, unit_type, consumed_ranges, max_units)

    @staticmethod
    def _mode_for_action(action: str) -> str:
        if action == "understand_document_images":
            return "understand_images"
        if action == "extract_document_content":
            return "local_text"
        return "auto"

    @staticmethod
    def _reason(state: dict[str, Any], action: str) -> str:
        last_sample = (state.get("metadata") or {}).get("last_sample") or {}
        if action == "understand_document_images":
            return "The latest sample is image-dominant and has little extractable text."
        if action == "extract_document_content":
            if last_sample.get("has_extractable_text"):
                return "The latest sample contains extractable text, so targeted text extraction is appropriate."
            return "The document type supports bounded extraction."
        if action == "sample_document_content":
            return "More sampling is needed before choosing a full reading strategy."
        return "A structural index is needed before detailed reading."

    @staticmethod
    def _risks(state: dict[str, Any], action: str) -> list[str]:
        if action == "understand_document_images":
            return [
                f"understand_document_images processes at most {DEFAULT_IMAGE_UNDERSTANDING_MAX_IMAGES} images per call.",
                "Visual results must be written back before summarizing.",
            ]
        if not state.get("metadata", {}).get("last_sample"):
            return ["No sample has been recorded yet; planning confidence is low."]
        return []

    @staticmethod
    def _action_sentence(plan: dict[str, Any]) -> str:
        next_range = plan.get("recommended_range")
        if next_range:
            return f"Call {plan['recommended_action']} for range {next_range}."
        return f"Call {plan['recommended_action']} for the next bounded read."
