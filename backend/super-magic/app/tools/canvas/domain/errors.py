"""Canvas 领域错误和稳定错误码。"""


class CanvasDomainError(ValueError):
    """携带模型可见稳定错误码的 Canvas 业务错误。"""

    def __init__(self, code: str, message: str):
        """初始化错误码和可读原因。"""
        super().__init__(message)
        self.code = code
        self.message = message


class CanvasProtocolError(CanvasDomainError):
    """表示主文件协议无法解析或校验失败的内部错误。"""


class CanvasBatchError(CanvasDomainError):
    """表示原子批量请求未写入，并携带逐项失败结果。"""

    def __init__(self, items: list[dict], message: str = "Canvas batch validation failed."):
        """保存每个 item 的状态，避免一个异常覆盖整个批次。"""
        super().__init__("BATCH_VALIDATION_FAILED", message)
        self.items = items


def canvas_error(code: str, message: str) -> CanvasDomainError:
    """创建统一的 Canvas 业务错误。"""
    return CanvasDomainError(code, message)
