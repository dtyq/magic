"""
Tests for ProcessExecutor._rewrite_python_command and _rewrite_single_python_command.

测试场景覆盖：
- enable_rewrite=False 及非 frozen 环境的快速返回
- 单命令改写：python/python3/python3.11、绝对/相对路径、携带参数
- 单命令不改写：非 python 命令、脚本不存在、python -c 形式
- 链式命令（&&、||、;）：cd 绝对路径、cd 相对路径、无 cd、多级 cd
- 链式命令中非 python 子命令保持原样
"""

import shlex
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

from app.utils.process_executor import ProcessExecutor


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def frozen_env(tmp_path):
    """
    模拟 PyInstaller 打包环境：
    - sys.frozen = True
    - sys.executable 指向 tmp_path/bin/main
    - 返回 (bin_dir, script_runner_path)
    """
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    executable = bin_dir / "main"
    executable.touch()
    script_runner = bin_dir / "script_runner"

    with patch.object(sys, "frozen", True, create=True), \
         patch.object(sys, "executable", str(executable)):
        yield bin_dir, script_runner


def make_script(directory: Path, name: str = "run.py") -> Path:
    """在指定目录创建一个空脚本文件，返回其路径。"""
    directory.mkdir(parents=True, exist_ok=True)
    script = directory / name
    script.touch()
    return script


def expected_rewrite(script_runner: Path, script_path: str, *args: str) -> str:
    """构造期望的改写结果命令字符串。"""
    return shlex.join([str(script_runner), script_path, *args])


# ---------------------------------------------------------------------------
# 快速返回：不满足改写前提条件
# ---------------------------------------------------------------------------

class TestRewriteGuards:
    def test_not_enabled_returns_original(self, tmp_path):
        """enable_rewrite=False 时，无论什么命令都原样返回。"""
        result = ProcessExecutor._rewrite_python_command(
            "python run.py", enable_rewrite=False
        )
        assert result == "python run.py"

    def test_not_frozen_returns_original(self, tmp_path):
        """非 PyInstaller 环境（无 sys.frozen）时，原样返回。"""
        with patch.object(sys, "frozen", False, create=True):
            result = ProcessExecutor._rewrite_python_command(
                "python run.py", enable_rewrite=True
            )
        assert result == "python run.py"

    def test_frozen_false_returns_original(self, tmp_path):
        """sys.frozen=False 时原样返回。"""
        with patch.object(sys, "frozen", False, create=True):
            result = ProcessExecutor._rewrite_python_command(
                "python run.py", enable_rewrite=True
            )
        assert result == "python run.py"


# ---------------------------------------------------------------------------
# 单命令改写
# ---------------------------------------------------------------------------

