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
from app.utils.document_parse.models import DocumentAsset, DocumentProfile
from app.utils.document_parse.structure.range_parser import RangeParser
from app.tools.document_parse.export_document_markdown import ExportDocumentMarkdown


def test_range_parser_compacts_numeric_ranges():
    assert RangeParser.parse_numeric("1-3,5,7-8", total=10) == [1, 2, 3, 5, 7, 8]


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

    result = await DocumentImageUnderstander().understand(output_dir, ranges="1", max_images=1)
    chunk_text = (chunks_dir / "chunk_0001.md").read_text(encoding="utf-8")

    assert result["processed"][0]["ok"] is True
    assert "Recognized text from page image." in chunk_text
    assert (output_dir / "visual-results" / "page1.md").exists()
    assert (output_dir / "document.reading_state.json").exists()


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
async def test_export_small_pdf_can_force_progressive_artifacts(tmp_path: Path):
    import fitz

    source = tmp_path / "small-progressive.pdf"
    doc = fitz.open()
    page = doc.new_page(width=300, height=200)
    page.insert_text((20, 40), "Small PDF progressive export")
    doc.save(str(source))
    doc.close()

    output_dir = tmp_path / "small-progressive-output"
    tool = ExportDocumentMarkdown()
    result = await tool.execute(
        None,
        tool.get_params_class()(
            input_path=str(source),
            output_dir=str(output_dir),
            artifact_mode="progressive",
        ),
    )

    assert result.ok
    assert result.extra_info["artifact_mode"] == "progressive"
    assert (output_dir / "document.md").exists()
    assert (output_dir / "chunks").exists()
    assert (output_dir / "document.index.json").exists()
    assert (output_dir / "document.outline.md").exists()
    assert (output_dir / "document.reading_state.json").exists()


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
