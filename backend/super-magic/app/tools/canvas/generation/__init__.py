"""Canvas 生成能力的兼容导出入口。"""

from app.tools.canvas.generation.adapters.fake_image_generation_port import FakeImageGenerationPort
from app.tools.canvas.generation.adapters.fake_video_generation_port import FakeVideoGenerationPort
from app.tools.canvas.generation.adapters.generic_image_generation_port import GenericImageGenerationPort
from app.tools.canvas.generation.adapters.design_video_generation_port import DesignVideoGenerationPort
from app.tools.canvas.generation.adapters.design_video_payload_builder import DesignVideoPayloadBuilder
from app.tools.canvas.generation.adapters.project_identity_resolver import ProjectIdentityResolver
from app.tools.canvas.generation.video_filename import build_video_filename, sanitize_video_filename
from app.tools.canvas.generation.capability.default_capability_factory import default_generation_capabilities
from app.tools.canvas.generation.capability.generation_capability_registry import GenerationCapabilityRegistry
from app.tools.canvas.generation.contracts.generation_capability import GenerationCapability
from app.tools.canvas.generation.contracts.generation_query_request import GenerationQueryRequest
from app.tools.canvas.generation.contracts.generation_query_result import GenerationQueryResult
from app.tools.canvas.generation.contracts.generation_request import GenerationRequest, TaskCreatedCallback
from app.tools.canvas.generation.contracts.generation_submission import GenerationSubmission
from app.tools.canvas.generation.contracts.generation_task import GenerationTask
from app.tools.canvas.generation.contracts.project_identity import ProjectIdentity
from app.tools.canvas.generation.execution.asynchronous import AsynchronousGenerationStrategy
from app.tools.canvas.generation.execution.interface import GenerationExecutionStrategyInterface
from app.tools.canvas.generation.execution.registry import GenerationExecutionStrategyRegistry
from app.tools.canvas.generation.execution.synchronous import SynchronousGenerationStrategy
from app.tools.canvas.generation.ports.query_port import GenerationQueryPort
from app.tools.canvas.generation.ports.submission_port import GenerationSubmissionPort
from app.tools.canvas.generation.ports.task_repository_interface import GenerationTaskRepositoryInterface
from app.tools.canvas.generation.result.canvas_generation_result_applier import CanvasGenerationResultApplier
from app.tools.canvas.generation.task.generation_task_poller import GenerationTaskPoller
from app.tools.canvas.generation.task.in_memory_generation_task_repository import InMemoryGenerationTaskRepository

GenerationTaskRepository = GenerationTaskRepositoryInterface

__all__ = [
    "AsynchronousGenerationStrategy",
    "CanvasGenerationResultApplier",
    "FakeImageGenerationPort",
    "FakeVideoGenerationPort",
    "GenerationCapability",
    "GenerationCapabilityRegistry",
    "GenerationExecutionStrategyInterface",
    "GenerationExecutionStrategyRegistry",
    "GenerationQueryPort",
    "GenerationQueryRequest",
    "GenerationQueryResult",
    "GenerationRequest",
    "GenerationSubmission",
    "GenerationSubmissionPort",
    "GenerationTask",
    "GenerationTaskPoller",
    "GenerationTaskRepository",
    "GenerationTaskRepositoryInterface",
    "GenericImageGenerationPort",
    "DesignVideoGenerationPort",
    "DesignVideoPayloadBuilder",
    "InMemoryGenerationTaskRepository",
    "ProjectIdentity",
    "ProjectIdentityResolver",
    "build_video_filename",
    "sanitize_video_filename",
    "SynchronousGenerationStrategy",
    "TaskCreatedCallback",
    "default_generation_capabilities",
]
