"""
Magic Service API Results

Result classes for Magic Service API responses.
"""

from .agent_details_result import AgentDetailsResult, Tool
from .message_schedule_result import MessageScheduleResult
from .agent_openapi_result import AgentOpenApiResult, AgentSkillInfo
from .update_agent_result import UpdateAgentResult
from .skill_file_urls_result import SkillFileUrlsResult, SkillFileUrlItem
from .import_skill_result import ImportSkillResult
from .share_result import ShareResourceIdResult, ShareResult, CancelShareResult, FindSimilarSharesResult
from .latest_published_skill_versions_result import LatestPublishedSkillVersionsResult, LatestPublishedSkillVersionItem
from .ingest_third_party_message_result import IngestThirdPartyMessageResult

__all__ = [
    'AgentDetailsResult',
    'Tool',
    'MessageScheduleResult',
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
    'LatestPublishedSkillVersionsResult',
    'LatestPublishedSkillVersionItem',
    'IngestThirdPartyMessageResult',
]
