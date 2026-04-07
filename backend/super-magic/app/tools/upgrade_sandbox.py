from typing import Dict, Any, Optional

from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from agentlang.context.tool_context import ToolContext
from app.tools.core import BaseTool, BaseToolParams, tool
from app.i18n import i18n
from app.core.context.agent_context import AgentContext
from app.infrastructure.magic_service.client import MagicServiceClient
from app.infrastructure.magic_service.exceptions import ApiError, ConnectionError
from app.tools.core.magic_service_tool_context import get_magic_service_tool_context

logger = get_logger(__name__)


class UpgradeSandboxParams(BaseToolParams):
    # sandbox_id is auto-fetched from agent context, no AI input needed
    pass


@tool()
class UpgradeSandbox(BaseTool[UpgradeSandboxParams]):
    """<!--zh
    沙箱自我升级工具

    将当前龙虾沙箱升级到最新 Agent 镜像版本。升级会重启沙箱，操作不可逆。
    -->
    Sandbox self-upgrade tool

    Upgrades the current sandbox to the latest Agent image version.
    The upgrade will restart the sandbox and is irreversible.
    """

    async def execute(self, tool_context: ToolContext, params: UpgradeSandboxParams) -> ToolResult:
        try:
            ctx_or_error = get_magic_service_tool_context(tool_context, logger=logger)
            if isinstance(ctx_or_error, ToolResult):
                return ctx_or_error
            ctx = ctx_or_error

            agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
            if not agent_context:
                return ToolResult.error("Cannot get agent context to retrieve sandbox_id")

            sandbox_id = agent_context.get_sandbox_id()
            if not sandbox_id:
                return ToolResult.error("sandbox_id is not available in current context")

            logger.info(f"Requesting sandbox upgrade, sandbox_id: {sandbox_id}")

            async with MagicServiceClient(ctx.config) as client:
                result = await client.upgrade_sandbox(sandbox_id)

            logger.info(f"Sandbox upgrade triggered successfully, sandbox_id: {sandbox_id}")
            return ToolResult(
                content="Sandbox upgrade initiated successfully. The sandbox will restart with the latest image.",
                extra_info={"sandbox_id": sandbox_id, "result": result},
            )

        except ConnectionError as e:
            logger.error(f"Connection error during sandbox upgrade: {e}", exc_info=True)
            return ToolResult.error("Failed to connect to Magic Service, please check network connectivity")
        except ApiError as e:
            logger.error(f"Sandbox upgrade API error: {e}", exc_info=True)
            return ToolResult.error(f"Sandbox upgrade failed: {e}")
        except Exception as e:
            logger.error(f"Unexpected error during sandbox upgrade: {e}", exc_info=True)
            return ToolResult.error("Unexpected error during sandbox upgrade, please try again later")

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        action = i18n.translate(self.name, category="tool.actions")
        if result.ok:
            return {
                "action": action,
                "remark": i18n.translate("upgrade_sandbox.success", category="tool.messages"),
            }
        return {
            "action": action,
            "remark": i18n.translate("upgrade_sandbox.error", category="tool.messages"),
        }
