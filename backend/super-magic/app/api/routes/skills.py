"""
Skill API Routes

提供 Skill SDK 工具调用的 HTTP 接口
"""
import json
import traceback
import uuid
from typing import Dict, Any, Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.api.http_dto.response import (
    BaseResponse,
    create_success_response,
    create_error_response,
)
from app.core.context.agent_context import AgentContext
from app.service.agent_dispatcher import AgentDispatcher
from app.tools.core.tool_call_executor import tool_call_executor
from agentlang.chat_history.chat_history_models import ToolCall, FunctionCall
from app.mcp.manager import get_global_mcp_manager

router = APIRouter(prefix="/skills", tags=["Skill工具调用"])

logger = get_logger(__name__)

# 创建 AgentDispatcher 实例
agent_dispatcher = AgentDispatcher.get_instance()

class CallToolRequest(BaseModel):
    """工具调用请求模型"""
    tool_name: str = Field(..., description="工具名称")
    tool_params: Dict[str, Any] = Field(..., description="工具参数字典")
    tool_call_id: Optional[str] = Field(None, description="工具调用ID，如果不提供则自动生成")
    agent_context_id: str = Field(..., description="调用方 AgentContext 的唯一标识符，由 run_sdk_snippet 注入子进程环境变量")


@router.post("/call_tool", response_model=BaseResponse)
async def call_tool(request: CallToolRequest):
    """
    调用工具接口

    用于 Skill SDK 通过 HTTP 请求调用工具
    """
    try:
        # 从注册表精确查找调用方的 AgentContext
        from app.core.context.agent_context_registry import AgentContextRegistry
        agent_context = AgentContextRegistry.get_instance().get(request.agent_context_id)
        if agent_context is None:
            error_msg = (
                f"agent_context_id '{request.agent_context_id}' was not found in the registry. "
                "Unable to route this request to the correct AgentContext."
            )
            logger.error(error_msg)
            return create_error_response(
                message=error_msg,
                data={"ok": False, "content": error_msg}
            )

        # 生成 tool_call_id
        tool_call_id = request.tool_call_id or f"call_{uuid.uuid4().hex[:24]}"

        agent_label = agent_context.get_agent_session_label()
        logger.info(
            f"Skill SDK 通过 HTTP 调用工具: {request.tool_name}, params: {request.tool_params}, "
            f"tool_call_id: {tool_call_id}, agent: {agent_label}, agent_context_id: {request.agent_context_id}"
        )

        # 创建 ToolCall 对象
        tool_call = ToolCall(
            id=tool_call_id,
            type="function",
            function=FunctionCall(
                name=request.tool_name,
                arguments=json.dumps(request.tool_params, ensure_ascii=False)
            )
        )

        # 使用 tool_call_executor 执行工具
        results = await tool_call_executor.execute(
            tool_calls=[tool_call],
            agent_context=agent_context
        )

        # 返回第一个结果
        if results:
            result = results[0]
            logger.debug(f"工具调用完成: {request.tool_name}, ok: {result.ok}")

            # 将 ToolResult 转换为字典
            result_dict = {
                "ok": result.ok,
                "content": result.content,
                "tool_call_id": result.tool_call_id,
                "execution_time": result.execution_time,
                "name": result.name,
                "data": result.data,
            }

            return create_success_response(
                message="Tool call succeeded" if result.ok else "Tool call failed",
                data=result_dict
            )
        else:
            error_msg = "Tool execution returned no result."
            logger.error(error_msg)
            return create_error_response(
                message=error_msg,
                data={"ok": False, "content": error_msg}
            )

    except HTTPException:
        # 重新抛出 HTTP 异常
        raise
    except Exception as e:
        logger.error(f"调用工具时发生异常: {e}", exc_info=True)
        logger.error(traceback.format_exc())
        return create_error_response(
            message=f"Tool call failed: {str(e)}",
            data={"ok": False, "content": str(e)}
        )


