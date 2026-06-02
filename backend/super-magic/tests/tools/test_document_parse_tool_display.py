import zipfile
from pathlib import Path

import pytest

from agentlang.tools.tool_result import ToolResult
from app.tools.document_parse.build_document_index import BuildDocumentIndex
from app.tools.document_parse.convert_document_format import ConvertDocumentFormat
from app.tools.document_parse.export_document_markdown import ExportDocumentMarkdown
from app.tools.document_parse.extract_document_content import ExtractDocumentContent
from app.tools.document_parse.inspect_document import InspectDocument
from app.tools.document_parse.plan_document_reading import PlanDocumentReading
from app.tools.document_parse.sample_document_content import SampleDocumentContent
from app.tools.document_parse.summarize_document import SummarizeDocument
from app.tools.document_parse.understand_document_images import UnderstandDocumentImages
from app.utils.document_parse.models import DocumentProfile


def _write_minimal_docx(path: Path) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types></Types>")
        archive.writestr("word/document.xml", "<w:document></w:document>")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tool", "tool_name", "arguments", "result"),
    [
        (
            InspectDocument(),
            "inspect_document",
            {"input_path": "report.pdf"},
            ToolResult(content="ok", extra_info={"file_name": "report.pdf", "file_type": "pdf", "unit_type": "page", "total_units": 3}),
        ),
        (
            ExtractDocumentContent(),
            "extract_document_content",
            {"input_path": "report.pdf"},
            ToolResult(content="ok", extra_info={"chunks": [{"path": "chunks/0001.md", "title": "Page 1"}]}),
        ),
        (
            BuildDocumentIndex(),
            "build_document_index",
            {"input_path": "report.pdf"},
            ToolResult(content="ok", extra_info={"output_dir": "out/report", "structure": {"nodes": []}}),
        ),
        (
            SummarizeDocument(),
            "summarize_document",
            {"output_dir": "out/report"},
            ToolResult(content="ok", extra_info={"summary_path": "out/report/document.summary.md", "summary": "# Summary"}),
        ),
        (
            ConvertDocumentFormat(),
            "convert_document_format",
            {"input_path": "slides.pptx"},
            ToolResult(content="ok", extra_info={"output_files": ["out/slides/slides.pdf"]}),
        ),
        (
            ExportDocumentMarkdown(),
            "export_document_markdown",
            {"input_path": "report.pdf"},
            ToolResult(content="ok", extra_info={"chunks": [], "index_path": "/tmp/out/document.index.json", "outline_path": "/tmp/out/document.outline.md", "combined_path": "/tmp/out/report.md"}),
        ),
        (
            SampleDocumentContent(),
            "sample_document_content",
            {"input_path": "report.pdf"},
            ToolResult(content="ok", extra_info={"sample_path": "/tmp/out/samples/sample_page_1.md", "sample_range": "1", "recommendations": ["Read next range"]}),
        ),
        (
            PlanDocumentReading(),
            "plan_document_reading",
            {"output_dir": "out/report"},
            ToolResult(content="ok", extra_info={"recommended_action": "extract_document_content", "recommended_range": "1-10", "reason": "sample text"}),
        ),
        (
            UnderstandDocumentImages(),
            "understand_document_images",
            {"output_dir": "out/report"},
            ToolResult(content="ok", extra_info={"processed": [{"asset_path": "assets/page1.png", "result_path": "visual-results/page1.md"}]}),
        ),
    ],
)
async def test_document_parse_tools_have_display_hooks(tool, tool_name, arguments, result):
    before = await tool.get_before_tool_call_friendly_action_and_remark(tool_name, None, arguments)
    after = await tool.get_after_tool_call_friendly_action_and_remark(tool_name, None, result, 0.1, arguments)
    detail = await tool.get_tool_detail(None, result, arguments)

    assert before["action"]
    assert before["remark"]
    assert after["action"]
    assert after["remark"]
    assert detail is not None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tool", "tool_name", "arguments"),
    [
        (InspectDocument(), "inspect_document", {"input_path": "report.pdf"}),
        (ExtractDocumentContent(), "extract_document_content", {"input_path": "report.pdf"}),
        (BuildDocumentIndex(), "build_document_index", {"input_path": "report.pdf"}),
        (SummarizeDocument(), "summarize_document", {"output_dir": "out/report"}),
        (ConvertDocumentFormat(), "convert_document_format", {"input_path": "slides.pptx"}),
        (ExportDocumentMarkdown(), "export_document_markdown", {"input_path": "report.pdf"}),
        (SampleDocumentContent(), "sample_document_content", {"input_path": "report.pdf"}),
        (PlanDocumentReading(), "plan_document_reading", {"output_dir": "out/report"}),
        (UnderstandDocumentImages(), "understand_document_images", {"output_dir": "out/report"}),
    ],
)
async def test_document_parse_failed_after_hooks_use_human_custom_remark(tool, tool_name, arguments):
    result = ToolResult.error("internal parsing stack trace")

    after = await tool.get_after_tool_call_friendly_action_and_remark(tool_name, None, result, 0.1, arguments)

    assert result.use_custom_remark is True
    assert after["action"]
    assert after["remark"]
    assert "internal parsing stack trace" not in after["remark"]
    assert "遇到问题" not in after["remark"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tool", "tool_name", "arguments"),
    [
        (InspectDocument(), "inspect_document", {"input_path": "/tmp/missing-report.pdf"}),
        (ExtractDocumentContent(), "extract_document_content", {"input_path": "/tmp/missing-report.pdf", "output_dir": "/tmp/out"}),
        (BuildDocumentIndex(), "build_document_index", {"input_path": "/tmp/missing-report.pdf", "output_dir": "/tmp/out"}),
        (SummarizeDocument(), "summarize_document", {"output_dir": "/tmp/missing-out"}),
        (ConvertDocumentFormat(), "convert_document_format", {"input_path": "/tmp/missing-slides.pptx", "output_dir": "/tmp/out", "target_format": "pdf"}),
        (ExportDocumentMarkdown(), "export_document_markdown", {"input_path": "/tmp/missing-report.pdf", "output_dir": "/tmp/out"}),
        (SampleDocumentContent(), "sample_document_content", {"input_path": "/tmp/missing-report.pdf", "output_dir": "/tmp/out"}),
        (PlanDocumentReading(), "plan_document_reading", {"output_dir": "/tmp/missing-out", "goal": "summarize"}),
        (UnderstandDocumentImages(), "understand_document_images", {"output_dir": "/tmp/missing-out", "ranges": "1-3"}),
    ],
)
async def test_document_parse_failed_tools_return_visible_detail(tool, tool_name, arguments):
    result = ToolResult.error("File does not exist: /tmp/missing-report.pdf")

    detail = await tool.get_tool_detail(None, result, arguments)

    assert detail is not None
    assert detail.data.file_name == "document_converter_error.md"
    assert "document-converter" in detail.data.content
    assert tool_name in detail.data.content
    assert "File does not exist" in detail.data.content


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tool", "params"),
    [
        (InspectDocument(), {"input_path": "relative/report.pdf"}),
        (BuildDocumentIndex(), {"input_path": "relative/report.pdf", "output_dir": "/tmp/document-output/report"}),
        (BuildDocumentIndex(), {"input_path": "/tmp/report.pdf", "output_dir": "relative/document-output/report"}),
        (ExtractDocumentContent(), {"input_path": "relative/report.pdf", "output_dir": "/tmp/document-output/report"}),
        (ExtractDocumentContent(), {"input_path": "/tmp/report.pdf", "output_dir": "relative/document-output/report"}),
        (SummarizeDocument(), {"output_dir": "relative/document-output/report"}),
        (ConvertDocumentFormat(), {"input_path": "relative/slides.pptx", "output_dir": "/tmp/document-output/slides", "target_format": "pdf"}),
        (ConvertDocumentFormat(), {"input_path": "/tmp/slides.pptx", "output_dir": "relative/document-output/slides", "target_format": "pdf"}),
        (ExportDocumentMarkdown(), {"input_path": "relative/report.pdf", "output_dir": "/tmp/document-output/report"}),
        (ExportDocumentMarkdown(), {"input_path": "/tmp/report.pdf", "output_dir": "relative/document-output/report"}),
        (SampleDocumentContent(), {"input_path": "relative/report.pdf", "output_dir": "/tmp/document-output/report"}),
        (SampleDocumentContent(), {"input_path": "/tmp/report.pdf", "output_dir": "relative/document-output/report"}),
        (PlanDocumentReading(), {"output_dir": "relative/document-output/report"}),
        (UnderstandDocumentImages(), {"output_dir": "relative/document-output/report"}),
    ],
)
async def test_document_parse_tools_require_absolute_path_params(tool, params):
    result = await tool.execute(None, tool.get_params_class()(**params))

    assert not result.ok
    assert "must be an absolute path" in result.content


