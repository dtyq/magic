"""
创建长期记忆工具

通过调用 Magic Service API 创建新的长期记忆。
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


class CreateMemoryParams(BaseToolParams):
    explanation: str = Field(
        ...,
        description="""<!--zh: 解释为什么这条记忆值得记录（避免引用对话原文）-->
Explain why this memory is worth recording (avoid quoting conversation)""",
    )
    memory: str = Field(
        ...,
        description="""<!--zh: 从对话中提炼的简短偏好或方法（不超过三句话）-->
Concise preference or method extracted from conversation (no more than three sentences)""",
    )
    tags: List[str] = Field(
        ...,
        description="""<!--zh: 相关标签数组，如 ['个人信息', '昵称']-->
Related tag array, e.g., ['personal info', 'nickname']""",
    )
    requires_confirmation: bool = Field(
        default=True,
        description="""<!--zh: 是否需要用户确认。true（默认）：AI推理的记忆需确认；false：用户主动提供的身份信息、项目约束等直接生效-->
Whether user confirmation required. true (default): AI-inferred memories need confirmation; false: User-provided identity info, project constraints etc. take effect directly""",
    )
    memory_type: str = Field(
        default="user",
        description="""<!--zh: 记忆类型。user（默认）：跨项目通用（如姓名、个人习惯、工具偏好）；project：仅当前项目（如任务目标、预算约束、特定资源位置）-->
Memory type. user (default): cross-project general (e.g., name, personal habits, tool preferences); project: current project only (e.g., task goals, budget constraints, specific resource locations)""",
    )


@tool()
class CreateMemory(BaseTool[CreateMemoryParams]):
    """<!--zh
    创建长期记忆

    保存后续对话中可复用的重要信息。记忆分为用户记忆（跨项目通用）和项目记忆（当前任务专属）。
    -->
    Create long-term memory

    Save important information that can be reused in subsequent conversations. Memory is divided into user memory (cross-project general) and project memory (current task specific).
    """

    def __init__(self, **data):
        super().__init__(**data)

    async def execute(self, tool_context: ToolContext, params: CreateMemoryParams) -> ToolResult:
        """
        执行记忆创建操作

        Args:
            tool_context: 工具执行上下文
            params: 创建记忆参数

        Returns:
            包含创建结果的 ToolResult
        """
        try:
            ctx_or_error = get_magic_service_tool_context(tool_context, logger=logger)
            if isinstance(ctx_or_error, ToolResult):
                return ctx_or_error
            ctx = ctx_or_error

            # 记录创建记忆的操作
            logger.info(
                f"开始创建记忆 - 内容长度: {len(params.memory)}, 标签: {params.tags}, 需要确认: {params.requires_confirmation}, 记忆类型: {params.memory_type}"
            )

            # 创建记忆
            async with MagicServiceClient(ctx.config) as client:
                result = await client.create_memory(
                    memory=params.memory,
                    tags=params.tags,
                    explanation=params.explanation,
                    requires_confirmation=params.requires_confirmation,
                    memory_type=params.memory_type,
                    metadata=ctx.metadata,
                )

                memory_id = result.get("memory_id")
                message = result.get("message", "创建记忆成功")

                logger.info(f"创建记忆成功 - ID: {memory_id}")

                success_msg = json.dumps(
                    {
                        "content": f"{params.memory[:100]}{'...' if len(params.memory) > 100 else ''}",
                        "memory_id": memory_id,
                        "success": True,
                    },
                    ensure_ascii=False,
                )

                return ToolResult(
                    content=success_msg,
                    extra_info={"memory_id": memory_id, "content": params.memory, "message": message},
                )

        except ConnectionError as e:
            error_msg = f"连接记忆服务失败，请检查网络连接后重试"
            logger.error(f"连接 Magic Service 失败: {e}", exc_info=True)
            return ToolResult.error(error_msg)
        except ApiError as e:
            error_msg = f"记忆服务返回错误，请稍后重试"
            logger.error(f"创建记忆API调用失败: {e}", exc_info=True)
            return ToolResult.error(error_msg)
        except Exception as e:
            error_msg = f"创建记忆时发生未知错误，请稍后重试"
            logger.error(f"创建记忆时发生未知错误: {e}", exc_info=True)
            return ToolResult.error(error_msg)

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        """生成工具详情"""
        if result.ok and result.extra_info:
            memory_id = result.extra_info.get("memory_id")
            memory_content = result.extra_info.get("content")

            if memory_id and memory_content:
                # 从参数中获取状态和类型信息
                requires_confirmation = arguments.get("requires_confirmation", True) if arguments else True
                memory_type = arguments.get("memory_type", "user") if arguments else "user"

                # 根据 requires_confirmation 设置 status
                status = "waiting" if requires_confirmation else "accepted"

                # 根据 memory_type 设置 type
                type_value = "all" if memory_type == "user" else "project"

                return ToolDetail(
                    type=DisplayType.TEXT,
                    data={
                        "memory_id": memory_id,
                        "memory_content": memory_content,
                        "status": status,
                        "type": type_value,
                        "render_type": "create_memory_card",
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
                "remark": i18n.translate("create_memory.success", category="tool.messages", preview=preview),
            }
        return {
            "action": action,
            "remark": i18n.translate("create_memory.error", category="tool.messages"),
        }
