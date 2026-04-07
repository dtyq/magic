"""Agent 文件解析器

负责从 .agent 文件中提取 YAML frontmatter 并解析为 AgentDefine，
剩余内容作为 prompt 正文返回。

文件格式：
    ---
    llm: main_llm
    tools:
      - tool_a
      - tool_b
    skills:
      system_skills:
        - name: skill-creator
        - name: find-skill
          preload: true
      crew_skills: "*"
      workspace_skills: "*"
    ---
    <prompt 正文，可含 <!--zh ... --> 等 HTML 注解>
"""
import re
from typing import Any, Dict, List, Optional, Tuple, Union

import yaml

from agentlang.logger import get_logger
from agentlang.utils.annotation_remover import remove_developer_annotations
from .models import AgentDefine, SkillPreloadEntry, SkillsConfig, SystemSkillEntry

logger = get_logger(__name__)

_FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n?", re.DOTALL)


def parse_agent_file(content: str) -> Tuple[AgentDefine, str]:
    """解析 .agent 文件，返回 (AgentDefine, prompt正文)。

    prompt 正文中的 HTML 注解（如 <!--zh ... -->）会被自动去除，
    动态语法（{{ ... }}）由上层 loader 统一处理，此处不干预。

    Raises:
        ValueError: YAML frontmatter 缺失或必填字段（tools / llm）不存在
    """
    match = _FRONTMATTER_RE.match(content)
    if not match:
        raise ValueError(
            "Agent 文件缺少 YAML frontmatter，请以 --- 开头定义头部配置"
        )

    yaml_text = match.group(1)
    prompt_raw = content[match.end():]

    try:
        data: Dict[str, Any] = yaml.safe_load(yaml_text) or {}
    except yaml.YAMLError as e:
        raise ValueError(f"Agent 文件 YAML frontmatter 解析失败: {e}") from e

    agent_define = AgentDefine(
        model_id=_parse_llm(data),
        tools_config=_parse_tools(data),
        skills_config=_parse_skills(data),
    )

    prompt = remove_developer_annotations(prompt_raw).strip()

    return agent_define, prompt


# ── 各字段解析 ──────────────────────────────────────────────────────────────


def _parse_llm(data: Dict[str, Any]) -> str:
    from agentlang.config import config

    raw = data.get("llm", "")
    if not raw:
        logger.warning("agent 文件 YAML frontmatter 中未找到 llm 字段")
        return ""
    model_str = str(raw).strip()
    resolved = config.resolve_model_alias(model_str)
    logger.debug(f"解析 llm: '{model_str}' -> '{resolved}'")
    return resolved


def _parse_tools(data: Dict[str, Any]) -> Dict[str, Any]:
    raw = data.get("tools")
    if raw is None:
        raise ValueError("agent 文件 YAML frontmatter 中缺少必填字段 tools")

    if isinstance(raw, list):
        tools = {str(item).strip(): {} for item in raw if item}
    elif isinstance(raw, str):
        # 兼容模板占位符，如 CREW_TOOLS
        tools = {raw.strip(): {}}
    else:
        raise ValueError(f"tools 字段格式不合法，期望列表，实际: {type(raw)}")

    logger.debug(f"解析 tools: {list(tools.keys())}")
    return tools


def _parse_skills(data: Dict[str, Any]) -> Optional[SkillsConfig]:
    raw = data.get("skills")
    if raw is None:
        return None

    if not isinstance(raw, dict):
        raise ValueError(f"skills 字段格式不合法，期望 mapping，实际: {type(raw)}")

    system_skills = _parse_skill_source(raw.get("system_skills"), "system_skills")
    crew_skills = _parse_skill_source(raw.get("crew_skills"), "crew_skills")
    workspace_skills = _parse_skill_source(raw.get("workspace_skills"), "workspace_skills")
    excluded_skills = _parse_excluded_skills(raw.get("excluded_skills"))
    preload = _parse_preload(raw.get("preload"))

    def _names(src: object) -> object:
        return src if src == "*" else [e.name for e in src]  # type: ignore[union-attr]

    cfg = SkillsConfig(
        system_skills=system_skills,
        crew_skills=crew_skills,
        workspace_skills=workspace_skills,
        excluded_skills=excluded_skills,
        preload=preload,
    )
    logger.debug(
        f"解析 skills: system={_names(system_skills)}, "
        f"crew={_names(crew_skills)}, workspace={_names(workspace_skills)}, "
        f"excluded={excluded_skills}, preload={[e.name for e in preload]}"
    )
    return cfg


