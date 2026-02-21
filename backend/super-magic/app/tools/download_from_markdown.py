from app.i18n import i18n
import os
import re
import asyncio
from pathlib import Path
from typing import Any, Dict, List, NamedTuple, Optional, Tuple

import aiofiles
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.tools.download_from_url import DownloadFromUrl, DownloadFromUrlParams
from app.utils.async_file_utils import async_copy2, async_stat

logger = get_logger(__name__)


class DownloadFromMarkdownParams(BaseToolParams):
    markdown_file: str = Field(
        ...,
        description="""<!--zh: Markdown文件路径，相对于工作区根目录-->
Markdown file path, relative to workspace root"""
    )
    target_folder: str = Field(
        ...,
        description="""<!--zh: 目标下载文件夹路径，相对于工作区根目录-->
Target download folder path, relative to workspace root"""
    )
    file_extensions: str = Field(
        default="*",
        description="""<!--zh: 要下载的文件扩展名，如 'jpg,png,webp' 或 '*' 表示所有文件-->
File extensions to download, e.g., 'jpg,png,webp' or '*' for all files"""
    )


# Constants
OVERRIDE_EXISTING = True  # 是否覆盖已存在的文件


class ResourceInfo(NamedTuple):
    """资源信息"""
    url: str
    filename: Optional[str]  # 从markdown提取的文件名，可能为空
    line_number: int  # 在markdown中的行号，用于错误定位


class DownloadResult(NamedTuple):
    """下载结果统计"""
    total_images: int
    successful_downloads: int  # 所有成功获取的资源（包括下载和复制）
    failed_downloads: int
    skipped_downloads: int
    failed_images: List[Tuple[str, str]]  # (filename, error_message)


# Helper functions for local file handling
def _is_local_path(path: str) -> bool:
    """
    Check if a path is a local file path (not a network URL).

    Args:
        path: The path to check

    Returns:
        bool: True if it's a local path, False for network URLs
    """
    # Network protocol URLs are not local
    if path.startswith(('http://', 'https://', 'ftp://', 'ftps://')):
        return False

    # Local path characteristics
    if any([
        path.startswith('./'),          # Relative path
        path.startswith('../'),         # Parent directory
        path.startswith('/'),           # Absolute path (Unix)
        path.startswith('\\'),          # Absolute path (Windows)
        ':' in path and len(path) > 1 and path[1] == ':',  # Windows drive
        not '://' in path and ('.' in path or '/' in path or '\\' in path)  # Contains path separators
    ]):
        return True

    return False


async def _copy_local_file_async(source_path: Path, target_path: Path) -> int:
    """
    Copy a local file asynchronously to avoid blocking.

    Args:
        source_path: Source file path
        target_path: Target file path

    Returns:
        int: File size in bytes

    Raises:
        Exception: If copy operation fails
    """
    # Use async_copy2 for asynchronous file copying
    await async_copy2(source_path, target_path)

    # Get file size asynchronously using async_stat
    stat_result = await async_stat(target_path)
    file_size = stat_result.st_size

    logger.info(f"File copied successfully: {source_path} -> {target_path}, size: {file_size} bytes")
    return file_size


