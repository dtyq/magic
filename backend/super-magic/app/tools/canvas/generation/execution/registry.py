"""生成执行策略注册器。"""

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.generation.execution.asynchronous import AsynchronousGenerationStrategy
from app.tools.canvas.generation.execution.interface import GenerationExecutionStrategyInterface
from app.tools.canvas.generation.execution.synchronous import SynchronousGenerationStrategy


class GenerationExecutionStrategyRegistry:
    """只负责按 execution_mode 选择同步或异步执行策略。"""

    def __init__(
        self,
        strategies: list[GenerationExecutionStrategyInterface] | None = None,
    ):
        """注册默认执行策略或调用方提供的替换实现。"""
        values = strategies or [SynchronousGenerationStrategy(), AsynchronousGenerationStrategy()]
        self._strategies = {strategy.mode: strategy for strategy in values}

    def get(self, execution_mode: str) -> GenerationExecutionStrategyInterface:
        """按执行模式返回策略实现。"""
        try:
            return self._strategies[execution_mode]
        except KeyError as exc:
            raise CanvasDomainError(
                "GENERATION_EXECUTION_MODE_INVALID",
                f"Unsupported generation execution mode: {execution_mode}.",
            ) from exc
