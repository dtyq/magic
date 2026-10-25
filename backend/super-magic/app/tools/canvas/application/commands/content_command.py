"""Canvas Content 创建命令模型。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.tools.canvas.application.commands.generation_parameters import GenerationParameters
from app.tools.canvas.domain.content_fields import CanvasContentFields


@dataclass(frozen=True)
class ContentCommand:
    """描述一次 Content 创建所需的确定字段。"""

    source: Literal["user", "imported", "generated"]
    content_type: str
    fields: CanvasContentFields
    asset_path: str | None = None
    generation_parameters: GenerationParameters | None = None
    content_id: str | None = None

    @property
    def is_generated(self) -> bool:
        """判断该 Content 是否需要调用生成能力。"""
        return self.source == "generated"

    @property
    def is_imported(self) -> bool:
        """判断该 Content 是否来自本地素材。"""
        return self.source == "imported"

    @property
    def is_composition(self) -> bool:
        """判断该生成 Content 是否需要通过 Canvas 内部合成能力产出。"""
        return bool(
            self.source == "generated"
            and self.generation_parameters is not None
            and self.generation_parameters.task == "compose"
            and self.generation_parameters.composition is not None
        )

    def to_metadata(self) -> dict[str, object]:
        """转换为 sidecar 记录使用的稳定输入摘要。"""
        values: dict[str, object] = {
            "source": self.source,
            "contentType": self.content_type,
        }
        if self.asset_path is not None:
            values["assetPath"] = self.asset_path
        if self.generation_parameters is not None:
            values["generationParameters"] = self.generation_parameters.to_dict()
        return values