class TestRewriteSingleCommand:
    def test_rewrite_python(self, frozen_env, tmp_path):
        """python script.py 被改写为 script_runner script.py。"""
        bin_dir, script_runner = frozen_env
        script = make_script(tmp_path / "proj", "run.py")

        result = ProcessExecutor._rewrite_python_command(
            f"python {script}", enable_rewrite=True
        )
        assert result == expected_rewrite(script_runner, str(script))

    def test_rewrite_python3(self, frozen_env, tmp_path):
        """python3 前缀也能被改写。"""
        bin_dir, script_runner = frozen_env
        script = make_script(tmp_path / "proj", "run.py")

        result = ProcessExecutor._rewrite_python_command(
            f"python3 {script}", enable_rewrite=True
        )
        assert result == expected_rewrite(script_runner, str(script))

    def test_rewrite_python311(self, frozen_env, tmp_path):
        """python3.11 前缀也能被改写。"""
        bin_dir, script_runner = frozen_env
        script = make_script(tmp_path / "proj", "run.py")

        result = ProcessExecutor._rewrite_python_command(
            f"python3.11 {script}", enable_rewrite=True
        )
        assert result == expected_rewrite(script_runner, str(script))

    def test_rewrite_preserves_script_args(self, frozen_env, tmp_path):
        """改写时脚本的额外参数被原样保留。"""
        bin_dir, script_runner = frozen_env
        script = make_script(tmp_path / "proj", "upload.py")
        arg = "/workspace/skills/pkg-v1.0.0.zip"

        result = ProcessExecutor._rewrite_python_command(
            f"python {script} {arg}", enable_rewrite=True
        )
        assert result == expected_rewrite(script_runner, str(script), arg)

    def test_rewrite_relative_path_with_cwd(self, frozen_env, tmp_path):
        """相对路径脚本配合 cwd 参数能正确解析并改写。"""
        bin_dir, script_runner = frozen_env
        proj_dir = tmp_path / "proj"
        script = make_script(proj_dir, "run.py")

        result = ProcessExecutor._rewrite_python_command(
            "python run.py", cwd=proj_dir, enable_rewrite=True
        )
        assert result == expected_rewrite(script_runner, "run.py")

    def test_no_rewrite_when_script_not_exists(self, frozen_env, tmp_path):
        """脚本文件不存在时，命令原样返回。"""
        result = ProcessExecutor._rewrite_python_command(
            f"python {tmp_path}/nonexistent.py", enable_rewrite=True
        )
        assert result == f"python {tmp_path}/nonexistent.py"

    def test_no_rewrite_relative_path_without_cwd(self, frozen_env):
        """相对路径且 cwd=None 时无法解析到文件，原样返回。"""
        result = ProcessExecutor._rewrite_python_command(
            "python scripts/run.py", cwd=None, enable_rewrite=True
        )
        assert result == "python scripts/run.py"

    def test_no_rewrite_python_dash_c(self, frozen_env):
        """python -c '...' 形式，-c 不是文件，原样返回。"""
        cmd = "python -c 'print(1)'"
        result = ProcessExecutor._rewrite_python_command(cmd, enable_rewrite=True)
        assert result == cmd

    def test_no_rewrite_non_python_command(self, frozen_env, tmp_path):
        """非 python 命令原样返回。"""
        script = make_script(tmp_path, "run.sh")
        cmd = f"bash {script}"
        result = ProcessExecutor._rewrite_python_command(cmd, enable_rewrite=True)
        assert result == cmd

    def test_no_rewrite_python_alone(self, frozen_env):
        """只有 python 没有脚本参数，原样返回。"""
        result = ProcessExecutor._rewrite_python_command("python", enable_rewrite=True)
        assert result == "python"


# ---------------------------------------------------------------------------
# 链式命令改写（&&）
# ---------------------------------------------------------------------------

class TestRewriteChainedAnd:
    def test_cd_absolute_then_python_relative(self, frozen_env, tmp_path):
        """cd 绝对路径 && python 相对路径：cd 更新虚拟 cwd 后能正确改写。"""
        bin_dir, script_runner = frozen_env
        proj_dir = tmp_path / "skill-creator"
        script = make_script(proj_dir / "scripts", "upload.py")
        arg = "/workspace/skills/pkg.zip"

        cmd = f"cd {proj_dir} && python scripts/upload.py {arg}"
        result = ProcessExecutor._rewrite_python_command(
            cmd, cwd=None, enable_rewrite=True
        )

        assert f"cd {proj_dir}" in result
        assert " && " in result
        rewritten_py = expected_rewrite(script_runner, "scripts/upload.py", arg)
        assert result.endswith(rewritten_py)

    def test_cd_relative_then_python(self, frozen_env, tmp_path):
        """cd 相对路径（基于传入 cwd）&& python 相对路径：正确追踪目录。"""
        bin_dir, script_runner = frozen_env
        base = tmp_path / "app"
        proj_dir = base / "skill-creator"
        script = make_script(proj_dir / "scripts", "run.py")

        cmd = "cd skill-creator && python scripts/run.py"
        result = ProcessExecutor._rewrite_python_command(
            cmd, cwd=base, enable_rewrite=True
        )

        rewritten_py = expected_rewrite(script_runner, "scripts/run.py")
        assert result.endswith(rewritten_py)

    def test_python_then_non_python(self, frozen_env, tmp_path):
        """python script.py && echo done：只改写 python 部分，echo 原样保留。"""
        bin_dir, script_runner = frozen_env
        script = make_script(tmp_path / "proj", "run.py")

        cmd = f"python {script} && echo done"
        result = ProcessExecutor._rewrite_python_command(cmd, enable_rewrite=True)

        assert result.startswith(expected_rewrite(script_runner, str(script)))
        assert result.endswith("echo done")

    def test_non_python_then_python(self, frozen_env, tmp_path):
        """echo setup && python script.py：echo 原样，python 被改写。"""
        bin_dir, script_runner = frozen_env
        script = make_script(tmp_path / "proj", "run.py")

        cmd = f"echo setup && python {script}"
        result = ProcessExecutor._rewrite_python_command(cmd, enable_rewrite=True)

        assert result.startswith("echo setup")
        assert result.endswith(expected_rewrite(script_runner, str(script)))

    def test_multiple_chains_with_multiple_cd(self, frozen_env, tmp_path):
        """多级 cd && cd && python：逐步追踪目录变化后正确改写。"""
        bin_dir, script_runner = frozen_env
        level1 = tmp_path / "agents"
        level2 = level1 / "skills" / "creator"
        script = make_script(level2 / "scripts", "validate.py")

        cmd = f"cd {level1} && cd skills/creator && python scripts/validate.py"
        result = ProcessExecutor._rewrite_python_command(
            cmd, cwd=None, enable_rewrite=True
        )

        rewritten_py = expected_rewrite(script_runner, "scripts/validate.py")
        assert result.endswith(rewritten_py)


