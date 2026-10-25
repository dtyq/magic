"""Canvas Content 创建前准备服务。"""

from dataclasses import dataclass, replace

from app.tools.canvas.application.commands import ContentCommand
from app.tools.canvas.domain.content_fields.audio import AudioContentFields
from app.tools.canvas.domain.content_fields.generated_media import GeneratedMediaContentFields
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasContent
from app.tools.canvas.infrastructure.assets import AssetGateway, MaterializedCanvasAsset
from app.tools.canvas.strategies import ContentStrategyRegistry


@dataclass(frozen=True)
class PreparedContentCommand:
    """保存已准备命令及其新建的项目素材。"""

    command: ContentCommand
    materialized_asset: MaterializedCanvasAsset | None = None


class ContentPreparationService:
    """负责 Content 构建和 imported 素材规范化。"""

    def __init__(self, content_strategies: ContentStrategyRegistry, asset_gateway: AssetGateway):
        """显式保存 Content 策略和素材网关。"""
        self.content_strategies = content_strategies
        self.asset_gateway = asset_gateway

    def build(self, command: ContentCommand, element_type: str) -> CanvasContent:
        """把强类型命令转换为领域 Content。"""
        return self.content_strategies.build(command, element_type)

    async def prepare_imported(
        self,
        command: ContentCommand,
        project_path: str,
    ) -> PreparedContentCommand:
        """将 imported 素材物化到当前项目并返回新命令。"""
        if not command.is_imported:
            return PreparedContentCommand(command)
        if not isinstance(command.fields, (GeneratedMediaContentFields, AudioContentFields)):
            raise CanvasDomainError("CONTENT_INPUT_INVALID", "Imported media Content must expose a src field.")
        materialized = await self.asset_gateway.materialize_existing_file(
            project_path,
            command.asset_path or "",
            command.content_type,
        )
        fields = replace(command.fields, src=materialized.project_uri)
        return PreparedContentCommand(
            command=replace(command, fields=fields, asset_path=materialized.project_uri),
            materialized_asset=materialized,
        )

    async def discard_materialized(self, prepared: list[PreparedContentCommand]) -> None:
        """清理未能随 Canvas 事务提交的新素材。"""
        discarded: set[str] = set()
        for item in reversed(prepared):
            asset = item.materialized_asset
            if asset is None or not asset.created or str(asset.absolute_path) in discarded:
                continue
            await self.asset_gateway.discard(asset)
            discarded.add(str(asset.absolute_path))
