"""原生视觉图片 Base64 的 `.runtime` 文件缓存。

## 为什么需要它

同一张图会在不同 run、不同 Agent 实例之间被反复压缩成 Base64。
`LLMMessageRenderer` 的进程内缓存挂在 Agent 实例上，而实例每个 run 重建，
所以每个新任务引用到同一张图时都会重新付一次完整压缩代价
（实测一张 1280×1706 的 RGBA 图需要数秒到数分钟）。本模块把结果落到
`.runtime/native_visual_cache/`，跨进程复用，命中即直接返回，不再解码和编码。

## 命中层级

| 场景                    | 进程内缓存   | 文件缓存 | 需要重新压缩 |
|-------------------------|-------------|---------|-------------|
| 同一次 run 内重复渲染    | 命中（最省） | —       | 否          |
| 新 run / 新 Agent 实例   | 未命中       | 命中     | 否          |
| 图片内容被修改           | 未命中       | 未命中   | 是          |
| 压缩参数变化             | 未命中       | 未命中   | 是          |

例：同一张图先按 quality=90 压缩，再按 quality=50 压缩，两次的缓存项不同，各存一份。

## 存放位置与清理

目录 `.runtime/native_visual_cache/`，一个缓存项一个 JSON 文件，属于"直接文件"形态，
由通用 `evict_runtime_files()` 按 age/count/bytes 淘汰，写入后机会式触发清理。
策略数值来自 `runtime_cleanup.native_visual_cache`。

## 边界

缓存只是加速手段，不是业务依赖：`.runtime` 不可用、文件损坏、权限不足时都必须
静默降级为"未命中"，由调用方照常走压缩流程，不能让缓存故障影响图片处理结果。
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass
from pathlib import Path

from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.utils.async_file_utils import async_chmod, async_try_read_json, async_write_json
from app.utils.runtime_storage import (
    RuntimeEvictionPolicy,
    ensure_runtime_directory,
    evict_runtime_files,
    get_runtime_config_int,
    get_runtime_config_size_bytes,
    trigger_opportunistic_cleanup,
)

logger = get_logger(__name__)

CACHE_VERSION = 1
CACHE_DIRECTORY_NAME = "native_visual_cache"
CACHE_FILE_SUFFIX = ".json"
CACHE_CLEANUP_KEY = "native_visual_cache"
CACHE_FILE_MODE = 0o600


@dataclass(frozen=True, slots=True)
class ImageBase64CacheKey:
    """定位一次图片 Base64 结果的全部输入。

    任一字段变化都视为不同缓存项：图片被替换（mtime/size 变）、压缩参数变化
    （quality / max_dimension / max_size_bytes 变）都会自然 miss，不需要额外失效逻辑。
    """

    source_path: str
    source_mtime_ns: int
    source_size: int
    quality: int
    max_dimension: int
    max_size_bytes: int

    def to_payload(self) -> dict[str, object]:
        """序列化为 JSON 字段，同时用于文件名摘要和读回校验。"""
        return {
            "source_path": self.source_path,
            "source_mtime_ns": self.source_mtime_ns,
            "source_size": self.source_size,
            "quality": self.quality,
            "max_dimension": self.max_dimension,
            "max_size_bytes": self.max_size_bytes,
        }

    def digest(self) -> str:
        """对规范化后的键做摘要，得到稳定的缓存文件名。"""
        encoded = json.dumps(self.to_payload(), sort_keys=True, ensure_ascii=False).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()


@dataclass(frozen=True, slots=True)
class CachedImageBase64:
    """命中缓存时返回的结果，字段与一次真实压缩的产物保持一致。"""

    data_url: str
    width: int
    height: int
    output_size: int


class ImageBase64Cache:
    """把图片 Base64 结果持久化到 `.runtime`，供后续 run 直接复用。"""

    def __init__(self, cache_dir: Path | None = None) -> None:
        """初始化缓存；显式传入目录用于测试，否则使用 `.runtime` 下的默认目录。"""
        if cache_dir is not None:
            self._cache_dir: Path | None = Path(cache_dir)
            return

        try:
            self._cache_dir = Path(PathManager.get_runtime_dir()) / CACHE_DIRECTORY_NAME
        except Exception as error:
            # `.runtime` 不可用时整体关闭缓存，调用方退化为每次重新压缩。
            logger.warning(f"图片 Base64 缓存不可用，已关闭: {error}")
            self._cache_dir = None

    @property
    def enabled(self) -> bool:
        """缓存是否可用；关闭时 get/put 都是无副作用的空操作。"""
        return self._cache_dir is not None

    @property
    def cache_dir(self) -> Path | None:
        """缓存目录，关闭时为 None。"""
        return self._cache_dir

    async def get(self, key: ImageBase64CacheKey) -> CachedImageBase64 | None:
        """读取缓存项；未命中、损坏或版本不符都返回 None。"""
        if self._cache_dir is None:
            return None

        payload = await async_try_read_json(self._cache_dir / f"{key.digest()}{CACHE_FILE_SUFFIX}")
        if not isinstance(payload, dict):
            return None
        if payload.get("version") != CACHE_VERSION:
            return None
        # 摘要相同的两个键理论上可能碰撞，读回时再比对一次完整键，避免串图。
        if payload.get("key") != key.to_payload():
            return None

        data_url = payload.get("data_url")
        width = payload.get("width")
        height = payload.get("height")
        output_size = payload.get("output_size")
        if not isinstance(data_url, str) or not data_url:
            return None
        if not all(isinstance(value, int) and not isinstance(value, bool) for value in (width, height, output_size)):
            return None

        return CachedImageBase64(
            data_url=data_url,
            width=width,
            height=height,
            output_size=output_size,
        )

    async def put(self, key: ImageBase64CacheKey, value: CachedImageBase64) -> None:
        """写入缓存项；写入失败只降低复用率，不影响本次结果。"""
        if self._cache_dir is None:
            return

        try:
            await ensure_runtime_directory(self._cache_dir)
            path = self._cache_dir / f"{key.digest()}{CACHE_FILE_SUFFIX}"
            await async_write_json(
                path,
                {
                    "version": CACHE_VERSION,
                    "key": key.to_payload(),
                    "data_url": value.data_url,
                    "width": value.width,
                    "height": value.height,
                    "output_size": value.output_size,
                    "created_at": time.time(),
                },
            )
            await async_chmod(path, CACHE_FILE_MODE)
        except Exception as error:
            logger.warning(f"写入图片 Base64 缓存失败: {error}")
            return

        trigger_opportunistic_cleanup(CACHE_CLEANUP_KEY, self.evict_expired_entries)

    async def evict_expired_entries(self) -> None:
        """按 `runtime_cleanup.native_visual_cache` 的 age/count/bytes 策略淘汰旧缓存项。"""
        if self._cache_dir is None:
            return

        policy = RuntimeEvictionPolicy(
            max_entries=get_runtime_config_int("runtime_cleanup.native_visual_cache.max_file_count"),
            target_entries=get_runtime_config_int("runtime_cleanup.native_visual_cache.target_file_count"),
            max_total_bytes=get_runtime_config_size_bytes("runtime_cleanup.native_visual_cache.max_total_size"),
            target_total_bytes=get_runtime_config_size_bytes("runtime_cleanup.native_visual_cache.target_total_size"),
            max_age_seconds=get_runtime_config_int("runtime_cleanup.native_visual_cache.max_age_days") * 24 * 60 * 60,
        )
        await evict_runtime_files(
            self._cache_dir,
            policy=policy,
            suffixes=(CACHE_FILE_SUFFIX,),
        )


__all__ = [
    "CACHE_DIRECTORY_NAME",
    "CachedImageBase64",
    "ImageBase64Cache",
    "ImageBase64CacheKey",
]
