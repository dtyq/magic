"""Canvas 项目路径解析器。"""

from pathlib import Path


class CanvasPathResolver:
    """把工作区相对 project_path 安全解析为本地目录。"""

    @staticmethod
    def resolve(workspace: Path, project_path: str) -> Path:
        """解析并拒绝绝对路径和工作区外路径。"""
        if not project_path or not project_path.strip() or project_path.strip() in {".", "./"}:
            raise ValueError("PROJECT_PATH_INVALID")
        raw = Path(project_path)
        if raw.is_absolute() or ".." in raw.parts:
            raise ValueError("PROJECT_PATH_INVALID")
        resolved = (workspace / raw).resolve()
        workspace_root = workspace.resolve()
        if resolved != workspace_root and workspace_root not in resolved.parents:
            raise ValueError("PROJECT_PATH_INVALID")
        return resolved
