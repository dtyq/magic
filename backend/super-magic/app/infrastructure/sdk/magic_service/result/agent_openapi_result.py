"""
Agent OpenAPI Result

Result class for agent details from open-api.
"""

from typing import Dict, Any, List, Optional
from app.infrastructure.sdk.base import AbstractResult


def _safe_i18n(value: Any) -> Dict[str, str]:
    """Return value as dict, falling back to empty dict if None or wrong type."""
    return value if isinstance(value, dict) else {}


def get_i18n_text(i18n: Dict[str, str], *fallbacks: str) -> str:
    """
    Safely get text from an i18n dict with multiple key fallbacks.
    Tries keys in order: zh_CN, zh, en_US, en, then caller-supplied fallbacks.
    Returns empty string if nothing found.
    """
    safe = i18n if isinstance(i18n, dict) else {}
    for key in ('zh_CN', 'zh', 'en_US', 'en', *fallbacks):
        val = safe.get(key)
        if val:
            return val
    return ''


class AgentSkillInfo:
    """Skill info from agent details"""

    def __init__(self, data: Dict[str, Any]):
        self.id = data.get('id')
        self.skill_id = data.get('skill_id')
        self.skill_code = data.get('skill_code', '')
        self.name_i18n = _safe_i18n(data.get('name_i18n'))
        self.description_i18n = _safe_i18n(data.get('description_i18n'))
        self.logo = data.get('logo')
        self.file_url = data.get('file_url')
        self.sort_order = data.get('sort_order', 0)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'skill_id': self.skill_id,
            'skill_code': self.skill_code,
            'name_i18n': self.name_i18n,
            'description_i18n': self.description_i18n,
            'logo': self.logo,
            'file_url': self.file_url,
            'sort_order': self.sort_order,
        }


class AgentOpenApiResult(AbstractResult):
    """Result for agent details via open-api"""

    def __init__(self, data: Dict[str, Any]):
        super().__init__(data)

    def _parse_data(self) -> None:
        """Parse raw data into structured attributes"""
        self.id = self.get('id', '')
        self.code = self.get('code', '')
        self.version_code = self.get('version_code')
        self.version_id = self.get('version_id')
        self.name = self.get('name', '')
        self.description = self.get('description', '')
        self.name_i18n = _safe_i18n(self.get('name_i18n'))
        self.description_i18n = _safe_i18n(self.get('description_i18n'))
        self.role_i18n = _safe_i18n(self.get('role_i18n'))

        raw_icon = self.get('icon')
        self.icon = raw_icon if isinstance(raw_icon, dict) else {}
        self.icon_type = self.get('icon_type', 1)

        self.prompt = self.get('prompt')
        self.enabled = self.get('enabled', False)
        self.source_type = self.get('source_type', '')
        self.is_store_offline = self.get('is_store_offline')
        self.pinned_at = self.get('pinned_at')
        self.project_id = self.get('project_id')
        self.file_key = self.get('file_key')
        self.file_url = self.get('file_url')
        self.latest_published_at = self.get('latest_published_at')
        self.created_at = self.get('created_at', '')
        self.updated_at = self.get('updated_at', '')

        # Parse skills
        skills_data = self.get('skills', [])
        self.skills: List[AgentSkillInfo] = [AgentSkillInfo(s) for s in skills_data] if skills_data else []

        # Parse playbooks (raw list)
        self.playbooks = self.get('playbooks', [])

        # Tools raw data
        self.tools = self.get('tools', [])

    def get_prompt_string(self) -> Optional[str]:
        """Extract the prompt string from the prompt object structure"""
        if not self.prompt:
            return None
        structure = self.prompt.get('structure', {})
        return structure.get('string')

    def get_prompt_version(self) -> Optional[str]:
        """Get prompt version"""
        if not self.prompt:
            return None
        return self.prompt.get('version')

    def get_skill_ids(self) -> List[str]:
        """Get list of skill IDs (as strings)"""
        return [str(s.skill_id) for s in self.skills if s.skill_id]
