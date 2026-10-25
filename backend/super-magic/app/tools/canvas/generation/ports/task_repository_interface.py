"""生成任务仓储抽象接口。"""

from abc import ABC, abstractmethod

from app.tools.canvas.generation.contracts.generation_task import GenerationTask


class GenerationTaskRepositoryInterface(ABC):
    """定义异步 Canvas 任务绑定的存取边界。"""

    @abstractmethod
    async def put(self, task: GenerationTask) -> None:
        """保存任务绑定。"""

    @abstractmethod
    async def get(self, generation_task_id: str) -> GenerationTask | None:
        """读取任务绑定。"""

    @abstractmethod
    async def update(self, task: GenerationTask) -> None:
        """更新任务绑定。"""
