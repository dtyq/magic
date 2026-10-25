"""
ASR 文件检测和分类模块

负责音频文件类型检测、文件扫描和格式识别
"""

import asyncio
import json
import re
import wave
from asyncio.subprocess import PIPE
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

from loguru import logger

from app.service.asr.asr_base import AsrServiceBase
from app.service.asr.asr_utils import SUPPORTED_AUDIO_FORMATS, validate_audio_format_for_write


@dataclass(frozen=True)
class AudioSignature:
    """可用于比较和缓存的音频流参数签名。"""

    format: str
    codec: str
    sample_rate: int
    channels: int
    bits_per_sample: int

    def as_key(self) -> str:
        return (
            f"{self.format}:{self.codec}:{self.sample_rate}:"
            f"{self.channels}:{self.bits_per_sample}"
        )


class AsrFileDetector(AsrServiceBase):
    """ASR 文件检测器 - 支持 WAV / Opus 分片（任务内格式同质）"""

    # 支持的音频格式（与 asr_utils.SUPPORTED_AUDIO_FORMATS 保持一致）
    SUPPORTED_AUDIO_FORMATS: list[str] = list(SUPPORTED_AUDIO_FORMATS)

    def extract_file_index(self, filename: str) -> Optional[int]:
        """
        从文件名提取序号

        支持格式: {index}.{ext}，例如 "0.opus", "1.wav", "123.opus"

        Args:
            filename: 文件名

        Returns:
            文件序号，提取失败返回 None
        """
        try:
            formats_pattern = "|".join(self.SUPPORTED_AUDIO_FORMATS)
            pattern = rf"^(\d+)\.({formats_pattern})$"
            match = re.match(pattern, filename.lower())

            if match:
                return int(match.group(1))
            return None
        except Exception as e:
            logger.warning(f"{self.LOG_PREFIX} 提取文件序号失败: {filename}, 错误: {e}")
            return None

    def scan_audio_files(self, directory: Path, include_merged: bool = True) -> List[Tuple[int, Path]]:
        """
        扫描目录中的音频文件并按索引排序

        Args:
            directory: 要扫描的目录
            include_merged: 是否包含 merged.{ext} 文件

        Returns:
            List[Tuple[int, Path]]: 排序后的 (文件索引, 文件路径) 列表
        """
        files, _ = self.scan_audio_files_with_conflicts(directory, include_merged)
        return self.deduplicate_files(files)

    @staticmethod
    def deduplicate_files(files: List[Tuple[int, Path]]) -> List[Tuple[int, Path]]:
        """Keep the newest candidate for each shard index."""
        files_dict = {}

        for _, file_path in files:
            file_index = int(file_path.stem)
            current_mtime = file_path.stat().st_mtime
            if file_index in files_dict:
                existing_path, existing_mtime = files_dict[file_index]
                logger.warning(
                    f"{AsrFileDetector.LOG_PREFIX} ⚠️ 保持兼容的去重扫描发现重复索引 {file_index}: "
                    f"{existing_path.name} (mtime={existing_mtime:.2f}) vs {file_path.name} (mtime={current_mtime:.2f})"
                )
                if current_mtime > existing_mtime:
                    files_dict[file_index] = (file_path, current_mtime)
            else:
                files_dict[file_index] = (file_path, current_mtime)

        deduplicated = [(idx, path) for idx, (path, _) in files_dict.items()]
        deduplicated.sort(key=lambda x: x[0])
        return deduplicated

    def scan_audio_files_with_conflicts(
        self, directory: Path, include_merged: bool = True
    ) -> tuple[List[Tuple[int, Path]], list[dict]]:
        """Return every shard candidate plus duplicate-index diagnostics.

        The legacy ``scan_audio_files`` API remains deduplicated for callers
        that only need merge inputs.  Conflict-aware callers must use this
        method so a ``0.wav``/``0.opus`` pair cannot disappear before validation.
        """
        files_by_index: dict[int, list[Path]] = {}

        for file_path in directory.glob("*"):
            if file_path.is_file():
                if not include_merged and file_path.stem.startswith("merged"):
                    continue

                file_index = self.extract_file_index(file_path.name)
                if file_index is not None:
                    files_by_index.setdefault(file_index, []).append(file_path)

        all_files = [
            (index, path)
            for index in sorted(files_by_index)
            for path in sorted(files_by_index[index], key=lambda item: item.name)
        ]
        conflicts = [
            {"index": index, "files": paths}
            for index, paths in sorted(files_by_index.items())
            if len(paths) > 1
        ]
        formats = {path.suffix.lower().lstrip(".") for _, path in all_files}
        if len(formats) > 1:
            conflicts.append(
                {
                    "type": "mixed_format",
                    "index": None,
                    "formats": sorted(formats),
                    "files": [path for _, path in all_files],
                }
            )
        return all_files, conflicts

    async def probe_audio_file(self, path: Path) -> dict:
        """Read lightweight container/codec metadata using ffprobe."""
        process = await asyncio.create_subprocess_exec(
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=codec_name,channels,sample_rate,bit_rate:format=format_name",
            "-of",
            "json",
            str(path),
            stdout=PIPE,
            stderr=PIPE,
        )
        stdout, stderr = await process.communicate()
        if process.returncode != 0:
            raise ValueError(stderr.decode(errors="replace").strip() or "ffprobe failed")
        payload = json.loads(stdout.decode())
        stream = (payload.get("streams") or [{}])[0]
        fmt = payload.get("format") or {}
        return {**stream, "format_name": fmt.get("format_name", "")}

    async def inspect_audio_signature(self, path: Path, expected_format: str) -> AudioSignature:
        """读取用于合并决策的音频参数；WAV 使用本地文件头，Opus 复用 ffprobe。"""
        expected = validate_audio_format_for_write(expected_format)
        if not path.is_file() or path.stat().st_size <= 0:
            raise ValueError("Audio shard is missing or empty")

        if expected == "wav":
            try:
                with wave.open(str(path), "rb") as wav_file:
                    sample_width = wav_file.getsampwidth()
                    frames = wav_file.getnframes()
                    if frames <= 0:
                        raise ValueError("WAV data section is empty")
                    return AudioSignature(
                        format="wav",
                        codec="pcm_s16le" if sample_width == 2 else f"pcm_s{sample_width * 8}",
                        sample_rate=wav_file.getframerate(),
                        channels=wav_file.getnchannels(),
                        bits_per_sample=sample_width * 8,
                    )
            except (wave.Error, EOFError) as exc:
                raise ValueError(f"WAV header parse failed: {exc}") from exc

        metadata = await self.probe_audio_file(path)
        try:
            channels = int(metadata.get("channels") or 0)
            sample_rate = int(metadata.get("sample_rate") or 0)
        except (TypeError, ValueError) as exc:
            raise ValueError("Invalid audio stream metadata") from exc
        codec = str(metadata.get("codec_name") or "unknown").lower()
        return AudioSignature(
            format=expected,
            codec=codec,
            sample_rate=sample_rate,
            channels=channels,
            bits_per_sample=0,
        )

    async def validate_audio_file(self, path: Path, expected_format: str) -> tuple[bool, str]:
        """Validate a shard's actual container/codec against its task format."""
        try:
            expected = validate_audio_format_for_write(expected_format)
        except ValueError as exc:
            return False, str(exc)

        try:
            if not path.is_file() or path.stat().st_size <= 0:
                return False, "Audio shard is missing or empty"
            if expected == "wav":
                await self.inspect_audio_signature(path, "wav")
                return True, ""
            metadata = await self.probe_audio_file(path)
        except Exception as exc:
            return False, f"Audio probe failed: {exc}"

        format_names = {item.strip().lower() for item in str(metadata.get("format_name", "")).split(",")}
        codec = str(metadata.get("codec_name", "")).lower()
        if expected == "opus":
            if "ogg" not in format_names:
                return False, "Expected Ogg container"
            if codec != "opus":
                return False, "Expected Opus codec"
            try:
                channels = int(metadata.get("channels") or 0)
                sample_rate = int(metadata.get("sample_rate") or 0)
            except (TypeError, ValueError):
                return False, "Invalid audio stream metadata"
            if channels != 1:
                return False, "Expected mono audio"
            # Opus commonly reports its internal 48kHz clock even when the
            # encoder was fed 16kHz speech; accept both representations.
            if sample_rate not in {16000, 48000}:
                return False, "Expected 16kHz input or Opus-compatible 48kHz stream"
        elif "wav" not in format_names:
            return False, "Expected WAV container"
        return True, ""

    @staticmethod
    def detect_audio_format(files: List[Tuple[int, Path]]) -> Optional[str]:
        """
        从扫描结果确定任务音频格式

        任务内格式同质（客户端契约：一个任务从首片到末片只用一种格式），
        因此取最小序号分片的后缀即可代表整个任务的格式。

        Args:
            files: scan_audio_files 的扫描结果 [(index, path), ...]

        Returns:
            str | None: 格式（wav / opus），无分片时返回 None
        """
        if not files:
            return None
        min_index_path = min(files, key=lambda x: x[0])[1]
        ext = min_index_path.suffix.lower().lstrip(".")
        return ext or None

    @staticmethod
    def filter_by_format(files: List[Tuple[int, Path]], audio_format: str) -> List[Tuple[int, Path]]:
        """
        按任务已定格式过滤分片（防呆：客户端异常导致混入异格式分片时不污染合并）

        Args:
            files: scan_audio_files 的扫描结果
            audio_format: 任务已定格式（wav / opus）

        Returns:
            仅保留该格式分片的列表
        """
        normalized_format = audio_format.lower().lstrip(".")
        suffix = f".{normalized_format}"
        return [(idx, path) for idx, path in files if path.suffix.lower() == suffix]