@tool()
class DownloadFromMarkdown(AbstractFileTool[DownloadFromMarkdownParams], WorkspaceTool[DownloadFromMarkdownParams]):
    """<!--zh
    从Markdown文件批量下载图片资源，请在下载多张图片时作为首选

    遵循Unix"一切皆文件"哲学，将图片信息整理在Markdown文件中，一次性批量下载，便于后续维护

    推荐使用标准图片语法：![filename.jpg](url)
    - 自动使用alt text作为文件名
    - 支持网络URL下载和本地文件复制

    示例：
    ![cover.png](https://example.com/image.png)
    ![logo.jpg](./assets/logo.jpg)
    -->
    Batch download image resources from Markdown file, prefer this when downloading multiple images

    Follow Unix "everything is a file" philosophy, organize image information in Markdown file for one-time batch download, convenient for subsequent maintenance

    Recommend using standard image syntax: ![filename.jpg](url)
    - Auto-use alt text as filename
    - Supports network URL download and local file copy

    Examples:
    ![cover.png](https://example.com/image.png)
    ![logo.jpg](./assets/logo.jpg)
    """

    def __init__(self, **data):
        super().__init__(**data)
        # Initialize download tool
        self._download_tool = DownloadFromUrl()

    async def execute(self, tool_context: ToolContext, params: DownloadFromMarkdownParams) -> ToolResult:
        """
        执行Markdown图片下载操作

        Args:
            tool_context: 工具上下文
            params: 参数对象

        Returns:
            ToolResult: 包含下载结果
        """
        result = await self.execute_purely(params, tool_context)
        return result

    async def execute_purely(self, params: DownloadFromMarkdownParams, tool_context: Optional[ToolContext] = None) -> ToolResult:
        """
        纯执行方法，可供其他工具内部调用

        Args:
            params: 参数对象
            tool_context: 可选的工具上下文，用于事件触发

        Returns:
            ToolResult: 包含下载结果
        """
        try:
            # Validate markdown file path
            markdown_path = self.resolve_path(params.markdown_file)
            if not markdown_path.exists():
                return ToolResult(error=f"Markdown文件不存在: {markdown_path}")

            # Validate target folder path
            target_folder = self.resolve_path(params.target_folder)
            # Read markdown content
            try:
                async with aiofiles.open(markdown_path, 'r', encoding='utf-8') as f:
                    markdown_content = await f.read()
            except Exception as e:
                return ToolResult(error="Failed to read markdown file")

            # Parse resource information
            resources = self._parse_markdown_resources(markdown_content, params.file_extensions)

            if not resources:
                return ToolResult(content="Markdown文件中未找到符合条件的资源")

            logger.info(f"从 {markdown_path} 解析到 {len(resources)} 个资源")

            # Create target folder if needed
            if not target_folder.exists():
                await asyncio.to_thread(os.makedirs, target_folder, exist_ok=True)
                logger.info(f"创建目标文件夹: {target_folder}")

            # Download resources
            download_result = await self._download_resources(resources, target_folder, markdown_path, tool_context)

            # Generate result report
            report = self._generate_download_report(download_result, target_folder)

            # Return with appropriate status
            if download_result.failed_downloads > 0:
                # Some downloads failed
                return ToolResult(
                    content=report,
                    extra_info={
                        "total": download_result.total_images,
                        "success": download_result.successful_downloads,
                        "failed": download_result.failed_downloads,
                        "skipped": download_result.skipped_downloads
                    }
                )
            else:
                # All successful
                return ToolResult(
                    content=report,
                    extra_info={
                        "total": download_result.total_images,
                        "success": download_result.successful_downloads,
                        "failed": 0,
                        "skipped": download_result.skipped_downloads
                    }
                )

        except Exception as e:
            logger.exception(f"执行Markdown图片下载失败: {e}")
            return ToolResult(error="Download execution failed")

    def _parse_markdown_resources(self, content: str, file_extensions: str) -> List[ResourceInfo]:
        """
        解析Markdown内容，提取资源URL

        Args:
            content: Markdown文件内容
            file_extensions: 要下载的文件扩展名

        Returns:
            List[ResourceInfo]: 资源信息列表
        """
        resources = []
        lines = content.split('\n')

        # Parse extensions filter
        if file_extensions == '*' or not file_extensions.strip():
            extensions_filter = None
        else:
            # Convert to lowercase and split
            extensions_filter = set(ext.strip().lower() for ext in file_extensions.split(','))

        # Markdown patterns
        # 1. Image: ![alt text](url "title")
        image_pattern = re.compile(r'!\[([^\]]*)\]\(([^\s\)]+)(?:\s+"[^"]*")?\)')

        # 2. Link: [text](url "title")
        link_pattern = re.compile(r'(?<!!)\[([^\]]+)\]\(([^\s\)]+)(?:\s+"[^"]*")?\)')

        # 3. Reference style image: ![alt text][ref]
        ref_image_pattern = re.compile(r'!\[([^\]]*)\]\[([^\]]+)\]')

        # 4. Reference style link: [text][ref]
        ref_link_pattern = re.compile(r'(?<!!)\[([^\]]+)\]\[([^\]]+)\]')

        # 5. Reference definition: [ref]: url "title"
        ref_def_pattern = re.compile(r'^\[([^\]]+)\]:\s*([^\s]+)(?:\s+"[^"]*")?', re.MULTILINE)

        # 6. Bare URL: <url>
        bare_url_pattern = re.compile(r'<(https?://[^>]+)>')

        # 7. Auto-linked URL: http://example.com
        auto_url_pattern = re.compile(r'(?:^|\s)(https?://[^\s<>"{}|\\^`\[\]]+)(?=\s|$)')

        # Build reference map
        ref_map = {}
        for match in ref_def_pattern.finditer(content):
            ref_id = match.group(1)
            url = match.group(2)
            ref_map[ref_id] = url

        # Process line by line
        for i, line in enumerate(lines):
            # Skip reference definitions
            if ref_def_pattern.match(line):
                continue

            # Extract URLs and filenames from different patterns
            urls_found = []

            # 1. Process images ![alt](url)
            for match in image_pattern.finditer(line):
                alt_text = match.group(1)
                url = match.group(2)
                # Use alt text as filename if it exists and is not empty
                filename = alt_text.strip() if alt_text and alt_text.strip() else None
                urls_found.append((url, filename))

            # 2. Process links [text](url)
            for match in link_pattern.finditer(line):
                link_text = match.group(1)
                url = match.group(2)
                # Use link text as filename if it exists and is not empty
                filename = link_text.strip() if link_text and link_text.strip() else None
                urls_found.append((url, filename))

            # 3. Process reference images ![alt][ref]
            for match in ref_image_pattern.finditer(line):
                alt_text = match.group(1)
                ref_id = match.group(2)
                if ref_id in ref_map:
                    url = ref_map[ref_id]
                    filename = alt_text.strip() if alt_text and alt_text.strip() else None
                    urls_found.append((url, filename))

            # 4. Process reference links [text][ref]
            for match in ref_link_pattern.finditer(line):
                link_text = match.group(1)
                ref_id = match.group(2)
                if ref_id in ref_map:
                    url = ref_map[ref_id]
                    filename = link_text.strip() if link_text and link_text.strip() else None
                    urls_found.append((url, filename))

            # 5. Process bare URLs <url>
            for match in bare_url_pattern.finditer(line):
                url = match.group(1)
                urls_found.append((url, None))

            # 6. Process auto-linked URLs
            for match in auto_url_pattern.finditer(line):
                url = match.group(1)
                urls_found.append((url, None))

            # Filter by extension and add to resources
            for url, filename in urls_found:
                # Extract file extension from URL
                url_parts = url.split('?')[0].split('#')[0]  # Remove query and fragment
                url_path = url_parts.rstrip('/')
                extension = ''

                if '.' in url_path:
                    extension = url_path.split('.')[-1].lower()

                # Check if extension matches filter
                if extensions_filter is None or extension in extensions_filter:
                    resources.append(ResourceInfo(
                        url=url,
                        filename=filename,
                        line_number=i + 1
                    ))

        logger.debug(f"解析到 {len(resources)} 个资源URL")
        return resources

    async def _download_resources(
        self,
        resources: List[ResourceInfo],
        target_folder: Path,
        markdown_path: Path,
        tool_context: Optional[ToolContext] = None
    ) -> DownloadResult:
        """
        并发下载所有资源

        Args:
            resources: 资源信息列表
            target_folder: 目标文件夹

        Returns:
            DownloadResult: 下载结果统计
        """
        # Create download tasks
        tasks = []
        for res in resources:
            task = self._download_single_resource(res, target_folder, markdown_path, tool_context)
            tasks.append(task)

        # Execute downloads concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Collect statistics
        successful = 0
        failed = 0
        skipped = 0
        failed_images = []

        for res, result in zip(resources, results):
            if isinstance(result, Exception):
                # Exception occurred
                failed += 1
                filename = res.filename or self._extract_filename_from_url(res.url)
                failed_images.append((filename, str(result)))
                logger.error(f"下载失败 {filename}: {result}")
            elif result is None:
                # Skipped (file exists)
                skipped += 1
            elif result:
                # Success
                successful += 1
            else:
                # Failed
                failed += 1
                filename = res.filename or self._extract_filename_from_url(res.url)
                failed_images.append((filename, "Unknown error"))

        return DownloadResult(
            total_images=len(resources),
            successful_downloads=successful,
            failed_downloads=failed,
            skipped_downloads=skipped,
            failed_images=failed_images
        )

    def _extract_filename_from_url(self, url: str) -> str:
        """
        从URL中提取文件名

        Args:
            url: 资源URL

        Returns:
            str: 文件名
        """
        # Remove query and fragment
        url_parts = url.split('?')[0].split('#')[0]
        # Get the last part of the path
        path_parts = url_parts.rstrip('/').split('/')
        filename = path_parts[-1] if path_parts else 'download'

        # Ensure it has an extension
        if '.' not in filename:
            filename = f"{filename}.bin"

        return filename

    def _determine_final_filename(self, resource: ResourceInfo) -> str:
        """
        确定最终的文件名

        Args:
            resource: 资源信息

        Returns:
            str: 最终的文件名
        """
        if resource.filename:
            # If we have a filename from alt_text, use it
            base_filename = resource.filename

            # Check if it already has an extension
            if '.' in base_filename:
                return base_filename
            else:
                # Extract extension from URL and append to alt_text
                url_parts = resource.url.split('?')[0].split('#')[0]  # Remove query and fragment
                url_path = url_parts.rstrip('/')

                if '.' in url_path:
                    extension = url_path.split('.')[-1].lower()
                    return f"{base_filename}.{extension}"
                else:
                    # No extension found in URL, use a default
                    return f"{base_filename}.bin"
        else:
            # No filename from alt_text, extract from URL
            return self._extract_filename_from_url(resource.url)

    async def _resolve_local_path(self, local_path: str, markdown_path: Path) -> tuple[Optional[Path], Optional[str]]:
        """
        Resolve local path safely within workspace boundaries.

        Args:
            local_path: The local file path from markdown
            markdown_path: Path to the markdown file (for relative path resolution)

        Returns:
            tuple: (resolved_path, error_message) where one of them will be None
        """
        try:
            # Handle relative paths: resolve relative to markdown file's directory
            if local_path.startswith('./') or local_path.startswith('../'):
                base_dir = markdown_path.parent
                resolved_path = (base_dir / local_path).resolve()

                # Convert to relative path from workspace root
                try:
                    workspace_root = self.base_dir.resolve()
                    relative_to_workspace = resolved_path.relative_to(workspace_root)
                    safe_path = self.resolve_path(str(relative_to_workspace))
                except ValueError:
                    # Path is outside workspace
                    return None, f"路径超出工作区范围: {local_path}"
            else:
                # Absolute path or workspace-relative path
                safe_path = self.resolve_path(local_path)

            if not safe_path.exists():
                return None, f"本地文件不存在: {local_path}"

            if safe_path.is_dir():
                return None, f"路径指向目录而非文件: {local_path}"

            return safe_path, None

        except Exception as e:
            return None, f"路径解析失败: {e}"

    async def _download_single_resource(
        self,
        resource: ResourceInfo,
        target_folder: Path,
        markdown_path: Path,
        tool_context: Optional[ToolContext] = None
    ) -> Optional[bool]:
        """
        下载单个资源（支持网络URL和本地文件）

        Args:
            resource: 资源信息
            target_folder: 目标文件夹
            markdown_path: Markdown文件路径

        Returns:
            True if successful, None if skipped, False if failed
        """
        # Determine filename
        filename = self._determine_final_filename(resource)
        target_path = target_folder / filename

        # Check if file exists and skip if needed
        if target_path.exists() and not OVERRIDE_EXISTING:
            logger.debug(f"跳过已存在文件: {filename}")
            return None

        # 使用 versioning context 处理资源（无需更新时间戳，因为是工具下载的文件）
        async with self._file_versioning_context(tool_context, target_path, update_timestamp=False):
            # Handle local files and network resources differently
            if _is_local_path(resource.url):
                # Local file handling
                result = await self._handle_local_file(resource, target_path, markdown_path)
            else:
                # Network resource handling
                result = await self._handle_network_resource(resource, target_path)

        return result

    async def _handle_local_file(self, resource: ResourceInfo, target_path: Path, markdown_path: Path) -> bool:
        """
        Handle local file copying.

        Args:
            resource: Resource information
            target_path: Target file path
            markdown_path: Markdown file path for relative path resolution

        Returns:
            bool: True if successful

        Raises:
            Exception: If copy operation fails
        """
        filename = target_path.name

        # Resolve local path safely
        source_path, error = await self._resolve_local_path(resource.url, markdown_path)

        if error:
            logger.error(f"本地文件路径解析失败 {filename}: {error}")
            raise Exception(error)

        try:
            # Copy file asynchronously
            await _copy_local_file_async(source_path, target_path)
            logger.info(f"本地文件复制成功: {filename}")
            return True

        except Exception as e:
            logger.error(f"本地文件复制失败 {filename}: {e}")
            raise e

    async def _handle_network_resource(self, resource: ResourceInfo, target_path: Path) -> bool:
        """
        Handle network resource downloading.

        Args:
            resource: Resource information
            target_path: Target file path

        Returns:
            bool: True if successful

        Raises:
            Exception: If download fails
        """
        filename = target_path.name

        # Prepare download parameters
        download_params = DownloadFromUrlParams(
            url=resource.url,
            file_path=str(target_path),
            override=OVERRIDE_EXISTING
        )

        try:
            # Use download tool
            result = await self._download_tool.execute_purely(download_params)

            if result.ok:
                logger.info(f"成功下载: {filename}")
                return True
            else:
                logger.error(f"下载失败 {filename}: {result.content}")
                raise Exception(result.content)

        except Exception as e:
            logger.error(f"下载异常 {filename}: {e}")
            raise e

    def _generate_download_report(self, result: DownloadResult, target_folder: Path) -> str:
        """
        生成下载报告

        Args:
            result: 下载结果
            target_folder: 目标文件夹

        Returns:
            str: 格式化的报告
        """
        report_lines = [
            f"📥 资源下载完成",
            f"",
            f"目标文件夹: {target_folder}",
            f"总计资源数: {result.total_images}",
            f"✅ 成功下载: {result.successful_downloads}",
        ]

        if result.skipped_downloads > 0:
            report_lines.append(f"⏭️ 跳过已存在: {result.skipped_downloads}")

        if result.failed_downloads > 0:
            report_lines.append(f"❌ 下载失败: {result.failed_downloads}")
            report_lines.append("")
            report_lines.append("失败详情:")
            for filename, error in result.failed_images:
                report_lines.append(f"  - {filename}: {error}")

        return "\n".join(report_lines)

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments:
            return i18n.translate("download_from_url.unknown_file", category="tool.messages")

        markdown_file = arguments.get("markdown_file", "")
        target_folder = arguments.get("target_folder", "")
        file_extensions = arguments.get("file_extensions", "*")

        if result.ok and result.extra_info:
            success = result.extra_info.get("success", 0)
            total = result.extra_info.get("total", 0)
            ext_desc = f"({file_extensions})" if file_extensions != "*" else ""
            return f"从 {markdown_file} 下载了 {success}/{total} 个资源{ext_desc}到 {target_folder}"
        else:
            return f"从 {markdown_file} 下载资源失败"

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None
    ) -> Dict:
        """获取工具调用后的友好动作和备注"""
        if not result.ok:
            return {
                "action": i18n.translate("download_from_markdown", category="tool.actions"),
                "remark": i18n.translate("download_from_urls.batch_error", category="tool.messages", error=result.content)
            }

        return {
            "action": i18n.translate("download_from_markdown", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
