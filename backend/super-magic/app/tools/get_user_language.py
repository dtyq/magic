"""Tool for reading the current Agent task language."""

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n
from app.tools.core import AutoMount, BaseTool, BaseToolParams, tool


class GetUserLanguageParams(BaseToolParams):
    pass


@tool(auto_mount=AutoMount.SKILLS)
class GetUserLanguage(BaseTool[GetUserLanguageParams]):
    """<!--zh: 获取当前 Agent 任务使用的语言代码。-->
    Get the language code used by the current Agent task.
    """

    async def execute(
        self,
        tool_context: ToolContext,
        params: GetUserLanguageParams,
    ) -> ToolResult:
        language = i18n.get_language()
        return ToolResult(
            content=f"The current Agent task language is {language}.",
            data={"language": language},
        )
