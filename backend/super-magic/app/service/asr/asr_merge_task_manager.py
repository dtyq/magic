"""
ASR 音频合并任务管理器

负责管理ASR音频合并任务的状态和结果存储
以内存为主、文件为兜底；仅在内存缺失时从文件恢复
"""

import asyncio
from functools import lru_cache
import json
import os
import threading
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Callable, Optional, TypeVar, Union
from uuid import uuid4
from loguru import logger
from pydantic import BaseModel, ConfigDict, Field

from app.path_manager import PathManager
from app.service.asr.asr_time_config import asr_time_config
from app.service.asr.asr_base import AsrServiceBase, ReadJsonOptions


T = TypeVar("T")


class AsrTaskStatus(str, Enum):
    """ASR任务状态枚举"""

    WAITING = "waiting"
    RUNNING = "running"
    FINALIZING = "finalizing"  # 正在执行最终合并
    COMPLETED = "completed"  # 任务完成
    FINISHED = "finished"  # 保留用于向后兼容
    CANCELED = "canceled"  # 任务已取消
    ERROR = "error"


class AsrTaskResult(BaseModel):
    """ASR任务结果模型"""

    model_config = ConfigDict(use_enum_values=True)

    task_key: str
    status: AsrTaskStatus
    source_dir: str
    target_dir: Optional[str] = None  # 创建时可选，完成时必填
    intelligent_title: Optional[str] = None  # 智能标题，完成时必填
    file_path: Optional[str] = None  # 音频文件路径（向后兼容）
    duration: Optional[float] = None  # 音频时长（秒，保留小数）
    file_size: Optional[int] = None  # 文件大小（字节）
    error_message: Optional[str] = None
    # 文件详情（JSON 格式存储）
    files: Optional[dict] = None  # 包含 audio_file 和 note_file 的详情
    renamed_directory: Optional[str] = None  # 重命名后的目录名
    deleted_files: Optional[list] = None  # 被删除的文件列表
    operations: Optional[dict] = None  # 操作结果汇总
    # 文件配置信息（用于沙箱根据 task_key 定位文件）
    note_file_config: Optional[dict] = None  # 笔记文件配置（在 start 阶段存储）
    transcript_file_config: Optional[dict] = None  # 流式识别文件配置（在 start 阶段存储）
    created_at: datetime
    updated_at: datetime


class TaskProgress(BaseModel):
    """任务进度信息模型 - 简化版"""

    max_processed_index: int = -1  # 最大文件索引
    file_count: int = 0  # 当前文件数量
    upload_completed: bool = False  # 用户是否告知上传完成（通过 finish 接口）
    file_shard_count: int = -1  # 客户端声明/服务端兜底的分片总数（首次 finish 固定基线）
    upload_completed_at: Optional[float] = None  # 首次 finish 时间戳（unix seconds）
    completion_deadline_at: Optional[float] = None  # 完成等待截止时间（unix seconds）
    start_time: float = Field(default_factory=lambda: datetime.now().timestamp())
    retry_count: int = 0  # 整体任务重试次数（由 finish 触发），最大允许次数由服务端控制


class TaskState(BaseModel):
    """完整任务状态模型"""

    task: AsrTaskResult
    progress: TaskProgress


