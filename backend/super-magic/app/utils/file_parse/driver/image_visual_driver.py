"""Image visual understanding file parser driver implementation."""

import asyncio
import shutil
from pathlib import Path
from typing import Union

from agentlang.logger import get_logger
from .abstract_driver import AbstractDriver
from .interfaces.file_parser_driver_interface import ParseResult
from .interfaces.image_driver_interface import ImageDriverInterface
from app.tools.visual_understanding import VisualUnderstanding, VisualUnderstandingParams

logger = get_logger(__name__)


class ImageVisualDriver(AbstractDriver, ImageDriverInterface):
    """Image visual understanding file parser driver using AI vision models.

    This driver analyzes images using visual understanding AI models to provide
    detailed descriptions, object detection, scene understanding, and other
    visual AI capabilities.

    Uses the VisualUnderstanding tool internally for AI-powered image analysis.
    """

    # Supported image file extensions
    supported_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff', '.tif', '.webp']
    priority = 2  # Higher priority than OCR driver

    def __init__(self):
        super().__init__()
        self._visual_understanding_tool = VisualUnderstanding()

    async def parse(self, file_path: Union[str, Path], result: ParseResult, **kwargs) -> None:
        """Parse image file using visual understanding AI and update the provided ParseResult object.

        Args:
            file_path: Path to the image file
            result: ParseResult object to update with parsed content and metadata
            **kwargs: Additional parsing options including:
                - query: Custom analysis query (optional, defaults to general description)
                - offset: Not applicable for image analysis
                - limit: Not applicable for image analysis

        Raises:
            Exception: If visual understanding fails
        """
        # Get local file path
        local_file_path = await self._get_file_path(file_path)

        # Extract query from kwargs or use default
        query = kwargs.get('query', '请分析这张图片的内容，识别其中的文字、图表、表格等信息。如果图片只是装饰性的（如边框、背景等），请说明。对于包含有意义信息的图片，请详细描述内容并提取其中的文字信息。')

        # Create parameters for visual understanding tool
        params = VisualUnderstandingParams(
            images=[str(local_file_path)],
            query=query
        )

        # Call visual understanding tool
        logger.info(f"开始视觉理解分析: {local_file_path}")
        tool_result = await self._visual_understanding_tool.execute_purely(
            params,
            include_download_info_in_content=False,  # Don't include download info for file parsing
            include_dimensions_info_in_content=False  # Don't include dimensions info for file parsing
        )

        if not tool_result.ok:
            logger.error(f"视觉理解失败: {tool_result.content}")
            raise Exception(f"Image visual analysis failed: {tool_result.content}")

        # Add filename as main title and adjust content heading levels
        from ..utils.markdown_util import MarkdownUtil
        file_path_obj = Path(file_path)

        # Create images directory and copy the original image
        from ..utils.document_image_util import DocumentImageUtil
        images_dir = DocumentImageUtil.get_images_directory_path(result.output_file_path)

        # Create directory asynchronously
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: images_dir.mkdir(parents=True, exist_ok=True))

        # Copy original image to images directory asynchronously
        image_filename = f"original_{file_path_obj.name}"
        image_dest_path = images_dir / image_filename
        await loop.run_in_executor(None, shutil.copy2, local_file_path, image_dest_path)
        logger.info(f"复制原始图片到: {image_dest_path}")

        # Set images directory path in result
        result.output_images_dir = str(images_dir)

        # Create content with relative image reference and visual understanding result
        relative_image_path = f"{images_dir.name}/{image_filename}"
        adjusted_content = MarkdownUtil.adjust_heading_levels(tool_result.content)
        final_markdown_content = f"# {file_path_obj.name}\n\n![{file_path_obj.name}]({relative_image_path})\n\n{adjusted_content}"
        await MarkdownUtil.write_to_file(final_markdown_content, result.output_file_path)

        # Update result metadata
        result.metadata.conversion_method = 'visual_understanding'

        # Extract additional info from tool result
        extra_info = tool_result.extra_info or {}
        image_dimensions_list = extra_info.get('image_dimensions_list', [])

        # Build additional metadata
        additional_info = {
            'image_format': local_file_path.suffix.lower(),
            'processing_type': 'visual_understanding',
            'character_count': len(tool_result.content),
            'word_count': len(tool_result.content.split()),
            'analysis_method': 'visual_ai',
            'query_used': query,
            'images_extracted': True,
            'original_image_copied': str(image_dest_path),
            'images_directory': str(images_dir)
        }

        # Add image dimensions if available
        if image_dimensions_list and len(image_dimensions_list) > 0 and image_dimensions_list[0]:
            dimensions_info = image_dimensions_list[0]
            if dimensions_info.get('size'):
                width, height = dimensions_info['size']
                additional_info.update({
                    'image_width': width,
                    'image_height': height,
                    'aspect_ratio': dimensions_info.get('aspect_ratio'),
                    'file_size_bytes': dimensions_info.get('file_size')
                })

        result.metadata.additional_info = additional_info

        # Set needs_visual_understanding to False since we already performed visual understanding
        result.needs_visual_understanding = False

        logger.info(f"视觉理解完成: {local_file_path}, 内容长度: {len(tool_result.content)}")
