"""PDF file parser driver using Magic Service OCR implementation."""

import asyncio
import shutil
from pathlib import Path
from typing import Union, Optional
from dataclasses import dataclass

from agentlang.logger import get_logger
from .interfaces.pdf_driver_interface import PdfDriverInterface
from .interfaces.file_parser_driver_interface import ParseResult, ParseMetadata, ConversionStrategy
from .abstract_driver import AbstractDriver
from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
from app.infrastructure.sdk.magic_service.parameter.tool_execute_parameter import ToolExecuteParameter
# from app.service.file_service import FileService  # 延迟导入以避免循环导入
from agentlang.paths import PathManager

logger = get_logger(__name__)


@dataclass
class CopiedFileInfo:
    """Information about a file copied to .visual directory"""
    original_path: str
    copied_path: str
    relative_path: str  # Path relative to workspace/.visual/


async def _parse_pdf_with_magic_service(pdf_url: str, result: ParseResult, original_filename: str, extract_images: bool = True) -> None:
    """
    Parse PDF using Magic Service and update the provided ParseResult object.
    Also analyzes any images found in the OCR result.

    Args:
        pdf_url: URL of the PDF file
        result: ParseResult object to update with parsed content and metadata
        original_filename: Original filename to use as title (from file_path)
        extract_images: Whether to extract images from OCR result
    """
    # Get Magic Service singleton instance
    magic_service = get_magic_service_sdk()

    # Prepare tool execution parameters
    parameter = ToolExecuteParameter(
        code="atomic_node_document_parse",
        arguments={
            "files": [
                {
                    "file_url": pdf_url
                }
            ]
        }
    )

    # Execute tool via Magic Service
    logger.info(f"Calling Magic Service to parse PDF: {pdf_url}")
    magic_result = await magic_service.agent.execute_tool_async(parameter)

    # Parse the response
    tool_result = magic_result.get_result()

    # Extract content from files array
    if tool_result and 'files' in tool_result and tool_result['files']:
        file_info = tool_result['files'][0]
        content = file_info.get('content', '')

        # Process images in the OCR content if requested
        if extract_images:
            enhanced_content = await _process_images_in_ocr_content(content, result)
        else:
            # Remove image markers from content if not extracting images
            import re
            enhanced_content = re.sub(r'!\[.*?\]\(.*?\)', '', content)
            enhanced_content = re.sub(r'\n{3,}', '\n\n', enhanced_content).strip()

        # Add filename as main title and adjust content heading levels
        from ..utils.markdown_util import MarkdownUtil

        # Use the original filename from file_path instead of Magic Service response
        # This avoids URL encoding issues and uses the actual file name
        final_markdown_content = MarkdownUtil.add_filename_title(enhanced_content, original_filename)
        await MarkdownUtil.write_to_file(final_markdown_content, result.output_file_path)
        result.metadata.conversion_method = 'magic_service_ocr_with_images'
        result.conversion_strategy = ConversionStrategy.BALANCED.value
        result.metadata.additional_info = {
            "parsing_method": "magic_service_ocr_with_image_download",
            "source": "magic_service",
            "file_url": pdf_url,
            "service_file_name": file_info.get('name', ''),
            "service_file_extension": file_info.get('extension', ''),
            "character_count": len(enhanced_content),
            "word_count": len(enhanced_content.split()),
            "processing_type": "remote_ocr_with_image_download",
            "original_content_length": len(content)
        }
    else:
        raise ValueError("Invalid response format from Magic Service")


