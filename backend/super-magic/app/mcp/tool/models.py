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
    """MCP 工具信息

    描述从 MCP 服务器发现的单个工具，包含注册到框架所需的全部元数据。
    不包含工厂方法（to_mcp_tool 已移至 MCPServerManager._build_mcp_tool），
    保持为纯数据对象。
    """
    name: str                              # 完整工具名称，带前缀（如 mcp_a_tool1）
    original_name: str                     # 原始工具名称，不带前缀
    description: str
    inputSchema: Dict[str, Any]
    server_name: str                       # 所属服务器名称
    session_letter: str                    # 会话字母标识（a/b/c...）
    server_options: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
