"""同步生成执行策略。"""

from agentlang.context.tool_context import ToolContext
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.generation.contracts.generation_capability import GenerationCapability
from app.tools.canvas.generation.contracts.generation_request import GenerationRequest
from app.tools.canvas.generation.contracts.generation_submission import GenerationSubmission
from app.tools.canvas.generation.execution.interface import GenerationExecutionStrategyInterface


class SynchronousGenerationStrategy(GenerationExecutionStrategyInterface):
    """执行同步生成并直接返回结果 URI。"""

    mode = "sync"

    async def execute(
        self,
        capability: GenerationCapability,
        request: GenerationRequest,
        tool_context: ToolContext | None,
    ) -> GenerationSubmission:
        """调用同步端口并校验结果。"""
        if capability.execution_mode != self.mode:
            raise self.invalid_mode("Capability is not synchronous.")
        submission = await capability.submission_port.submit(request, tool_context)
        if submission.execution_mode != self.mode or submission.status not in {"completed", "failed"}:
            raise CanvasDomainError("GENERATION_RESULT_INVALID", "Synchronous generation returned an invalid result.")
        if submission.status == "completed" and not submission.output_uri:
            raise CanvasDomainError("GENERATION_RESULT_INVALID", "Synchronous generation returned no output URI.")
        return submission
