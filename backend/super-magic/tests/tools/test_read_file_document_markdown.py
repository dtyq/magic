import pytest

from app.tools.read_file import ReadFile, ReadFileParams


@pytest.mark.asyncio
@pytest.mark.parametrize("file_name", ["large.pdf", "slides.pptx", "legacy.doc", "legacy.xls"])
async def test_read_file_rejects_complex_documents_with_skill_hint(tmp_path, file_name):
    file_path = tmp_path / file_name
    file_path.write_bytes(b"not parsed by read_file")

    tool = ReadFile(base_dir=tmp_path)
    result = await tool.execute_purely(ReadFileParams(file_path=file_name))

    assert not result.ok
    assert "document-converter" in result.content
    assert "read_file cannot directly read this document format" in result.content
