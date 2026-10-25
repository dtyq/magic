"""ASR 音频合并服务模块。

WAV 使用录音期间增量合并；Opus 使用 finish 后独立全量合并。
"""

from app.service.asr.asr_context_diff_service import AsrContextDiffService
from app.service.asr.asr_file_detector import AsrFileDetector
from app.service.asr.asr_merge_service import AsrMergeService
from app.service.asr.asr_merge_task_manager import (
    AsrMergeTaskManager,
    AsrTaskResult,
    AsrTaskStatus,
    TaskProgress,
)
from app.service.asr.asr_monitoring_task import AsrMonitoringTask
from app.service.asr.asr_opus_finish_processor import AsrOpusFinishProcessor
from app.service.asr.asr_opus_merge_operations import AsrOpusMergeOperations
from app.service.asr.asr_task_finalizer import AsrTaskFinalizer
from app.service.asr.asr_utils import (
    build_merged_file_tags,
    check_ffmpeg_installed,
    ensure_output_dir,
    log_ffmpeg_warning,
    resolve_path,
)
from app.service.asr.asr_wav_merge_operations import AsrWavMergeOperations

__all__ = [
    "AsrContextDiffService",
    "AsrFileDetector",
    "AsrMergeService",
    "AsrMergeTaskManager",
    "AsrMonitoringTask",
    "AsrOpusFinishProcessor",
    "AsrOpusMergeOperations",
    "AsrTaskFinalizer",
    "AsrTaskResult",
    "AsrTaskStatus",
    "AsrWavMergeOperations",
    "TaskProgress",
    "build_merged_file_tags",
    "check_ffmpeg_installed",
    "ensure_output_dir",
    "log_ffmpeg_warning",
    "resolve_path",
]
