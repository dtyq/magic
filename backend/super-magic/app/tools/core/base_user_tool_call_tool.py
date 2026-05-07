"""前端工具调用基类：封装"注册 pending → 等待前端 → 恢复 Agent"的通用生命周期。

继承此基类的工具会将实际执行交给前端完成，后端等待前端回传结果后再恢复 Agent 推理。

子类必须实现：
  build_tool_data       - 提取需要持久化的结构化数据（崩溃恢复用）
  build_result_builder  - 返回将用户回答转为模型上下文的闭包
  build_timeout_answer_builder - 返回构造超时默认答案的闭包
  build_pending_content - 返回等待期间写入 ToolResult 的提示文本

子类可选覆盖：
  _prepare              - 在 BEFORE_TOOL_CALL 前预处理输入，结果存入 tool_context.arguments
  user_tool_call_timeout - 等待超时秒数（默认 600）
"""

import time
from abc import abstractmethod
from typing import Any, Callable, ClassVar, Coroutine, Dict, Generic, Optional, Tuple, TypeVar

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult

from app.tools.core.base_tool import BaseTool
from app.tools.core.base_tool_params import BaseToolParams

T = TypeVar("T", bound=BaseToolParams)

# agent 主循环检测此标记后退出，等待前端回传结果
USER_TOOL_CALL_SYSTEM_MARKER = "USER_TOOL_CALL"

ResultBuilder = Callable[[str, str], Tuple[str, Dict[str, Any]]]
TimeoutAnswerBuilder = Callable[[], str]


class BaseUserToolCallTool(BaseTool[T]):
    """需要等待前端执行的工具基类。

    子类通过实现 build_* 系列方法注入工具专属逻辑；
    通用的 pending 注册、超时、恢复流程由基类统一处理。

    每个具体子类定义时会自动向 UserToolCallService 注册崩溃恢复工厂，
    子类无需手动调用任何注册方法。
    """

    # 等待超时时间（秒），子类可覆盖
    user_tool_call_timeout: ClassVar[int] = 600

    def __init_subclass__(cls, **kwargs) -> None:
        super().__init_subclass__(**kwargs)  # BaseTool.__init_subclass__ 在此设置 cls.name

        import inspect
        if inspect.isabstract(cls):
            return

        # 捕获 cls 供工厂闭包使用，避免晚绑定问题
        tool_cls = cls
        tool_name = cls.name

        def _restore_factory(tool_data: dict) -> tuple:
            instance = tool_cls()
            return (
                instance.build_result_builder(tool_data),
                instance.build_timeout_answer_builder(tool_data),
            )

        try:
            from app.service.user_tool_call_service import UserToolCallService
            UserToolCallService.register_restore_factory(tool_name, _restore_factory)
        except Exception as e:
            # 仅在模块加载阶段循环依赖等极端情况下可能失败，不影响正常运行
            import logging
            logging.getLogger(__name__).warning(
                f"Failed to auto-register restore factory for {tool_name}: {e}"
            )

    def allow_code_mode(self) -> bool:
        return False

    async def set_extra_arguments(self, tool_context: ToolContext) -> None:
        """设置 expires_at 并调用子类预处理 hook。"""
        tool_context.arguments["expires_at"] = int(time.time()) + self.user_tool_call_timeout
        await self._prepare(tool_context)

    async def _prepare(self, tool_context: ToolContext) -> None:
        """Hook：在 BEFORE_TOOL_CALL 前预处理输入，将结果存入 tool_context.arguments。

        子类按需覆盖；默认空实现。
        """

    @abstractmethod
    def build_tool_data(self, tool_context: ToolContext) -> dict:
        """提取需要持久化的结构化数据，用于崩溃恢复时重建回调。

        从 tool_context.arguments 中读取 _prepare 存入的数据并整理成字典返回。
        """

    @abstractmethod
    def build_result_builder(self, tool_data: dict) -> ResultBuilder:
        """返回结果构建闭包：(response_status, answer_json) -> (content, extra_info)。

        content 会写入对话历史供模型推理；extra_info 会通过 AFTER_TOOL_CALL 事件推给前端。
        """

    @abstractmethod
    def build_timeout_answer_builder(self, tool_data: dict) -> TimeoutAnswerBuilder:
        """返回超时答案构建闭包：() -> answer_json。

        超时时调用，用于构造携带默认值的答案 JSON，随后交给 result_builder 处理。
        """

    @abstractmethod
    def build_pending_content(self, tool_call_id: str, tool_data: dict) -> str:
        """返回等待期间写入 ToolResult.content 的提示文本（进入模型上下文）。"""

    async def execute(self, tool_context: ToolContext, params: T) -> ToolResult:
        """注册 pending 并立即返回，由 UserToolCallService 在收到前端回传后恢复 Agent。"""
        from app.core.context.agent_context import AgentContext
        from app.service.user_tool_call_service import UserToolCallService

        agent_context: AgentContext = tool_context.get_extension_typed("agent_context", AgentContext)
        tool_call_id: str = tool_context.tool_call_id
        expires_at: int = (
            tool_context.arguments.get("expires_at")
            or (int(time.time()) + self.user_tool_call_timeout)
        )
        tool_data: dict = self.build_tool_data(tool_context)

        chat_history = getattr(agent_context, "chat_history", None)
        agent_name = chat_history.agent_name if chat_history else getattr(agent_context, "agent_name", "magic")
        agent_id = chat_history.agent_id if chat_history else "main"

        await UserToolCallService.get_instance().create_and_register_pending(
            tool_call_id=tool_call_id,
            tool_name=self.name,
            agent_context=agent_context,
            expires_at=expires_at,
            agent_name=agent_name,
            agent_id=agent_id,
            raw_params=tool_context.arguments,
            tool_data=tool_data,
            result_builder=self.build_result_builder(tool_data),
            timeout_answer_builder=self.build_timeout_answer_builder(tool_data),
        )

        return ToolResult(
            content=self.build_pending_content(tool_call_id, tool_data),
            system=USER_TOOL_CALL_SYSTEM_MARKER,
        )
