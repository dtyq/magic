"""
通信配置模块

定义与外部服务通信相关的配置类
"""
from typing import Dict
from pydantic import BaseModel

class MessageSubscriptionConfig(BaseModel):
    """
    消息订阅配置

    用于配置消息的订阅方式和回调接口
    """
    method: str  # HTTP 方法，例如 "POST"
    url: str  # API 端点
    headers: Dict[str, str]  # HTTP 请求头
    enable_obfuscation: bool = True  # 是否启用消息混淆，默认开启


class STSTokenRefreshConfig(BaseModel):
    """
    STS Token刷新配置

    用于配置刷新STS Token的方式和接口
    """
    method: str  # HTTP方法，例如"POST"
    url: str  # API端点
    headers: Dict[str, str]  # HTTP请求头
