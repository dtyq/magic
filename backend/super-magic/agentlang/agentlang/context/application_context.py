from logging import Logger
from typing import ClassVar
from agentlang.path_manager import PathManager


class ApplicationContext:

    _logger: ClassVar[Logger] = None
    _path_manager: ClassVar[PathManager] = None

    @classmethod
    def set_logger(cls, logger: Logger):
        cls._logger = logger

    @classmethod
    def get_logger(cls) -> Logger:
        return cls._logger

    @classmethod
    def set_path_manager(cls, path_manager: PathManager):
        cls._path_manager = path_manager

    @classmethod
    def get_path_manager(cls) -> PathManager:
        """获取路径管理器

        如果已通过 set_path_manager 设置，则返回设置的实例（通常是应用层的 PathManager）
        如果未设置，则返回基础框架层的 PathManager（会自动初始化）
        这样既保持了原有的设计，又确保在测试环境中能正常工作
        """
        if cls._path_manager is not None:
            return cls._path_manager

        # 如果没有显式设置，返回基础框架层的 PathManager
        return PathManager
