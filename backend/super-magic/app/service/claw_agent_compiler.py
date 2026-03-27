"""
Claw Agent compiler.

Reads claw definition files from agents/claws/<claw_code>/:
  IDENTITY.md  — role definition + agent metadata (required)
  SOUL.md      — personality (optional)
  AGENTS.md    — workspace instructions (optional)
  TOOLS.md     — tools YAML list (optional)

Outputs agents/<claw_code>.agent with real tools in YAML frontmatter and
@include directives pointing to the source files. Developer annotations
(<!--zh -->) are stripped by agentlang's SyntaxProcessor at load time.
"""
from pathlib import Path
from typing import Any, Dict, List

import yaml

from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.utils.async_file_utils import (
    MarkdownFile,
    async_exists,
    async_read_markdown,
    async_try_read_markdown,
    async_write_text,
)

logger = get_logger(__name__)

# 模板中的路径占位符
_PLACEHOLDER_IDENTITY = "CLAW_IDENTITY_PATH"
_PLACEHOLDER_SOUL     = "CLAW_SOUL_PATH"
_PLACEHOLDER_AGENTS   = "CLAW_AGENTS_PATH"


class ClawAgentCompiler:
    """Compiles claw definition files into a .agent file."""

    async def compile(self, claw_code: str, claw_dir: Path) -> Dict[str, Any]:
        """Compile claw directory into agents/<claw_code>.agent.

        Returns:
            identity_meta: parsed YAML frontmatter from IDENTITY.md (name/role/description)

        Raises:
            FileNotFoundError: if IDENTITY.md or claw.template.agent is missing.
        """
        identity_file = claw_dir / "IDENTITY.md"
        if not await async_exists(identity_file):
            raise FileNotFoundError(f"IDENTITY.md not found in {claw_dir}")

        identity = await async_read_markdown(identity_file)
        tools    = await async_try_read_markdown(claw_dir / "TOOLS.md")

        template_path = PathManager.get_claw_template_file()
        if not await async_exists(template_path):
            raise FileNotFoundError(f"Claw template not found: {template_path}")
        template = await async_read_markdown(template_path)

        tools_list = self._read_tools(tools.meta if tools else {}, claw_code)

        rel_base = f"./claws/{claw_code}"
        path_map = {
            _PLACEHOLDER_IDENTITY: f"{rel_base}/IDENTITY.md",
            _PLACEHOLDER_SOUL:     f"{rel_base}/SOUL.md",
            _PLACEHOLDER_AGENTS:   f"{rel_base}/AGENTS.md",
        }

        compiled = self._build_agent_file(template, tools_list, path_map)
        output_path = PathManager.get_compiled_agent_file(claw_code)
        await async_write_text(output_path, compiled)
        logger.info(f"Compiled claw agent: {output_path}")

        return identity.meta

    def _read_tools(self, meta: Dict[str, Any], claw_code: str) -> List[str]:
        tools = meta.get("tools")
        if not tools or not isinstance(tools, list):
            logger.warning(f"Claw '{claw_code}': TOOLS.md has no 'tools:' list, using empty tool set")
            return []
        return [str(t).strip() for t in tools if str(t).strip()]

    def _build_agent_file(
        self, template: MarkdownFile, tools_list: List[str], path_map: Dict[str, str]
    ) -> str:
        """Inject real tools into YAML frontmatter and resolve @include path placeholders.

        Template-level tools (base tools shared by all claw agents) are merged with
        claw-specific tools from TOOLS.md. Template tools come first; duplicates are removed.
        """
        header = dict(template.meta)
        base_tools: List[str] = header.get("tools") or []
        seen: set = set()
        merged: List[str] = []
        for t in base_tools + tools_list:
            if t not in seen:
                seen.add(t)
                merged.append(t)
        header["tools"] = merged
        yaml_str = yaml.dump(header, default_flow_style=False, allow_unicode=True, sort_keys=False)

        body = template.body
        for placeholder, resolved in path_map.items():
            body = body.replace(placeholder, resolved)

        return f"---\n{yaml_str}---\n{body}"
