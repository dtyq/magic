"""Base mention handler"""
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, List, Any
from agentlang.logger import get_logger

logger = get_logger(__name__)


class BaseMentionHandler(ABC):
    """Mention处理器基类"""

    @abstractmethod
    def get_type(self) -> str:
        """获取处理器类型

        Returns:
            str: 处理器类型标识
        """
        pass

    @abstractmethod
    async def handle(self, mention: Dict[str, Any], index: int) -> List[str]:
        """处理mention，返回格式化的上下文行（异步）

        Args:
            mention: mention数据
            index: mention序号（从1开始）

        Returns:
            List[str]: 格式化的上下文行列表
        """
        pass

    @abstractmethod
    async def get_tip(self, mention: Dict[str, Any]) -> str:
        """获取该mention的提示文本（异步）

        Args:
            mention: mention数据

        Returns:
            str: 提示文本，如果不需要提示则返回空字符串
        """
        pass

    @staticmethod
    def normalize_path(file_path: str) -> str:
        """标准化文件路径：将绝对路径转换为相对路径

        Args:
            file_path: 原始文件路径

        Returns:
            str: 标准化后的路径
        """
        try:
            if file_path:
                path_obj = Path(file_path)
                # 如果路径是绝对路径且以 '/' 开头，转换为相对路径
                if path_obj.is_absolute() and str(path_obj).startswith('/'):
                    # 移除开头的斜杠并标准化
                    relative_path = str(path_obj).lstrip('/')
                    return str(Path(relative_path).as_posix())
                else:
                    return str(path_obj.as_posix())
        except Exception as e:
            logger.warning(f"处理文件路径时出错: {e}, 使用原始路径: {file_path}")
        return file_path
