"""本地 fake 生视频能力适配器。"""

import uuid
from pathlib import Path

from agentlang.context.tool_context import ToolContext
from app.tools.canvas.generation.contracts.generation_query_request import GenerationQueryRequest
from app.tools.canvas.generation.contracts.generation_query_result import GenerationQueryResult
from app.tools.canvas.generation.contracts.generation_request import GenerationRequest
from app.tools.canvas.generation.contracts.generation_submission import GenerationSubmission
from app.tools.canvas.generation.ports.query_port import GenerationQueryPort
from app.tools.canvas.generation.ports.submission_port import GenerationSubmissionPort
from app.tools.canvas.infrastructure.assets import ProjectAssetPathResolver
from app.tools.canvas.generation.video_filename import build_video_filename
from app.utils.async_file_utils import async_mkdir, async_write_bytes

_FAKE_VIDEO_QUERIES: dict[str, int] = {}


class FakeVideoGenerationPort(GenerationSubmissionPort, GenerationQueryPort):
    """本地调试用异步生视频端口，第一次查询处理中，第二次查询完成。"""

    execution_mode = "async"

    def __init__(self, workspace: Path):
        """保存工作区根目录。"""
        self.workspace = workspace
        self.asset_path_resolver = ProjectAssetPathResolver(workspace)

    async def submit(self, request: GenerationRequest, tool_context: ToolContext | None) -> GenerationSubmission:
        """创建进程内 fake provider 任务，不生成真实视频。"""
        provider_task_id = f"fake-{uuid.uuid4().hex[:8]}"
        _FAKE_VIDEO_QUERIES[provider_task_id] = 0
        output_filename = build_video_filename(request.parameters.name, provider_task_id, request.content_id)
        return GenerationSubmission(
            "async",
            "processing",
            generation_task_id=f"canvas-generation-{uuid.uuid4().hex}",
            provider_task_id=provider_task_id,
            request_metadata={"outputFilename": output_filename},
        )

    async def query(self, request: GenerationQueryRequest, tool_context: ToolContext | None) -> GenerationQueryResult:
        """按固定两阶段返回 fake 状态，并写入最小视频占位文件。"""
        count = _FAKE_VIDEO_QUERIES.get(request.provider_task_id, 0) + 1
        _FAKE_VIDEO_QUERIES[request.provider_task_id] = count
        if count == 1:
            return GenerationQueryResult("processing")
        output_filename = request.output_filename or build_video_filename(None, request.provider_task_id, request.content_id)
        output = self.workspace / request.project_path / "videos" / output_filename
        await async_mkdir(output.parent, parents=True, exist_ok=True)
        await async_write_bytes(output, b"fake-canvas-video")
        return GenerationQueryResult(
            "completed",
            output_uri=self.asset_path_resolver.to_project_uri(request.project_path, output),
        )
