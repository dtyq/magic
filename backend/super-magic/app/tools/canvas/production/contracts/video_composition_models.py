"""视频合成规则的强类型领域输入和准备结果。"""

from dataclasses import dataclass

from app.tools.canvas.production.contracts.composition_output import CompositionOutput


@dataclass(frozen=True)
class CompositionInputSpec:
    """描述一次合成冻结后的 Element 顺序、解析媒体和导出输入。"""

    video_element_ids: tuple[str, ...]
    audio_element_ids: tuple[str, ...]
    video_sources: tuple[str, ...]
    audio_sources: tuple[str, ...]
    output_width: int
    output_height: int
    audio_policy: str
    output: CompositionOutput


@dataclass(frozen=True)
class CompositionPreparation:
    """描述已创建 processing Video Content 的一次合成尝试。"""

    result_element_id: str
    result_content_id: str
    relative_output_path: str
    input_spec: CompositionInputSpec
    previous_active_content_id: str | None
    previous_main_content_id: str | None
