"""AgentHorizon 的 JSON 持久化。

文件命名规则与 ChatHistory 一致：
  .topic/chat_history/{agent_name}<{agent_id}>.horizon.json

正常保存和 fork 写入共用同一套 codec：

    HorizonState -> _encode_state -> JSON 文件
    JSON 文件   -> migrations -> _decode_state -> HorizonState

fork 只在写入目标时替换 `agent_id`，其余 Horizon 状态整体复制，包括已读文件、已加载
Skill、通知、模型配置、workspace 快照和 context usage baseline。这样子 Agent 的第一轮
上下文与“重新启动同一会话”使用同一份状态，而不是只复制其中几个字段。
"""
from __future__ import annotations

import asyncio
from dataclasses import asdict, fields
from pathlib import Path
from typing import Optional

from agentlang.logger import get_logger
from app.core.entity.user_context import UserContextSnapshot
from app.core.horizon.profile_context import AgentIdentityState
from app.core.horizon.migration import CURRENT_VERSION, apply_migrations
from app.core.horizon.models import (
    BrowserPageObservation,
    FileContextRecord,
    HorizonState,
    ImageModelState,
    ManualContextWindowState,
    MemoryDirectorySnapshot,
    PendingNotification,
    PendingResumption,
    ResumptionStatus,
    ResumptionTrigger,
    SuperMagicProductContextState,
    VideoModelState,
)
from app.utils.async_file_utils import (
    async_exists,
    async_read_json,
    async_write_json,
)

logger = get_logger(__name__)


def _record_to_dict(r: FileContextRecord) -> dict:
    return {
        "path": r.path,
        "file_hash": r.file_hash,
        "file_mtime_ms": r.file_mtime_ms,
        "file_size_bytes": r.file_size_bytes,
        "file_content": r.file_content,
        "tool_name": r.tool_name,
        "truncated": r.truncated,
        "metadata": r.metadata,
        "read_at": r.read_at,
        "read_ranges": r.read_ranges,
    }


def _record_from_dict(d: dict) -> FileContextRecord:
    return FileContextRecord(
        path=d["path"],
        file_hash=d.get("file_hash", ""),
        file_mtime_ms=float(d.get("file_mtime_ms", 0.0)),
        file_size_bytes=int(d.get("file_size_bytes", 0)),
        file_content=d.get("file_content", ""),
        tool_name=d.get("tool_name", ""),
        truncated=bool(d.get("truncated", False)),
        metadata=d.get("metadata", {}),
        read_at=d.get("read_at", ""),
        read_ranges=[tuple(r) for r in d.get("read_ranges", [])],
    )


def _notif_to_dict(n: PendingNotification) -> dict:
    return {"pushed_at": n.pushed_at, "source": n.source, "content": n.content}


def _notif_from_dict(d: dict) -> PendingNotification:
    return PendingNotification(
        pushed_at=d["pushed_at"],
        source=d["source"],
        content=d["content"],
    )


def _resumption_to_dict(resumption: PendingResumption) -> dict[str, str]:
    # 持久化字段必须与 PendingResumption 保持一一对应；状态命名变更不能只改内存模型。
    return {
        "id": resumption.id,
        "source": resumption.source,
        "content": resumption.content,
        "created_at": resumption.created_at,
        "trigger": resumption.trigger.value,
        "status": resumption.status.value,
        "assigned_at": resumption.assigned_at,
        "assigned_to_run_id": resumption.assigned_to_run_id,
        "last_error": resumption.last_error,
    }


def _resumption_from_dict(data: dict) -> PendingResumption:
    # 从 JSON 恢复时保留 assigned 的时间和 run 归属，供重启后的过期分配清理使用。
    try:
        trigger = ResumptionTrigger(str(data.get("trigger") or ResumptionTrigger.RUNTIME_READY))
    except ValueError:
        trigger = ResumptionTrigger.RUNTIME_READY
    try:
        status = ResumptionStatus(str(data.get("status") or ResumptionStatus.PENDING))
    except ValueError:
        status = ResumptionStatus.PENDING
    return PendingResumption(
        id=str(data.get("id") or ""),
        source=str(data.get("source") or ""),
        content=str(data.get("content") or ""),
        created_at=str(data.get("created_at") or ""),
        trigger=trigger,
        status=status,
        assigned_at=str(data.get("assigned_at") or ""),
        assigned_to_run_id=str(data.get("assigned_to_run_id") or ""),
        last_error=str(data.get("last_error") or ""),
    )


