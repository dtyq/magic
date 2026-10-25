# -*- coding: utf-8 -*-
"""
Checkpoint事件监听服务

这个模块负责监听主代理运行事件，在每个用户回合开始前创建 checkpoint：
登记 manifest 与目录骨架。创建后，挂载内所有空间的变更由 agfs 侧的
checkpoint hook 依据 manifest 自动增量入账：

- project / topic：magicfs 插件（元数据 + S3）；
- chat_history：localfs 插件（本地盘）。运行期聊天历史 `.chat_history/`
  即该空间的挂载，每次保存由 hook 以 per-file 帧记账，Python 侧不再做
  整目录快照（历史全量复制链路已删除）。
"""

from app.core.context.agent_context import AgentContext
from app.service.checkpoint_service import CheckpointService
from app.service.agent_event.base_listener_service import BaseListenerService
from app.utils.checkpoint_utils import CheckpointUtils
from agentlang.event.event import Event, EventType
from agentlang.event.data import BeforeMainAgentRunEventData
from agentlang.logger import get_logger

logger = get_logger(__name__)


class CheckpointListenerService:
    """Checkpoint 事件监听服务。

    checkpoint 只由主 Agent 创建。checkpoint 创建本身只是登记 manifest
    与目录骨架；挂载内的工作区、话题与聊天历史变更由 agfs 侧的
    checkpoint hook 依据 manifest 自动增量入账。
    """

    @staticmethod
    def register_standard_listeners(agent_context: AgentContext) -> None:
        """注册checkpoint相关的事件监听器"""
        event_listeners = {
            EventType.BEFORE_MAIN_AGENT_RUN: CheckpointListenerService._handle_before_main_agent_run,
        }

        BaseListenerService.register_listeners(agent_context, event_listeners)
        logger.info("已注册checkpoint事件监听器")

    @staticmethod
    async def _handle_before_main_agent_run(event: Event[BeforeMainAgentRunEventData]) -> None:
        """处理主代理运行前事件，创建checkpoint"""
        try:
            agent_context = event.data.agent_context

            # 创建checkpoint
            checkpoint_service = CheckpointService()
            await checkpoint_service.initialize()

            # 检查是否需要创建checkpoint
            if not await CheckpointUtils.should_create_checkpoint(agent_context):
                logger.info("不需要创建checkpoint，跳过")
                return

            # 获取消息ID
            message_id = CheckpointUtils.get_current_checkpoint_context(agent_context)
            checkpoint_info = await checkpoint_service.create_checkpoint(message_id)

            # 将checkpoint信息存储到代理上下文中供后续使用
            CheckpointUtils.set_current_checkpoint(agent_context, checkpoint_info)

            logger.info(f"为消息创建checkpoint: {message_id}")

        except Exception as e:
            logger.error(f"创建checkpoint失败: {e}")
