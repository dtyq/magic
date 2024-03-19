"""已安装 skill 元数据的持久化读取与静默重装"""
import asyncio
import json
from typing import List

from agentlang.skills.models import SkillMetadata
from agentlang.logger import get_logger
from app.utils.async_file_utils import async_read_text, async_exists
from app.core.skill_utils.constants import INSTALLED_SKILLS_META_FILE, reinstall_lock, get_skillhub_install_dir
from app.core.skill_utils.skillhub import skillhub_install_github

logger = get_logger(__name__)


async def load_installed_skills_from_meta() -> List[SkillMetadata]:
    """从 installed_skills.json 直接构造 SkillMetadata 列表

    不扫描磁盘、不触发重装，只从持久化的 JSON 元数据中读取 name 和
    description 来构造最小化的 SkillMetadata，供 agent 初始化时感知
    已安装的用户自定义 skills（即使容器重启导致文件不存在也能正常工作）。
    """
    from app.paths import PathManager

    metadata_file = PathManager.get_workspace_dir() / INSTALLED_SKILLS_META_FILE
    if not await async_exists(metadata_file):
        return []

    try:
        content = await async_read_text(metadata_file)
        installed: List[dict] = json.loads(content)
    except Exception as e:
        logger.warning(f"读取 installed_skills.json 失败: {e}")
        return []

    results = []
    for entry in installed:
        if not isinstance(entry, dict):
            continue
        name = entry.get("name") or entry.get("slug")
        if not name:
            continue
        description = entry.get("description", "")
        results.append(SkillMetadata(name=name, description=description))
        logger.info(f"从 installed_skills.json 加载 skill 元数据: {name}")

    return results


async def _try_reinstall_skill(skill_name: str) -> bool:
    """从 installed_skills.json 元数据静默重装 skill

    当 skill 文件不存在（如容器重启后）但 .chat_history 中有元数据记录时，
    自动重新安装并刷新 SkillManager 缓存。
    """
    async with reinstall_lock:
        from app.paths import PathManager

        metadata_file = PathManager.get_workspace_dir() / INSTALLED_SKILLS_META_FILE
        if not await async_exists(metadata_file):
            logger.debug(f"installed_skills.json 不存在，跳过重装: {skill_name}")
            return False

        try:
            content = await async_read_text(metadata_file)
            installed: List[dict] = json.loads(content)
        except Exception as e:
            logger.error(f"读取 installed_skills.json 失败: {e}")
            return False

        skill_name_lower = skill_name.lower()
        entry = next(
            (e for e in installed
             if str(e.get("slug", "")).lower() == skill_name_lower
             or str(e.get("name", "")).lower() == skill_name_lower),
            None
        )
        if not entry:
            logger.debug(f"installed_skills.json 中未找到 skill: {skill_name}")
            return False

        slug = entry["slug"]
        source = entry.get("source", "skillhub")
        url = entry.get("url", "")

        logger.info(f"开始静默重装 skill: {slug}，来源: {source}")

        if source == "github" and url:
            success, msg = await skillhub_install_github(url)
            if not success:
                logger.error(f"install-github 重装失败 ({slug}): {msg}")
                return False
            logger.info(f"install-github 重装成功: {slug}")
        else:
            install_dir = str(get_skillhub_install_dir())
            try:
                proc = await asyncio.create_subprocess_exec(
                    "skillhub", "--dir", install_dir, "install", slug, "--force",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                try:
                    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60.0)
                except asyncio.TimeoutError:
                    proc.kill()
                    logger.error(f"skillhub install {slug} 超时（60s），放弃重装")
                    return False

                if proc.returncode != 0:
                    err_msg = stderr.decode("utf-8", errors="replace").strip()
                    logger.error(f"skillhub install {slug} 失败 (exit {proc.returncode}): {err_msg}")
                    return False

                logger.info(f"skillhub skill 重装成功: {slug}")
            except FileNotFoundError:
                logger.error("skillhub 命令未找到，无法重装 skill")
                return False
            except Exception as e:
                logger.error(f"skillhub install {slug} 异常: {e}")
                return False

        return True
