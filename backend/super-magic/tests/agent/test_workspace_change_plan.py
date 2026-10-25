# -*- coding: utf-8 -*-
"""变更账本投递计划的测试。

`_plan_workspace_change_delivery` 回答三个问题：本轮谁负责变更、游标推进到哪、报什么。
每一个答错都有真实代价——报错了模型相信一个假事实，游标推错了要么重复上报、要么永久
漏掉一段变更，来源选错了要么白扫一遍目录树、要么让模型看不到变化。所以它被做成纯函数，
好在这里逐条钉住。
"""

from __future__ import annotations

from app.core.horizon.workspace_entry_index import BaselineMaintenance
from app.infrastructure.changefeed.change_ledger_client import (
    ChangeFileType,
    ChangeOperation,
    LedgerChange,
    LedgerPage,
)
from app.magic.agent import (
    _plan_workspace_change_delivery,
    _unmaintained_delivery,
    _WorkspaceChangeSkip,
)


def _page(
    revision: int,
    *changes: LedgerChange,
    cursor_expired: bool = False,
    oldest_revision: int = 1,
) -> LedgerPage:
    return LedgerPage(
        mount="/magicfs/project",
        space="project",
        revision=revision,
        oldest_revision=oldest_revision,
        cursor_expired=cursor_expired,
        has_more=False,
        changes=changes,
    )


def _create(path: str, revision: int = 1) -> LedgerChange:
    return LedgerChange(
        revision=revision,
        operation=ChangeOperation.CREATE,
        file_id="f",
        file_type=ChangeFileType.FILE,
        path=path,
    )


# ── 正常投递 ──────────────────────────────────────────────────────────────────


def test_a_normal_page_advances_the_cursor_and_reports_its_changes():
    plan = _plan_workspace_change_delivery(
        _page(137, _create("/docs/a.md")), cursor=100, primed=True
    )

    assert plan.maintenance is BaselineMaintenance.EVENTS
    assert plan.cursor == 137
    assert plan.skipped is None
    assert plan.changes.added == {"docs/a.md"}


def test_an_empty_advancing_page_moves_the_cursor_without_reporting_anything():
    # head-only 页会推进游标但不带行：游标必须跟着走，否则每次都要重读这一段。
    plan = _plan_workspace_change_delivery(_page(137), cursor=100, primed=True)

    assert plan.maintenance is BaselineMaintenance.EVENTS
    assert plan.cursor == 137
    assert plan.changes.empty


def test_unresolved_changes_still_count_as_events_and_fall_back_to_the_walk():
    """解析不出路径的变更说明条目集合必然缺项。

    已经解析出来的那部分仍然是可证明的事实，照常上报；但权威来源必须交回目录遍历，
    否则这个缺口永远不会被补上。
    """
    plan = _plan_workspace_change_delivery(
        _page(5, _create("/good.md"), _create("")), cursor=0, primed=True
    )

    assert plan.maintenance is BaselineMaintenance.STALE
    assert plan.skipped is _WorkspaceChangeSkip.UNRESOLVED
    assert plan.changes.added == {"good.md"}
    assert plan.changes.unresolved == 1


# ── 首次读取 ──────────────────────────────────────────────────────────────────


def test_the_first_page_primes_the_cursor_instead_of_replaying_history():
    """首次读取只对齐起点。

    账本里可能存着这个沙箱更早的历史（会话恢复、Claw 长生命周期、agent 进程重启）。
    把这些当成"刚发生的变化"报出去，模型会把一条早已过期、文件甚至已被重建的 `delete`
    读成"这个文件刚被删了"。起点之前的状态由 `<workspace_files>` 全量注入负责。
    """
    plan = _plan_workspace_change_delivery(
        _page(12, _create("/a.md", revision=12)), cursor=0, primed=False
    )

    assert plan.maintenance is BaselineMaintenance.EVENTS
    assert plan.cursor == 12
    assert plan.changes.empty
    assert plan.skipped is _WorkspaceChangeSkip.PRIMING


def test_priming_takes_precedence_over_an_expired_window():
    """首次读取即便窗口已过期，也只算"对齐起点"，不算连续性中断。

    顺序是刻意的：全新进程第一次读账本时，"这段历史已经不存在了"没有任何处置意义
    ——本来就不需要它。把它报成 warning 只会让每次冷启动都带一条假警报，而假警报会
    训练出"这条日志可以忽略"的习惯，等真的连续性中断时就没人看了。
    """
    plan = _plan_workspace_change_delivery(
        _page(500, cursor_expired=True), cursor=0, primed=False
    )

    assert plan.skipped is _WorkspaceChangeSkip.PRIMING
    assert plan.maintenance is BaselineMaintenance.EVENTS
    assert plan.cursor == 500


# ── 连续性中断 ────────────────────────────────────────────────────────────────


def test_an_expired_cursor_reports_nothing_and_hands_over_to_the_walk():
    """窗口挤掉了这段 revision：列表必然不完整，所以一条都不能报。"""
    plan = _plan_workspace_change_delivery(
        _page(200, _create("/docs/a.md", revision=199), cursor_expired=True),
        cursor=100,
        primed=True,
    )

    assert plan.maintenance is BaselineMaintenance.STALE
    assert plan.cursor == 200
    assert plan.changes.empty
    assert plan.skipped is _WorkspaceChangeSkip.EXPIRED


def test_a_cursor_regression_reports_nothing_and_hands_over_to_the_walk():
    """agfs 侧重启或文件树被重置：revision 换了时间线。

    此时无法区分"模型上次之后新发生的"和"重放出来的历史"。历史里的 delete 报出去就是
    一条假删除——模型会以为文件刚被删掉，而它可能早就被重建了。
    """
    plan = _plan_workspace_change_delivery(
        _page(40, _create("/docs/a.md", revision=39)),
        cursor=100,
        primed=True,
    )

    assert plan.maintenance is BaselineMaintenance.STALE
    assert plan.cursor == 40
    assert plan.changes.empty
    assert plan.skipped is _WorkspaceChangeSkip.REGRESSION


def test_a_page_at_the_same_revision_is_not_a_regression():
    plan = _plan_workspace_change_delivery(_page(100), cursor=100, primed=True)

    assert plan.maintenance is BaselineMaintenance.EVENTS
    assert plan.cursor == 100


# ── 账本不参与时 ──────────────────────────────────────────────────────────────


def test_the_unmaintained_delivery_keeps_the_cursor_where_it_was():
    """游标不动是刻意的：账本恢复后要从同一个位置接着读。

    跳过一段就等于把那段时间里的远端变更永久丢掉，而那种丢失完全无声。
    """
    plan = _unmaintained_delivery(4321, _WorkspaceChangeSkip.UNAVAILABLE)

    assert plan.maintenance is BaselineMaintenance.OBSERVATION
    assert plan.cursor == 4321
    assert plan.changes.empty
    assert plan.skipped is _WorkspaceChangeSkip.UNAVAILABLE
    # 读不到账本不是"缺口"：变更没丢，只是这一轮没有清单，所以不该让模型整份重新对齐。
    assert plan.is_gap is False
