"""生成能力的具体适配器。"""

from app.tools.canvas.generation.adapters.fake_image_generation_port import FakeImageGenerationPort
from app.tools.canvas.generation.adapters.fake_video_generation_port import FakeVideoGenerationPort
from app.tools.canvas.generation.adapters.generic_image_generation_port import GenericImageGenerationPort
from app.tools.canvas.generation.adapters.design_video_generation_port import DesignVideoGenerationPort
from app.tools.canvas.generation.adapters.design_video_payload_builder import DesignVideoPayloadBuilder
from app.tools.canvas.generation.adapters.project_identity_resolver import ProjectIdentityResolver

__all__ = [
    "FakeImageGenerationPort",
    "FakeVideoGenerationPort",
    "GenericImageGenerationPort",
    "DesignVideoGenerationPort",
    "DesignVideoPayloadBuilder",
    "ProjectIdentityResolver",
]
