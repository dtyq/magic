"""
Magic Service 相关常量定义

包含 Magic Service 交互中使用的常量定义。
"""

from enum import IntEnum


class FileEditType(IntEnum):
    """文件编辑类型枚举"""

    MANUAL = 1  # 人工编辑
    AI = 2      # AI编辑