async def _process_images_in_ocr_content(content: str, result: ParseResult) -> str:
    """
    Process images found in Magic Service OCR content.

    Extracts image URLs from markdown content, downloads them, saves to local files,
    and converts to standard markdown image format.

    Args:
        content: Original OCR content with image links
        result: ParseResult object to set output images directory

    Returns:
        str: Enhanced content with local image paths in markdown format
    """
    import re

    # Extract image URLs from markdown format: ![alt_text](image_url)
    image_pattern = r'!\[([^\]]*)\]\(([^)]+)\)'
    image_matches = re.findall(image_pattern, content)

    if not image_matches:
        logger.debug("No images found in OCR content")
        return content

    logger.info(f"Found {len(image_matches)} images in OCR content for download and processing")

    # Extract unique image URLs (avoid duplicates)
    image_urls = []
    seen_urls = set()
    url_to_alt_text = {}  # Map URL to alt text for later reference

    for alt_text, url in image_matches:
        if url not in seen_urls:
            image_urls.append(url)
            seen_urls.add(url)
            url_to_alt_text[url] = alt_text or f"图片 {len(image_urls)}"

    if not image_urls:
        logger.debug("No unique image URLs found")
        return content

    try:
        # Download images and save to local files
        downloaded_images_mapping = await _download_and_save_images(
            image_urls, result.output_file_path, url_to_alt_text
        )

        if downloaded_images_mapping:
            # Set images directory path in result
            from ..utils.document_image_util import DocumentImageUtil
            images_dir = DocumentImageUtil.get_images_directory_path(result.output_file_path)
            result.output_images_dir = str(images_dir)

            # Convert to standard markdown image format
            enhanced_content = _convert_ocr_images_to_markdown_format(
                content, image_matches, downloaded_images_mapping, result.output_file_path
            )
            logger.info(f"Successfully processed and saved {len(downloaded_images_mapping)} images")
            return enhanced_content
        else:
            logger.warning("No images were successfully downloaded and saved")
            return content

    except Exception as e:
        logger.error(f"Image processing failed: {e}")
        return content


async def _download_and_save_images(image_urls: list, output_file_path: str, url_to_alt_text: dict) -> dict:
    """
    Download images from URLs and save them to local files.

    Args:
        image_urls: List of image URLs to download
        output_file_path: Path where the markdown file will be saved
        url_to_alt_text: Mapping from URL to alt text

    Returns:
        dict: Mapping from original URL to saved local file path
    """
    import asyncio
    import aiohttp
    import aiofiles
    from pathlib import Path
    from ..utils.document_image_util import DocumentImageUtil

    # Create images directory asynchronously
    images_dir = DocumentImageUtil.get_images_directory_path(output_file_path)
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: images_dir.mkdir(parents=True, exist_ok=True))

    downloaded_mapping = {}

    async def download_single_image(session: aiohttp.ClientSession, url: str, index: int) -> tuple:
        """Download a single image and return (url, saved_path) or (url, None) if failed"""
        try:
            logger.debug(f"Downloading image {index + 1}: {url}")

            async with session.get(url) as response:
                if response.status == 200:
                    # Get file extension from URL or default to .png
                    url_path = Path(url)
                    file_extension = url_path.suffix.lower()
                    if not file_extension or file_extension not in ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']:
                        file_extension = '.png'

                    # Generate filename
                    alt_text = url_to_alt_text.get(url, f"图片 {index + 1}")
                    safe_filename = f"image_{index + 1:02d}{file_extension}"

                    local_file_path = images_dir / safe_filename

                    # Save image data
                    image_data = await response.read()
                    async with aiofiles.open(local_file_path, 'wb') as f:
                        await f.write(image_data)

                    logger.info(f"Successfully downloaded image {index + 1}: {url} -> {safe_filename}")
                    return (url, str(local_file_path))
                else:
                    logger.warning(f"Failed to download image {index + 1} (HTTP {response.status}): {url}")
                    return (url, None)

        except Exception as e:
            logger.error(f"Error downloading image {index + 1}: {url}, error: {e}")
            return (url, None)

    # Download all images concurrently
    async with aiohttp.ClientSession() as session:
        download_tasks = [
            download_single_image(session, url, index)
            for index, url in enumerate(image_urls)
        ]

        results = await asyncio.gather(*download_tasks, return_exceptions=True)

        # Process results
        for result in results:
            if isinstance(result, tuple) and result[1] is not None:
                url, saved_path = result
                downloaded_mapping[url] = saved_path

    logger.info(f"Successfully downloaded {len(downloaded_mapping)}/{len(image_urls)} images")
    return downloaded_mapping


