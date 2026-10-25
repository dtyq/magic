"""复制已结束会话，打包并上传聊天历史。"""

from __future__ import annotations

import asyncio
import json
import re
import uuid
import zipfile
from collections.abc import AsyncIterator, Awaitable
from contextlib import asynccontextmanager
from pathlib import Path
from typing import TYPE_CHECKING

from agentlang.logger import get_logger
from app.core.models.agent_session import AgentSessionRef
from app.path_manager import PathManager
from app.service.topic_persistence import get_chat_history_excluded_dir_names
from app.utils.async_file_utils import (
    async_chmod,
    async_copy2,
    async_exists,
    async_is_symlink,
    async_mkdir,
    async_move_path,
    async_read_json,
    async_rmtree,
    async_scandir,
)
from app.utils.runtime_storage import ensure_runtime_directory

if TYPE_CHECKING:
    from app.infrastructure.storage.base import AbstractStorage

logger = get_logger(__name__)
_OPERATION_NAME = re.compile(r"[0-9a-f]{32}")


class ChatHistoryArchiveService:
    """两个调用方共享上传顺序，避免较早生成的包最后覆盖较新的包。"""

    _lock = asyncio.Lock()
    _io_tasks: dict[Path, asyncio.Task[None]] = {}
    _cleanup_tasks: set[asyncio.Task[None]] = set()

    async def publish_completed_session(self, session: AgentSessionRef) -> bool:
        """将完整终态会话复制到配置的子 Agent 目录；不依赖上传凭证。"""
        from app.service.chat_history_cleanup_service import ChatHistoryCleanupService

        async with self._lock:
            try:
                source = session.chat_history_dir
                if not source.is_relative_to(PathManager.get_runtime_dir().absolute()):
                    raise ValueError("Completed-session source must be inside local runtime storage")
                await self._require_completed_session(session)
                target = PathManager.get_subagent_chat_history_dir(session.target.agent_name, session.agent_id)
                for path in (target.parent, target):
                    if await async_is_symlink(path):
                        raise ValueError(f"Session archive destination must not be a symbolic link: {path}")
                cleaner = ChatHistoryCleanupService()
                # 锁顺序固定为归档锁 → 清理锁；清理器不能反向调用归档。
                async with cleaner._lock:
                    async with self._operation_directory() as operation_dir:
                        if await async_exists(target):
                            target_session = AgentSessionRef(session.target, session.agent_id, target)
                            try:
                                await self._require_completed_session(target_session)
                            except (OSError, ValueError):
                                pass
                            else:
                                await cleaner._run_locked()
                                return True
                        staged = operation_dir / "session"
                        await self._run_archive_io(
                            self._copy_session(source, staged), operation_dir
                        )
                        await self._require_completed_session(
                            AgentSessionRef(session.target, session.agent_id, staged)
                        )
                        await self._run_archive_io(
                            self._publish_directory(staged, target, operation_dir / "previous"),
                            operation_dir,
                        )
                        await cleaner._run_locked()
                logger.info(f"已保存完整子 Agent 历史: agent={session.agent_id}, path={target}")
                return True
            except Exception as error:
                logger.warning(f"发布完整子 Agent 历史失败: agent={session.agent_id}, error={error!r}")
                return False

    async def upload(self, *, topic_id: str, storage_service: AbstractStorage) -> bool:
        """打包配置目录中的聊天历史并上传，返回上传结果，不负责 checkpoint。"""
        from app.infrastructure.storage.base import BaseFileProcessor
        from app.service.chat_history_cleanup_service import ChatHistoryCleanupService
        from app.utils.init_client_message_util import InitClientMessageUtil
        from app.utils.path_utils import get_workspace_dir

        async with self._lock:
            try:
                if not topic_id or Path(topic_id).name != topic_id or topic_id in {".", ".."}:
                    raise ValueError("Invalid topic ID for chat-history archive")
                # SDK 上传可能仍在线程中完成。取消调用方后，新上传须等旧 I/O 结束，
                # 否则旧包仍可能较晚到达远端；等待者取消时不再发起新的上传。
                for pending in tuple(self._io_tasks.values()):
                    try:
                        await asyncio.shield(pending)
                    except Exception:
                        pass
                source = PathManager.get_chat_history_dir()
                if not await async_exists(source) or not await async_scandir(source):
                    logger.info("聊天历史目录为空或不存在，跳过处理")
                    return False
                async with self._operation_directory() as operation_dir:
                    archive_path = operation_dir / f"chat_history_{topic_id}.zip"
                    cleaner = ChatHistoryCleanupService()
                    async with cleaner._lock:
                        await cleaner._run_locked()
                        await self._run_archive_io(
                            self._write_archive(source, archive_path),
                            operation_dir,
                        )
                        await async_chmod(archive_path, 0o600)
                    # 上传使用已封闭的本地包。网络等待期间释放清理锁，但仍保持上传顺序。
                    configured_path = InitClientMessageUtil.get_chat_history_dir()
                    destination = configured_path or get_workspace_dir(storage_service.credentials)
                    object_key = BaseFileProcessor.combine_path(destination, archive_path.name)

                    async def send_archive() -> None:
                        await storage_service.upload(file=str(archive_path), key=object_key, options=None)
                        logger.info(f"聊天历史归档上传成功: topic={topic_id}, key={object_key}")

                    await self._run_archive_io(send_archive(), operation_dir)
                return True
            except Exception as error:
                logger.warning(f"聊天历史归档未上传: topic={topic_id}, error={error!r}")
                return False

    @staticmethod
    async def _require_completed_session(session: AgentSessionRef) -> None:
        from app.tools.subagent_runtime_models import SubagentStatus
        from app.tools.subagent_runtime_store import SubagentRuntimeStore

        root = session.chat_history_dir
        name = f"{session.target.agent_name}<{session.agent_id}>"
        for path in (root, root / f"{name}.session.json", root / f"{name}.json"):
            if await async_is_symlink(path):
                raise ValueError(f"Completed session must not contain symbolic links: {path}")
        document = await SubagentRuntimeStore.load_document(session.target.agent_name, session.agent_id, root)
        state = document.subagent
        if (
            state is None
            or state.agent_name != session.target.agent_name
            or state.agent_id != session.agent_id
            or state.status not in {SubagentStatus.DONE, SubagentStatus.ERROR, SubagentStatus.INTERRUPTED}
            or state.finished_at is None
        ):
            raise ValueError("Session has no matching terminal state")
        await async_read_json(root / f"{name}.json")

    @classmethod
    async def _copy_session(cls, source: Path, target: Path) -> None:
        """只复制实际生成的文件，拒绝跟随软链接，源会话保留用于排查。"""
        await async_mkdir(target, parents=True, exist_ok=True)
        await async_chmod(target, 0o700)
        for entry in await async_scandir(source):
            path = Path(entry.path)
            if entry.is_symlink():
                raise ValueError(f"Session archive contains a symbolic link: {path}")
            if entry.is_dir(follow_symlinks=False):
                await cls._copy_session(path, target / entry.name)
            elif entry.is_file(follow_symlinks=False):
                await async_copy2(path, target / entry.name)
                await async_chmod(target / entry.name, 0o600)
                if path.suffix == ".json":
                    await async_read_json(target / entry.name)
            else:
                raise ValueError(f"Unsupported session archive entry: {path}")

    @staticmethod
    async def _publish_directory(staged: Path, target: Path, previous: Path) -> None:
        await async_mkdir(target.parent, parents=True, exist_ok=True)
        previous_ready = False
        publication_started = False
        try:
            if await async_exists(target):
                await async_move_path(target, previous)
                previous_ready = True
            # runtime 与 localfs 可能跨设备；复用支持目录复制后移动的统一异步入口。
            publication_started = True
            await async_move_path(staged, target)
        except (Exception, asyncio.CancelledError):
            if publication_started and await async_exists(target):
                await async_rmtree(target)
            if previous_ready:
                await async_move_path(previous, target)
            raise

    @staticmethod
    async def _write_archive(source: Path, archive_path: Path) -> None:
        """遍历一次源目录，再在线程中压缩；保存实际读取的内容，不冻结活动会话。"""
        files: list[Path] = []
        directories: list[Path] = []
        excluded = get_chat_history_excluded_dir_names()

        async def collect(directory: Path) -> None:
            for entry in await async_scandir(directory):
                path = Path(entry.path)
                relative = path.relative_to(source)
                if entry.is_dir(follow_symlinks=False):
                    if entry.name not in excluded:
                        directories.append(relative)
                        await collect(path)
                elif entry.is_file(follow_symlinks=False):
                    files.append(relative)
                else:
                    raise ValueError(f"Unsupported chat-history archive entry: {path}")

        await collect(source)

        def compress() -> None:
            with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as archive:
                for relative in sorted(directories):
                    archive.writestr(relative.as_posix() + "/", "")
                for relative in sorted(files):
                    archive.write(source / relative, relative.as_posix())
            with zipfile.ZipFile(archive_path) as archive:
                for relative in files:
                    if relative.suffix == ".json":
                        # 文件写入者不共享清理锁；半写 JSON 不能覆盖上一份可恢复的远端包。
                        json.loads(archive.read(relative.as_posix()))

        await asyncio.to_thread(compress)

    @classmethod
    @asynccontextmanager
    async def _operation_directory(cls) -> AsyncIterator[Path]:
        root = await ensure_runtime_directory(PathManager.get_chat_history_archive_dir())
        for entry in await async_scandir(root):
            path = Path(entry.path)
            if (
                _OPERATION_NAME.fullmatch(entry.name)
                and entry.is_dir(follow_symlinks=False)
                and path not in cls._io_tasks
            ):
                try:
                    await async_rmtree(path)
                except OSError as error:
                    logger.warning(f"清理上次归档临时目录失败: {path}: {error}")
        operation_dir = await ensure_runtime_directory(root / uuid.uuid4().hex)
        try:
            yield operation_dir
        finally:
            if operation_dir not in cls._io_tasks:
                try:
                    await async_rmtree(operation_dir)
                except OSError as error:
                    # 本地回收失败不改变已经完成的发布／上传结果，下次操作继续回收。
                    logger.warning(f"清理本次归档临时目录失败: {operation_dir}: {error}")

    @classmethod
    async def _run_archive_io(cls, operation: Awaitable[None], directory: Path) -> None:
        """取消调用方不取消仍在使用临时文件的 I/O；完成后再回收目录。"""
        async def run() -> None:
            await operation

        task = asyncio.create_task(run())
        cls._io_tasks[directory] = task
        try:
            await asyncio.shield(task)
        except asyncio.CancelledError:
            cleanup = asyncio.create_task(cls._finish_cancelled_operation(task, directory))
            cls._cleanup_tasks.add(cleanup)
            cleanup.add_done_callback(cls._cleanup_tasks.discard)
            raise
        else:
            cls._io_tasks.pop(directory, None)
        finally:
            if task.done() and not task.cancelled() and task.exception() is not None:
                cls._io_tasks.pop(directory, None)

    @classmethod
    async def _finish_cancelled_operation(cls, task: asyncio.Task[None], directory: Path) -> None:
        try:
            await task
        except (Exception, asyncio.CancelledError) as error:
            logger.debug(f"已取消归档的 I/O 结束: {directory}: {error!r}")
        finally:
            try:
                await async_rmtree(directory)
            except OSError as error:
                logger.warning(f"清理已取消归档目录失败: {directory}: {error}")
            finally:
                cls._io_tasks.pop(directory, None)
