"""Markdown content processing utilities."""

import re
from pathlib import Path

from agentlang.logger import get_logger

logger = get_logger(__name__)


class MarkdownUtil:
    """Utility class for markdown content processing operations."""

    @staticmethod
    def adjust_heading_levels(markdown_content: str) -> str:
        """Adjust markdown heading levels to make room for filename as main title.

        Only adjusts if there are level-1 headings (#). If the highest level
        is already level-2 (##) or lower, no adjustment is needed.

        Converts when level-1 headings exist:
        # → ##
        ## → ###
        ### → ####
        etc.

        Args:
            markdown_content: Original markdown content

        Returns:
            str: Markdown content with adjusted heading levels if needed
        """
        lines = markdown_content.split('\n')

        # First check if there are any level-1 headings (#)
        has_level_1_heading = any(re.match(r'^#\s', line) for line in lines)

        # If no level-1 headings, no adjustment needed
        if not has_level_1_heading:
            return markdown_content

        # Adjust all heading levels
        adjusted_lines = []
        for line in lines:
            # Match heading lines that start with one or more #
            if re.match(r'^#+\s', line):
                # Add one more # to decrease the heading level
                adjusted_line = '#' + line
                adjusted_lines.append(adjusted_line)
            else:
                adjusted_lines.append(line)

        return '\n'.join(adjusted_lines)

    @staticmethod
    def remove_image_markers(markdown_content: str) -> str:
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

    @staticmethod
    def add_filename_title(markdown_content: str, filename: str) -> str:
        """Add filename as main title and adjust content heading levels.

        Args:
            markdown_content: Original markdown content
            filename: Filename to use as title

        Returns:
            str: Markdown content with filename title and adjusted headings
        """
        adjusted_content = MarkdownUtil.adjust_heading_levels(markdown_content)
        return f"# {filename}\n\n{adjusted_content}"

    @staticmethod
    async def write_to_file(markdown_content: str, output_file_path: Path) -> None:
        """Write markdown content to the specified output file path.

        Args:
            markdown_content: The markdown content to write
            output_file_path: Full path where the .md file will be created

        Raises:
            Exception: If writing fails
        """
        import aiofiles

        try:
            async with aiofiles.open(output_file_path, 'w', encoding='utf-8') as f:
                await f.write(markdown_content)

            logger.info(f"Successfully wrote markdown content to: {output_file_path}")

        except Exception as e:
            logger.error(f"Failed to write markdown file {output_file_path}: {e}")
            raise

    @staticmethod
    async def normalize_image_formatting(file_path: Path) -> None:
        """Normalize image formatting in markdown file by ensuring proper line breaks around images.

        Processes all ![...](...) image references and ensures they have line breaks before and after
        to prevent rendering issues.

        Args:
            file_path: Path to the markdown file to normalize
        """
        import aiofiles

        try:
            # Check if file exists
            if not file_path.exists():
                logger.debug(f"File does not exist for image formatting: {file_path}")
                return

            # Read current content
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                content = await f.read()

            if not content.strip():
                logger.debug("Empty file, skipping image formatting")
                return

            # Find all image references in Markdown format: ![alt](path)
            image_pattern = r'!\[([^\]]*)\]\(([^)]+)\)'

            # Use a replacement strategy that ensures proper newlines
            def replace_image_with_newlines(match):
                """Replace image reference with proper newlines if needed"""
                image_ref = match.group(0)
                start_pos = match.start()
                end_pos = match.end()

                # Check context around the image
                char_before = content[start_pos - 1] if start_pos > 0 else '\n'
                char_after = content[end_pos] if end_pos < len(content) else '\n'

                # Build replacement with necessary newlines
                replacement = image_ref

                if char_before not in ['\n', '\r']:
                    replacement = '\n' + replacement

                if char_after not in ['\n', '\r']:
                    replacement = replacement + '\n'

                return replacement

            # Apply replacements
            updated_content = re.sub(image_pattern, replace_image_with_newlines, content)

            # Count how many images were processed
            images_found = len(re.findall(image_pattern, content))

            if images_found > 0:
                logger.debug(f"Found {images_found} image references to normalize")

                # Write back to file if content changed
                if updated_content != content:
                    async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
                        await f.write(updated_content)
                    logger.info(f"Normalized image formatting in: {file_path}")
                else:
                    logger.debug("No image formatting changes needed")
            else:
                logger.debug("No image references found for formatting")

        except Exception as e:
            logger.warning(f"Failed to normalize image formatting: {e}")
            # Don't raise the exception to avoid failing the entire parsing process
