import json
from typing import Any, Dict, List

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool
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
        results = []
        for agent_id in params.agent_ids:
            states = await SubagentRuntimeStore.find_states_by_agent_id(agent_id)
            if not states:
                results.append({
                    "agent_id": agent_id,
                    "status": "not_found",
                    "result": None,
                    "error": f"No sub-agent session found with id: {agent_id}",
                })
                continue
            if len(states) > 1:
                results.append({
                    "agent_id": agent_id,
                    "status": "ambiguous",
                    "result": None,
                    "error": f"Multiple sub-agent sessions found with id: {agent_id}. agent_id must be unique across agent_name.",
                })
                continue

            state = states[0]

            agent_name = state.agent_name
            handle = await subagent_session_manager.get_handle(agent_name, agent_id)

            async with handle.state_lock:
                state = await SubagentRuntimeStore.load_state(agent_name, agent_id)
                if state.status == "running" and not handle.is_running():
                    state.status = "interrupted"
                    state.last_error = state.last_error or "process_restarted_or_task_missing"
                    await SubagentRuntimeStore.save_state(state)

            results.append({
                "agent_id": agent_id,
                "agent_name": state.agent_name,
                "status": state.status,
                "result": state.last_result,
                "error": state.last_error,
            })
        return ToolResult(content=json.dumps(results, ensure_ascii=False))

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        if not result.ok:
            return {"action": "查询子 Agent 结果", "remark": f"查询失败: {result.content}"}
        try:
            data = json.loads(result.content)
            summary = ", ".join(f"{r['agent_id']}: {r['status']}" for r in data)
            return {"action": "查询子 Agent 结果", "remark": summary}
        except Exception:
            return {"action": "查询子 Agent 结果", "remark": ""}
