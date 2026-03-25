from dataclasses import asdict
from typing import Any, Dict, List

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool
from app.tools.subagent_runtime_models import SubagentQueryResult, SubagentQueryStatus, SubagentStatus, utc_now
from app.tools.subagent_runtime_store import SubagentRuntimeStore
from app.tools.subagent_session_manager import subagent_session_manager


class GetSubAgentResultsParams(BaseToolParams):
    agent_ids: List[str] = Field(
        ...,
        description="One or more agent_ids returned by call_subagent(background=True). Pass multiple to batch-query all at once."
    )


@tool()
class GetSubAgentResults(BaseTool[GetSubAgentResultsParams]):
    """Query status and results of one or more background sub-agents dispatched via call_subagent(background=True).
    Only call this when you actually need the results — avoid polling in a tight loop."""

    async def execute(self, tool_context: ToolContext, params: GetSubAgentResultsParams) -> ToolResult:
        results: list[SubagentQueryResult] = []
        for agent_id in params.agent_ids:
            states = await SubagentRuntimeStore.find_states_by_agent_id(agent_id)
            if not states:
                results.append(SubagentQueryResult(
                    agent_id=agent_id,
                    status=SubagentQueryStatus.NOT_FOUND,
                    error=f"No sub-agent session found with id: {agent_id}",
                ))
                continue
            if len(states) > 1:
                results.append(SubagentQueryResult(
                    agent_id=agent_id,
                    status=SubagentQueryStatus.AMBIGUOUS,
                    error=f"Multiple sub-agent sessions found with id: {agent_id}. agent_id must be unique across agent_name.",
                ))
                continue

            state = states[0]

            agent_name = state.agent_name
            handle = await subagent_session_manager.get_handle(agent_name, agent_id)

            async with handle.state_lock:
                state = await SubagentRuntimeStore.load_state(agent_name, agent_id)
                if state.status == SubagentStatus.RUNNING and not handle.is_running():
                    state.status = SubagentStatus.INTERRUPTED
                    state.last_error = state.last_error or "process_restarted_or_task_missing"
                    state.finished_at = state.finished_at or utc_now()
                    await SubagentRuntimeStore.save_state(state)

            results.append(SubagentQueryResult(
                agent_id=agent_id,
                agent_name=state.agent_name,
                status=state.status,
                result=state.last_result,
                error=state.last_error,
            ))
        return ToolResult(
            content=_build_results_text(results),
            data={"results": [asdict(result) for result in results]},
        )

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        action = i18n.translate("get_sub_agent_results", category="tool.actions")
        if not result.ok:
            return {
                "action": action,
                "remark": i18n.translate("get_sub_agent_results.error", category="tool.messages", error=result.content),
            }
        try:
            results = result.data.get("results", [])
            if len(results) == 1 and results[0].get("agent_name"):
                item = results[0]
                agent_name = item["agent_name"]
                action = i18n.translate("call_subagent.assign", category="tool.messages", agent_name=agent_name)
                status = item.get("status", "")
                if status in {SubagentStatus.PENDING, SubagentStatus.RUNNING}:
                    summary = i18n.translate("call_subagent.running", category="tool.messages", agent_name=agent_name)
                elif status == SubagentStatus.DONE:
                    summary = i18n.translate("call_subagent.done", category="tool.messages", agent_name=agent_name)
                elif status == SubagentStatus.ERROR:
                    summary = i18n.translate(
                        "call_subagent.failed",
                        category="tool.messages",
                        agent_name=agent_name,
                        error=item.get("error", i18n.translate("unknown.message", category="tool.messages")),
                    )
                elif status == SubagentStatus.INTERRUPTED:
                    summary = i18n.translate("call_subagent.interrupted", category="tool.messages", agent_name=agent_name)
                else:
                    summary = f"{agent_name}: {status}"
            else:
                summary = ", ".join(f"{item['agent_id']}: {item['status']}" for item in results)
            return {"action": action, "remark": summary}
        except Exception:
            return {"action": action, "remark": ""}


def _build_results_text(results: list[SubagentQueryResult]) -> str:
    if not results:
        return "No sub-agent results found."

    lines: list[str] = []
    for result in results:
        label = f"`{result.agent_id}`"
        if result.agent_name:
            label = f"`{result.agent_name}` / {label}"

        line = f"{label}: `{result.status}`"
        if result.error:
            line += f", error={result.error}"
        lines.append(line)

        if result.result:
            lines.append(f"Result for `{result.agent_id}`:\n{result.result}")

    return "\n".join(lines)
