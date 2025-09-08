"""
代理上下文类

管理与代理相关的业务参数
"""

import asyncio
import json
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from agentlang.context.base_agent_context import BaseAgentContext
from agentlang.event.common import BaseEventData
from agentlang.event.event import Event, EventType, StoppableEvent
from agentlang.llms.token_usage.models import TokenUsageReport
from agentlang.logger import get_logger
from app.core.config.communication_config import STSTokenRefreshConfig
from app.core.entity.attachment import Attachment
from app.core.entity.message.client_message import ChatClientMessage, InitClientMessage
from app.core.entity.project_archive import ProjectArchiveInfo
from app.core.stream import Stream
from app.paths import PathManager

# 获取日志记录器
logger = get_logger(__name__)

class AgentContext(BaseAgentContext):
    """
    代理上下文类，包含代理运行需要的上下文信息
    实现 AgentContextInterface 接口，提供用户和代理相关信息
    """

    def __init__(self):
        """
        初始化代理上下文
        """
        super().__init__()

        # 初始化字段并注册到 shared_context
        self._init_shared_fields()

        # 设置工作空间目录
        try:
            self.set_workspace_dir(str(PathManager.get_workspace_dir()))
        except Exception as e:
            logger.warning(f"无法获取工作空间目录: {e}")
            self.set_workspace_dir(os.path.join(os.getcwd(), ".workspace"))
            self.ensure_workspace_dir()

        # 设置聊天历史目录
        try:
            chat_history_dir = str(PathManager.get_chat_history_dir())
            self.set_chat_history_dir(chat_history_dir)
        except Exception as e:
            logger.warning(f"无法获取聊天历史目录: {e}")
            chat_history_dir = os.path.join(os.getcwd(), ".chat_history")
            self.set_chat_history_dir(chat_history_dir)

        # 设置默认代理名称
        self.set_agent_name("magic")

    def _init_shared_fields(self):
        """初始化共享字段并注册到 shared_context"""
        # 检查是否已经初始化
        if hasattr(self.shared_context, 'is_initialized') and self.shared_context.is_initialized():
            logger.warning("SharedContext 已经初始化，跳过重复初始化")
            return

        super()._init_shared_fields()

        # 使用 register_fields 一次性注册所有字段
        import asyncio
        from typing import Any, Dict, Optional

        from app.core.entity.attachment import Attachment
        from app.core.entity.message.client_message import ChatClientMessage, InitClientMessage
        from app.core.entity.project_archive import ProjectArchiveInfo
        from app.core.stream import Stream

        # 初始化并注册共享字段
        self.shared_context.register_fields({
            "streams": ({}, Dict[str, Stream]),
            "todo_items": ({}, Dict[str, Dict[str, Any]]),
            "attachments": ({}, Dict[str, Attachment]),
            "chat_client_message": (None, Optional[ChatClientMessage]),
            "init_client_message": (None, Optional[InitClientMessage]),
            "task_id": (None, Optional[str]),
            "interrupt_queue": (None, Optional[asyncio.Queue]),
            "sandbox_id": ("", str),
            "project_archive_info": (None, Optional[ProjectArchiveInfo]),
            "organization_code": (None, Optional[str]),
            "final_token_usage_report": (None, Optional[TokenUsageReport]),
        })

        # 标记初始化完成
        if hasattr(self.shared_context, 'set_initialized'):
            self.shared_context.set_initialized(True)

        logger.info("已初始化 SharedContext 共享字段")

    def set_task_id(self, task_id: str) -> None:
        """设置任务ID

        Args:
            task_id: 任务ID
        """
        self.shared_context.update_field("task_id", task_id)
        logger.debug(f"已更新任务ID: {task_id}")

    def get_task_id(self) -> Optional[str]:
        """获取任务ID

        Returns:
            Optional[str]: 任务ID
        """
        return self.shared_context.get_field("task_id")

    def set_interrupt_queue(self, interrupt_queue: asyncio.Queue) -> None:
        """设置中断队列

        Args:
            interrupt_queue: 中断队列
        """
        self.shared_context.update_field("interrupt_queue", interrupt_queue)

    def get_interrupt_queue(self) -> Optional[asyncio.Queue]:
        """获取中断队列

        Returns:
            Optional[asyncio.Queue]: 中断队列
        """
        return self.shared_context.get_field("interrupt_queue")

    def set_sandbox_id(self, sandbox_id: str) -> None:
        """设置沙盒ID

        Args:
            sandbox_id: 沙盒ID
        """
        self.shared_context.update_field("sandbox_id", sandbox_id)
        logger.debug(f"已更新沙盒ID: {sandbox_id}")

    def get_sandbox_id(self) -> str:
        """获取沙盒ID

        Returns:
            str: 沙盒ID
        """
        return self.shared_context.get_field("sandbox_id")

    def set_organization_code(self, organization_code: str) -> None:
        """设置组织编码

        Args:
            organization_code: 组织编码
        """
        self.shared_context.update_field("organization_code", organization_code)

    def get_organization_code(self) -> Optional[str]:
        """获取组织编码

        Returns:
            Optional[str]: 组织编码
        """
        return self.shared_context.get_field("organization_code")

    def set_init_client_message(self, init_client_message: InitClientMessage) -> None:
        """设置初始化客户端消息

        Args:
            init_client_message: 初始化客户端消息
        """
        self.shared_context.update_field("init_client_message", init_client_message)

    def get_init_client_message(self) -> Optional[InitClientMessage]:
        """获取初始化客户端消息

        Returns:
            Optional[InitClientMessage]: 初始化客户端消息
        """
        return self.shared_context.get_field("init_client_message")

    def get_init_client_message_metadata(self) -> Dict[str, Any]:
        """获取初始化客户端消息的元数据

        Returns:
            Dict[str, Any]: 初始化客户端消息的元数据
        """
        init_client_message = self.get_init_client_message()
        if init_client_message is None:
            return {}

        if init_client_message.metadata is None:
            return {}

        return init_client_message.metadata

    def get_init_client_message_sts_token_refresh(self) -> Optional[STSTokenRefreshConfig]:
        """获取初始化客户端消息的STS Token刷新配置

        Returns:
            Optional[STSTokenRefreshConfig]: STS Token刷新配置
        """
        init_client_message = self.get_init_client_message()
        if init_client_message is None:
            return None

        if init_client_message.sts_token_refresh is None:
            return None

        return init_client_message.sts_token_refresh

    def set_chat_client_message(self, chat_client_message: ChatClientMessage) -> None:
        """设置聊天客户端消息

        Args:
            chat_client_message: 聊天客户端消息
        """
        self.shared_context.update_field("chat_client_message", chat_client_message)

    def get_chat_client_message(self) -> Optional[ChatClientMessage]:
        """获取聊天客户端消息

        Returns:
            Optional[ChatClientMessage]: 聊天客户端消息
        """
        return self.shared_context.get_field("chat_client_message")

    def has_stream(self, stream: Stream) -> bool:
        """检查是否存在指定的通信流

        Args:
            stream: 要检查的通信流实例
        """
        stream_id = str(id(stream))
        streams = self.shared_context.get_field("streams")
        return stream_id in streams

    def add_stream(self, stream: Stream) -> None:
        """添加一个通信流到流字典中。

        Args:
            stream: 要添加的通信流实例。

        Raises:
            TypeError: 当传入的stream不是Stream接口的实现时抛出。
        """
        if not isinstance(stream, Stream):
            raise TypeError("stream必须是Stream接口的实现")

        streams = self.shared_context.get_field("streams")
        stream_id = str(id(stream))  # 使用stream对象的id作为键
        streams[stream_id] = stream
        logger.info(f"已添加新的Stream，当前Stream数量: {len(streams)}")

    def remove_stream(self, stream: Stream) -> None:
        """删除一个通信流。

        Args:
            stream: 要删除的通信流实例。
        """
        streams = self.shared_context.get_field("streams")
        stream_id = str(id(stream))
        if stream_id in streams:
            del streams[stream_id]
            logger.info(f"已删除Stream, type: {type(stream)}, 当前Stream数量: {len(streams)}")

    @property
    def streams(self) -> Dict[str, Stream]:
        """获取所有通信流的字典。

        Returns:
            Dict[str, Stream]: 通信流字典，键为stream ID，值为Stream对象。
        """
        return self.shared_context.get_field("streams")

    def set_project_archive_info(self, project_archive_info: ProjectArchiveInfo) -> None:
        """设置项目压缩包信息

        Args:
            project_archive_info: 项目压缩包信息
        """
        self.shared_context.update_field("project_archive_info", project_archive_info)

    def get_project_archive_info(self) -> Optional[ProjectArchiveInfo]:
        """获取项目压缩包信息

        Returns:
            Optional[ProjectArchiveInfo]: 项目压缩包信息
        """
        return self.shared_context.get_field("project_archive_info")

    # 重写基类方法，实现特定的事件分发
    async def dispatch_event(self, event_type: EventType, data: BaseEventData) -> Event[Any]:
        """
        触发指定类型的事件

        Args:
            event_type: 事件类型
            data: 事件数据，BaseEventData的子类实例

        Returns:
            Event: 处理后的事件对象
        """
        event = Event(event_type, data)
        return await self.get_event_dispatcher().dispatch(event)

    async def dispatch_stoppable_event(self, event_type: EventType, data: BaseEventData) -> StoppableEvent[Any]:
        """
        触发可停止的事件

        Args:
            event_type: 事件类型
            data: 事件数据，BaseEventData的子类实例

        Returns:
            StoppableEvent: 处理后的事件对象
        """
        event = StoppableEvent(event_type, data)
        return await self.get_event_dispatcher().dispatch(event)

    def get_todo_items(self) -> Dict[str, Dict[str, Any]]:
        """
        获取所有待办事项

        Returns:
            Dict[str, Dict[str, Any]]: 待办事项字典，键为待办事项内容，值为包含雪花ID等信息的字典
        """
        return self.shared_context.get_field("todo_items")

    def add_todo_item(self, todo_text: str, snowflake_id: int) -> None:
        """添加新的待办事项

        Args:
            todo_text: 待办事项文本内容
            snowflake_id: 待办事项的雪花ID
        """
        todo_items = self.shared_context.get_field("todo_items")
        if todo_text not in todo_items:
            todo_items[todo_text] = {
                'id': snowflake_id,
                'completed': False
            }
            logger.info(f"添加待办事项: {todo_text}, ID: {snowflake_id}")

    def update_todo_item(self, todo_text: str, completed: bool = None) -> None:
        """更新待办事项状态

        Args:
            todo_text: 待办事项文本内容
            completed: 是否完成
        """
        todo_items = self.shared_context.get_field("todo_items")
        if todo_text in todo_items:
            if completed is not None:
                todo_items[todo_text]['completed'] = completed
            logger.info(f"更新待办事项状态: {todo_text}, completed: {todo_items[todo_text]['completed']}")

    def get_todo_item_id(self, todo_text: str) -> Optional[int]:
        """
        获取待办事项的雪花ID

        Args:
            todo_text: 待办事项文本内容

        Returns:
            Optional[int]: 待办事项的雪花ID，如果不存在则返回None
        """
        todo_items = self.shared_context.get_field("todo_items")
        return todo_items.get(todo_text, {}).get('id')

    def has_todo_item(self, todo_text: str) -> bool:
        """
        检查待办事项是否存在

        Args:
            todo_text: 待办事项文本内容

        Returns:
            bool: 待办事项是否存在
        """
        todo_items = self.shared_context.get_field("todo_items")
        return todo_text in todo_items

    def update_activity_time(self) -> None:
        """更新agent活动时间"""
        self.shared_context.update_activity_time()

    def is_idle_timeout(self) -> bool:
        """检查agent是否超时闲置

        Returns:
            bool: 如果超时则返回True，否则返回False
        """
        return self.shared_context.is_idle_timeout()

    def add_attachment(self, attachment: Attachment) -> None:
        """添加附件到代理上下文

        所有工具产生的附件都将被添加到这里，以便在任务完成时一次性发送
        如果文件名已存在，则更新对应的附件对象

        Args:
            attachment: 要添加的附件对象
        """
        attachments = self.shared_context.get_field("attachments")
        filename = attachment.filename

        if filename in attachments:
            logger.debug(f"更新附件 {filename} 在代理上下文中")
        else:
            logger.debug(f"添加新附件 {filename} 到代理上下文，当前附件总数: {len(attachments) + 1}")

        attachments[filename] = attachment

    def get_attachments(self) -> List[Attachment]:
        """获取所有附件

        Returns:
            List[Attachment]: 所有收集到的附件列表
        """
        attachments = self.shared_context.get_field("attachments")
        return list(attachments.values())

    # 重写用户相关方法
    def get_user_id(self) -> Optional[str]:
        """获取用户ID

        Returns:
            Optional[str]: 用户ID，如果不存在则返回None
        """
        metadata = self.get_init_client_message_metadata()
        return metadata.get("user_id")

    def get_metadata(self) -> Dict[str, Any]:
        """获取元数据

        Returns:
            Dict[str, Any]: 上下文元数据
        """
        return self.get_init_client_message_metadata()

    def _serialize_value(self, value: Any) -> Any:
        """将值转换为可序列化的格式
        
        Args:
            value: 需要序列化的值
            
        Returns:
            Any: 转换后可序列化的值
        """
        if value is None:
            return None

        # 处理 pathlib.Path 对象
        if hasattr(value, "absolute") and callable(getattr(value, "absolute")):
            return str(value)

        # 处理具有 to_dict 方法的对象
        if hasattr(value, "to_dict") and callable(getattr(value, "to_dict")):
            return value.to_dict()

        # 处理日期时间对象
        if isinstance(value, (datetime, timedelta)):
            return str(value)

        # 处理异步队列
        if isinstance(value, asyncio.Queue):
            return f"<Queue:{id(value)}>"

        # 处理字典
        if isinstance(value, dict):
            return {k: self._serialize_value(v) for k, v in value.items()}

        # 处理列表或元组
        if isinstance(value, (list, tuple)):
            return [self._serialize_value(item) for item in value]

        # 尝试直接转换为 str
        try:
            json.dumps(value)
            return value
        except (TypeError, OverflowError, ValueError):
            # 如果无法序列化，则返回类型和ID信息
            return f"<{type(value).__name__}:{id(value)}>"

    def to_dict(self) -> Dict[str, Any]:
        """将代理上下文转换为字典
        
        Returns:
            Dict[str, Any]: 包含代理上下文信息的字典
        """
        # 基本信息
        result = {
            "agent_name": self.get_agent_name(),
            "workspace_dir": self._serialize_value(self.get_workspace_dir()),
            "chat_history_dir": self._serialize_value(self.get_chat_history_dir()),
            "user_id": self.get_user_id(),
            "task_id": self.get_task_id(),
            "sandbox_id": self.get_sandbox_id(),
            "organization_code": self.get_organization_code(),
        }

        # 集合信息
        try:
            result["todo_items_count"] = len(self.get_todo_items())
            # 添加部分 todo_items 信息
            todo_items = self.get_todo_items()
            if todo_items:
                result["todo_items"] = self._serialize_value({k: v for i, (k, v) in enumerate(todo_items.items()) if i < 5})
                if len(todo_items) > 5:
                    result["todo_items"]["..."] = f"还有 {len(todo_items) - 5} 项未显示"
        except Exception as e:
            result["todo_items_error"] = str(e)

        try:
            result["attachments_count"] = len(self.get_attachments())
            attachments = self.get_attachments()
            if attachments:
                result["attachments"] = [att.filename for att in attachments[:5]]
                if len(attachments) > 5:
                    result["attachments"].append(f"... 还有 {len(attachments) - 5} 个附件未显示")
        except Exception as e:
            result["attachments_error"] = str(e)

        try:
            result["streams_count"] = len(self.streams)
        except Exception as e:
            result["streams_error"] = str(e)

        # 添加共享上下文信息
        result["shared_context"] = "<使用 shared_context.to_dict() 查看详细信息>"

        return result

    def __str__(self) -> str:
        """自定义字符串表示
        
        Returns:
            str: 字典形式的字符串表示
        """
        try:
            return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)
        except Exception as e:
            return f"<AgentContext object at {hex(id(self))}: {e!s}>"

    def __repr__(self) -> str:
        """自定义对象表示
        
        Returns:
            str: 字典形式的对象表示
        """
        return self.__str__()

    def set_token_usage_report(self, report: TokenUsageReport) -> None:
        """设置 token 使用报告

        Args:
            report: token 使用报告实例
        """
        self.shared_context.update_field("final_token_usage_report", report)
        logger.debug("已更新 token 使用报告")

    def get_token_usage_report(self) -> Optional[TokenUsageReport]:
        """获取 token 使用报告

        Returns:
            Optional[TokenUsageReport]: token 使用报告，如果不存在则返回 None
        """
        return self.shared_context.get_field("final_token_usage_report")