def _browser_page_to_dict(page: BrowserPageObservation) -> dict[str, str]:
    return {
        "page_id": page.page_id,
        "url": page.url,
        "title": page.title,
        "observed_at": page.observed_at,
    }


def _browser_page_from_dict(data: dict) -> BrowserPageObservation:
    return BrowserPageObservation(
        page_id=str(data.get("page_id") or ""),
        url=str(data.get("url") or ""),
        title=str(data.get("title") or ""),
        observed_at=str(data.get("observed_at") or ""),
    )


def _manual_context_window_to_dict(state: ManualContextWindowState) -> dict:
    return {
        "user_manual_max_context_tokens": state.user_manual_max_context_tokens,
    }


def _manual_context_window_from_dict(data: object) -> ManualContextWindowState:
    if not isinstance(data, dict):
        return ManualContextWindowState()
    return ManualContextWindowState(
        user_manual_max_context_tokens=int(data.get("user_manual_max_context_tokens") or 0),
    )


def _manual_context_windows_to_dict(
    states: dict[str, ManualContextWindowState],
) -> dict[str, dict]:
    return {
        model_key: _manual_context_window_to_dict(state)
        for model_key, state in states.items()
        if model_key and state.user_manual_max_context_tokens > 0
    }


def _manual_context_windows_from_dict(data: object) -> dict[str, ManualContextWindowState]:
    if not isinstance(data, dict):
        return {}
    result: dict[str, ManualContextWindowState] = {}
    for raw_model_key, raw_state in data.items():
        model_key = str(raw_model_key or "").strip()
        if not model_key:
            continue
        state = _manual_context_window_from_dict(raw_state)
        if state.user_manual_max_context_tokens > 0:
            result[model_key] = state
    return result


def _memory_directory_from_dict(data: object) -> MemoryDirectorySnapshot | None:
    """
    恢复有限深度快照；旧成员摘要没有完整条目，下一次扫描重新建立。

    恢复真实条目后，进程重启或完整 fork 才能识别同数量的文件替换。
    只有分组名称或计数无法重建这些路径，所以不猜旧状态，交给下一次真实扫描。
    """
    if not isinstance(data, dict) or "entries" not in data or "scan_depth" not in data:
        return None
    return MemoryDirectorySnapshot(
        root=data["root"],
        scan_depth=data["scan_depth"],
        entries=data["entries"],
        exists=bool(data.get("exists", True)),
    )


def _assert_codec_covers_horizon_state(codec_name: str, field_names: set[str]) -> None:
    """新增持久化字段时，强制维护者同时更新 Horizon codec。

    维护方式是故意简单的：`HorizonState` 增加字段后，编码器或解码器没有同步登记，
    运行时直接报出缺失字段，而不是悄悄生成“看起来成功、实际丢数据”的 fork 文件。
    """
    state_field_names = {state_field.name for state_field in fields(HorizonState)}
    if field_names == state_field_names:
        return
    missing = sorted(state_field_names - field_names)
    unknown = sorted(field_names - state_field_names)
    raise RuntimeError(
        f"Horizon {codec_name} field coverage mismatch: missing={missing}, unknown={unknown}"
    )


