"""dynamic_config skill 列表的内存管理

每次对话携带完整 skill 列表，直接存内存，无需写文件。
按 agent_type 隔离；每次对话覆写，以最新配置为准。
"""
import asyncio
import shutil
from typing import List, Dict

from agentlang.logger import get_logger
from app.core.skill_utils.constants import get_skillhub_install_dir
from app.core.skill_utils.registry import load_skill_registry

logger = get_logger(__name__)

# 按 agent_type 隔离的内存存储，key 为规范化后的 agent_type
_store: Dict[str, List[dict]] = {}


def _normalize_agent_type(agent_type: str) -> str:
    return agent_type.strip().replace("/", "_") if agent_type else "default"


async def _cleanup_outdated_dynamic_skills(new_skills: List[dict]) -> None:
    """清理版本已变更的动态 skill：从磁盘删除旧目录

    每次对话写入新配置前调用，保证版本变更时能强制重新下载。
    skill_meta.json 随 skill 目录一并删除，无需额外操作。

    Args:
        new_skills: 本次对话传入的最新 skill 列表
    """
    registry = await load_skill_registry()
    if not registry:
        return

    for skill in new_skills:
        code = skill.get("code", "")
        new_version = skill.get("version", "")
        # 没有 code 或 version 为空的 skill 跳过版本比对
        if not code or not new_version:
            continue

        entry = registry.get(code)
        if not entry:
            continue

        old_version = entry.get("version", "")
        if old_version == new_version:
            continue

        # 版本变更：删除旧版磁盘目录，skill_meta.json 随之自动消失
        package_name = entry.get("package_name", "")
        if package_name:
            install_dir = get_skillhub_install_dir() / package_name
            if install_dir.exists():
                await asyncio.to_thread(shutil.rmtree, str(install_dir))
                logger.info(
                    f"已删除旧版 skill: {package_name} "
                    f"(version {old_version!r} -> {new_version!r})"
                )

        logger.info(f"已清除 skill 注册信息: code={code}, 旧版本={old_version!r}, 新版本={new_version!r}")


async def save_dynamic_config_skills(skills: List[dict], agent_type: str = "") -> None:
    """将 dynamic_config 传入的 skill 列表写入内存，按 agent_type 隔离

    每次对话覆写，以最新配置为准；同时对比版本，清理版本已变更的旧 skill。

    Args:
        skills: skill 信息列表，每项包含 id, code, name, description, version, source
        agent_type: agent 类型名称，用于隔离（空则用 "default"）
    """
    await _cleanup_outdated_dynamic_skills(skills)

    key = _normalize_agent_type(agent_type)
    _store[key] = skills
    logger.info(f"已保存 {len(skills)} 个 dynamic_config skills 到内存 (agent_type={key})")


async def load_dynamic_config_skills(agent_type: str = "") -> List[dict]:
    """从内存读取指定 agent_type 的 dynamic_config skills 列表

    Args:
        agent_type: agent 类型名称，为空时尝试使用 GlobalSkillManager.get_current_agent_type()

    Returns:
        skill 信息列表，每项包含 id, code, name, description, version, source
    """
    # manager 必须懒加载：manager→downloader→dynamic_config→manager 形成循环，顶层导入会报错
    from app.core.skill_utils.manager import GlobalSkillManager

    resolved_type = agent_type or GlobalSkillManager.get_current_agent_type()
    key = _normalize_agent_type(resolved_type)
    return _store.get(key, [])
