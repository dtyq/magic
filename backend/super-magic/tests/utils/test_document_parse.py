from pathlib import Path

import pytest

from agentlang.tools.tool_result import ToolResult
from app.utils.document_parse.service.document_extractor import DocumentExtractor
from app.utils.document_parse.service.document_artifact_mode import DocumentArtifactModeSelector
from app.utils.document_parse.service.document_indexer import DocumentIndexer
from app.utils.document_parse.service.document_inspector import DocumentInspector
from app.utils.document_parse.service.document_image_understander import DocumentImageUnderstander
from app.utils.document_parse.service.document_reading_planner import DocumentReadingPlanner
from app.utils.document_parse.service.document_sampler import DocumentSampler
from app.utils.document_parse.service.document_summarizer import DocumentSummarizer
from app.utils.document_parse.drivers.pdf_driver import PdfDocumentDriver
from app.utils.document_parse.drivers.generic import GenericMarkItDownDriver
from app.utils.document_parse.drivers.registry import get_document_driver_registry
from app.utils.document_parse.drivers.word_driver import WordDocumentDriver
from app.utils.document_parse.drivers.spreadsheet_driver import SpreadsheetDocumentDriver
from app.utils.document_parse.drivers.powerpoint_driver import PowerPointDocumentDriver
from app.utils.document_parse.models import DocumentAsset, DocumentChunk, DocumentProfile, ExtractionResult
from app.utils.document_parse.structure.chunk_store import ChunkStore
from app.utils.document_parse.structure.range_parser import RangeParser
from app.utils.file_parse.driver.interfaces.file_parser_driver_interface import ParseMetadata, ParseResult
from app.utils.file_parse.driver.word_driver import WordDriver as FileParseWordDriver
from app.utils.file_parse.driver.excel_driver import ExcelDriver as FileParseExcelDriver
from app.utils.file_parse.driver.powerpoint_driver import PowerPointDriver as FileParsePowerPointDriver
from app.tools.document_parse.export_document_markdown import ExportDocumentMarkdown


def test_range_parser_compacts_numeric_ranges():
    assert RangeParser.parse_numeric("1-3,5,7-8", total=10) == [1, 2, 3, 5, 7, 8]


def test_wps_routes_to_word_document_driver():
    driver = get_document_driver_registry().get_driver(Path("/tmp/sample.wps"))

    assert isinstance(driver, WordDocumentDriver)


@pytest.mark.parametrize("suffix", [".rtf", ".odt", ".docm", ".dotx", ".wpt"])
def test_word_like_formats_route_to_word_document_driver(suffix: str):
    driver = get_document_driver_registry().get_driver(Path(f"/tmp/sample{suffix}"))

    assert isinstance(driver, WordDocumentDriver)


@pytest.mark.parametrize("suffix", [".ods", ".tsv", ".xlsm", ".xlsb", ".xltx", ".et"])
def test_spreadsheet_like_formats_route_to_spreadsheet_document_driver(suffix: str):
    driver = get_document_driver_registry().get_driver(Path(f"/tmp/sample{suffix}"))

    assert isinstance(driver, SpreadsheetDocumentDriver)


@pytest.mark.parametrize("suffix", [".odp", ".pptm", ".ppsx", ".ppsm", ".potx", ".dps"])
def test_presentation_like_formats_route_to_powerpoint_document_driver(suffix: str):
    driver = get_document_driver_registry().get_driver(Path(f"/tmp/sample{suffix}"))

    assert isinstance(driver, PowerPointDocumentDriver)


@pytest.mark.asyncio
async def test_file_parse_word_driver_converts_wps_before_markitdown(tmp_path: Path, monkeypatch):
    source = tmp_path / "sample.wps"
    source.write_bytes(b"wps")
    converted = tmp_path / "sample.docx"
    converted.write_bytes(b"docx")
    output = tmp_path / "sample.md"
    result = ParseResult(metadata=ParseMetadata(), success=True, output_file_path=output)
    converted_inputs: list[tuple[Path, str]] = []
    markitdown_inputs: list[Path] = []

    async def fake_convert_document(input_file: Path, target_format: str, output_filename_prefix: str = "converted") -> Path:
        converted_inputs.append((input_file, target_format))
        return converted

    async def fake_convert_with_markitdown(self, file_path: Path, **kwargs) -> str:
        markitdown_inputs.append(file_path)
        return "WPS converted content"

    monkeypatch.setattr(
        "app.utils.file_parse.utils.libreoffice_util.LibreOfficeUtil.convert_document",
        fake_convert_document,
    )
    monkeypatch.setattr(FileParseWordDriver, "_convert_with_markitdown", fake_convert_with_markitdown)

    await FileParseWordDriver().parse(source, result, extract_images=False)

    assert converted_inputs == [(source, "docx")]
    assert markitdown_inputs == [converted]
    assert result.metadata.conversion_method == "libreoffice_then_markitdown"
    assert result.metadata.additional_info["original_format"] == "wps"
    assert result.metadata.additional_info["conversion_required"] is True
    assert "WPS converted content" in output.read_text(encoding="utf-8")


