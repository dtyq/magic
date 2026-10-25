"""Topic-local persistence detection and legacy directory migration helpers."""

from __future__ import annotations

from collections.abc import Collection
import json
import os
import shutil
import tempfile
import zipfile
from pathlib import Path
from pathlib import PurePosixPath
from typing import Dict, Optional

from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.utils.async_file_utils import (
    async_exists,
    async_is_dir,
    async_is_symlink,
    async_rmtree,
    async_unlink,
)

logger = get_logger(__name__)

TOPIC_DIR_NAME = ".topic"
CHAT_HISTORY_DIR_NAME = "chat_history"
MIGRATION_STATE_FILE_NAME = ".migration_state.json"
PERSISTENCE_STATE_FILE_NAME = ".persistence_state.json"
STATE_SCHEMA_VERSION = 1
LEGACY_LLM_REQUESTS_DIR_NAME = "llm_request"


def get_chat_history_excluded_dir_names() -> frozenset[str]:
    """Return current and legacy LLM log directories excluded from chat history."""
    return frozenset({
        LEGACY_LLM_REQUESTS_DIR_NAME,
        PathManager.get_llm_requests_dir_name(),
    })


def should_upload_component(*, persistence_healthy: bool, component_persisted: bool) -> bool:
    """Return whether the zip fallback must run for one topic component."""
    return not (persistence_healthy and component_persisted)


def safe_extract_archive(
    archive_path: str,
    target_dir: Path,
    *,
    skip_top_levels: Collection[str] = (),
    strip_top_level: Optional[str] = None,
) -> int:
    """Extract locally, filter unsafe/ignored members, then copy once to the target."""
    target_dir = Path(target_dir)
    with tempfile.TemporaryDirectory(prefix=".topic-extract-") as temp_dir:
        temp_root = Path(temp_dir)
        with zipfile.ZipFile(archive_path, "r") as zip_ref:
            members = []
            for member in zip_ref.infolist():
                normalized_name = member.filename.replace("\\", "/")
                path = PurePosixPath(normalized_name)
                if path.is_absolute() or ".." in path.parts:
                    raise ValueError(f"zip contains unsafe path: {member.filename}")
                effective_parts = path.parts
                if strip_top_level and effective_parts and effective_parts[0] == strip_top_level:
                    effective_parts = effective_parts[1:]
                if skip_top_levels and any(name in effective_parts for name in skip_top_levels):
                    continue
                members.append(member)
            zip_ref.extractall(temp_root, members=members)

        source_root = temp_root
        if strip_top_level:
            wrapped_root = temp_root / strip_top_level
            if wrapped_root.is_dir():
                source_root = wrapped_root

        target_dir.mkdir(parents=True, exist_ok=True)
        for source in source_root.iterdir():
            destination = target_dir / source.name
            if source.is_dir() and not source.is_symlink():
                shutil.copytree(source, destination, dirs_exist_ok=True)
            else:
                shutil.copy2(source, destination)
        return len(members)


