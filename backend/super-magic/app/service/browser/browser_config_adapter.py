"""把 Super Magic 配置转换为独立 magic_use SDK 配置。"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Mapping, Sequence
from dataclasses import replace
from pathlib import Path
from urllib.parse import urlsplit

import aiohttp

from agentlang.config.config import config
from agentlang.environment import Environment
from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.utils.async_file_utils import (
    async_close_fd,
    async_exists,
    async_is_dir,
    async_mkdir,
    async_mkstemp,
    async_read_text,
    async_realpath,
    async_rename,
    async_scandir,
    async_unlink,
    async_write_bytes,
)
from magic_use.config import (
    BrowserScreenshotConfig,
    BrowserContextConfig,
    BrowserLifecycleConfig,
    BrowserResourceLimits,
    BrowserRuntimeConfig,
    BrowserScriptConfig,
    BrowserTimeouts,
    LocalPlaywrightConfig,
    ProxyConfig,
    PureConfig,
    RemotePlaywrightConfig,
    ElementScanConfig,
)
from magic_use.models import BrowserBackendKind, BrowserName
from magic_use.userscripts import Userscript, parse_userscript

logger = get_logger(__name__)

_STORAGE_STATE_DOWNLOAD_TIMEOUT_SECONDS = 30
_STORAGE_STATE_MAX_BYTES = 16 * 1024 * 1024


class BrowserConfigAdapter:
    """从宿主配置生成不含 Super Magic 依赖的 SDK 配置。"""

    _storage_state_lock = asyncio.Lock()

    @classmethod
    async def build(
        cls,
        workspace_dir: str,
        backend_override: BrowserBackendKind | None = None,
        host_scope: str | None = None,
    ) -> BrowserRuntimeConfig:
        backend = backend_override or cls._backend()
        remote_config = cls._remote_config() if backend is BrowserBackendKind.REMOTE_PLAYWRIGHT else None
        resolved_host_scope = await async_realpath(host_scope or workspace_dir)
        storage_state_path = PathManager.get_browser_storage_state_file()
        storage_state = await cls._prepare_storage_state(storage_state_path)
        userscripts = await cls._load_userscripts()
        return BrowserRuntimeConfig(
            host_scope=str(resolved_host_scope),
            backend=backend,
            browser_name=cls._browser_name(),
            local_playwright=LocalPlaywrightConfig(
                headless=cls._bool("browser.headless", True),
                browser_args=cls._strings(
                    "browser.browser_args",
                    ("--disable-blink-features=AutomationControlled",),
                ),
                downloads_path=None,
                proxy=cls._proxy(),
            ),
            remote_playwright=remote_config,
            context=BrowserContextConfig(
                viewport_width=cls._int("browser.viewport_width", 1280),
                viewport_height=cls._int("browser.viewport_height", 1940),
                device_scale_factor=cls._float("browser.device_scale_factor", 2),
                user_agent=cls._optional_string("browser.user_agent"),
                extra_headers=cls._string_mapping("browser.extra_headers"),
                locale=cls._string("browser.locale", "zh-CN"),
                timezone_id=cls._string("browser.timezone_id", "Asia/Shanghai"),
                permissions=cls._strings("browser.permissions", ("geolocation", "notifications")),
                geolocation=cls._geolocation(),
                storage_state=storage_state,
                storage_state_path=str(storage_state_path),
                bypass_csp=cls._bool("browser.bypass_csp", True),
                ignore_https_errors=cls._bool("browser.ignore_https_errors", True),
                accept_downloads=cls._bool("browser.accept_downloads", True),
            ),
            scripts=BrowserScriptConfig(
                pure=PureConfig(
                    enabled=cls._bool("browser.scripts.pure_enabled", True),
                    disabled_domains=frozenset(cls._strings("browser.scripts.pure_disabled_domains")),
                    session_override=None,
                ),
                mask_enabled=cls._bool("browser.scripts.mask_enabled", True),
                lens_enabled=cls._bool("browser.scripts.lens_enabled", True),
                marker_enabled=cls._bool("browser.scripts.marker_enabled", True),
                userscripts=userscripts,
            ),
            elements=ElementScanConfig(
                max_nodes=cls._int("browser.elements.max_nodes", 500),
                max_depth=cls._int("browser.elements.max_depth", 30),
            ),
            screenshot=cls.screenshot_config(),
            timeouts=BrowserTimeouts(
                default_ms=cls._float("browser.default_timeout", 30_000),
                navigation_ms=cls._float("browser.navigation_timeout", 30_000),
                script_ms=cls._float("browser.script_timeout", 10_000),
                action_settle_ms=cls._float("browser.action_settle_timeout", 150),
                load_timeout_ms=cls._float("browser.load_timeout", 3_000),
            ),
            lifecycle=BrowserLifecycleConfig(
                page_idle_seconds=cls._float("browser.lifecycle.page_idle_seconds", 600),
                page_keep_alive_max_seconds=cls._float(
                    "browser.lifecycle.page_keep_alive_max_seconds",
                    3_600,
                ),
                context_idle_seconds=cls._float("browser.lifecycle.context_idle_seconds", 120),
                host_idle_seconds=cls._float("browser.lifecycle.host_idle_seconds", 120),
                sweep_interval_seconds=cls._float("browser.lifecycle.sweep_interval_seconds", 5),
            ),
            resources=BrowserResourceLimits(
                soft_contexts=cls._int("browser.resources.soft_contexts", 8),
                hard_contexts=cls._int("browser.resources.hard_contexts", 12),
                soft_pages=cls._int("browser.resources.soft_pages", 24),
                hard_pages=cls._int("browser.resources.hard_pages", 32),
            ),
            event_buffer_size=cls._int("browser.event_buffer_size", 1_000),
            diagnostic_buffer_size=cls._int("browser.diagnostic_buffer_size", 1_000),
        )

    @classmethod
    def screenshot_config(cls) -> BrowserScreenshotConfig:
        return BrowserScreenshotConfig(
            webp_quality=cls._int("browser.screenshot.webp_quality", 82),
            webp_min_quality=cls._int("browser.screenshot.webp_min_quality", 58),
            webp_quality_step=cls._int("browser.screenshot.webp_quality_step", 6),
            target_bpp=cls._float("browser.screenshot.target_bpp", 0.5),
            min_bytes=cls._int("browser.screenshot.min_bytes", 128 * 1024),
            max_bytes=cls._int("browser.screenshot.max_bytes", 256 * 1024),
            max_width=cls._int("browser.screenshot.max_width", 1_600),
            max_height_ratio=cls._float("browser.screenshot.max_height_ratio", 1.6),
            resize_step=cls._float("browser.screenshot.resize_step", 0.85),
            min_dimension=cls._int("browser.screenshot.min_dimension", 1_280),
        )

    @classmethod
    async def _load_userscripts(cls) -> tuple[Userscript, ...]:
        configured_directories = cls._strings(
            "browser.scripts.userscript_directories",
            ("magic_use/userscripts/scripts",),
        )
        project_root = (await async_realpath(Path(__file__))).parents[3]
        script_files: list[Path] = []
        for configured_directory in configured_directories:
            directory = Path(configured_directory).expanduser()
            if not directory.is_absolute():
                directory = project_root / directory
            if not await async_exists(directory) or not await async_is_dir(directory):
                continue
            script_files.extend(await cls._scan_userscript_files(directory))

        scripts: list[Userscript] = []
        for script_path in sorted(script_files):
            try:
                scripts.append(
                    parse_userscript(
                        await async_read_text(script_path),
                        fallback_name=script_path.stem,
                    )
                )
            except (OSError, ValueError) as error:
                logger.warning("Skipping invalid userscript %s: %s", script_path, error)
        return tuple(scripts)

    @classmethod
    async def _scan_userscript_files(cls, directory: Path) -> list[Path]:
        result: list[Path] = []
        pending = [directory]
        while pending:
            current = pending.pop()
            for entry in await async_scandir(current):
                path = Path(entry.path)
                if entry.is_dir(follow_symlinks=False):
                    pending.append(path)
                elif entry.is_file(follow_symlinks=False) and path.suffix.lower() == ".js":
                    result.append(path)
        return result

    @classmethod
    async def build_playwright(
        cls,
        workspace_dir: str,
        *,
        viewport_width: int | None = None,
        viewport_height: int | None = None,
        device_scale_factor: float | None = None,
    ) -> BrowserRuntimeConfig:
        """为内部渲染、转换和抓取任务创建 Playwright 配置，不使用用户 Chrome session。"""
        backend = (
            BrowserBackendKind.LOCAL_PLAYWRIGHT
            if Environment.is_local()
            else BrowserBackendKind.REMOTE_PLAYWRIGHT
        )
        runtime_config = await cls.build(
            workspace_dir,
            backend_override=backend,
            host_scope=str(PathManager.get_workspace_dir()),
        )
        if viewport_width is None and viewport_height is None and device_scale_factor is None:
            return runtime_config
        return replace(
            runtime_config,
            context=replace(
                runtime_config.context,
                viewport_width=(
                    viewport_width if viewport_width is not None else runtime_config.context.viewport_width
                ),
                viewport_height=(
                    viewport_height if viewport_height is not None else runtime_config.context.viewport_height
                ),
                device_scale_factor=(
                    device_scale_factor
                    if device_scale_factor is not None
                    else runtime_config.context.device_scale_factor
                ),
            ),
        )

    @classmethod
    async def _prepare_storage_state(cls, storage_state_path: Path) -> str | None:
        if await async_exists(storage_state_path):
            return str(storage_state_path)

        template_url = cls._optional_string("browser.storage_state_template_url")
        if template_url is None:
            return None
        if urlsplit(template_url).scheme not in {"http", "https"}:
            raise ValueError("browser.storage_state_template_url must use http:// or https://")

        async with cls._storage_state_lock:
            if await async_exists(storage_state_path):
                return str(storage_state_path)
            try:
                content = await cls._download_storage_state(template_url)
                decoded = json.loads(content)
                if not isinstance(decoded, dict):
                    raise ValueError("Browser storage state template must be a JSON object")
                await async_mkdir(storage_state_path.parent, parents=True, exist_ok=True)
                fd, temporary_path = await async_mkstemp(
                    suffix=".json",
                    prefix="storage-state-",
                    dir=storage_state_path.parent,
                )
                await async_close_fd(fd)
                try:
                    await async_write_bytes(temporary_path, content)
                    await async_rename(temporary_path, storage_state_path)
                finally:
                    await async_unlink(temporary_path)
                return str(storage_state_path)
            except Exception as error:
                logger.warning("下载浏览器存储状态模板失败，将使用空状态启动: %s", error)
                return None

    @staticmethod
    async def _download_storage_state(template_url: str) -> bytes:
        timeout = aiohttp.ClientTimeout(total=_STORAGE_STATE_DOWNLOAD_TIMEOUT_SECONDS)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(template_url) as response:
                response.raise_for_status()
                if response.content_length is not None and response.content_length > _STORAGE_STATE_MAX_BYTES:
                    raise ValueError("Browser storage state template exceeds the size limit")
                content = bytearray()
                async for chunk in response.content.iter_chunked(64 * 1024):
                    content.extend(chunk)
                    if len(content) > _STORAGE_STATE_MAX_BYTES:
                        raise ValueError("Browser storage state template exceeds the size limit")
        return bytes(content)

    @classmethod
    def _backend(cls) -> BrowserBackendKind:
        configured = cls._optional_string("browser.backend")
        if configured is not None:
            return BrowserBackendKind(configured)

        return (
            BrowserBackendKind.LOCAL_PLAYWRIGHT
            if Environment.is_local()
            else BrowserBackendKind.REMOTE_PLAYWRIGHT
        )

    @classmethod
    def _browser_name(cls) -> BrowserName:
        return BrowserName(cls._string("browser.browser_type", BrowserName.CHROMIUM.value))

    @classmethod
    def _remote_config(cls) -> RemotePlaywrightConfig:
        health_timeout = cls._float("browser.server_health_check_timeout", 60)
        health_interval = cls._float("browser.server_health_check_interval", 1)
        return RemotePlaywrightConfig(
            endpoint=cls._string("browser.browser_server_url", "ws://127.0.0.1:3000"),
            health_check_timeout_seconds=health_timeout,
            health_check_interval_seconds=health_interval,
            connect_timeout_ms=cls._float("browser.server_connect_timeout", 30_000),
            retry_timeout_seconds=health_timeout,
            retry_interval_seconds=health_interval,
        )

    @classmethod
    def _proxy(cls) -> ProxyConfig | None:
        server = cls._optional_string("browser.proxy.server")
        if server is None:
            return None
        return ProxyConfig(
            server=server,
            username=cls._optional_string("browser.proxy.username"),
            password=cls._optional_string("browser.proxy.password"),
            bypass=cls._strings("browser.proxy.bypass"),
        )

    @classmethod
    def _geolocation(cls) -> tuple[float, float] | None:
        value = config.get("browser.geolocation")
        if value is None:
            return (31.230416, 121.473701)
        if not isinstance(value, Mapping):
            raise ValueError("browser.geolocation must be a mapping")
        latitude = value.get("latitude")
        longitude = value.get("longitude")
        if not isinstance(latitude, (int, float)) or not isinstance(longitude, (int, float)):
            raise ValueError("browser.geolocation requires numeric latitude and longitude")
        return float(latitude), float(longitude)

    @staticmethod
    def _optional_string(key: str) -> str | None:
        value = config.get(key)
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError(f"{key} must be a string")
        normalized = value.strip()
        return normalized or None

    @classmethod
    def _string(cls, key: str, default: str) -> str:
        return cls._optional_string(key) or default

    @staticmethod
    def _bool(key: str, default: bool) -> bool:
        value = config.get(key)
        if value is None:
            return default
        if not isinstance(value, bool):
            raise ValueError(f"{key} must be a boolean")
        return value

    @staticmethod
    def _int(key: str, default: int) -> int:
        value = config.get(key)
        if value is None:
            return default
        if not isinstance(value, int) or isinstance(value, bool):
            raise ValueError(f"{key} must be an integer")
        return value

    @staticmethod
    def _float(key: str, default: float) -> float:
        value = config.get(key)
        if value is None:
            return default
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise ValueError(f"{key} must be numeric")
        return float(value)

    @staticmethod
    def _strings(key: str, default: tuple[str, ...] = ()) -> tuple[str, ...]:
        value = config.get(key)
        if value is None:
            return default
        if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
            raise ValueError(f"{key} must be a string list")
        if not all(isinstance(item, str) for item in value):
            raise ValueError(f"{key} must contain only strings")
        return tuple(item for item in value if item)

    @staticmethod
    def _string_mapping(key: str) -> dict[str, str]:
        value = config.get(key)
        if value is None:
            return {}
        if not isinstance(value, Mapping):
            raise ValueError(f"{key} must be a mapping")
        result: dict[str, str] = {}
        for name, item in value.items():
            if not isinstance(name, str) or not isinstance(item, str):
                raise ValueError(f"{key} must contain string keys and values")
            result[name] = item
        return result
