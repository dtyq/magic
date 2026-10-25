"""Canvas 主文件和 sidecar 仓储实现。"""

from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from pathlib import Path
from typing import Awaitable, Callable, TypeVar, cast

from app.tools.canvas.domain.models import CanvasProject
from app.tools.canvas.infrastructure.persistence.canvas_codec import CanvasCodec
from app.tools.canvas.infrastructure.persistence.canvas_main_file_sanitizer import CanvasMainFileSanitizer
from app.tools.canvas.infrastructure.persistence.canvas_repository_interface import (
    CanvasRepositoryInterface,
    RollbackCallback,
)
from app.tools.canvas.infrastructure.persistence.content_metadata_service import (
    RUNTIME_METADATA_KEY,
    RUNTIME_SIDECAR_FILENAME,
    ContentMetadataService,
)
from app.tools.canvas.infrastructure.persistence.element_details_codec import ElementDetailsCodec
from app.tools.canvas.infrastructure.workspace import CanvasWorkspaceDirectoryManager
from app.tools.canvas.repository.canvas_path_resolver import CanvasPathResolver
from app.utils.async_file_utils import (
    async_exists,
    async_read_bytes,
    async_read_text,
    async_unlink,
    async_write_bytes,
    async_write_text_with_retry,
)

T = TypeVar("T")

