"""异步文件工具的网络存储回归测试。"""

from __future__ import annotations

import os
from unittest.mock import AsyncMock

import pytest

from app.utils import async_file_utils


@pytest.mark.asyncio
async def test_write_text_with_retry_ignores_stale_path_stat(monkeypatch, tmp_path) -> None:
    """路径 stat 仍报告旧的空文件时，应使用新句柄验证已写入内容。"""
    stale_stat = AsyncMock(return_value=os.stat_result((0,) * 10))
    fresh_stat = AsyncMock(wraps=async_file_utils.async_fresh_stat)
    monkeypatch.setattr(async_file_utils, "async_stat", stale_stat)
    monkeypatch.setattr(async_file_utils, "async_fresh_stat", fresh_stat)

    target = tmp_path / "magic.project.js"
    content = '{"elements": []}'
    await async_file_utils.async_write_text_with_retry(
        target,
        content,
        retry_delay=0,
        content_validator=lambda value: value == content,
    )

    fresh_stat.assert_awaited_once_with(target)
    stale_stat.assert_not_awaited()
    assert await async_file_utils.async_read_text(target) == content
