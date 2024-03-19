"""Skill 管理公共常量、并发锁和目录函数"""
import asyncio
from pathlib import Path


# skillhub lock 文件名
SKILLHUB_LOCK_FILE = ".skills_store_lock.json"
# 已安装 skills 元数据文件（存放在 workspace/.magic/skills/ 目录中，自动持久化）
INSTALLED_SKILLS_META_FILE = ".magic/skills/installed_skills.json"
# 重装操作并发锁，防止多个工具并发触发重装
reinstall_lock = asyncio.Lock()
# 动态 skill 下载安装并发锁，防止同一 skill 并发重复下载
dynamic_skill_install_lock = asyncio.Lock()


def get_skillhub_install_dir() -> Path:
    """获取 skillhub 安装目录（project_root/skills/）

    skillhub 命令在 shell_exec 中强制以 project_root 为 CWD 执行，
    因此默认安装路径为 project_root/skills/。
    """
    from app.paths import PathManager
    return PathManager.get_project_root() / "skills"
