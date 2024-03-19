"""
日志工具模块
"""
import logging
import os
import sys
from typing import Optional


def setup_logging(
    log_level: str = "INFO",
    log_file: Optional[str] = None,
    logger_name: str = "sandbox_gateway"
) -> logging.Logger:
    """
    配置应用日志
    
    Args:
        log_level: 日志级别
        log_file: 日志文件路径
        logger_name: 日志记录器名称
        
    Returns:
        配置好的日志记录器
    """
    # 转换日志级别字符串为对应的常量
    numeric_level = getattr(logging, log_level.upper(), None)
    if not isinstance(numeric_level, int):
        raise ValueError(f"无效的日志级别: {log_level}")
    
    # 创建日志记录器
    logger = logging.getLogger(logger_name)
    logger.setLevel(numeric_level)
    
    # 清除现有的处理器
    if logger.handlers:
        logger.handlers.clear()
    
    # 创建格式化器
    formatter = logging.Formatter(
        '%(asctime)s | %(levelname)-8s | %(name)s:%(filename)s:%(lineno)d - %(message)s'
    )
    
    # 添加控制台处理器
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # 如果指定了日志文件，添加文件处理器
    if log_file:
        # 确保日志目录存在
        log_dir = os.path.dirname(log_file)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir)
        
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger 