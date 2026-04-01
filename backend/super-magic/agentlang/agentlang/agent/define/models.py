"""Agent 定义数据模型

对应 .agent 文件 YAML frontmatter 中各字段的结构化表示。
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Union


@dataclass
class SystemSkillEntry:
    """system_skills 列表中的单个 skill 条目"""

    name: str
    # 自定义目录路径；不填则按默认规则查找
    path: Optional[str] = None


@dataclass
class SkillPreloadEntry:
    """preload 列表中的单个条目：指定某个 skill 要预加载的文件"""

    name: str
    # 要预加载的文件列表；不填默认加载 SKILL.md
    files: List[str] = field(default_factory=lambda: ["SKILL.md"])


@dataclass
class SkillsConfig:
    """YAML frontmatter 中 skills 字段的完整配置

    三个来源字段（system_skills / crew_skills / workspace_skills）均支持：
    - 不填 / []       → 不加载该来源
    - "*"             → 扫描整个对应目录
    - List[entry]     → 只加载显式列出的条目

    - excluded_skills: 排除的 skill 名称列表；加载后过滤，不进入 prompt
    - preload: 需要预加载文件内容的 skill 列表，与加载方式无关
    """

    system_skills: Union[str, List[SystemSkillEntry]] = field(default_factory=list)
    crew_skills: Union[str, List[SystemSkillEntry]] = field(default_factory=list)
    workspace_skills: Union[str, List[SystemSkillEntry]] = field(default_factory=list)
    excluded_skills: List[str] = field(default_factory=list)
    preload: List[SkillPreloadEntry] = field(default_factory=list)

    def is_empty(self) -> bool:
        return (
            not self.system_skills
            and not self.crew_skills
            and not self.workspace_skills
        )

    def get_system_skill_names(self) -> List[str]:
        if isinstance(self.system_skills, list):
            return [e.name for e in self.system_skills]
        return []


@dataclass
class AgentDefine:
    """Agent 完整定义：YAML frontmatter 解析结果 + 处理后的系统提示"""

    model_id: str
    tools_config: Dict[str, Any]
    skills_config: Optional[SkillsConfig]
    # 经语法处理器处理后的系统提示正文；由 AgentLoader.load_agent 填入
    prompt: str = ""
