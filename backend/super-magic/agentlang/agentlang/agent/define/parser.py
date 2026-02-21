"""Agent 文件解析器

负责从 .agent 文件中提取 YAML frontmatter 并解析为 AgentDefine，
剩余内容作为 prompt 正文返回。

文件格式：
    ---
    llm: main_llm
    attributes: [main]
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
from typing import Any, Dict, List, Optional, Tuple

import yaml

from agentlang.logger import get_logger
from .models import AgentDefine, SkillsConfig, SystemSkillEntry

logger = get_logger(__name__)

_FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n?", re.DOTALL)
_HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)


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
        attributes_config=_parse_attributes(data),
        skills_config=_parse_skills(data),
    )

    prompt = _strip_html_comments(prompt_raw).strip()

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


def _parse_attributes(data: Dict[str, Any]) -> Dict[str, bool]:
    raw = data.get("attributes")
    if raw is None:
        return {}

    if isinstance(raw, list):
        attrs = {str(item).strip(): True for item in raw if item}
    elif isinstance(raw, str):
        attrs = {raw.strip(): True}
    else:
        raise ValueError(f"attributes 字段格式不合法: {type(raw)}")

    logger.debug(f"解析 attributes: {list(attrs.keys())}")
    return attrs


def _parse_skills(data: Dict[str, Any]) -> Optional[SkillsConfig]:
    raw = data.get("skills")
    if raw is None:
        return None

    if not isinstance(raw, dict):
        raise ValueError(f"skills 字段格式不合法，期望 mapping，实际: {type(raw)}")

    system_skills = _parse_system_skills(raw.get("system_skills"))
    crew_skills = _parse_wildcard_source(raw.get("crew_skills"), "crew_skills")
    workspace_skills = _parse_wildcard_source(raw.get("workspace_skills"), "workspace_skills")

    cfg = SkillsConfig(
        system_skills=system_skills,
        crew_skills=crew_skills,
        workspace_skills=workspace_skills,
    )
    logger.debug(
        f"解析 skills: system={[e.name for e in system_skills]}, "
        f"crew={crew_skills}, workspace={workspace_skills}"
    )
    return cfg


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
                    preload=bool(item.get("preload", False)),
                )
            )
        else:
            raise ValueError(f"system_skills 条目格式不合法: {item}")
    return entries


def _parse_wildcard_source(raw: Any, field_name: str) -> Optional[str]:
    """解析 crew_skills / workspace_skills 字段，目前只支持 "*" 或不填。"""
    if raw is None:
        return None
    value = str(raw).strip()
    if value != "*":
        raise ValueError(
            f"{field_name} 字段值不合法，目前只支持 \"*\"，实际: {raw!r}"
        )
    return "*"


def _strip_html_comments(text: str) -> str:
    return _HTML_COMMENT_RE.sub("", text)
