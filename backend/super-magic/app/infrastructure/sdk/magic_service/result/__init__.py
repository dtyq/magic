"""
Magic Service API Results

Result classes for Magic Service API responses.
"""

# ruff: noqa: I001 - this aggregate module keeps the established export groups

from .ai_ability_runtime_config_result import AiAbilityRuntimeConfigItem, AiAbilityRuntimeConfigResult
from .agent_details_result import AgentDetailsResult, Tool
from .get_user_info_result import GetUserInfoResult
from .message_schedule_result import MessageScheduleResult
from .oauth2_callback_relay_result import OAuth2CallbackRelayResult
from .mcp_authorization_credential_result import MCPAuthorizationCredentialResult
from .agent_openapi_result import AgentOpenApiResult, AgentSkillInfo
from .update_crew_result import UpdateCrewResult
from .skill_file_urls_result import SkillFileUrlsResult, SkillFileUrlItem
from .import_skill_result import ImportSkillResult
from .share_result import ShareResourceIdResult, ShareResult, CancelShareResult, FindSimilarSharesResult, ShareListResult
from .latest_published_skill_versions_result import LatestPublishedSkillVersionsResult, LatestPublishedSkillVersionItem
from .html_design_style_source_result import HtmlDesignStyleSourceResult
from .ingest_third_party_message_result import IngestThirdPartyMessageResult
from .scan_wav_result import ScanWavResult  # TEMP: scan-wav workaround, remove when MagicFS auto-refreshes
from .search_knowledge_result import SearchKnowledgeResult
from .update_file_source_result import UpdateFileSourceResult
from .magicbase_column_result import MagicBaseColumnResult
from .magicbase_table_result import MagicBaseTableResult, MagicBaseTablesResult
from .magicbase_row_result import (
    MagicBaseBatchCreateRowsResult,
    MagicBaseBatchDeleteRowsResult,
    MagicBaseRowResult,
    MagicBaseRowsResult,
)

__all__ = [  # noqa: RUF022 - 保留既有导出顺序
    'GetUserInfoResult',
    'AiAbilityRuntimeConfigResult',
    'AiAbilityRuntimeConfigItem',
    'AgentDetailsResult',
    'Tool',
    'MessageScheduleResult',
    'OAuth2CallbackRelayResult',
    'MCPAuthorizationCredentialResult',
    'AgentOpenApiResult',
    'AgentSkillInfo',
    'UpdateCrewResult',
    'SkillFileUrlsResult',
    'SkillFileUrlItem',
    'ImportSkillResult',
    'ShareResourceIdResult',
    'ShareResult',
    'CancelShareResult',
    'FindSimilarSharesResult',
    'ShareListResult',
    'LatestPublishedSkillVersionsResult',
    'LatestPublishedSkillVersionItem',
    'HtmlDesignStyleSourceResult',
    'IngestThirdPartyMessageResult',
    'ScanWavResult',
    'SearchKnowledgeResult',
    'UpdateFileSourceResult',
    'MagicBaseColumnResult',
    'MagicBaseTableResult',
    'MagicBaseTablesResult',
    'MagicBaseBatchCreateRowsResult',
    'MagicBaseBatchDeleteRowsResult',
    'MagicBaseRowResult',
    'MagicBaseRowsResult',
]
