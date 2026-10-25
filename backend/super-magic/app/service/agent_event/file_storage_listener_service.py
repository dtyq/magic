"""
文件存储监听器服务，用于监听文件事件并上传文件到对象存储服务
"""

import asyncio
import hashlib
import json
import os
import shutil
import tempfile
import time
import traceback
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Union

from app.utils.async_file_utils import (
    async_stat,
    async_read_json,
    async_write_text,
    async_exists,
    get_file_id_from_xattr,
    get_s3_key_from_xattr,
)

from agentlang.context.tool_context import ToolContext
from agentlang.event.data import (
    AfterMainAgentRunEventData,
    AgentSuspendedEventData,
    BeforeMainAgentRunEventData,
    ErrorEventData,
)
from agentlang.event.event import Event, EventType
from agentlang.logger import get_logger
from app.core.config.debug_config import is_local_debug_mode_enabled
from app.core.context.agent_context import AgentContext
from app.core.entity.attachment import Attachment, AttachmentTag
from app.core.entity.checkpoint import FileSnapshot
from app.core.entity.event.file_event import FileEventData  # 从业务层导入 FileEventData
from app.core.entity.project_archive import ArchiveDetail, ProjectArchiveInfo
from app.infrastructure.checkpoint.remote_sync import CheckpointRemoteSync
from app.infrastructure.storage.base import BaseFileProcessor
from app.infrastructure.storage.factory import StorageFactory
from app.infrastructure.storage.types import StorageResponse
from app.path_manager import PathManager
from app.service.agent_event.base_listener_service import BaseListenerService
from app.service.topic_persistence import (
    TopicPersistenceManager,
)
from app.utils.init_client_message_util import InitClientMessageUtil
from app.utils.path_utils import get_workspace_dir, get_storage_dir_with_fallback

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class ConstructedFileKey:
    """Object-storage location of a workspace file managed by magicfs."""

    file_key: str
    file_id: Optional[str]


@dataclass(frozen=True, slots=True)
class LocalDebugWorkspaceFileState:
    """本地调试工作区文件状态，用于识别单次任务产生的文件变更。"""

    path: Path
    size: int
    modified_time_ns: int
    changed_time_ns: int

    def signature(self) -> tuple[int, int, int]:
        """返回用于比较文件是否变化的状态签名。"""
        return self.size, self.modified_time_ns, self.changed_time_ns


