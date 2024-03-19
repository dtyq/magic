"""
凭证管理工具模块，处理凭证的导出和加载
"""

import json
import os
from typing import Dict, Any, Optional

from app.core.context.agent_context import AgentContext
from agentlang.logger import get_logger

logger = get_logger(__name__)


def mask_sensitive_value(value: str, prefix_length: int = 8, suffix_length: int = 0) -> str:
    """
    Mask sensitive value for logging

    Args:
        value: The sensitive value to mask
        prefix_length: Number of characters to show at the beginning
        suffix_length: Number of characters to show at the end (0 means no suffix)

    Returns:
        Masked value string
    """
    if not value or not isinstance(value, str):
        return "****"

    if len(value) <= prefix_length + suffix_length:
        return "****"

    if suffix_length > 0:
        return f"{value[:prefix_length]}****{value[-suffix_length:]}"
    else:
        return f"{value[:prefix_length]}****"


def sanitize_headers(headers: Dict[str, str]) -> Dict[str, str]:
    """
    Sanitize HTTP headers by masking sensitive fields

    Args:
        headers: Original headers dictionary

    Returns:
        Sanitized headers dictionary with sensitive values masked
    """
    sensitive_keys = [
        "authorization", "token", "api-key", "apikey", "api_key",
        "x-api-key", "x-auth-token", "x-access-token", "cookie",
        "set-cookie", "x-csrf-token", "x-session-id", "magic-authorization"
    ]

    sanitized = {}
    for key, value in headers.items():
        key_lower = key.lower()
        if any(sensitive in key_lower for sensitive in sensitive_keys):
            if isinstance(value, str):
                # Handle Bearer token format
                if value.startswith("Bearer "):
                    token = value[7:]
                    sanitized[key] = f"Bearer {mask_sensitive_value(token)}"
                else:
                    sanitized[key] = mask_sensitive_value(value)
            else:
                sanitized[key] = "****"
        else:
            sanitized[key] = value

    return sanitized


def sanitize_api_key(api_key: Optional[str]) -> str:
    """
    Sanitize API key for logging

    Args:
        api_key: The API key to sanitize

    Returns:
        Masked API key string
    """
    if not api_key:
        return "N/A"
    return mask_sensitive_value(api_key, prefix_length=8, suffix_length=4)

async def export_credentials(agent_context: AgentContext, file_path: str = "config/upload_credentials.json") -> bool:
    """
    将AgentContext中的上传凭证导出到文件

    Args:
        agent_context: 代理上下文对象
        file_path: 导出文件路径，默认为config/upload_credentials.json

    Returns:
        bool: 导出是否成功
    """
    try:
        # 检查是否有凭证
        credentials = agent_context.storage_credentials
        if not credentials:
            logger.warning("AgentContext中没有存储凭证，无法导出")
            return False

        # 获取沙盒ID
        sandbox_id = agent_context.get_sandbox_id()
        if not sandbox_id:
            logger.warning("AgentContext中没有设置沙盒ID")

        # 确保目录存在
        os.makedirs(os.path.dirname(file_path), exist_ok=True)

        # 将凭证转换为字典
        if hasattr(credentials, "model_dump"):
            # 使用Pydantic的model_dump方法
            creds_dict = credentials.model_dump()
        else:
            # 尝试使用__dict__属性
            creds_dict = {k: v for k, v in credentials.__dict__.items()
                        if not k.startswith('_') and not callable(v)}

        # 创建输出结构
        output_data = {
            "upload_config": creds_dict
        }

        # 添加沙盒ID（如果有）
        if sandbox_id:
            output_data["sandbox_id"] = sandbox_id

        # 添加组织编码（如果有）
        organization_code = agent_context.get_organization_code()
        if organization_code:
            output_data["organization_code"] = organization_code

        # 写入文件
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)

        sandbox_info = f"沙盒ID: {sandbox_id}" if sandbox_id else "未设置沙盒ID"
        logger.info(f"已将上传凭证导出到文件: {file_path} ({sandbox_info})")
        return True

    except Exception as e:
        logger.error(f"导出上传凭证失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

async def load_credentials(file_path: str = "config/upload_credentials.json") -> Optional[Dict[str, Any]]:
    """
    从文件加载上传凭证

    Args:
        file_path: 凭证文件路径

    Returns:
        Optional[Dict[str, Any]]: 凭证数据，加载失败则返回None
    """
    try:
        if not os.path.exists(file_path):
            logger.warning(f"凭证文件不存在: {file_path}")
            return None

        with open(file_path, "r", encoding="utf-8") as f:
            credentials_data = json.load(f)

        if not credentials_data.get("upload_config"):
            logger.error(f"凭证文件格式不正确，缺少upload_config字段: {file_path}")
            return None

        # 检查是否有沙盒ID
        if not credentials_data.get("sandbox_id"):
            logger.error(f"凭证文件缺少必需的sandbox_id字段: {file_path}")
            return None

        logger.info(f"已从文件加载上传凭证: {file_path}, 沙盒ID: {credentials_data.get('sandbox_id')}")

        result = credentials_data["upload_config"]

        # 添加sandbox_id到结果中
        result["sandbox_id"] = credentials_data["sandbox_id"]

        # 添加organization_code（如果存在）
        if "organization_code" in credentials_data:
            result["organization_code"] = credentials_data["organization_code"]

        return result

    except Exception as e:
        logger.error(f"加载上传凭证失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None
