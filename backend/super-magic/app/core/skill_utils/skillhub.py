"""Skillhub：从互联网检索并安装 skill 到 workspace（install-github、remove 等）。

本地目录遍历与元数据发现见 skill_directory_scan 模块。
"""
import asyncio
from pathlib import Path

from agentlang.logger import get_logger
from app.utils.async_file_utils import async_exists, async_rmtree
from app.core.skill_utils.constants import get_skillhub_install_dir, get_workspace_skills_dir

logger = get_logger(__name__)


async def register_custom_skill(name: str, description: str) -> tuple[bool, str]:
    """注册自定义 skill（当前仅验证 skill 目录和 SKILL.md 是否存在）

    无需写锁文件，skill_list 通过直接扫描目录发现 skill。
    保留此函数是为了兼容 SKILL.md 中可能存在的旧版调用。
    """
    skills_dir = await get_workspace_skills_dir()
    skill_dir = skills_dir / name
    skill_file = skill_dir / "SKILL.md"

    if not await async_exists(skill_dir):
        msg = f"注册失败：skill 目录不存在 ({skill_dir})，请先创建 SKILL.md"
        logger.warning(msg)
        return False, msg
    if not await async_exists(skill_file):
        msg = f"注册失败：SKILL.md 不存在 ({skill_file})，请先完成 skill 文件创建"
        logger.warning(msg)
        return False, msg

    logger.info(f"skill '{name}' 已在磁盘上，无需锁文件注册，直接扫描即可发现")
    return True, f"skill '{name}' 已就绪，可通过 skill_list 发现和使用。"


async def skillhub_remove(identifier: str) -> tuple[bool, str]:
    """移除已安装的 skillhub skill

    直接删除对应目录，无锁文件依赖。
    """
    skills_dir = get_skillhub_install_dir()
    skill_dir = skills_dir / identifier

    if not await async_exists(skill_dir):
        return False, f"skill '{identifier}' not found"

    await async_rmtree(skill_dir)
    logger.info(f"skillhub remove: 已删除目录 {skill_dir}")
    return True, f"Removed: {identifier}"


def _parse_github_url(url: str) -> tuple[str, str, str, str, str]:
    """解析 GitHub URL，提取仓库信息和安装目录名

    支持格式：
    - https://github.com/owner/repo
    - https://github.com/owner/repo/tree/branch/path/to/skill

    Returns:
        (owner, repo, branch, subdir, install_name) 五元组
    """
    from urllib.parse import urlparse

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


async def skillhub_install_github(url: str) -> tuple[bool, str]:
    """从 GitHub 下载并安装 skill

    通过 GitHub archive API 下载 zip 包，无需 git 命令。
    支持整个仓库或仓库内子目录，安装到 skills/<name>/。
    安装后无需注册，skill_list 直接扫描目录即可发现。
    """
    import tempfile
    import urllib.request
    import zipfile

    try:
        owner, repo, branch, subdir, install_name = _parse_github_url(url)
    except ValueError as e:
        return False, str(e)

    ref = f"refs/heads/{branch}" if branch else "HEAD"
    download_url = f"https://github.com/{owner}/{repo}/archive/{ref}.zip"

    skills_dir = await get_workspace_skills_dir()
    install_dir = skills_dir / install_name

    if await async_exists(install_dir):
        await async_rmtree(install_dir)

    try:
        def _download_and_extract() -> Path:
            """下载 zip 并解压到临时目录，返回解压后的仓库根目录路径"""
            import shutil

            with tempfile.TemporaryDirectory() as tmp:
                zip_path = Path(tmp) / "archive.zip"
                urllib.request.urlretrieve(download_url, zip_path)

                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(tmp)

                extracted = [
                    p for p in Path(tmp).iterdir()
                    if p.is_dir() and p.name != "__MACOSX"
                ]
                if not extracted:
                    raise FileNotFoundError("zip 解压后未找到目录")

                repo_dir = extracted[0]

                if subdir:
                    src = repo_dir / subdir
                    if not src.exists():
                        raise FileNotFoundError(f"子目录 '{subdir}' 在仓库中不存在")
                    shutil.copytree(src, install_dir)
                else:
                    shutil.copytree(repo_dir, install_dir)

            return install_dir

        await asyncio.to_thread(_download_and_extract)

    except Exception as e:
        logger.error(f"skillhub install-github: 安装失败: {e}")
        if await async_exists(install_dir):
            await async_rmtree(install_dir)
        return False, f"安装失败: {e}"

    logger.info(f"skillhub install-github: 安装完成 {install_name} -> {install_dir}")
    return True, f"Installed: {install_name} -> {install_dir}"
