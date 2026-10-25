"""生成任务轮询器。"""

import asyncio
import time

from agentlang.context.tool_context import ToolContext
from app.tools.canvas.generation.contracts.generation_query_request import GenerationQueryRequest
from app.tools.canvas.generation.contracts.generation_query_result import GenerationQueryResult
from app.tools.canvas.generation.ports.query_port import GenerationQueryPort


class GenerationTaskPoller:
    """在等待窗口内轮询外部任务，不负责 Canvas 写回。"""

    async def poll(
        self,
        query_port: GenerationQueryPort,
        request: GenerationQueryRequest,
        deadline: float,
        tool_context: ToolContext | None,
    ) -> GenerationQueryResult:
        """查询任务直到终态或达到等待截止时间。"""
        while True:
            result = await query_port.query(request, tool_context)
            if result.status in {"completed", "failed"}:
                return result
            if time.monotonic() >= deadline:
                return result
            await asyncio.sleep(min(1.0, max(0.05, deadline - time.monotonic())))
