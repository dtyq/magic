"""Project directory mention handler"""
from typing import Dict, List, Any

from app.service.mention.base import BaseMentionHandler, logger
from app.service.mention.utils.canvas_project_detector import detect_project_type


class ProjectDirectoryHandler(BaseMentionHandler):
    """处理项目目录类型的mention

    判断目录是否为特定类型的项目（如设计画布项目）
    """

    def get_type(self) -> str:
        return "project_directory"

    async def get_tip(self, mention: Dict[str, Any]) -> str:
        directory_path = self.normalize_path(mention.get("directory_path", ""))
        project_type = await detect_project_type(directory_path)

        if project_type == "design":
            return (
                "The referenced Canvas design project requires canvas project skill or tools "
                "for AI image generation, image search, or design marker processing."
            )
        if project_type == "slide":
            return (
                "The referenced Slide project requires slide/PPT skill or tools "
                "to create, edit, or manage the presentation."
            )
        return "Read and understand the referenced file or directory before proceeding"

    async def handle(self, mention: Dict[str, Any], index: int) -> List[str]:
        directory_path = self.normalize_path(mention.get("directory_path", ""))
        project_type = await detect_project_type(directory_path)

        if project_type == "design":
            context_lines = [
                f"{index}. [@design_canvas_project:{directory_path}]",
                f"   - Project type: canvas design project",
                f"   - Project path: {directory_path}",
            ]
            logger.info(f"用户prompt添加设计画布项目引用: {directory_path}")
        elif project_type == "slide":
            context_lines = [
                f"{index}. [@slide_project:{directory_path}]",
                f"   - Project type: slide project",
                f"   - Project path: {directory_path}",
            ]
            logger.info(f"用户prompt添加幻灯片项目引用: {directory_path}")
        elif project_type:
            context_lines = [
                f"{index}. [@project_directory:{directory_path}]",
                f"   - Project type: {project_type}",
                f"   - Project path: {directory_path}",
            ]
            logger.info(f"用户prompt添加 {project_type} 项目引用: {directory_path}")
        else:
            context_lines = [
                f"{index}. [@directory:{directory_path}]",
                f"   - Directory path: {directory_path}",
            ]
            logger.info(f"用户prompt添加目录引用: {directory_path}")

        return context_lines
