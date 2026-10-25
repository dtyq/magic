"""MCP Authorization 运行时凭据 API。"""

from __future__ import annotations

from urllib.parse import quote

from ..kernel.magic_service_api import MagicServiceAbstractApi
from ..parameter.mcp_authorization_credential_parameter import MCPAuthorizationCredentialParameter
from ..result.mcp_authorization_credential_result import MCPAuthorizationCredentialResult

DEFAULT_MCP_AUTHORIZATION_CREDENTIAL_PATH = "/api/v1/open-api/sandbox/mcp/authorization/credential"


class MCPAuthorizationCredentialApi(MagicServiceAbstractApi):
    """调用 magic-service 获取 MCP Authorization 运行时凭据。"""

    async def fetch_credential_async(
        self,
        parameter: MCPAuthorizationCredentialParameter,
    ) -> MCPAuthorizationCredentialResult:
        """按 MCP Server code 获取当前用户的最新 access token。"""
        code = quote(parameter.mcp_server_code.strip(), safe="")
        data = await self.request_by_parameter_async(
            parameter,
            "GET",
            f"{DEFAULT_MCP_AUTHORIZATION_CREDENTIAL_PATH}/{code}",
        )
        return MCPAuthorizationCredentialResult(data)
