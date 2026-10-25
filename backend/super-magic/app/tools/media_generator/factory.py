"""媒体生成工厂

提供各类媒体生成调度器的获取入口，调用方无需关心具体 dispatcher 实现。
"""

from app.tools.media_generator.image_dispatcher import ImageGeneratorDispatcher
from app.tools.media_generator.video_dispatcher import VideoGeneratorDispatcher


def get_image_generator() -> ImageGeneratorDispatcher:
    """获取图片生成调度器，目前固定返回 ImageGeneratorDispatcher"""
    return ImageGeneratorDispatcher()


def get_video_generator() -> VideoGeneratorDispatcher:
    """获取视频生成调度器。"""
    return VideoGeneratorDispatcher()
