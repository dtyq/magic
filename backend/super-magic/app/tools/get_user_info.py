from typing import Literal

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.context.agent_context import AgentContext
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.service.user_context_service import UserContextQueryError, UserContextService
from app.tools.core import BaseTool, BaseToolParams, tool

logger = get_logger(__name__)


class GetUserInfoParams(BaseToolParams):
    include_sensitive_fields: list[Literal["phone"]] = Field(
        default_factory=list,
        description="""<!--zh
需要返回原始值的敏感字段列表，目前支持 "phone"。
默认情况下手机号会脱敏；使用此参数可获取完整原始值。
调用前必须已通过向用户明确询问并获得其同意，未经授权不得传入此参数。
-->
List of sensitive field names to return as plain text. Supported value: "phone".
Phone is masked by default. Pass ["phone"] only after the user explicitly consents in this conversation.
Never pass this parameter without prior user approval."""
    )


@tool()
class GetUserInfo(BaseTool[GetUserInfoParams]):
    """<!--zh
    查询当前已认证服务用户的基础资料、组织、套餐和可见积分。
    每次调用都会重新查询服务；已有上下文足够时直接使用，需要最新资料时调用。
    账户数据可能部分不可用，读取各项状态，不把未接入或失败当成免费套餐或零余额。
    -->
    Query the authenticated service user's current profile, organization, subscription, and visible points.
    Each call queries the service again. Use existing context when sufficient; call when fresh data is needed.
    Account sections may be unavailable: read their status, and do not infer a free plan or zero balance.
    """

    async def execute(self, tool_context: ToolContext, params: GetUserInfoParams) -> ToolResult:
        context = tool_context.get_extension("agent_context")
        if not isinstance(context, AgentContext):
            return ToolResult.error("The authenticated user context is unavailable.")
        try:
            result = await UserContextService.fetch(context, tuple(params.include_sensitive_fields))
        except UserContextQueryError as error:
            return ToolResult.error(str(error))

        if "phone" not in params.include_sensitive_fields:
            result = UserContextService.for_model(result)
        try:
            await UserContextService.remember_result(context, result)
        except Exception as error:
            logger.warning(f"User profile snapshot could not be saved: {type(error).__name__}")
        auth = context.get_user_context_auth()
        if auth is None or result.user.id != auth.user_id or result.organization.code != auth.organization_code:
            return ToolResult.error("The session identity changed during the query. Query again.")

        data = result.user.model_dump(mode="json")
        data.update({
            "organization": result.organization.model_dump(mode="json"),
            "captured_at": result.captured_at.isoformat(),
            "subscription": result.subscription.model_dump(mode="json", exclude_none=True),
            "points": result.points.model_dump(mode="json", exclude_none=True),
        })
        return ToolResult(content=UserContextService.format_content(result), data=data)

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: dict[str, object] | None = None,
    ) -> ToolDetail | None:
        if result.ok:
            return None
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(
                file_name="user-info.md",
                content=i18n.translate("get_user_info.detail_error", category="tool.messages"),
            ),
        )

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        return {
            "action": i18n.translate("get_user_info", category="tool.actions"),
            "remark": i18n.translate(
                "get_user_info.success" if result.ok else "get_user_info.error", category="tool.messages",
            ),
        }
