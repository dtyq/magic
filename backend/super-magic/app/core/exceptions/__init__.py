# -*- coding: utf-8 -*-
"""
统一异常模块

这个模块提供了应用程序中所有异常类的统一访问入口。
"""

# 业务异常基类
from .business import BusinessException, ErrorCode

# 回滚相关异常
from .rollback import RollbackException

# 异常分类导出
__all__ = [
    # 基础异常类
    "BusinessException",
    "ErrorCode",

    # 回滚相关异常
    "RollbackException",
]
