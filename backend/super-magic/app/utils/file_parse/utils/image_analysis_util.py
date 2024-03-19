"""Image analysis utility for PowerPoint file parsing.

This module provides utilities for analyzing images from PowerPoint files using visual understanding capabilities.
"""

import asyncio
from pathlib import Path
from typing import List, Optional, Dict

from agentlang.logger import get_logger

logger = get_logger(__name__)


class ImageAnalysisUtil:
    """Utility class for image analysis from PowerPoint files."""

    @staticmethod
    def _create_visual_understanding_tool():
        """Create and return a visual understanding tool instance."""
        from app.tools.visual_understanding import VisualUnderstanding
        return VisualUnderstanding()

    @staticmethod
    def _create_visual_understanding_params(image_paths: List[str], query: str):
        """Create visual understanding parameters."""
        from app.tools.visual_understanding import VisualUnderstandingParams
        return VisualUnderstandingParams(images=image_paths, query=query)


    @staticmethod
    async def analyze_images_with_visual_understanding(
        image_paths: List[str],
        query: str,
        max_images: int = 100,
        batch_size: int = 5
    ) -> Optional[str]:
        """Analyze images using visual understanding tool with batching and concurrency.

        Args:
            image_paths: List of image file paths to analyze
            query: Query for image analysis (required)
            max_images: Maximum number of images to process (default: 100)
            batch_size: Number of images to process in each batch (default: 5)

        Returns:
            str: Analysis result or None if failed
        """
        if not image_paths:
            logger.debug("No images provided for analysis")
            return None

        try:
            # Limit the number of images to process
            limited_image_paths = image_paths[:max_images]

            if len(image_paths) > max_images:
                logger.info(f"Limited image analysis from {len(image_paths)} to {max_images} images")

            # Create batches of images
            batches = [
                limited_image_paths[i:i + batch_size]
                for i in range(0, len(limited_image_paths), batch_size)
            ]

            logger.info(f"Processing {len(limited_image_paths)} images in {len(batches)} batches (batch_size: {batch_size})")

            # Process batches concurrently
            batch_results = await ImageAnalysisUtil._process_image_batches_concurrently(
                batches, query
            )

            # Filter out None results and combine
            valid_results = [result for result in batch_results if result and result.strip()]

            if not valid_results:
                logger.warning("All visual understanding batches returned empty results")
                return None

            # Combine all batch results
            combined_result = "\n\n".join(valid_results)

            logger.info(f"Successfully analyzed {len(limited_image_paths)} images in {len(valid_results)}/{len(batches)} successful batches")
            return combined_result

        except Exception as e:
            logger.error(f"Visual understanding analysis failed: {e}")
            return None

    @staticmethod
    async def _process_image_batches_concurrently(
        batches: List[List[str]],
        query: Optional[str] = None
    ) -> List[Optional[str]]:
        """Process image batches concurrently.

        Args:
            batches: List of image path batches to process
            query: Query for analysis (optional)

        Returns:
            List[Optional[str]]: Results from each batch processing
        """
        import asyncio

        # Create tasks for concurrent batch processing
        tasks = []
        for i, batch in enumerate(batches):
            task = ImageAnalysisUtil._process_single_batch(batch, query, i + 1)
            tasks.append(task)

        # Execute all batches concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Handle exceptions and convert to proper return format
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Batch {i + 1} failed with exception: {result}")
                processed_results.append(None)
            else:
                processed_results.append(result)

        return processed_results

    @staticmethod
    async def _process_single_batch(
        image_paths: List[str],
        query: str,
        batch_number: int
    ) -> Optional[str]:
        """Process a single batch of images.

        Args:
            image_paths: List of image paths for this batch
            query: Query for analysis (required)
            batch_number: Batch number for logging

        Returns:
            str: Analysis result for this batch or None if failed
        """
        try:
            logger.debug(f"Processing batch {batch_number} with {len(image_paths)} images")

            # Create visual understanding tool instance
            visual_tool = ImageAnalysisUtil._create_visual_understanding_tool()

            # Create batch-specific query with actual file names
            batch_file_names = [Path(img_path).name for img_path in image_paths]
            file_list = '\n'.join([f"- {name}" for name in batch_file_names])

            # Create batch-specific query with actual file names
            batch_query = f"""{query}

当前批次包含以下图片文件：
{file_list}

请只分析上述列出的图片文件，不要提及其他文件。"""

            # Create parameters for visual understanding
            params = ImageAnalysisUtil._create_visual_understanding_params(image_paths, batch_query)

            # Execute analysis
            result = await visual_tool.execute_purely(
                params,
                include_download_info_in_content=False,
                include_dimensions_info_in_content=False
            )

            if result and result.ok and result.content and result.content.strip():
                logger.debug(f"Batch {batch_number} completed successfully")
                return result.content
            else:
                if result and not result.ok:
                    error_msg = getattr(result, 'error', 'Unknown error')
                    logger.warning(f"Batch {batch_number} analysis failed: {error_msg}")
                else:
                    logger.warning(f"Batch {batch_number} returned empty result")
                return None

        except Exception as e:
            logger.error(f"Batch {batch_number} processing failed: {e}")
            return None
