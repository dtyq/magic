"""Visual understanding data models and enums."""
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional, Tuple, Dict, List, Any


class ImageDownloadStatus(Enum):
    """Image download status enumeration"""
    SUCCESS = "success"
    DOWNLOAD_ERROR = "download_error"
    TIMEOUT = "timeout"
    INVALID_CONTENT = "invalid_content"  # Response is not a valid image
    SIZE_TOO_LARGE = "size_too_large"  # Image too large for download mode


@dataclass
class ImageDownloadResult:
    """Result of image download attempt"""
    status: ImageDownloadStatus
    local_path: Optional[Path] = None
    error_message: Optional[str] = None
    content_size: Optional[int] = None  # Size in bytes


@dataclass
class CopiedFileInfo:
    """Information about a file copied to .visual directory"""
    original_path: str
    copied_path: str
    relative_path: str  # Path relative to workspace/.visual/


@dataclass
class ImageProcessResult:
    """图片处理结果"""
    image_data: Optional[Dict[str, str]]  # 图片数据，如 {"url": "https://..."} 或 {"url": "data:image/jpeg;base64,..."}
    download_result: Optional[ImageDownloadResult]  # 下载状态结果
    success: bool  # 是否处理成功
    image_size: Optional[Tuple[int, int]] = None  # Image size in pixels (width, height)
    aspect_ratio: Optional[float] = None  # Width/Height ratio
    file_size: Optional[int] = None  # File size in bytes
    copied_file_info: Optional[CopiedFileInfo] = None  # Information about copied file if any
    use_url_mode: bool = True  # Whether to use URL mode (True) or base64 mode (False)
    error_message: Optional[str] = None  # 错误信息，用于透传具体的错误原因


@dataclass
class ImageData:
    """图片数据封装"""
    url: str  # 图片URL（可以是HTTP URL或base64 data URL）

    def to_dict(self) -> Dict[str, str]:
        """转换为字典格式（兼容旧的格式）"""
        return {"url": self.url}

    @classmethod
    def from_dict(cls, data: Dict[str, str]) -> 'ImageData':
        """从字典创建实例"""
        return cls(url=data.get("url", ""))


@dataclass
class ImageDimensionInfo:
    """图片尺寸信息"""
    size: Optional[Tuple[int, int]]  # (width, height)
    aspect_ratio: Optional[float]  # 宽高比
    file_size: Optional[int]  # 文件大小（字节）


@dataclass
class SingleImageResult:
    """单个图片的处理结果（统一封装成功和失败的情况）"""
    index: int  # 图片索引（从1开始，用于显示）
    source: str  # 图片来源（URL或路径）
    name: str  # 图片显示名称
    success: bool  # 是否处理成功

    # 成功时的数据
    image_data: Optional[ImageData] = None  # 图片数据（URL）
    dimension_info: Optional[ImageDimensionInfo] = None  # 尺寸信息
    copied_file_info: Optional[CopiedFileInfo] = None  # 复制文件信息（如果有的话）

    # 失败时的数据
    error: Optional[str] = None  # 错误信息

    # 下载状态（无论成功失败都可能有）
    download_result: Optional[ImageDownloadResult] = None


@dataclass
class BatchImageProcessingResults:
    """批量图片处理结果的封装类 - 使用统一的结果列表"""
    results: List[SingleImageResult] = field(default_factory=list)  # 所有图片的处理结果（成功+失败）

    @property
    def success_count(self) -> int:
        """成功处理的图片数量"""
        return sum(1 for r in self.results if r.success)

    @property
    def failed_count(self) -> int:
        """失败的图片数量"""
        return sum(1 for r in self.results if not r.success)

    @property
    def total_count(self) -> int:
        """总图片数量"""
        return len(self.results)

    @property
    def successful_results(self) -> List[SingleImageResult]:
        """获取所有成功的结果"""
        return [r for r in self.results if r.success]

    @property
    def failed_results(self) -> List[SingleImageResult]:
        """获取所有失败的结果"""
        return [r for r in self.results if not r.success]

    def get_image_data_list(self) -> List[ImageData]:
        """获取成功图片的数据列表（用于兼容旧代码）"""
        return [r.image_data for r in self.results if r.success and r.image_data]

    def get_image_data_dicts(self) -> List[Dict[str, str]]:
        """获取成功图片数据的字典列表（用于兼容旧格式）"""
        return [r.image_data.to_dict() for r in self.results if r.success and r.image_data]

    def get_download_status_dict(self) -> Dict[str, ImageDownloadResult]:
        """获取下载状态字典（用于兼容旧代码）"""
        return {
            r.source: r.download_result
            for r in self.results
            if r.download_result is not None
        }

    def get_dimension_info_list(self) -> List[Optional[ImageDimensionInfo]]:
        """获取所有图片的尺寸信息列表（按索引顺序，失败的为None）"""
        return [r.dimension_info for r in self.results]

    def add_result(self, result: SingleImageResult) -> None:
        """添加单个图片处理结果

        Args:
            result: 图片处理结果
        """
        self.results.append(result)

    def add_successful_image(
        self,
        index: int,
        source: str,
        name: str,
        image_data: ImageData,
        dimension_info: Optional[ImageDimensionInfo],
        download_result: Optional[ImageDownloadResult] = None,
        copied_file_info: Optional[CopiedFileInfo] = None
    ) -> None:
        """添加成功处理的图片

        Args:
            index: 图片索引（从1开始）
            source: 图片来源
            name: 图片显示名称
            image_data: 图片数据
            dimension_info: 尺寸信息
            download_result: 可选的下载结果
            copied_file_info: 可选的复制文件信息
        """
        self.results.append(SingleImageResult(
            index=index,
            source=source,
            name=name,
            success=True,
            image_data=image_data,
            dimension_info=dimension_info,
            copied_file_info=copied_file_info,
            download_result=download_result
        ))

    def add_failed_image(
        self,
        index: int,
        source: str,
        name: str,
        error: str,
        download_result: Optional[ImageDownloadResult] = None
    ) -> None:
        """添加失败的图片

        Args:
            index: 图片索引（从1开始）
            source: 图片来源
            name: 图片显示名称
            error: 错误信息
            download_result: 可选的下载结果
        """
        # 如果没有提供下载结果，创建一个默认的错误结果
        if not download_result:
            download_result = ImageDownloadResult(
                status=ImageDownloadStatus.DOWNLOAD_ERROR,
                error_message=error
            )

        self.results.append(SingleImageResult(
            index=index,
            source=source,
            name=name,
            success=False,
            error=error,
            download_result=download_result
        ))
