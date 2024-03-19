# -*- coding: utf-8 -*-
"""
回滚相关异常模块

这个模块定义了文件回滚操作相关的所有异常类型。
"""

from .business import BusinessException


class RollbackException(BusinessException):
    """回滚操作异常基类"""

    def __init__(self, code: int, message: str):
        super().__init__(code, message)
