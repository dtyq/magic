"""本地调试模式配置。"""

import math
import os

LOCAL_DEBUG_MODE_ENV = "ENABLE_LOCAL_DEBUG_MODE"
MOCK_IMAGE_GENERATION_ENV = "ENABLE_MOCK_IMAGE_GENERATION"
MOCK_VIDEO_GENERATION_ENV = "ENABLE_MOCK_VIDEO_GENERATION"
CANVAS_FAKE_VIDEO_ESTIMATE_ENV = "CANVAS_FAKE_VIDEO_ESTIMATE"
CANVAS_FAKE_VIDEO_ESTIMATE_POINTS_ENV = "CANVAS_FAKE_VIDEO_ESTIMATE_POINTS"
TRUE_VALUES = {"1", "true", "yes", "on"}


def is_local_debug_mode_enabled() -> bool:
    """统一控制只允许本地调试客户端使用的能力。"""
    return os.getenv(LOCAL_DEBUG_MODE_ENV, "").lower() in TRUE_VALUES


def is_mock_image_generation_enabled() -> bool:
    """判断是否使用本地图片生成 Handler。"""
    return os.getenv(MOCK_IMAGE_GENERATION_ENV, "").lower() in TRUE_VALUES


def is_mock_video_generation_enabled() -> bool:
    """判断是否使用本地视频生成 Handler。"""
    return os.getenv(MOCK_VIDEO_GENERATION_ENV, "").lower() in TRUE_VALUES


def is_canvas_fake_video_estimate_enabled() -> bool:
    """判断是否使用 Canvas 本地视频积分估算。"""
    return os.getenv(CANVAS_FAKE_VIDEO_ESTIMATE_ENV, "").lower() in TRUE_VALUES


def get_canvas_fake_video_estimate_points() -> int | float:
    """读取 Canvas 本地视频积分估算值，并拒绝非法配置。"""
    raw_points = os.getenv(CANVAS_FAKE_VIDEO_ESTIMATE_POINTS_ENV, "10").strip()
    try:
        points = float(raw_points)
    except ValueError as error:
        raise ValueError(
            f"{CANVAS_FAKE_VIDEO_ESTIMATE_POINTS_ENV} must be a non-negative number."
        ) from error
    if not math.isfinite(points) or points < 0:
        raise ValueError(f"{CANVAS_FAKE_VIDEO_ESTIMATE_POINTS_ENV} must be a non-negative number.")
    return int(points) if points.is_integer() else points
