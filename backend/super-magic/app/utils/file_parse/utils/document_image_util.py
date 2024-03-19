"""Document image management utilities."""

import asyncio
import re
import shutil
from pathlib import Path
from typing import List, Dict

from agentlang.logger import get_logger

logger = get_logger(__name__)


class DocumentImageUtil:
    """Utility class for document image management operations."""

    @staticmethod
    def get_images_directory_path(output_file_path: Path) -> Path:
        """Get the images directory path based on output file path.

        Args:
            output_file_path: Full path to output file (e.g., /a/b/c.md)

        Returns:
            Path: Images directory path (e.g., /a/b/c-images)
        """
        filename_without_ext = output_file_path.stem
        output_dir = output_file_path.parent
        return output_dir / f"{filename_without_ext}-images"

    @staticmethod
    async def save_images_to_output_path(
        temp_image_paths: List[str],
        output_file_path: Path,
        filename_prefix: str = "image"
    ) -> Dict[str, str]:
        """Save extracted images from temporary location to {filename}-images directory.

        Args:
            temp_image_paths: List of temporary image file paths
            output_file_path: Full path to output file (e.g., /a/b/c.md)
            filename_prefix: Prefix for saved image filenames (e.g., 'slide', 'doc')

        Returns:
            Dict[str, str]: Mapping of original temp paths to new permanent paths
        """
        saved_images_mapping = {}

        if not temp_image_paths:
            return saved_images_mapping

        # Create images directory with format: {filename}-images
        images_dir = DocumentImageUtil.get_images_directory_path(output_file_path)
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: images_dir.mkdir(exist_ok=True))

        logger.info(f"Saving {len(temp_image_paths)} images to directory: {images_dir}")

        for i, temp_path in enumerate(temp_image_paths):
            try:
                temp_file = Path(temp_path)

                # Check file existence asynchronously
                file_exists = await loop.run_in_executor(None, temp_file.exists)
                if not file_exists:
                    logger.warning(f"Temporary image file not found: {temp_path}")
                    continue

                # Generate new filename with prefix, number and original extension
                extension = temp_file.suffix
                new_filename = f"{filename_prefix}_{i+1:02d}_image{extension}"
                new_path = images_dir / new_filename

                # Copy file from temp location to permanent location asynchronously
                await loop.run_in_executor(None, shutil.copy2, temp_file, new_path)
                saved_images_mapping[temp_path] = str(new_path)

                logger.debug(f"Saved image: {temp_path} -> {new_path}")

            except Exception as e:
                logger.warning(f"Failed to save image {temp_path}: {e}")
                continue

        logger.info(f"Successfully saved {len(saved_images_mapping)} images to {images_dir}")
        return saved_images_mapping

    @staticmethod
    def update_image_paths_in_markdown(
        markdown_content: str,
        images_mapping: Dict[str, str],
        output_file_path: Path
    ) -> str:
        """Update image paths in markdown content to point to relative ./{filename}-images/ paths.

        Args:
            markdown_content: Original markdown content with image references
            images_mapping: Mapping of temp paths to permanent paths
            output_file_path: Full path to output file

        Returns:
            str: Updated markdown content with corrected image paths
        """
        if not images_mapping:
            # Remove image markers if no images were saved
            return DocumentImageUtil._remove_image_markers(markdown_content)

        # Get the images directory name
        images_dir_path = DocumentImageUtil.get_images_directory_path(output_file_path)
        images_dir_name = images_dir_path.name

        # Get sorted list of saved images (by filename to maintain order)
        saved_images = sorted(images_mapping.values(), key=lambda path: Path(path).name)

        # Find all image references in Markdown format ![alt](path)
        image_pattern = r'!\[([^\]]*)\]\(([^)]+)\)'
        image_matches = list(re.finditer(image_pattern, markdown_content))

        # Replace images by matching order: first markdown image -> first saved image, etc.
        updated_content = markdown_content
        replacement_offset = 0

        for i, match in enumerate(image_matches):
            if i < len(saved_images):
                saved_path = saved_images[i]
                saved_file = Path(saved_path)

                # Use the actual saved filename as alt text for consistency
                alt_text = saved_file.name

                # Use relative path ./{filename}-images/filename
                relative_path = f"./{images_dir_name}/{saved_file.name}"
                new_image_ref = f'![{alt_text}]({relative_path})'

                # Calculate actual position considering previous replacements
                start = match.start() + replacement_offset
                end = match.end() + replacement_offset

                # Replace the image reference
                updated_content = updated_content[:start] + new_image_ref + updated_content[end:]

                # Update offset for next replacement
                replacement_offset += len(new_image_ref) - (match.end() - match.start())

                logger.debug(f"Replaced image {i+1}: {match.group(0)} -> {new_image_ref}")

        if updated_content != markdown_content:
            logger.info(f"Updated {len(image_matches)} image references to point to ./{images_dir_name}/ directory")

        return updated_content

    @staticmethod
    def _remove_image_markers(markdown_content: str) -> str:
        """Remove image markers from markdown content.

        Args:
            markdown_content: Markdown content with image markers

        Returns:
            str: Markdown content with image markers removed
        """
        # Remove standard markdown images ![alt](path)
        content = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', '', markdown_content)

        # Clean up extra whitespace
        content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)

        return content.strip()
