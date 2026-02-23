from app.i18n import i18n
import asyncio
from pathlib import Path
from typing import Any, Dict, Optional, List

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.core.entity.message.server_message import DisplayType, TerminalContent, ToolDetail

# Import audio project analysis tool for reuse
from app.tools.analyze_audio_project import AnalyzeAudioProject, AnalyzeAudioProjectParams, ANALYSIS_TASK_NAME_MAP

logger = get_logger(__name__)

# Note: All analysis logic is delegated to audio project tool
# Video-specific behavior (if any) is handled through configuration


class AnalyzeVideoProjectParams(BaseToolParams):
    """分析视频项目参数"""

    project_path: str = Field(
        ...,
        description="""<!--zh: 视频项目文件夹路径，例如：'产品评审会议_20250109_140000'-->
Video project folder path, e.g., 'Product_Review_Meeting_20250109_140000'"""
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
- 视频转写文字稿（自动从 magic.project.js 读取，不需要在此列表中）

可选文件示例：
- 用户笔记：通常在视频项目文件夹内，如 "产品评审会议_20250109_140000/产品评审会议-笔记.md"
- 项目文档：可能在工作空间的其他位置，如 "项目文档/项目背景.md"、"技术方案/架构设计.md"
- 其他相关文件：任何你认为有助于分析的文件

使用示例：
[
    "项目文档/项目背景.md",
    "技术方案/架构设计.md"
]

注意：
1. 路径是相对于工作空间根目录，不是相对于视频项目文件夹
2. 视频转写文字稿会自动包含，不需要在此列表中
3. 文件不存在时会跳过（记录警告），不影响分析
4. 大文件可能影响分析效率和成本
5. 上下文传递顺序：视频转写 → 笔记 → 其他文件
-->
Additional context file list (paths relative to workspace root).

These files will be read and passed as additional context to analysis model, helping model better understand dialogue content.

Required files:
- Video transcript (automatically read from magic.project.js, no need in this list)

Optional file examples:
- User notes: Usually in video project folder, e.g., "Product_Review_Meeting_20250109_140000/Product_Review_Meeting-Notes.md"
- Project docs: May be elsewhere in workspace, e.g., "project-docs/project-background.md", "tech-specs/architecture.md"
- Other related files: Any files you think helpful for analysis

Usage example:
[
    "project-docs/project-background.md",
    "tech-specs/architecture.md"
]

Notes:
1. Paths are relative to workspace root, not video project folder
2. Video transcript automatically included, no need in this list
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
class AnalyzeVideoProject(AbstractFileTool[AnalyzeVideoProjectParams], WorkspaceTool[AnalyzeVideoProjectParams]):
    """<!--zh
    执行视频分析，并行调用多个AI智能体执行生成章节分析、内容总结及可选分析（权力动态、意图、量化数据、思维导图、洞察、金句）文件。
    最后生成 index.html 完成 Magic Project 构建。

    注意：本工具委托给 audio 分析工具执行核心逻辑，仅在可视化界面生成时有差异。
    -->
    Execute video analysis, parallel calling multiple AI agents to generate chapter analysis, content summary and optional analysis (power dynamics, intent, quantitative data, mind map, insights, highlights) files.
    Finally generate index.html to complete Magic Project construction.

    Note: This tool delegates to audio analysis tool for core logic, only differs in visualization template generation.
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Create audio project analysis instance for delegation
        self._audio_analyzer = AnalyzeAudioProject(**kwargs)

    async def execute(self, tool_context: ToolContext, params: AnalyzeVideoProjectParams) -> ToolResult:
        """
        执行视频分析操作（委托给 audio 工具，使用视频专用的可视化模板）

        Execute video analysis operation (delegates to audio tool, uses video-specific visualization template)

        Args:
            tool_context: 工具上下文 / Tool context
            params: 参数对象 / Parameter object

        Returns:
            ToolResult: 包含分析结果的详细信息 / Contains detailed analysis results
        """
        try:
            # Convert video params to audio params
            audio_params = AnalyzeAudioProjectParams(
                project_path=params.project_path,
                output_language=params.output_language,
                context_files=params.context_files,
                user_additional_requirements=params.user_additional_requirements,
                specified_analysis_types=params.specified_analysis_types
            )

            # Delegate to audio analyzer (handles all analysis logic)
            result = await self._audio_analyzer.execute(tool_context, audio_params)

            # If analysis succeeded, replace visualization template with video-specific one
            if result.ok:
                project_path = self.resolve_path(params.project_path)
                try:
                    # Generate video-specific visualization template
                    await self._copy_visualization_template(tool_context, project_path)
                    logger.info("视频可视化界面已生成")
                except Exception as e:
                    logger.error(f"生成视频可视化界面失败: {e}")
                    # 不影响分析结果，继续返回

            return result

        except Exception as e:
            logger.exception(f"视频分析失败: {e!s}")
            return ToolResult.error("Video analysis tool call failed")


    async def _copy_visualization_template(self, tool_context: ToolContext, project_path: Path):
        """
        生成视频专用可视化界面模板到项目文件夹

        Generate video-specific visualization interface template to project folder

        使用 generate_index.py 动态生成视频播放器界面
        在所有分析完成后调用，确保可视化界面与分析结果匹配

        Uses generate_index.py to dynamically generate video player interface
        Called after all analysis completes, ensures visualization matches analysis results

        Args:
            tool_context: 工具上下文 / Tool context
            project_path: 项目路径 / Project path
        """
        try:
            from agentlang.event.event import EventType
            index_path = project_path / "index.html"

            # 使用 versioning context 写入可视化界面（无需更新时间戳，因为是工具生成的文件）
            async with self._file_versioning_context(tool_context, index_path, update_timestamp=False):
                # 使用 generate_index 动态生成 HTML 模板（视频专用）
                from app.tools.magic_video.generate_index import generate_video_index

                def _generate():
                    return generate_video_index(
                        template_path='../magic_audio/index.html',
                        implementation_path='./media-player-implementation.js',
                        output_path=str(index_path),
                        title='超级麦吉视频播放器',
                        verbose=False  # 不输出详细日志
                    )

                # 在线程中执行生成操作（避免阻塞）
                result = await asyncio.to_thread(_generate)

                if not result.get('success'):
                    raise RuntimeError(f"生成可视化界面失败: {result.get('message', 'Unknown error')}")

            logger.info(f"成功生成视频可视化界面: {index_path}")

        except Exception as e:
            logger.error(f"生成视频可视化界面失败: {e}")
            raise

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容 / Get remark content"""
        if not arguments or "project_path" not in arguments:
            return i18n.translate("analyze_video_project.success", category="tool.messages")

        project_path = arguments["project_path"]
        project_name = Path(project_path).name

        return f"视频项目 {project_name} 分析完成"

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

            project_name = Path(project_path).name if project_path else "video_project"

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
            command = f"analyze_video_project --project {project_name}"

            # 构建终端样式的输出（英文，用于国际化）
            output_lines = []
            output_lines.append("Video project analysis completed!")
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
        """获取工具调用后的友好动作和备注 / Get friendly action and remark after tool call"""
        if not result.ok:
            return {
                "action": i18n.translate("analyze_video_project", category="tool.actions"),
                "remark": i18n.translate("analyze_video_project.error", category="tool.messages")
            }

        return {
            "action": i18n.translate("analyze_video_project", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