class AsrMergeTaskManager(AsrServiceBase):
    """
    ASR音频合并任务管理器 - 以内存为主、文件兜底

    文件同步机制：
    - 使用进程内锁保护读写与 RMW，避免并发更新导致不一致
    - 适用于单进程/单实例的高频读取、低频写入场景
    """

    # 常量定义
    STATE_FILE_SUFFIX = ".json"
    TEMP_FILE_PREFIX = "."
    TEMP_FILE_SUFFIX = ".tmp"
    MAX_TASK_RETRIES = 10  # 最大允许重试整个任务次数（由 finish 触发）

    def __init__(self):
        """初始化任务管理器"""
        logger.info(f"{AsrMergeTaskManager.LOG_PREFIX} 🎯 ASR任务管理器初始化 - 使用文件系统存储模式")
        self._state_cache: dict[str, TaskState] = {}
        self._cache_lock = threading.RLock()
        self._io_lock = threading.RLock()

    def _get_cached_state(self, task_key: str) -> Optional[TaskState]:
        """从内存缓存读取任务状态"""
        with self._cache_lock:
            return self._state_cache.get(task_key)

    def _set_cached_state(self, task_key: str, state: TaskState) -> None:
        """写入任务状态到内存缓存"""
        with self._cache_lock:
            self._state_cache[task_key] = state

    def _invalidate_cached_state(self, task_key: str) -> None:
        """清理内存缓存的任务状态"""
        with self._cache_lock:
            self._state_cache.pop(task_key, None)

    def _read_json_with_retry_sync(self, file_path: Path, label: str, use_lock: bool = True) -> Optional[dict]:
        """
        同步读取 JSON 文件（稳定性等待 + 解析重试）

        Args:
            file_path: 文件路径
            label: 日志标识
            use_lock: 是否在读取文本时加锁（默认 True）

        Returns:
            dict: 解析结果，失败返回 None
        """

        def _read_text() -> str:
            if use_lock:
                with self._io_lock:
                    if not file_path.exists():
                        raise FileNotFoundError
                    return file_path.read_text(encoding="utf-8")
            if not file_path.exists():
                raise FileNotFoundError
            return file_path.read_text(encoding="utf-8")

        options = ReadJsonOptions(
            min_size=1,
            retries=asr_time_config.FILE_READY_RETRIES,
            wait_interval=asr_time_config.FILE_READY_WAIT_INTERVAL,
        )
        return self.read_json_with_retry_sync(
            file_path,
            label,
            options=options,
            read_text_func=_read_text,
        )

    @staticmethod
    def _atomic_write(target_file: Path, data: dict) -> None:
        """
        原子性写入 JSON 文件（使用临时文件+原子替换）

        Args:
            target_file: 目标文件路径
            data: 要写入的数据

        Raises:
            IOError: 文件写入失败时抛出
            OSError: 文件操作失败时抛出
        """
        temp_file = target_file.parent / (
            f"{AsrMergeTaskManager.TEMP_FILE_PREFIX}"
            f"{target_file.name}_{uuid4().hex}{AsrMergeTaskManager.TEMP_FILE_SUFFIX}"
        )

        try:
            # 写入临时文件
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())

            # 原子替换
            os.replace(str(temp_file), str(target_file))

        except (IOError, OSError) as e:
            # 清理临时文件
            if temp_file.exists():
                try:
                    temp_file.unlink()
                except OSError:
                    pass
            raise IOError(f"原子写入失败: {e}") from e

    @staticmethod
    def get_state_file_path(task_key: str) -> Path:
        """
        根据 task_key 获取状态文件路径（公共方法，供外部查询使用）

        Args:
            task_key: 任务唯一标识

        Returns:
            Path: 状态文件路径
        """
        states_dir = PathManager.get_asr_states_dir()
        return states_dir / f"{task_key}{AsrMergeTaskManager.STATE_FILE_SUFFIX}"

    async def _read_state_file(self, state_file: Path) -> Optional[dict]:
        """
        读取状态文件（进程内锁 + 稳定性等待）

        Args:
            state_file: 状态文件路径

        Returns:
            dict: 状态数据，失败返回 None
        """
        data = await asyncio.to_thread(self._read_json_with_retry_sync, state_file, "状态文件")
        if data is not None:
            logger.debug(f"📖 {AsrMergeTaskManager.LOG_PREFIX} 读取状态文件: {state_file.name}")
        return data

    async def _write_state_file(self, state_file: Path, data: dict) -> bool:
        """
        写入状态文件（进程内锁，原子性写入）

        Args:
            state_file: 状态文件路径
            data: 要写入的状态数据

        Returns:
            bool: 是否写入成功
        """

        def _sync_write():
            try:
                # 确保目录存在
                state_file.parent.mkdir(parents=True, exist_ok=True)

                with self._io_lock:
                    AsrMergeTaskManager._atomic_write(state_file, data)
                logger.debug(f"💾 {AsrMergeTaskManager.LOG_PREFIX} 更新状态文件: {state_file.name}")
                return True

            except (IOError, OSError) as e:
                logger.error(f"❌ {AsrMergeTaskManager.LOG_PREFIX} 写入状态文件失败: {e}")
                return False

        return await asyncio.to_thread(_sync_write)

    async def _atomic_update_state(
        self, task_key: str, updater: Callable[[TaskState], TaskState], error_msg: str = "原子更新失败"
    ) -> bool:
        """
        原子性更新任务状态（通用模板方法）

        使用进程内锁保护整个 read-modify-write 过程

        Args:
            task_key: 任务标识符
            updater: 状态更新函数，接收旧状态返回新状态（可以抛出 ValueError 表示业务逻辑错误）
            error_msg: 错误消息前缀

        Returns:
            bool: 内存更新是否成功（落盘失败会告警但不影响内存）

        Raises:
            ValueError: 业务逻辑验证失败（由 updater 抛出）
        """

        def _atomic_update():
            try:
                state_file = self.get_state_file_path(task_key)
                # 使用进程内锁保护整个 RMW 过程
                with self._io_lock:
                    cached_state = self._get_cached_state(task_key)
                    if cached_state:
                        state = cached_state.model_copy(deep=True)
                    else:
                        # 读取（仅在内存缺失时）
                        if not state_file.exists():
                            logger.error(f"❌ {AsrMergeTaskManager.LOG_PREFIX} {error_msg}: 任务不存在 {task_key}")
                            return False

                        state_dict = self._read_json_with_retry_sync(state_file, "状态文件", use_lock=False)
                        if not state_dict:
                            logger.error(f"❌ {AsrMergeTaskManager.LOG_PREFIX} {error_msg}: 状态文件不可读 {task_key}")
                            return False
                        state = TaskState(**state_dict)

                    # 修改（调用用户提供的更新函数）
                    # ValueError 会被传播出去，由调用者处理
                    new_state = updater(state)

                    # 先更新内存，再同步落盘
                    self._set_cached_state(task_key, new_state)
                    try:
                        self._atomic_write(state_file, new_state.model_dump(mode="json"))
                    except (IOError, OSError) as e:
                        logger.warning(
                            f"⚠️ {AsrMergeTaskManager.LOG_PREFIX} {error_msg}: 状态落盘失败，仅保留内存 {task_key}: {e}"
                        )
                    return True

            except FileNotFoundError:
                logger.error(f"❌ {AsrMergeTaskManager.LOG_PREFIX} {error_msg}: 文件不存在 {task_key}")
                return False
            except json.JSONDecodeError as e:
                logger.error(f"❌ {AsrMergeTaskManager.LOG_PREFIX} {error_msg}: JSON解析失败 {task_key}: {e}")
                return False
            except (IOError, OSError) as e:
                logger.error(f"❌ {AsrMergeTaskManager.LOG_PREFIX} {error_msg}: IO错误 {task_key}: {e}")
                return False
            except ValueError:
                # 业务逻辑验证失败（由 updater 抛出），向上传播
                raise

        return await asyncio.to_thread(_atomic_update)

    @staticmethod
    def _create_task_result(
        task_key: str,
        source_dir: str,
        status: AsrTaskStatus,
        note_file_config: Optional[dict] = None,
        transcript_file_config: Optional[dict] = None,
    ) -> AsrTaskResult:
        """
        创建任务结果对象（提取重复代码）

        Args:
            task_key: 任务标识符
            source_dir: 音频分片所在目录
            status: 任务状态
            note_file_config: 笔记文件配置（可选）
            transcript_file_config: 流式识别文件配置（可选）

        Returns:
            AsrTaskResult: 任务结果对象
        """
        now = datetime.now()
        return AsrTaskResult(
            task_key=task_key,
            status=status,
            source_dir=source_dir,
            target_dir=None,
            intelligent_title=None,
            file_path=None,
            duration=None,
            file_size=None,
            error_message=None,
            files=None,
            renamed_directory=None,
            deleted_files=None,
            operations=None,
            note_file_config=note_file_config,
            transcript_file_config=transcript_file_config,
            created_at=now,
            updated_at=now,
        )

    @staticmethod
    def _build_task_state(task_result: AsrTaskResult) -> TaskState:
        """构建完整任务状态对象（统一入口）"""
        return TaskState(task=task_result, progress=TaskProgress())

    @staticmethod
    def _apply_state_updates(
        state: TaskState,
        task_updates: Optional[dict] = None,
        progress_updates: Optional[dict] = None,
        touch_updated_at: bool = True,
    ) -> TaskState:
        """统一更新 task/progress 字段，避免重复的 model_copy"""
        final_task_updates = dict(task_updates or {})
        if touch_updated_at:
            final_task_updates["updated_at"] = datetime.now()

        if final_task_updates:
            state.task = state.task.model_copy(update=final_task_updates)

        if progress_updates:
            state.progress = state.progress.model_copy(update=progress_updates)

        return state

    async def _read_task_state(self, task_key: str) -> Optional[TaskState]:
        """
        读取完整任务状态（返回对象模型）

        Args:
            task_key: 任务标识符

        Returns:
            TaskState: 状态对象，包含 task 和 progress，失败返回 None
        """
        cached_state = self._get_cached_state(task_key)
        if cached_state:
            logger.debug(f"📦 {AsrMergeTaskManager.LOG_PREFIX} 内存命中任务状态: {task_key}")
            return cached_state

        state_file = self.get_state_file_path(task_key)
        state_dict = await self._read_state_file(state_file)

        if not state_dict:
            return None

        try:
            # Pydantic 会自动处理 ISO 字符串到 datetime 的转换
            state = TaskState(**state_dict)
            self._set_cached_state(task_key, state)
            return state
        except (TypeError, ValueError) as e:
            logger.error(f"❌ {AsrMergeTaskManager.LOG_PREFIX} 解析任务状态失败 {task_key}: {e}")
            return None

    async def _write_task_state(self, task_key: str, state: TaskState) -> bool:
        """
        写入完整任务状态

        Args:
            task_key: 任务标识符
            state: 任务状态对象

        Returns:
            bool: 内存更新是否成功（落盘失败会告警但不影响内存）
        """
        state_file = self.get_state_file_path(task_key)

        # 转换为字典（pydantic 会自动处理序列化）
        state_dict = state.model_dump(mode="json")

        # 先更新内存，再同步落盘
        self._set_cached_state(task_key, state)
        write_ok = await self._write_state_file(state_file, state_dict)
        if not write_ok:
            logger.warning(f"⚠️ {AsrMergeTaskManager.LOG_PREFIX} 状态落盘失败，仅保留内存: {task_key}")
        return True

    async def _update_task_field(self, task_key: str, **fields) -> bool:
        """
        更新任务的特定字段（原子性操作）

        使用进程内锁保护整个 read-modify-write 过程，防止并发更新导致的 Lost Update 问题

        Args:
            task_key: 任务标识符
            **fields: 要更新的字段

        Returns:
            bool: 是否更新成功
        """

        def updater(state: TaskState) -> TaskState:
            """更新任务字段"""
            return self._apply_state_updates(state, task_updates=fields)

        return await self._atomic_update_state(task_key, updater, "更新任务字段失败")

    async def create_task(
        self,
        task_key: str,
        source_dir: str,
        note_file_config: Optional[dict] = None,
        transcript_file_config: Optional[dict] = None,
    ) -> AsrTaskResult:
        """
        创建新的ASR合并任务

        Args:
            task_key: 任务标识符
            source_dir: 音频分片所在目录
            note_file_config: 笔记文件配置（可选），用于沙箱根据 task_key 定位文件
            transcript_file_config: 流式识别文件配置（可选），用于沙箱根据 task_key 定位文件

        Returns:
            AsrTaskResult: 任务结果对象
        """
        # 检查任务是否已存在
        existing = await self.get_task(task_key)
        if existing:
            logger.info(f"✅ {AsrMergeTaskManager.LOG_PREFIX} 创建ASR合并任务(已存在): {task_key}")
            return existing

        # 创建任务对象（使用提取的方法）
        task_result = self._create_task_result(
            task_key=task_key,
            source_dir=source_dir,
            status=AsrTaskStatus.WAITING,
            note_file_config=note_file_config,
            transcript_file_config=transcript_file_config,
        )

        # 创建完整状态对象
        state = self._build_task_state(task_result)

        # 写入内存并尝试落盘
        success = await self._write_task_state(task_key, state)
        if not success:
            raise IOError(f"写入状态文件失败: {task_key}")

        logger.info(f"✅ {AsrMergeTaskManager.LOG_PREFIX} 创建ASR合并任务: {task_key}")
        return task_result

    async def get_or_create_task(
        self,
        task_key: str,
        source_dir: str,
        note_file_config: Optional[dict] = None,
        transcript_file_config: Optional[dict] = None,
    ) -> tuple[AsrTaskResult, bool]:
        """
        原子性地获取或创建任务（解决 TOCTOU 竞态条件）

        使用进程内锁保护整个 check-then-create 过程，确保并发安全

        Args:
            task_key: 任务标识符
            source_dir: 音频分片所在目录
            note_file_config: 笔记文件配置（可选）
            transcript_file_config: 流式识别文件配置（可选）

        Returns:
            tuple[AsrTaskResult, bool]: (任务对象, 是否新创建)

        Raises:
            IOError: 文件操作失败时抛出
        """
        cached_state = self._get_cached_state(task_key)
        if cached_state:
            logger.debug(f"📦 {AsrMergeTaskManager.LOG_PREFIX} 内存命中任务: {task_key}")
            return cached_state.task, False

        def _atomic_get_or_create():
            try:
                state_file = self.get_state_file_path(task_key)
                # 使用进程内锁保护整个 check-then-create 过程
                with self._io_lock:
                    # 1. 检查是否存在
                    if state_file.exists():
                        state_dict = self._read_json_with_retry_sync(state_file, "状态文件", use_lock=False)
                        if not state_dict:
                            raise IOError(f"状态文件不可读: {task_key}")
                        state = TaskState(**state_dict)
                        self._set_cached_state(task_key, state)
                        logger.info(f"✅ {AsrMergeTaskManager.LOG_PREFIX} 任务已存在(原子检查): {task_key}")
                        return state.task, False

                    # 2. 不存在则创建（使用提取的方法）
                    task_result = AsrMergeTaskManager._create_task_result(
                        task_key=task_key,
                        source_dir=source_dir,
                        status=AsrTaskStatus.WAITING,
                        note_file_config=note_file_config,
                        transcript_file_config=transcript_file_config,
                    )

                    state = self._build_task_state(task_result)

                    # 3. 原子写入
                    state_file.parent.mkdir(parents=True, exist_ok=True)
                    # 先更新内存，再同步落盘
                    self._set_cached_state(task_key, state)
                    try:
                        self._atomic_write(state_file, state.model_dump(mode="json"))
                    except (IOError, OSError) as e:
                        logger.warning(
                            f"⚠️ {AsrMergeTaskManager.LOG_PREFIX} 创建任务落盘失败，仅保留内存 {task_key}: {e}"
                        )

                    logger.info(f"✅ {AsrMergeTaskManager.LOG_PREFIX} 创建ASR合并任务(原子操作): {task_key}")
                    return task_result, True

            except json.JSONDecodeError as e:
                logger.error(f"❌ {AsrMergeTaskManager.LOG_PREFIX} JSON解析失败 {task_key}: {e}")
                raise IOError(f"JSON解析失败: {e}") from e
            except (IOError, OSError) as e:
                logger.error(f"❌ {AsrMergeTaskManager.LOG_PREFIX} 文件操作失败 {task_key}: {e}")
                raise IOError(f"文件操作失败: {e}") from e

        return await asyncio.to_thread(_atomic_get_or_create)

    async def update_task_status(
        self,
        task_key: str,
        status: Union[AsrTaskStatus, str],
        file_path: Optional[str] = None,
        duration: Optional[float] = None,
        file_size: Optional[int] = None,
        error_message: Optional[str] = None,
        target_dir: Optional[str] = None,
        intelligent_title: Optional[str] = None,
        files: Optional[dict] = None,
        renamed_directory: Optional[str] = None,
        deleted_files: Optional[list] = None,
        operations: Optional[dict] = None,
        note_file_config: Optional[dict] = None,
        transcript_file_config: Optional[dict] = None,
    ) -> bool:
        """
        更新任务状态

        Args:
            task_key: 任务标识符
            status: 新的状态（可以是枚举或字符串）
            file_path: 合并后的文件路径（可选，向后兼容）
            duration: 音频时长（可选，秒）
            file_size: 文件大小（可选，字节）
            error_message: 错误消息（可选）
            target_dir: 目标目录（可选）
            intelligent_title: 智能标题（可选）
            files: 文件详情（可选）
            renamed_directory: 重命名后的目录名（可选）
            deleted_files: 被删除的文件列表
            operations: 操作结果汇总
            note_file_config: 笔记文件配置（可选）
            transcript_file_config: 流式识别文件配置（可选）

        Returns:
            bool: 更新是否成功
        """
        # 标准化状态值（支持字符串和枚举）
        if isinstance(status, AsrTaskStatus):
            status_value = status.value
        else:
            status_value = status

        # 构建更新字段（过滤 None 值）
        fields = {
            "status": status_value,
            "file_path": file_path,
            "duration": duration,
            "file_size": file_size,
            "error_message": error_message,
            "target_dir": target_dir,
            "intelligent_title": intelligent_title,
            "files": files,
            "renamed_directory": renamed_directory,
            "deleted_files": deleted_files,
            "operations": operations,
            "note_file_config": note_file_config,
            "transcript_file_config": transcript_file_config,
        }
        # 过滤掉 None 值
        fields = {k: v for k, v in fields.items() if v is not None}

        # 更新字段（包含详细的状态文件路径信息）
        state_file_path = self.get_state_file_path(task_key)
        logger.debug(
            f"📂 {AsrMergeTaskManager.LOG_PREFIX} task_key={task_key} 状态文件路径: {state_file_path}, "
            f"exists={state_file_path.exists()}"
        )

        success = await self._update_task_field(task_key, **fields)
        if success:
            logger.info(
                f"🔄 {AsrMergeTaskManager.LOG_PREFIX} task_key={task_key} 更新ASR任务状态成功: -> {status_value}, "
                f"state_file={state_file_path}"
            )
        else:
            logger.error(
                f"❌ {AsrMergeTaskManager.LOG_PREFIX} task_key={task_key} 更新ASR任务状态失败: -> {status_value}, "
                f"state_file={state_file_path}"
            )
        return success

    async def update_progress(self, task_key: str, max_processed_index: int, file_count: int) -> bool:
        """
        更新任务进度信息（原子性操作）

        使用进程内锁保护整个 read-modify-write 过程

        Args:
            task_key: 任务标识符
            max_processed_index: 最大已处理索引
            file_count: 当前文件数量

        Returns:
            bool: 是否更新成功
        """

        def updater(state: TaskState) -> TaskState:
            """更新进度信息"""
            state = self._apply_state_updates(
                state,
                progress_updates={"max_processed_index": max_processed_index, "file_count": file_count},
            )
            logger.debug(
                f"🔄 {AsrMergeTaskManager.LOG_PREFIX} 更新任务进度: {task_key}, index={max_processed_index}, count={file_count}"
            )
            return state

        return await self._atomic_update_state(task_key, updater, "更新任务进度失败")

    async def mark_upload_completed(self, task_key: str, file_shard_count: Optional[int] = None) -> bool:
        """
        标记用户已告知上传完成（原子性操作）

        Args:
            task_key: 任务标识符
            file_shard_count: 当前可确认的分片总数（可选）

        Returns:
            bool: 是否更新成功
        """

        def updater(state: TaskState) -> TaskState:
            """设置upload_completed标志"""
            # 分片总数只增不减，避免重复 finish 被旧值回退
            final_shard_count = state.progress.file_shard_count
            if file_shard_count is not None and file_shard_count >= 0:
                final_shard_count = max(final_shard_count, file_shard_count)

            progress_updates: dict = {
                "upload_completed": True,
                "file_shard_count": final_shard_count,
            }

            # 首次 finish 固定时间窗口，后续重复 finish 不重置截止时间
            if not state.progress.upload_completed:
                now_ts = datetime.now().timestamp()
                progress_updates["upload_completed_at"] = now_ts
                # deadline 复用无新文件超时配置，避免双配置不一致
                progress_updates["completion_deadline_at"] = now_ts + asr_time_config.NO_NEW_FILE_TIMEOUT

            state = self._apply_state_updates(state, progress_updates=progress_updates)
            logger.info(
                f"✅ {AsrMergeTaskManager.LOG_PREFIX} 标记上传完成: {task_key}, "
                f"file_shard_count={state.progress.file_shard_count}, "
                f"upload_completed_at={state.progress.upload_completed_at}, "
                f"completion_deadline_at={state.progress.completion_deadline_at}"
            )
            return state

        return await self._atomic_update_state(task_key, updater, "标记上传完成失败")

    async def finalize_task_config(
        self,
        task_key: str,
        target_dir: str,
        intelligent_title: str,
        file_shard_count: Optional[int] = None,
        note_file_config: Optional[dict] = None,
        transcript_file_config: Optional[dict] = None,
    ) -> bool:
        """
        原子性地更新任务配置并标记上传完成（解决多次更新的原子性问题）

        将配置更新和上传完成标记合并为一次原子操作，避免中间状态

        Args:
            task_key: 任务标识符
            target_dir: 目标目录
            intelligent_title: 智能标题
            file_shard_count: 当前可确认的分片总数（可选）
            note_file_config: 笔记文件配置（可选）
            transcript_file_config: 流式识别文件配置（可选）

        Returns:
            bool: 是否更新成功
        """

        def updater(state: TaskState) -> TaskState:
            """更新配置并标记上传完成"""
            # 更新任务配置（使用 dict[str, Any] 避免类型推断问题）
            update_fields: dict = {
                "target_dir": target_dir,
                "intelligent_title": intelligent_title,
            }

            if note_file_config is not None:
                update_fields["note_file_config"] = note_file_config

            if transcript_file_config is not None:
                update_fields["transcript_file_config"] = transcript_file_config

            # 分片总数只增不减，避免重复 finish 被旧值回退
            final_shard_count = state.progress.file_shard_count
            if file_shard_count is not None and file_shard_count >= 0:
                final_shard_count = max(final_shard_count, file_shard_count)

            progress_updates: dict = {
                "upload_completed": True,
                "file_shard_count": final_shard_count,
            }

            # 首次 finish 固定时间窗口，后续重复 finish 不重置截止时间
            if not state.progress.upload_completed:
                now_ts = datetime.now().timestamp()
                progress_updates["upload_completed_at"] = now_ts
                # deadline 复用无新文件超时配置，避免双配置不一致
                progress_updates["completion_deadline_at"] = now_ts + asr_time_config.NO_NEW_FILE_TIMEOUT

            state = self._apply_state_updates(
                state,
                task_updates=update_fields,
                progress_updates=progress_updates,
            )

            logger.info(
                f"✅ {AsrMergeTaskManager.LOG_PREFIX} 原子更新任务配置并标记上传完成: {task_key}, "
                f"target_dir={target_dir}, title={intelligent_title}, "
                f"file_shard_count={state.progress.file_shard_count}, "
                f"upload_completed_at={state.progress.upload_completed_at}, "
                f"completion_deadline_at={state.progress.completion_deadline_at}"
            )
            return state

        return await self._atomic_update_state(task_key, updater, "更新任务配置并标记上传完成失败")

    async def get_task(self, task_key: str) -> Optional[AsrTaskResult]:
        """
        获取任务结果

        Args:
            task_key: 任务标识符

        Returns:
            AsrTaskResult: 任务结果，不存在或失败时返回None
        """
        state = await self._read_task_state(task_key)
        if not state:
            logger.debug(f"📖 {AsrMergeTaskManager.LOG_PREFIX} 任务不存在: {task_key}")
            return None

        logger.debug(f"📖 {AsrMergeTaskManager.LOG_PREFIX} 获取任务: {task_key} - Status: {state.task.status}")
        return state.task

    async def get_progress(self, task_key: str) -> Optional[TaskProgress]:
        """
        获取任务进度信息

        Args:
            task_key: 任务标识符

        Returns:
            TaskProgress: 进度对象，不存在或失败时返回None
        """
        state = await self._read_task_state(task_key)
        if not state:
            return None
        return state.progress

    async def start_monitoring(self, task_key: str) -> bool:
        """
        标记任务开始监听

        Args:
            task_key: 任务标识符

        Returns:
            bool: 操作是否成功
        """
        return await self.update_task_status(task_key, AsrTaskStatus.RUNNING)

    async def _log_task_status_update(self, task_key: str, status_name: str, success: bool) -> None:
        """
        记录任务状态更新的日志（包含完整状态内容）

        Args:
            task_key: 任务标识符
            status_name: 状态名称（用于日志）
            success: 更新是否成功
        """
        if success:
            # 读取最终写入的状态，打印完整内容
            final_state = await self.get_task(task_key)
            if final_state:
                import json

                state_content = final_state.model_dump(mode="json")
                logger.info(
                    f"✅ {AsrMergeTaskManager.LOG_PREFIX} task_key={task_key} {status_name} 状态写入成功, "
                    f"状态内容: {json.dumps(state_content, ensure_ascii=False)}"
                )
            else:
                logger.info(f"✅ {AsrMergeTaskManager.LOG_PREFIX} task_key={task_key} {status_name} 状态写入成功")
        else:
            logger.error(f"❌ {AsrMergeTaskManager.LOG_PREFIX} task_key={task_key} {status_name} 状态写入失败！")

    async def finish_task(
        self,
        task_key: str,
        file_path: str,
        duration: float,
        file_size: int,
        target_dir: Optional[str] = None,
        intelligent_title: Optional[str] = None,
        files: Optional[dict] = None,
        renamed_directory: Optional[str] = None,
        deleted_files: Optional[list] = None,
        operations: Optional[dict] = None,
    ) -> bool:
        """
        标记任务完成

        Args:
            task_key: 任务标识符
            file_path: 合并后的文件路径（向后兼容）
            duration: 音频时长（秒，保留小数）
            file_size: 文件大小（字节）
            target_dir: 目标目录（可选，用于更新任务信息）
            intelligent_title: 智能标题（可选）
            files: 文件详情（可选）
            renamed_directory: 重命名后的目录名（可选）
            deleted_files: 被删除的文件列表
            operations: 操作结果汇总

        Returns:
            bool: 操作是否成功
        """
        logger.info(
            f"💾 {AsrMergeTaskManager.LOG_PREFIX} task_key={task_key} 开始写入 COMPLETED 状态: "
            f"file_path={file_path}, duration={duration}s, size={file_size}B"
        )

        success = await self.update_task_status(
            task_key,
            AsrTaskStatus.COMPLETED,
            file_path=file_path,
            duration=duration,
            file_size=file_size,
            target_dir=target_dir,
            intelligent_title=intelligent_title,
            files=files,
            renamed_directory=renamed_directory,
            deleted_files=deleted_files,
            operations=operations,
        )

        await self._log_task_status_update(task_key, "COMPLETED", success)
        return success

    async def fail_task(self, task_key: str, error_message: str) -> bool:
        """
        标记任务失败

        Args:
            task_key: 任务标识符
            error_message: 错误消息

        Returns:
            bool: 操作是否成功
        """
        logger.info(
            f"💾 {AsrMergeTaskManager.LOG_PREFIX} task_key={task_key} 开始写入 ERROR 状态: "
            f"error_message={error_message}"
        )

        success = await self.update_task_status(task_key, AsrTaskStatus.ERROR, error_message=error_message)

        await self._log_task_status_update(task_key, "ERROR", success)
        return success

    async def request_retry(self, task_key: str, max_retries: int | None = None) -> tuple[bool, int, int]:
        """
        请求对整个任务进行一次重试（由 finish 触发）

        规则：
        - 只有任务处于 error 状态时才需要走 retry（其他状态由轮询继续处理）
        - retry_count 达到上限则拒绝重试
        - 允许清空 error_message 并把状态拉回 waiting，便于重新启动轮询

        Returns:
            (ok, retry_count, max_retries)
        """
        if max_retries is None:
            max_retries = self.MAX_TASK_RETRIES

        def updater(state: TaskState) -> TaskState:
            current_retry = int(getattr(state.progress, "retry_count", 0) or 0)

            if state.task.status != AsrTaskStatus.ERROR.value:
                # 非 error 不计入重试次数，直接返回原状态
                return state

            if current_retry >= max_retries:
                raise ValueError(f"retry_limit_reached({current_retry}/{max_retries})")

            new_retry = current_retry + 1

            state = self._apply_state_updates(
                state,
                task_updates={"status": AsrTaskStatus.WAITING, "error_message": None},
                progress_updates={"retry_count": new_retry},
            )

            logger.warning(
                f"🔁 {AsrMergeTaskManager.LOG_PREFIX} task_key={task_key} 进入重试流程: "
                f"retry_count={new_retry}/{max_retries}"
            )
            return state

        try:
            ok = await self._atomic_update_state(task_key, updater, "请求重试失败")
            progress = await self.get_progress(task_key)
            retry_count = int(getattr(progress, "retry_count", 0) or 0) if progress else 0
            return ok, retry_count, max_retries
        except ValueError as e:
            # 重试次数达到上限或状态不允许
            progress = await self.get_progress(task_key)
            retry_count = int(getattr(progress, "retry_count", 0) or 0) if progress else 0
            logger.warning(
                f"⚠️ {AsrMergeTaskManager.LOG_PREFIX} task_key={task_key} 请求重试被拒绝: {e} "
                f"retry_count={retry_count}/{max_retries}"
            )
            return False, retry_count, max_retries

    async def cancel_task(self, task_key: str, reason: str = "User canceled") -> bool:
        """
        标记任务为已取消

        Args:
            task_key: 任务标识符
            reason: 取消原因

        Returns:
            bool: 操作是否成功
        """
        return await self.update_task_status(task_key, AsrTaskStatus.CANCELED, error_message=reason)

    async def start_finalizing(self, task_key: str, target_dir: str, intelligent_title: str) -> bool:
        """
        标记任务开始最终合并（FINALIZING 状态）- 原子性操作

        原子性检查：只有状态为 WAITING/RUNNING 时才能转换为 FINALIZING
        防止并发调用导致重复 finalize
        使用进程内锁保护整个 check-and-set 过程

        Args:
            task_key: 任务标识符
            target_dir: 目标目录
            intelligent_title: 智能标题

        Returns:
            bool: 是否成功标记（True=成功标记，False=已在finalize/已完成/不存在）
        """

        def updater(state: TaskState) -> TaskState:
            """检查状态并转换为 FINALIZING"""
            # 检查状态是否允许转换（状态可能是字符串或枚举）
            allowed_statuses = [AsrTaskStatus.WAITING.value, AsrTaskStatus.RUNNING.value]
            if state.task.status not in allowed_statuses:
                logger.warning(
                    f"⚠️ {AsrMergeTaskManager.LOG_PREFIX} start_finalizing: 任务 {task_key} 状态为 {state.task.status}，"
                    f"无法转为 FINALIZING（可能已在处理或已完成）"
                )
                raise ValueError(f"Invalid state transition: {state.task.status} -> FINALIZING")

            # 修改状态
            state = self._apply_state_updates(
                state,
                task_updates={
                    "status": AsrTaskStatus.FINALIZING,
                    "target_dir": target_dir,
                    "intelligent_title": intelligent_title,
                },
            )
            logger.info(f"🔄 {AsrMergeTaskManager.LOG_PREFIX} 标记任务开始 finalize: {task_key} -> FINALIZING")
            return state

        try:
            return await self._atomic_update_state(task_key, updater, "start_finalizing 失败")
        except ValueError:
            # 状态转换不合法
            return False

    async def delete_task(self, task_key: str) -> bool:
        """
        删除任务状态文件

        Args:
            task_key: 任务标识符

        Returns:
            bool: 是否删除成功
        """
        try:
            state_file = self.get_state_file_path(task_key)
            if await asyncio.to_thread(state_file.exists):
                await asyncio.to_thread(state_file.unlink)
                logger.info(f"🗑️ {AsrMergeTaskManager.LOG_PREFIX} 删除任务状态文件: {task_key}")
                return True
            return False
        except OSError as e:
            logger.error(f"❌ {AsrMergeTaskManager.LOG_PREFIX} 删除任务失败 {task_key}: {e}")
            return False

    async def cleanup_old_tasks(self, max_age_hours: int = None) -> int:
        """
        清理旧的任务状态文件

        Args:
            max_age_hours: 最大保存时间（小时），默认 24 小时

        Returns:
            int: 清理的任务数量
        """
        if max_age_hours is None:
            max_age_hours = asr_time_config.DEFAULT_CLEANUP_AGE_HOURS

        states_dir = PathManager.get_asr_states_dir()
        if not await asyncio.to_thread(states_dir.exists):
            return 0

        cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
        cleaned_count = 0

        # 遍历所有状态文件
        files = await asyncio.to_thread(lambda: list(states_dir.glob("*.json")))
        for state_file in files:
            try:
                # 读取并解析为对象
                state_dict = await self._read_state_file(state_file)
                if not state_dict:
                    continue

                # 使用 Pydantic 解析为对象（自动处理类型转换）
                state = TaskState(**state_dict)

                # 使用对象属性访问（类型安全）
                if state.task.created_at < cutoff_time:
                    await asyncio.to_thread(state_file.unlink)
                    cleaned_count += 1
                    logger.debug(
                        f"🗑️ {AsrMergeTaskManager.LOG_PREFIX} 清理过期任务: {state_file.stem}, "
                        f"创建时间: {state.task.created_at}"
                    )
            except (OSError, TypeError, ValueError) as e:
                logger.warning(f"⚠️ {AsrMergeTaskManager.LOG_PREFIX} 检查任务 {state_file.stem} 失败: {e}")

        if cleaned_count > 0:
            logger.info(f"🧹 {AsrMergeTaskManager.LOG_PREFIX} 清理了 {cleaned_count} 个旧的ASR任务记录")

        return cleaned_count

    async def check_should_complete(self, task_key: str, source_dir: Path, scanned_file_count: int) -> bool:
        """
        检查是否应该完成任务

        完成条件（必须全部满足）：
        1. upload_completed = True（客户端已通知上传完成）
        2. merged.wav 存在且稳定可用
        3. 数量已处理完成（已处理数量 >= 要求数量）
        4. 若超时仍未达到要求数量，允许按截止时间安全收敛

        Args:
            task_key: 任务标识
            source_dir: 源目录路径
            scanned_file_count: 本轮扫描到的分片数量

        Returns:
            bool: 是否应该完成任务
        """
        # 1. 检查是否已标记上传完成
        progress = await self.get_progress(task_key)
        if not progress or not progress.upload_completed:
            return False

        # 2. 计算“要求数量”：以客户端声明数量和本轮扫描数量中的较大值为准
        required_file_count = max(scanned_file_count, progress.file_shard_count if progress.file_shard_count >= 0 else 0)

        # 3. 计算“已处理数量”
        # file_count 来自每次合并后的进度回写；max_processed_index + 1 用于兜底修正
        processed_file_count = progress.file_count
        if progress.max_processed_index >= 0:
            processed_file_count = max(processed_file_count, progress.max_processed_index + 1)

        # 再用 merged_metadata.json 的 last_index + 1 做双重保险
        merged_metadata_count = -1
        merged_metadata_path = source_dir / "merged_metadata.json"
        if merged_metadata_path.exists():
            metadata = await asyncio.to_thread(self._read_json_with_retry_sync, merged_metadata_path, "merged_metadata.json")
            if metadata:
                merged_metadata_count = metadata.get("last_index", -1) + 1
                processed_file_count = max(processed_file_count, merged_metadata_count)
            else:
                logger.debug(f"{AsrMergeTaskManager.LOG_PREFIX} task_key={task_key} merged_metadata.json 不可读")

        # 4. 未达到要求数量时，先看是否已到 deadline；未到则继续等待
        reached_deadline = False
        now_ts = datetime.now().timestamp()
        if progress.completion_deadline_at is not None and now_ts >= progress.completion_deadline_at:
            reached_deadline = True

        if processed_file_count < required_file_count and not reached_deadline:
            logger.debug(
                f"{AsrMergeTaskManager.LOG_PREFIX} task_key={task_key} 等待处理完成: "
                f"processed_file_count={processed_file_count}, required_file_count={required_file_count}, "
                f"scanned_file_count={scanned_file_count}, declared_file_shard_count={progress.file_shard_count}, "
                f"completion_deadline_at={progress.completion_deadline_at}"
            )
            return False

        # 5. 验证 merged.wav 是否存在且稳定（轻量级检查，不阻塞）
        merged_file = source_dir / self.MERGED_WAV_FILENAME
        if not await asyncio.to_thread(merged_file.exists):
            logger.warning(
                f"{AsrMergeTaskManager.LOG_PREFIX} ⚠️ task_key={task_key} "
                f"完成判定已触发但 {self.MERGED_WAV_FILENAME} 不存在"
            )
            return False

        # 检查文件大小是否合理（至少不是空文件）
        try:
            file_size = await asyncio.to_thread(lambda: merged_file.stat().st_size)
            from app.service.asr.asr_size_config import asr_size_config

            if file_size < asr_size_config.AUDIO_FILE_MIN_SIZE:
                logger.warning(
                    f"{AsrMergeTaskManager.LOG_PREFIX} ⚠️ task_key={task_key} "
                    f"{self.MERGED_WAV_FILENAME} 大小异常: {file_size}B < {asr_size_config.AUDIO_FILE_MIN_SIZE}B"
                )
                return False
        except Exception as e:
            logger.warning(
                f"{AsrMergeTaskManager.LOG_PREFIX} ⚠️ task_key={task_key} 无法获取 {self.MERGED_WAV_FILENAME} 大小: {e}"
            )
            return False

        # 6. 所有条件满足，可以完成任务
        if processed_file_count >= required_file_count:
            logger.info(
                f"{AsrMergeTaskManager.LOG_PREFIX} 🎉 task_key={task_key} 任务满足完成条件: "
                f"upload_completed=True, processed_file_count={processed_file_count}, "
                f"required_file_count={required_file_count}, scanned_file_count={scanned_file_count}, "
                f"declared_file_shard_count={progress.file_shard_count}, merged_metadata_count={merged_metadata_count}, "
                f"merged_size={file_size}B"
            )
            return True

        # 到达 deadline 后允许安全收敛（仍要求 merged.wav 有效）
        logger.warning(
            f"{AsrMergeTaskManager.LOG_PREFIX} ⏰ task_key={task_key} 到达 completion_deadline，执行安全收敛完成: "
            f"processed_file_count={processed_file_count}, required_file_count={required_file_count}, "
            f"scanned_file_count={scanned_file_count}, declared_file_shard_count={progress.file_shard_count}, "
            f"completion_deadline_at={progress.completion_deadline_at}, now={now_ts}, merged_size={file_size}B"
        )
        return True

    @classmethod
    @lru_cache
    def instance(cls) -> "AsrMergeTaskManager":
        """获取任务管理器单例（懒加载）"""
        return cls()
