"""Workspace tree display compression for Horizon context."""

from collections import Counter
from collections.abc import Iterator, Sequence
from dataclasses import dataclass, field
from pathlib import Path

from app.core.entity.message.server_message import UnexpandedDirectory
from app.utils.directory_scan import DirectoryScanBudget, describe_unexpanded
from app.utils.file_utils import (
    WorkspaceEntry,
    format_file_size,
)

WORKSPACE_FILES_DISPLAY_MAX_CHARS = 16 * 1024
WORKSPACE_TREE_SCAN_DEPTH = 5
WORKSPACE_EXTENSION_TYPE_LIMIT = 10

# 工作区快照的扫描预算。这是每轮 Loop 自动跑的观测，成本必须由代码封顶，而 list_dir
# 工具是模型主动发起的查询，两者诉求相反，所以预算分开定义、分开演进。
#
# - 条目数是主约束：它同时决定 FUSE 往返次数（每个条目一次 stat）和基线体积。
# - 时间只是兜底：条目数已经限定工作量，这里再设一道，是为了防止挂载异常时把整个
#   Loop 拖住。它同时也是唯一能在 worker 线程里生效的中断手段。
#
# 命中任何一项都会让这次观测不完整，模型必须被告知（见 build_workspace_snapshot_partial_notice）
# ——整份列表会在首包和压缩后重新注入，让模型把没读到的目录当成空目录，比不给列表更糟。
#
# 不完整**不再**影响变更清单：变更只有一个来源（变更账本事件），它不依赖观测完整性。
WORKSPACE_SNAPSHOT_SCAN_BUDGET = DirectoryScanBudget(
    max_nodes=5000,
    max_seconds=60.0,
)

_DETAIL_HINT = (
    'Use list_dir(relative_workspace_path="<directory>", level=3) for details.'
)


@dataclass(slots=True)
class WorkspaceDisplayNode:
    name: str
    path: str
    is_directory: bool
    size: int | None
    children: dict[str, "WorkspaceDisplayNode"] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class WorkspaceTreeStats:
    file_count: int
    directory_count: int
    total_size: int
    extension_counts: Counter[str]


def _normalize_entry_path(path: str) -> tuple[str, list[str], bool]:
    is_directory = path.endswith("/")
    normalized_path = path.strip("/")
    while normalized_path.startswith("./"):
        normalized_path = normalized_path[2:]
    parts = [part for part in normalized_path.split("/") if part and part != "."]
    return "/".join(parts), parts, is_directory


def _collect_canonical_entries(
    entries: list[WorkspaceEntry],
) -> dict[str, tuple[bool, int | None]]:
    canonical_entries: dict[str, tuple[bool, int | None]] = {}
    for entry in entries:
        path, _, is_directory = _normalize_entry_path(entry["path"])
        if not path:
            continue

        metadata = (is_directory, entry["size"])
        existing = canonical_entries.get(path)
        if existing is None:
            canonical_entries[path] = metadata
            continue
        if existing[0] != is_directory:
            raise ValueError(f"Workspace path type conflict at '{path}'")
        if existing[1] != entry["size"]:
            raise ValueError(f"Workspace path metadata conflict at '{path}'")

    for path in canonical_entries:
        parts = path.split("/")
        for depth in range(1, len(parts)):
            ancestor_path = "/".join(parts[:depth])
            ancestor = canonical_entries.get(ancestor_path)
            if ancestor is not None and not ancestor[0]:
                raise ValueError(
                    f"Workspace path type conflict: '{ancestor_path}' is a file "
                    f"and a parent of '{path}'"
                )
    return canonical_entries


