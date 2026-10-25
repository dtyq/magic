"""
Magic Service API

Main API class providing access to all Magic Service APIs.
"""

import hashlib

from app.infrastructure.sdk.base import SdkBase, SdkContext

from .api.agent_api import AgentApi
from .api.ai_ability_api import AiAbilityApi
from .api.contact_api import ContactApi
from .api.file_api import FileApi  # TEMP: scan-wav workaround, remove when MagicFS auto-refreshes
from .api.follow_up_suggestion_api import FollowUpSuggestionApi
from .api.html_design_style_api import HtmlDesignStyleApi
from .api.magicbase_api import MagicBaseApi
from .api.mcp_authorization_credential_api import MCPAuthorizationCredentialApi
from .api.message_api import MessageApi
from .api.message_schedule_api import MessageScheduleApi
from .api.micro_app_api import MicroAppApi
from .api.oauth2_callback_relay_api import OAuth2CallbackRelayApi
from .api.project_api import ProjectApi
from .api.share_api import ShareApi
from .api.skill_api import SkillApi
from .api.task_api import TaskApi
from .api.topic_api import TopicApi
from .api.user_api import UserApi
from .api.workspace_api import WorkspaceApi


class MagicService:
    """Magic Service - Main router for all Magic Service operations"""

    NAME = 'magic_service'

    def __init__(self, sdk_base: SdkBase):
        """
        Initialize Magic Service API

        Args:
            sdk_base: SdkBase instance for HTTP operations
        """
        # Create unique key for this instance
        config_data = sdk_base.get_config().to_dict()
        self.key = hashlib.md5(
            f"{self.NAME}{config_data!s}".encode()
        ).hexdigest()

        # Register in global context if not already registered
        if not SdkContext.has(self.key):
            SdkContext.register(self.key, sdk_base)

        # Initialize API routes
        self._routes = {
            'user': UserApi,
            'contact': ContactApi,
            'ai_ability': AiAbilityApi,
            'agent': AgentApi,
            'file': FileApi,  # TEMP: scan-wav workaround, remove when MagicFS auto-refreshes
            'html_design_style': HtmlDesignStyleApi,
            'magicbase': MagicBaseApi,
            'micro_app': MicroAppApi,
            'message_schedule': MessageScheduleApi,
            'oauth2_callback_relay': OAuth2CallbackRelayApi,
            'mcp_authorization_credential': MCPAuthorizationCredentialApi,
            'skill': SkillApi,
            'share': ShareApi,
            'follow_up_suggestion': FollowUpSuggestionApi,
            'workspace': WorkspaceApi,
            'project': ProjectApi,
            'topic': TopicApi,
            'message': MessageApi,
            'task': TaskApi,
        }

        # Initialize fetched API instances
        self._fetched_definitions = {}
        self._register_apis(sdk_base)

    def __getattr__(self, name: str):
        """
        Magic method to provide property-style access to APIs

        Args:
            name: API name to access

        Returns:
            API instance

        Raises:
            AttributeError: If API route not found
        """
        api_instance = self._fetched_definitions.get(name)
        if api_instance is None:
            raise AttributeError(f"No API route found for '{name}'. Available routes: {list(self._routes.keys())}")
        return api_instance

    @property
    def user(self) -> UserApi:
        return self._fetched_definitions['user']

    @property
    def contact(self) -> ContactApi:
        return self._fetched_definitions['contact']

    @property
    def agent(self) -> 'AgentApi':
        """Get agent API instance"""
        return self._fetched_definitions['agent']

    @property
    def ai_ability(self) -> 'AiAbilityApi':
        """Get AI ability API instance."""
        return self._fetched_definitions['ai_ability']

    @property
    def file(self) -> 'FileApi':
        """Get file API instance.

        # TEMP: scan-wav workaround, remove when MagicFS auto-refreshes.
        """
        return self._fetched_definitions['file']

    @property
    def html_design_style(self) -> 'HtmlDesignStyleApi':
        """Get HTML design style source API instance."""
        return self._fetched_definitions['html_design_style']

    @property
    def magicbase(self) -> 'MagicBaseApi':
        """Get MagicBase API instance"""
        return self._fetched_definitions['magicbase']

    @property
    def message_schedule(self) -> 'MessageScheduleApi':
        """Get message schedule API instance"""
        return self._fetched_definitions['message_schedule']

    @property
    def oauth2_callback_relay(self) -> 'OAuth2CallbackRelayApi':
        """获取 OAuth2 callback relay API 实例。"""
        return self._fetched_definitions['oauth2_callback_relay']

    @property
    def mcp_authorization_credential(self) -> 'MCPAuthorizationCredentialApi':
        """获取 MCP Authorization 运行时凭据 API 实例。"""
        return self._fetched_definitions['mcp_authorization_credential']

    @property
    def skill(self) -> 'SkillApi':
        """Get skill API instance"""
        return self._fetched_definitions['skill']

    @property
    def share(self) -> 'ShareApi':
        """Get share API instance"""
        return self._fetched_definitions['share']

    @property
    def follow_up_suggestion(self) -> 'FollowUpSuggestionApi':
        """获取追加问题上报 API。"""
        return self._fetched_definitions['follow_up_suggestion']

    def get_host(self) -> str:
        """
        Get Magic Service host URL

        Returns:
            Host URL string
        """
        sdk_base = SdkContext.get(self.key)
        config = sdk_base.get_config()
        return config.get('base_url', '')

    def get_sdk_base(self) -> SdkBase:
        """
        Get underlying SdkBase instance

        Returns:
            SdkBase instance
        """
        return SdkContext.get(self.key)

    def close(self) -> None:
        """Close SDK resources"""
        sdk_base = SdkContext.get(self.key)
        if sdk_base:
            sdk_base.close()
        SdkContext.remove(self.key)

    def _register_apis(self, sdk_base: SdkBase) -> None:
        """
        Register all API instances

        Args:
            sdk_base: SdkBase instance
        """
        for route_name, api_class in self._routes.items():
            self._fetched_definitions[route_name] = api_class(sdk_base)

    def __enter__(self):
        """Context manager entry"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.close()
