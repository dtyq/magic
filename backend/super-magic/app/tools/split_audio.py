"""
音频拆分工具

当音频文件时长超过4小时且文件大小超过400M时，自动拆分成多个音频文件
确保每个拆分后的音频不超过400M或4小时
使用 ffmpeg 进行拆分
"""

from app.i18n import i18n
import asyncio
import shutil
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from pydantic import Field
from mutagen import File as MutagenFile

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool

logger = get_logger(__name__)


class SplitAudioParams(BaseToolParams):
    """音频拆分工具参数"""

    audio_path: str = Field(
        ...,
        description="""<!--zh: [输入] 音频文件路径（相对于工作区根目录）。示例：'audio/recording.mp3' / 'meeting_audio/discussion.wav'-->
[Input] Audio file path (relative to workspace root). Examples: 'audio/recording.mp3' / 'meeting_audio/discussion.wav'"""
    )

    max_duration_hours: float = Field(
        default=4.0,
        description="""<!--zh: [阈值] 单个音频文件的最大时长（小时）。当音频时长超过此值或文件大小超过阈值时将会拆分。默认为 4 小时-->
[Threshold] Maximum duration per audio file (hours). Audio will be split when duration exceeds this value OR file size exceeds threshold. Default is 4 hours"""
    )

    max_size_mb: int = Field(
        default=400,
        description="""<!--zh: [阈值] 单个音频文件的最大大小（MB）。当文件大小超过此值或时长超过阈值时将会拆分。默认为 400 MB-->
[Threshold] Maximum size per audio file (MB). Audio will be split when file size exceeds this value OR duration exceeds threshold. Default is 400 MB"""
    )