# ==========================
# MCP API
# ==========================

class McpCallRequest(BaseModel):
    """MCP 工具调用请求模型"""
    server_name: str = Field(..., description="MCP 服务器名称")
    tool_name: str = Field(..., description="工具名称（原始名称）")
    tool_params: Dict[str, Any] = Field(..., description="工具参数字典")
    tool_call_id: Optional[str] = Field(None, description="工具调用ID")
    agent_context_id: str = Field(..., description="调用方 AgentContext 的唯一标识符，由 run_sdk_snippet 注入子进程环境变量")


@router.post("/mcp_call", response_model=BaseResponse)
async def mcp_call(request: McpCallRequest):
    """
    调用 MCP 工具接口

    用于 MCP SDK 通过 HTTP 请求调用 MCP 工具
    """
    try:
        # 从注册表精确查找调用方的 AgentContext
        from app.core.context.agent_context_registry import AgentContextRegistry
        agent_context = AgentContextRegistry.get_instance().get(request.agent_context_id)
        if agent_context is None:
            error_msg = (
                f"agent_context_id '{request.agent_context_id}' was not found in the registry. "
                "Unable to route this request to the correct AgentContext."
            )
            logger.error(error_msg)
            return create_error_response(
                message=error_msg,
                data={"ok": False, "content": error_msg}
            )

        manager = get_global_mcp_manager()
        if not manager:
            return create_error_response(
                message="MCP manager is not initialized.",
                data={"ok": False, "content": "MCP manager is not initialized."}
            )

        # 根据服务器名称和原始工具名称获取完整的工具名称（如 mcp_a_toolname）
        full_tool_name = manager.get_full_tool_name(request.server_name, request.tool_name)
        if not full_tool_name:
            return create_error_response(
                message=f"Tool not found: {request.server_name}.{request.tool_name}",
                data={"ok": False, "content": f"Tool not found: {request.server_name}.{request.tool_name}"}
            )

        # 生成 tool_call_id
        tool_call_id = request.tool_call_id or f"call_{uuid.uuid4().hex[:24]}"

        agent_label = agent_context.get_agent_session_label()
        logger.info(
            f"MCP SDK 通过 HTTP 调用工具: {full_tool_name} (服务器: {request.server_name}, 原始名称: {request.tool_name}), "
            f"params: {request.tool_params}, tool_call_id: {tool_call_id}, agent: {agent_label}, agent_context_id: {request.agent_context_id}"
        )

        # 创建 ToolCall 对象，使用统一的 tool_call_executor 执行
        tool_call = ToolCall(
            id=tool_call_id,
            type="function",
            function=FunctionCall(
                name=full_tool_name,
                arguments=json.dumps(request.tool_params, ensure_ascii=False)
            )
        )

        # 使用统一的 tool_call_executor 执行工具
        results = await tool_call_executor.execute(
            tool_calls=[tool_call],
            agent_context=agent_context
        )

        # 返回第一个结果
        if results:
            result = results[0]
            logger.debug(f"MCP 工具调用完成: {full_tool_name}, ok: {result.ok}")

            # 将 ToolResult 转换为字典
            result_dict = {
                "ok": result.ok,
                "content": result.content,
                "tool_call_id": result.tool_call_id,
                "execution_time": result.execution_time,
                "name": result.name,
                "data": result.data,
            }

            return create_success_response(
                message="MCP tool call succeeded" if result.ok else "MCP tool call failed",
                data=result_dict
            )
        else:
            return create_error_response(
                message="Tool execution returned no result.",
                data={"ok": False, "content": "Tool execution returned no result."}
            )

    except HTTPException:
        # 重新抛出 HTTP 异常
        raise
    except Exception as e:
        logger.error(f"调用 MCP 工具时发生异常: {e}", exc_info=True)
        logger.error(traceback.format_exc())
        return create_error_response(
            message=f"MCP tool call failed: {str(e)}",
            data={"ok": False, "content": str(e)}
        )


