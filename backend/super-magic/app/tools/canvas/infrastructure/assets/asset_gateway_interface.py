"""Canvas 素材网关抽象接口。"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class MaterializedCanvasAsset:
    """描述已物化到当前 Canvas 项目的素材。"""

    project_uri: str
    absolute_path: Path
    created: bool


class AssetGateway(ABC):
    """定义本机素材进入 Canvas 项目的物化边界。"""

    @abstractmethod
    async def materialize_existing_file(
        self,
        project_path: str,
        asset_path: str,
        media_type: str,
    ) -> MaterializedCanvasAsset:
        """校验本机素材，必要时复制到项目媒体目录并返回项目内 URI。"""

    @abstractmethod
    async def discard(self, asset: MaterializedCanvasAsset) -> None:
        """回滚本次新建但尚未被 Canvas 提交的素材文件。"""
