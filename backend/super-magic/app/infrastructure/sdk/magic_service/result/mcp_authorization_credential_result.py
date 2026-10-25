"""MCP Authorization 运行时凭据结果。"""

from __future__ import annotations

from typing import Any, Dict, Optional

from app.infrastructure.sdk.base import AbstractResult


class MCPAuthorizationCredentialResult(AbstractResult):
    """解析 magic-service 返回的 MCP Authorization 凭据状态。"""

    def _parse_data(self) -> None:
        """提取授权状态和短时 access token。"""
        self.status: str = str(self.get("status") or "")
        raw_token = self.get("access_token")
        self.access_token: Optional[str] = raw_token if isinstance(raw_token, str) else None
        self.token_type: str = str(self.get("token_type") or "Bearer")

    def is_authorized(self) -> bool:
        """判断服务端是否返回了可用授权凭据。"""
        return self.status == "authorized" and bool(self.access_token)

    def get_access_token(self) -> Optional[str]:
        """获取运行时 access token。"""
        return self.access_token

    def to_dict(self) -> Dict[str, Any]:
        """转换为不包含 access token 的安全结果字典。"""
        return {
            "status": self.status,
            "token_type": self.token_type,
        }
