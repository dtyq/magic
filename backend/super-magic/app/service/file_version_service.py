"""
文件版本服务

在 agent 执行完成后调用 magic service API 创建文件版本信息。
"""

import os
from pathlib import Path
from typing import List, Optional, Dict, Any

from agentlang.logger import get_logger
from app.infrastructure.magic_service.client import MagicServiceClient
from app.infrastructure.magic_service.config import MagicServiceConfigLoader, ConfigurationError
from app.infrastructure.magic_service.constants import FileEditType
from app.service.agent_event.file_storage_listener_service import FileStorageListenerService
from app.utils.async_file_utils import get_content_version_from_xattr, get_file_id_from_xattr, get_s3_key_from_xattr, set_content_version_to_xattr

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

    async def create_file_versions(self, file_paths: List[str], edit_type: int = FileEditType.AI) -> Dict[str, Any]:
        """
        为多个文件创建版本信息（通用方法）

        Args:
            file_paths: 文件本地路径列表
            edit_type: 编辑类型，默认为AI编辑

        Returns:
            Dict[str, Any]: 创建结果，包含成功/失败统计
        """
        if not file_paths:
            logger.info("文件列表为空，跳过创建文件版本")
            return {"success": True, "total_count": 0, "success_count": 0, "failed_files": []}

        logger.info(f"开始为 {len(file_paths)} 个文件创建版本")

        try:
            client = await self._get_magic_service_client()
            if not client:
                logger.error("无法获取 Magic Service 客户端，跳过创建文件版本")
                return {"success": False, "total_count": len(file_paths), "success_count": 0, "failed_files": file_paths}

            success_count = 0
            failed_files = []

            for filepath in file_paths:
                try:
                    file_key = await get_s3_key_from_xattr(filepath)
                    if not file_key:
                        logger.warning(f"无法从 xattr 读取 file_key，跳过: {filepath}")
                        failed_files.append(filepath)
                        continue

                    result = await client.create_file_version(file_key, edit_type=edit_type)

                    # API成功时通常返回data，没有success字段，默认认为成功
                    if result.get("success", True):
                        success_count += 1
                        logger.info(f"文件版本创建成功: {filepath}")
                    else:
                        failed_files.append(filepath)
                        logger.warning(f"文件版本创建失败: {filepath}, 结果: {result}")

                except Exception as e:
                    failed_files.append(filepath)
                    logger.error(
                        f"创建文件版本时发生异常: {filepath}, "
                        f"error_type={type(e).__name__}, 错误: {e!r}"
                    )

            total_count = len(file_paths)
            result_data = {
                "success": success_count > 0,
                "total_count": total_count,
                "success_count": success_count,
                "failed_files": failed_files
            }

            if success_count == total_count:
                logger.info(f"文件版本创建全部成功: {success_count}/{total_count}")
                result_data["success"] = True
            elif success_count > 0:
                logger.warning(f"文件版本创建部分成功: {success_count}/{total_count}")
                logger.warning(f"失败的文件: {failed_files}")
                result_data["success"] = True
            else:
                logger.error(f"文件版本创建全部失败: {success_count}/{total_count}")
                result_data["success"] = False

            return result_data

        except Exception as e:
            logger.error(f"创建文件版本过程中发生异常: {e}", exc_info=True)
            return {"success": False, "total_count": len(file_paths), "success_count": 0, "failed_files": file_paths}

    async def get_file_latest_version(self, filepath: str) -> Optional[int]:
        """
        获取文件当前最新内容版本号。

        Args:
            filepath: 文件本地路径

        Returns:
            最新版本号，若无法获取则返回 None
        """
        file_id = await get_file_id_from_xattr(filepath)
        if not file_id:
            logger.warning(f"无法从 xattr 读取 file_id，跳过获取版本: {filepath}")
            return None

        client = await self._get_magic_service_client()
        if not client:
            logger.error("无法获取 Magic Service 客户端，跳过获取文件版本")
            return None

        try:
            data = await client.get_file_latest_version(file_id)
            latest_version = data.get("latest_version")
            if latest_version is None:
                logger.warning(f"API 未返回 latest_version: file_id={file_id}, filepath={filepath}")
                return None
            logger.info(f"获取文件最新版本成功: {filepath}, version={latest_version}")
            return int(latest_version)
        except Exception as e:
            logger.error(f"获取文件最新版本失败: {filepath}, 错误: {e}")
            return None

    async def set_file_version(self, filepath: str, result: Dict[str, Any]) -> None:
        """
        根据 API 返回结果更新文件的 content version xattr。

        仅当返回的 latest_version 大于当前 xattr 中记录的版本时才写入，失败只记录 warning。
        """
        try:
            latest_version = result.get("latest_version")
            if latest_version is None:
                return

            current_version_str = await get_content_version_from_xattr(filepath)
            if current_version_str is not None:
                try:
                    if int(latest_version) <= int(current_version_str):
                        logger.debug(f"content_version 无需更新: {filepath}, current={current_version_str}, latest={latest_version}")
                        return
                except (ValueError, TypeError):
                    pass

            await set_content_version_to_xattr(filepath, str(latest_version))
            logger.info(f"content_version 已更新: {filepath}, version={latest_version}")
        except Exception as e:
            logger.warning(f"更新 content_version 失败: {filepath}, 错误: {e}")
