"""
文件存储监听器服务，用于监听文件事件并上传文件到对象存储服务
"""

import hashlib
import json
import os
import shutil
import stat
import tempfile
import time
import traceback
from pathlib import Path
from typing import List, Optional, Union

from app.utils.async_file_utils import async_stat, async_read_json, async_write_text, async_exists

from agentlang.context.tool_context import ToolContext
from agentlang.event.data import AfterMainAgentRunEventData, AgentSuspendedEventData
from agentlang.event.event import Event, EventType
from agentlang.logger import get_logger
from app.core.context.agent_context import AgentContext
from app.core.entity.attachment import Attachment, AttachmentTag
from app.core.entity.event.file_event import FileEventData  # 从业务层导入 FileEventData
from app.core.entity.project_archive import ArchiveDetail, ProjectArchiveInfo
from app.infrastructure.storage.base import BaseFileProcessor
from app.infrastructure.storage.exceptions import InitException, UploadException
from app.infrastructure.storage.factory import StorageFactory
from app.infrastructure.storage.types import StorageResponse
from app.paths import PathManager
from app.service.agent_event.base_listener_service import BaseListenerService
from app.utils.init_client_message_util import InitClientMessageUtil
from app.utils.path_utils import get_workspace_dir, get_storage_dir, get_storage_dir_with_fallback

logger = get_logger(__name__)


