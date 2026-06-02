"""LibreOffice document conversion utilities."""

import asyncio
import hashlib
import shutil
import subprocess
import tempfile
from pathlib import Path

from agentlang.logger import get_logger
from app.utils.async_file_utils import async_copy2, async_mkdir

logger = get_logger(__name__)


class LibreOfficeUtil:
    """Utility class for LibreOffice document conversion operations."""

    @staticmethod
    def _get_libreoffice_commands() -> list[str]:
        """Return LibreOffice executable candidates in a stable preference order."""
        command_names = ["libreoffice", "soffice"]
        resolved_commands = [
            resolved
            for name in command_names
            if (resolved := shutil.which(name))
        ]
        absolute_candidates = [
            "/opt/homebrew/bin/libreoffice",
            "/opt/homebrew/bin/soffice",
            "/usr/local/bin/libreoffice",
            "/usr/local/bin/soffice",
            "/usr/bin/libreoffice",
            "/usr/bin/soffice",
            "/Applications/LibreOffice.app/Contents/MacOS/soffice",
        ]

        commands: list[str] = []
        existing_absolute_candidates = [
            candidate
            for candidate in absolute_candidates
            if Path(candidate).exists()
        ]
        for candidate in [*resolved_commands, *existing_absolute_candidates]:
            if candidate not in commands:
                commands.append(candidate)
        return commands

    @staticmethod
    async def check_libreoffice_available() -> bool:
        """Check if LibreOffice is available on the system.

        Returns:
            bool: True if LibreOffice is available, False otherwise
        """
        try:
            for cmd in LibreOfficeUtil._get_libreoffice_commands():
                try:
                    result = subprocess.run(
                        [cmd, '--version'],
                        capture_output=True,
                        text=True,
                        timeout=3
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

        if not await LibreOfficeUtil.check_libreoffice_available():
            logger.warning(
                "LibreOffice availability check failed; attempting conversion anyway. "
                "The availability probe can be a false negative in restricted macOS contexts."
            )

        # Create temporary directory for conversion
        loop = asyncio.get_event_loop()

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_dir_path = Path(temp_dir)

            # Create a unique subdirectory using MD5 hash of the original filename
            # This ensures each file conversion has its own isolated directories.
            filename_hash = hashlib.md5(input_file.name.encode('utf-8')).hexdigest()[:8]
            conversion_root = temp_dir_path / filename_hash
            conversion_input_dir = conversion_root / "input"
            conversion_output_dir = conversion_root / "output"
            conversion_profile_dir = conversion_root / "profile"
            await async_mkdir(conversion_input_dir, parents=True, exist_ok=True)
            await async_mkdir(conversion_output_dir, parents=True, exist_ok=True)
            await async_mkdir(conversion_profile_dir, parents=True, exist_ok=True)

            # Use a safe random ASCII filename to avoid encoding issues with Chinese characters
            # in some Linux/Docker environments where LibreOffice may fail to handle
            # non-ASCII filenames properly
            safe_filename = f"{filename_hash}{input_file.suffix}"
            temp_input_path = conversion_input_dir / safe_filename
            await async_copy2(input_file, temp_input_path)

            # Convert using LibreOffice headless mode
            await LibreOfficeUtil._run_libreoffice_conversion(
                temp_input_path, conversion_output_dir, target_format, conversion_profile_dir
            )

            # Find the converted file using the safe filename stem
            safe_stem = Path(safe_filename).stem  # e.g. "a1b2c3d4"
            converted_file_path = conversion_output_dir / f"{safe_stem}.{target_format}"

            # Check file existence asynchronously
            file_exists = await loop.run_in_executor(None, converted_file_path.exists)
            if not file_exists:
                # Fallback: try to find any file with the target format in the conversion directory
                # This is reliable because the output directory contains only converted files.
                converted_files = list(conversion_output_dir.glob(f"*.{target_format}"))
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
            await async_copy2(converted_file_path, final_temp_path)

            logger.info(f"Successfully converted {input_file.suffix} to {target_format}: {final_temp_path}")
            return final_temp_path

    @staticmethod
    async def _run_libreoffice_conversion(
        input_file: Path,
        output_dir: Path,
        target_format: str,
        profile_dir: Path | None = None,
    ) -> None:
        """Run LibreOffice conversion command.

        Args:
            input_file: Path to the input file
            output_dir: Directory to save the converted file
            target_format: Target format (e.g., 'docx', 'pptx')
            profile_dir: Isolated LibreOffice user profile directory

        Raises:
            RuntimeError: If conversion fails
        """
        try:
            conversion_successful = False
            last_error = ""

            for cmd in LibreOfficeUtil._get_libreoffice_commands():
                try:
                    command = [
                        cmd,
                        '--headless',  # Run without GUI
                        '--nologo',
                        '--nodefault',
                        '--nolockcheck',
                        '--nofirststartwizard',
                        '--convert-to', target_format,  # Convert to target format
                        '--outdir', str(output_dir),  # Output directory
                        str(input_file)  # Input file
                    ]
                    if profile_dir is not None:
                        command.insert(2, f"-env:UserInstallation={profile_dir.resolve().as_uri()}")

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
                        last_error = (
                            f"command={cmd}, returncode={result.returncode}, "
                            f"stdout={result.stdout.strip()}, stderr={result.stderr.strip()}"
                        )
                        logger.debug(f"LibreOffice command {cmd} failed with return code {result.returncode}")
                        logger.debug(f"LibreOffice stdout: {result.stdout}")
                        logger.debug(f"LibreOffice stderr: {result.stderr}")

                except (FileNotFoundError, subprocess.TimeoutExpired) as e:
                    last_error = f"command={cmd}, error={e}"
                    logger.debug(f"LibreOffice command {cmd} not available or timed out: {e}")
                    continue

            if not conversion_successful:
                raise RuntimeError(
                    f"LibreOffice conversion failed for {input_file}. "
                    f"Please ensure LibreOffice is properly installed and accessible. Last error: {last_error}"
                )

        except Exception as e:
            logger.error(f"LibreOffice conversion error: {e}")
            raise RuntimeError(f"LibreOffice conversion failed: {e}")
