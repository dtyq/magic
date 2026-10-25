"""图片搜索任务契约。"""

from dataclasses import dataclass


@dataclass(frozen=True)
class ImageSearchTask:
    """描述一项搜索并导入图片候选的请求。"""

    item_ref: str
    name: str
    query: str
    requirement_explanation: str | None = None
    expected_aspect_ratio: str | None = None
    count: int = 3
