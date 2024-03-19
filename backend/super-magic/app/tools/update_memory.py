"""
更新长期记忆工具

通过调用 Magic Service API 更新已存在的长期记忆。
"""

import json
from typing import Dict, Any, List, Optional
from pydantic import Field

from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from agentlang.context.tool_context import ToolContext
from app.tools.core import BaseTool, BaseToolParams, tool
from app.i18n import i18n
from app.core.entity.message.server_message import ToolDetail, DisplayType
from app.infrastructure.magic_service.client import MagicServiceClient
from app.infrastructure.magic_service.exceptions import ApiError, ConnectionError
from app.tools.core.magic_service_tool_context import get_magic_service_tool_context

logger = get_logger(__name__)


class UpdateMemoryParams(BaseToolParams):
    memory_id: str = Field(
        ...,
        description="""<!--zh: 要更新的记忆ID（从 <用户长期记忆> 中的 [记忆ID: xxx] 获取）-->
Memory ID to update (get from [Memory ID: xxx] in <用户长期记忆>)""",
    )
    explanation: str = Field(
        ...,
        description="""<!--zh: 解释更新了什么内容（如：将称呼从'大白'改为'小白'）-->
Explain what was updated (e.g., changed nickname from 'Dabai' to 'Xiaobai')""",
    )
    memory: str = Field(
        ...,
        description="""<!--zh: 更新后的完整记忆内容（可以是补充、修改或删减，保留仍然有效的原有信息）-->
Complete updated memory content (can be supplemented, modified, or removed, retain original information that is still valid)""",
    )
    tags: List[str] = Field(
        ...,
        description="""<!--zh: 更新后的标签数组，如 ['个人信息', '昵称']-->
Updated tag array, e.g., ['personal info', 'nickname']""",
    )
    memory_type: str = Field(
        default="user",
        description="""<!--zh: 记忆类型（通常保持与原记忆相同）。user：跨项目通用；project：仅当前项目。如需改变类型，应删除旧记忆并创建新记忆-->
Memory type (usually keep same as original memory). user: cross-project general; project: current project only. To change type, delete old memory and create new one""",
    )


@tool()
class UpdateMemory(BaseTool[UpdateMemoryParams]):
    """<!--zh
    更新长期记忆

    修改已存在记忆的内容或标签。可以补充新信息、修改错误信息或删除过期信息，但要保留仍然有效的原有信息。
    -->
    Update long-term memory

    Modify content or tags of existing memory. Can supplement new information, correct errors, or remove outdated information, but retain original information that is still valid.
    """

    def __init__(self, **data):
        super().__init__(**data)

    async def execute(self, tool_context: ToolContext, params: UpdateMemoryParams) -> ToolResult:
        """
        执行记忆更新操作

        Args:
            tool_context: 工具执行上下文
            params: 更新记忆参数

        Returns:
            包含更新结果的 ToolResult
        """
        try:
            ctx_or_error = get_magic_service_tool_context(tool_context, logger=logger)
            if isinstance(ctx_or_error, ToolResult):
                return ctx_or_error
            ctx = ctx_or_error

            # 记录更新记忆的操作
            logger.info(
                f"开始更新记忆 - ID: {params.memory_id}, 新内容长度: {len(params.memory)}, 新标签: {params.tags}, 记忆类型: {params.memory_type}"
            )

            # 更新记忆
            async with MagicServiceClient(ctx.config) as client:
                result = await client.update_memory(
                    memory_id=params.memory_id,
                    memory=params.memory,
                    tags=params.tags,
                    explanation=params.explanation,
                    metadata=ctx.metadata,
                    memory_type=params.memory_type,
                )

                # 如果执行到这里，说明API调用成功（code=1000）
                message = result.get("message", "更新记忆成功")

                logger.info(f"更新记忆成功 - ID: {params.memory_id}")

                success_msg = json.dumps(
                    {
                        "content": f"{params.memory[:100]}{'...' if len(params.memory) > 100 else ''}",
                        "memory_id": params.memory_id,
                        "success": True,
                    },
                    ensure_ascii=False,
                )

                return ToolResult(
                    content=success_msg,
                    extra_info={
                        "memory_id": params.memory_id,
                        "content": params.memory,
                        "message": message,
                        "success": True,  # 固定为True，因为能执行到这里就是成功
                    },
                )

        except ConnectionError as e:
            error_msg = f"连接记忆服务失败，请检查网络连接后重试"
            logger.error(f"连接 Magic Service 失败: {e}", exc_info=True)
            return ToolResult.error(error_msg)
        except ApiError as e:
            error_msg = f"记忆服务返回错误，请稍后重试"
            logger.error(f"更新记忆API调用失败: {e}", exc_info=True)
            return ToolResult.error(error_msg)
        except Exception as e:
            error_msg = f"更新记忆时发生未知错误，请稍后重试"
            logger.error(f"更新记忆时发生未知错误: {e}", exc_info=True)
            return ToolResult.error(error_msg)

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        """生成工具详情"""
        if result.ok and result.extra_info:
            memory_id = result.extra_info.get("memory_id")
            memory_content = result.extra_info.get("content")

            if memory_id and memory_content:
                # 从参数中获取记忆类型信息
                memory_type = arguments.get("memory_type", "user") if arguments else "user"

                # 更新操作状态直接为已接受
                status = "accepted"

                # 根据 memory_type 设置 type
                type_value = "all" if memory_type == "user" else "project"

                return ToolDetail(
                    type=DisplayType.TEXT,
                    data={
                        "memory_id": memory_id,
                        "memory_content": memory_content,
                        "status": status,
                        "type": type_value,
                        "render_type": "update_memory_card",
                    },
                )
        return None

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        """生成友好的工具调用后反馈"""
        memory_text = arguments.get("memory", "") if arguments else ""
        action = i18n.translate(self.name, category="tool.actions")
        if result.ok:
            preview = (memory_text or "").strip()
            if len(preview) > 50:
                preview = f"{preview[:50]}..."
            return {
                "action": action,
                "remark": i18n.translate("update_memory.success", category="tool.messages", preview=preview),
            }
        return {
            "action": action,
            "remark": i18n.translate("update_memory.error", category="tool.messages"),
        }
