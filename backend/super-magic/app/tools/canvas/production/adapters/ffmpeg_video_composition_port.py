"""FFmpeg 视频合成端口实现。"""

import asyncio
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence
from uuid import uuid4

from app.tools.canvas.production.ports.video_composition_port import (
    VideoCompositionPort,
    VideoCompositionRequest,
    VideoCompositionResult,
)
from app.utils.async_file_utils import (
    async_copy_contents,
    async_exists,
    async_gettempdir,
    async_mkdir,
    async_stat,
    async_unlink,
    async_which,
)


@dataclass(frozen=True)
class _SourceMediaInfo:
    """记录源视频的音频存在性和时长。"""

    has_audio: bool
    duration_seconds: float


class FfmpegVideoCompositionPort(VideoCompositionPort):
    """使用系统 FFmpeg 顺序拼接视频并通过 FFprobe 校验输出。"""

    async def compose(self, request: VideoCompositionRequest, interruption_event=None) -> VideoCompositionResult:
        """执行顺序拼接，并在没有外部音频时保留源视频音轨。"""
        self._validate_request(request)
        await self._ensure_binaries()
        source_media = (
            await self._probe_source_media(request.video_paths, interruption_event)
            if request.audio_policy == "preserve" and request.audio_path is None
            else None
        )
        temp_dir = await async_gettempdir() / "super-magic" / "canvas-video-composition"
        temporary_output = temp_dir / f"composition-{uuid4().hex}.mp4"
        await async_mkdir(temp_dir, parents=True, exist_ok=True)
        await async_mkdir(request.output_path.parent, parents=True, exist_ok=True)
        try:
            temporary_request = VideoCompositionRequest(
                video_paths=request.video_paths,
                audio_path=request.audio_path,
                output_path=temporary_output,
                width=request.width,
                height=request.height,
                audio_policy=request.audio_policy,
            )
            command = self._build_command(temporary_request, source_media)
            await self._run(command, interruption_event)
            probe = await self._probe_output(temporary_output, interruption_event)
            self._validate_probe(
                probe,
                expected_width=request.width,
                expected_height=request.height,
                expected_audio=request.audio_policy == "preserve"
                and (
                    request.audio_path is not None
                    or bool(source_media and any(item.has_audio for item in source_media))
                ),
            )
            await self._move_output(temporary_output, request.output_path)
            persisted_probe = await self._probe_output(request.output_path, interruption_event)
            width, height, duration, has_audio = self._media_facts(persisted_probe)
            return VideoCompositionResult(request.output_path, width, height, duration, has_audio)
        finally:
            await async_unlink(temporary_output)

    def _build_command(
        self,
        request: VideoCompositionRequest,
        source_media: Sequence[_SourceMediaInfo] | None = None,
    ) -> list[str]:
        """构建统一画面规格的 FFmpeg 命令，并选择最终音频来源。"""
        command = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
        for video_path in request.video_paths:
            command.extend(["-i", str(video_path)])
        if request.audio_policy == "preserve" and request.audio_path is not None:
            command.extend(["-i", str(request.audio_path)])

        source_audio_enabled = bool(
            request.audio_policy == "preserve"
            and request.audio_path is None
            and source_media
            and any(item.has_audio for item in source_media)
        )
        audio_input_indices = list(range(len(request.video_paths)))
        if source_audio_enabled:
            assert source_media is not None
            next_input_index = len(request.video_paths)
            for index, media in enumerate(source_media):
                if media.has_audio:
                    continue
                audio_input_indices[index] = next_input_index
                command.extend([
                    "-f",
                    "lavfi",
                    "-t",
                    f"{max(media.duration_seconds, 0.001):.6f}",
                    "-i",
                    "anullsrc=r=48000:cl=stereo",
                ])
                next_input_index += 1

        filters: list[str] = []
        video_labels: list[str] = []
        for index in range(len(request.video_paths)):
            video_label = f"v{index}"
            filters.append(
                f"[{index}:v:0]"
                f"scale={request.width}:{request.height}:force_original_aspect_ratio=decrease,"
                f"pad={request.width}:{request.height}:(ow-iw)/2:(oh-ih)/2,"
                    f"setpts=PTS-STARTPTS,setsar=1,format=yuv420p[{video_label}]"
            )
            video_labels.append(f"[{video_label}]")

        if source_audio_enabled:
            assert source_media is not None
            audio_labels: list[str] = []
            for index in range(len(request.video_paths)):
                audio_label = f"a{index}"
                audio_input = f"[{audio_input_indices[index]}:a:0]"
                filters.append(
                    f"{audio_input}aresample=48000,aformat=sample_fmts=fltp:"
                    f"sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS[{audio_label}]"
                )
                audio_labels.append(f"[{audio_label}]")
            concat_inputs = "".join(
                f"{video_labels[index]}{audio_labels[index]}"
                for index in range(len(video_labels))
            )
            filters.append(
                f"{concat_inputs}concat=n={len(video_labels)}:v=1:a=1[vout][aout]"
            )
        else:
            filters.append(
                f"{''.join(video_labels)}concat=n={len(video_labels)}:v=1:a=0[vout]"
            )

        command.extend(["-filter_complex", ";".join(filters), "-map", "[vout]"])
        if request.audio_policy == "preserve" and request.audio_path is not None:
            audio_input_index = len(request.video_paths)
            command.extend([
                "-map",
                f"{audio_input_index}:a:0",
                "-af",
                "aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS,apad",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-shortest",
            ])
        elif source_audio_enabled:
            command.extend(["-map", "[aout]", "-c:a", "aac", "-b:a", "192k"])
        else:
            command.append("-an")
        command.extend([
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(request.output_path),
        ])
        return command

    async def _probe_source_media(
        self,
        video_paths: Sequence[Path],
        interruption_event=None,
    ) -> list[_SourceMediaInfo]:
        """读取源视频的音频流和时长，供无外部音频时保留原音。"""
        results: list[_SourceMediaInfo] = []
        for video_path in video_paths:
            _, _, duration, has_audio = await self.inspect_video(video_path, interruption_event)
            results.append(_SourceMediaInfo(has_audio=has_audio, duration_seconds=duration))
        return results

    async def inspect_video(self, video_path: Path, interruption_event=None) -> tuple[int, int, float, bool]:
        """使用 FFprobe 读取媒体事实。"""
        await self._ensure_binaries()
        payload = await self._probe_output(video_path, interruption_event)
        return self._media_facts(payload)

    async def _ensure_binaries(self) -> None:
        """确认运行环境同时具备 FFmpeg 和 FFprobe。"""
        if await async_which("ffmpeg") is None or await async_which("ffprobe") is None:
            raise RuntimeError("FFmpeg and FFprobe are required for MP4 composition")

    @classmethod
    def _validate_request(cls, request: VideoCompositionRequest) -> None:
        """在启动 FFmpeg 前限制输入数量和输出尺寸，避免失控资源消耗。"""
        if not request.video_paths:
            raise ValueError("At least one video input is required")
        try:
            max_inputs = int(os.getenv("CANVAS_MAX_VIDEO_INPUTS", "100"))
            max_dimension = int(os.getenv("CANVAS_MAX_VIDEO_DIMENSION", "16384"))
        except ValueError as error:
            raise ValueError("Canvas media resource limits must be integers") from error
        if len(request.video_paths) > max(1, max_inputs):
            raise ValueError("Too many video inputs for one composition")
        if (
            request.width < 2
            or request.height < 2
            or request.width > max(2, max_dimension)
            or request.height > max(2, max_dimension)
        ):
            raise ValueError("Requested output dimensions exceed the configured safety limit")

    async def _probe_output(self, output_path: Path, interruption_event=None) -> dict:
        """使用 FFprobe 读取媒体流和时长，并校验返回结构。"""
        stdout = await self._run(
            [
                "ffprobe",
                "-v",
                "error",
                "-print_format",
                "json",
                "-show_streams",
                "-show_format",
                str(output_path),
            ],
            interruption_event,
            capture_stdout=True,
        )
        try:
            payload = json.loads(stdout)
        except json.JSONDecodeError as error:
            raise RuntimeError("FFprobe returned invalid output metadata") from error
        if not isinstance(payload, dict):
            raise RuntimeError("FFprobe output metadata must be an object")
        return payload

    @staticmethod
    def _media_facts(payload: dict) -> tuple[int, int, float, bool]:
        """从 FFprobe 结果中提取尺寸、时长和音频状态。"""
        streams = payload.get("streams") or []
        video = next((item for item in streams if item.get("codec_type") == "video"), None)
        if not isinstance(video, dict):
            raise RuntimeError("Video stream is missing")
        return (
            int(video.get("width") or 0),
            int(video.get("height") or 0),
            FfmpegVideoCompositionPort._duration_seconds(payload),
            any(item.get("codec_type") == "audio" for item in streams),
        )

    @staticmethod
    def _duration_seconds(payload: dict) -> float:
        """从 FFprobe format 中读取正数时长。"""
        try:
            return float((payload.get("format") or {}).get("duration") or 0)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _validate_probe(
        payload: dict,
        *,
        expected_width: int,
        expected_height: int,
        expected_audio: bool,
    ) -> None:
        """校验输出包含预期规格的视频流和音频流。"""
        streams = payload.get("streams")
        if not isinstance(streams, list):
            raise RuntimeError("Composed MP4 has no readable media streams")
        video_stream = next(
            (stream for stream in streams if stream.get("codec_type") == "video"),
            None,
        )
        if video_stream is None:
            raise RuntimeError("Composed MP4 has no video stream")
        if video_stream.get("codec_name") != "h264":
            raise RuntimeError("Composed MP4 video codec is not H.264")
        if video_stream.get("pix_fmt") != "yuv420p":
            raise RuntimeError("Composed MP4 pixel format is not yuv420p")
        if video_stream.get("width") != expected_width or video_stream.get("height") != expected_height:
            raise RuntimeError("Composed MP4 resolution does not match the requested output")
        has_audio = any(stream.get("codec_type") == "audio" for stream in streams)
        if has_audio != expected_audio:
            raise RuntimeError("Composed MP4 audio stream does not match the requested output")
        if FfmpegVideoCompositionPort._duration_seconds(payload) <= 0:
            raise RuntimeError("Composed MP4 duration is invalid")

    @staticmethod
    async def _move_output(source_path: Path, target_path: Path) -> None:
        """直接写入最终工作区文件，避免 MagicFS 挂载目录中的中间文件和替换操作。"""
        if await async_exists(target_path):
            raise FileExistsError(f"Composition output already exists: {target_path}")
        try:
            await async_copy_contents(source_path, target_path)
        except BaseException:
            try:
                await async_unlink(target_path)
            except Exception:
                # MagicFS 在 I/O 异常后可能暂时不接受删除，不能覆盖原始写入错误。
                pass
            raise
        if not await async_exists(target_path) or (await async_stat(target_path)).st_size <= 0:
            raise RuntimeError("Composed MP4 was not persisted successfully")

    async def _run(self, command: list[str], interruption_event, capture_stdout: bool = False) -> str:
        """运行媒体命令并处理用户中断和可配置超时。"""
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        communicate_task = asyncio.create_task(process.communicate())
        interrupt_task = (
            asyncio.create_task(interruption_event.wait())
            if interruption_event is not None
            else None
        )
        timeout_task = asyncio.create_task(asyncio.sleep(self._command_timeout_seconds()))
        try:
            wait_tasks = [communicate_task]
            if interrupt_task is not None:
                wait_tasks.append(interrupt_task)
            wait_tasks.append(timeout_task)
            done, _ = await asyncio.wait(wait_tasks, return_when=asyncio.FIRST_COMPLETED)
            if interrupt_task is not None and interrupt_task in done and interruption_event.is_set():
                await self._terminate_process(process)
                communicate_task.cancel()
                await asyncio.gather(communicate_task, return_exceptions=True)
                raise asyncio.CancelledError
            if timeout_task in done:
                await self._terminate_process(process)
                communicate_task.cancel()
                await asyncio.gather(communicate_task, return_exceptions=True)
                raise TimeoutError("Media process exceeded the configured timeout")
            stdout, stderr = await communicate_task
            if process.returncode != 0:
                summary = self._sanitize_stderr(stderr.decode("utf-8", errors="replace"))
                raise RuntimeError(f"Media process failed: {summary}")
            return stdout.decode("utf-8", errors="replace") if capture_stdout else ""
        except asyncio.CancelledError:
            await self._terminate_process(process)
            raise
        finally:
            if interrupt_task is not None:
                interrupt_task.cancel()
                await asyncio.gather(interrupt_task, return_exceptions=True)
            timeout_task.cancel()
            await asyncio.gather(timeout_task, return_exceptions=True)
            if not communicate_task.done():
                communicate_task.cancel()
                await asyncio.gather(communicate_task, return_exceptions=True)

    @staticmethod
    async def _terminate_process(process: asyncio.subprocess.Process) -> None:
        """先温和终止媒体进程，超时后强制结束。"""
        if process.returncode is not None:
            return
        process.terminate()
        try:
            await asyncio.wait_for(process.wait(), timeout=3)
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()

    @staticmethod
    def _sanitize_stderr(stderr: str) -> str:
        """压缩 FFmpeg 错误，同时保留末尾多行上下文。"""
        lines = [line.strip() for line in stderr.splitlines() if line.strip()]
        return "\n".join(lines[-8:] if lines else ["unknown FFmpeg error"])[:2000]

    @staticmethod
    def _command_timeout_seconds() -> float:
        """读取媒体命令超时，非法配置时使用安全默认值。"""
        try:
            value = float(os.getenv("CANVAS_FFMPEG_TIMEOUT_SECONDS", "1800"))
        except ValueError:
            return 1800.0
        return max(1.0, value)
