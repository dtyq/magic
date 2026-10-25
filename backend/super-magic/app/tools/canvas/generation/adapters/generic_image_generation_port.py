"""通用生图能力适配器。"""

import time
from datetime import datetime
from pathlib import Path

from agentlang.context.tool_context import ToolContext
from app.tools.canvas.generation.adapters.project_identity_resolver import ProjectIdentityResolver
from app.tools.canvas.generation.contracts.generation_request import GenerationRequest
from app.tools.canvas.generation.contracts.generation_submission import GenerationSubmission
from app.tools.canvas.generation.image_filename import build_image_filename
from app.tools.canvas.generation.ports.submission_port import GenerationSubmissionPort
from app.tools.canvas.infrastructure.assets import ProjectAssetPathResolver
from app.tools.image_utils.image_generation_utils import resolve_image_model


class GenericImageGenerationPort(GenerationSubmissionPort):
    """适配现有通用生图能力的同步端口。"""

    execution_mode = "sync"

    def __init__(self, workspace: Path):
        """保存工作区根目录。"""
        self.workspace = workspace
        self.project_identity_resolver = ProjectIdentityResolver()
        self.asset_path_resolver = ProjectAssetPathResolver(workspace)

    async def resolve_request_metadata(self, request: GenerationRequest, tool_context: ToolContext | None) -> dict[str, object]:
        """在提交前解析图片最终模型，确保生成中详情可展示。"""
        model_id = request.parameters.model_id or await resolve_image_model(tool_context)
        return {
            "model_id": model_id,
            "mode": "edit" if request.parameters.effective_reference_images() else "generate",
        }

    async def submit(self, request: GenerationRequest, tool_context: ToolContext | None) -> GenerationSubmission:
        """调用通用生图工具并返回工作区相对结果路径。"""
        from app.tools.generate_images import GenerateImages, GenerateImagesParams, ImageGenerationTask

        parameters = request.parameters
        project = self.project_identity_resolver.resolve(request.project_path)
        if not parameters.name or not parameters.name.strip():
            raise ValueError("Generated Canvas images require a model-provided name.")
        name = build_image_filename(parameters.name, unique_key=request.content_id)
        output_path = str(parameters.output_path or f"{project.project_path}/images")
        reference_images = [
            self.asset_path_resolver.to_workspace_reference_path(request.project_path, path)
            for path in parameters.reference_images
        ]
        task = ImageGenerationTask(
            prompt=parameters.prompt,
            size=parameters.size,
            name=name,
            output_path=output_path,
            reference_images=reference_images,
        )
        start_dt = datetime.now()
        started = time.monotonic()
        result = await GenerateImages(base_dir=self.workspace).execute_purely(
            tool_context,
            GenerateImagesParams(tasks=[task]),
            model_id=parameters.model_id,
            on_task_created=request.on_task_created,
            report_progress=False,
        )
        end_dt = datetime.now()
        duration_ms = int((time.monotonic() - started) * 1000)
        if not result.ok:
            return GenerationSubmission("sync", "failed", error_message=result.content)
        saved = list(result.extra_info.get("saved_images") or []) if result.extra_info else []
        if not saved:
            return GenerationSubmission("sync", "failed", error_message="Image generation returned no output.")
        output = Path(saved[0])
        try:
            output_uri = self.asset_path_resolver.to_project_uri(request.project_path, output)
        except ValueError:
            return GenerationSubmission(
                "sync",
                "failed",
                error_message="Image generation returned an output outside the Canvas workspace.",
            )
        task_results = (result.extra_info or {}).get("tasks", [])
        task_info = task_results[0] if isinstance(task_results, list) and task_results and isinstance(task_results[0], dict) else {}
        request_metadata = {
            "size": task.size,
            "image_id": output.stem,
            "mode": "edit" if parameters.reference_images else "generate",
            "start_time": start_dt.isoformat(timespec="milliseconds"),
            "end_time": end_dt.isoformat(timespec="milliseconds"),
            "duration_ms": duration_ms,
            "model_id": task_info.get("model") or parameters.model_id,
            "reference_images": list(parameters.reference_images),
        }
        request_metadata = {key: value for key, value in request_metadata.items() if value is not None}
        return GenerationSubmission(
            "sync",
            "completed",
            output_uri=output_uri,
            request_metadata=request_metadata,
        )
