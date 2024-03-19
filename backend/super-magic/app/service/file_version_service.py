"""
文件版本服务

在 agent 执行完成后调用 magic service API 创建文件版本信息。
"""

import os
from pathlib import Path
from typing import List, Optional, Dict, Any

from agentlang.logger import get_logger
from app.core.context.agent_context import AgentContext
from app.infrastructure.magic_service.client import MagicServiceClient
from app.infrastructure.magic_service.config import MagicServiceConfigLoader, ConfigurationError
from app.infrastructure.magic_service.constants import FileEditType
from app.service.agent_event.file_storage_listener_service import FileStorageListenerService

logger = get_logger(__name__)


class FileVersionService:
    """文件版本服务"""

    def __init__(self):
        self.magic_service_client = None

    async def _get_magic_service_client(self) -> Optional[MagicServiceClient]:
        """获取 Magic Service 客户端"""
        if self.magic_service_client is None:
            try:
                config = MagicServiceConfigLoader.load_with_fallback()
                self.magic_service_client = MagicServiceClient(config)
                logger.info("Magic Service 客户端初始化成功")
            except ConfigurationError as e:
                logger.warning(f"Magic Service 配置加载失败: {e}")
                return None
            except Exception as e:
                logger.error(f"初始化 Magic Service 客户端失败: {e}")
                return None
        return self.magic_service_client

    async def create_file_versions(self, file_keys: List[str], edit_type: int = FileEditType.AI) -> Dict[str, Any]:
        """
        为多个文件创建版本信息（通用方法）

        Args:
            file_keys: 文件键列表
            edit_type: 编辑类型，默认为AI编辑

        Returns:
            Dict[str, Any]: 创建结果，包含成功/失败统计
        """
        # 过滤掉目录（file_key以'/'结尾的是目录）
        original_count = len(file_keys)
        file_keys = [fk for fk in file_keys if not fk.endswith('/')]

        if len(file_keys) < original_count:
            logger.info(f"过滤掉 {original_count - len(file_keys)} 个目录，剩余 {len(file_keys)} 个文件")

        if not file_keys:
            logger.info("文件列表为空或全部是目录，跳过创建文件版本")
            return {"success": True, "total_count": 0, "success_count": 0, "failed_files": []}

        logger.info(f"开始为 {len(file_keys)} 个文件创建版本")

        try:
            # 获取 Magic Service 客户端
            client = await self._get_magic_service_client()
            if not client:
                logger.error("无法获取 Magic Service 客户端，跳过创建文件版本")
                return {"success": False, "total_count": len(file_keys), "success_count": 0, "failed_files": file_keys}

            # 批量处理：逐个调用单个文件版本创建 API
            results = []
            success_count = 0
            failed_files = []

            for file_key in file_keys:
                try:
                    result = await client.create_file_version(file_key, edit_type=edit_type)

                    # API成功时通常返回data，没有success字段，默认认为成功
                    if result.get("success", True):
                        success_count += 1
                        logger.info(f"文件版本创建成功: {file_key}")
                    else:
                        failed_files.append(file_key)
                        logger.warning(f"文件版本创建失败: {file_key}, 结果: {result}")

                except Exception as e:
                    failed_files.append(file_key)
                    logger.error(f"创建文件版本时发生异常: {file_key}, 错误: {e}")

            # 返回详细的结果统计
            total_count = len(file_keys)
            result_data = {
                "success": success_count > 0,  # 至少有一个成功就认为成功
                "total_count": total_count,
                "success_count": success_count,
                "failed_files": failed_files
            }

            # 记录最终结果
            if success_count == total_count:
                logger.info(f"文件版本创建全部成功: {success_count}/{total_count}")
                result_data["success"] = True
            elif success_count > 0:
                logger.warning(f"文件版本创建部分成功: {success_count}/{total_count}")
                logger.warning(f"失败的文件: {failed_files}")
                result_data["success"] = True  # 部分成功也认为是成功的
            else:
                logger.error(f"文件版本创建全部失败: {success_count}/{total_count}")
                result_data["success"] = False

            return result_data

        except Exception as e:
            logger.error(f"创建文件版本过程中发生异常: {e}", exc_info=True)
            return {"success": False, "total_count": len(file_keys), "success_count": 0, "failed_files": file_keys}

    async def create_changed_files_versions(self, agent_context: AgentContext) -> bool:
        """
        创建变更文件的版本信息

        Args:
            agent_context: Agent 上下文

        Returns:
            bool: 是否成功创建版本
        """
        try:
            # 直接获取变更文件的 file_key 列表
            file_keys = agent_context.get_changed_file_keys()
            if not file_keys:
                logger.info("没有检测到文件变更，跳过创建文件版本")
                return True

            logger.info(f"准备创建 {len(file_keys)} 个文件的版本信息")

            # 调用公共的创建方法
            result = await self.create_file_versions(file_keys, edit_type=FileEditType.AI)
            return result["success"]

        except Exception as e:
            logger.error(f"创建变更文件版本过程中发生异常: {e}", exc_info=True)
            return False
