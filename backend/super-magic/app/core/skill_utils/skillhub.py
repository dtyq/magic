"""Skillhub CLI 操作：install-github、remove 及已安装元数据刷新"""
import asyncio
import json
from pathlib import Path
from typing import Optional

from agentlang.logger import get_logger
from app.utils.async_file_utils import async_read_text, async_write_text, async_exists, async_rmtree, async_mkdir
from app.core.skill_utils.constants import SKILLHUB_LOCK_FILE, INSTALLED_SKILLS_META_FILE, get_skillhub_install_dir

logger = get_logger(__name__)


async def refresh_installed_skills_meta() -> None:
    """刷新 workspace/installed_skills.json

    读取 skillhub lock 文件，将当前已安装的 skills 元数据写入 workspace，
    在每次 skillhub 命令（install/remove/install-github/upgrade）成功后调用。
    """
    from app.paths import PathManager
    # manager 必须懒加载：manager→installed→skillhub→manager 形成循环，顶层导入会报错
    from app.core.skill_utils.manager import get_global_skill_manager

    try:
        lock_file = get_skillhub_install_dir() / SKILLHUB_LOCK_FILE
        installed = []

        skill_manager = get_global_skill_manager()
        if await async_exists(lock_file):
            content = await async_read_text(lock_file)
            lock_data = json.loads(content)
            skills_dict = lock_data.get("skills", {})
            for slug, meta in skills_dict.items():
                if isinstance(meta, dict):
                    skill = await skill_manager.get_skill(slug)
                    name = (skill.name if skill else None) or meta.get("name") or slug
                    description = skill.description if skill else ""
                    installed.append({
                        "slug": slug,
                        "name": name,
                        "description": description,
                        "source": meta.get("source", "skillhub"),
                        "version": meta.get("version", ""),
                        "url": meta.get("url", ""),
                    })

        output_file = PathManager.get_workspace_dir() / INSTALLED_SKILLS_META_FILE
        await async_mkdir(output_file.parent, parents=True, exist_ok=True)
        await async_write_text(output_file, json.dumps(installed, ensure_ascii=False, indent=2))
        logger.info(f"已刷新 installed_skills.json，共 {len(installed)} 个 skills")
    except Exception as e:
        logger.warning(f"刷新 installed_skills.json 失败: {e}")


async def skillhub_remove(identifier: str) -> tuple[bool, str]:
    """移除已安装的 skillhub skill

    支持按技能名或 slug 匹配。匹配优先级：
    1. lock 文件中的 slug 精确匹配
    2. lock 文件中的 name 字段大小写不敏感匹配
    3. 直接将 identifier 当 slug 使用（兼容手动安装场景）
    """
    skills_dir = get_skillhub_install_dir()
    lock_file = skills_dir / SKILLHUB_LOCK_FILE

    slug = None
    lock = None

    if await async_exists(lock_file):
        try:
            content = await async_read_text(lock_file)
            lock = json.loads(content)
            skills: dict = lock.get("skills", {})

            if identifier in skills:
                slug = identifier
            else:
                identifier_lower = identifier.lower()
                for s, meta in skills.items():
                    skill_name = meta.get("name", "") if isinstance(meta, dict) else ""
                    if skill_name.lower() == identifier_lower or s.lower() == identifier_lower:
                        slug = s
                        break
        except Exception as e:
            logger.warning(f"skillhub remove: 读取 lock 文件失败: {e}")

    if slug is None:
        slug = identifier

    skill_dir = skills_dir / slug
    removed_dir = False
    removed_lock = False

    if await async_exists(skill_dir):
        await async_rmtree(skill_dir)
        removed_dir = True
        logger.info(f"skillhub remove: 已删除目录 {skill_dir}")

    if lock is not None:
        try:
            skills = lock.get("skills", {})
            if slug in skills:
                del skills[slug]
                lock["skills"] = skills
                await async_write_text(lock_file, json.dumps(lock, ensure_ascii=False, indent=2))
                removed_lock = True
                logger.info(f"skillhub remove: 已从 lock 文件移除 {slug}")
        except Exception as e:
            logger.warning(f"skillhub remove: 更新 lock 文件失败: {e}")

    if not removed_dir and not removed_lock:
        return False, f"skill '{identifier}' not found"

    await refresh_installed_skills_meta()
    return True, f"Removed: {slug}"


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
    支持整个仓库或仓库内子目录，安装到 skills/<name>/ 并写入 lock 文件。
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

    skills_dir = get_skillhub_install_dir()
    install_dir = skills_dir / install_name
    await async_mkdir(skills_dir, parents=True, exist_ok=True)

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

    lock_file = skills_dir / SKILLHUB_LOCK_FILE
    try:
        lock: dict = {}
        if await async_exists(lock_file):
            content = await async_read_text(lock_file)
            lock = json.loads(content)
        skills_entry = lock.setdefault("skills", {})
        skills_entry[install_name] = {
            "source": "github",
            "url": url,
            "branch": branch,
            "subdir": subdir,
        }
        await async_write_text(lock_file, json.dumps(lock, ensure_ascii=False, indent=2))
    except Exception as e:
        logger.warning(f"skillhub install-github: 写入 lock 文件失败: {e}")

    await refresh_installed_skills_meta()
    logger.info(f"skillhub install-github: 安装完成 {install_name} -> {install_dir}")
    return True, f"Installed: {install_name} -> {install_dir}"
