"""
删除长期记忆工具

通过调用 Magic Service API 删除已存在的长期记忆。
"""

import json
from typing import Dict, Any, Optional
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


class DeleteMemoryParams(BaseToolParams):
    memory_id: str = Field(
        ...,
        description="""<!--zh: 要删除的记忆ID（从 <用户长期记忆> 中的 [记忆ID: xxx] 获取）-->
Memory ID to delete (get from [Memory ID: xxx] in <用户长期记忆>)""",
    )
    memory: str = Field(
        ...,
        description="""<!--zh: （可选）要删除的记忆内容，用于工具回显“被删除的记忆详情”。建议从 <用户长期记忆> 对应 ID 的那一行内容直接拷贝过来-->
Memory content to be deleted, used for UI preview/detail. Recommended to copy from <用户长期记忆> line for the given ID.""",
    )


@tool()
class DeleteMemory(BaseTool[DeleteMemoryParams]):
    """<!--zh: 删除长期记忆-->
    Delete long-term memory"""

    def __init__(self, **data):
        super().__init__(**data)

    async def execute(self, tool_context: ToolContext, params: DeleteMemoryParams) -> ToolResult:
        """
        执行记忆删除操作

        Args:
            tool_context: 工具执行上下文
            params: 删除记忆参数

        Returns:
            包含删除结果的 ToolResult
        """
        try:
            ctx_or_error = get_magic_service_tool_context(tool_context, logger=logger)
            if isinstance(ctx_or_error, ToolResult):
                return ctx_or_error
            ctx = ctx_or_error

            # 删除工具的“回显内容”与 create/update 一致：来自工具入参（由大模型从 <用户长期记忆> 拷贝）
            deleted_memory_content: str = (params.memory or "").strip()

            # 记录删除记忆的操作
            logger.info(f"开始删除记忆 - ID: {params.memory_id}")

            # 删除记忆
            async with MagicServiceClient(ctx.config) as client:
                result = await client.delete_memory(memory_id=params.memory_id, metadata=ctx.metadata)

                # 如果执行到这里，说明API调用成功（code=1000）
                message = result.get("message", "删除记忆成功")

                logger.info(f"删除记忆成功 - ID: {params.memory_id}")

                preview = deleted_memory_content[:100] if deleted_memory_content else ""
                success_msg = json.dumps(
                    {
                        "memory_id": params.memory_id,
                        "content": f"{preview}{'...' if deleted_memory_content and len(deleted_memory_content) > 100 else ''}",
                        "success": True,
                    },
                    ensure_ascii=False,
                )

                return ToolResult(
                    content=success_msg,
                    extra_info={
                        "memory_id": params.memory_id,
                        "content": deleted_memory_content,
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
            logger.error(f"删除记忆API调用失败: {e}", exc_info=True)
            return ToolResult.error(error_msg)
        except Exception as e:
            error_msg = f"删除记忆时发生未知错误，请稍后重试"
            logger.error(f"删除记忆时发生未知错误: {e}", exc_info=True)
            return ToolResult.error(error_msg)

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        """生成工具详情"""
        if result.ok and result.extra_info:
            memory_id = result.extra_info.get("memory_id")
            memory_content = result.extra_info.get("content") or ""
            if memory_id:
                return ToolDetail(
                    type=DisplayType.TEXT,
                    data={
                        "memory_id": memory_id,
                        "memory_content": memory_content,
                        "status": "deleted",
                        "render_type": "delete_memory_card",
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
        deleted_text = (result.extra_info.get("content") if result.extra_info else "") or ""
        action = i18n.translate(self.name, category="tool.actions")
        if result.ok:
            preview = deleted_text.strip()
            if len(preview) > 50:
                preview = f"{preview[:50]}..."
            return {
                "action": action,
                "remark": i18n.translate("delete_memory.success", category="tool.messages", preview=preview),
            }
        return {
            "action": action,
            "remark": i18n.translate("delete_memory.error", category="tool.messages"),
        }
