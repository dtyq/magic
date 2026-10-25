"""
Magic Service API Parameters

Parameter classes for Magic Service API requests.
"""

# ruff: noqa: I001 - this aggregate module keeps the established export groups

from .ai_ability_runtime_config_parameter import AiAbilityRuntimeConfigParameter
from .get_agent_details_parameter import GetAgentDetailsParameter
from .get_user_info_parameter import GetUserInfoParameter
from .message_schedule_parameter import MessageScheduleParameter, TimeConfig
from .oauth2_callback_relay_parameter import OAuth2CallbackRelayParameter
from .mcp_authorization_credential_parameter import MCPAuthorizationCredentialParameter
from .get_agent_openapi_parameter import GetAgentOpenApiParameter
from .update_crew_parameter import UpdateCrewParameter
from .get_skill_file_urls_parameter import GetSkillFileUrlsParameter
from .import_skill_from_agent_parameter import ImportSkillFromAgentParameter
from .add_agent_skills_parameter import AddAgentSkillsParameter
from .delete_agent_skills_parameter import DeleteAgentSkillsParameter
from .share_resource_id_parameter import ShareResourceIdParameter
from .create_share_parameter import CreateShareParameter, ShareExtraParameter, TargetId
from .find_similar_share_parameter import FindSimilarShareParameter
from .cancel_share_parameter import CancelShareParameter
from .get_share_parameter import GetShareParameter
from .list_share_parameter import ListShareParameter
from .get_latest_published_skill_versions_parameter import GetLatestPublishedSkillVersionsParameter
from .get_html_design_style_source_parameter import GetHtmlDesignStyleSourceParameter
from .ingest_third_party_message_parameter import IngestThirdPartyMessageParameter
from .scan_wav_parameter import ScanWavParameter  # TEMP: scan-wav workaround, remove when MagicFS auto-refreshes
from .search_knowledge_parameter import SearchKnowledgeParameter
from .update_file_source_parameter import UpdateFileSourceParameter, FileSource
from .create_magicbase_column_parameter import CreateMagicBaseColumnParameter
from .create_magicbase_table_parameter import CreateMagicBaseTableParameter
from .delete_magicbase_column_parameter import DeleteMagicBaseColumnParameter
from .delete_magicbase_table_parameter import DeleteMagicBaseTableParameter
from .get_magicbase_table_parameter import GetMagicBaseTableParameter
from .query_magicbase_tables_parameter import QueryMagicBaseTablesParameter
from .update_magicbase_column_parameter import UpdateMagicBaseColumnParameter
from .update_magicbase_table_permissions_parameter import UpdateMagicBaseTablePermissionsParameter
from .magicbase_row_parameter import (
    BatchCreateMagicBaseRowsParameter,
    BatchDeleteMagicBaseRowsParameter,
    CreateMagicBaseRowParameter,
    DeleteMagicBaseRowParameter,
    GetMagicBaseRowParameter,
    QueryMagicBaseRowsParameter,
    UpdateMagicBaseRowParameter,
)


__all__ = [  # noqa: RUF022 - 保留既有分组和导出顺序
    'GetUserInfoParameter',
    'AiAbilityRuntimeConfigParameter',
    'GetAgentDetailsParameter',
    'MessageScheduleParameter',
    'TimeConfig',
    'OAuth2CallbackRelayParameter',
    'MCPAuthorizationCredentialParameter',
    'GetAgentOpenApiParameter',
    'UpdateCrewParameter',
    'GetSkillFileUrlsParameter',
    'ImportSkillFromAgentParameter',
    'AddAgentSkillsParameter',
    'DeleteAgentSkillsParameter',
    'ShareResourceIdParameter',
    'CreateShareParameter',
    'ShareExtraParameter',
    'TargetId',
    'FindSimilarShareParameter',
    'CancelShareParameter',
    'GetShareParameter',
    'ListShareParameter',
    'GetLatestPublishedSkillVersionsParameter',
    'GetHtmlDesignStyleSourceParameter',
    'IngestThirdPartyMessageParameter',
    'ScanWavParameter',
    'SearchKnowledgeParameter',
    'UpdateFileSourceParameter',
    'FileSource',
    'CreateMagicBaseColumnParameter',
    'CreateMagicBaseTableParameter',
    'DeleteMagicBaseColumnParameter',
    'DeleteMagicBaseTableParameter',
    'GetMagicBaseTableParameter',
    'QueryMagicBaseTablesParameter',
    'UpdateMagicBaseColumnParameter',
    'UpdateMagicBaseTablePermissionsParameter',
    'BatchCreateMagicBaseRowsParameter',
    'BatchDeleteMagicBaseRowsParameter',
    'CreateMagicBaseRowParameter',
    'DeleteMagicBaseRowParameter',
    'GetMagicBaseRowParameter',
    'QueryMagicBaseRowsParameter',
    'UpdateMagicBaseRowParameter',
]