def test_understand_document_images_hides_internal_runtime_params():
    fields = set(UnderstandDocumentImages().get_params_class().model_fields)

    assert fields == {"output_dir", "ranges"}
    assert "concurrency" not in fields
    assert "write_mode" not in fields
    assert "force" not in fields
    assert "images" not in fields
    assert "chunk_ids" not in fields
    assert "query" not in fields
    assert "max_images" not in fields


def test_document_converter_tools_expose_only_intent_params():
    assert set(SampleDocumentContent().get_params_class().model_fields) == {"input_path", "output_dir", "ranges"}
    assert set(ExtractDocumentContent().get_params_class().model_fields) == {"input_path", "output_dir", "ranges"}
    assert set(ExportDocumentMarkdown().get_params_class().model_fields) == {"input_path", "output_dir", "ranges"}
    assert set(PlanDocumentReading().get_params_class().model_fields) == {"output_dir", "goal"}
    assert set(SummarizeDocument().get_params_class().model_fields) == {"output_dir"}
    assert set(ConvertDocumentFormat().get_params_class().model_fields) == {"input_path", "output_dir", "target_format", "ranges"}


@pytest.mark.asyncio
async def test_inspect_document_corrects_unique_punctuation_only_path(tmp_path: Path, monkeypatch):
    actual = tmp_path / "mock-report-“quoted-title”.docx"
    requested = tmp_path / "mock-report-\"quoted-title\".docx"
    _write_minimal_docx(actual)

    async def fake_inspect(self, path: Path):
        return DocumentProfile(
            source_path=str(path),
            file_name=path.name,
            file_type="word",
            file_extension=".docx",
            file_size=actual.stat().st_size,
            unit_type="section",
            total_units=1,
            recommended_strategy="test",
        )

    monkeypatch.setattr(
        "app.tools.document_parse.inspect_document.DocumentInspector.inspect",
        fake_inspect,
    )

    result = await InspectDocument().execute(
        None,
        InspectDocument().get_params_class()(input_path=str(requested)),
    )

    assert result.ok
    assert "Path auto-correction applied" in result.content
    assert str(actual) in result.content
    assert result.extra_info["source_path"] == str(actual)


