"""MCP Authorization 运行时凭据请求参数。"""

from __future__ import annotations

from typing import Any, Dict

from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class MCPAuthorizationCredentialParameter(MagicServiceAbstractParameter):
    """按 MCP Server code 请求当前用户运行时凭据。"""

    def __init__(self, mcp_server_code: str) -> None:
        """初始化 MCP Server code。"""
        super().__init__()
        self.mcp_server_code = mcp_server_code

    def to_body(self) -> Dict[str, Any]:
        """GET 请求不携带请求体。"""
        return {}

    def to_query_params(self) -> Dict[str, Any]:
        """凭据接口使用路径参数，不携带查询参数。"""
        return {}

    def validate(self) -> None:
        """校验 MCP Server code 与 Magic Service 用户鉴权信息。"""
        super().validate()
        if not isinstance(self.mcp_server_code, str) or not self.mcp_server_code.strip():
            raise ValueError("mcp_server_code is required")
