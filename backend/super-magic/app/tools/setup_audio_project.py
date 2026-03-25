from app.i18n import i18n
import asyncio
import json
from pathlib import Path
from typing import Any, Dict, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from agentlang.utils.tool_param_utils import parse_multiline_kv
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.core.entity.message.server_message import DisplayType, TerminalContent, ToolDetail

logger = get_logger(__name__)


class SetupErrorType:
    """Setup error types (used in extra_info for differentiated error handling)"""
    FOLDER_NOT_EXISTS = "FOLDER_NOT_EXISTS"        # Project folder does not exist
    PATH_NOT_DIRECTORY = "PATH_NOT_DIRECTORY"      # Path is not a directory
    CONFIG_CREATE_FAILED = "CONFIG_CREATE_FAILED"  # Configuration file creation failed
    GENERAL_ERROR = "GENERAL_ERROR"                # General error


class SetupAudioProjectParams(BaseToolParams):
    """搭建音频项目参数"""

    project_path: str = Field(
        ...,
        description="""<!--zh: 已有音频项目文件夹路径（必须已存在，本工具不创建文件夹。调用前需要先创建此文件夹，并将音频文件和文字稿等放入此文件夹）。使用用户语言。示例：'录音总结_20251110_142921', 'Audio_Summary_20251110_142921', '音声要約_20251110_142921'-->
Existing audio project folder path (must already exist, this tool does not create folders. Before calling, need to create this folder first and place audio files and transcripts into it). Use user language. Examples: 'Audio_Summary_20251110_142921', '录音总结_20251110_142921', '音声要約_20251110_142921'"""
    )

    audio_title: str = Field(
        ...,
        description="""<!--zh: 音频标题，简洁描述。示例：'产品评审会议', 'Product Review Meeting', 'プロジェクト会議'-->
Audio title, concise description. Examples: 'Product Review Meeting', '产品评审会议', 'プロジェクト会議'"""
    )

    audio_file: str = Field(
        ...,
        description="""<!--zh: 音频文件名（相对于项目文件夹）。示例：'产品评审会议.webm', 'Product_Review_Meeting.mp3', 'プロジェクト会議.wav'-->
Audio filename (relative to project folder). Examples: 'Product_Review_Meeting.mp3', '产品评审会议.webm', 'プロジェクト会議.wav'"""
    )

    transcript_file: str = Field(
        ...,
        description="""<!--zh: 录音文字稿文件名。示例：'产品评审会议-录音文字稿.md', 'Product_Review_Meeting-Transcript.md', 'プロジェクト会議-文字起こし.md'-->
Transcript filename. Examples: 'Product_Review_Meeting-Transcript.md', '产品评审会议-录音文字稿.md', 'プロジェクト会議-文字起こし.md'"""
    )

    topics_file: str = Field(
        ...,
        description="""<!--zh: 章节主题文件名。示例：'产品评审会议-章节主题.md', 'Product_Review_Meeting-Topics.md', 'プロジェクト会議-トピック.md'-->
Chapter topics filename. Examples: 'Product_Review_Meeting-Topics.md', '产品评审会议-章节主题.md', 'プロジェクト会議-トピック.md'"""
    )

    summary_file: str = Field(
        ...,
        description="""<!--zh: 纪要文件名。示例：'产品评审会议-纪要.md', 'Product_Review_Meeting-Minutes.md', 'プロジェクト会議-議事録.md'-->
Minutes filename. Examples: 'Product_Review_Meeting-Minutes.md', '产品评审会议-纪要.md', 'プロジェクト会議-議事録.md'"""
    )

    duration: int = Field(
        ...,
        description="""<!--zh: 音频时长（秒），从音频元数据获取-->
Audio duration (seconds), obtained from audio metadata"""
    )

    date: str = Field(
        ...,
        description="""<!--zh: 录音日期时间，格式：YYYY-MM-DD HH:MM:SS-->
Recording date time, format: YYYY-MM-DD HH:MM:SS"""
    )

    notes_file: str = Field(
        ...,
        description="""<!--zh: 笔记文件名（必填，但可以为空字符串）。如果为空字符串，表示没有笔记。示例：'产品评审会议-笔记.md', 'Product_Review_Meeting-Notes.md', 'プロジェクト会議-ノート.md'。-->
Notes filename (required, but can be empty string). If empty string, means no notes. Examples: 'Product_Review_Meeting-Notes.md', '产品评审会议-笔记.md', 'プロジェクト会議-ノート.md'"""
    )

    scene_type: str = Field(
        default="general",
        description="""<!--zh
对话场景类型（必填，默认 general）

场景类型：
- meeting       会议类（战略会议、产品评审、项目复盘、头脑风暴、业务会议等）
- interview     访谈类（客户访谈、用户调研、新闻采访、专家访谈等）
- job_interview 面试类（求职面试、校招面试、候选人评估等）
- podcast       播客/节目类（播客录制、访谈节目、对谈节目等）
- presentation  分享/演讲类（技术分享、行业演讲、产品发布会、TED演讲等）
- learning      学习/培训类（听课、培训、工作坊、研讨会等）
- discussion    讨论/辩论类（3人以上的圆桌会谈、小组讨论、学术辩论等）
- conversation  对话/聊天类（一对一私密沟通、绩效面谈、朋友聊天、情感对话等）
- general       通用类（无法明确归类的情况）

场景判断依据：
- meeting：有议程、需决策、多人协作讨论
- interview：信息获取为目的、一对一问答
- podcast：内容传播为目的、主持+嘉宾模式
- presentation：单向输出为主、讲者+听众
- learning：知识传授为目的、讲师+学员
- discussion：多方观点碰撞、辩论性质
- conversation：私密沟通、情感交流

⚠️ 重要：场景类型会影响前端显示的标题和分析维度，需要准确判断
-->
Conversation scene type (required, default general)

Scene types:
- meeting       Meeting (strategic meeting, product review, project retrospective, brainstorming, business meeting, etc.)
- interview     Interview (customer interview, user research, news interview, expert interview, etc.)
- job_interview Job interview (recruitment interview, campus interview, candidate assessment, etc.)
- podcast       Podcast/show (podcast recording, interview show, dialogue show, etc.)
- presentation  Sharing/speech (technical sharing, industry speech, product launch, TED talk, etc.)
- learning      Learning/training (class, training, workshop, seminar, etc.)
- discussion    Discussion/debate (roundtable with 3+ people, group discussion, academic debate, etc.)
- conversation  Dialogue/chat (one-on-one private communication, performance review, friend chat, emotional dialogue, etc.)
- general       General (cases that cannot be clearly categorized)

Scene judgment criteria:
- meeting: has agenda, needs decisions, multi-party collaborative discussion
- interview: information gathering purpose, one-on-one Q&A
- podcast: content distribution purpose, host + guest mode
- presentation: mainly one-way output, speaker + audience
- learning: knowledge transfer purpose, instructor + student
- discussion: multi-party perspective collision, debate nature
- conversation: private communication, emotional exchange

⚠️ Important: Scene type affects frontend display titles and analysis dimensions, needs accurate judgment
"""
    )

    optional_files: str = Field(
        ...,
        description="""<!--zh
可选分析文件映射。格式：每行一个 key:value 键值对

可选的分析类型：

1. power_dynamics（权力动态分析）
   - 必须条件：2人及以上说话人
   - 适用：会议、讨论、辩论、多人访谈等
   - 禁止：单人独白、演讲、播客、教学讲座等单人场景

2. intent（意图分析）
   - 适用：会议、谈判、访谈、讨论等有互动性的内容
   - 不适用：纯技术分享、教学讲座等单向输出的内容

3. metrics（关键量化数据）
   - 适用：对话中包含各种数字型的数据、统计、指标等量化信息
   - 不适用：对话中几乎没有提及任何数字或量化信息

4. mindmap（思维导图）
   - 适用：内容有结构、有层次的讨论
   - 不适用：内容非常短（<3分钟）或过于零散
   - 建议：大部分情况下都有价值，帮助理解内容结构

5. insights（深度洞察）
   - 适用：有讨论价值的内容、重要决策、复杂问题等
   - 建议：大部分正式内容都值得深度分析

6. highlights（金句分析）
   - 适用：访谈、分享、播客、演讲、讲座等内容型对话
   - 不适用：日常业务会议等发言比较平淡的场景
   - 建议：只在内容有启发性、观点性、金句价值时列出

7. followup（待办事项）
   - 必选条件：会议场景（scene_type 为 meeting 时）
   - 可选条件：其它场景中有明确的待办任务、关键决策、问题跟进
   - 适用：需要会后跟进行动的场景
   - 不适用：纯分享、学习、访谈等无需后续行动的场景
   - 内容：待办事项、关键决策、遗留问题（可选）、风险提示（可选）、资源需求（可选）

使用说明：
- 未列出的分析类型：不执行
- 列出的分析类型：执行并将结果写入指定文件名

文件名要求：
- 优先使用用户偏好语言
- Markdown 文件用 .md 扩展名
- HTML 文件（metrics）用 .html 扩展名

示例（多个分析）：
followup:产品评审会议-待办事项.md
power_dynamics:产品评审会议-权力动态.md
intent:产品评审会议-意图分析.md
metrics:产品评审会议-关键数据.html
mindmap:产品评审会议-思维导图.md
insights:产品评审会议-洞察.md
highlights:产品评审会议-金句.md

示例（单个分析）：
power_dynamics:产品评审会议-权力动态.md

不执行任何可选分析时传空字符串
-->
Optional analysis file mapping. Format: one key:value pair per line

Available optional analysis types (select multiple based on content characteristics):

1. power_dynamics (Power dynamics analysis)
   - Required condition: 2 or more speakers
   - Applicable: meetings, discussions, debates, multi-person interviews, etc.
   - Prohibited: monologue, speech, podcast, lecture, other single-person scenarios

2. intent (Intent analysis)
   - Applicable: meetings, negotiations, interviews, discussions and other interactive content
   - Not applicable: pure technical sharing, lectures and other one-way output content

3. metrics (Key quantitative data)
   - Applicable: dialogue contains various numeric data, statistics, metrics and other quantitative information
   - Not applicable: dialogue contains almost no mention of numbers or quantitative information

4. mindmap (Mind map)
   - Applicable: content has structure and hierarchy
   - Not applicable: very short content (<3 minutes) or too scattered
   - Recommendation: include this in most cases for better content understanding

5. insights (Deep insights)
   - Applicable: content worth discussing, important decisions, complex problems, etc.
   - Recommendation: most formal content deserves deep analysis

6. highlights (Highlight analysis)
   - Applicable: interviews, sharing, podcasts, speeches, lectures and other content-oriented dialogues
   - Not applicable: daily business meetings and other scenarios with plain speeches
   - Recommendation: include when content has inspirational, viewpoint, or highlight value

7. followup (Follow-up tasks)
   - Required condition: meeting scene (when scene_type is meeting)
   - Optional condition: other scenes with clear follow-up tasks, key decisions, issue tracking
   - Applicable: scenarios requiring post-meeting follow-up actions
   - Not applicable: pure sharing, learning, interviews and other scenarios without follow-up actions
   - Content: follow-up tasks, key decisions, outstanding issues (optional), risk alerts (optional), resource requirements (optional)

Usage instructions:
- Unlisted analysis types: not executed
- Listed analysis types: executed and results written to specified filename
- Recommendation: select multiple analysis types for comprehensive insights

Filename requirements:
- Prioritize user language
- Markdown files use .md extension
- HTML files (metrics) use .html extension

Example (comprehensive analysis - recommended for important content):
followup:Product_Review_Meeting-Followup.md
power_dynamics:Product_Review_Meeting-Power.md
intent:Product_Review_Meeting-Intent.md
metrics:Product_Review_Meeting-Metrics.html
mindmap:Product_Review_Meeting-Mindmap.md
insights:Product_Review_Meeting-Insights.md
highlights:Product_Review_Meeting-Highlights.md

Example (minimal analysis):
power_dynamics:Product_Review_Meeting-Power.md

Pass empty string when not executing any optional analysis
"""
    )

    speakers: str = Field(
        ...,
        description="""<!--zh
说话人映射。格式：每行一个 key:value 键值对

优先级：角色 > 通用标识（禁止猜测真名）

根据文字稿内容和场景推测角色：
- 优先推测角色（使用用户语言）：
  - 面试场景：面试官、候选人
  - 会议场景：主持人、产品经理、技术负责人
  - 访谈场景：主持人、嘉宾、嘉宾A、嘉宾B
  - 培训场景：讲师、学员
- 无法推测角色：通用标识（"说话人1"、"说话人2" / "Speaker 1"、"Speaker 2" / "話し手1"、"話し手2"）

占比过滤：
- 若某说话人占比极小，可能是识别误差，判断是否应和已有说话人使用相同映射（如单人录音误识别出多人）

示例（面试场景）：
Speaker-1:面试官1
Speaker-2:候选人
Speaker-3:面试官2

示例（播客场景）：
Speaker-1:主持人
Speaker-2:嘉宾1
Speaker-2:嘉宾2

示例（无法推测）：
Speaker-1:说话人1
Speaker-2:说话人2

无说话人时传空字符串
若非推断语音转录识别有误，禁止出现多个Speaker-N映射到同一角色
-->
Speaker mapping. Format: one key:value pair per line

Priority: role > generic identifier (never guess real names)

Infer roles based on transcript content and scene:
- Prioritize role inference (use user language):
  - Interview scene: Interviewer, Candidate
  - Meeting scene: Host, Product Manager, Tech Lead
  - Interview show scene: Host, Guest, Guest A, Guest B
  - Training scene: Instructor, Student
- Cannot infer role: generic identifier ("Speaker 1", "Speaker 2" / "说话人1", "说话人2" / "話し手1", "話し手2")

Proportion filtering:
- If a speaker has very small proportion, may be recognition error, judge whether should use same mapping as existing speaker (e.g., single-person recording misidentified as multiple people)

Example (interview scene):
Speaker-1:Interviewer1
Speaker-2:Candidate
Speaker-3:Interviewer2

Example (podcast scene):
Speaker-1:Host
Speaker-2:Guest1
Speaker-2:Guest2

Example (cannot infer):
Speaker-1:Speaker 1
Speaker-2:Speaker 2

Pass empty string when no speakers
Unless inferring speech transcription has errors, prohibit multiple Speaker-N mapping to same role
"""
    )


