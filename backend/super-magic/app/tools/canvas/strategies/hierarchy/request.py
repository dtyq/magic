"""Frame 框选策略请求模型。"""

from dataclasses import dataclass


@dataclass(frozen=True)
class FrameSelectionRequest:
    """描述一次将同层级 Element 框选为 Frame 的请求。"""

    item_ref: str
    element_ids: tuple[str, ...]
    name: str | None = None
    padding: float | None = None
