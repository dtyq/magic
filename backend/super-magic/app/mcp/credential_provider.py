"""MCP Authorization 运行时凭据提供器。"""

from __future__ import annotations

from agentlang.logger import get_logger
from app.infrastructure.sdk.magic_service.api.mcp_authorization_credential_api import (
    MCPAuthorizationCredentialApi,
)
from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
from app.infrastructure.sdk.magic_service.parameter.mcp_authorization_credential_parameter import (
    MCPAuthorizationCredentialParameter,
)

logger = get_logger(__name__)


class MCPAuthorizationCredentialProvider:
    """在 MCP 建连前向 magic-service 请求用户授权凭据。"""

    def __init__(self, api: MCPAuthorizationCredentialApi | None = None) -> None:
        """初始化凭据 API；未传入时按当前 Agent 元数据创建 SDK。"""
        self._api = api

    async def get_access_token(self, mcp_server_code: str) -> str | None:
        """获取当前用户对应 MCP Server 的最新 access token。"""
        if not mcp_server_code.strip():
            return None

        if self._api is None:
            api = get_magic_service_sdk(timeout=15).mcp_authorization_credential
        else:
            api = self._api

        result = await api.fetch_credential_async(
            MCPAuthorizationCredentialParameter(mcp_server_code)
        )
        if not result.is_authorized():
            logger.info(
                f"MCP Server {mcp_server_code} 未获取到有效授权，status={result.status}"
            )
            return None
        return result.get_access_token()
