# -*- coding: utf-8 -*-
"""读本沙箱 agfs-server 的「已应用变更账本」。

# 它解决什么问题

工作区挂在网络文件系统上，"哪些文件变了"以前只能靠扫描目录树再比对路径集合得出。
项目文件数量大时那次遍历又慢又容易被预算截断，而截断会让"没读到"变成"已删除"。

账本换了一条路：durable journal 的权威数据已经被 agfs-server 用**一条进程级订阅**拉进
沙箱了，本模块只是把它取出来。因此它**不产生任何 magic-service 请求**——这正是它相对
"直接调 magic-service 的 changes 接口"的全部意义。

# 契约（必须按这个顺序理解，否则会把"读不到"当成"没有变化"）

| 响应字段 | 含义 | 消费方必须做什么 |
|---|---|---|
| `changes` | revision 大于 `since_revision` 的变更，按 revision 升序 | 逐条应用 |
| `revision` | **下一个游标**，不一定等于最后一条变更的 revision | 用它作为下次的 `since_revision` |
| `cursor_expired` | 这段时间的变更已被挤出窗口 | **重建视图**，不能把空列表当成没变化 |
| `oldest_revision` | 窗口还能服务的最早 revision | 仅用于排查 |
| `has_more` | 还有更多变更没取完 | 用返回的 `revision` 继续取 |

`revision` 小于调用方自己的游标，说明 agfs 进程重启过或文件树被重置——同样要重建视图，
而不是相信这次的空结果。这条判断放在调用方，因为它才知道自己的游标从哪里来。

还有一个字段不属于"窗口"而属于"链路"：`feed_attached`。它回答这个挂载到底有没有在听
durable journal。关掉版本同步的挂载照样有账本、照样回 200、`revision` 永远是 0——
和"什么都没变"长得一模一样。少了这个字段，那种部署会表现为**永久的静默**。
"""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional, Sequence

import aiohttp

from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.utils.agfs_mount_path import WORKSPACE_MOUNT_PATH
from app.utils.async_file_utils import async_try_read_json

logger = get_logger(__name__)

# agfs-server 的地址。网关把 FUSE 挂载根注入 agent 容器时用的是同一套约定；
# 这里默认值与 agfs-server 的默认监听端口一致，并且 localhost 是正确的：
# 同一个 pod 的所有容器共享网络命名空间（agfs-fuse sidecar 也是这么连的）。
AGFS_SERVER_URL_ENV = "AGFS_SERVER_URL"
DEFAULT_AGFS_SERVER_URL = "http://localhost:8080"

# agfs 的 data 层鉴权头，与 agfs-server 的 handlers.UserAuthorizationHeader 同名。
USER_AUTHORIZATION_HEADER = "User-Authorization"

# 单次读取的页大小。取值与 agfs 侧、journal 侧的默认页一致，避免同一批变更在不同
# 链路上呈现出不同的批次边界。
DEFAULT_PAGE_SIZE = 256


class ChangeOperation(str, Enum):
    """账本里的变更动词，闭集；与 agfs pkg/changefeed 的取值一一对应。"""

    CREATE = "create"
    UPDATE = "update"
    MOVE = "move"
    DELETE = "delete"
    RESTORE = "restore"


class ChangeFileType(str, Enum):
    """变更对象的类型。目录变更没有大小，调用方不要把它当空文件。"""

    FILE = "file"
    DIRECTORY = "directory"


@dataclass(frozen=True)
class LedgerChange:
    """一条已应用的变更。

    `path` 是**挂载点内部**的绝对路径（带前导 `/`），所以 agent 可见路径由调用方拼成
    `<agent 可见挂载根><path>`。它由 agfs 在应用变更的瞬间解析：那是旧位置和新位置
    同时可知的唯一时刻。缓存是有界的，所以解析可能是尽力而为——解析不到时 `path` 为空，
    而这条变更**仍然会被报出来**（丢掉它会让窗口看起来是完整的），`parent_id`/`name`
    保留调用方重新列目录所需的身份。
    """

    revision: int
    operation: ChangeOperation
    file_id: str
    file_type: ChangeFileType
    path: str
    old_path: str = ""
    parent_id: str = ""
    name: str = ""
    size: int = 0