@pytest.mark.asyncio
async def test_file_parse_word_driver_converts_odt_before_markitdown(tmp_path: Path, monkeypatch):
    source = tmp_path / "sample.odt"
    source.write_bytes(b"odt")
    converted = tmp_path / "sample.docx"
    converted.write_bytes(b"docx")
    output = tmp_path / "sample.md"
    result = ParseResult(metadata=ParseMetadata(), success=True, output_file_path=output)
    converted_inputs: list[tuple[Path, str]] = []
    markitdown_inputs: list[Path] = []

    async def fake_convert_document(input_file: Path, target_format: str, output_filename_prefix: str = "converted") -> Path:
        converted_inputs.append((input_file, target_format))
        return converted

    async def fake_convert_with_markitdown(self, file_path: Path, **kwargs) -> str:
        markitdown_inputs.append(file_path)
        return "ODT converted content"

    monkeypatch.setattr(
        "app.utils.file_parse.utils.libreoffice_util.LibreOfficeUtil.convert_document",
        fake_convert_document,
    )
    monkeypatch.setattr(FileParseWordDriver, "_convert_with_markitdown", fake_convert_with_markitdown)

    await FileParseWordDriver().parse(source, result, extract_images=False)

    assert converted_inputs == [(source, "docx")]
    assert markitdown_inputs == [converted]
    assert result.metadata.additional_info["original_format"] == "odt"
    assert result.metadata.additional_info["conversion_required"] is True
    assert "ODT converted content" in output.read_text(encoding="utf-8")


@pytest.mark.asyncio
async def test_file_parse_excel_driver_converts_ods_before_markitdown(tmp_path: Path, monkeypatch):
    source = tmp_path / "sample.ods"
    source.write_bytes(b"ods")
    converted = tmp_path / "sample.xlsx"
    converted.write_bytes(b"xlsx")
    output = tmp_path / "sample.md"
    result = ParseResult(metadata=ParseMetadata(), success=True, output_file_path=output)
    converted_inputs: list[tuple[Path, str]] = []
    markitdown_inputs: list[Path] = []

    async def fake_convert_document(input_file: Path, target_format: str, output_filename_prefix: str = "converted") -> Path:
        converted_inputs.append((input_file, target_format))
        return converted

    async def fake_convert_with_markitdown(self, file_path: Path, **kwargs) -> str:
        markitdown_inputs.append(file_path)
        return "A|B\n1|2"

    monkeypatch.setattr(
        "app.utils.file_parse.utils.libreoffice_util.LibreOfficeUtil.convert_document",
        fake_convert_document,
    )
    monkeypatch.setattr(FileParseExcelDriver, "_convert_with_markitdown", fake_convert_with_markitdown)

    await FileParseExcelDriver().parse(source, result)

    assert converted_inputs == [(source, "xlsx")]
    assert markitdown_inputs == [converted]
    assert result.metadata.conversion_method == "libreoffice_then_markitdown"
    assert result.metadata.additional_info["original_format"] == "ods"
    assert result.metadata.additional_info["conversion_required"] is True


@pytest.mark.asyncio
async def test_file_parse_powerpoint_driver_converts_odp_before_markitdown(tmp_path: Path, monkeypatch):
    source = tmp_path / "sample.odp"
    source.write_bytes(b"odp")
    converted = tmp_path / "sample.pptx"
    converted.write_bytes(b"pptx")
    output = tmp_path / "sample.md"
    result = ParseResult(metadata=ParseMetadata(), success=True, output_file_path=output)
    converted_inputs: list[tuple[Path, str]] = []
    markitdown_inputs: list[Path] = []

    async def fake_convert_document(input_file: Path, target_format: str, output_filename_prefix: str = "converted") -> Path:
        converted_inputs.append((input_file, target_format))
        return converted

    async def fake_convert_with_markitdown(self, file_path: Path, **kwargs) -> str:
        markitdown_inputs.append(file_path)
        return "# Slide 1\n\nContent"

    monkeypatch.setattr(
        "app.utils.file_parse.utils.libreoffice_util.LibreOfficeUtil.convert_document",
        fake_convert_document,
    )
    monkeypatch.setattr(FileParsePowerPointDriver, "_convert_with_markitdown", fake_convert_with_markitdown)

    await FileParsePowerPointDriver().parse(source, result, extract_images=False)

    assert converted_inputs == [(source, "pptx")]
    assert markitdown_inputs == [converted]
    assert result.metadata.conversion_method == "libreoffice_then_markitdown"
    assert result.metadata.additional_info["original_format"] == "odp"
    assert result.metadata.additional_info["conversion_required"] is True


@pytest.mark.asyncio
async def test_markdown_document_parse_pipeline(tmp_path: Path):
    source = tmp_path / "sample.md"
    output_dir = tmp_path / "sample.document"
    source.write_text(
        "# Title\n\nIntro.\n\n## Section A\n\nAlpha.\n\n## Section B\n\nBeta.\n",
        encoding="utf-8",
    )

    profile = await DocumentInspector().inspect(source)
    extraction = await DocumentExtractor().extract(source, output_dir)
    structure = await DocumentIndexer().build_from_extraction(source, output_dir, extraction)
    summary = await DocumentSummarizer().summarize(output_dir)

    assert profile.file_type == "markdown"
    assert profile.outline
    assert extraction.chunks
    assert structure.chunks[0].path == "chunks/chunk_0001.md"
    assert structure.metadata["chunk_lookup"]["chunk_0001"]["path"] == "chunks/chunk_0001.md"
    assert (output_dir / "document.index.json").exists()
    assert (output_dir / "document.outline.md").exists()
    assert "Global Summary" in summary
    assert "Chunk Summaries" in summary
    assert "Title" in summary


