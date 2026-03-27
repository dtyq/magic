from app.i18n import i18n
import asyncio
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional, List, Tuple

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from agentlang.llms.factory import LLMFactory
from agentlang.utils.retry import retry_with_exponential_backoff
from agentlang.utils.tool_param_utils import parse_multiline_kv
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.core.context.agent_context import AgentContext
from app.core.entity.message.server_message import DisplayType, FileContent, TerminalContent, ToolDetail
from app.utils.async_file_utils import async_copy2, async_exists, async_write_text, async_read_text, async_try_read_text

logger = get_logger(__name__)

# Import all prompts from separate file
from .analyze_audio_project_prompts import (
    # 通用片段 - 格式规范与输出原则
    SPEAKER_IDENTIFIER_REQUIREMENTS,        # 说话人标识要求（Speaker-N 格式）
    DIALOGUE_QUOTE_FORMAT,                  # 对话引用格式规范
    TIME_SLICE_RULES,                       # 时间片段规则
    UNIVERSAL_OUTPUT_PRINCIPLES,            # 通用输出原则
    INTERVIEW_EVALUATION_PRINCIPLES,        # 面试评估原则（面试场景专用）
    THREE_EXPERTS_COLLABORATION_BASE,       # 三专家协作模式基础模板
    EXPERT_ROLE_OVERVIEW,                   # 专家角色：整体概述
    EXPERT_ROLE_DEEP_ANALYSIS,              # 专家角色：深入分析
    EXPERT_ROLE_STRUCTURED,                 # 专家角色：结构化提取
    QUALITY_SELF_CHECK_GENERAL,             # 质量自检：通用场景
    QUALITY_SELF_CHECK_MEETING,             # 质量自检：会议场景
    QUALITY_SELF_CHECK_PROFESSIONAL,        # 质量自检：专业场景
    WORD_COUNT_OVERVIEW,                    # 字数要求：整体概述
    WORD_COUNT_REQUIREMENTS,                # 字数要求：深入分析
    WORD_COUNT_STRUCTURED,                  # 字数要求：结构化提取
    # 章节分析提示词
    TOPICS_IDENTIFICATION_PROMPT,           # 主题识别提示词（第一段）
    SINGLE_TOPIC_ANALYSIS_PROMPT,           # 单主题详细分析提示词（第二段）
    # 内容总结提示词（9种场景）
    SUMMARY_PROMPTS,                        # 内容总结提示词字典（包含所有场景）
    # 面试预评估提示词
    PRE_EVALUATION_SYSTEM_PROMPT,           # 面试预评估：系统提示词
    PRE_EVALUATION_USER_REQUIREMENTS,       # 面试预评估：用户需求
    # 可选分析提示词 - 待办事项
    FOLLOWUP_SYSTEM_PROMPT,                 # 待办事项：系统提示词
    FOLLOWUP_USER_REQUIREMENTS,             # 待办事项：用户需求
    # 可选分析提示词 - 权力动态
    POWER_DYNAMICS_SYSTEM_PROMPT,           # 权力动态：系统提示词
    POWER_DYNAMICS_USER_REQUIREMENTS,       # 权力动态：用户需求
    # 可选分析提示词 - 意图分析
    INTENT_SYSTEM_PROMPT,                   # 意图分析：系统提示词
    INTENT_USER_REQUIREMENTS,               # 意图分析：用户需求
    # 可选分析提示词 - 量化数据
    METRICS_SYSTEM_PROMPT,                  # 量化数据：系统提示词
    METRICS_USER_REQUIREMENTS,              # 量化数据：用户需求
    # 可选分析提示词 - 思维导图
    MINDMAP_SYSTEM_PROMPT,                  # 思维导图：系统提示词
    MINDMAP_USER_REQUIREMENTS,              # 思维导图：用户需求
    # 可选分析提示词 - 深度洞察
    INSIGHTS_SYSTEM_PROMPT,                 # 深度洞察：系统提示词
    INSIGHTS_USER_REQUIREMENTS,             # 深度洞察：用户需求
    # 可选分析提示词 - 金句分析
    HIGHLIGHTS_SYSTEM_PROMPT,               # 金句分析：系统提示词
    HIGHLIGHTS_USER_REQUIREMENTS,           # 金句分析：用户需求
)


# 默认模型（代码兜底，优先从 ai_abilities 配置读取）
DEFAULT_MODEL_ID = "qwen3.5-flash"

# 标签提取模型（使用快速模型）
TAG_EXTRACTION_MODEL_ID = "qwen-flash"

# 分析任务名称映射（中文 -> 英文）
ANALYSIS_TASK_NAME_MAP = {
    "topics": {"cn": "章节主题分析", "en": "Chapter Topics"},
    "summary": {"cn": "会议总结", "en": "Summary"},
    "followup": {"cn": "待办事项", "en": "Follow-up"},
    "power_dynamics": {"cn": "权力动态分析", "en": "Power Dynamics"},
    "intent": {"cn": "意图分析", "en": "Intent Analysis"},
    "metrics": {"cn": "关键量化数据", "en": "Metrics"},
    "mindmap": {"cn": "思维导图", "en": "Mind Map"},
    "insights": {"cn": "深度洞察", "en": "Insights"},
    "highlights": {"cn": "金句分析", "en": "Highlights"},
}


@dataclass
class AnalysisContext:
    """
    Analysis context data for LLM calls

    Encapsulates all context information needed for audio analysis,
    making it easy to extend with new fields in the future.
    """
    metadata: Dict[str, Any]  # Audio recording metadata (name, title, duration, speakers, etc.)
    transcript: str  # Audio transcript content
    output_language: str  # Output language for analysis results
    transcript_correction_guidance: str  # Guidance for transcript correction in analysis output
    context_contents: Dict[str, str] = field(default_factory=dict)  # Additional context files (notes, docs, etc.)
    user_additional_requirements: Optional[str] = None  # User's additional analysis requirements
    speakers_mapping: Dict[str, str] = field(default_factory=dict)  # Speaker ID to name/role mapping (for understanding only)
    extra_context: Dict[str, str] = field(default_factory=dict)  # Extra context for specific scenes (e.g., pre_evaluation for job_interview)


@dataclass
class TopicOutline:
    """
    主题大纲（第一段识别结果）

    轻量级结构，只包含主题的基本信息，不包含详细分析内容。
    用于第一段：让AI快速识别整个音频的主题分布。
    """
    topic_id: str  # 主题ID，如 "opening_remarks"
    topic_name: str  # 主题名称，如 "开场与背景介绍"
    start_seconds: int  # 开始时间（秒）
    end_seconds: int  # 结束时间（秒）
    color: str  # 颜色代码，如 "#e0e0e0"


@dataclass
class TopicDetail:
    """
    主题详细分析（第二段分析结果）

    完整结构，包含主题的所有详细信息。
    用于第二段：针对单个主题进行深度分析。
    """
    topic_id: str
    topic_name: str
    color: str
    speakers: List[str]  # 主要参与者列表
    summary: str  # 要点总结内容（纯文本）
    dialogue_items: List[str]  # 关联对话列表（格式化文本）
    start_seconds: int
    end_seconds: int


# ==================== 章节分析提示词（两段式）====================

# 第一段：主题识别提示词
TOPICS_IDENTIFICATION_PROMPT = """请分析录音内容，识别不同的讨论主题，并按以下格式输出主题大纲。

## 🎯 核心任务

你的任务是 **识别主题边界**，而不是详细分析内容。
- 仔细浏览全文，找到真实的话题转换点
- 给每个主题一个清晰的名称和时间范围
- 根据实际对话内容决定主题数量（不要被限制）

## 📋 主题划分原则

**核心：尊重对话的自然节奏**

1. **话题转换即切分**：话题讨论多久主题就覆盖多久，不人为合并或拆分
2. **灵活把握粒度**：可多可少，避免过度零碎，实际内容优先
3. **完整覆盖**：从 00:00 到结束，无缝衔接，无遗漏

## 📝 输出格式（严格遵守）

```
## 主题列表

1. topic_id_1 | 主题名称1 | 00:00-15:30 | #e0e0e0
2. topic_id_2 | 主题名称2 | 15:30-35:00 | #a8d5f7
3. topic_id_3 | 主题名称3 | 35:00-50:00 | #b8e6cf
...
```

**格式说明**：
- 序号：从1开始
- topic_id：**使用英文单词加连字符命名**（kebab-case 风格）
  - ✅ 正确：cdn-cache-strategy, http-mechanism, tech-discussion, opening-remarks
  - ❌ 错误：cdn缓存策略, 技术讨论, cdn cache（禁止中文、空格）
- 主题名称：简洁（10字内），可以使用任何语言
- **时间范围**：`MM:SS-MM:SS`（分钟:秒数，支持三位数，禁用小时格式）
- 颜色代码：
  - `#e0e0e0` 浅灰（开场、总结）
  - `#a8d5f7` 浅蓝（技术、方案）
  - `#b8e6cf` 浅绿（进展、成果）
  - `#ffd9b3` 浅橙（问题、讨论）
  - `#d4c5f0` 浅紫（规划、未来）
  - `#ffcbd1` 浅红（风险、挑战）

## ⚠️ 硬性要求

1. **时间**：从 00:00 开始，无缝衔接，到达音频总时长
2. **命名**：
   - topic_id：使用 kebab-case 命名（英文单词+连字符），如 opening-remarks, tech-discussion
   - 主题名称：简洁（10字内），可使用任何语言
3. **数量**：根据实际情况自由决定，无上下限

现在请开始分析，输出主题列表：
"""

# 第二段：单主题详细分析提示词
SINGLE_TOPIC_ANALYSIS_PROMPT = """请对以下主题进行详细分析，输出标准格式的主题块。

## 📋 主题信息

主题ID: {topic_id} | 名称: {topic_name} | 时间: {start_time}-{end_time} | 颜色: {color}

## 📝 输出格式（严格遵守）

```markdown
### 📌 {topic_id} | {topic_name} | {color}

#### 要点总结

[Speaker-X, Speaker-Y]

（1-2段连贯文字，100-150字，概括本主题的核心内容）

#### 关联对话

- `MM:SS-MM:SS` Speaker-X: 总结性描述（根据时长合理控制字数）
- `MM:SS-MM:SS` Speaker-X, Speaker-Y: 总结性描述
...
```

## ⚠️ 核心要求

1. **要点总结**：首行 `[Speaker-X, ...]`，后接1-2段文字（100-150字）

2. **关联对话**：
   - 总结性描述，非逐句摘抄
   - 根据主题时长合理分配条目数量和范围
   - 避免碎片化

3. **时间**：
   - 必须在 {start_time} - {end_time} 范围内
   - 格式 `MM:SS-MM:SS`（支持三位数分钟，禁用小时格式）

4. **说话人**：
   - 使用 Speaker-N 标识（严禁角色名、真名）
   - 占比极小可能是识别误差，结合上下文判断是否为已有说话人

## 📄 录音文字稿（本主题时间段）

```
{transcript_segment}
```

现在请开始分析，直接输出主题块（不要有任何解释）：
"""


