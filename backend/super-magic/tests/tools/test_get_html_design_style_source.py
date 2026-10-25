"""get_html_design_style_source 工具的契约测试。"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from pydantic import ValidationError

from app.tools.get_html_design_style_source import (
    GetHtmlDesignStyleSource,
    GetHtmlDesignStyleSourceParams,
)


def _fake_sdk(get_source_async: AsyncMock) -> SimpleNamespace:
    return SimpleNamespace(html_design_style=SimpleNamespace(get_source_async=get_source_async))


def test_tool_is_code_mode_only() -> None:
    assert GetHtmlDesignStyleSource.name == "get_html_design_style_source"
    assert GetHtmlDesignStyleSource.code_mode_only is True


def test_params_strip_surrounding_whitespace() -> None:
    assert GetHtmlDesignStyleSourceParams(style_code=" apple ").style_code == "apple"


@pytest.mark.parametrize("value", ["", "Apple", "../apple", "a/b", "-apple", "apple style"])
def test_params_reject_malformed_style_code(value: str) -> None:
    with pytest.raises(ValidationError):
        GetHtmlDesignStyleSourceParams(style_code=value)


@pytest.mark.asyncio
async def test_execute_returns_full_source_in_content() -> None:
    get_source = AsyncMock(
        return_value=SimpleNamespace(style_code="apple", content="---\nname: Apple\n---\nbody", sha256="abc")
    )
    with patch("app.tools.get_html_design_style_source.get_magic_service_sdk", return_value=_fake_sdk(get_source)):
        result = await GetHtmlDesignStyleSource().execute(None, GetHtmlDesignStyleSourceParams(style_code="apple"))

    assert result.ok
    assert "name: Apple" in result.content
    assert "sha256 abc" in result.content
    # 全文只放在 content，data 仅保留校验摘要。
    assert result.data == {"style_code": "apple", "sha256": "abc", "length": len("---\nname: Apple\n---\nbody")}


@pytest.mark.asyncio
async def test_execute_reports_service_failure() -> None:
    get_source = AsyncMock(side_effect=RuntimeError("boom http://internal.example/secret"))
    with patch("app.tools.get_html_design_style_source.get_magic_service_sdk", return_value=_fake_sdk(get_source)):
        result = await GetHtmlDesignStyleSource().execute(None, GetHtmlDesignStyleSourceParams(style_code="apple"))

    assert not result.ok
    assert "apple" in result.content
    # 异常类型可见，异常 message（可能含内部地址）不进入模型上下文。
    assert "RuntimeError" in result.content
    assert "boom" not in result.content
    assert "internal.example" not in result.content


@pytest.mark.asyncio
async def test_execute_rejects_empty_source() -> None:
    get_source = AsyncMock(return_value=SimpleNamespace(style_code="apple", content="  ", sha256="abc"))
    with patch("app.tools.get_html_design_style_source.get_magic_service_sdk", return_value=_fake_sdk(get_source)):
        result = await GetHtmlDesignStyleSource().execute(None, GetHtmlDesignStyleSourceParams(style_code="apple"))

    assert not result.ok
    assert "empty" in result.content
