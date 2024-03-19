"""Interface for driver selector implementations."""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Union, List, Optional, Dict, Any

from ...driver.interfaces.file_parser_driver_interface import FileParserDriverInterface


class DriverSelectorInterface(ABC):
    """驱动选择器接口

    定义驱动选择器的标准接口，用于根据文件特征智能选择最优驱动器。
    """

    @abstractmethod
    async def select_driver(
        self,
        file_path: Union[str, Path],
        available_drivers: List[FileParserDriverInterface],
        force_driver_type: Optional[str] = None,
        **kwargs
    ) -> List[FileParserDriverInterface]:
        """根据文件特征选择最优驱动器

        Args:
            file_path: 文件路径
            available_drivers: 可用的驱动器列表
            force_driver_type: 强制使用的驱动器类型（可选）
            **kwargs: 其他选择参数

        Returns:
            List[FileParserDriverInterface]: 按优先级排序的驱动器列表
        """
        pass

    @abstractmethod
    async def analyze_file(self, file_path: Path) -> Optional[Dict[str, Any]]:
        """分析文件特征

        Args:
            file_path: 文件路径

        Returns:
            Optional[Dict[str, Any]]: 文件特征字典，失败返回 None
        """
        pass

    @abstractmethod
    def determine_optimal_driver_type(
        self,
        file_info: Dict[str, Any],
        **kwargs
    ) -> str:
        """根据文件特征确定最优驱动器类型

        Args:
            file_info: 文件特征字典
            **kwargs: 其他决策参数

        Returns:
            str: 最优驱动器类型标识
        """
        pass