@pytest.mark.asyncio
async def test_image_document_parse_pipeline_uses_metadata_without_visual_model(tmp_path: Path):
    from PIL import Image

    source = tmp_path / "sample.png"
    output_dir = tmp_path / "sample-image.document"
    Image.new("RGB", (32, 16), color="white").save(source)

    profile = await DocumentInspector().inspect(source)
    extraction = await DocumentExtractor().extract(source, output_dir)
    structure = await DocumentIndexer().build_from_extraction(source, output_dir, extraction)

    assert profile.file_type == "image"
    assert profile.metadata["width"] == 32
    assert extraction.assets
    assert extraction.chunks[0].path == "chunks/chunk_0001.md"
    assert "![sample.png](assets/sample.png)" in extraction.chunks[0].content
    assert structure.metadata["chunk_lookup"]["chunk_0001"]["source_range"] == "image:1"
    assert (output_dir / "assets" / "sample.png").exists()


@pytest.mark.asyncio
async def test_chunk_store_appends_when_existing_chunk_id_would_collide(tmp_path: Path):
    output_dir = tmp_path / "sample.document"
    chunks_dir = output_dir / "chunks"
    chunks_dir.mkdir(parents=True)
    (chunks_dir / "chunk_0001.md").write_text("Existing visual writeback.\n", encoding="utf-8")

    new_chunk = DocumentChunk(
        chunk_id="chunk_0001",
        title="New range",
        content="New extracted content.",
        source_range="pages:11-20",
    )

    saved = await ChunkStore.write_chunks(output_dir, [new_chunk])

    assert saved[0].chunk_id == "chunk_0002"
    assert saved[0].path == "chunks/chunk_0002.md"
    assert (chunks_dir / "chunk_0001.md").read_text(encoding="utf-8") == "Existing visual writeback.\n"
    assert (chunks_dir / "chunk_0002.md").read_text(encoding="utf-8") == "New extracted content.\n"


