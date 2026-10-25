"""Selected file preparation keeps successful files and cleans failed downloads."""

from __future__ import annotations

import asyncio
import os
import time
from types import SimpleNamespace

import httpx
import pytest

from app.path_manager import PathManager
from app.tools.super_magic import prepare_files


@pytest.mark.asyncio
async def test_prepare_selected_files_keeps_success_and_reports_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(PathManager, "get_runtime_dir", classmethod(lambda cls: tmp_path))
    real_client = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(200, content=b"hello"))
    monkeypatch.setattr(prepare_files.httpx, "AsyncClient", lambda **kwargs: real_client(transport=transport, **kwargs))

    async def get_urls(auth, file_ids):
        assert file_ids == ["1", "2"]
        return {"list": [{"file_id": "1", "url": "https://files.example/1"}], "missing_file_ids": ["2"], "partial_success": True}

    async def get_info(auth, file_id):
        return {"file_name": "notes.txt"}

    files = SimpleNamespace(get_product_file_urls_async=get_urls, get_product_file_async=get_info)
    ctx = SimpleNamespace(sdk=SimpleNamespace(file=files), auth=object(), agent=SimpleNamespace(is_interruption_requested=lambda: False))
    result = await prepare_files.PrepareProjectFiles()._prepare(ctx, ["1", "2"])

    assert result["partial_success"] is True
    assert result["files"][0]["status"] == "prepared"
    assert result["files"][1]["status"] == "failed"
    assert open(result["files"][0]["path"], "rb").read() == b"hello"


@pytest.mark.asyncio
async def test_overlarge_file_is_removed(monkeypatch, tmp_path):
    monkeypatch.setattr(PathManager, "get_runtime_dir", classmethod(lambda cls: tmp_path))
    monkeypatch.setattr(prepare_files, "MAX_FILE", 4)
    real_client = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(200, content=b"12345"))
    monkeypatch.setattr(prepare_files.httpx, "AsyncClient", lambda **kwargs: real_client(transport=transport, **kwargs))

    async def get_urls(auth, file_ids):
        return {"list": [{"file_id": "1", "url": "https://files.example/1"}], "missing_file_ids": []}

    async def get_info(auth, file_id):
        return {"file_name": "notes.txt"}

    files = SimpleNamespace(get_product_file_urls_async=get_urls, get_product_file_async=get_info)
    ctx = SimpleNamespace(sdk=SimpleNamespace(file=files), auth=object(), agent=SimpleNamespace(is_interruption_requested=lambda: False))
    result = await prepare_files.PrepareProjectFiles()._prepare(ctx, ["1"])
    assert result["files"][0]["status"] == "failed"
    assert list((tmp_path / "super-magic-product-files").rglob("*.txt")) == []


@pytest.mark.asyncio
async def test_interruption_removes_request_directory(monkeypatch, tmp_path):
    monkeypatch.setattr(PathManager, "get_runtime_dir", classmethod(lambda cls: tmp_path))

    async def get_urls(auth, file_ids):
        return {"list": [{"file_id": "1", "url": "https://files.example/1"}], "missing_file_ids": []}

    files = SimpleNamespace(get_product_file_urls_async=get_urls)
    ctx = SimpleNamespace(sdk=SimpleNamespace(file=files), auth=object(), agent=SimpleNamespace(is_interruption_requested=lambda: True))
    with pytest.raises(asyncio.CancelledError):
        await prepare_files.PrepareProjectFiles()._prepare(ctx, ["1"])
    assert list((tmp_path / "super-magic-product-files").iterdir()) == []


def test_expired_preparations_are_removed(tmp_path):
    old = tmp_path / "old"
    old.mkdir()
    (old / "1.txt").write_text("old", encoding="utf-8")
    past = time.time() - prepare_files.RETENTION_SECONDS - 1
    os.utime(old, (past, past))
    assert prepare_files._cleanup_expired(tmp_path) == 0
    assert not old.exists()
