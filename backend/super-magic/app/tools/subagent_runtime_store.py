from dataclasses import asdict
from pathlib import Path

from agentlang.chat_history.chat_history import ChatHistory
from agentlang.logger import get_logger
from app.core.horizon.store import HorizonStore
from app.path_manager import PathManager
from app.tools.subagent_runtime_models import (
    SubagentSessionConfigBlock,
    SubagentSessionDocument,
    SubagentSessionState,
    SubagentStatus,
    utc_now,
)
from app.utils.async_file_utils import async_exists, async_read_json, async_scandir, async_write_json

logger = get_logger(__name__)


class SubagentRuntimeStore:
    """读取和写入会话级 subagent 运行态。

    本类只拥有 `.session.json` 中的 `subagent` 区域，不拥有整个文件：

        load_document -> 拆出 last/current/subagent/extra_fields
        save_state    -> 只替换 subagent
        save_document -> 把四部分重新合并后写回

    例如 Agent 新增一个 session 顶层字段时，即使本类暂时不认识它，也会放进
    `extra_fields` 原样带回，不会因为记录一次 DONE 状态而丢掉该字段。
    """

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
    def _session_file(cls, agent_name: str, agent_id: str, chat_history_dir: Path | None = None) -> Path:
        if chat_history_dir is None:
            return PathManager.get_subagent_chat_session_file(agent_name, agent_id)
        return chat_history_dir / f"{agent_name}<{agent_id}>.session.json"

    @classmethod
    async def load_document(
        cls,
        agent_name: str,
        agent_id: str,
        chat_history_dir: Path | None = None,
    ) -> SubagentSessionDocument:
        session_file = cls._session_file(agent_name, agent_id, chat_history_dir)
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
    async def save_document(
        cls,
        agent_name: str,
        agent_id: str,
        document: SubagentSessionDocument,
        chat_history_dir: Path | None = None,
    ) -> None:
        session_file = cls._session_file(agent_name, agent_id, chat_history_dir)
        payload = {
            **document.extra_fields,
            "last": asdict(document.last),
            "current": asdict(document.current),
        }
        if document.subagent is not None:
            payload["subagent"] = document.subagent.model_dump(mode="json")
        await async_write_json(session_file, payload, ensure_ascii=False, indent=2)

    @classmethod
    async def load_state(
        cls,
        agent_name: str,
        agent_id: str,
        chat_history_dir: Path | None = None,
    ) -> SubagentSessionState:
        document = await cls.load_document(agent_name, agent_id, chat_history_dir)
        if document.subagent is None:
            return SubagentSessionState(agent_name=agent_name, agent_id=agent_id)
        return document.subagent

    @classmethod
    async def save_state(cls, state: SubagentSessionState, chat_history_dir: Path | None = None) -> None:
        """更新 `subagent` 区域，同时保留 session 文档的其他 owner 数据。"""
        document = await cls.load_document(state.agent_name, state.agent_id, chat_history_dir)
        document.subagent = state
        await cls.save_document(state.agent_name, state.agent_id, document, chat_history_dir)

    @classmethod
    async def session_exists(cls, agent_name: str, agent_id: str) -> bool:
        """任一正式上下文文件存在，都表示该会话已被占用。"""
        chat_history_dir = PathManager.get_subagent_chat_history_dir(agent_name, agent_id)
        paths = (
            ChatHistory.history_path_for_session(agent_name, agent_id, chat_history_dir),
            ChatHistory.session_path_for_session(agent_name, agent_id, chat_history_dir),
            HorizonStore.path_for_session(agent_name, agent_id, chat_history_dir),
        )
        for path in paths:
            if await async_exists(path):
                return True
        return False

    @classmethod
    async def list_agent_ids(cls) -> set[str]:
        """列出正式上下文文件中出现过的全部 Agent ID。

        不依赖 `.session.json` 的内容，因为 ChatHistory 或 Horizon 单独落盘时，
        也已经足以阻止另一个 Agent 复用同一个 ID。
        """
        chat_history_dir = PathManager.get_subagents_chat_history_dir()
        if not await async_exists(chat_history_dir):
            return set()

        agent_ids: set[str] = set()
        for entry in await async_scandir(chat_history_dir):
            if not entry.is_dir():
                continue
            name = entry.name
            if "<" not in name or not name.endswith(">"):
                continue
            agent_ids.add(name.rsplit("<", 1)[1][:-1])
        return agent_ids

    @classmethod
    async def find_states_by_agent_id(cls, agent_id: str) -> list[SubagentSessionState]:
        chat_history_dir = PathManager.get_subagents_chat_history_dir()
        if not await async_exists(chat_history_dir):
            return []
        matches = sorted(
            entry.name
            for entry in await async_scandir(chat_history_dir)
            if entry.is_dir() and entry.name.endswith(f"<{agent_id}>")
        )
        states: list[SubagentSessionState] = []
        for session_dir_name in matches:
            agent_name = session_dir_name.split("<", 1)[0]
            document = await cls.load_document(agent_name, agent_id)
            if document.subagent is not None:
                states.append(document.subagent)
        return states

    @classmethod
    async def find_states_by_agent_ids(cls, agent_ids: list[str]) -> dict[str, list[SubagentSessionState]]:
        """一次扫描目录，批量查多个 agent_id 的会话状态；未命中的 agent_id 对应空列表。

        等待 80 个子 Agent 时逐个调用 find_states_by_agent_id 会把同一个目录扫 80 遍。
        """
        states_by_id: dict[str, list[SubagentSessionState]] = {agent_id: [] for agent_id in agent_ids}
        chat_history_dir = PathManager.get_subagents_chat_history_dir()
        if not states_by_id or not await async_exists(chat_history_dir):
            return states_by_id
        session_dir_names = sorted(
            entry.name
            for entry in await async_scandir(chat_history_dir)
            if entry.is_dir() and entry.name.endswith(">")
        )
        for session_dir_name in session_dir_names:
            agent_name, _, id_part = session_dir_name.rpartition("<")
            agent_id = id_part[:-1]
            if not agent_name or agent_id not in states_by_id:
                continue
            document = await cls.load_document(agent_name, agent_id)
            if document.subagent is not None:
                states_by_id[agent_id].append(document.subagent)
        return states_by_id
