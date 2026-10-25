"""Project directory mention handler"""
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from app.service.mention.base import BaseMentionHandler, logger
from app.service.mention.handlers.file_handler import _canonical_file_link

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext
from app.service.mention.utils.canvas_project_detector import detect_project_type


class ProjectDirectoryHandler(BaseMentionHandler):
    """处理项目目录类型的mention

    判断目录是否为特定类型的项目（如设计画布项目）
    """

    def get_type(self) -> str:
        return "project_directory"

    async def get_tip(self, mention: Dict[str, Any], agent_context: Optional["AgentContext"] = None) -> str:
        directory_path = mention.get("directory_path", "")
        if mention.get("type") == "user_directory" or directory_path.startswith("~/"):
            return "Read and understand the referenced file or directory before proceeding"
        project_type = await detect_project_type(directory_path)

        if project_type == "design":
            return (
                "Read and follow the `canvas-manager` Skill first (if it is not already preloaded), "
                "then inspect the referenced Canvas project with the Canvas business tools. "
                "Do not read or edit Canvas project files directly."
            )
        if project_type == "slide":
            return (
                "The referenced Slide project requires slide/PPT skill or tools "
                "to create, edit, or manage the presentation."
            )
        return "Read and understand the referenced file or directory before proceeding"

    async def handle(self, mention: Dict[str, Any], index: int, agent_context: Optional["AgentContext"] = None) -> List[str]:
        directory_path = mention.get("directory_path", "")
        directory_name = str(mention.get("directory_name") or "")
        canonical_link = _canonical_file_link(directory_path, directory_name, is_directory=True)
        if mention.get("type") == "user_directory" or directory_path.startswith("~/"):
            return [f"{index}. {canonical_link or 'Directory reference unavailable'}"]
        project_type = await detect_project_type(directory_path)

        if project_type == "design":
            context_lines = [
                f"{index}. [@design_canvas_project:{directory_path}]",
                "   - Project type: canvas design project",
                f"   - Project path: {directory_path}",
            ]
            logger.info(f"用户prompt添加设计画布项目引用: {directory_path}")
        elif project_type == "slide":
            context_lines = [
                f"{index}. [@slide_project:{directory_path}]",
                "   - Project type: slide project",
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
