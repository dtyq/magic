"""
模型过滤器

提供给 ConfigYamlProvider 的模型过滤函数，
用于跳过由更高优先级 provider（如 magic-service）管理的模型。
"""
import os
from urllib.parse import urlparse

from agentlang.config.models.model_config import ModelConfig


def should_skip_model(model_config: ModelConfig) -> bool:
    """判断该模型是否应被跳过

    匹配规则：
    1. api_base_url 的域名与环境变量 MAGIC_API_BASE_URL 的域名相同（非空时比较）
    2. api_base_url 以 http://magic-gateway/ 或 https://magic-gateway/ 开头

    Args:
        model_config: 待检查的模型配置

    Returns:
        True 表示应跳过该模型
    """
    api_base_url = model_config.api_base_url
    if not api_base_url:
        return False

    # 检查域名是否与 MAGIC_API_BASE_URL 环境变量的域名相同
    magic_api_base = os.environ.get("MAGIC_API_BASE_URL", "")
    if magic_api_base:
        magic_host = urlparse(magic_api_base).hostname or ""
        current_host = urlparse(api_base_url).hostname or ""
        if magic_host and current_host and magic_host.lower() == current_host.lower():
            return True

    # 检查是否以 magic-gateway 开头
    url_lower = api_base_url.lower()
    if url_lower.startswith("http://magic-gateway/") or url_lower.startswith("https://magic-gateway/"):
        return True

    return False
