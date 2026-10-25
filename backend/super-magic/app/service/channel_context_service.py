from pathlib import Path
from typing import TYPE_CHECKING, Optional

from agentlang.environment import Environment
from agentlang.logger import get_logger
from app.channel.base.registry import build_default_channel_registry
from app.channel.config import load_config
from app.core.entity.message.client_message import ChatClientMessage
from app.core.skill_utils.manager import find_skill
from app.utils.init_client_message_util import InitClientMessageUtil

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext

logger = get_logger(__name__)


class ChannelContextService:
    """构建渠道专属的模型上下文"""

    @classmethod
    def append_channel_context(cls, query: str, message: Optional[ChatClientMessage]) -> str:
        channel_name = message.metadata.channel_name if (message and message.metadata) else None
        if not channel_name:
            return query

        channel = build_default_channel_registry().get(channel_name)
        if channel is None:
            return query

        fragment = channel.build_agent_context_fragment(message)
        if not fragment:
            return query

        return f"{query}\n\n{fragment}"

    @classmethod
    async def resolve_auto_read_files(
        cls,
        agent_context: "AgentContext",
    ) -> tuple[Path, ...]:
        """当前话题 active 绑定决定知识候选；当前消息仍独立决定回复目标。"""
        if not agent_context.is_interactive_main_agent_context() or not agent_context.is_magiclaw():
            return ()
        topic_id = InitClientMessageUtil.get_topic_id()
        if not topic_id:
            return ()
        config = await load_config()
        active_keys: list[str] = []
        for channel in build_default_channel_registry().get_all():
            credential = getattr(config, channel.key, None)
            if (
                credential is not None and credential.enabled
                and credential.topic_id == topic_id and channel.is_connected
            ):
                active_keys.append(channel.key)
        if not active_keys:
            return ()

        excluded = {name.casefold() for name in agent_context.get_excluded_skills()}
        if "im-channels" in excluded:
            raise ValueError("The active IM channel Skill is excluded for this agent.")
        skill = await find_skill("im-channels", agent_name=agent_context.agent_name)
        if skill is None or not skill.skill_file:
            logger.warning("Active IM channels have no available im-channels Skill")
            raise ValueError("The active IM channel Skill could not be found.")
        if not skill.enabled or skill.name.casefold() in excluded or (Environment.is_mainland() and skill.region == "international"):
            raise ValueError("The active IM channel Skill is disabled or unavailable in this region.")
        main_file = Path(skill.skill_file)
        return (
            main_file,
            *(main_file.parent / "reference" / f"{key}.md" for key in active_keys),
        )
