"""Image extraction utility for PowerPoint file parsing.

This module provides utilities for extracting images from PowerPoint (PPTX/PPT) files.
"""

import asyncio
import os
import time
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List, Dict

import aiofiles
from agentlang.logger import get_logger

logger = get_logger(__name__)


class ImageExtractorUtil:
    """Utility class for image extraction from PowerPoint files."""

    @staticmethod
    async def extract_pptx_images_by_slides(pptx_file_path: Path, max_images_per_slide: int = 10) -> Dict[int, List[str]]:
        """Extract images from PPTX file organized by slide numbers.

        Args:
            pptx_file_path: Path to the PPTX file
            max_images_per_slide: Maximum number of images to extract per slide

        Returns:
            Dict[int, List[str]]: Dictionary mapping slide numbers to lists of extracted image paths
        """
        extracted_images_by_slide = {}

        try:
            # Create temporary directory for extracted images
            process_id = os.getpid()
            temp_dir = Path(tempfile.gettempdir()) / f"pptx_slide_images_{process_id}"
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, lambda: temp_dir.mkdir(exist_ok=True))

            with zipfile.ZipFile(pptx_file_path, 'r') as zip_ref:
                # Get all slide relationship files
                slide_rels = [f for f in zip_ref.namelist() if f.startswith('ppt/slides/_rels/') and f.endswith('.xml.rels')]

                for slide_rel in slide_rels:
                    try:
                        # Extract slide number from filename (e.g., slide1.xml.rels -> 1)
                        slide_filename = Path(slide_rel).name
                        slide_num_str = slide_filename.replace('slide', '').replace('.xml.rels', '')
                        slide_number = int(slide_num_str)

                        # Parse relationship XML to find image references
                        rel_content = zip_ref.read(slide_rel).decode('utf-8')
                        root = ET.fromstring(rel_content)

                        slide_images = []
                        image_count = 0

                        # Find image relationships
                        for relationship in root.findall('.//{http://schemas.openxmlformats.org/package/2006/relationships}Relationship'):
                            rel_type = relationship.get('Type')
                            if 'image' in rel_type:
                                target = relationship.get('Target')
                                if target and target.startswith('../media/'):
                                    # Convert relative path to ZIP path
                                    image_path = target.replace('../', 'ppt/')

                                    if image_path in zip_ref.namelist():
                                        # Extract image
                                        image_data = zip_ref.read(image_path)

                                        # Skip very small images (likely decorative), but use smaller threshold for testing
                                        if len(image_data) < 500:  # Less than 500 bytes
                                            continue

                                        # Generate filename with slide info
                                        timestamp: int = int(time.time() * 1000)
                                        original_name = Path(image_path).name
                                        img_filename = f"slide_{slide_number:02d}_img_{image_count+1}_{timestamp}_{original_name}"
                                        img_path = temp_dir / img_filename

                                        # Save image asynchronously
                                        async with aiofiles.open(img_path, 'wb') as img_file:
                                            await img_file.write(image_data)

                                        slide_images.append(str(img_path))
                                        image_count += 1

                                        # Respect max images per slide limit
                                        if image_count >= max_images_per_slide:
                                            break

                        if slide_images:
                            extracted_images_by_slide[slide_number] = slide_images

                    except (ValueError, ET.ParseError, KeyError) as e:
                        logger.warning(f"Failed to process slide relationship {slide_rel}: {e}")
                        continue

        except Exception as e:
            logger.error(f"PPTX slide-based image extraction failed: {e}")
            return {}

        total_images = sum(len(images) for images in extracted_images_by_slide.values())
        logger.info(f"Successfully extracted {total_images} images from {len(extracted_images_by_slide)} slides")
        return extracted_images_by_slide

    @staticmethod
    async def extract_docx_images(docx_file_path: Path, max_images: int = -1) -> List[str]:
        """Extract images from DOCX file using ZIP structure.

        Args:
            docx_file_path: Path to the DOCX file
            max_images: Maximum number of images to extract (-1 for unlimited)

        Returns:
            List[str]: List of extracted image file paths
        """
        extracted_images = []

        try:
            # Create temporary directory for extracted images
            process_id = os.getpid()
            temp_dir = Path(tempfile.gettempdir()) / f"docx_extracted_images_{process_id}"
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, lambda: temp_dir.mkdir(exist_ok=True))

            # Extract images using ZIP file structure
            with zipfile.ZipFile(docx_file_path, 'r') as zip_ref:
                media_files = [f for f in zip_ref.namelist()
                             if f.startswith('word/media/') and
                             f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp'))]

                # Limit to max_images if specified (max_images > 0)
                if max_images > 0:
                    media_files = media_files[:max_images]

                for i, media_file in enumerate(media_files):
                    try:
                        # Extract image data
                        image_data = zip_ref.read(media_file)

                        # Skip very small images (likely decorative), but use smaller threshold for testing
                        if len(image_data) < 500:  # Less than 500 bytes
                            continue

                        # Generate unique filename
                        timestamp: int = int(time.time() * 1000)
                        original_name = Path(media_file).name
                        img_filename = f"doc_img_{i+1}_{timestamp}_{original_name}"
                        img_path = temp_dir / img_filename

                        # Save image asynchronously
                        async with aiofiles.open(img_path, 'wb') as img_file:
                            await img_file.write(image_data)

                        extracted_images.append(str(img_path))

                    except Exception as e:
                        logger.warning(f"Failed to extract image {media_file}: {e}")
                        continue

        except Exception as e:
            logger.error(f"DOCX image extraction failed: {e}")
            return []

        logger.info(f"Successfully extracted {len(extracted_images)} images from DOCX")
        return extracted_images

    @staticmethod
    def cleanup_temp_images(image_paths: List[str]) -> None:
        """Clean up temporary image files.

        Args:
            image_paths: List of temporary image file paths to clean up
        """
        cleaned_count = 0
        for img_path in image_paths:
            try:
                Path(img_path).unlink(missing_ok=True)
                cleaned_count += 1
            except Exception as e:
                logger.warning(f"Failed to clean up temporary image {img_path}: {e}")

        if cleaned_count > 0:
            logger.debug(f"Cleaned up {cleaned_count} temporary image files")