class TopicPersistenceManager:
    """Persistence state and one-time legacy migration for the sandbox topic volume.

    The infrastructure mounts ``.topic`` as a topic-scoped persistent volume.
    Application code only verifies that the injected topic directories are
    available. Restore readiness is recorded independently per component.
    """

    def __init__(self, project_root: Path):
        self.project_root = Path(project_root)
        self.topic_dir = self.project_root / TOPIC_DIR_NAME
        self.chat_history_dir = self.topic_dir / CHAT_HISTORY_DIR_NAME
        self.migration_state_path = self.topic_dir / MIGRATION_STATE_FILE_NAME
        self.persistence_state_path = self.topic_dir / PERSISTENCE_STATE_FILE_NAME

    def ensure_directories(self) -> None:
        self.chat_history_dir.mkdir(parents=True, exist_ok=True)

    def has_chat_history_data(self) -> bool:
        """Return whether the topic chat-history source contains usable data."""
        try:
            excluded_dir_names = get_chat_history_excluded_dir_names()
            return any(
                entry.name not in excluded_dir_names and not entry.name.startswith(".")
                for entry in self.chat_history_dir.iterdir()
            )
        except OSError as error:
            logger.warning("检查 topic 聊天记录失败: %s", error)
            return False

    def restore_topic_chat_history(self, target_dir: Path) -> None:
        """Replace a local chat-history directory with the topic source."""
        self._replace_directory(self.chat_history_dir, Path(target_dir))

    @staticmethod
    def clear_directory(target_dir: Path) -> None:
        """Remove a target directory's contents in place, keeping the directory itself.

        运行期聊天历史目录在沙箱内是指向 localfs 挂载的 symlink
        （/app/.chat_history -> <AGFS FUSE 挂载根>/localfs/chat_history），恢复
        不能再用「备份 + rename 整目录替换」的原子替换（staging 在容器
        overlay 上、目标是 FUSE，跨设备 rename 会得到 EXDEV），而是解析
        symlink 后原地清空再拷入。恢复是幂等的全量替换，中途失败的半份
        状态会在下次启动被同样的恢复流程覆盖。
        """
        target_dir = Path(target_dir)
        resolved = target_dir.resolve() if target_dir.is_symlink() else target_dir
        resolved.mkdir(parents=True, exist_ok=True)
        for entry in resolved.iterdir():
            if entry.is_dir() and not entry.is_symlink():
                shutil.rmtree(entry)
            else:
                entry.unlink()

    def clear_topic_chat_history(self) -> None:
        """Remove topic chat-history contents while retaining the directory itself."""
        self.chat_history_dir.mkdir(parents=True, exist_ok=True)
        for entry in self.chat_history_dir.iterdir():
            if entry.name == ".git":
                continue
            if entry.is_dir() and not entry.is_symlink():
                shutil.rmtree(entry)
            else:
                entry.unlink()

    @staticmethod
    def _replace_directory(source_dir: Path, target_dir: Path) -> None:
        """Stage the source in the container-local FS, then clear-and-copy it
        into the target without merging stale files.

        目标可能是 FUSE 挂载（运行期聊天历史在 localfs 空间内），跨设备
        rename 不可用（EXDEV），因此恢复统一走「先清空目标、再逐项拷入」。
        """
        source_dir = Path(source_dir)
        target_dir = Path(target_dir)
        target_dir.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(
            prefix=".chat-history-restore-"
        ) as temp_dir:
            staged_dir = Path(temp_dir) / target_dir.name
            shutil.copytree(
                source_dir,
                staged_dir,
                ignore=shutil.ignore_patterns(".git"),
            )
            TopicPersistenceManager.clear_directory(target_dir)
            shutil.copytree(staged_dir, target_dir.resolve() if target_dir.is_symlink() else target_dir, dirs_exist_ok=True)

    def is_healthy(self, topic_id: Optional[str]) -> bool:
        """Return true when the sandbox-provided topic directories are available."""
        if not topic_id:
            return False
        self.ensure_directories()
        try:
            return self.topic_dir.is_dir() and self.chat_history_dir.is_dir()
        except OSError as error:
            logger.warning("topic 持久卷健康检查失败: %s", error)
            return False

    def _load_state(self, path: Path) -> Dict[str, object]:
        try:
            if path.exists():
                with path.open("r", encoding="utf-8") as state_file:
                    state = json.load(state_file)
                return state if isinstance(state, dict) else {}
        except (OSError, ValueError) as error:
            logger.warning("读取 topic 状态失败 %s: %s", path, error)
        return {}

    def _save_state(self, path: Path, state: Dict[str, object]) -> None:
        self.topic_dir.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", suffix=".tmp", dir=self.topic_dir, delete=False
        ) as temp_file:
            json.dump(state, temp_file, ensure_ascii=False, indent=2)
            temp_path = Path(temp_file.name)
        os.replace(temp_path, path)

    def is_component_ready(self, component: str) -> bool:
        state = self._load_state(self.persistence_state_path)
        ready = state.get("ready", {})
        empty = state.get("empty", {})
        if not isinstance(ready, dict) or ready.get(component) is not True:
            return False
        if isinstance(empty, dict) and empty.get(component) is True:
            return True
        return self.component_has_data(component)

    def mark_component_ready(self, component: str, ready: bool = True) -> None:
        state = self._load_state(self.persistence_state_path)
        state["schema_version"] = STATE_SCHEMA_VERSION
        current_ready = state.get("ready")
        if not isinstance(current_ready, dict):
            current_ready = {}
        current_ready[component] = bool(ready)
        state["ready"] = current_ready
        empty = state.get("empty")
        if not isinstance(empty, dict):
            empty = {}
        empty[component] = bool(ready and not self.component_has_data(component))
        state["empty"] = empty
        self._save_state(self.persistence_state_path, state)

    async def cleanup_legacy_llm_requests_dir(self) -> None:
        """Asynchronously remove the obsolete LLM log directory from chat history."""
        legacy_dir = self.chat_history_dir / LEGACY_LLM_REQUESTS_DIR_NAME
        try:
            if await async_is_symlink(legacy_dir):
                await async_unlink(legacy_dir)
            elif await async_exists(legacy_dir):
                if await async_is_dir(legacy_dir):
                    await async_rmtree(legacy_dir)
                else:
                    logger.warning("旧 LLM 请求路径不是目录，跳过删除: %s", legacy_dir)
                    return
            else:
                return
            logger.info("已删除持久化聊天历史中的旧 LLM 请求日志目录: %s", legacy_dir)
        except OSError as error:
            logger.warning("删除旧 LLM 请求日志目录失败 %s: %s", legacy_dir, error)

    def migrate_legacy_directories(self) -> Dict[str, bool]:
        """Migrate legacy directories once, with retryable per-component state."""
        self.ensure_directories()
        migrations = {
            "chat_history": (self.project_root / ".chat_history", self.chat_history_dir),
        }
        migration_state_exists = self.migration_state_path.exists()
        migration_state = self._load_state(self.migration_state_path)
        completed = migration_state.get("completed")
        if not isinstance(completed, dict):
            completed = {}
        result: Dict[str, bool] = {}
        for name, (legacy_dir, target_dir) in migrations.items():
            if completed.get(name) is True:
                result[name] = False
                continue
            if not legacy_dir.is_dir():
                completed[name] = True
                result[name] = False
                continue
            if not migration_state_exists and any(target_dir.iterdir()):
                completed[name] = True
                result[name] = False
                self.mark_component_ready(name, True)
                continue
            try:
                entries = list(legacy_dir.iterdir())
                excluded_dir_names = get_chat_history_excluded_dir_names()
                with tempfile.TemporaryDirectory(prefix=f".topic-migrate-{name}-") as temp_dir:
                    staged_dir = Path(temp_dir) / name
                    staged_dir.mkdir()
                    for entry in entries:
                        if name == "chat_history" and entry.name in excluded_dir_names:
                            continue
                        destination = staged_dir / entry.name
                        if entry.is_dir() and not entry.is_symlink():
                            shutil.copytree(entry, destination)
                        else:
                            shutil.copy2(entry, destination)

                    if any(target_dir.iterdir()):
                        backup_dir = target_dir.with_name(f"{target_dir.name}.migration-partial")
                        if backup_dir.exists():
                            shutil.rmtree(backup_dir)
                        target_dir.rename(backup_dir)
                    target_dir.mkdir(parents=True, exist_ok=True)
                    for entry in staged_dir.iterdir():
                        destination = target_dir / entry.name
                        if entry.is_dir() and not entry.is_symlink():
                            shutil.copytree(entry, destination)
                        else:
                            shutil.copy2(entry, destination)
                result[name] = True
                completed[name] = True
                self.mark_component_ready(name, True)
            except OSError as error:
                logger.error("迁移旧 %s 目录失败: %s", name, error)
                result[name] = False
                completed[name] = False
        migration_state["schema_version"] = STATE_SCHEMA_VERSION
        migration_state["completed"] = completed
        if all(completed.get(name) is True for name in migrations):
            try:
                self.migration_state_path.unlink(missing_ok=True)
            except OSError as error:
                logger.warning("删除迁移状态文件失败: %s", error)
        else:
            self._save_state(self.migration_state_path, migration_state)
        return result

    def component_has_data(self, component: str) -> bool:
        if component != "chat_history":
            return False
        directory = self.chat_history_dir
        try:
            entries = directory.iterdir()
            excluded_dir_names = get_chat_history_excluded_dir_names()
            return any(entry.name not in excluded_dir_names for entry in entries)
        except OSError:
            return False
