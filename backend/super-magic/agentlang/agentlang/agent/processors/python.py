import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Dict, List

from agentlang.logger import get_logger

from .base import BaseSyntaxProcessor

logger = get_logger(__name__)


class PythonProcessor(BaseSyntaxProcessor):
    """@python 语法处理器

    用于执行 Python 代码。
    支持语法格式：
    - {{ @python("print('hello')") }}  # 位置参数
    - {{ @python(code="print('hello')") }}  # 键值对参数
    - {{ @python("print('hello')", timeout=10) }}  # 带超时的位置参数
    - {{ @python(code="print('hello')", timeout=10) }}  # 带超时的键值对参数
    """

    def get_positional_param_mapping(self) -> List[str]:
        """返回位置参数映射：第一个参数对应code，第二个对应timeout"""
        return ["code", "timeout"]

    def get_required_params(self) -> List[str]:
        """返回必需参数列表"""
        return ["code"]

    def get_optional_params(self) -> List[str]:
        """返回可选参数列表"""
        return ["timeout"]

    def _run(self) -> str:
        """执行Python代码

        Returns:
            str: Python代码的执行结果输出

        Raises:
            ValueError: 当执行失败时
        """
        # 获取参数 - 无需手动验证，基类已经完成验证
        python_code = self._get_parameter("code")
        timeout_str = self._get_parameter("timeout", "30")

        # 解析超时时间
        try:
            timeout = float(timeout_str)
        except (ValueError, TypeError):
            logger.warning(f"无效的超时参数 '{timeout_str}'，使用默认值30秒")
            timeout = 30.0

        logger.debug(f"执行Python代码: {python_code[:100]}{'...' if len(python_code) > 100 else ''}")
        logger.debug(f"超时设置: {timeout}秒")

        try:
            # 创建临时文件来执行Python代码
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as temp_file:
                temp_file.write(python_code)
                temp_file_path = temp_file.name

            try:
                # 执行Python脚本
                result = subprocess.run(
                    [sys.executable, temp_file_path],
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    encoding='utf-8',
                    errors='replace'
                )

                # 检查执行结果
                if result.returncode != 0:
                    error_msg = f"Python代码执行失败: {result.stderr.strip()}"
                    logger.error(error_msg)
                    raise ValueError(error_msg)

                # 返回输出结果，去除末尾的换行符
                output = result.stdout.strip()
                logger.debug(f"Python代码执行成功，输出: {output[:100]}{'...' if len(output) > 100 else ''}")
                return output

            finally:
                # 清理临时文件
                try:
                    Path(temp_file_path).unlink()
                except OSError:
                    pass  # 忽略清理失败

        except subprocess.TimeoutExpired:
            error_msg = f"Python代码执行超时 ({timeout}秒)"
            logger.error(error_msg)
            raise ValueError(error_msg)
        except subprocess.SubprocessError as e:
            error_msg = f"Python代码执行异常: {str(e)}"
            logger.error(error_msg)
            raise ValueError(error_msg)
        except Exception as e:
            error_msg = f"执行Python代码时发生错误: {str(e)}"
            logger.error(error_msg)
            raise ValueError(error_msg)
