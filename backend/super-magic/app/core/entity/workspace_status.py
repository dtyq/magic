from enum import IntEnum
from typing import Dict


class WorkspaceStatus(IntEnum):
    """
    工作区状态枚举

    定义工作区的各种状态，使用int值便于API传输和存储
    """
    NOT_INITIALIZED = 0    # 未初始化
    INITIALIZING = 1       # 正在初始化
    INITIALIZED = 2        # 初始化完成
    ERROR = -1            # 初始化错误

    @classmethod
    def get_description(cls, status: int) -> str:
        """
        获取状态描述信息

        Args:
            status: 状态码

        Returns:
            str: 状态描述
        """
        descriptions: Dict[int, str] = {
            cls.NOT_INITIALIZED: "未初始化",
            cls.INITIALIZING: "正在初始化",
            cls.INITIALIZED: "初始化完成",
            cls.ERROR: "初始化错误"
        }
        return descriptions.get(status, "未知状态")

    @classmethod
    def from_boolean(cls, is_initialized: bool) -> int:
        """
        从布尔值转换为状态码

        Args:
            is_initialized: 初始化状态布尔值

        Returns:
            int: 对应的状态码
        """
        return cls.INITIALIZED if is_initialized else cls.NOT_INITIALIZED

    @classmethod
    def get_all_statuses(cls) -> Dict[int, str]:
        """
        获取所有状态码和描述的映射

        Returns:
            Dict[int, str]: 状态码到描述的映射
        """
        return {
            cls.NOT_INITIALIZED: cls.get_description(cls.NOT_INITIALIZED),
            cls.INITIALIZING: cls.get_description(cls.INITIALIZING),
            cls.INITIALIZED: cls.get_description(cls.INITIALIZED),
            cls.ERROR: cls.get_description(cls.ERROR)
        }
