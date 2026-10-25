"""Canvas 生成媒体协议注册表的 mock 测试。"""

from app.tools.canvas.domain.content_fields import (
    ImageContentFields,
    VideoContentFields,
    find_generation_request,
    generated_content_fields,
    generated_media_types,
    generation_request_field,
)


def test_generated_media_protocol_centralizes_current_media_contract() -> None:
    """当前图片和视频协议应从同一注册表读取字段定义。"""
    assert generated_media_types() == {"image", "video"}
    assert generation_request_field("image") == "generateImageRequest"
    assert generation_request_field("video") == "generateVideoRequest"
    assert "generateImageRequest" in generated_content_fields("image")
    assert "generateVideoRequest" in generated_content_fields("video")


def test_generated_media_fields_use_registered_request_fields() -> None:
    """具体媒体 Fields 写入生成请求时应使用注册表字段。"""
    image = ImageContentFields()
    image.set_generation_request({"prompt": "mock image"})
    video = VideoContentFields()
    video.set_generation_request({"prompt": "mock video"})

    assert find_generation_request(image.to_dict()) == (
        "generateImageRequest",
        {"prompt": "mock image"},
    )
    assert find_generation_request(video.to_dict()) == (
        "generateVideoRequest",
        {"prompt": "mock video"},
    )
