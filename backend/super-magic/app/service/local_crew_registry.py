"""Local debug custom agent listing."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

from app.path_manager import PathManager


class LocalCrewRegistry:
    """List local custom crew agents available to the debug client."""

    @classmethod
    def reset(cls) -> None:
        """Compatibility hook for tests; the registry has no in-memory state."""

    @classmethod
    def list_crews(cls) -> list[Dict[str, Any]]:
        agents_dir = PathManager.get_agents_dir()
        crews: dict[str, Dict[str, Any]] = {}

        if agents_dir.exists():
            for agent_file in agents_dir.glob("SMA-*.agent"):
                if agent_file.is_file():
                    crews[agent_file.stem] = cls._list_item(agent_file.stem)

        crew_root_dir = PathManager.get_crew_root_dir()
        if crew_root_dir.exists():
            for crew_dir in crew_root_dir.glob("SMA-*"):
                if crew_dir.is_dir() and (crew_dir / "IDENTITY.md").is_file():
                    crews.setdefault(crew_dir.name, cls._list_item(crew_dir.name))

        return sorted(crews.values(), key=lambda item: item["agent_code"])

    @classmethod
    def _list_item(cls, agent_code: str) -> Dict[str, Any]:
        agent_file = PathManager.get_compiled_agent_file(agent_code)
        crew_dir = PathManager.get_crew_agent_dir(agent_code)
        return {
            "agent_code": agent_code,
            "crew_dir": str(crew_dir),
            "agent_file": str(agent_file),
            "exists": agent_file.exists() or crew_dir.exists(),
            "compiled": agent_file.exists(),
        }
