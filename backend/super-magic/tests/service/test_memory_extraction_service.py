import asyncio
from types import SimpleNamespace

import pytest

from app.path_manager import PathManager
from app.service.memory.runtime.extraction import memory_extraction_service as service_module


def _snapshot(agent_name: str, agent_id: str) -> SimpleNamespace:
    """构造记忆提取服务日志所需的最小快照。"""
    return SimpleNamespace(
        source=SimpleNamespace(
            target=SimpleNamespace(agent_name=agent_name),
            agent_id=agent_id,
        )
    )


@pytest.mark.asyncio
async def test_submit_skips_when_another_memory_extraction_is_running(monkeypatch, tmp_path):
    """已有记忆整理子 Agent 运行时，后续提交直接跳过。"""
    service_module.MemoryExtractionService._release_run_lock()
    monkeypatch.setattr(PathManager, "get_runtime_dir", classmethod(lambda cls: tmp_path))

    started = asyncio.Event()
    release = asyncio.Event()
    calls: list[str] = []

    async def fake_run(self, _agent_context, snapshot, _generation):
        calls.append(snapshot.source.agent_id)
        started.set()
        await release.wait()

    monkeypatch.setattr(service_module.MemoryExtractionService, "_run_extraction", fake_run)
    first_service = service_module.MemoryExtractionService()
    second_service = service_module.MemoryExtractionService()

    assert first_service.submit(SimpleNamespace(), _snapshot("magic", "first")) is True
    await started.wait()

    assert second_service.submit(SimpleNamespace(), _snapshot("magic", "second")) is False
    assert calls == ["first"]

    release.set()
    first_task = next(iter(first_service._tasks))
    await first_task
    await asyncio.sleep(0)

    assert second_service.submit(SimpleNamespace(), _snapshot("magic", "third")) is True
    third_task = next(iter(second_service._tasks))
    await third_task
    await asyncio.sleep(0)
