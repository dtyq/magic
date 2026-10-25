"""Start and inspect tasks in other Super Magic topics."""

from __future__ import annotations

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.core import tool

from .display import ProductTool
from .execution_config import resolve_task_configuration
from .models import ProductParams, resource_id


class StartTopicTaskParams(ProductParams):
    project_id: str = Field(..., description="Target project's exact ID.")
    topic_id: str = Field(..., description="Target topic's exact ID.")
    content: str = Field(..., min_length=1, max_length=32000, description="Plain-text instruction for the target topic.")
    force_interrupt: bool = Field(False, description="If true, suspend the target topic's active task and start this task immediately. If false, an active topic queues the message instead.")


async def _submit(ctx, project_id: str, topic_id: str, content: str, force_interrupt: bool = False) -> dict:
    topic = await ctx.sdk.topic.get_async(ctx.auth, topic_id)
    if str(topic.get("project_id")) != project_id:
        raise ValueError("The target topic does not belong to the given project")
    configuration = await resolve_task_configuration(ctx, topic, project_id, topic_id)
    raw = await ctx.sdk.task.create_async(ctx.auth, {
        "project_id": project_id,
        "topic_id": topic_id,
        "content": content,
        "agent_mode": configuration.agent_mode,
        "model_id": configuration.model_id,
        "force_interrupt": force_interrupt,
    })
    task_id = raw.get("task_id")
    queue_id = raw.get("queue_id")
    if task_id:
        return {"kind": "task", "topic_id": topic_id, "topic_name": topic.get("topic_name", ""), "task_id": str(task_id), "status": "accepted", "force_interrupt": force_interrupt}
    if queue_id:
        return {"kind": "queue", "topic_id": topic_id, "topic_name": topic.get("topic_name", ""), "queue_id": str(queue_id), "status": "queued"}
    raise ValueError("The service returned neither a task ID nor a queue ID")


def _receipt(data: dict) -> ToolResult:
    if data["kind"] == "queue":
        return ToolResult(content=f"Message queued in topic {data['topic_id']} (queue_id: {data['queue_id']}). Delivery is not task completion.", data=data)
    interruption = " Interruption of any active task was requested." if data.get("force_interrupt") else ""
    return ToolResult(content=f"Task accepted in topic {data['topic_id']} (task_id: {data['task_id']}).{interruption} Check its status before reporting completion.", data=data)


@tool(name="start_topic_task", code_mode_only=True)
class StartTopicTask(ProductTool[StartTopicTaskParams]):
    """Start a task in a target topic using its Agent mode and the requested interruption behavior."""
    name = "start_topic_task"

    async def execute(self, tool_context: ToolContext, params: StartTopicTaskParams) -> ToolResult:
        project_id = resource_id(params.project_id, "project_id")
        topic_id = resource_id(params.topic_id, "topic_id")
        return await self.run_product(
            tool_context, "Task submission",
            lambda ctx: _submit(ctx, project_id, topic_id, params.content, params.force_interrupt),
            write=True, format_result=_receipt,
        )


@tool(name="send_topic_message", code_mode_only=True)
class SendTopicMessage(StartTopicTask):
    """Send a follow-up to a topic; it creates a new task or queue entry."""
    name = "send_topic_message"


class GetTopicTaskParams(ProductParams):
    task_id: str = Field(..., description="Exact task_id returned by task submission, never a queue_id.")


