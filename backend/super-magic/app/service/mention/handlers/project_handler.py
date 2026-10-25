"""Project mention handler"""
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from app.core.skill_utils.referenced_project_skills import (
    REFERENCED_PROJECT_SKILL_TIP,
    format_referenced_project_skill_lines,
)
from app.service.mention.base import BaseMentionHandler, logger

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext


class ProjectHandler(BaseMentionHandler):
    """处理整项目类型的 mention（跨项目挂载）。"""

    def get_type(self) -> str:
        return "project"

    async def get_tip(self, mention: Dict[str, Any], agent_context: Optional["AgentContext"] = None) -> str:
        tip = "Read and understand the referenced project before proceeding"
        if str(mention.get("project_id") or "").strip():
            return f"{tip}. {REFERENCED_PROJECT_SKILL_TIP}"
        return tip

    async def handle(self, mention: Dict[str, Any], index: int, agent_context: Optional["AgentContext"] = None) -> List[str]:
        project_path = mention.get("project_path", "") or ""
        project_name = mention.get("project_name", "") or ""
        project_id = str(mention.get("project_id") or "").strip()

        context_lines = [f"{index}. [@project:{project_path}]"]
        if project_name:
            context_lines.append(f"   - Project name: {project_name}")
        context_lines.append(f"   - Project path: {project_path}")
        if project_id:
            context_lines.extend(await format_referenced_project_skill_lines(project_id))

        logger.info(f"用户prompt添加项目引用: {project_path}")
        return context_lines
