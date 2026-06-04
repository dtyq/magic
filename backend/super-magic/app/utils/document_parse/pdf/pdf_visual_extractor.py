"""Visual PDF page extraction through the existing visual understanding tool."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable, List

from app.utils.async_file_utils import async_unlink

from .pdf_page_renderer import PdfPageRenderer


class PdfVisualExtractor:
    @staticmethod
    async def extract_pages(path: Path, pages: Iterable[int], query: str | None = None) -> str:
        from app.tools.visual_understanding import VisualUnderstanding, VisualUnderstandingParams

        rendered = await PdfPageRenderer.render_pages(path, pages)
        visual_tool = VisualUnderstanding()
        parts: List[str] = []
        try:
            for page_no, image_path in rendered:
                params = VisualUnderstandingParams(
                    images=[str(image_path)],
                    query=query or (
                        f"这是文档第 {page_no} 页。请转换为结构化 Markdown，"
                        "保留标题、正文、表格、图表含义和重要视觉信息。"
                    ),
                )
                result = await visual_tool.execute_purely(
                    params,
                    include_download_info_in_content=False,
                    include_dimensions_info_in_content=False,
                )
                parts.extend([f"## 第 {page_no} 页", "", result.content.strip() if result.ok else "视觉解析失败", ""])
        finally:
            for _, image_path in rendered:
                try:
                    await async_unlink(image_path)
                except Exception:
                    pass
        return "\n".join(parts).strip()
