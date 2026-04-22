"""AgentHorizon：per-agent 上下文工程基础设施。

替换全局单例 FileTimestampManager，并统一编排注入给 LLM 的动态上下文：
当前时间、文件变化 Diff、系统通知等，未来可扩展更多上下文类型。
"""
from __future__ import annotations

import asyncio
import difflib
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any, Optional, Set, Tuple, Union

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext
    from app.utils.file_utils import WorkspaceSnapshot

from agentlang.logger import get_logger
from app.core.horizon.diff_builder import detect_file_changes
from app.core.horizon.models import ContextUsage, FileReadRecord, HorizonState, ImageModelState, PendingNotification, VideoModelState
from app.core.horizon.store import HorizonStore
from app.utils.file_utils import calculate_file_hash, get_fresh_file_stat

logger = get_logger(__name__)

# 与原 FileTimestampManager 保持一致
HASH_DETECTION_THRESHOLD = 5 * 1024 * 1024   # 5 MB
NETWORK_FS_MTIME_BUFFER = 1.0                  # seconds
VALIDATION_ERROR_NOT_READ = "File must be read before editing. Please read the file first."
VALIDATION_ERROR_CHANGED = "File changed since last read. Please read the file again."
FILE_CONTENT_SNAPSHOT_MAX_BYTES = 64 * 1024   # 64 KB — 整文件快照上限

# context usage 注入灵敏度规则：
# - 当前占用 < 70%：变化不到 5 个百分点时，不再重复注入
# - 当前占用 >= 70% 且 < 80%：变化达到 3 个百分点就注入
# - 当前占用 >= 80%：变化达到 1 个百分点就注入
# 这里的“变化”指绝对百分点差值，不是相对变化率。
# 例如：40% -> 44% 的变化量是 4，81% -> 82% 的变化量是 1。
CONTEXT_USAGE_MEDIUM_USAGE_START_PCT = 70
CONTEXT_USAGE_HIGH_USAGE_START_PCT = 80
CONTEXT_USAGE_LOW_USAGE_DIFF_THRESHOLD_PCT = 5
CONTEXT_USAGE_MEDIUM_USAGE_DIFF_THRESHOLD_PCT = 3
CONTEXT_USAGE_HIGH_USAGE_DIFF_THRESHOLD_PCT = 1

def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _abs(path: Union[str, Path]) -> str:
    return str(Path(path).resolve())


async def _read_file_content_for_snapshot(abs_path: str) -> tuple[str, str, Optional[str]]:
    """读取整文件内容，按体积决定是否保存快照。

    返回 (file_content, snapshot_mode, snapshot_reason)。
    """
    from app.utils.async_file_utils import async_read_text, async_stat
    try:
        stat = await async_stat(abs_path)
        if stat.st_size > FILE_CONTENT_SNAPSHOT_MAX_BYTES:
            return "", "metadata_only", "file_too_large"
        content = await async_read_text(abs_path)
        return content, "full", None
    except Exception as e:
        logger.debug(f"[AgentHorizon] 读取文件快照失败 {abs_path}: {e}")
        return "", "metadata_only", "read_failed"


def _workspace_entries_to_path_set(entries: list) -> Set[str]:
    """从结构化条目列表提取路径集合，用于 diff 比对。"""
    return {e["path"] for e in entries if isinstance(e, dict) and "path" in e}


def _workspace_files_diff(old_entries: list, new_entries: list) -> str:
    """语义化工作区文件变化：报告新增/删除的文件和目录。

    added 条目带文件大小（size 存于 new_entries 中），removed 不带（文件已不存在）。
    """
    old_paths = _workspace_entries_to_path_set(old_entries)
    new_paths = _workspace_entries_to_path_set(new_entries)
    added_paths = new_paths - old_paths
    removed_paths = old_paths - new_paths
    if not added_paths and not removed_paths:
        return ""

    # 建立 path -> size 映射，用于展示新增文件的大小
    new_size_map: dict[str, Optional[int]] = {
        e["path"]: e.get("size") for e in new_entries if isinstance(e, dict)
    }

    def _fmt_size(size: Optional[int]) -> str:
        if not size:
            return ""
        if size < 1024:
            return f" ({size}B)"
        if size < 1024 * 1024:
            return f" ({size / 1024:.1f}KB)"
        return f" ({size / (1024 * 1024):.1f}MB)"

    parts = []
    if added_paths:
        if len(added_paths) <= 8:
            names = ", ".join(f"{p}{_fmt_size(new_size_map.get(p))}" for p in sorted(added_paths))
            parts.append(f"+{len(added_paths)} added: {names}")
        else:
            parts.append(f"+{len(added_paths)} files/dirs added")
    if removed_paths:
        if len(removed_paths) <= 8:
            names = ", ".join(sorted(removed_paths))
            parts.append(f"-{len(removed_paths)} removed: {names}")
        else:
            parts.append(f"-{len(removed_paths)} files/dirs removed")
    return "\n".join(parts)


def _string_diff(old: str, new: str) -> str:
    """通用字符串 diff（用于 memory 等文本），超过 30 行时退化为增删行数摘要。"""
    old_lines = old.splitlines(keepends=True)
    new_lines = new.splitlines(keepends=True)
    diff_lines = list(difflib.unified_diff(old_lines, new_lines, lineterm=""))
    if not diff_lines:
        return ""
    if len(diff_lines) < 30:
        return "\n".join(diff_lines)
    added = sum(1 for l in diff_lines if l.startswith("+") and not l.startswith("+++"))
    removed = sum(1 for l in diff_lines if l.startswith("-") and not l.startswith("---"))
    return f"[summary: +{added} lines / -{removed} lines]"


