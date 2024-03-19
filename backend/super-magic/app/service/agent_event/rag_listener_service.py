from app.core.context.agent_context import AgentContext
from app.core.entity.event.file_event import FileEventData
from agentlang.event.event import Event, EventType
from agentlang.logger import get_logger
from app.service.agent_event.base_listener_service import BaseListenerService

logger = get_logger(__name__)

class RagListenerService:
    """
    RAG事件监听服务，用于处理文件相关事件，支持检索增强生成(RAG)系统
    """

    @staticmethod
    def register_standard_listeners(agent_context: AgentContext) -> None:
        """
        为代理上下文注册文件相关事件的监听器
        
        Args:
            agent_context: 代理上下文对象
        """
        # 创建事件类型到处理函数的映射
        event_listeners = {
            EventType.FILE_CREATED: RagListenerService._handle_file_created,
            EventType.FILE_UPDATED: RagListenerService._handle_file_updated,
            EventType.FILE_DELETED: RagListenerService._handle_file_deleted
        }

        # 使用基类方法批量注册监听器
        BaseListenerService.register_listeners(agent_context, event_listeners)

        logger.info("已为RAG系统注册所有文件相关事件监听器")

    @staticmethod
    async def _handle_file_created(event: Event[FileEventData]) -> None:
        """
        处理文件创建事件
        
        Args:
            event: 文件创建事件对象，包含FileEventData数据
        """
        # 事件处理逻辑将由用户实现
        pass

    @staticmethod
    async def _handle_file_updated(event: Event[FileEventData]) -> None:
        """
        处理文件更新事件
        
        Args:
            event: 文件更新事件对象，包含FileEventData数据
        """
        # 事件处理逻辑将由用户实现
        pass

    @staticmethod
    async def _handle_file_deleted(event: Event[FileEventData]) -> None:
        """
        处理文件删除事件
        
        Args:
            event: 文件删除事件对象，包含FileEventData数据
        """
        # 事件处理逻辑将由用户实现
        pass
