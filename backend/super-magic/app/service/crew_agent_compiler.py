"""
Crew Agent compiler.

Reads crew definition files (IDENTITY.md, AGENTS.md, SOUL.md, TOOLS.md, SKILLS.md)
and compiles them into a .agent file using crew.template.agent.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional

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

DEFAULT_TOOLS: List[str] = [
    "web_search", "read_webpages_as_markdown", "visual_understanding", "convert_to_markdown",
    "image_search", "download_from_urls", "download_from_markdown", "generate_image",
    "list_dir", "file_search", "read_files", "grep_search", "run_python_snippet", "shell_exec",
    "write_file", "edit_file", "edit_file_range", "multi_edit_file", "multi_edit_file_range",
    "delete_files", "create_memory", "update_memory", "delete_memory",
    "compact_chat_history",
]

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

        tools_list  = self._build_item_list(tools.meta  if tools  else {}, "tools",  DEFAULT_TOOLS,  base=DEFAULT_TOOLS)
        skills_meta  = skills.meta if skills else {}
        crew_skills_raw = skills_meta.get("skills")
        preload_raw     = skills_meta.get("preload") or []

        # 以模板为基准，SKILLS.md 中的 skills 列表覆盖 crew_skills（没有则保持模板默认 *）
        header = dict(template.meta)
        header["tools"] = tools_list
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

    def _build_item_list(
        self, meta: Dict[str, Any], key: str, default: List[str],
        base: Optional[List[str]] = None,
    ) -> List[str]:
        """Build a list of item names from YAML metadata, with fallback to default.

        When *base* is provided and the user supplies a custom list, the result
        is ``base ∪ user_items`` (deduplicated, base order first) so that
        essential items are never accidentally removed.
        """
        items = meta.get(key)
        if not items or not isinstance(items, list):
            return list(default)

        user_items = [str(item).strip() for item in items if str(item).strip()]

        if not base:
            return user_items

        seen: set[str] = set()
        merged: List[str] = []
        for item in list(base) + user_items:
            if item not in seen:
                seen.add(item)
                merged.append(item)
        return merged
