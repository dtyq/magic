"""
音频理解工具

此工具使用 Magic Service API 提供音频转文本的转录功能。
它支持提交音频文件进行转录并查询结果。
"""

import asyncio
import json
import logging
import re
import traceback
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import httpx
from agentlang.config.config import Config
from agentlang.context.tool_context import ToolContext
from agentlang.event import EventPairType, get_correlation_manager
from agentlang.event.data import PendingToolCallEventData
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from agentlang.utils.metadata import MetadataUtil
from mutagen import File as MutagenFile
from pydantic import Field

from app.core.context.run_interruption import await_with_interruption
from app.core.entity.factory.tool_detail_factory import ToolDetailFactory
from app.core.entity.message.server_message import DisplayType, FileContent, OperationResultStatus, ToolDetail
from app.i18n import i18n
from app.infrastructure.magic_service.config import MagicServiceConfigLoader
from app.service.asr.asr_audio_preparation import (
    CONTAINER_TO_API_FORMAT,
    MAX_UPLOAD_BYTES,
    AudioPreparationError,
    AudioPreparationMode,
    AudioPreparer,
    AudioProbeError,
    PreparedAudio,
)
from app.service.asr.asr_merge_task_manager import AsrMergeTaskManager
from app.service.file_service import FileService, WorkspaceFileURLError
from app.tools.core.base_tool_params import BaseToolParams
from app.tools.core.tool_keepalive import start_tool_keep_alive, stop_tool_keep_alive
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_exists, async_mkdir, async_stat, async_write_text


class AudioUnderstandingError(Exception):
    """Audio Understanding 工具的自定义异常"""

    def __init__(self, message: str, error_code: str = None, task_id: str = None):
        self.message = message
        self.error_code = error_code
        self.task_id = task_id
        super().__init__(message)


@dataclass
class TranscriptionResult:
    """转录结果数据类"""

    text: str
    task_id: Optional[str] = None
    api_declared_duration_ms: Optional[int] = None
    last_utterance_end_ms: Optional[int] = None
    last_utterance_end_source: Optional[str] = None
    utterances: list[dict] | None = None


class TranscriptionValidationError(ValueError):
    """The ASR provider interpreted a different audio duration than we uploaded."""


@dataclass(frozen=True)
class TimelineTrim:
    dropped_count: int
    dropped_span_seconds: float
    retained_end_seconds: float

    @property
    def has_drop(self) -> bool:
        return self.dropped_count > 0


@dataclass(frozen=True)
class AudioRunResult:
    transcript_path: Path
    trim: TimelineTrim
    preparation_mode: AudioPreparationMode
    fallback_used: bool


def utterance_end_ms(utterance: dict) -> int:
    try:
        start_time = max(0, int(utterance.get("start_time", 0)))
    except (TypeError, ValueError):
        start_time = 0
    try:
        duration = max(0, int(utterance.get("duration", 0)))
    except (TypeError, ValueError):
        duration = 0
    return start_time + duration


def validate_transcription_result(prepared: PreparedAudio, result: TranscriptionResult) -> None:
    local_seconds = prepared.reference_duration_seconds
    if result.api_declared_duration_ms is None or result.api_declared_duration_ms <= 0:
        raise TranscriptionValidationError("ASR response has no valid declared duration")

    api_seconds = result.api_declared_duration_ms / 1000
    tolerance = max(2.0, local_seconds * 0.01)
    if abs(local_seconds - api_seconds) > tolerance:
        raise TranscriptionValidationError(
            f"ASR declared duration mismatch: local={local_seconds:.3f}s api={api_seconds:.3f}s"
        )


def trim_out_of_range_utterances(
    prepared: PreparedAudio,
    utterances: list[dict],
) -> tuple[list[dict], TimelineTrim]:
    max_allowed_ms = int((prepared.reference_duration_seconds + 2.0) * 1000)
    retained: list[dict] = []
    dropped: list[dict] = []
    for utterance in utterances:
        (retained if utterance_end_ms(utterance) <= max_allowed_ms else dropped).append(utterance)

    retained_end_ms = max((utterance_end_ms(item) for item in retained), default=0)
    dropped_end_ms = max((utterance_end_ms(item) for item in dropped), default=0)
    dropped_span_seconds = max(
        0.0,
        dropped_end_ms / 1000 - prepared.reference_duration_seconds,
    )
    return retained, TimelineTrim(
        dropped_count=len(dropped),
        dropped_span_seconds=dropped_span_seconds,
        retained_end_seconds=retained_end_ms / 1000,
    )


class AudioUnderstandingParams(BaseToolParams):
    audio_path: str = Field(
        ...,
        description="""<!--zh: [输入] 音频文件路径（相对于工作区根目录，包含文件夹和文件名）。线上生成的录音通常在 '{智能总结名}_{时间戳}' 格式的文件夹中。示例：'产品评审会议_20251121_170158/录音.wav' / 'meeting-summary_20251121_170158/audio.mp3' / '会議要約_20251121_170158/音声.m4a'-->
[Input] Audio file path (relative to workspace root, includes folder and filename). Online generated recordings typically in '{Summary_Name}_{timestamp}' format folder. Examples: 'Product_Review_Meeting_20251121_170158/audio.wav' / 'Meeting_Summary_20251121_170158/audio.mp3' / 'Meeting_Summary_20251121_170158/audio.m4a'""",
    )
    transcript_filename: str = Field(
        ...,
        description="""<!--zh: [输出] 录音文字稿文件名（纯文件名，不含路径，禁止包含 / 符号），转录结果将输出到音频文件同目录。格式为 '{主题名}-录音文字稿.md'（中文）/ '{topic-name}-transcript.md'（英文）/ '{トピック名}-文字起こし.md'（日文）。示例：'产品评审会议-录音文字稿.md' / 'meeting-transcript.md' / '会議-文字起こし.md'-->
[Output] Transcript filename (filename only, no path, no / symbol). Transcription result outputs to same directory as audio file. Format: '{topic-name}-transcript.md' (English) / '{主题名}-录音文字稿.md' (Chinese) / '{トピック名}-文字起こし.md' (Japanese). Examples: 'meeting-transcript.md' / '产品评审会议-录音文字稿.md' / '会議-文字起こし.md'""",
    )
    timeout: int = 60 * 60 * 3  # 长音频文件超时时间3小时