@router.get("/mcp_servers", response_model=BaseResponse)
async def get_mcp_servers():
    """
    获取 MCP 服务器列表
    """
    try:
        manager = get_global_mcp_manager()
        if not manager:
            return create_success_response(
                message="MCP 管理器未初始化",
                data={"servers": []}
            )

        # 只返回已成功连接的服务器
        servers = []

        for server_name in manager.get_connected_servers():
            # 获取该服务器的工具
            server_tools = manager.get_server_tools(server_name)

            # 获取 label_name
            label_name = ""
            config = manager.get_server_config(server_name)
            if config and config.server_options and isinstance(config.server_options, dict):
                label_name = config.server_options.get("label_name", "")

            servers.append({
                "name": server_name,
                "label_name": label_name,
                "status": "success",
                "tool_count": len(server_tools),
                "tools": server_tools,
                "error": None
            })

        return create_success_response(
            message=f"获取服务器列表成功，共 {len(servers)} 个服务器",
            data={"servers": servers}
        )

    except Exception as e:
        logger.error(f"获取 MCP 服务器列表时发生异常: {e}", exc_info=True)
        return create_error_response(
            message=f"获取服务器列表失败: {str(e)}",
            data={"servers": []}
        )


@router.get("/mcp_tools", response_model=BaseResponse)
async def get_mcp_tools(server_name: Optional[str] = None):
    """
    获取 MCP 工具列表

    Args:
        server_name: 可选，指定服务器名称过滤
    """
    try:
        manager = get_global_mcp_manager()
        if not manager:
            return create_success_response(
                message="MCP 管理器未初始化",
                data={"tools": []}
            )

        # 获取所有工具
        all_tools = await manager.get_all_tools()

        # 过滤指定服务器的工具
        tools = []
        for tool_name, tool_info in all_tools.items():
            if server_name and tool_info.server_name != server_name:
                continue

            tools.append({
                "name": tool_name,
                "original_name": tool_info.original_name,
                "server_name": tool_info.server_name,
                "description": tool_info.description,
                "input_schema": tool_info.inputSchema
            })

        message = f"获取工具列表成功，共 {len(tools)} 个工具"
        if server_name:
            message += f"（服务器: {server_name}）"

        return create_success_response(
            message=message,
            data={"tools": tools}
        )

    except Exception as e:
        logger.error(f"获取 MCP 工具列表时发生异常: {e}", exc_info=True)
        return create_error_response(
            message=f"获取工具列表失败: {str(e)}",
            data={"tools": []}
        )


class McpAddServerRequest(BaseModel):
    """添加 MCP 服务器请求模型"""
    name: str = Field(..., description="MCP 服务器名称")
    type: str = Field(..., description="连接类型: stdio 或 http")
    command: Optional[str] = Field(None, description="启动命令（stdio 类型必填）")
    args: Optional[List[str]] = Field(None, description="命令参数列表（stdio 类型可选）")
    url: Optional[str] = Field(None, description="服务器 URL（http 类型必填）")
    env: Optional[Dict[str, str]] = Field(None, description="环境变量字典")
    label_name: Optional[str] = Field(None, description="服务器显示名称")


