# -*- coding: utf-8 -*-
"""把账本变更映射成"工作区路径变化"。

这是纯函数层，刻意不碰 HTTP、不碰 Horizon、不碰文件系统：映射规则本身值得独立测试，
而它一旦出错，模型看到的会是错误的工作区事实。

# 路径口径

账本按挂载点查询，返回的也是**挂载点内部**的绝对路径（`/docs/a.md`），而模型看到的是
**工作区相对**路径（`docs/a.md`）。换算就是去掉前导 `/`——挂载点本身就是工作区，不需要
再拿一个"agent 可见前缀"去匹配。多引入一层前缀匹配不但没有新增语义，还会在前缀写错时
把整批变更静默丢掉。

# 为什么只映射路径变化，不映射内容变化

`<workspace_files_changed>` 的既有契约是"文件或目录**路径**增加、删除；不把文件内容
修改当作路径变化"（内容变化走 `<file_changes>`，只覆盖已追踪文件）。账本的 `update`
因此被有意忽略——把它当路径变化会让模型以为新增了文件。

| 账本动词 | 映射结果 | 原因 |
|---|---|---|
| `create` / `restore` | 新增 | 该路径此前不存在 |
| `delete` | 删除 | 该路径不再存在 |
| `move` | 旧路径删除 + 新路径新增 | 契约里没有 rename 形态；拆成两条与目录树比对的口径一致 |
| `update` | 忽略 | 路径没变，路径变化不是它要表达的事 |
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

from app.infrastructure.changefeed.change_ledger_client import (
    ChangeFileType,
    ChangeOperation,
    LedgerChange,
)

# 目录路径以 "/" 结尾，与工作区快照条目的既有约定一致（见 extract_workspace_entries）。
_DIRECTORY_SUFFIX = "/"


@dataclass
class WorkspaceChangeSet:
    """一批可证明的工作区路径变化。

    集合语义：同一路径重复出现只算一次。调用方据此渲染 `+N added` / `-N removed`，
    因此重复无害，而漏报有害——这也是账本"宁可多报也不丢一条"的取舍能落地的前提。
    """

    added: set[str] = field(default_factory=set)
    removed: set[str] = field(default_factory=set)

    # 账本报了变更但解析不出路径的条数（agfs 的驻留缓存是有界的，被挤出的节点定位不到）。
    # 它们不进 added/removed——说不出是哪个路径的变化，就不能写进给模型的清单——但必须
    # 留下来计数：持续非零说明这条链路正在退化，而它不会以任何其它方式表现出来。
    unresolved: int = 0

    @property
    def empty(self) -> bool:
        return not self.added and not self.removed

    def merge(self, other: "WorkspaceChangeSet") -> None:
        """把另一批变化并入本批。"""
        self.added |= other.added
        self.removed |= other.removed
        self.unresolved += other.unresolved

    def clear(self) -> None:
        self.added.clear()
        self.removed.clear()
        self.unresolved = 0


def map_ledger_changes_to_workspace_paths(
    changes: Iterable[LedgerChange],
) -> WorkspaceChangeSet:
    """把一次账本读取的结果换算成工作区相对路径。

    Args:
        changes: 账本返回的变更。按构造它们都属于被查询的那个挂载点。

    Returns:
        WorkspaceChangeSet: 可证明的路径变化，以及解析不出路径的条数。
    """
    result = WorkspaceChangeSet()

    for change in changes:
        is_directory = change.file_type is ChangeFileType.DIRECTORY
        new_path = _to_workspace_path(change.path, is_directory=is_directory)
        old_path = _to_workspace_path(change.old_path, is_directory=is_directory)

        if change.operation is ChangeOperation.UPDATE:
            # 路径没变。仍然要检查它是否可解析：解析不出来的 update 说明缓存里缺这个
            # 节点，是链路退化的信号，即使它本身不产生路径变化。
            if new_path is None:
                result.unresolved += 1
            continue

        if change.operation is ChangeOperation.MOVE:
            _apply(result, old_path, added=False)
            _apply(result, new_path, added=True)
            continue

        # create / restore → 新增；delete → 删除。
        mapped = new_path if new_path is not None else old_path
        _apply(result, mapped, added=change.operation is not ChangeOperation.DELETE)

    return result


def _apply(result: WorkspaceChangeSet, path: str | None, *, added: bool) -> None:
    """登记一条映射结果。

    三种输入各有归宿，不能合并：

    - 有路径 → 进集合；
    - `None` → 账本没解析出位置，是链路退化，计数；
    - `""` → 挂载点自身（挂载级事件），不是工作区里的一个路径，直接跳过。
    """
    if path is None:
        result.unresolved += 1
        return
    if not path:
        return
    (result.added if added else result.removed).add(path)


def _to_workspace_path(raw_path: str, *, is_directory: bool) -> str | None:
    """把挂载点内部路径换算成工作区相对路径。

    Returns:
        str: 工作区相对路径（目录带尾随 `/`）；挂载点自身返回空串。
        None: 账本没给出路径（agfs 解析不到），调用方应按"退化"计数。

    例：`/docs/a.md` → `docs/a.md`；`/assets`（目录）→ `assets/`；
        `""` → None（账本没能解析出位置）；`docs/a.md` → None（契约要求绝对路径）；
        `/` → ""（挂载级事件，不是工作区里的一个路径）。
    """
    if not raw_path or not raw_path.startswith("/"):
        return None

    relative = raw_path.lstrip("/")
    if not relative:
        return ""
    return relative + _DIRECTORY_SUFFIX if is_directory else relative
