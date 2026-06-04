from unittest.mock import AsyncMock, patch

import pytest

from app.core.entity.tool.tool_result_types import TerminalToolResult
from app.tools.run_sdk_snippet import RunSdkSnippet, RunSdkSnippetParams


class _FakeAgentContext:
    def __init__(self, context_id: str) -> None:
        self.context_id = context_id
        self.cleanup_callbacks = {}

    def register_run_cleanup(self, key, callback) -> None:
        self.cleanup_callbacks[key] = callback

    def get_message_version(self) -> str:
        return "v1"

    def get_interruption_event(self):
        return None


class _FakeToolContext:
    def __init__(self, context_id: str = "ctx_test_123") -> None:
        self.tool_call_id = "call_test_123"
        self.tool_name = "run_sdk_snippet"
        self.arguments = {}
        self._agent_context = _FakeAgentContext(context_id)

    def get_extension(self, name: str):
        if name == "agent_context":
            return self._agent_context
        return None


@pytest.mark.asyncio
async def test_run_sdk_snippet_uses_long_timeout_for_video_tools(tmp_path):
    tool = RunSdkSnippet()

    with patch("app.tools.run_sdk_snippet.PathManager.get_project_root", return_value=tmp_path), \
         patch("app.tools.run_sdk_snippet.ProcessExecutor.execute_command", new_callable=AsyncMock) as mock_execute:
        mock_execute.return_value = TerminalToolResult(ok=True, content="ok")

        result = await tool.execute(
            tool_context=_FakeToolContext(),
            params=RunSdkSnippetParams(
                python_code="from sdk.tool import tool\nresult = tool.call('generate_video', {'prompt': 'demo'})",
                timeout=60,
            ),
        )

    assert result.ok is True
    assert mock_execute.await_args.kwargs["timeout"] == 3600
    assert mock_execute.await_args.kwargs["extra_env"]["SUPER_MAGIC_AGENT_CONTEXT_ID"] == "ctx_test_123"


@pytest.mark.asyncio
async def test_run_sdk_snippet_keeps_default_timeout_for_non_video_tools(tmp_path):
    tool = RunSdkSnippet()

    with patch("app.tools.run_sdk_snippet.PathManager.get_project_root", return_value=tmp_path), \
         patch("app.tools.run_sdk_snippet.ProcessExecutor.execute_command", new_callable=AsyncMock) as mock_execute:
        mock_execute.return_value = TerminalToolResult(ok=True, content="ok")

        result = await tool.execute(
            tool_context=_FakeToolContext(),
            params=RunSdkSnippetParams(
                python_code="from sdk.tool import tool\nresult = tool.call('create_canvas', {'project_path': 'demo'})",
                timeout=60,
            ),
        )

    assert result.ok is True
    assert mock_execute.await_args.kwargs["timeout"] == 60
    assert mock_execute.await_args.kwargs["extra_env"]["SUPER_MAGIC_AGENT_CONTEXT_ID"] == "ctx_test_123"


def test_run_sdk_snippet_repairs_unescaped_quotes_in_absolute_path_assignment():
    python_code = (
        "from sdk.tool import tool\n"
        'doc = "/Users/demo/.workspace/mock-report-"quoted-section"-v1.docx"\n'
        "print(doc)\n"
    )

    repaired = RunSdkSnippet._prepare_python_code(python_code)

    assert repaired != python_code
    assert "doc = '/Users/demo/.workspace/mock-report-\"quoted-section\"-v1.docx'" in repaired


def test_run_sdk_snippet_repairs_unescaped_quotes_in_absolute_path_tool_argument():
    python_code = (
        "from sdk.tool import tool\n"
        "result = tool.call(\"inspect_document\", {\n"
        '    "input_path": "/Users/demo/.workspace/mock-report-"quoted-section"-v1.docx",\n'
        "})\n"
        "print(result.content)\n"
    )

    repaired = RunSdkSnippet._prepare_python_code(python_code)

    assert repaired != python_code
    assert '"input_path": \'/Users/demo/.workspace/mock-report-"quoted-section"-v1.docx\',' in repaired


def test_run_sdk_snippet_does_not_rewrite_valid_python_code():
    python_code = (
        "from sdk.tool import tool\n"
        'doc = "/Users/demo/.workspace/report.pdf"\n'
        "print(doc)\n"
    )

    assert RunSdkSnippet._prepare_python_code(python_code) == python_code
