from dataclasses import asdict

from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.tools.subagent_runtime_models import (
    SubagentSessionConfigBlock,
    SubagentSessionDocument,
    SubagentSessionState,
    SubagentStatus,
    utc_now,
)
from app.utils.async_file_utils import async_exists, async_iterdir, async_read_json, async_write_json

logger = get_logger(__name__)


class SubagentRuntimeStore:
    """读取和写入会话级 subagent 运行态。"""

    @staticmethod
    def _default_session_document() -> SubagentSessionDocument:
        return SubagentSessionDocument()

    @classmethod
    def _parse_config_block(cls, value: object) -> SubagentSessionConfigBlock:
        if not isinstance(value, dict):
            return SubagentSessionConfigBlock()
        return SubagentSessionConfigBlock(
            model_id=value.get("model_id"),
            image_model_id=value.get("image_model_id"),
            image_model_sizes=value.get("image_model_sizes"),
            mcp_servers=value.get("mcp_servers"),
        )

    @classmethod
    def _normalize_legacy_subagent_state(cls, value: object) -> object:
        if not isinstance(value, dict):
            return value

        normalized = dict(value)
        created_at = normalized.get("created_at") or utc_now().isoformat()
        normalized["created_at"] = created_at

        status_raw = normalized.get("status")
        try:
            status = SubagentStatus(status_raw) if status_raw is not None else SubagentStatus.IDLE
        except ValueError:
            return normalized

        if status in {SubagentStatus.PENDING, SubagentStatus.RUNNING}:
            normalized["started_at"] = normalized.get("started_at") or created_at

        if status in {SubagentStatus.DONE, SubagentStatus.INTERRUPTED, SubagentStatus.ERROR}:
            started_at = normalized.get("started_at") or created_at
            normalized["started_at"] = started_at
            normalized["finished_at"] = normalized.get("finished_at") or started_at

        return normalized

    @classmethod
    async def load_document(cls, agent_name: str, agent_id: str) -> SubagentSessionDocument:
        session_file = PathManager.get_subagent_chat_session_file(agent_name, agent_id)
        try:
            if not await async_exists(session_file):
                return cls._default_session_document()
            loaded = await async_read_json(session_file)
            if not isinstance(loaded, dict):
                return cls._default_session_document()
            subagent_raw = loaded.get("subagent")
            try:
                normalized_subagent = cls._normalize_legacy_subagent_state(subagent_raw)
                subagent = SubagentSessionState.model_validate(normalized_subagent) if isinstance(normalized_subagent, dict) else None
            except Exception:
                subagent = None
            extra_fields = {
                key: value
                for key, value in loaded.items()
                if key not in {"last", "current", "subagent"}
            }
            return SubagentSessionDocument(
                last=cls._parse_config_block(loaded.get("last")),
                current=cls._parse_config_block(loaded.get("current")),
                subagent=subagent,
                extra_fields=extra_fields,
            )
        except FileNotFoundError:
            return cls._default_session_document()
        except Exception as e:
            logger.warning(f"读取 subagent 会话文档失败: {e}")
            return cls._default_session_document()

    @classmethod
    async def save_document(cls, agent_name: str, agent_id: str, document: SubagentSessionDocument) -> None:
        session_file = PathManager.get_subagent_chat_session_file(agent_name, agent_id)
        payload = {
            **document.extra_fields,
            "last": asdict(document.last),
            "current": asdict(document.current),
        }
        if document.subagent is not None:
            payload["subagent"] = document.subagent.model_dump(mode="json")
        await async_write_json(session_file, payload, ensure_ascii=False, indent=2)

    @classmethod
    async def load_state(cls, agent_name: str, agent_id: str) -> SubagentSessionState:
        document = await cls.load_document(agent_name, agent_id)
        if document.subagent is None:
            return SubagentSessionState(agent_name=agent_name, agent_id=agent_id)
        return document.subagent

    @classmethod
    async def save_state(cls, state: SubagentSessionState) -> None:
        document = await cls.load_document(state.agent_name, state.agent_id)
        document.subagent = state
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
            document = await cls.load_document(agent_name, agent_id)
            if document.subagent is not None:
                states.append(document.subagent)
        return states
