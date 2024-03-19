"""
ASR 监听任务状态模型

封装单个 ASR 监听任务的所有状态信息
"""

import asyncio
import time
from pathlib import Path
from typing import Optional

from loguru import logger

from app.service.asr.asr_base import AsrServiceBase


class AsrMonitoringTask(AsrServiceBase):
    """封装单个ASR监听任务的所有状态"""

    def __init__(self, task_key: str, source_dir: Path):
        """
        初始化监听任务

        Args:
            task_key: 任务唯一标识
            source_dir: 音频分片所在目录
        """
        self.task_key = task_key
        self.source_dir = source_dir

        # 任务运行状态
        self.asyncio_task: Optional[asyncio.Task] = None

        # 时间追踪
        self.start_time = time.time()

        logger.debug(f"{self.LOG_PREFIX} 📦 创建监听任务对象: {task_key}")

    def get_elapsed_seconds(self) -> float:
        """获取任务运行时间（秒）"""
        return time.time() - self.start_time
