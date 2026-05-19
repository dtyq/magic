"""NPX Provider：npx skills（CLI 子进程）

新版 `skills` CLI 说明：
- search：`find` 命令只搜索本地已安装 skill，无公共 registry JSON 接口，search 直接返回空。
- fetch：`add <owner/repo>` 按项目级安装到 `.agents/skills/`；
  通过把 cwd 设为临时目录来捕获安装结果，再交给 InstallService 落盘。
"""
from __future__ import annotations

import asyncio
import shutil
import tempfile
from pathlib import Path

from agentlang.logger import get_logger
from app.core.skill_utils.providers._cli_base import CliProvider
from app.core.skill_utils.providers.base import (
    FetchedSkill,
    SkillCandidate,
    SkillProviderId,
)
from app.utils.async_file_utils import async_copytree, async_rmtree

logger = get_logger(__name__)

# add-skills 已重命名为 skills
_NPX_PACKAGE = "skills"

# skills add 项目级安装时 universal agent 的相对路径
_UNIVERSAL_SKILLS_REL = ".agents/skills"


class NpxProvider(CliProvider):
    """npx skills 来源

    依赖 node/npx 环境，探测不到时自动 disabled。
    search 永远返回空列表（新 CLI 无公共 registry JSON 搜索接口）。
    fetch 使用 `add <owner/repo> -a universal --copy -y` 安装到临时 cwd。
    """

    id = SkillProviderId.NPX
    cli: list[str] = []   # 在 __init__ 中动态构建

    def __init__(self) -> None:
        super().__init__()
        npx_path = shutil.which("npx")
        if npx_path:
            self.cli = ["npx", "-y", _NPX_PACKAGE]
        self.enabled = npx_path is not None
        if not self.enabled:
            logger.info("[npx] npx 不可用，provider 已禁用")

    # ── search：不支持，直接返回空 ─────────────────────────────────────────────

    async def search(self, keyword: str, limit: int | None = 10) -> list[SkillCandidate]:
        logger.debug(f"[npx] search 不支持，跳过关键词: {keyword!r}")
        return []

    # ── resolve_latest：新 CLI 无 info 子命令 ─────────────────────────────────

    async def resolve_latest(self, ref: SkillCandidate | str) -> str | None:
        return None

    # ── fetch：把 cwd 设为临时目录，捕获项目级安装结果 ───────────────────────

    async def _fetch_to_dir(self, skill_id: str, *, version: str | None) -> FetchedSkill:
        """
        运行 `npx -y skills add <repo> [-s <skill_name>] -a universal --copy -y`，
        cwd 设为临时目录，CLI 会把 skill 安装到 <tmpdir>/.agents/skills/<name>/。

        skill_id 格式：
        - "owner/repo"               安装仓库内所有 skill（取第一个）
        - "owner/repo#skill-name"    安装仓库内指定 skill
        """
        self._ensure_enabled()

        # 解析 owner/repo#skill-name 格式
        if "#" in skill_id:
            repo_part, skill_name = skill_id.split("#", 1)
            skill_name = skill_name.strip()
        else:
            repo_part, skill_name = skill_id, None
        repo_part = repo_part.strip()

        tmp_root = Path(tempfile.mkdtemp(prefix="skill_npx_"))
        try:
            cmd = self.cli + ["add", repo_part, "-a", "universal", "--copy", "-y"]
            if skill_name:
                cmd += ["-s", skill_name]
            logger.info(f"[npx] fetch: {' '.join(cmd)}  (cwd={tmp_root})")

            try:
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    cwd=str(tmp_root),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
            except asyncio.TimeoutError:
                raise RuntimeError("[npx] fetch 命令超时")
            except Exception as e:
                raise RuntimeError(f"[npx] fetch 命令执行失败: {e}")

            if proc.returncode != 0:
                raise RuntimeError(
                    f"[npx] fetch 失败 (exit {proc.returncode}): "
                    f"{stderr.decode(errors='replace')[:500]}"
                )

            # 在 <tmpdir>/.agents/skills/ 下找 SKILL.md
            skills_dir = tmp_root / _UNIVERSAL_SKILLS_REL
            skill_root = _find_skill_root(skills_dir)
            if skill_root is None:
                # 回退：全量递归查找
                skill_root = _find_skill_root(tmp_root)
            if skill_root is None:
                raise FileNotFoundError(
                    f"[npx] fetch 后未找到 SKILL.md（目录: {tmp_root}）"
                )

            # 把找到的 skill 目录迁移到独立 tmpdir，供 InstallService 接管
            persist_tmp = Path(tempfile.mkdtemp(prefix="skill_npx_persist_"))
            dest = persist_tmp / skill_root.name
            await async_copytree(skill_root, dest)

            return FetchedSkill(
                local_path=dest,
                version=version or "unknown",
                source_url=f"npx://{skill_id}",
            )
        except Exception:
            await async_rmtree(tmp_root)
            raise
        else:
            await async_rmtree(tmp_root)


def _find_skill_root(base: Path) -> Path | None:
    """在 base 下递归查找第一个含 SKILL.md 的目录"""
    if not base.exists():
        return None
    # 优先直接子目录
    for child in base.iterdir():
        if child.is_dir() and (child / "SKILL.md").exists():
            return child
    # 再递归
    for skill_md in base.rglob("SKILL.md"):
        return skill_md.parent
    return None
