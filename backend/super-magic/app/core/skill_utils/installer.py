"""InstallService：Skill 安装/升级统一入口

所有来源的 skill 安装都通过此服务落盘到 .workspace/.magic/skills/。
支持单条和批量安装，原子替换目录，失败时自动回滚。
"""
from __future__ import annotations

import asyncio
import random
import string
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from agentlang.logger import get_logger
from app.core.skill_utils.constants import dynamic_skill_install_lock, get_skillhub_install_dir
from app.utils.async_file_utils import (
    async_copytree, async_mkdir, async_rmtree, async_exists, async_is_symlink,
    async_iterdir, async_is_dir, async_stat, async_rename, async_replace,
    async_read_text, async_write_text, async_write_json, async_read_json,
)
from app.core.skill_utils.manifest import SkillManifest, invalidate_cache, MANIFEST_FILENAME
from app.core.skill_utils.providers.base import SkillProviderId, SkillProvider
from app.core.skill_utils.version import version_eq

logger = get_logger(__name__)

# 单 skill 最大体积（50MB）和文件数
MAX_SIZE_BYTES = 50 * 1024 * 1024
MAX_FILES = 2000


@dataclass
class SkillRef:
    """简化版 skill 引用（供 install_skills 工具使用）"""

    provider: str           # SkillProviderId.value
    id: str                 # provider 内唯一标识
    mode: Literal["install", "upgrade"] = "install"
    version: str | None = None


@dataclass
class InstallResult:
    """单条安装结果"""

    ok: bool
    name: str
    provider: str
    skill_id: str
    mode: str
    version: str = ""
    path: str = ""
    message: str = ""
    status: str = ""   # "installed" | "upgraded" | "already_installed" | "failed" | "provider_unavailable"


@dataclass
class InstallBatchResult:
    """批量安装结果"""

    items: list[InstallResult] = field(default_factory=list)

    @property
    def ok_count(self) -> int:
        return sum(1 for r in self.items if r.ok)

    @property
    def failed_count(self) -> int:
        return sum(1 for r in self.items if not r.ok)


def _rand_suffix(n: int = 8) -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


async def _validate_fetched_skill(local_path: Path) -> None:
    if not await async_exists(local_path / "SKILL.md"):
        raise ValueError("Skill package is missing SKILL.md.")
    total_size = total_files = 0
    pending = [local_path]
    while pending:
        for entry in await async_iterdir(pending.pop()):
            if await async_is_symlink(entry):
                raise ValueError("Skill package contains a symbolic link.")
            total_files += 1
            if await async_is_dir(entry):
                pending.append(entry)
            else:
                total_size += (await async_stat(entry)).st_size
            if total_size > MAX_SIZE_BYTES or total_files > MAX_FILES:
                raise ValueError("Skill package exceeds size or entry limits.")


