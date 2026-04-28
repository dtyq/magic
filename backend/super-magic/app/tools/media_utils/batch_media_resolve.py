"""批量媒体来源解析的通用数据结构。

用于图片理解、视频理解等媒体处理工具中，统一表达
"将一批媒体来源（URL / 本地路径 / base64）解析为可传给 LLM 的 URL"
这一步骤的成功/失败结果。
"""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class MediaResolveResult:
    """单个媒体来源的解析结果。

    Attributes:
        source: 原始输入来源（URL、本地路径或 base64 data URL）
        resolved_url: 解析后可传给 LLM 的 URL 或 base64 data URL；失败时为 None
        error: 解析失败的错误描述；成功时为 None
    """
    source: str
    resolved_url: Optional[str] = None
    error: Optional[str] = None

    @property
    def success(self) -> bool:
        """是否解析成功。"""
        return self.resolved_url is not None


@dataclass
class BatchMediaResolveResults:
    """批量媒体来源解析结果的容器。

    Attributes:
        results: 所有解析结果列表，顺序与输入来源一致
    """
    results: List[MediaResolveResult] = field(default_factory=list)

    @property
    def successful(self) -> List[MediaResolveResult]:
        """所有解析成功的结果。"""
        return [r for r in self.results if r.success]

    @property
    def failed(self) -> List[MediaResolveResult]:
        """所有解析失败的结果。"""
        return [r for r in self.results if not r.success]

    @property
    def success_count(self) -> int:
        """解析成功的数量。"""
        return len(self.successful)

    @property
    def failed_count(self) -> int:
        """解析失败的数量。"""
        return len(self.failed)
