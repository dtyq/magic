import pytest

from app.tools.shell_exec import ShellExec, ShellExecParams


@pytest.mark.asyncio
async def test_nonzero_exit_preserves_command_result_without_tool_error(tmp_path):
    tool = ShellExec(base_dir=tmp_path)
    result = await tool.execute(None, ShellExecParams(command="printf ok; exit 2"))

    assert result.ok is True
    assert result.exit_code == 2
    assert result.content == (
        "Command exited with nonzero status (exit code: 2)\n\n"
        "Standard output:\nok"
    )
