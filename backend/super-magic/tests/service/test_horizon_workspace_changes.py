# -*- coding: utf-8 -*-
"""`<workspace_files_changed>` 与 `<workspace_files_refreshed>` 的交付契约。

变更清单只有一个来源：变更账本事件。这一层因此不需要再判断"这份清单完不完整"——
事件本身就是结论。它要守住的是另外三件事：

1. 有变化就报、报完就清（不能重复注入，也不能因为一次预算失败永久丢掉）；
2. 账本自报缺口时，改交**事实**而不是清单：整份重发当前工作区列表；
3. 两种交付都只在正文真的进了历史之后才推进状态。
"""

from __future__ import annotations

import pytest

from app.core.context.agent_context import AgentContext
from app.core.horizon.agent_horizon import (
    HORIZON_CONTEXT_OVERSIZED_NOTICE,
    AgentHorizon,
)
from app.core.horizon.models import HorizonInjectionPoint
from app.core.horizon.store import HorizonStore
from app.infrastructure.changefeed.workspace_path_changes import WorkspaceChangeSet
from app.utils.file_utils import WorkspaceSnapshot

_TREE = "[DIR] ./\n└─[FILE] a.txt (8B)"


def _snapshot(display: str = _TREE) -> WorkspaceSnapshot:
    return WorkspaceSnapshot(display=display, entries=[{"path": "a.txt", "size": 8}])


async def _horizon(tmp_path) -> AgentHorizon:
    store = HorizonStore(str(tmp_path), "test-agent", "agent-1")
    return AgentHorizon(store, "agent-1")


# ── 变更清单 ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ledger_changes_are_injected_as_a_named_list(tmp_path):
    horizon = await _horizon(tmp_path)
    await horizon.set_workspace_snapshot(_snapshot())
    await horizon.build_context_update(HorizonInjectionPoint.BEFORE_FIRST_LLM)

    horizon.add_workspace_changes(
        WorkspaceChangeSet(added={"docs/new.md"}, removed={"docs/old.md"})
    )
    context = await horizon.build_context_update(HorizonInjectionPoint.AFTER_TOOL_RESULT)

    assert "<workspace_files_changed>" in context
    assert "+1 added: docs/new.md" in context
    assert "-1 removed: docs/old.md" in context


@pytest.mark.asyncio
async def test_a_large_change_list_falls_back_to_counts(tmp_path):
    horizon = await _horizon(tmp_path)
    await horizon.set_workspace_snapshot(_snapshot())
    await horizon.build_context_update(HorizonInjectionPoint.BEFORE_FIRST_LLM)

    horizon.add_workspace_changes(
        WorkspaceChangeSet(added={f"f{index}.txt" for index in range(20)})
    )
    context = await horizon.build_context_update(HorizonInjectionPoint.AFTER_TOOL_RESULT)

    # 一段几百行的清单既占上下文又没有信息量。
    assert "+20 files/dirs added" in context
    assert "f19.txt" not in context


@pytest.mark.asyncio
async def test_no_changes_means_no_block(tmp_path):
    horizon = await _horizon(tmp_path)
    await horizon.set_workspace_snapshot(_snapshot())
    await horizon.build_context_update(HorizonInjectionPoint.BEFORE_FIRST_LLM)

    context = await horizon.build_context_update(HorizonInjectionPoint.AFTER_TOOL_RESULT)

    assert "<workspace_files_changed>" not in context


@pytest.mark.asyncio
async def test_delivered_changes_are_not_repeated(tmp_path):
    horizon = await _horizon(tmp_path)
    await horizon.set_workspace_snapshot(_snapshot())
    await horizon.build_context_update(HorizonInjectionPoint.BEFORE_FIRST_LLM)
    horizon.add_workspace_changes(WorkspaceChangeSet(added={"docs/new.md"}))

    first = await horizon.build_context_update(HorizonInjectionPoint.AFTER_TOOL_RESULT)
    second = await horizon.build_context_update(HorizonInjectionPoint.AFTER_TOOL_RESULT)

    assert "docs/new.md" in first
    # 交付过就必须清空：同一批变化重复注入会让模型以为文件被反复改动。
    assert "docs/new.md" not in second


