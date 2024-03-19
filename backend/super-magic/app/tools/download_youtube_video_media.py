"""下载视频媒体文件。"""

import re
from typing import Any, Dict, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_guard_tool import WorkspaceGuardTool


class DownloadYoutubeVideoMediaParams(BaseToolParams):
    """下载 YouTube 视频媒体参数"""

    youtube_url: Optional[str] = Field(
        default=None,
        description="YouTube 视频链接，与 youtube_id 二选一。示例：'https://www.youtube.com/watch?v=dQw4w9WgXcQ'"
    )

    youtube_id: Optional[str] = Field(
        default=None,
        description="YouTube 视频 ID，与 youtube_url 二选一。示例：'dQw4w9WgXcQ'"
    )

    output_folder: str = Field(
        ...,
        description="输出文件夹路径（相对于工作区根目录）。示例：'视频分析_20251124'"
    )

    media_filename: Optional[str] = Field(
        default=None,
        description="媒体文件名（不含扩展名）。如果不提供，将使用视频 ID。示例：'产品介绍视频'"
    )


@tool()
class DownloadYoutubeVideoMedia(AbstractFileTool[DownloadYoutubeVideoMediaParams], WorkspaceGuardTool[DownloadYoutubeVideoMediaParams]):
    """
    下载 YouTube 视频媒体文件。
    """

    @staticmethod
    def _extract_youtube_video_id(url: str) -> Optional[str]:
        """从 YouTube URL 中提取视频 ID"""
        patterns = [
            r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
            r'(?:embed\/)([0-9A-Za-z_-]{11})',
            r'(?:watch\?v=)([0-9A-Za-z_-]{11})',
        ]

        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)

        return None


    async def execute(self, tool_context: ToolContext, params: DownloadYoutubeVideoMediaParams) -> ToolResult:
        """执行视频媒体下载操作"""
        if not params.youtube_url and not params.youtube_id:
            return ToolResult(error="必须提供 youtube_url 或 youtube_id 参数之一")

        if params.youtube_url and params.youtube_id:
            return ToolResult(error="youtube_url 和 youtube_id 只能提供其中一个，不能同时提供")

        if params.youtube_id and not params.youtube_id.strip():
            return ToolResult(error="视频 ID 不能为空")

        if params.youtube_url and not self._extract_youtube_video_id(params.youtube_url):
            return ToolResult(error=f"无法从 URL 中提取视频 ID: {params.youtube_url}")

        return ToolResult(error="暂不可用")

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None
    ) -> Dict:
        """获取友好动作和备注"""
        if not result.ok:
            return {
                "action": i18n.translate("download_youtube_video_media", category="tool.actions"),
                "remark": i18n.translate("download_youtube_video_media.error", category="tool.messages")
            }

        return {
            "action": i18n.translate("download_youtube_video_media", category="tool.actions"),
            "remark": i18n.translate("download_youtube_video_media.success", category="tool.messages")
        }
