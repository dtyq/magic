"""
ASR 音频合并服务时间配置

统一管理所有与时间相关的配置项，包括：
- 轮询间隔和超时
- 文件就绪检测配置
- FFmpeg 操作超时
- 各种等待和重试时间
- 任务清理时间
"""

import os


class AsrTimeConfig:
    """
    ASR 时间配置类

    所有时间单位均为秒（除非特别注明）
    """

    # ==================== 轮询监听配置 ====================

    # 轮询间隔：每次扫描音频文件目录的间隔时间
    POLL_INTERVAL: int = 5

    # 无新文件超时：如果超过此时间没有新文件，则退出轮询
    # 默认 600 秒（10分钟）
    NO_NEW_FILE_TIMEOUT: int = 600

    # 初始延迟：开始轮询前的初始延迟时间
    INITIAL_DELAY: float = 1.0

    # ==================== 文件就绪检测配置 ====================

    # 文件就绪检测最大重试次数（通用）
    FILE_READY_RETRIES: int = 10

    # 合并后文件的就绪检测重试次数（仅用于合并产物，如 merged.wav/最终输出）
    MERGED_FILE_READY_RETRIES: int = 30

    # 文件就绪检测初始间隔：每次检测文件状态之间的等待时间
    FILE_READY_WAIT_INTERVAL: float = 1.0

    # 文件就绪检测总超时时间：从开始检测到超时的总时间
    # 默认 30 秒
    FILE_READY_TIMEOUT: int = 30

    # 文件稳定性检查次数：文件大小需要连续稳定多少次才认为文件就绪
    FILE_STABLE_COUNT: int = 3

    # 文件就绪检测指数退避最大间隔：当文件不存在或为空时，使用指数退避
    # 最大等待时间不超过此值
    FILE_READY_MAX_BACKOFF_INTERVAL: float = 5.0

    # 文件就绪检测指数退避倍数：每次退避的倍数
    FILE_READY_BACKOFF_MULTIPLIER: float = 1

    # 不稳定文件超时扩展：每次检测到文件不稳定时，延长超时时间的秒数
    UNSTABLE_FILE_TIMEOUT_EXTENSION: int = 1

    # 不稳定文件允许的最大总超时时间（防止无限延长）
    # 默认 30 秒
    MAX_UNSTABLE_FILE_TIMEOUT: int = 30

    # ==================== FFmpeg 操作配置 ====================

    OGG_REENCODE_BITRATE: str = os.getenv("ASR_OGG_REENCODE_BITRATE", "32k")
    # finish 后等待分片可见/稳定的最长时间，WAV/Opus 统一使用。
    FINISH_SHARD_TIMEOUT_SECONDS: int = int(
        os.getenv("ASR_FINISH_SHARD_TIMEOUT_SECONDS", "300")
    )
    # 兼容已有调用方；新逻辑统一使用 FINISH_SHARD_TIMEOUT_SECONDS。
    OPUS_FINISH_DEADLINE_TIMEOUT: int = FINISH_SHARD_TIMEOUT_SECONDS
    FINISH_SHARD_POLL_INTERVAL_SECONDS: int = int(
        os.getenv("ASR_FINISH_SHARD_POLL_INTERVAL_SECONDS", "5")
    )
    FINISH_SHARD_STABLE_SCAN_COUNT: int = int(
        os.getenv("ASR_FINISH_SHARD_STABLE_SCAN_COUNT", "3")
    )
    # finish 超时后允许自动收敛的尾部分片最大缺失数（仅 WAV 增量合并路径使用；
    # Opus finish 路径的尾部缺片已统一走静音补齐，见下方 FINISH_MAX_MISSING_*）
    FINISH_MAX_TAIL_MISSING_SHARDS: int = int(
        os.getenv("ASR_FINISH_MAX_TAIL_MISSING_SHARDS", "3")
    )
    # Opus 缺片（中间/尾部/混合）只能在 finish 超时后用静音补齐。数量与比例同时受限，
    # 避免把严重丢包伪装成一次正常完成；单个缺片不受比例限制。
    # env 新名优先，旧的 *_MIDDLE_* 名称仅作兼容兜底。
    FINISH_MAX_MISSING_SHARDS: int = int(
        os.getenv(
            "ASR_FINISH_MAX_MISSING_SHARDS",
            os.getenv("ASR_FINISH_MAX_MIDDLE_MISSING_SHARDS", "3"),
        )
    )
    FINISH_MAX_MISSING_RATIO: float = float(
        os.getenv(
            "ASR_FINISH_MAX_MISSING_RATIO",
            os.getenv("ASR_FINISH_MAX_MIDDLE_MISSING_RATIO", "0.05"),
        )
    )
    OPUS_SHARD_SYNC_TIMEOUT: int = int(os.getenv("ASR_OPUS_SHARD_SYNC_TIMEOUT", "900"))
    OPUS_STAGING_UPLOAD_TIMEOUT: int = int(
        os.getenv("ASR_OPUS_STAGING_UPLOAD_TIMEOUT", "900")
    )
    OPUS_FINISH_FFMPEG_TIMEOUT: int = int(os.getenv("ASR_OPUS_FINISH_FFMPEG_TIMEOUT", "1800"))
    OPUS_SHARD_SYNC_CONCURRENCY: int = int(
        os.getenv("ASR_OPUS_SHARD_SYNC_CONCURRENCY", "32")
    )
    OPUS_SHARD_PROBE_CONCURRENCY: int = int(
        os.getenv("ASR_OPUS_SHARD_PROBE_CONCURRENCY", "8")
    )

    # FFmpeg 命令超时时间：执行 FFmpeg 合并命令的最大等待时间
    # 默认 300 秒（5分钟）
    FFMPEG_TIMEOUT: int = 300

    # ==================== 文件同步配置 ====================

    # 批量同步重试次数：批量同步文件时的最大重试次数
    BATCH_SYNC_RETRIES: int = 3

    # 批量同步指数退避初始等待时间：重试时的初始等待时间（秒）
    BATCH_SYNC_INITIAL_BACKOFF: float = 0.5

    # 批量同步指数退避倍数：每次重试的等待时间倍数
    BATCH_SYNC_BACKOFF_MULTIPLIER: float = 1

    # 单个文件同步重试次数：同步单个文件时的最大重试次数
    SINGLE_FILE_SYNC_RETRIES: int = 10

    # ==================== 音频时长获取配置 ====================

    # ffprobe 超时时间：使用 ffprobe 获取音频时长的超时时间
    FFPROBE_TIMEOUT: int = 10

    # ==================== 笔记/流式文件处理配置 ====================

    # 笔记文件等待超时：等待笔记文件就绪的超时时间（默认值）
    NOTE_FILE_TIMEOUT: int = 10

    # 流式文件等待超时：等待流式识别文件就绪的超时时间（默认值）
    TRANSCRIPT_FILE_TIMEOUT: int = 10

    # 完成任务时文件等待超时：完成任务时处理笔记/流式文件的等待超时时间
    # 设为 0 表示不等待，如果文件不存在或不可用则直接跳过
    FINALIZE_FILE_WAIT_TIMEOUT: int = 2

    # ==================== 源目录清理配置 ====================

    # 源目录清理超时时间：清理源目录时，如果目录不为空，等待文件被移除的最大时间
    SOURCE_DIR_CLEANUP_TIMEOUT: int = 10

    # 源目录清理轮询间隔：检查源目录是否为空的间隔时间
    SOURCE_DIR_CLEANUP_POLL_INTERVAL: float = 1

    # ==================== 重试等待配置 ====================

    # 操作重试等待时间：文件重命名、合并操作、文件替换等操作失败后重试前的等待时间
    # 默认 1.0 秒
    OPERATION_RETRY_WAIT: float = 1.0

    # ==================== 任务清理配置 ====================

    # 默认清理时间（小时）：清理旧任务状态文件的默认保存时间
    # 默认 24 小时
    DEFAULT_CLEANUP_AGE_HOURS: int = 24


# 全局配置实例
asr_time_config = AsrTimeConfig()