class FileStorageListenerService:
    """
    文件存储监听器服务，用于监听文件事件并将文件上传到对象存储服务
    """

    _local_debug_workspace_snapshots: Dict[str, Dict[str, LocalDebugWorkspaceFileState]] = {}

    @staticmethod
    def register_standard_listeners(agent_context: AgentContext) -> None:
        """
        为代理上下文注册文件事件监听器

        Args:
            agent_context: 代理上下文对象
        """
        # 创建事件类型到处理函数的映射
        event_listeners = {
            EventType.BEFORE_MAIN_AGENT_RUN: FileStorageListenerService._handle_before_main_agent_run,
            EventType.FILE_CREATED: FileStorageListenerService._handle_file_event,
            EventType.FILE_UPDATED: FileStorageListenerService._handle_file_event,
            EventType.FILE_DELETED: FileStorageListenerService._handle_file_deleted,
            EventType.AFTER_MAIN_AGENT_RUN: FileStorageListenerService._handle_after_main_agent_run,
            EventType.ERROR: FileStorageListenerService._handle_error,
        }

        # 使用基类方法批量注册监听器
        BaseListenerService.register_listeners(agent_context, event_listeners)

        logger.info("已为代理上下文注册文件事件、主代理运行前后事件和错误清理监听器")

    @staticmethod
    async def _handle_before_main_agent_run(event: Event[BeforeMainAgentRunEventData]) -> None:
        """
        在主代理运行前保存本地调试工作区基线。

        Args:
            event: 主代理运行前事件
        """
        agent_context = event.data.agent_context
        snapshot_key = FileStorageListenerService._get_local_debug_snapshot_key(agent_context)
        FileStorageListenerService._local_debug_workspace_snapshots.pop(snapshot_key, None)

        if not FileStorageListenerService._should_collect_local_debug_attachments(agent_context):
            return

        snapshot = FileStorageListenerService._snapshot_local_debug_workspace(agent_context)
        FileStorageListenerService._local_debug_workspace_snapshots[snapshot_key] = snapshot
        logger.info(f"已保存本地调试工作区任务前快照，共 {len(snapshot)} 个文件")

    @staticmethod
    async def _handle_error(event: Event[ErrorEventData]) -> None:
        """
        在任务异常结束时清理本地调试工作区快照。

        Args:
            event: 任务错误事件
        """
        snapshot_key = FileStorageListenerService._get_local_debug_snapshot_key(event.data.agent_context)
        FileStorageListenerService._local_debug_workspace_snapshots.pop(snapshot_key, None)

    @staticmethod
    async def _handle_file_event(event: Event[FileEventData]) -> None:
        """
        处理文件事件（创建和更新）

        Args:
            event: 文件事件对象，包含FileEventData数据
        """
        event_type_name = "创建" if event.event_type == EventType.FILE_CREATED else "更新"
        logger.info(f"处理文件{event_type_name}事件: {event.data.filepath}")

        # 1. 构造文件存储键（仅消费 magicfs xattr，没有 xattr 视为 magicfs 未接管，跳过）
        constructed = await FileStorageListenerService._construct_file_key(
            event.data.filepath,
        )

        # 2. 如果构造成功，创建附件并添加到事件上下文
        #    注意: 这里只往 event_context 里加 (per-tool-call, 用于 AFTER_TOOL_CALL 消息实时上报),
        #    不再写入 agent_context.attachments。agent_context 的最终变更附件会在
        #    AFTER_MAIN_AGENT_RUN 时一次性从 checkpoint 收集 (见 _handle_after_main_agent_run)。
        if constructed:
            try:
                attachment = FileStorageListenerService._create_attachment_from_uploaded_file(
                    filepath=event.data.filepath,
                    file_key=constructed.file_key,
                    file_id=constructed.file_id,
                    file_event_data=event.data
                )

                FileStorageListenerService._add_attachment_to_event_context(event.data.tool_context, attachment)
            except Exception as e:
                logger.error(f"处理附件信息失败: {e}")


    @staticmethod
    async def _handle_file_deleted(event: Event[FileEventData]) -> None:
        """
        处理文件删除事件

        Args:
            event: 文件删除事件对象，包含FileEventData数据
        """
        logger.info(f"处理文件删除事件: {event.data.filepath}")
        # 文件已被删除，所以不需要上传
        # 根据业务需求，可以在这里实现删除存储服务上的文件的逻辑
        pass

    @staticmethod
    async def _handle_after_main_agent_run(event: Event[AfterMainAgentRunEventData]) -> None:
        """
        处理主代理完成事件：
        1. 从当前消息对应的 checkpoint 里收集本轮变更的文件，一次性填充到
           agent_context.attachments (替代原来通过 FILE_CREATED / FILE_UPDATED
           事件逐次写入的方式)，这样 shell / python 脚本等绕过工具层的写入
           也能被 magicfs 捕获并正确形成最终附件
        2. 基于填充后的 attachments 创建文件版本
        3. 本地调试客户端显式开启时，通过任务前后快照差分补充模拟附件

        执行顺序依赖: dispatcher 按注册顺序顺序 await 监听器，FileStorage 的
        AFTER_MAIN_AGENT_RUN 比 StreamListener / ResourceCleanup 都先跑，
        因此 StreamListener 读到的 attachments 已经就绪。

        Args:
            event: 主代理完成事件对象，包含 AfterMainAgentRunEventData 数据
        """
        agent_context = event.data.agent_context

        logger.info("处理主代理完成事件：从 checkpoint 收集变更附件")
        await FileStorageListenerService._collect_changed_attachments_from_checkpoint(agent_context)

        logger.info("处理主代理完成事件：创建文件版本")
        await FileStorageListenerService._create_file_versions_from_checkpoint(agent_context)

        FileStorageListenerService._collect_local_debug_attachments(agent_context)

    @staticmethod
    def _collect_local_debug_attachments(agent_context: AgentContext) -> None:
        """
        在本地调试模式下，为未接入 magicfs 的普通工作区模拟最终附件候选。

        仅当调试客户端显式开启、且真实附件为空时执行。模拟附件加入上下文后，
        后续仍由 AttachmentSorter 按 finish_task 或时间戳规则排序，再写入 finished 消息。

        Args:
            agent_context: 当前主代理上下文
        """
        if not FileStorageListenerService._should_collect_local_debug_attachments(agent_context):
            return

        snapshot_key = FileStorageListenerService._get_local_debug_snapshot_key(agent_context)
        before_snapshot = FileStorageListenerService._local_debug_workspace_snapshots.pop(snapshot_key, None)
        if agent_context.get_attachments():
            return
        if before_snapshot is None:
            logger.warning("未找到本地调试工作区任务前快照，跳过模拟 finished 附件")
            return

        try:
            after_snapshot = FileStorageListenerService._snapshot_local_debug_workspace(agent_context)
            changed_files = [
                (relative_path, state)
                for relative_path, state in after_snapshot.items()
                if relative_path not in before_snapshot
                or state.signature() != before_snapshot[relative_path].signature()
            ]

            collected = 0
            for relative_path, state in changed_files:
                try:
                    attachment = FileStorageListenerService._build_attachment(
                        filepath=str(state.path),
                        file_key=f"local-debug/workspace/{relative_path}",
                        file_id=f"local-debug-{hashlib.sha256(relative_path.encode('utf-8')).hexdigest()[:16]}",
                        file_tag=AttachmentTag.PROCESS,
                    )
                    attachment.timestamp = state.modified_time_ns // 1_000_000_000
                    agent_context.add_attachment(attachment)
                    collected += 1
                except OSError as error:
                    logger.warning(f"跳过无法读取的本地调试附件 {state.path}: {error}")

            logger.info(
                f"本地调试附件模拟完成，共识别 {len(changed_files)} 个本轮新增或修改文件，"
                f"成功加入 {collected} 个附件"
            )
        except Exception as error:
            logger.warning(f"本地调试附件模拟失败: {error}", exc_info=True)

    @staticmethod
    def _snapshot_local_debug_workspace(
        agent_context: AgentContext,
    ) -> Dict[str, LocalDebugWorkspaceFileState]:
        """
        获取本地调试工作区的非隐藏普通文件状态快照。

        Args:
            agent_context: 当前主代理上下文

        Returns:
            Dict[str, LocalDebugWorkspaceFileState]: 相对路径到文件状态的映射
        """
        workspace_dir = Path(agent_context.get_workspace_dir() or PathManager.get_workspace_dir()).resolve()
        if not workspace_dir.exists() or not workspace_dir.is_dir():
            logger.warning(f"本地调试工作区不存在: {workspace_dir}")
            return {}

        snapshot: Dict[str, LocalDebugWorkspaceFileState] = {}
        for root, dir_names, file_names in os.walk(workspace_dir):
            dir_names[:] = [
                name for name in sorted(dir_names, key=lambda item: item.lower())
                if not name.startswith(".") and not (Path(root) / name).is_symlink()
            ]
            for file_name in sorted(file_names, key=lambda item: item.lower()):
                path = Path(root) / file_name
                if file_name.startswith(".") or path.is_symlink():
                    continue
                try:
                    stat_result = path.stat()
                    relative_path = path.relative_to(workspace_dir).as_posix()
                    snapshot[relative_path] = LocalDebugWorkspaceFileState(
                        path=path,
                        size=stat_result.st_size,
                        modified_time_ns=stat_result.st_mtime_ns,
                        changed_time_ns=stat_result.st_ctime_ns,
                    )
                except OSError as error:
                    logger.warning(f"跳过无法读取状态的本地调试文件 {path}: {error}")
        return snapshot

    @staticmethod
    def _get_local_debug_snapshot_key(agent_context: AgentContext) -> str:
        """
        获取本地调试工作区快照键，隔离不同代理上下文。

        Args:
            agent_context: 当前主代理上下文

        Returns:
            str: 当前上下文对应的快照键
        """
        return str(getattr(agent_context, "context_id", id(agent_context)))

    @staticmethod
    def _should_collect_local_debug_attachments(agent_context: AgentContext) -> bool:
        """
        判断当前请求是否允许模拟 finished 附件。

        Args:
            agent_context: 当前主代理上下文

        Returns:
            bool: 同时满足本地调试环境和客户端显式开关时返回 True
        """
        if not is_local_debug_mode_enabled():
            return False

        chat_message = agent_context.get_chat_client_message()
        dynamic_config = getattr(chat_message, "dynamic_config", None) or {}
        if not isinstance(dynamic_config, dict):
            return False
        return dynamic_config.get("enable_debug_finished_attachments") is True

    @staticmethod
    def _calculate_directory_hash(directory_path: str) -> str:
        """
        Calculate hash of directory contents to detect changes

        Args:
            directory_path: Path to directory

        Returns:
            str: MD5 hash of directory contents
        """
        if not os.path.exists(directory_path) or not os.path.isdir(directory_path):
            return ""

        md5_hash = hashlib.md5()

        try:
            # Walk through directory and hash all files
            for root, dirs, files in os.walk(directory_path):
                # Sort to ensure consistent ordering
                dirs.sort()
                files.sort()

                for filename in files:
                    file_path = os.path.join(root, filename)
                    try:
                        # Add relative path to hash
                        relative_path = os.path.relpath(file_path, directory_path)
                        md5_hash.update(relative_path.encode('utf-8'))

                        # Add file content to hash
                        with open(file_path, 'rb') as f:
                            for chunk in iter(lambda: f.read(4096), b""):
                                md5_hash.update(chunk)
                    except (IOError, OSError) as e:
                        logger.warning(f"跳过无法读取的文件 {file_path}: {e}")
                        continue

        except Exception as e:
            logger.error(f"计算目录哈希时出错 {directory_path}: {e}")
            return ""

        return md5_hash.hexdigest()

    @staticmethod
    def _load_local_manifest() -> Optional[ProjectArchiveInfo]:
        """
        Load local project archive manifest

        Returns:
            Optional[ProjectArchiveInfo]: Local manifest or None if not exists/invalid
        """
        try:
            project_archive_info_file = PathManager.get_project_archive_info_file()
            if not os.path.exists(project_archive_info_file):
                logger.info("本地清单文件不存在")
                return None

            with open(project_archive_info_file, 'r') as f:
                data = json.load(f)

            # Try to parse as new format first
            try:
                return ProjectArchiveInfo(**data)
            except Exception:
                # If new format fails, this might be legacy format or corrupted
                logger.info("本地清单文件格式需要升级")
                return None

        except Exception as e:
            logger.error(f"加载本地清单文件时出错: {e}")
            return None

    @staticmethod
    def _get_current_version() -> int:
        """
        获取当前项目压缩包的版本号

        Returns:
            int: 当前版本号，如果文件不存在则返回0
        """
        try:
            project_archive_info_file = PathManager.get_project_archive_info_file()
            if os.path.exists(project_archive_info_file):
                with open(project_archive_info_file, 'r') as f:
                    info = json.load(f)
                    return info.get('version', 0)
            return 0
        except Exception as e:
            logger.error(f"获取当前版本号时出错: {e}")
            return 0

    @staticmethod
    async def _save_and_upload_project_archive_info(
        project_archive_info: ProjectArchiveInfo,
        agent_context: AgentContext
    ) -> Optional[StorageResponse]:
        """
        保存项目存档信息到本地文件并上传到OSS

        Args:
            project_archive_info: 项目存档信息对象
            agent_context: 代理上下文对象

        Returns:
            Optional[StorageResponse]: 上传响应，失败则为None
        """
        # 持久化项目存档信息到本地文件
        project_archive_info_file = PathManager.get_project_archive_info_file()
        with open(project_archive_info_file, 'w') as f:
            json.dump(project_archive_info.model_dump(), f)
            logger.info(f"项目存档信息已保存到本地: {project_archive_info_file}")

        # 从agent_context获取storage_service
        metadata = agent_context.get_metadata()
        sts_token_refresh = agent_context.get_init_client_message_sts_token_refresh()

        # 获取平台类型，优先使用客户端消息中指定的平台
        platform_type = agent_context.get_init_client_message_platform_type()

        storage_service = await StorageFactory.get_storage(
            sts_token_refresh=sts_token_refresh,
            metadata=metadata,
            platform=platform_type
        )

        # 上传项目存档信息文件到OSS
        project_archive_info_file_relative_path = PathManager.get_project_archive_info_file_relative_path()
        info_file_key = BaseFileProcessor.combine_path(get_workspace_dir(storage_service.credentials), project_archive_info_file_relative_path)
        info_response = await storage_service.upload(
            file=str(project_archive_info_file),
            key=info_file_key,
            options={}
        )

        if info_response:
            logger.info(f"项目存档信息文件已上传: {info_file_key}")
        else:
            logger.error("项目存档信息文件上传失败")

        return info_response

    @staticmethod
    async def _archive_and_upload_project(agent_context: AgentContext) -> bool:
        """
        Compress and upload project directories separately with independent versioning

        Args:
            agent_context: Agent context object
        """
        # 通过环境变量控制是否执行归档，本地开发可设置为 false 跳过
        enable_archive = os.getenv("ENABLE_PROJECT_ARCHIVE", "true").lower() == "true"
        if not enable_archive:
            logger.info("ENABLE_PROJECT_ARCHIVE=false，跳过项目归档上传")
            return False

        try:
            # Get directory paths
            workspace_dir = PathManager.get_workspace_dir()
            metadata = agent_context.get_metadata()
            topic_id = metadata.get("topic_id") or metadata.get("chat_topic_id")

            if not topic_id:
                logger.error("无法获取topic_id，无法进行分离式打包")
                return False

            # Load local manifest to check current state
            # local_manifest = FileStorageListenerService._load_local_manifest()

            # Initialize storage service
            sts_token_refresh = agent_context.get_init_client_message_sts_token_refresh()
            platform_type = agent_context.get_init_client_message_platform_type()

            storage_service = await StorageFactory.get_storage(
                sts_token_refresh=sts_token_refresh,
                metadata=metadata,
                platform=platform_type
            )

            # Process and upload workspace archive if changed
            # workspace_archive_detail = await FileStorageListenerService._process_workspace_archive(
            #     workspace_dir, local_manifest, storage_service
            # )
            # if workspace_archive_detail:
            #     project_archive_info = ProjectArchiveInfo(archives={})
            #     project_archive_info.set_workspace_archive(workspace_archive_detail)
            #     logger.info("工作区归档信息已更新")
            # else:
            #     # If workspace has not changed, use the existing manifest or create a new one
            #     project_archive_info = local_manifest or ProjectArchiveInfo(archives={})

            # Process and upload chat history archive
            from app.service.chat_history_archive_service import ChatHistoryArchiveService
            uploaded = await ChatHistoryArchiveService().upload(
                topic_id=topic_id, storage_service=storage_service
            )
            if uploaded:
                persistence = TopicPersistenceManager(PathManager.get_project_root())
                try:
                    await asyncio.to_thread(persistence.clear_topic_chat_history)
                except Exception as error:
                    # 清理失败不应覆盖 Agent 结果，也不应阻断 checkpoint 的后续同步。
                    logger.warning(
                        "聊天历史归档已上传，但清理 .topic/chat_history 失败，后续启动将重试: %s",
                        error,
                        exc_info=True,
                    )
                else:
                    logger.info("聊天历史归档上传成功，已清理 .topic/chat_history")
            else:
                logger.warning("本轮聊天历史归档未上传；未清理已有 .topic/chat_history，本轮未更新该副本")

            # 每轮只上传本轮 checkpoint 归档与 manifest（不再整目录打包全量上传）
            await FileStorageListenerService._sync_checkpoints_archive(topic_id, storage_service)
            return uploaded

            # Save and upload the final manifest
            # await FileStorageListenerService._save_and_upload_project_archive_info(project_archive_info, agent_context)

        except Exception as e:
            logger.error(f"分离式打包和上传过程中发生错误: {e}")
            logger.error(traceback.format_exc())
            return False

    @staticmethod
    async def _process_workspace_archive(
        workspace_dir: str,
        local_manifest: Optional[ProjectArchiveInfo],
        storage_service
    ) -> Optional[ArchiveDetail]:
        """
        Process workspace directory archive with change detection

        Args:
            workspace_dir: Workspace directory path
            local_manifest: Local manifest for version comparison
            storage_service: Storage service instance

        Returns:
            Optional[ArchiveDetail]: Updated archive detail or None if no changes
        """
        try:
            # Calculate current directory hash
            current_hash = FileStorageListenerService._calculate_directory_hash(str(workspace_dir))

            # Get existing workspace archive info
            existing_archive = None
            if local_manifest:
                existing_archive = local_manifest.get_workspace_archive()

            # Check if we need to update (no existing archive or hash changed)
            needs_update = True
            if existing_archive and hasattr(existing_archive, 'file_md5'):
                # For now, we'll always update since we don't store directory hash
                # In future, we could store directory hash in archive detail
                needs_update = True

            if not needs_update:
                logger.info("工作区目录未发生变化，跳过打包")
                return existing_archive

            # Compress workspace directory
            workspace_zip = FileStorageListenerService._compress_directory(
                directory_paths=[str(workspace_dir)],
                output_filename="project_archive"
            )

            if not workspace_zip:
                logger.error("压缩工作区目录失败")
                return existing_archive

            try:
                # Calculate file metadata
                file_size = os.path.getsize(workspace_zip)
                file_md5 = FileStorageListenerService._calculate_file_md5(workspace_zip)

                # Upload to storage
                file_key = BaseFileProcessor.combine_path(
                    get_workspace_dir(storage_service.credentials),
                    "project_archive.zip"
                )

                storage_response = await storage_service.upload(
                    file=workspace_zip,
                    key=file_key,
                    options={}
                )

                if not storage_response:
                    logger.error("上传工作区压缩包失败")
                    return existing_archive

                # Determine new version
                new_version = 1
                if existing_archive:
                    new_version = existing_archive.version + 1

                logger.info(f"工作区压缩包上传成功，版本: {new_version}")

                return ArchiveDetail(
                    file_key=storage_response.key,
                    file_size=file_size,
                    file_md5=file_md5,
                    version=new_version
                )

            finally:
                # Clean up temporary file
                if os.path.exists(workspace_zip):
                    try:
                        os.remove(workspace_zip)
                        logger.debug(f"已删除临时工作区压缩文件: {workspace_zip}")
                    except Exception as e:
                        logger.warning(f"删除临时工作区压缩文件失败: {e}")

        except Exception as e:
            logger.error(f"处理工作区归档时出错: {e}")
            return None

    @staticmethod
    async def _sync_checkpoints_archive(topic_id: str, storage_service) -> None:
        """
        每轮同步 checkpoint 归档与 manifest。

        归档补齐、一致发布与差异删除的逻辑都在 CheckpointRemoteSync 内部：
        未上传成功的归档每轮自动重试，且只有 manifest 引用的所有归档都确认
        上传后才发布 manifest，保证远端不出现指向空归档的 checkpoint。
        """
        if not topic_id or storage_service is None:
            logger.warning("缺少 topic_id 或 storage_service，跳过 checkpoint 归档同步")
            return

        try:
            await CheckpointRemoteSync(storage_service, topic_id).sync_manifest_and_evicted()
            logger.info(f"话题 {topic_id} 的 checkpoint 归档同步完成")
        except Exception as e:
            logger.error(f"同步 checkpoints 归档时出错: {e}", exc_info=True)

    @staticmethod
    def _calculate_file_md5(file_path: str) -> str:
        """
        Calculate MD5 hash of a file

        Args:
            file_path: Path to file

        Returns:
            str: MD5 hash of file
        """
        md5_hash = hashlib.md5()
        try:
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    md5_hash.update(chunk)
        except Exception as e:
            logger.error(f"计算文件MD5时出错 {file_path}: {e}")
            return ""
        return md5_hash.hexdigest()

    @staticmethod
    async def _construct_file_key(filepath: str) -> Optional[ConstructedFileKey]:
        """
        Resolve the magicfs object-storage key for a workspace file.

        Reads ``user.magicfs.s3_key`` (and ``user.magicfs.file_id``) directly
        from xattr. Files without ``s3_key`` xattr are skipped — they are not
        managed by magicfs and any synthetic key would only feed dead links
        to ``create_file_version`` and the frontend.

        Args:
            filepath: 文件绝对路径

        Returns:
            Optional[ConstructedFileKey]: None when the file does not exist
              or has no magicfs xattr. ``file_id`` may still be None when
              ``user.magicfs.file_id`` is absent (e.g. read-only mounts).
        """
        if not await async_exists(filepath):
            logger.warning(f"文件不存在，跳过 file_key 构造: {filepath}")
            return None

        s3_key, file_id = await asyncio.gather(
            get_s3_key_from_xattr(filepath),
            get_file_id_from_xattr(filepath),
        )

        if not s3_key:
            logger.error(
                f"文件无 magicfs xattr (user.magicfs.s3_key)，跳过 file_key 构造: {filepath}"
            )
            return None

        logger.info(
            f"构造文件键成功: {filepath}, file_id: {file_id}, 存储键: {s3_key}"
        )
        return ConstructedFileKey(file_key=s3_key, file_id=file_id)

    @staticmethod
    async def create_workspace_attachment(filepath: str) -> Attachment:
        """投递前取得真实文件身份；无 MagicFS key 时拒绝产生不可下载的镜像。"""
        constructed = await FileStorageListenerService._construct_file_key(filepath)
        if constructed is None:
            raise ValueError("The file has no MagicFS storage identity; wait for file synchronization.")
        stat = await async_stat(filepath)
        return FileStorageListenerService._build_attachment(
            filepath, constructed.file_key, constructed.file_id, AttachmentTag.FINAL,
            file_size=stat.st_size,
        )

    @staticmethod
    def _create_attachment_from_uploaded_file(
        filepath: str,
        file_key: str,
        file_event_data: FileEventData,
        file_id: Optional[str] = None,
    ) -> Attachment:
        """
        根据文件事件数据创建附件对象 (用于 event_context 实时上报链路)。

        Args:
            filepath: 原始文件路径
            file_key: 文件存储键
            file_event_data: 文件事件数据
            file_id: magicfs xattr file ID (user.magicfs.file_id), optional

        Returns:
            Attachment: 创建的附件对象
        """
        file_tag = AttachmentTag.BROWSER if file_event_data.is_screenshot else AttachmentTag.PROCESS
        attachment = FileStorageListenerService._build_attachment(
            filepath=filepath,
            file_key=file_key,
            file_id=file_id,
            file_tag=file_tag,
            source=file_event_data.source,
        )
        logger.info(
            f"已创建附件对象: {attachment.filename}, 路径: {filepath}, "
            f"标签: {file_tag}, file_key: {file_key}"
        )
        return attachment

    @staticmethod
    def _add_attachment_to_event_context(tool_context: ToolContext, attachment: Attachment) -> None:
        """
        将附件添加到事件上下文

        Args:
            tool_context: 工具上下文
            attachment: 附件对象
        """
        try:
            # 直接使用已注册的EventContext
            from app.core.entity.event.event_context import EventContext
            event_context = tool_context.get_extension_typed("event_context", EventContext)
            if event_context:
                event_context.add_attachment(attachment)
                logger.info(f"已将文件 {attachment.filename} 作为附件添加到事件上下文")
            else:
                logger.warning("无法添加附件到事件上下文：EventContext未注册")
        except Exception as e:
            logger.error(f"添加附件到事件上下文失败: {e}")

    @staticmethod
    def _compress_directory(directory_paths: Union[str, List[str]], output_filename: str) -> Optional[str]:
        """
        压缩指定目录，支持单个或多个目录

        Args:
            directory_paths: 要压缩的目录路径，可以是单个字符串或路径列表
            output_filename: 输出的压缩文件名（不含扩展名）

        Returns:
            Optional[str]: 成功则返回压缩文件的完整路径，失败则返回 None
        """
        try:
            # 将单个目录路径转换为列表以统一处理
            if isinstance(directory_paths, str):
                directories = [directory_paths]
            else:
                directories = directory_paths

            # 如果只有一个目录，使用原有的直接压缩逻辑（更高效）
            if len(directories) == 1 and os.path.exists(directories[0]) and os.path.isdir(directories[0]):
                directory_path = directories[0]
                # 创建临时目录以存放压缩文件
                tmp_dir = tempfile.mkdtemp()
                base_name = os.path.join(tmp_dir, output_filename)

                # 创建 .zip 格式的压缩文件
                compressed_file = shutil.make_archive(
                    base_name=base_name,  # 压缩文件的基本名称（不含扩展名）
                    format='zip',         # 压缩格式，这里使用 zip
                    root_dir=os.path.dirname(directory_path),  # 根目录（包含要压缩的目录的父目录）
                    base_dir=os.path.basename(directory_path)  # 要压缩的目录名称
                )

                logger.info(f"成功压缩目录 {directory_path} 到 {compressed_file}")
                return compressed_file

            # 多个目录的情况，需要先复制到临时目录再压缩
            # 创建临时目录作为压缩源
            temp_source_dir = tempfile.mkdtemp()

            # 复制所有有效目录到临时目录中
            valid_dirs = False
            for directory in directories:
                if not os.path.exists(directory) or not os.path.isdir(directory):
                    logger.warning(f"要压缩的目录不存在: {directory}")
                    continue

                valid_dirs = True
                dir_name = os.path.basename(directory)
                target_dir = os.path.join(temp_source_dir, dir_name)
                shutil.copytree(directory, target_dir)

            if not valid_dirs:
                logger.error("没有有效的目录可供压缩")
                shutil.rmtree(temp_source_dir)
                return None

            # 创建临时目录以存放压缩文件
            tmp_dir = tempfile.mkdtemp()
            base_name = os.path.join(tmp_dir, output_filename)

            # 创建 .zip 格式的压缩文件
            compressed_file = shutil.make_archive(
                base_name=base_name,  # 压缩文件的基本名称（不含扩展名）
                format='zip',         # 压缩格式，这里使用 zip
                root_dir=temp_source_dir,  # 根目录
                base_dir='.'          # 压缩临时目录中的所有内容
            )

            # 清理临时源目录
            shutil.rmtree(temp_source_dir)

            logger.info(f"成功将多个目录压缩到 {compressed_file}")
            return compressed_file
        except Exception as e:
            logger.error(f"压缩目录过程中发生错误: {e}")
            return None

    @staticmethod
    async def _collect_changed_attachments_from_checkpoint(agent_context: AgentContext) -> None:
        """
        从当前消息的 checkpoint 中收集变更文件并填充到 agent_context.attachments。

        变更文件清单的权威来源是 magicfs 在 FUSE 层写入的 checkpoint_info.json，
        它覆盖所有写入路径 (工具、shell、python 脚本)，无需依赖 FILE_CREATED /
        FILE_UPDATED 事件。

        过滤规则:
        - 只收集项目空间条目（变更附件仅展示项目空间；user 空间等其它
          工作区空间只进文件版本链路，见空间注册表）；topic 空间（聊天
          历史等内部状态）不出现在用户可见变更里
        - 跳过目录快照 (版本与 attachment 都只针对文件)
        - 跳过 DELETED 操作 (文件已不存在，无法构造 attachment)
        - 不按隐藏路径过滤：以 "." 开头的目录（.magic/、.venv/ 等）里的
          持久文件同样进入变更附件与文件版本链路
        - 同一路径同一 checkpoint 内只取第一次出现 (file_snapshots 已是按顺序追加
          的操作流，保留首次即可)

        Args:
            agent_context: 代理上下文，attachments 会被就地追加
        """
        try:
            # 延迟导入: CheckpointService / CheckpointUtils 在顶层 import 会形成
            # file_storage_listener_service ↔ checkpoint_service 的循环依赖
            from app.service.checkpoint_service import CheckpointService
            from app.utils.checkpoint_utils import CheckpointUtils

            message_id = CheckpointUtils.get_current_checkpoint_context(agent_context)
            if not message_id:
                logger.warning("未能获取 message_id，跳过从 checkpoint 收集变更附件")
                return

            checkpoint_service = CheckpointService()
            checkpoint_info = await checkpoint_service.get_checkpoint(message_id)
            if not checkpoint_info or not checkpoint_info.file_snapshots:
                logger.info(f"checkpoint {message_id} 无文件变更，跳过收集变更附件")
                return

            relative_paths = FileStorageListenerService._collect_changed_file_paths(
                checkpoint_info.file_snapshots
            )
            if not relative_paths:
                logger.info(f"checkpoint {message_id} 过滤后无有效文件变更，跳过收集变更附件")
                return

            workspace_dir = PathManager.get_workspace_dir()
            collected = 0
            for relative_path in relative_paths:
                # 跨项目挂载（referenced-projects）的变更以 agent 视角绝对路径记录，
                # 直接使用该路径；workspace 内的相对路径仍拼 workspace 目录
                if os.path.isabs(relative_path):
                    absolute_path = relative_path
                else:
                    absolute_path = str(workspace_dir / relative_path.lstrip("/"))

                constructed = await FileStorageListenerService._construct_file_key(absolute_path)
                if not constructed:
                    continue

                try:
                    attachment = FileStorageListenerService._build_attachment(
                        filepath=absolute_path,
                        file_key=constructed.file_key,
                        file_id=constructed.file_id,
                        file_tag=AttachmentTag.PROCESS,
                    )
                except Exception as build_err:
                    logger.error(
                        f"从 checkpoint 构造附件失败 ({relative_path}): {build_err}"
                    )
                    continue

                agent_context.add_attachment(attachment)
                collected += 1

            logger.info(
                f"checkpoint {message_id} 共收集 {collected} 个变更附件到 agent_context "
                f"(候选路径 {len(relative_paths)} 个)"
            )
        except Exception as e:
            logger.error(f"从 checkpoint 收集变更附件失败: {e}", exc_info=True)

    @staticmethod
    def _collect_changed_file_paths(file_snapshots: List[FileSnapshot]) -> List[str]:
        """
        从 checkpoint 流水中挑出需要构造 attachment 的文件路径。

        选择逻辑（含空间过滤：topic/聊天历史条目不呈现给用户、目录与删除
        跳过）委托 infrastructure 层纯函数，便于单测直接覆盖；
        本方法保留仅为调用点稳定。

        Args:
            file_snapshots: 聚合后的 checkpoint_info.file_snapshots

        Returns:
            List[str]: 按首次出现顺序去重后的文件路径列表；workspace 内文件为
            相对路径，跨项目挂载（referenced-projects）文件为 agent 视角绝对路径
        """
        from app.infrastructure.checkpoint.attachment_candidates import (
            select_changed_attachment_paths,
        )

        return select_changed_attachment_paths(file_snapshots)
    @staticmethod
    def _build_attachment(
        filepath: str,
        file_key: str,
        file_id: Optional[str],
        file_tag: AttachmentTag,
        source: int = 3,
        file_size: Optional[int] = None,
    ) -> Attachment:
        """
        构造 Attachment 对象的公共实现，供事件路径与 checkpoint 路径共用。

        Args:
            filepath: 文件绝对路径
            file_key: 对象存储 key (来自 magicfs xattr)
            file_id: magicfs file_id (可为 None)
            file_tag: 附件标签
            source: 文件来源编码，默认 3 (容器生成)

        Returns:
            Attachment: 构造好的附件对象
        """
        file_path_obj = Path(filepath)
        if file_size is None:
            file_size = os.path.getsize(filepath)
        file_ext = file_path_obj.suffix.lstrip('.')
        file_name = file_path_obj.name

        return Attachment(
            file_key=file_key,
            file_id=file_id,
            file_tag=file_tag,
            file_extension=file_ext,
            filepath=filepath,
            filename=file_name,
            display_filename=file_name,
            file_size=file_size,
            file_url=None,
            source=source,
            timestamp=int(time.time()),
        )

    @staticmethod
    async def _create_file_versions_from_checkpoint(agent_context: AgentContext) -> bool:
        """
        从 checkpoint 流水创建文件版本（工作区空间：project / user）。

        文件版本与变更附件是两条独立策略：附件列表仅展示项目空间变更，
        版本创建覆盖全部工作区空间（如用户空间 .magic/ 下的记忆文件）。
        权威数据源是 agfs 侧按空间分区的 operations.json，路径解析与
        附件收集一致：绝对路径（挂载配置下发 path_prefix）原样使用，
        相对路径按 workspace 目录拼接。

        Args:
            agent_context: Agent 上下文

        Returns:
            bool: 是否成功创建版本
        """
        # Check environment variable to control file version creation
        enable_file_version = os.getenv("ENABLE_FILE_VERSION_CREATION", "true").lower() == "true"
        if not enable_file_version:
            logger.info("文件版本创建已通过环境变量 ENABLE_FILE_VERSION_CREATION 禁用，跳过创建")
            return True

        try:
            # 延迟导入: CheckpointService / CheckpointUtils 在顶层 import 会形成
            # file_storage_listener_service ↔ checkpoint_service 的循环依赖
            from app.infrastructure.checkpoint.attachment_candidates import (
                select_file_version_paths,
            )
            from app.service.checkpoint_service import CheckpointService
            from app.service.file_version_service import FileVersionService
            from app.utils.checkpoint_utils import CheckpointUtils

            message_id = CheckpointUtils.get_current_checkpoint_context(agent_context)
            if not message_id:
                logger.warning("未能获取 message_id，跳过创建文件版本")
                return True

            checkpoint_service = CheckpointService()
            checkpoint_info = await checkpoint_service.get_checkpoint(message_id)
            if not checkpoint_info or not checkpoint_info.file_snapshots:
                logger.info(f"checkpoint {message_id} 无文件变更，跳过创建文件版本")
                return True

            recorded_paths = select_file_version_paths(checkpoint_info.file_snapshots)
            if not recorded_paths:
                logger.info(f"checkpoint {message_id} 过滤后无需要创建版本的文件变更")
                return True

            workspace_dir = PathManager.get_workspace_dir()
            absolute_paths = []
            for recorded_path in recorded_paths:
                if os.path.isabs(recorded_path):
                    # 跨挂载（user / referenced-projects）的变更以 agent 视角
                    # 绝对路径记录，直接使用；无 magicfs xattr 的文件由
                    # create_file_versions 优雅跳过
                    absolute_paths.append(recorded_path)
                else:
                    absolute_paths.append(str(workspace_dir / recorded_path.lstrip("/")))

            logger.info(f"准备为 {len(absolute_paths)} 个文件创建版本信息")

            version_service = FileVersionService()
            result = await version_service.create_file_versions(absolute_paths)

            if result.get("success"):
                logger.info(
                    f"文件版本创建完成: {result.get('success_count')}/{result.get('total_count')}"
                )
            else:
                logger.warning(f"文件版本创建失败: {result}")

            return bool(result.get("success"))

        except Exception as e:
            logger.error(f"创建文件版本过程中发生异常: {e}", exc_info=True)
            return False