class FileStorageListenerService:
    """
    文件存储监听器服务，用于监听文件事件并将文件上传到对象存储服务
    """

    @staticmethod
    def register_standard_listeners(agent_context: AgentContext) -> None:
        """
        为代理上下文注册文件事件监听器

        Args:
            agent_context: 代理上下文对象
        """
        # 创建事件类型到处理函数的映射
        event_listeners = {
            EventType.FILE_CREATED: FileStorageListenerService._handle_file_event,
            EventType.FILE_UPDATED: FileStorageListenerService._handle_file_event,
            EventType.FILE_DELETED: FileStorageListenerService._handle_file_deleted,
            EventType.AFTER_MAIN_AGENT_RUN: FileStorageListenerService._handle_after_main_agent_run,
        }

        # 使用基类方法批量注册监听器
        BaseListenerService.register_listeners(agent_context, event_listeners)

        logger.info("已为代理上下文注册文件事件、主代理完成事件和agent暂停事件监听器")

    @staticmethod
    async def _handle_file_event(event: Event[FileEventData]) -> None:
        """
        处理文件事件（创建和更新）

        Args:
            event: 文件事件对象，包含FileEventData数据
        """
        event_type_name = "创建" if event.event_type == EventType.FILE_CREATED else "更新"
        logger.info(f"处理文件{event_type_name}事件: {event.data.filepath}")

        # 1. 构造文件存储键
        file_key = await FileStorageListenerService._construct_file_key(
            event.data.filepath,
            event.data.tool_context.get_extension_typed("agent_context", AgentContext)
        )

        # 2. 如果构造成功，创建附件并添加到事件上下文
        if file_key:
            try:
                # 创建附件对象，传递file_key字符串
                attachment = FileStorageListenerService._create_attachment_from_uploaded_file(
                    filepath=event.data.filepath,
                    file_key=file_key,
                    file_event_data=event.data
                )

                # 将附件添加到事件上下文
                FileStorageListenerService._add_attachment_to_event_context(event.data.tool_context, attachment)
                # 将附件添加到代理上下文
                FileStorageListenerService._add_attachment_to_agent_context(event.data.tool_context.get_extension_typed("agent_context", AgentContext), attachment)
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
        处理主代理完成事件，压缩并上传项目目录并创建文件版本

        Args:
            event: 主代理完成事件对象，包含 AfterMainAgentRunEventData 数据
        """
        logger.info("处理主代理完成事件：创建文件版本")
        await FileStorageListenerService._create_changed_files_versions(event.data.agent_context)

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
    async def _archive_and_upload_project(agent_context: AgentContext) -> None:
        """
        Compress and upload project directories separately with independent versioning

        Args:
            agent_context: Agent context object
        """
        try:
            # Get directory paths
            chat_history_dir = PathManager.get_chat_history_dir()
            workspace_dir = PathManager.get_workspace_dir()
            sandbox_id = agent_context.get_sandbox_id()

            if not sandbox_id:
                logger.error("无法获取sandbox_id，无法进行分离式打包")
                return

            # Load local manifest to check current state
            # local_manifest = FileStorageListenerService._load_local_manifest()

            # Initialize storage service
            metadata = agent_context.get_metadata()
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
            await FileStorageListenerService._process_chat_history_archive(
                chat_history_dir, sandbox_id, storage_service
            )

            # Process and upload checkpoints archive
            checkpoints_dir = PathManager.get_checkpoints_dir()
            await FileStorageListenerService._process_checkpoints_archive(
                str(checkpoints_dir), sandbox_id, storage_service
            )

            # Save and upload the final manifest
            # await FileStorageListenerService._save_and_upload_project_archive_info(project_archive_info, agent_context)
            logger.info("聊天历史和checkpoints上传完成")

        except Exception as e:
            logger.error(f"分离式打包和上传过程中发生错误: {e}")
            logger.error(traceback.format_exc())

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
    async def _process_chat_history_archive(
        chat_history_dir: str,
        sandbox_id: str,
        storage_service
    ) -> None:
        """
        Process chat history archive: compress if changed and upload

        Args:
            chat_history_dir: Path to chat history directory
            sandbox_id: Sandbox ID for naming the archive
            storage_service: Storage service instance
        """
        if not os.path.isdir(chat_history_dir) or not os.listdir(chat_history_dir):
            logger.info("聊天历史目录为空或不存在，跳过处理")
            return

        await FileStorageListenerService._archive_and_upload_single_chat_history(chat_history_dir, sandbox_id, storage_service)

    @staticmethod
    async def _archive_and_upload_single_chat_history(chat_history_dir: str, sandbox_id: str, storage_service) -> None:
        """
        Compress and upload a single chat history archive.

        Args:
            chat_history_dir: Path to the chat history directory.
            sandbox_id: The sandbox ID for this chat history.
            storage_service: The storage service instance.
        """
        try:
            # Always archive and upload chat history for the current sandbox
            logger.info(f"为沙箱 {sandbox_id} 处理聊天历史归档")

            # Create archive in a temporary directory
            with tempfile.TemporaryDirectory() as temp_dir:
                archive_name = f"chat_history_{sandbox_id}"
                archive_path = os.path.join(temp_dir, archive_name)
                zip_path = shutil.make_archive(archive_path, 'zip', chat_history_dir)
                logger.info(f"聊天历史已压缩到: {zip_path}")

                # Determine the directory path for upload
                configured_path = InitClientMessageUtil.get_chat_history_dir()
                dir_path = configured_path if configured_path else get_workspace_dir(storage_service.credentials)

                # Define object key
                object_key = BaseFileProcessor.combine_path(
                    dir_path,
                    os.path.basename(zip_path)
                )

                # Upload archive
                logger.info(f"上传聊天历史归档到: {object_key}")
                await storage_service.upload(
                    file=zip_path,
                    key=object_key,
                    options=None
                )
                logger.info(f"聊天历史归档上传成功: {object_key}")

        except Exception as e:
            logger.error(f"处理聊天历史归档时出错: {e}", exc_info=True)

    @staticmethod
    async def _process_checkpoints_archive(
        checkpoints_dir: str,
        sandbox_id: str,
        storage_service
    ) -> None:
        """
        Process checkpoints archive: compress if changed and upload

        Args:
            checkpoints_dir: Path to checkpoints directory
            sandbox_id: Sandbox ID for naming the archive
            storage_service: Storage service instance
        """
        if not os.path.isdir(checkpoints_dir) or not os.listdir(checkpoints_dir):
            logger.info("checkpoints目录为空或不存在，跳过处理")
            return

        await FileStorageListenerService._archive_and_upload_single_checkpoints(checkpoints_dir, sandbox_id, storage_service)

    @staticmethod
    async def _archive_and_upload_single_checkpoints(checkpoints_dir: str, sandbox_id: str, storage_service) -> None:
        """
        Compress and upload a single checkpoints archive.

        Args:
            checkpoints_dir: Path to the checkpoints directory.
            sandbox_id: The sandbox ID for this checkpoints.
            storage_service: The storage service instance.
        """
        try:
            # Always archive and upload checkpoints for the current sandbox
            logger.info(f"为沙箱 {sandbox_id} 处理checkpoints归档")

            # Create archive in a temporary directory
            with tempfile.TemporaryDirectory() as temp_dir:
                archive_name = f"checkpoints_{sandbox_id}"
                archive_path = os.path.join(temp_dir, archive_name)
                zip_path = shutil.make_archive(archive_path, 'zip', checkpoints_dir)
                logger.info(f"checkpoints已压缩到: {zip_path}")

                # Get work_dir as base path
                base_path = get_storage_dir(storage_service.credentials)

                # Get checkpoints dir name
                checkpoints_dir_name = InitClientMessageUtil.get_checkpoints_dir()

                # Combine paths
                dir_path = BaseFileProcessor.combine_path(base_path, checkpoints_dir_name)

                # Define object key
                object_key = BaseFileProcessor.combine_path(
                    dir_path,
                    os.path.basename(zip_path)
                )

                # Upload archive
                logger.info(f"上传checkpoints归档到: {object_key}")
                await storage_service.upload(
                    file=zip_path,
                    key=object_key,
                    options=None
                )
                logger.info(f"checkpoints归档上传成功: {object_key}")

        except Exception as e:
            logger.error(f"处理checkpoints归档时出错: {e}", exc_info=True)

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
    async def _construct_file_key(filepath: str, agent_context: AgentContext) -> Optional[str]:
        """
        构造文件存储键，不实际上传文件

        Args:
            filepath: 文件路径
            agent_context: 代理上下文对象

        Returns:
            Optional[str]: 构造的文件键，构造失败则返回None
        """
        try:
            # 检查文件是否存在
            if not os.path.exists(filepath):
                logger.warning(f"文件不存在，无法生成file_key: {filepath}")
                return None

            # 使用 async_stat 判断是否为目录
            try:
                stat_info = await async_stat(filepath)
                is_directory = stat.S_ISDIR(stat_info.st_mode)
            except Exception as e:
                logger.warning(f"无法获取文件状态信息，使用默认文件处理: {filepath}, 错误: {e}")
                is_directory = False

            sts_token_refresh = agent_context.get_init_client_message_sts_token_refresh()
            metadata = agent_context.get_metadata()

            # 获取平台类型，优先使用客户端消息中指定的平台
            platform_type = agent_context.get_init_client_message_platform_type()

            storage_service = await StorageFactory.get_storage(
                sts_token_refresh=sts_token_refresh,
                metadata=metadata,
                platform=platform_type
            )

            # 构造 file_key
            workspace_dir = agent_context.get_workspace_dir()
            # 去除掉workspace_dir - 确保两个参数都是字符串类型
            if isinstance(filepath, Path):
                filepath = str(filepath)
            if isinstance(workspace_dir, Path):
                workspace_dir = str(workspace_dir)
            relative_path = filepath.replace(workspace_dir, "")

            # 如果是目录且相对路径不以"/"结尾，则添加"/"
            if is_directory and not relative_path.endswith("/"):
                relative_path += "/"

            # 构造最终的file_key
            file_key = BaseFileProcessor.combine_path(get_storage_dir_with_fallback(storage_service.credentials), relative_path)

            logger.info(f"构造文件键成功: {filepath} ({'目录' if is_directory else '文件'}), 存储键: {file_key}")
            return file_key

        except (InitException, UploadException) as e:
            logger.error(f"构造文件键失败: {e}")
            return None
        except Exception as e:
            logger.error(f"构造文件键过程中发生错误: {e}")
            return None

    @staticmethod
    def _create_attachment_from_uploaded_file(filepath: str, file_key: str, file_event_data: FileEventData) -> Attachment:
        """
        根据文件信息和file_key创建附件对象

        Args:
            filepath: 原始文件路径
            file_key: 文件存储键
            file_event_data: 文件事件数据

        Returns:
            Attachment: 创建的附件对象
        """
        # 获取文件信息
        file_path_obj = Path(filepath)
        file_size = os.path.getsize(filepath)
        file_ext = file_path_obj.suffix.lstrip('.')
        file_name = file_path_obj.name
        display_name = file_name

        # 设置附件类型固定为中间产物
        if file_event_data.is_screenshot:
            file_tag = AttachmentTag.BROWSER
        else:
            file_tag = AttachmentTag.PROCESS

        # 创建附件对象，现在包含完整的文件路径
        attachment = Attachment(
            file_key=file_key,
            file_tag=file_tag,
            file_extension=file_ext,
            filepath=filepath,  # 新增：保存完整的文件路径
            filename=file_name,
            display_filename=display_name,
            file_size=file_size,
            file_url=None,
            source=file_event_data.source,  # 透传文件来源信息
            timestamp=int(time.time())
        )

        logger.info(f"已创建附件对象: {file_name}, 路径: {filepath}, 标签: {file_tag}, file_key: {file_key}")
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
    def _add_attachment_to_agent_context(agent_context: AgentContext, attachment: Attachment) -> None:
        """
        将附件添加到代理上下文
        """
        agent_context.add_attachment(attachment)

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
    async def _create_changed_files_versions(agent_context: AgentContext) -> bool:
        """
        创建变更文件的版本信息

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
            from app.service.file_version_service import FileVersionService

            version_service = FileVersionService()
            result = await version_service.create_changed_files_versions(agent_context)

            if result:
                logger.info("文件版本创建成功")
            else:
                logger.warning("文件版本创建失败")

            return result

        except Exception as e:
            logger.error(f"创建文件版本过程中发生异常: {e}", exc_info=True)
            return False