class InstallService:
    """Skill 安装服务（进程级无状态，可直接实例化使用）"""

    def __init__(self, target_dir: Path | None = None, *, installed_by: str = "install_skills") -> None:
        self._installed_by = installed_by
        self._target_dir = target_dir  # None 表示使用默认 .workspace/.magic/skills/

    def _get_target_dir(self) -> Path:
        return self._target_dir or get_skillhub_install_dir()

    async def install(self, ref: SkillRef, *, provider: SkillProvider | None = None) -> list[InstallResult]:
        """安装或升级单个 ref，返回结果列表（多 skill 仓库时含多条）。"""
        from app.core.skill_utils.providers.registry import get_registry

        provider_id_str = ref.provider
        skill_id = ref.id
        mode = ref.mode

        # 1. 获取 provider
        try:
            if provider is None:
                registry = get_registry()
                provider = registry.get(SkillProviderId(provider_id_str))
        except (KeyError, ValueError):
            return [InstallResult(
                ok=False, name="", provider=provider_id_str, skill_id=skill_id, mode=mode,
                message=f"未知 provider: {provider_id_str}",
                status="failed",
            )]

        if not provider.enabled:
            return [InstallResult(
                ok=False, name="", provider=provider_id_str, skill_id=skill_id, mode=mode,
                message=f"provider '{provider_id_str}' 不可用（CLI 未找到或已禁用）",
                status="provider_unavailable",
            )]

        # 2. 获取目标版本
        target_version = ref.version
        if mode == "upgrade" and not target_version:
            try:
                target_version = await provider.resolve_latest(skill_id)
            except Exception:
                pass  # 无法解析 latest 时继续，fetch 后从 manifest 补齐

        # 3. 检测是否已安装同版本（仅针对单 skill 场景的快速跳过优化）
        target_dir = self._get_target_dir()
        guessed_name = skill_id.rstrip("/").split("/")[-1]
        existing_dir = target_dir / guessed_name
        if await async_exists(existing_dir) and mode == "install":
            existing_manifest = None
            if await async_exists(existing_dir / MANIFEST_FILENAME):
                try:
                    existing_manifest = SkillManifest(**await async_read_json(existing_dir / MANIFEST_FILENAME))
                except (ValueError, TypeError, OSError):
                    pass
            if (
                existing_manifest
                and target_version
                and version_eq(existing_manifest.version, target_version)
            ):
                return [InstallResult(
                    ok=True, name=guessed_name, provider=provider_id_str, skill_id=skill_id,
                    mode=mode, version=existing_manifest.version,
                    path=str(existing_dir),
                    message="已安装相同版本，跳过",
                    status="already_installed",
                )]

        # 4. 确认性检查（已有目录 + install 模式）——多 skill 仓库时 guessed_name 可能不准，
        #    此处的快速返回只覆盖单 skill 情况；多 skill 情况由 _do_install_one 逐条拒绝覆盖
        if await async_exists(existing_dir) and mode == "install":
            return [InstallResult(
                ok=False, name=guessed_name, provider=provider_id_str, skill_id=skill_id,
                mode=mode, message=(
                    f"目录 '{guessed_name}' 已存在（{existing_dir}）。"
                    "如需重新安装，请先删除该目录后重试；如需升级，请使用 mode='upgrade'。"
                ),
                status="failed",
            )]

        # 5. 加锁并执行安装
        async with dynamic_skill_install_lock:
            return await self._do_install(
                provider, skill_id, target_version, mode, target_dir
            )

    async def _do_install(
        self,
        provider,
        skill_id: str,
        target_version: str | None,
        mode: str,
        target_dir: Path,
    ) -> list[InstallResult]:
        """调用 fetch_many 获取所有 skill，逐条安装并返回结果列表。"""
        provider_id_str = provider.id.value

        try:
            fetched_list = await provider.fetch_many(skill_id, version=target_version)
        except Exception as e:
            return [InstallResult(
                ok=False, name="", provider=provider_id_str, skill_id=skill_id, mode=mode,
                message=f"fetch 失败: {e}", status="failed",
            )]

        try:
            results: list[InstallResult] = []
            for fetched in fetched_list:
                result = await self._do_install_one(
                    provider_id_str, skill_id, target_version, mode, target_dir, fetched
                )
                results.append(result)
            return results
        finally:
            for fetched in fetched_list:
                await _cleanup_temp_parent(fetched.local_path)

    async def _do_install_one(
        self,
        provider_id_str: str,
        skill_id: str,
        target_version: str | None,
        mode: str,
        target_dir: Path,
        fetched,
    ) -> InstallResult:
        """将单个 FetchedSkill 落盘安装（staging → 原子替换）。"""
        from app.core.skill_utils.safe_download import validate_package_name

        local_path = fetched.local_path
        skill_name = fetched.install_name or await _read_skill_name(local_path) or local_path.name
        try:
            validate_package_name(skill_name)
            await _validate_fetched_skill(local_path)
        except ValueError as e:
            return InstallResult(ok=False, name=skill_name, provider=provider_id_str, skill_id=skill_id,
                                 mode=mode, message=str(e), status="failed")
        install_dir = target_dir / skill_name
        await async_mkdir(target_dir, parents=True, exist_ok=True)
        staging_dir = target_dir / f".staging-{skill_name}-{_rand_suffix()}"
        bak_dir = target_dir / f".{skill_name}.bak-{_rand_suffix()}"
        backed_up = False
        installed = False
        try:
            # install 模式绝不覆盖已存在目录（test_existing_directory_is_not_overwritten 锁定）：
            # 引用懒下载场景 name 与 code 可能不一致，覆盖会误伤目录里已有的其他 skill；
            # install_skills 侧如需重装/更新，按报错提示先删除目录或改用 mode="upgrade"
            if mode == "install" and await async_exists(install_dir):
                return InstallResult(ok=False, name=skill_name, provider=provider_id_str, skill_id=skill_id,
                                     mode=mode, message="Skill directory already exists.", status="failed")
            await async_copytree(local_path, staging_dir)
            await _fix_skill_name_in_md(staging_dir, skill_name)
            manifest = SkillManifest(
                name=skill_name, provider=provider_id_str, source_id=skill_id,
                version=fetched.version or target_version or "unknown",
                installed_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                source_url=fetched.source_url, installed_by=self._installed_by,
            )
            # staging 在网络文件系统上时写 manifest 可能失败；缺失只影响版本更新检查，不影响安装
            try:
                await async_write_json(staging_dir / MANIFEST_FILENAME, asdict(manifest))
            except Exception as e:
                logger.warning(f"写 manifest 到 staging 失败（不影响安装）: {e}")
            if await async_exists(install_dir):
                backup_task = asyncio.create_task(async_rename(install_dir, bak_dir))
                try:
                    await asyncio.shield(backup_task)
                except asyncio.CancelledError:
                    await backup_task
                    backed_up = True
                    raise
                backed_up = True
            commit_task = asyncio.create_task(async_replace(staging_dir, install_dir))
            try:
                await asyncio.shield(commit_task)
            except asyncio.CancelledError:
                await commit_task
                installed = True
                invalidate_cache(install_dir)
                raise
            installed = True
            invalidate_cache(install_dir)
            return InstallResult(
                ok=True, name=skill_name, provider=provider_id_str, skill_id=skill_id,
                mode=mode, version=manifest.version, path=str(install_dir),
                message=f"Installed skill: {skill_name} ({manifest.version})",
                status="upgraded" if mode == "upgrade" else "installed",
            )
        except Exception as e:
            return InstallResult(ok=False, name=skill_name, provider=provider_id_str, skill_id=skill_id,
                                 mode=mode, message=str(e), status="failed")
        finally:
            if backed_up and not installed:
                await async_rename(bak_dir, install_dir)
            if await async_exists(staging_dir):
                await async_rmtree(staging_dir)
            if installed and backed_up:
                await async_rmtree(bak_dir)

    async def install_many(
        self,
        refs: list[SkillRef],
        *,
        max_concurrency: int = 3,
    ) -> InstallBatchResult:
        """批量安装/升级，独立成败，不因单条失败而中止"""
        # 前置去重检查：同目标名冲突直接拒绝整批
        conflict = _detect_name_conflicts(refs)
        if conflict:
            return InstallBatchResult(items=[
                InstallResult(
                    ok=False, name="", provider=r.provider, skill_id=r.id, mode=r.mode,
                    message=f"批量冲突：检测到同名目标 '{conflict}'，请去重后重试",
                    status="failed",
                )
                for r in refs
            ])

        sem = asyncio.Semaphore(max_concurrency)

        async def _run(ref: SkillRef) -> list[InstallResult]:
            async with sem:
                return await self.install(ref)

        results_lists = await asyncio.gather(*[_run(r) for r in refs])
        # 展平：每个 ref 可能对应多条结果（多 skill 仓库）
        all_results = [item for sublist in results_lists for item in sublist]
        return InstallBatchResult(items=all_results)


