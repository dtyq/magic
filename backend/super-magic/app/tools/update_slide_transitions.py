"""通过受版本保护的文件保存接口更新幻灯片过渡。"""

import asyncio
from pathlib import Path

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.context.run_interruption import await_with_interruption
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.infrastructure.magic_service.client import MagicServiceClient
from app.infrastructure.magic_service.exceptions import ApiError
from app.tools.core import tool
from app.tools.core.tool_keepalive import start_tool_keep_alive, stop_tool_keep_alive
from app.tools.slide_transition_storage import (
    TransitionStorageError, read_project_snapshot, save_project_snapshot,
)
from app.tools.slide_transitions import (
    SlideTransitionOperation, TransitionOperation, UpdateSlideTransitionsParams, update_project_content,
)
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_realpath

logger = get_logger(__name__)


# 模型使用说明：agents/skills/creating-slides/references/slide-transitions.md
@tool(code_mode_only=True)
class UpdateSlideTransitions(WorkspaceTool[UpdateSlideTransitionsParams]):
    """Update deck transition metadata through a revision-protected save."""

    async def execute(self, tool_context: ToolContext, params: UpdateSlideTransitionsParams) -> ToolResult:
        context = tool_context.get_extension("agent_context")
        event = context.get_interruption_event() if context else None
        keep_alive = start_tool_keep_alive(tool_context)
        try:
            return await await_with_interruption(self._update(params), event)
        except asyncio.CancelledError:
            # 终止 HTTP 等待不能回滚已由服务端提交的保存。
            logger.info("Slide transition update interrupted; any submitted save may already have committed")
            raise
        except TransitionStorageError as exc:
            return ToolResult.error(str(exc), extra_info={"outcome": exc.outcome})
        except ApiError as exc:
            outcome = "permission" if exc.status_code in {401, 403} else "not_saved"
            return ToolResult.error(
                "The file service rejected access to the project. Check user authorization and edit permission before retrying.",
                extra_info={"outcome": outcome},
            )
        except Exception as exc:
            logger.warning("Slide transition update failed: %s", type(exc).__name__)
            return ToolResult.error(
                "Unable to update slide transitions. The file service, authorization, or synchronized project "
                "could not be verified. Reread the deck before another attempt; do not overwrite it with a generic file tool.",
                extra_info={"outcome": "unknown"},
            )
        finally:
            stop_tool_keep_alive(keep_alive)

    async def _update(self, params: UpdateSlideTransitionsParams) -> ToolResult:
        project = Path(params.project_path)
        if project.is_absolute() or ".." in project.parts or "\\" in params.project_path:
            raise TransitionStorageError("project_path must be relative to the workspace without parent traversal.")
        base = await async_realpath(self.base_dir)
        path = await async_realpath(base / project / "magic.project.js", strict=True)
        if not path.is_relative_to(base):
            raise TransitionStorageError("The project must remain inside the workspace.")
        async with MagicServiceClient() as client:
            snapshot = await read_project_snapshot(client, path)
            try:
                content = update_project_content(snapshot.content, params)
            except ValueError as exc:
                raise TransitionStorageError(str(exc)) from exc
            saved = await save_project_snapshot(client, path, snapshot, content)
        targets = (params.expected_slides if params.operations[0].operation == TransitionOperation.SET_DEFAULT
                   else [path for operation in params.operations for path in operation.slide_paths])
        summaries = [_operation_summary(operation) for operation in params.operations]
        unchanged = content == snapshot.content
        status = "No changes were needed; the requested settings already match the synchronized project." if unchanged else "Saved all transition updates together and confirmed them in the mounted project."
        return ToolResult(
            content=f"{status}\n" + "\n".join(summaries) + "\nPlayback was not previewed.",
            data={"project_path": params.project_path, "file_id": saved.file_id,
                  "revision": saved.revision, "slide_paths": targets,
                  "operations": [operation.model_dump(mode="json", exclude_none=True) for operation in params.operations]},
            extra_info={"outcome": "unchanged" if unchanged else "success"},
        )

    async def get_tool_detail(self, tool_context, result, arguments=None) -> ToolDetail:
        key = (result.extra_info or {}).get("outcome", "success" if result.ok else "error")
        content = i18n.translate(f"update_slide_transitions.{key}", category="tool.messages")
        if result.ok:
            summaries = [_operation_summary(SlideTransitionOperation.model_validate(operation), localized=True)
                         for operation in (result.data or {}).get("operations", [])]
            content += "\n\n" + "\n\n".join(summaries)
        return ToolDetail(type=DisplayType.MD, data=FileContent(
            file_name="slide-transitions.md",
            content=content,
        ))

    async def get_before_tool_call_friendly_action_and_remark(self, tool_name, tool_context, arguments=None):
        return self._friendly(tool_name, "before")

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name, tool_context, result, execution_time, arguments=None):
        return self._friendly(tool_name, (result.extra_info or {}).get("outcome", "success" if result.ok else "error"))

    @staticmethod
    def _friendly(tool_name, state):
        return {"tool_name": tool_name,
                "action": i18n.translate("update_slide_transitions", category="tool.actions"),
                "remark": i18n.translate(f"update_slide_transitions.{state}", category="tool.messages")}


def _operation_summary(operation: SlideTransitionOperation, *, localized: bool = False) -> str:
    def phrase(key, fallback, **values):
        return (i18n.translate(f"update_slide_transitions.{key}", category="tool.messages", **values)
                if localized else fallback.format(**values))

    scope = (phrase("default_scope", "Deck default") if operation.operation == TransitionOperation.SET_DEFAULT
             else ", ".join(operation.slide_paths))
    if operation.transition is None:
        return phrase("restored_scope", "{scope}: inherit the deck default", scope=scope)
    setting = operation.transition
    effect = phrase(f"effect_{setting.effect.value}", setting.effect.value)
    details = effect
    if setting.duration_ms is not None:
        easing = phrase(f"easing_{setting.easing}", setting.easing)
        details += f", {setting.duration_ms} ms, {easing}"
    if setting.direction:
        details += ", " + phrase(f"direction_{setting.direction}", setting.direction)
    summary = f"{scope}: {details}"
    if operation.clear_overrides:
        summary += "; " + phrase("cleared_overrides", "removed previous page overrides")
    return summary
