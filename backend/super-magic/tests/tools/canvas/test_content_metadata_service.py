"""Canvas 视频生成请求持久化协议测试。"""

import pytest

from app.tools.canvas.application.commands import GenerationParameters
from app.tools.canvas.infrastructure.persistence.content_metadata_service import ContentMetadataService
from app.tools.canvas.infrastructure.persistence.element_details_codec import ElementDetailsCodec


def test_build_public_video_request_uses_nested_reference_images():
    """视频公共请求应按 magic-web 协议把参考图写入 inputs.reference_images。"""
    request = ContentMetadataService.build_public_generation_request(
        {
            "prompt": "让产品动起来 [image1]",
            "reference_images": ["images/product.webp"],
            "aspect_ratio": "9:16",
            "resolution": "720p",
            "duration_seconds": 5,
        },
        "video",
    )

    assert request["inputs"] == {
        "reference_images": [{"uri": "./images/product.webp"}],
        "reference_videos": [],
        "reference_audios": [],
        "frames": [],
    }
    assert request["generation"] == {
        "aspect_ratio": "9:16",
        "resolution": "720p",
        "duration_seconds": 5,
    }
    assert "reference_image_paths" not in request


def test_build_public_video_request_strips_project_prefix_from_reference_images():
    """公共 Canvas 请求应把工作区项目路径归一化为项目相对 URI。"""
    request = ContentMetadataService.build_public_generation_request(
        {
            "prompt": "让产品动起来 [image1]",
            "reference_images": ["深圳景点图片/images/product.webp"],
        },
        "video",
        project_path="深圳景点图片",
    )

    assert request["inputs"]["reference_images"] == [
        {"uri": "./images/product.webp"},
    ]


def test_build_public_video_request_accepts_legacy_reference_image_paths():
    """旧版路径字段仍可生成符合新协议的公共请求。"""
    request = ContentMetadataService.build_public_generation_request(
        {
            "prompt": "让产品动起来 [image1]",
            "reference_image_paths": ["/Canvas/Demo/images/product.webp"],
        },
        "video",
    )

    assert request["inputs"]["reference_images"] == [
        {"uri": "./Canvas/Demo/images/product.webp"},
    ]
    assert "reference_image_paths" not in request


def test_build_public_video_request_normalizes_provider_asset_uri():
    """Canvas 公共视频请求应统一 provider URI 的前导斜杠。"""
    request = ContentMetadataService.build_public_generation_request(
        {
            "prompt": "虚拟人像 [image1] 介绍产品",
            "reference_images": ["/asset://asset-20260401123823-6d4x2"],
        },
        "video",
    )

    assert request["inputs"]["reference_images"] == [
        {"uri": "asset://asset-20260401123823-6d4x2"}
    ]


def test_build_public_video_request_persists_composition_sequences_and_output():
    """合成公共请求应完整保存 Element 顺序和导出配置。"""
    request = ContentMetadataService.build_public_generation_request(
        {
            "task": "compose",
            "composition": {
                "videoSequence": ["video-1", "video-2"],
                "audioSequence": ["audio-1"],
                "output": {"aspectRatio": "9:16", "resolution": "720p", "audioPolicy": "preserve"},
            },
        },
        "video",
    )

    assert request["composition"] == {
        "videoSequence": ["video-1", "video-2"],
        "audioSequence": ["audio-1"],
        "output": {"aspectRatio": "9:16", "resolution": "720p", "audioPolicy": "preserve"},
    }


def test_get_restores_generation_parameters_from_new_video_request():
    """只有新公共 sidecar 时，也应恢复可用于重试的规范参考图参数。"""
    metadata = {
        "elements": {
            "element-1": {
                "contentDetails": {
                    "content-1": {
                        "generateVideoRequest": {
                            "prompt": "让产品动起来 [image1]",
                            "inputs": {
                                "reference_images": [{"uri": "./images/product.webp"}],
                            },
                            "generation": {"aspect_ratio": "16:9"},
                        }
                    }
                }
            }
        }
    }

    detail = ContentMetadataService.get(metadata, "element-1", "content-1")

    assert detail["generationParameters"]["reference_images"] == ["./images/product.webp"]
    assert detail["generationParameters"]["aspect_ratio"] == "16:9"


def test_generation_parameters_use_reference_images_as_canonical_field():
    """从旧参数恢复时应暴露规范 reference_images，同时保留旧字段兼容。"""
    parameters = GenerationParameters.from_dict({"reference_image_paths": ["./images/legacy.webp"]})

    assert parameters.effective_reference_images() == ("./images/legacy.webp",)
    assert parameters.reference_images == ("./images/legacy.webp",)
    assert parameters.reference_image_paths == ("./images/legacy.webp",)


