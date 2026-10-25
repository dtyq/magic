"""生成能力端口。"""

from app.tools.canvas.generation.ports.query_port import GenerationQueryPort
from app.tools.canvas.generation.ports.submission_port import GenerationSubmissionPort
from app.tools.canvas.generation.ports.task_repository_interface import GenerationTaskRepositoryInterface

__all__ = ["GenerationQueryPort", "GenerationSubmissionPort", "GenerationTaskRepositoryInterface"]
