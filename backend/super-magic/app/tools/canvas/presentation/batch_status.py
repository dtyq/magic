"""Canvas 批量结果的统一状态聚合。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n

SUCCESS_STATUSES = frozenset(
    {
        "completed",
        "added",
        "removed",
        "replaced",
        "created",
        "reused",
        "already_removed",
        "already_replaced",
        "estimated",
        "not_billable",
        "changed",
        "unchanged",
        "unframed",
        "prepared",
        "shared_file_kept",
        "file_deleted",
    }
)
PROCESSING_STATUSES = frozenset({"pending", "processing", "queued", "running"})
PARTIAL_STATUSES = frozenset({"partial", "file_renamed"})
FAILED_STATUSES = frozenset(
    {
        "failed",
        "error",
        "not_found",
        "not_applicable",
        "not_applied",
        "unavailable",
        "retained",
        "canvas_write_failed",
        "deletion_unconfirmed",
        "rename_unconfirmed",
    }
)


@dataclass(frozen=True)
class CanvasBatchStatus:
    """保存批量结果的聚合状态和各类数量。"""

    status: str
    total: int
    succeeded: int
    processing: int
    failed: int
    partial: int = 0

    @property
    def ok(self) -> bool:
        """判断结果是否可以作为无失败的工具结果继续处理。"""
        return self.status in {"succeeded", "processing"}


def summarize_items(items: Any, *, fallback_ok: bool = True) -> CanvasBatchStatus:
    """按逐项 status 聚合 succeeded、processing、partial 或 failed。"""
    values = [item for item in items if isinstance(item, Mapping)] if isinstance(items, list) else []
    if not values:
        status = "succeeded" if fallback_ok else "failed"
        return CanvasBatchStatus(status, 0, 0, 0, 0 if fallback_ok else 1)

    succeeded = processing = failed = partial = 0
    for item in values:
        item_status = str(item.get("status") or "").casefold()
        if item_status in SUCCESS_STATUSES:
            succeeded += 1
        elif item_status in PROCESSING_STATUSES:
            processing += 1
        elif item_status in PARTIAL_STATUSES:
            partial += 1
        elif item_status in FAILED_STATUSES or not item_status:
            failed += 1
        else:
            # 未登记的新状态先按失败处理，避免成功文案掩盖协议漂移。
            failed += 1

    total = len(values)
    if partial or (failed and (succeeded or processing)):
        status = "partial"
    elif failed == total:
        status = "failed"
    elif processing:
        status = "processing"
    else:
        status = "succeeded"
    return CanvasBatchStatus(status, total, succeeded, processing, failed, partial)


def summarize_tool_result(result: ToolResult) -> CanvasBatchStatus:
    """按 ToolResult.data.items 聚合状态，并兼容非批量结果。"""
    data = result.data or {}
    items = data.get("items") if isinstance(data, Mapping) else None
    if isinstance(items, list):
        return summarize_items(items, fallback_ok=result.ok)
    return summarize_items([], fallback_ok=result.ok)


def canvas_result_remark(status: CanvasBatchStatus) -> str:
    """根据结果数量选择单项反馈或批量反馈文案。"""
    if status.total <= 1:
        if status.partial:
            return i18n.translate("canvas.operation_partial", category="tool.messages")
        if status.processing:
            return i18n.translate("canvas.operation_processing", category="tool.messages")
        if status.failed:
            return i18n.translate("canvas.operation_failed", category="tool.messages")
        return i18n.translate("canvas.operation_completed", category="tool.messages")
    return i18n.translate(
        "canvas.batch_result",
        category="tool.messages",
        completed=status.succeeded,
        processing=status.processing,
        failed=status.failed,
        total=status.total,
    )


def batch_tool_result(content: str, data: dict[str, Any]) -> ToolResult:
    """创建 ok 与批量逐项状态一致的 ToolResult。"""
    status = summarize_items(data.get("items"), fallback_ok=True)
    return ToolResult(content=content, ok=status.ok, data=data)
