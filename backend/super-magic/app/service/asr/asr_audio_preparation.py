"""ASR audio probing, compatibility policy, and safe temporary conversion."""

from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import AsyncIterator
from uuid import uuid4

from app.path_manager import PathManager
from app.utils.async_file_utils import async_chmod, async_mkdir, async_stat, async_unlink

PROBE_TIMEOUT_SECONDS = 15.0
MAX_UPLOAD_BYTES = 480 * 1024 * 1024
SAFE_BITS_PER_SAMPLE = 16
LOSSY_SAFE_CODECS = {"aac", "mp3", "opus", "vorbis"}
LOSSLESS_CODECS = {"flac", "alac"}
CONTAINER_TO_API_FORMAT = {
    "wav": "wav",
    "wave": "wav",
    "mp3": "mp3",
    "ogg": "ogg",
    "mov,mp4,m4a,3gp,3g2,mj2": "mp4",
    "flac": "flac",
}
POLICY_VERSION = "2026-09-20-v1"


class AudioProbeError(ValueError):
    """Audio metadata cannot be read safely."""


class AudioPreparationError(ValueError):
    """Audio conversion or output validation failed."""


class AudioPreparationMode(StrEnum):
    PRESERVE = "preserve"
    REPAIR = "repair"
    CANONICAL = "canonical"


@dataclass(frozen=True)
class AudioProbe:
    path: Path
    container: str
    codec: str
    sample_rate: int
    channels: int
    bits_per_sample: int | None
    sample_format: str | None
    duration_seconds: float


@dataclass(frozen=True)
class PreparedAudio:
    source: AudioProbe
    upload: AudioProbe
    mode: AudioPreparationMode
    temporary: bool

    @property
    def upload_path(self) -> Path:
        return self.upload.path

    @property
    def reference_duration_seconds(self) -> float:
        return self.upload.duration_seconds


