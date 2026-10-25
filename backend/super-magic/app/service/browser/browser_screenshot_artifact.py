"""Browser 截图 artifact 的跨运行来源与本地 staging。"""

from __future__ import annotations

import base64
import tempfile
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from urllib.parse import quote, unquote, urlparse

from agentlang.environment import Environment
from app.core.context.agent_context import AgentContext
from app.infrastructure.storage.base import AbstractStorage
from app.infrastructure.storage.factory import StorageFactory
from app.path_manager import PathManager
from app.utils.async_file_utils import (
    async_close_fd,
    async_copy2,
    async_exists,
    async_mkdir,
    async_mkstemp,
    async_unlink,
    async_write_bytes,
)
from app.utils.path_utils import get_workspace_dir
from magic_use.errors import BrowserErrorCode, BrowserSDKError


ARTIFACT_SCHEME = "artifact"
ARTIFACT_PROVIDER = "browser-screenshot"
_LOCAL_ARTIFACT_ROOT = PurePosixPath("browser", "screenshots")


@dataclass(frozen=True, slots=True)
class BrowserScreenshotArtifact:
    content_hash: str
    file_key: str
    file_size: int
    width: int
    height: int
    quality: int
    reused: bool
    source_ref: str
    # 仅本地 Tool Detail 展示使用，不参与历史消息或 artifact 引用持久化。
    file_url: str | None


@dataclass(frozen=True, slots=True)
class BrowserEncodedScreenshot:
    content_hash: str
    content: bytes
    width: int
    height: int
    quality: int


