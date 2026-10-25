"""生成项目身份解析器。"""

from pathlib import Path

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.generation.contracts.project_identity import ProjectIdentity


class ProjectIdentityResolver:
    """从工作区相对路径解析外部适配使用的项目身份。"""

    def resolve(self, project_path: str) -> ProjectIdentity:
        """保留完整 project_path，并从末级目录取得展示名称。"""
        normalized = Path(project_path).as_posix().strip("/")
        if not normalized:
            raise CanvasDomainError("PROJECT_PATH_INVALID", "project_path must not be empty.")
        return ProjectIdentity(project_path=normalized, project_name=Path(normalized).name)
