from pathlib import Path

import pytest

from app.utils.document_parse.service.document_extractor import DocumentExtractor
from app.utils.document_parse.service.document_indexer import DocumentIndexer
from app.utils.document_parse.service.document_inspector import DocumentInspector
from app.utils.document_parse.service.document_summarizer import DocumentSummarizer
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
