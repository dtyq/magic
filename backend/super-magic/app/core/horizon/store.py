"""AgentHorizon 的 JSON 持久化。

文件命名规则与 ChatHistory 一致：
  .chat_history/{agent_name}<{agent_id}>.horizon.json
"""
from __future__ import annotations

import json
import asyncio
from pathlib import Path
from typing import Optional

import aiofiles

from agentlang.logger import get_logger
from app.core.horizon.models import HorizonState, FileReadRecord, PendingNotification, ImageModelState, VideoModelState

logger = get_logger(__name__)


def _record_to_dict(r: FileReadRecord) -> dict:
    return {
        "path": r.path,
        "read_at": r.read_at,
        "read_ranges": r.read_ranges,
        "read_content": r.read_content,
        "read_content_hash": r.read_content_hash,
        "full_file_hash": r.full_file_hash,
        "file_mtime_ms": r.file_mtime_ms,
        "file_size_bytes": r.file_size_bytes,
        "truncated": r.truncated,
        "tool_name": r.tool_name,
        "metadata": r.metadata,
    }


def _record_from_dict(d: dict) -> FileReadRecord:
    return FileReadRecord(
        path=d["path"],
        read_at=d["read_at"],
        read_ranges=[tuple(r) for r in d.get("read_ranges", [])],
        read_content=d.get("read_content", ""),
        read_content_hash=d.get("read_content_hash", ""),
        full_file_hash=d.get("full_file_hash", ""),
        file_mtime_ms=float(d.get("file_mtime_ms", 0.0)),
        file_size_bytes=int(d.get("file_size_bytes", 0)),
        truncated=bool(d.get("truncated", False)),
        tool_name=d.get("tool_name", ""),
        metadata=d.get("metadata", {}),
    )


def _notif_to_dict(n: PendingNotification) -> dict:
    return {"pushed_at": n.pushed_at, "source": n.source, "content": n.content}


def _notif_from_dict(d: dict) -> PendingNotification:
    return PendingNotification(
        pushed_at=d["pushed_at"],
        source=d["source"],
        content=d["content"],
    )


class HorizonStore:
    """原子写入的 JSON 持久化，与 ChatHistory 同目录。"""

    def __init__(self, chat_history_dir: str, agent_name: str, agent_id: str) -> None:
        self._path = Path(chat_history_dir) / f"{agent_name}<{agent_id}>.horizon.json"
        self._path.parent.mkdir(parents=True, exist_ok=True)

    async def load(self) -> Optional[HorizonState]:
        if not self._path.exists():
            return None
        try:
            async with aiofiles.open(self._path, "r", encoding="utf-8") as f:
                raw = await f.read()
            data = json.loads(raw)
            state = HorizonState(agent_id=data.get("agent_id", ""))
            state.loaded_skills = data.get("loaded_skills", [])
            state.pending_notifications = [
                _notif_from_dict(n) for n in data.get("pending_notifications", [])
            ]
            state.file_records = {
                k: _record_from_dict(v)
                for k, v in data.get("file_records", {}).items()
            }
            img = data.get("image_model", {})
            state.image_model = ImageModelState(
                model_id=img.get("model_id", ""),
                sizes=img.get("sizes", []),
            )
            vid = data.get("video_model", {})
            state.video_model = VideoModelState(
                model_id=vid.get("model_id", ""),
                config=vid.get("config", {}),
            )
            state.user_preferred_language = data.get("user_preferred_language", "")
            state.workspace_files = data.get("workspace_files", "")
            state.workspace_entries = data.get("workspace_entries", [])
            state.memory = data.get("memory", "")
            return state
        except Exception as e:
            logger.warning(f"[HorizonStore] 加载失败，使用空状态: {e}")
            return None

    async def save(self, state: HorizonState) -> None:
        data = {
            "agent_id": state.agent_id,
            "loaded_skills": state.loaded_skills,
            "pending_notifications": [_notif_to_dict(n) for n in state.pending_notifications],
            "file_records": {k: _record_to_dict(v) for k, v in state.file_records.items()},
            "image_model": {"model_id": state.image_model.model_id, "sizes": state.image_model.sizes},
            "video_model": {"model_id": state.video_model.model_id, "config": state.video_model.config},
            "user_preferred_language": state.user_preferred_language,
            "workspace_files": state.workspace_files,
            "workspace_entries": state.workspace_entries,
            "memory": state.memory,
        }
        tmp = self._path.with_suffix(".tmp")
        try:
            async with aiofiles.open(tmp, "w", encoding="utf-8") as f:
                await f.write(json.dumps(data, ensure_ascii=False, indent=2))
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, tmp.replace, self._path)
        except Exception as e:
            logger.warning(f"[HorizonStore] 保存失败: {e}")
