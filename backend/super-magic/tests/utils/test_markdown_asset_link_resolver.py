from pathlib import Path

import pytest

from app.utils.document_parse.models import DocumentChunk
from app.utils.document_parse.output.markdown_asset_link_resolver import MarkdownAssetLinkResolver
from app.utils.document_parse.output.markdown_writer import MarkdownWriter
from app.utils.document_parse.structure.chunk_store import ChunkStore


def test_rewrite_asset_link_from_output_root_to_chunk(tmp_path: Path):
    output_dir = tmp_path / "document.document"
    content = "![Page](assets/page.png)\n"

    rewritten = MarkdownAssetLinkResolver.rewrite_asset_links(
        content,
        output_dir,
        output_dir / "document.md",
        output_dir,
        output_dir / "chunks" / "chunk_0001.md",
        ["assets/page.png"],
    )

    assert rewritten == "![Page](../assets/page.png)\n"


def test_rewrite_asset_link_from_chunk_to_combined_document(tmp_path: Path):
    output_dir = tmp_path / "document.document"
    content = "![Page](../assets/page.png)\n"

    rewritten = MarkdownAssetLinkResolver.rewrite_asset_links(
        content,
        output_dir,
        output_dir / "chunks" / "chunk_0001.md",
        output_dir,
        output_dir / "document.md",
        ["assets/page.png"],
    )

    assert rewritten == "![Page](assets/page.png)\n"


def test_rewrite_asset_links_does_not_touch_unknown_or_external_links(tmp_path: Path):
    output_dir = tmp_path / "document.document"
    content = "![Unknown](assets/unknown.png)\n![Remote](https://example.com/page.png)\n"

    rewritten = MarkdownAssetLinkResolver.rewrite_asset_links(
        content,
        output_dir,
        output_dir / "document.md",
        output_dir,
        output_dir / "chunks" / "chunk_0001.md",
        ["assets/page.png"],
    )

    assert rewritten == content


def test_asset_path_outside_output_dir_is_rejected(tmp_path: Path):
    assert MarkdownAssetLinkResolver.asset_link(
        tmp_path / "document.document",
        tmp_path / "document.document" / "document.md",
        "../secret.png",
    ) is None


@pytest.mark.asyncio
async def test_chunk_store_writes_chunk_relative_asset_links(tmp_path: Path):
    output_dir = tmp_path / "document.document"
    chunk = DocumentChunk(
        chunk_id="chunk_0001",
        title="Page 1",
        content="![Page](assets/page.png)",
        source_range="pages:1",
    )

    saved = await ChunkStore.write_chunks(output_dir, [chunk], ["assets/page.png"])

    assert saved[0].content == "![Page](../assets/page.png)"
    assert (output_dir / "chunks" / "chunk_0001.md").read_text(encoding="utf-8") == "![Page](../assets/page.png)\n"


@pytest.mark.asyncio
async def test_markdown_writer_restores_root_relative_asset_links(tmp_path: Path):
    output_dir = tmp_path / "document.document"
    chunk = DocumentChunk(
        chunk_id="chunk_0001",
        title="Page 1",
        content="![Page](../assets/page.png)",
        source_range="pages:1",
        path="chunks/chunk_0001.md",
    )

    combined_path = await MarkdownWriter.write_combined(
        output_dir / "document.md",
        [chunk],
        "document",
        output_dir,
        output_dir,
        ["assets/page.png"],
    )

    assert combined_path == output_dir / "document.md"
    assert "![Page](assets/page.png)" in combined_path.read_text(encoding="utf-8")