@tool()
class SplitAudio(AbstractFileTool[SplitAudioParams], WorkspaceTool[SplitAudioParams]):
    """<!--zh: 将大音频文件拆分成多个小文件。当音频文件时长超过指定阈值或文件大小超过指定阈值时，自动拆分成多个片段，确保每个拆分后的音频不超过指定的大小或时长。支持的音频格式：MP3, WAV, M4A, AAC, OGG, FLAC 等。-->
    Split large audio files into multiple smaller files. When audio file duration exceeds specified threshold or file size exceeds specified threshold, automatically split into multiple segments, ensuring each split audio does not exceed specified size or duration. Supported audio formats: MP3, WAV, M4A, AAC, OGG, FLAC, etc."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self._check_ffmpeg():
            logger.warning("ffmpeg 未安装，split_audio 工具可能无法正常工作")

    @staticmethod
    def _check_ffmpeg() -> bool:
        """检查 ffmpeg 是否已安装"""
        return shutil.which("ffmpeg") is not None

    async def execute(self, tool_context: ToolContext, params: SplitAudioParams) -> ToolResult:
        """执行音频拆分操作"""
        created_files = []  # 记录已创建的文件，用于回滚

        try:
            # 1. 检查音频文件是否存在
            audio_path = self.resolve_path(params.audio_path)
            if not await asyncio.to_thread(audio_path.exists):
                return ToolResult.error(f"音频文件不存在：{params.audio_path}")

            if not await asyncio.to_thread(audio_path.is_file):
                return ToolResult.error(f"路径不是文件：{params.audio_path}")

            # 2. 获取音频信息
            file_size_mb, duration_seconds, error = await self._get_audio_info(audio_path)
            if error:
                return ToolResult.error(error)

            duration_hours = duration_seconds / 3600
            max_duration_seconds = params.max_duration_hours * 3600

            logger.info(
                f"音频信息 - 文件大小: {file_size_mb:.2f}MB, "
                f"时长: {duration_hours:.2f}小时 ({duration_seconds:.2f}秒)"
            )

            # 3. 判断是否需要拆分
            if file_size_mb <= params.max_size_mb and duration_hours <= params.max_duration_hours:
                return ToolResult(
                    content=f"音频文件无需拆分\n\n"
                            f"📊 文件信息：\n"
                            f"- 文件大小：{file_size_mb:.2f}MB (阈值: {params.max_size_mb}MB)\n"
                            f"- 时长：{self._format_duration(duration_seconds)} (阈值: {params.max_duration_hours}小时)\n\n"
                            f"💡 只有当文件大小超过 {params.max_size_mb}MB 或者时长超过 {params.max_duration_hours}小时时才会拆分。",
                    extra_info={
                        "audio_path": str(params.audio_path),
                        "file_size_mb": file_size_mb,
                        "duration_hours": duration_hours,
                        "needs_split": False
                    }
                )

            # 4. 计算拆分策略
            split_duration_seconds = await self._calculate_split_duration(
                audio_path=audio_path,
                total_duration_seconds=duration_seconds,
                file_size_mb=file_size_mb,
                max_size_mb=params.max_size_mb,
                max_duration_seconds=max_duration_seconds
            )

            if split_duration_seconds is None:
                return ToolResult.error("无法计算合适的拆分时长")

            # 5. 执行拆分
            output_files = await self._split_audio_file(
                audio_path=audio_path,
                total_duration_seconds=duration_seconds,
                split_duration_seconds=split_duration_seconds,
                tool_context=tool_context
            )

            if not output_files:
                return ToolResult.error("音频拆分失败，未生成任何文件")

            created_files.extend(output_files)

            # 6. 生成结果内容
            result_content = self._generate_result_content(
                original_filename=audio_path.name,
                original_size_mb=file_size_mb,
                original_duration_seconds=duration_seconds,
                output_files=output_files,
                split_duration_seconds=split_duration_seconds
            )

            return ToolResult(
                content=result_content,
                extra_info={
                    "audio_path": str(params.audio_path),
                    "file_size_mb": file_size_mb,
                    "duration_hours": duration_hours,
                    "needs_split": True,
                    "output_files": [str(f.relative_to(self.base_dir)) for f in output_files],
                    "split_count": len(output_files)
                }
            )

        except Exception as e:
            logger.exception(f"音频拆分失败: {e!s}")

            # 回滚：删除已创建的文件
            await self._rollback_created_files(created_files)

            return ToolResult.error(f"音频拆分失败: {str(e)}")

    async def _get_audio_info(self, audio_path: Path) -> Tuple[float, float, Optional[str]]:
        """
        获取音频文件信息
        
        Args:
            audio_path: 音频文件路径
            
        Returns:
            tuple: (文件大小MB, 时长秒数, 错误信息)
        """
        try:
            # 获取文件大小
            file_size_bytes = await asyncio.to_thread(audio_path.stat)
            file_size_mb = file_size_bytes.st_size / (1024 * 1024)

            # 获取音频时长
            audio_file = await asyncio.to_thread(MutagenFile, str(audio_path))
            if audio_file is None or not hasattr(audio_file.info, 'length'):
                return 0, 0, f"无法读取音频文件元数据：{audio_path.name}"

            duration_seconds = audio_file.info.length

            return file_size_mb, duration_seconds, None

        except Exception as e:
            logger.error(f"获取音频信息失败: {e}")
            return 0, 0, f"获取音频信息失败: {str(e)}"

    async def _calculate_split_duration(
        self,
        audio_path: Path,
        total_duration_seconds: float,
        file_size_mb: float,
        max_size_mb: int,
        max_duration_seconds: float
    ) -> Optional[float]:
        """
        计算每个拆分片段的时长
        
        策略：
        1. 首先基于文件大小计算：每个片段的时长 = (max_size_mb / file_size_mb) * total_duration_seconds
        2. 确保不超过 max_duration_seconds
        3. 预留 5% 的安全边际
        
        Args:
            audio_path: 音频文件路径
            total_duration_seconds: 总时长（秒）
            file_size_mb: 文件大小（MB）
            max_size_mb: 最大文件大小（MB）
            max_duration_seconds: 最大时长（秒）
            
        Returns:
            每个片段的时长（秒），如果计算失败返回 None
        """
        try:
            # 基于文件大小计算的片段时长
            size_based_duration = (max_size_mb / file_size_mb) * total_duration_seconds
            
            # 应用安全边际（95%）
            safe_duration = size_based_duration * 0.95
            
            # 确保不超过最大时长限制
            split_duration = min(safe_duration, max_duration_seconds)
            
            # 确保至少会拆分成 2 个文件（否则没有意义）
            if split_duration >= total_duration_seconds * 0.9:
                split_duration = total_duration_seconds / 2
            
            logger.info(
                f"计算拆分时长 - "
                f"基于大小: {size_based_duration:.2f}秒, "
                f"安全时长: {safe_duration:.2f}秒, "
                f"最终时长: {split_duration:.2f}秒"
            )
            
            return split_duration

        except Exception as e:
            logger.error(f"计算拆分时长失败: {e}")
            return None

    async def _split_audio_file(
        self,
        audio_path: Path,
        total_duration_seconds: float,
        split_duration_seconds: float,
        tool_context: ToolContext
    ) -> List[Path]:
        """
        使用 ffmpeg 拆分音频文件
        
        Args:
            audio_path: 原始音频文件路径
            total_duration_seconds: 总时长（秒）
            split_duration_seconds: 每个片段的时长（秒）
            tool_context: 工具上下文
            
        Returns:
            拆分后的文件路径列表
        """
        output_files = []
        
        try:
            # 计算需要拆分的片段数量
            num_segments = int(total_duration_seconds / split_duration_seconds) + 1
            
            # 获取原始文件的扩展名
            file_extension = audio_path.suffix
            file_stem = audio_path.stem
            parent_dir = audio_path.parent
            
            logger.info(f"开始拆分音频，共 {num_segments} 个片段")
            
            # 拆分每个片段
            for i in range(num_segments):
                start_time = i * split_duration_seconds
                
                # 最后一个片段可能较短
                if start_time >= total_duration_seconds:
                    break
                
                # 计算输出文件名：原文件名_part1, 原文件名_part2, ...
                output_filename = f"{file_stem}_part{i+1}{file_extension}"
                output_path = parent_dir / output_filename
                
                # 使用 file versioning context 确保文件版本控制
                async with self._file_versioning_context(tool_context, output_path, update_timestamp=False):
                    success, error = await self._extract_audio_segment(
                        input_path=audio_path,
                        output_path=output_path,
                        start_time=start_time,
                        duration=split_duration_seconds
                    )
                    
                    if not success:
                        logger.error(f"拆分片段 {i+1} 失败: {error}")
                        continue
                
                output_files.append(output_path)
                logger.info(f"成功生成片段 {i+1}/{num_segments}: {output_filename}")
            
            return output_files

        except Exception as e:
            logger.error(f"拆分音频文件失败: {e}")
            return []

    async def _extract_audio_segment(
        self,
        input_path: Path,
        output_path: Path,
        start_time: float,
        duration: float
    ) -> Tuple[bool, Optional[str]]:
        """
        使用 ffmpeg 提取音频片段
        
        Args:
            input_path: 输入音频文件路径
            output_path: 输出音频文件路径
            start_time: 开始时间（秒）
            duration: 持续时间（秒）
            
        Returns:
            tuple: (是否成功, 错误信息)
        """
        try:
            # 检查 ffmpeg 是否可用
            if not self._check_ffmpeg():
                return False, "ffmpeg 未安装，请先安装 ffmpeg"

            # 构建 ffmpeg 命令
            # -ss: 开始时间
            # -t: 持续时间
            # -c copy: 直接复制编码，不重新编码（速度快）
            # -y: 覆盖输出文件
            cmd = [
                'ffmpeg',
                '-ss', str(start_time),
                '-i', str(input_path),
                '-t', str(duration),
                '-c', 'copy',
                '-y',
                str(output_path)
            ]

            logger.info(f"执行 ffmpeg 命令: {' '.join(cmd)}")

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            if process.returncode == 0:
                logger.info(f"音频片段提取成功：{output_path}")
                return True, None
            else:
                error_msg = stderr.decode('utf-8', errors='ignore') if stderr else "未知错误"
                logger.error(f"ffmpeg 执行失败: {error_msg}")
                return False, f"ffmpeg 执行失败: {error_msg}"

        except Exception as e:
            error_msg = str(e)
            logger.error(f"提取音频片段失败: {error_msg}")
            return False, error_msg

    async def _rollback_created_files(self, created_files: List[Path]):
        """回滚已创建的文件"""
        for path in reversed(created_files):
            try:
                if isinstance(path, Path) and await asyncio.to_thread(path.exists):
                    from agentlang.utils.file import safe_delete
                    await safe_delete(path)
                    logger.info(f"回滚删除: {path}")
            except Exception as rollback_error:
                logger.error(f"回滚删除失败 {path}: {rollback_error}")

    def _format_duration(self, seconds: float) -> str:
        """格式化时长为可读字符串"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        
        if hours > 0:
            return f"{hours}小时{minutes}分钟{secs}秒"
        elif minutes > 0:
            return f"{minutes}分钟{secs}秒"
        else:
            return f"{secs}秒"

    def _generate_result_content(
        self,
        original_filename: str,
        original_size_mb: float,
        original_duration_seconds: float,
        output_files: List[Path],
        split_duration_seconds: float
    ) -> str:
        """生成结构化的结果内容"""
        result = f"""✅ 音频拆分完成！

📹 原始文件：{original_filename}
📊 原始大小：{original_size_mb:.2f}MB
⏱️ 原始时长：{self._format_duration(original_duration_seconds)}

🎵 拆分结果：
- 拆分片段数：{len(output_files)}
- 每段时长：约 {self._format_duration(split_duration_seconds)}

📁 生成的文件：
"""
        
        for i, output_file in enumerate(output_files, 1):
            # 获取每个文件的大小
            try:
                file_size = output_file.stat().st_size / (1024 * 1024)
                result += f"  {i}. {output_file.name} ({file_size:.2f}MB)\n"
            except:
                result += f"  {i}. {output_file.name}\n"

        result += f"""
🎯 下一步：
使用 audio_understanding 工具分别转录各个音频片段 → 生成文字稿"""

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
                "action": i18n.translate("split_audio", category="tool.actions"),
                "remark": i18n.translate("split_audio.error", category="tool.messages")
            }

        extra_info = result.extra_info or {}
        needs_split = extra_info.get("needs_split", False)
        
        if not needs_split:
            return {
                "action": i18n.translate("split_audio", category="tool.actions"),
                "remark": i18n.translate("audio_understanding.no_split_needed", category="tool.messages")
            }

        split_count = extra_info.get("split_count", 0)
        return {
            "action": i18n.translate("split_audio", category="tool.actions"),
            "remark": i18n.translate("split_audio.success", category="tool.messages", count=split_count)
        }
