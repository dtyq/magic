"""
ASR 合并服务工具函数

包含 FFmpeg 检查、路径解析等辅助功能
"""

import shutil
from pathlib import Path

from loguru import logger

from app.path_manager import PathManager

# 默认音频格式：历史任务均为 wav，作为未知格式的回退值
DEFAULT_AUDIO_FORMAT = "wav"

# 支持的音频分片格式（任务内格式同质：一个任务从首片到末片只用一种格式）
SUPPORTED_AUDIO_FORMATS = ("wav", "opus")


def normalize_audio_format(audio_format: str | None) -> str:
    """
    归一化音频格式，空值或不支持的格式回退为 wav（兼容历史任务）

    Args:
        audio_format: 原始格式字符串（可带点、大小写不敏感、可为 None）

    Returns:
        str: 归一化后的格式（wav / opus）
    """
    fmt = (audio_format or "").strip().lower().lstrip(".")
    return fmt if fmt in SUPPORTED_AUDIO_FORMATS else DEFAULT_AUDIO_FORMAT


def validate_audio_format_for_write(audio_format: str | None) -> str:
    """Validate a format before pinning it to a newly observed task.

    Read paths may use :func:`normalize_audio_format` for legacy states.  A
    write path must not silently turn a bad client value into WAV because that
    can pin a task to the wrong merge/checkpoint format.
    """
    fmt = (audio_format or "").strip().lower().lstrip(".")
    if not fmt:
        raise ValueError("Audio format is required")
    if fmt not in SUPPORTED_AUDIO_FORMATS:
        raise ValueError(f"Unsupported audio format: {audio_format}")
    return fmt


def build_merged_filename(audio_format: str | None) -> str:
    """
    按任务音频格式构建 merged 文件名（merged.wav / merged.opus）

    Args:
        audio_format: 任务音频格式，None 时回退 wav（兼容历史检查点）

    Returns:
        str: merged 文件名
    """
    return f"merged.{normalize_audio_format(audio_format)}"


def resolve_audio_format_from_directory(source_dir: Path, state_format: str | None) -> str | None:
    """Resolve a task format without hiding conflicting merged artifacts."""
    merged_wav = source_dir / "merged.wav"
    merged_opus = source_dir / "merged.opus"
    wav_exists = merged_wav.exists()
    opus_exists = merged_opus.exists()
    if wav_exists and opus_exists:
        raise ValueError("Conflicting merged audio files: merged.wav and merged.opus")

    if state_format is not None:
        resolved_state = validate_audio_format_for_write(state_format)
        if (resolved_state == "wav" and opus_exists) or (resolved_state == "opus" and wav_exists):
            raise ValueError(
                f"Task format {resolved_state} conflicts with existing merged file "
                f"{('merged.opus' if opus_exists else 'merged.wav')}"
            )
        return resolved_state

    if opus_exists:
        return "opus"
    if wav_exists:
        return "wav"
    return None


def check_ffmpeg_installed() -> bool:
    """
    检查系统是否安装了 ffmpeg

    Returns:
        bool: 如果 ffmpeg 可用返回 True
    """
    return shutil.which("ffmpeg") is not None


def log_ffmpeg_warning():
    """记录 ffmpeg 未安装的警告"""
    logger.warning("[asrmerge] " + "=" * 60)
    logger.warning("[asrmerge] ⚠️  FFmpeg 未安装！")
    logger.warning("[asrmerge] ASR 音频合并服务需要 ffmpeg 才能正常工作")
    logger.warning("[asrmerge] ")
    logger.warning("[asrmerge] 安装方法：")
    logger.warning("[asrmerge]   macOS:        brew install ffmpeg")
    logger.warning("[asrmerge]   Ubuntu/Debian: sudo apt-get install -y ffmpeg")
    logger.warning("[asrmerge]   CentOS/RHEL:   sudo yum install -y ffmpeg")
    logger.warning("[asrmerge] ")
    logger.warning("[asrmerge] 详细信息请查看: SYSTEM_DEPENDENCIES.md")
    logger.warning("[asrmerge] " + "=" * 60)


def resolve_path(source_dir: str, workspace_dir: str = ".workspace") -> Path:
    """
    解析路径

    Args:
        source_dir: 源目录（相对于 workspace_dir）
        workspace_dir: 工作区根目录（相对于项目根目录），默认为 .workspace

    Returns:
        Path: 解析后的完整路径

    Example:
        >>> resolve_path("recordings/task_001")
        Path("/project/.workspace/recordings/task_001")
        >>> resolve_path("task_xxx", workspace_dir=".")
        Path("/project/task_xxx")
        >>> resolve_path("data/audio", workspace_dir="/tmp")
        Path("/tmp/data/audio")
    """
    project_root = PathManager.get_project_root()

    # 如果 workspace_dir 是绝对路径，直接使用
    if workspace_dir.startswith("/"):
        workspace_path = Path(workspace_dir)
    else:
        # workspace_dir 相对于项目根目录
        workspace_path = project_root / workspace_dir

    # source_dir 相对于 workspace_path
    resolved = workspace_path / source_dir

    logger.debug(f"[asrmerge] 路径解析: source_dir='{source_dir}', workspace_dir='{workspace_dir}' -> {resolved}")

    return resolved


def ensure_output_dir(file_path: Path) -> None:
    """
    确保输出文件的目录存在（同步）

    mkdir 操作通常非常快（微秒级），保持同步以确保：
    1. 目录立即对后续操作可见
    2. 代码意图更清晰
    3. 避免理论上的跨线程缓存问题

    Args:
        file_path: 文件路径
    """
    file_path.parent.mkdir(parents=True, exist_ok=True)


def build_merged_file_tags(task_key: str, has_binary_appended: bool) -> dict:
    """
    构建 merged 文件的元数据标签

    用于标记文件是否包含二进制拼接，避免服务重启后丢失状态

    Args:
        task_key: 任务唯一标识
        has_binary_appended: 是否有二进制追加

    Returns:
        dict: 元数据标签字典
    """
    tags = {
        "comment": f"super_magic_asr_task={task_key}",
    }

    if has_binary_appended:
        tags["description"] = "super_magic_binary_appended=true"

    return tags
