"""Agent Profile Configuration

Defines the Agent identity configuration including name and description.
"""
from pydantic import BaseModel


class AgentProfile(BaseModel):
    """Agent identity configuration

    Used to customize Agent's name and description, which will replace
    corresponding text in prompts and system messages.
    """
    name: str = "超级麦吉"
    role: str = ""
    description: str = "英文名 SuperMagic，由广东灯塔引擎科技有限公司创造。"

    def get_profile_desc(self) -> str:
        """生成完整的身份描述文本，语言跟随当前 i18n 上下文"""
        if not self.name:
            return self.description

        from app.i18n import i18n

        if self.role:
            return i18n.translate(
                "agent_profile.desc_with_role",
                name=self.name,
                role=self.role,
                description=self.description,
            )
        return i18n.translate(
            "agent_profile.desc_without_role",
            name=self.name,
            description=self.description,
        )


# Default Agent Profile
DEFAULT_AGENT_PROFILE = AgentProfile()