# ── 辅助函数 ──────────────────────────────────────────────────────────────────


async def _read_skill_name(skill_dir: Path) -> str | None:
    from app.utils.async_file_utils import async_try_read_markdown
    markdown = await async_try_read_markdown(skill_dir / "SKILL.md")
    if markdown is None:
        return None
    # frontmatter 是合法 YAML 但不是 mapping（如手滑写成列表）时 meta 不是 dict，按无 name 处理
    meta = markdown.meta if isinstance(markdown.meta, dict) else {}
    name = meta.get("name")
    return name if isinstance(name, str) and name else None


async def _fix_skill_name_in_md(skill_dir: Path, expected_name: str) -> None:
    """若 SKILL.md frontmatter 中的 name 与安装目录名不一致，则原地修正。

    只做 name 行的最小改写（不重排 frontmatter、不丢注释）；
    第三方 skill 的 frontmatter 写法千奇百怪，解析/写回失败仅告警，不影响安装。
    """
    skill_md = skill_dir / "SKILL.md"
    try:
        content = await async_read_text(skill_md)
        if not content.startswith("---"):
            return
        end = content.find("\n---", 3)
        if end <= 0:
            return

        frontmatter = content[3:end]
        new_lines = []
        changed = False
        for line in frontmatter.splitlines():
            if line.startswith("name:"):
                current = line.split(":", 1)[1].strip().strip("\"'")
                if current != expected_name:
                    new_lines.append(f"name: {expected_name}")
                    changed = True
                    continue
            new_lines.append(line)

        if not changed:
            return

        await async_write_text(skill_md, "---" + "\n".join(new_lines) + content[end:])
        logger.info(f"已将 SKILL.md name 字段修正为: {expected_name}（路径: {skill_md}）")
    except Exception as e:
        logger.warning(f"修正 SKILL.md name 字段失败（不影响安装）: {e}")


async def _cleanup_temp_parent(local_path: Path) -> None:
    """清理 fetch 时创建的顶层临时目录（如果是以 skill_ 开头的 tmpdir）"""
    try:
        parent = local_path.parent
        if parent.name.startswith("skill_") or "skill_my_library" in str(parent) or "skill_github" in str(parent):
            await async_rmtree(parent)
    except Exception:
        pass


def _detect_name_conflicts(refs: list[SkillRef]) -> str | None:
    """检测批量 refs 中是否有两条会安装到同名目录（同 id 最后一段名相同）"""
    seen: set[str] = set()
    for ref in refs:
        guessed = ref.id.rstrip("/").split("/")[-1]
        if guessed in seen:
            return guessed
        seen.add(guessed)
    return None
