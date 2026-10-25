"""Canvas 视频预估凭证恢复与指纹校验测试。"""

import pytest

from app.tools.canvas.application.commands import GenerationParameters
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.production.contracts import CostEstimateRecord, CostEstimateRecordItem
from app.tools.canvas.production.estimation import (
    CostEstimateRequestNormalizerRegistry,
    InMemoryCostEstimateRepository,
    VideoProductionRequestNormalizer,
)
from app.tools.canvas.production.services.generation_estimate_guard import GenerationEstimateGuard
from app.tools.canvas.tools.add_canvas_elements import ContentInput


async def _store_estimate(parameters: GenerationParameters) -> tuple[GenerationEstimateGuard, str]:
    """保存一条 mock 视频估算凭证并返回门禁和凭证 ID。"""
    repository = InMemoryCostEstimateRepository()
    normalizer = VideoProductionRequestNormalizer()
    normalized = normalizer.normalize("Canvas/Demo", "video-1", parameters)
    estimate_id = "estimate-test-1"
    await repository.put(
        CostEstimateRecord.create(
            estimate_id,
            "Canvas/Demo",
            "video_generation",
            (
                CostEstimateRecordItem(
                    item_ref="video-1",
                    status="estimated",
                    request_fingerprint=normalized.request_fingerprint,
                    points=10,
                    canonical_parameters=parameters,
                ),
            ),
        )
    )
    return GenerationEstimateGuard(
        repository,
        CostEstimateRequestNormalizerRegistry([normalizer]),
    ), estimate_id


@pytest.mark.asyncio
async def test_guard_restores_canonical_request_when_prompt_is_omitted():
    """只提供 estimate_id 时应恢复预估阶段冻结的完整请求。"""
    canonical = GenerationParameters(
        prompt="Animate the virtual human [image1] with natural gestures.",
        model_id="video-model",
        reference_image_paths=("asset://virtual-human-1",),
        duration_seconds=5,
        aspect_ratio="16:9",
        resolution="720p",
        watermark=False,
    )
    guard, estimate_id = await _store_estimate(canonical)

    resolved = await guard.resolve_and_validate(
        "Canvas/Demo",
        "video-1",
        "video_generation",
        GenerationParameters(estimate_id=estimate_id),
    )

    assert resolved.prompt == canonical.prompt
    assert resolved.reference_image_paths == canonical.reference_image_paths
    assert resolved.watermark is False
    assert resolved.estimate_id == estimate_id


@pytest.mark.asyncio
async def test_guard_rejects_changed_request_after_estimation():
    """调用方提供完整但发生变化的请求时仍必须拒绝。"""
    canonical = GenerationParameters(prompt="Original prompt", model_id="video-model")
    guard, estimate_id = await _store_estimate(canonical)

    with pytest.raises(CanvasDomainError) as exc_info:
        await guard.resolve_and_validate(
            "Canvas/Demo",
            "video-1",
            "video_generation",
            GenerationParameters(
                estimate_id=estimate_id,
                prompt="Changed prompt",
                model_id="video-model",
            ),
        )

    assert exc_info.value.code == "POINT_ESTIMATE_MISMATCH"


@pytest.mark.asyncio
async def test_guard_allows_explicit_skip_without_estimate_record():
    """显式跳过预估时无需估算凭证，但仍保留稳定 item_ref 门槛。"""
    guard = GenerationEstimateGuard(
        InMemoryCostEstimateRepository(),
        CostEstimateRequestNormalizerRegistry([VideoProductionRequestNormalizer()]),
    )
    parameters = GenerationParameters(
        prompt="Generate a short product video.",
        model_id="video-model",
        skip_point_estimate=True,
    )

    resolved = await guard.resolve_and_validate(
        "Canvas/Demo",
        "video-1",
        "video_generation",
        parameters,
    )

    assert resolved is parameters


@pytest.mark.asyncio
async def test_guard_rejects_skip_and_estimate_id_together():
    """跳过预估不能与已有估算凭证同时出现。"""
    guard = GenerationEstimateGuard(
        InMemoryCostEstimateRepository(),
        CostEstimateRequestNormalizerRegistry([VideoProductionRequestNormalizer()]),
    )

    with pytest.raises(CanvasDomainError, match="skip_point_estimate cannot be combined"):
        await guard.resolve_and_validate(
            "Canvas/Demo",
            "video-1",
            "video_generation",
            GenerationParameters(estimate_id="estimate-test-1", skip_point_estimate=True),
        )


def test_generated_video_requires_prompt_without_estimate_protocol():
    """生成工具必须携带实际提示词，不能依赖估算凭证恢复请求。"""
    with pytest.raises(ValueError, match="requires prompt"):
        ContentInput(
            source="generated",
            content_type="video",
        )
