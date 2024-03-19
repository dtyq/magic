"""
Path utilities for storage operations
"""
from typing import Optional
from agentlang.logger import get_logger
from app.infrastructure.storage.types import BaseStorageCredentials

logger = get_logger(__name__)

def get_storage_dir(credentials: BaseStorageCredentials) -> str:
    """
    Args:
        credentials: 存储凭证

    Returns:
        str: 存储目录路径
    """
    return credentials.get_dir()

def get_workspace_dir(credentials: BaseStorageCredentials) -> str:
    """
    获取存储目录路径，优先从 init_client_message 获取 work_dir，回退到 credentials.get_dir()

    Args:
        credentials: 存储凭证

    Returns:
        str: 存储目录路径
    """
    # 优先从 InitClientMessageUtil 获取 work_dir
    try:
        from app.utils.init_client_message_util import InitClientMessageUtil
        work_dir = InitClientMessageUtil.get_work_dir()
        if work_dir:
            logger.debug(f"使用 init_client_message 中的 work_dir: {work_dir}")
            return work_dir
    except Exception as e:
        logger.debug(f"无法从 init_client_message 获取 work_dir: {e}")

    # 回退到凭证中的 dir
    dir_path = credentials.get_dir()
    logger.debug(f"回退到凭证中的 dir: {dir_path}")
    return dir_path

def get_storage_dir_with_fallback(credentials: Optional[BaseStorageCredentials] = None) -> str:
    """
    获取存储目录路径，支持多重回退

    Args:
        credentials: 存储凭证，可能为None

    Returns:
        str: 存储目录路径，如果都获取不到则返回空字符串
    """
    # 优先从 InitClientMessageUtil 获取
    try:
        from app.utils.init_client_message_util import InitClientMessageUtil
        work_dir = InitClientMessageUtil.get_work_dir()
        if work_dir:
            logger.debug(f"使用 init_client_message 中的 work_dir: {work_dir}")
            return work_dir
    except Exception as e:
        logger.debug(f"无法从 init_client_message 获取 work_dir: {e}")

    # 回退到凭证
    if credentials:
        dir_path = credentials.get_dir()
        logger.debug(f"回退到凭证中的 dir: {dir_path}")
        return dir_path

    # 最后回退到空字符串
    logger.warning("无法获取存储目录，返回空字符串")
    return ""
