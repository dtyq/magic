"""文件保存遇损坏载荷时必须阻断写入，不把密文当正文保存。"""

from pathlib import Path
from unittest.mock import AsyncMock, Mock

import pytest

from app.service.file_save_service import FileSaveService


@pytest.mark.asyncio
async def test_declared_plain_text_preserves_reserved_prefix():
    """明确的明文不按前缀猜测其编码状态。"""
    service = FileSaveService()
    for content in ("SHADOWED_hello", "SHADOWED2_!", "SHADOWED3_anything"):
        assert await service.process_file_content(content, is_encrypted=False) == content


@pytest.mark.asyncio
async def test_invalid_encoding_prevents_file_write():
    """实际单文件处理在解码失败时不能进入文件写入。"""
    service = FileSaveService()
    service._get_safe_target_path = Mock(return_value=Path("/mock/mock.txt"))
    service.safe_write_text_file = AsyncMock()
    result = await service.edit_single_file("mock-key", "mock.txt", "SHADOWED2_!", is_encrypted=True)
    assert result.success is False
    assert result.error_message == "Failed to decode file content"
    service.safe_write_text_file.assert_not_awaited()


@pytest.mark.asyncio
async def test_decode_error_does_not_include_original_payload():
    """错误信息不回显模拟正文。"""
    with pytest.raises(ValueError, match=r"^Failed to decode file content$"):
        await FileSaveService().process_file_content("SHADOWED2_mock-sensitive-content", is_encrypted=True)