@dataclass(frozen=True)
class LedgerPage:
    """一次账本读取的结果。字段语义见模块 docstring 的契约表。"""

    mount: str
    space: str
    revision: int
    oldest_revision: int
    cursor_expired: bool
    has_more: bool
    changes: tuple[LedgerChange, ...] = field(default_factory=tuple)

    # 这个挂载到底有没有在听 durable journal。
    #
    # 没有它，"账本里什么都没有"和"账本永远不会有东西"是同一个响应：关掉版本同步的
    # 挂载照样有账本、照样回 200、revision 永远是 0。把空窗口当成"没有变化"，就会在
    # 没有任何人汇报的情况下认为工作区一直很安静——正是这个账本要消灭的那类故障，
    # 换了一身衣服。
    feed_attached: bool = True


class ChangeLedgerUnavailable(Exception):
    """账本当前读不到。

    这**不是**错误路径，而是需要降级的正常状态，三类原因都归到这里：

    - 网关没给这个挂载配账本（agfs 回 501）或挂载不存在（404）；
    - 沙箱还没绑定、令牌过期（401/503）；
    - agfs-server 不可达或超时。

    调用方必须降级到自己的发现机制（目录树扫描），而不是把"读不到"当成"没有变化"——
    后者会让模型长期看不到工作区变化，而且完全无声。

    `permanent` 区分"这个部署根本没开这个能力"和"这次读不到"：前者重试一辈子也不会有
    结果，只该记一次日志；后者下次要照常重试。把两者混在一起，要么刷日志，要么让一次
    网络抖动永久关掉这条链路。
    """

    def __init__(self, message: str, *, permanent: bool = False) -> None:
        super().__init__(message)
        self.permanent = permanent


def agfs_server_url() -> str:
    """本 pod 内 agfs-server 的 HTTP 地址。"""
    return os.getenv(AGFS_SERVER_URL_ENV, "").strip() or DEFAULT_AGFS_SERVER_URL


