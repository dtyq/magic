"""
ASR 合并服务工具函数

包含 FFmpeg 检查、路径解析等辅助功能
"""

import shutil
from pathlib import Path

from loguru import logger

from app.paths import PathManager


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
