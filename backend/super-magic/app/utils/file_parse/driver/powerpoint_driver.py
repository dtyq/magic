"""PowerPoint presentation file parser driver implementation."""

import asyncio
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Union, List, Optional

from agentlang.logger import get_logger
from .abstract_driver import AbstractDriver
from .interfaces.file_parser_driver_interface import ParseResult, ParseMetadata
from .interfaces.powerpoint_driver_interface import PowerPointDriverInterface

logger = get_logger(__name__)


class PowerPointDriver(AbstractDriver, PowerPointDriverInterface):
    """PowerPoint presentation parser driver using MarkItDown integration.

    Supports both .pptx and .ppt formats:
    - .pptx: Direct processing through existing PptxConverter plugin
    - .ppt: Converted to .pptx using LibreOffice/unoconv, then processed
    """

    # Supported PowerPoint extensions
    supported_extensions = ['.ppt', '.pptx']

    async def parse(self, file_path: Union[str, Path], result: ParseResult, **kwargs) -> None:
        """Parse PowerPoint presentation and update the provided ParseResult object.

        Args:
            file_path: Path to the PowerPoint presentation (.ppt or .pptx)
            result: ParseResult object to update with parsed content and metadata
            **kwargs: Additional parsing options:
                - offset (int): Starting offset for conversion, default 0
                - limit (int): Maximum items to convert (-1 for unlimited), default -1
                - extract_images (bool): Whether to extract images from presentation, default True
        """
        file_path_obj = Path(file_path)
        is_ppt_format = file_path_obj.suffix.lower() == '.ppt'

        logger.info(f"Parsing PowerPoint presentation: {file_path_obj} (format: {'PPT' if is_ppt_format else 'PPTX'})")

        # Get local file path
        local_file_path = await self._get_file_path(file_path)

        # Handle .ppt files by converting to .pptx first
        converted_file_path = None
        try:
            if is_ppt_format:
                from ..utils.libreoffice_util import LibreOfficeUtil
                converted_file_path = await LibreOfficeUtil.convert_document(
                    local_file_path, 'pptx', 'converted'
                )
                processing_file_path = converted_file_path
                conversion_method = 'libreoffice_then_markitdown'
            else:
                processing_file_path = local_file_path
                conversion_method = 'markitdown'

            # Use base class MarkItDown functionality to convert the file
            markdown_content = await self._convert_with_markitdown(
                processing_file_path,
                offset=kwargs.get('offset', 0),
                limit=kwargs.get('limit', -1)
            )

            if not markdown_content:
                raise ValueError("MarkItDown conversion returned empty content")

            # Check image processing options
            extract_images = kwargs.get('extract_images', True)

            # Initialize variables for image handling
            saved_images_mapping = {}

            # Extract and save images if requested
            if extract_images and ('![' in markdown_content):
                from ..utils.image_extractor_util import ImageExtractorUtil

                # Extract images using slide-based method for better ordering
                logger.info("Extracting images for filesystem saving")
                extracted_images_by_slide = await ImageExtractorUtil.extract_pptx_images_by_slides(processing_file_path)

                # Flatten slide-based images to maintain slide order
                extracted_images = []
                for slide_num in sorted(extracted_images_by_slide.keys()):
                    slide_images = extracted_images_by_slide[slide_num]
                    extracted_images.extend(slide_images)
                    logger.debug(f"Added {len(slide_images)} images from slide {slide_num}")

                # Save images to filesystem if requested
                if extracted_images:
                    from ..utils.document_image_util import DocumentImageUtil

                    saved_images_mapping = await DocumentImageUtil.save_images_to_output_path(
                        extracted_images, result.output_file_path, 'slide'
                    )

                    # Update markdown image paths if images were saved
                    final_content = DocumentImageUtil.update_image_paths_in_markdown(
                        markdown_content, saved_images_mapping, result.output_file_path
                    )

                    # Set images directory path in result
                    images_dir = DocumentImageUtil.get_images_directory_path(result.output_file_path)
                    result.output_images_dir = str(images_dir)

                    # Clean up temporary images after saving
                    ImageExtractorUtil.cleanup_temp_images(extracted_images)
                    logger.debug(f"Cleaned up {len(extracted_images)} temporary image files")
                else:
                    final_content = markdown_content
            else:
                final_content = markdown_content

            # Add filename as main title and adjust content heading levels
            from ..utils.markdown_util import MarkdownUtil

            final_markdown_content = MarkdownUtil.add_filename_title(final_content, file_path_obj.name)
            await MarkdownUtil.write_to_file(final_markdown_content, result.output_file_path)
            result.metadata.conversion_method = conversion_method
            result.metadata.additional_info = {
                'presentation_format': 'ppt' if is_ppt_format else 'pptx',
                'character_count': len(final_content),  # Use final content length
                'slide_count': self._estimate_slide_count(markdown_content),
                'original_format': 'ppt' if is_ppt_format else 'pptx',
                'conversion_required': is_ppt_format,
                'images_extracted': extract_images
            }
        finally:
            # Clean up temporary converted file if it was created
            if converted_file_path:
                try:
                    loop = asyncio.get_event_loop()
                    file_exists = await loop.run_in_executor(None, converted_file_path.exists)
                    if file_exists:
                        await loop.run_in_executor(None, converted_file_path.unlink)
                        logger.debug(f"Cleaned up temporary file: {converted_file_path}")
                except Exception as e:
                    logger.warning(f"Failed to clean up temporary file {converted_file_path}: {e}")

    def _estimate_slide_count(self, content: str) -> int:
        """Estimate the number of slides based on content structure.

        Args:
            content: Markdown content from the presentation

        Returns:
            int: Estimated number of slides
        """
        # Look for slide indicators in the markdown
        # This is a rough estimation based on common patterns
        slide_indicators = [
            '# Slide',
            '## Slide',
            '---\n',  # Slide separators
            'Slide '
        ]

        max_count = 0
        for indicator in slide_indicators:
            count = content.count(indicator)
            max_count = max(max_count, count)

        # If no clear indicators, estimate based on heading structure
        if max_count == 0:
            # Count top-level headings as potential slides
            max_count = content.count('\n# ') + (1 if content.startswith('# ') else 0)

        return max(1, max_count)  # At least 1 slide