def build_workspace_display_tree(
    entries: list[WorkspaceEntry],
) -> WorkspaceDisplayNode:
    """从任意顺序的扁平条目构建统一的工作区展示树。"""
    root = WorkspaceDisplayNode(".", ".", True, None)
    canonical_entries = _collect_canonical_entries(entries)

    ordered_entries = sorted(
        canonical_entries.items(),
        key=lambda item: (
            item[0].count("/"),
            item[0].casefold(),
            item[0],
        ),
    )
    for path, (is_directory, size) in ordered_entries:
        parts = path.split("/")
        parent = root
        for index, name in enumerate(parts):
            is_leaf = index == len(parts) - 1
            node_is_directory = not is_leaf or is_directory
            node_path = "/".join(parts[:index + 1])
            if node_is_directory:
                node_path += "/"

            node = parent.children.get(name)
            if node is None:
                node = WorkspaceDisplayNode(
                    name=name,
                    path=node_path,
                    is_directory=node_is_directory,
                    size=None if node_is_directory else size,
                )
                parent.children[name] = node
            elif node.is_directory != node_is_directory:
                raise ValueError(f"Workspace path type conflict at '{node_path}'")

            if node_is_directory:
                parent = node

    return root


def calculate_workspace_tree_stats(
    root: WorkspaceDisplayNode,
) -> dict[str, WorkspaceTreeStats]:
    """自底向上计算每个节点的后代统计，并按规范化路径建立索引。"""
    stats_by_path: dict[str, WorkspaceTreeStats] = {}

    def calculate(node: WorkspaceDisplayNode) -> WorkspaceTreeStats:
        if not node.is_directory:
            extension = Path(node.name).suffix.lower() or "[no-ext]"
            node_stats = WorkspaceTreeStats(
                file_count=1,
                directory_count=0,
                total_size=node.size if node.size is not None else 0,
                extension_counts=Counter({extension: 1}),
            )
            stats_by_path[node.path] = node_stats
            return node_stats

        file_count = 0
        directory_count = 0
        total_size = 0
        extension_counts: Counter[str] = Counter()
        for child in node.children.values():
            child_stats = calculate(child)
            file_count += child_stats.file_count
            total_size += child_stats.total_size
            extension_counts.update(child_stats.extension_counts)
            if child.is_directory:
                directory_count += child_stats.directory_count + 1

        node_stats = WorkspaceTreeStats(
            file_count=file_count,
            directory_count=directory_count,
            total_size=total_size,
            extension_counts=extension_counts,
        )
        stats_by_path[node.path] = node_stats
        return node_stats

    calculate(root)
    return stats_by_path


def _format_workspace_extension_counts(
    extension_counts: Counter[str],
    limit: int = WORKSPACE_EXTENSION_TYPE_LIMIT,
) -> str:
    sorted_counts = sorted(
        (
            (extension, count)
            for extension, count in extension_counts.items()
            if count > 0
        ),
        key=lambda item: (-item[1], item[0]),
    )
    if not sorted_counts:
        return "none"

    visible_counts = sorted_counts[:limit]
    parts = [f"{extension} {count}" for extension, count in visible_counts]
    remaining_counts = sorted_counts[len(visible_counts):]
    if remaining_counts:
        remaining_file_count = sum(count for _, count in remaining_counts)
        parts.append(
            f"other: {len(remaining_counts)} types, {remaining_file_count} files"
        )
    return ", ".join(parts)


def _node_sort_key(node: WorkspaceDisplayNode) -> tuple[bool, str, str]:
    return not node.is_directory, node.name.casefold(), node.name


def _iter_workspace_tree_display_lines(
    root: WorkspaceDisplayNode,
    stats: dict[str, WorkspaceTreeStats],
    max_depth: int,
    scan_depth: int,
) -> Iterator[str]:
    if max_depth < 1:
        raise ValueError("max_depth must be at least 1")
    if scan_depth < 1:
        raise ValueError("scan_depth must be at least 1")

    yield "[DIR] ./\n"
    if max_depth < scan_depth:
        yield (
            f"[INFO] Workspace tree compressed to depth {max_depth}/{scan_depth}. "
            f"Statistics cover only the current depth-{scan_depth} snapshot. "
            "Collapsed directories retain aggregate file statistics. "
            f"{_DETAIL_HINT}\n"
        )

    children = sorted(root.children.values(), key=_node_sort_key)
    stack: list[tuple[WorkspaceDisplayNode, str, bool, int]] = [
        (child, "", index == len(children) - 1, 1)
        for index, child in reversed(list(enumerate(children)))
    ]
    while stack:
        node, indent, is_last_item, depth = stack.pop()
        prefix = f"{indent}{'└─' if is_last_item else '├─'}"
        next_indent = f"{indent}{'   ' if is_last_item else '│  '}"

        if not node.is_directory:
            size = node.size if node.size is not None else 0
            yield f"{prefix}[FILE] {node.name} ({format_file_size(size)})\n"
            continue

        node_stats = stats[node.path]
        has_descendants = node_stats.file_count > 0 or node_stats.directory_count > 0
        if depth >= max_depth and has_descendants:
            extension_summary = _format_workspace_extension_counts(
                node_stats.extension_counts
            )
            yield (
                f"{prefix}[DIR] {node.name}/ "
                f"[collapsed: {node_stats.file_count} files, "
                f"{node_stats.directory_count} dirs, "
                f"{format_file_size(node_stats.total_size)}; "
                f"types: {extension_summary}]\n"
            )
            continue

        yield f"{prefix}[DIR] {node.name}/ ({len(node.children)} items)\n"
        if depth >= max_depth:
            continue

        child_nodes = sorted(node.children.values(), key=_node_sort_key)
        stack.extend(
            (child, next_indent, index == len(child_nodes) - 1, depth + 1)
            for index, child in reversed(list(enumerate(child_nodes)))
        )


