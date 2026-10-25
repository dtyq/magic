"""Canvas Code Mode 工具超时注册的 mock 契约测试。"""

from app.tools.canvas.tools import (
    AddCanvasContents,
    AddCanvasElements,
    EstimateCanvasContentPoints,
    RetryCanvasContentGeneration,
    SearchCanvasImages,
    WaitCanvasGeneration,
)
from app.tools.snippet_timeout_registry import SdkSnippetTimeoutRegistry


def test_long_running_canvas_tools_require_six_hundred_second_snippet_timeout() -> None:
    """长耗时 Canvas 工具的 SDK 片段超时至少应为 600 秒。"""
    tool_names = (
        AddCanvasElements.name,
        AddCanvasContents.name,
        RetryCanvasContentGeneration.name,
        EstimateCanvasContentPoints.name,
        SearchCanvasImages.name,
        WaitCanvasGeneration.name,
    )

    for tool_name in tool_names:
        code = f'tool.call("{tool_name}", {{}})'
        assert SdkSnippetTimeoutRegistry.get_effective_timeout(code, 120) >= 600
