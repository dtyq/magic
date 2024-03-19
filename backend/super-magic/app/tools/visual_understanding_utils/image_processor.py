"""Image processor for visual understanding tool."""
import os
import re
import asyncio
from typing import Optional, List, Dict, Tuple, Any
from pathlib import Path

from agentlang.logger import get_logger
from agentlang.llms.factory import LLMFactory
from app.utils.async_file_utils import async_read_bytes, async_exists, async_stat, async_mkdir
from app.tools.download_from_url import DownloadFromUrl, DownloadFromUrlParams
from app.service.file_service import FileService

from .models import (
    ImageDownloadStatus,
    ImageDownloadResult,
    CopiedFileInfo,
    ImageProcessResult,
)
from .image_format_utils import (
    validate_image_signature,
    get_content_type_for_local_file,
    detect_content_type_from_file,
    FORMATS_NEED_CONVERSION,
)
from .image_info_utils import get_image_dimensions
from .image_conversion_utils import local_file_to_base64, convert_unsupported_format_to_jpeg
from .image_compress_utils import compress_if_needed, should_compress_image
from .format_utils import format_file_size
from .file_operations_utils import (
    get_workspace_path,
    is_file_in_workspace,
    copy_file_to_visual_dir,
    generate_file_download_url,
)

logger = get_logger(__name__)


