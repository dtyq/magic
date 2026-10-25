"""生成查询端口抽象接口。"""

from abc import ABC, abstractmethod

from agentlang.context.tool_context import ToolContext
from app.tools.canvas.generation.contracts.generation_query_request import GenerationQueryRequest
from app.tools.canvas.generation.contracts.generation_query_result import GenerationQueryResult


class GenerationQueryPort(ABC):
    """定义查询异步生成任务的端口。"""

    @abstractmethod
    async def query(self, request: GenerationQueryRequest, tool_context: ToolContext | None) -> GenerationQueryResult:
        """查询一次外部生成任务。"""
