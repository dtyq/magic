from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from app.service.cron.models import (
    CronJob,
    CronJobState,
    CronPayload,
    CronSchedule,
    CronState,
    ScheduleKind,
)
from app.tools.manage_cron import ManageCron, ManageCronParams


def _job(job_id: str, *, enabled: bool = True) -> CronJob:
    return CronJob(
        id=job_id,
        name=f"{job_id} name",
        schedule=CronSchedule(kind=ScheduleKind.EVERY, every_ms=60_000),
        payload=CronPayload(),
        body="Run a scheduled task.",
        enabled=enabled,
    )


@pytest.mark.asyncio
async def test_status_uses_jobs_from_scan_result(monkeypatch):
    job = _job("daily-report")
    scan_jobs = AsyncMock(return_value=([job], {"invalid-job": 123.0}))
    load_cron_state = AsyncMock(
        return_value=CronState(
            jobs={
                job.id: CronJobState(
                    next_run_at_ms=1_700_000_000_000,
                    last_status="ok",
                )
            }
        )
    )
    monkeypatch.setattr("app.service.cron.store.scan_jobs", scan_jobs)
    monkeypatch.setattr("app.service.cron.store.load_cron_state", load_cron_state)

    result = await ManageCron()._status()

    assert result.ok
    assert "Total jobs: 1" in result.content
    assert "[daily-report] enabled=True" in result.content
    scan_jobs.assert_awaited_once_with({})


@pytest.mark.asyncio
async def test_list_filters_disabled_jobs_from_scan_result(monkeypatch):
    enabled_job = _job("enabled-job")
    disabled_job = _job("disabled-job", enabled=False)
    scan_jobs = AsyncMock(return_value=([enabled_job, disabled_job], {"invalid-job": 123.0}))
    monkeypatch.setattr("app.service.cron.store.scan_jobs", scan_jobs)

    result = await ManageCron()._list(ManageCronParams(action="list"))

    assert result.ok
    assert result.data == {
        "jobs": [
            {
                "id": enabled_job.id,
                "name": enabled_job.name,
                "enabled": True,
                "schedule_kind": ScheduleKind.EVERY,
                "payload_kind": enabled_job.payload.kind,
            }
        ]
    }
    assert disabled_job.id not in result.content
    scan_jobs.assert_awaited_once_with({})


@pytest.mark.asyncio
async def test_run_now_finds_job_from_scan_result(monkeypatch):
    job = _job("manual-job")
    scan_jobs = AsyncMock(return_value=([job], {"invalid-job": 123.0}))
    execute_agent_turn = AsyncMock()
    monkeypatch.setattr("app.service.cron.store.scan_jobs", scan_jobs)
    monkeypatch.setattr(
        "app.service.cron.executor.execute_agent_turn",
        execute_agent_turn,
    )

    result = await ManageCron()._run_now(ManageCronParams(action="run", job_id=job.id))
    await asyncio.sleep(0)

    assert result.ok
    assert f"Triggered job '{job.id}' immediately" in result.content
    execute_agent_turn.assert_awaited_once_with(job)
    scan_jobs.assert_awaited_once_with({})
