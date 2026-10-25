"""过渡配置的版本保护保存；远端 CAS 是写入保护，读回只用于确认结果。"""

import asyncio
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import aiohttp
from agentlang.logger import get_logger

from app.infrastructure.magic_service.client import MagicServiceClient
from app.infrastructure.magic_service.exceptions import ApiError
from app.service.file_service import FileService
from app.utils.async_file_utils import (
    async_read_text,
    get_file_id_from_xattr,
    get_metadata_version_from_xattr,
)

logger = get_logger(__name__)
CONFIRM_TIMEOUT_SECONDS = 10.0
CONFIRM_POLL_SECONDS = 0.25


class TransitionStorageError(ValueError):
    def __init__(self, message: str, outcome: str = "not_saved", *, diagnostics: dict | None = None):
        super().__init__(message)
        self.outcome = outcome
        self.diagnostics = diagnostics or {}


@dataclass(frozen=True)
class ProjectSnapshot:
    file_id: str
    revision: int
    content: str
    parent_id: str = ""


@dataclass(frozen=True)
class SaveReceipt:
    """保存响应与确认分开记录；未收到可用响应不代表服务端没有提交。"""

    response_state: Literal["received", "unavailable"]
    revision: int | None = None
    error_type: str | None = None


async def read_project_snapshot(client: MagicServiceClient, path: Path) -> ProjectSnapshot:
    file_id = await get_file_id_from_xattr(path)
    if not file_id:
        raise TransitionStorageError("The project file is not synchronized yet. Wait and reread it before trying again.")
    before = await client.get_file_metadata(file_id)
    revision = before.get("version")
    if type(revision) is not int or revision < 0 or str(before.get("id")) != file_id:
        raise TransitionStorageError("The file service did not return a matching file identity and metadata revision.")
    if before.get("is_directory") or before.get("name") != "magic.project.js":
        raise TransitionStorageError("The file identity no longer points to the project configuration.")
    mounted_revision = await get_metadata_version_from_xattr(path)
    remote_content = await _read_remote_content(path)
    content = await async_read_text(path)
    mounted_after = await get_metadata_version_from_xattr(path)
    identity_after = await get_file_id_from_xattr(path)
    after = await client.get_file_metadata(file_id)
    if (
        mounted_revision != str(revision) or mounted_after != str(revision)
        or identity_after != file_id or before != after or content != remote_content
    ):
        raise TransitionStorageError(
            "The project changed or its mounted copy is not synchronized. Reread it before saving.",
            "conflict",
            diagnostics={
                "remote_revision": revision,
                "mounted_revision": mounted_revision,
                "mounted_after": mounted_after,
                "identity_matches": identity_after == file_id,
                "metadata_matches": before == after,
                "content_matches": content == remote_content,
                "local_size": len(content.encode("utf-8")),
                "remote_size": len(remote_content.encode("utf-8")),
            },
        )
    return ProjectSnapshot(file_id, revision, content, str(before.get("parent_id") or ""))


async def _read_remote_content(path: Path) -> str:
    # 统一按 xattr 中的真实 S3 key 取 URL，禁止根据路径猜对象 key。
    url = await FileService().get_workspace_file_url(path, expires_in=60)
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as session:
        async with session.get(url, headers={"Cache-Control": "no-cache"}) as response:
            response.raise_for_status()
            chunks = []
            size = 0
            async for chunk in response.content.iter_chunked(65536):
                size += len(chunk)
                if size > 2 * 1024 * 1024:
                    raise TransitionStorageError("The project configuration exceeds the supported size.")
                chunks.append(chunk)
            return b"".join(chunks).decode("utf-8")


async def save_project_snapshot(
    client: MagicServiceClient, path: Path, snapshot: ProjectSnapshot, content: str
) -> ProjectSnapshot:
    current = await read_project_snapshot(client, path)
    if current != snapshot:
        raise TransitionStorageError("The project changed before saving. Reread it and resolve the requested scope again.", "conflict")
    if content == snapshot.content:
        return snapshot
    try:
        result = await client.save_file_content(snapshot.file_id, content, snapshot.revision)
    except ApiError as exc:
        if str((exc.response_data or {}).get("code")) == "51152":
            raise TransitionStorageError("Version conflict: reread the deck and resolve the requested scope again.", "conflict") from exc
        if exc.status_code in {401, 403}:
            raise TransitionStorageError("User authorization or edit permission was rejected. No changes were saved.", "permission") from exc
        # 服务端响应异常也可能发生在写入之后。只确认，不重复提交。
        return await _confirm_save(client, path, snapshot, content, SaveReceipt("received", error_type=type(exc).__name__))
    except (aiohttp.ClientError, TimeoutError, ValueError) as exc:
        return await _confirm_save(client, path, snapshot, content, SaveReceipt("unavailable", error_type=type(exc).__name__))
    errors = result.get("error_files", [])
    for error in errors:
        if str(error.get("file_id")) == snapshot.file_id:
            if str(error.get("error_code")) == "51152":
                raise TransitionStorageError("Version conflict: the project was updated. Reread it; do not retry the old payload.", "conflict")
            raise TransitionStorageError("The save was rejected or failed. Reread the project before deciding how to proceed.", "unknown")
    revision = next((item["data"]["revision"] for item in result.get("success_files", [])
                     if str(item.get("file_id")) == snapshot.file_id
                     and isinstance(item.get("data"), dict)
                     and type(item["data"].get("revision")) is int), None)
    return await _confirm_save(client, path, snapshot, content, SaveReceipt("received", revision))


