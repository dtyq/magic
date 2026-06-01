from pathlib import Path

import pytest

from app.utils.document_parse.service.document_extractor import DocumentExtractor
from app.utils.document_parse.service.document_indexer import DocumentIndexer
from app.utils.document_parse.service.document_inspector import DocumentInspector
from app.utils.document_parse.service.document_summarizer import DocumentSummarizer
from app.utils.document_parse.drivers.pdf_driver import PdfDocumentDriver
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