def test_new_generated_video_detail_persists_public_request_before_submission():
    """新建视频生成 Content 时应在提交 provider 前写入公共生成请求。"""
    detail = ContentMetadataService.new_detail(
        "element-1",
        {
            "source": "generated",
            "contentType": "video",
            "generationParameters": {
                "prompt": "让产品动起来 [image1]",
                "reference_images": ["images/product.webp"],
                "duration_seconds": 5,
            },
        },
    )

    assert detail["generationStatus"] == "pending"
    assert detail["generateVideoRequest"]["prompt"] == "让产品动起来 [image1]"
    assert detail["generateVideoRequest"]["inputs"]["reference_images"] == [
        {"uri": "./images/product.webp"}
    ]
    assert detail["generationParameters"]["reference_images"] == ["images/product.webp"]

    metadata = {}
    ContentMetadataService.set(metadata, "element-1", "content-1", detail)

    public_detail = metadata["elements"]["element-1"]["contentDetails"]["content-1"]
    runtime_detail = metadata["__canvas_runtime__"]["elements"]["element-1"]["contentDetails"]["content-1"]
    assert public_detail["generateVideoRequest"]["prompt"] == "让产品动起来 [image1]"
    assert "generationParameters" not in public_detail
    assert runtime_detail["generationParameters"]["reference_images"] == ["images/product.webp"]


def test_start_retry_replaces_public_video_request_with_new_parameters():
    """重试详情应携带新参数构造的公共视频请求。"""
    detail = ContentMetadataService.start_retry(
        "element-1",
        {
            "source": "generated",
            "generationStatus": "failed",
            "retryCount": 0,
            "generationTaskId": "task-old",
            "generateVideoRequest": {"prompt": "旧提示词"},
        },
        1,
        {
            "prompt": "新提示词 [image1]",
            "reference_image_paths": ["images/new.webp"],
        },
        "retry-key",
        element_type="video",
    )

    assert detail["generationStatus"] == "pending"
    assert detail["generateVideoRequest"]["prompt"] == "新提示词 [image1]"
    assert detail["generateVideoRequest"]["inputs"]["reference_images"] == [
        {"uri": "./images/new.webp"}
    ]
    assert "generationTaskId" not in detail


def test_new_image_detail_persists_public_request_before_submission():
    """新建生图 Content 时应写入 generateImageRequest，并隔离运行态参数。"""
    detail = ContentMetadataService.new_detail(
        "element-image",
        {
            "source": "generated",
            "contentType": "image",
            "generationParameters": {
                "prompt": "生成一张产品图",
                "reference_images": ["images/source.png"],
            },
        },
    )

    metadata = {}
    ContentMetadataService.set(metadata, "element-image", "content-image", detail)

    public_detail = metadata["elements"]["element-image"]["contentDetails"]["content-image"]
    runtime_detail = metadata["__canvas_runtime__"]["elements"]["element-image"]["contentDetails"]["content-image"]
    assert public_detail["generateImageRequest"]["prompt"] == "生成一张产品图"
    assert public_detail["generateImageRequest"]["reference_images"] == ["./images/source.png"]
    assert public_detail["generateImageRequest"]["mode"] == "edit"
    assert public_detail["generateImageRequest"]["start_time"]
    assert "generationParameters" not in public_detail
    assert runtime_detail["generationParameters"]["reference_images"] == ["images/source.png"]


def test_new_video_detail_keeps_result_metadata_out_of_public_detail():
    """新建视频详情只保留公共请求，不承载主文件结果元数据。"""
    detail = ContentMetadataService.new_detail(
        "element-video",
        {
            "source": "generated",
            "contentType": "video",
            "generationParameters": {
                "prompt": "让产品动起来",
                "model_id": "video-model",
                "reference_images": ["images/source.png"],
                "duration_seconds": 5,
                "resolution": "720p",
            },
        },
    )

    assert "videoGenerationResultMeta" not in detail
    assert detail["generateVideoRequest"]["model_id"] == "video-model"


def test_public_sidecar_rejects_video_result_metadata():
    """公共 Sidecar 必须拒绝前端未声明的 Video Content 结果字段。"""
    document = {
        "version": "2.0.0",
        "elements": {
            "video-1": {
                "contentDetails": {
                    "content-1": {"videoGenerationResultMeta": {"billing": {"points": 2}}},
                },
            },
        },
    }

    with pytest.raises(ValueError, match="UNSUPPORTED_PUBLIC_ELEMENT_DETAILS_STRUCTURE"):
        ElementDetailsCodec.validate_public(document)


def test_video_result_metadata_adds_terminal_runtime_fields():
    """视频终态元数据应补齐完成时间和整秒耗时。"""
    result = ContentMetadataService.merge_video_result_metadata(
        {
            "runtime": {"started_at": "2026-09-02 10:00:00"},
        },
        {
            "generation_info": {"input_mode": "standard"},
            "billing": {"points": 3},
        },
        "completed",
        finished_at="2026-09-02 10:00:07",
    )

    assert result["generation_info"]["input_mode"] == "standard"
    assert result["billing"]["points"] == 3
    assert result["runtime"] == {
        "started_at": "2026-09-02 10:00:00",
        "finished_at": "2026-09-02 10:00:07",
        "elapsed_seconds": 7,
    }
