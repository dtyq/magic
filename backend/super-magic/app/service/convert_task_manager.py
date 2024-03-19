"""
转换任务管理器

负责管理文件转换任务的状态和结果存储
使用全局内存变量存储，不再使用文件系统
"""

import asyncio
import json
import os
import time
from pathlib import Path
from typing import Dict, Any, Optional, List
from enum import Enum
from datetime import datetime
import tempfile
import shutil
from loguru import logger
from pydantic import BaseModel

# 🎯 全局任务存储变量 - 以task_key为键存储任务结果
GLOBAL_TASK_RESULTS: Dict[str, Dict[str, Any]] = {}
# 全局异步锁保证并发安全
GLOBAL_TASK_LOCK = asyncio.Lock()

class TaskStatus(str, Enum):
    """任务状态枚举"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class ConvertTaskResult(BaseModel):
    """转换任务结果模型"""
    task_key: str
    status: TaskStatus
    convert_type: str
    created_at: datetime
    updated_at: datetime
    batch_id: Optional[str] = None
    total_files: Optional[int] = None
    success_count: Optional[int] = None
    # 新增转换率相关字段
    valid_files_count: Optional[int] = None
    conversion_rate: Optional[float] = None
    files: Optional[List[Dict[str, Any]]] = None
    error_message: Optional[str] = None
    # 新增闲置时间字段
    idle_duration: Optional[float] = None

    class Config:
        use_enum_values = True

class ConvertTaskManager:
    """转换任务管理器 - 使用全局内存变量存储"""

    def __init__(self):
        """初始化任务管理器"""
        logger.info("🎯 转换任务管理器初始化 - 使用全局内存变量存储模式")

    def _get_current_idle_duration(self) -> Optional[float]:
        """获取当前闲置时间（秒）

        Returns:
            Optional[float]: 闲置时间（秒），如果获取失败则返回xNone
        """
        try:
            from app.service.agent_dispatcher import AgentDispatcher
            dispatcher = AgentDispatcher.get_instance()
            if dispatcher and dispatcher.agent_context and dispatcher.agent_context.shared_context:
                return dispatcher.agent_context.shared_context.get_idle_duration_seconds()
        except Exception as e:
            logger.debug(f"获取闲置时间失败: {e}")
        return None

    async def _save_task_to_global(self, task_key: str, task_data: Dict[str, Any]):
        """保存任务到全局变量并打印完整数据"""
        async with GLOBAL_TASK_LOCK:
            GLOBAL_TASK_RESULTS[task_key] = task_data.copy()
            logger.info(f"📝 [GLOBAL_WRITE] Task: {task_key}")
            logger.info(f"📝 [COMPLETE_DATA] {json.dumps(task_data, indent=2, ensure_ascii=False, default=str)}")

    async def _get_task_from_global(self, task_key: str) -> Optional[Dict[str, Any]]:
        """从全局变量获取任务数据"""
        async with GLOBAL_TASK_LOCK:
            task_data = GLOBAL_TASK_RESULTS.get(task_key)
            if task_data:
                logger.debug(f"📖 [GLOBAL_READ] Task: {task_key} - Found")
                return task_data.copy()
            else:
                logger.debug(f"📖 [GLOBAL_READ] Task: {task_key} - Not Found")
                return None

    async def create_task(self, task_key: str, convert_type: str) -> ConvertTaskResult:
        """
        创建新的转换任务

        Args:
            task_key: 任务标识符
            convert_type: 转换类型

        Returns:
            ConvertTaskResult: 任务结果对象
        """
        try:
            task_result = ConvertTaskResult(
                task_key=task_key,
                status=TaskStatus.PENDING,
                convert_type=convert_type,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )

            # 记录初始闲置时间
            task_data = task_result.model_dump()
            current_idle_duration = self._get_current_idle_duration()
            if current_idle_duration is not None:
                task_data["idle_duration"] = current_idle_duration

            # 🎯 保存到全局变量
            await self._save_task_to_global(task_key, task_data)
            logger.info(f"✅ 创建转换任务: {task_key} ({convert_type})")

            # **【新增】重置 agent idle 时间 - 任务创建时**
            try:
                from app.service.agent_dispatcher import AgentDispatcher
                dispatcher = AgentDispatcher.get_instance()
                if dispatcher and dispatcher.agent_context:
                    dispatcher.agent_context.update_activity_time()
                    logger.debug(f"已重置 agent idle 时间 - 任务创建: {task_key}")
            except Exception as agent_error:
                logger.debug(f"更新 agent 活动时间失败 (可忽略): {agent_error}")

            return task_result
        except Exception as e:
            logger.error(f"❌ 创建转换任务失败 {task_key}: {e}")
            raise

    async def update_conversion_rate(self, task_key: str, conversion_rate: float,
                                    current_progress: Optional[int] = None,
                                    total_tasks: Optional[int] = None) -> bool:
        """
        更新转换任务的转换率和进度

        Args:
            task_key: 任务标识符
            conversion_rate: 转换率百分比 (0-100)
            current_progress: 当前进度数量
            total_tasks: 总任务数量

        Returns:
            bool: 更新是否成功
        """
        try:
            # 🎯 从全局变量获取任务数据
            task_data = await self._get_task_from_global(task_key)
            if not task_data:
                logger.error(f"❌ 任务不存在，无法更新转换率: {task_key}")
                return False

            # 更新转换率和进度
            task_data["conversion_rate"] = round(conversion_rate, 2)
            if current_progress is not None:
                task_data["success_count"] = current_progress
            if total_tasks is not None:
                task_data["valid_files_count"] = total_tasks
                task_data["total_files"] = total_tasks  # 🎯 同时更新total_files字段
            task_data["updated_at"] = datetime.now()

            # 记录当前闲置时间
            current_idle_duration = self._get_current_idle_duration()
            if current_idle_duration is not None:
                task_data["idle_duration"] = current_idle_duration

            # 🎯 保存到全局变量
            await self._save_task_to_global(task_key, task_data)

            # 统一进度日志格式
            progress_info = f"{current_progress}/{total_tasks}" if current_progress is not None and total_tasks is not None else "N/A"
            logger.info(f"📊 任务进度更新: {task_key} -> {conversion_rate:.1f}% ({progress_info})")

            # **【新增】重置 agent idle 时间 - 进度更新时**
            try:
                from app.service.agent_dispatcher import AgentDispatcher
                dispatcher = AgentDispatcher.get_instance()
                if dispatcher and dispatcher.agent_context:
                    dispatcher.agent_context.update_activity_time()
                    logger.debug(f"已重置 agent idle 时间 - 进度更新: {task_key}")
            except Exception as agent_error:
                logger.debug(f"更新 agent 活动时间失败 (可忽略): {agent_error}")

            return True

        except Exception as e:
            logger.error(f"❌ 更新转换率失败 {task_key}: {e}")
            return False

    async def update_task_status(self, task_key: str, status: TaskStatus,
                               error_message: Optional[str] = None,
                               result: Optional[Dict[str, Any]] = None) -> bool:
        """
        更新任务状态

        Args:
            task_key: 任务标识符
            status: 新的状态
            error_message: 错误消息（可选）
            result: 结果数据（可选）

        Returns:
            bool: 更新是否成功
        """
        try:
            # 🎯 从全局变量获取任务数据
            task_data = await self._get_task_from_global(task_key)
            if not task_data:
                logger.error(f"❌ 任务不存在，无法更新状态: {task_key}")
                return False

            task_data["status"] = status
            task_data["updated_at"] = datetime.now()
            if error_message:
                task_data["error_message"] = error_message

            # 更新结果数据
            if result:
                for key, value in result.items():
                    task_data[key] = value

            # 记录当前闲置时间
            current_idle_duration = self._get_current_idle_duration()
            if current_idle_duration is not None:
                task_data["idle_duration"] = current_idle_duration

            # 🎯 保存到全局变量
            await self._save_task_to_global(task_key, task_data)
            logger.info(f"🔄 更新任务状态: {task_key} -> {status}")

            # **【新增】重置 agent idle 时间 - 状态更新时**
            try:
                from app.service.agent_dispatcher import AgentDispatcher
                dispatcher = AgentDispatcher.get_instance()
                if dispatcher and dispatcher.agent_context:
                    dispatcher.agent_context.update_activity_time()
                    logger.debug(f"已重置 agent idle 时间 - 状态更新: {task_key} -> {status}")
            except Exception as agent_error:
                logger.debug(f"更新 agent 活动时间失败 (可忽略): {agent_error}")

            return True
        except Exception as e:
            logger.error(f"❌ 更新任务状态失败 {task_key}: {e}")
            return False

    async def complete_task(self, task_key: str, result_data: Dict[str, Any]) -> bool:
        """
        完成任务

        Args:
            task_key: 任务标识符
            result_data: 结果数据

        Returns:
            bool: 操作是否成功
        """
        try:
            # 🎯 从全局变量获取任务数据
            task_data = await self._get_task_from_global(task_key)
            if not task_data:
                logger.error(f"❌ 任务不存在，无法完成: {task_key}")
                return False

            task_data["status"] = TaskStatus.COMPLETED
            task_data["updated_at"] = datetime.now()

            # 更新结果数据
            for key, value in result_data.items():
                task_data[key] = value

            # 记录当前闲置时间
            current_idle_duration = self._get_current_idle_duration()
            if current_idle_duration is not None:
                task_data["idle_duration"] = current_idle_duration

            # 🎯 保存到全局变量
            await self._save_task_to_global(task_key, task_data)
            logger.info(f"✅ 任务完成: {task_key}")

            # **【新增】重置 agent idle 时间 - 任务完成时**
            try:
                from app.service.agent_dispatcher import AgentDispatcher
                dispatcher = AgentDispatcher.get_instance()
                if dispatcher and dispatcher.agent_context:
                    dispatcher.agent_context.update_activity_time()
                    logger.debug(f"已重置 agent idle 时间 - 任务完成: {task_key}")
            except Exception as agent_error:
                logger.debug(f"更新 agent 活动时间失败 (可忽略): {agent_error}")

            return True
        except Exception as e:
            logger.error(f"❌ 完成任务失败 {task_key}: {e}")
            return False

    async def get_task_result(self, task_key: str, max_retries: int = 3) -> Optional[ConvertTaskResult]:
        """
        获取任务结果（从全局变量）

        Args:
            task_key: 任务标识符
            max_retries: 最大重试次数（保留参数兼容性，但不再需要重试）

        Returns:
            ConvertTaskResult: 任务结果，不存在时返回None
        """
        try:
            # 🎯 从全局变量获取任务数据，无需重试机制
            task_data = await self._get_task_from_global(task_key)
            if not task_data:
                logger.debug(f"📖 [QUERY_RESULT] Task: {task_key} - 任务不存在")
                return None

            # 动态获取当前闲置时间
            current_idle_duration = self._get_current_idle_duration()
            if current_idle_duration is not None:
                task_data["idle_duration"] = current_idle_duration
                logger.debug(f"📖 [QUERY_RESULT] Task: {task_key} - 当前闲置时间: {current_idle_duration:.2f}秒")

            # 将字典数据转换为 ConvertTaskResult 对象
            task_result = ConvertTaskResult.model_validate(task_data)
            logger.debug(f"📖 [QUERY_RESULT] Task: {task_key} - 任务存在，状态: {task_result.status}")
            return task_result

        except Exception as e:
            logger.error(f"❌ 获取任务结果失败 {task_key}: {e}")
            return None

    # 🎯 文件操作相关方法已删除，改用全局变量存储

    async def start_processing(self, task_key: str) -> bool:
        """
        标记任务开始处理

        Args:
            task_key: 任务标识符

        Returns:
            bool: 操作是否成功
        """
        return await self.update_task_status(task_key, TaskStatus.PROCESSING)

    async def fail_task(self, task_key: str, error_message: str) -> bool:
        """
        标记任务失败

        Args:
            task_key: 任务标识符
            error_message: 错误消息

        Returns:
            bool: 操作是否成功
        """
        return await self.update_task_status(task_key, TaskStatus.FAILED, error_message=error_message)

    async def cleanup_old_tasks(self, max_age_hours: int = 24) -> int:
        """
        清理旧的任务（从全局变量中清理）

        Args:
            max_age_hours: 最大保存时间（小时）

        Returns:
            int: 清理的任务数量
        """
        cleaned_count = 0
        cutoff_time = datetime.now().timestamp() - (max_age_hours * 3600)

        try:
            async with GLOBAL_TASK_LOCK:
                tasks_to_remove = []

                for task_key, task_data in GLOBAL_TASK_RESULTS.items():
                    try:
                        # 检查任务的创建时间
                        created_at = task_data.get("created_at")
                        if created_at:
                            if isinstance(created_at, str):
                                # 如果是字符串，尝试解析
                                created_timestamp = datetime.fromisoformat(created_at.replace('Z', '+00:00')).timestamp()
                            elif isinstance(created_at, datetime):
                                created_timestamp = created_at.timestamp()
                            else:
                                continue

                            if created_timestamp < cutoff_time:
                                tasks_to_remove.append(task_key)
                    except Exception as e:
                        logger.warning(f"检查任务时间失败 {task_key}: {e}")

                # 删除过期任务
                for task_key in tasks_to_remove:
                    try:
                        del GLOBAL_TASK_RESULTS[task_key]
                        cleaned_count += 1
                        logger.debug(f"🗑️ 清理过期任务: {task_key}")
                    except Exception as e:
                        logger.warning(f"删除过期任务失败 {task_key}: {e}")

            logger.info(f"🧹 清理了 {cleaned_count} 个旧的任务记录")
        except Exception as e:
            logger.error(f"❌ 清理旧任务失败: {e}")

        return cleaned_count

# 🎯 全局状态查看函数
async def get_global_tasks_status() -> Dict[str, Any]:
    """获取全局任务状态，用于调试"""
    async with GLOBAL_TASK_LOCK:
        status = {
            "total_tasks": len(GLOBAL_TASK_RESULTS),
            "tasks": {}
        }
        for task_key, task_data in GLOBAL_TASK_RESULTS.items():
            status["tasks"][task_key] = {
                "status": task_data.get("status"),
                "convert_type": task_data.get("convert_type"),
                "created_at": task_data.get("created_at"),
                "updated_at": task_data.get("updated_at")
            }
        logger.info(f"🔍 [GLOBAL_STATUS] 当前任务数量: {len(GLOBAL_TASK_RESULTS)}")
        return status

# 全局任务管理器实例
task_manager = ConvertTaskManager()
