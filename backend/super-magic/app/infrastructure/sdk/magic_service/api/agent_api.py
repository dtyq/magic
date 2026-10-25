"""
Agent API

API implementation for agent-related operations in Magic Service.
"""

from urllib.parse import quote

from ..kernel.magic_service_api import MagicServiceAbstractApi
from ..parameter.add_agent_skills_parameter import AddAgentSkillsParameter
from ..parameter.assistant_execute_parameter import AssistantExecuteParameter
from ..parameter.delete_agent_skills_parameter import DeleteAgentSkillsParameter
from ..parameter.get_agent_details_parameter import GetAgentDetailsParameter
from ..parameter.get_agent_openapi_parameter import GetAgentOpenApiParameter
from ..parameter.get_skill_file_urls_parameter import GetSkillFileUrlsParameter
from ..parameter.import_skill_from_agent_parameter import ImportSkillFromAgentParameter
from ..parameter.ingest_third_party_message_parameter import IngestThirdPartyMessageParameter
from ..parameter.available_agents_parameter import AvailableAgentsParameter
from ..parameter.list_agents_parameter import ListAgentsParameter
from ..parameter.search_knowledge_parameter import SearchKnowledgeParameter
from ..parameter.tool_execute_parameter import ToolExecuteParameter
from ..parameter.update_crew_parameter import UpdateCrewParameter
from ..result.available_agents_result import AvailableAgentsResult
from ..result.agent_details_result import AgentDetailsResult
from ..result.agent_execute_result import AgentExecuteResult
from ..result.agent_openapi_result import AgentOpenApiResult
from ..result.import_skill_result import ImportSkillResult
from ..result.ingest_third_party_message_result import IngestThirdPartyMessageResult
from ..result.list_agents_result import ListAgentsResult
from ..result.search_knowledge_result import SearchKnowledgeResult
from ..result.skill_file_urls_result import SkillFileUrlsResult
from ..result.tool_execute_result import ToolExecuteResult
from ..result.update_crew_result import UpdateCrewResult


