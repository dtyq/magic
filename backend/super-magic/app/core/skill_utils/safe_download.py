"""技能包下载：在解压前限制大小、数量和路径，并支持取消。"""

from __future__ import annotations

import asyncio
import io
import stat
import time
import uuid
import zipfile
from pathlib import PurePosixPath

import httpx

from urllib.parse import urljoin, urlsplit

from app.core.skill_utils.providers.base import FetchedSkill
from app.path_manager import PathManager
from app.utils.async_file_utils import (
    async_chmod,
    async_mkdir,
    async_rmtree,
    async_write_bytes,
    async_exists,
    async_iterdir,
    async_stat,
)

MAX_SIZE_BYTES = 50 * 1024 * 1024
MAX_FILES = 2000

# 下载 URL 只允许 http/https：预签名 URL 虽由服务端签发，但重定向目标不受控，逐跳校验 scheme 兜住 SSRF 面
_ALLOWED_URL_SCHEMES = {"http", "https"}
_MAX_REDIRECTS = 5
# httpx 的 timeout 是单次 IO 超时，慢速滴灌（每个 60s 窗口内发一小段）可无限拖长下载，这里兜总量
_TOTAL_DOWNLOAD_TIMEOUT_SECONDS = 300


def _validate_download_url(url: str) -> None:
    if urlsplit(url).scheme.lower() not in _ALLOWED_URL_SCHEMES:
        raise ValueError("Skill download URL scheme is not allowed.")


async def _stream_zip_bytes(client: httpx.AsyncClient, url: str) -> bytes:
    current = url
    for _ in range(_MAX_REDIRECTS + 1):
        _validate_download_url(current)
        async with client.stream("GET", current, follow_redirects=False) as response:
            if response.is_redirect:
                location = response.headers.get("location")
                if not location:
                    raise ValueError("Skill download redirect is missing a location.")
                current = urljoin(current, location)
                continue
            response.raise_for_status()
            data = bytearray()
            async for chunk in response.aiter_bytes(64 * 1024):
                if len(data) + len(chunk) > MAX_SIZE_BYTES:
                    raise ValueError("Skill download exceeds 50 MB.")
                data.extend(chunk)
            return bytes(data)
    raise ValueError("Skill download exceeded the redirect limit.")


def validate_package_name(name: str) -> None:
    if not name or name in {".", ".."} or "/" in name or "\\" in name or "\x00" in name:
        raise ValueError("Skill package name must be a single path segment.")


def unpack_skill_zip(data: bytes) -> list[tuple[PurePosixPath, bytes, bool]]:
    """只处理内存中的压缩包；工作线程不会在取消后继续写磁盘。"""
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        members = archive.infolist()
        if len(members) > MAX_FILES or sum(m.file_size for m in members) > MAX_SIZE_BYTES:
            raise ValueError("Skill archive exceeds the size or entry limit.")
        seen = set()
        for member in members:
            path = PurePosixPath(member.filename)
            mode = member.external_attr >> 16
            if (
                path.is_absolute()
                or ".." in path.parts
                or "\\" in member.filename
                or stat.S_ISLNK(mode)
                or (stat.S_IFMT(mode) not in {0, stat.S_IFREG, stat.S_IFDIR})
                or path in seen
            ):
                raise ValueError("Skill archive contains unsafe or duplicate paths.")
            seen.add(path)
        roots = sorted(
            (
                PurePosixPath(m.filename).parent
                for m in members
                if not m.is_dir()
                and PurePosixPath(m.filename).name == "SKILL.md"
                and "__MACOSX" not in PurePosixPath(m.filename).parts
            ),
            key=lambda p: (len(p.parts), str(p)),
        )
        if not roots:
            raise ValueError("Skill archive does not contain SKILL.md.")
        root = roots[0]
        files = []
        for member in members:
            path = PurePosixPath(member.filename)
            if member.is_dir() or not path.is_relative_to(root):
                continue
            files.append((path.relative_to(root), archive.read(member), bool((member.external_attr >> 16) & 0o111)))
        return files


async def download_skill_zip(url: str, name: str, version: str) -> FetchedSkill:
    validate_package_name(name)
    download_root = PathManager.get_project_root() / ".runtime" / "skill_downloads"
    # Finally handles normal failures/cancellation; reclaim leftovers from a killed process on reuse.
    if await async_exists(download_root):
        for directory in await async_iterdir(download_root):
            if directory.name.startswith("skill_") and time.time() - (await async_stat(directory)).st_mtime > 86400:
                await async_rmtree(directory)
    # HTTP transport is async: cancellation closes the response instead of leaving a download thread.
    async with asyncio.timeout(_TOTAL_DOWNLOAD_TIMEOUT_SECONDS):
        async with httpx.AsyncClient(timeout=60) as client:
            data = await _stream_zip_bytes(client, url)
    files = await asyncio.to_thread(unpack_skill_zip, data)
    temp = download_root / f"skill_{uuid.uuid4().hex}"
    destination = temp / name
    try:
        await async_mkdir(destination, parents=True, exist_ok=True)
        await async_chmod(temp.parent, 0o700)
        await async_chmod(temp, 0o700)
        for relative_path, content, executable in files:
            target = destination / relative_path
            await async_mkdir(target.parent, parents=True, exist_ok=True)
            await async_write_bytes(target, content)
            await async_chmod(target, 0o700 if executable else 0o600)
        return FetchedSkill(local_path=destination, version=version, source_url=url.split("?")[0], install_name=name)
    except BaseException:
        await async_rmtree(temp)
        raise
