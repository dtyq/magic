"""生成能力注册器。"""

from pathlib import Path

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.generation.capability.default_capability_factory import default_generation_capabilities
from app.tools.canvas.generation.contracts.generation_capability import GenerationCapability


class GenerationCapabilityRegistry:
    """按 Element 类型、模型和能力名称选择生成能力。"""

    def __init__(self, capabilities: list[GenerationCapability] | None = None, workspace: Path | None = None):
        """接收由组装入口构建的能力列表。"""
        values = capabilities if capabilities is not None else default_generation_capabilities(workspace)
        self._capabilities = {(capability.element_type, capability.model_id): capability for capability in values}
        self._by_name = {capability.name: capability for capability in values}

    def get(self, element_type: str, model_id: str | None = None) -> GenerationCapability:
        """根据 Element 类型和可选模型选择生成能力。"""
        capability = self._capabilities.get((element_type, model_id))
        if capability is None and model_id is not None:
            capability = self._capabilities.get((element_type, None))
        if capability is None:
            raise CanvasDomainError("GENERATION_NOT_CONFIGURED", f"No generation capability is configured for {element_type}.")
        return capability

    def get_by_name(self, capability_name: str, element_type: str) -> GenerationCapability:
        """按任务记录中的能力名称恢复查询端口，缺少名称时按类型回退。"""
        capability = self._by_name.get(capability_name)
        return capability if capability is not None else self.get(element_type)