def _encode_state(state: HorizonState) -> dict:
    """按既有 schema 编码 HorizonState，正常保存和 fork 共用本入口。

    这里是 Horizon 持久化字段的集中登记处。新增需要随 Agent 重启延续的状态时，必须
    在这里加入字段，并让 `_decode_state` 同步恢复；覆盖检查会阻止只改一边的情况。
    """
    data = {
        "version": CURRENT_VERSION,
        "agent_id": state.agent_id,
        "user_context": state.user_context.model_dump(mode="json") if state.user_context else None,
        "user_context_baseline": state.user_context_baseline.model_dump(mode="json") if state.user_context_baseline else None,
        "user_context_auto_fetch_attempted": state.user_context_auto_fetch_attempted,
        "agent_identity": state.agent_identity.model_dump(mode="json") if state.agent_identity else None,
        "loaded_skills": state.loaded_skills,
        "suggested_skill_names": state.suggested_skill_names,
        "pending_notifications": [_notif_to_dict(n) for n in state.pending_notifications],
        "pending_resumptions": [_resumption_to_dict(r) for r in state.pending_resumptions],
        "browser_pages": {
            page_id: _browser_page_to_dict(page)
            for page_id, page in state.browser_pages.items()
        },
        "file_records": {k: _record_to_dict(v) for k, v in state.file_records.items()},
        "image_model": {"model_id": state.image_model.model_id, "sizes": state.image_model.sizes},
        "video_model": {"model_id": state.video_model.model_id, "config": state.video_model.config},
        "manual_context_windows": _manual_context_windows_to_dict(state.manual_context_windows),
        "llm_model_id": state.llm_model_id,
        "llm_model_name": state.llm_model_name,
        "process_started_at_ns": state.process_started_at_ns,
        "super_magic_product_context": (
            state.super_magic_product_context.to_dict()
            if state.super_magic_product_context
            else None
        ),
        "user_preferred_language": state.user_preferred_language,
        "workspace_files": state.workspace_files,
        # 目录快照跟其它 Horizon 字段一起保存；显示折叠从不写回这个结构。
        "memory_directory": asdict(state.memory_directory) if state.memory_directory is not None else None,
        "client_context": state.client_context,
        "cli_status": state.cli_status,
        "context_usage_baseline_used": state.context_usage_baseline_used,
        "context_usage_baseline_total": state.context_usage_baseline_total,
        "context_usage_baseline_used_pct": state.context_usage_baseline_used_pct,
        "initial_context_injected": state.initial_context_injected,
        "last_injected_date": state.last_injected_date,
    }
    _assert_codec_covers_horizon_state("encoder", set(data) - {"version"})
    return data


def _decode_state(data: dict) -> HorizonState:
    """按改造前的明确字段规则恢复 HorizonState。

    先做版本迁移，再按字段恢复；缺失字段使用当前默认值，嵌套结构由各自的解析函数
    处理。这个入口同时服务普通 Agent 重启和 persisted fork，二者不会各自维护一套
    恢复逻辑。
    """
    decoded_fields = {
        "user_context",
        "user_context_baseline",
        "user_context_auto_fetch_attempted",
        "agent_identity",
        "agent_id",
        "file_records",
        "pending_notifications",
        "pending_resumptions",
        "browser_pages",
        "loaded_skills",
        "suggested_skill_names",
        "image_model",
        "video_model",
        "manual_context_windows",
        "llm_model_id",
        "llm_model_name",
        "process_started_at_ns",
        "super_magic_product_context",
        "user_preferred_language",
        "workspace_files",
        "memory_directory",
        "client_context",
        "cli_status",
        "context_usage_baseline_used",
        "context_usage_baseline_total",
        "context_usage_baseline_used_pct",
        "initial_context_injected",
        "last_injected_date",
    }
    _assert_codec_covers_horizon_state("decoder", decoded_fields)

    state = HorizonState(agent_id=data.get("agent_id", ""))
    if data.get("user_context") is not None:
        state.user_context = UserContextSnapshot.model_validate(data["user_context"])
    if data.get("user_context_baseline") is not None:
        state.user_context_baseline = UserContextSnapshot.model_validate(data["user_context_baseline"])
    state.user_context_auto_fetch_attempted = bool(data.get("user_context_auto_fetch_attempted", False))
    if data.get("agent_identity") is not None:
        state.agent_identity = AgentIdentityState.model_validate(data["agent_identity"])
    state.loaded_skills = data.get("loaded_skills", [])
    state.suggested_skill_names = data.get("suggested_skill_names", [])
    state.pending_notifications = [
        _notif_from_dict(notification)
        for notification in data.get("pending_notifications", [])
    ]
    state.pending_resumptions = [
        _resumption_from_dict(resumption)
        for resumption in data.get("pending_resumptions", [])
        if isinstance(resumption, dict)
    ]
    state.browser_pages = {
        page_id: _browser_page_from_dict(page)
        for page_id, page in data.get("browser_pages", {}).items()
        if isinstance(page_id, str) and isinstance(page, dict)
    }
    state.file_records = {
        key: _record_from_dict(record)
        for key, record in data.get("file_records", {}).items()
    }
    image_model = data.get("image_model", {})
    state.image_model = ImageModelState(
        model_id=image_model.get("model_id", ""),
        sizes=image_model.get("sizes", []),
    )
    video_model = data.get("video_model", {})
    state.video_model = VideoModelState(
        model_id=video_model.get("model_id", ""),
        config=video_model.get("config", {}),
    )
    state.manual_context_windows = _manual_context_windows_from_dict(
        data.get("manual_context_windows")
    )
    state.llm_model_id = data.get("llm_model_id", "")
    state.llm_model_name = data.get("llm_model_name", "")
    state.process_started_at_ns = int(data.get("process_started_at_ns", 0) or 0)
    state.super_magic_product_context = SuperMagicProductContextState.from_dict(
        data.get("super_magic_product_context")
    )
    state.user_preferred_language = data.get("user_preferred_language", "")
    state.workspace_files = data.get("workspace_files", "")
    state.memory_directory = _memory_directory_from_dict(data.get("memory_directory"))
    state.client_context = data.get("client_context", "")
    state.cli_status = data.get("cli_status", "")
    state.context_usage_baseline_used = int(data.get("context_usage_baseline_used", 0))
    state.context_usage_baseline_total = int(data.get("context_usage_baseline_total", 0))
    state.context_usage_baseline_used_pct = int(data.get("context_usage_baseline_used_pct", 0))
    state.initial_context_injected = bool(data.get("initial_context_injected", False))
    state.last_injected_date = data.get("last_injected_date", "")
    return state