@tool()
class SetupAudioProject(AbstractFileTool[SetupAudioProjectParams], WorkspaceTool[SetupAudioProjectParams]):
    """<!--zh
    搭建音频项目基础架构。调用前必须：完整读取文字稿，否则将无法识别所有说话人并完成映射！

    本工具在已有文件夹中生成项目骨架：
    - 生成 magic.project.js 配置文件（包含所有文件映射）

    注意：本工具不创建文件夹。调用前必须确保项目文件夹已存在，且音频文件、文字稿、笔记等已移入该文件夹。

    项目结构：
    ```
    产品评审会议_20250109_140000/
    ├── magic.project.js              # 项目配置（含说话人映射）
    ├── index.html                    # 可视化界面文件 (由 analyze_audio_project 创建)
    ├── 产品评审会议.webm             # 音频文件（已存在）
    ├── 产品评审会议-录音文字稿.md    # 待生成（由 audio_understanding 创建）
    ├── 产品评审会议-章节主题.md      # 待生成（由 analyze_audio_project 创建）
    ├── 产品评审会议-纪要.md          # 待生成（由 analyze_audio_project 创建）
    ├── 产品评审会议-权力动态.md      # 可选（由 analyze_audio_project 创建）
    ├── 产品评审会议-意图分析.md      # 可选（由 analyze_audio_project 创建）
    ├── 产品评审会议-金句.md          # 可选（由 analyze_audio_project 创建）
    ├── 产品评审会议-关键数据.html    # 可选（由 analyze_audio_project 创建）
    └── ...（更多）
    ```
    -->
    Setup audio project infrastructure. Must before calling: read transcript completely, otherwise unable to identify all speakers and complete mapping!

    This tool generates project skeleton in existing folder:
    - Generate magic.project.js configuration file (contains all file mappings)

    Note: This tool does not create folders. Before calling, must ensure project folder exists, and audio files, transcripts, notes have been moved into the folder.

    Project structure:
    ```
    Product_Review_Meeting_20250109_140000/
    ├── magic.project.js                # Project config (with speaker mapping)
    ├── index.html                      # Visualization interface file (created by analyze_audio_project)
    ├── Product_Review_Meeting.webm     # Audio file (exists)
    ├── Product_Review_Meeting-Transcript.md    # To generate (created by audio_understanding)
    ├── Product_Review_Meeting-Topics.md        # To generate (created by analyze_audio_project)
    ├── Product_Review_Meeting-Minutes.md       # To generate (created by analyze_audio_project)
    ├── Product_Review_Meeting-Power.md         # Optional (created by analyze_audio_project)
    ├── Product_Review_Meeting-Intent.md        # Optional (created by analyze_audio_project)
    ├── Product_Review_Meeting-Highlights.md    # Optional (created by analyze_audio_project)
    ├── Product_Review_Meeting-Metrics.html     # Optional (created by analyze_audio_project)
    └── ...(more)
    ```
    """

    async def execute(self, tool_context: ToolContext, params: SetupAudioProjectParams) -> ToolResult:
        """
        执行音频项目搭建操作

        Args:
            tool_context: 工具上下文
            params: 包含项目配置的参数对象

        Returns:
            ToolResult: 包含搭建结果的详细信息
        """
        created_files = []  # 记录已创建的文件，用于回滚

        try:
            # Parse multi-line key:value format to dict
            speakers_dict = parse_multiline_kv(params.speakers, "speakers")
            optional_files_dict = parse_multiline_kv(params.optional_files, "optional_files")

            # 获取安全的项目路径（文件夹应该已存在，由 AI 创建）
            project_path = self.resolve_path(params.project_path)
            # 检查项目文件夹是否存在
            if not await asyncio.to_thread(project_path.exists):
                return ToolResult(
                    error=f"项目文件夹不存在：{project_path}，必须先创建文件夹。",
                    extra_info={"error_type": SetupErrorType.FOLDER_NOT_EXISTS},
                    use_custom_remark=True
                )

            if not await asyncio.to_thread(project_path.is_dir):
                return ToolResult(
                    error=f"路径不是文件夹：{project_path}",
                    extra_info={"error_type": SetupErrorType.PATH_NOT_DIRECTORY},
                    use_custom_remark=True
                )

            # 定义文件路径
            project_js_path = project_path / "magic.project.js"

            # 生成 magic.project.js 配置
            config_data = {
                "version": "1.0.0",
                "type": "audio",
                "name": params.audio_title,
                "files": {
                    "audio": params.audio_file,
                    "transcript": params.transcript_file,
                    "topics": params.topics_file,
                    "summary": params.summary_file
                },
                "metadata": {
                    "title": params.audio_title,
                    "date": params.date,
                    "duration": params.duration,
                    "speakers": speakers_dict,  # Use parsed dict
                    "scene_type": params.scene_type,  # Record scene type for frontend display
                    "tags": []  # Tags will be generated in analyze_audio_project
                }
            }

            # 添加笔记文件（如果提供非空字符串）
            if params.notes_file and params.notes_file.strip():
                config_data["files"]["notes"] = params.notes_file

            # 添加可选分析文件（如果提供非空字典）
            if optional_files_dict:
                config_data["files"].update(optional_files_dict)

            config_json = json.dumps(config_data, indent=2, ensure_ascii=False)
            project_js_content = f"""window.magicProjectConfig = {config_json};

if (typeof window.magicProjectConfigure === 'function') {{
  window.magicProjectConfigure(window.magicProjectConfig);
}}
"""

            # 使用 versioning context 写入文件（无需更新时间戳，因为是工具生成的文件）
            try:
                async with self._file_versioning_context(tool_context, project_js_path, update_timestamp=False):
                    await asyncio.to_thread(project_js_path.write_text, project_js_content, encoding='utf-8')
                created_files.append(project_js_path)
                logger.info(f"创建项目配置文件: {project_js_path}")
            except Exception as e:
                logger.error(f"创建 magic.project.js 失败: {e}")
                return ToolResult(
                    error=f"创建 magic.project.js 失败: {e}",
                    extra_info={"error_type": SetupErrorType.CONFIG_CREATE_FAILED},
                    use_custom_remark=True
                )

            # 生成结果内容
            result_content = self._generate_result_content(params, speakers_dict, optional_files_dict, project_path.name)

            return ToolResult(content=result_content)

        except Exception as e:
            logger.exception(f"音频项目搭建失败: {e!s}")

            # Rollback: Delete created project files (magic.project.js)
            await self._rollback_created_files(created_files)

            return ToolResult(
                error=f"音频项目搭建失败: {e!s}",
                extra_info={"error_type": SetupErrorType.GENERAL_ERROR},
                use_custom_remark=True
            )

    async def _rollback_created_files(self, created_files: list):
        """
        回滚已创建的文件

        Args:
            created_files: 已创建的文件路径列表
        """
        # 逆序删除，先删除文件
        for path in reversed(created_files):
            try:
                if isinstance(path, Path):
                    from agentlang.utils.file import safe_delete
                    await safe_delete(path)
                    logger.info(f"回滚删除: {path}")
            except Exception as rollback_error:
                logger.error(f"回滚删除失败 {path}: {rollback_error}")

    def _generate_result_content(self, params: SetupAudioProjectParams, speakers_dict: Dict[str, str], optional_files_dict: Dict[str, str], folder_name: str) -> str:
        """
        生成结构化的结果内容（中文，给 AI 阅读）

        注意：此方法输出中文内容，供 AI 阅读和理解。
        如果修改此处内容，也要同步检查和更新 get_tool_detail 方法（输出英文给前端）。
        两者需要保持同步。

        Args:
            params: 项目参数
            speakers_dict: 解析后的说话人字典
            optional_files_dict: 解析后的可选文件字典
            folder_name: 文件夹名称

        Returns:
            str: 格式化的结果内容
        """
        # 计算时长显示
        duration_minutes = params.duration // 60
        duration_seconds = params.duration % 60
        duration_str = f"{duration_minutes}分{duration_seconds}秒"

        # 构建项目结构显示
        structure_lines = [
            f"{folder_name}/",
            "├── magic.project.js   # 项目配置",
            f"├── {params.audio_file}",
            f"├── {params.transcript_file}  # 待生成"
        ]

        # 添加笔记（如果提供）
        if params.notes_file and params.notes_file.strip():
            structure_lines.append(f"├── {params.notes_file}  # 用户笔记（可在查看器中编辑）")

        structure_lines.extend([
            f"├── {params.topics_file}      # 待生成",
            f"├── {params.summary_file}     # 待生成",
            "└── index.html         # 待生成（可视化界面）"
        ])

        # 添加可选分析文件
        if optional_files_dict:
            for analysis_type, filename in optional_files_dict.items():
                structure_lines.append(f"└── {filename}  # 可选分析: {analysis_type}")

        # 生成说话人信息显示
        if speakers_dict:
            speakers_display = "、".join([f"{k}({v})" for k, v in speakers_dict.items()])
        else:
            speakers_display = "待识别"

        result = f"""🎯 音频项目搭建完成！

📁 项目结构：
{chr(10).join(structure_lines)}

📊 项目信息：
- 标题：{params.audio_title}
- 时长：{duration_str}
- 日期：{params.date}
- 说话人：{speakers_display}

🎯 下一步：
使用 analyze_audio_project 执行分析 → 生成所有分析文件（包括主题标签）"""

        return result

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments or "audio_title" not in arguments:
            return i18n.translate("setup_audio_project.exception", category="tool.messages")

        audio_title = arguments["audio_title"]
        duration = arguments.get("duration", 0)
        duration_minutes = duration // 60
        duration_str = f"{duration_minutes}分钟"

        return i18n.translate("setup_audio_project.success", category="tool.messages", title=audio_title,
                              duration=duration_str)

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """
        获取前端预览的工具详情（Terminal 样式）

        注意：此方法输出英文内容，用于国际化的前端展示。
        如果修改此处内容，也要同步检查和更新 _generate_result_content 方法（输出中文给 AI）。
        两者需要保持同步。
        """
        if not result.ok:
            return None

        try:
            # 提取参数
            audio_title = arguments.get("audio_title", "Audio Project") if arguments else "Audio Project"
            project_path = arguments.get("project_path", "") if arguments else ""
            duration = arguments.get("duration", 0) if arguments else 0

            # 格式化时长
            duration_minutes = duration // 60
            duration_seconds = duration % 60
            duration_str = f"{duration_minutes}m {duration_seconds}s"

            # 确定文件夹名称
            folder_name = Path(project_path).name if project_path else "project"

            # 构建终端样式的命令
            command = f"setup_audio_project --project {folder_name}"

            # 构建终端样式的输出（英文，用于国际化）
            output_lines = []
            output_lines.append("Audio project setup completed successfully!")
            output_lines.append("")
            output_lines.append(f"Project:       {folder_name}")
            output_lines.append(f"Title:         {audio_title}")
            output_lines.append(f"Duration:      {duration_str} ({duration}s)")
            output_lines.append("")
            output_lines.append("Created Files:")
            output_lines.append("  ✓ magic.project.js    # Project configuration")
            output_lines.append("")
            output_lines.append("Next Step:")
            output_lines.append("  Use analyze_audio_project to generate analysis files, tags and visualization")

            terminal_content = TerminalContent(
                command=command,
                output="\n".join(output_lines),
                exit_code=0
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
        """
        获取工具调用后的友好动作和备注
        """
        if not result.ok:
            # Get error type from extra_info
            error_type = result.extra_info.get("error_type") if result.extra_info else None

            # Return differentiated friendly message based on error type
            if error_type == SetupErrorType.FOLDER_NOT_EXISTS:
                remark = i18n.translate("audio_understanding.project_folder_not_exists", category="tool.messages")
            elif error_type == SetupErrorType.PATH_NOT_DIRECTORY:
                remark = i18n.translate("audio_understanding.project_path_not_directory", category="tool.messages")
            elif error_type == SetupErrorType.CONFIG_CREATE_FAILED:
                remark = i18n.translate("audio_understanding.project_config_create_failed", category="tool.messages")
            else:
                # Fallback to generic error message
                remark = i18n.translate("setup_audio_project.exception", category="tool.messages")

            return {
                "action": i18n.translate("setup_audio_project", category="tool.actions"),
                "remark": remark
            }

        return {
            "action": i18n.translate("setup_audio_project", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
