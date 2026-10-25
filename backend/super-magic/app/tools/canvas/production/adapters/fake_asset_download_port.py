"""Fake 素材下载端口。"""

from pathlib import Path

from app.tools.canvas.production.ports.asset_download_port import AssetDownloadPort
from app.utils.async_file_utils import async_mkdir, async_write_bytes


class FakeAssetDownloadPort(AssetDownloadPort):
    """写入 mock 非空图片文件。"""

    async def download(self, url: str, target_path: Path) -> None:
        """创建固定 mock 文件。"""
        await async_mkdir(target_path.parent, parents=True, exist_ok=True)
        await async_write_bytes(target_path, b"mock-image")
