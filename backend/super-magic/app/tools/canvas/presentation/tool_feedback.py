"""Canvas 工具错误映射。"""

from __future__ import annotations

from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n
from app.tools.canvas.domain.errors import CanvasBatchError, CanvasDomainError, CanvasProtocolError


def canvas_remark(code: str, project_path: str = "", **kwargs: object) -> str:
    """翻译 Canvas 用户反馈，并按需附加项目路径。"""
    remark = i18n.translate(code, category="tool.messages", **kwargs)
    return f"{project_path} · {remark}" if project_path else remark


def error_result(error: Exception) -> ToolResult:
    """把内部异常转换为稳定且可继续处理的模型结果。"""
    if isinstance(error, CanvasBatchError):
        lines = [
            "Canvas batch was not applied.",
            "- Error code: BATCH_VALIDATION_FAILED",
        ]
        for item in error.items:
            line = f"- item_ref={item['item_ref']} | status={item['status']}"
            if item.get("error_code"):
                line += f" | error_code={item['error_code']}"
            if item.get("reason"):
                line += f" | reason={item['reason']}"
            lines.append(line)
        lines.append("Action: correct only the failed items, then submit the intended batch again.")
        return ToolResult.error("\n".join(lines), data={"items": error.items, "applied": False})
    if isinstance(error, (CanvasDomainError, CanvasProtocolError)):
        code = "CANVAS_PROJECT_NOT_SUPPORTED" if error.code == "UNSUPPORTED_CANVAS_VERSION" else error.code
        action = _model_action_for_error(code)
        return ToolResult.error(
            "Canvas operation failed.\n"
            f"- Error code: {code}\n"
            f"- Reason: {error.message}\n"
            f"- Action: {action}",
            data={"error_code": code, "error": error.message},
        )
    if isinstance(error, FileNotFoundError) and str(error) == "PROJECT_NOT_FOUND":
        return ToolResult.error(
            "Canvas operation failed.\n"
            "- Error code: PROJECT_NOT_FOUND\n"
            "- Action: Call initialize_canvas with the same project_path.",
            data={"error_code": "PROJECT_NOT_FOUND", "error": "Canvas project was not found."},
        )
    if isinstance(error, ValueError) and str(error) in {
        "INVALID_ELEMENT_DETAILS",
        "UNSUPPORTED_ELEMENT_DETAILS_STRUCTURE",
    }:
        return ToolResult.error(
            "Canvas operation failed.\n"
            "- Error code: INVALID_ELEMENT_DETAILS\n"
            "- Reason: Canvas metadata is unavailable or has an unsupported structure.\n"
            "- Action: Query the Canvas first and ask the user to repair the project metadata.",
            data={
                "error_code": "INVALID_ELEMENT_DETAILS",
                "error": "Canvas metadata is unavailable or has an unsupported structure.",
            },
        )
    if isinstance(error, ValueError) and str(error) == "PROJECT_PATH_INVALID":
        return ToolResult.error(
            "Canvas operation failed.\n"
            "- Error code: PROJECT_PATH_INVALID\n"
            "- Reason: project_path must be a workspace-relative directory.",
            data={
                "error_code": "PROJECT_PATH_INVALID",
                "error": "project_path must be a workspace-relative directory.",
            },
        )
    return ToolResult.error(
        "Canvas operation failed.\n"
        "- Error code: INTERNAL_ERROR\n"
        "- Reason: An unexpected internal error occurred.\n"
        "- Action: Keep the returned IDs and retry the smallest failed operation.",
        data={"error_code": "INTERNAL_ERROR", "error": "An unexpected internal error occurred."},
    )


def _model_action_for_error(code: str) -> str:
    """根据稳定错误码生成大模型可执行的下一步建议。"""
    if code in {"CONTENT_RETRY_LIMIT_REACHED", "CONTENT_RETRY_NOT_ALLOWED"}:
        return "Do not retry this Content automatically; ask the user whether to create a new Content version."
    if code == "FRAME_GENERATION_NOT_APPLICABLE":
        return "Do not wait for a Frame; use query or layout tools for the Frame."
    if code in {"CONNECTION_NOT_FOUND", "CONNECTION_ID_REQUIRED"}:
        return "Query the affected Elements to obtain the exact Connection ID, then retry only after explicit user intent."
    if code == "CANVAS_PROJECT_NOT_SUPPORTED":
        return (
            "Tell the user that this Canvas project uses an older format that the current Canvas tools cannot process. "
            "Ask the user to open the Canvas in the UI and click Upgrade, then retry the operation. "
            "Do not inspect, migrate, or write the project file directly."
        )
    if code in {"ELEMENT_NOT_FOUND", "CONTENT_NOT_FOUND"}:
        return "Use the latest Canvas query result to obtain the exact target ID, then retry only the failed item."
    if code == "ELEMENT_MUTATION_NOT_ALLOWED":
        return "Do not attempt another write to this Element type. You may query it and describe its current state."
    return "Correct the failed item using the exact IDs from the latest Canvas query, then retry only that operation."