def _positive_int(*values: object) -> int | None:
    for value in values:
        try:
            parsed = int(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            continue
        if parsed > 0:
            return parsed
    return None


async def _communicate_with_kill(process, timeout: float, timeout_message: str):
    try:
        return await asyncio.wait_for(process.communicate(), timeout=timeout)
    except asyncio.TimeoutError as exc:
        try:
            process.kill()
        except ProcessLookupError:
            pass
        await process.wait()
        raise AudioPreparationError(timeout_message) from exc
    except asyncio.CancelledError:
        try:
            process.kill()
        except ProcessLookupError:
            pass
        await process.wait()
        raise


async def probe_audio(path: Path) -> AudioProbe:
    try:
        process = await asyncio.create_subprocess_exec(
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=codec_name,codec_type,sample_fmt,sample_rate,channels,bits_per_sample,bits_per_raw_sample:format=format_name,duration",
            "-of",
            "json",
            str(path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError as exc:
        raise AudioProbeError("ffprobe is not installed") from exc
    try:
        stdout, stderr = await _communicate_with_kill(
            process,
            PROBE_TIMEOUT_SECONDS,
            "ffprobe timeout",
        )
    except AudioPreparationError as exc:
        raise AudioProbeError(str(exc)) from exc

    if process.returncode != 0:
        detail = stderr.decode("utf-8", errors="replace").strip()
        raise AudioProbeError(detail or "ffprobe failed")

    try:
        payload = json.loads(stdout.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise AudioProbeError("ffprobe returned invalid JSON") from exc

    stream = (payload.get("streams") or [None])[0]
    media_format = payload.get("format") or {}
    if not isinstance(stream, dict):
        raise AudioProbeError("No audio stream found")
    if not isinstance(media_format, dict):
        raise AudioProbeError("Invalid audio container metadata")

    try:
        duration = float(media_format.get("duration") or 0)
    except (TypeError, ValueError) as exc:
        raise AudioProbeError("Invalid audio duration") from exc
    if duration <= 0:
        raise AudioProbeError("Audio duration is empty or invalid")

    sample_rate = _positive_int(stream.get("sample_rate"))
    channels = _positive_int(stream.get("channels"))
    if not sample_rate or not channels:
        raise AudioProbeError("Invalid sample rate or channel count")

    container = str(media_format.get("format_name") or "unknown").lower()
    codec = str(stream.get("codec_name") or "unknown").lower()
    return AudioProbe(
        path=path,
        container=container,
        codec=codec,
        sample_rate=sample_rate,
        channels=channels,
        bits_per_sample=_positive_int(
            stream.get("bits_per_raw_sample"),
            stream.get("bits_per_sample"),
        ),
        sample_format=str(stream.get("sample_fmt") or "") or None,
        duration_seconds=duration,
    )


def choose_mode(probe: AudioProbe) -> AudioPreparationMode:
    if probe.container not in CONTAINER_TO_API_FORMAT:
        return AudioPreparationMode.CANONICAL
    if probe.channels not in {1, 2}:
        return AudioPreparationMode.CANONICAL

    if probe.codec in LOSSY_SAFE_CODECS:
        return AudioPreparationMode.PRESERVE

    if probe.container in {"wav", "wave"} and probe.codec == "pcm_s16le":
        if probe.channels in {1, 2} and probe.bits_per_sample == SAFE_BITS_PER_SAMPLE:
            return AudioPreparationMode.PRESERVE

    if probe.codec in LOSSLESS_CODECS:
        if probe.bits_per_sample is not None and probe.bits_per_sample <= SAFE_BITS_PER_SAMPLE:
            return AudioPreparationMode.PRESERVE
        return AudioPreparationMode.REPAIR

    if probe.container in {"wav", "wave"} and probe.codec.startswith("pcm_"):
        return AudioPreparationMode.REPAIR

    return AudioPreparationMode.CANONICAL


def build_repair_command(source: Path, target: Path, probe: AudioProbe) -> list[str]:
    return [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-i",
        str(source),
        "-ar",
        str(probe.sample_rate),
        "-ac",
        str(probe.channels),
        "-c:a",
        "pcm_s16le",
        str(target),
    ]


def build_canonical_command(source: Path, target: Path) -> list[str]:
    return [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-i",
        str(source),
        "-ar",
        "16000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        str(target),
    ]


def transcode_timeout_for(probe: AudioProbe) -> float:
    """Scale conversion timeout with source duration, with a one-minute floor."""
    return max(60.0, 30.0 + probe.duration_seconds * 0.25)


async def run_ffmpeg(command: list[str], timeout: float) -> None:
    try:
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError as exc:
        raise AudioPreparationError("ffmpeg is not installed") from exc
    _, stderr = await _communicate_with_kill(process, timeout, "ffmpeg conversion timeout")
    if process.returncode != 0:
        detail = stderr.decode("utf-8", errors="replace").strip()
        raise AudioPreparationError(detail or "ffmpeg conversion failed")


def validate_prepared_audio(
    source: AudioProbe,
    upload: AudioProbe,
    mode: AudioPreparationMode,
) -> None:
    if mode is AudioPreparationMode.REPAIR:
        if upload.codec != "pcm_s16le" or upload.bits_per_sample != 16:
            raise AudioPreparationError("Repair output is not 16-bit pcm_s16le")
        if upload.sample_rate != source.sample_rate or upload.channels != source.channels:
            raise AudioPreparationError("Repair output changed sample rate or channels")
    elif mode is AudioPreparationMode.CANONICAL:
        if (
            upload.codec != "pcm_s16le"
            or upload.bits_per_sample != 16
            or upload.sample_rate != 16_000
            or upload.channels != 1
        ):
            raise AudioPreparationError("Canonical output is not 16kHz mono pcm_s16le")

    tolerance = max(2.0, source.duration_seconds * 0.05)
    if abs(source.duration_seconds - upload.duration_seconds) > tolerance:
        raise AudioPreparationError(
            "Transcoded duration differs from source metadata beyond tolerance: "
            f"source={source.duration_seconds:.3f}s upload={upload.duration_seconds:.3f}s"
        )


class AudioPreparer:
    def __init__(self, runtime_dir: Path | None = None):
        self.runtime_dir = runtime_dir

    def _runtime_dir(self) -> Path:
        return self.runtime_dir or (PathManager.get_runtime_dir() / "audio_understanding")

    @asynccontextmanager
    async def prepare_audio(
        self,
        path: Path,
        forced_mode: AudioPreparationMode | None = None,
    ) -> AsyncIterator[PreparedAudio]:
        source = await probe_audio(path)
        mode = forced_mode or choose_mode(source)
        if mode is AudioPreparationMode.PRESERVE:
            yield PreparedAudio(source=source, upload=source, mode=mode, temporary=False)
            return

        runtime_dir = self._runtime_dir()
        await async_mkdir(runtime_dir, parents=True, exist_ok=True)
        await async_chmod(runtime_dir, 0o700)
        temporary_path: Path | None = None

        try:
            while True:
                suffix = "repair" if mode is AudioPreparationMode.REPAIR else "canonical"
                temporary_path = runtime_dir / f"{uuid4().hex}.{suffix}.wav"
                command = (
                    build_repair_command(path, temporary_path, source)
                    if mode is AudioPreparationMode.REPAIR
                    else build_canonical_command(path, temporary_path)
                )
                await run_ffmpeg(command, timeout=transcode_timeout_for(source))
                await async_chmod(temporary_path, 0o600)
                upload = await probe_audio(temporary_path)
                validate_prepared_audio(source, upload, mode)

                if mode is AudioPreparationMode.REPAIR:
                    file_stat = await async_stat(temporary_path)
                    if file_stat.st_size > MAX_UPLOAD_BYTES:
                        await async_unlink(temporary_path)
                        temporary_path = None
                        mode = AudioPreparationMode.CANONICAL
                        continue
                break

            yield PreparedAudio(source=source, upload=upload, mode=mode, temporary=True)
        finally:
            if temporary_path is not None:
                await async_unlink(temporary_path)
