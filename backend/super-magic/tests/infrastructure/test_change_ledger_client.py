# -*- coding: utf-8 -*-
"""变更账本客户端的契约测试。

这个客户端的失败模式很特殊：它读的是"工作区变了什么"。任何一次把"读不到"当成
"没有变化"的降级都是**无声**的——模型不会报错，只会长期不知道工作区发生过什么。
所以这里的重点不是 happy path，而是每一类失败都被归到"不可用"而不是"空结果"。
"""

from __future__ import annotations

import asyncio
import json

import pytest

from app.infrastructure.changefeed import change_ledger_client as client_module
from app.infrastructure.changefeed.change_ledger_client import (
    DEFAULT_PAGE_SIZE,
    ChangeFileType,
    ChangeLedgerClient,
    ChangeLedgerUnavailable,
    ChangeOperation,
)


class _FakeResponse:
    def __init__(self, status: int, body: str) -> None:
        self.status = status
        self._body = body

    async def text(self) -> str:
        return self._body

    async def __aenter__(self) -> "_FakeResponse":
        return self

    async def __aexit__(self, *exc) -> bool:
        return False


class _FakeSession:
    """记录请求并返回脚本化响应，替代 aiohttp 的真实会话。"""

    def __init__(self, response, record: dict, *, raises: Exception | None = None) -> None:
        self._response = response
        self._record = record
        self._raises = raises

    async def __aenter__(self) -> "_FakeSession":
        return self

    async def __aexit__(self, *exc) -> bool:
        return False

    def get(self, url, params=None, headers=None):
        self._record["url"] = url
        self._record["params"] = params
        self._record["headers"] = headers
        if self._raises is not None:
            raise self._raises
        return self._response


class _FakeTimeout:
    def __init__(self, **kwargs) -> None:
        self.kwargs = kwargs


def _install_transport(monkeypatch, response, record, *, raises=None) -> None:
    """把模块看到的 aiohttp 换成 shim，避免污染全局 aiohttp 状态。"""

    class _Shim:
        # 名字必须和被替换的 aiohttp API 完全一致：这个 shim 的职责就是让被测代码
        # 察觉不到替换，改名会让测试通过而生产代码照旧走真会话。
        ClientTimeout = _FakeTimeout
        ClientError = client_module.aiohttp.ClientError

        @staticmethod
        def ClientSession(**kwargs):  # noqa: N802
            return _FakeSession(response, record, raises=raises)

    monkeypatch.setattr(client_module, "aiohttp", _Shim)


async def _write_metadata(tmp_path, payload) -> str:
    path = tmp_path / "metadata.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return str(path)


def _page_body(**overrides) -> str:
    payload = {
        "mount": "/magicfs/project",
        "space": "project",
        "revision": 42,
        "oldest_revision": 1,
        "cursor_expired": False,
        "has_more": False,
        "changes": [
            {
                "revision": 41,
                "operation": "create",
                "file_id": "f1",
                "file_type": "file",
                "path": "/docs/a.md",
                "size": 12,
            },
            {
                "revision": 42,
                "operation": "delete",
                "file_id": "f2",
                "file_type": "directory",
                "path": "/vendor",
            },
        ],
    }
    payload.update(overrides)
    return json.dumps(payload)


@pytest.mark.asyncio
async def test_fetch_parses_the_page_and_sends_the_cursor(tmp_path, monkeypatch):
    metadata = await _write_metadata(tmp_path, {"authorization": "user-token"})
    record: dict = {}
    _install_transport(monkeypatch, _FakeResponse(200, _page_body()), record)

    client = ChangeLedgerClient(base_url="http://localhost:8080/", metadata_path=metadata)
    page = await client.fetch(7, limit=64)

    assert record["url"] == "http://localhost:8080/api/v1/changes"
    assert record["params"] == {
        "mount": "/magicfs/project",
        "since_revision": "7",
        "limit": "64",
    }
    # 头名必须与 agfs-server 的 UserAuthMiddleware 完全一致，否则数据层直接 401。
    assert record["headers"][client_module.USER_AUTHORIZATION_HEADER] == "user-token"

    assert page.revision == 42
    assert page.cursor_expired is False
    assert [c.operation for c in page.changes] == [ChangeOperation.CREATE, ChangeOperation.DELETE]
    assert page.changes[0].path == "/docs/a.md"
    assert page.changes[0].size == 12
    # 目录没有大小；客户端必须按类型区分，而不是把 0 当成空文件。
    assert page.changes[1].file_type is ChangeFileType.DIRECTORY


