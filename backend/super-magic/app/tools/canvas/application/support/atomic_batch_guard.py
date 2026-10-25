"""Canvas 原子批量请求的关联标识与错误映射。"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any, Protocol

from app.tools.canvas.domain.errors import CanvasBatchError, CanvasDomainError


class ItemReferenceCommand(Protocol):
    """声明批量命令必须提供的关联标识。"""

    @property
    def item_ref(self) -> str:
        """返回批量命令的关联标识。"""
        ...


class AtomicBatchGuard:
    """统一校验 item_ref，并生成逐项失败结果。"""

    @staticmethod
    def validate_item_refs(items: Sequence[ItemReferenceCommand]) -> None:
        """保证同一批次的关联标签非空且唯一。"""
        refs = [item.item_ref.strip() for item in items]
        if any(not item_ref for item_ref in refs) or len(refs) != len(set(refs)):
            raise CanvasDomainError(
                "ITEM_REF_INVALID",
                "item_ref values must be non-empty and unique within a batch.",
            )

    @staticmethod
    def map_error(
        items: Sequence[ItemReferenceCommand],
        failed_item_ref: str | None,
        error: CanvasDomainError,
    ) -> CanvasDomainError:
        """多项批次返回逐项状态，单项保留原业务错误码。"""
        if len(items) == 1:
            item_ref = items[0].item_ref or "-"
            return CanvasDomainError(
                error.code,
                f"item_ref={item_ref} | {error.message}",
            )
        results: list[dict[str, Any]] = []
        for item in items:
            item_ref = item.item_ref or "-"
            if item_ref == failed_item_ref:
                results.append({
                    "item_ref": item_ref,
                    "status": "failed",
                    "error_code": error.code,
                    "reason": error.message,
                })
            else:
                results.append({
                    "item_ref": item_ref,
                    "status": "not_applied",
                    "error_code": "BATCH_VALIDATION_FAILED",
                    "reason": "The atomic batch was not written because another item failed validation.",
                })
        return CanvasBatchError(results)
