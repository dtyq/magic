"""Browser screenshot 编码、上传与去重。"""

from __future__ import annotations

import asyncio
import hashlib
import io

from PIL import Image

from agentlang.context.tool_context import ToolContext
from app.core.context.agent_context import AgentContext
from app.service.browser.browser_config_adapter import BrowserConfigAdapter
from app.service.browser.browser_screenshot_artifact import (
    BrowserEncodedScreenshot,
    BrowserScreenshotArtifact,
    BrowserScreenshotArtifactStore,
)
from magic_use.config import BrowserScreenshotConfig
from magic_use.errors import BrowserErrorCode, BrowserSDKError


class BrowserScreenshotService:
    def __init__(self, tool_context: ToolContext) -> None:
        agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
        if agent_context is None:
            raise BrowserSDKError(BrowserErrorCode.INVALID_CONFIG, "Agent context is unavailable")
        self._tool_context = tool_context
        self._agent_context = agent_context
        self._artifact_store = BrowserScreenshotArtifactStore(agent_context)

    async def encode(self, image: bytes) -> BrowserEncodedScreenshot:
        config = BrowserConfigAdapter.screenshot_config()
        return await asyncio.to_thread(self._encode_webp, image, config)

    async def publish(self, image: bytes | BrowserEncodedScreenshot) -> BrowserScreenshotArtifact:
        encoded = await self.encode(image) if isinstance(image, bytes) else image
        # Browser Tool Detail 截图是短期展示资源，不能加入 EventContext attachments；
        # 普通附件链路会把它登记为 MagicFS 项目文件，使 Agent 能通过工作区文件系统看到它。
        return await self._artifact_store.publish(encoded)

    @property
    def artifact_store(self) -> BrowserScreenshotArtifactStore:
        return self._artifact_store

    @staticmethod
    def _encode_webp(image: bytes, config: BrowserScreenshotConfig) -> BrowserEncodedScreenshot:
        with Image.open(io.BytesIO(image)) as source:
            original = source.convert("RGB")
        max_source_height = max(1, round(original.width * config.max_height_ratio))
        if original.height > max_source_height:
            original = original.crop((0, 0, original.width, max_source_height))
        quality_values = list(
            range(config.webp_quality, config.webp_min_quality - 1, -config.webp_quality_step)
        )
        if quality_values[-1] != config.webp_min_quality:
            quality_values.append(config.webp_min_quality)

        width = min(original.width, config.max_width)
        height = max(1, round(original.height * width / original.width))
        budget = min(
            config.max_bytes,
            max(config.min_bytes, round(width * height * config.target_bpp / 8)),
        )
        content_hash = hashlib.sha256(image).hexdigest()
        last = BrowserEncodedScreenshot(
            content_hash=content_hash,
            content=b"",
            width=width,
            height=height,
            quality=config.webp_min_quality,
        )
        while True:
            rendered = (
                original
                if (width, height) == original.size
                else original.resize((width, height), Image.Resampling.LANCZOS)
            )
            for quality in quality_values:
                output = io.BytesIO()
                rendered.save(output, format="WEBP", quality=quality, method=6)
                last = BrowserEncodedScreenshot(
                    content_hash=content_hash,
                    content=output.getvalue(),
                    width=rendered.width,
                    height=rendered.height,
                    quality=quality,
                )
                if len(last.content) <= budget:
                    return last

            shortest_dimension = min(width, height)
            if shortest_dimension <= config.min_dimension:
                return last
            next_scale = max(config.resize_step, config.min_dimension / shortest_dimension)
            next_size = (
                max(1, round(width * next_scale)),
                max(1, round(height * next_scale)),
            )
            if next_size == (width, height):
                return last
            width, height = next_size