def measure_workspace_tree_display(
    root: WorkspaceDisplayNode,
    stats: dict[str, WorkspaceTreeStats],
    max_depth: int,
    scan_depth: int = WORKSPACE_TREE_SCAN_DEPTH,
) -> int:
    """只累计指定展示深度的行长度。"""
    return sum(
        len(line)
        for line in _iter_workspace_tree_display_lines(
            root,
            stats,
            max_depth,
            scan_depth,
        )
    )


def render_workspace_tree_display(
    root: WorkspaceDisplayNode,
    stats: dict[str, WorkspaceTreeStats],
    max_depth: int,
    scan_depth: int = WORKSPACE_TREE_SCAN_DEPTH,
) -> str:
    """只拼接最终选中深度的展示行。"""
    return "".join(
        _iter_workspace_tree_display_lines(root, stats, max_depth, scan_depth)
    )


def _join_lines(lines: list[str]) -> str:
    return "\n".join(lines) + "\n"


def _build_top_level_directories_line(
    directories: list[WorkspaceDisplayNode],
    max_length: int,
) -> str | None:
    if not directories or max_length <= 0:
        return None

    prefix = "Top-level directories: "
    selected_names: list[str] = []
    for directory in directories:
        candidate_names = [*selected_names, f"{directory.name}/"]
        remaining_count = len(directories) - len(candidate_names)
        candidate = prefix + ", ".join(candidate_names)
        candidate += (
            f", and {remaining_count} more." if remaining_count else "."
        )
        if len(candidate) > max_length:
            break
        selected_names = candidate_names

    if not selected_names:
        count_only = f"Top-level directories: {len(directories)} total."
        return count_only if len(count_only) <= max_length else None

    remaining_count = len(directories) - len(selected_names)
    result = prefix + ", ".join(selected_names)
    result += f", and {remaining_count} more." if remaining_count else "."
    return result


def _fit_first(candidates: list[str], max_chars: int) -> str:
    return next((text for text in candidates if len(text) <= max_chars), "")


def _render_full_workspace_summary(
    root: WorkspaceDisplayNode,
    stats: dict[str, WorkspaceTreeStats],
    max_chars: int,
    scan_depth: int,
) -> str | None:
    root_stats = stats[root.path]
    top_level_directories = sorted(
        (node for node in root.children.values() if node.is_directory),
        key=lambda node: (
            -stats[node.path].file_count,
            node.name.casefold(),
            node.name,
        ),
    )
    summary_head = [
        "[DIR] ./",
        "[SUMMARY] Workspace tree is too large even at depth 1.",
        (
            f"Files: {root_stats.file_count}; "
            f"directories: {root_stats.directory_count}; "
            f"total size: {format_file_size(root_stats.total_size)}."
        ),
        f"Statistics cover only the current depth-{scan_depth} snapshot.",
    ]
    extension_limits = (
        [*range(WORKSPACE_EXTENSION_TYPE_LIMIT, 0, -1), 0]
        if root_stats.extension_counts
        else [0]
    )
    for extension_limit in extension_limits:
        lines = list(summary_head)
        if extension_limit:
            lines.append(
                "Types: "
                f"{_format_workspace_extension_counts(root_stats.extension_counts, extension_limit)}."
            )
        lines.append(_DETAIL_HINT)
        base_text = _join_lines(lines)
        if len(base_text) > max_chars:
            continue

        if top_level_directories:
            directory_line = _build_top_level_directories_line(
                top_level_directories,
                max_chars - len(base_text) - 1,
            )
            if directory_line is None:
                continue
            lines.insert(-1, directory_line)

        candidate = _join_lines(lines)
        if len(candidate) <= max_chars:
            return candidate
    return None


