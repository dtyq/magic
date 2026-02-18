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
from .share_resource_id_parameter import ShareResourceIdParameter
from .create_share_parameter import CreateShareParameter, TargetId
from .find_similar_share_parameter import FindSimilarShareParameter
from .cancel_share_parameter import CancelShareParameter

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
    'ShareResourceIdParameter',
    'CreateShareParameter',
    'TargetId',
    'FindSimilarShareParameter',
    'CancelShareParameter',
]
