"""
事件上下文模块

提供事件上下文类，用于在事件传递过程中携带数据
"""

import uuid
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.core.entity.attachment import Attachment


class EventContext(BaseModel):
    """事件上下文，用于在多个监听器之间传递数据

    事件上下文允许多个监听器共享数据，特别是当后面的监听器需要
    使用前面监听器生成的数据时非常有用。

    在工具执行过程中，一个工具可能触发多个事件，这些事件应该共享
    同一个事件上下文，以便在事件之间传递数据。
    """
    # 预定义的上下文字段
    attachments: List[Attachment] = Field(default_factory=list)

    # 事件上下文的ID
    id: str = Field(default_factory=str)

    # 标记 todos 是否发生变化
    todos_changed: bool = Field(default=False)

    model_config = ConfigDict(arbitrary_types_allowed=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.id = str(uuid.uuid4())

    def add_attachment(self, attachment: Attachment) -> None:
        """添加附件到上下文

        Args:
            attachment: 要添加的附件对象
        """
        self.attachments.append(attachment)

    def get_attachment_by_key(self, key: str) -> Optional[Attachment]:
        """通过key获取附件

        Args:
            key: 附件的object_key

        Returns:
            找到的附件对象，如果未找到则返回None
        """
        for attachment in self.attachments:
            if attachment.key == key:
                return attachment
        return None