def _convert_ocr_images_to_markdown_format(
    content: str,
    image_matches: list,
    downloaded_mapping: dict,
    output_file_path: str
) -> str:
    """
    Convert OCR image URLs to standard markdown image format with local paths.

    Args:
        content: Original content with image URLs
        image_matches: List of (alt_text, url) tuples from regex matching
        downloaded_mapping: Mapping from URL to local file path
        output_file_path: Path to the output markdown file

    Returns:
        str: Content with image URLs replaced by local paths
    """
    import re
    from pathlib import Path

    # Get output directory for relative path calculation
    output_dir = Path(output_file_path).parent

    updated_content = content

    for alt_text, url in image_matches:
        if url in downloaded_mapping:
            local_file_path = Path(downloaded_mapping[url])

            # Generate relative path
            try:
                relative_path = local_file_path.relative_to(output_dir)

                # Create new markdown image reference
                new_alt_text = alt_text if alt_text else "图片"
                new_image_ref = f"![{new_alt_text}]({relative_path})"

                # Simple replacement of URL with local path
                original_ref = f"![{alt_text}]({url})"
                updated_content = updated_content.replace(original_ref, new_image_ref)

                logger.debug(f"Updated image reference: {original_ref} -> {new_image_ref}")

            except ValueError:
                # If relative path calculation fails, use absolute path
                new_alt_text = alt_text if alt_text else "图片"
                new_image_ref = f"![{new_alt_text}]({local_file_path})"
                original_ref = f"![{alt_text}]({url})"

                # Simple replacement of URL with local path
                updated_content = updated_content.replace(original_ref, new_image_ref)
                logger.debug(f"Updated image reference (absolute): {original_ref} -> {new_image_ref}")

    return updated_content


def _get_workspace_path() -> Path:
    """Get the workspace directory path using PathManager"""
    workspace_dir = PathManager.get_workspace_dir()
    return workspace_dir


def _is_file_in_workspace(file_path: str) -> bool:
    """Check if file is within the workspace directory"""
    workspace_path = _get_workspace_path()
    file_abs_path = Path(file_path).resolve()
    workspace_abs_path = workspace_path.resolve()

    # Check if file is within workspace directory
    try:
        file_abs_path.relative_to(workspace_abs_path)
        logger.debug(f"PDF file is in workspace: {file_path}")
        return True
    except ValueError:
        logger.debug(f"PDF file is not in workspace: {file_path}")
        return False


