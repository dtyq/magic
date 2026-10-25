"""Canvas 素材基础设施。"""

from app.tools.canvas.infrastructure.assets.asset_gateway_interface import AssetGateway, MaterializedCanvasAsset
from app.tools.canvas.infrastructure.assets.project_asset_path_resolver import ProjectAssetPathResolver
from app.tools.canvas.infrastructure.assets.workspace_asset_gateway import WorkspaceAssetGateway

__all__ = ["AssetGateway", "MaterializedCanvasAsset", "ProjectAssetPathResolver", "WorkspaceAssetGateway"]
