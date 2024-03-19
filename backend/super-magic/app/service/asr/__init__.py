"""
ASR 音频合并服务模块 - 简化版

只支持 WAV 格式的全量式合并
"""

from app.service.asr.asr_context_diff_service import AsrContextDiffService
from app.service.asr.asr_file_detector import AsrFileDetector
from app.service.asr.asr_merge_operations import AsrMergeOperations
from app.service.asr.asr_merge_service import AsrMergeService
from app.service.asr.asr_task_finalizer import AsrTaskFinalizer
from app.service.asr.asr_merge_task_manager import (
    AsrMergeTaskManager,
    AsrTaskStatus,
    AsrTaskResult,
    TaskProgress,
)
from app.service.asr.asr_monitoring_task import AsrMonitoringTask
from app.service.asr.asr_utils import (
    build_merged_file_tags,
    check_ffmpeg_installed,
    ensure_output_dir,
    log_ffmpeg_warning,
    resolve_path,
)

__all__ = [
    # 核心服务
    "AsrMergeService",
    "AsrContextDiffService",
    # 任务管理
    "AsrMergeTaskManager",
    "AsrTaskStatus",
    "AsrTaskResult",
    "TaskProgress",
    # 子服务
    "AsrMergeOperations",
    "AsrTaskFinalizer",
    # 工具类
    "AsrFileDetector",
    "AsrMonitoringTask",
    # 工具函数
    "check_ffmpeg_installed",
    "log_ffmpeg_warning",
    "resolve_path",
    "ensure_output_dir",
    "build_merged_file_tags",
]
