from pathlib import Path
from typing import Optional, TypeVar, Tuple

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.paths import PathManager
from app.tools.core.base_tool import BaseTool
from app.tools.core.base_tool_params import BaseToolParams
from app.utils.file_path_fuzzy_matcher import FilePathFuzzyMatcher

logger = get_logger(__name__)

# 定义参数类型变量
T = TypeVar('T', bound=BaseToolParams)


class WorkspaceGuardTool(BaseTool[T]):
    """
    文件操作工具基类，提供工作目录限制和相关安全功能

    所有需要访问文件系统的工具都应继承此类，以便统一处理工作目录限制
    """

    # 默认使用workspace目录作为基础目录
    base_dir: Path = PathManager.get_workspace_dir()

    def __init__(self, **data):
        """
        初始化文件操作工具

        Args:
            **data: 其他参数传递给父类
        """
        super().__init__(**data)
        if 'base_dir' in data:
            self.base_dir = Path(data['base_dir'])

    def get_safe_path(self, filepath: str) -> tuple[Path, Optional[str]]:
        """
        获取安全的文件路径，确保其在工作目录内

        Args:
            filepath: 文件路径字符串

        Returns:
            tuple: (安全的文件路径对象, 错误信息)
                如果路径安全，错误信息为空字符串
                如果路径不安全，返回None和对应的错误信息
        """
        # 处理文件路径
        file_path = Path(filepath)

        # 如果是相对路径，则相对于base_dir
        if not file_path.is_absolute():
            file_path = self.base_dir / file_path

        # 检查文件是否在base_dir内
        try:
            file_path.relative_to(self.base_dir)
            return file_path, ""
        except ValueError:
            error_msg = f"安全限制：不允许访问工作目录({self.base_dir})外的文件: {file_path}"
            logger.warning(error_msg)
            return None, error_msg

    def get_safe_path_with_fuzzy_match(self, file_path_str: str) -> Tuple[Optional[Path], Optional[str], Optional[str]]:
        """
        获取安全路径，并在必要时进行模糊匹配

        逻辑：
        1. 调用 get_safe_path 进行安全检查（工作区限制等）
        2. 如果文件不存在，尝试通过模糊匹配查找（处理中英文标点符号差异）
        3. 返回文件路径、错误信息和警告信息

        Args:
            file_path_str: 文件路径字符串

        Returns:
            Tuple[Optional[Path], Optional[str], Optional[str]]:
            (文件路径, 错误信息, 警告信息)
            - 错误信息不为空时，文件路径为 None，不应继续处理
            - 警告信息不为空时，表示使用了模糊匹配，应告知 AI
        """
        # 1. 先进行安全检查
        file_path, error = self.get_safe_path(file_path_str)
        if error:
            return None, error, None

        # 2. 如果文件不存在，尝试模糊匹配
        fuzzy_warning = None
        if not file_path.exists():
            fuzzy_result = FilePathFuzzyMatcher.try_find_fuzzy_match(file_path, self.base_dir)
            if fuzzy_result:
                file_path, fuzzy_warning = fuzzy_result
                logger.info(f"通过模糊匹配找到文件: {file_path.name}")

        return file_path, None, fuzzy_warning

    async def execute(self, tool_context: ToolContext, params: T) -> ToolResult:
        """
        默认执行方法，子类应该重写此方法

        Args:
            tool_context: 工具上下文
            params: 工具参数

        Returns:
            ToolResult: 工具执行结果
        """
        raise NotImplementedError("子类必须实现execute方法")