@pytest.mark.asyncio
async def test_changes_survive_an_oversized_update(tmp_path):
    """整包超限时不能清空队列。

    超限时 Horizon 提前返回轻量提示、不推进任何 baseline；如果这时候把队列清掉，
    这些变化就被永久丢掉了，而且完全无声。
    """
    horizon = await _horizon(tmp_path)
    await horizon.set_workspace_snapshot(_snapshot())
    await horizon.build_context_update(HorizonInjectionPoint.BEFORE_FIRST_LLM)

    horizon.add_workspace_changes(WorkspaceChangeSet(added={"docs/new.md"}))
    # 用一份超大的客户端上下文把整包顶过预算。
    await horizon.set_client_context("x" * 400_000)
    oversized = await horizon.build_context_update(HorizonInjectionPoint.AFTER_TOOL_RESULT)
    assert oversized == HORIZON_CONTEXT_OVERSIZED_NOTICE

    await horizon.set_client_context("")
    retried = await horizon.build_context_update(HorizonInjectionPoint.AFTER_TOOL_RESULT)
    assert "docs/new.md" in retried


# ── 缺口后的整份重发 ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_refresh_request_reinjects_the_full_listing(tmp_path):
    """账本自报缺口时，逐条列举无从谈起，只能把当前这份观测整份交给模型。"""
    horizon = await _horizon(tmp_path)
    await horizon.set_workspace_snapshot(_snapshot())
    await horizon.build_context_update(HorizonInjectionPoint.BEFORE_FIRST_LLM)

    horizon.request_workspace_files_refresh()
    context = await horizon.build_context_update(HorizonInjectionPoint.AFTER_TOOL_RESULT)

    assert "<workspace_files_refreshed>" in context
    # 必须明确说明这是全量状态而不是变更清单，否则模型会把差异当成全部变化。
    assert "cannot be listed" in context
    assert "a.txt" in context


@pytest.mark.asyncio
async def test_a_refresh_is_delivered_once(tmp_path):
    horizon = await _horizon(tmp_path)
    await horizon.set_workspace_snapshot(_snapshot())
    await horizon.build_context_update(HorizonInjectionPoint.BEFORE_FIRST_LLM)
    horizon.request_workspace_files_refresh()

    first = await horizon.build_context_update(HorizonInjectionPoint.AFTER_TOOL_RESULT)
    second = await horizon.build_context_update(HorizonInjectionPoint.AFTER_TOOL_RESULT)

    assert "<workspace_files_refreshed>" in first
    assert "<workspace_files_refreshed>" not in second


@pytest.mark.asyncio
async def test_a_refresh_survives_an_oversized_update(tmp_path):
    horizon = await _horizon(tmp_path)
    await horizon.set_workspace_snapshot(_snapshot())
    await horizon.build_context_update(HorizonInjectionPoint.BEFORE_FIRST_LLM)
    horizon.request_workspace_files_refresh()

    await horizon.set_client_context("x" * 400_000)
    oversized = await horizon.build_context_update(HorizonInjectionPoint.AFTER_TOOL_RESULT)
    assert oversized == HORIZON_CONTEXT_OVERSIZED_NOTICE

    await horizon.set_client_context("")
    retried = await horizon.build_context_update(HorizonInjectionPoint.AFTER_TOOL_RESULT)
    assert "<workspace_files_refreshed>" in retried


@pytest.mark.asyncio
async def test_a_refresh_without_a_listing_emits_nothing(tmp_path):
    """还没有任何观测结果时不该发一个空块。"""
    horizon = await _horizon(tmp_path)
    horizon.request_workspace_files_refresh()

    context = await horizon.build_context_update(HorizonInjectionPoint.BEFORE_FIRST_LLM)

    assert "<workspace_files_refreshed>" not in context


@pytest.mark.asyncio
async def test_the_workspace_listing_is_persisted_for_a_restart(tmp_path):
    """整份列表会在首包和压缩后重新注入，所以它必须能跨进程恢复。"""
    store = HorizonStore(str(tmp_path), "test-agent", "agent-1")
    horizon = AgentHorizon(store, "agent-1")
    await horizon.set_workspace_snapshot(_snapshot())
    await horizon.build_context_update(HorizonInjectionPoint.BEFORE_FIRST_LLM)

    reloaded = await store.load()

    assert reloaded is not None
    assert reloaded.workspace_files == _TREE


@pytest.mark.asyncio
async def test_an_empty_snapshot_does_not_overwrite_a_known_listing(tmp_path):
    context = AgentContext(isolated=True)
    context.agent_name = "magic"
    context.set_chat_history_dir(str(tmp_path))
    horizon = await _horizon(tmp_path)

    await horizon.set_workspace_snapshot(_snapshot())
    await horizon.build_context_update(HorizonInjectionPoint.BEFORE_FIRST_LLM)

    # 一次采集失败的快照不该把已知的目录索引抹成空——那会让模型以为工作区没了。
    await horizon.set_workspace_snapshot(WorkspaceSnapshot(display=""))
    context_after = await horizon.build_context_update(HorizonInjectionPoint.AFTER_TOOL_RESULT)

    assert "workspace_files_cleared" not in context_after
