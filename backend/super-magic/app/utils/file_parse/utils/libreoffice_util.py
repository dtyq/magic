"""LibreOffice document conversion utilities."""

import asyncio
import hashlib
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import List

from agentlang.logger import get_logger

logger = get_logger(__name__)


class LibreOfficeUtil:
    """Utility class for LibreOffice document conversion operations."""

    @staticmethod
    async def check_libreoffice_available() -> bool:
        """Check if LibreOffice is available on the system.

        Returns:
            bool: True if LibreOffice is available, False otherwise
        """
        try:
            # Try different common LibreOffice command names
            libreoffice_commands = ['libreoffice', 'soffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice']

            for cmd in libreoffice_commands:
                try:
                    result = subprocess.run(
                        [cmd, '--version'],
                        capture_output=True,
                        text=True,
                        timeout=10
                    )
                    if result.returncode == 0:
                        logger.debug(f"Found LibreOffice: {cmd}, version: {result.stdout.strip()}")
                        return True
                except (FileNotFoundError, subprocess.TimeoutExpired):
                    continue

            logger.warning("LibreOffice not found in common locations")
            return False

        except Exception as e:
            logger.warning(f"Error checking LibreOffice availability: {e}")
            return False

    @staticmethod
    async def convert_document(
        input_file: Path,
        target_format: str,
        output_filename_prefix: str = "converted"
    ) -> Path:
        """Convert document using LibreOffice.

        Args:
            input_file: Path to the input file
            target_format: Target format (e.g., 'docx', 'pptx')
            output_filename_prefix: Prefix for the output filename

        Returns:
            Path: Path to the converted file

        Raises:
            RuntimeError: If LibreOffice is not available or conversion fails
        """
        logger.info(f"Converting {input_file.suffix} to {target_format}: {input_file}")

        # Check if LibreOffice is available
        if not await LibreOfficeUtil.check_libreoffice_available():
            raise RuntimeError(
                f"LibreOffice is not available. Please install LibreOffice to support {input_file.suffix} files.\n"
                "Installation: https://www.libreoffice.org/download/"
            )

        # Create temporary directory for conversion
        loop = asyncio.get_event_loop()

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_dir_path = Path(temp_dir)

            # Create a unique subdirectory using MD5 hash of the original filename
            # This ensures each file conversion has its own isolated directory,
            # making the fallback glob logic reliable (only one file in the directory)
            filename_hash = hashlib.md5(input_file.name.encode('utf-8')).hexdigest()[:8]
            conversion_dir = temp_dir_path / filename_hash
            conversion_dir.mkdir(parents=True, exist_ok=True)

            # Use a safe random ASCII filename to avoid encoding issues with Chinese characters
            # in some Linux/Docker environments where LibreOffice may fail to handle
            # non-ASCII filenames properly
            safe_filename = f"{filename_hash}{input_file.suffix}"
            temp_input_path = conversion_dir / safe_filename
            await loop.run_in_executor(None, shutil.copy2, input_file, temp_input_path)

            # Convert using LibreOffice headless mode
            await LibreOfficeUtil._run_libreoffice_conversion(
                temp_input_path, conversion_dir, target_format
            )

            # Find the converted file using the safe filename stem
            safe_stem = Path(safe_filename).stem  # e.g. "a1b2c3d4"
            converted_file_path = conversion_dir / f"{safe_stem}.{target_format}"

            # Check file existence asynchronously
            file_exists = await loop.run_in_executor(None, converted_file_path.exists)
            if not file_exists:
                # Fallback: try to find any file with the target format in the conversion directory
                # This is reliable because the directory contains only one file
                converted_files = list(conversion_dir.glob(f"*.{target_format}"))
                if converted_files:
                    converted_file_path = converted_files[0]
                    logger.info(f"Found converted file via glob: {converted_file_path}")
                else:
                    raise RuntimeError(f"LibreOffice conversion failed: output file not found at {converted_file_path}")

            # Copy converted file to a persistent temporary location
            # (TemporaryDirectory will be deleted when exiting the with block)
            final_temp_file = tempfile.NamedTemporaryFile(
                suffix=f'.{target_format}',
                delete=False,
                prefix=f"{output_filename_prefix}_{filename_hash}_"
            )
            final_temp_path = Path(final_temp_file.name)
            final_temp_file.close()

            # Copy file asynchronously
            await loop.run_in_executor(None, shutil.copy2, converted_file_path, final_temp_path)

            logger.info(f"Successfully converted {input_file.suffix} to {target_format}: {final_temp_path}")
            return final_temp_path

    @staticmethod
    async def _run_libreoffice_conversion(input_file: Path, output_dir: Path, target_format: str) -> None:
        """Run LibreOffice conversion command.

        Args:
            input_file: Path to the input file
            output_dir: Directory to save the converted file
            target_format: Target format (e.g., 'docx', 'pptx')

        Raises:
            RuntimeError: If conversion fails
        """
        try:
            # Try different LibreOffice command names
            libreoffice_commands = ['libreoffice', 'soffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice']

            conversion_successful = False

            for cmd in libreoffice_commands:
                try:
                    # LibreOffice command to convert document
                    command = [
                        cmd,
                        '--headless',  # Run without GUI
                        '--convert-to', target_format,  # Convert to target format
                        '--outdir', str(output_dir),  # Output directory
                        str(input_file)  # Input file
                    ]

                    logger.debug(f"Running LibreOffice conversion: {' '.join(command)}")

                    result = subprocess.run(
                        command,
                        capture_output=True,
                        text=True,
                        timeout=30  # 30 second timeout
                    )

                    # Check for errors: LibreOffice may return 0 even when it fails to load the file
                    has_error = 'error' in result.stderr.lower() or 'error' in result.stdout.lower()

                    if result.returncode == 0 and not has_error:
                        logger.debug(f"LibreOffice conversion successful with {cmd}")
                        logger.debug(f"LibreOffice stdout: {result.stdout}")
                        conversion_successful = True
                        break
                    else:
                        logger.debug(f"LibreOffice command {cmd} failed with return code {result.returncode}")
                        logger.debug(f"LibreOffice stderr: {result.stderr}")

                except (FileNotFoundError, subprocess.TimeoutExpired) as e:
                    logger.debug(f"LibreOffice command {cmd} not available or timed out: {e}")
                    continue

            if not conversion_successful:
                raise RuntimeError(
                    f"LibreOffice conversion failed for {input_file}. "
                    "Please ensure LibreOffice is properly installed and accessible."
                )

        except Exception as e:
            logger.error(f"LibreOffice conversion error: {e}")
            raise RuntimeError(f"LibreOffice conversion failed: {e}")
