"""按限定范围查询当前、压缩历史和 subagent 聊天记录。"""

from __future__ import annotations

import asyncio
import re
import unicodedata
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

from agentlang.chat_history.chat_history import ChatHistory
from agentlang.chat_history.chat_history_models import (
    AssistantMessage,
    SystemMessage,
    ToolMessage,
    UserMessage,
)
from app.magic.compact_user_input_references import is_real_user_input
from app.path_manager import PathManager
from app.service.chat_history_query_models import (
    ChatHistoryFile,
    HistoryMessage,
    HistoryType,
    MessageType,
    TimeRange,
    format_history_time,
    parse_time_range,
)
from app.service.chat_history_query_rg import ChatHistoryRipgrep
from app.tools.subagent_runtime_models import SubagentSessionState, SubagentStatus
from app.tools.subagent_runtime_store import SubagentRuntimeStore
from app.utils.async_file_utils import async_exists, async_read_json, async_scandir, async_stat

_COMPACTED_NAME = re.compile(r"^(?P<agent_name>[^<>/]+)<(?P<agent_id>[^<>/]+)>_(?P<timestamp>\d{14})\.json$")
_SUBAGENT_DIR_NAME = re.compile(r"^(?P<agent_name>[^<>/]+)<(?P<agent_id>[^<>/]+)>$")
_HISTORY_FILE_NAME = re.compile(r"^[^<>/]+<[^<>/]+>\.json$")
_MAX_HISTORY_FILES = 5_000
_MAX_SEARCH_FILE_BYTES = 20 * 1024 * 1024
_MAX_MESSAGE_CACHE_FILES = 8
_MESSAGE_CACHE: OrderedDict[tuple[str, float, int], tuple[HistoryMessage, ...]] = OrderedDict()


