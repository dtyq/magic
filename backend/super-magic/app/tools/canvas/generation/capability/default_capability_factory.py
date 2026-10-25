"""默认生成能力组装函数。"""

from __future__ import annotations

import os
from pathlib import Path

from app.tools.canvas.generation.adapters.fake_image_generation_port import FakeImageGenerationPort
from app.tools.canvas.generation.adapters.fake_video_generation_port import FakeVideoGenerationPort
from app.tools.canvas.generation.adapters.generic_image_generation_port import GenericImageGenerationPort
from app.tools.canvas.generation.adapters.design_video_generation_port import DesignVideoGenerationPort
from app.tools.canvas.generation.contracts.generation_capability import GenerationCapability


def default_generation_capabilities(workspace: Path | None = None) -> list[GenerationCapability]:
    """创建默认图片同步和视频异步能力。"""
    workspace = workspace or Path.cwd()
    if os.getenv("CANVAS_FAKE_GENERATION") == "1":
        image = FakeImageGenerationPort(workspace)
        video = FakeVideoGenerationPort(workspace)
        return [
            GenerationCapability("fake-image-generation", "image", "sync", image, None, production_rule="image_generation"),
            GenerationCapability("fake-video-generation", "video", "async", video, video, billable=True, production_rule="video_generation"),
        ]
    image = GenericImageGenerationPort(workspace)
    video = DesignVideoGenerationPort(workspace)
    return [
        GenerationCapability("image-generation", "image", "sync", image, None, production_rule="image_generation"),
        GenerationCapability("video-generation", "video", "async", video, video, billable=True, production_rule="video_generation"),
    ]
