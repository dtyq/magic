"""
Crew Agent file downloader.

Downloads crew agent definition files from remote API and extracts them
to the local agents/crew/{agent_code}/ directory.
"""

import io
import zipfile
from pathlib import Path
from typing import Optional

import aiohttp

from agentlang.logger import get_logger
from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
from app.infrastructure.sdk.magic_service.parameter.get_agent_openapi_parameter import GetAgentOpenApiParameter

logger = get_logger(__name__)


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
            raise ValueError(f"Agent '{agent_code}' API response missing file_url")

        logger.info(f"Downloading crew package for '{agent_code}' from: {file_url}")

        await self._download_and_extract_zip(file_url, target_dir)

        identity_file = target_dir / "IDENTITY.md"
        if not identity_file.exists():
            raise ValueError(
                f"Downloaded crew package for '{agent_code}' is missing IDENTITY.md"
            )

        logger.info(f"Crew package extracted to: {target_dir}")

    async def _download_and_extract_zip(self, url: str, target_dir: Path) -> None:
        """Download a zip file from URL and extract to target directory.

        Strips the top-level directory inside the zip (if all entries share one)
        so files land directly in target_dir.
        """
        target_dir.mkdir(parents=True, exist_ok=True)

        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=60)) as resp:
                if resp.status != 200:
                    raise Exception(
                        f"Failed to download crew package: HTTP {resp.status}"
                    )
                data = await resp.read()

        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            names = zf.namelist()
            # Strip common top-level directory prefix (e.g. "SMA-xxx/") if all
            # entries share the same root folder, so files land directly in target_dir.
            top_level = {n.split("/")[0] for n in names if n.strip()}
            prefix = (top_level.pop() + "/") if len(top_level) == 1 else ""

            for member in zf.infolist():
                rel_path = member.filename[len(prefix):] if prefix and member.filename.startswith(prefix) else member.filename
                if not rel_path:  # top-level directory entry itself
                    continue
                dest = target_dir / rel_path
                if member.filename.endswith("/"):
                    dest.mkdir(parents=True, exist_ok=True)
                else:
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    dest.write_bytes(zf.read(member.filename))

        logger.info(f"Extracted {len(names)} files to {target_dir}")