class ChatHistoryQueryService:
    """只查询治理后的三类历史文件，并把筛选成本留在本地。"""

    def __init__(
        self,
        agent_name: str,
        agent_id: str,
        *,
        chat_history: ChatHistory | None = None,
        interruption_event: asyncio.Event | None = None,
    ) -> None:
        self._root = PathManager.get_chat_history_dir()
        self._agent_name = agent_name
        self._agent_id = agent_id
        self._chat_history = chat_history
        self._interruption_event = interruption_event

    @property
    def root(self) -> Path:
        return self._root

    async def list_files(
        self,
        history_types: Sequence[HistoryType] | None = None,
        history_files: Sequence[str] | None = None,
        time_range: TimeRange | None = None,
    ) -> list[ChatHistoryFile]:
        if history_files:
            files = [await self._resolve_history_file(item) for item in history_files]
        else:
            selected_types = tuple(history_types or HistoryType)
            files = await self._scan_files(selected_types)

        if time_range is not None:
            files = [
                item for item in files
                if time_range.contains(datetime.fromtimestamp(item.modified_at, timezone.utc))
            ]
        return sorted(files, key=lambda item: (-item.modified_at, item.history_file))[:_MAX_HISTORY_FILES]

    async def describe_files(
        self,
        history_types: Sequence[HistoryType] | None = None,
        time_range: TimeRange | None = None,
        statuses: Sequence[SubagentStatus] | None = None,
        parent_agent_ids: Sequence[str] | None = None,
        pattern: str | None = None,
        limit: int = 20,
    ) -> dict[str, object]:
        effective_types = history_types
        if (pattern or statuses or parent_agent_ids) and effective_types is None:
            effective_types = [HistoryType.SUBAGENT]
        files = await self.list_files(history_types=effective_types, time_range=time_range)
        metadata: dict[str, SubagentSessionState] = {}
        subagent_files = [item for item in files if item.history_type == HistoryType.SUBAGENT]
        if statuses or parent_agent_ids:
            for item in subagent_files:
                metadata[item.history_file] = await self._load_subagent_state(item)
            files = [
                item for item in files
                if item.history_type != HistoryType.SUBAGENT
                or self._matches_subagent_filters(metadata[item.history_file], statuses, parent_agent_ids)
            ]

        if pattern:
            if any(item.history_type != HistoryType.SUBAGENT for item in files):
                raise ValueError("list_chat_history pattern can only search subagent metadata")
            session_paths = [
                session_path
                for item in files
                if await async_exists(session_path := self._session_path(item))
            ]
            matched_paths = await self._rg_matching_paths(session_paths, pattern)
            candidate_files = [item for item in files if self._session_path(item) in matched_paths]
            candidate_states = [await self._load_subagent_state(item) for item in candidate_files]
            metadata_texts = [
                "\n".join(
                    value
                    for value in (
                        state.agent_name,
                        state.agent_id,
                        state.display_name or "",
                        state.task_label or "",
                        state.last_result or "",
                        state.last_error or "",
                    )
                    if value
                )
                for state in candidate_states
            ]
            metadata_matches = await ChatHistoryRipgrep(self._interruption_event).matching_text_indexes(
                metadata_texts,
                pattern,
                len(metadata_texts) or 1,
            )
            files = [item for index, item in enumerate(candidate_files) if index in metadata_matches]
            metadata.update({
                item.history_file: state
                for item, state in zip(candidate_files, candidate_states)
            })

        total = len(files)
        counts = {
            history_type.value: sum(1 for item in files if item.history_type == history_type)
            for history_type in HistoryType
        }
        returned_files = files[: max(limit, 0)]
        descriptions: list[dict[str, object]] = []
        for item in returned_files:
            description: dict[str, object] = {
                "history_file": item.history_file,
                "history_type": item.history_type.value,
                "size_bytes": item.size_bytes,
                "modified_at": item.modified_at,
            }
            if item.history_type == HistoryType.SUBAGENT:
                state = metadata.get(item.history_file)
                if state is None:
                    state = await self._load_subagent_state(item)
                description.update({
                    "agent_name": state.agent_name,
                    "agent_id": state.agent_id,
                    "display_name": state.display_name,
                    "task_label": state.task_label,
                    "status": state.status.value,
                    "parent_agent_name": state.parent_agent_name,
                    "parent_agent_id": state.parent_agent_id,
                    "created_at": state.created_at.timestamp(),
                    "started_at": state.started_at.timestamp() if state.started_at else None,
                    "finished_at": state.finished_at.timestamp() if state.finished_at else None,
                    "result_preview": _preview(state.last_result or state.last_error or ""),
                })
            descriptions.append(description)

        return {
            "history_root": str(self._root.resolve()),
            "total": total,
            "returned": len(descriptions),
            "truncated": total > len(descriptions),
            "counts": counts,
            "files": descriptions,
        }

    async def search(
        self,
        *,
        history_types: Sequence[HistoryType] | None,
        history_files: Sequence[str] | None,
        pattern: str | None,
        message_types: Sequence[MessageType] | None,
        time_range: TimeRange | None,
        limit: int,
    ) -> dict[str, object]:
        if bool(history_types) == bool(history_files):
            raise ValueError("Provide exactly one of history_types or history_files")
        if not pattern and not message_types and time_range is None:
            raise ValueError("pattern is optional only when message_types or time_range is provided")

        files = await self.list_files(
            history_types=history_types,
            history_files=history_files,
            time_range=None,
        )
        selected_files = files
        skipped_files = 0
        if pattern:
            disk_files = [item for item in files if not self._is_current_memory_file(item)]
            matched_paths = await self._rg_matching_paths([item.path for item in disk_files], pattern)
            selected_files = [
                item for item in files
                if self._is_current_memory_file(item) or item.path in matched_paths
            ]

        records: list[HistoryMessage] = []
        read_files = 0
        read_bytes = 0
        for item in selected_files:
            if item.size_bytes > _MAX_SEARCH_FILE_BYTES and not self._is_current_memory_file(item):
                skipped_files += 1
                continue
            messages = await self._load_messages(item)
            read_files += 1
            read_bytes += item.size_bytes
            records.extend(
                message for message in messages
                if self._matches_message(message, message_types, time_range)
            )

        if pattern:
            matched_indexes = await self._rg_matching_message_indexes(records, pattern, limit)
            records = [record for index, record in enumerate(records) if index in matched_indexes]

        records = self._deduplicate_compacted_messages(records)

        records.sort(key=lambda item: (item.timestamp or datetime.min.replace(tzinfo=timezone.utc)), reverse=True)
        limited_records = records[: max(limit, 0)]
        return {
            "history_root": str(self._root.resolve()),
            "history_range": time_range.describe() if time_range else "not limited",
            "candidate_files": len(files),
            "searched_files": read_files,
            "skipped_files": skipped_files,
            "read_bytes": read_bytes,
            "total_matches": len(records),
            "returned_matches": len(limited_records),
            "truncated": len(records) > len(limited_records),
            "matches": [self._message_data(item, include_content=False) for item in limited_records],
        }

    async def read_range(
        self,
        history_file: str,
        start: int,
        end: int,
        message_types: Sequence[MessageType] | None,
        time_range: TimeRange | None,
    ) -> dict[str, object]:
        if start < 0 or end < start or end - start > 50:
            raise ValueError("message range must be non-negative, ordered, and at most 50 messages")
        item = await self._resolve_history_file(history_file)
        messages = await self._load_messages(item)
        selected = [
            message for message in messages
            if start <= message.message_index < end
            and self._matches_message(message, message_types, time_range)
        ]
        return {
            "history_root": str(self._root.resolve()),
            "history_file": history_file,
            "start": start,
            "end": end,
            "messages": [self._message_data(message, include_content=True) for message in selected],
        }

    async def _scan_files(self, history_types: Sequence[HistoryType]) -> list[ChatHistoryFile]:
        files: list[ChatHistoryFile] = []
        selected = set(history_types)
        if HistoryType.CURRENT in selected:
            current_path = self._root / f"{self._agent_name}<{self._agent_id}>.json"
            if await async_exists(current_path):
                files.append(await self._build_file(current_path, HistoryType.CURRENT, self._agent_name, self._agent_id))
            elif self._chat_history is not None:
                files.append(ChatHistoryFile(
                    history_file=current_path.name,
                    path=current_path,
                    history_type=HistoryType.CURRENT,
                    agent_name=self._agent_name,
                    agent_id=self._agent_id,
                    modified_at=datetime.now(timezone.utc).timestamp(),
                    size_bytes=0,
                ))

        if HistoryType.COMPACTED in selected:
            compacted_dir = self._root / "compacted"
            if await async_exists(compacted_dir):
                for entry in await async_scandir(compacted_dir):
                    if not entry.is_file(follow_symlinks=False):
                        continue
                    match = _COMPACTED_NAME.fullmatch(entry.name)
                    if match is None:
                        continue
                    path = Path(entry.path)
                    files.append(await self._build_file(
                        path,
                        HistoryType.COMPACTED,
                        match.group("agent_name"),
                        match.group("agent_id"),
                    ))

        if HistoryType.SUBAGENT in selected:
            subagents_dir = self._root / "subagents"
            if await async_exists(subagents_dir):
                for entry in await async_scandir(subagents_dir):
                    if not entry.is_dir(follow_symlinks=False):
                        continue
                    match = _SUBAGENT_DIR_NAME.fullmatch(entry.name)
                    if match is None:
                        continue
                    path = Path(entry.path) / entry.name
                    path = path.with_suffix(".json")
                    if await async_exists(path):
                        files.append(await self._build_file(
                            path,
                            HistoryType.SUBAGENT,
                            match.group("agent_name"),
                            match.group("agent_id"),
                        ))
        return files

    async def _build_file(
        self,
        path: Path,
        history_type: HistoryType,
        agent_name: str,
        agent_id: str,
    ) -> ChatHistoryFile:
        stat = await async_stat(path)
        return ChatHistoryFile(
            history_file=str(path.relative_to(self._root)),
            path=path,
            history_type=history_type,
            agent_name=agent_name,
            agent_id=agent_id,
            modified_at=stat.st_mtime,
            size_bytes=stat.st_size,
        )

    async def _resolve_history_file(self, history_file: str) -> ChatHistoryFile:
        if not history_file or Path(history_file).is_absolute():
            raise ValueError("history_file must be a relative history file path")
        relative = Path(history_file)
        if any(part in {"", ".", ".."} for part in relative.parts):
            raise ValueError("history_file must not contain '.', '..', or empty path components")
        path = (self._root / relative).resolve()
        root = self._root.resolve()
        if root not in path.parents or path == root or path.suffix != ".json":
            raise ValueError("history_file must point to a JSON history file")
        parts = relative.parts
        if len(parts) == 1 and _HISTORY_FILE_NAME.fullmatch(parts[0]):
            agent_name, agent_id = parts[0][:-5].rsplit("<", 1)
            agent_id = agent_id[:-1]
            if not await async_exists(path):
                if self._chat_history is not None and agent_name == self._agent_name and agent_id == self._agent_id:
                    return ChatHistoryFile(
                        history_file=history_file,
                        path=path,
                        history_type=HistoryType.CURRENT,
                        agent_name=agent_name,
                        agent_id=agent_id,
                        modified_at=datetime.now(timezone.utc).timestamp(),
                        size_bytes=0,
                    )
                raise FileNotFoundError(f"History file does not exist: {history_file}")
            return await self._build_file(path, HistoryType.CURRENT, agent_name, agent_id)
        if not await async_exists(path):
            raise FileNotFoundError(f"History file does not exist: {history_file}")
        if len(parts) == 2 and parts[0] == "compacted":
            match = _COMPACTED_NAME.fullmatch(parts[1])
            if match is not None:
                return await self._build_file(
                    path,
                    HistoryType.COMPACTED,
                    match.group("agent_name"),
                    match.group("agent_id"),
                )
        if len(parts) == 3 and parts[0] == "subagents" and parts[1] == parts[2][:-5]:
            match = _SUBAGENT_DIR_NAME.fullmatch(parts[1])
            if match is not None:
                return await self._build_file(
                    path,
                    HistoryType.SUBAGENT,
                    match.group("agent_name"),
                    match.group("agent_id"),
                )
        raise ValueError(f"History file is outside the governed history layout: {history_file}")

    async def _load_messages(self, item: ChatHistoryFile) -> list[HistoryMessage]:
        if self._is_current_memory_file(item) and self._chat_history is not None:
            return [
                record
                for index, message in enumerate(self._chat_history.messages)
                if (record := self._message_from_object(item.history_file, index, message)) is not None
            ]

        cache_key = (str(item.path), item.modified_at, item.size_bytes)
        cached = _MESSAGE_CACHE.get(cache_key)
        if cached is not None:
            _MESSAGE_CACHE.move_to_end(cache_key)
            return list(cached)

        data = await async_read_json(item.path)
        if not isinstance(data, list):
            return []
        records = [
            record
            for index, message in enumerate(data)
            if (record := self._message_from_object(item.history_file, index, message)) is not None
        ]
        _MESSAGE_CACHE[cache_key] = tuple(records)
        _MESSAGE_CACHE.move_to_end(cache_key)
        while len(_MESSAGE_CACHE) > _MAX_MESSAGE_CACHE_FILES:
            _MESSAGE_CACHE.popitem(last=False)
        return records

    def _message_from_object(self, history_file: str, index: int, message: object) -> HistoryMessage | None:
        if isinstance(message, dict):
            role = message.get("role")
            content = message.get("content", "")
            timestamp_value = message.get("timestamp")
            normalized_message: object = message
        elif isinstance(message, (SystemMessage, UserMessage, AssistantMessage, ToolMessage)):
            role = message.role
            content = message.content
            timestamp_value = message.created_at
            normalized_message = message
        else:
            return None

        if not isinstance(role, str) or not isinstance(content, str):
            return None
        message_type = self._message_type(normalized_message, role)
        if message_type is None:
            return None
        return HistoryMessage(
            history_file=history_file,
            message_index=index,
            message_type=message_type,
            role=role,
            content=content,
            timestamp=self._parse_message_timestamp(timestamp_value),
        )

    @staticmethod
    def _message_type(message: object, role: str) -> MessageType | None:
        if role == "user":
            return MessageType.USER_INPUT if is_real_user_input(message) else MessageType.USER
        try:
            return MessageType(role)
        except ValueError:
            return None

    @staticmethod
    def _parse_message_timestamp(value: object) -> datetime | None:
        if not isinstance(value, str) or not value.strip():
            return None
        try:
            parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
        return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=timezone.utc)

    @staticmethod
    def _message_data(message: HistoryMessage, *, include_content: bool) -> dict[str, object]:
        data: dict[str, object] = {
            "history_file": message.history_file,
            "message_index": message.message_index,
            "message_type": message.message_type.value,
            "role": message.role,
            "timestamp": message.timestamp.timestamp() if message.timestamp else None,
            "excerpt": _preview(message.content),
        }
        if include_content:
            data["content"] = message.content
        return data

    @staticmethod
    def _matches_message(
        message: HistoryMessage,
        message_types: Sequence[MessageType] | None,
        time_range: TimeRange | None,
    ) -> bool:
        if message_types:
            allowed = set(message_types)
            if message.message_type == MessageType.USER_INPUT:
                if MessageType.USER_INPUT not in allowed and MessageType.USER not in allowed:
                    return False
            elif message.message_type not in allowed:
                return False
        return time_range is None or time_range.contains(message.timestamp)

    @staticmethod
    def _matches_subagent_filters(
        state: SubagentSessionState,
        statuses: Sequence[SubagentStatus] | None,
        parent_agent_ids: Sequence[str] | None,
    ) -> bool:
        if statuses and state.status not in statuses:
            return False
        if parent_agent_ids and state.parent_agent_id not in parent_agent_ids:
            return False
        return True

    async def _load_subagent_state(self, item: ChatHistoryFile) -> SubagentSessionState:
        return await SubagentRuntimeStore.load_state(item.agent_name, item.agent_id, self._root)

    @staticmethod
    def _session_path(item: ChatHistoryFile) -> Path:
        return item.path.parent / f"{item.agent_name}<{item.agent_id}>.session.json"

    def _is_current_memory_file(self, item: ChatHistoryFile) -> bool:
        return (
            item.history_type == HistoryType.CURRENT
            and self._chat_history is not None
            and item.agent_name == self._agent_name
            and item.agent_id == self._agent_id
        )

    async def _rg_matching_paths(self, paths: Sequence[Path], pattern: str) -> set[Path]:
        return await ChatHistoryRipgrep(self._interruption_event).matching_paths(paths, pattern)

    async def _rg_matching_message_indexes(
        self,
        messages: Sequence[HistoryMessage],
        pattern: str,
        limit: int,
    ) -> set[int]:
        return await ChatHistoryRipgrep(self._interruption_event).matching_message_indexes(messages, pattern, limit)

    @staticmethod
    def _deduplicate_compacted_messages(messages: Sequence[HistoryMessage]) -> list[HistoryMessage]:
        seen: set[tuple[object, str, str]] = set()
        result: list[HistoryMessage] = []
        for message in messages:
            if not message.history_file.startswith("compacted/"):
                result.append(message)
                continue
            normalized = " ".join(unicodedata.normalize("NFKC", message.content).split()).casefold()
            key = (message.timestamp, message.role, normalized)
            if key in seen:
                continue
            seen.add(key)
            result.append(message)
        return result

def _preview(value: str, max_chars: int = 240) -> str | None:
    normalized = " ".join(value.strip().split())
    if not normalized:
        return None
    return normalized if len(normalized) <= max_chars else normalized[: max_chars - 3] + "..."


__all__ = [
    "ChatHistoryFile",
    "ChatHistoryQueryService",
    "HistoryMessage",
    "HistoryType",
    "MessageType",
    "TimeRange",
    "format_history_time",
    "parse_time_range",
]
