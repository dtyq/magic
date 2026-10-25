# -*- coding: utf-8 -*-
"""`list_dir` 工具的"说真话"契约测试。

工具与工作区快照的诉求相反，因此护栏也必须相反：

- 工具是模型主动发起的查询，**必须忠于 `level`**：不设遍历条目上限，只设时间上限防挂死。
  输出体积由 `ToolResultContentManager` 统一落文件并告知路径，那比在这里偷偷截断更诚实。
- 快照是每轮自动跑的观测，成本必须封顶（见 `tests/utils/test_directory_scan.py`）。

这个文件守住的是第一点，以及在真的必须截断时**模型能不能知道缺了什么**。
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from agentlang.context.tool_context import ToolContext
from app.core.entity.message.server_message import DisplayType
from app.tools import list_dir as list_dir_module
from app.tools.list_dir import LIST_DIR_MAX_LEVEL, ListDir, ListDirParams
from app.utils.directory_scan import DirectoryScanBudget


def _build(root: Path, spec: dict[str, str | None]) -> None:
    for relative_path, body in spec.items():
        target = root / relative_path
        if body is None:
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(body, encoding="utf-8")


async def _run(tool: ListDir, arguments: dict) -> tuple[str, ToolContext]:
    tool_context = ToolContext(tool_name="list_dir", arguments=arguments)
    result = await tool.execute(tool_context, ListDirParams(**arguments))
    return result.content, tool_context


# ── 契约：工具不设遍历条目上限 ────────────────────────────────────────────────


def test_tool_budget_has_no_node_or_byte_cap():
    """工具唯一的护栏是时间；条目数上限会破坏"忠于 level"的语义。"""
    assert list_dir_module._LIST_DIR_BUDGET.max_nodes is None
    assert list_dir_module._LIST_DIR_BUDGET.max_bytes is None
    assert list_dir_module._LIST_DIR_BUDGET.max_seconds == list_dir_module.LIST_DIR_SCAN_MAX_SECONDS


@pytest.mark.asyncio
async def test_tool_lists_every_entry_of_a_wide_directory(tmp_path):
    _build(tmp_path, {f"file{index:03d}.txt": "x\n" for index in range(150)})

    content, _ = await _run(ListDir(base_dir=tmp_path), {"relative_workspace_path": ".", "level": 1})

    assert content.count("[FILE]") == 150
    assert "[PARTIAL LISTING]" not in content


@pytest.mark.asyncio
async def test_tool_keeps_every_level_it_was_asked_for(tmp_path):
    _build(tmp_path, {"a/b/c/d/deep.txt": "deep\n"})

    # level=N 表示展开到第 N 层，所以 a/b/c/d/deep.txt 需要 level=5。
    content, _ = await _run(ListDir(base_dir=tmp_path), {"relative_workspace_path": ".", "level": 5})

    assert "[DIR] d/" in content
    assert "deep.txt" in content
    assert "[PARTIAL LISTING]" not in content


@pytest.mark.asyncio
async def test_tool_level_is_clamped_instead_of_failing(tmp_path):
    _build(tmp_path, {"a/b/x.txt": "x\n"})
    tool = ListDir(base_dir=tmp_path)

    too_deep, _ = await _run(tool, {"relative_workspace_path": ".", "level": 99})
    too_shallow, _ = await _run(tool, {"relative_workspace_path": ".", "level": 0})

    # 超范围收敛到边界值继续服务，而不是把提示词错误变成一次失败的工具调用。
    assert too_deep == tool.get_file_tree_string(".", LIST_DIR_MAX_LEVEL, False)
    assert too_shallow == tool.get_file_tree_string(".", 1, False)


# ── 截断必须可归因、可续查 ────────────────────────────────────────────────────


def _patched_scan(os_shim):
    """把共享 os 替换成受限 shim 后再调用真实扫描器，避免在工具层复制扫描逻辑。"""
    from app.utils import directory_scan as scan_module
    from app.utils.directory_scan import scan_directory_tree

    def _scan(*args, **kwargs):
        original = scan_module.os
        scan_module.os = os_shim
        try:
            return scan_directory_tree(*args, **kwargs)
        finally:
            scan_module.os = original

    return _scan


@pytest.mark.asyncio
async def test_partial_listing_names_the_directories_it_could_not_read(tmp_path, monkeypatch):
    _build(tmp_path, {f"dir{index}/inner.txt": "x\n" for index in range(6)})
    # 只给 1 个条目的预算，强制在根目录就截断。
    monkeypatch.setattr(
        list_dir_module, "_LIST_DIR_BUDGET", DirectoryScanBudget(max_nodes=1)
    )

    content, _ = await _run(ListDir(base_dir=tmp_path), {"relative_workspace_path": ".", "level": 3})

    assert "[PARTIAL LISTING]" in content
    assert "Their contents are unknown, not empty." in content
    assert "Call list_dir on one of those paths to list it on its own." in content
    # 关键：不能让模型以为这些目录是空的。
    assert "No files found" not in content


@pytest.mark.asyncio
async def test_partial_listing_is_absent_when_nothing_was_cut(tmp_path):
    _build(tmp_path, {"a.txt": "x\n"})

    content, _ = await _run(ListDir(base_dir=tmp_path), {"relative_workspace_path": ".", "level": 1})

    assert "[PARTIAL LISTING]" not in content


@pytest.mark.asyncio
async def test_unreadable_directory_is_reported_not_silently_empty(tmp_path, monkeypatch):
    blocked = tmp_path / "locked"
    _build(tmp_path, {"locked/inner.txt": "x\n", "ok.txt": "y\n"})

    real_os = os

    class _OsShim:
        @staticmethod
        def scandir(path):
            if Path(path) == blocked:
                raise PermissionError(13, "Permission denied")
            return real_os.scandir(path)

        def __getattr__(self, name):
            return getattr(real_os, name)

    monkeypatch.setattr(list_dir_module, "scan_directory_tree", _patched_scan(_OsShim))

    content, _ = await _run(ListDir(base_dir=tmp_path), {"relative_workspace_path": ".", "level": 2})

    assert "[ERROR]" in content
    assert "[PARTIAL LISTING]" in content
    assert "could not be read: locked" in content
    assert "ok.txt" in content


# ── 错误路径：模型可读的英文说明 ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_missing_path_returns_an_english_explanation(tmp_path):
    content, _ = await _run(
        ListDir(base_dir=tmp_path), {"relative_workspace_path": "nope", "level": 1}
    )

    assert content.startswith("Path does not exist:")
    assert str(tmp_path / "nope") in content


@pytest.mark.asyncio
async def test_file_path_is_rejected_as_not_a_directory(tmp_path):
    _build(tmp_path, {"a.txt": "x\n"})

    content, _ = await _run(
        ListDir(base_dir=tmp_path), {"relative_workspace_path": "a.txt", "level": 1}
    )

    assert content.startswith("Path is not a directory:")


# ── 工具详情：展示结构与缺口一起交付 ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_tool_detail_carries_the_same_incomplete_tree(tmp_path, monkeypatch):
    _build(tmp_path, {f"dir{index}/inner.txt": "x\n" for index in range(6)})
    monkeypatch.setattr(
        list_dir_module, "_LIST_DIR_BUDGET", DirectoryScanBudget(max_nodes=1)
    )
    tool = ListDir(base_dir=tmp_path)
    arguments = {"relative_workspace_path": ".", "level": 3}
    tool_context = ToolContext(tool_name="list_dir", arguments=arguments)

    result = await tool.execute(tool_context, ListDirParams(**arguments))
    detail = await tool.get_tool_detail(tool_context, result, arguments)

    assert result.ok
    assert detail is not None
    assert detail.type == DisplayType.FILE_TREE
    assert detail.data.complete is False
    assert detail.data.unexpanded
