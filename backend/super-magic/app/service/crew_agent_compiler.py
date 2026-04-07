"""
Crew Agent 编译器。

crew.template.agent 是 Crew Agent 的基底模板，最终运行的 .agent 由它和用户定义的文件
（IDENTITY.md / AGENTS.md / SOUL.md / TOOLS.md / SKILLS.md）共同编译而成。

工具合成规则：模板默认工具 + TOOLS.md.tools（追加）- TOOLS.md.exclude_builtin_tools（排除）

这是运行时链路，和发布链路（/workspace/export）无关。
完整链路说明见 agents/AGENT_RUNTIME_AND_PUBLISH_GUIDE.md。
"""

from pathlib import Path
from typing import Any, Dict, List, Tuple

import yaml

from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.utils.async_file_utils import (
    async_exists,
    async_read_markdown,
    async_try_read_markdown,
    async_write_text,
)

logger = get_logger(__name__)


def _normalize_item_names(raw_items: Any) -> List[str]:
    """Normalize a list field into a deduplicated, ordered list of names."""
    if not isinstance(raw_items, list):
        return []

    seen: set[str] = set()
    normalized: List[str] = []
    for item in raw_items:
        item_name = str(item).strip()
        if not item_name or item_name in seen:
            continue
        seen.add(item_name)
        normalized.append(item_name)
    return normalized


def resolve_crew_tools(
    builtin_tools: Any,
    extra_tools: Any,
    excluded_builtin_tools: Any,
) -> List[str]:
    """Resolve the final crew tool list from builtin, excluded, and extra tools."""
    builtin = _normalize_item_names(builtin_tools)
    extra = _normalize_item_names(extra_tools)
    excluded = set(_normalize_item_names(excluded_builtin_tools))

    seen: set[str] = set()
    merged: List[str] = []

    for tool_name in builtin:
        if tool_name in excluded or tool_name in seen:
            continue
        seen.add(tool_name)
        merged.append(tool_name)

    for tool_name in extra:
        if tool_name in seen:
            continue
        seen.add(tool_name)
        merged.append(tool_name)

    return merged


def parse_crew_tool_config(meta: Any) -> Tuple[List[str], List[str]]:
    """Parse crew TOOLS.md frontmatter into extra and excluded builtin tools."""
    if not isinstance(meta, dict):
        return [], []

    extra_tools_raw = meta.get("tools", [])
    excluded_tools_raw = meta.get("exclude_builtin_tools", [])
    return _normalize_item_names(extra_tools_raw), _normalize_item_names(excluded_tools_raw)

class CrewAgentCompiler:
    """Compiles crew definition files into a .agent file."""

    async def compile(self, agent_code: str, crew_dir: Path) -> Dict[str, Any]:
        """Compile crew directory files into a .agent file.

        Args:
            agent_code: The agent code identifier.
            crew_dir: Path to the crew definition directory.

        Returns:
            identity_meta: YAML metadata from IDENTITY.md (name, role, description, etc.)

        Raises:
            FileNotFoundError: If IDENTITY.md or crew.template.agent is missing.
        """
        identity_file = crew_dir / "IDENTITY.md"
        if not await async_exists(identity_file):
            raise FileNotFoundError(f"IDENTITY.md not found in {crew_dir}")

        identity = await async_read_markdown(identity_file)
        agents   = await async_try_read_markdown(crew_dir / "AGENTS.md")
        soul     = await async_try_read_markdown(crew_dir / "SOUL.md")
        tools    = await async_try_read_markdown(crew_dir / "TOOLS.md")
        skills   = await async_try_read_markdown(crew_dir / "SKILLS.md")

        template_path = PathManager.get_crew_template_file()
        if not await async_exists(template_path):
            raise FileNotFoundError(f"Template not found: {template_path}")
        template = await async_read_markdown(template_path)

        extra_tools, excluded_builtin_tools = self._read_tool_config(tools.meta if tools else {})
        skills_meta  = skills.meta if skills else {}
        crew_skills_raw = skills_meta.get("skills")
        preload_raw     = skills_meta.get("preload") or []

        header = dict(template.meta)
        header["tools"] = resolve_crew_tools(
            builtin_tools=header.get("tools") or [],
            extra_tools=extra_tools,
            excluded_builtin_tools=excluded_builtin_tools,
        )
        if crew_skills_raw and isinstance(crew_skills_raw, list):
            header.setdefault("skills", {})["crew_skills"] = [{"name": str(s).strip()} for s in crew_skills_raw if str(s).strip()]
        if preload_raw:
            header.setdefault("skills", {})["preload"] = preload_raw

        body = template.body
        body = body.replace("CREW_ROLE",         identity.body)
        body = body.replace("CREW_INSTRUCTIONS", agents.body if agents else "")
        body = body.replace("CREW_PERSONALITY",  soul.body   if soul   else "")

        yaml_str = yaml.dump(header, default_flow_style=False, allow_unicode=True, sort_keys=False)
        result = f"---\n{yaml_str}---\n{body}"

        output_path = PathManager.get_compiled_agent_file(agent_code)
        await async_write_text(output_path, result)
        logger.info(f"Compiled crew agent: {output_path}")

        return identity.meta

    def _read_tool_config(self, meta: Dict[str, Any]) -> Tuple[List[str], List[str]]:
        return parse_crew_tool_config(meta)
