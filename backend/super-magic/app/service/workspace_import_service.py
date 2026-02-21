"""Workspace import service.

Download a ZIP archive from URL and extract its content into workspace directory.
"""

import io
import shutil
import zipfile
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse

import aiohttp

from agentlang.logger import get_logger
from app.paths import PathManager

logger = get_logger(__name__)

_HTTP_TIMEOUT_SECONDS = 120
_MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024  # 500 MB


def _validate_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only http/https URLs are supported")
    if not parsed.netloc:
        raise ValueError("Invalid URL: missing host")


def _resolve_destination(workspace_dir: Path, rel_path: str) -> Path:
    normalized = rel_path.replace("\\", "/").lstrip("/")
    rel = PurePosixPath(normalized)
    if not rel.parts or any(part in {"", ".", ".."} for part in rel.parts):
        raise ValueError(f"Unsafe zip entry path: {rel_path}")

    dest = workspace_dir.joinpath(*rel.parts).resolve()
    workspace_root = workspace_dir.resolve()
    if dest != workspace_root and workspace_root not in dest.parents:
        raise ValueError(f"Path traversal detected in zip entry: {rel_path}")
    return dest


def _resolve_import_dir(workspace_dir: Path, target_dir: str) -> Path:
    normalized = (target_dir or "").replace("\\", "/").strip()
    if normalized in {"", "/"}:
        return workspace_dir

    normalized = normalized.strip("/")
    if not normalized:
        return workspace_dir

    rel = PurePosixPath(normalized)
    if not rel.parts or any(part in {"", ".", ".."} for part in rel.parts):
        raise ValueError("Invalid target_dir")

    destination = workspace_dir.joinpath(*rel.parts).resolve()
    workspace_root = workspace_dir.resolve()
    if destination != workspace_root and workspace_root not in destination.parents:
        raise ValueError("target_dir escapes workspace root")
    return destination


async def _download_zip_bytes(url: str) -> bytes:
    timeout = aiohttp.ClientTimeout(total=_HTTP_TIMEOUT_SECONDS)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(url) as resp:
            if resp.status != 200:
                raise ValueError(f"Failed to download archive: HTTP {resp.status}")

            content_length = resp.headers.get("Content-Length")
            if content_length and int(content_length) > _MAX_DOWNLOAD_BYTES:
                raise ValueError("Archive is too large")

            chunks = bytearray()
            async for chunk in resp.content.iter_chunked(1024 * 1024):
                chunks.extend(chunk)
                if len(chunks) > _MAX_DOWNLOAD_BYTES:
                    raise ValueError("Archive is too large")
            return bytes(chunks)


def _extract_zip_to_workspace(data: bytes, workspace_dir: Path) -> int:
    workspace_dir.mkdir(parents=True, exist_ok=True)
    extracted_files = 0

    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        names = [name for name in zf.namelist() if name.strip()]
        if not names:
            raise ValueError("Archive is empty")

        top_level = {name.split("/")[0] for name in names}
        prefix = f"{next(iter(top_level))}/" if len(top_level) == 1 else ""

        for member in zf.infolist():
            member_name = member.filename
            if not member_name or member_name.endswith("/"):
                continue

            rel_path = member_name
            if prefix and member_name.startswith(prefix):
                rel_path = member_name[len(prefix):]
            if not rel_path:
                continue

            destination = _resolve_destination(workspace_dir, rel_path)
            destination.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(member) as src, destination.open("wb") as dst:
                shutil.copyfileobj(src, dst)
            extracted_files += 1

    if extracted_files == 0:
        raise ValueError("Archive does not contain extractable files")
    return extracted_files


async def import_workspace_from_url(url: str, target_dir: str = "") -> dict:
    """Download ZIP from URL and extract files into workspace directory."""
    _validate_url(url)

    logger.info(f"Importing workspace from URL: {url}, target_dir={target_dir!r}")
    zip_data = await _download_zip_bytes(url)

    workspace_root = PathManager.get_workspace_dir()
    import_dir = _resolve_import_dir(workspace_root, target_dir)
    extracted_files = _extract_zip_to_workspace(zip_data, import_dir)

    logger.info(f"Workspace import completed: extracted_files={extracted_files}, dir={import_dir}")
    return {
        "workspace_dir": str(import_dir),
        "extracted_files": extracted_files,
    }
