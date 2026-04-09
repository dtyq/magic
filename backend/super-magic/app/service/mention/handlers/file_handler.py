"""File mention handler"""
from pathlib import Path
from typing import Dict, List, Any

from app.service.mention.base import BaseMentionHandler, logger
from app.service.mention.utils.canvas_project_detector import find_parent_canvas_project

_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".avif"}
_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".webm", ".mkv", ".flv", ".wmv"}

_PROJECT_TYPE_LABELS = {
    "design": "canvas",
    "slide": "slide",
}

_PROJECT_TYPE_TIPS = {
    "design": (
        "The referenced file belongs to a Canvas design project. "
        "Use canvas project skill or tools for AI image generation, image search, or design marker processing."
    ),
    "slide": (
        "The referenced file belongs to a Slide project. "
        "Use slide/PPT skill or tools to create, edit, or manage the presentation."
    ),
}


def _file_category(file_path: str) -> str:
    ext = Path(file_path).suffix.lower()
    if ext in _IMAGE_EXTS:
        return "image"
    if ext in _VIDEO_EXTS:
        return "video"
    return "file"


class FileHandler(BaseMentionHandler):
    """处理文件类型的mention（file、project_file、upload_file）"""

    def get_type(self) -> str:
        return "file"

    async def get_tip(self, mention: Dict[str, Any]) -> str:
        file_path = self.normalize_path(mention.get("file_path", ""))
        _, project_type = await find_parent_canvas_project(file_path)
        if project_type and project_type in _PROJECT_TYPE_TIPS:
            return _PROJECT_TYPE_TIPS[project_type]
        return "Read and understand the referenced file or directory before proceeding"

    async def handle(self, mention: Dict[str, Any], index: int) -> List[str]:
        file_path = self.normalize_path(mention.get("file_path", ""))
        file_url = mention.get("file_url", "")

        context_lines = [f"{index}. [@file_path:{file_path}]"]

        project_path, project_type = await find_parent_canvas_project(file_path)
        if project_path and project_type:
            project_label = _PROJECT_TYPE_LABELS.get(project_type, project_type)
            category = _file_category(file_path)
            context_lines.append(f"   - Project ({project_label}): {project_path}")
            context_lines.append(f"   - File type: {project_label} {category}")

        if file_url:
            context_lines.append(f"   - URL: {file_url}")

        logger.info(
            f"用户prompt添加文件引用: {file_path}"
            + (f" (所属项目: {project_path})" if project_path else "")
        )

        return context_lines
