"""Opus finish 合并操作。

该模块只负责 Opus 在 finish 后的一次性全量合并，不参与 WAV 增量合并。
"""

import asyncio
import time
from dataclasses import dataclass
from pathlib import Path
from statistics import median
from uuid import uuid4

from loguru import logger

from app.service.asr.asr_base import AsrServiceBase
from app.service.asr.asr_file_detector import AsrFileDetector
from app.service.asr.asr_local_proxy import AsrLocalWorkspaceProxy
from app.service.asr.asr_merge_task_manager import AsrMergeTaskManager
from app.service.asr.asr_time_config import asr_time_config
from app.utils.async_file_utils import (
    async_chmod,
    async_rename,
    async_unlink,
    async_write_text,
)


class OpusShardsNotReadyError(RuntimeError):
    """finish 已到达，但 Opus 分片集合尚未完整或尚未稳定。"""


@dataclass(frozen=True)
class OpusMergeInput:
    index: int
    path: Path
    synthetic: bool
    duration_ms: int | None = None


@dataclass(frozen=True)
class SilenceFillParams:
    """静音补片的编码参数，对齐相邻真实分片，避免 concat 段参数跳变。"""

    sample_rate: int = 16000
    channels: int = 1
    bitrate: str = ""  # ffmpeg -b:a 取值，如 "32k"；空串表示用全局默认

    def effective_bitrate(self) -> str:
        return self.bitrate or asr_time_config.OGG_REENCODE_BITRATE