class AudioUnderstanding(WorkspaceTool[AudioUnderstandingParams]):
    """<!--zh: 使用音频理解将音频文件转换为文本。支持多种音频格式，包括 wav、mp3、mp4、ogg、m4a 等。-->
    Convert audio files to text using audio understanding. Supports multiple audio formats including wav, mp3, mp4, ogg, m4a, etc."""

    # Constants
    PLATFORM_TYPE_VOLCENGINE = "volcengine"
    HTTP_TIMEOUT = 30
    RETRYABLE_QUERY_HTTP_STATUSES = frozenset({408, 429, 500, 502, 503, 504})
    # ASR 已给出明确结论（拒绝音频，或完成但内容无效）的错误码；此时任务不会再被查询，临时上传可以删除。
    # 查询中断、鉴权失败、超时等结果未知的错误码不在其中，上传对象需保留以便继续查询该任务。
    DEFINITIVE_ASR_ERROR_CODES = frozenset({
        "ASR_ERROR",
        "FORMAT_NOT_SUPPORTED",
        "EMPTY_TRANSCRIPT",
        "NO_UTTERANCES",
        "EXTRACT_TEXT_FAILED",
        "SILENT_AUDIO",
        "INVALID_PARAMETERS",
        "EMPTY_AUDIO",
        "FILE_DOWNLOAD_FAILED",
        "SERVER_BUSY",
        "INTERNAL_SERVER_ERROR",
        "UNKNOWN_STATUS",
        "TASK_SUCCESS_NO_AUDIO_INFO",
    })
    # ISO BMFF（mp4 家族）扩展名，提交前做轻量完整性校验
    MP4_FAMILY_EXTS = {"mp4", "m4a", "m4v", "mov", "3gp", "3g2"}
    # 进度报告间隔：固定30秒，无论音频多长，保持用户体验一致
    # 频繁的进度更新可以减少用户等待时的焦虑感
    PROGRESS_REPORT_INTERVAL = 30

    def __init__(self, **kwargs):
        self.logger = logging.getLogger(__name__)
        super().__init__(**kwargs)
        self.config = Config()
        self.api_key = None
        self.api_base_url = None
        self.magic_service_config = None
        self._initialized = False
        self.audio_preparer = AudioPreparer()

    def _initialize_service(self):
        """延迟初始化服务，只在需要时进行"""
        if self._initialized:
            return

        try:
            self.api_key = self.config.get("audio_understanding.api_key")
            self.api_base_url = self.config.get("audio_understanding.api_base_url", "")

            if not self.api_key:
                raise ValueError("audio_understanding.api_key not configured in config.yaml")

            # Load magic service configuration
            self.magic_service_config = MagicServiceConfigLoader.load_with_fallback()
            self.logger.info("Successfully loaded Magic Service configuration")
            self._initialized = True
            self.logger.info("AudioUnderstanding工具服务初始化成功")

        except Exception as e:
            self.logger.warning(f"AudioUnderstanding工具服务初始化失败: {e}")
            raise

    def is_available(self) -> bool:
        """
        检查工具是否可用，验证所需配置是否存在

        Returns:
            bool: 工具是否可用
        """
        try:
            # 检查API key配置
            api_key = self.config.get("audio_understanding.api_key")
            if not api_key:
                return False

            # 尝试加载Magic Service配置
            try:
                MagicServiceConfigLoader.load_with_fallback()
                return True
            except Exception:
                return False

        except Exception as e:
            self.logger.warning(f"检查AudioUnderstanding工具可用性失败: {e}")
            return False

    async def _run(self, params: AudioUnderstandingParams, correlation_id: str) -> AudioRunResult:
        """
        将音频文件转换为文本

        Args:
            params: 包含 audio_path 和 transcript_filename 的 AudioUnderstandingParams
            correlation_id: 用于追踪整个工具调用的关联ID

        Returns:
            str: 转录的文本或错误消息
        """
        try:
            # 相对路径锚定到 workspace 根目录，绝对路径直接使用
            file_path = self.resolve_path(params.audio_path)
            audio_filename = file_path.name
            # 检查文件是否存在（异步执行以避免阻塞）
            file_exists = await async_exists(file_path)
            if not file_exists:
                raise AudioUnderstandingError(
                    i18n.translate("audio_understanding.file_not_found", category="tool.messages", file_path=params.audio_path),
                    "FILE_NOT_FOUND",
                )

            # 提交前轻量完整性校验：拦截因录制/上传中断导致的截断损坏文件，
            # 这类文件索引（moov）不完整，播放器和 ASR 都无法打开
            corruption_reason = await self._detect_corruption(file_path)
            if corruption_reason:
                self.logger.warning(f"Corrupted audio file detected ({audio_filename}): {corruption_reason}")
                raise AudioUnderstandingError(
                    i18n.translate(
                        "audio_understanding.file_corrupted",
                        category="tool.messages",
                        file_name=audio_filename,
                        reason=corruption_reason,
                    ),
                    "FILE_CORRUPTED",
                )

            # 获取真实音频时长（异步执行，不阻塞事件循环）
            audio_duration = await self._get_audio_duration(file_path)

            # 获取文件大小用于日志记录（异步执行以避免阻塞）
            file_stat = await async_stat(file_path)
            file_size_mb = file_stat.st_size / (1024 * 1024)  # 转换为 MB

            # 前置检查：判断是否需要拆分音频
            # 固定阈值：480MB 或 4.8小时
            max_size_mb = 480
            max_duration_hours = 4.8
            max_duration_seconds = max_duration_hours * 3600

            # Intentionally enforce the existing split policy against the user source,
            # before conversion. Changing this to the smaller prepared upload would alter
            # split_audio product behavior and is tracked as a separate decision.
            needs_split = file_size_mb > max_size_mb or (audio_duration and audio_duration > max_duration_seconds)

            if needs_split:
                # 格式化时长显示
                if audio_duration and audio_duration > 0:
                    hours = int(audio_duration // 3600)
                    minutes = int((audio_duration % 3600) // 60)
                    seconds = int(audio_duration % 60)
                    if hours > 0:
                        duration_str = f"{hours}小时{minutes}分钟{seconds}秒"
                    elif minutes > 0:
                        duration_str = f"{minutes}分钟{seconds}秒"
                    else:
                        duration_str = f"{seconds}秒"
                else:
                    duration_str = "未知"

                # 构建拆分建议提示
                split_suggestion = f"""⚠️ 音频文件过大，建议先拆分后再转录

📊 当前文件信息：
- 文件名：{audio_filename}
- 文件大小：{file_size_mb:.2f}MB (阈值: {max_size_mb}MB)
- 时长：{duration_str} (阈值: {max_duration_hours}小时)

💡 处理建议：
音频文件大小超过 {max_size_mb}MB 或时长超过 {max_duration_hours}小时，建议使用 split_audio 工具先拆分成多个小文件，然后分别转录各个片段。

🎯 操作步骤：
1. 使用 split_audio 工具拆分音频文件：
   - audio_path: '{params.audio_path}'

2. 拆分完成后，对每个拆分的音频文件分别使用 audio_understanding 进行转录

这样可以提高转录成功率，避免因文件过大导致的超时或失败问题。"""

                raise AudioUnderstandingError(
                    split_suggestion,
                    "FILE_TOO_LARGE"
                )

            # 估算转录处理时长（注意：这是处理时间，不是音频播放时长）
            # BUG FIX: 检查 audio_duration 不仅要 not None，还要 > 0
            # 因为某些情况下可能返回 0.0（如元数据损坏），这会导致估算时长为 0
            if audio_duration is not None and audio_duration > 0:
                # 根据经验：转录处理时间约为音频时长的 1/10
                # 例如：1小时音频大约需要6分钟处理
                estimated_transcription_duration = audio_duration / 10.0
                self.logger.info(
                    f"Audio file size: {file_size_mb:.2f}MB, audio duration: {audio_duration:.1f}s ({audio_duration / 60:.1f} minutes), estimated transcription time: {estimated_transcription_duration:.1f}s ({estimated_transcription_duration / 60:.1f} minutes)"
                )
            else:
                # 回退方案：基于文件大小估算转录处理时间
                # 经验值：40MB 音频文件需要约 180 秒完成转录
                estimated_transcription_duration = (file_size_mb / 40.0) * 180.0
                self.logger.info(
                    f"Audio file size: {file_size_mb:.2f}MB, estimated transcription time (fallback based on file size): {estimated_transcription_duration:.1f}s ({estimated_transcription_duration / 60:.1f} minutes)"
                )

            # 存储以供轮询使用
            self._file_size_mb = file_size_mb
            self._audio_duration = audio_duration  # 保存音频播放时长（用于日志）
            self._estimated_transcription_duration = (
                estimated_transcription_duration  # 保存估算的转录处理时长（用于进度计算）
            )

            format_preparation_enabled = bool(
                self.config.get("audio_understanding.format_preparation_enabled", True)
            )
            duration_validation_enabled = bool(
                self.config.get("audio_understanding.duration_validation_enabled", True)
            )
            # Disabling preparation restores the original "submit the source as-is" path,
            # so the canonical fallback must be off too, otherwise a validation failure
            # would still transcode behind the kill switch.
            fallback_enabled = format_preparation_enabled and bool(
                self.config.get("audio_understanding.canonical_fallback_enabled", True)
            )
            max_fallback_attempts = min(
                1,
                max(0, int(self.config.get("audio_understanding.max_fallback_attempts", 1))),
            )

            forced_mode = None if format_preparation_enabled else AudioPreparationMode.PRESERVE
            fallback_used = False
            final_result: TranscriptionResult | None = None
            final_trim: TimelineTrim | None = None
            final_mode: AudioPreparationMode | None = None

            for attempt in range(1, 2 + max_fallback_attempts):
                try:
                    async with self.audio_preparer.prepare_audio(file_path, forced_mode) as prepared:
                        self._log_prepared_audio(prepared, attempt)
                        try:
                            result = await self._transcribe_prepared_audio(
                                prepared,
                                params.timeout,
                                correlation_id,
                            )
                        except AudioUnderstandingError as exc:
                            retryable_upstream_error = exc.error_code == "FORMAT_NOT_SUPPORTED"
                            retry_possible = (
                                retryable_upstream_error
                                and fallback_enabled
                                and attempt == 1
                                and max_fallback_attempts > 0
                                and prepared.mode is not AudioPreparationMode.CANONICAL
                            )
                            if not retry_possible:
                                raise
                            self.logger.warning(
                                "ASR rejected prepared format; retrying canonical: attempt=%s mode=%s error_code=%s",
                                attempt,
                                prepared.mode.value,
                                exc.error_code,
                            )
                            forced_mode = AudioPreparationMode.CANONICAL
                            fallback_used = True
                            continue

                        if duration_validation_enabled:
                            try:
                                validate_transcription_result(prepared, result)
                            except TranscriptionValidationError as exc:
                                retry_possible = (
                                    fallback_enabled
                                    and attempt == 1
                                    and max_fallback_attempts > 0
                                    and prepared.mode is not AudioPreparationMode.CANONICAL
                                )
                                self.logger.warning(
                                    "Transcription declared duration validation failed: "
                                    "attempt=%s mode=%s retry=%s reason=%s",
                                    attempt,
                                    prepared.mode.value,
                                    retry_possible,
                                    exc,
                                )
                                if not retry_possible:
                                    raise AudioUnderstandingError(
                                        i18n.translate(
                                            "audio_understanding.result_mismatch",
                                            category="tool.messages",
                                        ),
                                        "TRANSCRIPTION_RESULT_MISMATCH",
                                    ) from exc
                                forced_mode = AudioPreparationMode.CANONICAL
                                fallback_used = True
                                continue

                        utterances = result.utterances or []
                        retained, trim = trim_out_of_range_utterances(prepared, utterances)
                        if not retained:
                            raise AudioUnderstandingError(
                                i18n.translate(
                                    "audio_understanding.no_valid_utterance",
                                    category="tool.messages",
                                ),
                                "TRANSCRIPTION_EMPTY_AFTER_TRIM",
                            )

                        final_result = self._replace_result_utterances(result, retained)
                        final_trim = trim
                        final_mode = prepared.mode
                        self._audio_duration = prepared.reference_duration_seconds
                        self.logger.info(
                            "Transcription timeline normalized: dropped_utterance_count=%s "
                            "dropped_span_seconds=%.3f retained_end_seconds=%.3f",
                            trim.dropped_count,
                            trim.dropped_span_seconds,
                            trim.retained_end_seconds,
                        )
                        break
                except (AudioProbeError, AudioPreparationError) as exc:
                    self.logger.error("Audio preparation failed: %s", exc)
                    raise AudioUnderstandingError(
                        i18n.translate(
                            "audio_understanding.format_preparation_failed",
                            category="tool.messages",
                        ),
                        "AUDIO_PREPARATION_FAILED",
                    ) from exc

            if final_result is None or final_trim is None or final_mode is None:
                raise AudioUnderstandingError(
                    i18n.translate("audio_understanding.result_mismatch", category="tool.messages"),
                    "TRANSCRIPTION_RESULT_MISMATCH",
                )

            # 转录文件输出到音频文件所在目录（使用已解析的绝对路径，避免依赖进程 CWD）
            transcript_full_path = file_path.parent / params.transcript_filename

            # 确保目录存在
            await async_mkdir(transcript_full_path.parent, parents=True, exist_ok=True)

            # 将转录文本写入到与音频文件相同目录下的转录文件
            await async_write_text(transcript_full_path, final_result.text)
            await self._dispatch_transcription_progress_event(final_result.task_id or "", 0, 0, 100, correlation_id, "completed")

            self.logger.info(
                i18n.translate("audio_understanding.transcription_success", category="tool.messages", content=str(transcript_full_path))
            )
            return AudioRunResult(
                transcript_path=transcript_full_path,
                trim=final_trim,
                preparation_mode=final_mode,
                fallback_used=fallback_used,
            )

        except AudioUnderstandingError:
            # 重新抛出自定义异常
            raise
        except Exception as e:
            raise AudioUnderstandingError(
                i18n.translate("audio_understanding.transcription_error", category="tool.messages", error=f"Audio transcription processing failed - {e!s}",
                ),
                "GENERAL_ERROR",
            )

    def _log_prepared_audio(self, prepared: PreparedAudio, attempt: int) -> None:
        self.logger.info(
            "Audio prepared: audio_prepare_mode=%s policy_version=2026-09-20-v1 "
            "source_container=%s source_codec=%s source_sample_rate=%s source_channels=%s "
            "source_bits_per_sample=%s source_duration_seconds=%.3f upload_container=%s "
            "upload_codec=%s upload_sample_rate=%s upload_channels=%s upload_bits_per_sample=%s "
            "upload_is_temporary=%s upload_duration_seconds=%.3f attempt=%s",
            prepared.mode.value,
            prepared.source.container,
            prepared.source.codec,
            prepared.source.sample_rate,
            prepared.source.channels,
            prepared.source.bits_per_sample,
            prepared.source.duration_seconds,
            prepared.upload.container,
            prepared.upload.codec,
            prepared.upload.sample_rate,
            prepared.upload.channels,
            prepared.upload.bits_per_sample,
            prepared.temporary,
            prepared.upload.duration_seconds,
            attempt,
        )

    def _replace_result_utterances(
        self,
        result: TranscriptionResult,
        utterances: list[dict],
    ) -> TranscriptionResult:
        formatted_result = ["## 📝 Dialogue Content", ""]
        formatted_result.extend(self._format_utterances_to_lines(utterances))
        last_utterance = max(utterances, key=utterance_end_ms)
        return TranscriptionResult(
            text="\n".join(formatted_result),
            task_id=result.task_id,
            api_declared_duration_ms=result.api_declared_duration_ms,
            last_utterance_end_ms=utterance_end_ms(last_utterance),
            last_utterance_end_source=(
                "utterance_duration" if "duration" in last_utterance else "start_time_only"
            ),
            utterances=utterances,
        )

    async def _resolve_upload_url(self, prepared: PreparedAudio) -> tuple[str, dict | None]:
        file_service = FileService()
        if not prepared.temporary:
            try:
                url = await file_service.get_workspace_file_url(prepared.upload_path, expires_in=7200)
            except WorkspaceFileURLError as exc:
                raise AudioUnderstandingError(
                    i18n.translate(
                        "audio_understanding.transcription_error",
                        category="tool.messages",
                        error=str(exc),
                    ),
                    "S3_KEY_NOT_FOUND",
                ) from exc
            except FileNotFoundError as exc:
                raise AudioUnderstandingError(
                    i18n.translate(
                        "audio_understanding.file_not_found",
                        category="tool.messages",
                        file_path=str(prepared.upload_path),
                    ),
                    "FILE_NOT_FOUND",
                ) from exc
            return url, None

        upload = await file_service.upload_local_file(
            str(prepared.upload_path),
            expires_in=7200,
            options={"max_size_bytes": MAX_UPLOAD_BYTES},
        )
        return upload["temporary_url"], upload

    async def _transcribe_prepared_audio(
        self,
        prepared: PreparedAudio,
        timeout: int,
        correlation_id: str,
    ) -> TranscriptionResult:
        upload_record: dict | None = None
        file_service = FileService()
        can_cleanup_upload = True
        try:
            file_url, upload_record = await self._resolve_upload_url(prepared)
            try:
                audio_format = CONTAINER_TO_API_FORMAT[prepared.upload.container]
            except KeyError as exc:
                raise AudioUnderstandingError(
                    i18n.translate(
                        "audio_understanding.format_not_supported",
                        category="tool.messages",
                        format=prepared.upload.container,
                    ),
                    "FORMAT_NOT_SUPPORTED",
                ) from exc

            can_cleanup_upload = False
            task_id = await self._submit_transcription_task(file_url, audio_format)
            if not task_id:
                raise AudioUnderstandingError(
                    i18n.translate(
                        "audio_understanding.transcription_error",
                        category="tool.messages",
                        error="Submit audio transcription task failed",
                    ),
                    "TASK_SUBMISSION_FAILED",
                )
            result = await self._poll_transcription_result(task_id, timeout, correlation_id)
            can_cleanup_upload = True
            return result
        except AudioUnderstandingError as exc:
            # 明确拒绝或已完成但内容无效时可清理；传输中断、鉴权阻塞查询、取消等均保留。
            if exc.error_code in self.DEFINITIVE_ASR_ERROR_CODES:
                can_cleanup_upload = True
            raise
        finally:
            if upload_record and not can_cleanup_upload:
                self.logger.warning("Retained temporary ASR upload because task outcome is unknown: object_key=%s",
                                    upload_record.get("object_key", ""))
            if upload_record and can_cleanup_upload:
                try:
                    await file_service.delete_uploaded_object(
                        upload_record.get("object_key", ""),
                        upload_record.get("platform"),
                    )
                except Exception as exc:
                    self.logger.error(
                        "Failed to delete temporary ASR upload object: object_key=%s error=%s",
                        upload_record.get("object_key", ""),
                        exc,
                    )

    def _build_api_headers(self) -> Dict[str, str]:
        """使用 Magic 元数据构建 API 请求头，遵循 generate_image.py 的模式"""
        # 构建默认请求头
        headers = {"Content-Type": "application/json", "api-key": self.api_key}

        # 添加 Magic-Authorization 与 User-Authorization
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        # 如果 MetadataUtil 已初始化，添加 Magic 元数据请求头
        if MetadataUtil.is_initialized():
            # 将 task_id 添加到请求头
            task_id = MetadataUtil.get_metadata().get("super_magic_task_id")
            if task_id:
                headers["Magic-Task-Id"] = task_id

            # 将 topic_id 添加到请求头
            topic_id = MetadataUtil.get_metadata().get("topic_id")
            if topic_id:
                headers["Magic-Topic-Id"] = topic_id

            # 将 chat_topic_id 添加到请求头
            chat_topic_id = MetadataUtil.get_metadata().get("chat_topic_id")
            if chat_topic_id:
                headers["Magic-Chat-Topic-Id"] = chat_topic_id

            # 将 language 添加到请求头
            language = MetadataUtil.get_metadata().get("language")
            if language:
                headers["Magic-Language"] = language

        # 只记录请求头名称和凭据长度，不记录凭据内容。
        self.logger.info("Built ASR API headers: names=%s", sorted(headers))
        MetadataUtil.log_authorization_header_diagnostics(headers, "audio_request")
        return headers

    def _asr_interruption_event(self) -> asyncio.Event | None:
        # 工具上下文只在 execute 期间存在；脱离 execute 直接调用时没有中断信号可等待。
        context = getattr(self, "_current_tool_context", None)
        agent_context = context.get_extension("agent_context") if context is not None else None
        return agent_context.get_interruption_event() if agent_context is not None else None

    def _log_asr_event(self, level: str, event: str, **fields: object) -> None:
        metadata = MetadataUtil.get_metadata() if MetadataUtil.is_initialized() else {}
        context = getattr(self, "_current_tool_context", None)
        values = {
            "magic_task_id": metadata.get("super_magic_task_id"),
            "topic_id": metadata.get("topic_id"),
            "tool_call_id": context.tool_call_id if context is not None else None,
            "correlation_id": getattr(self, "_current_correlation_id", None),
            **fields,
        }
        # 统一日志入口保证诊断事件进入项目日志；不依赖标准 logging 的默认 WARNING 级别。
        get_logger(__name__).opt(depth=1).log(
            level, "{} {}", event, json.dumps(values, ensure_ascii=False)
        )

    def _asr_error_detail(self, error: Exception) -> str:
        detail = re.sub(r"https?://[^\s\"'<>]+", "<redacted-url>", repr(error))
        if self.api_key:
            detail = detail.replace(self.api_key, "<redacted-api-key>")
        return detail

    async def _query_transcription_task(
        self,
        client: httpx.AsyncClient,
        task_id: str,
        headers: dict[str, str],
        deadline: float,
        poll_count: int,
        consecutive_failures: int,
        max_failures: int,
    ) -> httpx.Response:
        loop = asyncio.get_running_loop()
        started = loop.time()
        remaining = deadline - started
        if remaining <= 0:
            raise TimeoutError("Transcription polling deadline reached")
        fields = {
            "asr_request_id": task_id,
            "request_path": f"/speech/large-model/query/{task_id}",
            "query_attempt": poll_count,
            "consecutive_failures": consecutive_failures,
            "max_consecutive_failures": max_failures,
            "http_timeout_seconds": self.HTTP_TIMEOUT,
            "remaining_seconds": round(remaining, 3),
        }
        self._log_asr_event("INFO", "audio.asr.query.start", **fields)
        try:
            # HTTPX 限制各网络阶段；外层期限限制本次请求总时长，且中断会取消在途请求。
            async with asyncio.timeout(remaining):
                response = await await_with_interruption(
                    client.post(
                        f"{self.api_base_url}/speech/large-model/query/{task_id}?type={self.PLATFORM_TYPE_VOLCENGINE}",
                        headers=headers,
                        json={},
                        timeout=self.HTTP_TIMEOUT,
                    ),
                    self._asr_interruption_event(),
                )
            self._log_asr_event(
                "INFO", "audio.asr.query.response", **fields,
                elapsed_ms=round((loop.time() - started) * 1000, 1),
                http_status=response.status_code,
                upstream_status=response.headers.get("X-Volcengine-Status-Code", ""),
                upstream_log_id=response.headers.get("X-Volcengine-Log-Id", ""),
                gateway_request_id=response.headers.get("X-Request-ID", ""),
            )
            response.raise_for_status()
            return response
        except (httpx.HTTPError, TimeoutError) as error:
            self._log_asr_event(
                "WARNING", "audio.asr.query.failed", **fields,
                elapsed_ms=round((loop.time() - started) * 1000, 1),
                error_type=type(error).__name__,
                error_detail=self._asr_error_detail(error),
                error_traceback=traceback.format_tb(error.__traceback__),
            )
            raise

    # 提交失败的分类（决定能否清理临时上传、能否重新提交）：
    # | 失败形态                         | 错误码                                    | 含义                         |
    # | 服务返回 HTTP 错误               | AUTHENTICATION_FAILED / SUBMIT_HTTP_ERROR | 明确被拒绝，没有创建任务     |
    # | 状态头非成功或响应没有任务 ID    | TASK_SUBMISSION_FAILED                    | 明确被拒绝，没有创建任务     |
    # | 超时或网络中断                   | SUBMIT_RESULT_UNKNOWN                     | 远端可能已接受，不能自动重发 |
    # | 响应无法解析                     | SUBMIT_INVALID_RESPONSE                   | 响应格式异常，同样不能重发   |
    async def _submit_transcription_task(self, file_url: str, audio_format: str) -> str:
        """
        提交音频文件进行转录

        Args:
            file_url: 音频文件的预签名 URL
            audio_format: 音频格式（wav、mp3、ogg、m4a 等）

        Returns:
            str: 已接受的任务 ID；提交未完成时抛错，不自动重发。
        """
        started = asyncio.get_running_loop().time()
        try:
            url = f"{self.api_base_url}/speech/large-model/submit"
            headers = self._build_api_headers()

            payload = {
                "type": self.PLATFORM_TYPE_VOLCENGINE,
                "audio": {"url": file_url, "format": audio_format},
                "request": {"enable_speaker_info": True},
            }

            self._log_asr_event(
                "INFO", "audio.asr.submit.start", audio_format=audio_format,
                request_path="/speech/large-model/submit",
                http_timeout_seconds=self.HTTP_TIMEOUT,
            )
            async with httpx.AsyncClient() as client:
                # 提交超时不自动重试：远端可能已接受，重发会创建另一个收费任务。
                response = await await_with_interruption(
                    client.post(url, headers=headers, json=payload, timeout=self.HTTP_TIMEOUT),
                    self._asr_interruption_event(),
                )
                self._log_asr_event(
                    "INFO", "audio.asr.submit.response",
                    elapsed_ms=round((asyncio.get_running_loop().time() - started) * 1000, 1),
                    http_status=response.status_code,
                    upstream_status=response.headers.get("X-Volcengine-Status-Code", ""),
                    upstream_log_id=response.headers.get("X-Volcengine-Log-Id", ""),
                    gateway_request_id=response.headers.get("X-Request-ID", ""),
                )
                response.raise_for_status()

                result = response.json()
                # 网关可能在 HTTP 200 下带回 ASR 业务错误，同时仍返回 request_id；此时任务并未创建成功。
                status = response.headers.get("X-Volcengine-Status-Code", "")
                if status and status != "20000000":
                    raise AudioUnderstandingError(
                        f"Transcription submission rejected (ASR status {status}). No transcript was written.",
                        "TASK_SUBMISSION_FAILED",
                    )
                task_id = result.get("request_id")
                if not task_id:
                    raise AudioUnderstandingError(
                        "Transcription submission returned no task ID. No transcript was written.",
                        "TASK_SUBMISSION_FAILED",
                    )
                self._log_asr_event("INFO", "audio.asr.submit.accepted", asr_request_id=task_id)
                return str(task_id)

        except asyncio.CancelledError:
            self._log_asr_event("INFO", "audio.asr.submit.cancelled", remote_submission_state="unknown")
            raise
        except Exception as error:
            self._log_asr_event(
                "ERROR", "audio.asr.submit.failed",
                elapsed_ms=round((asyncio.get_running_loop().time() - started) * 1000, 1),
                error_type=type(error).__name__, error_detail=self._asr_error_detail(error),
                error_traceback=traceback.format_tb(error.__traceback__),
            )
            if isinstance(error, AudioUnderstandingError):
                raise
            if isinstance(error, httpx.HTTPStatusError):
                status_code = error.response.status_code
                raise AudioUnderstandingError(
                    f"Transcription submission failed (HTTP {status_code}). No transcript was written.",
                    "AUTHENTICATION_FAILED" if status_code in {401, 403} else "SUBMIT_HTTP_ERROR",
                ) from error
            if isinstance(error, (httpx.RequestError, TimeoutError)):
                # 提交可能已被接收；重发会创建重复计费任务。只对已有 ID 的查询做重试。
                raise AudioUnderstandingError(
                    f"Unable to confirm transcription submission ({type(error).__name__}). The service may have "
                    "accepted it, but no task ID was received. Do not automatically submit the audio again. "
                    "No transcript was written.",
                    "SUBMIT_RESULT_UNKNOWN",
                ) from error
            raise AudioUnderstandingError(
                f"Invalid transcription submission response ({type(error).__name__}). "
                "Remote acceptance is unconfirmed; resubmitting may create a duplicate task. "
                "No transcript was written.",
                "SUBMIT_INVALID_RESPONSE",
            ) from error

    # 查询失败的处理（所有错误都携带 task_id：任务可能仍在处理，应查询该任务而不是重新提交音频）：
    # | 失败形态                                  | 处理                                     | 错误码                |
    # | 超时、网络中断、502/503 等临时 HTTP 状态  | 同一任务继续查询，连续失败达到上限才结束 | QUERY_RESULT_UNKNOWN  |
    # | 401/403                                   | 不重试                                   | AUTHENTICATION_FAILED |
    # | 其它 HTTP 状态（如 404）                  | 不重试                                   | QUERY_HTTP_ERROR      |
    # | 其它请求错误（如协议不受支持）            | 不重试                                   | QUERY_REQUEST_FAILED  |
    # 完成进度（100%）不在这里发送：只有文字稿写入成功后，由 _run 统一发送。
    async def _poll_transcription_result(self, task_id: str, timeout: int, correlation_id: str) -> TranscriptionResult:
        """
        轮询转录结果

        Args:
            task_id: 提交后返回的任务 ID
            timeout: 最大等待时间（秒）

        Returns:
            TranscriptionResult: 转录结果，包含文本和音频时长
        """
        loop = asyncio.get_running_loop()
        start_time = loop.time()
        deadline = start_time + timeout
        poll_count = 0
        consecutive_failures = 0
        max_failures = max(1, int(self.config.get("audio_understanding.max_consecutive_query_failures", 5)))
        last_percentage = 1  # 跟踪上次报告的百分比
        # 使用固定的进度报告间隔（30秒）
        progress_interval = self.PROGRESS_REPORT_INTERVAL
        headers = self._build_api_headers()
        try:
            async with asyncio.timeout_at(deadline):
                async with httpx.AsyncClient() as client:
                    # 发送初始进度事件
                    await await_with_interruption(
                        self._dispatch_transcription_progress_event(task_id, 0, 0, 1, correlation_id),
                        self._asr_interruption_event(),
                    )
                    while True:
                        # 休眠替代 sleep(0) 空转；查询、重试和用户中断共享同一个整体期限。
                        await await_with_interruption(
                            asyncio.sleep(progress_interval), self._asr_interruption_event()
                        )
                        elapsed_seconds = int(loop.time() - start_time)
                        poll_count += 1
                        # 根据估算的转录处理时长计算进度百分比
                        if (
                            hasattr(self, "_estimated_transcription_duration")
                            and self._estimated_transcription_duration > 0
                        ):
                            # 使用已经过的时间与估算的转录处理时长的比例计算进度，最高到 80%
                            time_based_percentage = min(
                                int((elapsed_seconds / self._estimated_transcription_duration) * 80), 80
                            )
                            # 确保最小进度为 1%
                            time_based_percentage = max(time_based_percentage, 1)

                            # 80% 之后，每次进度事件增加 1%，最高 99%（经典做法：最后卡在99%）
                            if last_percentage >= 80:
                                percentage = min(last_percentage + 1, 99)
                            else:
                                # 确保进度只增不减
                                percentage = max(time_based_percentage, last_percentage)
                        else:
                            # 如果估算不可用，则回退到原始逻辑，但也限制在 99%
                            if last_percentage >= 80:
                                percentage = min(last_percentage + 1, 99)
                            else:
                                percentage = min(max(elapsed_seconds // progress_interval, 1), 80)
                                # 确保进度只增不减
                                percentage = max(percentage, last_percentage)

                        # 根据音频时长动态发送进度事件
                        await await_with_interruption(
                            self._dispatch_transcription_progress_event(
                                task_id, elapsed_seconds, poll_count, percentage, correlation_id
                            ),
                            self._asr_interruption_event(),
                        )
                        last_percentage = percentage  # 更新上次报告的百分比
                        try:
                            response = await self._query_transcription_task(
                                client, task_id, headers, deadline, poll_count,
                                consecutive_failures, max_failures,
                            )
                        except httpx.HTTPError as error:
                            http_status = (
                                error.response.status_code if isinstance(error, httpx.HTTPStatusError) else None
                            )
                            if http_status in {401, 403}:
                                raise AudioUnderstandingError(
                                    f"Transcription query was not authorized (HTTP {http_status}) for task {task_id}. "
                                    "The task may still be processing. No transcript was written. "
                                    "Query this task rather than resubmitting the audio.",
                                    "AUTHENTICATION_FAILED", task_id,
                                ) from error
                            retryable = isinstance(
                                error, (httpx.TimeoutException, httpx.NetworkError, httpx.RemoteProtocolError)
                            ) or http_status in self.RETRYABLE_QUERY_HTTP_STATUSES
                            consecutive_failures += 1
                            failure_label = f"HTTP {http_status}" if http_status is not None else type(error).__name__
                            if retryable and consecutive_failures < max_failures:
                                self._log_asr_event(
                                    "WARNING", "audio.asr.query.retry", asr_request_id=task_id,
                                    query_attempt=poll_count, consecutive_failures=consecutive_failures,
                                    max_consecutive_failures=max_failures,
                                    retry_delay_seconds=progress_interval,
                                    remaining_seconds=round(max(0, deadline - loop.time()), 3),
                                    error_type=type(error).__name__,
                                )
                                continue
                            # 查询失败不代表识别失败，远端任务可能仍在处理；不能暗示重发安全。
                            if retryable:
                                raise AudioUnderstandingError(
                                    f"Unable to confirm transcription result for task {task_id} "
                                    f"({failure_label}; consecutive failures: {consecutive_failures}). "
                                    "The task may still be processing. No transcript was written. "
                                    "Query this task rather than resubmitting the audio.",
                                    "QUERY_RESULT_UNKNOWN", task_id,
                                ) from error
                            if http_status is not None:
                                raise AudioUnderstandingError(
                                    f"Transcription query failed ({failure_label}) for task {task_id}. "
                                    "No transcript was written.",
                                    "QUERY_HTTP_ERROR", task_id,
                                ) from error
                            raise AudioUnderstandingError(
                                f"Transcription query failed ({failure_label}) for task {task_id}. "
                                "The task may still be processing. No transcript was written. "
                                "Query this task rather than resubmitting the audio.",
                                "QUERY_REQUEST_FAILED", task_id,
                            ) from error

                        # 从响应头获取状态信息
                        status_code = response.headers.get("X-Volcengine-Status-Code", "")
                        status_message = response.headers.get("X-Volcengine-Message", "")
                        result = response.json()
                        if consecutive_failures:
                            self._log_asr_event(
                                "INFO", "audio.asr.query.recovered", asr_request_id=task_id,
                                query_attempt=poll_count, recovered_failures=consecutive_failures,
                            )
                        consecutive_failures = 0

                        # 检查响应头中的状态码
                        if status_code == "20000000":  # 成功
                            # audio_info 不为空，表示任务已完成
                            if result.get("audio_info"):
                                # 提取转录文本和时长；内容校验通过后才算完成
                                transcription_result = self._extract_transcribed_text(result)
                                transcription_result.task_id = task_id
                                self._log_asr_event("INFO", "audio.asr.poll.completed", asr_request_id=task_id, query_attempt=poll_count)
                                return transcription_result
                            else:
                                self.logger.warning(
                                    f"Success status but no audio_info in response for task_id: {task_id}"
                                )
                                raise AudioUnderstandingError(
                                    "ASR reported completion without audio metadata. No transcript was written.",
                                    "TASK_SUCCESS_NO_AUDIO_INFO",
                                )

                        elif status_code == "20000001":  # 处理中
                            self.logger.info(
                                f"Transcription still processing for task_id: {task_id}, waiting {progress_interval} seconds..."
                            )
                            continue

                        elif status_code == "20000002":  # 队列中
                            self.logger.info(
                                f"Transcription task in queue for task_id: {task_id}, waiting {progress_interval} seconds..."
                            )
                            continue

                        elif status_code == "20000003":  # 静音音频
                            self.logger.warning(f"Silent audio detected for task_id: {task_id}")
                            raise AudioUnderstandingError(
                                "The audio contains no speech. Verify the source file before submitting again.",
                                "SILENT_AUDIO",
                            )

                        elif status_code == "45000001":  # 无效参数
                            self.logger.error(f"Invalid parameters for task_id: {task_id}")
                            raise AudioUnderstandingError(
                                f"ASR rejected the parameters: {status_message}",
                                "INVALID_PARAMETERS",
                            )

                        elif status_code == "45000002":  # 空音频
                            self.logger.error(f"Empty audio for task_id: {task_id}")
                            raise AudioUnderstandingError(
                                "ASR rejected an empty audio file.",
                                "EMPTY_AUDIO",
                            )

                        elif status_code == "45000151":  # 无效音频格式
                            self.logger.error(f"Invalid audio format for task_id: {task_id}")
                            raise AudioUnderstandingError(
                                "ASR rejected the audio format.",
                                "FORMAT_NOT_SUPPORTED",
                            )

                        elif status_code == "45000006":  # 文件无法下载
                            self.logger.error(f"file cannot download for task_id: {task_id}")
                            raise AudioUnderstandingError(
                                "ASR could not download the audio file.",
                                "FILE_DOWNLOAD_FAILED",
                            )

                        elif status_code.startswith("550"):  # 内部服务器错误
                            self.logger.error(
                                f"Internal server error for task_id: {task_id}, status_code: {status_code}"
                            )
                            if status_code == "55000031":
                                raise AudioUnderstandingError(
                                    "The ASR service reported that it is busy.",
                                    "SERVER_BUSY",
                                )
                            else:
                                raise AudioUnderstandingError(
                                    f"ASR reported an internal error ({status_code}): {status_message}",
                                    "INTERNAL_SERVER_ERROR",
                                )

                        else:
                            # 未知状态码，检查 audio_info 是否存在
                            if result.get("audio_info"):
                                # 提取转录文本和时长；内容校验通过后才算完成
                                transcription_result = self._extract_transcribed_text(result)
                                transcription_result.task_id = task_id
                                self._log_asr_event("INFO", "audio.asr.poll.completed", asr_request_id=task_id, query_attempt=poll_count)
                                return transcription_result
                            elif result.get("audio_info") == []:
                                # audio_info 为空数组，表示任务正在处理
                                self.logger.info(
                                    f"Transcription still processing for task_id: {task_id}, waiting {progress_interval} seconds..."
                                )
                                continue
                            else:
                                self.logger.warning(f"Unknown status code '{status_code}' for task_id: {task_id}")
                                raise AudioUnderstandingError(
                                    f"ASR returned an unknown status ({status_code}): {status_message}",
                                    "UNKNOWN_STATUS",
                                )

        except asyncio.CancelledError:
            self._log_asr_event("INFO", "audio.asr.poll.cancelled", asr_request_id=task_id, query_attempt=poll_count)
            raise
        except TimeoutError as error:
            self._log_asr_event(
                "ERROR", "audio.asr.poll.timeout", asr_request_id=task_id,
                query_attempt=poll_count, total_timeout_seconds=timeout,
                consecutive_failures=consecutive_failures,
            )
            raise AudioUnderstandingError(
                f"Timed out waiting for transcription task {task_id} after {timeout} seconds. "
                "The result is unknown; the task may still be processing. No transcript was written. "
                "Query this task rather than resubmitting the audio.",
                "QUERY_RESULT_UNKNOWN", task_id,
            ) from error
        except AudioUnderstandingError as error:
            error.task_id = error.task_id or task_id
            self._log_asr_event(
                "ERROR", "audio.asr.poll.failed", asr_request_id=task_id,
                query_attempt=poll_count, error_code=error.error_code,
            )
            raise
        except Exception as error:
            self._log_asr_event(
                "ERROR", "audio.asr.poll.failed", asr_request_id=task_id,
                query_attempt=poll_count, error_type=type(error).__name__,
                error_detail=self._asr_error_detail(error),
                error_traceback=traceback.format_tb(error.__traceback__),
            )
            raise AudioUnderstandingError(
                f"Could not read the result of submitted ASR task {task_id} ({type(error).__name__}). "
                "Its transcription outcome is unconfirmed; do not assume that submitting it again is safe.",
                "QUERY_EXCEPTION", task_id,
            ) from error

    def _extract_transcribed_text(self, data: Dict[str, Any]) -> TranscriptionResult:
        """
        Extract transcribed text from API response data and format to Markdown (no Front Matter)
        Also extract audio duration from API response for accurate metadata

        Args:
            data: Response data from API

        Returns:
            TranscriptionResult: 转录结果，包含文本和音频时长（毫秒）
        """
        try:
            utterances = None
            duration_values: list[int] = []

            def collect_duration(value: object) -> None:
                try:
                    parsed = int(value)  # type: ignore[arg-type]
                except (TypeError, ValueError):
                    return
                if parsed > 0:
                    duration_values.append(parsed)

            # Try to extract utterances and duration from audio_info field (new format)
            if "audio_info" in data:
                audio_info = data["audio_info"]

                if isinstance(audio_info, list) and len(audio_info) > 0:
                    # audio_info is a list of audio segments
                    all_utterances = []

                    for segment in audio_info:
                        if isinstance(segment, dict):
                            collect_duration(segment.get("duration"))

                            if "utterances" in segment:
                                filtered = self._filter_utterances(segment["utterances"])
                                if isinstance(filtered, list):
                                    all_utterances.extend(filtered)
                                else:
                                    all_utterances.append(filtered)

                    if all_utterances:
                        utterances = all_utterances

                elif isinstance(audio_info, dict):
                    # audio_info is a single dictionary
                    if "duration" in audio_info:
                        collect_duration(audio_info.get("duration"))

                    if "utterances" in audio_info:
                        utterances = self._filter_utterances(audio_info["utterances"])

            # Fallback: check result field (old format)
            if utterances is None and "result" in data:
                result = data["result"]
                collect_result_durations = not duration_values

                if isinstance(result, dict):
                    # Extract duration from result if not found yet
                    if collect_result_durations and "duration" in result:
                        collect_duration(result.get("duration"))

                    if "utterances" in result:
                        utterances = self._filter_utterances(result["utterances"])

                elif isinstance(result, list):
                    # result is a list of items
                    all_utterances = []

                    for item in result:
                        if isinstance(item, dict):
                            if collect_result_durations:
                                collect_duration(item.get("duration"))

                            if "utterances" in item:
                                filtered = self._filter_utterances(item["utterances"])
                                if isinstance(filtered, list):
                                    all_utterances.extend(filtered)
                                else:
                                    all_utterances.append(filtered)

                    if all_utterances:
                        utterances = all_utterances

            # Format result in Markdown format (no Front Matter)
            if utterances:
                utterances = [item for item in utterances if isinstance(item, dict)]
            if utterances:
                formatted_result = []
                formatted_result.append("## 📝 Dialogue Content")
                formatted_result.append("")  # Empty line after title
                utterances_lines = self._format_utterances_to_lines(utterances)
                if not utterances_lines:
                    raise AudioUnderstandingError("Transcription returned no usable speech. No transcript was written.", "EMPTY_TRANSCRIPT")
                formatted_result.extend(utterances_lines)
                api_declared_duration_ms = sum(duration_values) if duration_values else None
                last_utterance = max(utterances, key=utterance_end_ms)
                last_utterance_end_ms = utterance_end_ms(last_utterance)
                last_utterance_end_source = (
                    "utterance_duration" if "duration" in last_utterance else "start_time_only"
                )
                if api_declared_duration_ms is not None:
                    self.logger.info(
                        "Extracted ASR declared duration: %sms; last utterance end: %sms (%s)",
                        api_declared_duration_ms,
                        last_utterance_end_ms,
                        last_utterance_end_source,
                    )
                return TranscriptionResult(
                    text="\n".join(formatted_result),
                    api_declared_duration_ms=api_declared_duration_ms,
                    last_utterance_end_ms=last_utterance_end_ms,
                    last_utterance_end_source=last_utterance_end_source,
                    utterances=utterances,
                )

            # No utterances found, return raw data for debugging
            self.logger.warning("ASR response contained no usable utterances")
            raise AudioUnderstandingError(
                i18n.translate("audio_understanding.task_success_no_audio_info", category="tool.messages"),
                "NO_UTTERANCES",
            )

        except AudioUnderstandingError:
            raise
        except Exception as e:
            self.logger.error(f"Error extracting transcribed text: {e}")
            raise AudioUnderstandingError(
                i18n.translate("audio_understanding.extract_text_error", category="tool.messages", error=str(e)),
                "EXTRACT_TEXT_FAILED",
            ) from e

    def _format_utterances_to_lines(self, utterances: Any) -> list:
        """
        Format utterances to Markdown lines: [MM:SS] Speaker-N:\ntext

        Args:
            utterances: Utterances data (list or dict)

        Returns:
            List of formatted utterance strings
        """
        lines = []

        if isinstance(utterances, list):
            for utterance in utterances:
                if isinstance(utterance, dict):
                    line = self._format_single_utterance(utterance)
                    if line:
                        lines.append(line)
        elif isinstance(utterances, dict):
            line = self._format_single_utterance(utterances)
            if line:
                lines.append(line)

        return lines

    def _format_single_utterance(self, utterance: dict) -> str:
        """
        Format single utterance to Markdown format: [MM:SS] Speaker-N:\ntext

        Args:
            utterance: Single utterance dictionary

        Returns:
            Formatted utterance string in Markdown format
        """
        try:
            # Extract speaker from additions or use default value
            speaker = "Unknown"
            if "additions" in utterance and isinstance(utterance["additions"], dict):
                speaker = "Speaker-" + utterance["additions"].get("speaker", "Unknown")
            elif "speaker" in utterance:
                speaker = "Speaker-" + utterance["speaker"]
            else:
                speaker = "Speaker-Unknown"

            start_time = utterance.get("start_time", 0)
            text = utterance.get("text", "")

            if not isinstance(text, str) or not text.strip():
                return ""

            # Convert milliseconds to MM:SS format
            time_str = self._milliseconds_to_mm_ss(start_time)

            # ⚠️ 【格式规范 - 三处同步】生成文字稿时的格式化
            # 格式：[MM:SS] Speaker-N:\n对话内容\n\n
            # 同步修改：analyze_audio_project._extract_transcript_segment()、index.html.parseTranscriptMarkdown()
            return f"[{time_str}] {speaker}:\n{text}\n"

        except Exception as e:
            self.logger.error(f"Error formatting utterance: {e}")
            return ""

    def _milliseconds_to_mm_ss(self, milliseconds: int) -> str:
        """
        将毫秒转换为 MM:SS 格式

        Args:
            milliseconds: 时间（毫秒）

        Returns:
            MM:SS 格式的时间字符串
        """
        try:
            total_seconds = milliseconds // 1000
            minutes = total_seconds // 60
            seconds = total_seconds % 60
            return f"{minutes:02d}:{seconds:02d}"
        except Exception as e:
            self.logger.error(f"Error converting time format: {e}")
            return "00:00"

    def _filter_utterances(self, utterances: Any) -> Any:
        """
        过滤话语以移除 words 字段并确保保留说话人信息

        Args:
            utterances: 话语数据（可以是列表或字典）

        Returns:
            不包含 words 字段但包含说话人信息的过滤后的话语
        """
        if isinstance(utterances, list):
            filtered_list = []
            for utterance in utterances:
                if isinstance(utterance, dict):
                    # 创建不包含 words 字段的副本
                    filtered_utterance = {k: v for k, v in utterance.items() if k != "words"}

                    # 如果存在，从 additions 提取说话人信息
                    if "additions" in filtered_utterance and isinstance(filtered_utterance["additions"], dict):
                        speaker = filtered_utterance["additions"].get("speaker")
                        if speaker:
                            filtered_utterance["speaker"] = speaker
                        # 保留原始 additions 作为备份
                        filtered_utterance["additions"] = filtered_utterance["additions"]

                    filtered_list.append(filtered_utterance)
                else:
                    filtered_list.append(utterance)
            return filtered_list
        elif isinstance(utterances, dict):
            # 创建不包含 words 字段的副本
            filtered_utterance = {k: v for k, v in utterances.items() if k != "words"}

            # 如果存在，从 additions 提取说话人信息
            if "additions" in filtered_utterance and isinstance(filtered_utterance["additions"], dict):
                speaker = filtered_utterance["additions"].get("speaker")
                if speaker:
                    filtered_utterance["speaker"] = speaker
                # 保留原始 additions 作为备份
                filtered_utterance["additions"] = filtered_utterance["additions"]

            return filtered_utterance
        else:
            return utterances

    async def _dispatch_transcription_progress_event(
        self,
        task_id: str,
        elapsed_seconds: int,
        poll_count: int,
        percentage: int = 1,
        correlation_id: str = "",
        status: str = "processing",
    ) -> None:
        """发送音频转录进度事件"""
        try:
            if hasattr(self, "_current_tool_context") and self._current_tool_context:
                agent_context = self._current_tool_context.get_extension("agent_context")

                if agent_context:
                    if status == "completed":
                        percentage = 100
                    elif status == "failed":
                        percentage = 0

                    # 进度消息直接使用百分比数字的字符串形式
                    # progress_message = str(percentage)
                    file_path = getattr(self, "_current_file_path", "")
                    audio_filename = Path(file_path).name if file_path else ""
                    # 构造进度参数 - 复用现有的参数字段来传递进度信息，增加百分比进度
                    progress_arguments = {
                        "name": "audio_understanding",
                        "correlation_id": correlation_id,
                        "file_name": audio_filename,
                        "action": i18n.translate("audio_understanding", category="tool.actions"),
                        "detail": {
                            "type": "text",
                            "data": {
                                "file_name": audio_filename,
                                "progress": percentage,
                                "message": i18n.translate("audio_understanding.transcription_progress_message", category="tool.messages", percentage=percentage),
                            },
                        },
                        "status": status,
                        # "file_path": getattr(self, '_current_file_path', ''),
                    }

                    # 添加日志 - 检查 correlation_id 的值
                    self.logger.info(
                        f"[进度事件] 准备发送进度事件，correlation_id: {correlation_id}, percentage: {percentage}%"
                    )

                    # 创建事件数据
                    event_data = PendingToolCallEventData(
                        tool_context=self._current_tool_context,
                        tool_name="audio_understanding",
                        arguments=progress_arguments,
                        tool_instance=self,
                        correlation_id=correlation_id,  # Set correlation_id to keep consistency with before/after events
                    )

                    # 添加日志 - 检查事件数据中的 correlation_id
                    self.logger.info(
                        f"[进度事件] PendingToolCallEventData 已创建，event_data.correlation_id: {event_data.correlation_id}"
                    )

                    agent_context.update_activity_time()

                    # 分发事件 - 会被现有的监听器处理并发送到客户端
                    await agent_context.dispatch_event(EventType.PENDING_TOOL_CALL, event_data)

                    self.logger.info(
                        f"已发送音频转录进度事件: 任务{task_id}, 已耗时{elapsed_seconds}秒, 进度{percentage}%, 轮询{poll_count}次"
                    )

        except Exception as e:
            self.logger.error(f"发送音频转录进度事件失败: {e}")

    async def _get_audio_duration(self, file_path: Path) -> Optional[float]:
        """
        Get accurate audio duration using ffprobe (fallback to mutagen if unavailable)

        Uses ffprobe as primary method because it's more reliable for:
        - VBR (Variable Bit Rate) encoded MP3 files
        - Files with incomplete or corrupted metadata
        - All audio formats (MP3, M4A, WAV, OGG, FLAC, etc.)

        Args:
            file_path: Path to audio file

        Returns:
            float: Duration in seconds, or None if all methods fail
        """
        # Method 1: Try ffprobe first (most reliable) - using async subprocess
        try:
            process = await asyncio.create_subprocess_exec(
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(file_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            try:
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10.0)

                if process.returncode == 0 and stdout:
                    duration = float(stdout.decode().strip())
                    if duration > 0:
                        self.logger.info(f"Audio duration (ffprobe): {duration:.1f}s ({duration / 60:.1f} minutes)")
                        return duration
                    else:
                        self.logger.warning(f"ffprobe returned invalid duration: {duration}, trying mutagen")
            except asyncio.TimeoutError:
                self.logger.warning("ffprobe timeout, trying mutagen fallback")
                try:
                    process.kill()
                    await process.wait()
                except Exception:
                    pass
        except FileNotFoundError:
            self.logger.warning("ffprobe not found, trying mutagen fallback")
        except Exception as e:
            self.logger.warning(f"ffprobe failed: {e}, trying mutagen fallback")

        # Method 2: Fallback to mutagen (run in thread pool to avoid blocking)
        try:

            def _read_mutagen():
                audio = MutagenFile(str(file_path))
                if audio is not None and hasattr(audio.info, "length"):
                    return audio.info.length
                return None

            duration = await asyncio.to_thread(_read_mutagen)

            if duration is not None and duration > 0:
                self.logger.info(f"Audio duration (mutagen): {duration:.1f}s ({duration / 60:.1f} minutes)")
                return duration
            elif duration is not None:
                self.logger.warning(f"Mutagen returned invalid duration: {duration}")
        except Exception as e:
            self.logger.warning(f"Mutagen failed: {e}")

        # All methods failed
        self.logger.warning(f"Could not get audio duration from file: {file_path}, will use file size estimation")
        return None

    async def _detect_corruption(self, file_path: Path) -> Optional[str]:
        """
        Lightweight integrity check for ISO BMFF containers (mp4/m4a/mov/3gp).

        Reads only box headers (no full decode) to detect a clearly truncated
        sample index: if the top-level moov box claims to extend beyond the
        actual file size, neither players nor ASR can parse it.

        Returns a short reason string when corruption is detected, otherwise
        None (including when the format is not ISO BMFF or the check itself
        fails, to avoid blocking otherwise valid files).
        """
        ext = file_path.suffix.lstrip(".").lower()
        if ext not in self.MP4_FAMILY_EXTS:
            return None

        try:
            return await asyncio.to_thread(self._scan_iso_boxes, file_path)
        except Exception as e:
            self.logger.warning(f"Corruption check failed for {file_path.name}: {e}")
            return None

    def _scan_iso_boxes(self, file_path: Path) -> Optional[str]:
        """
        Synchronously walk top-level ISO BMFF boxes and report truncation.

        Returns a reason string if the critical moov box overflows the file,
        otherwise None. Runs in a thread pool via ``_detect_corruption``.

        ISO BMFF variants such as 3gp/3g2 may carry compatibility, vendor, or
        tail-reserved boxes that this lightweight top-level scan does not fully
        understand. Treat non-moov overflows or malformed trailing boxes as
        inconclusive so healthy files are not blocked before the real decoder
        gets a chance to inspect them.
        """
        file_size = file_path.stat().st_size
        if file_size < 8:
            return f"file too small to be a valid audio container ({file_size} bytes)"

        with open(file_path, "rb") as f:
            pos = 0
            while pos + 8 <= file_size:
                f.seek(pos)
                header = f.read(8)
                if len(header) < 8:
                    return "unexpected end of file while reading box header"

                box_size = int.from_bytes(header[:4], "big")
                box_type = header[4:8].decode("ascii", "replace")
                header_len = 8

                if box_size == 1:
                    # 64-bit extended size follows the type
                    ext_bytes = f.read(8)
                    if len(ext_bytes) < 8:
                        return "truncated 64-bit box header"
                    box_size = int.from_bytes(ext_bytes, "big")
                    header_len = 16
                elif box_size == 0:
                    # Box extends to EOF by definition; nothing past it
                    break

                if box_size < header_len:
                    if box_type == "moov":
                        return f"invalid box size {box_size} for box '{box_type}'"
                    return None

                box_end = pos + box_size
                if box_end > file_size:
                    if box_type != "moov":
                        return None
                    missing = box_end - file_size
                    return (
                        f"box '{box_type}' claims to end at byte {box_end} but the file "
                        f"is only {file_size} bytes ({missing} bytes missing); the file "
                        f"is truncated and its audio index is incomplete"
                    )
                pos = box_end

        return None

    async def _get_recording_start_time(self, tool_context: ToolContext) -> str:
        """
        Get recording start time from ASR task

        Retrieves the recording start time from dynamic_config.asr_task_key,
        reading the created_at field as the recording start time.
        Returns "未知" if not available.

        Args:
            tool_context: Tool context

        Returns:
            str: Formatted start time string (YYYY-MM-DD HH:MM:SS) or "未知"
        """
        try:
            # Get asr_task_key from dynamic_config
            agent_context = tool_context.get_extension("agent_context")
            if not agent_context:
                self.logger.debug("No agent_context found in tool_context")
                return "未知"

            chat_message = agent_context.get_chat_client_message()
            if not chat_message or not chat_message.dynamic_config:
                self.logger.debug("No dynamic_config found in chat_message")
                return "未知"

            asr_task_key = chat_message.dynamic_config.get("asr_task_key")
            if not asr_task_key:
                self.logger.debug("No asr_task_key found in dynamic_config")
                return "未知"

            self.logger.debug(f"Found asr_task_key from dynamic_config: {asr_task_key}")

            # Get task info from ASR task manager
            task = await AsrMergeTaskManager.instance().get_task(asr_task_key)

            if task and task.created_at:
                # Use created_at as recording start time
                start_time = task.created_at.strftime("%Y-%m-%d %H:%M:%S")
                self.logger.info(f"Found recording start time from ASR task: {start_time} (task_key: {asr_task_key})")
                return start_time
            else:
                self.logger.debug(f"No task found for asr_task_key: {asr_task_key}")
                return "未知"

        except Exception as e:
            self.logger.warning(f"Failed to get recording start time: {e}")
            return "未知"

    async def execute(self, tool_context: ToolContext, params: AudioUnderstandingParams) -> ToolResult:
        """执行音频到文本的转换"""
        keep_alive_task = None
        try:
            # 延迟初始化服务
            self._initialize_service()

            # 保存当前工具上下文和文件路径，供事件分发使用
            self._current_tool_context = tool_context
            self._current_file_path = params.audio_path
            keep_alive_task = start_tool_keep_alive(tool_context)

            # 获取当前活跃的 tool_call correlation_id，确保 before/pending/after 事件使用同一个 ID
            correlation_manager = get_correlation_manager()
            scope_id = None
            try:
                from app.core.context.agent_context import AgentContext

                agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
                scope_id = agent_context.context_id
            except Exception:
                scope_id = None
            correlation_id = correlation_manager.get_active_correlation_id(EventPairType.TOOL_CALL, scope_id)

            self.logger.info(f"[_transcribe] 从 correlation_manager 获取的 correlation_id: {correlation_id}")

            # 如果没有活跃的 correlation_id（不应该发生，但作为备用），使用 tool_call_id
            if not correlation_id:
                correlation_id = tool_context.tool_call_id or str(uuid.uuid4())
                self.logger.warning(f"No active correlation_id found for TOOL_CALL, using fallback: {correlation_id}")

            # 保存 correlation_id 供 get_tool_detail 使用
            self._current_correlation_id = correlation_id
            self.logger.info(f"[_transcribe] 最终使用的 correlation_id: {correlation_id}")

            # 执行音频到文本的转换（传入 correlation_id）
            run_result = await self._run(params, correlation_id)

            # 构造完整的转录文件路径（直接从参数构造，不依赖字符串解析）
            audio_file_path = Path(params.audio_path)
            transcription_file_path = str(audio_file_path.parent / params.transcript_filename)

            # 获取音频元数据
            audio_duration = getattr(self, "_audio_duration", 0)
            file_size_mb = getattr(self, "_file_size_mb", 0)
            duration_seconds = int(audio_duration) if audio_duration else 0

            # 获取当前日期时间
            current_date = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

            # 获取录音开始时间
            start_time = await self._get_recording_start_time(tool_context)

            # 返回文件路径以便 LLM 可以读取
            trim_note = ""
            if run_result.trim.has_drop:
                trim_note = (
                    f"\nRemoved {run_result.trim.dropped_count} utterances whose timestamps exceeded "
                    f"the audio end; retained content ends at {run_result.trim.retained_end_seconds:.1f}s.\n"
                    "The tail of this recording may be incomplete; do not infer conclusions from a missing ending."
                )
            fallback_note = (
                "\nThe source was converted to the canonical ASR format after validation failed."
                if run_result.fallback_used
                else ""
            )
            return ToolResult(
                ok=True,
                content=(
                    f"Audio transcription completed. Transcript written to {transcription_file_path}. Audio duration {audio_duration:.1f}s."
                    f"{trim_note}{fallback_note}\n"
                    "Next: use setup_audio_project to create the audio project structure."
                ),
                extra_info={
                    "audio_path": params.audio_path,
                    "transcription_file_path": transcription_file_path,
                    "duration": duration_seconds,
                    "file_size_mb": file_size_mb,
                    "date": current_date,
                    "recording_start_time": start_time,
                    "audio_prepare_mode": run_result.preparation_mode.value,
                    "canonical_fallback_used": run_result.fallback_used,
                    "dropped_utterance_count": run_result.trim.dropped_count,
                    "dropped_span_seconds": run_result.trim.dropped_span_seconds,
                    "retained_end_seconds": run_result.trim.retained_end_seconds,
                },
            )

        except AudioUnderstandingError as e:
            self.logger.error("Audio transcription failed error_code=%s task_id=%s", e.error_code, e.task_id)
            await self._dispatch_transcription_progress_event(e.task_id or "", 0, 0, 0,
                                                              getattr(self, "_current_correlation_id", ""), "failed")
            return ToolResult(
                ok=False,
                content=(
                    f"Audio transcription failed (error code {e.error_code or 'UNKNOWN_ERROR'}).\n"
                    f"{e.message}"
                ),
                extra_info={
                    "error": e.message,
                    "error_code": e.error_code,
                    "asr_task_id": e.task_id,
                    "audio_path": params.audio_path,
                    "transcribed_text": "",
                },
            )
        except Exception as e:
            self.logger.error(f"Audio transcription failed: {e}")
            error_message = i18n.translate("audio_understanding.transcription_error", category="tool.messages", error=str(e))
            return ToolResult(
                ok=False,
                content=f"Audio transcription failed with an unexpected error.\n{error_message}",
                extra_info={"error": error_message, "error_code": "GENERAL_ERROR", "audio_path": params.audio_path, "transcribed_text": ""},
            )
        finally:
            stop_tool_keep_alive(keep_alive_task)
            # 清理上下文引用
            if hasattr(self, "_current_tool_context"):
                delattr(self, "_current_tool_context")
            if hasattr(self, "_current_file_path"):
                delattr(self, "_current_file_path")

    def _parse_transcription_result(self, result_text: str) -> Dict[str, Any]:
        """
        解析转录结果以提取结构化数据

        Args:
            result_text: 格式化的结果文本

        Returns:
            包含文本、附加信息和话语的字典
        """
        try:
            result_data = {}

            # 按部分拆分
            sections = result_text.split("\n")
            current_section = None
            current_content = []

            for line in sections:
                if line.startswith("转录文本："):
                    current_section = "text"
                    current_content = []
                elif line.startswith("附加信息："):
                    # 保存上一部分
                    if current_section == "text" and current_content:
                        result_data["text"] = "\n".join(current_content).strip()
                    current_section = "additions"
                    current_content = []
                elif line.startswith("话语信息："):
                    # 保存上一部分
                    if current_section == "additions" and current_content:
                        try:
                            result_data["additions"] = json.loads("\n".join(current_content))
                        except json.JSONDecodeError:
                            result_data["additions"] = current_content
                    current_section = "utterances"
                    current_content = []
                elif line.strip() and current_section:
                    current_content.append(line)

            # 保存最后一部分
            if current_section == "text" and current_content:
                result_data["text"] = "\n".join(current_content).strip()
            if current_section == "additions" and current_content:
                try:
                    result_data["additions"] = json.loads("\n".join(current_content))
                except json.JSONDecodeError:
                    result_data["additions"] = current_content
            elif current_section == "utterances" and current_content:
                try:
                    result_data["utterances"] = json.loads("\n".join(current_content))
                except json.JSONDecodeError:
                    result_data["utterances"] = current_content

                # 从话语中提取实际文本内容供 LLM 使用
                if result_data.get("utterances"):
                    utterances_text = []
                    if isinstance(result_data["utterances"], list):
                        for utterance in result_data["utterances"]:
                            if isinstance(utterance, str):
                                # 提取时间戳后的文本
                                if ": " in utterance:
                                    text_part = utterance.split(": ", 1)[1]
                                    utterances_text.append(text_part)
                                else:
                                    utterances_text.append(utterance)

                    # 将提取的文本设置为主要文本内容
                    if utterances_text:
                        result_data["text"] = " ".join(utterances_text)

            return result_data

        except Exception as e:
            self.logger.error(f"Error parsing transcription result: {e}")
            return {"text": result_text}

    def _get_failure_display_message(self, result: ToolResult) -> str:
        error_code = (result.extra_info or {}).get("error_code")
        if error_code in {
            "QUERY_RESULT_UNKNOWN",
            "SUBMIT_RESULT_UNKNOWN",
            "SUBMIT_INVALID_RESPONSE",
            "QUERY_REQUEST_FAILED",
            "QUERY_EXCEPTION",
        }:
            key = "audio_understanding.result_unknown"
        elif error_code == "AUTHENTICATION_FAILED":
            key = "audio_understanding.authentication_failed"
        else:
            key = "audio_understanding.failed_no_transcript"
        return i18n.translate(key, category="tool.messages")

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        """获取前端预览的工具详情"""
        if not result.ok:
            return ToolDetail(type=DisplayType.TEXT, data={"message": self._get_failure_display_message(result)})
        if not result.extra_info:
            return None

        try:
            # Extract metadata from extra_info
            audio_path = result.extra_info.get("audio_path", "")
            item = ToolDetailFactory.create_file_result_item(audio_path, self.base_dir, OperationResultStatus.SUCCESS)
            transcript = str(result.extra_info.get("transcription_file_path") or "")
            report = None
            if transcript:
                transcript_item = ToolDetailFactory.create_file_result_item(transcript, self.base_dir, OperationResultStatus.SUCCESS)
                if transcript_item.target:
                    report = ToolDetail(type=DisplayType.MD, data=FileContent(
                        file_name=Path(transcript).name, content="",
                        target_file_path=f"./{transcript_item.target.relative_file_path}",
                    ))
            return ToolDetailFactory.create_operation_result_detail([item], report=report, stage="analyze")
        except Exception as e:
            self.logger.error(f"生成工具详情失败: {e}")
            return None

    async def get_after_tool_call_friendly_content(
        self, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None
    ) -> str:
        """获取工具执行后的友好输出内容"""
        if not result.ok:
            return ""

        transcribed_text = str(result)
        if transcribed_text:
            # 如果文本太长，从50个字符串开始，截取前200个字符
            preview_text = transcribed_text[50:200] + "..." if len(transcribed_text) > 200 else transcribed_text
            return i18n.translate("audio_understanding.transcription_preview", category="tool.messages", preview=preview_text)

        return i18n.translate("audio_understanding.transcription_completed", category="tool.messages")

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        """获取工具执行后的友好动作和备注"""
        if not result.ok:
            return {
                "action": i18n.translate("audio_understanding", category="tool.actions"),
                "remark": self._get_failure_display_message(result),
            }

        if result.extra_info and result.extra_info.get("dropped_utterance_count", 0) > 0:
            return {
                "action": i18n.translate("audio_understanding", category="tool.actions"),
                "remark": i18n.translate(
                    "audio_understanding.timeline_trimmed",
                    category="tool.messages",
                    count=result.extra_info["dropped_utterance_count"],
                    retained_end=f"{result.extra_info.get('retained_end_seconds', 0):.1f}s",
                ),
            }

        if result.extra_info and result.extra_info.get("canonical_fallback_used"):
            return {
                "action": i18n.translate("audio_understanding", category="tool.actions"),
                "remark": i18n.translate(
                    "audio_understanding.canonical_fallback_succeeded",
                    category="tool.messages",
                ),
            }

        if not arguments:
            return {
                "action": i18n.translate("audio_understanding", category="tool.actions"),
                "remark": i18n.translate("audio_understanding.unknown_file", category="tool.messages"),
            }

        audio_path = arguments.get("audio_path", "")
        if audio_path:
            file_name = Path(audio_path).name
            return {
                "action": i18n.translate("audio_understanding", category="tool.actions"),
                "remark": i18n.translate("audio_understanding.processing_audio_file", category="tool.messages", file_name=file_name),
            }

        return {
            "action": i18n.translate("audio_understanding", category="tool.actions"),
            "remark": i18n.translate("audio_understanding.transcription_completed", category="tool.messages"),
        }
