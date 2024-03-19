"""Agent mention handler"""
from typing import Dict, List, Any
from app.service.mention.base import BaseMentionHandler, logger


class AgentHandler(BaseMentionHandler):
    """处理Agent类型的mention"""

    def get_type(self) -> str:
        return "agent"

    async def get_tip(self, mention: Dict[str, Any]) -> str:
        """Agent类型的mention返回提示文本"""
        return "可按需求使用上述 Agent"

    async def handle(self, mention: Dict[str, Any], index: int) -> List[str]:
        """处理Agent引用（异步）

        Args:
            mention: mention数据
            index: mention序号

        Returns:
            List[str]: 格式化的上下文行列表
        """
        agent_name = mention.get('name') or mention.get('agent_name', '未知Agent')

        logger.info(f"用户prompt添加Agent引用: {agent_name}")

        return [f"{index}. [@agent:{agent_name}]"]