class AsrOpusMergeOperations(AsrServiceBase):
    """Use original numbered Opus shards to build one committed staging file."""

    def __init__(self, file_detector: AsrFileDetector):
        self.file_detector = file_detector

    async def merge_opus_on_finish(
        self,
        task_key: str,
        source_dir: Path,
        all_files: list[tuple[int, Path]],
        expected_shard_count: int | None = None,
        merge_attempt_id: str | None = None,
        missing_indices: list[int] | None = None,
    ) -> bool:
        started_at = time.monotonic()
        ordered_files = sorted(all_files, key=lambda item: item[0])
        indices = [index for index, _ in ordered_files]
        accepted_missing = sorted(missing_indices or [])
        self._validate_shard_indices(ordered_files, expected_shard_count, accepted_missing)

        proxy = AsrLocalWorkspaceProxy(task_key, source_dir, audio_format="opus")
        filenames = [path.name for _, path in ordered_files]
        try:
            local_paths = await asyncio.wait_for(
                proxy.ensure_remote_files_to_local_batch(
                    filenames,
                    required=True,
                    concurrency=asr_time_config.OPUS_SHARD_SYNC_CONCURRENCY,
                ),
                timeout=asr_time_config.OPUS_SHARD_SYNC_TIMEOUT,
            )
        except asyncio.TimeoutError as exc:
            raise RuntimeError("Opus 分片同步超时") from exc

        strict_local_paths = [path for path in local_paths if path is not None]
        if len(strict_local_paths) != len(ordered_files):
            raise OpusShardsNotReadyError(
                f"Opus 本地同步未完成: {len(strict_local_paths)}/{len(ordered_files)}"
            )

        await self._validate_local_shards(ordered_files, strict_local_paths)

        token = merge_attempt_id or uuid4().hex
        list_file = proxy.get_local_path(f".concat_list_opus_finish_{token}.txt")
        temp_output = proxy.get_local_path(f".concat_temp_opus_finish_{token}.opus")
        local_merged_path = proxy.get_local_path(proxy.merged_filename)
        synthetic_files: list[Path] = []

        try:
            real_local_files = {
                index: path
                for (index, _), path in zip(ordered_files, strict_local_paths, strict=True)
            }
            merge_inputs, synthetic_files = await self._build_merge_inputs(
                task_key=task_key,
                local_files=real_local_files,
                expected_shard_count=expected_shard_count,
                missing_indices=accepted_missing,
                synthetic_dir=proxy.local_dir,
                attempt_id=token,
            )
            await self._create_concat_list_file([item.path for item in merge_inputs], list_file)
            cmd = self._build_ffmpeg_command(list_file, temp_output)
            log_event = "ASR_DEGRADED_MERGE_STARTED" if accepted_missing else "ASR_MERGE_STARTED"
            logger.warning(
                f"{self.LOG_PREFIX} event={log_event} task_key={task_key} "
                f"attempt_id={token} input_count={len(merge_inputs)} "
                f"real_shard_count={len(strict_local_paths)} synthetic_shard_count={len(synthetic_files)} "
                f"index_range={indices[0]}-{indices[-1]}, codec=libopus, "
                f"sample_rate=16000, channels=1, bitrate={asr_time_config.OGG_REENCODE_BITRATE}"
            )
            await self._run_ffmpeg(cmd)

            valid_output, reason = await self.file_detector.validate_audio_file(temp_output, "opus")
            if not valid_output:
                raise RuntimeError(f"Opus finish 输出校验失败: {reason}")
            duration = await self._get_audio_duration(temp_output)
            if duration <= 0:
                raise RuntimeError("Opus finish 输出时长无效")

            await async_rename(temp_output, local_merged_path)
            upload_ok = await proxy.sync_local_to_remote_atomic(
                proxy.merged_filename,
                timeout=asr_time_config.OPUS_STAGING_UPLOAD_TIMEOUT,
            )
            if not upload_ok:
                raise RuntimeError("Opus finish staging 原子上传失败")

            merged_size = await asyncio.to_thread(lambda: local_merged_path.stat().st_size)
            # 静音补片后合并产物逻辑上覆盖 0..expected-1（尾部缺片也算在内），
            # source_last_index 必须反映覆盖范围而非最后一个真实分片，
            # 否则 check_should_complete_opus 的 metadata 校验会卡住尾部补片任务。
            covered_last_index = (
                expected_shard_count - 1 if expected_shard_count and accepted_missing else indices[-1]
            )
            metadata_ok = await proxy.save_metadata(
                covered_last_index,
                extra={
                    "audio_format": "opus",
                    "merge_strategy": "opus_finish_full_rebuild_v1",
                    "merge_mode": "normalized_reencode",
                    "audio_signature": "opus:opus:16000:1:0",
                    "audio_signature_details": {
                        "format": "opus",
                        "codec": "opus",
                        "sample_rate": 16000,
                        "channels": 1,
                        "bits_per_sample": 0,
                    },
                    "merge_attempt_id": token,
                    "source_shard_count": len(indices),
                    "expected_shard_count": expected_shard_count or len(indices),
                    "source_last_index": covered_last_index,
                    "degraded": bool(accepted_missing),
                    "completion_mode": (
                        "silence_fill" if accepted_missing else "strict"
                    ),
                    "missing_shard_indices": accepted_missing,
                    "synthetic_shards": [
                        {
                            "index": item.index,
                            "duration_ms": item.duration_ms,
                            "reason": "source_shard_missing",
                        }
                        for item in merge_inputs
                        if item.synthetic
                    ],
                    "merged_duration": duration,
                    "merged_size": merged_size,
                },
                atomic=True,
            )
            if not metadata_ok:
                raise RuntimeError("Opus finish metadata 原子上传失败")

            progress_saved = await AsrMergeTaskManager.instance().update_progress(
                task_key,
                expected_shard_count - 1 if expected_shard_count else indices[-1],
                expected_shard_count or len(indices),
            )
            if not progress_saved:
                raise RuntimeError("Opus finish 进度写入失败")

            completed_event = (
                "ASR_DEGRADED_MERGE_COMPLETED" if accepted_missing else "ASR_MERGE_COMPLETED"
            )
            logger.warning(
                f"{self.LOG_PREFIX} event={completed_event} task_key={task_key} "
                f"attempt_id={token}, size={merged_size}B, duration={duration}s, "
                f"missing_indices={accepted_missing[:20]} "
                f"elapsed={time.monotonic() - started_at:.2f}s"
            )
            return True
        except Exception as exc:
            if accepted_missing:
                logger.error(
                    f"{self.LOG_PREFIX} event=ASR_DEGRADED_MERGE_FAILED task_key={task_key} "
                    f"attempt_id={token} missing_indices={accepted_missing[:20]} error={exc}"
                )
            raise
        finally:
            for path in [list_file, temp_output, *synthetic_files]:
                await async_unlink(path)

    @staticmethod
    def _validate_shard_indices(
        ordered_files: list[tuple[int, Path]],
        expected_shard_count: int | None,
        accepted_missing_indices: list[int] | None = None,
    ) -> None:
        if not ordered_files:
            raise OpusShardsNotReadyError("尚未扫描到 Opus 分片")

        indices = [index for index, _ in ordered_files]
        for index, path in ordered_files:
            if path.name != f"{index}.opus":
                raise ValueError(f"Opus 分片文件名非法: index={index}, filename={path.name}")

        accepted_missing = sorted(accepted_missing_indices or [])
        if expected_shard_count is not None and expected_shard_count >= 0:
            expected_indices = list(range(expected_shard_count))
            if indices == expected_indices:
                return
            if accepted_missing and sorted(set(expected_indices) - set(indices)) == accepted_missing:
                return
            if len(indices) <= expected_shard_count and set(indices).issubset(expected_indices):
                missing = sorted(set(expected_indices) - set(indices))
                raise OpusShardsNotReadyError(f"Opus 分片尚未齐全，缺少索引: {missing[:20]}")
            raise ValueError(
                f"Opus 分片与声明数量冲突: declared={expected_shard_count}, indices={indices[:20]}"
            )

        expected_indices = list(range(indices[-1] + 1))
        if indices != expected_indices:
            missing = sorted(set(expected_indices) - set(indices))
            raise OpusShardsNotReadyError(f"Opus 分片索引不连续，缺少: {missing[:20]}")

    async def _build_merge_inputs(
        self,
        task_key: str,
        local_files: dict[int, Path],
        expected_shard_count: int | None,
        missing_indices: list[int],
        synthetic_dir: Path,
        attempt_id: str,
    ) -> tuple[list[OpusMergeInput], list[Path]]:
        if not missing_indices:
            return (
                [
                    OpusMergeInput(index=index, path=path, synthetic=False)
                    for index, path in sorted(local_files.items())
                ],
                [],
            )
        if expected_shard_count is None or expected_shard_count <= 0:
            raise ValueError("静音补片需要明确的预期分片范围")

        neighbor_indices = {
            neighbor
            for missing_index in missing_indices
            for neighbor in range(
                max(0, missing_index - 3),
                min(expected_shard_count, missing_index + 4),
            )
            if neighbor in local_files
        }
        durations = {
            index: duration
            for index, duration in await asyncio.gather(
                *(
                    self._probe_index_duration(index, local_files[index])
                    for index in sorted(neighbor_indices)
                )
            )
            if duration > 0
        }
        inputs: list[OpusMergeInput] = []
        synthetic_files: list[Path] = []
        for index in range(expected_shard_count):
            real_path = local_files.get(index)
            if real_path is not None:
                inputs.append(OpusMergeInput(index=index, path=real_path, synthetic=False))
                continue
            if index not in missing_indices:
                raise OpusShardsNotReadyError(f"未获批准的 Opus 缺片: {index}")
            neighbors = [
                durations[neighbor]
                for neighbor in range(max(0, index - 3), min(expected_shard_count, index + 4))
                if neighbor in durations
            ]
            if not neighbors:
                raise OpusShardsNotReadyError(f"无法推算 Opus 缺片 {index} 的时长")
            duration = float(median(neighbors))
            fill_params = await self._probe_neighbor_fill_params(
                task_key, local_files, index, expected_shard_count
            )
            synthetic_path = synthetic_dir / f".synthetic_{attempt_id}_{index}.opus"
            position = "tail" if index > max(local_files) else "middle"
            logger.warning(
                f"{self.LOG_PREFIX} event=ASR_SILENCE_FILL_PLANNED task_key={task_key} "
                f"index={index} position={position} duration_ms={round(duration * 1000)} "
                f"duration_source=neighbor_median sample_rate={fill_params.sample_rate} "
                f"channels={fill_params.channels} bitrate={fill_params.effective_bitrate()}"
            )
            await self._generate_silence_opus(synthetic_path, duration, fill_params)
            logger.warning(
                f"{self.LOG_PREFIX} event=ASR_SILENCE_FILL_GENERATED task_key={task_key} "
                f"index={index} duration_ms={round(duration * 1000)} codec=opus "
                f"sample_rate={fill_params.sample_rate} channels={fill_params.channels} "
                f"bitrate={fill_params.effective_bitrate()}"
            )
            synthetic_files.append(synthetic_path)
            inputs.append(
                OpusMergeInput(
                    index=index,
                    path=synthetic_path,
                    synthetic=True,
                    duration_ms=round(duration * 1000),
                )
            )
        return inputs, synthetic_files

    async def _probe_neighbor_fill_params(
        self,
        task_key: str,
        local_files: dict[int, Path],
        missing_index: int,
        expected_shard_count: int,
    ) -> SilenceFillParams:
        """探测缺片相邻真实分片的编码参数；探测失败回落到合并输出的统一参数。"""
        fallback = SilenceFillParams()
        candidates = sorted(
            (
                neighbor
                for neighbor in range(
                    max(0, missing_index - 3),
                    min(expected_shard_count, missing_index + 4),
                )
                if neighbor in local_files
            ),
            # 优先前一个分片，其次按距离取最近
            key=lambda neighbor: (0 if neighbor == missing_index - 1 else 1, abs(neighbor - missing_index)),
        )
        if not candidates:
            return fallback
        try:
            metadata = await self.file_detector.probe_audio_file(local_files[candidates[0]])
        except Exception as exc:
            logger.warning(
                f"{self.LOG_PREFIX} ⚠️ task_key={task_key} 探测缺片 {missing_index} 相邻分片参数失败，"
                f"使用默认静音参数: {exc}"
            )
            return fallback
        try:
            sample_rate = int(metadata.get("sample_rate") or 0)
            channels = int(metadata.get("channels") or 0)
        except (TypeError, ValueError):
            return fallback
        # 分片入库前已校验为 opus/单声道/16000|48000；探测值越界说明文件异常，不值得对齐
        if sample_rate not in {16000, 48000} or channels != 1:
            return fallback
        bitrate = ""
        try:
            bit_rate_bps = int(metadata.get("bit_rate") or 0)
        except (TypeError, ValueError):
            bit_rate_bps = 0
        if 6000 <= bit_rate_bps <= 510000:
            bitrate = f"{round(bit_rate_bps / 1000)}k"
        return SilenceFillParams(sample_rate=sample_rate, channels=channels, bitrate=bitrate)

    async def _probe_index_duration(self, index: int, path: Path) -> tuple[int, float]:
        return index, await self._get_audio_duration(path)

    async def _generate_silence_opus(
        self, output_path: Path, duration: float, params: SilenceFillParams | None = None
    ) -> None:
        params = params or SilenceFillParams()
        channel_layout = "mono" if params.channels == 1 else "stereo"
        cmd = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "lavfi", "-i", f"anullsrc=r={params.sample_rate}:cl={channel_layout}",
            "-t", f"{duration:.3f}", "-c:a", "libopus",
            "-b:a", params.effective_bitrate(),
            "-application", "audio", str(output_path),
        ]
        await self._run_ffmpeg(cmd)
        await async_chmod(output_path, 0o600)

    async def _validate_local_shards(
        self,
        ordered_files: list[tuple[int, Path]],
        local_paths: list[Path],
    ) -> None:
        semaphore = asyncio.Semaphore(asr_time_config.OPUS_SHARD_PROBE_CONCURRENCY)

        async def validate(index: int, local_path: Path) -> tuple[int, bool, str]:
            async with semaphore:
                valid, reason = await self.file_detector.validate_audio_file(local_path, "opus")
                return index, valid, reason

        results = await asyncio.gather(
            *(validate(index, local_path) for (index, _), local_path in zip(ordered_files, local_paths, strict=True))
        )
        for index, valid, reason in results:
            if not valid:
                raise OpusShardsNotReadyError(f"Opus 分片 {index} 尚不可用: {reason}")

    @staticmethod
    async def _create_concat_list_file(files: list[Path], list_file: Path) -> None:
        lines = [f"file '{path.absolute()}'" for path in files]
        await async_write_text(list_file, "\n".join(lines), encoding="utf-8")

    @staticmethod
    def _build_ffmpeg_command(list_file: Path, temp_output: Path) -> list[str]:
        return [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_file),
            "-map",
            "0:a:0",
            "-vn",
            "-c:a",
            "libopus",
            "-ar",
            "16000",
            "-ac",
            "1",
            "-b:a",
            asr_time_config.OGG_REENCODE_BITRATE,
            "-application",
            "audio",
            str(temp_output),
        ]

    async def _run_ffmpeg(self, cmd: list[str]) -> None:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            _, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=asr_time_config.OPUS_FINISH_FFMPEG_TIMEOUT,
            )
        except asyncio.TimeoutError as exc:
            process.kill()
            raise RuntimeError("Opus finish FFmpeg 超时") from exc
        if process.returncode != 0:
            stderr_text = stderr.decode("utf-8", errors="replace")[-4000:]
            raise RuntimeError(f"Opus finish FFmpeg 失败: {stderr_text}")

    @staticmethod
    async def _get_audio_duration(audio_file: Path) -> float:
        process = await asyncio.create_subprocess_exec(
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(audio_file),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, _ = await asyncio.wait_for(
                process.communicate(), timeout=asr_time_config.FFPROBE_TIMEOUT
            )
        except asyncio.TimeoutError:
            process.kill()
            return 0
        if process.returncode != 0 or not stdout:
            return 0
        try:
            return float(stdout.decode().strip())
        except ValueError:
            return 0
