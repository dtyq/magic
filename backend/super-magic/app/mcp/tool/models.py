"""MCP 工具层数据模型

统一定义 MCP 工具信息和服务器操作结果数据类，消除跨模块的重复定义。
"""

from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional


@dataclass
class MCPServerResult:
    """MCP 服务器操作结果

    统一用于连接发现结果和事件通知，替代原先分散的
    ServerDiscoveryResult（server_manager）和 MCPServerInitResult（event_manager）。
    """
    name: str
    status: str        # "success", "failed", "timeout"
    duration: float    # 操作耗时（秒）
    tools: List[str]   # 工具名称列表（原始名称，不带前缀）
    tool_count: int
    error: Optional[str] = None
    label_name: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class MCPToolInfo:
    """从 MCP 服务器发现的单个工具信息

    纯数据对象，包含注册到框架所需的全部元数据。
    """
    name: str                              # 工具名称（原始名称）
    original_name: str                     # 原始工具名称
    description: str
    inputSchema: Dict[str, Any]
    server_name: str                       # 所属服务器名称
    server_options: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class UnavailableToolInfo:
    """不可用的 MCP 工具信息

    记录因 schema 验证失败等原因无法注册的工具，
    便于查询或调用时返回明确的错误信息。
    """
    name: str                # 工具原始名称
    server_name: str         # 所属服务器名称
    description: str         # 工具描述
    error: str               # 不可用原因

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
