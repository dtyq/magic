"""Skill 管理公共常量、并发锁和目录函数"""
import asyncio
from pathlib import Path


# 主动读取和 preload 共用异常体积边界；继续读取的同意由现有用户交互处理。
SKILL_MAX_TOKENS = 50_000
SKILL_READ_LIMIT_NOTICE = (
    f"This Skill exceeds the {SKILL_MAX_TOKENS:,}-token reading limit and is unusually large; "
    "its organization or content may need attention. "
    "Before reading more through any tool, obtain the user's informed consent for this Skill "
    "in the current task, unless it has already been given. Explain that further reading may "
    "trigger context compaction: earlier conversation and tool results may be summarized, "
    "some details may be lost, and those details may need to be read or supplied again. "
    "Use ask_user when available; a subagent should return this requirement to its caller. "
    "A refusal, no response, or a timeout is not consent. Do not treat a partial read as the "
    "complete Skill. After consent, load an unread Skill with read_skills, or continue a partial "
    "read with read_files using its returned path and range. Do not ask again for every page "
    "of the same remaining content."
)


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
