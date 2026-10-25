"""Markdown writer for combined outputs."""

from __future__ import annotations

from pathlib import Path

from app.utils.async_file_utils import async_write_text

from ..models import DocumentChunk
from .markdown_asset_link_resolver import MarkdownAssetLinkResolver


class MarkdownWriter:
    """将多个文档 chunk 合并为用户可直接阅读的 Markdown。"""

    @staticmethod
    async def write_combined(
        output_path: Path,
        chunks: list[DocumentChunk],
        title: str,
        source_root: Path,
        target_root: Path,
        asset_paths: list[str] | tuple[str, ...] = (),
    ) -> Path:
        """合并 chunk，并将图片链接转换为 combined 文件视角。"""
        parts = [f"# {title}", ""]
        for chunk in chunks:
            chunk_path = source_root / chunk.path if chunk.path else source_root / "document.md"
            content = MarkdownAssetLinkResolver.rewrite_asset_links(
                chunk.content,
                source_root,
                chunk_path,
                target_root,
                output_path,
                asset_paths,
            )
            parts.extend([f"## {chunk.title}", "", content.rstrip(), ""])
        await async_write_text(output_path, "\n".join(parts).rstrip() + "\n")
        return output_path
