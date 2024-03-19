"""
定义基础DTO类和通用结构
"""


from pydantic import BaseModel, root_validator

from app.core.entity.message.client_message import ClientMessage


class BaseDTO(BaseModel):
    """基础数据传输对象"""
    class Config:
        arbitrary_types_allowed = True


class WebSocketMessage(ClientMessage):
    """WebSocket消息模型"""

    @root_validator(pre=True)
    def validate_id_and_type(cls, values):
        if "message_id" not in values:
            raise ValueError("消息必须包含 'message_id' 字段")

        if "type" not in values:
            raise ValueError("消息必须包含 'type' 字段")

        return values
