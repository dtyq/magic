# -*- coding: utf-8 -*-
"""工作区条目集合：它是怎么来的、靠什么保持最新、什么时候必须重新遍历。

# 为什么单独一个组件

这份集合有三个使用方（注入给模型的目录索引、嵌套规则文件的发现、变更通知的参照），
又有两种更新方式（一次目录遍历建立基线、之后由事件增量维护）。散在 Agent 里会让
"这份集合是怎么来的、现在还信不信得过"变成一个没人能回答的问题——而它一旦错了，
模型看到的是错误的工作区。

# 变更只有一个来源：账本

**目录遍历不再是变更的兜底来源。** 它做不了这件事：它是有预算的观测，而有预算的观测
证明不了删除，所以在大项目上要么什么都不说，要么说错——把它当兜底，等于在最需要准确
的时候拿出最不可靠的那份答案。变更清单只由账本事件生成。

代价是账本链路出问题时**变更通知缺席**而不是降级成近似答案。这是刻意的取舍：缺席是
可恢复的（游标不动，账本恢复后这些变更会补上），而错误的工作区事实不是。

# 遍历只做一件事：在没有事件维护时，让集合保持新鲜

| 维护状态 | 集合怎么保持最新 | 什么时候遍历 |
|---|---|---|
| `EVENTS` | 事件增量 | 只有还没有基线时 |
| `OBSERVATION` | 重新观测 | 挂载根修订号变化时 |
| `STALE` | 重新观测 | 立刻一次（账本已自报缺口） |

`OBSERVATION` 会在账本没开、读不到、或者根本没在听（`feed_attached=false`）时出现。
它不产生任何变更通知，只保证"模型拿到的目录索引是真的"——整份列表会在首包和压缩后
重新注入，拿一份冻结在会话开始时刻的列表去注入，比不注入更糟。

# 为什么维护集合时不看根目录修订号（`EVENTS` 状态下）

修订号只说明"树动过"，不说明"谁动过"。而它被推进的两种情况在事件增量下都是正常的：

- 本地写入：变更回显还没到（一个订阅周期），此时重扫纯属浪费；
- 只改了内容、没改路径：账本会记 `update`，但不产生路径变化，本来就不该通知模型。

盯着它，只会把每次写入都变成一次无谓的全量遍历——那正是这次改造要消掉的开销。
"""

import asyncio
import time
from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

from agentlang.logger import get_logger
from app.core.entity.message.server_message import FileTreeContent, UnexpandedDirectory
from app.core.horizon.workspace_tree_display import (
    WORKSPACE_FILES_DISPLAY_MAX_CHARS,
    WORKSPACE_SNAPSHOT_SCAN_BUDGET,
    WORKSPACE_TREE_SCAN_DEPTH,
    build_workspace_snapshot_partial_notice,
    build_workspace_tree_display_text,
)
from app.infrastructure.changefeed.workspace_path_changes import WorkspaceChangeSet
from app.utils.directory_scan import DirectoryScanBudget, scan_directory_tree
from app.utils.file_utils import WorkspaceEntry, WorkspaceSnapshot, extract_workspace_entries

logger = get_logger(__name__)


class BaselineMaintenance(str, Enum):
    """这一轮条目集合靠什么保持最新。

    名字刻意不叫"变更来源"：变更来源只有一个（账本事件），这里描述的是**这份集合有没有
    人在维护**——它决定遍历要不要重新观测一次，以及是否立刻。
    """

    EVENTS = "events"            # 账本在正常汇报：事件增量维护，不遍历
    OBSERVATION = "observation"  # 账本缺席：靠重新观测，受修订号门控
    STALE = "stale"              # 账本自报缺口：立刻重新观测一次


class WorkspaceRebuildReason(str, Enum):
    """必须重新遍历工作区的原因。每一种都要能在日志里认出来。"""

    NO_BASELINE = "no_baseline"            # 进程里还没有任何条目集合
    REVISION_MOVED = "revision_moved"      # 挂载根修订号变了（仅在无人维护时生效）
    STALE_REQUESTED = "stale_requested"    # 账本自报缺口，集合与变更清单都不可信了


@dataclass(frozen=True)
class WorkspaceIndexStats:
    """遍历与事件维护的次数。

    这两个数字就是这次改造的 KPI：`scans` 在账本健康时应该停在"每个会话一次"附近，
    而 `event_updates` 随工作区活跃度增长。它们的关系反了，说明事件链路退化成了遍历。
    """

    scans: int
    event_updates: int
    applied_changes: int


