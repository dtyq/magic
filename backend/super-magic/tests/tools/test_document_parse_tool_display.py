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