async def _confirm_save(
    client: MagicServiceClient, path: Path, snapshot: ProjectSnapshot, content: str, receipt: SaveReceipt
) -> ProjectSnapshot:
    # 保存只提交一次。AGFS 元数据、对象正文及 FUSE 缓存分别同步，
    # 不能把短暂读回不一致当成未保存，也不能靠再次写入来确认。
    loop = asyncio.get_running_loop()
    started = loop.time()
    deadline = started + CONFIRM_TIMEOUT_SECONDS
    attempts = 0
    differences = {}
    last_error = {}
    while (remaining := deadline - loop.time()) > 0:
        attempts += 1
        try:
            current = await asyncio.wait_for(read_project_snapshot(client, path), timeout=remaining)
        except ApiError as exc:
            last_error = {"error_type": type(exc).__name__, "status_code": exc.status_code}
            if exc.status_code in {401, 403}:
                break
        except (ValueError, aiohttp.ClientError, OSError, TimeoutError) as exc:
            last_error = {"error_type": type(exc).__name__}
            if isinstance(exc, TransitionStorageError) and exc.diagnostics:
                differences = exc.diagnostics
        else:
            if current.file_id != snapshot.file_id:
                _log_confirmation("conflict", path, snapshot, content, receipt, attempts, loop.time() - started,
                                  {**differences, "identity_matches": False}, last_error)
                raise TransitionStorageError("The project file was replaced after the save. Reread the deck; do not resubmit this payload.", "conflict")
            if current.revision > snapshot.revision and current.content == content:
                _log_confirmation("confirmed", path, snapshot, content, receipt, attempts, loop.time() - started,
                                  differences, last_error, current.revision)
                return current
            if current.revision > snapshot.revision and current.content != snapshot.content:
                _log_confirmation("conflict", path, snapshot, content, receipt, attempts, loop.time() - started,
                                  {**differences, "remote_revision": current.revision, "content_matches": False}, last_error)
                raise TransitionStorageError("The project contains another edit after the save. Reread it and resolve the requested scope again.", "conflict")
            differences = {"remote_revision": current.revision, "content_matches": current.content == content}
        remaining = deadline - loop.time()
        if remaining > 0:
            await asyncio.sleep(min(CONFIRM_POLL_SECONDS, remaining))
    _log_confirmation("unknown", path, snapshot, content, receipt, attempts, loop.time() - started, differences, last_error)
    raise TransitionStorageError(
        "Save outcome is unknown: the new content and metadata revision could not be confirmed in the mounted project. "
        "The save may already have committed. Reread the project; do not retry this payload or report success.", "unknown"
    )


def _log_confirmation(
    outcome: Literal["confirmed", "conflict", "unknown"], path: Path, snapshot: ProjectSnapshot, content: str, receipt: SaveReceipt,
    attempts: int, elapsed: float, differences: dict, last_error: dict, confirmed_revision: int | None = None,
) -> None:
    # 仅记录身份、版本及大小；正文、对象 URL 和授权信息不得进入诊断日志。
    event = {
        "event": {"confirmed": "SLIDE_TRANSITION_SAVE_CONFIRMED", "conflict": "SLIDE_TRANSITION_SAVE_CONFLICT", "unknown": "NETWORK_FILE_NOT_READY"}[outcome],
        "outcome": outcome, "workspace_type": ".workspace", "file_path": str(path),
        "parent_id": snapshot.parent_id, "file_name": path.name, "operation": "direct_overwrite",
        "file_id": snapshot.file_id, "baseline_revision": snapshot.revision,
        "local_size": len(content.encode("utf-8")),
        "remote_size": len(content.encode("utf-8")) if outcome == "confirmed" else differences.get("remote_size"),
        "retry_count": max(0, attempts - 1), "elapsed_seconds": round(elapsed, 3),
        "response_state": receipt.response_state, "acknowledged_revision": receipt.revision,
        "submission_error_type": receipt.error_type, "confirmed_revision": confirmed_revision,
        "last_sync_difference": differences, "last_read_error": last_error,
    }
    log = logger.info if outcome == "confirmed" else logger.warning
    log("{}", json.dumps(event, ensure_ascii=False))
