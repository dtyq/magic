# -*- coding: utf-8 -*-
"""目录扫描引擎的契约测试。

这个文件的核心不是"函数返回值对不对"，而是**不完整的结果能不能被认出来**：
截断必须留下可归因的记录，否则消费方会把"没读到"当成"不存在"——那正是历史上
`<workspace_files_changed>` 报出假删除的原因。
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from app.core.entity.message.server_message import DirectoryScanFailure, UnexpansionReason
from app.utils import directory_scan
from app.utils.directory_scan import (
    UNBOUNDED_SCAN,
    DirectoryScanBudget,
    describe_unexpanded,
    scan_directory_tree,
)


def _scan(root: Path, **kwargs):
    kwargs.setdefault("relative_path", ".")
    kwargs.setdefault("level", 3)
    return scan_directory_tree(root, **kwargs)


def _tree_paths(content) -> set[str]:
    """收集结果里出现过的全部相对路径（目录带尾随 /）。"""

    def walk(nodes) -> set[str]:
        found: set[str] = set()
        for node in nodes or []:
            if node.error:
                continue
            found.add(node.relative_file_path + "/" if node.is_directory else node.relative_file_path)
            found |= walk(node.children)
        return found

    return walk(content.tree)


def _build_tree(root: Path, spec: dict[str, str | None]) -> None:
    """spec: 相对路径 -> 文件内容；None 表示建目录。"""
    for relative_path, body in spec.items():
        target = root / relative_path
        if body is None:
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(body, encoding="utf-8")


# ── 正常扫描 ──────────────────────────────────────────────────────────────────


def test_complete_scan_reports_every_path_and_no_gap(tmp_path):
    _build_tree(
        tmp_path,
        {
            "src": None,
            "src/main.py": "print('hi')\n",
            "docs": None,
            "docs/readme.md": "# readme\n",
            "top.txt": "top\n",
        },
    )

    content = _scan(tmp_path)

    assert content.failure is None
    assert content.unexpanded == []
    assert content.complete is True
    assert content.total_files == 3
    assert content.total_dirs == 2
    assert _tree_paths(content) == {
        "src/",
        "src/main.py",
        "docs/",
        "docs/readme.md",
        "top.txt",
    }


def test_empty_directory_is_complete_not_a_failure(tmp_path):
    content = _scan(tmp_path)

    assert content.tree == []
    assert content.failure is None
    # 空目录是完整观测，不是缺口：消费方必须能把它和"没读到"分开。
    assert content.complete is True


def test_depth_limit_is_requested_semantics_not_a_gap(tmp_path):
    _build_tree(tmp_path, {"a/b/c/deep.txt": "deep\n"})

    content = _scan(tmp_path, level=1)

    # a/ 出现在结果里但没有子项；这是 level=1 要求的语义，不是预算缺口。
    assert _tree_paths(content) == {"a/"}
    assert content.unexpanded == []
    assert content.complete is True


def test_hidden_entries_are_skipped_but_magic_dir_is_visible(tmp_path):
    _build_tree(
        tmp_path,
        {
            ".hidden": "x",
            ".git": None,
            ".git/config": "y",
            ".magic": None,
            ".magic/MEMORY.md": "memory\n",
        },
    )

    content = _scan(tmp_path)

    assert _tree_paths(content) == {".magic/", ".magic/MEMORY.md"}
    assert content.complete is True


def test_filter_binary_drops_non_text_files(tmp_path):
    _build_tree(tmp_path, {"notes.md": "text\n", "blob.bin": "\x00\x01\x02binary\x00"})

    filtered = _scan(tmp_path, filter_binary=True)
    unfiltered = _scan(tmp_path, filter_binary=False)

    assert _tree_paths(filtered) == {"notes.md"}
    assert _tree_paths(unfiltered) == {"notes.md", "blob.bin"}
    # 过滤是调用方要求的语义，同样不算缺口。
    assert filtered.complete is True


# ── 预算：必须可归因 ──────────────────────────────────────────────────────────


@pytest.mark.parametrize("max_nodes", [1, 2, 3, 5, 9])
def test_node_budget_never_hides_a_path_without_recording_it(tmp_path, max_nodes):
    """核心不变量：结果里缺的内容，必须在 unexpanded 里被点名。

    这条断言就是"假删除"的守门人。做法是把扫描结果和真实目录逐层对比：任何一个目录
    的真实子项数多于结果里的子项数，这个目录就必须出现在 unexpanded 里。
    """
    _build_tree(
        tmp_path,
        {
            **{f"d{index}": None for index in range(6)},
            **{f"d{index}/f{index}.txt": "x\n" for index in range(6)},
            "root.txt": "root\n",
        },
    )

    content = _scan(tmp_path, budget=DirectoryScanBudget(max_nodes=max_nodes))
    recorded = {item.path for item in content.unexpanded}

    def expected_children(relative_directory: str) -> set[str]:
        directory = tmp_path if relative_directory == "." else tmp_path / relative_directory
        return {
            entry.name
            for entry in os.scandir(directory)
            if not entry.name.startswith(".")
        }

    def assert_no_silent_gap(nodes, parent_relative: str) -> None:
        observed = {node.file_name for node in nodes if not node.error}
        expected = expected_children(parent_relative)
        assert observed <= expected
        if observed != expected:
            assert parent_relative in recorded, (
                f"{parent_relative} 少了 {sorted(expected - observed)} 但没有被登记为未展开"
            )
        for node in nodes:
            if node.is_directory and not node.error:
                assert_no_silent_gap(node.children or [], node.relative_file_path)

    assert_no_silent_gap(content.tree, ".")

    if max_nodes < 13:
        assert content.complete is False
        assert recorded
        assert all(item.reason is UnexpansionReason.NODE_BUDGET for item in content.unexpanded)
    else:
        assert content.complete is True


def test_node_budget_keeps_the_directory_handle_for_unread_subtrees(tmp_path):
    _build_tree(tmp_path, {f"dir{index}/file.txt": "x\n" for index in range(5)})

    content = _scan(tmp_path, budget=DirectoryScanBudget(max_nodes=1))

    directory_nodes = [node for node in content.tree if node.is_directory and not node.error]
    assert directory_nodes, "被预算挡住的目录仍要作为续查入口出现在树里"
    recorded = {item.path for item in content.unexpanded}
    for node in directory_nodes:
        # 这些目录的子项没被读到，所以必须被点名，模型才知道要单独 list_dir 一次。
        assert node.children is None
        assert node.relative_file_path in recorded
    assert content.complete is False


def test_byte_budget_marks_the_directory_it_cut(tmp_path):
    _build_tree(tmp_path, {f"file{index:03d}.txt": "x\n" for index in range(40)})

    # 每个条目的估算开销是 128 + 路径 + 名字，40 个条目远超这个预算。
    content = _scan(tmp_path, budget=DirectoryScanBudget(max_bytes=600))

    assert content.complete is False
    assert [(item.path, item.reason) for item in content.unexpanded] == [
        (".", UnexpansionReason.BYTE_BUDGET)
    ]
    assert len(content.tree) < 40


def test_time_budget_marks_the_directory_it_cut(tmp_path, monkeypatch):
    _build_tree(tmp_path, {f"f{index}.txt": "x\n" for index in range(10)})

    ticks = iter([0.0, 0.0, 0.0, 999.0])

    class _Clock:
        @staticmethod
        def monotonic() -> float:
            return next(ticks, 999.0)

    # 只替换本模块看到的 time 引用，避免影响其它使用真实时钟的代码。
    monkeypatch.setattr(directory_scan, "time", _Clock)

    content = _scan(tmp_path, budget=DirectoryScanBudget(max_seconds=1.0))

    assert content.complete is False
    assert [item.reason for item in content.unexpanded] == [UnexpansionReason.TIME_BUDGET]
    # 截断前的条目照常产出，不是整棵树丢掉。
    assert content.tree


def test_unreadable_directory_is_recorded_and_marked_in_the_tree(tmp_path, monkeypatch):
    blocked = tmp_path / "locked"
    _build_tree(tmp_path, {"locked/inner.txt": "x\n", "ok.txt": "y\n"})

    real_os = os

    class _OsShim:
        @staticmethod
        def scandir(path):
            if Path(path) == blocked:
                raise PermissionError(13, "Permission denied")
            return real_os.scandir(path)

        def __getattr__(self, name):
            return getattr(real_os, name)

    monkeypatch.setattr(directory_scan, "os", _OsShim)

    content = _scan(tmp_path)

    # 单个目录读不了不算整次扫描失败：它只在树里留一个错误节点，并让结果变成不完整。
    assert content.failure is None
    assert content.complete is False
    assert ("locked", UnexpansionReason.UNREADABLE) in [
        (item.path, item.reason) for item in content.unexpanded
    ]
    locked_node = next(node for node in content.tree if node.relative_file_path == "locked")
    assert locked_node.is_directory
    assert any(child.error for child in locked_node.children or [])


def test_budget_hit_stops_before_recursing_further(tmp_path):
    _build_tree(tmp_path, {f"a{i}/b{i}/c{i}/deep.txt": "x\n" for i in range(4)})

    content = _scan(tmp_path, budget=DirectoryScanBudget(max_nodes=2))

    # 深层的目录不可能被读到时，不会为它们各写一条记录：记录条数受深度约束，
    # 不随目录宽度膨胀。
    assert len(content.unexpanded) <= 3
    assert content.complete is False


# ── 失败路径 ──────────────────────────────────────────────────────────────────


def test_missing_path_reports_not_found_and_incomplete(tmp_path):
    content = _scan(tmp_path / "nope")

    assert content.failure is DirectoryScanFailure.NOT_FOUND
    assert content.tree == []
    assert content.complete is False


def test_file_path_reports_not_a_directory(tmp_path):
    target = tmp_path / "a.txt"
    target.write_text("x", encoding="utf-8")

    content = _scan(target)

    assert content.failure is DirectoryScanFailure.NOT_A_DIRECTORY
    assert content.complete is False


def test_unexpected_error_reports_unreadable_rather_than_an_empty_workspace(tmp_path, monkeypatch):
    def _explode(*args, **kwargs):
        raise RuntimeError("mount went away")

    monkeypatch.setattr(directory_scan._DirectoryScanner, "_expand", staticmethod(_explode))

    content = _scan(tmp_path)

    assert content.failure is DirectoryScanFailure.UNREADABLE
    assert content.failure_detail is not None
    # 关键：挂载出错不能被表达成"工作区是空的"。
    assert content.complete is False


# ── 参数契约 ──────────────────────────────────────────────────────────────────


def test_level_below_one_is_a_programming_error(tmp_path):
    with pytest.raises(ValueError, match="level must be >= 1"):
        _scan(tmp_path, level=0)


@pytest.mark.parametrize(
    "kwargs",
    [
        {"max_nodes": 0},
        {"max_nodes": -1},
        {"max_bytes": -1},
        {"max_seconds": 0},
        {"max_seconds": -0.5},
    ],
)
def test_invalid_budgets_are_rejected_at_construction(kwargs):
    """预算写错必须在构造时就炸，而不是把"无界"当成"零界"静默跑完。"""
    with pytest.raises(ValueError):
        DirectoryScanBudget(**kwargs)


def test_unbounded_budget_accepts_everything(tmp_path):
    _build_tree(tmp_path, {f"f{index}.txt": "x\n" for index in range(30)})

    content = _scan(tmp_path, budget=UNBOUNDED_SCAN)

    assert content.complete is True
    assert content.total_files == 30


# ── 缺口说明的渲染 ────────────────────────────────────────────────────────────


def test_describe_unexpanded_is_empty_without_gaps():
    assert describe_unexpanded([]) == ""


def test_describe_unexpanded_groups_by_reason_and_caps_the_list(tmp_path):
    from app.core.entity.message.server_message import UnexpandedDirectory

    items = [
        UnexpandedDirectory(path=f"budget{index}", reason=UnexpansionReason.NODE_BUDGET)
        for index in range(12)
    ]
    items.append(UnexpandedDirectory(path="locked", reason=UnexpansionReason.UNREADABLE))

    text = describe_unexpanded(items, max_paths=3)

    assert "not read because the listing budget was reached" in text
    assert "could not be read: locked" in text
    assert "and 9 more" in text