@pytest.mark.asyncio
async def test_document_indexer_merges_incremental_extraction_without_losing_visual_metadata(tmp_path: Path):
    import json

    source = tmp_path / "source.md"
    source.write_text("# Source\n", encoding="utf-8")
    output_dir = tmp_path / "source.document"
    chunks_dir = output_dir / "chunks"
    chunks_dir.mkdir(parents=True)
    (chunks_dir / "chunk_0001.md").write_text(
        "Existing page.\n\n<!-- document-converter-visual:assets/page1.png -->\n#### Visual Understanding\n\nRecognized page text.\n",
        encoding="utf-8",
    )
    (chunks_dir / "chunk_0002.md").write_text("New page.\n", encoding="utf-8")
    (output_dir / "document.index.json").write_text(
        json.dumps(
            {
                "document_id": "doc_existing",
                "source_path": str(source),
                "file_type": "markdown",
                "title": "source",
                "unit_type": "section",
                "total_units": 2,
                "chunks": [
                    {
                        "chunk_id": "chunk_0001",
                        "title": "Existing",
                        "content": "",
                        "source_range": "sections:1",
                        "path": "chunks/chunk_0001.md",
                    }
                ],
                "assets": [
                    {
                        "asset_id": "asset_0001",
                        "asset_type": "image",
                        "path": "assets/page1.png",
                        "title": "Page 1",
                        "source_range": "pages:1",
                        "metadata": {
                            "visual_understanding": {
                                "status": "completed",
                                "written_to_chunk": True,
                                "result_path": "visual-results/page1.md",
                            }
                        },
                    }
                ],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    extraction = ExtractionResult(
        document_id="doc_current",
        source_path=str(source),
        output_dir=str(output_dir),
        chunks=[
            DocumentChunk(
                chunk_id="chunk_0002",
                title="New",
                content="New page.",
                source_range="sections:2",
                path="chunks/chunk_0002.md",
            )
        ],
        assets=[
            DocumentAsset(
                asset_id="asset_0002",
                asset_type="image",
                path="assets/page1.png",
                title="Page 1",
                source_range="pages:1",
                metadata={},
            )
        ],
        total_units=2,
    )

    structure = await DocumentIndexer().build_from_extraction(source, output_dir, extraction)

    assert [chunk.chunk_id for chunk in structure.chunks] == ["chunk_0001", "chunk_0002"]
    assert "Recognized page text." in structure.chunks[0].content
    visual_metadata = structure.assets[0].metadata["visual_understanding"]
    assert visual_metadata["status"] == "completed"
    assert visual_metadata["result_path"] == "visual-results/page1.md"


@pytest.mark.asyncio
async def test_sampler_recommends_image_understanding_for_scanned_pdf(tmp_path: Path):
    import fitz
    from PIL import Image

    image_path = tmp_path / "page.png"
    Image.new("RGB", (200, 120), color="white").save(image_path)

    source = tmp_path / "scanned.pdf"
    doc = fitz.open()
    for _ in range(3):
        page = doc.new_page(width=200, height=120)
        page.insert_image(fitz.Rect(0, 0, 200, 120), filename=str(image_path))
    doc.save(str(source))
    doc.close()

    output_dir = tmp_path / "scanned.document"
    result = await DocumentSampler().sample(source, output_dir, max_units=2, include_images=True)

    assert result["text_signal"]["image_dominant"] is True
    assert any("understand_document_images" in action for action in result["recommendations"])
    assert (output_dir / "samples" / "sample_page_1_2.md").exists()
    assert (output_dir / "document.reading_state.json").exists()


@pytest.mark.asyncio
async def test_sampler_recommends_text_extraction_for_text_pdf(tmp_path: Path):
    import fitz

    source = tmp_path / "text.pdf"
    doc = fitz.open()
    page = doc.new_page(width=300, height=200)
    page.insert_text((20, 40), "This is extractable PDF text. " * 20)
    doc.save(str(source))
    doc.close()

    output_dir = tmp_path / "text.document"
    result = await DocumentSampler().sample(source, output_dir, max_units=1, include_images=True)
    plan = await DocumentReadingPlanner().plan(output_dir, goal="summarize", budget="10 pages")

    assert result["text_signal"]["has_extractable_text"] is True
    assert any("extract_document_content" in action for action in result["recommendations"])
    assert plan["recommended_action"] == "extract_document_content"


@pytest.mark.asyncio
async def test_document_image_understander_writes_visual_results_back_to_chunk(tmp_path: Path, monkeypatch):
    import json
    from PIL import Image
    from app.utils.async_file_utils import async_write_json

    output_dir = tmp_path / "doc.document"
    chunks_dir = output_dir / "chunks"
    assets_dir = output_dir / "assets"
    chunks_dir.mkdir(parents=True)
    assets_dir.mkdir(parents=True)
    Image.new("RGB", (32, 16), color="white").save(assets_dir / "page1.png")
    (chunks_dir / "chunk_0001.md").write_text(
        "## Page 1\n\n![Page 1](assets/page1.png)\n",
        encoding="utf-8",
    )
    await async_write_json(
        output_dir / "document.index.json",
        {
            "source_path": str(tmp_path / "source.pdf"),
            "file_type": "pdf",
            "unit_type": "page",
            "total_units": 1,
            "chunks": [
                {
                    "chunk_id": "chunk_0001",
                    "path": "chunks/chunk_0001.md",
                    "source_range": "pages:1",
                    "content": "## Page 1\n\n![Page 1](assets/page1.png)\n",
                }
            ],
            "assets": [
                {
                    "asset_id": "asset_0001",
                    "asset_type": "image",
                    "path": "assets/page1.png",
                    "title": "Page 1",
                    "source_range": "pages:1",
                    "metadata": {"page": 1},
                }
            ],
        },
        ensure_ascii=False,
        indent=2,
    )

    async def fake_execute_purely(self, params, **kwargs):
        return ToolResult(content="Recognized text from page image.")

    monkeypatch.setattr(
        "app.tools.visual_understanding.VisualUnderstanding.execute_purely",
        fake_execute_purely,
    )

    result = await DocumentImageUnderstander().understand(output_dir, ranges="1", max_images=1, write_mode="write_back")
    chunk_text = (chunks_dir / "chunk_0001.md").read_text(encoding="utf-8")

    assert result["processed"][0]["ok"] is True
    assert "Recognized text from page image." in chunk_text
    assert (output_dir / "visual-results" / "page1.md").exists()
    assert (output_dir / "document.reading_state.json").exists()
    index = json.loads((output_dir / "document.index.json").read_text(encoding="utf-8"))
    visual_metadata = index["assets"][0]["metadata"]["visual_understanding"]
    assert visual_metadata["status"] == "completed"
    assert visual_metadata["written_to_chunk"] is True
    assert visual_metadata["chunk_path"] == "chunks/chunk_0001.md"
    assert visual_metadata["result_path"] == "visual-results/page1.md"


@pytest.mark.asyncio
async def test_document_image_understander_reuses_existing_visual_result_for_chunk_writeback(tmp_path: Path, monkeypatch):
    import json
    from PIL import Image
    from app.utils.async_file_utils import async_write_json

    output_dir = tmp_path / "doc.document"
    chunks_dir = output_dir / "chunks"
    assets_dir = output_dir / "assets"
    visual_dir = output_dir / "visual-results"
    chunks_dir.mkdir(parents=True)
    assets_dir.mkdir(parents=True)
    visual_dir.mkdir(parents=True)
    Image.new("RGB", (32, 16), color="white").save(assets_dir / "page1.png")
    (visual_dir / "page1.md").write_text(
        "# Visual Understanding: Page 1\n\n"
        "- Image: `assets/page1.png`\n"
        "- Source range: `pages:1`\n\n"
        "Stored recognized text from page image.\n",
        encoding="utf-8",
    )
    (chunks_dir / "chunk_0001.md").write_text(
        "## Page 1\n\n![Page 1](assets/page1.png)\n",
        encoding="utf-8",
    )
    await async_write_json(
        output_dir / "document.index.json",
        {
            "source_path": str(tmp_path / "source.pdf"),
            "file_type": "pdf",
            "unit_type": "page",
            "total_units": 1,
            "chunks": [
                {
                    "chunk_id": "chunk_0001",
                    "path": "chunks/chunk_0001.md",
                    "source_range": "pages:1",
                    "content": "## Page 1\n\n![Page 1](assets/page1.png)\n",
                }
            ],
            "assets": [
                {
                    "asset_id": "asset_0001",
                    "asset_type": "image",
                    "path": "assets/page1.png",
                    "title": "Page 1",
                    "source_range": "pages:1",
                    "metadata": {
                        "page": 1,
                        "visual_understanding": {
                            "status": "completed",
                            "result_path": "visual-results/page1.md",
                        },
                    },
                }
            ],
        },
        ensure_ascii=False,
        indent=2,
    )

    async def fail_if_called(self, params, **kwargs):
        raise AssertionError("existing visual result should be reused without calling the visual model")

    monkeypatch.setattr(
        "app.tools.visual_understanding.VisualUnderstanding.execute_purely",
        fail_if_called,
    )

    result = await DocumentImageUnderstander().understand(output_dir, ranges="1", max_images=1)
    chunk_text = (chunks_dir / "chunk_0001.md").read_text(encoding="utf-8")

    assert result["processed"][0]["reused"] is True
    assert "Stored recognized text from page image." in chunk_text
    assert "- Image:" not in chunk_text
    assert (visual_dir / "page1.md").exists()
    index = json.loads((output_dir / "document.index.json").read_text(encoding="utf-8"))
    visual_metadata = index["assets"][0]["metadata"]["visual_understanding"]
    assert visual_metadata["written_to_chunk"] is True
    assert visual_metadata["result_path"] == "visual-results/page1.md"


@pytest.mark.asyncio
async def test_document_image_understander_serializes_multiple_images_in_one_chunk(tmp_path: Path, monkeypatch):
    import json
    from PIL import Image
    from app.utils.async_file_utils import async_write_json

    output_dir = tmp_path / "doc.document"
    chunks_dir = output_dir / "chunks"
    assets_dir = output_dir / "assets"
    chunks_dir.mkdir(parents=True)
    assets_dir.mkdir(parents=True)
    chunk_lines = ["## Page 1", ""]
    assets = []
    for index in range(1, 4):
        image_name = f"page1_{index}.png"
        Image.new("RGB", (32, 16), color="white").save(assets_dir / image_name)
        chunk_lines.append(f"![Page 1 image {index}](assets/{image_name})")
        assets.append(
            {
                "asset_id": f"asset_{index:04d}",
                "asset_type": "image",
                "path": f"assets/{image_name}",
                "title": f"Page 1 image {index}",
                "source_range": "pages:1",
                "metadata": {"page": 1},
            }
        )
    (chunks_dir / "chunk_0001.md").write_text("\n\n".join(chunk_lines) + "\n", encoding="utf-8")
    await async_write_json(
        output_dir / "document.index.json",
        {
            "source_path": str(tmp_path / "source.pdf"),
            "file_type": "pdf",
            "unit_type": "page",
            "total_units": 1,
            "chunks": [
                {
                    "chunk_id": "chunk_0001",
                    "path": "chunks/chunk_0001.md",
                    "source_range": "pages:1",
                    "content": (chunks_dir / "chunk_0001.md").read_text(encoding="utf-8"),
                }
            ],
            "assets": assets,
        },
        ensure_ascii=False,
        indent=2,
    )

    async def fake_execute_purely(self, params, **kwargs):
        return ToolResult(content=f"Recognized text from {Path(params.images[0]).name}.")

    monkeypatch.setattr(
        "app.tools.visual_understanding.VisualUnderstanding.execute_purely",
        fake_execute_purely,
    )

    result = await DocumentImageUnderstander().understand(output_dir, ranges="1", max_images=3)
    chunk_text = (chunks_dir / "chunk_0001.md").read_text(encoding="utf-8")
    index = json.loads((output_dir / "document.index.json").read_text(encoding="utf-8"))

    assert len(result["processed"]) == 3
    assert chunk_text.count("<!-- document-converter-visual:assets/page1_") == 3
    for image_index in range(1, 4):
        assert f"Recognized text from page1_{image_index}.png." in chunk_text
        assert (output_dir / "visual-results" / f"page1_{image_index}.md").exists()
    assert all(asset["metadata"]["visual_understanding"]["written_to_chunk"] is True for asset in index["assets"])


@pytest.mark.asyncio
async def test_document_image_understander_keeps_failed_result_out_of_chunk(tmp_path: Path, monkeypatch):
    import json
    from PIL import Image
    from app.utils.async_file_utils import async_write_json

    output_dir = tmp_path / "doc.document"
    chunks_dir = output_dir / "chunks"
    assets_dir = output_dir / "assets"
    chunks_dir.mkdir(parents=True)
    assets_dir.mkdir(parents=True)
    Image.new("RGB", (32, 16), color="white").save(assets_dir / "page1.png")
    (chunks_dir / "chunk_0001.md").write_text(
        "## Page 1\n\n![Page 1](assets/page1.png)\n",
        encoding="utf-8",
    )
    await async_write_json(
        output_dir / "document.index.json",
        {
            "source_path": str(tmp_path / "source.pdf"),
            "file_type": "pdf",
            "unit_type": "page",
            "total_units": 1,
            "chunks": [
                {
                    "chunk_id": "chunk_0001",
                    "path": "chunks/chunk_0001.md",
                    "source_range": "pages:1",
                    "content": "## Page 1\n\n![Page 1](assets/page1.png)\n",
                }
            ],
            "assets": [
                {
                    "asset_id": "asset_0001",
                    "asset_type": "image",
                    "path": "assets/page1.png",
                    "title": "Page 1",
                    "source_range": "pages:1",
                    "metadata": {"page": 1},
                }
            ],
        },
        ensure_ascii=False,
        indent=2,
    )

    async def fake_execute_purely(self, params, **kwargs):
        return ToolResult.error("visual model failed")

    monkeypatch.setattr(
        "app.tools.visual_understanding.VisualUnderstanding.execute_purely",
        fake_execute_purely,
    )

    result = await DocumentImageUnderstander().understand(output_dir, ranges="1", max_images=1)
    chunk_text = (chunks_dir / "chunk_0001.md").read_text(encoding="utf-8")
    index = json.loads((output_dir / "document.index.json").read_text(encoding="utf-8"))
    visual_metadata = index["assets"][0]["metadata"]["visual_understanding"]

    assert result["processed"][0]["ok"] is False
    assert "Visual understanding failed" not in chunk_text
    assert (output_dir / "visual-results" / "page1.md").exists()
    assert visual_metadata["status"] == "failed"
    assert visual_metadata["written_to_chunk"] is False
    assert visual_metadata["result_path"] == "visual-results/page1.md"


@pytest.mark.asyncio
async def test_pdf_visual_mode_persists_recognition_result(tmp_path: Path, monkeypatch):
    source = tmp_path / "sample.pdf"
    output_dir = tmp_path / "sample-pdf.document"
    source.write_bytes(b"%PDF test placeholder")

    async def fake_metadata(path: Path):
        return {
            "page_count": 2,
            "sample_pages": 2,
            "avg_chars_per_sample_page": 0,
            "text_density": "low",
            "has_images_in_sample": True,
        }

    async def fake_outline(path: Path):
        return []

    async def fake_visual(path: Path, pages, query=None):
        return "## 第 1 页\n\nChart recognition result."

    monkeypatch.setattr("app.utils.document_parse.drivers.pdf_driver.PdfMetadata.inspect", fake_metadata)
    monkeypatch.setattr("app.utils.document_parse.drivers.pdf_driver.PdfOutlineReader.read", fake_outline)
    monkeypatch.setattr("app.utils.document_parse.drivers.pdf_driver.PdfVisualExtractor.extract_pages", fake_visual)

    extraction = await PdfDocumentDriver().extract(source, output_dir, ranges="1", mode="visual")

    assert extraction.metadata["visual_result_path"] == "visual-results/pdf_pages_1.md"
    assert (output_dir / "visual-results" / "pdf_pages_1.md").read_text(encoding="utf-8") == "## 第 1 页\n\nChart recognition result."
    assert extraction.chunks[0].path == "chunks/chunk_0001.md"


@pytest.mark.asyncio
async def test_pdf_local_text_extracts_image_assets_without_visual_understanding(tmp_path: Path):
    import fitz
    from PIL import Image

    image_path = tmp_path / "embedded.png"
    Image.new("RGB", (24, 16), color="red").save(image_path)

    source = tmp_path / "with-image.pdf"
    doc = fitz.open()
    page = doc.new_page(width=200, height=160)
    page.insert_text((20, 30), "PDF text content")
    page.insert_image(fitz.Rect(20, 50, 80, 90), filename=str(image_path))
    doc.save(str(source))
    doc.close()

    output_dir = tmp_path / "with-image.document"
    extraction = await PdfDocumentDriver().extract(source, output_dir, mode="local_text", extract_images=True)
    structure = await DocumentIndexer().build_from_extraction(source, output_dir, extraction)

    assert extraction.chunks
    assert extraction.assets
    assert extraction.assets[0].path.startswith("assets/")
    assert (output_dir / extraction.assets[0].path).exists()
    assert structure.assets[0].metadata["page"] == 1
    assert f"![PDF page 1 image 1]({extraction.assets[0].path})" in extraction.chunks[0].content


@pytest.mark.asyncio
async def test_export_small_pdf_defaults_to_simple_artifacts(tmp_path: Path):
    import fitz

    source = tmp_path / "small.pdf"
    doc = fitz.open()
    for page_index in range(3):
        page = doc.new_page(width=300, height=200)
        page.insert_text((20, 40), f"Small PDF page {page_index + 1}")
    doc.save(str(source))
    doc.close()

    output_dir = tmp_path / "small-output"
    tool = ExportDocumentMarkdown()
    result = await tool.execute(
        None,
        tool.get_params_class()(
            input_path=str(source),
            output_dir=str(output_dir),
        ),
    )

    assert result.ok
    assert result.extra_info["artifact_mode"] == "simple"
    assert (output_dir / "document.md").exists()
    assert not (output_dir / "chunks").exists()
    assert not (output_dir / "document.index.json").exists()
    assert not (output_dir / "document.outline.md").exists()
    assert not (output_dir / "document.reading_state.json").exists()


@pytest.mark.asyncio
async def test_export_small_scanned_pdf_simple_artifacts_keep_assets(tmp_path: Path):
    import fitz
    from PIL import Image

    image_path = tmp_path / "scan.png"
    Image.new("RGB", (80, 60), color="red").save(image_path)
    source = tmp_path / "small-scanned.pdf"
    doc = fitz.open()
    for _ in range(3):
        page = doc.new_page(width=200, height=150)
        page.insert_image(fitz.Rect(0, 0, 200, 150), filename=str(image_path))
    doc.save(str(source))
    doc.close()

    output_dir = tmp_path / "small-scanned-output"
    tool = ExportDocumentMarkdown()
    result = await tool.execute(
        None,
        tool.get_params_class()(
            input_path=str(source),
            output_dir=str(output_dir),
        ),
    )

    assert result.ok
    assert result.extra_info["artifact_mode"] == "simple"
    assert (output_dir / "document.md").exists()
    assert (output_dir / "assets").exists()
    assert "![" in (output_dir / "document.md").read_text(encoding="utf-8")
    assert not (output_dir / "chunks").exists()


@pytest.mark.asyncio
async def test_export_large_pdf_defaults_to_progressive_artifacts(tmp_path: Path):
    import fitz

    source = tmp_path / "large-progressive.pdf"
    doc = fitz.open()
    for page_index in range(11):
        page = doc.new_page(width=300, height=200)
        page.insert_text((20, 40), f"Large PDF progressive export page {page_index + 1}")
    doc.save(str(source))
    doc.close()

    output_dir = tmp_path / "large-progressive-output"
    tool = ExportDocumentMarkdown()
    result = await tool.execute(
        None,
        tool.get_params_class()(
            input_path=str(source),
            output_dir=str(output_dir),
        ),
    )

    assert result.ok
    assert result.extra_info["artifact_mode"] == "progressive"
    assert (output_dir / "document.md").exists()
    assert (output_dir / "chunks").exists()
    assert (output_dir / "document.index.json").exists()
    assert (output_dir / "document.outline.md").exists()
    assert (output_dir / "document.reading_state.json").exists()


@pytest.mark.asyncio
async def test_export_large_document_reuses_existing_chunks_with_visual_writeback(tmp_path: Path, monkeypatch):
    import json

    source = tmp_path / "large-scanned.pdf"
    source.write_bytes(b"%PDF placeholder")
    output_dir = tmp_path / "large-scanned-output"
    chunks_dir = output_dir / "chunks"
    chunks_dir.mkdir(parents=True)
    chunk_content = "\n".join([
        "## Pages 1-11",
        "",
        "![Page 1](assets/page_0001.png)",
        "",
        "<!-- document-converter-visual:assets/page_0001.png -->",
        "#### Visual Understanding",
        "",
        "Recognized page text.",
        "",
    ])
    (chunks_dir / "chunk_0001.md").write_text(chunk_content, encoding="utf-8")
    (output_dir / "document.index.json").write_text(
        json.dumps(
            {
                "source_path": str(source),
                "file_type": "pdf",
                "unit_type": "page",
                "total_units": 11,
                "chunks": [
                    {
                        "chunk_id": "chunk_0001",
                        "title": "Pages 1-11",
                        "path": "chunks/chunk_0001.md",
                        "source_range": "pages:1-11",
                    }
                ],
                "assets": [
                    {
                        "asset_id": "asset_0001",
                        "asset_type": "image",
                        "path": "assets/page_0001.png",
                        "title": "Page 1",
                        "source_range": "pages:1",
                        "metadata": {
                            "visual_understanding": {
                                "status": "completed",
                                "written_to_chunk": True,
                                "result_path": "visual-results/page_0001.md",
                            }
                        },
                    }
                ],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    async def fake_inspect(self, path: Path):
        return DocumentProfile(
            source_path=str(path),
            file_name=path.name,
            file_type="pdf",
            file_extension=".pdf",
            file_size=source.stat().st_size,
            unit_type="page",
            total_units=11,
        )

    async def fail_if_extracts(self, *args, **kwargs):
        raise AssertionError("export should reuse existing chunks instead of extracting again")

    monkeypatch.setattr(
        "app.tools.document_parse.export_document_markdown.DocumentInspector.inspect",
        fake_inspect,
    )
    monkeypatch.setattr(
        "app.tools.document_parse.export_document_markdown.DocumentExtractor.extract",
        fail_if_extracts,
    )

    tool = ExportDocumentMarkdown()
    result = await tool.execute(
        None,
        tool.get_params_class()(
            input_path=str(source),
            output_dir=str(output_dir),
        ),
    )

    assert result.ok
    assert result.extra_info["reused_existing_chunks"] is True
    assert "Recognized page text." in (output_dir / "document.md").read_text(encoding="utf-8")
    assert "<!-- document-converter-visual:assets/page_0001.png -->" in (output_dir / "document.md").read_text(encoding="utf-8")


def test_artifact_mode_rejects_forced_simple_for_large_documents():
    profile = DocumentProfile(
        source_path="/tmp/large.pdf",
        file_name="large.pdf",
        file_type="pdf",
        file_extension=".pdf",
        file_size=1024,
        unit_type="page",
        total_units=146,
    )

    with pytest.raises(ValueError) as exc_info:
        DocumentArtifactModeSelector.resolve("simple", profile)

    assert "artifact_mode=simple is only allowed for small documents" in str(exc_info.value)
    assert "146 page(s)" in str(exc_info.value)
    assert DocumentArtifactModeSelector.resolve("auto", profile) == "progressive"


@pytest.mark.asyncio
async def test_generic_driver_normalizes_parser_images_to_assets(tmp_path: Path):
    from PIL import Image

    raw_images = tmp_path / "sample.raw-images"
    raw_images.mkdir()
    Image.new("RGB", (16, 12), color="blue").save(raw_images / "doc_image_001.png")

    output_dir = tmp_path / "sample.document"
    driver = GenericMarkItDownDriver()
    assets, skipped = await driver._collect_image_assets(str(raw_images), output_dir, "sample.docx")
    content = "![image](./sample.raw-images/doc_image_001.png)"
    rewritten = driver._rewrite_image_links_to_assets(content, str(raw_images), assets)

    assert skipped == []
    assert len(assets) == 1
    assert assets[0].path == "assets/sample_docx_image_0001.png"
    assert (output_dir / assets[0].path).exists()
    assert rewritten == "![image](assets/sample_docx_image_0001.png)"


def test_generic_driver_appends_missing_image_links():
    driver = GenericMarkItDownDriver()
    assets = [
        DocumentAsset(
            asset_id="asset_0001",
            asset_type="image",
            path="assets/sample_docx_image_0001.png",
            title="doc_image_001.png",
        )
    ]

    content = driver._append_missing_image_links("# sample.docx\n\nBody text.", assets)

    assert "## Extracted Images" in content
    assert "![doc_image_001.png](assets/sample_docx_image_0001.png)" in content


@pytest.mark.asyncio
async def test_pdf_skips_watermark_images_and_keeps_one_repeated_logo(tmp_path: Path):
    import fitz
    from PIL import Image

    watermark_path = tmp_path / "watermark.png"
    logo_path = tmp_path / "logo.png"
    figure_path = tmp_path / "figure.png"
    Image.new("RGB", (160, 100), color=(230, 230, 230)).save(watermark_path)
    Image.new("RGB", (24, 12), color="blue").save(logo_path)
    Image.new("RGB", (36, 24), color="red").save(figure_path)

    source = tmp_path / "with-watermark.pdf"
    doc = fitz.open()
    for page_index in range(3):
        page = doc.new_page(width=200, height=160)
        page.insert_text((20, 30), f"Page {page_index + 1}")
        page.insert_image(fitz.Rect(20, 35, 180, 135), filename=str(watermark_path))
        page.insert_image(fitz.Rect(12, 12, 36, 24), filename=str(logo_path))
        if page_index == 0:
            page.insert_image(fitz.Rect(60, 105, 96, 129), filename=str(figure_path))
    doc.save(str(source))
    doc.close()

    output_dir = tmp_path / "with-watermark.document"
    extraction = await PdfDocumentDriver().extract(source, output_dir, mode="local_text", extract_images=True)

    assert len(extraction.assets) == 2
    assert len([item for item in extraction.metadata["skipped_images"] if "watermark" in item["reason"]]) == 3
    assert len([item for item in extraction.metadata["skipped_images"] if "duplicate repeated image" in item["reason"]]) == 2
    assert extraction.chunks[0].content.count("![") == 2


@pytest.mark.asyncio
async def test_generic_driver_keeps_one_repeated_image_asset(tmp_path: Path):
    from PIL import Image

    raw_images = tmp_path / "sample.raw-images"
    raw_images.mkdir()
    Image.new("RGB", (16, 12), color="blue").save(raw_images / "logo_001.png")
    Image.new("RGB", (16, 12), color="blue").save(raw_images / "logo_002.png")

    output_dir = tmp_path / "sample.document"
    driver = GenericMarkItDownDriver()
    assets, skipped = await driver._collect_image_assets(str(raw_images), output_dir, "sample.docx")
    content = "\n".join([
        "![logo](./sample.raw-images/logo_001.png)",
        "![logo](./sample.raw-images/logo_002.png)",
    ])
    content = driver._remove_skipped_image_links(content, str(raw_images), skipped)
    content = driver._rewrite_image_links_to_assets(content, str(raw_images), assets)

    assert len(assets) == 1
    assert len(skipped) == 1
    assert "duplicate repeated image kept once" in skipped[0]["reason"]
    assert content.count("![") == 1
    assert "assets/sample_docx_image_0001.png" in content


@pytest.mark.asyncio
async def test_generic_driver_filters_lightweight_invalid_images(tmp_path: Path):
    from PIL import Image

    raw_images = tmp_path / "sample.raw-images"
    raw_images.mkdir()
    Image.new("RGB", (2, 2), color="black").save(raw_images / "tiny.png")
    Image.new("RGBA", (24, 24), color=(255, 255, 255, 0)).save(raw_images / "transparent.png")
    Image.new("RGB", (400, 4), color="black").save(raw_images / "line.png")
    Image.new("RGB", (80, 40), color="white").save(raw_images / "blank_spacer.png")
    Image.new("RGB", (32, 16), color="green").save(raw_images / "logo.png")

    output_dir = tmp_path / "sample.document"
    driver = GenericMarkItDownDriver()
    assets, skipped = await driver._collect_image_assets(str(raw_images), output_dir, "sample.docx")

    assert len(assets) == 1
    assert assets[0].title == "logo.png"
    reasons = {item["original_name"]: item["reason"] for item in skipped}
    assert reasons["tiny.png"] == "invalid tiny image"
    assert reasons["transparent.png"] == "invalid transparent image"
    assert reasons["line.png"] == "invalid decorative line image"
    assert reasons["blank_spacer.png"] == "invalid solid or blank image"