def _normalize_files(raw: Any) -> List[str]:
    """将 preload entry 的 files 字段归一化为文件名列表。

    - None / 不填     → []（调用方按需补默认值）
    - true            → ["SKILL.md"]
    - "QUICK-REF.md"  → ["QUICK-REF.md"]
    - ["A.md", "B.md"] → ["A.md", "B.md"]
    """
    if raw is None:
        return []
    if raw is True:
        return ["SKILL.md"]
    if raw is False:
        return []
    if isinstance(raw, str):
        name = raw.strip()
        return [name] if name else []
    if isinstance(raw, list):
        return [str(f).strip() for f in raw if f and str(f).strip()]
    return []


def _parse_system_skills(raw: Any) -> List[SystemSkillEntry]:
    if raw is None:
        return []

    if isinstance(raw, str):
        # 兼容模板占位符，如 CREW_SKILLS
        return [SystemSkillEntry(name=raw.strip())]

    if not isinstance(raw, list):
        raise ValueError(f"system_skills 字段格式不合法: {type(raw)}")

    entries: List[SystemSkillEntry] = []
    for item in raw:
        if isinstance(item, str):
            entries.append(SystemSkillEntry(name=item.strip()))
        elif isinstance(item, dict):
            name = item.get("name")
            if not name:
                raise ValueError(f"system_skills 条目缺少 name 字段: {item}")
            entries.append(
                SystemSkillEntry(
                    name=str(name).strip(),
                    path=item.get("path") or None,
                )
            )
        else:
            raise ValueError(f"system_skills 条目格式不合法: {item}")
    return entries


def _parse_preload(raw: Any) -> List[SkillPreloadEntry]:
    """解析顶层 preload 字段，返回 SkillPreloadEntry 列表。

    支持写法：
    - 字符串条目：  - using-cron         （等价于 files: [SKILL.md]）
    - 字典条目：    - name: using-cron
                     files: QUICK-REF.md  （或列表）
    """
    if not raw:
        return []
    if not isinstance(raw, list):
        raise ValueError(f"preload 字段格式不合法，期望列表，实际: {type(raw)}")

    entries: List[SkillPreloadEntry] = []
    for item in raw:
        if isinstance(item, str):
            entries.append(SkillPreloadEntry(name=item.strip()))
        elif isinstance(item, dict):
            name = item.get("name")
            if not name:
                raise ValueError(f"preload 条目缺少 name 字段: {item}")
            raw_files = item.get("files")
            files = _normalize_files(raw_files) if raw_files is not None else ["SKILL.md"]
            entries.append(SkillPreloadEntry(name=str(name).strip(), files=files))
        else:
            raise ValueError(f"preload 条目格式不合法: {item}")
    return entries


def _parse_excluded_skills(raw: Any) -> List[str]:
    """解析 excluded_skills 字段，返回要排除的 system skill 名称列表。"""
    if raw is None:
        return []
    if isinstance(raw, list):
        result = []
        for item in raw:
            if not isinstance(item, str):
                raise ValueError(f"excluded_skills 条目格式不合法，期望字符串，实际: {type(item)}")
            name = item.strip()
            if name:
                result.append(name)
        return result
    raise ValueError(f"excluded_skills 字段格式不合法，期望列表，实际: {type(raw)}")


def _parse_skill_source(raw: Any, field_name: str) -> Union[str, List[SystemSkillEntry]]:
    """解析 system_skills / crew_skills / workspace_skills 字段。

    - 不填 / None → []（不加载该来源）
    - "*"          → "*"（扫描整个目录）
    - 列表          → List[SystemSkillEntry]（只加载显式列出的条目）
    """
    if raw is None:
        return []
    if isinstance(raw, str):
        value = raw.strip()
        if value != "*":
            raise ValueError(
                f"{field_name} 字段值不合法，期望 \"*\" 或条目列表，实际: {raw!r}"
            )
        return "*"
    if isinstance(raw, list):
        return _parse_system_skills(raw)
    raise ValueError(f"{field_name} 字段格式不合法，期望字符串或列表，实际: {type(raw)}")


