"""Canvas ToolResult 和用户反馈 Presenter。"""

from app.tools.canvas.presentation.batch_status import (
    CanvasBatchStatus,
    batch_tool_result,
    canvas_result_remark,
    summarize_items,
    summarize_tool_result,
)
from app.tools.canvas.presentation.generation_feedback import (
    CanvasGenerationFeedback,
    GenerationFeedbackSummary,
)
from app.tools.canvas.presentation.model_content import elements_content, items_content, overview_content
from app.tools.canvas.presentation.tool_detail import CanvasToolDetailBuilder
from app.tools.canvas.presentation.tool_feedback import canvas_remark, error_result

__all__ = [
    "CanvasBatchStatus",
    "CanvasGenerationFeedback",
    "CanvasToolDetailBuilder",
    "GenerationFeedbackSummary",
    "batch_tool_result",
    "canvas_result_remark",
    "canvas_remark",
    "elements_content",
    "error_result",
    "items_content",
    "overview_content",
    "summarize_items",
    "summarize_tool_result",
]
