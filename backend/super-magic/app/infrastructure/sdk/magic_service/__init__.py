"""
Magic Service SDK

A complete SDK for interacting with Magic Service APIs.
"""

from .magic_service import MagicService
from .factory import (
    create_magic_service_sdk,
    create_magic_service_sdk_with_defaults,
    MagicServiceConfigError
)

# API classes
from .api.agent_api import AgentApi
from .api.share_api import ShareApi

# Parameter classes
from .parameter.get_agent_details_parameter import GetAgentDetailsParameter
from .parameter.tool_execute_parameter import ToolExecuteParameter
from .parameter.share_resource_id_parameter import ShareResourceIdParameter
from .parameter.create_share_parameter import CreateShareParameter, TargetId
from .parameter.find_similar_share_parameter import FindSimilarShareParameter
from .parameter.cancel_share_parameter import CancelShareParameter

# Result classes
from .result.agent_details_result import (
    AgentDetailsResult,
    Tool
)
from .result.tool_execute_result import ToolExecuteResult
from .result.share_result import (
    ShareResourceIdResult,
    ShareResult,
    CancelShareResult,
    FindSimilarSharesResult,
)

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

__all__ = [
    # Main API class
    'MagicService',

    # Factory functions
    'create_magic_service_sdk',
    'create_magic_service_sdk_with_defaults',
    'MagicServiceConfigError',

    # API classes
    'AgentApi',
    'ShareApi',

    # Parameter classes
    'GetAgentDetailsParameter',
    'ToolExecuteParameter',
    'ShareResourceIdParameter',
    'CreateShareParameter',
    'TargetId',
    'FindSimilarShareParameter',
    'CancelShareParameter',

    # Result classes
    'AgentDetailsResult',
    'ToolExecuteResult',
    'Tool',
    'ShareResourceIdResult',
    'ShareResult',
    'CancelShareResult',
    'FindSimilarSharesResult',

    # Kernel classes
    'MagicServiceException',
    'MagicServiceUnauthorizedException',
    'MagicServiceConfigurationError',
    'MagicServiceApiError',
    'AbstractApi',
    'AbstractParameter',
    'AbstractResult'
]
