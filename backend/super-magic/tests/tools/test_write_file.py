import json

import pytest

from app.tools.write_file import WriteFile, WriteFileParams

INVALID_JSON_WITH_QUOTES = '{"text":"mock prefix "quoted mock phrase" mock suffix"}'
REPAIRED_JSON_PAYLOAD = {"text": 'mock prefix "quoted mock phrase" mock suffix'}


@pytest.mark.asyncio
async def test_write_file_auto_repairs_new_json_file(tmp_path):
    tool = WriteFile(base_dir=tmp_path)
    content = INVALID_JSON_WITH_QUOTES

    result = await tool.execute(None, WriteFileParams(file_path="draft.json", content=content))

    written = (tmp_path / "draft.json").read_text(encoding="utf-8")
    payload = json.loads(written)
    assert result.ok
    assert result.extra_info["auto_repaired_json"] is True
    assert result.extra_info["original_syntax_errors"]
    assert "JSON content was auto-repaired before writing" in result.content
    assert "The file on disk now contains the repaired, valid JSON content" in result.content
    assert "Do not retry this write only to fix JSON syntax" in result.content
    assert payload == REPAIRED_JSON_PAYLOAD


@pytest.mark.asyncio
async def test_write_file_keeps_valid_new_json_content(tmp_path):
    tool = WriteFile(base_dir=tmp_path)
    content = '{"text": "valid"}'

    result = await tool.execute(None, WriteFileParams(file_path="valid.json", content=content))

    written = (tmp_path / "valid.json").read_text(encoding="utf-8")
    assert result.ok
    assert result.extra_info["auto_repaired_json"] is False
    assert result.extra_info["original_syntax_errors"] == []
    assert json.loads(written) == {"text": "valid"}
    assert "JSON content was auto-repaired" not in result.content


@pytest.mark.asyncio
async def test_write_file_does_not_auto_repair_existing_json_file(tmp_path):
    target = tmp_path / "existing.json"
    target.write_text('{"old": true}\n', encoding="utf-8")

    tool = WriteFile(base_dir=tmp_path)
    content = INVALID_JSON_WITH_QUOTES

    result = await tool.execute(None, WriteFileParams(file_path="existing.json", content=content))

    written = target.read_text(encoding="utf-8")
    assert result.ok
    assert result.extra_info["auto_repaired_json"] is False
    assert result.extra_info["original_syntax_errors"] == []
    assert written == content + "\n"
    assert "Warning: File has syntax issues" in result.content


@pytest.mark.asyncio
async def test_write_file_does_not_auto_repair_non_json_file(tmp_path):
    tool = WriteFile(base_dir=tmp_path)
    content = INVALID_JSON_WITH_QUOTES

    result = await tool.execute(None, WriteFileParams(file_path="draft.txt", content=content))

    written = (tmp_path / "draft.txt").read_text(encoding="utf-8")
    assert result.ok
    assert result.extra_info["auto_repaired_json"] is False
    assert result.extra_info["original_syntax_errors"] == []
    assert written == content + "\n"
