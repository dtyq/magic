from app.i18n import i18n
import os
import asyncio
import hashlib
import shutil
import tempfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, NamedTuple, Optional, Tuple
from urllib.parse import urlparse

import aiofiles
import aiohttp
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from app.core.entity.message.server_message import FileContent, ToolDetail
from agentlang.tools.tool_result import ToolResult
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_guard_tool import WorkspaceGuardTool
from agentlang.utils.file import generate_safe_filename
from app.tools.webview_utils import IMAGE_DOWNLOAD_HEADERS
from app.utils.async_file_utils import async_copy2, async_stat, async_exists

logger = get_logger(__name__)

# Configuration constants - can be modified for different timeout settings
DOWNLOAD_TIMEOUT_SECONDS = 15  # Default timeout for HTTP requests when downloading files


class DownloadFromUrlParams(BaseToolParams):
    url: str = Field(
        ...,
        description="""<!--zh: 要下载的文件URL地址，支持HTTP和HTTPS协议-->
File URL to download, supports HTTP and HTTPS protocols"""
    )
    file_path: str = Field(
        ...,
        description="""<!--zh: 下载文件的保存路径（包含文件名），建议保存到项目工作区内合适的路径下，与项目当前架构情况匹配，并使用用户偏好语言命名。如果指定的目录不存在，会自动创建。-->
Save path for downloaded file (including filename). Recommend saving to appropriate path within project workspace matching current project structure, using user preferred language for naming. Auto-creates directory if it doesn't exist."""
    )

    @classmethod
    def get_custom_error_message(cls, field_name: str, error_type: str) -> Optional[str]:
        """获取自定义参数错误信息"""
        if field_name == "url":
            return """<!--zh: 缺少必要参数'url'。请提供有效的下载地址。-->
Missing required parameter 'url'. Please provide valid download address."""
        elif field_name == "file_path":
            return "缺少必要参数'file_path'。请提供文件保存路径。"
        return None


class DownloadResult(NamedTuple):
    """下载结果详情"""
    file_size: int  # 文件大小（字节）
    content_type: str  # 内容类型
    file_exists: bool  # 文件是否已存在
    file_path: str  # 文件保存路径
    url: str  # 下载的URL（可能是重定向后的URL）
    from_cache: bool  # 是否命中缓存


@dataclass
class CacheMetadata:
    """缓存文件元数据"""
    content_type: str
    url: str
    file_size: int
    cached_at: str


