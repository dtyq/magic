"""MCP per-instance 配置存储

提供 .chat_history/mcp_servers.json 的读写能力。仅做配置持久化，不建连、不 discover。
"""

from .chat_mcp_store import (
    ChatMcpStore,
    ChatMcpStoreEntry,
    UpsertChangeType,
    get_chat_mcp_store,
)

__all__ = [
    "ChatMcpStore",
    "ChatMcpStoreEntry",
    "UpsertChangeType",
    "get_chat_mcp_store",
]
