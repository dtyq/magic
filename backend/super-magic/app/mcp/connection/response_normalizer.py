"""MCP 响应标准化。

该模块只负责把已经收到的服务端响应转换为 MCP JSON-RPC 消息，
不参与连接、重试、超时或业务状态管理。
"""

from __future__ import annotations

import json
from typing import Any

from mcp.types import ErrorData, JSONRPCMessage


class MCPResponseNormalizer:
    """将非标准 MCP 响应统一转换为 JSON-RPC error。"""

    PARSE_ERROR = -32700
    SERVER_ERROR = -32000

    _SENSITIVE_KEY_PARTS = (
        "authorization",
        "access_key",
        "accesskey",
        "api_key",
        "apikey",
        "cookie",
        "password",
        "secret",
        "signature",
        "token",
    )
    _MAX_DEPTH = 4
    _MAX_ITEMS = 30
    _MAX_TEXT_LENGTH = 300

    def normalize_payload(
        self,
        body: bytes,
        request_id: str | int | None,
        http_status: int | None = None,
        content_type: str | None = None,
    ) -> bytes:
        """将 HTTP body 转换为标准 JSON-RPC 消息。"""
        try:
            payload = json.loads(body)
        except (UnicodeDecodeError, json.JSONDecodeError, TypeError):
            return self._dump_error(
                request_id,
                ErrorData(
                    code=self.PARSE_ERROR,
                    message="无法解析 MCP 服务端响应",
                    data=self._error_data(http_status, content_type, body),
                ),
            )

        if self._is_json_rpc_message(payload):
            return body

        if isinstance(payload, dict) and isinstance(payload.get("message"), str):
            error_data: dict[str, Any] = {
                "source": "mcp_server",
                "remote_code": payload.get("code"),
                "remote_data": self._sanitize(payload.get("data")),
            }
            error_data.update(self._http_data(http_status, content_type))
            return self._dump_error(
                request_id,
                ErrorData(
                    code=self.SERVER_ERROR,
                    message=self._limit_text(payload["message"]),
                    data=error_data,
                ),
            )

        return self._dump_error(
            request_id,
            ErrorData(
                code=self.SERVER_ERROR,
                message="MCP 服务端返回了非标准 JSON-RPC 响应",
                data={
                    "source": "mcp_server",
                    "payload": self._sanitize(payload),
                    **self._http_data(http_status, content_type),
                },
            ),
        )

    def normalize_exception(
        self,
        error: BaseException,
        request_id: str | int | None,
    ) -> ErrorData:
        """将 SDK 未关联请求的解析异常转换为标准错误数据。"""
        return ErrorData(
            code=self.PARSE_ERROR,
            message="无法解析 MCP 服务端响应",
            data={
                "source": "mcp_transport",
                "exception_type": type(error).__name__,
                "request_id": request_id,
            },
        )

    def _is_json_rpc_message(self, payload: Any) -> bool:
        """判断 payload 是否已经是合法的 JSON-RPC 消息。"""
        try:
            JSONRPCMessage.model_validate(payload)
            return True
        except Exception:
            return False

    def _dump_error(self, request_id: str | int | None, error: ErrorData) -> bytes:
        """构造 JSON-RPC error envelope。"""
        return json.dumps(
            {
                "jsonrpc": "2.0",
                "id": request_id,
                "error": error.model_dump(mode="json", exclude_none=True),
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")

    def _error_data(
        self,
        http_status: int | None,
        content_type: str | None,
        body: bytes,
    ) -> dict[str, Any]:
        """为解析错误生成脱敏的上下文信息。"""
        return {
            "source": "mcp_server",
            "body_length": len(body),
            **self._http_data(http_status, content_type),
        }

    def _http_data(self, http_status: int | None, content_type: str | None) -> dict[str, Any]:
        """生成可选 HTTP 元数据。"""
        data: dict[str, Any] = {}
        if http_status is not None:
            data["http_status"] = http_status
        if content_type:
            data["content_type"] = self._limit_text(content_type)
        return data

    def _sanitize(self, value: Any, depth: int = 0) -> Any:
        """限制错误数据的深度、数量和敏感字段，避免错误回显泄露凭证。"""
        if depth >= self._MAX_DEPTH:
            return "[TRUNCATED]"
        if isinstance(value, str):
            return self._limit_text(value)
        if value is None or isinstance(value, (bool, int, float)):
            return value
        if isinstance(value, dict):
            result: dict[str, Any] = {}
            for index, (key, item) in enumerate(value.items()):
                if index >= self._MAX_ITEMS:
                    result["[TRUNCATED]"] = "[TRUNCATED]"
                    break
                key_text = self._limit_text(str(key))
                if self._is_sensitive_key(key_text):
                    result[key_text] = "[REDACTED]"
                else:
                    result[key_text] = self._sanitize(item, depth + 1)
            return result
        if isinstance(value, (list, tuple, set)):
            return [self._sanitize(item, depth + 1) for item in list(value)[: self._MAX_ITEMS]]
        return self._limit_text(str(value))

    def _is_sensitive_key(self, key: str) -> bool:
        """判断字段名是否可能包含凭证或签名。"""
        normalized = key.lower().replace("-", "_")
        return any(part in normalized for part in self._SENSITIVE_KEY_PARTS)

    def _limit_text(self, value: str) -> str:
        """限制错误文本长度。"""
        if len(value) <= self._MAX_TEXT_LENGTH:
            return value
        return f"{value[: self._MAX_TEXT_LENGTH]}..."
