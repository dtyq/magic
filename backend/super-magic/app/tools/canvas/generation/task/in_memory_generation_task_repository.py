"""进程内生成任务仓储。"""

import asyncio

from app.tools.canvas.generation.contracts.generation_task import GenerationTask
from app.tools.canvas.generation.ports.task_repository_interface import GenerationTaskRepositoryInterface


class InMemoryGenerationTaskRepository(GenerationTaskRepositoryInterface):
    """使用进程内字典保存任务绑定，供默认运行和测试替换。"""

    def __init__(self) -> None:
        """初始化任务字典和并发锁。"""
        self._records: dict[str, GenerationTask] = {}
        self._lock = asyncio.Lock()

    async def put(self, task: GenerationTask) -> None:
        """保存任务绑定。"""
        async with self._lock:
            self._records[task.generation_task_id] = task

    async def get(self, generation_task_id: str) -> GenerationTask | None:
        """读取任务绑定。"""
        async with self._lock:
            return self._records.get(generation_task_id)

    async def update(self, task: GenerationTask) -> None:
        """更新任务绑定。"""
        async with self._lock:
            self._records[task.generation_task_id] = task