def workspace_root_signature(workspace_root: Path) -> tuple[int, int] | None:
    """读取工作区挂载根的修订号签名。

    AGFS 侧只要文件树版本推进就会更新根目录 mtime（agfs-server 的
    touchRootMtimeLocked），所以 (mtime_ns, ino) 是一次 stat 能拿到的最便宜的
    "树变过没有"判据。只在 `OBSERVATION` 状态下用它——那时候没有事件可依赖。

    返回 None 表示这次读不到判据（挂载瞬断、根被替换等）。调用方必须把 None 当作
    "不可比较"，而不是"和上次一样"——把两次读失败当成没变化，会让之后的变更永久
    不再被发现。
    """
    try:
        root_stat = workspace_root.stat()
    except OSError:
        return None
    return (root_stat.st_mtime_ns, root_stat.st_ino)


def _is_same_revision(current: tuple[int, int] | None, recorded: tuple[int, int] | None) -> bool:
    """两次修订号是否可判定为同一个。

    只有两边都读到了并且相等才算同一个。任何一边读不到都不构成"没变"的证据。

    例：(100, 7) 与 (100, 7) → 同一个；(101, 7) 与 (100, 7) → 变了；
        None 与 None → 不可判定，必须当作变过。
    """
    return current is not None and recorded is not None and current == recorded


