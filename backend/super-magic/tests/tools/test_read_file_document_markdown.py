import pytest

from agentlang.context.tool_context import ToolContext
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
async def test_read_file_fuzzy_matches_medium_risk_filename_symbols(tmp_path):
    file_path = tmp_path / "mock《title》 - 1.TXT"
    file_path.write_text("matched content\n", encoding="utf-8")

    tool = ReadFile(base_dir=tmp_path)
    result = await tool.execute_purely(ReadFileParams(file_path='mock"title"_1.txt', limit=-1))

    assert result.ok
    assert "matched content" in result.content
    assert "Path Auto-Correction Applied" in result.content
    assert result.extra_info["read_path"] == str(file_path)


@pytest.mark.asyncio
async def test_read_file_after_remark_includes_paged_line_range(tmp_path):
    file_path = tmp_path / "notes.md"
    file_path.write_text("\n".join([f"line {i}" for i in range(1, 21)]), encoding="utf-8")

    tool = ReadFile(base_dir=tmp_path)
    arguments = {"file_path": "notes.md", "offset": 4, "limit": 5}
    tool_context = ToolContext(tool_name="read_file", arguments=arguments)

    result = await tool.execute(tool_context, ReadFileParams(**arguments))
    after = await tool.get_after_tool_call_friendly_action_and_remark(
        "read_file",
        tool_context,
        result,
        0.1,
        arguments,
    )

    assert result.ok
    assert result.extra_info["read_range"] == {"start_line": 5, "end_line": 9}
    assert "notes.md" in after["remark"]
    assert "5" in after["remark"]
    assert "9" in after["remark"]


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


@pytest.mark.asyncio
async def test_read_files_after_remark_includes_paged_line_ranges(tmp_path):
    (tmp_path / "a.py").write_text("\n".join([f"a{i}" for i in range(1, 11)]), encoding="utf-8")
    (tmp_path / "b.py").write_text("\n".join([f"b{i}" for i in range(1, 11)]), encoding="utf-8")

    tool = ReadFiles(base_dir=tmp_path)
    operations = [
        {"file_path": "a.py", "offset": 0, "limit": 3},
        {"file_path": "b.py", "offset": 4, "limit": 2},
    ]
    tool_context = ToolContext(tool_name="read_files", arguments={"operations": operations})

    result = await tool.execute(
        tool_context,
        ReadFilesParams(operations=[FileReadOperation(**operation) for operation in operations]),
    )
    after = await tool.get_after_tool_call_friendly_action_and_remark(
        "read_files",
        tool_context,
        result,
        0.1,
        {"operations": operations},
    )

    assert result.ok
    assert result.extra_info["file_results"][0]["read_range"] == {"start_line": 1, "end_line": 3}
    assert result.extra_info["file_results"][1]["read_range"] == {"start_line": 5, "end_line": 6}
    assert "a.py" in after["remark"]
    assert "b.py" in after["remark"]
    assert "1" in after["remark"]
    assert "3" in after["remark"]
    assert "5" in after["remark"]
    assert "6" in after["remark"]


@pytest.mark.asyncio
async def test_read_files_accepts_legacy_single_file_arguments(tmp_path):
    (tmp_path / "notes.md").write_text("\n".join([f"line {i}" for i in range(1, 11)]), encoding="utf-8")

    tool = ReadFiles(base_dir=tmp_path)
    arguments = {"file_path": "notes.md", "limit": 3}
    params = ReadFilesParams(**arguments)

    result = await tool.execute(None, params)
    after = await tool.get_after_tool_call_friendly_action_and_remark(
        "read_files",
        ToolContext(tool_name="read_files", arguments=arguments),
        result,
        0.1,
        arguments,
    )

    assert result.ok
    assert result.extra_info["normalized_operations"] == [
        {"file_path": "notes.md", "offset": 0, "limit": 3}
    ]
    assert "line 1" in result.content
    assert "notes.md" in after["remark"]
    assert "1" in after["remark"]
    assert "3" in after["remark"]


@pytest.mark.asyncio
async def test_read_files_accepts_files_list_arguments(tmp_path):
    (tmp_path / "a.py").write_text("alpha\n", encoding="utf-8")
    (tmp_path / "b.py").write_text("beta\n", encoding="utf-8")

    tool = ReadFiles(base_dir=tmp_path)
    params = ReadFilesParams(files=["a.py", "b.py"], limit=50)

    result = await tool.execute(None, params)

    assert result.ok
    assert result.extra_info["normalized_operations"] == [
        {"file_path": "a.py", "offset": 0, "limit": 50},
        {"file_path": "b.py", "offset": 0, "limit": 50},
    ]
    assert "alpha" in result.content
    assert "beta" in result.content


def test_read_files_prompt_no_longer_claims_complex_document_support():
    prompt = ReadFiles().get_prompt_hint()

    assert "PDF files (.pdf)" not in prompt
    assert "Word documents" not in prompt
    assert "Excel files" not in prompt
    assert "PowerPoint (.ppt" not in prompt
    assert "Jupyter notebooks" not in prompt
    assert "document-converter" in prompt
