"""合并应用 YAML 中的默认 Skill 声明，保留 Agent 自身的来源与排除配置。"""

from __future__ import annotations

import copy
from collections import Counter
from dataclasses import dataclass
from pathlib import PurePosixPath

from agentlang.agent.define.models import SkillsConfig, SkillPreloadEntry, SystemSkillEntry
from agentlang.config.config import config
from agentlang.logger import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class RuntimeSkillRule:
    """
    一条声明回答三件事：能否被 Agent 排除、默认展开哪些文件、关键正文读失败怎么办。
    mount_when 目前只支持 always，表示默认具备这项知识，不表示自动执行业务。
    例：自动记忆关闭后，用户仍可要求整理记忆，因此默认挂载和业务开关不能混成条件。
    """
    name: str
    allow_exclude: bool
    preload_files: tuple[str, ...]
    disable_skill_on_preload_failure: bool


@dataclass(frozen=True)
class ResolvedRuntimeSkills:
    """
    skills_config 是本次 Agent 的有效配置；required_preloads 是交给加载器的成功条件。
    此处尚未读任何 Skill 文件，不能据此宣称模型已经得到说明。
    """
    skills_config: SkillsConfig
    required_preloads: dict[str, tuple[str, ...]]


def normalize_preload_path(value: str) -> str:
    """
    路径相对某个 Skill 根目录解释，如 references/reorganize.md；不能借 .. 跳到别的 Skill。
    项目运行在 POSIX 环境，只统一主文件拼写，不把反斜杠猜成 Windows 分隔符。
    """
    path = PurePosixPath(value)
    if not value.strip() or path.is_absolute() or ".." in path.parts or not path.parts:
        raise ValueError("preload file must be a relative path within the skill directory")
    normalized = str(path)
    return "SKILL.md" if normalized.upper() == "SKILL.MD" else normalized


def _load_runtime_rules() -> tuple[RuntimeSkillRule, ...]:
    raw_rules = config.get("skills.runtime", [])
    if not isinstance(raw_rules, list):
        logger.error("skills.runtime 必须为声明列表，本轮不应用默认 Skill")
        return ()
    names = Counter(item.get("name") for item in raw_rules if isinstance(item, dict) and isinstance(item.get("name"), str))
    rules: list[RuntimeSkillRule] = []
    for index, raw in enumerate(raw_rules):
        try:
            if not isinstance(raw, dict):
                raise ValueError("declaration must be an object")
            name = raw["name"]
            if not isinstance(name, str) or not name.strip() or names[name] != 1:
                raise ValueError("skill name must be nonempty and unique")
            if raw["mount_when"] != "always":
                raise ValueError("default skill declarations must use mount_when: always")
            allow_exclude = raw["allow_exclude"]
            disable_on_failure = raw["disable_skill_on_preload_failure"]
            if not isinstance(allow_exclude, bool) or not isinstance(disable_on_failure, bool):
                raise ValueError("skill flags must be booleans")
            files = raw["preload_files"]
            if not isinstance(files, list) or not all(isinstance(path, str) for path in files):
                raise ValueError("preload_files must be a list of relative paths")
            rules.append(RuntimeSkillRule(
                name, allow_exclude,
                tuple(dict.fromkeys(normalize_preload_path(path) for path in files)), disable_on_failure,
            ))
        except (KeyError, TypeError, ValueError) as error:
            logger.error(f"skills.runtime[{index}] 无效，跳过该声明: {error}")
    return tuple(rules)


def resolve_runtime_skills(skills_config: SkillsConfig | None) -> ResolvedRuntimeSkills:
    """
    YAML 声明默认挂载、预加载和是否允许排除；业务自动开关不隐式排除 Skill。
    例如关闭自动同步，只停止定时执行，同步 Skill 仍可指导用户发起的操作。
    这里仅合并配置；文件来源优先级仍由原发现流程决定，实际正文交付仍由 preload 处理。
    deepcopy 防止初始化一个 Agent 时改写共享定义，影响同进程的其它 Agent。
    """
    effective = copy.deepcopy(skills_config) if skills_config is not None else SkillsConfig()
    excluded = list(dict.fromkeys(effective.excluded_skills))
    preloads: dict[str, list[str]] = {}
    for entry in effective.preload:
        preloads.setdefault(entry.name, []).extend(entry.files)
    required: dict[str, tuple[str, ...]] = {}
    for rule in _load_runtime_rules():
        """
        显式排除优先于默认预加载；只有声明了不可排除的基础能力才移除排除项。
        后续仍沿用来源发现顺序，不在这里强行挑某个目录里的同名 Skill。
        """
        if rule.name in excluded:
            if rule.allow_exclude:
                preloads.pop(rule.name, None)
                continue
            excluded.remove(rule.name)
        if isinstance(effective.system_skills, list) and not any(entry.name == rule.name for entry in effective.system_skills):
            effective.system_skills.append(SystemSkillEntry(name=rule.name))
        if rule.preload_files:
            preloads.setdefault(rule.name, []).extend(rule.preload_files)
            if rule.disable_skill_on_preload_failure:
                required[rule.name] = rule.preload_files
    effective.excluded_skills = excluded
    effective.preload = [
        SkillPreloadEntry(name, list(dict.fromkeys(files)))
        for name, files in preloads.items() if name not in excluded
    ]
    return ResolvedRuntimeSkills(effective, required)
