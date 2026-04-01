"""图片/视频生成完成后的共享后处理能力。"""

import time
import traceback
from pathlib import Path
from typing import Optional, Union

from app.api.http_dto.file_notification_dto import FileNotificationRequest
from app.infrastructure.magic_service.client import MagicServiceClient
from app.infrastructure.magic_service.config import MagicServiceConfigLoader
from app.service.file_service import FileService
from app.utils.async_file_utils import async_stat
from app.utils.init_client_message_util import InitClientMessageUtil, InitializationError
from app.utils.video_logger import get_video_logger

logger = get_video_logger(__name__)

AI_IMAGE_GENERATION_SOURCE = 5
AI_VIDEO_GENERATION_SOURCE = 7


async def generate_presigned_url_for_file(file_path: str) -> Optional[str]:
    """为工作区文件生成可访问的预签名 URL。"""
    try:
        file_service = FileService()
        download_result = await file_service.get_file_download_url(file_path, expires_in=7200, options={"size": 80})
        presigned_url = download_result.get("download_url")
        platform = download_result.get("platform")

        logger.info(f"为 {platform} 存储生成预签名 URL，file_path: {file_path}")
        logger.info(f"生成的预签名 URL: {presigned_url}")
        return presigned_url
    except Exception as e:
        logger.error(f"为文件 {file_path} 生成预签名 URL 失败: {e}")
        return None


async def notify_generated_media_file(
    file_path: Union[str, Path],
    base_dir: Union[str, Path],
    file_existed: bool,
    file_size: Optional[int] = None,
    source: int = AI_IMAGE_GENERATION_SOURCE,
) -> None:
    """为落盘的 AI 生成媒体文件发送文件变更通知。"""
    try:
        normalized_path = Path(file_path)
        normalized_base_dir = Path(base_dir)

        if file_size is None:
            stat_result = await async_stat(str(normalized_path))
            file_size = stat_result.st_size

        operation = "UPDATE" if file_existed else "CREATE"

        try:
            relative_path = normalized_path.relative_to(normalized_base_dir)
        except ValueError:
            relative_path = normalized_path.name

        notification_request = FileNotificationRequest(
            timestamp=int(time.time()),
            operation=operation,
            file_path=str(relative_path),
            file_size=file_size,
            is_directory=0,
            source=source,
        )

        await send_file_notification(notification_request)
        logger.info(f"文件通知已发送: {operation} {relative_path} ({file_size} 字节)")
    except Exception as e:
        logger.error(f"发送文件通知失败 {file_path}: {e}")


async def send_file_notification(request: FileNotificationRequest) -> None:
    """
    发送媒体文件下载完成通知给 Magic Service

    Args:
        request: 媒体文件下载完成通知请求，包含时间戳、操作类型、文件路径、文件大小和是否为目录
    Returns:
        None
    """
    try:
        logger.info(f"收到媒体文件下载完成通知: {request.model_dump_json()}")
        logger.info(
            f"文件路径: {request.file_path}, 操作: {request.operation}, 大小: {request.file_size} bytes, 是否目录: {request.is_directory}"
        )

        metadata = {}
        try:
            metadata = InitClientMessageUtil.get_metadata()
            logger.info(f"成功获取系统初始化 metadata，包含 {len(metadata)} 个字段")
        except InitializationError as e:
            logger.error(f"系统未初始化: {e}")

        try:
            config = MagicServiceConfigLoader.load_with_fallback()
            logger.info(f"Magic Service 配置加载成功: {config.api_base_url}")

            async with MagicServiceClient(config) as client:
                logger.info(
                    f"即将调用 Magic Service API: {MagicServiceClient.send_file_notification.__qualname__}"
                )
                await client.send_file_notification(metadata=metadata, notification_data=request.model_dump())

            logger.info("媒体文件下载完成通知成功转发到 Magic Service")
        except Exception as e:
            logger.error(f"Magic Service 配置或调用异常: {e}")
            logger.error(traceback.format_exc())
    except Exception as e:
        logger.error(f"处理媒体文件下载完成通知时发生未知错误: {e}")
        logger.error(traceback.format_exc())
