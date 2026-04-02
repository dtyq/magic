from unittest.mock import AsyncMock, patch

import pytest

from app.core.entity.tool.tool_result_types import TerminalToolResult
from app.tools.run_skills_snippet import RunSkillsSnippet, RunSkillsSnippetParams


@pytest.mark.asyncio
async def test_run_skills_snippet_uses_long_timeout_for_video_tools(tmp_path):
    tool = RunSkillsSnippet()

    with patch("app.tools.run_skills_snippet.PathManager.get_project_root", return_value=tmp_path), \
         patch("app.tools.run_skills_snippet.ProcessExecutor.execute_command", new_callable=AsyncMock) as mock_execute:
        mock_execute.return_value = TerminalToolResult(ok=True, content="ok")

        result = await tool.execute(
            tool_context=None,
            params=RunSkillsSnippetParams(
                python_code="from sdk.tool import tool\nresult = tool.call('generate_video', {'prompt': 'demo'})",
                timeout=60,
            ),
        )

    assert result.ok is True
    assert mock_execute.await_args.kwargs["timeout"] == 3600


@pytest.mark.asyncio
async def test_run_skills_snippet_keeps_default_timeout_for_non_video_tools(tmp_path):
    tool = RunSkillsSnippet()

    with patch("app.tools.run_skills_snippet.PathManager.get_project_root", return_value=tmp_path), \
         patch("app.tools.run_skills_snippet.ProcessExecutor.execute_command", new_callable=AsyncMock) as mock_execute:
        mock_execute.return_value = TerminalToolResult(ok=True, content="ok")

        result = await tool.execute(
            tool_context=None,
            params=RunSkillsSnippetParams(
                python_code="from sdk.tool import tool\nresult = tool.call('create_design_project', {'project_path': 'demo'})",
                timeout=60,
            ),
        )

    assert result.ok is True
    assert mock_execute.await_args.kwargs["timeout"] == 60