class AgentApi(MagicServiceAbstractApi):
    """Agent API for Magic Service"""

    def get_agent_details(
        self,
        parameter: GetAgentDetailsParameter
    ) -> AgentDetailsResult:
        """
        Get agent details using parameter object

        Args:
            parameter: GetAgentDetailsParameter instance

        Returns:
            AgentDetailsResult containing agent details
        """
        # Use base request method that handles auth injection
        endpoint_path = f"/api/v1/open-api/sandbox/agents/{parameter.get_agent_id()}"
        data = self.request_by_parameter(parameter, 'GET', endpoint_path)

        # Return structured result
        return AgentDetailsResult(data)

    async def get_agent_details_async(
        self,
        parameter: GetAgentDetailsParameter
    ) -> AgentDetailsResult:
        """
        Get agent details using parameter object (async version)

        Args:
            parameter: GetAgentDetailsParameter instance

        Returns:
            AgentDetailsResult containing agent details
        """
        # Use base async request method that handles auth injection
        endpoint_path = f"/api/v1/open-api/sandbox/agents/{parameter.get_agent_id()}"
        data = await self.request_by_parameter_async(parameter, 'GET', endpoint_path)

        # Return structured result
        return AgentDetailsResult(data)

    def execute_tool(
        self,
        parameter: ToolExecuteParameter
    ) -> ToolExecuteResult:
        """
        Execute a tool using parameter object

        Args:
            parameter: ToolExecuteParameter instance

        Returns:
            ToolExecuteResult containing execution result
        """
        # Use base request method that handles auth injection
        endpoint_path = "/api/v1/open-api/sandbox/agents/tool-execute"
        data = self.request_by_parameter(parameter, 'POST', endpoint_path)

        # Return structured result
        return ToolExecuteResult(data)

    async def execute_tool_async(
        self,
        parameter: ToolExecuteParameter
    ) -> ToolExecuteResult:
        """
        Execute a tool using parameter object (async version)

        Args:
            parameter: ToolExecuteParameter instance

        Returns:
            ToolExecuteResult containing execution result
        """
        # Use base async request method that handles auth injection
        endpoint_path = "/api/v1/open-api/sandbox/agents/tool-execute"
        data = await self.request_by_parameter_async(parameter, 'POST', endpoint_path)

        # Return structured result
        return ToolExecuteResult(data)

    async def execute_assistant_async(
        self,
        parameter: AssistantExecuteParameter
    ) -> AgentExecuteResult:
        """
        Execute a legacy business assistant (one chat round) via the assistant execute API (async).

        Backed by magic-service apiChatByMCPTool. Pass `conversation_id` to keep context.

        Args:
            parameter: AssistantExecuteParameter instance

        Returns:
            AgentExecuteResult containing reply messages and conversation_id
        """
        endpoint_path = "/api/v1/open-api/sandbox/assistants/assistant-execute"
        data = await self.request_by_parameter_async(parameter, 'POST', endpoint_path)
        return AgentExecuteResult(data)

    async def execute_agent_async(self, parameter: AssistantExecuteParameter) -> AgentExecuteResult:
        """Backward-compatible call to the original agent-execute endpoint."""
        endpoint_path = "/api/v1/open-api/sandbox/agents/agent-execute"
        data = await self.request_by_parameter_async(parameter, 'POST', endpoint_path)
        return AgentExecuteResult(data)

    async def search_knowledge_async(
        self,
        parameter: SearchKnowledgeParameter,
    ) -> SearchKnowledgeResult:
        """
        Search for knowledge and related context that may help answer the current question.

        Args:
            parameter: SearchKnowledgeParameter instance

        Returns:
            SearchKnowledgeResult containing knowledge hits and context text
        """
        agent_code = quote(parameter.get_agent_code(), safe="")
        endpoint_path = f"/api/v1/open-api/sandbox/knowledge/agents/{agent_code}/similarity"
        data = await self.request_by_parameter_async(parameter, "GET", endpoint_path)
        return SearchKnowledgeResult(data, query=parameter.query)

    def ingest_third_party_message(
        self,
        parameter: IngestThirdPartyMessageParameter
    ) -> IngestThirdPartyMessageResult:
        """
        Persist a third-party inbound IM message.

        Args:
            parameter: IngestThirdPartyMessageParameter instance

        Returns:
            IngestThirdPartyMessageResult containing task/message identifiers
        """
        endpoint_path = "/api/v1/open-api/sandbox/super-agent/tasks/ingest-third-party-message"
        data = self.request_by_parameter(parameter, "POST", endpoint_path)
        return IngestThirdPartyMessageResult(data)

    async def ingest_third_party_message_async(
        self,
        parameter: IngestThirdPartyMessageParameter
    ) -> IngestThirdPartyMessageResult:
        """
        Persist a third-party inbound IM message (async).

        Args:
            parameter: IngestThirdPartyMessageParameter instance

        Returns:
            IngestThirdPartyMessageResult containing task/message identifiers
        """
        endpoint_path = "/api/v1/open-api/sandbox/super-agent/tasks/ingest-third-party-message"
        data = await self.request_by_parameter_async(parameter, "POST", endpoint_path)
        return IngestThirdPartyMessageResult(data)

    async def list_available_agents_async(
        self,
        parameter: AvailableAgentsParameter,
    ) -> AvailableAgentsResult:
        """List the current user's available Crew agents (paginated, keyword-searchable).

        Uses POST /api/v1/open-api/sandbox/agents/me/available which returns agents
        with localized name/description based on the request language header.

        Args:
            parameter: AvailableAgentsParameter instance

        Returns:
            AvailableAgentsResult containing the list of available agents
        """
        endpoint_path = "/api/v1/open-api/sandbox/agents/me/available"
        data = await self.request_by_parameter_async(parameter, "POST", endpoint_path)
        return AvailableAgentsResult(data)

    # ==================== Open API Methods ====================

    def get_agent_by_code(
        self,
        parameter: GetAgentOpenApiParameter
    ) -> AgentOpenApiResult:
        """
        Get agent details by code via open-api (sync)

        Args:
            parameter: GetAgentOpenApiParameter instance

        Returns:
            AgentOpenApiResult containing agent details
        """
        endpoint_path = f"/api/v1/open-api/sandbox/agents/{parameter.get_code()}"
        data = self.request_by_parameter(parameter, 'GET', endpoint_path)
        return AgentOpenApiResult(data)

    async def get_agent_by_code_latest_version(
        self,
        parameter: GetAgentOpenApiParameter
    ) -> AgentOpenApiResult:
        """
        Get agent details by code via open-api (async)

        Args:
            parameter: GetAgentOpenApiParameter instance

        Returns:
            AgentOpenApiResult containing agent details
        """
        endpoint_path = f"/api/v1/open-api/sandbox/agents/{parameter.get_code()}/latest-version"
        data = await self.request_by_parameter_async(parameter, 'GET', endpoint_path)
        return AgentOpenApiResult(data)

    async def update_crew_async(
        self,
        parameter: UpdateCrewParameter
    ) -> UpdateCrewResult:
        """
        Update Crew by code via open-api (async)

        Args:
            parameter: UpdateCrewParameter instance

        Returns:
            UpdateCrewResult containing updated Crew info
        """
        endpoint_path = f"/api/v1/open-api/sandbox/agents/{parameter.get_code()}"
        data = await self.request_by_parameter_async(parameter, 'PUT', endpoint_path)
        return UpdateCrewResult(data)

    async def get_skill_file_urls_async(
        self,
        parameter: GetSkillFileUrlsParameter
    ) -> SkillFileUrlsResult:
        """
        Batch get skill file download URLs (async)

        Args:
            parameter: GetSkillFileUrlsParameter instance

        Returns:
            SkillFileUrlsResult containing file URLs
        """
        endpoint_path = "/api/v1/open-api/sandbox/skills/file-urls"
        data = await self.request_by_parameter_async(parameter, 'POST', endpoint_path)
        return SkillFileUrlsResult(data)

    async def import_skill_from_agent_async(
        self,
        parameter: ImportSkillFromAgentParameter
    ) -> ImportSkillResult:
        """
        Import skill from agent via multipart upload (async)

        Args:
            parameter: ImportSkillFromAgentParameter instance

        Returns:
            ImportSkillResult containing imported skill info
        """
        try:
            endpoint_path = "/api/v1/open-api/sandbox/skills/import-from-agent"
            data = await self.request_by_parameter_async(parameter, 'POST', endpoint_path)
            return ImportSkillResult(data)
        finally:
            parameter.close()

    async def add_agent_skills_async(
        self,
        parameter: AddAgentSkillsParameter
    ) -> None:
        """
        Add skills to agent (incremental) (async)

        Args:
            parameter: AddAgentSkillsParameter instance
        """
        endpoint_path = f"/api/v1/open-api/sandbox/agents/{parameter.get_code()}/skills"
        await self.request_by_parameter_async(parameter, 'POST', endpoint_path)

    async def delete_agent_skills_async(
        self,
        parameter: DeleteAgentSkillsParameter
    ) -> None:
        """
        Delete skills from agent (incremental) (async)

        Args:
            parameter: DeleteAgentSkillsParameter instance
        """
        endpoint_path = f"/api/v1/open-api/sandbox/agents/{parameter.get_code()}/skills"
        await self.request_by_parameter_async(parameter, 'DELETE', endpoint_path)

    async def list_agents_async(
        self,
        parameter: ListAgentsParameter
    ) -> ListAgentsResult:
        """
        List all agents available to the current user (async)

        Uses the /api/v1/super-agents/featured endpoint which returns
        the user's frequent + all accessible agents.

        Args:
            parameter: ListAgentsParameter instance

        Returns:
            ListAgentsResult containing the list of available agents
        """
        endpoint_path = "/api/v1/super-agents/featured"
        data = await self.request_by_parameter_async(parameter, 'GET', endpoint_path)
        return ListAgentsResult(data)

    def list_agents(
        self,
        parameter: ListAgentsParameter
    ) -> ListAgentsResult:
        """
        List all agents available to the current user (sync)

        Uses the /api/v1/super-agents/featured endpoint which returns
        the user's frequent + all accessible agents.

        Args:
            parameter: ListAgentsParameter instance

        Returns:
            ListAgentsResult containing the list of available agents
        """
        endpoint_path = "/api/v1/super-agents/featured"
        data = self.request_by_parameter(parameter, 'GET', endpoint_path)
        return ListAgentsResult(data)
