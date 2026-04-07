"""
Skill API

API implementation for skill-related operations in Magic Service.
Covers both user skills (/skills/*) and skill market (/skill-market/*) endpoints.
All endpoints are under /api/v1/open-api/sandbox and require SandboxUserAuthMiddleware.
"""

import os
from typing import Optional

import httpx

from ..kernel.magic_service_api import MagicServiceAbstractApi, _process_magic_service_response
from ..parameter.query_skills_parameter import QuerySkillsParameter
from ..parameter.get_skill_file_urls_parameter import GetSkillFileUrlsParameter
from ..parameter.import_skill_from_agent_parameter import ImportSkillFromAgentParameter
from ..parameter.get_latest_published_skill_versions_parameter import GetLatestPublishedSkillVersionsParameter
from ..result.skill_list_result import SkillListResult
from ..result.skill_file_urls_result import SkillFileUrlsResult
from ..result.import_skill_from_agent_result import ImportSkillFromAgentResult
from ..result.skill_market_list_result import SkillMarketListResult
from ..result.latest_published_skill_versions_result import LatestPublishedSkillVersionsResult
from app.infrastructure.sdk.base.exceptions import HttpRequestError


class SkillApi(MagicServiceAbstractApi):
    """Skill API for Magic Service - user skills and skill market"""

    # --- User skill endpoints ---

    def query_skills(self, parameter: QuerySkillsParameter) -> SkillListResult:
        """
        Query user skill list

        Args:
            parameter: QuerySkillsParameter instance

        Returns:
            SkillListResult containing paginated skill list
        """
        endpoint_path = "/api/v1/open-api/sandbox/skills/queries"
        data = self.request_by_parameter(parameter, 'POST', endpoint_path)
        return SkillListResult(data)

    async def query_skills_async(self, parameter: QuerySkillsParameter) -> SkillListResult:
        """
        Query user skill list (async version)

        Args:
            parameter: QuerySkillsParameter instance

        Returns:
            SkillListResult containing paginated skill list
        """
        endpoint_path = "/api/v1/open-api/sandbox/skills/queries"
        data = await self.request_by_parameter_async(parameter, 'POST', endpoint_path)
        return SkillListResult(data)

    def get_skill_file_urls(self, parameter: GetSkillFileUrlsParameter) -> SkillFileUrlsResult:
        """
        Batch get skill file keys and download URLs.
        Only returns skills owned by the current user.

        Args:
            parameter: GetSkillFileUrlsParameter instance

        Returns:
            SkillFileUrlsResult containing list of skill file URL items
        """
        endpoint_path = "/api/v1/open-api/sandbox/skills/file-urls"
        data = self.request_by_parameter(parameter, 'POST', endpoint_path)
        return SkillFileUrlsResult(data)

    async def get_skill_file_urls_async(self, parameter: GetSkillFileUrlsParameter) -> SkillFileUrlsResult:
        """
        Batch get skill file keys and download URLs (async version).
        Only returns skills owned by the current user.

        Args:
            parameter: GetSkillFileUrlsParameter instance

        Returns:
            SkillFileUrlsResult containing list of skill file URL items
        """
        endpoint_path = "/api/v1/open-api/sandbox/skills/file-urls"
        data = await self.request_by_parameter_async(parameter, 'POST', endpoint_path)
        return SkillFileUrlsResult(data)

    def import_skill_from_agent(self, parameter: ImportSkillFromAgentParameter) -> ImportSkillFromAgentResult:
        """
        Import a skill package file from an agent (one-step: upload, validate, extract, store).
        Sends the file as multipart/form-data.

        Args:
            parameter: ImportSkillFromAgentParameter instance

        Returns:
            ImportSkillFromAgentResult containing id, code, name, description, is_create
        """
        parameter.validate()
        endpoint_path = "/api/v1/open-api/sandbox/skills/import-from-agent"
        url = self._get_full_url(endpoint_path)
        headers = parameter.to_headers()

        filename = os.path.basename(parameter.file_path)
        try:
            with open(parameter.file_path, 'rb') as f:
                files = {'file': (filename, f, 'application/octet-stream')}
                form_data = {'source': parameter.source}
                response = self.sdk_base.get_client().request(
                    'POST', url, headers=headers, files=files, data=form_data
                )
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HttpRequestError(f"HTTP {e.response.status_code}: {e.response.text}")
        except HttpRequestError:
            raise
        except Exception as e:
            raise HttpRequestError(f"Request failed: {e}")

        result_data = _process_magic_service_response(response)
        return ImportSkillFromAgentResult(result_data)

    async def import_skill_from_agent_async(self, parameter: ImportSkillFromAgentParameter) -> ImportSkillFromAgentResult:
        """
        Import a skill package file from an agent (async version).
        Sends the file as multipart/form-data.

        Args:
            parameter: ImportSkillFromAgentParameter instance

        Returns:
            ImportSkillFromAgentResult containing id, code, name, description, is_create
        """
        parameter.validate()
        endpoint_path = "/api/v1/open-api/sandbox/skills/import-from-agent"
        url = self._get_full_url(endpoint_path)
        headers = parameter.to_headers()

        filename = os.path.basename(parameter.file_path)
        try:
            with open(parameter.file_path, 'rb') as f:
                files = {'file': (filename, f, 'application/octet-stream')}
                form_data = {'source': parameter.source}
                response = await self.sdk_base.get_async_client().request(
                    'POST', url, headers=headers, files=files, data=form_data
                )
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HttpRequestError(f"HTTP {e.response.status_code}: {e.response.text}")
        except HttpRequestError:
            raise
        except Exception as e:
            raise HttpRequestError(f"Async request failed: {e}")

        result_data = _process_magic_service_response(response)
        return ImportSkillFromAgentResult(result_data)

    def query_latest_published_versions(
        self, parameter: GetLatestPublishedSkillVersionsParameter
    ) -> LatestPublishedSkillVersionsResult:
        """
        Batch query the latest published version of skills by codes.

        Args:
            parameter: GetLatestPublishedSkillVersionsParameter instance

        Returns:
            LatestPublishedSkillVersionsResult containing paginated version list
        """
        endpoint_path = "/api/v1/open-api/sandbox/skills/last-versions/queries"
        data = self.request_by_parameter(parameter, 'POST', endpoint_path)
        return LatestPublishedSkillVersionsResult(data)

    async def query_latest_published_versions_async(
        self, parameter: GetLatestPublishedSkillVersionsParameter
    ) -> LatestPublishedSkillVersionsResult:
        """
        Batch query the latest published version of skills by codes (async version).

        Args:
            parameter: GetLatestPublishedSkillVersionsParameter instance

        Returns:
            LatestPublishedSkillVersionsResult containing paginated version list
        """
        endpoint_path = "/api/v1/open-api/sandbox/skills/last-versions/queries"
        data = await self.request_by_parameter_async(parameter, 'POST', endpoint_path)
        return LatestPublishedSkillVersionsResult(data)

    # --- Skill market endpoints ---

    def query_skill_market(self, parameter: QuerySkillsParameter) -> SkillMarketListResult:
        """
        Query skill market list

        Args:
            parameter: QuerySkillsParameter instance

        Returns:
            SkillMarketListResult containing paginated skill market list
        """
        endpoint_path = "/api/v1/open-api/sandbox/skill-market/queries"
        data = self.request_by_parameter(parameter, 'POST', endpoint_path)
        return SkillMarketListResult(data)

    async def query_skill_market_async(self, parameter: QuerySkillsParameter) -> SkillMarketListResult:
        """
        Query skill market list (async version)

        Args:
            parameter: QuerySkillsParameter instance

        Returns:
            SkillMarketListResult containing paginated skill market list
        """
        endpoint_path = "/api/v1/open-api/sandbox/skill-market/queries"
        data = await self.request_by_parameter_async(parameter, 'POST', endpoint_path)
        return SkillMarketListResult(data)
