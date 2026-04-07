"""
MCP SDK 接口

提供简化的 MCP 工具调用接口，通过 HTTP 请求调用
"""
import os
import json
import sys
import urllib.request
import urllib.error
import urllib.parse
from typing import Dict, Any, Optional, List, Union

from .result import Result


class McpSDK:
    """MCP SDK，提供 MCP 工具调用和信息查询接口

    通过 HTTP 请求调用 MCP 相关功能

    示例:
        from sdk.mcp import mcp

        # 调用 MCP 工具
        result = mcp.call('server_name', 'tool_name', {'param': 'value'})

        # 获取服务器列表
        servers = mcp.get_servers()

        # 获取工具列表
        tools = mcp.get_tools(server_name='my-server')

        # 获取工具 Schema
        schema = mcp.get_tool_schema('server_name', 'tool_name')
    """

    def __init__(self):
        """初始化 SDK"""
        # 获取服务器地址和端口
        api_port = os.getenv("SUPER_MAGIC_API_PORT", "8002")
        self.api_base_url = f"http://127.0.0.1:{api_port}"
        self.api_timeout = 60.0

    def call(
        self,
        server_name: str,
        tool_name: str,
        tool_params: Dict[str, Any],
        tool_call_id: Optional[str] = None
    ) -> Result:
        """调用 MCP 工具（同步）

        通过 HTTP 请求调用 MCP 工具

        Args:
            server_name: MCP 服务器名称
            tool_name: 工具名称（原始名称，不带前缀）
            tool_params: 工具参数字典
            tool_call_id: 可选的工具调用 ID

        Returns:
            Result: 工具执行结果
        """
        import uuid

        try:
            # 生成 tool_call_id
            if not tool_call_id:
                tool_call_id = f"call_{uuid.uuid4().hex[:24]}"

            # 构建请求数据
        # agent_context_id 由 run_sdk_snippet 注入到子进程环境变量，
        # SDK Runtime 服务端用它精确路由到发起调用的 Agent context。
            agent_context_id = os.getenv("SUPER_MAGIC_AGENT_CONTEXT_ID", "")
            request_data = {
                "server_name": server_name,
                "tool_name": tool_name,
                "tool_params": tool_params,
                "tool_call_id": tool_call_id,
                "agent_context_id": agent_context_id,
            }

            # 发起 HTTP 请求
            url = f"{self.api_base_url}/api/sdk-runtime/mcp_call"

            # 将请求数据转换为 JSON
            data = json.dumps(request_data).encode('utf-8')

            # 创建请求
            req = urllib.request.Request(
                url,
                data=data,
                headers={'Content-Type': 'application/json'},
                method='POST'
            )

            # 发送请求
            with urllib.request.urlopen(req, timeout=self.api_timeout) as response:
                # 解析响应
                result_data = json.loads(response.read().decode('utf-8'))

                if result_data.get("code") == 1000:  # SUCCESS
                    data = result_data.get("data", {})
                    return Result(
                        ok=data.get("ok", True),
                        content=data.get("content", ""),
                        execution_time=data.get("execution_time", 0.0),
                        tool_call_id=data.get("tool_call_id", tool_call_id),
                        name=data.get("name", f"mcp_{server_name}_{tool_name}"),
                        data=data.get("data"),
                    )
                else:
                    error_msg = result_data.get("message", "MCP 工具调用失败")
                    error_data = result_data.get("data", {})
                    return Result.error(
                        error_data.get("content", error_msg),
                        tool_call_id=tool_call_id
                    )

        except urllib.error.HTTPError as e:
            error_msg = f"HTTP 请求失败: {e.code} - {e.reason}"
            print(f"[SDK Error] {error_msg}", file=sys.stderr)
            return Result.error(error_msg, tool_call_id=tool_call_id)

        except urllib.error.URLError as e:
            error_msg = f"HTTP 请求错误: {str(e.reason)}"
            print(f"[SDK Error] {error_msg}", file=sys.stderr)
            return Result.error(error_msg, tool_call_id=tool_call_id)

        except Exception as e:
            error_msg = f"调用 MCP 工具失败: {str(e)}"
            print(f"[SDK Error] {error_msg}", file=sys.stderr)
            return Result.error(error_msg, tool_call_id=tool_call_id)

    def get_servers(self) -> List[Dict[str, Any]]:
        """获取 MCP 服务器列表（同步）

        Returns:
            List[Dict]: 服务器列表
        """
        try:
            url = f"{self.api_base_url}/api/sdk-runtime/mcp_servers"

            # 创建请求
            req = urllib.request.Request(url, method='GET')

            # 发送请求
            with urllib.request.urlopen(req, timeout=self.api_timeout) as response:
                result_data = json.loads(response.read().decode('utf-8'))

                if result_data.get("code") == 1000:
                    data = result_data.get("data", {})
                    return data.get("servers", [])
                else:
                    print(f"[SDK Warning] 获取服务器列表失败: {result_data.get('message')}", file=sys.stderr)
                    return []

        except Exception as e:
            print(f"[SDK Error] 获取服务器列表失败: {e}", file=sys.stderr)
            return []

    def get_tools(self, server_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取 MCP 工具列表（同步）

        Args:
            server_name: 可选，指定服务器名称

        Returns:
            List[Dict]: 工具列表
        """
        try:
            url = f"{self.api_base_url}/api/sdk-runtime/mcp_tools"
            if server_name:
                url += f"?server_name={urllib.parse.quote(server_name)}"

            # 创建请求
            req = urllib.request.Request(url, method='GET')

            # 发送请求
            with urllib.request.urlopen(req, timeout=self.api_timeout) as response:
                result_data = json.loads(response.read().decode('utf-8'))

                if result_data.get("code") == 1000:
                    data = result_data.get("data", {})
                    return data.get("tools", [])
                else:
                    print(f"[SDK Warning] 获取工具列表失败: {result_data.get('message')}", file=sys.stderr)
                    return []

        except Exception as e:
            print(f"[SDK Error] 获取工具列表失败: {e}", file=sys.stderr)
            return []

    def add_server(
        self,
        name: str,
        server_type: str,
        command: Optional[str] = None,
        args: Optional[List[str]] = None,
        url: Optional[str] = None,
        env: Optional[Dict[str, str]] = None,
        label_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """动态添加 MCP 服务器（同步）

        将新服务器加入运行中的全局 MCP 管理器。同名服务器会先断开旧连接再重建。
        仅在当前运行期间有效，重启后失效。

        Args:
            name: MCP 服务器名称
            server_type: 连接类型，"stdio" 或 "http"
            command: 启动命令（stdio 类型必填）
            args: 命令参数列表（stdio 类型可选）
            url: 服务器 URL（http 类型必填）
            env: 环境变量字典
            label_name: 服务器显示名称

        Returns:
            Dict: 包含 ok, name, tool_count, tools 等字段的结果字典
        """
        try:
            request_data: Dict[str, Any] = {
                "name": name,
                "type": server_type,
            }
            if command is not None:
                request_data["command"] = command
            if args is not None:
                request_data["args"] = args
            if url is not None:
                request_data["url"] = url
            if env is not None:
                request_data["env"] = env
            if label_name is not None:
                request_data["label_name"] = label_name

            url_str = f"{self.api_base_url}/api/sdk-runtime/mcp_add_server"
            data = json.dumps(request_data).encode("utf-8")

            req = urllib.request.Request(
                url_str,
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )

            with urllib.request.urlopen(req, timeout=self.api_timeout) as response:
                result_data = json.loads(response.read().decode("utf-8"))

                if result_data.get("code") == 1000:
                    return result_data.get("data", {"ok": True})
                else:
                    error_msg = result_data.get("message", "添加 MCP 服务器失败")
                    return {"ok": False, "error": error_msg}

        except urllib.error.HTTPError as e:
            error_msg = f"HTTP 请求失败: {e.code} - {e.reason}"
            print(f"[SDK Error] {error_msg}", file=sys.stderr)
            return {"ok": False, "error": error_msg}

        except urllib.error.URLError as e:
            error_msg = f"HTTP 请求错误: {str(e.reason)}"
            print(f"[SDK Error] {error_msg}", file=sys.stderr)
            return {"ok": False, "error": error_msg}

        except Exception as e:
            error_msg = f"添加 MCP 服务器失败: {str(e)}"
            print(f"[SDK Error] {error_msg}", file=sys.stderr)
            return {"ok": False, "error": error_msg}

    def get_tool_schema(self, server_name: str, tool_name: Union[str, List[str]]) -> List[Dict[str, Any]]:
        """获取工具 Schema（同步，支持单个或多个工具）

        Args:
            server_name: 服务器名称
            tool_name: 工具名称（原始名称），可以是单个字符串或字符串列表

        Returns:
            List[Dict]: 结果列表，每个元素包含 tool_name, server_name, schema 或 error
        """
        try:
            # 处理输入，支持单个工具名或工具名列表
            tool_names = tool_name if isinstance(tool_name, str) else ','.join(tool_name)

            url = f"{self.api_base_url}/api/sdk-runtime/mcp_tool_schema"
            url += f"?server_name={urllib.parse.quote(server_name)}&tool_name={urllib.parse.quote(tool_names)}"

            # 创建请求
            req = urllib.request.Request(url, method='GET')

            # 发送请求
            with urllib.request.urlopen(req, timeout=self.api_timeout) as response:
                result_data = json.loads(response.read().decode('utf-8'))

                if result_data.get("code") == 1000:
                    data = result_data.get("data", {})
                    return data.get("results", [])
                else:
                    print(f"[SDK Warning] 获取工具 Schema 失败: {result_data.get('message')}", file=sys.stderr)
                    return []

        except Exception as e:
            print(f"[SDK Error] 获取工具 Schema 失败: {e}", file=sys.stderr)
            return []


# 全局实例（延迟初始化）
_mcp_instance: Optional[McpSDK] = None


def get_mcp() -> McpSDK:
    """获取全局 mcp 实例

    Returns:
        McpSDK: 全局 mcp 实例
    """
    global _mcp_instance
    if _mcp_instance is None:
        _mcp_instance = McpSDK()
    return _mcp_instance


# 创建全局 mcp 实例（延迟初始化）
class _McpProxy:
    """MCP 代理类，用于延迟初始化"""

    def __getattr__(self, name):
        """延迟初始化并转发所有属性访问"""
        global _mcp_instance
        if _mcp_instance is None:
            _mcp_instance = McpSDK()
        return getattr(_mcp_instance, name)


# 导出全局代理实例
mcp = _McpProxy()

__all__ = ['McpSDK', 'get_mcp', 'mcp']