class ImageProcessor:
    """图片处理器，负责图片下载、格式转换、URL生成等

    统一处理图片的下载、验证、转换和URL生成逻辑
    """

    # 配置常量
    SMART_DOWNLOAD_ENABLED = True
    URL_MODE_MAX_SIZE = 20 * 1024 * 1024  # 20MB for URL mode
    BASE64_MODE_MAX_SIZE = 4 * 1024 * 1024  # 4MB for base64 mode

    def __init__(self):
        """初始化图片处理器"""
        # 内部初始化依赖
        self._download_tool = DownloadFromUrl()
        self._file_service = FileService()

        # 从环境变量读取URL模式配置
        self.url_mode_enabled = os.environ.get('VISUAL_URL_MODE_ENABLED', 'true').lower() == 'true'

        # 使用类常量
        self.smart_download_enabled = self.SMART_DOWNLOAD_ENABLED
        self.url_mode_max_size = self.URL_MODE_MAX_SIZE
        self.base64_mode_max_size = self.BASE64_MODE_MAX_SIZE

        # 初始化 .visual 目录路径
        workspace_path = get_workspace_path()
        self.visual_dir = workspace_path / ".visual"

        # Track copied files for cleanup
        self.copied_files: List[CopiedFileInfo] = []

    async def process_image_source(
        self,
        image_source: str,
        skip_format_validation: bool = False
    ) -> ImageProcessResult:
        """处理单个图片来源，智能下载职责单一，下载成功后按本地文件处理

        Args:
            image_source: 图片URL或本地文件路径
            skip_format_validation: 是否跳过格式验证（默认False）

        Returns:
            ImageProcessResult: 图片处理结果
        """
        try:
            # 提前定义下载结果
            download_result = None
            # 保存原始source，用于后续处理（如提取文件扩展名）
            original_source = image_source

            # 1. 判断是否为URL
            is_url = re.match(r'^https?://', image_source)

            # 2. 如果是URL且不开启智能下载，直接返回
            if is_url and not self.smart_download_enabled:
                return ImageProcessResult(
                    image_data={"url": image_source},
                    download_result=None,
                    success=True,
                    image_size=None,
                    aspect_ratio=None,
                    file_size=None,
                    use_url_mode=True,
                    error_message=None
                )

            # 3. 如果是URL且开启智能下载，尝试下载
            if is_url:
                download_result = await self._smart_download_only(image_source)

                # 下载失败，直接返回原URL
                if not (download_result and
                       download_result.status == ImageDownloadStatus.SUCCESS and
                       download_result.local_path and
                       download_result.local_path.exists()):
                    logger.info(f"智能下载失败，使用原URL: {image_source}")
                    return ImageProcessResult(
                        image_data={"url": image_source},
                        download_result=download_result,
                        success=True,
                        image_size=None,
                        aspect_ratio=None,
                        file_size=None,
                        use_url_mode=True,
                        error_message=None
                    )

                # 下载成功，更新image_source为本地路径
                logger.info(f"智能下载成功，转为本地文件处理: {image_source} -> {download_result.local_path}")
                image_source = str(download_result.local_path)

            # 4. 本地文件处理前检查文件是否存在
            if not await async_exists(image_source):
                logger.error(f"图片文件不存在: {image_source}")
                return ImageProcessResult(
                    image_data=None,
                    download_result=download_result,
                    success=False,
                    image_size=None,
                    aspect_ratio=None,
                    file_size=None,
                    copied_file_info=None,
                    use_url_mode=False,
                    error_message=f"文件不存在: {image_source}"
                )

            # 5. 本地文件格式校验：检查是否为有效的图片格式
            if not skip_format_validation:
                try:
                    # 异步读取文件头
                    file_header = await async_read_bytes(image_source, size=100)

                    if not validate_image_signature(file_header):
                        logger.error(f"无效的图片格式: {image_source}")
                        return ImageProcessResult(
                            image_data=None,
                            download_result=download_result,
                            success=False,
                            image_size=None,
                            aspect_ratio=None,
                            file_size=None,
                            copied_file_info=None,
                            use_url_mode=False,
                            error_message=f"文件格式不支持，请使用有效的图片格式（JPEG、PNG、GIF、WEBP、BMP等）: {image_source}"
                        )
                    logger.debug(f"图片格式校验通过: {image_source}")
                except Exception as e:
                    logger.error(f"读取文件进行格式校验时出错: {image_source}, 错误: {e}")
                    return ImageProcessResult(
                        image_data=None,
                        download_result=download_result,
                        success=False,
                        image_size=None,
                        aspect_ratio=None,
                        file_size=None,
                        copied_file_info=None,
                        use_url_mode=False,
                        error_message=f"读取文件失败: {str(e)}"
                    )
            else:
                logger.debug(f"跳过图片格式校验: {image_source}")

            # 5.5 检测并转换不支持的格式（如 AVIF、HEIC、HEIF、TIFF）
            # 这些格式虽然通过了格式校验，但 PIL 和部分 LLM 可能不支持，或文件过大
            # 需要转换为 JPEG 后再处理
            detected_type = await detect_content_type_from_file(image_source)
            if detected_type in FORMATS_NEED_CONVERSION:
                logger.info(f"检测到不兼容格式 ({detected_type})，开始转换为 JPEG: {image_source}")
                # 确保 .visual 目录存在
                await async_mkdir(self.visual_dir, parents=True, exist_ok=True)
                converted_path = await convert_unsupported_format_to_jpeg(image_source, str(self.visual_dir))

                if converted_path:
                    logger.info(f"格式转换成功 ({detected_type} → JPEG)，使用转换后的文件: {converted_path}")

                    # 将转换后的文件添加到清理列表
                    converted_file_info = CopiedFileInfo(
                        original_path=str(Path(original_source).resolve()),
                        copied_path=str(Path(converted_path).resolve()),
                        relative_path=Path(converted_path).name
                    )
                    self.copied_files.append(converted_file_info)

                    # 使用转换后的文件路径替换原路径
                    image_source = converted_path
                else:
                    logger.error(f"格式转换失败 ({detected_type}): {image_source}")
                    return ImageProcessResult(
                        image_data=None,
                        download_result=download_result,
                        success=False,
                        image_size=None,
                        aspect_ratio=None,
                        file_size=None,
                        copied_file_info=None,
                        use_url_mode=False,
                        error_message=f"图片格式转换失败，无法处理 {detected_type} 格式: {original_source}"
                    )

            # 6. 本地文件处理：优先URL模式，失败后回退base64模式
            # 传递原始source信息，用于提取文件扩展名等
            result = await self._process_local_file_with_url_priority(image_source, original_source)

            # 如果有下载结果，添加到返回结果中
            if download_result is not None:
                result.download_result = download_result

            return result

        except Exception as e:
            logger.error(f"处理图片来源失败: {e!s}")
            return ImageProcessResult(
                image_data=None,
                download_result=None,
                success=False,
                image_size=None,
                aspect_ratio=None,
                file_size=None,
                use_url_mode=False,
                error_message=f"处理异常: {str(e)}"
            )

    async def _process_local_file_with_url_priority(
        self,
        image_source: str,
        original_source: Optional[str] = None
    ) -> ImageProcessResult:
        """处理本地文件，优先URL模式，失败后回退base64模式

        Args:
            image_source: Local file path
            original_source: Original source (URL or path) for context, used to extract file extension if needed
        """

        # Get image dimensions for local file
        image_size, aspect_ratio, file_size = await get_image_dimensions(image_source)

        # If URL mode is disabled, directly use base64 mode
        if not self.url_mode_enabled:
            logger.debug(f"直接使用base64模式处理本地文件: {image_source}")
            return await self._fallback_to_base64_mode(image_source, image_size, aspect_ratio, file_size)

        try:
            # Step 1: 尝试URL模式
            logger.info(f"尝试URL模式处理本地文件: {image_source} (文件大小: {file_size} bytes)")

            copied_file_info = None
            relative_path = None

            # Step 1.1: 检查是否需要压缩图片（超过10MB）
            needs_compress = await should_compress_image(image_source)

            if needs_compress:
                # 需要压缩：直接压缩到 .visual 目录
                logger.info(f"图片需要压缩，将压缩到 .visual 目录: {image_source}")
                await async_mkdir(self.visual_dir, parents=True, exist_ok=True)

                compressed_path = await compress_if_needed(image_source, output_dir=str(self.visual_dir))
                if compressed_path != image_source and await async_exists(compressed_path):
                    logger.info(f"图片已压缩到 .visual 目录: {compressed_path}")

                    # 计算相对路径
                    compressed_file_path = Path(compressed_path)
                    relative_path = f".visual/{compressed_file_path.name}"

                    # 创建 copied_file_info（即使没有真正"复制"，也需要记录以便清理）
                    copied_file_info = CopiedFileInfo(
                        original_path=str(Path(image_source).resolve()),
                        copied_path=str(compressed_file_path.resolve()),
                        relative_path=relative_path
                    )
                    self.copied_files.append(copied_file_info)

                    # 等待文件同步到OSS (S3机制)
                    await asyncio.sleep(0.1)
                else:
                    raise ValueError(f"压缩图片失败: {image_source}")
            else:
                # 不需要压缩：按原逻辑处理
                # Check if file is in workspace
                is_in_workspace_flag = is_file_in_workspace(image_source)

                if is_in_workspace_flag:
                    # 文件在workspace内，计算相对于workspace的路径
                    workspace_path = get_workspace_path()
                    file_abs_path = Path(image_source).resolve()
                    workspace_abs_path = workspace_path.resolve()
                    try:
                        relative_path = str(file_abs_path.relative_to(workspace_abs_path))
                        logger.info(f"文件在workspace内，相对于workspace的路径: {relative_path}")
                    except ValueError:
                        logger.warning(f"计算相对于workspace的路径失败，回退到复制模式")
                        is_in_workspace_flag = False

                if not is_in_workspace_flag:
                    # 文件不在workspace内，复制到.visual目录
                    copied_file_info = await copy_file_to_visual_dir(image_source, original_source)
                    if not copied_file_info:
                        raise ValueError(f"复制文件失败: {image_source}")

                    # Track copied file
                    self.copied_files.append(copied_file_info)
                    relative_path = copied_file_info.relative_path

                    # 等待文件同步到OSS (S3机制)
                    await asyncio.sleep(0.1)

            # Generate download URL
            download_url = await generate_file_download_url(relative_path, self._file_service)
            if not download_url:
                raise ValueError(f"生成下载URL失败: {image_source}")

            logger.info(f"生成下载URL成功: {image_source} -> {download_url}")
            return ImageProcessResult(
                image_data={"url": download_url},
                download_result=None,
                success=True,
                image_size=image_size,
                aspect_ratio=aspect_ratio,
                file_size=file_size,
                copied_file_info=copied_file_info,
                use_url_mode=True,
                error_message=None
            )

        except Exception as e:
            logger.warning(f"URL模式处理失败: {image_source}, 错误: {e}, 回退到base64模式")
            return await self._fallback_to_base64_mode(image_source, image_size, aspect_ratio, file_size)

    async def _smart_download_only(self, image_url: str) -> Optional[ImageDownloadResult]:
        """智能下载图片，仅负责下载功能，职责单一

        使用 DownloadFromUrl 的 cache_only 模式，直接使用缓存目录

        Args:
            image_url: 图片URL

        Returns:
            Optional[ImageDownloadResult]: 下载结果，包含成功/失败状态和本地路径
        """
        try:
            logger.debug(f"开始智能下载图片: {image_url}")

            # Use cache-only mode for temporary files
            download_params = DownloadFromUrlParams(
                url=image_url,
                file_path="",  # Empty path for cache-only mode
            )

            result = await self._download_tool.execute_purely(download_params, cache_only=True)

            if not result.ok or not result.extra_info:
                # Download failed
                error_msg = result.content if not result.ok else "下载失败"
                logger.warning(f"智能下载失败: {image_url} - {error_msg}")
                return ImageDownloadResult(
                    status=ImageDownloadStatus.DOWNLOAD_ERROR,
                    error_message=error_msg
                )

            # Download successful, get file info
            downloaded_file_path = result.extra_info.get("file_path")
            file_size = result.extra_info.get("file_size", 0)

            logger.debug(f"智能下载成功 - 本地路径: {downloaded_file_path}, 文件大小: {file_size}")

            if not downloaded_file_path or not Path(downloaded_file_path).exists():
                logger.warning(f"下载的文件不存在: {downloaded_file_path}")
                return ImageDownloadResult(
                    status=ImageDownloadStatus.DOWNLOAD_ERROR,
                    error_message="下载的文件不存在"
                )

            # Validate image file signature
            try:
                # Read first 100 bytes for validation
                content_header = await async_read_bytes(downloaded_file_path, size=100)

                if not validate_image_signature(content_header):
                    logger.warning(f"无效的图片格式: {image_url}")
                    return ImageDownloadResult(
                        status=ImageDownloadStatus.INVALID_CONTENT,
                        local_path=Path(downloaded_file_path),
                        content_size=file_size,
                        error_message="无效的图片格式"
                    )
            except Exception as e:
                logger.warning(f"验证图片格式时出错: {e}")
                # Continue anyway, let the subsequent process try to handle it
                pass

            # Download successful
            logger.info(f"智能下载完成: {image_url} -> {downloaded_file_path}")
            return ImageDownloadResult(
                    status=ImageDownloadStatus.SUCCESS,
                    local_path=Path(downloaded_file_path),
                    content_size=file_size
                )

        except Exception as e:
            logger.warning(f"智能下载异常: {image_url}, 错误: {e}")
            return ImageDownloadResult(
                status=ImageDownloadStatus.DOWNLOAD_ERROR,
                error_message=str(e)
            )

    async def _fallback_to_base64_mode(
        self,
        image_source: str,
        image_size: Optional[Tuple[int, int]],
        aspect_ratio: Optional[float],
        file_size: Optional[int]
    ) -> ImageProcessResult:
        """回退到base64模式处理本地文件"""
        try:
            logger.info(f"使用base64模式处理: {image_source}")

            # 获取 content_type（从文件内容检测）
            content_type = await get_content_type_for_local_file(image_source)

            # 转换为 Base64，如果文件超过 3MB 则自动压缩到 3MB
            image_data = {"url": await local_file_to_base64(
                image_source,
                content_type,
                compress_threshold_mb=3.0
            )}

            return ImageProcessResult(
                image_data=image_data,
                download_result=None,
                success=True,
                image_size=image_size,
                aspect_ratio=aspect_ratio,
                file_size=file_size,
                copied_file_info=None,
                use_url_mode=False,
                error_message=None
            )
        except Exception as e:
            logger.error(f"base64模式也失败: {image_source}, 错误: {e}")
            return ImageProcessResult(
                image_data=None,
                download_result=None,
                success=False,
                image_size=image_size,
                aspect_ratio=aspect_ratio,
                file_size=file_size,
                copied_file_info=None,
                use_url_mode=False,
                error_message=f"Base64模式处理失败: {str(e)}"
            )