class BrowserScreenshotArtifactStore:
    """保存和读取 Browser 截图，不把模型中间产物登记为 MagicFS 文件。"""

    def __init__(self, agent_context: AgentContext) -> None:
        self._agent_context = agent_context

    @staticmethod
    def build_source_ref(project_id: str, topic_id: str, content_hash: str) -> str:
        return (
            f"{ARTIFACT_SCHEME}://{ARTIFACT_PROVIDER}/"
            f"{quote(project_id, safe='')}/{quote(topic_id, safe='')}/{content_hash}.webp"
        )

    @staticmethod
    def is_source_ref(value: str) -> bool:
        parsed = urlparse(value)
        return parsed.scheme == ARTIFACT_SCHEME and parsed.netloc == ARTIFACT_PROVIDER

    async def publish(
        self,
        encoded: BrowserEncodedScreenshot,
    ) -> BrowserScreenshotArtifact:
        project_id, topic_id = self._context_ids()
        source_ref = self.build_source_ref(project_id, topic_id, encoded.content_hash)
        if Environment.is_local():
            return await self._publish_local(encoded, source_ref, topic_id)
        return await self._publish_remote(encoded, source_ref)

    @asynccontextmanager
    async def materialize(self, source_ref: str) -> AsyncIterator[str]:
        """把稳定 artifact 引用放入系统临时目录，退出后删除 staging。"""
        project_id, topic_id, content_hash = self._parse_source_ref(source_ref)
        current_project_id, current_topic_id = self._context_ids()
        if (project_id, topic_id) != (current_project_id, current_topic_id):
            raise ValueError("Browser screenshot artifact does not belong to the current topic")

        temp_dir = Path(tempfile.gettempdir()) / "super-magic" / "browser-visual"
        await async_mkdir(temp_dir, parents=True, exist_ok=True)
        fd, temp_path = await async_mkstemp(suffix=".webp", prefix="artifact-", dir=temp_dir)
        await async_close_fd(fd)
        try:
            if Environment.is_local():
                source_path = self._local_path(topic_id, content_hash)
                if not await async_exists(source_path):
                    raise FileNotFoundError(f"Browser screenshot artifact is missing: {source_ref}")
                await async_copy2(source_path, temp_path)
            else:
                storage = await self._get_storage()
                if storage.credentials is None:
                    raise BrowserSDKError(
                        BrowserErrorCode.INVALID_CONFIG,
                        "Object storage credentials are unavailable",
                    )
                workspace_key = get_workspace_dir(storage.credentials)
                remote_key = self._remote_key(workspace_key, project_id, topic_id, content_hash)
                await storage.download_file_by_stream(remote_key, temp_path)
            yield temp_path
        finally:
            await async_unlink(temp_path)

    async def _publish_local(
        self,
        encoded: BrowserEncodedScreenshot,
        source_ref: str,
        topic_id: str,
    ) -> BrowserScreenshotArtifact:
        target = self._local_path(topic_id, encoded.content_hash)
        reused = await async_exists(target)
        if not reused:
            await async_mkdir(target.parent, parents=True, exist_ok=True)
            await async_write_bytes(target, encoded.content)
        encoded_image = base64.b64encode(encoded.content).decode("ascii")
        return BrowserScreenshotArtifact(
            content_hash=encoded.content_hash,
            file_key=f"local-topic-artifact:{encoded.content_hash}",
            file_size=len(encoded.content),
            width=encoded.width,
            height=encoded.height,
            quality=encoded.quality,
            reused=reused,
            source_ref=source_ref,
            file_url=f"data:image/webp;base64,{encoded_image}",
        )

    async def _publish_remote(
        self,
        encoded: BrowserEncodedScreenshot,
        source_ref: str,
    ) -> BrowserScreenshotArtifact:
        storage = await self._get_storage()
        if storage.credentials is None:
            raise BrowserSDKError(
                BrowserErrorCode.INVALID_CONFIG,
                "Object storage credentials are unavailable",
            )
        project_id, topic_id = self._context_ids()
        file_key = self._remote_key(
            get_workspace_dir(storage.credentials),
            project_id,
            topic_id,
            encoded.content_hash,
        )
        reused = await storage.exists(file_key)
        if not reused:
            await storage.upload(file=encoded.content, key=file_key)
        return BrowserScreenshotArtifact(
            content_hash=encoded.content_hash,
            file_key=file_key,
            file_size=len(encoded.content),
            width=encoded.width,
            height=encoded.height,
            quality=encoded.quality,
            reused=reused,
            source_ref=source_ref,
            file_url=None,
        )

    async def _get_storage(self) -> AbstractStorage:
        return await StorageFactory.get_storage(
            sts_token_refresh=self._agent_context.get_init_client_message_sts_token_refresh(),
            metadata=self._agent_context.get_metadata(),
            platform=self._agent_context.get_init_client_message_platform_type(),
        )

    def _context_ids(self) -> tuple[str, str]:
        context = self._agent_context.get_super_magic_product_context()
        metadata = self._agent_context.get_metadata()
        project_id = context.project.id if context is not None else str(metadata.get("project_id") or "")
        topic_id = context.topic.id if context is not None else str(
            metadata.get("topic_id") or metadata.get("chat_topic_id") or ""
        )
        if not project_id or not topic_id:
            raise BrowserSDKError(
                BrowserErrorCode.INVALID_CONFIG,
                "Project and topic context are required for a Browser screenshot artifact",
            )
        return project_id, topic_id

    @staticmethod
    def _parse_source_ref(source_ref: str) -> tuple[str, str, str]:
        parsed = urlparse(source_ref)
        if parsed.scheme != ARTIFACT_SCHEME or parsed.netloc != ARTIFACT_PROVIDER:
            raise ValueError("Unsupported Browser screenshot artifact reference")
        parts = parsed.path.strip("/").split("/")
        if len(parts) != 3:
            raise ValueError("Invalid Browser screenshot artifact reference")
        project_id, topic_id, filename = (unquote(part) for part in parts)
        if not project_id or not topic_id or "/" in project_id or "/" in topic_id:
            raise ValueError("Invalid Browser screenshot artifact scope")
        if not filename.endswith(".webp"):
            raise ValueError("Browser screenshot artifact must use WebP")
        content_hash = filename[:-5]
        if len(content_hash) != 64 or any(char not in "0123456789abcdef" for char in content_hash):
            raise ValueError("Invalid Browser screenshot artifact hash")
        return project_id, topic_id, content_hash

    @staticmethod
    def _local_path(topic_id: str, content_hash: str) -> Path:
        return PathManager.get_topic_dir() / Path(
            _LOCAL_ARTIFACT_ROOT.as_posix(),
            quote(topic_id, safe=""),
            f"{content_hash}.webp",
        )

    @staticmethod
    def _remote_key(
        workspace_key: str,
        project_id: str,
        topic_id: str,
        content_hash: str,
    ) -> str:
        parts = PurePosixPath(workspace_key.strip("/")).parts
        project_part = f"project_{project_id}"
        if project_part not in parts:
            raise BrowserSDKError(
                BrowserErrorCode.INVALID_CONFIG,
                "The Browser screenshot storage path does not match the current project",
            )
        project_index = parts.index(project_part)
        project_suffix = parts[project_index + 1 :]
        if project_suffix not in ((), ("workspace",)):
            raise BrowserSDKError(
                BrowserErrorCode.INVALID_CONFIG,
                "The Browser screenshot storage path is not a project root or workspace path",
            )
        return PurePosixPath(
            *parts[: project_index + 1],
            "runtime",
            f"topic_{topic_id}",
            "screenshots",
            f"{content_hash}.webp",
        ).as_posix()


__all__ = [
    "ARTIFACT_PROVIDER",
    "ARTIFACT_SCHEME",
    "BrowserEncodedScreenshot",
    "BrowserScreenshotArtifact",
    "BrowserScreenshotArtifactStore",
]
