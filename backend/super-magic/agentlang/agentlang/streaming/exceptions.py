# agentlang/agentlang/streaming/exceptions.py


class StreamingException(Exception):
    """流式推送基础异常"""
    pass


class DriverNotAvailableException(StreamingException):
    """驱动不可用异常"""
    def __init__(self, driver_name: str, message: str = None):
        self.driver_name = driver_name
        super().__init__(message or f"Streaming driver '{driver_name}' not available")


class PushFailedException(StreamingException):
    """推送失败异常"""
    def __init__(self, request_id: str, message: str = None):
        self.request_id = request_id
        super().__init__(message or f"Push failed for request '{request_id}'")
