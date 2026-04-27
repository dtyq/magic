"""媒体生成工厂

提供各类媒体生成调度器的获取入口，调用方无需关心具体 dispatcher 实现。
"""

from app.tools.media_generator.image_dispatcher import ImageGeneratorDispatcher


def get_image_generator() -> ImageGeneratorDispatcher:
    """获取图片生成调度器，目前固定返回 ImageGeneratorDispatcher"""
    return ImageGeneratorDispatcher()
