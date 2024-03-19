from typing import Any, Optional

from pydantic import BaseModel


class MessageResponse(BaseModel):
    """消息响应模型"""

    success: bool
    message: str
    data: Optional[Any] = None
