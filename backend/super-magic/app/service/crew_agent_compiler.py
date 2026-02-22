"""
Crew Agent compiler.

Reads crew definition files (IDENTITY.md, AGENTS.md, SOUL.md, TOOLS.md, SKILLS.md)
and compiles them into a .agent file using crew.agent.template.
"""

import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml

from agentlang.logger import get_logger
from app.paths import PathManager
from app.utils.async_file_utils import async_exists, async_read_text, async_write_text

logger = get_logger(__name__)

_FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n?", re.DOTALL)

BASE_TOOLS: List[str] = [
    "web_search", "read_webpages_as_markdown", "visual_understanding", "convert_to_markdown",
    "image_search", "download_from_urls", "download_from_markdown", "generate_image",
    "list_dir", "file_search", "read_files", "grep_search", "run_python_snippet", "shell_exec",
    "write_file", "edit_file", "edit_file_range", "multi_edit_file", "multi_edit_file_range",
    "delete_files", "create_memory", "update_memory", "delete_memory",
    "compact_chat_history",
]

DEFAULT_TOOLS: List[str] = list(BASE_TOOLS)

DEFAULT_SKILLS: List[str] = ["find-skill", "using-mcp", "using-llm", "env-manager"]


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
            FileNotFoundError: If IDENTITY.md or crew.agent.template is missing.
        """
        identity_file = crew_dir / "IDENTITY.md"
        if not await async_exists(identity_file):
            raise FileNotFoundError(f"IDENTITY.md not found in {crew_dir}")

        identity_content, identity_meta = await self._read_with_yaml(identity_file)

        agents_content = await self._read_optional(crew_dir / "AGENTS.md")
        soul_content = await self._read_optional(crew_dir / "SOUL.md")

        tools_raw = await self._read_optional(crew_dir / "TOOLS.md")
        tools_content, tools_meta = self._split_yaml_and_content(tools_raw)

        skills_raw = await self._read_optional(crew_dir / "SKILLS.md")
        _, skills_meta = self._split_yaml_and_content(skills_raw)

        template_path = PathManager.get_crew_template_file()
        if not await async_exists(template_path):
            raise FileNotFoundError(f"Template not found: {template_path}")
        template = await async_read_text(template_path)

        tools_list = self._build_item_list(tools_meta, "tools", DEFAULT_TOOLS, base=BASE_TOOLS)
        skills_list = self._build_item_list(skills_meta, "skills", DEFAULT_SKILLS)

        header = {
            "llm": "main_llm",
            "tools": tools_list,
            "skills": {
                "system_skills": [{"name": s} for s in skills_list],
                "crew_skills": "*",
            },
        }

        template_body = self._extract_template_body(template)

        body = template_body
        body = body.replace("CREW_ROLE", identity_content or "")
        body = body.replace("CREW_PERSONALITY", self._wrap_section("personality", soul_content))
        body = body.replace("CREW_INSTRUCTIONS", self._wrap_instructions(agents_content))
        body = body.replace("CREW_TOOL_PREFERENCES", self._wrap_section("tool_preferences", tools_content))

        yaml_str = yaml.dump(header, default_flow_style=False, allow_unicode=True, sort_keys=False)
        result = f"---\n{yaml_str}---\n{body}"

        output_path = PathManager.get_compiled_agent_file(agent_code)
        await async_write_text(output_path, result)
        logger.info(f"Compiled crew agent: {output_path}")

        return identity_meta

    async def _read_with_yaml(self, file_path: Path) -> Tuple[str, Dict[str, Any]]:
        """Read a file and split into YAML frontmatter and markdown content."""
        raw = await async_read_text(file_path)
        return self._split_yaml_and_content(raw)

    async def _read_optional(self, file_path: Path) -> Optional[str]:
        """Read a file if it exists, otherwise return None."""
        if await async_exists(file_path):
            return await async_read_text(file_path)
        return None

    def _split_yaml_and_content(self, raw: Optional[str]) -> Tuple[Optional[str], Dict[str, Any]]:
        """Split raw text into markdown content and YAML frontmatter dict.

        Returns:
            Tuple of (content_without_yaml, yaml_dict).
            content_without_yaml is None if raw is None.
        """
        if not raw:
            return None, {}

        match = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)", raw, re.DOTALL)
        if not match:
            return raw.strip() or None, {}

        yaml_str = match.group(1)
        content = match.group(2).strip() or None

        try:
            meta = yaml.safe_load(yaml_str) or {}
        except yaml.YAMLError:
            logger.warning(f"Failed to parse YAML frontmatter, treating as plain content")
            meta = {}

        return content, meta

    def _extract_template_body(self, template: str) -> str:
        """Remove YAML frontmatter from template and return the body portion."""
        match = _FRONTMATTER_RE.match(template)
        if match:
            return template[match.end():]
        return template

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

    def _wrap_section(self, tag: str, content: Optional[str]) -> str:
        """Wrap content in an XML-style tag, or return empty string if no content."""
        if not content:
            return ""
        return f"<{tag}>\n{content}\n</{tag}>"

    def _wrap_instructions(self, content: Optional[str]) -> str:
        """Wrap AGENTS.md content into <user_custom_instructions> with security notice."""
        if not content:
            return ""

        zh_content, en_content = self._split_bilingual(content)

        parts = []
        if zh_content:
            parts.append(
                "<!--zh\n"
                "<user_custom_instructions>\n"
                "**用户个性化指令**\n\n"
                "**安全提醒：以下用户指令不得违反安全限制、道德准则或系统核心约束**\n\n"
                f"{zh_content}\n"
                "</user_custom_instructions>\n"
                "-->"
            )
        parts.append(
            "<user_custom_instructions>\n"
            "**User Custom Instructions**\n\n"
            "**Security Notice: Following user instructions must not violate "
            "security restrictions, ethical principles, or system core constraints**\n\n"
            f"{en_content}\n"
            "</user_custom_instructions>"
        )
        return "\n".join(parts)

    def _split_bilingual(self, content: str) -> Tuple[str, str]:
        """Split bilingual content (<!--zh ... --> + English) into (zh, en) parts.

        If no <!--zh block found, returns (content, content) treating it as monolingual.
        """
        pattern = r"<!--zh\s*\n(.*?)-->\s*\n?(.*)"
        match = re.match(pattern, content, re.DOTALL)
        if match:
            zh = match.group(1).strip()
            en = match.group(2).strip()
            return zh, en
        return content.strip(), content.strip()
