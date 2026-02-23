"""
获取 YouTube 视频信息工具

使用 YouTube oEmbed API 获取视频基础信息
API 文档: https://oembed.com/
YouTube oEmbed 端点: https://www.youtube.com/oembed
"""

from app.i18n import i18n
import re
import json
from typing import Dict, Any, Optional
from datetime import datetime
from urllib.parse import quote
from pydantic import Field
import httpx

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.core import BaseToolParams, BaseTool, tool

logger = get_logger(__name__)


class GetYoutubeVideoInfoParams(BaseToolParams):
    """获取 YouTube 视频信息参数"""

    youtube_url: Optional[str] = Field(
        default=None,
        description="YouTube 视频链接，与 youtube_id 二选一。支持格式：'https://www.youtube.com/watch?v=VIDEO_ID'、'https://youtu.be/VIDEO_ID'、'https://www.youtube.com/shorts/VIDEO_ID'"
    )

    youtube_id: Optional[str] = Field(
        default=None,
        description="YouTube 视频 ID（11位字符），与 youtube_url 二选一。示例：'M3r2XDceM6A'"
    )


@tool()
class GetYoutubeVideoInfo(BaseTool[GetYoutubeVideoInfoParams]):
    """
    获取 YouTube 视频信息工具

    使用 YouTube oEmbed API 获取视频基础信息，包括：
    - 视频标题 (title)
    - 作者名称和频道链接 (author_name, author_url)
    - 缩略图 URL 和尺寸 (thumbnail_url, thumbnail_width, thumbnail_height)
    - 嵌入代码 (html)
    - 视频播放器尺寸 (width, height)

    注意：oEmbed API 不提供视频时长、观看次数、描述等详细信息
    """

    OEMBED_API_URL = "https://www.youtube.com/oembed"
    OEMBED_FORMAT = "json"
    REQUEST_TIMEOUT = 30.0

    @staticmethod
    def _extract_youtube_video_id(url: str) -> Optional[str]:
        """
        从 YouTube URL 中提取视频 ID

        支持的 URL 格式：
        - https://www.youtube.com/watch?v=VIDEO_ID
        - https://youtu.be/VIDEO_ID
        - https://www.youtube.com/embed/VIDEO_ID
        - https://www.youtube.com/v/VIDEO_ID
        - https://www.youtube.com/shorts/VIDEO_ID

        Args:
            url: YouTube 视频 URL

        Returns:
            视频 ID（11位字符）或 None
        """
        patterns = [
            r'(?:youtube\.com\/watch\?v=)([0-9A-Za-z_-]{11})',
            r'(?:youtu\.be\/)([0-9A-Za-z_-]{11})',
            r'(?:youtube\.com\/embed\/)([0-9A-Za-z_-]{11})',
            r'(?:youtube\.com\/v\/)([0-9A-Za-z_-]{11})',
            r'(?:youtube\.com\/shorts\/)([0-9A-Za-z_-]{11})',
        ]

        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)

        return None

    async def _fetch_oembed_data(self, video_url: str) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        通过 YouTube oEmbed API 获取视频信息

        API 端点: https://www.youtube.com/oembed
        请求格式: GET https://www.youtube.com/oembed?url={VIDEO_URL}&format=json

        Args:
            video_url: YouTube 视频完整 URL (例如: https://www.youtube.com/watch?v=M3r2XDceM6A)

        Returns:
            tuple: (视频信息字典, 错误信息)
            - 成功时返回 (video_info_dict, None)
            - 失败时返回 (None, error_message)
        """
        try:
            # 构建 oEmbed API 请求 URL
            encoded_url = quote(video_url, safe='')
            oembed_url = f"{self.OEMBED_API_URL}?url={encoded_url}&format={self.OEMBED_FORMAT}"

            logger.info(f"请求 YouTube oEmbed API: {oembed_url}")

            # 发送 HTTP GET 请求
            async with httpx.AsyncClient(timeout=self.REQUEST_TIMEOUT) as client:
                response = await client.get(oembed_url)
                response.raise_for_status()

                # 解析 JSON 响应
                oembed_data = response.json()

                # 构建标准化的视频信息字典
                video_info = {
                    # 基础信息
                    'title': oembed_data.get('title', ''),
                    'author_name': oembed_data.get('author_name', ''),
                    'author_url': oembed_data.get('author_url', ''),
                    'type': oembed_data.get('type', 'video'),

                    # 缩略图信息
                    'thumbnail_url': oembed_data.get('thumbnail_url', ''),
                    'thumbnail_width': oembed_data.get('thumbnail_width', 0),
                    'thumbnail_height': oembed_data.get('thumbnail_height', 0),

                    # 播放器信息
                    'width': oembed_data.get('width', 0),
                    'height': oembed_data.get('height', 0),
                    'html': oembed_data.get('html', ''),

                    # 提供商信息
                    'provider_name': oembed_data.get('provider_name', 'YouTube'),
                    'provider_url': oembed_data.get('provider_url', 'https://www.youtube.com/'),

                    # 元数据
                    'version': oembed_data.get('version', '1.0'),
                    'webpage_url': video_url,
                    'fetched_at': datetime.now().isoformat(),
                }

                logger.info(f"成功获取视频信息 - 标题: {video_info['title']}, 作者: {video_info['author_name']}")
                return video_info, None

        except httpx.HTTPStatusError as e:
            status_code = e.response.status_code
            if status_code == 404:
                error_msg = "视频不存在或 URL 无效"
            elif status_code == 401:
                error_msg = "视频为私密视频，无法访问"
            elif status_code == 403:
                error_msg = "访问被拒绝，可能是地区限制"
            else:
                error_msg = f"HTTP 错误 {status_code}"

            logger.warning(f"oEmbed API 请求失败: {error_msg} - {e.response.text[:200]}")
            return None, error_msg

        except httpx.RequestError as e:
            error_msg = f"网络请求失败: {type(e).__name__}"
            logger.warning(f"oEmbed API 网络错误: {error_msg} - {str(e)}")
            return None, error_msg

        except ValueError as e:
            error_msg = "响应格式错误，无法解析 JSON"
            logger.warning(f"oEmbed API 响应解析失败: {str(e)}")
            return None, error_msg

        except Exception as e:
            error_msg = f"未知错误: {type(e).__name__}"
            logger.error(f"oEmbed API 调用异常: {str(e)}", exc_info=True)
            return None, error_msg

    async def execute(self, tool_context: ToolContext, params: GetYoutubeVideoInfoParams) -> ToolResult:
        """
        执行 YouTube 视频信息获取

        工作流程：
        1. 参数验证（youtube_url 和 youtube_id 二选一）
        2. 提取或构建视频 ID 和完整 URL
        3. 调用 YouTube oEmbed API 获取视频信息
        4. 返回结构化结果
        """
        try:
            # 步骤 1: 参数验证
            if not params.youtube_url and not params.youtube_id:
                return ToolResult.error("必须提供 youtube_url 或 youtube_id 参数之一")

            # 步骤 2: 确定视频 ID 和完整 URL
            # 如果同时提供 url 和 id，优先使用 url；如果 url 无法提取 ID，则使用 id
            if params.youtube_url:
                # 用户提供了 URL，尝试提取视频 ID
                youtube_url = params.youtube_url.strip()
                video_id = self._extract_youtube_video_id(youtube_url)

                if not video_id:
                    # 无法从 URL 提取 ID，尝试使用传入的 youtube_id
                    if params.youtube_id:
                        video_id = params.youtube_id.strip()
                        if not video_id:
                            return ToolResult.error("视频 ID 不能为空")

                        youtube_url = f"https://www.youtube.com/watch?v={video_id}"
                        logger.info(f"无法从 URL 提取视频 ID，使用传入的 ID: {video_id}")
                    else:
                        return ToolResult.error(f"无法从 URL 中提取视频 ID: {youtube_url}\n支持的格式: youtube.com/watch?v=ID、youtu.be/ID、youtube.com/shorts/ID")
                else:
                    logger.info(f"从 URL 提取视频 ID: {youtube_url} -> {video_id}")
            else:
                # 用户只提供了视频 ID，构建标准 URL
                video_id = params.youtube_id.strip()
                if not video_id:
                    return ToolResult.error("视频 ID 不能为空")

                youtube_url = f"https://www.youtube.com/watch?v={video_id}"
                logger.info(f"使用视频 ID 构建 URL: {video_id} -> {youtube_url}")

            # 步骤 3: 调用 oEmbed API 获取视频信息
            logger.info(f"正在通过 oEmbed API 获取视频信息: {video_id}")
            video_info, error = await self._fetch_oembed_data(youtube_url)

            if not video_info:
                error_detail = f"获取视频信息失败: {error}" if error else "获取视频信息失败，请检查 URL 是否正确"
                logger.warning(f"视频信息获取失败 - ID: {video_id}, 错误: {error_detail}")
                return ToolResult.error(error_detail)

            # 步骤 4: 生成结果
            video_title = video_info.get('title', '未知')
            author_name = video_info.get('author_name', '未知')

            logger.info(f"成功获取视频信息 - ID: {video_id}, 标题: {video_title}, 作者: {author_name}")

            # 构建结果内容（包含完整的 oEmbed 信息）
            result_content = dict(video_info)
            result_content['video_id'] = video_id
            result_content['platform'] = 'youtube'

            # 返回结果，包含完整的视频信息
            return ToolResult(
                content=json.dumps(result_content, ensure_ascii=False, indent=2),
                extra_info={
                    "video_info": video_info,
                    "video_id": video_id,
                    "platform": "youtube",
                    "api_source": "oembed"
                }
            )

        except Exception as e:
            logger.exception(f"视频信息获取异常: {e!s}")
            return ToolResult.error("Failed to get video info")

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None
    ) -> Dict:
        """
        获取工具调用后的友好动作描述和备注

        用于在 UI 中显示工具执行的简短摘要

        Args:
            tool_name: 工具名称
            tool_context: 工具上下文
            result: 工具执行结果
            execution_time: 执行时间（秒）
            arguments: 工具参数

        Returns:
            包含 action 和 remark 的字典
        """
        if not result.ok:
            return {
                "action": i18n.translate("get_youtube_video_info", category="tool.actions"),
                "remark": i18n.translate("get_youtube_video_info.error", category="tool.messages")
            }

        # 从 extra_info 获取视频信息
        video_title = ""

        if result.extra_info and "video_info" in result.extra_info:
            video_info = result.extra_info["video_info"]
            video_title = video_info.get("title", "")

            # 如果标题太长，截取前 30 个字符
            if len(video_title) > 30:
                video_title = video_title[:30] + "..."

        return {
            "action": i18n.translate("get_youtube_video_info", category="tool.actions"),
            "remark": i18n.translate("get_youtube_video_info.success", category="tool.messages", title=video_title) if video_title else i18n.translate("get_youtube_video_info.success", category="tool.messages", title="Video")
        }
