# -*- coding: utf-8 -*-
"""目录扫描引擎：把一棵目录树读成结构化节点。

这里是「机制」，不含「策略」。读多少、读多深、为哪个调用方省成本，全部由调用方通过
`DirectoryScanBudget` 决定；引擎自己不给任何维度设默认上限。只有把预算留在调用方，
两个诉求相反的调用方才不会互相绑架：

| 调用方 | 它要的语义 | 典型预算 |
|---|---|---|
| `list_dir` 工具（模型主动问） | 忠于 `level` 的真实列表 | 只设时间上限，防挂死 |
| `Agent._get_workspace_snapshot`（每轮自动跑） | 成本必须封顶的观测 | 条目数 + 时间 |

**预算命中不等于「这些路径不存在」。** 任何一次未完整读取都会登记进
`FileTreeContent.unexpanded`，带着目录路径和原因，由上层决定怎么告诉模型。此前把
节点预算写死在扫描器里，消费方拿不到这份缺口记录，于是"没读到"被当成了"已删除"。

本模块是同步实现，必须由调用方放进 `asyncio.to_thread` 执行，不要直接在事件循环里调。
"""

from __future__ import annotations

import os
import time
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from agentlang.logger import get_logger
from agentlang.utils.file import is_text_file
from app.core.entity.message.server_message import (
    DirectoryScanFailure,
    FileTreeContent,
    FileTreeNode,
    FileTreeNodeType,
    UnexpandedDirectory,
    UnexpansionReason,
)

logger = get_logger(__name__)

# `FileTreeNode.updated_at` 的既有线格式，前端和模型都在读，不要改。
_NODE_TIME_FORMAT = "%Y-%m-%d %H:%M:%S"

# 扫描时跳过的隐藏项；`.magic` 是 Agent 自己的持久状态目录，必须可见。
_SKIPPED_DOT_PREFIX = "."
_VISIBLE_DOT_DIRECTORY = ".magic"

# 每个条目在树里占用的估算字节 = 相对路径 + 名字 + 这个固定开销。
# 常数是渲染体积的经验补偿（缩进、类型标记、大小、时间戳），不参与任何业务判断。
_NODE_METADATA_BYTES = 128

# 缺口清单本身也占模型上下文，超过这个数量就只列前几个。
_DEFAULT_MAX_LISTED_PATHS = 8

# `UnexpansionReason` 的规范英文说法。缺口说明会进入模型上下文，必须用英文，而且
# 只描述"为什么没读到"，绝不暗示目录里有什么。两个消费方（list_dir 工具结果、
# 工作区快照）共用这一份措辞，避免同一件事出现两种说法。
UNEXPANSION_REASON_PHRASES: dict[UnexpansionReason, str] = {
    UnexpansionReason.NODE_BUDGET: "not read because the listing budget was reached",
    UnexpansionReason.BYTE_BUDGET: "not read because the listing budget was reached",
    UnexpansionReason.TIME_BUDGET: "not read because the scan ran out of time",
    UnexpansionReason.UNREADABLE: "could not be read",
}


def describe_unexpanded(
    unexpanded: Sequence[UnexpandedDirectory],
    *,
    max_paths: int = _DEFAULT_MAX_LISTED_PATHS,
) -> str:
    """把缺口清单渲染成按原因分组的文本；没有缺口时返回空串。

    调用方负责补上"这段缺口意味着什么"的说明——这里只回答"哪些目录、为什么"。
    """
    if not unexpanded:
        return ""

    grouped: dict[UnexpansionReason, list[str]] = {}
    for item in unexpanded:
        grouped.setdefault(item.reason, []).append(item.path)

    lines: list[str] = []
    for reason, paths in grouped.items():
        shown = ", ".join(sorted(paths)[:max_paths])
        if len(paths) > max_paths:
            shown += f", and {len(paths) - max_paths} more"
        lines.append(f"{UNEXPANSION_REASON_PHRASES[reason]}: {shown}")
    return "\n".join(lines)