class ChangeLedgerClient:
    """账本的 HTTP 读取端。

    无状态：游标属于调用方，因为只有调用方知道自己的视图从哪一刻开始。
    """

    def __init__(
        self,
        *,
        base_url: Optional[str] = None,
        metadata_path: Optional[str] = None,
        timeout_seconds: float = 10.0,
    ) -> None:
        self._base_url = (base_url or agfs_server_url()).rstrip("/")
        self._metadata_path = metadata_path
        self._timeout_seconds = timeout_seconds

    async def fetch(
        self,
        since_revision: int,
        *,
        mount: str = WORKSPACE_MOUNT_PATH,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> LedgerPage:
        """读取 `since_revision` 之后已应用的变更。

        Raises:
            ChangeLedgerUnavailable: 见该异常类的说明。
        """
        authorization = await self._read_authorization()
        if not authorization:
            raise ChangeLedgerUnavailable(
                "sandbox is not bound yet: metadata.json has no authorization"
            )

        url = f"{self._base_url}/api/v1/changes"
        params = {
            "mount": mount,
            "since_revision": str(max(0, int(since_revision))),
            "limit": str(max(0, int(limit))),
        }
        timeout = aiohttp.ClientTimeout(total=self._timeout_seconds)
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(
                    url,
                    params=params,
                    headers={USER_AUTHORIZATION_HEADER: authorization},
                ) as response:
                    body = await response.text()
                    status = response.status
        except asyncio.CancelledError:
            # 中断必须原样冒泡：把它当成"账本不可用"会让停止请求变成一次静默降级。
            raise
        except (aiohttp.ClientError, asyncio.TimeoutError) as error:
            raise ChangeLedgerUnavailable(
                f"agfs-server is unreachable at {self._base_url}: {error}"
            ) from error

        if status == 200:
            return _parse_page(body, mount)
        if status in (404, 501):
            raise ChangeLedgerUnavailable(
                f"mount {mount} does not offer a change ledger (http {status}): {body.strip()}",
                permanent=True,
            )
        if status in (401, 403, 503):
            raise ChangeLedgerUnavailable(
                f"change ledger refused the request (http {status}): {body.strip()}"
            )
        # 400 说明请求本身有问题（游标或页大小非法），属于编程错误：仍然降级，
        # 但要留下警告，因为静默降级会让这个 bug 永远不被发现。
        logger.warning(f"[ChangeLedger] unexpected response: http {status} body={body.strip()}")
        raise ChangeLedgerUnavailable(f"change ledger returned http {status}")

    async def _read_authorization(self) -> str:
        """从共享 metadata.json 现读 per-user token。

        每次请求都重新读：warm pool 换绑和令牌轮换都靠这一点即时生效，与 agfs-server
        的 UserAuthMiddleware 行为一致。
        """
        path = self._metadata_path or str(PathManager.get_client_message_metadata_file())
        metadata = await async_try_read_json(path)
        if not isinstance(metadata, dict):
            return ""
        token = metadata.get("authorization")
        return token.strip() if isinstance(token, str) else ""


def _parse_page(body: str, mount: str) -> LedgerPage:
    """把响应体解析成 `LedgerPage`。

    解析失败按"不可用"处理而不是"没有变化"：一个畸形的响应说明契约被破坏了，此时
    最不该做的就是让调用方以为工作区是干净的。
    """
    import json

    try:
        payload: Any = json.loads(body)
    except ValueError as error:
        raise ChangeLedgerUnavailable(f"change ledger returned malformed json: {error}") from error
    if not isinstance(payload, dict):
        raise ChangeLedgerUnavailable("change ledger returned a non-object payload")

    changes = tuple(
        change
        for change in (_parse_change(raw) for raw in payload.get("changes") or [])
        if change is not None
    )
    return LedgerPage(
        mount=str(payload.get("mount") or mount),
        space=str(payload.get("space") or ""),
        revision=_as_int(payload.get("revision")),
        oldest_revision=_as_int(payload.get("oldest_revision")),
        cursor_expired=bool(payload.get("cursor_expired")),
        has_more=bool(payload.get("has_more")),
        # 老版本 agfs 不带这个字段。取 True 是刻意的：那时候"没有变化"就是字面意思，
        # 而把缺字段当成"没在听"会让每次升级顺序不对的部署都报一次假警报。
        feed_attached=bool(payload.get("feed_attached", True)),
        changes=changes,
    )


def _parse_change(raw: Any) -> Optional[LedgerChange]:
    """解析单条变更。

    单条解析失败只丢这一条并告警：整页丢掉会让一个未知的新动词（agfs 先上线了新操作）
    变成"这段时间没有变化"，代价远大于漏报一条。
    """
    if not isinstance(raw, dict):
        return None
    operation = _as_enum(ChangeOperation, raw.get("operation"))
    if operation is None:
        logger.warning(f"[ChangeLedger] unknown operation, skipping row: {raw.get('operation')!r}")
        return None
    file_type = _as_enum(ChangeFileType, raw.get("file_type")) or ChangeFileType.FILE
    return LedgerChange(
        revision=_as_int(raw.get("revision")),
        operation=operation,
        file_id=str(raw.get("file_id") or ""),
        file_type=file_type,
        path=str(raw.get("path") or ""),
        old_path=str(raw.get("old_path") or ""),
        parent_id=str(raw.get("parent_id") or ""),
        name=str(raw.get("name") or ""),
        size=_as_int(raw.get("size")),
    )


def _as_int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _as_enum(enum_type, value: Any):
    if not isinstance(value, str):
        return None
    try:
        return enum_type(value)
    except ValueError:
        return None


def page_paths(page: LedgerPage) -> Sequence[LedgerChange]:
    """按 revision 升序返回页面里的变更。

    agfs 已经保证顺序，这里只做一次显式排序：窗口被重建（discontinuity）后同一个
    页面里可能出现不连续的 revision，排序让"最后一条"始终是可用的落点。
    """
    return tuple(sorted(page.changes, key=lambda change: change.revision))