def build_workspace_snapshot_partial_notice(
    unexpanded: Sequence[UnexpandedDirectory],
) -> str:
    """把工作区快照的扫描缺口写成一段必须让模型看到的话；没有缺口时返回空串。

    基线不完整时，模型不能把"列表里没有"推断成"文件已删除"——那正是节点预算造成
    "假删除上报"的同一个根因，只是换了一条路径。这段话和 `AgentHorizon` 里增量 diff
    的准入规则是同一条约束的两端：diff 那边负责不上报无法证明的增删，这里负责让模型
    自己不往那个方向推断。

    例：预算截断在 node_modules/ 和 vendor/，模型仍会看到这两行目录，但不会看到它们的
    子项。没有这段话时模型会认为两个目录是空的；有这段话时它知道要单独 list_dir 一次。
    """
    details = describe_unexpanded(unexpanded)
    if not details:
        return ""
    return (
        f"\n[PARTIAL] The workspace listing above is incomplete: "
        f"{len(unexpanded)} directories were not read.\n"
        f"{details}\n"
        "Files under those directories are not shown. Their absence from this listing "
        "does not mean they were deleted. Use list_dir on a specific path to see inside it.\n"
    )


def render_workspace_summary(
    root: WorkspaceDisplayNode,
    stats: dict[str, WorkspaceTreeStats],
    max_chars: int,
    scan_depth: int,
) -> str:
    """在字符预算内渲染工作区摘要，优先保留统计和扫描范围。"""
    if max_chars <= 0:
        return ""
    if scan_depth < 1:
        raise ValueError("scan_depth must be at least 1")

    full_summary = _render_full_workspace_summary(
        root,
        stats,
        max_chars,
        scan_depth,
    )
    if full_summary is not None:
        return full_summary

    root_stats = stats[root.path]
    compact_stats = (
        f"Depth-{scan_depth} snapshot only: {root_stats.file_count} files, "
        f"{root_stats.directory_count} dirs, "
        f"{format_file_size(root_stats.total_size)}."
    )
    return _fit_first(
        [
            _join_lines([compact_stats, _DETAIL_HINT]),
            f"{compact_stats}\n",
            "Workspace tree exceeds the display budget.\n",
            f"{_DETAIL_HINT}\n",
            "Workspace tree is too large.\n",
            "Too large.\n",
        ],
        max_chars,
    )


def build_workspace_tree_display_text(
    entries: list[WorkspaceEntry],
    max_chars: int = WORKSPACE_FILES_DISPLAY_MAX_CHARS,
    scan_depth: int = WORKSPACE_TREE_SCAN_DEPTH,
) -> str:
    """构建一次树和统计，选择预算内最大深度并只渲染最终版本。"""
    if max_chars <= 0:
        return ""
    if scan_depth < 1:
        raise ValueError("scan_depth must be at least 1")
    if not entries:
        return _fit_first(
            [
                "[DIR] ./\n[INFO] Workspace is empty.\n",
                "Workspace is empty.\n",
                "Empty workspace.\n",
                "Empty.\n",
            ],
            max_chars,
        )

    root = build_workspace_display_tree(entries)
    stats = calculate_workspace_tree_stats(root)
    selected_depth = next(
        (
            depth
            for depth in range(scan_depth, 0, -1)
            if measure_workspace_tree_display(root, stats, depth, scan_depth)
            <= max_chars
        ),
        None,
    )
    if selected_depth is not None:
        display = render_workspace_tree_display(
            root,
            stats,
            selected_depth,
            scan_depth,
        )
        if len(display) <= max_chars:
            return display

    return render_workspace_summary(root, stats, max_chars, scan_depth)
