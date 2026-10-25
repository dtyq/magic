"""生成执行策略抽象接口。"""

from abc import ABC, abstractmethod

from agentlang.context.tool_context import ToolContext
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.generation.contracts.generation_capability import GenerationCapability
from app.tools.canvas.generation.contracts.generation_request import GenerationRequest
from app.tools.canvas.generation.contracts.generation_submission import GenerationSubmission


class GenerationExecutionStrategyInterface(ABC):
    """定义同步或异步生成执行语义。"""

    mode: str

    @abstractmethod
    async def execute(
        self,
        capability: GenerationCapability,
        request: GenerationRequest,
        tool_context: ToolContext | None,
    ) -> GenerationSubmission:
        """执行一次生成提交并返回统一结果。"""

    @staticmethod
    def invalid_mode(message: str) -> CanvasDomainError:
        """创建统一的执行模式错误。"""
        return CanvasDomainError("GENERATION_EXECUTION_MODE_INVALID", message)
