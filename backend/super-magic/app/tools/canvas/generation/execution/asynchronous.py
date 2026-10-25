"""异步生成执行策略。"""

from agentlang.context.tool_context import ToolContext
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.generation.contracts.generation_capability import GenerationCapability
from app.tools.canvas.generation.contracts.generation_request import GenerationRequest
from app.tools.canvas.generation.contracts.generation_submission import GenerationSubmission
from app.tools.canvas.generation.execution.interface import GenerationExecutionStrategyInterface


class AsynchronousGenerationStrategy(GenerationExecutionStrategyInterface):
    """提交异步生成并校验 Canvas 与 provider 任务 ID。"""

    mode = "async"

    async def execute(
        self,
        capability: GenerationCapability,
        request: GenerationRequest,
        tool_context: ToolContext | None,
    ) -> GenerationSubmission:
        """调用异步端口并校验任务标识。"""
        if capability.execution_mode != self.mode:
            raise self.invalid_mode("Capability is not asynchronous.")
        submission = await capability.submission_port.submit(request, tool_context)
        if submission.execution_mode != self.mode:
            raise CanvasDomainError("GENERATION_RESULT_INVALID", "Asynchronous generation returned an invalid mode.")
        if submission.status not in {"processing", "pending", "completed", "failed"}:
            raise CanvasDomainError("GENERATION_RESULT_INVALID", "Generation returned an unsupported status.")
        if submission.status in {"processing", "pending"} and (
            not submission.generation_task_id or not submission.provider_task_id
        ):
            raise CanvasDomainError(
                "GENERATION_TASK_ID_MISSING",
                "Asynchronous generation did not return complete Canvas and provider task IDs.",
            )
        return submission
