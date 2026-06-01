from pathlib import Path

import pytest

from app.utils.document_parse.service.document_extractor import DocumentExtractor
from app.utils.document_parse.service.document_indexer import DocumentIndexer
from app.utils.document_parse.service.document_inspector import DocumentInspector
from app.utils.document_parse.service.document_summarizer import DocumentSummarizer
from app.utils.document_parse.drivers.pdf_driver import PdfDocumentDriver
from app.utils.document_parse.drivers.generic import GenericMarkItDownDriver
from app.utils.document_parse.models import DocumentAsset
from app.utils.document_parse.structure.range_parser import RangeParser


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
