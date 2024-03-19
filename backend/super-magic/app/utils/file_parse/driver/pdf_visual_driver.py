"""PDF file parser driver using visual understanding for page-by-page analysis.

This driver converts each PDF page to an image and uses visual understanding to analyze content.
Best for PDFs with complex visual layouts, charts, diagrams, and mixed content.
"""

import asyncio
import tempfile
from pathlib import Path
from typing import Union, List, Optional, Dict
import fitz  # PyMuPDF

from agentlang.logger import get_logger
from .interfaces.pdf_driver_interface import PdfDriverInterface
from .interfaces.file_parser_driver_interface import ParseResult, ParseMetadata, ConversionStrategy
from .abstract_driver import AbstractDriver
from app.tools.visual_understanding import VisualUnderstanding, VisualUnderstandingParams

logger = get_logger(__name__)


class PdfVisualDriver(AbstractDriver, PdfDriverInterface):
    """PDF file parser driver using visual understanding for page-by-page analysis.

    This driver converts each PDF page to high-quality images and uses visual understanding
    AI to analyze the content of each page. It provides comprehensive understanding of
    visual elements, charts, diagrams, and complex layouts.

    Features:
    - Page-by-page visual analysis using AI vision models
    - High-quality page image generation from PDF (temporary files only)
    - Understanding of charts, diagrams, and visual content
    - Structured markdown output with page organization
    - No image files saved - only text analysis results

    Best for: PDFs with charts, diagrams, complex visual layouts, mixed content
    Priority: 3 (highest - for visual content analysis)
    """

    # Define supported extensions as class attribute
    supported_extensions = ['.pdf']

    # Highest priority for visual content analysis
    priority = 3

    def __init__(self):
        """Initialize PDF visual driver with visual understanding tool."""
        super().__init__()
        self._visual_tool = VisualUnderstanding()
        logger.debug("Initialized PDF visual understanding driver")

    async def parse(self, file_path: Union[str, Path], result: ParseResult, **kwargs) -> None:
        """Parse PDF file using visual understanding and update the provided ParseResult object.

        Args:
            file_path: Path to the PDF file
            result: ParseResult object to update with parsed content and metadata
            **kwargs: Additional parsing options:
                - dpi (int): DPI for page rendering, default 200
                - max_pages (int): Maximum pages to process, default -1 (all pages)
                - batch_size (int): Number of pages to process in parallel, default 10
                - visual_query (str): Custom query for visual analysis
        """
        # Get local file path
        local_file_path = await self._get_file_path(file_path)

        logger.info(f"Parsing PDF file with visual understanding: {local_file_path}")

        # Extract configuration parameters
        # 降低默认 DPI 到 150，对文档识别完全足够，且避免生成超大图片
        dpi = kwargs.get('dpi', 150)
        max_pages = kwargs.get('max_pages', -1)
        batch_size = kwargs.get('batch_size', 10)
        visual_query = kwargs.get('visual_query', self._get_default_visual_query())

        # Convert PDF pages to images
        page_images = await self._convert_pdf_pages_to_images(
            str(local_file_path), dpi=dpi, max_pages=max_pages
        )

        if not page_images:
            raise ValueError("No pages could be converted to images from PDF")

        # Analyze pages with visual understanding in batches
        page_analyses = await self._analyze_pages_with_visual_understanding(
            page_images, visual_query, batch_size=batch_size
        )

        # Generate final markdown content
        final_content = await self._generate_final_markdown(
            page_analyses, page_images, file_path
        )

        # Clean up temporary image files asynchronously
        await self._cleanup_temp_files(page_images)

        # Add filename as main title and write to file
        from ..utils.markdown_util import MarkdownUtil
        file_path_obj = Path(file_path)

        final_markdown_content = MarkdownUtil.add_filename_title(final_content, file_path_obj.name)
        await MarkdownUtil.write_to_file(final_markdown_content, result.output_file_path)

        result.metadata.conversion_method = 'visual_understanding'
        result.conversion_strategy = ConversionStrategy.QUALITY.value
        result.metadata.additional_info = {
            'parsing_method': 'pdf_visual_understanding',
            'pages_processed': len(page_analyses),
            'total_pages_in_pdf': len(page_images),
            'dpi_used': dpi,
            'character_count': len(final_content),
            'word_count': len(final_content.split()),
            'processing_type': 'visual_ai_analysis',
            'batch_size': batch_size
        }

        logger.info(f"Successfully parsed PDF with visual understanding: {local_file_path}")

    async def _convert_pdf_pages_to_images(
        self,
        pdf_path: str,
        dpi: int = 200,
        max_pages: int = -1
    ) -> List[Dict]:
        """Convert PDF pages to high-quality images using PyMuPDF.

        Args:
            pdf_path: Path to the PDF file
            dpi: DPI for image rendering
            max_pages: Maximum number of pages to convert (-1 for all)

        Returns:
            List[Dict]: List of page info dicts with keys: page_num, image_path, temp_file
        """
        try:
            # 在线程池中执行 PDF 转图片（CPU 密集型操作）
            def _convert_sync():
                page_images = []

                # Open PDF document
                doc = fitz.open(pdf_path)
                total_pages = doc.page_count

                # Determine pages to process
                pages_to_process = total_pages if max_pages == -1 else min(max_pages, total_pages)

                logger.info(f"Converting {pages_to_process} pages to images (DPI: {dpi})")

                # Create matrix for high-quality rendering
                mat = fitz.Matrix(dpi / 72, dpi / 72)  # 72 is default DPI

                for page_num in range(pages_to_process):
                    page = doc[page_num]

                    # 获取页面原始尺寸
                    page_rect = page.rect
                    page_width = page_rect.width * dpi / 72
                    page_height = page_rect.height * dpi / 72

                    # 计算总像素数，如果超限则自动降低渲染质量
                    total_pixels = page_width * page_height
                    max_pixels = 32_000_000  # 与压缩限制保持一致

                    if total_pixels > max_pixels:
                        # 计算安全的缩放比例
                        scale_factor = (max_pixels / total_pixels) ** 0.5
                        adjusted_mat = fitz.Matrix(dpi / 72 * scale_factor, dpi / 72 * scale_factor)
                        logger.info(f"第 {page_num + 1} 页像素数 ({int(page_width)}x{int(page_height)}={int(total_pixels):,}) 超限，降低渲染质量 (缩放比例: {scale_factor:.2f})")
                        pix = page.get_pixmap(matrix=adjusted_mat)
                    else:
                        # Render page as image
                        pix = page.get_pixmap(matrix=mat)

                    # Create temporary file for the image
                    temp_file = tempfile.NamedTemporaryFile(
                        suffix=f'_page_{page_num + 1:03d}.png',
                        delete=False
                    )
                    temp_file.close()

                    # Save image to temporary file
                    pix.save(temp_file.name)

                    page_images.append({
                        'page_num': page_num + 1,
                        'image_path': temp_file.name,
                        'temp_file': temp_file.name
                    })

                doc.close()
                logger.info(f"Successfully converted {len(page_images)} pages to images")
                return page_images

            # 异步执行转换
            page_images = await asyncio.to_thread(_convert_sync)
            return page_images

        except Exception as e:
            logger.error(f"Failed to convert PDF pages to images: {e}")
            raise ValueError(f"PDF to images conversion failed: {e}")

    async def _analyze_pages_with_visual_understanding(
        self,
        page_images: List[Dict],
        visual_query: str,
        batch_size: int = 10
    ) -> List[Dict]:
        """Analyze PDF page images using visual understanding in batches.

        Args:
            page_images: List of page image info dicts
            visual_query: Query for visual analysis
            batch_size: Number of pages to process in parallel

        Returns:
            List[Dict]: List of analysis results with keys: page_num, analysis, success
        """
        logger.info(f"Starting visual analysis of {len(page_images)} pages in batches of {batch_size}")

        # Split pages into batches for parallel processing
        batches = [
            page_images[i:i + batch_size]
            for i in range(0, len(page_images), batch_size)
        ]

        all_analyses = []

        for batch_idx, batch in enumerate(batches):
            logger.debug(f"Processing batch {batch_idx + 1}/{len(batches)} with {len(batch)} pages")

            # Create tasks for batch processing
            batch_tasks = [
                self._analyze_single_page(page_info, visual_query)
                for page_info in batch
            ]

            # Execute batch concurrently
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)

            # Process batch results
            for result in batch_results:
                if isinstance(result, Exception):
                    logger.error(f"Page analysis failed with exception: {result}")
                    all_analyses.append({
                        'page_num': 0,
                        'analysis': "分析失败：发生异常",
                        'success': False
                    })
                else:
                    all_analyses.append(result)

        logger.info(f"Completed visual analysis of all {len(page_images)} pages")
        return all_analyses

    async def _analyze_single_page(self, page_info: Dict, visual_query: str) -> Dict:
        """Analyze a single page using visual understanding.

        Args:
            page_info: Page information dict with image_path
            visual_query: Query for visual analysis

        Returns:
            Dict: Analysis result with keys: page_num, analysis, success
        """
        page_num = page_info['page_num']
        image_path = page_info['image_path']

        try:
            # Prepare page-specific query
            page_specific_query = f"这是PDF文档的第{page_num}页。{visual_query}"

            # Create visual understanding parameters
            params = VisualUnderstandingParams(
                images=[image_path],
                query=page_specific_query
            )

            # Execute visual analysis
            result = await self._visual_tool.execute_purely(
                params,
                include_download_info_in_content=False,
                include_dimensions_info_in_content=False
            )

            if result.ok and result.content:
                logger.debug(f"Successfully analyzed page {page_num}")
                return {
                    'page_num': page_num,
                    'analysis': result.content.strip(),
                    'success': True
                }
            else:
                logger.warning(f"Visual analysis failed for page {page_num}: {result.error if result.error else 'No content'}")
                return {
                    'page_num': page_num,
                    'analysis': "分析失败：无法获取分析结果",
                    'success': False
                }

        except Exception as e:
            logger.error(f"Exception during analysis of page {page_num}: {e}")
            return {
                'page_num': page_num,
                'analysis': f"分析失败：{str(e)}",
                'success': False
            }

    async def _generate_final_markdown(
        self,
        page_analyses: List[Dict],
        page_images: List[Dict],
        original_file_path: Union[str, Path]
    ) -> str:
        """Generate final markdown content from page analyses.

        Args:
            page_analyses: List of page analysis results
            page_images: List of page image info
            original_file_path: Original PDF file path

        Returns:
            str: Final markdown content
        """
        content_parts = []

        # Process each page
        for analysis in page_analyses:
            page_num = analysis['page_num']
            page_analysis = analysis['analysis']

            if analysis['success']:
                # Add page header for multi-page docs
                if len(page_images) > 1:
                    if page_num > 1:
                        content_parts.append("")
                        content_parts.append("---")
                        content_parts.append("")
                    content_parts.append(f"## 第 {page_num} 页")
                    content_parts.append("")

                content_parts.append(page_analysis)
            else:
                # For failed pages, add a simple error message
                if len(page_images) > 1:
                    if page_num > 1:
                        content_parts.append("")
                        content_parts.append("---")
                        content_parts.append("")
                    content_parts.append(f"## 第 {page_num} 页")
                    content_parts.append("")
                    content_parts.append("解析失败：无法获取页面内容")

            content_parts.append("")

        return "\n".join(content_parts).strip()


    def _get_default_visual_query(self) -> str:
        """Get default query for visual understanding analysis."""
        return """请将这个PDF页面转换为结构化的markdown格式，要求：

1. 根据页面实际内容，使用合适的三级标题（###）来组织不同类型的内容，比如：
   - ### 文字内容 （页面中的纯文本）
   - ### 表格数据 （表格信息）
   - ### 图片描述 （图像内容）
   - ### 图表分析 （图表信息）
   - ### 公式内容 （数学公式）
   - ### 其他元素 （签名、印章等）
   - 或根据实际情况使用更自然的标题

2. 内容组织要求：
   - 如果内容类型单一，可以不使用分类标题，直接输出内容
   - 如果内容类型混合，使用三级标题进行分类
   - 表格数据用markdown表格格式
   - 图片和图表要详细描述，包含颜色、形状、位置等视觉特征
   - 不要使用![](]图片格式
   - 保持自然的阅读流畅性

3. 灵活组织：
   - 根据页面复杂程度决定是否需要分类标题
   - 内容简单时保持简洁，复杂时适度分类
   - 确保最终输出便于阅读和理解

请输出结构化的markdown内容，既保持组织性又避免过度分类。"""

    async def _cleanup_temp_files(self, page_images: List[Dict]):
        """Clean up temporary image files."""
        loop = asyncio.get_event_loop()
        for page_info in page_images:
            try:
                temp_path = page_info.get('temp_file')
                if temp_path:
                    temp_path_obj = Path(temp_path)
                    # Check existence asynchronously
                    file_exists = await loop.run_in_executor(None, temp_path_obj.exists)
                    if file_exists:
                        # Delete file asynchronously
                        await loop.run_in_executor(None, temp_path_obj.unlink)
            except Exception as e:
                logger.warning(f"Failed to clean up temp file: {e}")
