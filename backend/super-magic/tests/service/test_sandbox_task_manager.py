"""SandboxTaskManager 状态目录迁移与持久化行为测试。

覆盖：
- 状态文件写入 .runtime/sandbox_tasks，不再触碰 .workspace（不产生 magicfs 云端记录）；
- tmp 文件命名（隐藏单段名）与权限（目录 0700、文件 0600）；
- 旧目录 .workspace/.magic/sandbox-tasks 的启动迁移（损坏文件跳过、幂等）；
- 终态且超过保留期的状态文件被机会式淘汰，未终结状态永不淘汰。
"""

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

from app.path_manager import PathManager
from app.service.sandbox_task.models import SandboxTask, SandboxTaskStatus
from app.service.sandbox_task.task_manager import SandboxTaskManager


@dataclass
class _Dirs:
    runtime: Path
    sandbox_tasks: Path
    workspace: Path
    legacy: Path


def _redirect_state_dirs(monkeypatch, tmp_path: Path) -> _Dirs:
    """把 PathManager 相关目录重定向到临时目录，隔离真实 workspace/runtime。"""
    dirs = _Dirs(
        runtime=tmp_path / "runtime",
        sandbox_tasks=tmp_path / "runtime" / "sandbox_tasks",
        workspace=tmp_path / "workspace",
        legacy=tmp_path / "workspace" / ".magic" / "sandbox-tasks",
    )
    monkeypatch.setattr(PathManager, "get_runtime_dir", classmethod(lambda cls: dirs.runtime))
    monkeypatch.setattr(PathManager, "get_sandbox_tasks_dir", classmethod(lambda cls: dirs.sandbox_tasks))
    monkeypatch.setattr(PathManager, "get_workspace_dir", classmethod(lambda cls: dirs.workspace))
    return dirs


async def _noop_worker(task, update_status):
    return {}


async def test_persist_writes_state_into_runtime_dir_only(monkeypatch, tmp_path):
    dirs = _redirect_state_dirs(monkeypatch, tmp_path)
    manager = SandboxTaskManager()
    task = SandboxTask(task_id="publish:skill:1", capability="workspace_export", project_path="/w")

    await manager._persist(task)

    state_file = dirs.sandbox_tasks / "publish:skill:1.json"
    assert state_file.exists()
    assert state_file.stat().st_mode & 0o777 == 0o600
    assert dirs.sandbox_tasks.stat().st_mode & 0o777 == 0o700
    # workspace 未被写入：magicfs 不会再为状态落盘产生云端文件记录
    assert not dirs.workspace.exists()
    loaded = await manager._load("publish:skill:1")
    assert loaded is not None
    assert loaded.task_id == "publish:skill:1"


def test_persist_tmp_file_uses_hidden_single_segment_name(monkeypatch, tmp_path):
    """tmp 命名回归：旧实现 with_suffix 会产生 publish:skill:X.publish:skill:X.tmp 双段名。"""
    dirs = _redirect_state_dirs(monkeypatch, tmp_path)
    dirs.sandbox_tasks.mkdir(parents=True)
    manager = SandboxTaskManager()
    task = SandboxTask(task_id="publish:skill:958029423963328513", capability="workspace_export", project_path="/w")

    # replace 置为 no-op，让 tmp 文件留在磁盘上以便检查命名
    monkeypatch.setattr(Path, "replace", lambda self, target: None)
    manager._persist_sync(task)

    assert (dirs.sandbox_tasks / ".publish:skill:958029423963328513.tmp").exists()
    assert not (dirs.sandbox_tasks / "publish:skill:958029423963328513.publish:skill:958029423963328513.tmp").exists()


async def test_create_or_get_runs_worker_and_persists_terminal_state(monkeypatch, tmp_path):
    dirs = _redirect_state_dirs(monkeypatch, tmp_path)
    manager = SandboxTaskManager()

    async def worker(task, update_status):
        await update_status(SandboxTaskStatus.RUNNING)
        return {"file_key": "skills/demo/demo.zip"}

    created = await manager.create_or_get("publish:skill:9", "workspace_export", "/w", {"code": "demo"}, worker)
    assert created.status == "queued"

    await asyncio.gather(*manager._workers.values())
    await asyncio.sleep(0.05)  # 等终态落盘触发的机会式清理任务结束

    result = await manager.get("publish:skill:9")
    assert result is not None
    assert result.status == "completed"
    assert result.output == {"file_key": "skills/demo/demo.zip"}
    assert (dirs.sandbox_tasks / "publish:skill:9.json").exists()
    assert not dirs.workspace.exists()


async def test_recover_migrates_legacy_state_dir(monkeypatch, tmp_path):
    dirs = _redirect_state_dirs(monkeypatch, tmp_path)
    running_task = SandboxTask(
        task_id="publish:skill:1",
        capability="workspace_export",
        project_path="/w",
        status=SandboxTaskStatus.RUNNING,
    )
    dirs.legacy.mkdir(parents=True)
    (dirs.legacy / "publish:skill:1.json").write_text(running_task.model_dump_json(), encoding="utf-8")
    (dirs.legacy / "broken.json").write_text("{not-json", encoding="utf-8")
    residue = dirs.legacy / "publish:skill:2.publish:skill:2.tmp"
    residue.write_text("", encoding="utf-8")

    async def worker(task, update_status):
        return {"file_key": "ok"}

    manager = SandboxTaskManager()
    recovered = await manager.recover(worker)
    await asyncio.gather(*manager._workers.values())
    await asyncio.sleep(0.05)

    assert recovered == 1
    # 合法状态迁到新目录并被恢复执行到终态
    assert (dirs.sandbox_tasks / "publish:skill:1.json").exists()
    result = await manager.get("publish:skill:1")
    assert result is not None
    assert result.status == "completed"
    # tmp 残留被清理；损坏文件保留在旧目录，不阻塞整体迁移
    assert not residue.exists()
    assert list(dirs.legacy.iterdir()) == [dirs.legacy / "broken.json"]
    # 幂等：再次 recover 不报错、不重复恢复
    assert await SandboxTaskManager().recover(worker) == 0


async def test_recover_without_legacy_dir_is_noop(monkeypatch, tmp_path):
    dirs = _redirect_state_dirs(monkeypatch, tmp_path)
    manager = SandboxTaskManager()

    assert await manager.recover(_noop_worker) == 0
    assert not dirs.workspace.exists()
    assert not dirs.runtime.exists()


async def test_evict_stale_states_only_removes_expired_terminal_files(monkeypatch, tmp_path):
    dirs = _redirect_state_dirs(monkeypatch, tmp_path)
    dirs.sandbox_tasks.mkdir(parents=True)
    now = datetime.now()
    cases = {
        "stale-completed": (SandboxTaskStatus.COMPLETED, now - timedelta(days=8), False),
        "fresh-completed": (SandboxTaskStatus.COMPLETED, now - timedelta(days=1), True),
        "stale-running": (SandboxTaskStatus.RUNNING, now - timedelta(days=8), True),
    }
    for task_id, (status, updated_at, _) in cases.items():
        task = SandboxTask(
            task_id=task_id,
            capability="workspace_export",
            project_path="/w",
            status=status,
            updated_at=updated_at,
        )
        (dirs.sandbox_tasks / f"{task_id}.json").write_text(task.model_dump_json(), encoding="utf-8")

    await SandboxTaskManager()._evict_stale_states()

    for task_id, (_, _, keep) in cases.items():
        assert (dirs.sandbox_tasks / f"{task_id}.json").exists() == keep, task_id
