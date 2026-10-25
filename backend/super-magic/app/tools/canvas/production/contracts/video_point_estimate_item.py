"""视频积分预估项契约。"""

from dataclasses import dataclass

from app.tools.canvas.application.commands import GenerationParameters


@dataclass(frozen=True)
class VideoPointEstimateItem:
    """描述一项与真实生成一致的视频预估参数。"""

    item_ref: str
    parameters: GenerationParameters
