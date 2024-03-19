"""MCP 服务器配置类

提供 MCP 服务器配置的数据模型和验证功能，支持 HTTP 和 Stdio 两种连接类型。
"""

from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, field_validator
import os

from agentlang.logger import get_logger

logger = get_logger(__name__)


class MCPServerType(str, Enum):
    """MCP 服务器连接类型"""
    HTTP = "http"
    STDIO = "stdio"


class MCPConfigSource(str, Enum):
    """MCP 配置来源"""
    GLOBAL_CONFIG = "global_config"      # 来自 config/mcp.json
    CLIENT_CONFIG = "client_config"      # 来自客户端传入
    EXISTING_MANIFEST = "existing_manifest"  # 来自现有清单文件
    UNKNOWN = "unknown"                  # 未知来源


class MCPServerConfig(BaseModel):
    """MCP 服务器配置，参考 Odin 框架设计

    支持 HTTP/SSE 和 Stdio 两种连接类型，提供配置验证和环境变量扩展功能。
    """

    name: str = Field(..., description="MCP 服务器名称")
    type: MCPServerType = Field(..., description="连接类型")

    # HTTP 连接配置
    url: Optional[str] = Field(None, description="HTTP/SSE 服务器 URL")
    token: Optional[str] = Field(None, description="认证令牌")
    headers: Optional[Dict[str, str]] = Field(None, description="自定义 HTTP 头")

    # Stdio 连接配置
    command: Optional[str] = Field(None, description="启动命令")
    args: Optional[List[str]] = Field(default_factory=list, description="命令参数")
    env: Optional[Dict[str, str]] = Field(default_factory=dict, description="环境变量")

    # 工具筛选
    allowed_tools: Optional[List[str]] = Field(None, description="允许的工具列表，None 表示允许所有")

    # 配置来源
    source: MCPConfigSource = Field(MCPConfigSource.UNKNOWN, description="配置来源")

    # 服务器选项
    server_options: Optional[Dict[str, Any]] = Field(None, description="服务器选项，包含 label_name 和 tools_label_name 等")

    @field_validator('headers', mode='before')
    @classmethod
    def convert_headers_list_to_dict(cls, v):
        """将空列表转换为空字典以兼容旧配置格式

        某些配置可能使用 [] 表示空的 headers，这里将其转换为 {}
        """
        if isinstance(v, list):
            if len(v) == 0:
                logger.debug("将空列表 headers 转换为空字典")
                return {}
            else:
                logger.warning(f"headers 字段应该是字典而不是列表，但收到了非空列表: {v}")
                return {}
        return v

    @field_validator('env', mode='before')
    @classmethod
    def expand_env_vars(cls, v):
        """扩展环境变量并处理列表到字典的转换

        支持 ${VAR_NAME} 格式的环境变量引用。
        同时将空列表转换为空字典以兼容旧配置格式。
        """
        # 先处理列表转换，类似于 headers 的处理
        if isinstance(v, list):
            if len(v) == 0:
                logger.debug("将空列表 env 转换为空字典")
                return {}
            else:
                logger.warning(f"env 字段应该是字典而不是列表，但收到了非空列表: {v}")
                return {}

        # 处理环境变量扩展
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
        """将空列表转换为空字典以兼容旧配置格式

        某些配置可能使用 [] 表示空的 server_options，这里将其转换为 {}
        """
        if isinstance(v, list):
            if len(v) == 0:
                logger.debug("将空列表 server_options 转换为空字典")
                return {}
            else:
                logger.warning(f"server_options 字段应该是字典而不是列表，但收到了非空列表: {v}")
                return {}
        return v

    def validate_config(self) -> None:
        """验证配置完整性

        Raises:
            ValueError: 当配置不完整或无效时
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

    def get_connect_config(self) -> Dict[str, Any]:
        """获取连接配置

        Returns:
            Dict[str, Any]: 连接配置字典
        """
        if self.type == MCPServerType.HTTP:
            http_config: Dict[str, Any] = {"base_url": self.url}
            # token 通过 Authorization header 传递，不在这里配置
            logger.debug(f"生成 HTTP 连接配置: {self.name}")
            return http_config

        elif self.type == MCPServerType.STDIO:
            stdio_config: Dict[str, Any] = {
                "command": self.command,
                "args": self.args,
                "env": self.env
            }
            logger.debug(f"生成 Stdio 连接配置: {self.name}")
            return stdio_config

        raise ValueError(f"不支持的 MCP 服务器类型: {self.type}")

    def __str__(self) -> str:
        """字符串表示"""
        if self.type == MCPServerType.HTTP:
            return f"MCPServer(name='{self.name}', type=HTTP, url='{self.url}')"
        else:
            return f"MCPServer(name='{self.name}', type=Stdio, command='{self.command}')"
