"""PDF file parser driver using MarkItDown with PyMuPDF plugin implementation."""

import asyncio
import glob
import tempfile
from pathlib import Path
from typing import Union

from agentlang.logger import get_logger
from .interfaces.pdf_driver_interface import PdfDriverInterface
from .interfaces.file_parser_driver_interface import ParseResult, ParseMetadata, ConversionStrategy
from .abstract_driver import AbstractDriver

logger = get_logger(__name__)


class PdfLocalDriver(AbstractDriver, PdfDriverInterface):
    """PDF file parser driver using MarkItDown with PyMuPDF plugin for local processing.

    This driver uses MarkItDown library with PyMuPDF plugin to parse PDF files locally.
    It provides faster processing and works offline.

    Features:
    - Text extraction from PDFs using PyMuPDF plugin
    - Image extraction and saving from PDF pages
    - Local processing without external API dependencies

    Best for: Text-based PDFs with images, offline processing
    Priority: 1 (lower than OCR driver for fallback usage)
    """

    # Define supported extensions as class attribute
    supported_extensions = ['.pdf']

    # Lower priority than OCR driver (used as fallback)
    priority = 1

    def __init__(self):
        """Initialize PDF local driver with PyMuPDF plugin for image extraction."""
        super().__init__()

        # Register PyMuPDF plugin for PDF processing with image extraction support
        try:
            from app.tools.markitdown_plugins.pymupdf_plugin import PyMuPDFConverter
            self._md.register_converter(PyMuPDFConverter())
            logger.debug("Successfully registered PyMuPDF plugin for PDF processing with image support")
        except ImportError as e:
            logger.warning(f"Failed to register PyMuPDF plugin: {e}")
            logger.debug("Falling back to native MarkItDown PDF processing")


    async def parse(self, file_path: Union[str, Path], result: ParseResult, **kwargs) -> None:
        """Parse PDF file using MarkItDown and update the provided ParseResult object.

        Args:
            file_path: Path to the PDF file
            result: ParseResult object to update with parsed content and metadata
            **kwargs: Additional parsing options:
                - offset (int): Starting offset for conversion, default 0
                - limit (int): Maximum items to convert (-1 for unlimited), default -1
                - extract_images (bool): Whether to extract images from PDF, default True
        """
        # Get local file path
        local_file_path = await self._get_file_path(file_path)

        logger.info(f"Parsing PDF file with MarkItDown: {local_file_path}")

        # Use base class MarkItDown functionality to convert PDF file
        # Enable image extraction with PyMuPDF plugin
        markdown_content = await self._convert_with_markitdown(
            local_file_path,
            offset=kwargs.get('offset', 0),
            limit=kwargs.get('limit', -1),
            text_page_image_extract_count=5  # Extract up to 5 images per page with text
        )

        if not markdown_content:
            raise ValueError("MarkItDown conversion returned empty content")

        # Check image processing options
        extract_images = kwargs.get('extract_images', True)

        # Extract and save images if requested and present in markdown content
        # This follows the same approach as powerpoint_driver
        if extract_images:
            final_content = await self._extract_and_save_images(markdown_content, result)
        else:
            # If extract_images=False, remove image list markers from content
            final_content = self._remove_image_list_markers(markdown_content)

        # Add filename as main title and adjust content heading levels
        from ..utils.markdown_util import MarkdownUtil
        file_path_obj = Path(file_path)

        final_markdown_content = MarkdownUtil.add_filename_title(final_content, file_path_obj.name)
        await MarkdownUtil.write_to_file(final_markdown_content, result.output_file_path)

        result.needs_visual_understanding = False

        result.metadata.conversion_method = 'markitdown_local'
        result.conversion_strategy = ConversionStrategy.PERFORMANCE.value
        result.metadata.additional_info = {
            'parsing_method': 'markitdown_pymupdf',
            'character_count': len(final_content),
            'word_count': len(final_content.split()),
            'page_count_estimate': self._estimate_page_count(markdown_content),
            'processing_type': 'local',
            'image_extraction_status': 'attempted' if extract_images and '- 图片' in markdown_content else 'disabled' if not extract_images else 'not_needed',
            'image_support_note': 'PyMuPDF plugin supports PDF image extraction and processing',
            'images_extracted': extract_images
        }

        logger.info(f"Successfully parsed PDF with MarkItDown: {local_file_path}")

    async def _extract_and_save_images(self, markdown_content: str, result: ParseResult) -> str:
        """提取并保存 PDF 中的图片，参考 powerpoint_driver 的实现

        Args:
            markdown_content: 原始 Markdown 内容
            result: ParseResult 对象，用于设置输出图片目录

        Returns:
            str: 更新图片路径后的 Markdown 内容
        """
        try:
            # 检测是否有提取的图片路径（格式：- 图片 X: /path/to/image.png）
            image_paths = await self._extract_image_paths_from_markdown(markdown_content)

            if not image_paths:
                logger.debug("未检测到提取的图片，返回原始内容")
                return markdown_content

            logger.info(f"检测到 {len(image_paths)} 个提取的图片，开始保存")

            # 导入图片处理工具
            from ..utils.document_image_util import DocumentImageUtil
            from ..utils.image_extractor_util import ImageExtractorUtil

            # 保存图片到文件系统
            saved_images_mapping = await DocumentImageUtil.save_images_to_output_path(
                image_paths, result.output_file_path, 'pdf'
            )

            if saved_images_mapping:
                # 转换为标准markdown图片格式
                final_content = self._convert_to_markdown_image_format(
                    markdown_content, saved_images_mapping, result.output_file_path
                )

                # 设置图片目录路径
                images_dir = DocumentImageUtil.get_images_directory_path(result.output_file_path)
                result.output_images_dir = str(images_dir)

                # 清理临时图片文件
                ImageExtractorUtil.cleanup_temp_images(image_paths)
                logger.info(f"成功保存 {len(image_paths)} 张图片并更新为markdown格式")

                return final_content
            else:
                logger.warning("图片保存失败，返回原始内容")
                return markdown_content

        except Exception as e:
            logger.error(f"图片提取和保存过程中发生异常: {e}", exc_info=True)
            return markdown_content

    async def _extract_image_paths_from_markdown(self, markdown_content: str) -> list[str]:
        """从 Markdown 内容中提取图片路径

        Args:
            markdown_content: Markdown 内容

        Returns:
            list[str]: 提取的图片路径列表
        """
        import re
        image_paths = []

        # 匹配 "- 图片 X: /path/to/image.png" 格式
        pattern = r'- 图片 \d+: (.+\.(?:png|jpg|jpeg|gif|bmp|tiff|webp))'
        matches = re.findall(pattern, markdown_content, re.IGNORECASE)

        loop = asyncio.get_event_loop()
        for match in matches:
            image_path = match.strip()
            # Check existence asynchronously
            file_exists = await loop.run_in_executor(None, Path(image_path).exists)
            if file_exists:
                image_paths.append(image_path)

        return image_paths

    def _convert_to_markdown_image_format(self, markdown_content: str, saved_images_mapping: dict, output_file_path: str) -> str:
        """将图片列表格式转换为标准的markdown图片格式

        Args:
            markdown_content: 原始 Markdown 内容
            saved_images_mapping: 图片路径映射字典 {temp_path: saved_path}
            output_file_path: 输出文件路径

        Returns:
            str: 转换后的 Markdown 内容
        """
        import re
        from pathlib import Path

        # 获取输出文件所在目录，用于生成相对路径
        output_dir = Path(output_file_path).parent

        # 查找所有 "- 图片 X: /path/to/image.png" 格式的行
        pattern = r'- 图片 (\d+): (.+\.(?:png|jpg|jpeg|gif|bmp|tiff|webp))'

        def replace_image_reference(match):
            image_num = match.group(1)
            temp_image_path = match.group(2).strip()

            # 在映射中查找对应的保存路径
            if temp_image_path in saved_images_mapping:
                saved_path = Path(saved_images_mapping[temp_image_path])
                # 生成相对路径
                try:
                    relative_path = saved_path.relative_to(output_dir)
                    return f"![图片 {image_num}]({relative_path})"
                except ValueError:
                    # 如果无法生成相对路径，使用绝对路径
                    return f"![图片 {image_num}]({saved_path})"
            else:
                # 如果没有找到映射，保持原格式但转换为markdown格式
                return f"![图片 {image_num}]({temp_image_path})"

        # 执行替换
        updated_content = re.sub(pattern, replace_image_reference, markdown_content)

        logger.debug("成功将图片引用转换为标准markdown格式")
        return updated_content

    def _remove_image_list_markers(self, markdown_content: str) -> str:
        """移除图片列表标记（- 图片 X: /path/to/image.png）

        Args:
            markdown_content: 原始 Markdown 内容

        Returns:
            str: 移除图片标记后的 Markdown 内容
        """
        import re

        # 匹配并移除 "- 图片 X: /path/to/image.png" 格式的行
        pattern = r'- 图片 \d+: .+\.(?:png|jpg|jpeg|gif|bmp|tiff|webp)\n?'
        cleaned_content = re.sub(pattern, '', markdown_content, flags=re.IGNORECASE)

        # 清理多余的空行
        cleaned_content = re.sub(r'\n{3,}', '\n\n', cleaned_content)

        logger.debug("成功移除图片列表标记")
        return cleaned_content.strip()

    def _estimate_page_count(self, content: str) -> int:
        """Estimate the number of pages based on content structure.

        Args:
            content: Markdown content from the PDF

        Returns:
            int: Estimated number of pages
        """
        # Look for page indicators in the markdown
        page_indicators = [
            'Page ',
            'page ',
            '\f',  # Form feed character (page break)
            '---\n',  # Horizontal rules might indicate page breaks
        ]

        max_count = 0
        for indicator in page_indicators:
            count = content.count(indicator)
            max_count = max(max_count, count)

        # If no clear indicators, estimate based on content length
        if max_count == 0:
            # Rough estimate: ~500 words per page
            word_count = len(content.split())
            max_count = max(1, word_count // 500)

        return max(1, max_count)  # At least 1 page