@dataclass(frozen=True)
class DirectoryScanBudget:
    """一次目录扫描的预算。三个维度都是 `None` 表示不设上限。

    - `max_nodes`：最多读取多少个条目（文件 + 目录）。超出的部分不会被观测。
    - `max_bytes`：最多产出多少估算字节的树元数据。这是**输出体积**的代理量，不是
      文件内容的体积——一个几百 MB 的二进制文件不应该因为它自己的大小吃掉整个预算。
    - `max_seconds`：最长扫描时间。这是唯一能在 worker 线程里生效的"可中断"手段：
      `asyncio` 取消不了已经跑起来的线程，所以长时间扫描只能靠自检截止时间来收敛。

    三个维度都会在命中时把受影响的目录记进 `FileTreeContent.unexpanded`，因此调用方
    不需要自己判断"结果是不是完整的"——看 `FileTreeContent.complete` 即可。
    """

    max_nodes: int | None = None
    max_bytes: int | None = None
    max_seconds: float | None = None

    def __post_init__(self) -> None:
        for name in ("max_nodes", "max_bytes"):
            value = getattr(self, name)
            if value is not None and value <= 0:
                raise ValueError(f"{name} must be positive when set, got {value!r}")
        if self.max_seconds is not None and self.max_seconds <= 0:
            raise ValueError(f"max_seconds must be positive when set, got {self.max_seconds!r}")


# 不设任何上限。只在调用方明确接受无界扫描时使用。
UNBOUNDED_SCAN = DirectoryScanBudget()


@dataclass
class _ScanCounters:
    """扫描过程中累加的观测量。"""

    nodes: int = 0
    response_bytes: int = 0
    total_files: int = 0
    total_dirs: int = 0
    total_size: int = 0


@dataclass
class _Expansion:
    """一个目录的展开结果。

    `stop_reason` 非 `None` 表示这次展开（以及它的子树）没有覆盖本目录的全部内容。
    父层据此决定要不要把自己也标成未展开，并沿用同一个原因——这样一次预算命中只会
    在每一层留下一条记录，条数受深度约束，不会随目录宽度膨胀。
    """

    nodes: list[FileTreeNode] = field(default_factory=list)
    stop_reason: UnexpansionReason | None = None


def scan_directory_tree(
    directory: Path,
    *,
    relative_path: str,
    level: int,
    filter_binary: bool = False,
    budget: DirectoryScanBudget = UNBOUNDED_SCAN,
) -> FileTreeContent:
    """把 `directory` 读成 `FileTreeContent`。

    Args:
        directory: 已解析好的绝对目录路径。
        relative_path: 写进结果的路径标签，同时作为子项相对路径的前缀。工作区根传 "."。
        level: 展开到第几层。1 表示只读 `directory` 的直接子项。必须 >= 1。
        filter_binary: 是否跳过非文本文件。
        budget: 扫描预算；默认无界。

    Returns:
        FileTreeContent: 结果可能不完整，用 `result.complete` 判断，不要用 `tree` 是否为空。

    Raises:
        ValueError: `level` 小于 1。调用方负责把用户输入收敛到合法范围。
    """
    if level < 1:
        raise ValueError(f"level must be >= 1, got {level!r}")
    return _DirectoryScanner(budget=budget, max_level=level, filter_binary=filter_binary).run(
        directory, relative_path
    )


