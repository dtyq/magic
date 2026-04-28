"""预签名 URL 生成工具函数。"""

import mimetypes
import os

from agentlang.logger import get_logger

logger = get_logger(__name__)

# 视频文件扩展名到 MIME 类型的映射（补充 mimetypes 标准库可能缺失的类型）
_VIDEO_MIME_TYPES: dict[str, str] = {
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".wmv": "video/x-ms-wmv",
    ".flv": "video/x-flv",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".ts": "video/mp2t",
    ".m3u8": "application/x-mpegURL",
    ".3gp": "video/3gpp",
    ".3g2": "video/3gpp2",
    ".ogv": "video/ogg",
    ".mpeg": "video/mpeg",
    ".mpg": "video/mpeg",
}


def _get_content_type(file_path: str) -> str | None:
    """根据文件扩展名推断 MIME 类型，优先返回视频类型。"""
    ext = os.path.splitext(file_path)[1].lower()
    if ext in _VIDEO_MIME_TYPES:
        return _VIDEO_MIME_TYPES[ext]
    mime_type, _ = mimetypes.guess_type(file_path)
    return mime_type


async def generate_presigned_url(file_path: str, expires_in: int = 7200) -> str:
    """为本地文件（存储服务路径）生成预签名下载 URL。

    Args:
        file_path: 文件路径（相对于工作区根目录，或存储服务键名）
        expires_in: URL 有效期（秒），默认 7200

    Returns:
        str: 预签名下载 URL

    Raises:
        ValueError: 无法生成预签名 URL 时抛出
    """
    # 延迟导入避免循环依赖
    from app.service.file_service import FileService

    # 根据文件类型设置 response-content-type，避免存储服务返回 application/octet-stream
    # 导致视频 API 拒绝请求
    options: dict = {}
    content_type = _get_content_type(file_path)
    if content_type:
        options["params"] = {"response-content-type": content_type}
        logger.debug(f"为预签名 URL 设置 response-content-type: {content_type} ({file_path})")

    file_service = FileService()
    download_result = await file_service.get_file_download_url(
        file_path, expires_in=expires_in, options=options
    )
    presigned_url = download_result.get("download_url")
    if not presigned_url:
        raise ValueError(f"无法为文件生成预签名 URL: {file_path}")

    logger.info(f"预签名 URL 生成成功: {file_path}")
    return presigned_url