class DownloadCacheManager:
    """下载缓存文件管理器"""

    def __init__(self):
        # 获取系统临时目录并创建应用特定的缓存目录
        self.cache_dir = Path(tempfile.gettempdir()) / "super-magic-downloads"

    def get_cache_path(self, url: str) -> Path:
        """根据URL生成缓存文件路径

        Args:
            url: 要下载的URL

        Returns:
            Path: 缓存文件路径
        """
        # 创建URL哈希作为缓存文件名
        url_hash = hashlib.sha256(url.encode('utf-8')).hexdigest()

        # 不带扩展名，保持简洁和健壮
        return self.cache_dir / url_hash

    async def ensure_cache_dir(self) -> None:
        """确保缓存目录存在"""
        if not self.cache_dir.exists():
            await asyncio.to_thread(self.cache_dir.mkdir, parents=True, exist_ok=True)
            logger.info(f"创建缓存目录: {self.cache_dir}")

    async def save_metadata(self, cache_path: Path, content_type: str, url: str, file_size: int) -> None:
        """保存缓存文件的元数据

        Args:
            cache_path: 缓存文件路径
            content_type: HTTP Content-Type
            url: 重定向后的最终URL
            file_size: 文件大小（字节）
        """
        import json

        metadata = CacheMetadata(
            content_type=content_type,
            url=url,
            file_size=file_size,
            cached_at=datetime.now().isoformat()
        )

        meta_path = cache_path.with_suffix('.meta')
        try:
            with open(meta_path, 'w', encoding='utf-8') as f:
                # 将数据类转换为字典以进行JSON序列化
                json.dump(metadata.__dict__, f)
            logger.debug(f"保存元数据: {meta_path}")
        except Exception as e:
            logger.warning(f"保存缓存元数据失败 {meta_path}: {e}")

    async def load_metadata(self, cache_path: Path) -> Optional[CacheMetadata]:
        """加载缓存文件的元数据

        Args:
            cache_path: 缓存文件路径

        Returns:
            Optional[CacheMetadata]: 元数据对象（如果找到），否则为None
        """
        import json

        meta_path = cache_path.with_suffix('.meta')
        try:
            if meta_path.exists():
                with open(meta_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                # 从加载的数据创建CacheMetadata对象
                metadata = CacheMetadata(**data)
                logger.debug(f"加载元数据: {meta_path}")
                return metadata
        except Exception as e:
            logger.warning(f"加载缓存元数据失败 {meta_path}: {e}")

        return None

    async def get_cached_file_info(self, url: str) -> Optional[Tuple[Path, CacheMetadata]]:
        """获取缓存文件信息（如果存在）

        Args:
            url: 原始URL

        Returns:
            Optional[Tuple[Path, CacheMetadata]]: 缓存文件路径和元数据，如果不存在则返回None
        """
        cache_path = self.get_cache_path(url)

        if cache_path.exists():
            metadata = await self.load_metadata(cache_path)
            if metadata:
                return cache_path, metadata

        return None

    def is_cache_file(self, file_path: str) -> bool:
        """检查文件是否是缓存文件

        Args:
            file_path: 文件路径

        Returns:
            bool: 如果是缓存文件返回True
        """
        try:
            path = Path(file_path)
            # 检查文件是否在缓存目录中
            return self.cache_dir in path.parents or path.parent == self.cache_dir
        except Exception:
            return False

    async def try_to_get_metadata_for_file(self, file_path: str) -> Optional[CacheMetadata]:
        """尝试获取文件的元数据（如果是缓存文件）

        Args:
            file_path: 文件路径

        Returns:
            Optional[CacheMetadata]: 元数据对象（如果找到），否则为None
        """
        if self.is_cache_file(file_path):
            return await self.load_metadata(Path(file_path))
        return None


@tool()
class DownloadFromUrl(AbstractFileTool[DownloadFromUrlParams], WorkspaceGuardTool[DownloadFromUrlParams]):
    """<!--zh
    URL文件下载工具

    - 支持自动处理重定向
    - 如果文件不存在，将自动创建文件和必要的目录
    - 如果文件已存在，将直接覆盖
    - 支持各种类型的文件下载，如图片、PDF、压缩包等
    -->
    URL file download tool

    - Supports auto-handling redirects
    - Auto-creates file and necessary directories if file doesn't exist
    - Directly overwrites if file exists
    - Supports downloading various file types like images, PDFs, archives, etc.
    """

    def __init__(self, **data):
        super().__init__(**data)
        # 初始化缓存管理器
        self.cache_manager = DownloadCacheManager()
        # URL锁字典，用于防止同一URL的并发下载
        self._url_locks: Dict[str, asyncio.Lock] = {}

    async def try_to_get_metadata_for_file(self, file_path: str) -> Optional[CacheMetadata]:
        """尝试获取文件的缓存元数据

        这是一个公开接口，供其他工具调用

        Args:
            file_path: 文件路径

        Returns:
            Optional[CacheMetadata]: 如果是缓存文件且有元数据则返回，否则返回 None
        """
        return await self.cache_manager.try_to_get_metadata_for_file(file_path)

    async def execute(self, tool_context: ToolContext, params: DownloadFromUrlParams) -> ToolResult:
        """
        执行文件下载操作

        Args:
            tool_context: 工具上下文
            params: 参数对象，包含URL和文件保存路径

        Returns:
            ToolResult: 包含操作结果
        """
        # Call the pure execution method
        result = await self.execute_purely(params)

        # File events are now handled within execute_purely via _file_versioning_context

        return result

    async def execute_purely(self, params: DownloadFromUrlParams, cache_only: bool = False, tool_context: ToolContext = None) -> ToolResult:
        """
        Pure execution without tool context - allows clean invocation without context

        Args:
            params: 参数对象，包含URL和文件保存路径
            cache_only: 如果为True且file_path为空，则只下载到缓存并返回缓存路径
            tool_context: 可选的工具上下文，用于事件分发

        Returns:
            ToolResult: 包含操作结果
        """
        try:
            # Check if cache-only mode is requested
            if cache_only and not params.file_path.strip():
                # Cache-only mode: download to cache and return cache path
                                # Create a dummy path that won't be used
                dummy_path = Path("dummy")
                download_result = await self._download_file(params.url, dummy_path, cache_only=True)

                if download_result.file_size > 0:
                    cache_path = self.cache_manager.get_cache_path(params.url)
                    output = f"文件下载到缓存: {cache_path} | 大小: {self._format_size(download_result.file_size)} | 类型: {download_result.content_type}"

                    # Determine file extension from content type for caller's reference
                    detected_extension = self._determine_extension_from_content_type(download_result.content_type, params.url)

                    return ToolResult(
                        content=output,
                        extra_info={
                            "file_path": str(cache_path),
                            "file_exists": False,  # This is a cache file, not a user file
                            "file_size": download_result.file_size,
                            "content_type": download_result.content_type,
                            "url": download_result.url,
                            "from_cache": download_result.from_cache,
                            "file_extension": detected_extension,  # Detected extension for caller's use
                            "cache_only": True  # Indicate this is cache-only mode
                        }
                    )
                else:
                    return ToolResult(error="缓存下载失败")

            # Normal mode: use safe path validation
            full_path, error = self.get_safe_path(params.file_path)
            if error:
                return ToolResult(error=error)

            # 从安全路径对象中提取父目录和原始文件名
            parent_dir = full_path.parent
            original_name = full_path.name

            # 分离基本名称和扩展名
            base_name, extension = os.path.splitext(original_name)

            # 对基本名称部分进行安全处理
            safe_base_name = generate_safe_filename(base_name)

            # 如果基本名称处理后为空，尝试从 URL 获取或使用默认名称
            if not safe_base_name:
                try:
                    parsed_url = urlparse(params.url)
                    url_filename = os.path.basename(parsed_url.path)
                    if url_filename: # 确保从URL获取的文件名不为空
                        url_base_name, url_extension = os.path.splitext(url_filename)
                        safe_base_name = generate_safe_filename(url_base_name) if url_base_name else "downloaded_file"
                        # Use the extension from the URL if available and original was missing or different
                        if url_extension and (not extension or extension.lower() != url_extension.lower()):
                            extension = url_extension
                    else:
                        safe_base_name = "downloaded_file"
                except Exception:
                    safe_base_name = "downloaded_file" # Fallback default name

            # 重新组合安全的文件名和原始扩展名
            # 确保扩展名以点开头（如果存在且不是点）
            if extension and not extension.startswith('.'):
                 extension = '.' + extension
            safe_name = safe_base_name + extension

            # 重构最终的文件路径
            file_path = parent_dir / safe_name

            # 创建目录（如果需要）
            await self._create_directories(file_path)

            # 使用 versioning context 下载文件（无需更新时间戳，因为是工具下载的文件）
            if tool_context:
                async with self._file_versioning_context(tool_context, file_path, update_timestamp=False):
                    download_result = await self._download_file(params.url, file_path, cache_only=False)
            else:
                download_result = await self._download_file(params.url, file_path, cache_only=False)

            # Generate formatted output
            output = (
                f"文件下载成功: {file_path} | "
                f"大小: {self._format_size(download_result.file_size)} | "
                f"类型: {download_result.content_type}"
            )

            # Add warning if file was overwritten
            if download_result.file_exists:
                output += "\n⚠️ 注意：原文件已被新下载的文件覆盖"

            # 返回操作结果，包含额外信息供事件分发使用
            return ToolResult(
                content=output,
                extra_info={
                    "file_path": str(file_path),
                    "file_exists": download_result.file_exists,
                    "file_size": download_result.file_size,
                    "content_type": download_result.content_type,
                    "url": download_result.url,
                    "from_cache": download_result.from_cache,
                    "file_extension": file_path.suffix.lower()  # Add determined file extension
                }
            )

        except Exception as e:
            logger.error(f"下载文件失败: {e!s}")
            return ToolResult(error="Failed to download file")

    async def _create_directories(self, file_path: Path) -> None:
        """创建文件所需的目录结构"""
        directory = file_path.parent

        if not directory.exists():
            await asyncio.to_thread(os.makedirs, directory, exist_ok=True)
            logger.info(f"创建目录: {directory}")

    async def _download_file(self, url: str, file_path: Path, cache_only: bool = False) -> DownloadResult:
        """Download file with caching mechanism"""
        # 获取或创建此 URL 的锁，防止并发下载同一个 URL
        if url not in self._url_locks:
            self._url_locks[url] = asyncio.Lock()

        # 使用锁确保同一 URL 只有一个任务在下载
        async with self._url_locks[url]:
            return await self._download_file_with_lock(url, file_path, cache_only)

    async def _download_file_with_lock(self, url: str, file_path: Path, cache_only: bool = False) -> DownloadResult:
        """Download file with caching mechanism (executed within lock)"""
        final_url = url
        content_type = ""
        file_exists = await async_exists(file_path) if not cache_only else False
        from_cache = False

        # Get cache path for this URL
        cache_path = self.cache_manager.get_cache_path(url)

                # Check if file exists in cache with retry for concurrent downloads
        max_retries = 5
        retry_delay = 0.1  # 100ms

        for attempt in range(max_retries):
            if cache_path.exists():
                                                # Cache hit
                logger.info(f"Cache hit for URL: {url}")

                if cache_only:
                    # Cache-only mode: just return cache info
                    file_size = cache_path.stat().st_size
                    target_path = str(cache_path)
                else:
                    # Copy from cache to target path
                    file_size = await self._copy_file(cache_path, file_path)
                    target_path = str(file_path)

                # Load metadata from cache if available
                cached_metadata = await self.cache_manager.load_metadata(cache_path)
                if cached_metadata:
                    content_type = cached_metadata.content_type
                    final_url = cached_metadata.url
                else:
                    content_type = "application/octet-stream"
                    final_url = url

                return DownloadResult(
                    file_size=file_size,
                    content_type=content_type,
                    file_exists=file_exists,
                    file_path=target_path,
                    url=final_url,
                    from_cache=True
                )

            # Check for concurrent download in progress
            temp_cache_path = cache_path.with_suffix('.tmp')
            if temp_cache_path.exists() and attempt < max_retries - 1:
                # Another process is downloading, wait and retry
                logger.debug(f"Concurrent download detected for {url}, waiting...")
                await asyncio.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
                continue

            # No cache found and no concurrent download, proceed to download
            break

        # Cache miss - download and cache with atomic operation
        logger.info(f"Cache miss for URL: {url}, downloading...")

        # Ensure cache directory exists
        await self.cache_manager.ensure_cache_dir()

        # Use temporary file for atomic download to prevent concurrent access issues
        temp_cache_path = cache_path.with_suffix('.tmp')

        try:
            # Create timeout configuration
            timeout = aiohttp.ClientTimeout(total=DOWNLOAD_TIMEOUT_SECONDS)

            # Generate image-specific headers for the request
            # For image downloads, use the image's own domain as referer to avoid CDN blocking
            # If we can't get the same domain referer, don't set Referer at all (anti-hotlinking protection)
            parsed_url = urlparse(url)

            headers = IMAGE_DOWNLOAD_HEADERS.copy()  # Start with image-specific headers

            if parsed_url.netloc and parsed_url.scheme:
                # Use the same domain as referer for image downloads
                referer = f"{parsed_url.scheme}://{parsed_url.netloc}/"
                headers["Referer"] = referer
                logger.debug(f"设置同域名referer: {referer}")
            else:
                # Don't set Referer header if we can't get same-domain referer
                # Many CDNs have anti-hotlinking protection that blocks external referers
                logger.debug(f"URL解析失败，不设置Referer头会有更高成功率: {url}")

            async with aiohttp.ClientSession(timeout=timeout) as session:
                # Set redirect handling and track redirect count
                async with session.get(url, allow_redirects=True, headers=headers) as response:
                    # Check response status
                    if response.status != 200:
                        raise Exception(f"下载失败，HTTP状态码: {response.status}, 原因: {response.reason}")

                    # Get final URL (after redirects)
                    final_url = str(response.url)

                    # Get content type
                    content_type = response.headers.get('Content-Type', 'unknown')

                    # Download to temporary cache file first
                    async with aiofiles.open(temp_cache_path, 'wb') as f:
                        file_size = 0
                        # Read and write in chunks to avoid memory issues
                        async for chunk in response.content.iter_chunked(8192):
                            await f.write(chunk)
                            file_size += len(chunk)

            # Atomically move temp file to final cache location
            # This prevents other concurrent requests from reading incomplete files
            temp_cache_path.rename(cache_path)

            # Save metadata alongside cache file
            await self.cache_manager.save_metadata(cache_path, content_type, final_url, file_size)

            logger.info(f"Downloaded to cache: {cache_path}, size: {file_size} bytes")

            # Copy from cache to target location if needed
            if cache_only:
                # Cache-only mode: return cache path
                target_path = str(cache_path)
            else:
                await self._copy_file(cache_path, file_path)
                target_path = str(file_path)

            return DownloadResult(
                file_size=file_size,
                content_type=content_type,
                file_exists=file_exists,
                file_path=target_path,
                url=final_url,
                from_cache=from_cache
            )

        except Exception as e:
            # Clean up temporary file if it exists
            if temp_cache_path.exists():
                try:
                    temp_cache_path.unlink()
                except Exception as cleanup_error:
                    logger.warning(f"Failed to cleanup temp file {temp_cache_path}: {cleanup_error}")
            raise e

    def _determine_extension_from_content_type(self, content_type: str, url: str) -> str:
        """
        Determine file extension from content type and URL

        Args:
            content_type: HTTP Content-Type header value
            url: The original URL

        Returns:
            str: File extension (with dot), or empty string if cannot determine
        """
        if not content_type:
            content_type = ""

        content_type = content_type.lower()

        # Map content types to extensions
        content_type_map = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/bmp': '.bmp',
            'image/tiff': '.tiff',
            'image/ico': '.ico',
            'application/pdf': '.pdf',
            'text/html': '.html',
            'text/plain': '.txt',
            'application/json': '.json',
            'application/xml': '.xml',
            'text/xml': '.xml',
            'application/zip': '.zip',
            'application/x-zip-compressed': '.zip',
        }

        # First try exact match
        for ct, ext in content_type_map.items():
            if ct in content_type:
                return ext

        # If no content type match, try to extract from URL
        try:
            url_path = url.split('?')[0]  # Remove query parameters
            url_ext = Path(url_path).suffix.lower()
            if url_ext and len(url_ext) <= 5:  # Reasonable extension length
                return url_ext
        except Exception:
            pass

        return ""  # No extension determined

    async def _copy_file(self, source_path: Path, target_path: Path) -> int:
        """
        Copy file from source to target, preserving metadata

        Args:
            source_path: Source file path
            target_path: Target file path

        Returns:
            int: File size in bytes
        """
        # Use async_copy2 to preserve metadata
        await async_copy2(source_path, target_path)

        # Get file size asynchronously using async_stat
        stat_result = await async_stat(target_path)
        file_size = stat_result.st_size

        logger.info(f"File copied from cache: {source_path} -> {target_path}, size: {file_size} bytes")

        return file_size

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """
        根据工具执行结果获取对应的ToolDetail

        Args:
            tool_context: 工具上下文
            result: 工具执行的结果
            arguments: 工具执行的参数字典

        Returns:
            Optional[ToolDetail]: 工具详情对象，可能为None
        """
        if not result.ok:
            return None

        if not arguments or "file_path" not in arguments:
            logger.warning("没有提供file_path参数")
            return None

        file_path = arguments["file_path"]
        file_path_path, _ = self.get_safe_path(file_path)
        if not file_path_path or not file_path_path.exists():
            return None

        file_name = os.path.basename(file_path)

        # 使用 AbstractFileTool 的方法获取显示类型
        display_type = self.get_display_type_by_extension(file_path)

        # 对于图片类型，我们可能需要返回文件路径而不是内容
        # 这里简化处理，只返回文件名
        return ToolDetail(
            type=display_type,
            data=FileContent(
                file_name=file_name,
                content="" # 对于大文件或二进制文件，不返回内容
            )
        )

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments:
            return i18n.translate("read_file.not_found", category="tool.messages")

        url = arguments.get("url", "")
        return url if url else "未知URL"

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """
        获取工具调用后的友好动作和备注
        """
        if not result.ok:
            return {
                "action": i18n.translate("download_from_url", category="tool.actions"),
                "remark": i18n.translate("download_from_url.error", category="tool.messages", error=result.content)
            }

        return {
            "action": i18n.translate("download_from_url", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }

    def _format_size(self, size_bytes: int) -> str:
        """格式化文件大小显示"""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size_bytes < 1024.0 or unit == 'TB':
                return f"{size_bytes:.2f} {unit}" if unit != 'B' else f"{size_bytes} {unit}"
            size_bytes /= 1024.0
