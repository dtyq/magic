"""CLI 子进程 Provider 基类

skillhub / clawhub / npx 三个 provider 共用此基类。
子类只需声明 cli（命令前缀）并实现子命令名映射即可。
"""
from __future__ import annotations

import asyncio
import json
import shutil
from pathlib import Path
from typing import Any

from agentlang.logger import get_logger
from app.core.skill_utils.providers.base import (
    FetchedSkill,
    SkillCandidate,
    SkillProvider,
    SkillProviderId,
)
from app.utils.async_file_utils import async_copytree

logger = get_logger(__name__)

# CLI 能力探测结果缓存（进程级，避免重复探测）
_detect_cache: dict[str, bool] = {}

# provider unavailable 时统一使用此异常
class ProviderUnavailableError(RuntimeError):
    pass


class CliProvider(SkillProvider):
    """CLI 子进程 Provider 基类

    子类需声明：
    - id: SkillProviderId
    - cli: list[str]   — 命令前缀，如 ["clawhub"] 或 ["skillhub"]
    - search_subcmd: list[str]   — search 子命令，如 ["search"]
    - fetch_subcmd: list[str]    — fetch/install 子命令，如 ["install"]
    - info_subcmd: list[str]     — info 子命令，如 ["info"]
    - json_flag: str             — 触发 JSON 输出的 flag，默认 "--json"

    fetch 时会尝试传入 --dir <tmp> 让 CLI 安装到临时目录；
    若 CLI 不支持 --dir，由子类覆盖 _fetch_to_dir 处理。
    """

    cli: list[str] = []
    search_subcmd: list[str] = ["search"]
    fetch_subcmd: list[str] = ["install"]
    info_subcmd: list[str] = ["info"]
    json_flag: str = "--json"
    dir_flag: str = "--dir"

    def __init__(self) -> None:
        self.enabled = self._detect_sync()

    # ── 能力探测 ──────────────────────────────────────────────────────────────

    def _detect_sync(self) -> bool:
        """同步探测 CLI 是否可用（在 __init__ 中调用）"""
        exe = self.cli[0] if self.cli else ""
        if not exe:
            return False
        cache_key = exe
        if cache_key in _detect_cache:
            return _detect_cache[cache_key]
        result = shutil.which(exe) is not None
        _detect_cache[cache_key] = result
        if not result:
            logger.info(f"[{self.id.value}] CLI '{exe}' 不可用，provider 已禁用")
        return result

    def _ensure_enabled(self) -> None:
        if not self.enabled:
            raise ProviderUnavailableError(
                f"Provider '{self.id.value}' 不可用：CLI '{self.cli[0] if self.cli else '?'}' 未找到"
            )

    # ── 核心子进程调用 ─────────────────────────────────────────────────────────

    async def _run_json(self, *args: str, timeout: float = 60) -> Any:
        """运行 CLI 并解析 JSON 输出；失败时抛异常"""
        cmd = self.cli + list(args) + [self.json_flag]
        logger.debug(f"[{self.id.value}] 执行: {' '.join(cmd)}")
        try:
            proc = await asyncio.wait_for(
                asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                ),
                timeout=5,  # 进程创建超时
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            raise RuntimeError(f"[{self.id.value}] 命令超时: {' '.join(cmd)}")
        except Exception as e:
            raise RuntimeError(f"[{self.id.value}] 命令执行失败: {e}")

        if proc.returncode != 0:
            raise RuntimeError(
                f"[{self.id.value}] CLI 返回非零退出码 {proc.returncode}: "
                f"{stderr.decode(errors='replace')[:500]}"
            )

        text = stdout.decode(errors="replace").strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            raise RuntimeError(
                f"[{self.id.value}] JSON 解析失败（前 200 字节）: {text[:200]!r}"
            ) from e

    # ── 抽象方法实现 ──────────────────────────────────────────────────────────

    async def search(self, keyword: str, limit: int = 10) -> list[SkillCandidate]:
        self._ensure_enabled()
        try:
            raw = await self._run_json(*self.search_subcmd, keyword)
            return self._parse_search(raw, limit)
        except Exception as e:
            logger.warning(f"[{self.id.value}] search 失败: {e}")
            return []

    async def fetch(
        self,
        ref: SkillCandidate | str,
        *,
        version: str | None = None,
    ) -> FetchedSkill:
        self._ensure_enabled()
        skill_id = self._get_id(ref)
        return await self._fetch_to_dir(skill_id, version=version)

    async def resolve_latest(self, ref: SkillCandidate | str) -> str | None:
        self._ensure_enabled()
        skill_id = self._get_id(ref)
        try:
            raw = await self._run_json(*self.info_subcmd, skill_id)
            return self._parse_version(raw)
        except Exception as e:
            logger.warning(f"[{self.id.value}] resolve_latest 失败: {e}")
            return None

    # ── 子类可覆盖的解析钩子 ──────────────────────────────────────────────────

    def _parse_search(self, raw: Any, limit: int) -> list[SkillCandidate]:
        """将 CLI JSON 输出解析为 SkillCandidate 列表，子类按需覆盖"""
        items: list[SkillCandidate] = []
        if not isinstance(raw, list):
            raw = raw.get("items", raw.get("results", []))
        for item in raw[:limit]:
            if not isinstance(item, dict):
                continue
            candidate = SkillCandidate(
                provider=self.id,
                id=item.get("slug", item.get("name", item.get("id", ""))),
                name=item.get("name", item.get("slug", "")),
                description=item.get("description", ""),
                version=item.get("version"),
                extra=item,
            )
            if candidate.id:
                items.append(candidate)
        return items

    def _parse_version(self, raw: Any) -> str | None:
        """从 info JSON 中提取版本号，子类按需覆盖"""
        if isinstance(raw, dict):
            return raw.get("version") or raw.get("latest_version")
        return None

    async def _fetch_to_dir(self, skill_id: str, *, version: str | None) -> FetchedSkill:
        """安装到临时目录并返回 FetchedSkill，子类可覆盖以处理不支持 --dir 的 CLI"""
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            args = list(self.fetch_subcmd) + [skill_id]
            if version:
                args += ["--version", version]
            args += [self.dir_flag, str(tmp_path)]

            cmd = self.cli + args
            logger.info(f"[{self.id.value}] fetch: {' '.join(cmd)}")
            try:
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
            except asyncio.TimeoutError:
                raise RuntimeError(f"[{self.id.value}] fetch 命令超时")

            if proc.returncode != 0:
                raise RuntimeError(
                    f"[{self.id.value}] fetch 失败 (exit {proc.returncode}): "
                    f"{stderr.decode(errors='replace')[:500]}"
                )

            # 找到 SKILL.md 所在目录
            from app.core.skill_utils.skillhub import _find_skill_root
            skill_root = _find_skill_root(tmp_path)
            if skill_root is None:
                raise FileNotFoundError(
                    f"[{self.id.value}] fetch 后未找到 SKILL.md（目录: {tmp_path}）"
                )

            # 需要将临时目录持久化到调用方管理（InstallService 会接管）
            # 这里用 tempfile 语义外的目录返回供 InstallService 拷贝
            persist_tmp = Path(tempfile.mkdtemp(prefix=f"skill_{self.id.value}_"))
            await async_copytree(skill_root, persist_tmp / skill_root.name)
            fetched_root = persist_tmp / skill_root.name
            if not (fetched_root / "SKILL.md").exists():
                fetched_root = persist_tmp

            return FetchedSkill(
                local_path=fetched_root,
                version=version or "unknown",
                source_url=f"cli://{self.id.value}/{skill_id}",
            )