@pytest.mark.asyncio
async def test_fetch_defaults_the_page_size(tmp_path, monkeypatch):
    metadata = await _write_metadata(tmp_path, {"authorization": "t"})
    record: dict = {}
    _install_transport(monkeypatch, _FakeResponse(200, _page_body()), record)

    await ChangeLedgerClient(metadata_path=metadata).fetch(0)

    assert record["params"]["limit"] == str(DEFAULT_PAGE_SIZE)


@pytest.mark.asyncio
async def test_fetch_clamps_a_negative_cursor(tmp_path, monkeypatch):
    metadata = await _write_metadata(tmp_path, {"authorization": "t"})
    record: dict = {}
    _install_transport(monkeypatch, _FakeResponse(200, _page_body()), record)

    await ChangeLedgerClient(metadata_path=metadata).fetch(-3)

    assert record["params"]["since_revision"] == "0"


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [404, 501])
async def test_mount_without_a_ledger_is_a_permanent_unavailability(tmp_path, monkeypatch, status):
    """能力缺失是部署状态，重试不会有结果：只该记一次日志。"""
    metadata = await _write_metadata(tmp_path, {"authorization": "t"})
    _install_transport(monkeypatch, _FakeResponse(status, "no ledger here"), {})

    client = ChangeLedgerClient(metadata_path=metadata)
    with pytest.raises(ChangeLedgerUnavailable) as error:
        await client.fetch(0)

    assert error.value.permanent is True


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [401, 403, 503])
async def test_auth_failures_are_transient(tmp_path, monkeypatch, status):
    """令牌轮换/沙箱未绑定都会自愈，下次必须照常重试。"""
    metadata = await _write_metadata(tmp_path, {"authorization": "t"})
    _install_transport(monkeypatch, _FakeResponse(status, "nope"), {})

    with pytest.raises(ChangeLedgerUnavailable) as error:
        await ChangeLedgerClient(metadata_path=metadata).fetch(0)

    assert error.value.permanent is False


@pytest.mark.asyncio
async def test_transport_failure_is_transient(tmp_path, monkeypatch):
    metadata = await _write_metadata(tmp_path, {"authorization": "t"})
    _install_transport(
        monkeypatch,
        _FakeResponse(200, "{}"),
        {},
        raises=client_module.aiohttp.ClientError("connection refused"),
    )

    with pytest.raises(ChangeLedgerUnavailable) as error:
        await ChangeLedgerClient(metadata_path=metadata).fetch(0)

    assert error.value.permanent is False


@pytest.mark.asyncio
async def test_missing_authorization_is_refused_before_the_request(tmp_path, monkeypatch):
    """沙箱未绑定时不发请求：一次注定 503 的往返没有意义。"""
    metadata = await _write_metadata(tmp_path, {"authorization": None})
    record: dict = {}
    _install_transport(monkeypatch, _FakeResponse(200, _page_body()), record)

    with pytest.raises(ChangeLedgerUnavailable):
        await ChangeLedgerClient(metadata_path=metadata).fetch(0)

    assert record == {}


@pytest.mark.asyncio
async def test_malformed_json_is_unavailable_not_an_empty_page(tmp_path, monkeypatch):
    metadata = await _write_metadata(tmp_path, {"authorization": "t"})
    _install_transport(monkeypatch, _FakeResponse(200, "{not json"), {})

    with pytest.raises(ChangeLedgerUnavailable):
        await ChangeLedgerClient(metadata_path=metadata).fetch(0)


@pytest.mark.asyncio
async def test_unknown_operation_skips_only_that_row(tmp_path, monkeypatch):
    """agfs 先上线了新动词不该让整页变成"这段时间没有变化"。"""
    metadata = await _write_metadata(tmp_path, {"authorization": "t"})
    body = json.dumps(
        {
            "revision": 5,
            "changes": [
                {"revision": 4, "operation": "create", "path": "/a.txt", "file_type": "file"},
                {"revision": 5, "operation": "teleport", "path": "/b.txt", "file_type": "file"},
            ],
        }
    )
    _install_transport(monkeypatch, _FakeResponse(200, body), {})

    page = await ChangeLedgerClient(metadata_path=metadata).fetch(0)

    assert [c.path for c in page.changes] == ["/a.txt"]


@pytest.mark.asyncio
async def test_cancellation_is_never_downgraded_to_unavailability(tmp_path, monkeypatch):
    """中断必须原样冒泡。

    把它包成 ChangeLedgerUnavailable 会让"用户点了终止"变成一次静默降级，Agent 会继续
    跑下去——这正是项目规则里明确禁止的取消语义破坏。
    """
    metadata = await _write_metadata(tmp_path, {"authorization": "t"})
    _install_transport(monkeypatch, _FakeResponse(200, "{}"), {}, raises=asyncio.CancelledError())

    with pytest.raises(asyncio.CancelledError):
        await ChangeLedgerClient(metadata_path=metadata).fetch(0)
