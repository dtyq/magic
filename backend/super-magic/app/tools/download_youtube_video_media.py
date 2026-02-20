"""
下载视频媒体文件

支持平台：YouTube
"""

from app.i18n import i18n
import re
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool

logger = get_logger(__name__)


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
class DownloadYoutubeVideoMedia(AbstractFileTool[DownloadYoutubeVideoMediaParams], WorkspaceTool[DownloadYoutubeVideoMediaParams]):
    """
    下载 YouTube 视频媒体文件并保存为 MP3

    支持平台：YouTube
    输出格式：MP3 (192kbps)
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

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


    async def _download_media(
        self,
        url: str,
        output_path: Path,
        filename: str
    ) -> tuple[Optional[str], Optional[str]]:
        """
        使用多种方式尝试下载媒体文件

        优先级顺序：
        1. Y2Mate - 最稳定可靠（已更新支持新加密格式，2024-12-02）
        2. YTMP3 - 备选方案（无验证码，中等稳定性）
        3. EzMP3 - 最后尝试（高质量，但需要 Turnstile 验证）

        Args:
            url: 视频 URL
            output_path: 输出目录路径
            filename: 文件名（不含扩展名）

        Returns:
            tuple: (下载文件路径, 错误信息)
        """
        # 定义多种下载方式，按优先级排序
        download_methods = []

        # 1. Y2Mate - 首选（最稳定，已修复新加密格式）
        try:
            from app.tools.video_downloaders import y2mate_downloader
            if y2mate_downloader.is_available():
                download_methods.append((
                    'Y2Mate',
                    y2mate_downloader.download
                ))
        except Exception as e:
            logger.debug(f"无法加载 Y2Mate: {e}")

        # 2. YTMP3 - 备选（无验证码，中等稳定性）
        try:
            from app.tools.video_downloaders import ytmp3_downloader
            if ytmp3_downloader.is_available():
                download_methods.append((
                    'YTMP3',
                    ytmp3_downloader.download
                ))
        except Exception as e:
            logger.debug(f"无法加载 YTMP3: {e}")

        # 3. EzMP3 - 最后尝试（API 简单，支持高质量，但需要验证码）
        try:
            from app.tools.video_downloaders import ezmp3_downloader
            if ezmp3_downloader.is_available():
                download_methods.append((
                    'EzMP3',
                    lambda url, path, name: ezmp3_downloader.download(url, path, name, quality=192)
                ))
        except Exception as e:
            logger.debug(f"无法加载 EzMP3: {e}")

        if not download_methods:
            return None, "没有可用的下载方式，请检查 aiohttp 是否已安装"

        logger.info(f"已加载 {len(download_methods)} 个下载方式: {', '.join(m[0] for m in download_methods)}")

        last_error = None

        for method_name, download_func in download_methods:
            try:
                logger.info(f"尝试使用 {method_name} 下载...")
                file_path, error = await download_func(url, output_path, filename)

                if file_path:
                    logger.info(f"✅ {method_name} 下载成功: {file_path}")
                    return file_path, None

                last_error = error
                logger.warning(f"❌ {method_name} 失败: {error}")

            except Exception as e:
                last_error = str(e)
                logger.warning(f"❌ {method_name} 下载异常: {e}")
                continue

        error_msg = f"所有下载方式都失败了。最后一次错误: {last_error}" if last_error else "所有下载方式都失败了"
        return None, error_msg


    async def execute(self, tool_context: ToolContext, params: DownloadYoutubeVideoMediaParams) -> ToolResult:
        """执行视频媒体下载操作"""
        created_files = []  # 记录已创建的文件，用于回滚

        try:
            # 0. 参数验证：youtube_url 和 youtube_id 二选一
            if not params.youtube_url and not params.youtube_id:
                return ToolResult(error="必须提供 youtube_url 或 youtube_id 参数之一")

            if params.youtube_url and params.youtube_id:
                return ToolResult(error="youtube_url 和 youtube_id 只能提供其中一个，不能同时提供")

            # 1. 确定视频 ID 和 URL（目前仅支持 YouTube）
            if params.youtube_id:
                # 用户提供了视频 ID，构建 URL
                video_id = params.youtube_id.strip()
                if not video_id:
                    return ToolResult(error="视频 ID 不能为空")
                youtube_url = f"https://www.youtube.com/watch?v={video_id}"
                logger.info(f"使用 YouTube 视频 ID: {video_id}")
            else:
                # 用户提供了 URL，提取视频 ID
                youtube_url = params.youtube_url
                video_id = self._extract_youtube_video_id(youtube_url)
                if not video_id:
                    return ToolResult(error=f"无法从 URL 中提取视频 ID: {youtube_url}")
                logger.info(f"从 URL 提取 YouTube 视频 ID: {video_id}")

            # 2. 确定输出文件夹
            output_folder = self.resolve_path(params.output_folder)
            # 检查文件夹是否存在，如果不存在则自动创建
            if not await asyncio.to_thread(output_folder.exists):
                try:
                    await asyncio.to_thread(output_folder.mkdir, parents=True, exist_ok=True)
                    logger.info(f"已创建输出文件夹：{output_folder}")
                except Exception as e:
                    return ToolResult(error=f"无法创建输出文件夹 {output_folder}: {e}")

            if not await asyncio.to_thread(output_folder.is_dir):
                return ToolResult(error=f"路径不是文件夹：{output_folder}")

            # 3. 确定媒体文件名
            media_filename = params.media_filename if params.media_filename else video_id

            # 4. 下载媒体文件
            logger.info("正在下载媒体文件（这可能需要几分钟）...")
            media_path, error = await self._download_media(youtube_url, output_folder, media_filename)

            if not media_path:
                error_detail = f"媒体文件下载失败: {error}" if error else "媒体文件下载失败，请检查网络连接或视频是否可用"
                return ToolResult(error=error_detail)

            # File events are handled in _download_youtube_media via _file_versioning_context
            created_files.append(Path(media_path))

            # 5. 生成结果内容
            result_content = self._generate_result_content(
                Path(media_path).name,
                output_folder.name
            )

            return ToolResult(content=result_content)

        except Exception as e:
            logger.exception(f"媒体文件下载失败: {e!s}")

            # 回滚：删除已创建的文件
            await self._rollback_created_files(created_files)

            return ToolResult(error="Failed to download media file")

    async def _rollback_created_files(self, created_files: list):
        """回滚已创建的文件"""
        for path in reversed(created_files):
            try:
                if isinstance(path, Path):
                    from agentlang.utils.file import safe_delete
                    await safe_delete(path)
                    logger.info(f"回滚删除: {path}")
            except Exception as rollback_error:
                logger.error(f"回滚删除失败 {path}: {rollback_error}")

    def _generate_result_content(
        self,
        media_filename: str,
        folder_name: str
    ) -> str:
        """生成结构化的结果内容"""
        result = f"""✅ 媒体文件下载完成！

📁 保存文件：
{folder_name}/
└── {media_filename}     # 媒体文件（MP3, 192kbps）

🎯 下一步：
使用 audio_understanding 转录音频 → 生成文字稿"""

        return result

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
