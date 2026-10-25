"""工作区素材网关实现。"""

import asyncio
import hashlib
from pathlib import Path
from stat import S_ISREG

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.infrastructure.assets.asset_gateway_interface import AssetGateway, MaterializedCanvasAsset
from app.tools.canvas.infrastructure.assets.project_asset_path_resolver import ProjectAssetPathResolver
from app.utils.asset_filename_policy import AssetFilenamePolicy
from app.utils.async_file_utils import async_copy_contents, async_exists, async_stat, async_unlink

_MEDIA_DIRECTORY_BY_TYPE = {
    "image": "images",
    "video": "videos",
    "audio": "audios",
}
_MEDIA_EXTENSIONS_BY_TYPE = {
    "image": {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"},
    "video": {".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv"},
    "audio": {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".opus"},
}
class WorkspaceAssetGateway(AssetGateway):
    """解析、校验并物化工作区或本机绝对路径下的素材文件。"""

    def __init__(self, workspace: Path):
        """保存工作区根目录。"""
        self.workspace = workspace
        self.path_resolver = ProjectAssetPathResolver(workspace)

    async def materialize_existing_file(
        self,
        project_path: str,
        asset_path: str,
        media_type: str,
    ) -> MaterializedCanvasAsset:
        """将工作区素材物化到当前项目的类型目录。"""
        target_directory = self._target_directory(media_type)
        source = await self._resolve_existing_source(project_path, asset_path)
        suffix = source.suffix.lower()
        if suffix not in _MEDIA_EXTENSIONS_BY_TYPE[media_type]:
            raise CanvasDomainError(
                "ASSET_TYPE_MISMATCH",
                f"Asset file type does not match content_type={media_type}: {asset_path}.",
            )

        project_root = self.path_resolver.resolve_project_root(project_path)
        canonical_root = (project_root / target_directory).resolve()
        try:
            canonical_root.relative_to(project_root)
        except ValueError as error:
            raise CanvasDomainError(
                "ASSET_PATH_INVALID",
                "Canvas project media directory must stay inside the project.",
            ) from error
        try:
            project_relative = source.relative_to(canonical_root).as_posix()
        except ValueError:
            project_relative = None
        if project_relative is not None:
            return MaterializedCanvasAsset(
                project_uri=f"./{target_directory}/{project_relative}",
                absolute_path=source,
                created=False,
            )

        digest = await asyncio.to_thread(self._content_digest, source)
        filename = AssetFilenamePolicy.sanitize(source.name)
        destination = canonical_root / filename
        while await async_exists(destination):
            if not S_ISREG((await async_stat(destination)).st_mode):
                raise CanvasDomainError(
                    "ASSET_DESTINATION_INVALID",
                    f"Canvas asset destination is not a regular file: {destination}.",
                )
            existing_digest = await asyncio.to_thread(self._content_digest, destination)
            if existing_digest == digest:
                return MaterializedCanvasAsset(
                    project_uri=f"./{target_directory}/{filename}",
                    absolute_path=destination,
                    created=False,
                )
            filename = AssetFilenamePolicy.unique_name(filename)
            destination = canonical_root / filename

        created = await self._copy_to_destination(source, destination)
        return MaterializedCanvasAsset(
            project_uri=f"./{target_directory}/{filename}",
            absolute_path=destination,
            created=created,
        )

    async def discard(self, asset: MaterializedCanvasAsset) -> None:
        """仅删除本次物化新建的项目文件。"""
        if asset.created:
            await async_unlink(asset.absolute_path)

    async def _resolve_existing_source(self, project_path: str, asset_path: str) -> Path:
        """按项目相对、工作区相对或本机绝对路径解析素材。"""
        raw = str(asset_path or "").strip().replace("\\", "/")
        if not raw:
            raise CanvasDomainError("ASSET_PATH_INVALID", "Asset path must not be empty.")

        project_root = self.path_resolver.resolve_project_root(project_path)
        value = Path(raw).expanduser()
        if value.is_absolute():
            candidates = [value]
        elif raw.startswith("./"):
            candidates = [project_root / raw[2:]]
        else:
            workspace_candidate = self.workspace / value
            project_candidate = project_root / value
            project_prefix = Path(project_path).parts
            candidates = (
                [workspace_candidate]
                if value.parts[: len(project_prefix)] == project_prefix
                else [project_candidate, workspace_candidate]
            )

        for candidate in candidates:
            resolved = candidate.resolve()
            if not value.is_absolute():
                try:
                    resolved.relative_to(self.workspace.resolve())
                except ValueError as error:
                    raise CanvasDomainError(
                        "ASSET_PATH_INVALID",
                        "Relative asset paths must stay inside the Canvas workspace.",
                    ) from error
            if await async_exists(resolved) and S_ISREG((await async_stat(resolved)).st_mode):
                return resolved
        raise CanvasDomainError("ASSET_NOT_FOUND", f"Asset file does not exist: {asset_path}.")

    @staticmethod
    def _target_directory(media_type: str) -> str:
        """返回媒体类型对应的 Canvas 项目目录。"""
        directory = _MEDIA_DIRECTORY_BY_TYPE.get(media_type)
        if directory is None:
            raise CanvasDomainError(
                "ASSET_TYPE_UNSUPPORTED",
                f"Imported Canvas assets do not support content_type={media_type}.",
            )
        return directory

    @staticmethod
    async def _copy_to_destination(source: Path, destination: Path) -> bool:
        """直接复制素材内容到项目目录，兼容普通目录和 S3 挂载目录。"""
        try:
            await async_copy_contents(source, destination)
            return True
        except Exception:
            await async_unlink(destination)
            raise

    @staticmethod
    def _content_digest(path: Path) -> str:
        """以分块读取计算素材内容指纹，保持重复导入幂等。"""
        digest = hashlib.sha256()
        with path.open("rb") as stream:
            while chunk := stream.read(1024 * 1024):
                digest.update(chunk)
        return digest.hexdigest()
