import pytest

from app.tools.read_file import ReadFile, ReadFileParams
from app.tools.read_files import FileReadOperation, ReadFiles, ReadFilesParams


@pytest.mark.asyncio
@pytest.mark.parametrize("file_name", [
    "large.pdf",
    "slides.pptx",
    "legacy.doc",
    "legacy.docx",
    "macro.docm",
    "template.dotx",
    "open.odt",
    "rich.rtf",
    "legacy.wps",
    "legacy.xls",
    "legacy.xlsx",
    "macro.xlsm",
    "open.ods",
    "data.tsv",
    "show.odp",
    "deck.ppsx",
    "notebook.ipynb",
    "image.png",
    "scan.tif",
])
async def test_read_file_rejects_complex_documents_with_skill_hint(tmp_path, file_name):
    file_path = tmp_path / file_name
    file_path.write_bytes(b"not parsed by read_file")

    tool = ReadFile(base_dir=tmp_path)
    result = await tool.execute_purely(ReadFileParams(file_path=file_name))

    assert not result.ok
    assert "document-converter" in result.content
    assert "read_skills(['document-converter'])" in result.content
    assert "read_file cannot directly read this document format" in result.content


@pytest.mark.asyncio
async def test_read_file_still_reads_direct_text_files(tmp_path):
    file_path = tmp_path / "data.csv"
    file_path.write_text("name,value\nalpha,1\n", encoding="utf-8")

    tool = ReadFile(base_dir=tmp_path)
    result = await tool.execute_purely(ReadFileParams(file_path="data.csv", limit=-1))

    assert result.ok
    assert "alpha,1" in result.content
    assert result.extra_info["read_method"] == "text"


@pytest.mark.asyncio
async def test_read_files_reuses_read_file_document_converter_error(tmp_path):
    file_path = tmp_path / "slides.pptx"
    file_path.write_bytes(b"not parsed by read_files")

    tool = ReadFiles(base_dir=tmp_path)
    result = await tool.execute(None, ReadFilesParams(operations=[
        FileReadOperation(file_path="slides.pptx")
    ]))

    assert result.ok
    assert "document-converter" in result.content
    assert "read_skills(['document-converter'])" in result.content
    assert "read_file cannot directly read this document format" in result.content
    assert result.extra_info["success_count"] == 0
    assert result.extra_info["failure_count"] == 1


def test_read_files_prompt_no_longer_claims_complex_document_support():
    prompt = ReadFiles().get_prompt_hint()

    assert "PDF files (.pdf)" not in prompt
    assert "Word documents" not in prompt
    assert "Excel files" not in prompt
    assert "PowerPoint (.ppt" not in prompt
    assert "Jupyter notebooks" not in prompt
    assert "document-converter" in prompt
