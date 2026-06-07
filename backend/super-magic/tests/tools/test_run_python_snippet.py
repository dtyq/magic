import ast
from unittest.mock import AsyncMock, patch

import pytest

from app.core.entity.tool.tool_result_types import TerminalToolResult
from app.tools.run_python_snippet import RunPythonSnippet, RunPythonSnippetParams
from app.tools.run_sdk_snippet import RunSdkSnippet


def test_run_python_snippet_repairs_unescaped_quotes_in_prose_call_argument():
    python_code = (
        'add_body("这是一段包含"关键词甲"的测试正文。")\n'
        'add_heading2("（一）这是一段包含"关键词乙"和"关键词丙"的测试标题）\n'
    )

    repaired = RunPythonSnippet._prepare_python_code(python_code)

    assert repaired != python_code
    ast.parse(repaired)
    assert "add_body('这是一段包含\"关键词甲\"的测试正文。')" in repaired
    assert "add_heading2('（一）这是一段包含\"关键词乙\"和\"关键词丙\"的测试标题）')" in repaired


def test_run_python_snippet_combines_path_and_prose_repairs():
    python_code = (
        'source_path = "/tmp/包含"关键词甲"的测试材料.docx"\n'
        'add_body("这是一段包含"关键词甲"的测试正文。")\n'
    )

    repaired = RunPythonSnippet._prepare_python_code(python_code)

    assert repaired != python_code
    ast.parse(repaired)
    assert "source_path = '/tmp/包含\"关键词甲\"的测试材料.docx'" in repaired
    assert "add_body('这是一段包含\"关键词甲\"的测试正文。')" in repaired


def test_run_sdk_snippet_uses_same_python_repair():
    python_code = 'tool.call("write_file", {"path": "/tmp/包含"关键词甲"的测试材料.txt"})\n'

    repaired = RunSdkSnippet._prepare_python_code(python_code)

    assert repaired != python_code
    ast.parse(repaired)
    assert '/tmp/包含"关键词甲"的测试材料.txt' in repaired


@pytest.mark.asyncio
async def test_run_python_snippet_injects_project_root_env(tmp_path):
    project_root = tmp_path / "mock_app"
    workspace = tmp_path / "mock_workspace"
    project_root.mkdir()
    workspace.mkdir()

    tool = RunPythonSnippet()
    tool.base_dir = workspace

    with patch(
        "app.tools.run_python_snippet.PathManager.get_project_root",
        return_value=project_root,
    ), patch(
        "app.tools.run_python_snippet.ProcessExecutor.execute_command",
        new_callable=AsyncMock,
    ) as mock_execute:
        mock_execute.return_value = TerminalToolResult(ok=True, content="ok")

        result = await tool.execute_purely(
            RunPythonSnippetParams(
                python_code="print('mock result')",
                script_path="temp_mock_snippet.py",
            )
        )

    assert result.ok is True
    assert mock_execute.await_args.kwargs["cwd"] == workspace
    assert mock_execute.await_args.kwargs["extra_env"] == {
        "SUPER_MAGIC_PROJECT_ROOT": str(project_root),
    }
