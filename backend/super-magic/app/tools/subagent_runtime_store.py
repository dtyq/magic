import json
from typing import Any, Dict, Optional

from agentlang.logger import get_logger
from app.paths import PathManager
from app.tools.subagent_runtime_models import SubagentSessionState
from app.utils.async_file_utils import async_exists, async_iterdir, async_read_json, async_write_json

logger = get_logger(__name__)


class SubagentRuntimeStore:
    """读取和写入会话级 subagent 运行态。"""

    @staticmethod
    def _default_session_document() -> Dict[str, Any]:
        return {
            "last": {
                "model_id": None,
                "image_model_id": None,
                "image_model_sizes": None,
                "mcp_servers": None,
            },
            "current": {
                "model_id": None,
                "image_model_id": None,
                "image_model_sizes": None,
                "mcp_servers": None,
            },
        }

    @classmethod
    async def load_document(cls, agent_name: str, agent_id: str) -> Dict[str, Any]:
        session_file = PathManager.get_subagent_chat_session_file(agent_name, agent_id)
        try:
            if not await async_exists(session_file):
                return cls._default_session_document()
            loaded = await async_read_json(session_file)
            if not isinstance(loaded, dict):
                return cls._default_session_document()
            document = cls._default_session_document() | loaded
            if not isinstance(document.get("last"), dict):
                document["last"] = cls._default_session_document()["last"]
            if not isinstance(document.get("current"), dict):
                document["current"] = cls._default_session_document()["current"]
            return document
        except FileNotFoundError:
            return cls._default_session_document()
        except Exception as e:
            logger.warning(f"读取 subagent 会话文档失败: {e}")
            return cls._default_session_document()

    @classmethod
    async def save_document(cls, agent_name: str, agent_id: str, document: Dict[str, Any]) -> None:
        session_file = PathManager.get_subagent_chat_session_file(agent_name, agent_id)
        await async_write_json(session_file, document, ensure_ascii=False, indent=2)

    @classmethod
    async def load_state(cls, agent_name: str, agent_id: str) -> SubagentSessionState:
        document = await cls.load_document(agent_name, agent_id)
        state = document.get("subagent")
        if not isinstance(state, dict):
            return SubagentSessionState(agent_name=agent_name, agent_id=agent_id)
        try:
            return SubagentSessionState.model_validate(state)
        except Exception:
            return SubagentSessionState(agent_name=agent_name, agent_id=agent_id)

    @classmethod
    async def save_state(cls, state: SubagentSessionState) -> None:
        document = await cls.load_document(state.agent_name, state.agent_id)
        document["subagent"] = state.model_dump()
        await cls.save_document(state.agent_name, state.agent_id, document)

    @classmethod
    async def find_states_by_agent_id(cls, agent_id: str) -> list[SubagentSessionState]:
        chat_history_dir = PathManager.get_subagents_chat_history_dir()
        if not await async_exists(chat_history_dir):
            return []
        matches = sorted(
            path for path in await async_iterdir(chat_history_dir)
            if path.name.endswith(f"<{agent_id}>.session.json")
        )
        states: list[SubagentSessionState] = []
        for session_file in matches:
            agent_name = session_file.name.split("<", 1)[0]
            state = await cls.load_state(agent_name, agent_id)
            if state.created_at or state.started_at or state.finished_at or state.last_tool_call_id or state.active_tool_call_id:
                states.append(state)
        return states
