from pathlib import Path
from typing import Optional, TypeVar

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
    文件操作工具基类，提供路径解析和模糊匹配功能

    所有需要访问文件系统的工具都应继承此类，以统一处理路径解析
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

    def get_safe_path(self, filepath: str) -> tuple[Path, str]:
        """
        路径解析：相对路径解析到 workspace，绝对路径直接放行访问全 VM。
        """
        file_path = Path(filepath)

        if not file_path.is_absolute():
            # 相对路径始终锚定到 workspace
            file_path = self.base_dir / file_path

        return file_path, ""

    def get_safe_path_with_fuzzy_match(self, file_path_str: str) -> tuple[Optional[Path], Optional[str], Optional[str]]:
        """
        获取解析后的路径，并在必要时进行模糊匹配

        逻辑：
        1. 调用 get_safe_path 解析路径（相对→workspace，绝对→直接使用）
        2. 如果文件不存在，尝试通过模糊匹配查找（处理中英文标点符号差异）
        3. 返回文件路径、错误信息和警告信息

        Args:
            file_path_str: 文件路径字符串

        Returns:
            tuple[Optional[Path], Optional[str], Optional[str]]:
            (文件路径, 错误信息, 警告信息)
            - 错误信息不为空时，文件路径为 None，不应继续处理
            - 警告信息不为空时，表示使用了模糊匹配，应告知 AI
        """
        # 1. 解析路径（相对→workspace，绝对→直接使用）
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
