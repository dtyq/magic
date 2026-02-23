"""Skill 管理公共常量、并发锁和目录函数"""
import asyncio
from pathlib import Path


# skillhub lock 文件名
SKILLHUB_LOCK_FILE = ".skills_store_lock.json"
# 动态 skill 下载安装并发锁，防止同一 skill 并发重复下载
dynamic_skill_install_lock = asyncio.Lock()


def get_skillhub_install_dir() -> Path:
    """获取 skillhub 安装目录（.workspace/.magic/skills/）

    统一使用 .workspace/.magic/skills/ 作为安装目录，该目录持久化且对用户可见。
    skillhub CLI 命令在 shell_exec 中以此目录为 CWD 执行。
    """
    from app.path_manager import PathManager
    return PathManager.get_magic_dir() / "skills"


async def get_workspace_skills_dir() -> Path:
    """获取 .workspace/.magic/skills/ 目录路径，并确保目录存在

    在需要写入或以该目录为 CWD 执行命令前调用，避免各处重复拼接路径和创建目录。
    """
    from app.utils.async_file_utils import async_mkdir
    skills_dir = get_skillhub_install_dir()
    await async_mkdir(skills_dir, parents=True, exist_ok=True)
    return skills_dir
