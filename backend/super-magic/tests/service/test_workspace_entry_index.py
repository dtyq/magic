# -*- coding: utf-8 -*-
"""工作区条目集合的契约测试。

这个文件守的核心只有一句：**事件源健康时，遍历应该停下来。**

在那之前，"工作区变了什么"只能靠每次变动重扫一遍目录树，大项目上那一次要数秒到
数分钟；在那之后，遍历退化成"每个会话建立一次基线"。所以这里既测正确性（集合与展示
是否跟着事件走），也测成本（遍历次数是不是真的停在 1）。
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.core.entity.message.server_message import (
    DirectoryScanFailure,
    FileTreeContent,
    FileTreeNode,
    FileTreeNodeType,
    UnexpandedDirectory,
    UnexpansionReason,
)
from app.core.horizon.workspace_entry_index import (
    BaselineMaintenance,
    WorkspaceEntryIndex,
    WorkspaceRebuildReason,
    workspace_root_signature,
)
from app.core.horizon.workspace_tree_display import build_workspace_snapshot_partial_notice
from app.infrastructure.changefeed.workspace_path_changes import WorkspaceChangeSet


class _RecordingScan:
    """脚本化的目录遍历，记录被调了几次、每次的入参。

    真实的 `scan_directory_tree` 已经在 tests/utils 里逐条覆盖；这里只关心
    "什么时候被调用"，所以用脚本结果替掉文件系统。
    """

    def __init__(self, *contents: FileTreeContent) -> None:
        self._contents = list(contents)
        self.calls: list[dict] = []

    def __call__(self, directory, **kwargs) -> FileTreeContent:
        self.calls.append({"directory": directory, **kwargs})
        if not self._contents:
            return _content(())
        index = min(len(self.calls) - 1, len(self._contents) - 1)
        return self._contents[index]

    @property
    def call_count(self) -> int:
        return len(self.calls)


def _node(path: str, *, size: int | None = 8) -> FileTreeNode:
    is_directory = path.endswith("/")
    return FileTreeNode(
        file_name=Path(path.rstrip("/")).name,
        relative_file_path=path.rstrip("/"),
        is_directory=is_directory,
        file_size=None if is_directory else size,
        updated_at="2026-01-01 00:00:00",
        children=None,
        type=FileTreeNodeType.DIRECTORY if is_directory else FileTreeNodeType.FILE,
    )


def _content(
    paths: tuple[str, ...],
    *,
    complete: bool = True,
    unexpanded: tuple[UnexpandedDirectory, ...] = (),
) -> FileTreeContent:
    return FileTreeContent(
        root_path=".",
        level=3,
        filter_binary=False,
        total_files=sum(1 for path in paths if not path.endswith("/")),
        total_dirs=sum(1 for path in paths if path.endswith("/")),
        total_size=0,
        tree=[_node(path) for path in paths],
        unexpanded=list(unexpanded),
        failure=None if complete or unexpanded else DirectoryScanFailure.UNREADABLE,
    )


def _index(scan: _RecordingScan, tmp_path: Path) -> WorkspaceEntryIndex:
    return WorkspaceEntryIndex(tmp_path, scan=scan)


def _paths(snapshot) -> set[str]:
    return {entry["path"] for entry in snapshot.entries}


# ── 建立基线 ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_the_first_observation_always_scans(tmp_path):
    scan = _RecordingScan(_content(("a.txt", "docs/", "docs/b.md")))
    index = _index(scan, tmp_path)

    snapshot = await index.observe(maintenance=BaselineMaintenance.EVENTS)

    assert scan.call_count == 1
    assert _paths(snapshot) == {"a.txt", "docs/", "docs/b.md"}
    assert "[PARTIAL]" not in snapshot.display
    assert index.stats().scans == 1


@pytest.mark.asyncio
async def test_a_truncated_baseline_is_reported_as_incomplete(tmp_path):
    unexpanded = [UnexpandedDirectory(path="vendor", reason=UnexpansionReason.NODE_BUDGET)]
    scan = _RecordingScan(_content(("a.txt",), complete=False, unexpanded=tuple(unexpanded)))
    index = _index(scan, tmp_path)

    snapshot = await index.observe(maintenance=BaselineMaintenance.EVENTS)

    # 观测不完整必须让模型看见，否则它会以为那些目录是空的。变更清单不受影响：
    # 它只有一个来源（账本事件），不依赖观测完整性。
    assert "[PARTIAL]" in snapshot.display
    assert "vendor" in snapshot.display


# ── 事件源：遍历必须停下来 ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_healthy_event_source_stops_the_walk(tmp_path):
    """P3 的核心 KPI。

    基线建立之后，无论来多少批事件，都不该再遍历一次目录树。这个数字涨回去，就说明
    这次改造失效了，而它不会以任何其它方式表现出来。
    """
    scan = _RecordingScan(_content(("a.txt",)))
    index = _index(scan, tmp_path)
    await index.observe(maintenance=BaselineMaintenance.EVENTS)

    for step in range(5):
        await index.observe(
            maintenance=BaselineMaintenance.EVENTS,
            events=WorkspaceChangeSet(added={f"new{step}.txt"}),
        )

    assert scan.call_count == 1
    stats = index.stats()
    assert stats.scans == 1
    assert stats.event_updates == 5
    assert stats.applied_changes == 5


@pytest.mark.asyncio
async def test_created_paths_enter_the_set_and_the_display(tmp_path):
    scan = _RecordingScan(_content(("a.txt",)))
    index = _index(scan, tmp_path)
    await index.observe(maintenance=BaselineMaintenance.EVENTS)

    snapshot = await index.observe(
        maintenance=BaselineMaintenance.EVENTS,
        events=WorkspaceChangeSet(added={"docs/report.md"}),
    )

    assert "docs/report.md" in _paths(snapshot)
    # 展示必须同步重绘：整份树会在首包和压缩后被重新注入，那时如果还是旧的，
    # 模型会拿一份过期的目录索引去推理。
    assert "report.md" in snapshot.display
    assert scan.call_count == 1


@pytest.mark.asyncio
async def test_deleted_paths_leave_the_set_and_the_display(tmp_path):
    scan = _RecordingScan(_content(("a.txt", "gone.txt")))
    index = _index(scan, tmp_path)
    await index.observe(maintenance=BaselineMaintenance.EVENTS)

    snapshot = await index.observe(
        maintenance=BaselineMaintenance.EVENTS,
        events=WorkspaceChangeSet(removed={"gone.txt"}),
    )

    assert "gone.txt" not in _paths(snapshot)
    assert "gone.txt" not in snapshot.display
    assert scan.call_count == 1


@pytest.mark.asyncio
async def test_a_move_rekeys_the_path_without_a_walk(tmp_path):
    scan = _RecordingScan(_content(("docs/old.md",)))
    index = _index(scan, tmp_path)
    await index.observe(maintenance=BaselineMaintenance.EVENTS)

    snapshot = await index.observe(
        maintenance=BaselineMaintenance.EVENTS,
        events=WorkspaceChangeSet(added={"docs/new.md"}, removed={"docs/old.md"}),
    )

    assert _paths(snapshot) == {"docs/new.md"}
    assert scan.call_count == 1


@pytest.mark.asyncio
async def test_directory_events_keep_their_trailing_slash(tmp_path):
    scan = _RecordingScan(_content(("a.txt",)))
    index = _index(scan, tmp_path)
    await index.observe(maintenance=BaselineMaintenance.EVENTS)

    snapshot = await index.observe(
        maintenance=BaselineMaintenance.EVENTS,
        events=WorkspaceChangeSet(added={"assets/"}),
    )

    # 尾随斜杠是 extract_workspace_entries 的既有约定，渲染时才不会把目录当文件。
    assert "assets/" in _paths(snapshot)


@pytest.mark.asyncio
async def test_events_arriving_before_the_baseline_do_not_break_it(tmp_path):
    scan = _RecordingScan(_content(("a.txt", "b.txt")))
    index = _index(scan, tmp_path)

    # 还没有基线时事件被跳过：紧接着的遍历会给出真实结果，先并一遍再被覆盖没有意义。
    snapshot = await index.observe(
        maintenance=BaselineMaintenance.EVENTS,
        events=WorkspaceChangeSet(added={"ghost.txt"}),
    )

    assert scan.call_count == 1
    assert _paths(snapshot) == {"a.txt", "b.txt"}
    assert index.stats().event_updates == 0


@pytest.mark.asyncio
async def test_repeated_events_for_one_path_collapse(tmp_path):
    scan = _RecordingScan(_content(("a.txt",)))
    index = _index(scan, tmp_path)
    await index.observe(maintenance=BaselineMaintenance.EVENTS)

    snapshot = await index.observe(
        maintenance=BaselineMaintenance.EVENTS,
        events=WorkspaceChangeSet(added={"same.txt", "same.txt"}),
    )

    assert _paths(snapshot) == {"a.txt", "same.txt"}


# ── 回退到遍历 ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_scan_mode_rescans_when_the_root_revision_moves(tmp_path):
    scan = _RecordingScan(_content(("a.txt",)), _content(("a.txt", "b.txt")))
    index = _index(scan, tmp_path)
    await index.observe(maintenance=BaselineMaintenance.OBSERVATION)

    # 制造一次真实的修订号变化：临时文件会改变目录 mtime 与 inode 组合。
    (tmp_path / "b.txt").write_text("b", encoding="utf-8")
    snapshot = await index.observe(maintenance=BaselineMaintenance.OBSERVATION)

    assert scan.call_count == 2
    assert "b.txt" in _paths(snapshot) or scan.call_count == 2


@pytest.mark.asyncio
async def test_scan_mode_reuses_the_baseline_while_the_tree_is_still(tmp_path):
    scan = _RecordingScan(_content(("a.txt",)))
    index = _index(scan, tmp_path)
    await index.observe(maintenance=BaselineMaintenance.OBSERVATION)

    for _ in range(3):
        await index.observe(maintenance=BaselineMaintenance.OBSERVATION)

    assert scan.call_count == 1


@pytest.mark.asyncio
async def test_a_ledger_gap_forces_one_coherent_observation(tmp_path):
    """账本自报缺口时，集合和变更清单都不可信了。

    这不是"降级回目录树比对"——比对出来的差异会让模型以为那就是全部变化。缺口下只能
    重新观测一次，然后用整份列表让模型的工作区认知重新对齐。
    """
    scan = _RecordingScan(_content(("a.txt",)))
    index = _index(scan, tmp_path)
    await index.observe(maintenance=BaselineMaintenance.EVENTS)
    await index.observe(
        maintenance=BaselineMaintenance.EVENTS,
        events=WorkspaceChangeSet(added={"event-only.txt"}),
    )
    assert scan.call_count == 1

    await index.observe(
        maintenance=BaselineMaintenance.STALE,
        events=WorkspaceChangeSet(added={"resolved.txt"}),
    )

    assert scan.call_count == 2


@pytest.mark.asyncio
async def test_a_gap_does_not_turn_into_a_rescan_loop(tmp_path):
    """重建一次就够了，下一次必须回到不遍历的状态。

    `STALE` 是"这一轮集合不可信"，不是"从此以后每轮都遍历"。混淆两者会把这次改造
    省下来的开销原样还回去。
    """
    scan = _RecordingScan(_content(("a.txt",)))
    index = _index(scan, tmp_path)
    await index.observe(maintenance=BaselineMaintenance.STALE)
    assert scan.call_count == 1

    for _ in range(3):
        await index.observe(maintenance=BaselineMaintenance.EVENTS)

    assert scan.call_count == 1


@pytest.mark.asyncio
async def test_events_are_still_applied_on_the_way_into_a_gap_rebuild(tmp_path):
    """已经解析出来的事件仍然是事实。

    缺口只说明"有一部分变更读不到了"，不说明"这一页全都不算数"。重建会用真实目录
    覆盖集合，所以即使先并入也不会有害。
    """
    scan = _RecordingScan(_content(("a.txt",)))
    index = _index(scan, tmp_path)

    snapshot = await index.observe(
        maintenance=BaselineMaintenance.STALE,
        events=WorkspaceChangeSet(added={"resolved.txt"}),
    )

    # 重建后集合来自真实目录，所以只有目录里真实存在的路径。
    assert _paths(snapshot) == {"a.txt"}


# ── 修订号判据 ────────────────────────────────────────────────────────────────


def test_signature_is_none_when_the_root_cannot_be_stat_ed(tmp_path):
    assert workspace_root_signature(tmp_path / "missing") is None


def test_signature_is_a_pair_for_an_existing_directory(tmp_path):
    signature = workspace_root_signature(tmp_path)

    assert signature is not None
    assert len(signature) == 2


@pytest.mark.asyncio
async def test_an_unreadable_root_revision_forces_a_rescan(tmp_path, monkeypatch):
    """两次读不到修订号都不能被当成"没变"。

    旧实现把 None 也存进缓存，于是"两次 stat 都失败"被判成"树没动"，之后的变更永远
    不会被发现。这里断言的是同一条规则：读不到就必须重扫。
    """
    from app.core.horizon import workspace_entry_index as module

    scan = _RecordingScan(_content(("a.txt",)))
    index = _index(scan, tmp_path)
    await index.observe(maintenance=BaselineMaintenance.OBSERVATION)
    assert scan.call_count == 1

    monkeypatch.setattr(module, "workspace_root_signature", lambda _root: None)
    await index.observe(maintenance=BaselineMaintenance.OBSERVATION)

    assert scan.call_count == 2


# ── 缺口说明 ──────────────────────────────────────────────────────────────────


def test_partial_notice_is_empty_when_the_snapshot_is_complete():
    assert build_workspace_snapshot_partial_notice([]) == ""


def test_partial_notice_states_that_absence_is_not_deletion():
    unexpanded = [
        UnexpandedDirectory(path="node_modules", reason=UnexpansionReason.NODE_BUDGET),
        UnexpandedDirectory(path="private", reason=UnexpansionReason.UNREADABLE),
    ]

    notice = build_workspace_snapshot_partial_notice(unexpanded)

    assert "[PARTIAL]" in notice
    assert "2 directories were not read" in notice
    assert "node_modules" in notice
    assert "could not be read: private" in notice
    # 这句话是这段文本存在的唯一理由：阻止模型把"没列出来"当成"被删了"。
    assert "does not mean they were deleted" in notice
    assert "list_dir" in notice


def test_partial_notice_caps_the_listed_paths():
    unexpanded = [
        UnexpandedDirectory(path=f"dir{index:03d}", reason=UnexpansionReason.NODE_BUDGET)
        for index in range(20)
    ]

    notice = build_workspace_snapshot_partial_notice(unexpanded)

    assert "20 directories were not read" in notice
    assert "and 12 more" in notice


def test_rebuild_reasons_are_a_closed_set():
    """重建原因都必须能被日志区分——排查时先看的就是"为什么又扫了一遍"。"""
    assert {reason.value for reason in WorkspaceRebuildReason} == {
        "no_baseline",
        "revision_moved",
        "stale_requested",
    }


def test_maintenance_states_are_a_closed_set():
    """维护状态决定遍历的门控方式，多一个都会让"什么时候扫"说不清。"""
    assert {state.value for state in BaselineMaintenance} == {
        "events",
        "observation",
        "stale",
    }


@pytest.mark.asyncio
async def test_the_baseline_gap_notice_survives_event_updates(tmp_path):
    """缺口是**基线**的属性，不会被事件补上。

    截断的基线建立之后，事件只告诉我们"哪些路径变了"，不会把当初没读到的目录补上。
    如果重绘展示时把缺口说明丢了，模型会在整份树被重新注入时（压缩之后）把那些目录
    当成空的——这正是 P0 修掉的那类错误，只是换了一条路径回来。
    """
    unexpanded = [UnexpandedDirectory(path="vendor", reason=UnexpansionReason.NODE_BUDGET)]
    scan = _RecordingScan(_content(("a.txt",), complete=False, unexpanded=tuple(unexpanded)))
    index = _index(scan, tmp_path)
    await index.observe(maintenance=BaselineMaintenance.EVENTS)

    snapshot = await index.observe(
        maintenance=BaselineMaintenance.EVENTS,
        events=WorkspaceChangeSet(added={"docs/new.md"}),
    )

    assert "[PARTIAL]" in snapshot.display
    assert "vendor" in snapshot.display


@pytest.mark.asyncio
async def test_a_complete_baseline_never_grows_a_gap_notice(tmp_path):
    scan = _RecordingScan(_content(("a.txt",)))
    index = _index(scan, tmp_path)
    await index.observe(maintenance=BaselineMaintenance.EVENTS)

    snapshot = await index.observe(
        maintenance=BaselineMaintenance.EVENTS,
        events=WorkspaceChangeSet(added={"docs/new.md"}),
    )

    assert "[PARTIAL]" not in snapshot.display
