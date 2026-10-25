"""生成能力注册。"""

from app.tools.canvas.generation.capability.default_capability_factory import default_generation_capabilities
from app.tools.canvas.generation.capability.generation_capability_registry import GenerationCapabilityRegistry

__all__ = ["GenerationCapabilityRegistry", "default_generation_capabilities"]
