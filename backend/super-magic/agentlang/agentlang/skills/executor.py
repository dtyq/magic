"""Skill 脚本执行器"""

import subprocess
import os
import sys
import json
import logging
import io
from pathlib import Path
from typing import Any, Optional
from contextlib import redirect_stdout

from .exceptions import SkillExecutionError

logger = logging.getLogger(__name__)


class SkillExecutor:
    """Skill 脚本执行器

    提供执行 Skill 中各类脚本的功能，支持 Python、Node.js 和 Shell 脚本。
    包含基础的超时保护和路径验证。
    """

    def __init__(self, timeout: int = 300):
        """初始化 SkillExecutor

        Args:
            timeout: 脚本执行超时时间（秒），默认 300 秒
        """
        self.timeout = timeout

    def execute(
        self,
        scripts_dir: Path,
        script_name: str,
        skills_dir: Optional[Path] = None,
        use_subprocess: bool = True,
        **kwargs
    ) -> Any:
        """执行脚本

        Args:
            scripts_dir: 脚本目录
            script_name: 脚本名称
            skills_dir: Skills 根目录（用于路径验证）
            use_subprocess: 是否使用子进程执行，默认 True
                          - True: 在子进程中执行（隔离、安全）
                          - False: 在主进程中执行（可访问项目模块）
            **kwargs: 传递给脚本的参数

        Returns:
            脚本执行结果

        Raises:
            SkillExecutionError: 脚本不存在或执行失败
        """
        # 安全校验 1: 严格验证 script_name，防止路径穿越攻击
        self._validate_script_name(script_name)

        # 安全校验 2: 构造并验证脚本路径
        script_path = scripts_dir / script_name

        # 安全校验 3: 解析真实路径并验证其位于 scripts_dir 内
        try:
            resolved_script = script_path.resolve()
            resolved_scripts_dir = scripts_dir.resolve()

            # 使用 is_relative_to 确保脚本在 scripts_dir 内
            if not resolved_script.is_relative_to(resolved_scripts_dir):
                raise SkillExecutionError(
                    f"Script path outside scripts directory: {script_name}"
                )
        except (ValueError, OSError) as e:
            raise SkillExecutionError(
                f"Invalid script path: {script_name}, error: {e}"
            )

        # 安全校验 4: 检查脚本是否存在（在路径验证之后）
        if not resolved_script.exists():
            raise SkillExecutionError(f"Script not found: {script_name}")

        # 安全校验 5: 如果提供了 skills_dir，额外验证脚本路径在 skills 目录内
        if skills_dir:
            try:
                resolved_skills_dir = skills_dir.resolve()
                if not resolved_script.is_relative_to(resolved_skills_dir):
                    raise SkillExecutionError(
                        f"Script path outside skills directory: {script_name}"
                    )
            except (ValueError, OSError) as e:
                raise SkillExecutionError(
                    f"Invalid skills directory path, error: {e}"
                )
        else:
            # 记录警告：未提供 skills_dir，缺少全局路径保护
            logger.warning(
                f"Executing script without skills_dir validation: {script_name}"
            )

        # 根据文件扩展名选择执行方式
        suffix = resolved_script.suffix.lower()

        if suffix == ".py":
            if use_subprocess:
                return self._execute_python(resolved_script, **kwargs)
            else:
                return self._execute_in_main_process(resolved_script, **kwargs)
        elif suffix in [".js", ".ts"]:
            if not use_subprocess:
                raise SkillExecutionError("主进程执行仅支持 Python 脚本")
            return self._execute_node(resolved_script, **kwargs)
        elif suffix == ".sh":
            if not use_subprocess:
                raise SkillExecutionError("主进程执行仅支持 Python 脚本")
            return self._execute_shell(resolved_script, **kwargs)
        else:
            raise SkillExecutionError(f"Unsupported script type: {suffix}")

    def _validate_script_name(self, script_name: str) -> None:
        """验证脚本名称，防止路径穿越攻击

        Args:
            script_name: 脚本名称

        Raises:
            SkillExecutionError: 如果脚本名称包含非法字符或路径穿越尝试
        """
        if not script_name:
            raise SkillExecutionError("Script name cannot be empty")

        # 拒绝绝对路径
        if script_name.startswith('/') or (len(script_name) > 1 and script_name[1] == ':'):
            raise SkillExecutionError(
                f"Absolute paths are not allowed: {script_name}"
            )

        # 在 Path 规范化之前检查原始字符串中的危险模式
        # Path() 会自动规范化路径，所以需要在此之前检查
        if script_name.startswith('./') or script_name.startswith('.\\'):
            raise SkillExecutionError(
                f"Current directory marker not allowed in script name: {script_name}"
            )

        # 检查是否包含 ../ 或 ..\（路径穿越）
        if '/..' in script_name or '\\..' in script_name or script_name.startswith('..'):
            raise SkillExecutionError(
                f"Path traversal not allowed in script name: {script_name}"
            )

        # 拆分路径组件并验证每个部分
        path_parts = Path(script_name).parts

        for part in path_parts:
            # 再次检查路径穿越（双重保险）
            if part == '..':
                raise SkillExecutionError(
                    f"Path traversal not allowed in script name: {script_name}"
                )
            # 检查当前目录标记
            if part == '.':
                raise SkillExecutionError(
                    f"Current directory marker not allowed in script name: {script_name}"
                )
            # 拒绝空组件（如 "a//b"）
            if not part:
                raise SkillExecutionError(
                    f"Empty path component in script name: {script_name}"
                )

        # 限制路径深度（最多支持一层子目录，如 "utils/helper.py"）
        if len(path_parts) > 2:
            raise SkillExecutionError(
                f"Script name too deep (max 1 subdirectory allowed): {script_name}"
            )

    def _execute_python(self, script_path: Path, **kwargs) -> Any:
        """执行 Python 脚本

        Args:
            script_path: 脚本路径
            **kwargs: 传递给脚本的参数

        Returns:
            脚本执行结果

        Raises:
            SkillExecutionError: 执行失败
        """
        # 将参数转换为 JSON 字符串
        args_json = json.dumps(kwargs)

        # 执行脚本（带超时）
        # 注意：cwd 设置为脚本所在目录，这样脚本可以访问相对路径的资源
        try:
            result = subprocess.run(
                [sys.executable, script_path.name, args_json],
                capture_output=True,
                text=True,
                cwd=script_path.parent,
                timeout=self.timeout
            )
        except subprocess.TimeoutExpired:
            raise SkillExecutionError(
                f"Script execution timeout after {self.timeout}s"
            )

        if result.returncode != 0:
            raise SkillExecutionError(
                f"Script execution failed (exit code {result.returncode}): {result.stderr}"
            )

        # 尝试解析 JSON 输出
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            return result.stdout

    def _execute_node(self, script_path: Path, **kwargs) -> Any:
        """执行 Node.js 脚本

        Args:
            script_path: 脚本路径
            **kwargs: 传递给脚本的参数

        Returns:
            脚本执行结果

        Raises:
            SkillExecutionError: 执行失败
        """
        args_json = json.dumps(kwargs)

        try:
            result = subprocess.run(
                ["node", script_path.name, args_json],
                capture_output=True,
                text=True,
                cwd=script_path.parent,
                timeout=self.timeout
            )
        except subprocess.TimeoutExpired:
            raise SkillExecutionError(
                f"Script execution timeout after {self.timeout}s"
            )
        except FileNotFoundError:
            raise SkillExecutionError("Node.js not found in PATH")

        if result.returncode != 0:
            raise SkillExecutionError(
                f"Script execution failed (exit code {result.returncode}): {result.stderr}"
            )

        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            return result.stdout

    def _execute_shell(self, script_path: Path, **kwargs) -> Any:
        """执行 Shell 脚本

        Args:
            script_path: 脚本路径
            **kwargs: 传递给脚本的参数（通过环境变量）

        Returns:
            脚本执行结果

        Raises:
            SkillExecutionError: 执行失败
        """
        # Shell 脚本通过环境变量传递参数
        env = os.environ.copy()
        for key, value in kwargs.items():
            env[f"SKILL_ARG_{key.upper()}"] = str(value)

        try:
            result = subprocess.run(
                ["bash", script_path.name],
                capture_output=True,
                text=True,
                cwd=script_path.parent,
                env=env,
                timeout=self.timeout
            )
        except subprocess.TimeoutExpired:
            raise SkillExecutionError(
                f"Script execution timeout after {self.timeout}s"
            )
        except FileNotFoundError:
            raise SkillExecutionError("Bash not found in PATH")

        if result.returncode != 0:
            raise SkillExecutionError(
                f"Script execution failed (exit code {result.returncode}): {result.stderr}"
            )

        return result.stdout

    def _execute_in_main_process(self, script_path: Path, **kwargs) -> Any:
        """在主进程中执行 Python 脚本

        Args:
            script_path: 脚本路径
            **kwargs: 传递给脚本的参数

        Returns:
            脚本的标准输出（纯文本）

        Raises:
            SkillExecutionError: 执行失败
        """
        # 构造参数列表（转换为命令行参数格式）
        args = [str(script_path)]
        for key, value in kwargs.items():
            # 将 snake_case 转换为 kebab-case
            arg_name = key.replace('_', '-')
            args.append(f"--{arg_name}")
            args.append(str(value))

        # 保存原始 sys.argv 和 stdout
        old_argv = sys.argv
        old_stdout = sys.stdout

        try:
            # 设置 sys.argv
            sys.argv = args

            # 捕获输出
            output_buffer = io.StringIO()

            with redirect_stdout(output_buffer):
                # 读取脚本内容
                with open(script_path, 'r', encoding='utf-8') as f:
                    script_code = f.read()

                # 创建脚本执行环境
                script_globals = {
                    '__name__': '__main__',
                    '__file__': str(script_path),
                }

                # 执行脚本
                exec(script_code, script_globals)

            # 返回纯文本输出
            return output_buffer.getvalue()

        except Exception as e:
            # 捕获并包装异常
            logger.error(f"主进程执行脚本失败: {script_path}, 错误: {e}")
            raise SkillExecutionError(f"主进程执行脚本失败: {str(e)}")

        finally:
            # 恢复原始 sys.argv 和 stdout
            sys.argv = old_argv
            sys.stdout = old_stdout