class AnalyzeAudioProjectParams(BaseToolParams):
    """分析音频项目参数"""

    project_path: str = Field(
        ...,
        description="""<!--zh: 音频项目文件夹路径，例如：'产品评审会议_20250109_140000'-->
Audio project folder path, e.g., 'Product_Review_Meeting_20250109_140000'"""
    )

    output_language: str = Field(
        ...,
        description="""<!--zh: 分析结果输出语言。默认使用用户偏好语言（中文用户传'中文'，英文用户传'English'）。用户明确要求其他语言时传入指定语言（如'日本語'、'한국어'、'Français'等）。-->
Analysis result output language. Default to user preferred language (Chinese users pass '中文', English users pass 'English'). When user explicitly requests other language, pass specified language (e.g., '日本語', '한국어', 'Français', etc.)"""
    )

    context_files: List[str] = Field(
        default_factory=list,
        description="""<!--zh
附加上下文文件列表（相对于工作空间根目录的路径）。

这些文件会被读取并作为附加上下文传递给分析模型，帮助模型更好地理解对话内容。

必传文件：
- 录音转写文字稿（自动从 magic.project.js 读取，不需要在此列表中）

可选文件示例：
- 用户笔记：通常在音频项目文件夹内，如 "产品评审会议_20250109_140000/产品评审会议-笔记.md"
- 项目文档：可能在工作空间的其他位置，如 "项目文档/项目背景.md"、"技术方案/架构设计.md"
- 其他相关文件：任何你认为有助于分析的文件

使用示例：
[
    "项目文档/项目背景.md",
    "技术方案/架构设计.md"
]

注意：
1. 路径是相对于工作空间根目录，不是相对于音频项目文件夹
2. 录音转写文字稿会自动包含，不需要在此列表中
3. 文件不存在时会跳过（记录警告），不影响分析
4. 大文件可能影响分析效率和成本
5. 上下文传递顺序：录音转写 → 笔记 → 其他文件
-->
Additional context file list (paths relative to workspace root).

These files will be read and passed as additional context to analysis model, helping model better understand dialogue content.

Required files:
- Audio transcript (automatically read from magic.project.js, no need in this list)

Optional file examples:
- User notes: Usually in audio project folder, e.g., "Product_Review_Meeting_20250109_140000/Product_Review_Meeting-Notes.md"
- Project docs: May be elsewhere in workspace, e.g., "project-docs/project-background.md", "tech-specs/architecture.md"
- Other related files: Any files you think helpful for analysis

Usage example:
[
    "project-docs/project-background.md",
    "tech-specs/architecture.md"
]

Notes:
1. Paths are relative to workspace root, not audio project folder
2. Audio transcript automatically included, no need in this list
3. Non-existent files will be skipped (logged as warning), doesn't affect analysis
4. Large files may affect analysis efficiency and cost
5. Context passing order: transcript → notes → other files
"""
    )

    user_additional_requirements: Optional[str] = Field(
        default=None,
        description="""<!--zh
用户的额外分析需求（可选，自由文本）。

在标准分析流程之外，用户对分析的任何额外要求或指示，用于指导分析过程。
可以是关注点、输出方式、特定角度、语言风格等任何合理需求。

特点：
- 可选参数，不传递时按标准流程分析
- 会应用于所有分析任务（章节、总结、可选分析等）
- 工具会在标准分析基础上尝试满足这些额外要求
-->
User's additional analysis requirements (optional, free text).

Beyond standard analysis process, any extra requirements or instructions from user to guide analysis process.
Can be focus points, output methods, specific perspectives, language style, or any reasonable requirements.

Characteristics:
- Optional parameter, follows standard process when not passed
- Applied to all analysis tasks (chapters, summary, optional analysis, etc.)
- Tool attempts to meet these extra requirements based on standard analysis
"""
    )

    transcript_correction_guidance: str = Field(
        ...,
        description="""<!--zh
转写纠错指导（必填，自由文本）。
作用：只纠正分析输出表述；请勿修改/重写原始转写。
要求：
- 必传；若无明显错误，写“未发现明显识别错误，按原文语义理解”。
- 子模型直接遵循本指导，不做二次判断。

Few-shot:
1) "'龙虾 Open Cloud' 实际是开源项目 OpenClaw (俗称 '龙虾'), 输出统一写 OpenClaw."
2) "'超级麦咭' 应为 '超级麦吉', 两者指同一产品名, 统一写 '超级麦吉'."
3) "'天枢' 应为 '天书', 按 '天书' 理解并输出."
4) "未发现明显识别错误, 按原文语义理解, 不额外猜测纠正."
-->
Transcript correction guidance (required, free text).
Scope: correct analysis output wording only; never modify/rewrite original transcript.
Rules:
- Always pass this field. If no obvious error: "No obvious recognition error found; follow original transcript semantics."
- Sub-model must follow this guidance directly (no second-guessing).

Few-shot:
1) "'龙虾 Open Cloud' refers to the open-source project OpenClaw (nickname: 龙虾); use OpenClaw consistently."
2) "'超级麦咭' should be corrected to '超级麦吉'; they refer to the same product name."
3) "'天枢' should be interpreted as '天书'."
4) "No obvious recognition error found; follow original transcript semantics and avoid speculative correction."
"""
    )

    specified_analysis_types: Optional[str] = Field(
        default=None,
        description="""<!--zh
指定要分析的类型及文件名（可选，多行 key:value 格式）

**重要**：仅当用户明确提出"只分析某些类型"或"重新生成某个分析"或"新增某个分析"时才需要传递此参数。

格式：每行一个 分析类型:文件名 键值对

可选值：
- topics: 章节主题分析
- summary: 内容总结
- followup: 待办事项
- power_dynamics: 权力动态分析
- intent: 意图分析
- metrics: 关键量化数据（使用 .html 扩展名）
- mindmap: 思维导图
- insights: 深度洞察
- highlights: 金句分析

示例（重新分析已有）：
topics:产品评审会议-章节主题.md
summary:产品评审会议-纪要.md

示例（新增分析）：
insights:产品评审会议-洞察.md
highlights:产品评审会议-金句.md

示例（混合：重新分析+新增）：
summary:产品评审会议-纪要.md
insights:产品评审会议-洞察.md
mindmap:产品评审会议-思维导图.md

行为：
- 不传递（默认）: 分析项目配置中的所有类型
- 传递指定类型: 仅分析指定的类型，配置中不存在的会自动追加

文件名要求：
- 使用用户语言（中文/英文/日文等）
- Markdown 文件用 .md 扩展名
- HTML 文件（metrics）用 .html 扩展名

使用场景：
- 用户说"只生成总结"："summary:产品评审会议-纪要.md"
- 用户说"重新分析章节"："topics:产品评审会议-章节主题.md"
- 用户说"新增洞察分析"："insights:产品评审会议-洞察.md"
-->
Specify analysis types and filenames to analyze (optional, multi-line key:value format)

**Important**: Only pass this parameter when user explicitly requests "analyze only certain types" or "regenerate specific analysis" or "add new analysis".

Format: one analysis_type:filename pair per line

Available values:
- topics: Chapter topics analysis
- summary: Content summary
- followup: Follow-up tasks
- power_dynamics: Power dynamics analysis
- intent: Intent analysis
- metrics: Key quantitative data (use .html extension)
- mindmap: Mind map
- insights: Deep insights
- highlights: Highlight analysis

Example (reanalyze existing):
topics:Product_Review_Meeting-Topics.md
summary:Product_Review_Meeting-Minutes.md

Example (add new):
insights:Product_Review_Meeting-Insights.md
highlights:Product_Review_Meeting-Highlights.md

Example (mixed: reanalyze + add new):
summary:Product_Review_Meeting-Minutes.md
insights:Product_Review_Meeting-Insights.md
mindmap:Product_Review_Meeting-Mindmap.md

Behavior:
- Not passed (default): Analyze all types in project configuration
- Pass specified types: Only analyze specified types, non-existent in config will be auto-appended

Filename requirements:
- Use user language (Chinese/English/Japanese etc.)
- Markdown files use .md extension
- HTML files (metrics) use .html extension

Usage scenarios:
- User says "only generate summary": "summary:Product_Review_Meeting-Minutes.md"
- User says "reanalyze chapters": "topics:Product_Review_Meeting-Topics.md"
- User says "add insights analysis": "insights:Product_Review_Meeting-Insights.md"
"""
    )


