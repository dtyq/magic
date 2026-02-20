from app.i18n import i18n
import asyncio
import json
from pathlib import Path
from typing import Any, Dict, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.core.entity.message.server_message import DisplayType, TerminalContent, ToolDetail

# Import audio project setup tool for reuse
from app.tools.setup_audio_project import SetupAudioProject, SetupAudioProjectParams

logger = get_logger(__name__)


class SetupVideoProjectParams(BaseToolParams):
    """搭建视频项目参数"""

    project_path: str = Field(
        ...,
        description="""<!--zh: 已有视频项目文件夹路径（必须已存在，本工具不创建文件夹。调用前需要先创建此文件夹，并将视频文件和文字稿等放入此文件夹）。使用用户语言。示例：'视频总结_20251110_142921', 'Video_Summary_20251110_142921', 'ビデオ要約_20251110_142921'-->
Existing video project folder path (must already exist, this tool does not create folders. Before calling, need to create this folder first and place video files and transcripts into it). Use user language. Examples: 'Video_Summary_20251110_142921', '视频总结_20251110_142921', 'ビデオ要約_20251110_142921'"""
    )

    video_title: str = Field(
        ...,
        description="""<!--zh: 视频标题，简洁描述。示例：'产品演示', 'Product Demo', 'プロジェクトデモ'-->
Video title, concise description. Examples: 'Product Demo', '产品演示', 'プロジェクトデモ'"""
    )

    video_file: Optional[str] = Field(
        default=None,
        description="""<!--zh
视频文件名（相对于项目文件夹）

- local 平台：必填，用于在界面中显示视频
- youtube 平台：不需要（使用 youtube_video_id）

示例：'产品演示.mp4' / 'product-demo.mp4' / 'プロジェクトデモ.mov'
-->
Video filename (relative to project folder)

- local platform: Required, used to display video in interface
- youtube platform: Not needed (uses youtube_video_id)

Examples: 'product-demo.mp4', '产品演示.mp4', 'プロジェクトデモ.mov'
"""
    )

    audio_file: str = Field(
        ...,
        description="""<!--zh: 音频文件名（相对于项目文件夹，必填）。示例：'产品演示.mp3', 'product-demo.mp3', 'プロジェクトデモ.m4a'-->
Audio filename (relative to project folder, required). Examples: 'product-demo.mp3', '产品演示.mp3', 'プロジェクトデモ.m4a'"""
    )

    transcript_file: str = Field(
        ...,
        description="""<!--zh: 视频文字稿文件名。示例：'产品演示-视频文字稿.md', 'product-demo-transcript.md', 'プロジェクトデモ-文字起こし.md'-->
Video transcript filename. Examples: 'product-demo-transcript.md', '产品演示-视频文字稿.md', 'プロジェクトデモ-文字起こし.md'"""
    )

    topics_file: str = Field(
        ...,
        description="""<!--zh: 章节主题文件名。示例：'产品演示-章节主题.md', 'product-demo-topics.md', 'プロジェクトデモ-トピック.md'-->
Chapter topics filename. Examples: 'product-demo-topics.md', '产品演示-章节主题.md', 'プロジェクトデモ-トピック.md'"""
    )

    summary_file: str = Field(
        ...,
        description="""<!--zh: 内容总结文件名。示例：'产品演示-总结.md', 'product-demo-summary.md', 'プロジェクトデモ-要約.md'-->
Content summary filename. Examples: 'product-demo-summary.md', '产品演示-总结.md', 'プロジェクトデモ-要約.md'"""
    )

    duration: int = Field(
        ...,
        description="""<!--zh: 视频时长（秒），从视频元数据获取-->
Video duration (seconds), obtained from video metadata"""
    )

    date: str = Field(
        ...,
        description="""<!--zh: 录制日期时间，格式：YYYY-MM-DD HH:MM:SS-->
Recording date time, format: YYYY-MM-DD HH:MM:SS"""
    )

    notes_file: str = Field(
        ...,
        description="""<!--zh: 笔记文件名（必填，但可以为空字符串）。如果为空字符串，表示没有笔记。示例：'产品演示-笔记.md', 'product-demo-notes.md', 'プロジェクトデモ-ノート.md'。-->
Notes filename (required, but can be empty string). If empty string, means no notes. Examples: 'product-demo-notes.md', '产品演示-笔记.md', 'プロジェクトデモ-ノート.md'"""
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
   - 必选条件：会议场景（meeting）
   - 可选条件：其它场景中有明确的待办任务、关键决策、问题跟进
   - 适用：需要会后跟进行动的场景
   - 不适用：纯分享、学习、访谈等无需后续行动的场景
   - 内容：待办事项、关键决策、遗留问题（可选）、风险提示（可选）、资源需求（可选）

使用说明：
- 未列出的分析类型：不执行
- 列出的分析类型：执行并将结果写入指定文件名

文件名要求：
- 优先使用用户语言
- Markdown 文件用 .md 扩展名
- HTML 文件（metrics）用 .html 扩展名

示例（多个分析）：
followup:产品演示-待办事项.md
power_dynamics:产品演示-权力动态.md
intent:产品演示-意图分析.md
metrics:产品演示-关键数据.html
mindmap:产品演示-思维导图.md
insights:产品演示-洞察.md
highlights:产品演示-金句.md

示例（单个分析）：
power_dynamics:产品演示-权力动态.md

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
followup:Product_Demo-Followup.md
power_dynamics:Product_Demo-Power.md
intent:Product_Demo-Intent.md
metrics:Product_Demo-Metrics.html
mindmap:Product_Demo-Mindmap.md
insights:Product_Demo-Insights.md
highlights:Product_Demo-Highlights.md

Example (minimal analysis):
power_dynamics:Product_Demo-Power.md

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
Speaker-1:面试官
Speaker-2:候选人

示例（播客场景）：
Speaker-1:主持人
Speaker-2:嘉宾

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
Speaker-1:Interviewer
Speaker-2:Candidate

Example (podcast scene):
Speaker-1:Host
Speaker-2:Guest

Example (cannot infer):
Speaker-1:Speaker 1
Speaker-2:Speaker 2

Pass empty string when no speakers
Unless inferring speech transcription has errors, prohibit multiple Speaker-N mapping to same role
"""
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

    platform: str = Field(
        default="local",
        description="""<!--zh
视频平台类型（可选，默认 local）

平台类型：
- youtube  YouTube 视频（需要提供 youtube_video_id）
- local    本地视频文件（默认）

⚠️ 重要：必须准确识别平台类型，如果调用了(get_youtube_video_info、download_youtube_video_media)工具，则必须设置为 youtube，否则将无法正确显示视频。
-->
Video platform type (optional, default local)

Platform types:
- youtube  YouTube video (requires youtube_video_id)
- local    Local video file (default)

⚠️ Important: Must accurately identify platform type, if called (get_youtube_video_info, download_youtube_video_media) tools, must set to youtube, otherwise video cannot be displayed correctly.
"""
    )

    youtube_video_id: Optional[str] = Field(
        default=None,
        description="""<!--zh
YouTube 视频 ID（可选，当 platform 为 youtube 时必填）

YouTube 视频 ID 为 11 位字符。
示例：'dQw4w9WgXcQ'
-->
YouTube video ID (optional, required when platform is youtube)

YouTube video ID is 11 characters.
Example: 'dQw4w9WgXcQ'
"""
    )


@tool()
class SetupVideoProject(AbstractFileTool[SetupVideoProjectParams], WorkspaceTool[SetupVideoProjectParams]):
    """<!--zh
    搭建视频项目基础架构。调用前必须：完整读取文字稿，否则将无法识别所有说话人并完成映射！

    本工具在已有文件夹中生成项目骨架：
    - 生成 magic.project.js 配置文件（包含所有文件映射）

    注意：本工具不创建文件夹。调用前必须确保项目文件夹已存在，且视频文件、文字稿、笔记等已移入该文件夹。

    项目结构：
    ```
    产品演示_20250109_140000/
    ├── magic.project.js              # 项目配置（含说话人映射）
    ├── index.html                    # 可视化界面文件 (由 analyze_video_project 创建)
    ├── 产品演示.mp4                  # 视频文件（已存在）
    ├── 产品演示-视频文字稿.md        # 待生成（由 audio_understanding 创建）
    ├── 产品演示-章节主题.md          # 待生成（由 analyze_video_project 创建）
    ├── 产品演示-总结.md              # 待生成（由 analyze_video_project 创建）
    ├── 产品演示-权力动态.md          # 可选（由 analyze_video_project 创建）
    ├── 产品演示-意图分析.md          # 可选（由 analyze_video_project 创建）
    ├── 产品演示-金句.md              # 可选（由 analyze_video_project 创建）
    ├── 产品演示-关键数据.html        # 可选（由 analyze_video_project 创建）
    └── ...（更多）
    ```
    -->
    Setup video project infrastructure. Must before calling: read transcript completely, otherwise unable to identify all speakers and complete mapping!

    This tool generates project skeleton in existing folder:
    - Generate magic.project.js configuration file (contains all file mappings)

    Note: This tool does not create folders. Before calling, must ensure project folder exists, and video files, transcripts, notes have been moved into the folder.

    Project structure:
    ```
    Product_Demo_20250109_140000/
    ├── magic.project.js                # Project config (with speaker mapping)
    ├── index.html                      # Visualization interface file (created by analyze_video_project)
    ├── Product_Demo.mp4                # Video file (exists)
    ├── Product_Demo-Transcript.md       # To generate (created by audio_understanding)
    ├── Product_Demo-Topics.md          # To generate (created by analyze_video_project)
    ├── Product_Demo-Summary.md         # To generate (created by analyze_video_project)
    ├── Product_Demo-Power.md           # Optional (created by analyze_video_project)
    ├── Product_Demo-Intent.md          # Optional (created by analyze_video_project)
    ├── Product_Demo-Highlights.md      # Optional (created by analyze_video_project)
    ├── Product_Demo-Metrics.html       # Optional (created by analyze_video_project)
    └── ...(more)
    ```
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Create audio project setup instance for delegation
        self._audio_setup = SetupAudioProject(**kwargs)

    async def execute(self, tool_context: ToolContext, params: SetupVideoProjectParams) -> ToolResult:
        """
        执行视频项目搭建操作（委托给 audio 工具，添加视频特定配置）

        Execute video project setup operation (delegates to audio tool, adds video-specific configuration)

        Args:
            tool_context: 工具上下文 / Tool context
            params: 包含项目配置的参数对象 / Parameter object containing project configuration

        Returns:
            ToolResult: 包含搭建结果的详细信息 / Contains detailed setup results
        """
        try:
            # Validate: local platform must have video_file
            if params.platform == "local" and not params.video_file:
                error_msg = "当 platform 为 local 时，必须提供 video_file 参数，否则无法显示视频"
                logger.error(error_msg)
                return ToolResult(error=error_msg)

            # Validate: youtube platform must have youtube_video_id
            if params.platform == "youtube" and not params.youtube_video_id:
                error_msg = "当 platform 为 youtube 时，必须提供 youtube_video_id 参数"
                logger.error(error_msg)
                return ToolResult(error=error_msg)

            # Convert video params to audio params
            audio_params = SetupAudioProjectParams(
                project_path=params.project_path,
                audio_title=params.video_title,
                audio_file=params.audio_file,
                transcript_file=params.transcript_file,
                topics_file=params.topics_file,
                summary_file=params.summary_file,
                duration=params.duration,
                date=params.date,
                notes_file=params.notes_file,
                optional_files=params.optional_files,
                speakers=params.speakers,
                scene_type=params.scene_type
            )

            # Delegate to audio setup tool
            result = await self._audio_setup.execute(tool_context, audio_params)

            # If audio setup succeeded, add video-specific metadata
            if result.ok:
                project_path = self.resolve_path(params.project_path)
                # Update config with video-specific fields
                await self._add_video_metadata(project_path, params)

                # Update result content to reflect video project
                result_content = self._generate_video_result_content(params, project_path.name)
                result = ToolResult(content=result_content)

            return result

        except Exception as e:
            logger.exception(f"视频项目搭建失败: {e!s}")
            return ToolResult(error="Failed to setup video project")

    async def _add_video_metadata(self, project_path: Path, params: SetupVideoProjectParams):
        """
        添加视频特定的元数据到配置文件

        Add video-specific metadata to configuration file

        Args:
            project_path: 项目路径 / Project path
            params: 视频项目参数 / Video project parameters
        """
        try:
            config_path = project_path / "magic.project.js"
            if not await asyncio.to_thread(config_path.exists):
                logger.warning(f"配置文件不存在: {config_path}")
                return

            content = await asyncio.to_thread(config_path.read_text, encoding="utf-8")

            # Extract JSON config
            import re
            json_match = re.search(r'window\.magicProjectConfig\s*=\s*({[\s\S]*?});', content)
            if not json_match:
                logger.warning("无法解析配置文件 JSON")
                return

            config_json = json_match.group(1)
            config_data = json.loads(config_json)

            # Update type to video
            config_data["type"] = "video"

            # Add video file if provided
            if params.video_file:
                config_data["files"]["video"] = params.video_file

            # Add platform metadata
            config_data["metadata"]["platform"] = params.platform

            # Add YouTube video ID if platform is youtube
            if params.platform == "youtube" and params.youtube_video_id:
                config_data["metadata"]["youtube_video_id"] = params.youtube_video_id

            # Write back
            new_config_json = json.dumps(config_data, indent=2, ensure_ascii=False)
            new_content = f"""window.magicProjectConfig = {new_config_json};

if (typeof window.magicProjectConfigure === 'function') {{
  window.magicProjectConfigure(window.magicProjectConfig);
}}
"""

            await asyncio.to_thread(config_path.write_text, new_content, encoding='utf-8')
            logger.info("已添加视频特定元数据到配置文件")

        except Exception as e:
            logger.error(f"添加视频元数据失败: {e}")
            # 不抛异常，不影响主流程

    def _generate_video_result_content(self, params: SetupVideoProjectParams, folder_name: str) -> str:
        """
        生成视频项目结果内容（中文，给 AI 阅读）

        Generate video project result content (Chinese, for AI reading)

        Args:
            params: 项目参数 / Project parameters
            folder_name: 文件夹名称 / Folder name

        Returns:
            str: 格式化的结果内容 / Formatted result content
        """
        from agentlang.utils.tool_param_utils import parse_multiline_kv

        # Parse speakers and optional files for display
        speakers_dict = parse_multiline_kv(params.speakers, "speakers") if params.speakers else {}
        optional_files_dict = parse_multiline_kv(params.optional_files, "optional_files") if params.optional_files else {}

        # 计算时长显示
        duration_minutes = params.duration // 60
        duration_seconds = params.duration % 60
        duration_str = f"{duration_minutes}分{duration_seconds}秒"

        # 构建项目结构显示
        structure_lines = [
            f"{folder_name}/",
            "├── magic.project.js   # 项目配置",
        ]

        # 添加视频文件（如果提供）
        if params.video_file:
            structure_lines.append(f"├── {params.video_file}")

        structure_lines.append(f"├── {params.audio_file}")
        structure_lines.append(f"├── {params.transcript_file}  # 待生成")

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

        # 平台信息
        platform_info = ""
        if params.platform == "youtube":
            platform_info = f"\n- 平台：YouTube (ID: {params.youtube_video_id})"
        else:
            platform_info = "\n- 平台：本地视频"

        result = f"""🎯 视频项目搭建完成！

📁 项目结构：
{chr(10).join(structure_lines)}

📊 项目信息：
- 标题：{params.video_title}
- 时长：{duration_str}
- 日期：{params.date}
- 说话人：{speakers_display}{platform_info}

🎯 下一步：
使用 analyze_video_project 执行分析 → 生成所有分析文件"""

        return result

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容（与 audio 工具保持一致） / Get remark content (consistent with audio tool)"""
        if not arguments or "video_title" not in arguments:
            return i18n.translate("setup_video_project.exception", category="tool.messages")

        video_title = arguments["video_title"]
        duration = arguments.get("duration", 0)
        duration_minutes = duration // 60

        # 根据当前语言格式化时长
        current_lang = i18n.get_language()
        if current_lang.startswith('zh'):
            duration_str = f"{duration_minutes}分钟"
        else:
            duration_str = f"{duration_minutes} min" if duration_minutes != 1 else "1 min"

        return i18n.translate("setup_video_project.success", category="tool.messages", title=video_title,
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
            video_title = arguments.get("video_title", "Video Project") if arguments else "Video Project"
            project_path = arguments.get("project_path", "") if arguments else ""
            duration = arguments.get("duration", 0) if arguments else 0

            # 格式化时长
            duration_minutes = duration // 60
            duration_seconds = duration % 60
            duration_str = f"{duration_minutes}m {duration_seconds}s"

            # 确定文件夹名称
            folder_name = Path(project_path).name if project_path else "project"

            # 构建终端样式的命令
            command = f"setup_video_project --project {folder_name}"

            # 构建终端样式的输出（英文，用于国际化）
            output_lines = []
            output_lines.append("Video project setup completed successfully!")
            output_lines.append("")
            output_lines.append(f"Project:       {folder_name}")
            output_lines.append(f"Title:         {video_title}")
            output_lines.append(f"Duration:      {duration_str} ({duration}s)")
            output_lines.append("")
            output_lines.append("Created Files:")
            output_lines.append("  ✓ magic.project.js    # Project configuration")
            output_lines.append("")
            output_lines.append("Next Step:")
            output_lines.append("  Use analyze_video_project to generate analysis files and visualization")

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
        获取工具调用后的友好动作和备注（与 audio 工具保持一致的错误处理）

        Get friendly action and remark after tool call (consistent error handling with audio tool)
        """
        if not result.ok:
            # Import error types from audio setup
            from app.tools.setup_audio_project import SetupErrorType

            # Get error type from extra_info (delegated from audio setup)
            error_type = result.extra_info.get("error_type") if result.extra_info else None

            # Return differentiated friendly message based on error type
            if error_type == SetupErrorType.FOLDER_NOT_EXISTS:
                remark = i18n.translate("video.project_folder_not_exists", category="tool.messages")
            elif error_type == SetupErrorType.PATH_NOT_DIRECTORY:
                remark = i18n.translate("video.project_path_not_directory", category="tool.messages")
            elif error_type == SetupErrorType.CONFIG_CREATE_FAILED:
                remark = i18n.translate("video.project_config_create_failed", category="tool.messages")
            else:
                # Fallback to generic error message
                remark = i18n.translate("setup_video_project.exception", category="tool.messages")

            return {
                "action": i18n.translate("setup_video_project", category="tool.actions"),
                "remark": remark
            }

        return {
            "action": i18n.translate("setup_video_project", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
