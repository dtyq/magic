"""ask_user 工具：向用户提问并暂停当前 Agent 轮次。"""

import time
import uuid
from typing import Optional

from app.service.ask_user_service import INTERNAL_TIMEOUT

from pydantic import Field

from app.core.context.agent_context import AgentContext
from app.core.entity.message.server_message import (
    AskUserQuestionContent,
    AskUserResultContent,
    DisplayType,
    ToolDetail,
)
from app.tools.core.base_tool import BaseTool
from app.tools.core.base_tool_params import BaseToolParams
from app.tools.core.tool_decorator import tool
from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult

logger = get_logger(__name__)


class AskUserParams(BaseToolParams):
    questions: str = Field(
        description="""<!--zh: 用 XML 格式描述要问用户的问题。支持 type: confirm / input / select / multi_select。每个问题用 <question> 标签包裹。-->
Questions in XML format. Wrap each question in a <question> tag with a `type` attribute (confirm / input / select / multi_select). For select/multi_select, add <option> children. Optional attributes: default, placeholder, min, max.""",
    )


@tool()
class AskUserTool(BaseTool[AskUserParams]):
    """<!--zh
    向用户提问，发出问题后立即结束当前 Agent 轮次，等待用户答复后重启。
    当运行在子代理（depth > 0）中时，不要调用此工具——子代理无法与用户交互。

    调用时机：
    - 缺少无法推断的关键信息（如目标路径、账号凭据、审批确认）
    - 需要用户在多个方案间做重大方向选择
    - 不可逆操作（删除、覆盖、发送、付款）需要用户确认

    不应调用：
    - 可用合理默认值的偏好问题
    - 用户已在上文提供过的信息
    - 子代理（depth > 0）运行时
    -->
    Ask the user one or more questions and wait for a reply before continuing.
    Do NOT call this tool when running as a subagent — subagents cannot interact with the user. In that case, complete the task with your best judgment or surface the missing information in your result.

    Call this tool when:
    - Missing must-know information that cannot be reasonably inferred (e.g. target path, credentials, approval)
    - A major directional decision requires explicit user input among multiple approaches
    - An irreversible action (delete, overwrite, send, pay) must be confirmed before proceeding

    Do NOT call this tool when:
    - A reasonable default exists and the choice is a trivial preference
    - The user already provided the information earlier in the conversation
    - You are running as a subagent

    Write questions as XML in the `questions` parameter:

    ```
    <question type="confirm">Are you sure you want to delete /tmp/*?</question>

    <question type="select">
    Which framework?
    <option>React</option>
    <option>Vue</option>
    </question>

    <question type="input" placeholder="e.g. my-project">Project name?</question>

    <question type="multi_select" min="1" max="3">
    Features to include:
    <option>Auth</option>
    <option>Database</option>
    <option>API</option>
    </question>
    ```

    Allowed types: confirm, input, select, multi_select.
    For select/multi_select, the system automatically appends an "Other" free-input option.
    Use the `default` attribute to provide a fallback when the user times out or skips.
    """

    async def set_extra_arguments(self, tool_context: ToolContext) -> None:
        """Pre-generate question_id, expiry and parse XML before BEFORE_TOOL_CALL fires."""
        from app.tools.ask_user_parser import parse_questions_xml

        raw_xml = tool_context.arguments.get("questions", "")
        parsed = parse_questions_xml(raw_xml)
        tool_context.arguments["parsed_questions"] = parsed
        tool_context.arguments["question_id"] = tool_context.tool_call_id
        tool_context.arguments["expires_at"] = int(time.time()) + INTERNAL_TIMEOUT
        tool_context.arguments["status"] = "pending"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict = None) -> Optional[ToolDetail]:
        """Build the AFTER_TOOL_CALL detail card from result.extra_info."""
        if not result or not result.extra_info:
            return None
        status = result.extra_info.get("status")
        answers = result.extra_info.get("answers", {})
        questions = result.extra_info.get("questions", [])
        if not status:
            return None
        question_id = tool_context.tool_call_id if tool_context else result.extra_info.get("question_id", "")
        return ToolDetail(
            type=DisplayType.ASK_USER,
            data=AskUserResultContent(
                question_id=question_id,
                status=status,
                questions=questions,
                answers=answers,
            ),
        )

    async def get_before_tool_detail(self, tool_context: ToolContext, arguments: dict = None) -> ToolDetail:
        """Build the BEFORE_TOOL_CALL detail card for ask_user."""
        parsed = (arguments or {}).get("parsed_questions", [])
        return ToolDetail(
            type=DisplayType.ASK_USER,
            data=AskUserQuestionContent(
                question_id=tool_context.tool_call_id,
                questions=parsed,
                expires_at=tool_context.arguments.get("expires_at", 0),
                status="pending",
            ),
        )

    async def execute(self, tool_context: ToolContext, params: AskUserParams) -> ToolResult:
        agent_context: AgentContext = tool_context.get_extension_typed("agent_context", AgentContext)

        question_id: str = tool_context.arguments.get("question_id") or str(uuid.uuid4())
        expires_at: int = tool_context.arguments.get("expires_at") or (int(time.time()) + INTERNAL_TIMEOUT)
        tool_call_id: str = tool_context.tool_call_id
        parsed_questions: list = tool_context.arguments.get("parsed_questions", [])

        # 获取 agent_name / agent_id
        chat_history = getattr(agent_context, "chat_history", None)
        agent_name = chat_history.agent_name if chat_history else getattr(agent_context, "agent_name", "magic")
        agent_id = chat_history.agent_id if chat_history else "main"

        # 通过 AskUserService 单例注册 pending
        from app.service.ask_user_service import AskUserService
        service = AskUserService.get_instance()

        await service.create_and_register_pending(
            question_id=question_id,
            tool_call_id=tool_call_id,
            agent_context=agent_context,
            expires_at=expires_at,
            agent_name=agent_name,
            agent_id=agent_id,
            raw_params=tool_context.arguments,
            parsed_questions=parsed_questions,
        )

        n = len(parsed_questions)
        return ToolResult(
            content=f"[ASK_USER:{question_id}] {n} question(s) sent to user, waiting for response.",
            system="ASK_USER",
        )