class _DirectoryScanner:
    """一次扫描的可变状态。

    预算、计数器、未展开目录和截止时间收在同一个对象里：递归只传自己，未展开登记只有
    一个落点，`FileTreeContent` 也只有一个出口，避免"某条异常分支忘了标记不完整"。
    """

    def __init__(
        self,
        *,
        budget: DirectoryScanBudget,
        max_level: int,
        filter_binary: bool,
    ) -> None:
        self._budget = budget
        self._max_level = max_level
        self._filter_binary = filter_binary
        self._counters = _ScanCounters()
        self._unexpanded: dict[str, UnexpansionReason] = {}
        self._deadline = (
            time.monotonic() + budget.max_seconds if budget.max_seconds is not None else None
        )

    # ── 对外入口 ──────────────────────────────────────────────────────────────

    def run(self, directory: Path, relative_path: str) -> FileTreeContent:
        failure = self._validate(directory)
        if failure is not None:
            logger.warning(f"Path invalid or does not exist: {relative_path}")
            return self._build(relative_path, tree=[], failure=failure)

        try:
            expansion = self._expand(directory, relative_path, 1)
        except Exception as error:  # 兜底：任何未预期错误都不能让调用方拿到"看起来完整"的空树
            logger.error(f"Error scanning directory tree: {error}", exc_info=True)
            return self._build(
                relative_path,
                tree=[],
                failure=DirectoryScanFailure.UNREADABLE,
                failure_detail=str(error),
            )
        return self._build(relative_path, tree=expansion.nodes)

    # ── 递归展开 ──────────────────────────────────────────────────────────────

    def _expand(self, directory: Path, relative_path: str, current_level: int) -> _Expansion:
        """读取一个目录的直接子项，并在 `level` 允许时递归。

        Args:
            current_level: 正在读取的这一层的层级；1 表示根目录的子项。
        """
        try:
            entries, read_stop = self._read_entries(directory)
        except PermissionError:
            self._record(relative_path, UnexpansionReason.UNREADABLE)
            return _Expansion(nodes=[self._error_node(relative_path, "Permission denied")])
        except OSError as error:
            self._record(relative_path, UnexpansionReason.UNREADABLE)
            return _Expansion(nodes=[self._error_node(relative_path, f"Cannot access: {error!s}")])

        if read_stop is not None:
            # 本目录的条目没读完；已经读到的照常产出，但本目录内容不完整。
            self._record(relative_path, read_stop)

        entries.sort(key=lambda pair: (not pair[1], pair[0].name.lower()))

        nodes: list[FileTreeNode] = []
        child_stop: UnexpansionReason | None = None
        for entry, is_dir in entries:
            if child_stop is not None:
                # 某个子树已经因预算停止；本目录剩余的条目不会再产出，本目录也不完整。
                self._record(relative_path, child_stop)
                break
            try:
                item_relative_path = (
                    entry.name if relative_path == "." else f"{relative_path}/{entry.name}"
                )
                stat_result = entry.stat(follow_symlinks=False)
                node_bytes = self._estimate_node_bytes(item_relative_path, entry.name)
                if self._out_of_bytes(node_bytes):
                    # 本条及之后的条目都放不进输出体积预算：本目录内容不完整。
                    self._record(relative_path, UnexpansionReason.BYTE_BUDGET)
                    child_stop = UnexpansionReason.BYTE_BUDGET
                    break
                self._counters.response_bytes += node_bytes

                if is_dir:
                    self._counters.total_dirs += 1
                    child = (
                        self._expand(Path(entry.path), item_relative_path, current_level + 1)
                        if current_level < self._max_level
                        else _Expansion()
                    )
                    child_stop = child.stop_reason
                    nodes.append(
                        FileTreeNode(
                            file_name=entry.name,
                            relative_file_path=item_relative_path,
                            is_directory=True,
                            file_size=None,
                            updated_at=self._format_time(stat_result.st_mtime),
                            children=child.nodes or None,
                            type=FileTreeNodeType.DIRECTORY,
                        )
                    )
                else:
                    self._counters.total_files += 1
                    self._counters.total_size += stat_result.st_size
                    nodes.append(
                        FileTreeNode(
                            file_name=entry.name,
                            relative_file_path=item_relative_path,
                            is_directory=False,
                            file_size=stat_result.st_size,
                            updated_at=self._format_time(stat_result.st_mtime),
                            children=None,
                            type=FileTreeNodeType.FILE,
                        )
                    )
            except Exception as error:
                logger.warning(f"Error processing {entry.path}: {error}")

        # `read_stop` 表示"本目录只读到一半"，`child_stop` 表示"子树已经停了"；
        # 两者都要往上传，父层才知道自己是否也缺内容。
        return _Expansion(nodes=nodes, stop_reason=child_stop or read_stop)

    def _read_entries(
        self, directory: Path
    ) -> tuple[list[tuple[os.DirEntry[str], bool]], UnexpansionReason | None]:
        """读取目录的直接子项。

        Returns:
            (已读到的条目, 被预算截断的原因)。原因为 None 表示本目录已完整枚举。
            返回部分结果而不是抛错，是为了让调用方既能拿到已读到的内容，又能知道缺口。
        """
        entries: list[tuple[os.DirEntry[str], bool]] = []
        # scandir 增量产出条目，预算命中时立刻停手，不先把整个目录物化成列表。
        with os.scandir(directory) as scanner:
            for entry in scanner:
                if entry.name.startswith(_SKIPPED_DOT_PREFIX) and entry.name != _VISIBLE_DOT_DIRECTORY:
                    continue
                try:
                    is_dir = entry.is_dir(follow_symlinks=False)
                except OSError:
                    continue
                if self._filter_binary and not is_dir and not is_text_file(Path(entry.path)):
                    continue
                if self._out_of_nodes():
                    return entries, UnexpansionReason.NODE_BUDGET
                if self._out_of_time():
                    return entries, UnexpansionReason.TIME_BUDGET
                self._counters.nodes += 1
                entries.append((entry, is_dir))
        return entries, None

    # ── 预算判定 ──────────────────────────────────────────────────────────────

    def _out_of_nodes(self) -> bool:
        return self._budget.max_nodes is not None and self._counters.nodes >= self._budget.max_nodes

    def _out_of_time(self) -> bool:
        # 未设置时间预算时短路，不读时钟。
        return self._deadline is not None and time.monotonic() >= self._deadline

    def _out_of_bytes(self, node_bytes: int) -> bool:
        if self._budget.max_bytes is None:
            return False
        return self._counters.response_bytes + node_bytes > self._budget.max_bytes

    # ── 结果装配 ──────────────────────────────────────────────────────────────

    def _record(self, relative_path: str, reason: UnexpansionReason) -> None:
        """登记一个未完整读取的目录。同一路径只保留首次原因。"""
        self._unexpanded.setdefault(relative_path, reason)

    def _build(
        self,
        relative_path: str,
        *,
        tree: list[FileTreeNode],
        failure: DirectoryScanFailure | None = None,
        failure_detail: str | None = None,
    ) -> FileTreeContent:
        return FileTreeContent(
            root_path=relative_path,
            level=self._max_level,
            filter_binary=self._filter_binary,
            total_files=self._counters.total_files,
            total_dirs=self._counters.total_dirs,
            total_size=self._counters.total_size,
            tree=tree,
            # 排序让输出稳定：同一棵树重复扫描得到同一份缺口清单。
            unexpanded=[
                UnexpandedDirectory(path=path, reason=reason)
                for path, reason in sorted(self._unexpanded.items())
            ],
            failure=failure,
            failure_detail=failure_detail,
        )

    @staticmethod
    def _validate(directory: Path) -> DirectoryScanFailure | None:
        if not directory.exists():
            return DirectoryScanFailure.NOT_FOUND
        if not directory.is_dir():
            return DirectoryScanFailure.NOT_A_DIRECTORY
        return None

    @staticmethod
    def _estimate_node_bytes(item_relative_path: str, name: str) -> int:
        return (
            len(item_relative_path.encode("utf-8", errors="ignore"))
            + len(name.encode("utf-8", errors="ignore"))
            + _NODE_METADATA_BYTES
        )

    @staticmethod
    def _format_time(timestamp: float) -> str:
        return datetime.fromtimestamp(timestamp).strftime(_NODE_TIME_FORMAT)

    @staticmethod
    def _error_node(relative_path: str, message: str) -> FileTreeNode:
        return FileTreeNode(
            file_name=message,
            relative_file_path=f"{relative_path}/[ERROR]",
            is_directory=False,
            file_size=None,
            updated_at="",
            children=None,
            type=FileTreeNodeType.FILE,
            error=message,
        )
