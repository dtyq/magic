"""
Magic Service API Results

Result classes for Magic Service API responses.
"""

from .agent_details_result import AgentDetailsResult, Tool
from .agent_openapi_result import AgentOpenApiResult, AgentSkillInfo
from .update_agent_result import UpdateAgentResult
from .skill_file_urls_result import SkillFileUrlsResult, SkillFileUrlItem
from .import_skill_result import ImportSkillResult
from .share_result import ShareResourceIdResult, ShareResult, CancelShareResult, FindSimilarSharesResult

__all__ = [
    'AgentDetailsResult',
    'Tool',
    'AgentOpenApiResult',
    'AgentSkillInfo',
    'UpdateAgentResult',
    'SkillFileUrlsResult',
    'SkillFileUrlItem',
    'ImportSkillResult',
    'ShareResourceIdResult',
    'ShareResult',
    'CancelShareResult',
    'FindSimilarSharesResult',
]
