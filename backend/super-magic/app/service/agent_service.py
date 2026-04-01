import asyncio
import json
import os
import re
import tempfile
import uuid
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional

from agentlang.context.tool_context import ToolContext
from agentlang.event.data import AfterInitEventData, BeforeInitEventData
from agentlang.environment import Environment
from agentlang.event.event import EventType
from app.core.context.agent_context import AgentContext
from app.core.stream.base import Stream
from app.infrastructure.storage.base import BaseFileProcessor
from app.infrastructure.storage.factory import StorageFactory
from agentlang.logger import get_logger
from app.magic.agent import Agent
from app.path_manager import PathManager
from app.service.agent_event.file_storage_listener_service import FileStorageListenerService
from app.service.attachment_service import AttachmentService
from app.core.entity.project_archive import ProjectArchiveInfo
from app.utils.init_client_message_util import InitClientMessageUtil
from app.utils.path_utils import get_workspace_dir
from app.utils.path_utils import get_storage_dir
from app.service.asr.asr_context_diff_service import AsrContextDiffService
from app.service.channel_context_service import ChannelContextService
from app.service.image_model_sizes_service import ImageModelSizesService
from app.service.mcp_servers_service import MCPServersService
from app.infrastructure.observability import install_tool_monitoring_listener
from app.core.base_service import Base
from app.service.mention import MentionContextBuilder

logger = get_logger(__name__)

ASR_CHAT_LOG_PREFIX = "[asrChat]"


