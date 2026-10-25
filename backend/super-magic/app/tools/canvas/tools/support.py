"""Canvas Tool 共享运行时辅助。"""

from __future__ import annotations

from pathlib import Path

from agentlang.context.tool_context import ToolContext
from app.tools.canvas.application import CanvasApplication
from app.tools.canvas.bootstrap import CanvasApplicationFactory


def _workspace(tool_context: ToolContext | None) -> Path:
    """解析当前 Agent 的运行时工作区。"""
    if tool_context is not None:
        agent_context = tool_context.get_extension("agent_context")
        if agent_context is not None and agent_context.get_workspace_dir():
            return Path(agent_context.get_workspace_dir())
        if tool_context.base_dir:
            return Path(tool_context.base_dir)
    return Path.cwd()


def _application(tool_context: ToolContext | None) -> CanvasApplication:
    """创建当前调用使用的 Canvas Application。"""
    return CanvasApplicationFactory.create_default(_workspace(tool_context))


async def resolve_element_types(
    tool_context: ToolContext | None,
    project_path: str,
    element_ids: list[str] | tuple[str, ...],
) -> frozenset[str]:
    """读取明确 Element ID 对应的类型，供用户反馈选择专用文案。"""
    if not element_ids:
        return frozenset()
    try:
        project = await _application(tool_context).repository.read(project_path)
    except Exception:
        return frozenset()
    return frozenset(
        element.element_type
        for element_id in element_ids
        if (element := project.canvas.get_element(element_id)) is not None
    )


async def resolve_generation_task_types(
    tool_context: ToolContext | None,
    generation_task_ids: list[str] | tuple[str, ...],
) -> frozenset[str]:
    """读取生成任务绑定的 Element 类型，供等待反馈选择媒体文案。"""
    if not generation_task_ids:
        return frozenset()
    try:
        tasks = _application(tool_context).wait_generation_service.generation_tasks
        values = [await tasks.get(task_id) for task_id in generation_task_ids]
    except Exception:
        return frozenset()
    return frozenset(task.element_type for task in values if task is not None)