class CanvasRepository(CanvasRepositoryInterface):
    """负责 Canvas 主文件和 sidecar 的读取、写入与项目级锁。"""

    _locks: defaultdict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    def __init__(self, workspace: Path):
        """初始化工作区级仓储。"""
        self._workspace = workspace
        self._main_file_sanitizer = CanvasMainFileSanitizer()
        self._workspace_directories = CanvasWorkspaceDirectoryManager(workspace)

    @property
    def workspace(self) -> Path:
        """基础工作区路径；构造时注入，只读。"""
        return self._workspace

    async def initialize(self, project_path: str) -> tuple[Path, bool]:
        """创建空项目；已存在合法项目时返回未修改状态。"""
        path = CanvasPathResolver.resolve(self.workspace, project_path)
        await self._workspace_directories.ensure_project(project_path)
        project_file = path / "magic.project.js"
        if await async_exists(project_file):
            await self.read(project_path)
            return path, False
        await self._write_text(
            project_file,
            CanvasCodec.encode(CanvasCodec.empty_project(path.name)),
            content_validator=self._is_valid_main_file,
        )
        return path, True

    async def read(self, project_path: str) -> CanvasProject:
        """读取并校验当前项目。"""
        path = CanvasPathResolver.resolve(self.workspace, project_path)
        project_file = path / "magic.project.js"
        if not await async_exists(project_file):
            raise FileNotFoundError("PROJECT_NOT_FOUND")
        await self._workspace_directories.ensure_media_directories(project_path)
        return CanvasCodec.decode(await async_read_text(project_file, encoding="utf-8"))

    async def transaction(
        self,
        project_path: str,
        mutator: Callable[[CanvasProject], T | Awaitable[T]],
    ) -> T:
        """在项目锁内读取、修改、校验并写回主文件。"""
        path = CanvasPathResolver.resolve(self.workspace, project_path)
        lock = self._locks[str(path)]
        async with lock:
            project = await self.read(project_path)
            result = mutator(project)
            if asyncio.iscoroutine(result):
                result = await result
            project.canvas.validate()
            await self._write(path, project)
            return cast(T, result)

    async def transaction_with_sidecar(
        self,
        project_path: str,
        mutator: Callable[[CanvasProject, dict], tuple[T, dict] | Awaitable[tuple[T, dict]]],
        filename: str = "element-details.json",
        on_rollback: RollbackCallback | None = None,
    ) -> T:
        """在同一项目锁内协调主文件和 sidecar 写入。

        两个文件无法由普通文件系统提供真正的跨文件事务，因此这里使用临时文件、
        顺序替换和失败回滚，避免把半完成的结构暴露给后续 Canvas 调用。
        """
        path = CanvasPathResolver.resolve(self.workspace, project_path)
        lock = self._locks[str(path)]
        async with lock:
            try:
                project = await self.read(project_path)
                sidecar = await self._read_sidecar_strict(path / filename)
                runtime_sidecar = {}
                if filename == "element-details.json":
                    runtime_sidecar = await self._read_sidecar_strict(
                        path / RUNTIME_SIDECAR_FILENAME
                    )
                    ContentMetadataService.split_legacy_metadata(sidecar, runtime_sidecar)
                    sidecar[RUNTIME_METADATA_KEY] = runtime_sidecar
                if filename != "element-details-user.json":
                    await self._read_sidecar_strict(path / "element-details-user.json")
                result = mutator(project, sidecar)
                if asyncio.iscoroutine(result):
                    result = await result
                if not isinstance(result, tuple) or len(result) != 2:
                    raise TypeError("transaction_with_sidecar mutator must return (result, sidecar)")
                value, updated_sidecar = result
                project.canvas.validate()
                if filename == "element-details.json":
                    updated_sidecar = self._main_file_sanitizer.synchronize_sidecar(project, updated_sidecar)
                await self._write_bundle(path, project, updated_sidecar, filename)
                return value
            except BaseException as error:
                if on_rollback is not None:
                    try:
                        rollback = on_rollback()
                        if asyncio.iscoroutine(rollback):
                            await rollback
                    except BaseException as rollback_error:
                        error.add_note(f"Canvas transaction resource rollback failed: {rollback_error}")
                raise

    async def _write(self, path: Path, project: CanvasProject) -> None:
        """写入主文件并等待 MagicFS 返回合法内容。"""
        encoded = CanvasCodec.encode(self._main_file_sanitizer.sanitize(project))
        await self._write_text(
            path / "magic.project.js",
            encoded,
            content_validator=self._is_valid_main_file,
        )

    async def read_sidecar(self, project_path: str, filename: str = "element-details.json") -> dict:
        """读取可选 sidecar；不存在或非法时返回空对象。"""
        project_root = CanvasPathResolver.resolve(self.workspace, project_path)
        value = await self._read_sidecar_strict(project_root / filename, missing_ok=True)
        if filename == "element-details.json":
            runtime = await self._read_sidecar_strict(
                project_root / RUNTIME_SIDECAR_FILENAME,
                missing_ok=True,
            )
            ContentMetadataService.split_legacy_metadata(value, runtime)
        return value

    async def read_sidecar_runtime(self, project_path: str) -> dict:
        """读取后端生成运行态 sidecar。"""
        project_root = CanvasPathResolver.resolve(self.workspace, project_path)
        runtime = await self._read_sidecar_strict(
            project_root / RUNTIME_SIDECAR_FILENAME,
            missing_ok=True,
        )
        legacy = await self._read_sidecar_strict(project_root / "element-details.json", missing_ok=True)
        ContentMetadataService.split_legacy_metadata(legacy, runtime)
        return runtime

    async def write_sidecar(self, project_path: str, data: dict, filename: str = "element-details.json") -> None:
        """原子写入 Canvas 侧车元数据，不把内部字段写入主协议。"""
        path = CanvasPathResolver.resolve(self.workspace, project_path) / filename
        if filename == "element-details.json":
            ElementDetailsCodec.validate_public(data)
        else:
            ElementDetailsCodec.validate(data)
        await self._write_text(
            path,
            json.dumps(data, ensure_ascii=False, indent=2),
            content_validator=(
                self._is_valid_public_sidecar
                if filename == "element-details.json"
                else self._is_valid_runtime_sidecar
            ),
        )

    async def _read_sidecar_strict(self, path: Path, missing_ok: bool = True) -> dict:
        """严格读取 sidecar，损坏或非对象结构不静默覆盖。"""
        if not await async_exists(path):
            if missing_ok:
                return {}
            raise ValueError("INVALID_ELEMENT_DETAILS")
        try:
            data = await async_read_text(path, encoding="utf-8")
            value = json.loads(data)
        except (OSError, json.JSONDecodeError) as exc:
            raise ValueError("INVALID_ELEMENT_DETAILS") from exc
        if not isinstance(value, dict):
            raise ValueError("INVALID_ELEMENT_DETAILS")
        return ElementDetailsCodec.validate(value)

    async def _write_bundle(
        self, path: Path, project: CanvasProject, sidecar: dict, filename: str
    ) -> None:
        """直接写入主文件和 sidecar，并在失败时恢复已有内容。"""
        project_file = path / "magic.project.js"
        sidecar_file = path / filename
        runtime_file = path / RUNTIME_SIDECAR_FILENAME
        encoded = CanvasCodec.encode(self._main_file_sanitizer.sanitize(project))
        runtime_sidecar = sidecar.pop(RUNTIME_METADATA_KEY, {}) if filename == "element-details.json" else {}
        if filename == "element-details.json":
            ElementDetailsCodec.validate_public(sidecar)
        else:
            ElementDetailsCodec.validate(sidecar)
        if filename == "element-details.json":
            ElementDetailsCodec.validate(runtime_sidecar)
        sidecar_text = json.dumps(sidecar, ensure_ascii=False, indent=2)
        runtime_text = json.dumps(runtime_sidecar, ensure_ascii=False, indent=2)
        backups: dict[Path, bytes | None] = {}
        try:
            targets = [(project_file, encoded), (sidecar_file, sidecar_text)]
            if filename == "element-details.json":
                targets.append((runtime_file, runtime_text))
            for target, _ in targets:
                backups[target] = await async_read_bytes(target) if await async_exists(target) else None
            for target, content in targets:
                if target == project_file:
                    validator = self._is_valid_main_file
                elif target == sidecar_file:
                    validator = (
                        self._is_valid_public_sidecar
                        if filename == "element-details.json"
                        else self._is_valid_runtime_sidecar
                    )
                else:
                    validator = self._is_valid_runtime_sidecar
                await self._write_text(target, content, content_validator=validator)
            persisted_project = await async_read_text(project_file, encoding="utf-8")
            CanvasCodec.decode(persisted_project)
            persisted_sidecar = json.loads(await async_read_text(sidecar_file, encoding="utf-8"))
            if filename == "element-details.json":
                ElementDetailsCodec.validate_public(persisted_sidecar)
            else:
                ElementDetailsCodec.validate(persisted_sidecar)
            if filename == "element-details.json":
                persisted_runtime = json.loads(await async_read_text(runtime_file, encoding="utf-8"))
                ElementDetailsCodec.validate(persisted_runtime)
        except Exception:
            for target, original in backups.items():
                try:
                    if original is None:
                        await async_unlink(target)
                    else:
                        await async_write_bytes(target, original)
                except OSError:
                    pass
            raise
    @staticmethod
    async def _write_text(
        target: Path,
        content: str,
        content_validator: Callable[[str], bool] | None = None,
    ) -> None:
        """直接写入单个 Canvas 文件并等待 MagicFS 可见性稳定。"""
        def verify_persisted_content(value: str) -> bool:
            """同时确认读取内容不是旧版本且满足结构校验。"""
            if value != content:
                return False
            return content_validator is None or content_validator(value)

        await async_write_text_with_retry(
            target,
            content,
            encoding="utf-8",
            max_retries=5,
            retry_delay=0.2,
            content_validator=verify_persisted_content,
        )

    @staticmethod
    def _is_valid_main_file(content: str) -> bool:
        """校验主文件内容仍是合法 Canvas 文档。"""
        try:
            CanvasCodec.decode(content)
        except (TypeError, ValueError, json.JSONDecodeError):
            return False
        return True

    @staticmethod
    def _is_valid_sidecar(content: str, *, public: bool) -> bool:
        """校验 sidecar 内容是合法对象并符合对应公开边界。"""
        try:
            value = json.loads(content)
            if not isinstance(value, dict):
                return False
            if public:
                ElementDetailsCodec.validate_public(value)
            else:
                ElementDetailsCodec.validate(value)
        except (TypeError, ValueError, json.JSONDecodeError):
            return False
        return True

    @staticmethod
    def _is_valid_public_sidecar(content: str) -> bool:
        """校验公开 sidecar 文本。"""
        return CanvasRepository._is_valid_sidecar(content, public=True)

    @staticmethod
    def _is_valid_runtime_sidecar(content: str) -> bool:
        """校验运行态 sidecar 文本。"""
        return CanvasRepository._is_valid_sidecar(content, public=False)
