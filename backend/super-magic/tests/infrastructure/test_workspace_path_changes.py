# -*- coding: utf-8 -*-
"""账本变更 → 工作区路径的映射测试。

映射规则本身很短，但它是"模型看到的工作区事实"的最后一道换算：错了不会有任何报错，
只会让模型相信一个错误的工作区。所以这里逐条钉住动词、目录、路径边界和两类排除。
"""

from __future__ import annotations

from app.infrastructure.changefeed.change_ledger_client import (
    ChangeFileType,
    ChangeOperation,
    LedgerChange,
)
from app.infrastructure.changefeed.workspace_path_changes import (
    WorkspaceChangeSet,
    map_ledger_changes_to_workspace_paths,
)


def _change(
    operation: ChangeOperation,
    path: str = "",
    *,
    old_path: str = "",
    file_type: ChangeFileType = ChangeFileType.FILE,
    revision: int = 1,
) -> LedgerChange:
    return LedgerChange(
        revision=revision,
        operation=operation,
        file_id="f",
        file_type=file_type,
        path=path,
        old_path=old_path,
    )


def _map(*changes: LedgerChange) -> WorkspaceChangeSet:
    return map_ledger_changes_to_workspace_paths(changes)


def test_create_becomes_an_added_workspace_relative_path():
    result = _map(_change(ChangeOperation.CREATE, "/docs/a.md"))

    assert result.added == {"docs/a.md"}
    assert result.removed == set()
    assert result.unresolved == 0


def test_restore_becomes_an_added_path():
    # 回收站恢复在账本里是 restore；对路径集合而言它与 create 等价。
    result = _map(_change(ChangeOperation.RESTORE, "/docs/a.md"))

    assert result.added == {"docs/a.md"}


def test_delete_becomes_a_removed_path():
    result = _map(_change(ChangeOperation.DELETE, "/docs/gone.md"))

    assert result.removed == {"docs/gone.md"}
    assert result.added == set()


def test_move_becomes_a_removal_plus_an_addition():
    # 契约里没有 rename 形态；拆成两条与目录树比对的口径一致，模型读到的语义不变。
    result = _map(_change(ChangeOperation.MOVE, "/docs/new.md", old_path="/docs/old.md"))

    assert result.removed == {"docs/old.md"}
    assert result.added == {"docs/new.md"}


def test_update_produces_no_path_change():
    # <workspace_files_changed> 的契约是"路径增加、删除"；内容变化走 <file_changes>。
    # 把 update 当路径变化会让模型以为新增了文件。
    result = _map(_change(ChangeOperation.UPDATE, "/docs/a.md"))

    assert result.empty
    assert result.unresolved == 0


def test_directory_paths_carry_a_trailing_slash():
    # 与 extract_workspace_entries 的既有约定一致，渲染时才不会把目录当成文件。
    result = _map(_change(ChangeOperation.CREATE, "/assets", file_type=ChangeFileType.DIRECTORY))

    assert result.added == {"assets/"}


def test_the_mount_root_itself_is_not_a_workspace_path():
    """挂载点自身被移动/删除是挂载级事件，不是工作区里的一个路径。"""
    result = _map(_change(ChangeOperation.DELETE, "/"))

    assert result.empty
    assert result.unresolved == 0


def test_missing_path_counts_as_unresolved():
    """路径为空说明 agfs 的驻留缓存没能定位节点——这是链路退化，必须留痕。"""
    result = _map(_change(ChangeOperation.CREATE, ""))

    assert result.empty
    assert result.unresolved == 1


def test_missing_path_on_a_move_still_reports_the_resolvable_end():
    result = _map(_change(ChangeOperation.MOVE, "/docs/new.md", old_path=""))

    assert result.added == {"docs/new.md"}
    assert result.removed == set()
    assert result.unresolved == 1


def test_relative_paths_are_treated_as_unresolved():
    """账本的路径契约是挂载点内部绝对路径；相对形式说明契约被破坏了。"""
    result = _map(_change(ChangeOperation.CREATE, "docs/a.md"))

    assert result.empty
    assert result.unresolved == 1


def test_repeated_paths_collapse_into_a_set():
    # 同一路径一轮内可以变更多次（写两次、或在窗口重建后重复出现）；集合语义让重复无害，
    # 这正是账本"宁可多报也不丢一条"的取舍能落地的前提。
    result = _map(
        _change(ChangeOperation.CREATE, "/docs/a.md", revision=1),
        _change(ChangeOperation.UPDATE, "/docs/a.md", revision=2),
        _change(ChangeOperation.DELETE, "/docs/a.md", revision=3),
    )

    assert result.added == {"docs/a.md"}
    assert result.removed == {"docs/a.md"}


def test_merge_accumulates_sets_and_counters():
    first = _map(_change(ChangeOperation.CREATE, "/a.md"))
    second = _map(_change(ChangeOperation.CREATE, "/b.md"), _change(ChangeOperation.CREATE, ""))

    first.merge(second)

    assert first.added == {"a.md", "b.md"}
    assert first.unresolved == 1


def test_clear_empties_sets_and_counters():
    result = _map(_change(ChangeOperation.CREATE, "/a.md"), _change(ChangeOperation.CREATE, ""))

    result.clear()

    assert result.empty
    assert result.unresolved == 0


def test_empty_input_maps_to_an_empty_result():
    result = map_ledger_changes_to_workspace_paths(())

    assert result.empty
    assert result.unresolved == 0


def test_nested_paths_keep_their_directory_structure():
    """去掉前导斜杠就够了：账本已经按挂载点查询，不存在需要再剥离的"agent 前缀"。"""
    result = _map(
        _change(ChangeOperation.CREATE, "/a/b/c/deep.txt"),
        _change(ChangeOperation.CREATE, "/a/b", file_type=ChangeFileType.DIRECTORY),
    )

    assert result.added == {"a/b/c/deep.txt", "a/b/"}