@pytest.mark.asyncio
async def test_inspect_document_returns_next_actions_for_large_pdf(tmp_path: Path, monkeypatch):
    source = tmp_path / "large-report.pdf"
    source.write_bytes(b"%PDF-1.7\nmock")

    async def fake_inspect(self, path: Path):
        return DocumentProfile(
            source_path=str(path),
            file_name=path.name,
            file_type="pdf",
            file_extension=".pdf",
            file_size=source.stat().st_size,
            unit_type="page",
            total_units=42,
            recommended_strategy="sample first",
            metadata={"text_density": "medium", "has_images_in_sample": True},
        )

    monkeypatch.setattr(
        "app.tools.document_parse.inspect_document.DocumentInspector.inspect",
        fake_inspect,
    )

    result = await InspectDocument().execute(
        None,
        InspectDocument().get_params_class()(input_path=str(source)),
    )

    assert result.ok
    assert result.extra_info["format_check"]["detected_type"] == "pdf"
    assert "Format check: passed" in result.content
    assert "Recommended next actions" in result.content
    assert any("sample_document_content" in action for action in result.extra_info["next_actions"])
    assert any("plan_document_reading" in action for action in result.extra_info["next_actions"])
    assert any("extract_document_content" in action for action in result.extra_info["next_actions"])


@pytest.mark.asyncio
async def test_inspect_document_does_not_guess_when_punctuation_match_is_ambiguous(tmp_path: Path):
    requested = tmp_path / "mock-\"subject\"-request.docx"
    _write_minimal_docx(tmp_path / "mock-“subject”-request.docx")
    _write_minimal_docx(tmp_path / "mock-”subject“-request.docx")

    result = await InspectDocument().execute(
        None,
        InspectDocument().get_params_class()(input_path=str(requested)),
    )

    assert not result.ok
    assert "File does not exist" in result.content


@pytest.mark.asyncio
async def test_inspect_document_rejects_obvious_extension_signature_mismatch(tmp_path: Path):
    wrong_pdf = tmp_path / "report.pdf"
    wrong_pdf.write_bytes(b"not a pdf")

    result = await InspectDocument().execute(
        None,
        InspectDocument().get_params_class()(input_path=str(wrong_pdf)),
    )

    assert not result.ok
    assert "File format mismatch" in result.content
    assert "Expected a %PDF header" in result.content


@pytest.mark.asyncio
async def test_inspect_document_reports_docm_content_when_doc_extension_is_wrong(tmp_path: Path):
    wrong_doc = tmp_path / "mock-macro-document.doc"
    with zipfile.ZipFile(wrong_doc, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types></Types>")
        archive.writestr("word/document.xml", "<w:document></w:document>")
        archive.writestr("word/vbaProject.bin", b"mock macro")

    result = await InspectDocument().execute(
        None,
        InspectDocument().get_params_class()(input_path=str(wrong_doc)),
    )

    assert not result.ok
    assert "File format mismatch" in result.content
    assert "Word OOXML macro-enabled document" in result.content
    assert "`.docm`" in result.content
    assert "run inspect_document again" in result.content
