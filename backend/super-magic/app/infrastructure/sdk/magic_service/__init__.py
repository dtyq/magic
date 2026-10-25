"""
Magic Service SDK

A complete SDK for interacting with Magic Service APIs.
"""

# ruff: noqa: I001 - this aggregate module keeps API-surface groups readable

from .magic_service import MagicService
from .factory import (
    create_magic_service_sdk,
    create_magic_service_sdk_with_defaults,
    MagicServiceConfigError
)

# API classes
from .api.ai_ability_api import AiAbilityApi
from .api.agent_api import AgentApi
from .api.magicbase_api import MagicBaseApi
from .api.message_schedule_api import MessageScheduleApi
from .api.oauth2_callback_relay_api import OAuth2CallbackRelayApi
from .api.mcp_authorization_credential_api import MCPAuthorizationCredentialApi
from .api.share_api import ShareApi

# Parameter classes
from .parameter.ai_ability_runtime_config_parameter import AiAbilityRuntimeConfigParameter
from .parameter.get_agent_details_parameter import GetAgentDetailsParameter
from .parameter.tool_execute_parameter import ToolExecuteParameter
from .parameter.search_knowledge_parameter import SearchKnowledgeParameter
from .parameter.message_schedule_parameter import (
    MessageScheduleParameter,
    TimeConfig,
    QueryMessageSchedulesParameter,
    GetMessageScheduleDetailParameter,
    UpdateMessageScheduleParameter,
    DeleteMessageScheduleParameter,
)
from .parameter.oauth2_callback_relay_parameter import OAuth2CallbackRelayParameter
from .parameter.mcp_authorization_credential_parameter import MCPAuthorizationCredentialParameter
from .parameter.share_resource_id_parameter import ShareResourceIdParameter
from .parameter.create_share_parameter import CreateShareParameter, ShareExtraParameter, TargetId
from .parameter.find_similar_share_parameter import FindSimilarShareParameter
from .parameter.cancel_share_parameter import CancelShareParameter
from .parameter.get_share_parameter import GetShareParameter
from .parameter.list_share_parameter import ListShareParameter
from .parameter.ingest_third_party_message_parameter import IngestThirdPartyMessageParameter
from .parameter.create_magicbase_column_parameter import CreateMagicBaseColumnParameter
from .parameter.create_magicbase_table_parameter import CreateMagicBaseTableParameter
from .parameter.delete_magicbase_column_parameter import DeleteMagicBaseColumnParameter
from .parameter.delete_magicbase_table_parameter import DeleteMagicBaseTableParameter
from .parameter.get_magicbase_table_parameter import GetMagicBaseTableParameter
from .parameter.query_magicbase_tables_parameter import QueryMagicBaseTablesParameter
from .parameter.update_magicbase_column_parameter import UpdateMagicBaseColumnParameter
from .parameter.update_magicbase_table_permissions_parameter import UpdateMagicBaseTablePermissionsParameter

# Result classes
from .result.ai_ability_runtime_config_result import AiAbilityRuntimeConfigItem, AiAbilityRuntimeConfigResult
from .result.agent_details_result import (
    AgentDetailsResult,
    Tool
)
from .result.tool_execute_result import ToolExecuteResult
from .result.search_knowledge_result import SearchKnowledgeResult
from .result.message_schedule_result import (
    MessageScheduleResult,
    MessageScheduleListResult,
    DeleteMessageScheduleResult,
)
from .result.oauth2_callback_relay_result import OAuth2CallbackRelayResult
from .result.mcp_authorization_credential_result import MCPAuthorizationCredentialResult
from .result.share_result import (
    ShareResourceIdResult,
    ShareResult,
    CancelShareResult,
    FindSimilarSharesResult,
    ShareListResult,
)
from .result.ingest_third_party_message_result import IngestThirdPartyMessageResult
from .result.magicbase_column_result import MagicBaseColumnResult
from .result.magicbase_table_result import MagicBaseTableResult, MagicBaseTablesResult

# Kernel classes
from .kernel.magic_service_exception import (
    MagicServiceException,
    MagicServiceUnauthorizedException,
    MagicServiceConfigurationError,
    MagicServiceApiError
)

# Import abstract classes from sdk-base
from app.infrastructure.sdk.base import AbstractApi, AbstractParameter, AbstractResult

__version__ = '1.0.0'

__all__ = [  # noqa: RUF022 - 分组顺序属于此聚合模块的既有结构
    # Main API class
    'MagicService',

    # Factory functions
    'create_magic_service_sdk',
    'create_magic_service_sdk_with_defaults',
    'MagicServiceConfigError',

    # API classes
    'AiAbilityApi',
    'AgentApi',
    'MagicBaseApi',
    'MessageScheduleApi',
    'OAuth2CallbackRelayApi',
    'MCPAuthorizationCredentialApi',
    'ShareApi',

    # Parameter classes
    'AiAbilityRuntimeConfigParameter',
    'GetAgentDetailsParameter',
    'ToolExecuteParameter',
    'SearchKnowledgeParameter',
    'MessageScheduleParameter',
    'TimeConfig',
    'QueryMessageSchedulesParameter',
    'GetMessageScheduleDetailParameter',
    'UpdateMessageScheduleParameter',
    'DeleteMessageScheduleParameter',
    'OAuth2CallbackRelayParameter',
    'MCPAuthorizationCredentialParameter',
    'ShareResourceIdParameter',
    'CreateShareParameter',
    'ShareExtraParameter',
    'TargetId',
    'FindSimilarShareParameter',
    'CancelShareParameter',
    'GetShareParameter',
    'ListShareParameter',
    'IngestThirdPartyMessageParameter',
    'CreateMagicBaseColumnParameter',
    'CreateMagicBaseTableParameter',
    'DeleteMagicBaseColumnParameter',
    'DeleteMagicBaseTableParameter',
    'GetMagicBaseTableParameter',
    'QueryMagicBaseTablesParameter',
    'UpdateMagicBaseColumnParameter',
    'UpdateMagicBaseTablePermissionsParameter',

    # Result classes
    'AiAbilityRuntimeConfigResult',
    'AiAbilityRuntimeConfigItem',
    'AgentDetailsResult',
    'ToolExecuteResult',
    'SearchKnowledgeResult',
    'Tool',
    'MessageScheduleResult',
    'MessageScheduleListResult',
    'DeleteMessageScheduleResult',
    'OAuth2CallbackRelayResult',
    'MCPAuthorizationCredentialResult',
    'ShareResourceIdResult',
    'ShareResult',
    'CancelShareResult',
    'FindSimilarSharesResult',
    'ShareListResult',
    'IngestThirdPartyMessageResult',
    'MagicBaseColumnResult',
    'MagicBaseTableResult',
    'MagicBaseTablesResult',

    # Kernel classes
    'MagicServiceException',
    'MagicServiceUnauthorizedException',
    'MagicServiceConfigurationError',
    'MagicServiceApiError',
    'AbstractApi',
    'AbstractParameter',
    'AbstractResult'
]
