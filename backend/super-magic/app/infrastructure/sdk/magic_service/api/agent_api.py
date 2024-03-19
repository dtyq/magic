"""
Agent API

API implementation for agent-related operations in Magic Service.
"""

from typing import Optional
from ..kernel.magic_service_api import MagicServiceAbstractApi
from ..parameter.get_agent_details_parameter import GetAgentDetailsParameter
from ..parameter.get_agent_openapi_parameter import GetAgentOpenApiParameter
from ..parameter.update_agent_parameter import UpdateAgentParameter
from ..parameter.get_skill_file_urls_parameter import GetSkillFileUrlsParameter
from ..parameter.import_skill_from_agent_parameter import ImportSkillFromAgentParameter
from ..parameter.add_agent_skills_parameter import AddAgentSkillsParameter
from ..parameter.delete_agent_skills_parameter import DeleteAgentSkillsParameter
from ..parameter.tool_execute_parameter import ToolExecuteParameter
from ..result.agent_details_result import AgentDetailsResult
from ..result.agent_openapi_result import AgentOpenApiResult
from ..result.update_agent_result import UpdateAgentResult
from ..result.skill_file_urls_result import SkillFileUrlsResult
from ..result.import_skill_result import ImportSkillResult
from ..result.tool_execute_result import ToolExecuteResult


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

    # ==================== Open API Methods ====================

    async def get_agent_by_code_async(
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
        endpoint_path = f"/api/v1/open-api/sandbox/agents/{parameter.get_code()}"
        data = await self.request_by_parameter_async(parameter, 'GET', endpoint_path)
        return AgentOpenApiResult(data)

    async def update_agent_async(
        self,
        parameter: UpdateAgentParameter
    ) -> UpdateAgentResult:
        """
        Update agent by code via open-api (async)

        Args:
            parameter: UpdateAgentParameter instance

        Returns:
            UpdateAgentResult containing updated agent info
        """
        endpoint_path = f"/api/v1/open-api/sandbox/agents/{parameter.get_code()}"
        data = await self.request_by_parameter_async(parameter, 'PUT', endpoint_path)
        return UpdateAgentResult(data)

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
