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
from .api.message_schedule_api import MessageScheduleApi

# Parameter classes
from .parameter.get_agent_details_parameter import GetAgentDetailsParameter
from .parameter.tool_execute_parameter import ToolExecuteParameter
from .parameter.message_schedule_parameter import (
    MessageScheduleParameter,
    TimeConfig,
    QueryMessageSchedulesParameter,
    GetMessageScheduleDetailParameter,
    UpdateMessageScheduleParameter,
    DeleteMessageScheduleParameter,
)

# Result classes
from .result.agent_details_result import (
    AgentDetailsResult,
    Tool
)
from .result.tool_execute_result import ToolExecuteResult
from .result.message_schedule_result import (
    MessageScheduleResult,
    MessageScheduleListResult,
    DeleteMessageScheduleResult,
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
    'MessageScheduleApi',

    # Parameter classes
    'GetAgentDetailsParameter',
    'ToolExecuteParameter',
    'MessageScheduleParameter',
    'TimeConfig',
    'QueryMessageSchedulesParameter',
    'GetMessageScheduleDetailParameter',
    'UpdateMessageScheduleParameter',
    'DeleteMessageScheduleParameter',

    # Result classes
    'AgentDetailsResult',
    'ToolExecuteResult',
    'Tool',
    'MessageScheduleResult',
    'MessageScheduleListResult',
    'DeleteMessageScheduleResult',

    # Kernel classes
    'MagicServiceException',
    'MagicServiceUnauthorizedException',
    'MagicServiceConfigurationError',
    'MagicServiceApiError',
    'AbstractApi',
    'AbstractParameter',
    'AbstractResult'
]