@router.post("/mcp_add_server", response_model=BaseResponse)
async def mcp_add_server(request: McpAddServerRequest):
    """
    动态添加 MCP 服务器

    运行时将新服务器加入全局 MCP 管理器，同名服务器会先断开旧连接再重建。
    """
    try:
        from app.mcp.manager import initialize_global_mcp_manager

        # 参数校验
        server_type = request.type.lower()
        if server_type not in ("stdio", "http"):
            return create_error_response(
                message=f"不支持的服务器类型: {request.type}，仅支持 stdio 或 http",
                data={"ok": False, "error": f"不支持的服务器类型: {request.type}"}
            )

        if server_type == "stdio" and not request.command:
            return create_error_response(
                message="stdio 类型服务器必须提供 command 参数",
                data={"ok": False, "error": "stdio 类型服务器必须提供 command 参数"}
            )

        if server_type == "http" and not request.url:
            return create_error_response(
                message="http 类型服务器必须提供 url 参数",
                data={"ok": False, "error": "http 类型服务器必须提供 url 参数"}
            )

        # 构建服务器配置字典
        server_config: Dict[str, Any] = {
            "name": request.name,
            "type": server_type,
            "source": "client_config",
        }
        if request.command:
            server_config["command"] = request.command
        if request.args:
            server_config["args"] = request.args
        if request.url:
            server_config["url"] = request.url
        if request.env:
            server_config["env"] = request.env
        if request.label_name:
            server_config["server_options"] = {"label_name": request.label_name}

        logger.info(f"动态添加 MCP 服务器: {request.name} (type={server_type})")

        # 以追加模式初始化，只添加/更新这一个服务器
        success = await initialize_global_mcp_manager(
            mcp_servers=[server_config],
            append_mode=True,
        )

        if not success:
            return create_error_response(
                message=f"添加 MCP 服务器失败: {request.name}",
                data={"ok": False, "error": f"服务器 {request.name} 连接失败，请检查配置"}
            )

        # 查询新增服务器的工具列表
        manager = get_global_mcp_manager()
        tools: List[str] = []
        if manager and manager.has_server(request.name):
            tools = manager.get_server_tools(request.name)
        elif manager and request.name in manager.failed_servers:
            return create_error_response(
                message=f"MCP 服务器 {request.name} 连接失败",
                data={"ok": False, "error": f"服务器 {request.name} 连接失败，请检查配置和网络"}
            )

        return create_success_response(
            message=f"MCP 服务器 {request.name} 添加成功，共 {len(tools)} 个工具",
            data={
                "ok": True,
                "name": request.name,
                "tool_count": len(tools),
                "tools": tools,
            }
        )

    except Exception as e:
        logger.error(f"添加 MCP 服务器时发生异常: {e}", exc_info=True)
        return create_error_response(
            message=f"添加 MCP 服务器失败: {str(e)}",
            data={"ok": False, "error": str(e)}
        )


@router.get("/mcp_tool_schema", response_model=BaseResponse)
async def get_mcp_tool_schema(server_name: str, tool_name: str):
    """
    获取 MCP 工具 Schema（支持单个或多个工具）

    Args:
        server_name: 服务器名称
        tool_name: 工具名称（原始名称），支持逗号分隔多个工具名
    """
    try:
        manager = get_global_mcp_manager()
        if not manager:
            return create_error_response(
                message="MCP 管理器未初始化",
                data={"results": []}
            )

        # 解析工具名（支持逗号分隔）
        tool_names = [name.strip() for name in tool_name.split(',')]

        # 获取所有工具
        all_tools = await manager.get_all_tools()

        results = []
        for t_name in tool_names:
            found = False
            for full_name, t_info in all_tools.items():
                if (t_info.server_name == server_name and
                    t_info.original_name == t_name):
                    results.append({
                        "tool_name": t_name,
                        "server_name": server_name,
                        "schema": t_info.inputSchema
                    })
                    found = True
                    break

            if not found:
                results.append({
                    "tool_name": t_name,
                    "server_name": server_name,
                    "error": f"未找到工具: {server_name}.{t_name}"
                })

        # 统一返回数组格式
        return create_success_response(
            message=f"获取 {len(tool_names)} 个工具 Schema 完成",
            data={"results": results}
        )

    except Exception as e:
        logger.error(f"获取工具 Schema 时发生异常: {e}", exc_info=True)
        return create_error_response(
            message=f"获取工具 Schema 失败: {str(e)}",
            data={"schema": {}}
        )
