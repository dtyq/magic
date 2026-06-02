"""知识检索工具。"""

from typing import Any

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.context.agent_context import AgentContext
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
from app.infrastructure.sdk.magic_service.parameter.search_knowledge_parameter import (
    SearchKnowledgeParameter,
)
from app.i18n import i18n
from app.tools.core import BaseTool, BaseToolParams, tool

logger = get_logger(__name__)

MAX_DETAIL_SNIPPET_LENGTH = 500


class SearchKnowledgeParams(BaseToolParams):
    query: str = Field(
        ...,
        description=(
            "<!--zh: 用于执行知识检索的查询语句。优先使用用户原话，必要时再补充少量同义词或限定词。 -->"
            "Query used for knowledge search. Prefer the user's original wording and only add a small "
            "number of synonyms or constraints when needed."
        ),
    )


@tool(name="search_knowledge")
class SearchKnowledge(BaseTool[SearchKnowledgeParams]):
    """<!--zh
    在知识库中检索可能与当前问题相关的知识与上下文，返回可供回答使用的相关片段。
    当你不确定、缺少事实依据，或用户质疑上一轮回答时，应优先尝试使用它。
    -->
    Search the knowledge base for knowledge and related context that may help answer the current
    question, and return snippets that can ground the answer. Use it when you are unsure, lack
    evidence, or the user challenges a previous answer. Try this search before answering from
    guesswork alone.
    """

    name = "search_knowledge"

    def get_prompt_hint(self) -> str:
        return """<!--zh
当你对答案没有把握、缺少事实依据，或用户质疑你上一轮回答时，优先尝试调用 search_knowledge 做一次知识检索，也许会找到关联的上下文。

优先使用场景：
- 已知 bug、缺陷、异常、FAQ、会议纪要、经验总结
- 某功能怎么优化、之前怎么处理、有没有相关记录、某流程/规范/制度是什么
- 用户说“不是这个意思”“不对”“没回答到点上”“再查一下”“你这个结论不对吧”等，需要补充证据时

执行规则：
- 对这类问题，不要在未检索前直接说“我不知道”“我无法确认”“我无法监控”
- 优先保留用户原话作为 query，仅在必要时补充少量同义词或限定词
- 有结果就基于结果回答；结果不足时说明哪些部分仍不确定；无结果时统一说“没有检索到相关知识上下文”

正例：
- “门店的负责人是谁”
- “报销流程是什么”
- “之前有人处理过导出失败吗”
- “你刚才说得不对，再查一下”

反例：
- “今天北京天气”
- “写一个 Go 并发示例”
- 纯主观闲聊或纯创作任务
-->
Use `search_knowledge` when you are unsure, lack evidence, or the user challenges your previous
answer. Try a knowledge search before answering from guesswork alone, because related context may exist
even when the answer is not obvious yet.

Typical cases include known bugs, defects, FAQs, meeting notes, prior handling, process or policy
questions, "is there any related record", and "how should this feature be optimized". For questions
like "知识库现在有哪些 bug", first try a knowledge search for related records instead of immediately
treating it as a real-time monitoring request.

If the user says "不是这个意思", "不对", "没回答到点上", "再查一下", "你这个结论不对吧", or otherwise
shows dissatisfaction, run this search unless you already have strong retrieved evidence.

Do not say "I don't know", "I can't confirm", or "I can't monitor that" before trying this search when
related knowledge context may help. Prefer the user's original wording for `query`; only add a few
light synonyms or constraints when needed, such as bug/缺陷/异常/已知问题, 优化/方案/改进, or
流程/规范/制度/指引.

If results exist, answer from them. If results are partial, say what you found and what remains
uncertain. If no result exists, say: "No relevant knowledge context was found." Do not overclaim that
the system has no issue.

Positive examples:
- “门店的负责人是谁”
- “报销流程是什么”
- “之前有人处理过导出失败吗”
- “你刚才说得不对，再查一下”

Negative examples:
- "今天北京天气"
- "写一个 Go 并发示例"
- pure casual chat or pure creative generation
"""

    def is_visible_in_ui(self) -> bool:
        return False

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: dict[str, Any] | None = None,
    ) -> ToolDetail:
        query = (arguments or {}).get("query", "")
        if not result.ok:
            content = "\n".join(
                [
                    f"# {i18n.translate('search_knowledge.detail_error_title', category='tool.messages')}",
                    "",
                    i18n.translate("search_knowledge.detail_error_summary", category="tool.messages"),
                ]
            )
            return ToolDetail(
                type=DisplayType.MD,
                data=FileContent(file_name="knowledge_search_error.md", content=content),
            )

        extra_info = result.extra_info or {}
        documents = extra_info.get("documents") or []
        hit_count = extra_info.get("hit_count", 0)
        content = self._build_detail_markdown(query=query, hit_count=hit_count, documents=documents)
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="knowledge_search_results.md", content=content),
        )

    def _build_detail_markdown(
        self,
        *,
        query: str,
        hit_count: int,
        documents: list[dict[str, Any]],
    ) -> str:
        lines = [
            f"# {i18n.translate('search_knowledge.detail_title', category='tool.messages')}",
            "",
            f"- {i18n.translate('search_knowledge.detail_query', category='tool.messages')}: `{query}`",
            f"- {i18n.translate('search_knowledge.detail_hit_count', category='tool.messages')}: {hit_count}",
            "",
        ]

        if not documents or hit_count <= 0:
            lines.append(i18n.translate("search_knowledge.detail_no_results", category="tool.messages"))
            return "\n".join(lines)

        lines.append(f"## {i18n.translate('search_knowledge.detail_related_documents', category='tool.messages')}")
        lines.append("")
        for document in documents:
            snippets = document.get("snippets") or []
            if not snippets:
                continue
            document_name = document.get("document_name") or i18n.translate(
                "search_knowledge.detail_unknown_document",
                category="tool.messages",
            )
            lines.append(f"### {document_name}")
            lines.append("")
            for index, snippet in enumerate(snippets, start=1):
                snippet_text = self._truncate_snippet(str(snippet.get("text") or ""))
                lines.append(
                    f"**{i18n.translate('search_knowledge.detail_snippet', category='tool.messages', index=index)}**"
                )
                lines.append(snippet_text)
                lines.append("")

        return "\n".join(lines).rstrip()

    def _truncate_snippet(self, text: str) -> str:
        normalized = " ".join(text.split())
        if len(normalized) <= MAX_DETAIL_SNIPPET_LENGTH:
            return normalized
        return normalized[:MAX_DETAIL_SNIPPET_LENGTH].rstrip() + "..."

    async def get_before_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        arguments: dict | None = None,
    ) -> dict:
        query = (arguments or {}).get("query", "")
        return {
            "tool_name": tool_name,
            "action": i18n.translate("search_knowledge", category="tool.actions"),
            "remark": i18n.translate("search_knowledge.searching", category="tool.messages", query=query),
        }

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: dict | None = None,
    ) -> dict:
        result.use_custom_remark = True
        query = (arguments or {}).get("query", "")
        if not result.ok:
            return {
                "tool_name": tool_name,
                "action": i18n.translate("search_knowledge", category="tool.actions"),
                "remark": i18n.translate("search_knowledge.error", category="tool.messages", query=query),
            }
        return {
            "tool_name": tool_name,
            "action": i18n.translate("search_knowledge", category="tool.actions"),
            "remark": i18n.translate("search_knowledge.completed", category="tool.messages", query=query),
        }

    async def execute(self, tool_context: ToolContext, params: SearchKnowledgeParams) -> ToolResult:
        agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
        agent_code = (agent_context.get_agent_code() or "").strip()
        if agent_code == "":
            return ToolResult.error("Knowledge search is not supported in the current mode.")

        query = params.query.strip()
        if query == "":
            return ToolResult.error("The query cannot be empty.")

        try:
            magic_service = get_magic_service_sdk()
            result = await magic_service.agent.search_knowledge_async(
                SearchKnowledgeParameter(agent_code=agent_code, query=query)
            )
            return ToolResult(content=result.to_string(), extra_info=result.to_dict())
        except Exception as exc:
            logger.error(f"Knowledge search failed: {exc}")
            return ToolResult.error(f"Knowledge search failed: {exc}")