class AgentService(Base):
    SERVICE_TYPE = "agent"

    def __init__(self):
        """初始化AgentService"""
        super().__init__()
        # 初始化mention上下文构建器（复用实例，避免每次调用都创建）
        self._mention_builder = MentionContextBuilder()


    def is_support_fetch_workspace(self) -> bool:
        """是否支持获取工作空间

        Returns:
            bool: 是否支持获取工作空间
        """
        # 优先从环境变量获取，如果不存在则从配置文件获取
        env_value = Environment.get_env("FETCH_WORKSPACE", None, bool)
        if env_value is not None:
            return env_value

        # 从配置文件获取
        try:
            from agentlang.config.config import config

            return config.get("sandbox.fetch_workspace", False)
        except (ImportError, AttributeError):
            return False

    async def _download_and_check_project_archive_info(self, agent_context: AgentContext) -> bool:
        """
        下载并检查项目存档信息，判断是否需要更新工作区

        Args:
            agent_context: 代理上下文

        Returns:
            bool: 是否需要更新工作区
        """
        # 获取storage_service
        sts_token_refresh = agent_context.get_init_client_message_sts_token_refresh()
        metadata = agent_context.get_metadata()

        # 获取平台类型，优先使用客户端消息中指定的平台
        platform_type = agent_context.get_init_client_message_platform_type()

        storage_service = await StorageFactory.get_storage(
            sts_token_refresh=sts_token_refresh, metadata=metadata, platform=platform_type
        )

        # 尝试下载项目存档信息文件
        project_archive_info_file_relative_path = PathManager.get_project_archive_info_file_relative_path()
        project_archive_info_file = PathManager.get_project_archive_info_file()

        project_archive_info_file_key = BaseFileProcessor.combine_path(
            dir_path=get_workspace_dir(storage_service.credentials), file_path=project_archive_info_file_relative_path
        )
        # 判断文件是否存在
        if not await storage_service.exists(project_archive_info_file_key):
            logger.info(f"项目存档信息文件不存在: {project_archive_info_file_key}")
            return False
        logger.info(f"尝试下载项目存档信息文件: {project_archive_info_file_key}")
        info_file_stream = await storage_service.download(key=project_archive_info_file_key, options=None)

        # 解析远程版本信息
        remote_info = json.loads(info_file_stream.read().decode("utf-8"))
        remote_version = remote_info.get("version", 0)
        logger.info(f"远程项目存档信息版本号: {remote_version}")

        # 获取本地版本信息
        local_version = 0
        if os.path.exists(project_archive_info_file):
            with open(project_archive_info_file, "r") as f:
                local_info = json.load(f)
                local_version = local_info.get("version", 0)
                logger.info(f"本地项目存档信息版本号: {local_version}")
        else:
            logger.info("本地项目存档信息文件不存在")

        # 如果远程版本小于等于本地版本，则不需要更新
        if remote_version <= local_version:
            logger.info(f"远程版本({remote_version})不大于本地版本({local_version})，无需更新工作区")
            return False

        logger.info(f"远程版本({remote_version})大于本地版本({local_version})，将更新工作区")

        # 版本较新，保存远程版本信息到本地
        project_schema_absolute_dir = PathManager.get_project_schema_absolute_dir()
        project_schema_absolute_dir.mkdir(exist_ok=True, parents=True)
        with open(project_archive_info_file, "w") as f:
            json.dump(remote_info, f)
            logger.info(f"已更新本地项目存档信息文件: {project_archive_info_file}")
        return True

    async def download_and_extract_workspace(self, agent_context: AgentContext) -> None:
        """
        Download and extract workspace with separated archive support

        Args:
            agent_context: Agent context containing storage configuration

        Raises:
            Exception: If download or extraction fails
        """
        try:
            # Initialize storage service
            sts_token_refresh = agent_context.get_init_client_message_sts_token_refresh()
            metadata = agent_context.get_metadata()
            platform_type = agent_context.get_init_client_message_platform_type()

            storage_service = await StorageFactory.get_storage(
                sts_token_refresh=sts_token_refresh, metadata=metadata, platform=platform_type
            )

            # Check if we should fetch workspace
            if not self.is_support_fetch_workspace():
                logger.info("不支持获取工作空间，跳过下载")
                return

            # Download and parse remote manifest
            # remote_manifest = await self._download_remote_manifest(agent_context, storage_service)
            # if not remote_manifest:
            #     logger.info("远程清单不存在或无法解析，跳过下载")
            #     return

            # Load local manifest for comparison
            # local_manifest = self._load_local_manifest()

            # Determine what needs to be updated
            # workspace_needs_update = self._check_workspace_update_needed(remote_manifest, local_manifest)

            # Download and extract workspace if needed
            # if workspace_needs_update:
            #     await self._download_and_extract_workspace_archive(remote_manifest, storage_service)
            # else:
            #     logger.info("工作区是最新版本，无需下载")

            # Always try to download chat history, as it's independent of the manifest
            await self._download_and_extract_chat_history_archive(storage_service, agent_context)

            # Always try to download checkpoints, as it's independent of the manifest
            await self._download_and_extract_checkpoints_archive(storage_service, agent_context)

            # Update local manifest with remote version if the workspace was updated
            # if workspace_needs_update:
            #     self._save_local_manifest(remote_manifest)

            logger.info("聊天历史和checkpoints处理完成")

        except Exception as e:
            logger.error(f"下载和解压工作区时出错: {e}")
            raise  # 直接抛出异常，不进行兜底处理

    async def _download_remote_manifest(
        self, agent_context: AgentContext, storage_service
    ) -> Optional[ProjectArchiveInfo]:
        """
        Download and parse remote manifest file

        Args:
            agent_context: Agent context
            storage_service: Storage service instance

        Returns:
            Optional[ProjectArchiveInfo]: Remote manifest or None if not exists/invalid
        """
        try:
            project_archive_info_file_relative_path = PathManager.get_project_archive_info_file_relative_path()
            info_file_key = BaseFileProcessor.combine_path(
                get_workspace_dir(storage_service.credentials), project_archive_info_file_relative_path
            )

            # Check if file exists
            if not await storage_service.exists(info_file_key):
                logger.info(f"远程清单文件不存在: {info_file_key}")
                return None

            # Download manifest file
            logger.info(f"下载远程清单文件: {info_file_key}")
            info_file_stream = await storage_service.download(key=info_file_key, options=None)

            # Parse manifest
            remote_data = json.loads(info_file_stream.read().decode("utf-8"))

            # Try to parse as new format first
            try:
                return ProjectArchiveInfo(**remote_data)
            except Exception:
                # If new format fails, might be legacy format
                logger.info("远程清单是旧格式，将尝试兼容处理")
                return None

        except Exception as e:
            logger.error(f"下载远程清单时出错: {e}")
            return None

    def _load_local_manifest(self) -> Optional[ProjectArchiveInfo]:
        """
        Load local manifest file

        Returns:
            Optional[ProjectArchiveInfo]: Local manifest or None if not exists/invalid
        """
        try:
            project_archive_info_file = PathManager.get_project_archive_info_file()
            if not os.path.exists(project_archive_info_file):
                logger.info("本地清单文件不存在")
                return None

            with open(project_archive_info_file, "r") as f:
                data = json.load(f)

            # Try to parse as new format
            try:
                return ProjectArchiveInfo(**data)
            except Exception:
                logger.info("本地清单是旧格式")
                return None

        except Exception as e:
            logger.error(f"加载本地清单时出错: {e}")
            return None

    def _save_local_manifest(self, manifest: ProjectArchiveInfo) -> None:
        """
        Save manifest to local file

        Args:
            manifest: Manifest to save
        """
        try:
            project_archive_info_file = PathManager.get_project_archive_info_file()
            project_schema_dir = project_archive_info_file.parent
            project_schema_dir.mkdir(exist_ok=True, parents=True)

            with open(project_archive_info_file, "w") as f:
                json.dump(manifest.model_dump(), f, indent=2)

            logger.info(f"本地清单已更新: {project_archive_info_file}")

        except Exception as e:
            logger.error(f"保存本地清单时出错: {e}")

    def _check_workspace_update_needed(
        self, remote_manifest: ProjectArchiveInfo, local_manifest: Optional[ProjectArchiveInfo]
    ) -> bool:
        """
        Check if workspace archive needs update

        Args:
            remote_manifest: Remote manifest
            local_manifest: Local manifest

        Returns:
            bool: True if update needed
        """
        remote_workspace = remote_manifest.get_workspace_archive()
        if not remote_workspace:
            logger.info("远程清单中没有工作区归档")
            return False

        if not local_manifest:
            logger.info("本地清单不存在，需要下载工作区")
            return True

        local_workspace = local_manifest.get_workspace_archive()
        if not local_workspace:
            logger.info("本地清单中没有工作区归档，需要下载")
            return True

        if remote_workspace.version > local_workspace.version:
            logger.info(f"工作区需要更新: 远程版本 {remote_workspace.version} > 本地版本 {local_workspace.version}")
            return True

        logger.info(f"工作区是最新版本: {local_workspace.version}")
        return False

    async def _download_and_extract_workspace_archive(self, manifest: ProjectArchiveInfo, storage_service) -> None:
        """
        Download and extract workspace archive

        Args:
            manifest: Manifest containing workspace archive info
            storage_service: Storage service instance
        """
        workspace_archive = manifest.get_workspace_archive()
        if not workspace_archive:
            logger.error("清单中没有工作区归档信息")
            return

        try:
            # Download workspace archive
            logger.info(f"下载工作区归档: {workspace_archive.file_key}")

            file_stream = await storage_service.download(key=workspace_archive.file_key, options=None)

            if not file_stream:
                logger.error(f"下载工作区归档失败: 返回的文件流为空")
                return

            # Save to temporary file
            temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
            temp_zip_path = temp_zip.name
            temp_zip.close()

            file_content = file_stream.read()

            with open(temp_zip_path, "wb") as f:
                f.write(file_content)

            # Verify file size and zip validity
            actual_size = os.path.getsize(temp_zip_path)
            logger.info(f"工作区归档下载完成: {temp_zip_path} ({actual_size} 字节)")

            if actual_size != workspace_archive.file_size:
                logger.warning(f"文件大小不匹配! 预期: {workspace_archive.file_size}, 实际: {actual_size}")

            # Verify it's a valid zip file and check structure
            try:
                with zipfile.ZipFile(temp_zip_path, "r") as zip_test:
                    zip_files = zip_test.namelist()
                    if not zip_files:
                        logger.warning("工作区压缩包是空的!")
                        return
                    logger.info(f"工作区压缩包包含 {len(zip_files)} 个文件")

            except zipfile.BadZipFile as e:
                logger.error(f"下载的文件不是有效的ZIP格式: {e}")
                return

            # Ensure workspace directory exists (without clearing)
            workspace_dir = PathManager.get_workspace_dir()
            workspace_dir.mkdir(exist_ok=True, parents=True)
            logger.info(f"工作区目录已准备就绪: {workspace_dir}")

            # Extract archive
            logger.info(f"解压工作区归档到: {workspace_dir}")
            logger.info("开始解压工作区归档，不清空现有文件，允许覆盖")
            with zipfile.ZipFile(temp_zip_path, "r") as zip_ref:
                # Check if the zip contains .workspace directory or direct files
                zip_files = zip_ref.namelist()
                has_workspace_dir = any(name.startswith(".workspace/") for name in zip_files)

                if has_workspace_dir:
                    # If zip contains .workspace directory, extract to parent and it will recreate .workspace
                    zip_ref.extractall(workspace_dir.parent)
                else:
                    # If zip contains direct files, extract directly to workspace_dir
                    zip_ref.extractall(workspace_dir)

            # Verify extraction result
            if workspace_dir.exists():
                extracted_files = list(workspace_dir.rglob("*"))
                logger.info(f"工作区解压完成，包含 {len(extracted_files)} 个文件/目录")
                logger.info("解压操作可能覆盖了现有文件，这是预期行为")
            else:
                logger.error("解压后.workspace目录不存在!")

        except Exception as e:
            logger.error(f"下载和解压工作区归档时出错: {e}")
            import traceback

            logger.error(f"异常堆栈: {traceback.format_exc()}")
            raise
        finally:
            # Clean up temporary file
            if "temp_zip_path" in locals() and os.path.exists(temp_zip_path):
                try:
                    os.unlink(temp_zip_path)
                    logger.debug(f"已删除临时工作区文件: {temp_zip_path}")
                except Exception as e:
                    logger.warning(f"删除临时工作区文件失败: {e}")

    async def _download_and_extract_chat_history_archive(self, storage_service, agent_context: AgentContext) -> None:
        """
        Download and extract chat history archive

        Args:
            storage_service: Storage service instance
            agent_context: Agent context
        """
        try:
            # Get sandbox_id from agent_context. If not present, skip download.
            sandbox_id = agent_context.get_sandbox_id()
            if not sandbox_id:
                logger.warning("agent_context 中没有 sandbox_id，跳过下载聊天历史")
                return

            # Construct the object name using the sandbox_id
            chat_history_object_name = f"chat_history_{sandbox_id}.zip"
            logger.info(
                f"使用来自 agent_context 的 sandbox_id: {sandbox_id}，构造聊天历史归档名称: {chat_history_object_name}"
            )

            logger.info(f"下载聊天历史归档: {chat_history_object_name}")

            # Try to get chat_history_dir from init_client_message first
            chat_history_dir = InitClientMessageUtil.get_chat_history_dir()
            chat_history_object_key = None

            if chat_history_dir:
                # Use the configured chat_history_dir path
                chat_history_object_key = BaseFileProcessor.combine_path(chat_history_dir, chat_history_object_name)
                logger.info(f"尝试使用配置的聊天历史路径: {chat_history_object_key}")

                # Check if the file exists at this path
                if await storage_service.exists(chat_history_object_key):
                    logger.info(f"在配置路径找到聊天历史文件: {chat_history_object_key}")
                else:
                    logger.info(f"配置路径下不存在聊天历史文件，将降级到默认路径")
                    chat_history_object_key = None

            # Fallback to default path if chat_history_dir is empty or file doesn't exist
            if not chat_history_object_key:
                chat_history_object_key = BaseFileProcessor.combine_path(
                    get_workspace_dir(storage_service.credentials), chat_history_object_name
                )
                logger.info(f"使用默认路径构造聊天历史对象键: {chat_history_object_key}")

            # Check if object exists
            if not await storage_service.exists(chat_history_object_key):
                logger.warning(
                    f"聊天历史归档在存储中不存在: {chat_history_object_key} (如果是新话题, 没有聊天历史归档)"
                )
                return

            # Download archive to a temporary file
            file_stream = await storage_service.download(key=chat_history_object_key, options=None)

            if not file_stream:
                logger.error(f"下载聊天历史归档失败: 返回的文件流为空")
                return

            # Save to temporary file
            temp_file = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
            temp_file_path = temp_file.name
            temp_file.close()

            file_content = file_stream.read()

            with open(temp_file_path, "wb") as f:
                f.write(file_content)

                file_size = os.path.getsize(temp_file_path)
                logger.info(f"聊天历史归档下载完成: {temp_file_path} ({file_size} 字节)")

            # Extract archive
            chat_history_dir = PathManager.get_chat_history_dir()
            with zipfile.ZipFile(temp_file_path, "r") as zip_ref:
                num_files = len(zip_ref.namelist())
                logger.info(f"聊天历史压缩包包含 {num_files} 个文件")
                # Ensure chat history directory exists (without clearing)
                os.makedirs(chat_history_dir, exist_ok=True)
                logger.info(f"聊天历史目录已准备就绪: {chat_history_dir}")
                logger.info(f"解压聊天历史归档到: {chat_history_dir}")
                zip_ref.extractall(chat_history_dir)
                extracted_count = len(os.listdir(chat_history_dir))
                logger.info(f"聊天历史解压完成，包含 {extracted_count} 个文件/目录")
        except Exception as e:
            logger.error(f"下载和解压聊天历史时出错: {e}")
        finally:
            # Clean up temporary file
            if "temp_file_path" in locals() and os.path.exists(temp_file_path):
                os.remove(temp_file_path)

    async def _download_and_extract_checkpoints_archive(self, storage_service, agent_context: AgentContext) -> None:
        """
        Download and extract checkpoints archive

        Args:
            storage_service: Storage service instance
            agent_context: Agent context
        """
        try:
            # Get sandbox_id from agent_context. If not present, skip download.
            sandbox_id = agent_context.get_sandbox_id()
            if not sandbox_id:
                logger.warning("agent_context 中没有 sandbox_id，跳过下载checkpoints")
                return

            # Construct the object name using the sandbox_id
            checkpoints_object_name = f"checkpoints_{sandbox_id}.zip"
            logger.info(
                f"使用来自 agent_context 的 sandbox_id: {sandbox_id}，构造checkpoints归档名称: {checkpoints_object_name}"
            )

            logger.info(f"下载checkpoints归档: {checkpoints_object_name}")

            # Get work_dir as base path
            base_path = get_storage_dir(storage_service.credentials)

            # Get checkpoints dir name
            checkpoints_dir_name = InitClientMessageUtil.get_checkpoints_dir()

            # Combine paths
            dir_path = BaseFileProcessor.combine_path(base_path, checkpoints_dir_name)

            checkpoints_object_key = BaseFileProcessor.combine_path(dir_path, checkpoints_object_name)
            logger.info(f"使用checkpoints路径构造对象键: {checkpoints_object_key}")

            # Check if object exists
            if not await storage_service.exists(checkpoints_object_key):
                logger.warning(
                    f"checkpoints归档在存储中不存在: {checkpoints_object_key} (如果是新话题, 没有checkpoints归档)"
                )
                return

            # Download archive to a temporary file
            file_stream = await storage_service.download(key=checkpoints_object_key, options=None)

            if not file_stream:
                logger.error(f"下载checkpoints归档失败: 返回的文件流为空")
                return

            # Save to temporary file
            temp_file = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
            temp_file_path = temp_file.name
            temp_file.close()

            file_content = file_stream.read()

            with open(temp_file_path, "wb") as f:
                f.write(file_content)

            file_size = os.path.getsize(temp_file_path)
            logger.info(f"checkpoints归档下载完成: {temp_file_path} ({file_size} 字节)")

            # Extract archive
            checkpoints_dir = PathManager.get_checkpoints_dir()
            with zipfile.ZipFile(temp_file_path, "r") as zip_ref:
                num_files = len(zip_ref.namelist())
                logger.info(f"checkpoints压缩包包含 {num_files} 个文件")
                # Ensure checkpoints directory exists (without clearing)
                os.makedirs(checkpoints_dir, exist_ok=True)
                logger.info(f"checkpoints目录已准备就绪: {checkpoints_dir}")
                logger.info(f"解压checkpoints归档到: {checkpoints_dir}")
                zip_ref.extractall(checkpoints_dir)
                extracted_count = len(os.listdir(checkpoints_dir))
                logger.info(f"checkpoints解压完成，包含 {extracted_count} 个文件/目录")
        except Exception as e:
            logger.error(f"下载和解压checkpoints时出错: {e}")
        finally:
            # Clean up temporary file
            if "temp_file_path" in locals() and os.path.exists(temp_file_path):
                os.remove(temp_file_path)

    async def init_workspace(
        self,
        agent_context: AgentContext,
        fetch_history: bool = True,
    ):
        """
        初始化智能体

        Args:
            agent_context: 智能体上下文
            fetch_history: 是否下载远端聊天历史与相关资产
        """

        for stream in agent_context.streams.values():
            agent_context.add_stream(stream)

        agent_name = agent_context.get_agent_name()
        logger.info(f"{agent_name}初始化开始")

        # 创建 ToolContext 实例
        tool_context = ToolContext(metadata=agent_context.get_metadata())
        tool_context.register_extension("agent_context", agent_context)

        # 触发初始化前事件
        before_init_data = BeforeInitEventData(tool_context=tool_context)
        await agent_context.dispatch_event(EventType.BEFORE_INIT, before_init_data)

        # 初始化OSS凭证
        sts_token_refresh = agent_context.get_init_client_message_sts_token_refresh()
        metadata = agent_context.get_metadata()

        # 获取平台类型，优先使用客户端消息中指定的平台
        platform_type = agent_context.get_init_client_message_platform_type()

        await StorageFactory.get_storage(sts_token_refresh=sts_token_refresh, metadata=metadata, platform=platform_type)

        if fetch_history:
            await self.download_and_extract_workspace(agent_context)
        else:
            logger.info("fetch_history disabled, skip downloading remote chat history and checkpoints")

        # 触发初始化后事件
        after_init_data = AfterInitEventData(tool_context=tool_context, agent_context=agent_context, success=True)
        await agent_context.dispatch_event(EventType.AFTER_INIT, after_init_data)

        agent_name = agent_context.get_agent_name()
        logger.info(f"{agent_name}初始化完成")

        return

    async def create_agent(
        self,
        agent_name: str,
        agent_context: AgentContext,
    ) -> Agent:
        """
        创建智能体实例

        Args:
            agent_type: 智能体类型名称
            stream_mode: 是否启用流式输出
            agent_context: 可选的代理上下文对象，将覆盖其他参数
            stream: 流式输出对象
            storage_credentials: 对象存储凭证，用于配置对象存储服务

        Returns:
            智能体实例和错误信息列表
        """

        try:
            agent = Agent(agent_name, agent_context)

            # 安装工具监控监听器（非侵入式）
            install_tool_monitoring_listener(agent_context)

            # Complete async dynamic initialization (directory scanning)
            # This runs the IO-intensive directory scan in a thread pool
            # to avoid blocking the asyncio event loop
            await agent.async_complete_dynamic_init()

            return agent
        except Exception as e:
            logger.error(f"创建SuperMagic实例时出错: {e}")
            import traceback

            logger.error(traceback.format_exc())
            return None

    async def run_agent(
        self,
        agent: Agent,
    ):
        agent_context = agent.agent_context
        chat_client_message = agent_context.get_chat_client_message()
        query = chat_client_message.prompt

        # 🔥 ASR 录音纪要聊天模式：注入上下文 Diff
        try:
            asr_task_key = None
            if chat_client_message.dynamic_config:
                asr_task_key = chat_client_message.dynamic_config.get("asr_task_key")

            if asr_task_key:
                diff_block = await AsrContextDiffService.instance().build_diff_block(asr_task_key)
                if diff_block:
                    query = f"{diff_block}\n\n{query}"
                    context_type = "noChange" if 'type="no-change"' in diff_block else "updated"
                    logger.info(f"{ASR_CHAT_LOG_PREFIX} injectedContext type={context_type} length={len(diff_block)}")
        except Exception as e:
            logger.error(f"{ASR_CHAT_LOG_PREFIX} injectContextFailed error={e}")
            # 失败不影响聊天主流程

        # 处理mentions信息（顶部引用区）- 添加到用户prompt中
        mentions = getattr(chat_client_message, "mentions", [])
        if mentions:
            mentions_context = await self._build_mentions_context(mentions)
            query = f"{mentions_context}\n\n---\n\n{query}"
            logger.info(f"已将{len(mentions)}个mentions添加到用户prompt中")

        # 处理输入框内联引用（[@file_path:格式）
        query = agent._process_user_input_with_mentions(query, [])

        # 追加渠道专属上下文片段（如微信消息携带的媒体文件路径），不支持的渠道返回空串不影响
        query = ChannelContextService.append_channel_context(query, chat_client_message)

        if chat_client_message and hasattr(chat_client_message, "attachments") and chat_client_message.attachments:
            query = await self._process_attachments(agent_context, query, chat_client_message.attachments)

        # 将图片模型信息同步到 horizon（sizes 变化时 horizon 会在下次 system_injected_context 中通知 LLM）
        await ImageModelSizesService.sync_to_horizon(
            chat_client_message.dynamic_config,
            agent.agent_context.horizon,
        )

        # 每次用户消息前刷新工作区文件树，让 horizon 检测用户上传/删除文件等变化
        try:
            await agent.refresh_workspace_files()
        except Exception as _e:
            logger.warning(f"[AgentService] 刷新工作区文件树失败: {_e}")

        # 处理 MCP 服务器信息：为加载了 using-mcp skill 的 agent 追加可用服务器信息
        query = await MCPServersService.append_mcp_servers_to_query(query, agent)

        try:
            await agent.run_main_agent(query)
        finally:
            # 持久化聊天记录·
            asyncio.create_task(FileStorageListenerService._archive_and_upload_project(agent_context))

    def create_agent_context(
        self,
        stream_mode: bool,
        streams: Optional[List[Stream]] = [],
        llm: Optional[str] = None,
        task_id: Optional[str] = "",
        is_main_agent: bool = False,
        interrupt_queue: Optional[asyncio.Queue] = None,
        sandbox_id: Optional[str] = "",
    ) -> AgentContext:
        """
        创建代理上下文对象

        Args:
            stream_mode: 是否启用流式输出
            streams: 可选的通信流实例
            llm: 大语言模型名称
            task_id: 任务ID，若为None则自动生成
            is_main_agent: 标记当前agent是否是主agent，默认为False

        Returns:
            AgentContext: 代理上下文对象
        """
        agent_context = AgentContext()
        agent_context.set_task_id(task_id)
        agent_context.set_llm(llm)
        agent_context.stream_mode = stream_mode
        agent_context.ensure_workspace_dir()
        agent_context.is_main_agent = is_main_agent
        agent_context.set_sandbox_id(sandbox_id)

        if interrupt_queue:
            agent_context.set_interrupt_queue(interrupt_queue)

        for stream in streams:
            agent_context.add_stream(stream)

        return agent_context

    async def _build_mentions_context(self, mentions: List[Dict[str, Any]]) -> str:
        """构建mentions的系统上下文信息（异步）

        Args:
            mentions: mentions字段中的信息列表

        Returns:
            str: 格式化的mentions上下文信息
        """
        return await self._mention_builder.build(mentions)

    def get_agent_file(self, agent_type: str) -> str:
        """
        获取智能体文件路径
        """
        return os.path.join(PathManager.get_project_root(), "agents", f"{agent_type}.agent")

    async def _process_attachments(
        self, agent_context: AgentContext, query: str, attachments: List[Dict[str, Any]]
    ) -> str:
        """
        处理附件并将其集成到查询中

        Args:
            query: 原始用户查询
            attachments: 附件列表，每个附件是一个字典，包含附件信息

        Returns:
            str: 添加了附件路径信息的查询
        """
        if not attachments:
            logger.info("消息中没有附件，返回原始查询")
            return query

        logger.info(f"收到带附件的消息，附件数量: {len(attachments)}")
        logger.info(f"消息内容: {query[:100]}{'...' if len(query) > 100 else ''}")
        logger.info(f"附件详情: {json.dumps([{k: v for k, v in a.items()} for a in attachments], ensure_ascii=False)}")

        # 初始化附件服务
        logger.info("初始化附件下载服务")
        attachment_service = AttachmentService(agent_context)

        # 下载附件
        logger.info("开始下载附件...")
        attachment_paths = await attachment_service.download_attachments(attachments)

        # 如果有成功下载的附件，将路径添加到提示中
        if attachment_paths:
            logger.info(f"成功下载 {len(attachment_paths)} 个附件")
            # 为每个附件生成路径信息
            attachment_info = "\n\n以下是用户上传的附件路径:\n"

            # @FIXME: Workaround for design defects, should be fixed in the future.
            # Fix path from "/app/.workspace/project-name/pages/slide-01.html" to "project-name/pages/slide-01.html"
            try:
                workspace_dir = PathManager.get_workspace_dir()
                workspace_path = Path(workspace_dir).resolve()

                for i, path in enumerate(attachment_paths, 1):
                    try:
                        # Convert to Path object and resolve to get absolute path
                        file_path = Path(path).resolve()

                        # Try to get relative path from workspace
                        try:
                            relative_path = file_path.relative_to(workspace_path)
                            display_path = str(relative_path.as_posix())
                        except ValueError:
                            # If path is not under workspace, use original path
                            display_path = str(file_path.as_posix())
                            logger.warning(f"附件路径不在工作区内: {path}")

                        attachment_info += f"{i}. {display_path}\n"
                        logger.info(f"附件 {i}: {display_path}")

                    except Exception as e:
                        logger.warning(f"处理附件路径时出错: {e}, 使用原始路径: {path}")
                        attachment_info += f"{i}. {path}\n"
                        logger.info(f"附件 {i}: {path}")

            except Exception as e:
                logger.error(f"处理附件路径时出错: {e}")
                # Fallback to original simple processing
                for i, path in enumerate(attachment_paths, 1):
                    attachment_info += f"{i}. {path}\n"
                    logger.info(f"附件 {i}: {path}")

            # 将附件信息添加到提示中
            message_with_attachments = f"{query}\n{attachment_info}"
            logger.info(f"将附件路径信息添加到消息中，新消息长度: {len(message_with_attachments)}")

            return message_with_attachments
        else:
            logger.info("没有成功下载的附件，返回原始查询")
            return query
