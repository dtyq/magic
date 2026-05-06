import json
from typing import Any, Dict, List, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.ai_abilities import get_video_understanding_model_id, get_video_understanding_timeout
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.tools.core import BaseTool, BaseToolParams, tool
from app.tools.media_utils import extract_media_source_name
from app.tools.video_understanding_utils import (
    VideoLLMRequestHandler,
    VideoProcessor,
    format_video_source_info,
    probe_all_videos,
)

logger = get_logger(__name__)


class VideoUnderstandingParams(BaseToolParams):
    videos: List[str] = Field(
        ...,
        description="""<!--zh: 视频来源列表，可以是视频 URL 或本地文件路径，支持多视频输入-->
Video source list, can be video URLs or local file paths, supports multiple video input"""
    )
    query: str = Field(
        ...,
        description="""<!--zh: 关于视频的问题或分析需求，需要详尽且准确，若用户提供了视频分析需求，则需要对用户的分析需求进行逐字引用，并提供必要的分析背景信息-->
Question or analysis requirements about the video, needs to be thorough and accurate. If user provides video analysis requirements, quote user's analysis requirements verbatim and provide necessary analysis background information"""
    )
    confirmed: bool = Field(
        default=False,
        description="""<!--zh: 长视频确认标记。当视频超过 3 分钟时工具会返回确认提示，用 ask_user 获得用户同意后设为 true 重新调用-->
Long video confirmation flag. When video exceeds 3 minutes the tool returns a confirmation prompt; set to true after getting user consent via ask_user"""
    )


