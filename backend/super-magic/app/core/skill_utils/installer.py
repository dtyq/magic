"""InstallService：Skill 安装/升级统一入口

所有来源的 skill 安装都通过此服务落盘到 .workspace/.magic/skills/。
支持单条和批量安装，原子替换目录，失败时自动回滚。
"""
from __future__ import annotations

import asyncio
import os
import random
import shutil
import string
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from agentlang.logger import get_logger
from app.core.skill_utils.constants import dynamic_skill_install_lock, get_skillhub_install_dir
from app.path_manager import PathManager
from app.utils.async_file_utils import async_copytree, async_mkdir, async_rmtree
from app.core.skill_utils.manifest import SkillManifest, invalidate_cache, write_manifest, read_manifest
from app.core.skill_utils.providers.base import SkillCandidate, SkillProviderId
from app.core.skill_utils.version import version_eq, version_gt

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


def _validate_fetched_skill(local_path: Path) -> None:
    """结构安全检查：必含 SKILL.md，禁止越权路径，体积/数量在限"""
    skill_md = local_path / "SKILL.md"
    if not skill_md.exists():
        raise ValueError(f"缺少 SKILL.md（目录: {local_path}）")

    total_size = 0
    total_files = 0
    for entry in local_path.rglob("*"):
        # 拒绝绝对路径或 .. 穿越
        try:
            entry.relative_to(local_path)
        except ValueError:
            raise ValueError(f"安全检查失败：越权路径 {entry}")
        if entry.is_file():
            total_files += 1
            total_size += entry.stat().st_size

    if total_size > MAX_SIZE_BYTES:
        raise ValueError(
            f"skill 体积 {total_size / 1024 / 1024:.1f}MB 超过限制 {MAX_SIZE_BYTES // 1024 // 1024}MB"
        )
    if total_files > MAX_FILES:
        raise ValueError(f"skill 文件数 {total_files} 超过限制 {MAX_FILES}")


class InstallService:
    """Skill 安装服务（进程级无状态，可直接实例化使用）"""

    def __init__(self, target_dir: Path | None = None) -> None:
        self._target_dir = target_dir  # None 表示使用默认 .workspace/.magic/skills/

    def _get_target_dir(self) -> Path:
        return self._target_dir or get_skillhub_install_dir()

    async def install(self, ref: SkillRef) -> list[InstallResult]:
        """安装或升级单个 ref，返回结果列表（多 skill 仓库时含多条）。"""
        from app.core.skill_utils.providers.registry import get_registry

        provider_id_str = ref.provider
        skill_id = ref.id
        mode = ref.mode

        # 1. 获取 provider
        try:
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
        if existing_dir.exists() and mode == "install":
            existing_manifest = read_manifest(existing_dir)
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
        #    但对于单 skill 情况仍有效；多 skill 情况由 _do_install_one 的原子替换逻辑处理
        if existing_dir.exists() and mode == "install":
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

        results: list[InstallResult] = []
        for fetched in fetched_list:
            result = await self._do_install_one(
                provider_id_str, skill_id, target_version, mode, target_dir, fetched
            )
            results.append(result)
        return results

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
        local_path = fetched.local_path
        actual_version = fetched.version

        try:
            _validate_fetched_skill(local_path)
        except ValueError as e:
            return InstallResult(
                ok=False, name="", provider=provider_id_str, skill_id=skill_id, mode=mode,
                message=f"安全校验失败: {e}", status="failed",
            )

        # 从 SKILL.md 读取真实 name
        skill_name = _read_skill_name(local_path) or local_path.name
        install_dir = target_dir / skill_name

        # 确保安装目标父目录存在（os.replace 要求目标父目录存在）
        await async_mkdir(target_dir, parents=True, exist_ok=True)

        # 原子替换：先 staging，再 rename 旧目录为 .bak，再 rename staging 到正式名
        # staging 放在 .runtime/.staging/ 下，不污染工作区目录
        staging_dir = PathManager.get_runtime_dir() / f".staging/{skill_name}-{_rand_suffix()}"
        await async_mkdir(staging_dir.parent, parents=True, exist_ok=True)

        try:
            await async_copytree(local_path, staging_dir)
        except Exception as e:
            return InstallResult(
                ok=False, name=skill_name, provider=provider_id_str, skill_id=skill_id, mode=mode,
                message=f"复制到 staging 失败: {e}", status="failed",
            )

        # 备份旧目录
        bak_dir = target_dir / f".{skill_name}.bak"
        if install_dir.exists():
            if bak_dir.exists():
                await async_rmtree(bak_dir)
            install_dir.rename(bak_dir)

        try:
            os.replace(staging_dir, install_dir)
        except Exception as e:
            # 回滚
            if bak_dir and bak_dir.exists():
                bak_dir.rename(install_dir)
            return InstallResult(
                ok=False, name=skill_name, provider=provider_id_str, skill_id=skill_id, mode=mode,
                message=f"目录替换失败: {e}", status="failed",
            )

        # 写 manifest
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        manifest = SkillManifest(
            name=skill_name,
            provider=provider_id_str,
            source_id=skill_id,
            version=actual_version or target_version or "unknown",
            installed_at=now,
            source_url=fetched.source_url,
            installed_by="install_skills",
        )
        try:
            invalidate_cache(install_dir)
            write_manifest(install_dir, manifest)
        except Exception as e:
            logger.warning(f"写 manifest 失败（不影响安装）: {e}")

        # 清理 bak 和临时目录
        if bak_dir.exists():
            await async_rmtree(bak_dir)
        # 清理 fetch 产生的临时根目录
        await _cleanup_temp_parent(local_path)

        status = "upgraded" if mode == "upgrade" else "installed"
        action_label = "升级成功" if mode == "upgrade" else "安装成功"
        return InstallResult(
            ok=True, name=skill_name, provider=provider_id_str, skill_id=skill_id,
            mode=mode, version=manifest.version,
            path=str(install_dir),
            message=f"{action_label}: {skill_name} ({manifest.version})",
            status=status,
        )

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


def _read_skill_name(skill_dir: Path) -> str | None:
    """从 SKILL.md frontmatter 中读取 name 字段"""
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        return None
    try:
        content = skill_md.read_text(encoding="utf-8")
        if content.startswith("---"):
            end = content.find("\n---", 3)
            if end > 0:
                for line in content[3:end].splitlines():
                    if line.startswith("name:"):
                        return line.split(":", 1)[1].strip().strip("\"'") or None
    except Exception:
        pass
    return None


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
