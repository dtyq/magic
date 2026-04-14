"""
异常定义模块

本模块包含所有 agentlang 包使用的异常类定义，
提供了统一的异常处理接口和用户友好的消息展示机制。
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Type, TypeVar
import json

_E = TypeVar("_E", bound=Exception)

class UserFriendlyException(Exception, ABC):
    """用户友好异常接口类
    
    定义了可以向用户展示友好错误消息的异常接口。
    继承此类的异常应实现 get_user_friendly_message 方法，
    以提供适合直接展示给最终用户的错误消息。
    """
    
    def __init__(self, message: str = "", **kwargs: Any):
        """初始化异常
        
        Args:
            message: 异常消息
            **kwargs: 其他异常相关参数
        """
        self.message = message
        self.extra_data: Dict[str, Any] = kwargs
        super().__init__(message)
    
    @abstractmethod
    def get_user_friendly_message(self) -> str:
        """获取适合向用户展示的友好错误消息
        
        返回一个经过格式化、便于理解的错误消息，
        该消息可以直接展示给最终用户，无需技术背景也能理解。
        
        Returns:
            str: 格式化后的用户友好消息
        """
        pass


class StreamChunkTimeoutError(Exception):
    """流式响应 chunk 间隔超时。

    与 asyncio.TimeoutError 区分开，避免被外层 asyncio.wait_for 兜底超时误捕。
    携带实际耗时和已处理 chunk 数，确保日志和错误信息始终真实。
    """

    def __init__(self, *, chunk_count: int, chunk_timeout_seconds: float, total_elapsed_seconds: float):
        self.chunk_count = chunk_count
        self.chunk_timeout_seconds = chunk_timeout_seconds
        self.total_elapsed_seconds = total_elapsed_seconds
        super().__init__(
            f"Chunk timeout: no data received for {chunk_timeout_seconds:.0f}s "
            f"after processing {chunk_count} chunks "
            f"(total elapsed: {total_elapsed_seconds:.1f}s)"
        )


class StreamInterruptedError(Exception):
    """流式响应被外部中断：已收到部分数据但连接异常关闭，未收到 finish_reason。

    典型场景：网关/代理超时切断长连接、上游服务端主动断开。
    与 StreamChunkTimeoutError（客户端等待下一个 chunk 超时）互斥：
    - StreamChunkTimeoutError：chunk 间隔超时，客户端主动放弃
    - StreamInterruptedError：连接被对端关闭，数据可能不完整
    """

    def __init__(self, *, chunk_count: int, total_elapsed_seconds: float, message: str = ""):
        self.chunk_count = chunk_count
        self.total_elapsed_seconds = total_elapsed_seconds
        if not message:
            message = (
                f"Stream interrupted after {chunk_count} chunks "
                f"(total elapsed: {total_elapsed_seconds:.1f}s): "
                f"connection closed without finish_reason"
            )
        super().__init__(message)


class ResourceLimitExceededException(UserFriendlyException):
    """资源限制超出异常，用于处理各种资源超限情况

    包括但不限于：
    - 12000: 积分不足
    - 6603: 单次消耗轮数超出上限
    - 6400: 任务并发数超出上限

    该异常不应触发重试机制，而是应该暂停Agent执行。
    """

    # Define supported error codes and their default messages
    ERROR_CODE_MESSAGES = {
        12000: "Insufficient points",
        6603: "Single consumption rounds exceed limit",
        6400: "Task concurrency limit exceeded"
    }

    def __init__(self, error_code: int, error_details: Optional[Dict[str, Any]] = None, message: str = ""):
        """Initialize resource limit exceeded exception

        Args:
            error_code: Error code (12000, 6603, 6400, etc.)
            error_details: Error details dictionary containing original API response info
            message: Custom error message
        """
        self.error_code = error_code
        self.error_details = error_details or {}

        # Use provided message or default message for the error code
        if not message:
            message = self.ERROR_CODE_MESSAGES.get(error_code, f"Resource limit exceeded (error code: {error_code})")

        super().__init__(message, error_details=error_details)

    def get_user_friendly_message(self) -> str:
        """获取适合向用户展示的友好错误消息

        Returns:
            str: 格式化后的用户友好消息
        """
        return self.message

    def is_insufficient_points_error(self) -> bool:
        """Check if this is an insufficient points error

        Returns:
            bool: True if error code is 12000, False otherwise
        """
        return self.error_code == 12000

    def is_consumption_rounds_limit_error(self) -> bool:
        """Check if this is a consumption rounds limit error

        Returns:
            bool: True if error code is 6603, False otherwise
        """
        return self.error_code == 6603

    def is_concurrency_limit_error(self) -> bool:
        """Check if this is a concurrency limit error

        Returns:
            bool: True if error code is 6400, False otherwise
        """
        return self.error_code == 6400

@dataclass
class ErrorDetail:
    """API错误详情结构

    Represents the error object structure in API responses.
    """
    code: Optional[int] = None
    message: Optional[str] = None
    type: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ErrorDetail':
        """从字典创建ErrorDetail实例

        Args:
            data: 包含错误信息的字典

        Returns:
            ErrorDetail: 错误详情实例
        """
        return cls(
            code=data.get('code'),
            message=data.get('message'),
            type=data.get('type')
        )


@dataclass
class APIErrorResponse:
    """API错误响应结构

    Represents the complete structure of an API error response.
    Provides type-safe access to error information.
    """
    error: Optional[ErrorDetail] = None

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]) -> 'APIErrorResponse':
        """从字典创建APIErrorResponse实例

        Args:
            data: 包含错误响应的字典

        Returns:
            APIErrorResponse: 错误响应实例
        """
        if not data or not isinstance(data, dict):
            return cls()

        error_data = data.get('error')
        error_detail = None
        if error_data and isinstance(error_data, dict):
            error_detail = ErrorDetail.from_dict(error_data)

        return cls(error=error_detail)

    @classmethod
    def from_json(cls, json_str: str) -> 'APIErrorResponse':
        """从JSON字符串创建APIErrorResponse实例

        Args:
            json_str: JSON格式的错误响应字符串

        Returns:
            APIErrorResponse: 错误响应实例
        """
        try:
            data = json.loads(json_str)
            return cls.from_dict(data)
        except (json.JSONDecodeError, TypeError):
            return cls()

    @classmethod
    def from_response_or_message(cls, response=None, error_message: str = "") -> 'APIErrorResponse':
        """从响应对象或错误消息创建APIErrorResponse实例

        Args:
            response: HTTP响应对象
            error_message: 错误消息字符串

        Returns:
            APIErrorResponse: 错误响应实例
        """
        # 首先尝试从响应对象解析
        if response and hasattr(response, 'json'):
            try:
                data = response.json()
                return cls.from_dict(data)
            except Exception:
                pass

        # 如果响应解析失败，尝试从错误消息中提取
        if error_message:
            # 检查错误消息中是否包含资源限制相关的错误代码
            resource_limit_codes = {
                12000: "Insufficient points",
                6603: "Single consumption rounds exceed limit",
                6400: "Task concurrency limit exceeded"
            }

            for code, message in resource_limit_codes.items():
                if f'"code": {code}' in error_message or f'"code":{code}' in error_message:
                    error_detail = ErrorDetail(code=code, message=message)
                    return cls(error=error_detail)

        return cls()

    def is_resource_limit_error(self) -> bool:
        """检查是否为资源限制错误 (12000, 6603, 6400)

        Returns:
            bool: 如果是资源限制错误返回True，否则返回False
        """
        if self.error is None:
            return False
        return self.error.code in [12000, 6603, 6400]

    def is_insufficient_points_error(self) -> bool:
        """检查是否为积分不足错误

        Returns:
            bool: 如果是积分不足错误返回True，否则返回False
        """
        return self.error is not None and self.error.code == 12000

    def is_consumption_rounds_limit_error(self) -> bool:
        """检查是否为单次消耗轮数超限错误

        Returns:
            bool: 如果是单次消耗轮数超限错误返回True，否则返回False
        """
        return self.error is not None and self.error.code == 6603

    def is_concurrency_limit_error(self) -> bool:
        """检查是否为任务并发数超限错误

        Returns:
            bool: 如果是任务并发数超限错误返回True，否则返回False
        """
        return self.error is not None and self.error.code == 6400

    def get_error_code(self) -> Optional[int]:
        """获取错误代码

        Returns:
            Optional[int]: 错误代码，如果不存在返回None
        """
        return self.error.code if self.error else None

    def get_error_message(self) -> Optional[str]:
        """获取错误消息

        Returns:
            Optional[str]: 错误消息，如果不存在返回None
        """
        return self.error.message if self.error else None


# ---------------------------------------------------------------------------
# 流式链路中"不应被通用 except Exception 包装"的结构性异常。
# 所有通用 except Exception 前应先写: except STREAMING_PASSTHROUGH_EXCEPTIONS: raise
# ---------------------------------------------------------------------------
STREAMING_PASSTHROUGH_EXCEPTIONS: tuple[Type[BaseException], ...] = (
    StreamChunkTimeoutError,
    StreamInterruptedError,
)


def iter_exception_chain(exception: BaseException) -> List[Exception]:
    """遍历完整异常图，返回链中所有 Exception 节点。

    同时展开 __cause__ 和 __context__ 两条边。遇到 BaseException 子节点时继续展开
    其子链但不加入结果列表（结果只含 Exception 子类）。
    """
    result: List[Exception] = []
    queue: list[BaseException] = [exception]
    seen: set[int] = set()

    while queue:
        current = queue.pop(0)
        if current is None or id(current) in seen:
            continue
        seen.add(id(current))

        if isinstance(current, Exception):
            result.append(current)

        # 标准因果链：同时展开 __cause__ 和 __context__
        if current.__cause__ is not None:
            queue.append(current.__cause__)
        if current.__context__ is not None and current.__context__ is not current.__cause__:
            queue.append(current.__context__)



    return result


def find_in_exception_chain(
    exception: BaseException,
    exc_type: Type[_E],
) -> Optional[_E]:
    """在异常图中查找指定类型的第一个实例。"""
    for exc in iter_exception_chain(exception):
        if isinstance(exc, exc_type):
            return exc  # type: ignore[return-value]
    return None