class PdfOcrDriver(AbstractDriver, PdfDriverInterface):
    """PDF file parser driver using Magic Service for OCR processing with image download.

    This driver uses the Magic Service to parse PDF files with advanced OCR capabilities.
    It can handle complex layouts, images, scanned documents, and special formatting.
    Images found in OCR results are automatically downloaded and saved locally.

    Features:
    - Advanced OCR processing via Magic Service
    - Automatic image URL detection and download
    - Local image file saving with proper directory structure
    - Standard markdown format output with local image references

    Best for: Scanned PDFs, complex layouts, image-heavy documents, high accuracy requirements
    Priority: 2 (higher than local driver, used as primary option)
    """

    # Define supported extensions as class attribute
    supported_extensions = ['.pdf']

    # Higher priority than local driver (used as primary option)
    priority = 2

    def __init__(self):
        """Initialize PDF parser driver."""
        super().__init__()
        self._file_service = None  # 延迟初始化以避免循环导入
        # Track copied files for cleanup
        self._copied_files: list[CopiedFileInfo] = []

    def _get_file_service(self):
        """获取FileService实例，使用延迟导入避免循环依赖"""
        if self._file_service is None:
            from app.service.file_service import FileService
            self._file_service = FileService()
        return self._file_service

    async def _copy_file_to_visual_dir(self, file_path: str) -> Optional[CopiedFileInfo]:
        """Copy PDF file to workspace/.visual directory

        Args:
            file_path: Local PDF file path to copy

        Returns:
            Optional[CopiedFileInfo]: Information about the copied file, or None if failed
        """
        try:
            workspace_path = _get_workspace_path()

            # Create .visual directory if not exists (under workspace) asynchronously
            visual_dir = workspace_path / ".visual"
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, lambda: visual_dir.mkdir(exist_ok=True))
            logger.debug(f"Ensure workspace/.visual directory exists: {visual_dir}")

            # Generate filename preserving original name
            original_file = Path(file_path)
            file_stem = original_file.stem
            file_suffix = original_file.suffix

            # Use original filename with extension
            unique_filename = f"{file_stem}{file_suffix}"
            copied_path = visual_dir / unique_filename

            # Relative path is relative to workspace (not project root)
            relative_path = f".visual/{unique_filename}"

            # Copy the file asynchronously
            await loop.run_in_executor(None, shutil.copy2, file_path, copied_path)

            copied_file_info = CopiedFileInfo(
                original_path=str(Path(file_path).resolve()),
                copied_path=str(copied_path),
                relative_path=relative_path  # Relative to workspace
            )

            # Add to tracking list
            self._copied_files.append(copied_file_info)

            logger.info(f"PDF file copied to workspace/.visual directory: {file_path} -> {relative_path}")
            return copied_file_info

        except Exception as e:
            logger.error(f"Failed to copy PDF file to workspace/.visual directory: {e}")
            return None

    async def _cleanup_copied_files(self):
        """Clean up files that were copied to .visual directory"""
        if not self._copied_files:
            return

        loop = asyncio.get_event_loop()
        for copied_file_info in self._copied_files:
            try:
                copied_path = Path(copied_file_info.copied_path)
                # Check existence asynchronously
                file_exists = await loop.run_in_executor(None, copied_path.exists)
                if file_exists:
                    # Delete file asynchronously
                    await loop.run_in_executor(None, copied_path.unlink)
                    logger.debug(f"Cleaned up copied PDF file: {copied_file_info.relative_path}")
            except Exception as e:
                logger.warning(f"Failed to clean up copied PDF file: {e}")

        self._copied_files.clear()

    async def _generate_file_download_url(self, relative_path: str) -> str:
        """Generate download URL using file service

        Args:
            relative_path: Path relative to workspace (e.g., 'documents/file.pdf')

        Returns:
            str: Download URL

        Raises:
            ValueError: If URL generation fails
        """
        result = await self._get_file_service().get_file_download_url(
            file_path=relative_path,
            expires_in=3600  # 1 hour
        )

        download_url = result.get("download_url")
        if not download_url:
            raise ValueError("Failed to generate download URL for PDF file")

        logger.info(f"Generated PDF download URL: {relative_path}")
        return download_url

    async def parse(self, file_path: Union[str, Path], result: ParseResult, **kwargs) -> None:
        """
        Parse the PDF file and update the provided ParseResult object.

        Args:
            file_path: Path to the PDF file (local only)
            result: ParseResult object to update with parsed content and metadata
            **kwargs: Additional parsing options:
                - extract_images (bool): Whether to extract images from PDF, default True
        """
        file_path_obj = Path(file_path)
        logger.info(f"Parsing PDF file: {file_path_obj}")

        try:
            # Check if file is in workspace
            is_in_workspace = _is_file_in_workspace(str(file_path_obj))
            copied_file_info = None
            relative_path = None

            if is_in_workspace:
                # File is in workspace, calculate relative path
                workspace_path = _get_workspace_path()
                file_abs_path = file_path_obj.resolve()
                workspace_abs_path = workspace_path.resolve()
                relative_path = str(file_abs_path.relative_to(workspace_abs_path))
                logger.info(f"PDF file is in workspace, relative path: {relative_path}")
            else:
                # File is not in workspace, copy to .visual directory
                copied_file_info = await self._copy_file_to_visual_dir(str(file_path_obj))
                if not copied_file_info:
                    raise ValueError("Failed to copy PDF file to workspace/.visual directory")

                relative_path = copied_file_info.relative_path
                logger.info(f"PDF file copied to .visual directory, relative path: {relative_path}")

            # Generate download URL
            download_url = await self._generate_file_download_url(relative_path)

            # Parse using Magic Service
            extract_images = kwargs.get('extract_images', True)
            # Use original filename from file_path (not from Magic Service response)
            original_filename = file_path_obj.name
            await _parse_pdf_with_magic_service(download_url, result, original_filename, extract_images)

            # Update metadata with local file information
            if not result.metadata.additional_info:
                result.metadata.additional_info = {}

            additional_info = {
                "original_file_path": str(file_path_obj),
                "relative_path": relative_path,
                "source": "local_workspace_file" if is_in_workspace else "copied_to_visual"
            }

            if copied_file_info:
                additional_info.update({
                    "copied_to_visual": True,
                    "copied_path": copied_file_info.copied_path
                })

            # Add image extraction status
            additional_info['images_extracted'] = extract_images

            result.metadata.additional_info.update(additional_info)

        finally:
            # Clean up copied files
            await self._cleanup_copied_files()