class HorizonStore:
    """Horizon JSON 持久化，与 ChatHistory 同目录。

    Horizon 与 ChatHistory 是同一个 Agent 会话的两个持久化组件，不能单独把某一份当成
    完整上下文。`AgentContextSnapshotService` 会同时准备并提交它们；本类只负责 Horizon
    自己的编码、解码和文件写入。
    """

    def __init__(self, chat_history_dir: str, agent_name: str, agent_id: str) -> None:
        self.agent_name = agent_name
        self.agent_id = agent_id
        self._path = self.path_for_session(agent_name, agent_id, Path(chat_history_dir))
        self._save_lock = asyncio.Lock()

    @staticmethod
    def path_for_session(agent_name: str, agent_id: str, chat_history_dir: Path) -> Path:
        return chat_history_dir / f"{agent_name}<{agent_id}>.horizon.json"

    @property
    def path(self) -> Path:
        return self._path

    async def load(self) -> Optional[HorizonState]:
        if not await async_exists(self._path):
            return None
        try:
            return await self._load_path(self._path)
        except Exception as e:
            logger.warning(f"[HorizonStore] 加载失败，使用空状态: {e}")
            return None

    async def save(self, state: HorizonState) -> None:
        try:
            async with self._save_lock:
                await self._write_path(self._path, state)
        except Exception as e:
            logger.warning(f"[HorizonStore] 保存失败: {e}")

    @classmethod
    async def load_for_session(
        cls,
        agent_name: str,
        agent_id: str,
        chat_history_dir: Path,
    ) -> HorizonState:
        """读取指定会话的持久化 Horizon；损坏数据向调用方抛出。"""
        normalized_dir = Path(chat_history_dir).expanduser().resolve(strict=False)
        path = cls.path_for_session(agent_name, agent_id, normalized_dir)
        if not await async_exists(path):
            return HorizonState(agent_id=agent_id)
        return await cls._load_path(path)

    @classmethod
    async def write_fork_state(
        cls,
        state: HorizonState,
        *,
        target_agent_id: str,
        horizon_path: Path,
    ) -> None:
        """按 Horizon 自己的 fork 语义生成目标状态并写入指定临时路径。

        哪些状态可以继承、哪些外部动作必须清理由 `HorizonState.copy_for_fork()` 统一
        决定；Store 只负责把已经准备好的目标状态写入文件。
        """
        normalized_horizon_path = Path(horizon_path).expanduser().resolve(strict=False)
        target_state = state.copy_for_fork(target_agent_id)
        await cls._write_path(normalized_horizon_path, target_state)

    @staticmethod
    async def _load_path(path: Path) -> HorizonState:
        data = await async_read_json(path)
        if not isinstance(data, dict):
            raise ValueError(f"Horizon 文件格式无效: {path}")
        return _decode_state(apply_migrations(data))

    @staticmethod
    async def _write_path(path: Path, state: HorizonState) -> None:
        await async_write_json(
            path,
            _encode_state(state),
            ensure_ascii=False,
            indent=2,
        )