class WorkspaceEntryIndex:
    """持有当前工作区条目集合，并决定什么时候必须重新遍历。

    线程约束：所有方法都在主事件循环里调用；真正的目录遍历通过注入的 `scan`
    在 worker 线程里执行（`observe` 负责 `asyncio.to_thread`）。
    """

    def __init__(
        self,
        workspace_root: Path,
        *,
        scan: Callable[..., FileTreeContent] = scan_directory_tree,
        budget: DirectoryScanBudget = WORKSPACE_SNAPSHOT_SCAN_BUDGET,
        depth: int = WORKSPACE_TREE_SCAN_DEPTH,
        display_max_chars: int = WORKSPACE_FILES_DISPLAY_MAX_CHARS,
    ) -> None:
        self._workspace_root = workspace_root
        self._scan = scan
        self._budget = budget
        self._depth = depth
        self._display_max_chars = display_max_chars

        self._entries: list[WorkspaceEntry] | None = None
        self._display: str = ""
        self._revision: tuple[int, int] | None = None
        # 上一次遍历没能读到的目录。它是**基线**的属性，不是某一次渲染的属性：
        # 事件只告诉我们"哪些路径变了"，不会把当初没读到的目录补上，所以这份缺口要
        # 一直跟着集合，直到下一次遍历重新判定。丢了它，模型会在整份树被重新注入时
        # （压缩之后）把那些目录当成空的。
        self._unexpanded: list[UnexpandedDirectory] = []

        # 账本自报缺口时登记在这里，由下一次 observe 兑现：缺口发生在账本轮询里，
        # 而重建要 await（遍历在 worker 线程里跑），两件事的时机不同。
        self._stale_requested = False

        self._scans = 0
        self._event_updates = 0
        self._applied_changes = 0

    # ── 对外入口 ──────────────────────────────────────────────────────────────

    async def observe(
        self,
        *,
        maintenance: BaselineMaintenance,
        events: WorkspaceChangeSet | None = None,
    ) -> WorkspaceSnapshot:
        """把本轮的事件并入集合、必要时重新观测，返回可注入模型的工作区快照。

        事件先并入、再判断要不要遍历：遍历会用真实目录覆盖整份集合，所以顺序反了会让
        事件白做一遍（结果一样，但会多算一次"事件更新"）。集合还没建立时事件会被跳过
        ——马上要做的那次遍历本来就包含它们当前的结果。

        Args:
            maintenance: 这一轮谁在保持集合最新，见 `BaselineMaintenance`。
            events: 账本给出的、已证明的变化。仅用于维护集合；通知模型由调用方另行交给
                Horizon——两件事的时机不同：集合要在下一轮之前更新，通知要在这一轮注入
                时给出。
        """
        # `STALE` 状态下事件清单本身已经不完整，但已经解析出来的那部分仍然是事实，
        # 并入集合不会出错；紧接着的重建会用真实目录再覆盖一次。
        if events is not None and not events.empty:
            self._apply_events(events)

        reason = self._rebuild_reason(maintenance)
        if reason is not None:
            await self._rebuild(reason)

        return self._snapshot()

    def stats(self) -> WorkspaceIndexStats:
        return WorkspaceIndexStats(
            scans=self._scans,
            event_updates=self._event_updates,
            applied_changes=self._applied_changes,
        )

    # ── 事件增量 ──────────────────────────────────────────────────────────────

    def _apply_events(self, events: WorkspaceChangeSet) -> None:
        """把已证明的路径变化并入条目集合，并重绘展示用的树。

        例：集合里有 `docs/old.md`，事件是 `move docs/old.md docs/new.md` →
        集合换成 `docs/new.md`，展示树同步更新，模型看到的目录索引与变更清单一致。

        没有基线时直接跳过：紧接着的那次遍历会给出真实结果，先应用一遍再被覆盖没有意义，
        还会把这次维护计进 `event_updates`，让"遍历是否真的变少了"这个观测失真。
        """
        if self._entries is None:
            return

        by_path = {entry["path"]: entry for entry in self._entries}
        for path in events.removed:
            by_path.pop(path, None)
        for path in events.added:
            # 事件不带大小（账本的 size 是 journal 行的快照，不保证等于工作区当前
            # 状态）。留 None 比留一个可能过期的数字诚实：展示层会显示为无大小，
            # 而不是显示一个错的。
            by_path[path] = {"path": path, "size": None}

        self._entries = list(by_path.values())
        self._redraw_display()
        self._event_updates += 1
        self._applied_changes += len(events.added) + len(events.removed)

        if events.unresolved:
            # 解析不出路径的变更说明集合里缺了对应节点。调用方据此把维护状态降级为
            # `STALE`，下一次遍历会把缺口补上；这里只保证不把它当成"集合是完整的"。
            logger.warning(
                f"[WorkspaceIndex] {events.unresolved} 条事件没有路径，条目集合可能缺项"
            )

    # ── 遍历决策 ──────────────────────────────────────────────────────────────

    def _rebuild_reason(self, maintenance: BaselineMaintenance) -> WorkspaceRebuildReason | None:
        if self._entries is None:
            return WorkspaceRebuildReason.NO_BASELINE
        if self._stale_requested:
            return WorkspaceRebuildReason.STALE_REQUESTED
        if maintenance is BaselineMaintenance.STALE:
            # 账本这一轮自报缺口，但上面没有被登记过——说明调用方是先观察到缺口、
            # 再同轮拿到维护状态的。语义一样：集合不可信，必须重新观测。
            return WorkspaceRebuildReason.STALE_REQUESTED
        if maintenance is BaselineMaintenance.EVENTS:
            # 事件在维护这份集合，修订号被推进的两种情况都不需要遍历。
            return None
        if not _is_same_revision(workspace_root_signature(self._workspace_root), self._revision):
            return WorkspaceRebuildReason.REVISION_MOVED
        return None

    async def _rebuild(self, reason: WorkspaceRebuildReason) -> None:
        started = time.monotonic()
        content = await asyncio.to_thread(
            self._scan,
            self._workspace_root,
            relative_path=".",
            level=self._depth,
            filter_binary=False,
            budget=self._budget,
        )
        elapsed = time.monotonic() - started

        self._entries = extract_workspace_entries(content.tree)
        self._unexpanded = list(content.unexpanded)
        self._redraw_display()
        # 修订号必须在遍历「之后」读：遍历期间发生的写入会把 mtime 推到新值，先读
        # 就会把这次写入算进"已经看过"的那一版，下次不再重扫，等于漏掉它。
        self._revision = workspace_root_signature(self._workspace_root)
        self._stale_requested = False
        self._scans += 1

        # 遍历耗时无法从条目预算推断（每个目录一次网络往返），实测值才是区分
        # "真的扫完了"和"被预算截断"的依据。reason 让"为什么又扫了一遍"可查——
        # 这个数字涨得太快就是这次改造失效的第一个信号。
        logger.info(
            f"[WorkspaceIndex] 遍历工作区: reason={reason.value} "
            f"dirs={content.total_dirs} files={content.total_files} "
            f"unexpanded={len(content.unexpanded)} elapsed={elapsed:.2f}s scans={self._scans}"
        )

    def _redraw_display(self) -> None:
        """按当前条目集合重绘展示用的树，并附上缺口的说明。

        每次集合变化都要重绘：整份展示会在首包和压缩后被重新注入，那时如果还是旧的树，
        模型会拿一份过期的目录索引去推理，而覆盖它的增量变更早已交付过了。

        缺口说明取自 `self._unexpanded` 而不是本次调用的入参——事件不会把当初没读到的
        目录补上，所以缺口一直在，直到下一次遍历重新判定。
        """
        display = build_workspace_tree_display_text(
            self._entries or [],
            max_chars=self._display_max_chars,
            scan_depth=self._depth,
        )
        if self._unexpanded:
            display += build_workspace_snapshot_partial_notice(self._unexpanded)
        self._display = display

    def _snapshot(self) -> WorkspaceSnapshot:
        return WorkspaceSnapshot(
            display=self._display,
            entries=list(self._entries or []),
        )
