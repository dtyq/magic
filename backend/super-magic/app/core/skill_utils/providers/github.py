"""GitHub Provider：从 GitHub 仓库/子目录下载并安装 skill（archive zip）"""
from __future__ import annotations

import asyncio
import shutil
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from agentlang.logger import get_logger
from app.core.skill_utils.providers.base import (
    FetchedSkill,
    SkillCandidate,
    SkillProvider,
    SkillProviderId,
)

logger = get_logger(__name__)

# 单次从 GitHub 仓库安装的 skill 数量上限，防止大型仓库无限下载
_MAX_SKILLS_PER_REPO = 20


def _parse_github_url(url: str) -> tuple[str, str, str, str, str]:
    """解析 GitHub URL，提取 (owner, repo, branch, subdir, install_name)

    支持格式：
    - https://github.com/owner/repo
    - https://github.com/owner/repo/tree/branch/path/to/skill
    """
    parsed = urlparse(url)
    parts = [p for p in parsed.path.strip("/").split("/") if p]

    if len(parts) < 2:
        raise ValueError(f"无效的 GitHub URL: {url}")

    owner, repo = parts[0], parts[1]
    if repo.endswith(".git"):
        repo = repo[:-4]

    branch = ""
    subdir = ""

    if len(parts) > 3 and parts[2] == "tree":
        branch = parts[3]
        subdir = "/".join(parts[4:]) if len(parts) > 4 else ""

    install_name = subdir.split("/")[-1] if subdir else repo
    return owner, repo, branch, subdir, install_name


def _extract_all_skills(download_url: str, subdir: str) -> list[Path]:
    """下载 GitHub zip，返回所有 skill 根目录（每个已持久化到独立临时目录，调用方负责清理）

    逻辑：
    1. 下载并解压 zip
    2. 进入 GitHub archive 的外层目录（如 `skills-main/`）
    3. 若指定了 subdir，只处理该子目录
    4. 若根目录本身含 SKILL.md → 单 skill
    5. 否则查找直接子目录中含 SKILL.md 的 → 多 skill
    6. 兜底：深度递归找第一个
    """
    import urllib.request
    import zipfile
    from app.core.skill_utils.skillhub import _find_skill_root

    tmp = tempfile.mkdtemp(prefix="skill_github_extract_")
    try:
        zip_path = Path(tmp) / "skill.zip"
        logger.info(f"下载 skill zip: {download_url}")
        urllib.request.urlretrieve(download_url, zip_path)

        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(tmp)

        tmp_path = Path(tmp)
        extracted = [p for p in tmp_path.iterdir() if p.is_dir() and p.name != "__MACOSX"]
        if not extracted:
            raise FileNotFoundError("zip 解压后未找到任何目录")

        # GitHub archive 外层目录，如 `skills-main/`
        repo_root = extracted[0]
        search_root = (repo_root / subdir) if subdir else repo_root

        if not search_root.exists():
            raise FileNotFoundError(f"子目录 '{subdir}' 在仓库中不存在")

        def _copy_to_persist(src: Path) -> Path:
            persist_dir = tempfile.mkdtemp(prefix="skill_github_persist_")
            dest = Path(persist_dir) / src.name
            shutil.copytree(src, dest)
            return dest

        # search_root 本身即单 skill
        if (search_root / "SKILL.md").exists():
            return [_copy_to_persist(search_root)]

        # 查找直接子目录中含 SKILL.md 的（多 skill 仓库），最多取 _MAX_SKILLS_PER_REPO 个
        candidates = [
            child
            for child in sorted(search_root.iterdir())
            if child.is_dir()
            and child.name not in ("__MACOSX", ".git", ".github")
            and (child / "SKILL.md").exists()
        ]
        if len(candidates) > _MAX_SKILLS_PER_REPO:
            logger.warning(
                f"仓库包含 {len(candidates)} 个 skill，超过上限 {_MAX_SKILLS_PER_REPO}，"
                f"仅安装前 {_MAX_SKILLS_PER_REPO} 个"
            )
            candidates = candidates[:_MAX_SKILLS_PER_REPO]
        skill_dirs = [_copy_to_persist(child) for child in candidates]
        if skill_dirs:
            return skill_dirs

        # 兜底：深度递归找第一个
        found = _find_skill_root(search_root)
        if found:
            return [_copy_to_persist(found)]

        raise FileNotFoundError("zip 解压后未找到包含 SKILL.md 的目录")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


class GitHubProvider(SkillProvider):
    """GitHub archive zip 来源

    search 首版不实现（返回 []）；fetch_many 通过 archive API 下载 zip，
    支持单 skill 仓库和多 skill 仓库（每个子目录各含 SKILL.md）。
    resolve_latest 调用 GitHub API 取最新 commit sha。
    """

    id = SkillProviderId.GITHUB
    enabled = True

    async def search(self, keyword: str, limit: int = 10) -> list[SkillCandidate]:
        # 首版不接 GitHub Search API（避免限流），返回空
        return []

    async def fetch_many(
        self,
        ref: SkillCandidate | str,
        *,
        version: str | None = None,
    ) -> list[FetchedSkill]:
        """下载仓库 zip，返回所有找到的 skill（支持多 skill 仓库）。"""
        url = self._get_id(ref)
        try:
            owner, repo, branch, subdir, _ = _parse_github_url(url)
        except ValueError as e:
            raise ValueError(f"[github] {e}") from e

        if branch:
            download_url = f"https://github.com/{owner}/{repo}/archive/refs/heads/{branch}.zip"
        else:
            download_url = f"https://github.com/{owner}/{repo}/archive/HEAD.zip"

        try:
            skill_paths = await asyncio.to_thread(_extract_all_skills, download_url, subdir)
        except Exception as e:
            if not isinstance(e, RuntimeError):
                raise RuntimeError(f"[github] 下载失败 '{download_url}': {e}") from e
            raise

        return [
            FetchedSkill(local_path=p, version="unknown", source_url=url)
            for p in skill_paths
        ]

    async def fetch(
        self,
        ref: SkillCandidate | str,
        *,
        version: str | None = None,
    ) -> FetchedSkill:
        results = await self.fetch_many(ref, version=version)
        return results[0]

    async def resolve_latest(self, ref: SkillCandidate | str) -> str | None:
        url = self._get_id(ref)
        try:
            owner, repo, branch, _, _ = _parse_github_url(url)
            branch = branch or "HEAD"
            api_url = f"https://api.github.com/repos/{owner}/{repo}/commits/{branch}"

            import urllib.request
            import json

            def _fetch_sha() -> str | None:
                req = urllib.request.Request(api_url, headers={"Accept": "application/vnd.github.sha"})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    return resp.read().decode("ascii", errors="replace").strip()[:12]

            return await asyncio.to_thread(_fetch_sha)
        except Exception as e:
            logger.warning(f"[github] resolve_latest 失败: {e}")
            return None