@tool()
class AnalyzeAudioProject(AbstractFileTool[AnalyzeAudioProjectParams], WorkspaceTool[AnalyzeAudioProjectParams]):
    """<!--zh
    执行音频分析，并行调用多个AI智能体执行生成章节分析、内容总结及可选分析（权力动态、意图、量化数据、思维导图、洞察、金句）文件。
    最后生成 index.html 完成 Magic Project 构建。
    -->
    Execute audio analysis, parallel calling multiple AI agents to generate chapter analysis, content summary and optional analysis (power dynamics, intent, quantitative data, mind map, insights, highlights) files.
    Finally generate index.html to complete Magic Project construction.
    """

    async def execute(self, tool_context: ToolContext, params: AnalyzeAudioProjectParams) -> ToolResult:
        """
        执行音频分析操作

        Args:
            tool_context: 工具上下文
            params: 参数对象

        Returns:
            ToolResult: 包含分析结果的详细信息
        """
        try:
            # 1. 从 ai_abilities 动态配置获取 model_id
            from app.core.ai_abilities import get_analysis_audio_model_id
            model_id = get_analysis_audio_model_id()
            logger.info(f"使用模型进行音频分析: {model_id}")

            # 2. 获取安全路径
            project_path = self.resolve_path(params.project_path)
            # 3. 读取项目配置
            config = await self._load_project_config(project_path)
            if not config:
                return ToolResult.error(f"无法读取项目配置文件: {project_path}/magic.project.js")

            # 4. 读取录音文字稿（必须）
            transcript_file = config.get("files", {}).get("transcript")
            if not transcript_file:
                return ToolResult.error("项目配置中缺少文字稿文件路径")

            transcript_path = project_path / transcript_file
            transcript = await async_try_read_text(transcript_path)
            if not transcript:
                return ToolResult.error(f"无法读取文字稿文件: {transcript_path}，此文件是必须的")

            # 5. 校验转写纠错指导（必填，且不允许空字符串）
            transcript_correction_guidance = params.transcript_correction_guidance.strip()
            if not transcript_correction_guidance:
                return ToolResult.error("参数 transcript_correction_guidance 不能为空。即使未发现错误，也请传入说明。")

            # 6. 读取附加上下文文件（可选）
            context_contents = await self._read_context_files(project_path, params.context_files, config)
            logger.info(f"读取到 {len(context_contents)} 个附加上下文文件")

            # 7. 准备分析上下文对象（传递给大模型）
            # 读取 speakers 映射（确保总是字典，即使为空）
            speakers_mapping = config.get("metadata", {}).get("speakers") or {}

            analysis_context = AnalysisContext(
                metadata={
                    "name": config.get("name", ""),
                    "metadata": config.get("metadata", {})
                },
                transcript=transcript,
                output_language=params.output_language,
                transcript_correction_guidance=transcript_correction_guidance,
                context_contents=context_contents,
                user_additional_requirements=params.user_additional_requirements,
                speakers_mapping=speakers_mapping
            )
            logger.info(f"准备分析上下文：{analysis_context.metadata.get('name', 'Unknown')}")
            logger.info(f"说话人映射：{speakers_mapping if speakers_mapping else '（空）'}")
            if params.user_additional_requirements:
                logger.info(f"用户额外需求：{params.user_additional_requirements}")
            logger.info("已接收转写纠错指导，将透传给分析模型")

            # 8. 从配置中读取场景类型，如果没有则智能推断
            scene_type = config.get("metadata", {}).get("scene_type")
            if not scene_type:
                logger.info("配置中未找到 scene_type，开始智能推断")
                scene_type = await self._infer_scene_type(model_id, analysis_context)
                logger.info(f"推断场景类型：{scene_type}")

                # 将推断结果写回配置
                await self._update_scene_type_in_config(tool_context, project_path, scene_type)
            else:
                logger.info(f"场景类型（从配置读取）：{scene_type}")

            # 8. 准备并行任务
            tasks = []
            task_names = []

            # 可选分析函数映射
            optional_map = {
                "followup": lambda: self._analyze_followup(model_id, analysis_context),
                "power_dynamics": lambda: self._analyze_power_dynamics(model_id, analysis_context),
                "intent": lambda: self._analyze_intent(model_id, analysis_context),
                "metrics": lambda: self._analyze_metrics(model_id, analysis_context),
                "mindmap": lambda: self._analyze_mindmap(model_id, analysis_context),
                "insights": lambda: self._analyze_insights(model_id, analysis_context),
                "highlights": lambda: self._analyze_highlights(model_id, analysis_context),
            }

            config_files = config.get("files", {})

            # 确定要执行的分析类型
            new_files_mapping = {}  # 记录新增的文件映射

            if params.specified_analysis_types is None:
                # 默认模式：执行所有配置的分析
                types_to_analyze = ["topics", "summary"]
                # 添加配置中的可选分析
                for key in optional_map.keys():
                    if key in config_files:
                        types_to_analyze.append(key)
                logger.info("默认模式：分析所有配置的类型")
            else:
                # 指定模式：解析 key:value 格式
                parsed_types = parse_multiline_kv(params.specified_analysis_types, "specified_analysis_types")
                types_to_analyze = list(parsed_types.keys())

                # 找出配置中不存在的新类型
                for analysis_type, filename in parsed_types.items():
                    if analysis_type not in config_files:
                        new_files_mapping[analysis_type] = filename
                        # 临时添加到 config 中（供 _write_analysis_file 使用）
                        config["files"][analysis_type] = filename
                        logger.info(f"检测到新分析类型: {analysis_type} -> {filename}")

                logger.info(f"指定模式：分析 {types_to_analyze}，其中新增 {len(new_files_mapping)} 个类型")

            # 按需添加任务
            if "topics" in types_to_analyze:
                tasks.append(self._analyze_topics(model_id, analysis_context))
                task_names.append("topics")

            if "summary" in types_to_analyze:
                tasks.append(self._analyze_summary(model_id, analysis_context, scene_type))
                task_names.append("summary")

            # 添加可选分析任务
            for analysis_type in types_to_analyze:
                if analysis_type in optional_map:
                    # 检查配置中是否有对应的文件定义
                    if analysis_type in config_files:
                        tasks.append(optional_map[analysis_type]())
                        task_names.append(analysis_type)
                    else:
                        logger.warning(f"分析类型 {analysis_type} 未在项目配置中定义，已跳过")

            if not tasks:
                return ToolResult.error("没有可执行的分析任务，请检查 specified_analysis_types 参数")

            logger.info(f"准备执行 {len(tasks)} 个分析任务: {task_names}")

            # 9. 并行执行所有任务
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # 10. 写入分析结果文件
            success_count = 0
            failed_tasks = []
            summary_content = None  # 保存 summary 内容用于标签提取

            for i, (task_name, result) in enumerate(zip(task_names, results)):
                if isinstance(result, Exception):
                    logger.error(f"分析任务 {task_name} 失败: {result}")
                    failed_tasks.append(task_name)
                else:
                    try:
                        await self._write_analysis_file(tool_context, project_path, task_name, config, result)
                        success_count += 1
                        logger.info(f"分析任务 {task_name} 完成并写入文件")

                        # 如果是 summary 任务成功，保存内容用于标签提取
                        if task_name == "summary":
                            summary_content = result
                            logger.info("Summary 任务完成，准备提取标签")
                    except Exception as e:
                        logger.error(f"写入分析文件 {task_name} 失败: {e}")
                        failed_tasks.append(task_name)

            # 10.5. 如果 summary 成功生成，立即提取标签并更新配置
            if summary_content and "summary" not in failed_tasks:
                try:
                    logger.info("开始从 summary 提取精炼标签")
                    tags = await self._extract_tags_from_summary(
                        summary_content=summary_content,
                        audio_title=analysis_context.metadata.get("name", ""),
                        output_language=params.output_language
                    )

                    if tags:
                        await self._update_tags_in_config(tool_context, project_path, tags)
                        logger.info(f"✅ 标签提取和更新成功: {tags}")
                    else:
                        logger.warning("标签提取返回空列表")
                except Exception as e:
                    logger.warning(f"标签提取或更新失败: {e}，不影响主流程")

            # 11. 检查核心任务是否完成（至少要有一个核心任务成功）
            core_tasks = ["topics", "summary"]
            completed_core_tasks = [task for task in core_tasks if task in task_names and task not in failed_tasks]

            if not completed_core_tasks and any(task in task_names for task in core_tasks):
                # 如果有核心任务在计划中，但全部失败了
                failed_core_tasks = [task for task in core_tasks if task in task_names and task in failed_tasks]
                error_msg = f"核心分析任务全部失败: {', '.join(failed_core_tasks)}。至少需要完成 topics 或 summary 中的一个。"
                logger.error(error_msg)
                return ToolResult.error(error_msg)

            logger.info(f"核心任务完成情况: {completed_core_tasks}")

            # 12. 如果有新增的分析类型，更新配置文件
            if new_files_mapping:
                try:
                    await self._update_config_with_new_files(tool_context, project_path, new_files_mapping)
                    logger.info(f"配置文件已更新，新增 {len(new_files_mapping)} 个分析类型")
                except Exception as e:
                    logger.error(f"更新配置文件失败: {e}")
                    # 不影响分析结果，继续执行

            # 13. 复制可视化界面文件（在所有分析完成后）
            try:
                await self._copy_visualization_template(tool_context, project_path)
                logger.info("可视化界面文件已创建")
            except Exception as e:
                logger.error(f"复制可视化界面失败: {e}")
                # 这不影响分析结果，继续执行

            # 13. 生成结果报告
            result_content = self._generate_report(
                project_path.name,
                success_count,
                len(tasks),
                task_names,
                failed_tasks
            )

            # 计算成功的任务列表
            completed_tasks = [task for task in task_names if task not in failed_tasks]

            # 通过 extra_info 传递结构化数据，避免后续需要解析文本
            return ToolResult(
                content=result_content,
                extra_info={
                    "project_name": project_path.name,
                    "success_count": success_count,
                    "total_count": len(tasks),
                    "completed_tasks": completed_tasks,
                    "failed_tasks": failed_tasks,
                    "scene_type": scene_type,  # Pass scene_type to tool detail
                }
            )

        except Exception as e:
            logger.exception(f"音频分析失败: {e!s}")

            # 在错误消息中提供格式规范，以便手动生成时参考
            error_msg = f"""音频分析工具调用失败: {e!s}

⚠️ 如果你需要手动生成分析文件，请注意：

【章节主题分析】- 两段式分析
  第一段：识别主题大纲（格式：序号. topic_id | 主题名称 | MM:SS-MM:SS | #颜色）
  第二段：详细分析每个主题（格式：标准的主题块，包含要点总结和关联对话）

【会议总结】- 灵活输出，根据对话类型决定板块
- 必须：整体概述、关键要点、分段深入分析
- 可选：决策事项、待办事项、遗留问题（根据内容判断）
- 使用中文标题，Markdown 格式
- 根据时长调整输出字数（10-30分钟约2000-4000字）

【其他可选分析】- 灵活输出，不要硬套模板
- 待办事项：待办任务 + 关键决策 + 遗留问题（可选）+ 风险提示（可选）
- 权力动态：整体排名 + 分段动态分析
- 意图分析：表层意图 + 深层推断（含依据和置信度）
- 量化数据：完整 HTML 页面（含 ECharts），深色商务风格
- 思维导图：Markdown 无序列表，3-5 层结构
- 深度洞察：深度分析 + 灵魂问题 + 可选建议

注意：
- 所有标题使用中文
- 说话人标识用 Speaker-1、Speaker-2 等
- 不要死板套用格式，根据内容灵活组织"""

            return ToolResult.error(error_msg)

    async def _load_project_config(self, project_path: Path) -> Optional[Dict]:
        """读取项目配置文件"""
        try:
            config_path = project_path / "magic.project.js"
            if not await async_exists(config_path):
                return None

            content = await async_read_text(config_path)

            # 提取 JSON 配置
            json_match = re.search(r'window\.magicProjectConfig\s*=\s*({[\s\S]*?});', content)
            if json_match:
                config_json = json_match.group(1)
                return json.loads(config_json)

            return None
        except Exception as e:
            logger.error(f"读取项目配置失败: {e}")
            return None


    async def _infer_scene_type(self, model_id: str, context: AnalysisContext) -> str:
        """
        智能推断场景类型（用于老项目兼容）

        Args:
            model_id: 模型ID
            context: 分析上下文（包含文字稿、笔记等所有内容）

        Returns:
            场景类型（meeting/interview/podcast等）
        """
        try:
            system_prompt = "你是场景识别专家，根据对话内容判断场景类型。"

            user_requirements = """请分析对话内容，判断场景类型。

场景类型：
- meeting: 会议类（有议程、需决策、多人协作）
- interview: 访谈类（信息获取、一对一问答）
- job_interview: 面试类（能力评估、求职面试）
- podcast: 播客/节目类（内容传播、主持+嘉宾）
- presentation: 演讲/分享类（单向输出、讲者+听众）
- learning: 学习/培训类（知识传授、讲师+学员）
- discussion: 讨论/辩论类（多方观点碰撞）
- conversation: 对话/聊天类（私密沟通、情感交流）
- general: 通用类（无法明确归类）

请直接输出场景类型的英文代码（只输出一个单词，如 meeting 或 podcast），不要有任何解释。"""

            # 复用标准分析方法，自动包含笔记等所有上下文
            result = await self._call_llm_for_analysis(
                model_id=model_id,
                analysis_name="scene_type_inference",
                system_prompt=system_prompt,
                user_requirements=user_requirements,
                context=context
            )

            # 使用正则提取场景类型关键词（防止 LLM 输出额外内容）
            valid_types = ["job_interview", "meeting", "interview", "podcast", "presentation",
                          "learning", "discussion", "conversation", "general"]

            # 优先匹配带下划线的（job_interview），避免被 interview 误匹配
            for scene_type in valid_types:
                if re.search(rf'\b{scene_type}\b', result, re.IGNORECASE):
                    logger.info(f"从返回内容中提取到场景类型: {scene_type}")
                    return scene_type

            logger.warning(f"场景推断未能提取有效类型，使用默认值 general")
            return "general"

        except Exception as e:
            logger.error(f"场景推断失败: {e}")
            return "general"

    async def _update_scene_type_in_config(self, tool_context: ToolContext, project_path: Path, scene_type: str):
        """
        更新配置文件中的 scene_type

        Args:
            tool_context: 工具上下文
            project_path: 项目路径
            scene_type: 场景类型
        """
        try:
            config_path = project_path / "magic.project.js"
            if not await async_exists(config_path):
                logger.warning(f"配置文件不存在，无法更新 scene_type: {config_path}")
                return

            content = await async_read_text(config_path)

            # 提取 JSON 配置
            json_match = re.search(r'window\.magicProjectConfig\s*=\s*({[\s\S]*?});', content)
            if not json_match:
                logger.warning("无法解析配置文件 JSON")
                return

            config_json = json_match.group(1)
            config_data = json.loads(config_json)

            # 更新 scene_type
            if "metadata" not in config_data:
                config_data["metadata"] = {}
            config_data["metadata"]["scene_type"] = scene_type

            # 写回文件
            new_config_json = json.dumps(config_data, indent=2, ensure_ascii=False)
            new_content = f"""window.magicProjectConfig = {new_config_json};

if (typeof window.magicProjectConfigure === 'function') {{
  window.magicProjectConfigure(window.magicProjectConfig);
}}
"""

            # 使用封装方法自动处理版本控制（工具生成的文件，不更新 timestamp）
            await self._write_text_with_versioning(tool_context, config_path, new_content, update_timestamp=False)

            logger.info(f"已更新配置文件 scene_type: {scene_type}")

        except Exception as e:
            logger.error(f"更新 scene_type 失败: {e}")
            # 不抛异常，不影响分析继续

    async def _update_config_with_new_files(self, tool_context: ToolContext, project_path: Path, new_files: Dict[str, str]):
        """
        将新增的分析文件追加到 magic.project.js

        当用户指定分析配置中不存在的新类型时，自动将这些类型追加到配置文件中，
        使前端能够正确显示和访问这些新生成的分析文件。

        Args:
            tool_context: 工具上下文
            project_path: 项目路径
            new_files: 新增的文件映射，格式 {analysis_type: filename}
                      例如 {"insights": "产品评审会议-洞察.md"}
        """
        try:
            config_path = project_path / "magic.project.js"
            if not await async_exists(config_path):
                logger.warning(f"配置文件不存在，无法追加新分析类型: {config_path}")
                return

            content = await async_read_text(config_path)

            # 提取 JSON 配置
            json_match = re.search(r'window\.magicProjectConfig\s*=\s*({[\s\S]*?});', content)
            if not json_match:
                logger.warning("无法解析配置文件 JSON")
                return

            config_json = json_match.group(1)
            config_data = json.loads(config_json)

            # 追加新文件到 files 字段
            if "files" not in config_data:
                config_data["files"] = {}

            for analysis_type, filename in new_files.items():
                config_data["files"][analysis_type] = filename
                logger.info(f"配置追加: {analysis_type} -> {filename}")

            # 写回文件
            new_config_json = json.dumps(config_data, indent=2, ensure_ascii=False)
            new_content = f"""window.magicProjectConfig = {new_config_json};

if (typeof window.magicProjectConfigure === 'function') {{
  window.magicProjectConfigure(window.magicProjectConfig);
}}
"""

            # 使用封装方法自动处理版本控制（工具生成的文件，不更新 timestamp）
            await self._write_text_with_versioning(tool_context, config_path, new_content, update_timestamp=False)

            logger.info(f"配置文件已更新，成功追加 {len(new_files)} 个新分析类型")

        except Exception as e:
            logger.error(f"更新配置文件失败: {e}")
            # 不抛异常，不影响分析结果

    async def _read_context_files(
        self,
        project_path: Path,
        context_files: List[str],
        config: Dict
    ) -> Dict[str, str]:
        """
        读取附加上下文文件

        Args:
            project_path: 项目路径（绝对路径）
            context_files: 用户指定的上下文文件列表（相对于工作空间根目录的路径）
            config: 项目配置（用于读取笔记文件）

        Returns:
            文件名到内容的映射 {"notes": "...", "file1.md": "...", ...}
        """
        context_contents = {}

        # 1. 优先读取笔记文件（如果配置中存在）
        notes_file = config.get("files", {}).get("notes")
        if notes_file:
            notes_path = project_path / notes_file
            notes_content = await async_try_read_text(notes_path)
            if notes_content:
                context_contents["notes"] = notes_content
                logger.info(f"读取笔记文件成功: {notes_file}")
            else:
                logger.warning(f"笔记文件不存在或为空: {notes_file}")

        # 2. 读取用户指定的其他上下文文件（相对于工作空间根目录）
        for relative_path in context_files:
            if not relative_path or not relative_path.strip():
                continue

            # 使用 resolve_path 解析路径（相对→workspace，绝对→直接使用）
            file_path = self.resolve_path(relative_path)
            content = await async_try_read_text(file_path)
            if content:
                context_contents[relative_path] = content
                logger.info(f"读取上下文文件成功: {relative_path}")
            else:
                logger.warning(f"上下文文件不存在或为空: {relative_path}，已跳过")

        return context_contents

    def _format_duration(self, seconds: int) -> str:
        """
        Format duration from seconds to human-readable time string

        Args:
            seconds: Duration in seconds

        Returns:
            Formatted time string (MM:SS or HH:MM:SS)
        """
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60

        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}"
        else:
            return f"{minutes:02d}:{secs:02d}"

    def _format_time_mmss(self, seconds: int) -> str:
        """
        格式化为 MM:SS（分钟:秒数，支持三位数分钟）

        90秒 → "01:30"
        3900秒 → "65:00"
        18000秒 → "300:00"
        """
        total_minutes = seconds // 60
        secs = seconds % 60
        return f"{total_minutes:02d}:{secs:02d}"

    def _parse_time_to_seconds(self, time_str: str) -> Optional[int]:
        """
        解析时间字符串为秒数

        支持格式：
        - MM:SS（主要格式，支持三位数分钟如 100:45, 180:00）
        - HH:MM:SS（兜底格式，容错处理）

        Args:
            time_str: 时间字符串

        Returns:
            秒数，解析失败返回 None
        """
        try:
            parts = time_str.split(':')
            if len(parts) == 2:
                # MM:SS（主要格式，int()支持任意位数）
                minutes, seconds = int(parts[0]), int(parts[1])
                return minutes * 60 + seconds
            elif len(parts) == 3:
                # HH:MM:SS（兜底格式）
                hours, minutes, seconds = int(parts[0]), int(parts[1]), int(parts[2])
                return hours * 3600 + minutes * 60 + seconds
            else:
                logger.warning(f"Unexpected time format: {time_str}")
                return None
        except (ValueError, IndexError) as e:
            logger.warning(f"Failed to parse time string '{time_str}': {e}")
            return None

    async def _call_llm_for_analysis(
        self,
        model_id: str,
        analysis_name: str,
        system_prompt: str,
        user_requirements: str,
        context: AnalysisContext
    ) -> str:
        """
        标准的大模型调用函数（带重试机制）

        Args:
            model_id: 要使用的模型 ID
            analysis_name: 分析类型名称（用于日志）
            system_prompt: 系统提示词（简短，说明专家角色）
            user_requirements: 输出要求
            context: 分析上下文（包含 metadata、transcript、context_contents）

        Returns:
            大模型输出的内容
        """
        async def _do_analysis():
            # 构建 User 消息 - 按顺序：元数据 → 转写文字稿 → 附加上下文
            user_message_parts = [user_requirements, ""]

            # 1. 添加元数据信息（帮助模型理解录音的基本信息）
            if context.metadata:
                user_message_parts.extend([
                    "录音基本信息：",
                    "```"
                ])

                # 项目名称
                if "name" in context.metadata:
                    user_message_parts.append(f"项目名称: {context.metadata['name']}")

                # 元数据详情
                meta = context.metadata.get("metadata", {})
                if meta:
                    if "title" in meta:
                        user_message_parts.append(f"录音标题: {meta['title']}")
                    if "date" in meta:
                        user_message_parts.append(f"录音时间: {meta['date']}")
                    if "duration" in meta:
                        duration_seconds = meta["duration"]
                        duration_formatted = self._format_duration(duration_seconds)
                        user_message_parts.append(f"录音时长: {duration_formatted} ({duration_seconds} 秒)")
                    if "speakers" in meta and meta["speakers"]:
                        user_message_parts.append(f"参与人数: {len(meta['speakers'])} 人")

                user_message_parts.extend(["```", ""])

            # 2. 说话人身份映射（帮助理解人物关系）
            if context.speakers_mapping:
                # 情况1：有映射信息 - 展示完整的映射和说明
                user_message_parts.extend([
                    "说话人身份映射：",
                    "```"
                ])
                for speaker_id, speaker_info in context.speakers_mapping.items():
                    user_message_parts.append(f"{speaker_id}: {speaker_info}")
                user_message_parts.extend([
                    "```",
                    "",
                    "**⚠️ 关键说明（必读）**：",
                    "- 以上映射用于帮助你理解录音中的人物关系和角色定位",
                    "- 此映射由 AI 自动识别，可能存在误差，仅供参考",
                    "- **你在输出时必须严格使用 Speaker-N 格式**（如 Speaker-1、Speaker-2），严禁直接使用姓名或角色名",
                    "- 前端会根据此映射自动将 Speaker-N 替换为对应的姓名/角色，你无需手动替换",
                    "- 示例：正确写法 'Speaker-1 提出了方案'，错误写法 '张三提出了方案'",
                    ""
                ])
            else:
                # 情况2：无映射信息 - 简短提示
                user_message_parts.extend([
                    "⚠️ 说话人信息：",
                    "项目配置中暂无说话人身份映射，请在分析时使用 Speaker-1、Speaker-2 等标准格式标识说话人。",
                    ""
                ])

            # 3. 转写纠错指导（必传）
            correction_guidance_parts = self._build_transcript_correction_guidance_parts(
                context.transcript_correction_guidance
            )
            if correction_guidance_parts:
                user_message_parts.extend(correction_guidance_parts)

            # 4. 录音转写文字稿（必须）
            user_message_parts.extend([
                """录音转写文字内容（重要说明）：
以下文字稿由 AI 语音识别技术生成，可能存在错别字、同音字替换、专业术语识别错误、数字识别偏差等问题。

**分析要求**：
请在分析时结合上下文语义，自动识别并修正明显的识别错误，理解说话人的真实意图。
输出时使用修正后的正确表述，不要照搬原文的错误内容。

录音转写文字稿：""",
                "```markdown",
                context.transcript,
                "```"
            ])

            # 5. 添加附加上下文（按顺序：笔记 → 其他文件）
            if context.context_contents:
                # 优先添加笔记
                if "notes" in context.context_contents:
                    # 面试场景下，说明笔记的作用
                    if "job_interview" in analysis_name.lower():
                        user_message_parts.extend([
                            "",
                            "⚠️ 面试官笔记（重要参考）：",
                            "",
                            "以下是面试官记录的笔记，可能包含候选人简历、面试官的观察和评价等内容。",
                            "",
                            "使用规则：",
                            "1. **区分简历和评价**：笔记中可能包含候选人简历，简历是候选人自述，不是面试官的评价",
                            "2. **只有面试官的评价才有权威性**：如笔记中写'很不错'、'应该拿下'、'不合适'等评价性语言",
                            "3. 如果笔记里有面试官的明确评价，就以评价为准（不是简历内容）",
                            "4. 理解评价的整体语气和倾向，不要只看字面（比如'应该速战速决拿下' = 通过）",
                            "5. 笔记有明确评价时，你的任务是从录音找支持依据，不要质疑面试官的判断",
                            "6. 如果笔记没写明确评价（或没有笔记），就基于录音内容严格评估",
                            "",
                            "```markdown",
                            context.context_contents["notes"],
                            "```"
                        ])
                    else:
                        user_message_parts.extend([
                            "",
                            "用户笔记：",
                            "```markdown",
                            context.context_contents["notes"],
                            "```"
                        ])

                # 添加其他文件
                for filename, content in context.context_contents.items():
                    if filename == "notes":
                        continue  # 已处理
                    user_message_parts.extend([
                        "",
                        f"附加参考文件（{filename}）：",
                        "```markdown",
                        content,
                        "```"
                    ])

            # 6. 输出语言说明
            user_message_parts.extend([
                "",
                f"请使用 {context.output_language} 输出分析结果。若引用非 {context.output_language} 的原文，需同时提供 {context.output_language} 译文对照。",
                ""
            ])

            # 7. 扩展上下文（统一添加分隔符后拼接）
            if context.extra_context:
                for content in context.extra_context.values():
                    user_message_parts.extend([
                        "---",
                        "",
                        content,
                        ""
                    ])

            # 8. 用户额外分析需求（如果有）
            if context.user_additional_requirements:
                user_message_parts.extend([
                    "---",
                    "",
                    "**用户额外分析需求**：",
                    "",
                    context.user_additional_requirements,
                    "",
                    "请在标准分析基础上，特别关注并体现用户的上述额外需求。",
                    ""
                ])

            # 9. 开始分析指令
            user_message_parts.append("请开始分析并输出结果。")

            user_message = "\n".join(user_message_parts)

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ]

            logger.info(f"开始调用大模型进行 {analysis_name} 分析")

            response = await LLMFactory.call_with_tool_support(
                model_id=model_id,
                messages=messages,
                tools=None,
                stop=None
            )

            if not response or not response.choices or len(response.choices) == 0:
                raise Exception(f"大模型返回空响应")

            content = response.choices[0].message.content

            # 清理可能的代码块包裹（兜底处理）
            content = self._clean_markdown_wrapper(content)

            logger.info(f"{analysis_name} 分析完成，内容长度: {len(content)}")

            return content

        # 使用统一的重试机制
        try:
            return await retry_with_exponential_backoff(
                _do_analysis,
                max_retries=3,
                initial_delay=1.0,
                exponential_base=2.0,
                jitter=True
            )
        except Exception as e:
            logger.exception(f"{analysis_name} 分析在重试后仍然失败: {e}")
            raise

    def _build_transcript_correction_guidance_parts(self, guidance: str) -> List[str]:
        """
        构建转写纠错指导提示词片段

        Args:
            guidance: 转写纠错说明（自由文本）

        Returns:
            可直接拼接到 user message 的文本行列表
        """
        if not guidance.strip():
            return []

        cleaned_guidance = guidance.strip()
        return [
            "转写纠错指导，分析输出时请修正表述",
            "```text",
            cleaned_guidance,
            "```",
            "",
            "将指导视为事实并直接执行，若指导写明“未发现明显错误”，则保持原文语义，不额外猜测纠错；",
            ""
        ]

    def _clean_markdown_wrapper(self, content: str) -> str:
        """
        终极优雅可靠地移除 Markdown 代码块包裹（兜底处理）

        LLM 有时会用代码块包裹输出内容，导致前端渲染异常。
        此函数使用正则表达式精确匹配并提取被包裹的内容，
        确保只有当整个字符串是一个完整的代码块时才进行清理。

        支持格式（示例中的空白字符已用 \\n 表示换行，\\t 表示制表符，便于理解实际包裹结构）：
        - ```markdown\n内容\n```
        - ```html\n内容\n```
        - ```\n内容\n```   # 无尾部换行
        - ```\n内容\n```\n\n\n   # 多个尾部换行

        Args:
            content: LLM 输出的内容（可能被代码块包裹）

        Returns:
            清理后的纯内容（无代码块包裹，且末尾确保有一个换行符）
        """
        stripped_content = content.strip()

        # 使用正则表达式精确匹配并提取被包裹的内容
        # re.DOTALL 使 `.` 可以匹配换行符
        match = re.match(r"^```[^\n]*\n(.*)\n?```$", stripped_content, re.DOTALL)

        if match:
            # 捕获组1是代码块内的内容, strip() 后再加一个换行符
            return match.group(1).strip() + '\n'

        # 如果不匹配, strip() 后再加一个换行符
        return stripped_content + '\n'

    async def _identify_topics(self, model_id: str, context: AnalysisContext) -> List[TopicOutline]:
        """
        第一段：识别主题大纲（带重试机制）

        让AI快速识别整个音频的主题分布，输出简化格式的主题列表。
        这一步很轻量，AI只需要浏览全文并识别话题转换点。

        Args:
            model_id: 模型ID
            context: 分析上下文

        Returns:
            主题大纲列表
        """
        logger.info("开始第一段：识别主题大纲")

        async def _do_identify():
            # 构建提示词
            system_prompt = "你是一位专业的对话分析专家，擅长快速识别对话中的主题转换点。"

            # 构建用户消息
            user_message_parts = [TOPICS_IDENTIFICATION_PROMPT, ""]

            # 添加元数据
            if context.metadata:
                user_message_parts.extend(["录音基本信息：", "```"])

                if "name" in context.metadata:
                    user_message_parts.append(f"项目名称: {context.metadata['name']}")

                meta = context.metadata.get("metadata", {})
                if meta:
                    if "title" in meta:
                        user_message_parts.append(f"录音标题: {meta['title']}")
                    if "date" in meta:
                        user_message_parts.append(f"录音时间: {meta['date']}")
                    if "duration" in meta:
                        duration_seconds = meta["duration"]
                        duration_formatted = self._format_duration(duration_seconds)
                        user_message_parts.append(f"录音时长: {duration_formatted} ({duration_seconds} 秒)")
                    if "speakers" in meta and meta["speakers"]:
                        user_message_parts.append(f"参与人数: {len(meta['speakers'])} 人")

                user_message_parts.extend(["```", ""])

            # 添加转写纠错指导（必传）
            correction_guidance_parts = self._build_transcript_correction_guidance_parts(
                context.transcript_correction_guidance
            )
            if correction_guidance_parts:
                user_message_parts.extend(correction_guidance_parts)

            # 添加录音文字稿
            user_message_parts.extend([
                "录音转写文字稿：",
                "```markdown",
                context.transcript,
                "```",
                "",
                f"请使用 {context.output_language} 输出主题列表。",
                ""
            ])

            user_message = "\n".join(user_message_parts)

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ]

            # 调用大模型
            response = await LLMFactory.call_with_tool_support(
                model_id=model_id,
                messages=messages,
                tools=None,
                stop=None
            )

            if not response or not response.choices or len(response.choices) == 0:
                raise Exception("模型返回空响应")

            content = response.choices[0].message.content

            # 清理可能的代码块包裹（兜底处理）
            content = self._clean_markdown_wrapper(content)

            logger.info(f"第一段输出长度: {len(content)} 字符")

            # 解析主题列表
            topics = self._parse_topic_outlines(content)

            if not topics:
                raise Exception("无法从模型输出中提取主题列表")

            logger.info(f"✅ 第一段完成，识别到 {len(topics)} 个主题")
            return topics

        # 使用统一的重试机制
        try:
            return await retry_with_exponential_backoff(
                _do_identify,
                max_retries=3,
                initial_delay=1.0,
                exponential_base=2.0,
                jitter=True
            )
        except Exception as e:
            logger.exception(f"主题识别在重试后仍然失败: {e}")
            raise

    def _sanitize_topic_id(self, topic_id: str, index: int) -> str:
        """
        清理主题ID，确保可安全用于 HTML/JS

        规则：
        - 允许英文字母、数字、下划线、连字符 [a-zA-Z0-9_-]
        - 包含其他字符（如中文、空格）时，使用兜底命名：topic_1, topic_2...

        Args:
            topic_id: LLM 输出的原始主题ID
            index: 主题索引（用于兜底命名）

        Returns:
            清理后的安全主题ID
        """
        # 检查是否只包含安全字符 [a-zA-Z0-9_-]
        # 注：连字符在 HTML ID 和 CSS 选择器中完全合法（kebab-case）
        if re.match(r'^[a-zA-Z0-9_-]+$', topic_id):
            return topic_id

        # 不安全时使用兜底命名，确保ID唯一性
        fallback_id = f"topic_{index + 1}"
        logger.warning(f"主题ID '{topic_id}' 包含不安全字符，使用兜底命名 '{fallback_id}'")
        return fallback_id

    def _parse_topic_outlines(self, content: str) -> List[TopicOutline]:
        """
        解析主题大纲列表

        格式：1. topic_id | 主题名称 | 00:00-15:30 | #e0e0e0

        Args:
            content: 模型输出的文本

        Returns:
            主题大纲列表
        """
        topics = []

        # 正则：序号. topic_id | 主题名称 | MM:SS-MM:SS | #颜色
        # 放宽 topic_id 匹配：\S+ 匹配任何非空白字符（支持中文、英文、数字、下划线等）
        # Python端会对不安全的ID进行清理
        pattern = r'\d+\.\s+(\S+)\s*\|\s*([^|]+?)\s*\|\s*([\d:]+)-([\d:]+)\s*\|\s*(#[\w]+)'

        for idx, match in enumerate(re.finditer(pattern, content)):
            raw_topic_id = match.group(1).strip()
            topic_name = match.group(2).strip()
            start_time = match.group(3).strip()
            end_time = match.group(4).strip()
            color = match.group(5).strip()

            # Sanitize topic ID to ensure it's safe for HTML/JS
            topic_id = self._sanitize_topic_id(raw_topic_id, idx)

            # 解析时间为秒数
            start_seconds = self._parse_time_to_seconds(start_time)
            end_seconds = self._parse_time_to_seconds(end_time)

            if start_seconds is None or end_seconds is None:
                logger.warning(f"跳过无效时间格式的主题: {topic_id}")
                continue

            topics.append(TopicOutline(
                topic_id=topic_id,
                topic_name=topic_name,
                start_seconds=start_seconds,
                end_seconds=end_seconds,
                color=color
            ))

        # 按时间排序
        topics.sort(key=lambda t: t.start_seconds)

        logger.info(f"成功解析 {len(topics)} 个主题大纲")
        return topics

    def _extract_transcript_segment(self, transcript: str, start_seconds: int, end_seconds: int) -> str:
        """
        根据时间范围提取文字稿片段

        从完整的录音文字稿中提取指定时间段的内容。
        文字稿格式：[MM:SS] Speaker-N:
                    对话内容

        Args:
            transcript: 完整的录音文字稿
            start_seconds: 开始时间（秒）
            end_seconds: 结束时间（秒）

        Returns:
            该时间段的文字稿内容
        """
        lines = []
        in_range = False  # 标记是否在目标时间范围内

        # ⚠️ 【格式规范 - 三处同步】解析文字稿的正则表达式
        # 格式：[MM:SS] Speaker-N: 或 [HH:MM:SS] Speaker-N:（支持三位数分钟）
        # 同步修改：audio_understanding._format_single_utterance()、index.html.parseTranscriptMarkdown()
        timestamp_pattern = r'^\[(\d+:\d+(?::\d+)?)\]\s+[\w-]+:'

        for line in transcript.split('\n'):
            match = re.match(timestamp_pattern, line)
            if match:
                # 遇到时间戳行，解析时间
                time_str = match.group(1)
                line_seconds = self._parse_time_to_seconds(time_str)

                if line_seconds is not None:
                    if start_seconds <= line_seconds <= end_seconds:
                        # 在范围内，开始收集
                        in_range = True
                        lines.append(line)
                    elif line_seconds > end_seconds and in_range:
                        # 超出范围且已经开始收集，停止收集
                        break
                    elif line_seconds < start_seconds:
                        # 还未到达范围，重置状态
                        in_range = False
            elif in_range:
                # 在范围内，收集对话内容（没有时间戳的行）
                lines.append(line)

        segment = '\n'.join(lines)

        if not segment:
            logger.warning(f"未能提取到时间段 {start_seconds}-{end_seconds} 的文字稿内容")

        return segment

    async def _analyze_single_topic(
        self,
        model_id: str,
        topic: TopicOutline,
        transcript_segment: str,
        output_language: str,
        transcript_correction_guidance: str
    ) -> Optional[TopicDetail]:
        """
        第二段：分析单个主题（带重试机制）

        针对单个主题的时间段进行深度分析，输出标准格式的主题块。

        Args:
            model_id: 模型ID
            topic: 主题大纲
            transcript_segment: 该主题时间段的文字稿
            output_language: 输出语言
            transcript_correction_guidance: 转写纠错指导（自由文本）

        Returns:
            主题详细分析结果，失败返回 None
        """
        logger.info(f"分析主题: {topic.topic_id} ({topic.topic_name})")

        async def _do_analyze():
            # 构建提示词
            system_prompt = "你是一位专业的对话分析专家，擅长深入分析对话内容并提取关键信息。"

            # 格式化时间
            start_time = self._format_time_mmss(topic.start_seconds)
            end_time = self._format_time_mmss(topic.end_seconds)

            # 构建用户消息
            user_message = SINGLE_TOPIC_ANALYSIS_PROMPT.format(
                topic_id=topic.topic_id,
                topic_name=topic.topic_name,
                start_time=start_time,
                end_time=end_time,
                color=topic.color,
                transcript_segment=transcript_segment
            )

            correction_guidance_parts = self._build_transcript_correction_guidance_parts(
                transcript_correction_guidance
            )
            if correction_guidance_parts:
                user_message += "\n\n" + "\n".join(correction_guidance_parts)

            user_message += f"\n\n请使用 {output_language} 输出分析结果。\n"

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ]

            # 调用大模型
            response = await LLMFactory.call_with_tool_support(
                model_id=model_id,
                messages=messages,
                tools=None,
                stop=None
            )

            if not response or not response.choices or len(response.choices) == 0:
                raise Exception("模型返回空响应")

            content = response.choices[0].message.content

            # 清理可能的代码块包裹（兜底处理）
            content = self._clean_markdown_wrapper(content)

            # 解析结果
            topic_detail = self._parse_single_topic_detail(content, topic)

            if not topic_detail:
                raise Exception(f"主题 {topic.topic_id} 解析失败")

            logger.info(f"✅ 主题 {topic.topic_id} 分析成功")
            return topic_detail

        # 使用统一的重试机制
        try:
            return await retry_with_exponential_backoff(
                _do_analyze,
                max_retries=3,
                initial_delay=1.0,
                exponential_base=2.0,
                jitter=True
            )
        except Exception as e:
            logger.error(f"❌ 主题 {topic.topic_id} 在重试后仍然失败: {e}")
            return None  # 单个主题失败不影响其他主题

    def _parse_single_topic_detail(self, content: str, topic: TopicOutline) -> Optional[TopicDetail]:
        """
        解析单个主题的详细分析结果

        从模型输出中提取：
        - speakers（从要点总结第一行提取）
        - summary（要点总结内容）
        - dialogue_items（关联对话列表）

        Args:
            content: 模型输出的文本
            topic: 主题大纲

        Returns:
            主题详细分析结果，失败返回 None
        """
        try:
            # 查找 "#### 要点总结" 和 "#### 关联对话" 位置
            summary_match = re.search(r'####\s*要点总结', content)
            items_match = re.search(r'####\s*关联对话', content)

            if not summary_match or not items_match:
                logger.warning("未找到要点总结或关联对话标题")
                return None

            # 提取要点总结内容
            summary_start = summary_match.end()
            summary_end = items_match.start()
            summary_text = content[summary_start:summary_end].strip()

            # ⚠️ 【格式规范B - 三处同步】提取参与者（第一行：[Speaker-X, Speaker-Y]）
            # 同步修改：SINGLE_TOPIC_ANALYSIS_PROMPT、index.html.parseTopicsMarkdown()
            speakers_pattern = r'^\[([^\]]+)\]'
            speakers_match = re.match(speakers_pattern, summary_text, re.MULTILINE)
            speakers = []
            if speakers_match:
                speakers_line = speakers_match.group(1)
                speakers = [s.strip() for s in speakers_line.split(',')]
                # 移除参与者行
                summary_text = summary_text[speakers_match.end():].strip()

            # 提取关联对话列表
            items_start = items_match.end()
            items_text = content[items_start:].strip()

            # ⚠️ 【格式规范B - 三处同步】提取关联对话条目（格式：- `MM:SS-MM:SS` Speaker-X: 描述）
            # 同步修改：SINGLE_TOPIC_ANALYSIS_PROMPT、index.html.parseTopicsMarkdown()
            dialogue_items = []
            item_pattern = r'- `([\d:]+)-([\d:]+)`\s+([^:]+):\s*(.+)'
            for match in re.finditer(item_pattern, items_text, re.MULTILINE):
                dialogue_items.append(match.group(0))  # 保存原始格式化文本

            if not dialogue_items:
                logger.warning("未找到关联对话条目")
                return None

            return TopicDetail(
                topic_id=topic.topic_id,
                topic_name=topic.topic_name,
                color=topic.color,
                speakers=speakers,
                summary=summary_text,
                dialogue_items=dialogue_items,
                start_seconds=topic.start_seconds,
                end_seconds=topic.end_seconds
            )

        except Exception as e:
            logger.error(f"解析主题详情失败: {e}")
            return None

    def _merge_topic_details_to_markdown(self, topics: List[TopicDetail]) -> str:
        """
        将主题详细分析列表合并为标准 Markdown 格式

        Args:
            topics: 主题详细分析列表

        Returns:
            标准格式的章节主题 Markdown
        """
        lines = ["## 🎯 章节主题", ""]

        for i, topic in enumerate(topics):
            # 主题头部
            lines.append(f"### 📌 {topic.topic_id} | {topic.topic_name} | {topic.color}")
            lines.append("")

            # 要点总结
            lines.append("#### 要点总结")
            lines.append("")

            # ⚠️ 【格式规范B - 三处同步】参与者列表：[Speaker-X, Speaker-Y]
            # 同步修改：SINGLE_TOPIC_ANALYSIS_PROMPT、_parse_topic_analysis()、index.html.parseTopicsMarkdown()
            speakers_str = ", ".join(topic.speakers)
            lines.append(f"[{speakers_str}]")
            lines.append("")

            # 摘要内容
            lines.append(topic.summary)
            lines.append("")

            # 关联对话
            lines.append("#### 关联对话")
            lines.append("")

            for item in topic.dialogue_items:
                lines.append(item)

            # 分隔符（最后一个主题不加）
            if i < len(topics) - 1:
                lines.append("")
                lines.append("---")
                lines.append("")

        return "\n".join(lines)

    async def _analyze_topics(self, model_id: str, context: AnalysisContext, max_retries: int = 5) -> str:
        """
        章节主题分析（两段式）

        工作流程：
        1. 第一段：识别主题大纲（轻量级，快速识别整个音频的主题分布）
        2. 第二段：并发分析主题（每5个为一组，针对每个主题进行详细分析）
        3. 合并结果为标准 Markdown 格式

        Args:
            model_id: 模型ID
            context: 分析上下文
            max_retries: 单个主题的最大重试次数（默认3次）

        Returns:
            完整的章节主题分析 Markdown
        """
        try:
            # ============ 第一段：识别主题大纲 ============
            topic_outlines = await self._identify_topics(model_id, context)

            if not topic_outlines:
                raise Exception("第一段未能识别到任何主题")

            logger.info(f"第一段完成，共识别 {len(topic_outlines)} 个主题")

            # ============ 第二段：并发分析主题 ============
            logger.info("开始第二段：并发分析主题详情")

            # 提取完整文字稿
            transcript = context.transcript

            # 并发分析：每5个为一组
            batch_size = 5
            all_topic_details = []

            for i in range(0, len(topic_outlines), batch_size):
                batch = topic_outlines[i:i + batch_size]
                batch_num = i // batch_size + 1
                total_batches = (len(topic_outlines) + batch_size - 1) // batch_size

                logger.info(f"处理第 {batch_num}/{total_batches} 批次（{len(batch)} 个主题）")

                # 为每个主题准备任务
                tasks = []
                for topic in batch:
                    # 提取该主题时间段的文字稿
                    segment = self._extract_transcript_segment(
                        transcript,
                        topic.start_seconds,
                        topic.end_seconds
                    )

                    # 创建分析任务
                    task = self._analyze_single_topic(
                        model_id,
                        topic,
                        segment,
                        context.output_language,
                        context.transcript_correction_guidance
                    )
                    tasks.append(task)

                # 并发执行
                results = await asyncio.gather(*tasks, return_exceptions=True)

                # 收集成功的结果
                for j, result in enumerate(results):
                    if isinstance(result, Exception):
                        logger.error(f"主题 {batch[j].topic_id} 分析异常: {result}")
                    elif result is not None:
                        all_topic_details.append(result)
                    else:
                        logger.warning(f"主题 {batch[j].topic_id} 分析失败（返回None）")

            # ============ 第三步：合并结果 ============
            if not all_topic_details:
                raise Exception("第二段未能成功分析任何主题")

            # 按时间排序
            all_topic_details.sort(key=lambda t: t.start_seconds)

            logger.info(f"第二段完成，成功分析 {len(all_topic_details)}/{len(topic_outlines)} 个主题")

            # 合并为 Markdown
            result = self._merge_topic_details_to_markdown(all_topic_details)

            logger.info(f"✅ 章节分析完成，输出长度: {len(result)} 字符")
            return result

        except Exception as e:
            logger.exception(f"章节分析失败: {e}")
            raise

    async def _pre_evaluate_job_interview(self, model_id: str, context: AnalysisContext) -> str:
        """
        面试场景专用：预评估候选人，给出初步结论

        在三板块并行分析之前，先快速给出评估倾向，作为统一的参考基准。

        Args:
            model_id: 模型ID
            context: 分析上下文

        Returns:
            预评估结论文本
        """
        logger.info("面试场景：开始预评估")

        system_prompt = PRE_EVALUATION_SYSTEM_PROMPT
        user_requirements = PRE_EVALUATION_USER_REQUIREMENTS.format(
            INTERVIEW_EVALUATION_PRINCIPLES=INTERVIEW_EVALUATION_PRINCIPLES,
            SPEAKER_IDENTIFIER_REQUIREMENTS=SPEAKER_IDENTIFIER_REQUIREMENTS
        )

        result = await self._call_llm_for_analysis(
            model_id=model_id,
            analysis_name="pre_evaluation_job_interview",
            system_prompt=system_prompt,
            user_requirements=user_requirements,
            context=context
        )

        logger.info(f"预评估完成，输出长度: {len(result)} 字符")
        return result

    async def _analyze_summary(
        self,
        model_id: str,
        context: AnalysisContext,
        scene_type: str = "general"
    ) -> str:
        """
        内容总结（必须执行）- 三板块并行方案

        Args:
            model_id: 模型ID
            context: 分析上下文（包含 metadata、transcript、context_contents）
            scene_type: 场景类型

        Returns:
            合并后的总结内容
        """

        # 面试场景：先进行预评估，统一评估基调
        if scene_type == "job_interview":
            try:
                pre_evaluation_result = await self._pre_evaluate_job_interview(model_id, context)

                # 构建格式化的评估结论内容（不含分隔符，分隔符由拼接处统一处理）
                formatted_pre_evaluation = "\n".join([
                    "⚠️ 面试评估结论（参考基准）：",
                    "",
                    "以下是对本次面试的评估结论，作为统一的评估基调和参考基准。",
                    "请基于此评估结论展开你的详细分析，保持评估倾向的一致性。",
                    "",
                    "```markdown",
                    pre_evaluation_result,
                    "```"
                ])

                context.extra_context["pre_evaluation"] = formatted_pre_evaluation
                logger.info(f"面试场景：预评估完成，格式化内容已存入 extra_context")
            except Exception as e:
                logger.warning(f"预评估失败，继续三板块分析: {e}")
                # 预评估失败不影响主流程

        # 获取对应场景的提示词，如果场景不存在则使用 general
        prompts = SUMMARY_PROMPTS.get(scene_type, SUMMARY_PROMPTS["general"])

        logger.info(f"Summary 分析使用场景：{scene_type}，开始三板块并行执行")

        # 根据场景类型选择质量检查模板
        quality_check_map = {
            "meeting": QUALITY_SELF_CHECK_MEETING,
            "interview": QUALITY_SELF_CHECK_PROFESSIONAL,
            "job_interview": QUALITY_SELF_CHECK_PROFESSIONAL,
            "podcast": QUALITY_SELF_CHECK_PROFESSIONAL,
            "presentation": QUALITY_SELF_CHECK_PROFESSIONAL,
            "learning": QUALITY_SELF_CHECK_PROFESSIONAL,
            "discussion": QUALITY_SELF_CHECK_GENERAL,
            "conversation": QUALITY_SELF_CHECK_GENERAL,
            "general": QUALITY_SELF_CHECK_GENERAL,
        }
        quality_check = quality_check_map.get(scene_type, QUALITY_SELF_CHECK_GENERAL)

        # 动态注入通用片段（使用 format 替换占位符）
        # 准备公共的 format 参数
        common_format_params = {
            "UNIVERSAL_OUTPUT_PRINCIPLES": UNIVERSAL_OUTPUT_PRINCIPLES,
            "SPEAKER_IDENTIFIER_REQUIREMENTS": SPEAKER_IDENTIFIER_REQUIREMENTS,
            "QUALITY_SELF_CHECK_MEETING": quality_check,
            "QUALITY_SELF_CHECK_PROFESSIONAL": quality_check,
            "QUALITY_SELF_CHECK_GENERAL": quality_check,
        }

        # 面试场景需要额外注入评估原则
        if scene_type == "job_interview":
            common_format_params["INTERVIEW_EVALUATION_PRINCIPLES"] = INTERVIEW_EVALUATION_PRINCIPLES

        overview_prompt = prompts["overview"].format(
            **common_format_params,
            THREE_EXPERTS_COLLABORATION=THREE_EXPERTS_COLLABORATION_BASE.format(
                expert_role_description=EXPERT_ROLE_OVERVIEW
            ),
            WORD_COUNT_OVERVIEW=WORD_COUNT_OVERVIEW
        )

        deep_analysis_prompt = prompts["deep_analysis"].format(
            **common_format_params,
            THREE_EXPERTS_COLLABORATION=THREE_EXPERTS_COLLABORATION_BASE.format(
                expert_role_description=EXPERT_ROLE_DEEP_ANALYSIS
            ),
            TIME_SLICE_RULES=TIME_SLICE_RULES,
            WORD_COUNT_REQUIREMENTS=WORD_COUNT_REQUIREMENTS,
            DIALOGUE_QUOTE_FORMAT=DIALOGUE_QUOTE_FORMAT
        )

        structured_prompt = prompts["structured"].format(
            **common_format_params,
            THREE_EXPERTS_COLLABORATION=THREE_EXPERTS_COLLABORATION_BASE.format(
                expert_role_description=EXPERT_ROLE_STRUCTURED
            ),
            WORD_COUNT_STRUCTURED=WORD_COUNT_STRUCTURED
        )

        # 并行执行三个板块
        tasks = [
            # 板块1：整体概述
            self._call_llm_for_analysis(
                model_id=model_id,
                analysis_name=f"summary_overview_{scene_type}",
                system_prompt="你是一位资深的内容分析专家，擅长快速把握全局、深入理解核心内容。",
                user_requirements=overview_prompt,
                context=context
            ),
            # 板块2：深入分析
            self._call_llm_for_analysis(
                model_id=model_id,
                analysis_name=f"summary_deep_analysis_{scene_type}",
                system_prompt="你是一位细致入微的内容分析专家，擅长按时间线剖析细节。",
                user_requirements=deep_analysis_prompt,
                context=context
            ),
            # 板块3：结构化提取
            self._call_llm_for_analysis(
                model_id=model_id,
                analysis_name=f"summary_structured_{scene_type}",
                system_prompt="你是一位结构化思维专家，擅长提取关键的结构化要素。",
                user_requirements=structured_prompt,
                context=context
            ),
        ]

        try:
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # 容错处理：检查失败的板块，但不直接抛出异常
            success_results = []
            failed_blocks = []
            block_names = ["整体概述", "深入分析", "结构化提取"]

            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"Summary 板块 {i+1}（{block_names[i]}）分析失败: {result}")
                    failed_blocks.append(block_names[i])
                    success_results.append(None)
                else:
                    # 清理可能的代码块包裹（兜底处理）
                    cleaned_result = self._clean_markdown_wrapper(result)
                    success_results.append(cleaned_result)
                    logger.info(f"Summary 板块 {i+1}（{block_names[i]}）分析成功")

            # 如果全部失败，抛出异常
            if all(r is None for r in success_results):
                raise Exception(f"Summary 所有板块都失败了: {', '.join(failed_blocks)}")

            # 如果有部分成功，记录警告并合并成功的板块
            if failed_blocks:
                logger.warning(f"Summary 部分板块失败: {', '.join(failed_blocks)}，将使用成功的板块继续生成")

            logger.info(f"Summary 并行执行完成，成功 {len([r for r in success_results if r])}/{len(results)} 个板块，开始合并")

            # 合并成功的板块（传入 None 的会被跳过）
            return self._merge_summary_blocks(success_results[0], success_results[1], success_results[2], scene_type)

        except Exception as e:
            logger.exception(f"Summary 分析失败: {e}")
            raise

    def _merge_summary_blocks(self, overview: str, deep_analysis: str, structured: str, scene_type: str = "general") -> str:
        """
        合并三个板块的输出（容错版本）

        Args:
            overview: 整体概述内容
            deep_analysis: 深入分析内容
            structured: 结构化提取内容
            scene_type: 场景类型，用于决定标题和顺序
        """
        sections = []

        # 所有场景统一：结论先行 - overview(含核心结论) → structured(结构化分析) → deep_analysis(详细拆解)
        block_order = [(overview, "整体概述"), (structured, "结构化分析"), (deep_analysis, "深入分析")]

        # 处理板块：移除开头的一级标题（避免标题重复）
        #
        # 背景说明：
        # 三个板块（overview/deep_analysis/structured）由 LLM 独立生成，
        # 可能会在开头输出一级标题（如 "# 会议纪要"、"# 整体概述" 等）。
        # 但最终合并时，我们会统一添加标题（如 "# 会议纪要"），
        # 所以需要移除各板块自己生成的一级标题，避免重复。
        #
        # 为什么只移除一级标题（#）而不移除二级标题（##）？
        # - 一级标题：是板块自己生成的"整体标题"，会与合并后的标题重复
        # - 二级标题：是板块内部的"小节标题"，是有效内容，必须保留
        #   例如："## 00:00-12:30 | 开场"、"## 1. 关键要点"
        #
        # 边缘情况处理：
        # 1. 空内容 → 早期返回
        # 2. 只有标题无内容 → 移除后检查，记录警告
        # 3. 标题后有多个空行 → 全部跳过
        # 4. 标题后是二级标题 → 正确保留
        for block, name in block_order:
            if block:
                content = block.strip()

                # 早期返回：如果板块内容为空，记录日志并跳过
                if not content:
                    logger.warning(f"{name}板块内容为空，跳过")
                    continue

                # 按行分割，检查第一行
                lines = content.split('\n')
                first_line = lines[0].strip()

                # 判断：第一行是否为一级标题（单个#开头，后面不是#）
                # 注意：## 是二级标题，### 是三级标题，都不应该删除
                if first_line.startswith('#') and not first_line.startswith('##'):
                    # 步骤1：移除第一行（一级标题行）
                    remaining_lines = lines[1:]

                    # 步骤2：跳过标题后紧跟的空行（处理格式差异，如标题后有1-3个空行）
                    while remaining_lines and not remaining_lines[0].strip():
                        remaining_lines = remaining_lines[1:]

                    # 步骤3：重组内容
                    content = '\n'.join(remaining_lines).strip()

                # 最终检查：移除标题后是否还有内容
                if content:
                    sections.append(content)
                else:
                    logger.warning(f"{name}板块移除标题后无内容，跳过")
            else:
                logger.warning(f"{name}板块失败，跳过")

        if not sections:
            raise Exception("Summary 所有板块都失败，无法生成内容")

        # 根据场景类型决定标题
        if scene_type == "meeting":
            title = "会议纪要"
        elif scene_type == "job_interview":
            title = "面试评估"
        else:
            title = "内容总结"

        # 合并：标题 + 内容 + 分隔符
        merged = f"# {title}\n\n" + "\n\n---\n\n".join(sections) + "\n"

        logger.info(f"Summary 合并完成（{scene_type}场景），标题：{title}，包含 {len(sections)}/3 个板块，总字数：{len(merged)} 字")

        return merged

    async def _analyze_followup(self, model_id: str, context: AnalysisContext) -> str:
        """待办事项（可选）- 会后跟进的可执行内容"""

        system_prompt = FOLLOWUP_SYSTEM_PROMPT

        user_requirements = FOLLOWUP_USER_REQUIREMENTS

        return await self._call_llm_for_analysis(
            model_id, "followup", system_prompt, user_requirements, context
        )

    async def _analyze_power_dynamics(self, model_id: str, context: AnalysisContext) -> str:
        """权力动态分析（可选）"""

        system_prompt = POWER_DYNAMICS_SYSTEM_PROMPT

        user_requirements = POWER_DYNAMICS_USER_REQUIREMENTS

        return await self._call_llm_for_analysis(
            model_id, "power_dynamics", system_prompt, user_requirements, context
        )

    async def _analyze_intent(self, model_id: str, context: AnalysisContext) -> str:
        """意图分析（可选）"""

        system_prompt = INTENT_SYSTEM_PROMPT

        user_requirements = INTENT_USER_REQUIREMENTS

        return await self._call_llm_for_analysis(
            model_id, "intent", system_prompt, user_requirements, context
        )

    async def _analyze_metrics(self, model_id: str, context: AnalysisContext) -> str:
        """关键量化数据分析（可选，输出 HTML）"""

        system_prompt = METRICS_SYSTEM_PROMPT

        user_requirements = METRICS_USER_REQUIREMENTS

        result = await self._call_llm_for_analysis(
            model_id, "metrics", system_prompt, user_requirements, context
        )

        # Note: Already cleaned by _call_llm_for_analysis, but HTML might need extra check
        # _clean_markdown_wrapper handles both ```html and ```markdown wrappers
        return result

    async def _analyze_mindmap(self, model_id: str, context: AnalysisContext) -> str:
        """思维导图（可选，Markdown 格式）"""

        system_prompt = MINDMAP_SYSTEM_PROMPT

        user_requirements = MINDMAP_USER_REQUIREMENTS

        return await self._call_llm_for_analysis(
            model_id, "mindmap", system_prompt, user_requirements, context
        )

    async def _analyze_insights(self, model_id: str, context: AnalysisContext) -> str:
        """深度洞察（可选）"""

        system_prompt = INSIGHTS_SYSTEM_PROMPT

        user_requirements = INSIGHTS_USER_REQUIREMENTS

        return await self._call_llm_for_analysis(
            model_id, "insights", system_prompt, user_requirements, context
        )

    async def _analyze_highlights(self, model_id: str, context: AnalysisContext) -> str:
        """金句分析（可选，适用于访谈、分享、播客等内容型对话）"""

        system_prompt = HIGHLIGHTS_SYSTEM_PROMPT

        user_requirements = HIGHLIGHTS_USER_REQUIREMENTS

        return await self._call_llm_for_analysis(
            model_id, "highlights", system_prompt, user_requirements, context
        )

    async def _extract_tags_from_summary(
        self,
        summary_content: str,
        audio_title: str,
        output_language: str = "中文"
    ) -> list:
        """
        <!--zh
        基于会议纪要提取 3-4 个精炼主题标签

        纪要内容已经过深度分析和结构化，信息密度高、噪音少，
        相比原始文字稿能提取出更准确、更有价值的标签。

        Args:
            summary_content: 会议纪要内容（已经过结构化分析）
            audio_title: 音频标题（作为上下文参考）
            output_language: 输出语言（默认中文）

        Returns:
            精炼标签列表，如 ["CDN缓存优化", "分层架构设计", "智能预热策略"]
            失败返回空列表
        -->
        Extract 3-4 refined topic tags from meeting summary

        Summary content has been deeply analyzed and structured, with high information density and low noise.
        Compared to raw transcript, can extract more accurate and valuable tags.

        Args:
            summary_content: Meeting summary content (already structured and analyzed)
            audio_title: Audio title (as context reference)
            output_language: Output language (default Chinese)

        Returns:
            Refined tag list, e.g. ["CDN Cache Optimization", "Layered Architecture Design", "Smart Preheating Strategy"]
            Returns empty list on failure
        """
        try:
            system_prompt = """<!--zh: 你是主题标签提取专家，擅长从会议纪要中提炼核心主题标签。-->
You are a topic tag extraction expert, skilled at extracting core topic tags from meeting summaries."""

            user_prompt = f"""<!--zh
请基于以下会议纪要，提取 3-4 个最能代表核心主题的标签。

音频标题：{audio_title}

要求：
- 每个标签 3-8 个字（中文）或 2-5 个单词（英文）
- 使用 {output_language} 输出
- 标签应具体、有区分度、有价值
- 优先提取技术、业务、决策相关的核心主题
- 标签应反映纪要中的重点内容和关键决策
- 直接输出标签，用英文逗号分隔，不要有任何解释或其他内容

示例输出（中文）：CDN缓存优化, 分层架构设计, 智能预热策略, 性能提升方案
示例输出（英文）：CDN Cache Optimization, Layered Architecture, Smart Preheating, Performance Enhancement

会议纪要：
```markdown
{summary_content[:4000]}
```

请输出标签：
-->
Please extract 3-4 tags that best represent the core topics based on the following meeting summary.

Audio Title: {audio_title}

Requirements:
- Each tag 3-8 characters (Chinese) or 2-5 words (English)
- Output in {output_language}
- Tags should be specific, distinctive, and valuable
- Prioritize technical, business, decision-related core topics
- Tags should reflect key content and critical decisions in the summary
- Output tags directly, separated by commas, without any explanation or other content

Example output (Chinese): CDN缓存优化, 分层架构设计, 智能预热策略, 性能提升方案
Example output (English): CDN Cache Optimization, Layered Architecture, Smart Preheating, Performance Enhancement

Meeting Summary:
```markdown
{summary_content[:4000]}
```

Please output tags:
"""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]

            logger.info(f"开始从纪要提取标签，纪要长度: {len(summary_content)} 字符")

            # 调用 LLM（使用快速模型）
            response = await LLMFactory.call_with_tool_support(
                model_id=TAG_EXTRACTION_MODEL_ID,
                messages=messages,
                tools=None,
                stop=None
            )

            if not response or not response.choices or len(response.choices) == 0:
                logger.warning("标签提取失败：模型返回空响应")
                return []

            result = response.choices[0].message.content.strip()
            logger.info(f"模型返回标签: {result}")

            # 解析标签（按逗号分割）
            tags = [tag.strip() for tag in result.split(',') if tag.strip()]

            # 过滤掉过长的标签（可能是模型输出了解释文本）
            max_tag_length = 30  # 中英文通用上限
            tags = [tag for tag in tags if len(tag) <= max_tag_length]

            # 限制数量 3-4 个
            if len(tags) > 4:
                tags = tags[:4]
                logger.info(f"标签数量超过4个，截取前4个: {tags}")

            if len(tags) < 3:
                logger.warning(f"标签数量不足3个: {tags}，将返回现有标签")

            logger.info(f"✅ 成功提取精炼标签: {tags}")
            return tags

        except Exception as e:
            logger.error(f"标签提取失败: {e}", exc_info=True)
            return []

    async def _update_tags_in_config(
        self,
        tool_context: ToolContext,
        project_path: Path,
        tags: list
    ):
        """
        <!--zh
        更新配置文件中的标签

        在 summary 生成后，将提取的精炼标签写入 magic.project.js 配置文件。
        标签会覆盖初始的空标签列表，供前端展示使用。

        采用与 _update_scene_type_in_config 和 _update_config_with_new_files 相同的
        标准更新模式，确保配置文件格式一致性。

        Args:
            tool_context: 工具上下文
            project_path: 项目路径
            tags: 精炼标签列表
        -->
        Update tags in configuration file

        After summary generation, write extracted refined tags to magic.project.js config file.
        Tags will override initial empty tag list for frontend display.

        Uses same standard update pattern as _update_scene_type_in_config and
        _update_config_with_new_files to ensure config file format consistency.

        Args:
            tool_context: Tool context
            project_path: Project path
            tags: Refined tag list
        """
        try:
            config_path = project_path / "magic.project.js"

            # Safety check: config file must exist
            if not await async_exists(config_path):
                logger.warning(f"配置文件不存在，无法更新标签: {config_path}")
                return

            # Read current config
            content = await async_read_text(config_path)
            if not content or not content.strip():
                logger.warning("配置文件为空，无法更新标签")
                return

            # Extract JSON configuration with regex
            json_match = re.search(r'window\.magicProjectConfig\s*=\s*({[\s\S]*?});', content)
            if not json_match:
                logger.warning("无法解析配置文件 JSON，可能文件格式已损坏")
                return

            # Parse JSON safely
            try:
                config_data = json.loads(json_match.group(1))
            except json.JSONDecodeError as e:
                logger.error(f"JSON 解析失败: {e}")
                return

            # Validate tags input
            if not isinstance(tags, list):
                logger.warning(f"标签格式无效（应为列表）: {type(tags)}")
                return

            # Update tags in metadata
            if "metadata" not in config_data:
                config_data["metadata"] = {}

            # Store old tags for logging
            old_tags = config_data["metadata"].get("tags", [])
            config_data["metadata"]["tags"] = tags

            # Serialize back to JSON with consistent formatting
            new_config_json = json.dumps(config_data, indent=2, ensure_ascii=False)
            new_content = f"""window.magicProjectConfig = {new_config_json};

if (typeof window.magicProjectConfigure === 'function') {{
  window.magicProjectConfigure(window.magicProjectConfig);
}}
"""

            # Write back with versioning (can rollback if needed!)
            await self._write_text_with_versioning(
                tool_context, config_path, new_content, update_timestamp=False
            )

            logger.info(f"✅ 配置文件标签已更新: {old_tags} → {tags}")

        except json.JSONDecodeError as e:
            logger.error(f"标签更新失败 - JSON 解析错误: {e}", exc_info=True)
        except Exception as e:
            logger.error(f"标签更新失败 - 未知错误: {e}", exc_info=True)
            # Don't raise - tag update failure should not break analysis pipeline

    async def _write_analysis_file(
        self,
        tool_context: ToolContext,
        project_path: Path,
        task_name: str,
        config: Dict,
        content: str
    ):
        """写入分析结果文件"""
        try:
            # 从配置中确定文件名
            filename = config["files"].get(task_name)
            if not filename:
                logger.error(f"配置中未找到 {task_name} 的文件名")
                raise Exception(f"配置中未找到 {task_name} 的文件名")

            file_path = project_path / filename

            # 使用封装方法自动处理版本控制（工具生成的文件，不更新 timestamp）
            await self._write_text_with_versioning(tool_context, file_path, content, update_timestamp=False)

            logger.info(f"成功写入分析文件: {file_path}")

        except Exception as e:
            logger.error(f"写入分析文件失败: {e}")
            raise

    async def _copy_visualization_template(self, tool_context: ToolContext, project_path: Path):
        """
        复制可视化界面模板到项目文件夹

        在所有分析完成后调用，确保可视化界面与分析结果匹配

        Args:
            tool_context: 工具上下文
            project_path: 项目路径
        """
        try:
            index_path = project_path / "index.html"
            source_index_path = Path(__file__).parent / "magic_audio" / "index.html"

            if not await async_exists(source_index_path):
                raise FileNotFoundError(f"找不到模板文件: {source_index_path}")

            # 使用封装方法自动处理版本控制（工具生成的文件，不更新 timestamp）
            await self._copy_file_with_versioning(tool_context, source_index_path, index_path, update_timestamp=False)

            logger.info(f"成功复制可视化界面: {index_path}")

        except Exception as e:
            logger.error(f"复制可视化界面失败: {e}")
            raise

    def _generate_report(
        self,
        project_name: str,
        success_count: int,
        total_count: int,
        task_names: List[str],
        failed_tasks: List[str]
    ) -> str:
        """
        生成结果报告（中文，给 AI 阅读）

        注意：
        1. 此方法输出中文内容，供 AI 阅读和理解
        2. 结构化数据通过 ToolResult.extra_info 传递，不需要在此报告中编码
        3. 此报告只是给 AI 看的友好文本，get_tool_detail 会从 extra_info 读取数据
        """

        # 区分核心任务和可选任务
        core_tasks = ["topics", "summary"]
        completed_tasks = [task for task in task_names if task not in failed_tasks]

        core_completed = [task for task in completed_tasks if task in core_tasks]
        optional_completed = [task for task in completed_tasks if task not in core_tasks]

        core_failed = [task for task in failed_tasks if task in core_tasks]
        optional_failed = [task for task in failed_tasks if task not in core_tasks]

        result = f"""🎯 音频分析完成！

📁 项目：{project_name}

📊 分析结果：
- 总计：{success_count}/{total_count} 个任务成功
- 核心任务：{len(core_completed)}/{len([t for t in task_names if t in core_tasks])} 个成功
- 可选分析：{len(optional_completed)}/{len([t for t in task_names if t not in core_tasks])} 个成功
"""

        # 显示已完成的核心任务
        if core_completed:
            result += "\n✅ 核心任务（必须）："
            for task in core_completed:
                cn_name = ANALYSIS_TASK_NAME_MAP.get(task, {}).get("cn", task)
                result += f"\n- {cn_name}"

        # 显示已完成的可选分析
        if optional_completed:
            result += "\n\n✅ 可选分析："
            for task in optional_completed:
                cn_name = ANALYSIS_TASK_NAME_MAP.get(task, {}).get("cn", task)
                result += f"\n- {cn_name}"

        # 显示失败的任务（如果有）
        if failed_tasks:
            result += "\n"

            if core_failed:
                result += "\n⚠️ 核心任务失败："
                for task in core_failed:
                    cn_name = ANALYSIS_TASK_NAME_MAP.get(task, {}).get("cn", task)
                    result += f"\n- {cn_name}"

            if optional_failed:
                result += "\n\n⚠️ 可选分析失败："
                for task in optional_failed:
                    cn_name = ANALYSIS_TASK_NAME_MAP.get(task, {}).get("cn", task)
                    result += f"\n- {cn_name}"

            result += "\n\n💡 提示：失败的任务不影响已完成部分的使用，可以稍后重试失败的分析。"

        result += f"""

🎯 项目状态：
整个项目文件夹已构建完成，包含 {len(completed_tasks)} 个成功的分析结果、主题标签和可视化界面。

💡 使用方式：
在前端界面点击项目图标即可打开项目面板，查看录音转写、总结、章节、标签等所有内容。

⚠️ 重要提醒：
- 所有分析文件已经生成完成，存储在项目文件夹中
- 主题标签已自动从纪要中提取并写入配置文件
- 除非用户明确要求查看或修改特定文件，否则无需再次读取这些文件
- 如果用户想重新生成某个分析，使用 specified_analysis_types 参数指定要重新分析的类型即可"""

        return result

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments or "project_path" not in arguments:
            return i18n.translate("analyze_audio_project.success", category="tool.messages")

        project_path = arguments["project_path"]
        project_name = Path(project_path).name

        return f"音频项目 {project_name} 分析完成"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """
        获取前端预览的工具详情（Terminal 样式）

        注意：
        1. 此方法输出英文内容，用于国际化的前端展示
        2. 通过 result.extra_info 获取结构化数据，避免解析文本
        3. result.content 是中文报告（给 AI 阅读），extra_info 是结构化数据（给前端使用）
        """
        if not result.ok or not result.content:
            return None

        try:
            # 提取参数
            project_path = arguments.get("project_path", "") if arguments else ""
            output_language = arguments.get("output_language", "") if arguments else ""
            context_files = arguments.get("context_files", []) if arguments else []
            user_additional_requirements = arguments.get("user_additional_requirements") if arguments else None
            specified_analysis_types = arguments.get("specified_analysis_types") if arguments else None

            project_name = Path(project_path).name if project_path else "audio_project"

            # 从 extra_info 中读取 scene_type（如果有）
            extra_info = result.extra_info or {}
            scene_type = extra_info.get("scene_type", "general")

            # 从 extra_info 中读取结构化数据（避免解析文本）
            extra_info = result.extra_info or {}
            success_count = extra_info.get("success_count", 0)
            total_count = extra_info.get("total_count", 0)
            completed_tasks = extra_info.get("completed_tasks", [])
            failed_tasks = extra_info.get("failed_tasks", [])

            # 构建终端样式的命令
            command = f"analyze_audio_project --project {project_name}"

            # 构建终端样式的输出（英文，用于国际化）
            output_lines = []
            output_lines.append("Audio project analysis completed!")
            output_lines.append("")

            # 显示参数信息
            output_lines.append("Parameters:")
            output_lines.append(f"  Project Path:    {project_path}")
            output_lines.append(f"  Output Language: {output_language}")
            output_lines.append(f"  Scene Type:      {scene_type}")

            if context_files:
                output_lines.append(f"  Context Files:   {len(context_files)} file(s)")
                for ctx_file in context_files[:3]:  # 最多显示前3个
                    output_lines.append(f"                   - {ctx_file}")
                if len(context_files) > 3:
                    output_lines.append(f"                   ... and {len(context_files) - 3} more")
            else:
                output_lines.append(f"  Context Files:   None")

            if user_additional_requirements:
                # 截断过长的额外需求
                req_preview = user_additional_requirements[:60] + "..." if len(user_additional_requirements) > 60 else user_additional_requirements
                output_lines.append(f"  Additional Req:  {req_preview}")
            else:
                output_lines.append(f"  Additional Req:  None")

            if specified_analysis_types:
                output_lines.append(f"  Analysis Types:  {specified_analysis_types}")
            else:
                output_lines.append(f"  Analysis Types:  All (default)")

            output_lines.append("")
            output_lines.append("Results:")
            output_lines.append(f"  Project:         {project_name}")
            output_lines.append(f"  Success:         {success_count}/{total_count} tasks")

            if completed_tasks:
                output_lines.append("")
                output_lines.append("Completed Analysis:")
                for task_key in completed_tasks:
                    # 从常量获取英文名
                    task_en = ANALYSIS_TASK_NAME_MAP.get(task_key, {}).get("en", task_key)
                    output_lines.append(f"  ✓ {task_en}")

            if failed_tasks:
                output_lines.append("")
                output_lines.append("Failed Analysis:")
                for task_key in failed_tasks:
                    # 从常量获取英文名
                    task_en = ANALYSIS_TASK_NAME_MAP.get(task_key, {}).get("en", task_key)
                    output_lines.append(f"  ✗ {task_en}")

            output_lines.append("")
            output_lines.append("Project Status:")
            output_lines.append("  ✓ All files generated")
            output_lines.append("  ✓ Tags extracted from summary")
            output_lines.append("  ✓ Visualization ready")
            output_lines.append("")
            output_lines.append("Next Step:")
            output_lines.append("  Click the project icon in frontend to open project panel")

            terminal_content = TerminalContent(
                command=command,
                output="\n".join(output_lines),
                exit_code=0 if not failed_tasks else 1
            )

            return ToolDetail(
                type=DisplayType.TERMINAL,
                data=terminal_content
            )
        except Exception as e:
            logger.error(f"生成工具详情失败: {e}")
            return None

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None
    ) -> Dict:
        """获取工具调用后的友好动作和备注"""
        if not result.ok:
            return {
                "action": i18n.translate("analyze_audio_project", category="tool.actions"),
                "remark": i18n.translate("analyze_audio_project.error", category="tool.messages")
            }

        return {
            "action": i18n.translate("analyze_audio_project", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
