"""
消息历史管理服务

负责将 ServerMessage 保存到文件系统，维护索引，提供查询功能
支持异步和线程安全
"""

import json
import asyncio
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass, asdict

from agentlang.logger import get_logger
from app.core.entity.message.server_message import ServerMessage
from app.paths import PathManager

logger = get_logger(__name__)


@dataclass
class MessageMetadata:
    """消息元数据"""
    seq_id: int
    message_id: str
    timestamp: int
    event_type: Optional[str]
    message_type: str
    status: str
    content_length: int
    has_tool: bool
    has_attachments: bool
    file_size_bytes: int


@dataclass
class TaskIndex:
    """任务索引信息"""
    task_id: str
    created_at: str
    last_updated: str
    message_count: int
    max_seq_id: int
    total_size_bytes: int
    metadata: Dict[str, Any]


@dataclass
class TaskMessageFile:
    """任务消息文件结构"""
    task_id: str
    created_at: str
    last_updated: str
    message_count: int
    max_seq_id: int
    messages: List[Dict[str, Any]]


class MessageHistoryService:
    """消息历史管理服务"""

    def __init__(self):
        # 异步写入锁
        self._write_lock = asyncio.Lock()
        # 线程安全的索引锁
        self._index_lock = threading.Lock()
        # 内存缓存
        self._task_indices: Dict[str, TaskIndex] = {}
        self._loaded_tasks: Set[str] = set()

        # 初始化时加载全局任务元数据
        self._load_global_metadata()

    def _load_global_metadata(self) -> None:
        """加载全局任务元数据"""
        try:
            metadata_file = PathManager.get_task_metadata_file()
            if metadata_file.exists():
                with open(metadata_file, 'r', encoding='utf-8') as f:
                    global_data = json.load(f)

                for task_data in global_data.get('tasks', []):
                    task_index = TaskIndex(**task_data)
                    self._task_indices[task_index.task_id] = task_index

                logger.info(f"加载全局任务元数据: {len(self._task_indices)} 个任务")
        except Exception as e:
            logger.warning(f"加载全局任务元数据失败: {e}")

    async def _save_global_metadata_async(self) -> None:
        """保存全局任务元数据（异步版本）"""
        try:
            metadata_file = PathManager.get_task_metadata_file()
            global_data = {
                'updated_at': datetime.now().isoformat(),
                'total_tasks': len(self._task_indices),
                'tasks': [asdict(task_index) for task_index in self._task_indices.values()]
            }

            # 异步写入文件
            def write_file():
                with open(metadata_file, 'w', encoding='utf-8') as f:
                    json.dump(global_data, f, ensure_ascii=False, indent=2)

            await asyncio.get_event_loop().run_in_executor(None, write_file)

        except Exception as e:
            logger.error(f"保存全局任务元数据失败: {e}")

    def _save_global_metadata(self) -> None:
        """保存全局任务元数据（同步版本）"""
        try:
            metadata_file = PathManager.get_task_metadata_file()
            global_data = {
                'updated_at': datetime.now().isoformat(),
                'total_tasks': len(self._task_indices),
                'tasks': [asdict(task_index) for task_index in self._task_indices.values()]
            }

            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(global_data, f, ensure_ascii=False, indent=2)

        except Exception as e:
            logger.error(f"保存全局任务元数据失败: {e}")

    async def _load_task_file_async(self, task_id: str) -> TaskMessageFile:
        """加载或创建任务消息文件（异步版本）"""
        try:
            task_file = PathManager.get_task_message_file(task_id)

            if task_file.exists():
                def read_file():
                    with open(task_file, 'r', encoding='utf-8') as f:
                        return json.load(f)

                task_data = await asyncio.get_event_loop().run_in_executor(None, read_file)
                return TaskMessageFile(**task_data)
            else:
                # 创建新任务文件结构
                return TaskMessageFile(
                    task_id=task_id,
                    created_at=datetime.now().isoformat(),
                    last_updated=datetime.now().isoformat(),
                    message_count=0,
                    max_seq_id=0,
                    messages=[]
                )

        except Exception as e:
            logger.error(f"加载任务文件失败 {task_id}: {e}")
            # 返回默认结构
            return TaskMessageFile(
                task_id=task_id,
                created_at=datetime.now().isoformat(),
                last_updated=datetime.now().isoformat(),
                message_count=0,
                max_seq_id=0,
                messages=[]
            )

    def _load_task_file(self, task_id: str) -> TaskMessageFile:
        """加载或创建任务消息文件（同步版本）"""
        try:
            task_file = PathManager.get_task_message_file(task_id)
            if task_file.exists():
                with open(task_file, 'r', encoding='utf-8') as f:
                    task_data = json.load(f)
                    return TaskMessageFile(**task_data)
            else:
                # 创建新任务文件结构
                return TaskMessageFile(
                    task_id=task_id,
                    created_at=datetime.now().isoformat(),
                    last_updated=datetime.now().isoformat(),
                    message_count=0,
                    max_seq_id=0,
                    messages=[]
                )

        except Exception as e:
            logger.error(f"加载任务文件失败 {task_id}: {e}")
            # 返回默认结构
            return TaskMessageFile(
                task_id=task_id,
                created_at=datetime.now().isoformat(),
                last_updated=datetime.now().isoformat(),
                message_count=0,
                max_seq_id=0,
                messages=[]
            )

    async def _save_task_file_async(self, task_file_data: TaskMessageFile) -> None:
        """保存任务消息文件（异步版本）"""
        try:
            task_file = PathManager.get_task_message_file(task_file_data.task_id)

            def write_file():
                with open(task_file, 'w', encoding='utf-8') as f:
                    json.dump(asdict(task_file_data), f, ensure_ascii=False, indent=2)

            await asyncio.get_event_loop().run_in_executor(None, write_file)

        except Exception as e:
            logger.error(f"保存任务文件失败 {task_file_data.task_id}: {e}")

    def _save_task_file(self, task_file_data: TaskMessageFile) -> None:
        """保存任务消息文件（同步版本）"""
        try:
            task_file = PathManager.get_task_message_file(task_file_data.task_id)

            with open(task_file, 'w', encoding='utf-8') as f:
                json.dump(asdict(task_file_data), f, ensure_ascii=False, indent=2)

        except Exception as e:
            logger.error(f"保存任务文件失败 {task_file_data.task_id}: {e}")

    async def save_message(self, message: ServerMessage) -> bool:
        """
        保存消息到文件系统（异步版本）

        Args:
            message: 要保存的 ServerMessage

        Returns:
            bool: 保存是否成功
        """
        try:
            task_id = message.payload.task_id
            seq_id = message.payload.seq_id

            if not task_id:
                logger.warning("消息缺少 task_id，跳过保存")
                return False

            async with self._write_lock:
                # 异步加载任务文件
                task_file_data = await self._load_task_file_async(task_id)

                # 序列化消息数据
                message_data = {
                    'saved_at': datetime.now().isoformat(),
                    'seq_id': seq_id,
                    'message_id': message.payload.message_id,
                    'task_id': task_id,
                    'metadata': message.metadata,
                    'payload': message.payload.model_dump(),
                    'token_usage_details': asdict(message.token_usage_details) if message.token_usage_details else None
                }

                # 检查是否已存在相同seq_id的消息
                existing_index = None
                for i, msg in enumerate(task_file_data.messages):
                    if msg.get('seq_id') == seq_id:
                        existing_index = i
                        break

                if existing_index is not None:
                    # 更新现有消息
                    task_file_data.messages[existing_index] = message_data
                    logger.debug(f"更新现有消息: task_id={task_id}, seq_id={seq_id}")
                else:
                    # 添加新消息
                    task_file_data.messages.append(message_data)
                    task_file_data.message_count += 1
                    logger.debug(f"添加新消息: task_id={task_id}, seq_id={seq_id}")

                # 更新统计信息
                task_file_data.max_seq_id = max(task_file_data.max_seq_id, seq_id)
                task_file_data.last_updated = datetime.now().isoformat()

                # 按seq_id排序消息
                task_file_data.messages.sort(key=lambda x: x.get('seq_id', 0))

                # 异步保存任务文件
                await self._save_task_file_async(task_file_data)

                # 更新内存中的任务索引（使用线程锁）
                with self._index_lock:
                    task_index = TaskIndex(
                        task_id=task_file_data.task_id,
                        created_at=task_file_data.created_at,
                        last_updated=task_file_data.last_updated,
                        message_count=task_file_data.message_count,
                        max_seq_id=task_file_data.max_seq_id,
                        total_size_bytes=0,  # 可以计算文件大小
                        metadata={}
                    )
                    self._task_indices[task_id] = task_index

                # 异步保存全局元数据
                await self._save_global_metadata_async()

                logger.debug(f"消息已保存: task_id={task_id}, seq_id={seq_id}")
                return True

        except Exception as e:
            logger.error(f"保存消息失败: {e}")
            return False

    async def get_message(self, task_id: str, seq_id: int) -> Optional[Dict[str, Any]]:
        """
        获取指定消息

        Args:
            task_id: 任务ID
            seq_id: 消息序列号

        Returns:
            Optional[Dict[str, Any]]: 消息数据，如果不存在则返回None
        """
        try:
            task_file_data = await self._load_task_file_async(task_id)

            # 在消息列表中查找指定seq_id的消息
            for message_data in task_file_data.messages:
                if message_data.get('seq_id') == seq_id:
                    return message_data

            return None

        except Exception as e:
            logger.error(f"读取消息失败 {task_id}/{seq_id}: {e}")
            return None

    async def get_message_list(self, task_id: str, start_seq: int = 1, limit: int = 100) -> List[Dict[str, Any]]:
        """
        获取任务的消息列表

        Args:
            task_id: 任务ID
            start_seq: 起始序列号
            limit: 最大返回数量

        Returns:
            List[Dict[str, Any]]: 消息列表
        """
        messages = []
        try:
            task_file_data = await self._load_task_file_async(task_id)

            # 过滤出seq_id在指定范围内的消息
            filtered_messages = [
                msg for msg in task_file_data.messages
                if msg.get('seq_id', 0) >= start_seq
            ]

            # 按seq_id排序并限制数量
            filtered_messages.sort(key=lambda x: x.get('seq_id', 0))
            messages = filtered_messages[:limit]

        except Exception as e:
            logger.error(f"获取消息列表失败 {task_id}: {e}")

        return messages

    async def get_task_info(self, task_id: str) -> Optional[TaskIndex]:
        """
        获取任务信息

        Args:
            task_id: 任务ID

        Returns:
            Optional[TaskIndex]: 任务索引信息
        """
        try:
            task_file_data = await self._load_task_file_async(task_id)

            # 将TaskMessageFile转换为TaskIndex
            return TaskIndex(
                task_id=task_file_data.task_id,
                created_at=task_file_data.created_at,
                last_updated=task_file_data.last_updated,
                message_count=task_file_data.message_count,
                max_seq_id=task_file_data.max_seq_id,
                total_size_bytes=0,  # 可以添加文件大小计算
                metadata={}
            )
        except Exception as e:
            logger.error(f"获取任务信息失败 {task_id}: {e}")
            return None

    async def get_all_tasks(self) -> List[TaskIndex]:
        """
        获取所有任务列表

        Returns:
            List[TaskIndex]: 所有任务的索引信息
        """
        tasks = []
        try:
            # 扫描所有任务文件
            client_message_dir = PathManager.get_client_message_dir()

            def scan_files():
                file_list = []
                for task_file in client_message_dir.glob("*.json"):
                    if task_file.name != "task_metadata.json":
                        file_list.append((task_file.stem, task_file.stat().st_size))
                return file_list

            file_list = await asyncio.get_event_loop().run_in_executor(None, scan_files)

            for task_id, file_size in file_list:
                try:
                    task_file_data = await self._load_task_file_async(task_id)
                    task_index = TaskIndex(
                        task_id=task_file_data.task_id,
                        created_at=task_file_data.created_at,
                        last_updated=task_file_data.last_updated,
                        message_count=task_file_data.message_count,
                        max_seq_id=task_file_data.max_seq_id,
                        total_size_bytes=file_size,
                        metadata={}
                    )
                    tasks.append(task_index)
                except Exception as e:
                    logger.error(f"读取任务文件失败 {task_id}: {e}")

        except Exception as e:
            logger.error(f"扫描任务文件失败: {e}")

        return tasks

    async def cleanup_old_messages(self, days: int = 30) -> int:
        """
        清理旧消息

        Args:
            days: 保留天数，超过此天数的消息将被删除

        Returns:
            int: 删除的消息数量
        """
        deleted_count = 0
        cutoff_date = datetime.now().timestamp() - (days * 24 * 60 * 60)

        try:
            # 获取所有任务文件
            client_message_dir = PathManager.get_client_message_dir()

            def get_task_files():
                return [f for f in client_message_dir.glob("*.json") if f.name != "task_metadata.json"]

            task_files = await asyncio.get_event_loop().run_in_executor(None, get_task_files)

            for task_file in task_files:
                task_id = task_file.stem
                try:
                    task_file_data = await self._load_task_file_async(task_id)
                    original_count = len(task_file_data.messages)

                    # 过滤出未过期的消息
                    task_file_data.messages = [
                        msg for msg in task_file_data.messages
                        if msg.get('saved_at') and
                        datetime.fromisoformat(msg['saved_at']).timestamp() >= cutoff_date
                    ]

                    new_count = len(task_file_data.messages)
                    deleted_count += (original_count - new_count)

                    if new_count == 0:
                        # 如果没有消息了，删除整个文件
                        await asyncio.get_event_loop().run_in_executor(None, task_file.unlink)
                        with self._index_lock:
                            if task_id in self._task_indices:
                                del self._task_indices[task_id]
                    else:
                        # 更新文件信息
                        task_file_data.message_count = new_count
                        task_file_data.max_seq_id = max(msg.get('seq_id', 0) for msg in task_file_data.messages) if task_file_data.messages else 0
                        task_file_data.last_updated = datetime.now().isoformat()

                        # 保存更新后的文件
                        await self._save_task_file_async(task_file_data)

                except Exception as e:
                    logger.error(f"清理任务文件失败 {task_id}: {e}")

            logger.info(f"清理完成，删除了 {deleted_count} 个旧消息")

        except Exception as e:
            logger.error(f"清理旧消息失败: {e}")

        return deleted_count

    def get_stats(self) -> Dict[str, Any]:
        """获取服务统计信息"""
        with self._index_lock:
            return {
                'total_tasks': len(self._task_indices),
                'loaded_tasks': len(self._loaded_tasks),
                'total_messages': sum(task.message_count for task in self._task_indices.values()),
                'total_size_bytes': sum(task.total_size_bytes for task in self._task_indices.values())
            }


# 全局单例
_message_history_service = MessageHistoryService()


def get_message_history_service() -> MessageHistoryService:
    """获取全局消息历史管理服务实例"""
    return _message_history_service
