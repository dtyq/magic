"""
Crew Agent 编译器。

crew.template.agent 是 Crew Agent 的基底模板，最终运行的 .agent 由它和用户定义的文件
（IDENTITY.md / AGENTS.md / SOUL.md / TOOLS.md / SKILLS.md）共同编译而成。

工具合成规则：模板默认工具 + TOOLS.md.tools（追加）- TOOLS.md.exclude_builtin_tools（排除）

SKILLS.md 支持的 frontmatter 字段：
  skills:           该 crew 专属技能，覆盖模板 crew_skills（不填保留模板默认 "*"），支持字符串简写或 {name, path?} dict
  system_skills:    追加到模板默认 system_skills（去重），同上格式
  excluded_skills:  从 system_skills 中排除指定技能（字符串列表）
  preload:          追加到模板 preload（按 name 去重）

这是运行时链路，和发布链路（/workspace/export）无关。
完整链路说明见 agents/AGENT_RUNTIME_AND_PUBLISH_GUIDE.md。
"""

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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


def _normalize_skill_entries(raw: Any) -> Optional[List[Dict[str, str]]]:
    """将 SKILLS.md 的 skill 列表字段归一化为 {name, path?} dict 列表。

    支持：
    - 字符串简写：- skill-name
    - dict 格式：- name: skill-name（可选 path 字段）

    返回 None 表示字段未填写，调用方保留模板默认值。
    """
    if raw is None:
        return None
    if not isinstance(raw, list):
        return None

    entries: List[Dict[str, str]] = []
    seen: set[str] = set()
    for item in raw:
        if isinstance(item, str):
            name = item.strip()
            if name and name not in seen:
                entries.append({"name": name})
                seen.add(name)
        elif isinstance(item, dict):
            name = str(item.get("name", "")).strip()
            if not name or name in seen:
                continue
            entry: Dict[str, str] = {"name": name}
            path = item.get("path")
            if path:
                entry["path"] = str(path)
            entries.append(entry)
            seen.add(name)
    return entries


def _merge_skill_entries(
    base: Any,
    additions: List[Dict[str, str]],
) -> Any:
    """将 additions 追加到 base（已有的 skill 列表），按 name 去重。

    base 为 "*" 时直接返回 "*"（全量扫描已包含所有 skill，追加无意义）。
    """
    if base == "*":
        return "*"

    result: List[Dict[str, str]] = []
    seen: set[str] = set()

    if isinstance(base, list):
        for item in base:
            if isinstance(item, dict):
                name = str(item.get("name", "")).strip()
            else:
                name = str(item).strip()
            if name and name not in seen:
                result.append({"name": name} if not isinstance(item, dict) else item)
                seen.add(name)

    for entry in additions:
        name = entry["name"]
        if name not in seen:
            result.append(entry)
            seen.add(name)

    return result


def _merge_preload(base: Any, additions: Any) -> list:
    """将 additions 追加到 base preload 列表，按 name 去重。"""
    if not additions:
        return base if isinstance(base, list) else []

    result = list(base) if isinstance(base, list) else []
    existing_names = set()
    for item in result:
        if isinstance(item, dict):
            existing_names.add(str(item.get("name", "")))
        elif isinstance(item, str):
            existing_names.add(item.strip())

    for item in additions:
        name = item.get("name") if isinstance(item, dict) else str(item).strip()
        if name and name not in existing_names:
            result.append(item)
            existing_names.add(name)

    return result


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
        skills_meta = skills.meta if skills else {}

        header = dict(template.meta)
        header["tools"] = resolve_crew_tools(
            builtin_tools=header.get("tools") or [],
            extra_tools=extra_tools,
            excluded_builtin_tools=excluded_builtin_tools,
        )

        self._apply_skills_meta(header, skills_meta)

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

    def _apply_skills_meta(self, header: Dict[str, Any], skills_meta: Dict[str, Any]) -> None:
        """将 SKILLS.md frontmatter 中的 skills 配置合并写入 header。

        - system_skills：追加到模板默认值（去重）
        - crew_skills：有值则覆盖模板默认值，无值保留模板默认 "*"
        - excluded_skills：有值则覆盖（模板通常无此字段）
        - preload：追加到模板默认值（按 name 去重）
        """
        system_skills_raw = skills_meta.get("system_skills")
        crew_skills_raw   = skills_meta.get("skills")
        excluded_raw      = skills_meta.get("excluded_skills")
        preload_raw       = skills_meta.get("preload")

        skills_header = header.setdefault("skills", {})

        # system_skills：追加
        system_additions = _normalize_skill_entries(system_skills_raw)
        if system_additions:
            skills_header["system_skills"] = _merge_skill_entries(
                skills_header.get("system_skills"), system_additions
            )
            logger.info(f"SKILLS.md 追加 system_skills: {[e['name'] for e in system_additions]}")

        # SKILLS.md 是 crew 创建阶段的配置文件，所以 skills 字段天然就是 crew 的专属技能；
        # 编译为单文件 .agent 后需要加 crew_ 前缀以区分 system/workspace 来源
        crew_entries = _normalize_skill_entries(crew_skills_raw)
        if crew_entries is not None:
            skills_header["crew_skills"] = crew_entries
            logger.info(f"SKILLS.md 覆盖 crew_skills: {[e['name'] for e in crew_entries]}")

        # excluded_skills：有值则覆盖
        if excluded_raw and isinstance(excluded_raw, list):
            excluded = [str(s).strip() for s in excluded_raw if str(s).strip()]
            if excluded:
                skills_header["excluded_skills"] = excluded
                logger.info(f"SKILLS.md 设置 excluded_skills: {excluded}")

        # preload：追加
        if preload_raw:
            skills_header["preload"] = _merge_preload(
                skills_header.get("preload"), preload_raw
            )
            logger.info(f"SKILLS.md 追加 preload 条目")

    def _read_tool_config(self, meta: Dict[str, Any]) -> Tuple[List[str], List[str]]:
        return parse_crew_tool_config(meta)
