"""
SDK Tool 接口

提供简化的工具调用接口，让 AI 在 Skill 代码中可以轻松调用工具

通过 HTTP 请求调用工具，避免子进程和 agent_context 传递的复杂性
"""
import os
import json
import sys
import urllib.request
import urllib.error
from typing import Dict, Any, Optional

from .result import Result


class ToolSDK:
    """Tool SDK，提供工具调用接口

    示例:
        from sdk.tool import tool

        # 同步调用（推荐，用于 skill 代码片段）
        result = tool.call('tool_name', {'param': 'value'})
    """

    def __init__(self):
        """初始化 SDK"""
        # 获取服务器地址和端口
        api_port = os.getenv("SUPER_MAGIC_API_PORT", "8002")
        self.api_base_url = f"http://127.0.0.1:{api_port}"
        self.api_timeout = 60.0

    def call(
        self,
        tool_name: str,
        tool_params: Dict[str, Any],
        tool_call_id: Optional[str] = None
    ) -> Result:
        """调用工具（同步）

        通过 HTTP 请求调用工具，避免子进程和 agent_context 传递的复杂性

        Args:
            tool_name: 工具名称
            tool_params: 工具参数字典
            tool_call_id: 可选的工具调用 ID，如果不提供则自动生成

        Returns:
            Result: 工具执行结果

        Raises:
            Exception: 工具执行失败时抛出异常
        """
        import uuid

        # 生成 tool_call_id
        if not tool_call_id:
            tool_call_id = f"call_{uuid.uuid4().hex[:24]}"

        # 构建请求数据
        request_data = {
            "tool_name": tool_name,
            "tool_params": tool_params,
            "tool_call_id": tool_call_id,
        }

        # 发起 HTTP 请求
        url = f"{self.api_base_url}/api/skills/call_tool"

        try:
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
                        name=data.get("name", tool_name),
                        data=data.get("data"),
                    )
                else:
                    error_msg = result_data.get("message", "工具调用失败")
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
            error_msg = f"调用工具时发生异常: {str(e)}"
            print(f"[SDK Error] {error_msg}", file=sys.stderr)
            return Result.error(error_msg, tool_call_id=tool_call_id)


# 全局实例（延迟初始化）
_tool_instance: Optional[ToolSDK] = None


def get_tool() -> ToolSDK:
    """获取全局 tool 实例

    Returns:
        ToolSDK: 全局 tool 实例
    """
    global _tool_instance
    if _tool_instance is None:
        _tool_instance = ToolSDK()
    return _tool_instance


# 创建全局 tool 实例（延迟初始化，第一次导入时不创建）
# 用户可以直接 from sdk.tool import tool 使用
class _ToolProxy:
    """Tool 代理类，用于延迟初始化"""

    def __getattr__(self, name):
        """延迟初始化并转发所有属性访问"""
        global _tool_instance
        if _tool_instance is None:
            _tool_instance = ToolSDK()
        return getattr(_tool_instance, name)


# 导出全局代理实例
tool = _ToolProxy()
