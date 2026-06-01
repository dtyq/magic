"""Hierarchical document summarization service.

This service writes a navigable extractive summary instead of copying large
chunks verbatim. It follows the product workflow shape: chunk summaries first,
then section summaries, then a compact global summary.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Iterable, List

from app.utils.async_file_utils import async_exists, async_read_json, async_read_text
from ..constants import INDEX_FILENAME
from ..output.summary_writer import SummaryWriter


class DocumentSummarizer:
    async def summarize(self, output_dir: Path, max_chunk_chars: int = 1200) -> str:
        index_path = output_dir / INDEX_FILENAME
        if not await async_exists(index_path):
            raise FileNotFoundError(f"document index not found: {index_path}")
        index = await async_read_json(index_path)
        title = index.get("title") or "Document"
        lines: List[str] = [f"# {title} Summary", ""]
        chunks = index.get("chunks") or []
        if not chunks:
            lines.append("No chunks available. Run extract_document_content first.")
            summary = "\n".join(lines).rstrip()
            await SummaryWriter.write(output_dir, summary)
            return summary

        chunk_summaries: List[Dict[str, str]] = []
        for chunk in chunks:
            chunk_path = output_dir / chunk.get("path", "")
            if not await async_exists(chunk_path):
                continue
            text = (await async_read_text(chunk_path, errors="ignore")).strip()
            chunk_summaries.append({
                "chunk_id": str(chunk.get("chunk_id") or ""),
                "title": str(chunk.get("title") or "Untitled chunk"),
                "path": str(chunk.get("path") or ""),
                "source_range": str(chunk.get("source_range") or ""),
                "summary": self._summarize_text(text, max_chunk_chars),
            })

        lines.extend(["## Global Summary", ""])
        lines.append(self._merge_global_summary(title, chunk_summaries))

        section_lines = self._build_section_summaries(index.get("nodes") or [], chunk_summaries)
        if section_lines:
            lines.extend(["", "## Section Summaries", "", *section_lines])

        lines.extend(["", "## Chunk Summaries", ""])
        for item in chunk_summaries:
            lines.extend([
                f"### {item['chunk_id']} - {item['title']}",
                f"- Source range: `{item['source_range']}`",
                f"- File: `{item['path']}`",
                "",
                item["summary"],
                "",
            ])
        summary = "\n".join(lines).rstrip()
        await SummaryWriter.write(output_dir, summary)
        return summary

    @staticmethod
    def _summarize_text(text: str, max_chars: int) -> str:
        compact = " ".join(line.strip() for line in text.splitlines() if line.strip())
        if not compact:
            return "No readable text was extracted for this chunk."
        sentences = DocumentSummarizer._split_sentences(compact)
        selected: List[str] = []
        total = 0
        for sentence in sentences:
            if not sentence:
                continue
            selected.append(sentence)
            total += len(sentence)
            if total >= max(240, min(max_chars, 900)):
                break
        return " ".join(selected).strip() or compact[:max_chars].strip()

    @staticmethod
    def _split_sentences(text: str) -> List[str]:
        separators = "。！？.!?"
        sentences: List[str] = []
        start = 0
        for index, char in enumerate(text):
            if char in separators:
                sentences.append(text[start:index + 1].strip())
                start = index + 1
        tail = text[start:].strip()
        if tail:
            sentences.append(tail)
        return sentences or [text]

    @staticmethod
    def _merge_global_summary(title: str, chunk_summaries: List[Dict[str, str]]) -> str:
        if not chunk_summaries:
            return f"No chunk summaries were generated for {title}."
        highlights = [item["summary"] for item in chunk_summaries[:5] if item.get("summary")]
        merged = " ".join(highlights)
        return DocumentSummarizer._summarize_text(merged, 900)

    @staticmethod
    def _build_section_summaries(nodes: Iterable[Dict[str, Any]], chunk_summaries: List[Dict[str, str]]) -> List[str]:
        chunk_by_id = {item["chunk_id"]: item for item in chunk_summaries}
        lines: List[str] = []

        def visit(node_list: Iterable[Dict[str, Any]], depth: int = 0) -> None:
            for node in node_list:
                title = str(node.get("title") or "Untitled section")
                chunk_ids = [str(chunk_id) for chunk_id in node.get("chunk_ids") or []]
                summaries = [chunk_by_id[chunk_id]["summary"] for chunk_id in chunk_ids if chunk_id in chunk_by_id]
                indent = "  " * depth
                if summaries:
                    section_summary = DocumentSummarizer._summarize_text(" ".join(summaries), 700)
                    lines.append(f"{indent}- {title}: {section_summary}")
                else:
                    source_range = str(node.get("source_range") or "")
                    suffix = f" [{source_range}]" if source_range else ""
                    lines.append(f"{indent}- {title}{suffix}: No extracted chunk is directly attached.")
                visit(node.get("children") or [], depth + 1)

        visit(nodes)
        return lines