class AgentHorizon:
    """per-agent 上下文资产账本。

    线程安全：asyncio 单线程，无需额外锁。
    失败策略：所有写操作异常只打 warning，不向上抛。
    """

    def __init__(self, store: HorizonStore, agent_id: str, agent_context: Optional["AgentContext"] = None) -> None:
        self._store = store
        self._state = HorizonState(agent_id=agent_id)
        self._loaded = False
        self._agent_context = agent_context

        # 以下为纯内存状态，不持久化（session 级别）
        self._last_llm_model_id: str = ""
        self._last_llm_model_name: str = ""
        self._last_llm_model_description: str = ""
        self._llm_model_changed: bool = False
        self._image_model_changed: bool = False
        self._video_model_changed: bool = False
        self._context_used: int = 0    # 上一次 LLM 调用的 input_tokens
        self._context_total: int = 0   # 模型最大上下文窗口

        # 当前上下文窗口是否尚未完成首包注入；只有为 True 时才输出完整 <initial_context>
        self._is_first_injection: bool = True
        # 运行时 staging：表示这次消息处理前刚拿到的 current 状态，不落持久化。
        # 持久化 state.* 则始终表达模型上次已经看到的 baseline。
        self._workspace_files_current: Optional[str] = None
        self._workspace_entries_current: Optional[list] = None
        self._memory_current: Optional[str] = None
        self._language_current: Optional[str] = None

        # 初始输出 token 预算（由 agent 在首次 LLM 调用前设置，提限时不更新）
        # 用于在 initial_context 里给模型写入单次输出的字符量参考，让模型主动控制输出长度
        self._output_token_budget: Optional[int] = None

        # magiclaw 文件驱动启动状态（纯内存，per-context-window，不持久化）
        self._is_magiclaw: bool = False              # 会话是否为 magiclaw 模式
        self._magiclaw_dir: Optional[Path] = None    # .magic 目录，用于重置时重算文件集合
        self._magiclaw_required_paths: frozenset[str] = frozenset()
        self._magiclaw_read_paths: set[str] = set()
        self._magiclaw_missing_fixed_files: tuple[str, ...] = tuple()
        self._magiclaw_bootstrap_exists: bool = False
        self._magiclaw_startup_done: bool = True     # 启动阶段是否已完成（非 magiclaw 恒为 True）

    # ─────────────────────────────────────────────────────────────────────────
    # 初始化
    # ─────────────────────────────────────────────────────────────────────────

    async def _ensure_loaded(self) -> None:
        if self._loaded:
            return
        loaded = await self._store.load()
        if loaded is not None:
            self._state = loaded
            # 容器重启 / Agent 实例重建时，只恢复“这个上下文窗口是否已经发过首包”。
            # baseline 已经在 state.* 里；current 由本轮运行时重新采集，不应从旧进程内存恢复。
            self._is_first_injection = not loaded.initial_context_injected
            # 恢复 LLM 模型 baseline，避免重启后误判为"模型变更"
            self._last_llm_model_id = loaded.llm_model_id
            self._last_llm_model_name = loaded.llm_model_name
        self._loaded = True

    async def _save(self) -> None:
        await self._store.save(self._state)

    # ─────────────────────────────────────────────────────────────────────────
    # 原 FileTimestampManager 兼容接口
    # ─────────────────────────────────────────────────────────────────────────

    async def update_timestamp(
        self, file_path: Union[str, Path], metadata: Optional[dict] = None
    ) -> None:
        """写文件后调用，更新校验用 hash/mtime（不存内容快照）。"""
        await self._ensure_loaded()
        abs_path = _abs(file_path)
        try:
            stat = await get_fresh_file_stat(abs_path)
            size = stat.size
            mtime_ms = stat.mtime * 1000

            if size <= HASH_DETECTION_THRESHOLD:
                file_hash = await calculate_file_hash(abs_path)
            else:
                file_hash = f"__mtime__{stat.mtime}"

            ts = max(time.time() * 1000, mtime_ms) + NETWORK_FS_MTIME_BUFFER * 1000

            rec = self._state.file_records.get(abs_path)
            if rec is not None:
                rec.file_hash = file_hash
                rec.file_mtime_ms = ts
                rec.file_size_bytes = size
            else:
                self._state.file_records[abs_path] = FileReadRecord(
                    path=abs_path,
                    file_hash=file_hash,
                    file_mtime_ms=ts,
                    file_size_bytes=size,
                    file_content="",
                    tool_name="write",
                    truncated=False,
                    read_at=_iso_now(),
                )

            if metadata:
                existing_meta = self._state.file_records[abs_path].metadata
                existing_meta.update(metadata)

            await self._save()
        except Exception as e:
            logger.warning(f"[AgentHorizon] update_timestamp 失败 {abs_path}: {e}")

    async def validate_file_not_modified(
        self, file_path: Union[str, Path]
    ) -> Tuple[bool, str]:
        """编辑前校验文件自上次读/写后是否被外部修改。"""
        await self._ensure_loaded()
        abs_path = _abs(file_path)

        rec = self._state.file_records.get(abs_path)
        if rec is None:
            return False, VALIDATION_ERROR_NOT_READ

        try:
            stat = await get_fresh_file_stat(abs_path)
            size = stat.size
            mtime_ms = stat.mtime * 1000

            if size <= HASH_DETECTION_THRESHOLD:
                if not rec.file_hash:
                    return False, VALIDATION_ERROR_CHANGED
                current_hash = await calculate_file_hash(abs_path)
                if current_hash != rec.file_hash:
                    return False, VALIDATION_ERROR_CHANGED
                return True, ""
            else:
                # 大文件：mtime 快速校验
                if mtime_ms > rec.file_mtime_ms:
                    return False, VALIDATION_ERROR_CHANGED
                return True, ""
        except FileNotFoundError:
            return False, VALIDATION_ERROR_CHANGED
        except Exception as e:
            logger.warning(f"[AgentHorizon] validate_file_not_modified 异常 {abs_path}: {e}")
            return False, VALIDATION_ERROR_CHANGED

    async def get_metadata(self, file_path: Union[str, Path]) -> Optional[dict]:
        await self._ensure_loaded()
        rec = self._state.file_records.get(_abs(file_path))
        return rec.metadata if rec else None

    async def get_metadata_field(
        self, file_path: Union[str, Path], field_name: str
    ) -> Optional[Any]:
        meta = await self.get_metadata(file_path)
        return meta.get(field_name) if meta else None

    async def on_context_reset(self) -> None:
        """聊天历史压缩或 /new 后调用，重置与上下文内容相关的所有状态。

        - file_records：清空，强制重新读取才能编辑
        - image_model / video_model：清空，确保新上下文重新获得模型信息
        - _is_first_injection：重置为 True，下次 build_context_update 输出完整 initial_context
        - pending_notifications：保留，下次 build_context_update 仍会投递到新上下文
        - workspace_files/memory/language：保留（首次注入时重新全量输出给新上下文）
        - session 内存计数器：归零
        """
        await self._ensure_loaded()
        self._state.file_records.clear()
        self._state.image_model = ImageModelState()
        self._state.video_model = VideoModelState()
        self._context_used = 0
        self._context_total = 0
        self._llm_model_changed = False
        self._image_model_changed = False
        self._video_model_changed = False
        self._is_first_injection = True
        self._state.initial_context_injected = False
        self._state.last_injected_date = ""
        self._state.context_usage_baseline_used = 0
        self._state.context_usage_baseline_total = 0
        self._state.context_usage_baseline_used_pct = 0

        # magiclaw：重算固定文件集合和 BOOTSTRAP 状态，清空已读记录，强制重新进入必读流程
        # file_records 已被清空，所以无法从中恢复已读状态，这里必须走完整重置
        if self._is_magiclaw and self._magiclaw_dir is not None:
            await self.reset_magiclaw_startup(self._magiclaw_dir)

        await self._save()
        logger.info("[AgentHorizon] 已重置上下文相关状态（文件记录、图片/视频模型、首次注入标志）")

    # ─────────────────────────────────────────────────────────────────────────
    # 内容快照
    # ─────────────────────────────────────────────────────────────────────────

    async def record_file_read(
        self,
        path: Union[str, Path],
        file_hash: str,
        mtime_ms: float,
        size: int,
        truncated: bool,
        tool_name: str,
        ranges: Optional[list[tuple[int, int]]] = None,
        metadata: Optional[dict] = None,
    ) -> None:
        """read_file 工具成功读取后调用。

        Horizon 自主决定是否读取整文件并保存快照：
        - 小文件（<= FILE_CONTENT_SNAPSHOT_MAX_BYTES）：读整文件存快照
        - 大文件或读取失败：file_content 置空，变化时退化为 summary
        """
        await self._ensure_loaded()
        abs_path = _abs(path)
        record_saved = False
        try:
            ts = max(time.time() * 1000, mtime_ms) + NETWORK_FS_MTIME_BUFFER * 1000

            file_content, snapshot_mode, snapshot_reason = await _read_file_content_for_snapshot(abs_path)

            record_metadata = dict(metadata or {})
            record_metadata["snapshot_mode"] = snapshot_mode
            if snapshot_reason:
                record_metadata["snapshot_reason"] = snapshot_reason

            self._state.file_records[abs_path] = FileReadRecord(
                path=abs_path,
                file_hash=file_hash,
                file_mtime_ms=ts,
                file_size_bytes=size,
                file_content=file_content,
                tool_name=tool_name,
                truncated=truncated,
                metadata=record_metadata,
                read_at=_iso_now(),
                read_ranges=list(ranges) if ranges else [],
            )
            await self._save()
            record_saved = True
        except Exception as e:
            logger.warning(f"[AgentHorizon] record_file_read 失败 {abs_path}: {e}")

        if record_saved and not self._magiclaw_startup_done:
            self.mark_magiclaw_file_read(abs_path)

    # ─────────────────────────────────────────────────────────────────────────
    # magiclaw 文件驱动启动
    # ─────────────────────────────────────────────────────────────────────────

    async def _scan_magiclaw_required_paths(
        self, magic_dir: Path
    ) -> tuple[frozenset[str], tuple[str, ...], bool]:
        """扫描 .magic/ 目录，返回 (required_abs_paths, missing_fixed_names, bootstrap_exists)。

        只做文件系统扫描，不修改任何实例状态，可被 reset/restore 两条路径复用。
        """
        from app.utils.async_file_utils import async_exists

        fixed_files = {
            "IDENTITY.md": magic_dir / "IDENTITY.md",
            "SOUL.md": magic_dir / "SOUL.md",
            "AGENTS.md": magic_dir / "AGENTS.md",
            "USER.md": magic_dir / "USER.md",
            "MEMORY.md": magic_dir / "MEMORY.md",
        }
        required_paths: set[str] = set()
        missing_fixed: list[str] = []
        for filename, file_path in fixed_files.items():
            if await async_exists(file_path):
                required_paths.add(_abs(file_path))
            else:
                missing_fixed.append(filename)

        bootstrap_path = magic_dir / "BOOTSTRAP.md"
        bootstrap_exists = await async_exists(bootstrap_path)
        if bootstrap_exists:
            required_paths.add(_abs(bootstrap_path))

        return frozenset(required_paths), tuple(sorted(missing_fixed)), bootstrap_exists

    async def reset_magiclaw_startup(self, magic_dir: Path) -> None:
        """magiclaw 上下文显式重置时调用（/new 或 /compact 触发）。

        清空已读状态，强制重新扫描必读文件集合，要求模型重新读取所有必读文件。
        """
        required_paths, missing_fixed, bootstrap_exists = await self._scan_magiclaw_required_paths(magic_dir)

        self._is_magiclaw = True
        self._magiclaw_dir = magic_dir
        self._magiclaw_required_paths = required_paths
        self._magiclaw_read_paths = set()  # 硬重置：/new|/compact 后必须重读所有文件
        self._magiclaw_missing_fixed_files = missing_fixed
        self._magiclaw_bootstrap_exists = bootstrap_exists
        self._magiclaw_startup_done = not bool(required_paths)
        logger.info(
            "[magiclaw] startup reset（/new 或 /compact）: "
            f"required={sorted(Path(p).name for p in required_paths)}, "
            f"missing_fixed={list(missing_fixed)}, bootstrap_exists={bootstrap_exists}"
        )

    async def restore_magiclaw_startup(self, magic_dir: Path) -> None:
        """Agent 实例重建或容器重启后调用，从持久化 file_records 恢复已读状态。

        从 .horizon.json 中的 file_records 反推哪些必读文件已经真实读取过，
        只对真正未读过的文件继续提醒，避免容器重启后把已完成的 startup 重置掉。
        """
        await self._ensure_loaded()

        required_paths, missing_fixed, bootstrap_exists = await self._scan_magiclaw_required_paths(magic_dir)

        # 从持久化 file_records 恢复已读必读文件集合
        persisted_paths = set(self._state.file_records.keys())
        restored_read_paths = set(required_paths & persisted_paths)

        self._is_magiclaw = True
        self._magiclaw_dir = magic_dir
        self._magiclaw_required_paths = required_paths
        self._magiclaw_read_paths = restored_read_paths
        self._magiclaw_missing_fixed_files = missing_fixed
        self._magiclaw_bootstrap_exists = bootstrap_exists
        self._magiclaw_startup_done = required_paths <= restored_read_paths

        if self._magiclaw_startup_done:
            logger.info("[magiclaw] startup restore：所有必读文件已从 file_records 恢复，跳过 startup 提醒")
        else:
            remaining = sorted(Path(p).name for p in (required_paths - restored_read_paths))
            logger.info(
                "[magiclaw] startup restore：部分必读文件尚未读取，继续提醒: "
                f"remaining={remaining}, bootstrap_exists={bootstrap_exists}"
            )

    def mark_magiclaw_file_read(self, abs_path: str) -> None:
        """read_file 工具成功读取后调用，记录必读文件完成情况。

        只有绝对路径在必读集合中时才更新状态，避免被其他同名文件误命中。
        """
        if self._magiclaw_startup_done or abs_path not in self._magiclaw_required_paths:
            return
        self._magiclaw_read_paths.add(abs_path)
        if self._magiclaw_required_paths <= self._magiclaw_read_paths:
            self._magiclaw_startup_done = True
            logger.info("[magiclaw] 所有必读文件已真实读取，停止启动提醒")
        else:
            remaining = sorted(Path(p).name for p in (self._magiclaw_required_paths - self._magiclaw_read_paths))
            logger.info(f"[magiclaw] 已读取 {Path(abs_path).name}，剩余必读: {remaining}")

    def _build_magiclaw_startup_context(self) -> str:
        """生成 magiclaw 运行时必读文件提醒块。未完成时返回非空字符串，完成后返回空串。"""
        if self._magiclaw_startup_done:
            return ""
        unread = sorted(Path(p).name for p in (self._magiclaw_required_paths - self._magiclaw_read_paths))
        read_done = sorted(Path(p).name for p in self._magiclaw_read_paths)
        lines = ["<magiclaw_startup>"]
        lines.append(
            "You are in a file-driven startup phase. Read all required workspace files "
            "before responding normally to the user."
        )
        if self._magiclaw_bootstrap_exists and "BOOTSTRAP.md" in unread:
            lines.append(
                "PRIORITY: BOOTSTRAP.md exists — read it FIRST. "
                "Complete every item in it before deleting the file."
            )
        if self._magiclaw_missing_fixed_files:
            lines.append(
                "These fixed startup files are not present in the workspace yet: "
                + ", ".join(self._magiclaw_missing_fixed_files)
            )
        lines.append(f"Still need to read: {', '.join(unread)}")
        if read_done:
            lines.append(f"Already read this session: {', '.join(read_done)}")
        lines.append(
            "Also review today's and yesterday's files in memory/ if present. "
            "This is recommended startup context, but it does not block startup completion."
        )
        lines.append("</magiclaw_startup>")
        return "\n".join(lines)

    async def record_skill_loaded(self, skill_name: str) -> None:
        await self._ensure_loaded()
        if skill_name not in self._state.loaded_skills:
            self._state.loaded_skills.append(skill_name)
            await self._save()

    def get_loaded_skills(self) -> list[str]:
        return list(self._state.loaded_skills)

    # ─────────────────────────────────────────────────────────────────────────
    # 通知队列
    # ─────────────────────────────────────────────────────────────────────────

    def push_notification(self, source: str, content: str) -> None:
        """推送系统通知到队列，下次 build_context_update 时消费并注入 LLM。"""
        notif = PendingNotification(
            pushed_at=_iso_now(),
            source=source,
            content=content,
        )
        self._state.pending_notifications.append(notif)

    # ─────────────────────────────────────────────────────────────────────────
    # 运行时状态更新
    # ─────────────────────────────────────────────────────────────────────────

    def set_output_token_budget(self, tokens: int) -> None:
        """设置初始输出 token 预算，只在未设置时生效（提限时不调用，保持原始引导值）。

        max_tokens 提升（finish_reason=length 后的扩容）只是为了让已经超限的内容能顺利输出，
        而不是授权模型输出更多内容。如果把扩容后的值也注入给模型，模型会认为上限变高了，
        从而产生更长的输出，反复触发截断——这与提升成功率的初衷相反。

        因此：
        - 这里只允许设置一次（_output_token_budget is None 时才写入）
        - initial_context 里注入的字符量引导始终基于初始值，不随提限更新
        - 扩容后的 max_tokens 不通过 initial_context 或任何 change 事件告知模型
        """
        if self._output_token_budget is None:
            self._output_token_budget = tokens

    @staticmethod
    def _build_output_size_hint(max_tokens: int) -> str:
        """根据 max_tokens 换算各语言单次安全字符量，生成写入 initial_context 的提示行。

        只在首次注入（initial_context）时调用，后续不随 max_tokens 变化更新。
        即使 agent 因 finish_reason=length 扩容了 max_tokens，模型也不会收到新的引导值，
        原因见 set_output_token_budget 注释。

        换算系数（含 50% 安全裕量，code 额外考虑中文注释混入场景）：
        - 拉丁字母系（英/德/法/西/葡/意）：4 chars/token × 0.5
        - 非拉丁密集脚本（俄/阿拉伯/印地语）：2 chars/token × 0.5
        - 中文：1.5 chars/token × 0.5
        - 日/韩：1.5 chars/token × 0.5
        - 代码（含中文注释）：2.5 chars/token × 0.5
        """
        def _k(chars: float) -> str:
            return f"~{int(chars / 1000)}k"

        latin = max_tokens * 4.0 * 0.5   # English, German, French, Spanish, Portuguese, Italian
        dense = max_tokens * 2.0 * 0.5   # Russian, Arabic, Hindi
        zh    = max_tokens * 1.5 * 0.5   # Chinese
        jk    = max_tokens * 1.5 * 0.5   # Japanese, Korean
        code  = max_tokens * 2.5 * 0.5
        return (
            f'<output_size_limit max_tokens="{max_tokens}">'
            f"Every single response — whether writing/editing a file, filling tool arguments, "
            f"or producing plain text — is hard-capped at: "
            f"English/German/French/Spanish/Portuguese/Italian {_k(latin)} chars, "
            f"Russian/Arabic/Hindi {_k(dense)} chars, "
            f"Chinese {_k(zh)} chars, Japanese/Korean {_k(jk)} chars, "
            f"code with inline comments {_k(code)} chars. "
            f"Exceeding the limit causes the output to be cut off mid-way with no warning. "
            f"Any content over {_k(zh)}–{_k(latin)} chars (lower end for Chinese, upper for Latin-script) "
            f"must be broken up: write a skeleton with placeholder anchors first, "
            f"then fill each section in a separate, focused action."
            f"</output_size_limit>"
        )

    def update_llm_model(self, model_id: str, model_name: str, description: str = "") -> None:
        """LLM 调用返回后调用，记录实际生效的模型信息；仅在模型变化时标记需要注入。"""
        if model_id != self._last_llm_model_id or model_name != self._last_llm_model_name:
            self._last_llm_model_id = model_id
            self._last_llm_model_name = model_name
            self._last_llm_model_description = description
            self._llm_model_changed = True

    def get_context_usage(self) -> ContextUsage:
        """返回当前上下文窗口使用情况，供工具决策使用。total=0 表示尚未获得模型数据。"""
        return ContextUsage(used=self._context_used, total=self._context_total)

    def update_context_usage(self, input_tokens: int, context_window_total: int) -> None:
        """LLM 调用返回后调用，更新上下文窗口使用量。"""
        self._context_used = input_tokens
        self._context_total = context_window_total

    def _calculate_context_used_pct(self, used: int, total: int) -> int:
        return int(used / total * 100)

    def _get_context_usage_diff_threshold_pct(self, current_used_pct: int) -> int:
        """按当前占用区间返回最小注入阈值。

        规则保持和常量区注释一致：
        - <70% => 5
        - 70%~79% => 3
        - >=80% => 1
        """
        if current_used_pct >= CONTEXT_USAGE_HIGH_USAGE_START_PCT:
            return CONTEXT_USAGE_HIGH_USAGE_DIFF_THRESHOLD_PCT
        if current_used_pct >= CONTEXT_USAGE_MEDIUM_USAGE_START_PCT:
            return CONTEXT_USAGE_MEDIUM_USAGE_DIFF_THRESHOLD_PCT
        return CONTEXT_USAGE_LOW_USAGE_DIFF_THRESHOLD_PCT

    def _should_inject_context_usage(self, current_used_pct: int) -> bool:
        """按绝对百分点差值判断是否需要再次注入 context usage。

        baseline 不存在时先注入一次，后续再按阈值做节流。
        """
        if self._state.context_usage_baseline_total <= 0:
            return True
        used_pct_diff = abs(current_used_pct - self._state.context_usage_baseline_used_pct)
        return used_pct_diff >= self._get_context_usage_diff_threshold_pct(current_used_pct)

    def _update_context_usage_baseline(self, used: int, total: int, used_pct: int) -> bool:
        """只有真正把 usage 发给模型后，才推进 last injected baseline。"""
        if (
            self._state.context_usage_baseline_used == used
            and self._state.context_usage_baseline_total == total
            and self._state.context_usage_baseline_used_pct == used_pct
        ):
            return False
        self._state.context_usage_baseline_used = used
        self._state.context_usage_baseline_total = total
        self._state.context_usage_baseline_used_pct = used_pct
        return True

    async def update_video_model(self, model_id: str, config: dict) -> None:
        """用户消息处理时调用，检测视频模型配置是否变化；变化则标记需注入并持久化。"""
        if not model_id or not config:
            return
        await self._ensure_loaded()
        try:
            import json
            new_json = json.dumps(config, sort_keys=True, ensure_ascii=False)
            stored = self._state.video_model
            old_json = json.dumps(stored.config, sort_keys=True, ensure_ascii=False)
            if model_id != stored.model_id or new_json != old_json:
                self._state.video_model = VideoModelState(model_id=model_id, config=config)
                self._video_model_changed = True
                await self._save()
        except Exception as e:
            logger.warning(f"[AgentHorizon] update_video_model 失败: {e}")

    async def update_image_model(self, model_id: str, sizes: list) -> None:
        """用户消息处理时调用，检测图片模型是否变化；变化则标记需注入并持久化。"""
        if not model_id or not sizes:
            return
        await self._ensure_loaded()
        try:
            import json
            new_json = json.dumps(sizes, sort_keys=True, ensure_ascii=False)
            stored = self._state.image_model
            old_json = json.dumps(stored.sizes, sort_keys=True, ensure_ascii=False)
            if model_id != stored.model_id or new_json != old_json:
                self._state.image_model = ImageModelState(model_id=model_id, sizes=sizes)
                self._image_model_changed = True
                await self._save()
        except Exception as e:
            logger.warning(f"[AgentHorizon] update_image_model 失败: {e}")

    def _build_media_model_info(
        self,
        *,
        include_image: bool,
        include_video: bool,
        image_changed: bool,
        video_changed: bool,
    ) -> list[str]:
        """统一构建紧凑媒体模型信息，避免首次和增量注入格式漂移。"""
        media_parts: list[str] = []
        has_video = False

        # 首次注入和增量注入共用这一层组装，目的是让模型始终看到同一种结构，
        # 避免 initial_context 和 model_info 里出现两套不同格式，增加理解负担。
        if include_image:
            from app.service.image_model_sizes_service import ImageModelSizesService

            img = self._state.image_model
            image_text = ImageModelSizesService.build_image_model_info(
                img.model_id,
                img.sizes,
                changed=image_changed,
            )
            if image_text:
                media_parts.append(image_text)

        if include_video:
            from app.service.video_model_config_service import VideoModelConfigService

            vid = self._state.video_model
            video_text = VideoModelConfigService.build_video_model_info(
                vid.model_id,
                vid.config,
                changed=video_changed,
            )
            if video_text:
                media_parts.append(video_text)
                has_video = True

        if not media_parts:
            return []

        from app.service.video_model_config_service import VideoModelConfigService

        # 规则块放在 media_model_info 之后，让 LLM 先拿到事实，再读很短的决策约束。
        return [
            "<media_model_info>",
            *media_parts,
            "</media_model_info>",
            VideoModelConfigService.build_media_model_rules(has_video=has_video),
        ]

    # ─────────────────────────────────────────────────────────────────────────
    # 字符串值 setter（用于 diff 追踪）
    # ─────────────────────────────────────────────────────────────────────────

    def _get_workspace_files_current(self) -> str:
        return self._workspace_files_current if self._workspace_files_current is not None else self._state.workspace_files

    def _get_workspace_entries_current(self) -> list:
        entries = self._workspace_entries_current if self._workspace_entries_current is not None else self._state.workspace_entries
        return list(entries)

    def _get_memory_current(self) -> str:
        return self._memory_current if self._memory_current is not None else self._state.memory

    def _get_language_current(self) -> str:
        return self._language_current if self._language_current is not None else self._state.user_preferred_language

    async def set_workspace_snapshot(self, snapshot: "WorkspaceSnapshot") -> None:
        """更新运行时 current 工作区快照，不直接覆盖持久化 baseline。"""
        await self._ensure_loaded()
        current_paths = _workspace_entries_to_path_set(self._get_workspace_entries_current())
        new_paths = _workspace_entries_to_path_set(snapshot.entries)
        if snapshot.display != self._get_workspace_files_current() or new_paths != current_paths:
            self._workspace_files_current = snapshot.display
            self._workspace_entries_current = list(snapshot.entries)

    async def set_memory(self, memory: str) -> None:
        """更新运行时 current memory，不直接覆盖持久化 baseline。"""
        await self._ensure_loaded()
        if memory != self._get_memory_current():
            self._memory_current = memory

    async def set_user_preferred_language(self, language: str) -> None:
        """更新运行时 current 语言，不直接覆盖持久化 baseline。"""
        await self._ensure_loaded()
        if language != self._get_language_current():
            self._language_current = language

    # ─────────────────────────────────────────────────────────────────────────
    # 核心：构建注入给 LLM 的动态上下文
    # ─────────────────────────────────────────────────────────────────────────

    async def build_context_update(self) -> str:
        """
        编排所有动态上下文，返回完整的 <system_injected_context> XML 文本，每次调用均输出。

        首次注入（_is_first_injection=True）时包含 <initial_context> 全量块：
          当前时间、LLM 模型、图片模型、workspace_files、memory、user_preferred_language

        后续注入按需包含：
          <current_time>     — 始终输出
          <context_usage>    — context_total > 0 且达到分段阈值时
          <model_info>       — LLM 模型或图片模型发生变化时
          <workspace_files_changed> — workspace_files 变化时
          <memory_changed>   — memory 变化时
          <language_changed> — user_preferred_language 变化时
          <file_changes>     — 文件有变化时
          <notifications>    — 有待注入通知时
        """
        await self._ensure_loaded()

        # 并发计算所有被追踪文件的当前 hash 和 mtime
        current_hashes: dict[str, tuple[str, int]] = {}
        current_mtimes: dict[str, float] = {}
        paths = list(self._state.file_records.keys())

        async def _get_stat(abs_path: str) -> tuple[str, str, int, float]:
            try:
                stat = await get_fresh_file_stat(abs_path)
                size = stat.size
                mtime_ms = stat.mtime * 1000
                if size <= HASH_DETECTION_THRESHOLD:
                    h = await calculate_file_hash(abs_path)
                else:
                    h = f"__mtime__{stat.mtime}"
                return abs_path, h, size, mtime_ms
            except Exception:
                return abs_path, "", 0, 0.0

        results = await asyncio.gather(*[_get_stat(p) for p in paths])
        for abs_path, h, size, mtime_ms in results:
            current_hashes[abs_path] = (h, size)
            current_mtimes[abs_path] = mtime_ms

        # 文件变化检测
        file_blocks = await detect_file_changes(self._state, current_hashes, current_mtimes)

        # 通知块
        notif_blocks = [
            f'<notification source="{n.source}" time="{n.pushed_at}">{n.content}</notification>'
            for n in self._state.pending_notifications
        ]

        # ── 时间 ────────────────────────────────────────────────────────────
        from agentlang.utils.datetime_formatter import get_current_datetime_str
        tz = self._agent_context.get_user_timezone() if self._agent_context else None
        now_str = get_current_datetime_str(tz)
        # 格式固定为 "YYYY-MM-DD HH:MM:SS Weekday (Week N) TZ (UTC+xx:xx)"
        today_date = now_str[:10]
        date_changed = today_date != self._state.last_injected_date
        # 同一天内省略周几、第几周、时区，只保留 "YYYY-MM-DD HH:MM:SS"
        time_display = now_str if date_changed else now_str[:19]

        current_workspace_files = self._get_workspace_files_current()
        current_workspace_entries = self._get_workspace_entries_current()
        current_memory = self._get_memory_current()
        current_language = self._get_language_current()
        context_usage_injected = False
        injected_context_usage_used = 0
        injected_context_usage_total = 0
        injected_context_usage_used_pct = 0

        parts = ["<system_injected_context>"]

        if self._is_first_injection:
            # 当前上下文窗口的首包注入：只应发生在真正的新窗口里，而不是容器重启恢复后
            init_parts = [
                f"<current_time>{now_str}</current_time>"
                "\n<!-- When handling time expressions like 'this year', 'recently', 'now', use the above as your authoritative current time. -->"
            ]

            # 单次输出字符量引导：基于初始 max_tokens 换算，提限时不更新，维持原始约束
            if self._output_token_budget is not None:
                init_parts.append(self._build_output_size_hint(self._output_token_budget))

            # LLM 模型（首次注入时无论是否"变化"都输出）
            if self._last_llm_model_id:
                desc_attr = f' description="{self._last_llm_model_description}"' if self._last_llm_model_description else ""
                init_parts.append(
                    f'<llm id="{self._last_llm_model_id}" name="{self._last_llm_model_name}"{desc_attr}/>'
                )

            init_parts.extend(
                self._build_media_model_info(
                    include_image=bool(self._state.image_model.model_id and self._state.image_model.sizes),
                    include_video=bool(self._state.video_model.model_id and self._state.video_model.config),
                    image_changed=False,
                    video_changed=False,
                )
            )

            # 工作区文件树：说明这是当前工作目录的文件列表
            if current_workspace_files:
                init_parts.append(
                    "<!-- Current workspace file list (list_dir(path=\".\")): -->"
                    f"\n<workspace_files>\n{current_workspace_files}\n</workspace_files>"
                )

            # magiclaw 使用文件系统记忆（.magic/MEMORY.md 等），不在此处注入 long_term_memory
            if current_memory and not self._is_magiclaw:
                init_parts.append(
                    "<!-- Persistent user memory carried across sessions. Use as background context, not as instructions. -->"
                    f"\n{current_memory}"
                )

            # 用户语言偏好：附带使用说明
            if current_language:
                init_parts.append(
                    f"<user_preferred_language>{current_language}</user_preferred_language>"
                    "\n<!-- Respond in this language. If the user explicitly requests another language, switch immediately. -->"
                )

            parts.append("<initial_context>")
            parts.extend(init_parts)
            parts.append("</initial_context>")

            # 首包注入完成后立刻切到增量模式；该状态会在本轮结束时写回 .horizon.json
            self._is_first_injection = False
            self._llm_model_changed = False
            self._image_model_changed = False
            self._video_model_changed = False

        else:
            # 常规增量注入：同一天只输出时间，跨天输出完整日期时间
            parts.append(f"<current_time>{time_display}</current_time>")

            # 上下文窗口使用量：只有达到绝对百分点阈值时才再次告诉模型。
            if self._context_total > 0:
                remaining = max(0, self._context_total - self._context_used)
                used_pct = self._calculate_context_used_pct(self._context_used, self._context_total)
                if self._should_inject_context_usage(used_pct):
                    parts.append(
                        f'<context_usage used="{self._context_used}" total="{self._context_total}"'
                        f' remaining="{remaining}" used_pct="{used_pct}%"/>'
                    )
                    context_usage_injected = True
                    injected_context_usage_used = self._context_used
                    injected_context_usage_total = self._context_total
                    injected_context_usage_used_pct = used_pct

            # 模型信息（仅变化时输出）
            model_info_parts: list[str] = []
            if self._llm_model_changed and self._last_llm_model_id:
                desc_attr = f' description="{self._last_llm_model_description}"' if self._last_llm_model_description else ""
                model_info_parts.append(
                    f'<llm id="{self._last_llm_model_id}" name="{self._last_llm_model_name}"{desc_attr}/>'
                )
                self._llm_model_changed = False

            if self._image_model_changed or self._video_model_changed:
                model_info_parts.extend(
                    self._build_media_model_info(
                        include_image=self._image_model_changed and bool(self._state.image_model.model_id),
                        include_video=self._video_model_changed and bool(self._state.video_model.model_id and self._state.video_model.config),
                        image_changed=self._image_model_changed,
                        video_changed=self._video_model_changed,
                    )
                )
                self._image_model_changed = False
                self._video_model_changed = False

            if model_info_parts:
                parts.append("<model_info>")
                parts.extend(model_info_parts)
                parts.append("</model_info>")

            # 增量注入：用“模型已知 baseline”与“本轮 current staging”直接计算 diff
            cur_paths = _workspace_entries_to_path_set(current_workspace_entries)
            baseline_paths = _workspace_entries_to_path_set(self._state.workspace_entries)
            if cur_paths != baseline_paths:
                diff = _workspace_files_diff(self._state.workspace_entries, current_workspace_entries)
                if diff:
                    parts.append(f"<workspace_files_changed>\n{diff}\n</workspace_files_changed>")

            if not self._is_magiclaw and self._state.memory != current_memory:
                diff = _string_diff(self._state.memory, current_memory)
                if diff:
                    parts.append(f"<long_term_memory_changed>\n{diff}\n</long_term_memory_changed>")

            if self._state.user_preferred_language != current_language:
                parts.append(
                    f'<user_preferred_language_changed>{current_language}</user_preferred_language_changed>'
                )

        # 注入完成后，把 current staging 提交成新的持久化 baseline。
        persistence_changed = False
        if self._state.last_injected_date != today_date:
            self._state.last_injected_date = today_date
            persistence_changed = True
        if self._state.initial_context_injected is not True:
            self._state.initial_context_injected = True
            persistence_changed = True
        if self._state.workspace_files != current_workspace_files:
            self._state.workspace_files = current_workspace_files
            persistence_changed = True
        if self._state.workspace_entries != current_workspace_entries:
            self._state.workspace_entries = list(current_workspace_entries)
            persistence_changed = True
        if self._state.memory != current_memory:
            self._state.memory = current_memory
            persistence_changed = True
        if self._state.llm_model_id != self._last_llm_model_id or self._state.llm_model_name != self._last_llm_model_name:
            self._state.llm_model_id = self._last_llm_model_id
            self._state.llm_model_name = self._last_llm_model_name
            persistence_changed = True
        if self._state.user_preferred_language != current_language:
            self._state.user_preferred_language = current_language
            persistence_changed = True
        if context_usage_injected:
            persistence_changed = (
                self._update_context_usage_baseline(
                    injected_context_usage_used,
                    injected_context_usage_total,
                    injected_context_usage_used_pct,
                )
                or persistence_changed
            )

        if file_blocks:
            parts.append("<file_changes>")
            parts.extend(file_blocks)
            parts.append("</file_changes>")

        if notif_blocks:
            parts.append("<notifications>")
            parts.extend(notif_blocks)
            parts.append("</notifications>")

        # magiclaw 启动提醒：每轮都注入，直到所有必读文件完成
        magiclaw_ctx = self._build_magiclaw_startup_context()
        if magiclaw_ctx:
            parts.append(magiclaw_ctx)

        parts.append("</system_injected_context>")

        state_changed = bool(file_blocks) or bool(self._state.pending_notifications) or persistence_changed
        for abs_path, (cur_hash, cur_size) in current_hashes.items():
            rec = self._state.file_records.get(abs_path)
            if rec and cur_hash and rec.file_hash != cur_hash:
                rec.file_hash = cur_hash
                rec.file_size_bytes = cur_size
                rec.file_mtime_ms = current_mtimes.get(abs_path, rec.file_mtime_ms)

        self._state.pending_notifications.clear()

        if state_changed:
            await self._save()

        return "\n".join(parts)