@tool()
class VideoUnderstanding(BaseTool[VideoUnderstandingParams]):
    """<!--zh
    视频理解工具：调用 AI 视频专家来查看、分析或解释视频内容。
    视频专家无法得知你所知晓的上下文，因此需要提供必要且充足的背景与需求信息。

    最佳实践：
    1、分析需求明确时，为视频专家提供完整的逐字引用的分析需求
    2、需要说明分析背景，帮助视频专家理解分析意图
    3、要求视频专家描述视频内容、场景、主题等关键信息

    支持格式：MP4、AVI、MOV、MKV、WebM 等常见视频格式（视模型支持情况而定）
    适用场景：视频内容识别描述、场景分析、主题提炼、人物行为分析、多视频对比等视频理解场景

    要求：
    - 输入视频 URL 链接或本地文件路径，支持同时输入多个视频
    - 提供对视频内容的具体问题或要求描述
    调用示例：
    ```
    # URL 输入
    {
        "videos": ["https://example.com/video1.mp4", "https://example.com/video2.mp4"],
        "query": "..." # 输入分析需求
    }
    ```
    或
    ```
    # 本地文件路径输入
    {
        "videos": ["./uploads/video1.mp4"],
        "query": "..." # 输入分析需求
    }
    ```
    -->
    Video understanding tool: Call AI video expert to view, analyze or interpret video content.
    Video expert cannot know the context you know, so provide necessary and sufficient background and requirement information.

    Best practices:
    1. When analysis requirements are clear, provide video expert with complete verbatim quoted analysis requirements
    2. Provide analysis background to help the video expert understand the intent
    3. Ask the video expert to describe video content, scenes, themes and key information

    Supported formats: MP4, AVI, MOV, MKV, WebM and other common video formats (depends on model support)
    Use scenarios: Video content recognition/description, scene analysis, theme extraction, character behavior analysis, multi-video comparison and other video understanding scenarios

    Requirements:
    - Input video URL links or local file paths, supports inputting multiple videos simultaneously
    - Provide specific questions or requirement descriptions about video content
    Usage examples:
    ```
    # URL input
    {
        "videos": ["https://example.com/video1.mp4", "https://example.com/video2.mp4"],
        "query": "..." # Input analysis requirements
    }
    ```
    or
    ```
    # Local file path input
    {
        "videos": ["./uploads/video1.mp4"],
        "query": "..." # Input analysis requirements
    }
    ```
    """

    def __init__(self, **data):
        super().__init__(**data)
        self._video_processor = VideoProcessor()

    async def execute(
        self,
        tool_context: ToolContext,
        params: VideoUnderstandingParams,
    ) -> ToolResult:
        return await self.execute_purely(params)

    async def execute_purely(
        self,
        params: VideoUnderstandingParams,
    ) -> ToolResult:
        """执行视频理解并返回结果，不依赖 tool_context，可被外部直接调用。

        Args:
            params: 视频理解参数对象

        Returns:
            ToolResult: 包含视频理解结果的工具结果
        """
        videos = params.videos
        query = params.query

        if not videos:
            return ToolResult.error("请提供至少一个视频来源进行分析")

        if not query or not query.strip():
            return ToolResult.error("请提供对视频的分析需求或问题")

        model_id = get_video_understanding_model_id()
        timeout = get_video_understanding_timeout()

        truncated_query = (query[:100] + "..." if len(query) > 100 else query).replace('\n', '\\n')
        logger.info(
            f"执行视频理解: 视频数量={len(videos)}, "
            f"视频={json.dumps(videos, ensure_ascii=False)}, "
            f"查询={truncated_query}, 模型={model_id}, 超时={timeout}s"
        )

        batch = await self._video_processor.resolve_all(videos)

        if len(videos) == 1 and batch.failed_count == 1:
            return ToolResult.error(f"视频处理失败: {batch.failed[0].error}")

        if batch.success_count == 0:
            return ToolResult.error(f"所有视频处理失败 ({batch.failed_count} 个视频)")

        # 先探测视频元信息，用于长视频预警和结果展示
        metadata_list = await probe_all_videos(videos)

        # 长视频确认检查：任一视频超过 3 分钟且未确认时，要求 agent 先向用户确认
        if not params.confirmed:
            warning = self._check_long_video_warning(metadata_list, videos)
            if warning:
                return warning

        # LLM 调用（元信息已提前获取，无需并发）
        try:
            response = await VideoLLMRequestHandler.call_with_fallback(model_id, query, batch, timeout)
        except Exception as e:
            logger.error(f"视频理解 LLM 调用失败 (模型: {model_id}): {e}")
            return ToolResult.error("视频理解服务暂时不可用，请稍后重试")

        if not response or not response.choices or len(response.choices) == 0:
            return ToolResult.error("没有从模型收到有效响应")

        content = response.choices[0].message.content

        # 在内容末尾追加视频来源信息，格式与视觉理解的图片尺寸信息对齐
        source_info = format_video_source_info(metadata_list, videos)
        if source_info:
            content = f"{content}\n\n{source_info}"

        video_names = [extract_media_source_name(v) for v in videos]

        return ToolResult(
            content=content,
            extra_info={
                "videos": videos,
                "video_count": len(videos),
                "video_names": video_names,
            }
        )

    # 长视频确认阈值（秒）
    LONG_VIDEO_THRESHOLD_SECONDS = 180

    def _check_long_video_warning(self, metadata_list, videos) -> Optional[ToolResult]:
        """检查是否有视频超过时长阈值，返回确认提示或 None。"""
        long_videos: List[tuple] = []
        for meta, source in zip(metadata_list, videos):
            if meta.duration_seconds and meta.duration_seconds > self.LONG_VIDEO_THRESHOLD_SECONDS:
                long_videos.append((meta, source))

        if not long_videos:
            return None

        # 构建详情信息
        details = []
        total_duration = 0.0
        for meta, source in long_videos:
            name = extract_media_source_name(source)
            details.append(f"- {name}: {meta.duration_str}")
            total_duration += meta.duration_seconds or 0

        # 估算处理时间（经验值：约为视频时长的 30%~60%）
        est_minutes_low = max(1, int(total_duration * 0.3 / 60))
        est_minutes_high = max(2, int(total_duration * 0.6 / 60))

        video_list_str = "\n".join(details)
        content = (
            f"CONFIRMATION REQUIRED: The following video(s) exceed 3 minutes:\n"
            f"{video_list_str}\n\n"
            f"Estimated processing time: {est_minutes_low}-{est_minutes_high} minutes. "
            f"This operation consumes significant time and tokens.\n\n"
            f"Action required: Use ask_user to confirm with the user whether to proceed. "
            f"If confirmed, call video_understanding again with confirmed=true."
        )
        return ToolResult(content=content)

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
长视频预警机制：
- 当视频时长超过 3 分钟时，工具会返回确认提示而非直接分析
- 收到确认提示后，必须用 ask_user 向用户说明视频时长和预计耗时，询问是否继续
- 用户确认后，设置 confirmed=true 重新调用本工具
- 如果你事先就知道视频较长（如用户提到时长、或从视频标题推断），应主动在调用前用 ask_user 确认
-->
Long video safeguard:
- When video duration exceeds 3 minutes, this tool returns a confirmation prompt instead of analyzing
- Upon receiving the prompt, you MUST use ask_user to inform the user about video duration and estimated time, asking whether to proceed
- After user confirms, call this tool again with confirmed=true
- If you already know the video is long (e.g. user mentioned duration or inferable from title), proactively confirm with ask_user before calling this tool"""

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: Dict[str, Any] = None,
    ) -> Optional[ToolDetail]:
        if not result.content:
            return None

        try:
            video_count = result.extra_info.get("video_count", 0) if result.extra_info else 0
            video_names = result.extra_info.get("video_names", []) if result.extra_info else []

            title = i18n.translate("video_understanding.title", category="tool.messages")
            if video_count == 1 and video_names:
                title = i18n.translate(
                    "video_understanding.single", category="tool.messages",
                    video_name=video_names[0],
                )
            elif video_count > 1:
                title = i18n.translate(
                    "video_understanding.multiple", category="tool.messages",
                    count=video_count,
                )

            return ToolDetail(
                type=DisplayType.MD,
                data=FileContent(
                    file_name=i18n.translate("video_understanding.result_file", category="tool.messages"),
                    content=f"## {title}\n\n{result.content}",
                )
            )
        except Exception as e:
            logger.error(f"生成工具详情失败: {e!s}")
            return None

    async def get_before_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        action = i18n.translate("video_understanding_ing", category="tool.actions")

        videos = arguments.get("videos", []) if arguments else []
        video_count = len(videos) if isinstance(videos, list) else 0

        if video_count == 1:
            video_name = extract_media_source_name(videos[0])
            remark = i18n.translate(
                "video_understanding.analyzing", category="tool.messages",
                video_name=video_name,
            )
        elif video_count > 1:
            remark = i18n.translate(
                "video_understanding.analyzing_multiple", category="tool.messages",
                count=video_count,
            )
        else:
            remark = ""

        return {"action": action, "remark": remark}

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        if not result.ok:
            return {
                "action": i18n.translate("video_understanding", category="tool.actions"),
                "remark": i18n.translate(
                    "video_understanding.error", category="tool.messages",
                    error=result.content,
                ),
            }

        videos = arguments.get("videos", []) if arguments else []
        video_count = len(videos) if isinstance(videos, list) else 0

        if video_count == 1:
            video_name = extract_media_source_name(videos[0])
            remark = i18n.translate(
                "video_understanding.completed", category="tool.messages",
                video_name=video_name,
            )
        elif video_count > 1:
            remark = i18n.translate(
                "video_understanding.multiple_videos", category="tool.messages",
                count=video_count,
            )
        else:
            remark = i18n.translate("video_understanding.title", category="tool.messages")

        return {
            "action": i18n.translate("video_understanding", category="tool.actions"),
            "remark": remark,
        }
