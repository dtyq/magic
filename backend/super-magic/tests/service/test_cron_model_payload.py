import pytest

from app.service.cron.store import _parse_job_file, build_job_md


@pytest.mark.asyncio
async def test_cron_job_payload_keeps_text_image_and_video_models(tmp_path):
    job_md = build_job_md(
        schedule={"kind": "every", "every_ms": 60_000},
        payload_kind="agent_turn",
        agent_name="mock-agent",
        model_id="mock-text-model",
        image_model_id="mock-image-model",
        video_model_id="mock-video-model",
        timeout_seconds=30,
        enabled=True,
        name="mock scheduled task",
        body="Run a mock scheduled task.",
        timezone="UTC",
        notify_user=True,
    )
    job_path = tmp_path / "mock-job.md"
    job_path.write_text(job_md, encoding="utf-8")

    job = await _parse_job_file(job_path, "mock-job", 0)

    assert job is not None
    assert job.payload.model_id == "mock-text-model"
    assert job.payload.image_model_id == "mock-image-model"
    assert job.payload.video_model_id == "mock-video-model"
    assert "video_generation_config" not in job_md
