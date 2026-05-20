"""MCP 服务器配置模型

提供 MCP 服务器配置的数据模型和字段验证，支持 HTTP 和 Stdio 两种连接类型。
连接参数构建（如 get_connect_config）属于连接层职责，不在此处定义。
"""

import os
from enum import Enum
from typing import Any, Dict, List, Optional

from agentlang.logger import get_logger
from pydantic import BaseModel, Field, field_validator

logger = get_logger(__name__)


class MCPServerType(str, Enum):
    """MCP 服务器连接类型"""
    HTTP = "http"
    STDIO = "stdio"


class MCPConfigSource(str, Enum):
    """MCP 配置来源"""
    GLOBAL_CONFIG = "global_config"          # 来自 config/mcp.json
    CLIENT_CONFIG = "client_config"          # 来自客户端传入
    EXISTING_MANIFEST = "existing_manifest"  # 来自现有清单文件
    UNKNOWN = "unknown"                      # 未知来源


class MCPServerConfig(BaseModel):
    """MCP 服务器配置

    支持 HTTP/SSE 和 Stdio 两种连接类型，提供字段校验和环境变量扩展。
    """

    name: str = Field(..., description="MCP 服务器名称")
    type: MCPServerType = Field(..., description="连接类型")
    description: Optional[str] = Field(None, description="MCP 服务器描述")

    # HTTP 连接字段
    url: Optional[str] = Field(None, description="HTTP/SSE 服务器 URL")
    token: Optional[str] = Field(None, description="认证令牌")
    headers: Optional[Dict[str, str]] = Field(None, description="自定义 HTTP 头")

    # Stdio 连接字段
    command: Optional[str] = Field(None, description="启动命令")
    args: Optional[List[str]] = Field(default_factory=list, description="命令参数")
    env: Optional[Dict[str, str]] = Field(default_factory=dict, description="环境变量")

    # 工具筛选
    allowed_tools: Optional[List[str]] = Field(None, description="允许的工具列表，None 表示允许所有")

    # 配置来源
    source: MCPConfigSource = Field(MCPConfigSource.UNKNOWN, description="配置来源")

    # 服务器选项
    server_options: Optional[Dict[str, Any]] = Field(
        None, description="服务器选项，包含 label_name、tools 等自定义配置"
    )

    @field_validator('headers', mode='before')
    @classmethod
    def convert_headers_list_to_dict(cls, v):
        """将空列表转换为空字典以兼容旧配置格式"""
        if isinstance(v, list):
            if len(v) == 0:
                logger.debug("将空列表 headers 转换为空字典")
                return {}
            logger.warning(f"headers 字段应该是字典而不是列表，但收到了非空列表: {v}")
            return {}
        return v

    @field_validator('env', mode='before')
    @classmethod
    def expand_env_vars(cls, v):
        """扩展环境变量引用并处理列表到字典的转换

        支持 ${VAR_NAME} 格式的环境变量引用。
        """
        if isinstance(v, list):
            if len(v) == 0:
                logger.debug("将空列表 env 转换为空字典")
                return {}
            logger.warning(f"env 字段应该是字典而不是列表，但收到了非空列表: {v}")
            return {}

        if isinstance(v, dict):
            expanded = {}
            for key, value in v.items():
                if isinstance(value, str) and value.startswith('${') and value.endswith('}'):
                    env_var = value[2:-1]
                    expanded[key] = os.getenv(env_var, value)
                    logger.debug(f"扩展环境变量 {key}: {value} -> {expanded[key]}")
                else:
                    expanded[key] = value
            return expanded
        return v

    @field_validator('server_options', mode='before')
    @classmethod
    def convert_server_options_list_to_dict(cls, v):
        """将空列表转换为空字典以兼容旧配置格式"""
        if isinstance(v, list):
            if len(v) == 0:
                logger.debug("将空列表 server_options 转换为空字典")
                return {}
            logger.warning(f"server_options 字段应该是字典而不是列表，但收到了非空列表: {v}")
            return {}
        return v

    def validate_config(self) -> None:
        """验证配置完整性

        Raises:
            ValueError: 当配置不完整时
        """
        if self.type == MCPServerType.HTTP:
            if not self.url:
                raise ValueError(f"HTTP MCP 服务器 '{self.name}' 需要提供 URL")
            logger.debug(f"HTTP 服务器 '{self.name}' 配置验证通过: {self.url}")
        elif self.type == MCPServerType.STDIO:
            if not self.command:
                raise ValueError(f"Stdio MCP 服务器 '{self.name}' 需要提供启动命令")
            if not self.args:
                raise ValueError(f"Stdio MCP 服务器 '{self.name}' 需要提供命令参数")
            logger.debug(f"Stdio 服务器 '{self.name}' 配置验证通过: {self.command} {' '.join(self.args)}")
        else:
            raise ValueError(f"不支持的 MCP 服务器类型: {self.type}")

    def __str__(self) -> str:
        if self.type == MCPServerType.HTTP:
            return f"MCPServer(name='{self.name}', type=HTTP, url='{self.url}')"
        return f"MCPServer(name='{self.name}', type=Stdio, command='{self.command}')"
