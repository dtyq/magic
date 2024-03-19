"""
Agent Details Result

Result class for agent details API response.
"""

from typing import Dict, Any, List, Optional
from app.infrastructure.sdk.base import AbstractResult


def _resolve_i18n(i18n_dict: dict, lang: str = "zh_CN", fallback: str = "") -> str:
    """从 i18n 字典中按优先级取本地化文本

    优先级：指定语言 → default → en_US → fallback
    """
    if not isinstance(i18n_dict, dict):
        return fallback
    return (
        i18n_dict.get(lang)
        or i18n_dict.get("default")
        or i18n_dict.get("en_US")
        or fallback
    )


class AgentSkillItem:
    """Agent 详情中的单个 skill 条目"""

    def __init__(self, data: Dict[str, Any]):
        self.id: str = data.get("id", "")
        self.skill_id: str = data.get("skill_id", "")
        self.skill_code: str = data.get("skill_code", "")
        self.name_i18n: dict = data.get("name_i18n") or {}
        self.description_i18n: dict = data.get("description_i18n") or {}
        self.logo: str = data.get("logo", "")
        self.file_url: Optional[str] = data.get("file_url")
        self.sort_order: int = data.get("sort_order", 0)

    def get_name(self, lang: str = "zh_CN") -> str:
        return _resolve_i18n(self.name_i18n, lang)

    def get_description(self, lang: str = "zh_CN") -> str:
        return _resolve_i18n(self.description_i18n, lang)

    def to_dynamic_config_dict(self, lang: str = "zh_CN") -> dict:
        """转换为 dynamic_config skills 格式"""
        return {
            "id": self.skill_id,
            "code": self.skill_code,
            "name": self.get_name(lang),
            "description": self.get_description(lang),
            "version": "",
            "source": "MARKET",
            "file_url": self.file_url,
        }


class Tool:
    """Tool data structure"""

    def __init__(self, data: Dict[str, Any]):
        self.code = data.get('code', '')
        self.name = data.get('name', '')
        self.description = data.get('description', '')

        # Normalize icon field to always be a dict
        raw_icon = data.get('icon')
        if isinstance(raw_icon, dict):
            self.icon = raw_icon
        else:
            # Convert any other type (list, null, string, etc.) to empty dict
            self.icon = {}

        self.type = data.get('type', 0)
        self.schema = data.get('schema')  # Optional schema field

    def has_schema(self) -> bool:
        """Check if tool has schema"""
        return self.schema is not None

    def get_schema(self) -> Optional[Dict[str, Any]]:
        """Get tool schema"""
        return self.schema

    def get_icon(self) -> Dict[str, Any]:
        """Get tool icon"""
        return self.icon

    def to_dict(self) -> Dict[str, Any]:
        result = {
            'code': self.code,
            'name': self.name,
            'description': self.description,
            'icon': self.icon,
            'type': self.type
        }
        if self.schema is not None:
            result['schema'] = self.schema
        return result


