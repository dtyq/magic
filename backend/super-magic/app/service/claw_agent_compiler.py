"""
Claw Agent 编译器。

claw.template.agent 是 Claw Agent 的基底模板，最终运行的 .agent 由它和
.workspace/.magic/ 里的用户定义文件共同编译而成。

和 Crew 不同的地方：IDENTITY.md / SOUL.md / AGENTS.md 不内嵌进系统提示，
而是运行时注入 <magiclaw_startup> 块，要求 Agent 自己去读这些文件。

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
    MarkdownFile,
    async_exists,
    async_read_markdown,
    async_try_read_markdown,
    async_write_text,
)

logger = get_logger(__name__)


def _normalize_tool_names(raw_tools: Any) -> List[str]:
    """Normalize a tool list into a deduplicated, ordered list of non-empty names."""
    if not isinstance(raw_tools, list):
        return []

    seen: set[str] = set()
    normalized: List[str] = []
    for item in raw_tools:
        tool_name = str(item).strip()
        if not tool_name or tool_name in seen:
            continue
        seen.add(tool_name)
        normalized.append(tool_name)
    return normalized


def resolve_claw_tools(
    builtin_tools: Any,
    extra_tools: Any,
    excluded_builtin_tools: Any,
) -> List[str]:
    """Resolve the final claw tool list from builtin, excluded, and extra tools."""
    builtin = _normalize_tool_names(builtin_tools)
    extra = _normalize_tool_names(extra_tools)
    excluded = set(_normalize_tool_names(excluded_builtin_tools))

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


def parse_claw_tool_config(meta: Any, claw_code: str = "") -> Tuple[List[str], List[str]]:
    """Parse claw TOOLS.md frontmatter into extra and excluded builtin tools."""
    if not isinstance(meta, dict):
        if claw_code:
            logger.warning(f"Claw '{claw_code}': TOOLS.md frontmatter is invalid, using builtin tools only")
        return [], []

    extra_tools_raw = meta.get("tools", [])
    if "tools" in meta and not isinstance(extra_tools_raw, list):
        if claw_code:
            logger.warning(f"Claw '{claw_code}': TOOLS.md field 'tools' is not a list, ignoring it")
        extra_tools_raw = []

    has_excluded_builtin_tools = "exclude_builtin_tools" in meta
    excluded_tools_raw = meta.get("exclude_builtin_tools", [])
    if has_excluded_builtin_tools and not isinstance(excluded_tools_raw, list):
        if claw_code:
            logger.warning(
                f"Claw '{claw_code}': TOOLS.md field 'exclude_builtin_tools' is not a list, ignoring it"
            )
        excluded_tools_raw = []

    extra_tools = _normalize_tool_names(extra_tools_raw)
    excluded_tools = _normalize_tool_names(excluded_tools_raw)

    return extra_tools, excluded_tools


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

        extra_tools, excluded_builtin_tools = self._read_tool_config(tools.meta if tools else {}, claw_code)

        compiled = self._build_agent_file(template, extra_tools, excluded_builtin_tools)
        output_path = PathManager.get_compiled_agent_file(claw_code)
        await async_write_text(output_path, compiled)
        logger.info(f"Compiled claw agent: {output_path}")

        return identity.meta

    def _read_tool_config(self, meta: Dict[str, Any], claw_code: str) -> Tuple[List[str], List[str]]:
        return parse_claw_tool_config(meta, claw_code)

    def _build_agent_file(
        self,
        template: MarkdownFile,
        extra_tools: List[str],
        excluded_builtin_tools: List[str],
    ) -> str:
        """把最终工具列表写入 YAML frontmatter，生成可运行的 .agent 文件。"""
        header = dict(template.meta)
        header["tools"] = resolve_claw_tools(
            builtin_tools=header.get("tools") or [],
            extra_tools=extra_tools,
            excluded_builtin_tools=excluded_builtin_tools,
        )
        yaml_str = yaml.dump(header, default_flow_style=False, allow_unicode=True, sort_keys=False)
        return f"---\n{yaml_str}---\n{template.body}"
