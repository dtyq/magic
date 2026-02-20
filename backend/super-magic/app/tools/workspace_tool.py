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

T = TypeVar('T', bound=BaseToolParams)


class WorkspaceTool(BaseTool[T]):
    """
    文件类工具基类，提供路径解析和模糊匹配功能。

    - 相对路径：解析到 base_dir（默认为 .workspace）
    - 绝对路径：直接使用，可访问 VM 任意位置
    """

    # 相对路径的锚定目录，默认为 .workspace
    base_dir: Path = PathManager.get_workspace_dir()

    def __init__(self, **data):
        super().__init__(**data)
        if 'base_dir' in data:
            self.base_dir = Path(data['base_dir'])

    def resolve_path(self, filepath: str) -> Path:
        """相对路径解析到 workspace，绝对路径直接使用。"""
        p = Path(filepath)
        return p if p.is_absolute() else self.base_dir / p

    def resolve_path_fuzzy(self, file_path_str: str) -> tuple[Path, Optional[str]]:
        """
        解析路径，若文件不存在则尝试模糊匹配（处理中英文标点差异）。

        Returns:
            (path, warning) — warning 非 None 时表示使用了模糊匹配，应告知模型。
        """
        file_path = self.resolve_path(file_path_str)

        fuzzy_warning = None
        if not file_path.exists():
            fuzzy_result = FilePathFuzzyMatcher.try_find_fuzzy_match(file_path, self.base_dir)
            if fuzzy_result:
                file_path, fuzzy_warning = fuzzy_result
                logger.info(f"通过模糊匹配找到文件: {file_path.name}")

        return file_path, fuzzy_warning

    async def execute(self, tool_context: ToolContext, params: T) -> ToolResult:
        raise NotImplementedError("子类必须实现 execute 方法")
