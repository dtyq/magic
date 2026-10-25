# -*- coding: utf-8 -*-
"""
业务异常基类模块

这个模块定义了业务异常的基类。
业务异常用于表示应用程序业务逻辑中的预期错误情况。
"""

class ErrorCode:
    """错误码常量"""
    GENERAL_ERROR = 2000

    CHECKPOINT_NOT_FOUND = 2001
    ROLLBACK_EXECUTION_FAILED = 2002
    ROLLBACK_GENERAL_ERROR = 2003

    NOT_FOUND = 4004

    # user_tool_call 的 pending 问题不存在（已超时被消费或重复提交）
    USER_TOOL_CALL_NOT_FOUND = 4100

    # 环境正在空闲退出，问题仍有效；调用方应保留回答并走恢复／重试提示。
    USER_TOOL_CALL_ENVIRONMENT_CLOSING = 4101


class BusinessException(Exception):
    """
    业务异常基类

    所有业务相关的异常都应该继承这个类。
    业务异常表示应用程序可以预期和处理的错误情况。
    """

    def __init__(self, code: int, message: str):
        """
        初始化业务异常

        Args:
            code: 错误代码，用于程序化处理
            message: 异常消息
        """
        super().__init__(message)
        self.code = code
        self.message = message

    def __str__(self) -> str:
        """返回异常的字符串表示"""
        return f"{self.code}: {self.message}"
