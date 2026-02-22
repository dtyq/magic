"""Agent 定义数据模型

对应 .agent 文件 YAML frontmatter 中各字段的结构化表示。
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class SystemSkillEntry:
    """system_skills 列表中的单个 skill 条目"""

    name: str
    # 自定义目录路径；不填则按默认规则从 agents/skills/ 查找
    path: Optional[str] = None
    # 是否将 skill 完整内容内联进系统提示；False 时只写入元数据（name/description/location）
    preload: bool = False


@dataclass
class SkillsConfig:
    """YAML frontmatter 中 skills 字段的完整配置

    - system_skills: 显式列出的具名 skill 条目，只加载列出的条目
    - crew_skills: 值为 "*" 时扫描整个 crew skills 目录；None 表示不纳入 prompt
    - workspace_skills: 值为 "*" 时扫描整个 workspace skills 目录；None 表示不纳入 prompt
    """

    system_skills: List[SystemSkillEntry] = field(default_factory=list)
    crew_skills: Optional[str] = None
    workspace_skills: Optional[str] = None

    def is_empty(self) -> bool:
        return (
            not self.system_skills
            and self.crew_skills is None
            and self.workspace_skills is None
        )

    def get_system_skill_names(self) -> List[str]:
        return [e.name for e in self.system_skills]


@dataclass
class AgentDefine:
    """Agent 完整定义：YAML frontmatter 解析结果 + 处理后的系统提示"""

    model_id: str
    tools_config: Dict[str, Any]
    skills_config: Optional[SkillsConfig]
    # 经语法处理器处理后的系统提示正文；由 AgentLoader.load_agent 填入
    prompt: str = ""
