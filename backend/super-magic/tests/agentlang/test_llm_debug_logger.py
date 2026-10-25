import time
import sys
import types
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from agentlang.llms.utils.debug_logger import (
    LLMDebugInfo,
    _get_llm_request_log_max_files,
    _prune_llm_request_logs,
    _sanitize_request_params,
    _save_failed_log_archive,
    save_llm_debug_log,
)
from app.path_manager import PathManager
from app.utils.async_file_utils import (
    async_exists,
    async_mkdir,
    async_read_text,
    async_scandir,
    async_write_text,
)


@pytest.fixture(autouse=True)
def _isolate_failed_archives(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(PathManager, "get_topic_dir", classmethod(lambda cls: tmp_path / ".topic"))


class _MockChatHistoryCleanupService:
    """用于隔离日志单测的清理服务 mock。"""

    trigger = staticmethod(lambda: None)


def _mock_cleanup_module() -> types.ModuleType:
    """构造不加载真实云存储依赖的清理服务模块。"""
    module = types.ModuleType("app.service.chat_history_cleanup_service")
    module.ChatHistoryCleanupService = _MockChatHistoryCleanupService
    return module


def test_llm_debug_log_sanitizes_sensitive_request_params():
    sanitized = _sanitize_request_params({
        "model": "mock-model",
        "extra_headers": {
            "Magic-Authorization": "magic-secret",
            "User-Authorization": "user-secret",
            "Magic-Task-Id": "task-id",
        },
        "extra_body": {
            "api_key": "body-secret",
        },
    })

    assert sanitized["extra_headers"]["Magic-Authorization"] == "<redacted>"
    assert sanitized["extra_headers"]["User-Authorization"] == "<redacted>"
    assert sanitized["extra_headers"]["Magic-Task-Id"] == "task-id"
    assert sanitized["extra_body"]["api_key"] == "<redacted>"


@pytest.mark.parametrize(
    ("config_value", "expected"),
    [
        (10, 10),
        ("0", 0),
        ("10", 10),
    ],
)
def test_get_llm_request_log_max_files(config_value: int | str, expected: int) -> None:
    with patch("agentlang.config.config.config.get", return_value=config_value) as get_config:
        assert _get_llm_request_log_max_files() == expected
    get_config.assert_called_once_with("runtime_cleanup.llm_request.max_file_count")


@pytest.mark.parametrize("config_value", [None, True, "-3", "invalid"])
def test_get_llm_request_log_max_files_rejects_invalid_config(config_value: object) -> None:
    with patch("agentlang.config.config.config.get", return_value=config_value):
        with pytest.raises(ValueError):
            _get_llm_request_log_max_files()


@pytest.mark.asyncio
async def test_prune_llm_request_logs_keeps_latest_files(tmp_path: Path):
    log_dir = tmp_path / PathManager.get_llm_requests_dir_name()
    log_dir.mkdir()

    paths = []
    for index in range(3):
        path = log_dir / f"model_{index}.log"
        path.write_text(f"log-{index}", encoding="utf-8")
        paths.append(path)
        time.sleep(0.01)

    await _prune_llm_request_logs(log_dir, 2)

    remaining = sorted(path.name for path in log_dir.glob("*.log"))
    assert remaining == ["model_1.log", "model_2.log"]


@pytest.mark.asyncio
async def test_prune_llm_request_logs_noop_when_unlimited(tmp_path: Path):
    log_dir = tmp_path / PathManager.get_llm_requests_dir_name()
    log_dir.mkdir()

    for index in range(3):
        (log_dir / f"model_{index}.log").write_text(f"log-{index}", encoding="utf-8")

    await _prune_llm_request_logs(log_dir, 0)

    assert len(list(log_dir.glob("*.log"))) == 3


@pytest.mark.asyncio
async def test_save_llm_debug_log_prunes_after_write(tmp_path: Path, monkeypatch):
    monkeypatch.setattr("agentlang.llms.utils.debug_logger._get_llm_request_log_max_files", lambda: 2)

    runtime_dir = tmp_path / ".runtime"
    runtime_dir.mkdir()
    log_dir = runtime_dir / PathManager.get_llm_requests_dir_name()
    log_dir.mkdir()

    for index in range(2):
        (log_dir / f"old_{index}.log").write_text(f"old-{index}", encoding="utf-8")
        time.sleep(0.01)

    debug_info = LLMDebugInfo(
        model_id="mock-model",
        model_name="mock-model",
        provider="mock-provider",
        api_base_url="https://example.com",
        api_key="secret",
    )

    with (
        patch("app.path_manager.PathManager.get_llm_requests_dir", return_value=log_dir),
        patch("app.utils.runtime_storage.ensure_runtime_directory", new=AsyncMock(return_value=log_dir)),
        patch.dict(sys.modules, {"app.service.chat_history_cleanup_service": _mock_cleanup_module()}),
    ):
        await save_llm_debug_log(
            debug_info=debug_info,
            request_params={"model": "mock-model"},
            exception=RuntimeError("boom"),
            start_timestamp="2026-08-12T15:00:00",
            end_timestamp="2026-08-12T15:00:01",
        )

    remaining = sorted(log_dir.glob("*.log"), key=lambda path: path.stat().st_mtime)
    assert len(remaining) == 2
    assert all(path.name.startswith("mock-model_") or path.name.startswith("old_") for path in remaining)
    assert remaining[0].name.startswith("old_1.log")
    assert remaining[1].name.startswith("mock-model_")
    archived = PathManager.get_llm_failed_logs_archive_dir() / remaining[1].name
    assert await async_read_text(archived) == await async_read_text(remaining[1])


@pytest.mark.asyncio
async def test_save_llm_debug_log_prunes_backlog_without_writing_success_log(
    tmp_path: Path,
    monkeypatch,
):
    monkeypatch.setattr("agentlang.llms.utils.debug_logger._get_llm_request_log_max_files", lambda: 2)
    monkeypatch.setenv("ENABLE_LLM_SUCCESS_REQUEST_LOG", "false")

    runtime_dir = tmp_path / ".runtime"
    runtime_dir.mkdir()
    log_dir = runtime_dir / PathManager.get_llm_requests_dir_name()
    log_dir.mkdir()

    for index in range(5):
        (log_dir / f"old_{index}.log").write_text(f"old-{index}", encoding="utf-8")
        time.sleep(0.01)

    debug_info = LLMDebugInfo(
        model_id="mock-model",
        model_name="mock-model",
        provider="mock-provider",
        api_base_url="https://example.com",
        api_key="secret",
    )

    with (
        patch("app.path_manager.PathManager.get_llm_requests_dir", return_value=log_dir),
        patch("app.utils.runtime_storage.ensure_runtime_directory", new=AsyncMock(return_value=log_dir)),
        patch.dict(sys.modules, {"app.service.chat_history_cleanup_service": _mock_cleanup_module()}),
    ):
        await save_llm_debug_log(
            debug_info=debug_info,
            request_params={"model": "mock-model"},
            response=object(),  # 模拟成功响应，不触发写盘
            start_timestamp="2026-08-12T15:00:00",
            end_timestamp="2026-08-12T15:00:01",
        )

    remaining = sorted(path.name for path in log_dir.glob("*.log"))
    assert remaining == ["old_3.log", "old_4.log"]
    assert not await async_exists(PathManager.get_llm_failed_logs_archive_dir())


def _failed_archive_name(index: int) -> str:
    return f"model_20260909_120000_000_100_{index:032x}_failed.log"


@pytest.mark.asyncio
async def test_failed_archive_repeated_save_does_not_replace_remote_file() -> None:
    """同一次失败的重试复用原文件，不触发挂载内 rename/replace 或重复覆盖。"""
    content = "完整失败记录\n=== END LOG ==="
    name = _failed_archive_name(1)
    with (
        patch("os.rename", side_effect=AssertionError("remote rename is forbidden")),
        patch("os.replace", side_effect=AssertionError("remote replace is forbidden")),
        patch("app.utils.async_file_utils.async_write_text", wraps=async_write_text) as write,
    ):
        await _save_failed_log_archive(name, content)
        await _save_failed_log_archive(name, content)
    write.assert_awaited_once()
    assert await async_read_text(PathManager.get_llm_failed_logs_archive_dir() / name) == content


@pytest.mark.asyncio
async def test_failed_archive_write_error_preserves_previous_complete_logs() -> None:
    """D 半写失败后只清理 D，已有 A/B/C 的内容保持可读。"""
    content = "complete\n=== END LOG ==="
    root = PathManager.get_llm_failed_logs_archive_dir()
    for index in range(3):
        await _save_failed_log_archive(_failed_archive_name(index), content)

    async def fail_after_partial_write(path: Path, _content: str) -> None:
        await async_write_text(path, "partial")
        raise OSError("write interrupted")

    with patch("app.utils.async_file_utils.async_write_text", new=fail_after_partial_write):
        await _save_failed_log_archive(_failed_archive_name(3), content)
    assert not await async_exists(root / _failed_archive_name(3))
    for index in range(3):
        assert await async_read_text(root / _failed_archive_name(index)) == content


@pytest.mark.asyncio
async def test_failed_archive_prunes_only_owned_logs_after_complete_write() -> None:
    """半写残留不挤占名额，未知文件和其它能力目录不属于日志清理器。"""
    root = PathManager.get_llm_failed_logs_archive_dir()
    await async_mkdir(root, parents=True, exist_ok=True)
    await async_write_text(root / "unknown.log", "keep")
    other = root.parent / "another-capability" / "keep.log"
    await async_write_text(other, "keep")
    await async_write_text(root / _failed_archive_name(9), "partial")
    for index in range(4):
        await _save_failed_log_archive(_failed_archive_name(index), f"log-{index}\n=== END LOG ===")
    assert {entry.name for entry in await async_scandir(root)} == {
        "unknown.log", *(_failed_archive_name(index) for index in range(1, 4)),
    }
    assert await async_read_text(other) == "keep"
