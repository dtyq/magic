"""
Magic Service API Parameters

Parameter classes for Magic Service API requests.
"""

from .get_agent_details_parameter import GetAgentDetailsParameter
from .message_schedule_parameter import MessageScheduleParameter, TimeConfig
from .get_agent_openapi_parameter import GetAgentOpenApiParameter
from .update_agent_parameter import UpdateAgentParameter
from .get_skill_file_urls_parameter import GetSkillFileUrlsParameter
from .import_skill_from_agent_parameter import ImportSkillFromAgentParameter
from .add_agent_skills_parameter import AddAgentSkillsParameter
from .delete_agent_skills_parameter import DeleteAgentSkillsParameter

__all__ = [
    'GetAgentDetailsParameter',
    'MessageScheduleParameter',
    'TimeConfig',
    'GetAgentOpenApiParameter',
    'UpdateAgentParameter',
    'GetSkillFileUrlsParameter',
    'ImportSkillFromAgentParameter',
    'AddAgentSkillsParameter',
    'DeleteAgentSkillsParameter',
]
