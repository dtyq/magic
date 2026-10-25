"""
Crew Agent file downloader.

Downloads crew agent definition files from remote API and extracts them
to the local agents/crew/{agent_code}/ directory.
"""

import asyncio
import os
import tempfile
import zipfile
from pathlib import Path

import aiohttp

from agentlang.logger import get_logger
from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
from app.infrastructure.sdk.magic_service.parameter.get_agent_openapi_parameter import GetAgentOpenApiParameter
from app.tools.driver_log_utils import redact_url
from app.utils.async_file_utils import async_exists, async_mkdir, async_write_bytes

logger = get_logger(__name__)

DEFAULT_DOWNLOAD_TOTAL_TIMEOUT_SECONDS = 30 * 60
DEFAULT_DOWNLOAD_CONNECT_TIMEOUT_SECONDS = 30
DEFAULT_DOWNLOAD_READ_TIMEOUT_SECONDS = 120
DOWNLOAD_CHUNK_SIZE = 1024 * 1024


class CrewPackageInvalidError(RuntimeError):
    """Raised when a Crew package is incomplete or invalid."""


class CrewPackageFetchError(RuntimeError):
    """Raised when a Crew package cannot be retrieved."""


class CrewDownloader:
    """Downloads and extracts crew agent file packages from remote API."""

    async def download_and_extract(self, agent_code: str, target_dir: Path) -> None:
        """Download crew file package via get_agent_by_code and extract to target directory.

        Args:
            agent_code: The agent code identifier.
            target_dir: Target directory to extract files into (e.g. agents/crew/{agent_code}/).

        Raises:
            ValueError: If the API does not return a file_url.
            Exception: If download or extraction fails.
        """
        magic_api = get_magic_service_sdk()
        parameter = GetAgentOpenApiParameter(code=agent_code)
        result = await magic_api.agent.get_agent_by_code_latest_version(parameter)

        file_url = result.file_url
        if not file_url:
            raise CrewPackageInvalidError(f"Employee package metadata is incomplete: {agent_code}")

        logger.info(f"Downloading crew package for '{agent_code}' from: {redact_url(file_url)}")

        await self._download_and_extract_zip(file_url, target_dir)

        identity_file = target_dir / "IDENTITY.md"
        if not await async_exists(identity_file):
            raise CrewPackageInvalidError(f"Employee package is missing required configuration: {agent_code}")

        logger.info(f"Crew package extracted to: {target_dir}")

    async def _download_and_extract_zip(self, url: str, target_dir: Path) -> None:
        """Download a zip file from URL and extract to target directory.

        Strips the top-level directory inside the zip (if all entries share one)
        so files land directly in target_dir.
        """
        await async_mkdir(target_dir, parents=True, exist_ok=True)

        timeout = self._build_download_timeout()
        archive_path: Path | None = None
        downloaded_bytes = 0
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=timeout) as resp:
                    if resp.status != 200:
                        raise CrewPackageFetchError(f"Employee package download returned HTTP {resp.status}")

                    with tempfile.NamedTemporaryFile(
                        dir=target_dir,
                        prefix=".crew-package-",
                        suffix=".zip",
                        delete=False,
                    ) as temp_file:
                        archive_path = Path(temp_file.name)
                        async for chunk in resp.content.iter_chunked(DOWNLOAD_CHUNK_SIZE):
                            if chunk:
                                temp_file.write(chunk)
                                downloaded_bytes += len(chunk)
        except asyncio.CancelledError:
            self._remove_temp_archive(archive_path)
            raise
        except CrewPackageFetchError:
            self._remove_temp_archive(archive_path)
            raise
        except (aiohttp.ClientError, TimeoutError) as exc:
            self._remove_temp_archive(archive_path)
            logger.error(
                "Crew package download failed: url=%s downloaded_bytes=%s error=%s: %s",
                redact_url(url),
                downloaded_bytes,
                type(exc).__name__,
                exc,
            )
            raise CrewPackageFetchError(f"Employee package download failed after {downloaded_bytes} bytes") from exc

        try:
            if archive_path is None:
                raise CrewPackageFetchError("Employee package download produced no archive")

            with zipfile.ZipFile(archive_path) as zf:
                names = zf.namelist()
                # Strip common top-level directory prefix (e.g. "SMA-xxx/") if all
                # entries share the same root folder, so files land directly in target_dir.
                top_level = {n.split("/")[0] for n in names if n.strip()}
                prefix = (top_level.pop() + "/") if len(top_level) == 1 else ""

                for member in zf.infolist():
                    rel_path = (
                        member.filename[len(prefix) :]
                        if prefix and member.filename.startswith(prefix)
                        else member.filename
                    )
                    if not rel_path:  # top-level directory entry itself
                        continue
                    dest = target_dir / rel_path
                    if member.filename.endswith("/"):
                        await async_mkdir(dest, parents=True, exist_ok=True)
                    else:
                        await async_mkdir(dest.parent, parents=True, exist_ok=True)
                        await async_write_bytes(dest, zf.read(member.filename))
        except zipfile.BadZipFile as exc:
            raise CrewPackageInvalidError("Employee package archive is invalid") from exc
        finally:
            if archive_path is not None:
                self._remove_temp_archive(archive_path)

        logger.info(f"Extracted {len(names)} files from {downloaded_bytes} bytes to {target_dir}")

    @classmethod
    def _build_download_timeout(cls) -> aiohttp.ClientTimeout:
        return aiohttp.ClientTimeout(
            total=cls._get_timeout_seconds(
                "CREW_PACKAGE_DOWNLOAD_TOTAL_TIMEOUT_SECONDS",
                DEFAULT_DOWNLOAD_TOTAL_TIMEOUT_SECONDS,
            ),
            connect=cls._get_timeout_seconds(
                "CREW_PACKAGE_DOWNLOAD_CONNECT_TIMEOUT_SECONDS",
                DEFAULT_DOWNLOAD_CONNECT_TIMEOUT_SECONDS,
            ),
            sock_connect=cls._get_timeout_seconds(
                "CREW_PACKAGE_DOWNLOAD_CONNECT_TIMEOUT_SECONDS",
                DEFAULT_DOWNLOAD_CONNECT_TIMEOUT_SECONDS,
            ),
            sock_read=cls._get_timeout_seconds(
                "CREW_PACKAGE_DOWNLOAD_READ_TIMEOUT_SECONDS",
                DEFAULT_DOWNLOAD_READ_TIMEOUT_SECONDS,
            ),
        )

    @staticmethod
    def _get_timeout_seconds(name: str, default: float) -> float:
        try:
            return max(0.1, float(os.getenv(name, str(default))))
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _remove_temp_archive(archive_path: Path | None) -> None:
        if archive_path is None:
            return
        try:
            archive_path.unlink()
        except FileNotFoundError:
            pass
        except OSError as exc:
            logger.warning(
                "Failed to remove temporary Crew package archive: %s: %s",
                archive_path,
                exc,
            )
