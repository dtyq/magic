"""包含文件语法处理器

提供 @include 语法，用于包含外部文件内容。

支持的参数：
- path: 文件路径（必需）
- extension: 文件扩展名，默认为 .prompt（可选）

使用示例：
- @include("./prompt.md")
- @include(path="./prompt.md")
- @include(path="./prompt", extension=".md")
- @include("./prompt", ".yaml")
"""

from pathlib import Path
from typing import List, Optional

from agentlang.logger import get_logger

from .base import BaseSyntaxProcessor

logger = get_logger(__name__)


class IncludeProcessor(BaseSyntaxProcessor):
    """@include 语法处理器

    用于包含外部文件的内容。
    支持相对路径和绝对路径。
    支持递归处理包含文件中的动态语法。
    """

    def __init__(self, agents_dir: Optional[Path] = None):
        """初始化包含文件处理器

        Args:
            agents_dir: Agent文件目录，用于解析相对路径
        """
        super().__init__(agents_dir)
        self._current_file: Optional[Path] = None

    def set_current_file(self, current_file: Optional[Path]):
        """设置当前处理的文件路径，用于循环引用检测

        Args:
            current_file: 当前文件路径
        """
        self._current_file = current_file

    def get_positional_param_mapping(self) -> List[str]:
        """返回位置参数映射：第一个参数对应path，第二个参数对应extension"""
        return ["path", "extension"]

    def get_required_params(self) -> List[str]:
        """返回必需参数列表"""
        return ["path"]

    def get_optional_params(self) -> List[str]:
        """返回可选参数列表"""
        return ["extension"]

    def _run(self) -> str:
        """处理包含文件语法

        Returns:
            str: 包含文件的内容

        Raises:
            ValueError: 缺少必需参数
            FileNotFoundError: 文件不存在
            IOError: 文件读取失败
        """
        try:
            # 获取文件路径 - 无需手动验证，基类已完成
            file_path = self._get_parameter("path")

            # 获取扩展名，默认为 .prompt
            extension = self._get_parameter("extension", default=".prompt")

            # 如果路径没有扩展名且extension不为空，则追加扩展名
            if extension and not Path(file_path).suffix:
                file_path = file_path + extension

            # 解析文件路径
            resolved_path = self.resolve_path(file_path)

            logger.debug(f"包含文件: {resolved_path}")

            # 检查文件是否存在
            if not resolved_path.exists():
                raise FileNotFoundError(f"包含文件不存在: {resolved_path}")

            # 读取文件内容
            try:
                with open(resolved_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                logger.debug(f"成功读取包含文件，内容长度: {len(content)} 字符")

                # 递归处理文件内容中的动态语法
                if self._process_dynamic_syntax_func:
                    logger.debug(f"递归处理包含文件中的动态语法: {resolved_path}")
                    content = self._process_dynamic_syntax_func(content, resolved_path)
                    logger.debug(f"递归处理完成，处理后内容长度: {len(content)} 字符")

                # 移除内容末尾的空行，避免 include 后产生多余的空行
                # 只移除末尾的换行符，保留其他空白字符
                return content.rstrip('\n')

            except Exception as e:
                raise IOError(f"读取包含文件失败: {resolved_path} - {e}")

        except Exception as e:
            if isinstance(e, (ValueError, FileNotFoundError, IOError)):
                raise
            error_msg = f"处理包含文件失败: {e}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e

    def get_syntax_name(self) -> str:
        """返回语法名称"""
        return "include"
