"""把追加问题的查询结果写到 `.runtime/follow_up_suggestions/`。

| 已有状态 | 再写入生成中 | 再写入完成或失败 |
| 没有文件 | 新建         | 新建             |
| 生成中   | 覆盖         | 覆盖为终态       |
| 完成/失败 | 保留原文件  | 保留原文件       |

终态不能被后到的上报改回去。调试客户端按 task_id 读这份文件，产品前端仍查 magic-service。
"""

import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from app.path_manager import PathManager
from app.utils.async_file_utils import async_chmod, async_exists, async_try_read_json, async_write_json

# 与 FollowUpSuggestionService 上报 magic-service 的状态一致：0 生成中，1 完成，2 失败。
STATUS_GENERATING = 0
STATUS_DONE = 1
STATUS_FAILED = 2
from app.utils.runtime_storage import (
    RuntimeEvictionPolicy,
    ensure_runtime_directory,
    evict_runtime_files,
    get_runtime_config_int,
    trigger_opportunistic_cleanup,
)

_TASK_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
_DIRECTORY_NAME = "follow_up_suggestions"
_CLEANUP_KEY = "follow_up_suggestions"


@dataclass(frozen=True)
class FollowUpSuggestionRecord:
    """一次任务当前可查询的追加问题。"""

    task_id: str
    status: int
    suggestions: List[str]


class FollowUpSuggestionStore:
    """一个 task_id 对应一个 JSON 文件。"""

    def __init__(self, directory: Optional[Path] = None) -> None:
        self._directory = directory or (PathManager.get_runtime_dir() / _DIRECTORY_NAME)

    async def load(self, task_id: str) -> Optional[FollowUpSuggestionRecord]:
        """文件不存在或内容不完整时返回 None，调用方按生成中继续等待。"""
        path = self._path_for(task_id)
        if path is None or not await async_exists(path):
            return None
        payload = await async_try_read_json(path)
        return _record_from_payload(task_id, payload)

    async def save(self, task_id: str, status: int, suggestions: Optional[List[str]]) -> Optional[FollowUpSuggestionRecord]:
        """写入当前状态。已是终态时不再覆盖。"""
        path = self._path_for(task_id)
        if path is None or status not in (STATUS_GENERATING, STATUS_DONE, STATUS_FAILED):
            return None
        existing = await self.load(task_id)
        if existing is not None and existing.status in (STATUS_DONE, STATUS_FAILED):
            return existing

        record = FollowUpSuggestionRecord(
            task_id=task_id,
            status=status,
            suggestions=_clean_suggestions(suggestions),
        )
        await ensure_runtime_directory(self._directory)
        await async_write_json(
            path,
            {
                "task_id": record.task_id,
                "status": record.status,
                "suggestions": record.suggestions,
            },
            ensure_ascii=False,
        )
        await async_chmod(path, 0o600)
        trigger_opportunistic_cleanup(_CLEANUP_KEY, lambda: self._cleanup(path))
        return record

    async def query(self, task_id: str) -> Optional[dict]:
        """给调试客户端的查询结果。没有文件时返回生成中，方便按前端节奏重试。"""
        if self._path_for(task_id) is None:
            return None
        record = await self.load(task_id)
        if record is None:
            return {"status": STATUS_GENERATING, "suggestions": []}
        return {"status": record.status, "suggestions": list(record.suggestions)}

    def _path_for(self, task_id: str) -> Optional[Path]:
        if not isinstance(task_id, str) or _TASK_ID_PATTERN.fullmatch(task_id) is None:
            return None
        return self._directory / f"{task_id}.json"

    async def _cleanup(self, protected_path: Path) -> None:
        await evict_runtime_files(
            self._directory,
            policy=_load_eviction_policy(),
            suffixes=(".json",),
            protected_paths=frozenset({protected_path}),
        )


def _record_from_payload(task_id: str, payload: Optional[dict]) -> Optional[FollowUpSuggestionRecord]:
    if not isinstance(payload, dict):
        return None
    status = payload.get("status")
    if status not in (STATUS_GENERATING, STATUS_DONE, STATUS_FAILED):
        return None
    return FollowUpSuggestionRecord(
        task_id=task_id,
        status=status,
        suggestions=_clean_suggestions(payload.get("suggestions")),
    )


def _clean_suggestions(suggestions: Optional[List[str]]) -> List[str]:
    if not isinstance(suggestions, list):
        return []
    return [item for item in suggestions if isinstance(item, str)]


def _load_eviction_policy() -> RuntimeEvictionPolicy:
    return RuntimeEvictionPolicy(
        max_entries=get_runtime_config_int(
            "runtime_cleanup.follow_up_suggestions.max_file_count",
            minimum=1,
        ),
        target_entries=get_runtime_config_int(
            "runtime_cleanup.follow_up_suggestions.target_file_count",
            minimum=0,
        ),
        max_age_seconds=get_runtime_config_int(
            "runtime_cleanup.follow_up_suggestions.max_age_days",
            minimum=1,
        )
        * 24
        * 60
        * 60,
    )
