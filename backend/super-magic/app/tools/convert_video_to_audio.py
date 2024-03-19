"""
视频转音频工具

将视频文件转换为音频文件，支持多种音频格式
使用 ffmpeg 进行转换
"""

from app.i18n import i18n
import asyncio
import shutil
from pathlib import Path
from typing import Dict, Any, Optional
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_guard_tool import WorkspaceGuardTool

logger = get_logger(__name__)


# 支持的音频格式及其 ffmpeg 参数
AUDIO_FORMATS = {
    'mp3': {
        'codec': 'libmp3lame',
        'default_bitrate': '192k',
        'description': 'MP3 - 最常用的音频格式，兼容性好'
    },
    'wav': {
        'codec': 'pcm_s16le',
        'default_bitrate': None,  # WAV 是无损格式，不需要比特率
        'description': 'WAV - 无损音频格式，文件较大'
    },
    'aac': {
        'codec': 'aac',
        'default_bitrate': '192k',
        'description': 'AAC - 高质量音频格式，Apple 设备常用'
    },
    'flac': {
        'codec': 'flac',
        'default_bitrate': None,  # FLAC 是无损格式
        'description': 'FLAC - 无损压缩音频格式'
    },
    'ogg': {
        'codec': 'libvorbis',
        'default_bitrate': '192k',
        'description': 'OGG - 开源音频格式，质量好'
    },
    'm4a': {
        'codec': 'aac',
        'default_bitrate': '192k',
        'description': 'M4A - AAC 音频容器，Apple 设备常用'
    }
}


class ConvertVideoToAudioParams(BaseToolParams):
    """视频转音频工具参数"""

    video_path: str = Field(
        ...,
        description="输入视频文件路径（相对于工作区根目录）。示例：'videos/demo.mp4'"
    )

    output_format: str = Field(
        default='mp3',
        description=f"输出音频格式，支持：{', '.join(AUDIO_FORMATS.keys())}。默认为 mp3"
    )


@tool()
class ConvertVideoToAudio(AbstractFileTool[ConvertVideoToAudioParams], WorkspaceGuardTool[ConvertVideoToAudioParams]):
    """
    将视频文件转换为音频文件

    支持的输出格式：MP3, WAV, AAC, FLAC, OGG, M4A
    使用 ffmpeg 进行转换
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self._check_ffmpeg():
            logger.warning("ffmpeg 未安装，convert_video_to_audio 工具可能无法正常工作")

    @staticmethod
    def _check_ffmpeg() -> bool:
        """检查 ffmpeg 是否已安装"""
        return shutil.which("ffmpeg") is not None

    async def execute(self, tool_context: ToolContext, params: ConvertVideoToAudioParams) -> ToolResult:
        """执行视频转音频操作"""
        created_files = []  # 记录已创建的文件，用于回滚

        try:
            # 1. 参数验证
            output_format = params.output_format.lower()
            if output_format not in AUDIO_FORMATS:
                return ToolResult(error=f"不支持的音频格式 '{params.output_format}'。支持的格式：{', '.join(AUDIO_FORMATS.keys())}")

            # 2. 检查视频文件是否存在
            video_path, error = self.get_safe_path(params.video_path)
            if error:
                return ToolResult(error=error)

            if not await asyncio.to_thread(video_path.exists):
                return ToolResult(error=f"视频文件不存在：{params.video_path}")

            if not await asyncio.to_thread(video_path.is_file):
                return ToolResult(error=f"路径不是文件：{params.video_path}")

            # 3. 确定输出路径（与视频文件同目录，同名但扩展名不同）
            output_path = video_path.with_suffix(f'.{output_format}')

            # 4. 使用 versioning context 执行转换（无需更新时间戳，因为是工具生成的文件）
            logger.info(f"开始转换视频到音频：{video_path} -> {output_path}")

            async with self._file_versioning_context(tool_context, output_path, update_timestamp=False):
                success, error = await self._convert_video_to_audio(
                    video_path=video_path,
                    output_path=output_path,
                    format=output_format
                )

            if not success:
                error_detail = f"视频转音频失败: {error}" if error else "视频转音频失败，请检查视频文件是否包含音频流"
                return ToolResult(error=error_detail)

            created_files.append(output_path)

            # 5. 生成结果内容
            result_content = self._generate_result_content(
                video_filename=video_path.name,
                audio_filename=output_path.name,
                output_format=output_format
            )

            return ToolResult(
                content=result_content,
                extra_info={
                    "video_path": str(params.video_path),
                    "audio_path": str(output_path.relative_to(self.base_dir)),
                    "format": output_format
                }
            )

        except Exception as e:
            logger.exception(f"视频转音频失败: {e!s}")

            # 回滚：删除已创建的文件
            await self._rollback_created_files(created_files)

            return ToolResult(error="Failed to convert video to audio")

    async def _convert_video_to_audio(
        self,
        video_path: Path,
        output_path: Path,
        format: str
    ) -> tuple[bool, Optional[str]]:
        """
        使用 ffmpeg 将视频转换为音频

        Args:
            video_path: 视频文件路径
            output_path: 输出音频文件路径
            format: 输出音频格式

        Returns:
            tuple: (转换是否成功, 错误信息)
        """
        try:
            # 检查 ffmpeg 是否可用
            if not self._check_ffmpeg():
                return False, "ffmpeg 未安装，请先安装 ffmpeg"

            # 获取格式配置
            format_config = AUDIO_FORMATS[format]

            # 构建 ffmpeg 命令
            cmd = [
                'ffmpeg',
                '-i', str(video_path),  # 输入文件
                '-vn',  # 禁用视频流
                '-y',  # 覆盖输出文件
            ]

            # 添加音频编解码器
            cmd.extend(['-acodec', format_config['codec']])

            # 添加比特率（如果需要）
            if format_config['default_bitrate']:
                cmd.extend(['-b:a', format_config['default_bitrate']])

            # 添加输出文件
            cmd.append(str(output_path))

            # 执行 ffmpeg 命令
            logger.info(f"执行 ffmpeg 命令: {' '.join(cmd)}")

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            if process.returncode == 0:
                logger.info(f"视频转音频成功：{output_path}")
                return True, None
            else:
                error_msg = stderr.decode('utf-8', errors='ignore') if stderr else "未知错误"
                logger.error(f"ffmpeg 执行失败: {error_msg}")
                return False, f"ffmpeg 执行失败: {error_msg}"

        except Exception as e:
            error_msg = str(e)
            logger.error(f"转换过程中发生错误: {error_msg}")
            return False, error_msg

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
        video_filename: str,
        audio_filename: str,
        output_format: str
    ) -> str:
        """生成结构化的结果内容"""
        format_info = AUDIO_FORMATS[output_format]

        result = f"""✅ 视频转音频完成！

📹 输入视频：{video_filename}
🎵 输出音频：{audio_filename}
📝 格式说明：{format_info['description']}
"""

        if format_info['default_bitrate']:
            result += f"🎚️ 比特率：{format_info['default_bitrate']}\n"
        else:
            result += f"🎚️ 质量：无损\n"

        result += f"""
🎯 下一步：
使用 audio_understanding 工具转录音频 → 生成文字稿"""

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
                "action": i18n.translate("convert_video_to_audio", category="tool.actions"),
                "remark": i18n.translate("convert_video_to_audio.error", category="tool.messages")
            }

        extra_info = result.extra_info or {}
        output_format = extra_info.get("format", "mp3").upper()

        return {
            "action": i18n.translate("convert_video_to_audio", category="tool.actions"),
            "remark": i18n.translate("convert_video_to_audio.success", category="tool.messages", format=output_format)
        }