class AgentDetailsResult(AbstractResult):
    """Result for agent details API"""

    def __init__(self, data: Dict[str, Any]):
        """
        Initialize agent details result

        Args:
            data: Raw response data from API
        """
        super().__init__(data)

    def _parse_data(self) -> None:
        """Parse raw data into structured attributes"""
        # Basic agent information
        self.id = self.get('id', '')
        self.name = self.get('name', '')
        self.description = self.get('description', '')

        # Normalize icon field to always be a dict
        raw_icon = self.get('icon')
        if isinstance(raw_icon, dict):
            self.icon = raw_icon
        else:
            # Convert any other type (list, null, string, etc.) to empty dict
            self.icon = {}

        self.type = self.get('type', 0)
        self.enabled = self.get('enabled', False)

        # Prompt information - store as object directly
        self.prompt = self.get('prompt', {})
        self.prompt_string = self.get('prompt_string', '')

        # i18n fields
        self.name_i18n: dict = self.get('name_i18n') or {}
        self.role_i18n: dict = self.get('role_i18n') or {}
        self.description_i18n: dict = self.get('description_i18n') or {}

        # Skills information
        skills_data = self.get('skills', [])
        self.skills: List[AgentSkillItem] = [AgentSkillItem(s) for s in skills_data]

        # Tools information
        tools_data = self.get('tools', [])
        self.tools = [Tool(tool) for tool in tools_data]

        # Creator and modifier information
        self.creator = self.get('creator', '')
        self.modifier = self.get('modifier', '')
        self.created_uid = self.get('created_uid')
        self.updated_uid = self.get('updated_uid')
        self.created_at = self.get('created_at', '')
        self.updated_at = self.get('updated_at', '')
        self.creator_info = self.get('creator_info')
        self.modifier_info = self.get('modifier_info')

    def get_id(self) -> str:
        """Get agent ID"""
        return self.id

    def get_name(self) -> str:
        """Get agent name"""
        return self.name

    def get_description(self) -> str:
        """Get agent description"""
        return self.description

    def get_localized_name(self, lang: str = "zh_CN") -> str:
        """按语言优先级获取 agent 名称，zh_CN → default → en_US → name"""
        return _resolve_i18n(self.name_i18n, lang, fallback=self.name)

    def get_localized_role(self, lang: str = "zh_CN") -> str:
        """按语言优先级获取 agent 角色"""
        return _resolve_i18n(self.role_i18n, lang)

    def get_localized_description(self, lang: str = "zh_CN") -> str:
        """按语言优先级获取 agent 描述，zh_CN → default → en_US → description"""
        return _resolve_i18n(self.description_i18n, lang, fallback=self.description)

    def get_skills(self) -> List[AgentSkillItem]:
        """获取 agent skills 列表"""
        return self.skills

    def to_dynamic_config_skills(self, lang: str = "zh_CN") -> List[dict]:
        """将 skills 转换为 dynamic_config 格式列表"""
        return [s.to_dynamic_config_dict(lang) for s in self.skills]

    def get_icon(self) -> Dict[str, Any]:
        """Get agent icon"""
        return self.icon

    def get_type(self) -> int:
        """Get agent type"""
        return self.type

    def is_enabled(self) -> bool:
        """Check if agent is enabled"""
        return self.enabled

    def get_prompt(self) -> Dict[str, Any]:
        """Get prompt object"""
        return self.prompt

    def get_prompt_string(self) -> str:
        """Get prompt string"""
        return self.prompt_string

    def get_tools(self) -> List[Tool]:
        """Get agent tools"""
        return self.tools

    def get_creator(self) -> str:
        """Get creator"""
        return self.creator

    def get_modifier(self) -> str:
        """Get modifier"""
        return self.modifier

    def get_created_at(self) -> str:
        """Get creation timestamp"""
        return self.created_at

    def get_updated_at(self) -> str:
        """Get update timestamp"""
        return self.updated_at

    def has_tools(self) -> bool:
        """Check if agent has tools"""
        return len(self.tools) > 0

    def get_tool_by_code(self, code: str) -> Optional[Tool]:
        """
        Get tool by code

        Args:
            code: Tool code to search for

        Returns:
            Tool instance if found, None otherwise
        """
        for tool in self.tools:
            if tool.code == code:
                return tool
        return None

    def get_tool_codes(self) -> List[str]:
        """
        Get list of tool codes

        Returns:
            List of tool codes
        """
        return [tool.code for tool in self.tools]

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert result to dictionary

        Returns:
            Dict representation of structured result
        """
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'icon': self.icon,
            'type': self.type,
            'enabled': self.enabled,
            'prompt': self.prompt,
            'prompt_string': self.prompt_string,
            'tools': [tool.to_dict() for tool in self.tools],
            'creator': self.creator,
            'modifier': self.modifier,
            'created_uid': self.created_uid,
            'updated_uid': self.updated_uid,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'creator_info': self.creator_info,
            'modifier_info': self.modifier_info
        }

    def __str__(self) -> str:
        """String representation of agent details"""
        return f"Agent[{self.id}]: {self.name} ({'enabled' if self.enabled else 'disabled'})"
