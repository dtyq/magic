"""Shell命令语法处理器

提供 @shell 语法，用于执行shell命令。

支持的参数：
- command: 要执行的命令（必需）
- timeout: 超时时间（秒），默认30

使用示例：
- @shell("ls -la")
- @shell("echo hello", timeout=10)
- @shell(command="ls -la", timeout=10)
"""

import subprocess
from typing import List, Optional
from pathlib import Path

from agentlang.logger import get_logger

from .base import BaseSyntaxProcessor

logger = get_logger(__name__)


class ShellProcessor(BaseSyntaxProcessor):
    """@shell 语法处理器

    用于执行shell命令。
    """

    def __init__(self, agents_dir: Optional[Path] = None):
        """初始化shell处理器

        Args:
            agents_dir: Agent文件目录，用于解析相对路径
        """
        super().__init__(agents_dir)

    def get_positional_param_mapping(self) -> List[str]:
        """返回位置参数映射：第一个参数对应command，第二个对应timeout"""
        return ["command", "timeout"]

    def get_required_params(self) -> List[str]:
        """返回必需参数列表"""
        return ["command"]

    def get_optional_params(self) -> List[str]:
        """返回可选参数列表"""
        return ["timeout"]

    def _run(self) -> str:
        """处理shell命令语法

        Returns:
            str: 命令执行结果

        Raises:
            ValueError: 命令执行失败
        """
        try:
            # 获取参数 - 无需手动验证，基类已完成
            command = self._get_parameter("command")
            timeout_str = self._get_parameter("timeout", "30")

            # 解析超时时间
            try:
                timeout = float(timeout_str)
            except (ValueError, TypeError):
                logger.warning(f"无效的超时参数 '{timeout_str}'，使用默认值30秒")
                timeout = 30.0

            logger.debug(f"执行Shell命令: {command}")
            logger.debug(f"超时设置: {timeout}秒")

            # 执行命令
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
                encoding='utf-8',
                errors='replace'
            )

            # 检查执行结果
            if result.returncode != 0:
                error_msg = f"Shell命令执行失败: {result.stderr.strip()}"
                logger.error(error_msg)
                raise ValueError(error_msg)

            # 返回输出结果，去除末尾的换行符
            output = result.stdout.strip()
            logger.debug(f"Shell命令执行成功，输出: {output[:100]}{'...' if len(output) > 100 else ''}")
            return output

        except subprocess.TimeoutExpired:
            error_msg = f"Shell命令执行超时 ({timeout}秒): {command}"
            logger.error(error_msg)
            raise ValueError(error_msg)
        except subprocess.SubprocessError as e:
            error_msg = f"Shell命令执行异常: {str(e)}"
            logger.error(error_msg)
            raise ValueError(error_msg)
        except OSError as e:
            error_msg = f"Shell命令执行异常: {str(e)}"
            logger.error(error_msg)
            raise ValueError(error_msg)
        except Exception as e:
            if isinstance(e, ValueError):
                raise
            error_msg = f"执行Shell命令失败: {e}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e

    def get_syntax_name(self) -> str:
        """返回语法名称"""
        return "shell"
