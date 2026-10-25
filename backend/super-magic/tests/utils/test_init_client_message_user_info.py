"""在隔离目录验证 INIT 保存及后续 CHAT 的来源用户 ID 更新。"""

from types import SimpleNamespace

import pytest

from app.core.entity.message.client_message import InitClientMessage, Metadata
from app.path_manager import PathManager
from app.utils.async_file_utils import async_read_json
from app.utils.init_client_message_util import InitClientMessageUtil


@pytest.fixture
def message_files(tmp_path, monkeypatch):
    """替换所有持久化路径，禁止触碰真实凭证与会话文件。"""
    init_path = tmp_path / "init_client_message.json"
    monkeypatch.setattr(InitClientMessageUtil, "_config_path", init_path)
    monkeypatch.setattr(PathManager, "get_init_client_message_file", classmethod(lambda cls: init_path))
    monkeypatch.setattr(PathManager, "get_chat_client_message_file", classmethod(lambda cls: tmp_path / "chat_client_message.json"))
    monkeypatch.setattr(PathManager, "get_client_message_metadata_file", classmethod(lambda cls: tmp_path / "metadata.json"))
    return init_path


@pytest.mark.asyncio
async def test_init_and_chat_keep_and_clear_source_identity(message_files):
    """保存 INIT 后，完整 CHAT 可更新或清空来源 ID。"""
    metadata = Metadata.model_validate({"user_id": "mock-user", "user": {"id": "mock-user", "third_platform_id": "00123"}})
    # 只构造持久化所需的消息，避免触发与测试无关的订阅配置验证。
    await InitClientMessageUtil.save_init_client_message(InitClientMessage.model_construct(metadata=metadata))
    assert (await async_read_json(message_files))["metadata"]["user"]["third_platform_id"] == "00123"
    for source_id in ("mock-updated", ""):
        metadata = Metadata.model_validate({"super_magic_task_id": "mock-task", "user": {"id": "mock-user", "third_platform_id": source_id}})
        message = SimpleNamespace(metadata=metadata, model_dump=lambda: {"metadata": metadata.model_dump()})
        await InitClientMessageUtil.save_chat_client_message(message)
        assert (await async_read_json(message_files))["metadata"]["user"]["third_platform_id"] == source_id


@pytest.mark.asyncio
async def test_partial_chat_does_not_replace_saved_user(message_files):
    """不携带用户资料的局部消息不会抹掉 INIT 的身份字段。"""
    initial = Metadata.model_validate({"user": {"third_platform_id": "mock-origin"}})
    await InitClientMessageUtil.save_init_client_message(InitClientMessage.model_construct(metadata=initial))
    for payload in ({"super_magic_task_id": "mock-task"}, {"user": {"third_platform_id": "mock-ignored"}}):
        metadata = Metadata.model_validate(payload)
        message = SimpleNamespace(metadata=metadata, model_dump=lambda: {"metadata": metadata.model_dump()})
        await InitClientMessageUtil.save_chat_client_message(message)
        assert (await async_read_json(message_files))["metadata"]["user"]["third_platform_id"] == "mock-origin"