@tool(name="get_topic_task", code_mode_only=True)
class GetTopicTask(ProductTool[GetTopicTaskParams]):
    """Check one product task and return its result only when finished."""
    name = "get_topic_task"

    async def execute(self, tool_context: ToolContext, params: GetTopicTaskParams) -> ToolResult:
        task_id = resource_id(params.task_id, "task_id")
        async def operation(ctx):
            raw = await ctx.sdk.task.status_async(ctx.auth, task_id)
            state = str(raw.get("task_status", "unknown"))
            data = {"task_id": task_id, "task_status": state}
            if raw.get("err_msg"):
                data["error_message"] = str(raw["err_msg"])[:2000]
            if state == "finished" and isinstance(raw.get("result"), dict):
                result = raw["result"]
                text = str(result.get("content", ""))
                data["result"] = {"content": text[:24000], "truncated": len(text) > 24000, "attachments": [
                    {key: item[key] for key in ("file_id", "file_name", "name") if key in item}
                    for item in result.get("attachments", []) if isinstance(item, dict)
                ]}
            return data
        def present(data):
            state = data["task_status"]
            if state == "finished":
                result = data.get("result", {})
                suffix = " [Result truncated.]" if result.get("truncated") else ""
                return ToolResult(content=f"Task {task_id} finished.\n{result.get('content', '')}{suffix}", data=data)
            detail = f" Reason: {data['error_message']}" if data.get("error_message") else ""
            return ToolResult(content=f"Task {task_id} status: {state}.{detail} No final result is available.", data=data)
        return await self.run_product(tool_context, "Task lookup", operation, format_result=present)


@tool(name="cancel_topic_task", code_mode_only=True)
class CancelTopicTask(ProductTool[GetTopicTaskParams]):
    """Request cancellation of one product task."""
    name = "cancel_topic_task"

    async def execute(self, tool_context: ToolContext, params: GetTopicTaskParams) -> ToolResult:
        task_id = resource_id(params.task_id, "task_id")
        async def operation(ctx):
            raw = await ctx.sdk.task.cancel_async(ctx.auth, task_id)
            return {"task_id": task_id, "status": str(raw.get("task_status", raw.get("status", "cancel_requested")))}
        return await self.run_product(tool_context, "Task cancellation", operation, write=True)


def _queue_status(value: object) -> str:
    # Queue completion means delivery, never completion of the Agent task.
    return {0: "queued", 1: "delivered", 2: "failed", 3: "processing"}.get(value, "unknown")


class ListTopicQueueParams(ProductParams):
    topic_id: str = Field(..., description="Exact target topic ID.")
    page: int = Field(1, ge=1, description="Page number.")
    page_size: int = Field(20, ge=1, le=100, description="Queue entries per page.")


@tool(name="list_topic_queued_messages", code_mode_only=True)
class ListTopicQueuedMessages(ProductTool[ListTopicQueueParams]):
    """List queued messages for one topic; delivery status is not task status."""
    name = "list_topic_queued_messages"

    async def execute(self, tool_context: ToolContext, params: ListTopicQueueParams) -> ToolResult:
        topic_id = resource_id(params.topic_id, "topic_id")
        async def operation(ctx):
            raw = await ctx.sdk.task.list_queue_async(ctx.auth, topic_id, params.page, params.page_size)
            items = raw.get("list")
            if not isinstance(items, list):
                raise ValueError("The service returned an invalid queue list")
            return {"items": [{"queue_id": str(item.get("queue_id", "")), "status": _queue_status(item.get("status")), "created_at": item.get("created_at")} for item in items if isinstance(item, dict)], "page": params.page, "total": raw.get("total")}
        return await self.run_product(tool_context, "Topic queue lookup", operation)


class DeleteTopicQueueParams(ProductParams):
    queue_id: str = Field(..., description="Exact queue_id, never a task_id.")


@tool(name="delete_topic_queued_message", code_mode_only=True)
class DeleteTopicQueuedMessage(ProductTool[DeleteTopicQueueParams]):
    """Withdraw one queued message when the backend permits deletion."""
    name = "delete_topic_queued_message"

    async def execute(self, tool_context: ToolContext, params: DeleteTopicQueueParams) -> ToolResult:
        queue_id = resource_id(params.queue_id, "queue_id")
        async def operation(ctx):
            raw = await ctx.sdk.task.delete_queue_async(ctx.auth, queue_id)
            return {"queue_id": queue_id, "status": raw.get("status", "delete_requested")}
        return await self.run_product(tool_context, "Queue withdrawal", operation, write=True)