# ---------------------------------------------------------------------------
# 链式命令改写（||  和  ;）
# ---------------------------------------------------------------------------

class TestRewriteChainedOtherOperators:
    def test_or_operator(self, frozen_env, tmp_path):
        """fallback || python script.py：python 部分被改写。"""
        bin_dir, script_runner = frozen_env
        script = make_script(tmp_path / "proj", "run.py")

        cmd = f"false || python {script}"
        result = ProcessExecutor._rewrite_python_command(cmd, enable_rewrite=True)

        assert result.endswith(expected_rewrite(script_runner, str(script)))

    def test_semicolon_operator(self, frozen_env, tmp_path):
        """cmd1 ; python script.py：python 部分被改写。"""
        bin_dir, script_runner = frozen_env
        script = make_script(tmp_path / "proj", "run.py")

        cmd = f"echo pre ; python {script}"
        result = ProcessExecutor._rewrite_python_command(cmd, enable_rewrite=True)

        assert result.endswith(expected_rewrite(script_runner, str(script)))

    def test_cd_then_python_with_semicolon(self, frozen_env, tmp_path):
        """cd /abs ; python rel/script.py：用 ; 分隔时 cd 也能更新虚拟 cwd。"""
        bin_dir, script_runner = frozen_env
        proj_dir = tmp_path / "proj"
        script = make_script(proj_dir / "scripts", "run.py")

        cmd = f"cd {proj_dir} ; python scripts/run.py"
        result = ProcessExecutor._rewrite_python_command(cmd, enable_rewrite=True)

        rewritten_py = expected_rewrite(script_runner, "scripts/run.py")
        assert result.endswith(rewritten_py)


# ---------------------------------------------------------------------------
# 链式命令：python 脚本不存在时不改写
# ---------------------------------------------------------------------------

class TestRewriteChainedNoRewrite:
    def test_cd_then_nonexistent_script(self, frozen_env, tmp_path):
        """cd && python 但脚本不存在：python 部分原样返回。"""
        proj_dir = tmp_path / "proj"
        proj_dir.mkdir()

        cmd = f"cd {proj_dir} && python scripts/missing.py"
        result = ProcessExecutor._rewrite_python_command(cmd, enable_rewrite=True)

        assert "scripts/missing.py" in result
        assert "script_runner" not in result

    def test_chain_without_cd_nonexistent_relative(self, frozen_env):
        """无 cd 且相对路径脚本不存在：python 部分原样返回。"""
        cmd = "echo pre && python no_such_script.py"
        result = ProcessExecutor._rewrite_python_command(cmd, enable_rewrite=True)

        assert result == cmd
