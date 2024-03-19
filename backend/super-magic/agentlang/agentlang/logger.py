import logging
import sys
from typing import Optional, Dict, Any, ClassVar
from pathlib import Path

from loguru import logger as _logger
from agentlang.context.application_context import ApplicationContext


class Logger:
    """
    SuperMagic日志记录器，基于loguru实现
    提供统一的日志格式和级别控制
    """
    # 类变量，保存实例
    _instance: ClassVar['Logger'] = None

    def __init__(self, name: str = "agentlang"):
        """
        初始化日志记录器

        Args:
            name: 日志记录器名称
        """
        self.name = name
        self.logger = _logger.bind(name=name)

    @classmethod
    def setup(cls,
              log_name: str = "agentlang",
              console_level: str = "INFO",
              logfile_level: Optional[str] = "DEBUG",
              log_file: Optional[str] = None) -> 'Logger':
        """
        设置并返回日志记录器实例

        Args:
            log_name: 日志文件名
            console_level: 控制台日志级别
            logfile_level: 文件日志级别，如果为 None 则不记录到文件
            log_file: 日志文件路径，如果为 None，则使用默认路径

        Returns:
            配置好的 LoguruLogger 实例
        """
        # 创建或获取实例
        if cls._instance is None:
            cls._instance = cls(log_name)

        logger_instance = cls._instance

        # 移除所有默认处理器
        _logger.remove()

        # 添加控制台处理器，并配置 DEBUG 级别为灰色
        _logger.configure(
            handlers=[
                {
                    "sink": sys.stderr,
                    "level": console_level,
                    "format": "<green>{time:HH:mm:ss.SSS}</green> | "
                    "<level>{level: <8}</level> | "
                    "<cyan>{file.path}</cyan>:<cyan>{line}</cyan> - "
                    "<level>{message}</level>",
                    "colorize": True,
                }
            ],
            levels=[
                {"name": "DEBUG", "color": "<dim>"}  # 使用 dim 样式（灰色）代替默认的蓝色
            ],
        )

        # 如果指定了文件日志级别，添加文件处理器
        if logfile_level:
            if log_file:
                file_path = Path(log_file)
            else:
                path_manager = ApplicationContext.get_path_manager()
                log_dir = path_manager.get_logs_dir() if path_manager else Path("logs")
                file_path = log_dir / f"{log_name}.log"

            # 确保日志目录存在
            file_path.parent.mkdir(parents=True, exist_ok=True)

            _logger.add(
                file_path,
                level=logfile_level,
                format="{time:HH:mm:ss.SSS} | {level: <8} | {file.path}:{line} - {message}",
            )

        # 设置到ApplicationContext
        ApplicationContext.set_logger(logger_instance)

        return logger_instance

    def bind(self, **kwargs) -> 'Logger':
        """
        创建一个带有绑定上下文的日志记录器

        Args:
            **kwargs: 要绑定的关键字参数，如name=模块名

        Returns:
            一个新的日志记录器实例，具有相同的处理器但携带不同的上下文
        """
        new_logger = Logger()
        new_logger.logger = self.logger.bind(**kwargs)
        if 'name' in kwargs:
            new_logger.name = kwargs['name']
        return new_logger

    # 转发所有日志方法到内部的loguru实例
    def debug(self, message, *args, **kwargs):
        return self.logger.opt(depth=1).debug(message, *args, **kwargs)

    def info(self, message, *args, **kwargs):
        return self.logger.opt(depth=1).info(message, *args, **kwargs)

    def warning(self, message, *args, **kwargs):
        return self.logger.opt(depth=1).warning(message, *args, **kwargs)

    def error(self, message, *args, **kwargs):
        return self.logger.opt(depth=1).error(message, *args, **kwargs)

    def critical(self, message, *args, **kwargs):
        return self.logger.opt(depth=1).critical(message, *args, **kwargs)

    def exception(self, message, *args, **kwargs):
        return self.logger.opt(depth=1).exception(message, *args, **kwargs)

    # 允许像loguru一样使用opt
    def opt(self, *args, **kwargs):
        return self.logger.opt(*args, **kwargs)


# 导出默认实例
logger = Logger.setup()


def setup_logger(log_name: str = "agentlang", console_level: str = "INFO",
                logfile_level: Optional[str] = "DEBUG", log_file: Optional[str] = None) -> Logger:
    """
    设置日志记录器

    Args:
        log_name: 日志文件名
        console_level: 控制台日志级别
        logfile_level: 文件日志级别，如果为 None 则不记录到文件
        log_file: 日志文件路径，如果为 None，则使用默认路径
    """
    return Logger.setup(log_name, console_level, logfile_level, log_file)


def get_logger(name: str = None) -> Logger:
    """
    获取命名的日志记录器

    Args:
        name: 日志记录器名称，通常是模块名

    Returns:
        日志记录器实例
    """
    if name:
        return logger.bind(name=name)
    return logger


# 添加 logging 到 LoguruLogger 的拦截器
class InterceptHandler(logging.Handler):
    """
    将标准库 logging 消息拦截并重定向到 LoguruLogger 的处理器

    这确保使用标准 logging 模块的代码最终也使用统一的输出格式
    """

    def emit(self, record):
        # 获取对应的 loguru 级别
        try:
            level = logger.logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # 查找调用者帧记录 - 修复帧检测逻辑
        frame = logging.currentframe()
        depth = 0

        # Skip frames from logging module and this InterceptHandler
        while frame:
            filename = frame.f_code.co_filename
            # Skip logging module frames and this InterceptHandler frame
            if (filename.endswith(('/logging/__init__.py', '/logging.py')) or
                'InterceptHandler' in frame.f_code.co_name or
                filename == __file__):
                frame = frame.f_back
                depth += 1
            else:
                # Found the actual caller, break
                break

        # Add extra depth to account for the loguru call chain
        # Typically need depth=1 to skip the immediate call to loguru
        depth = max(1, depth - 1)

        # 使用 loguru 记录消息
        logger.logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def configure_logging_intercept():
    """
    配置标准库 logging 拦截

    这应该在项目启动时调用一次，以确保所有使用标准库 logging 的代码
    都会被正确地重定向到 LoguruLogger
    """
    # 删除所有其他处理器
    logging.basicConfig(handlers=[InterceptHandler()], level=0)

    # 替换所有已存在的处理器
    for name in logging.root.manager.loggerDict.keys():
        logging.getLogger(name).handlers = []
        logging.getLogger(name).propagate = True
