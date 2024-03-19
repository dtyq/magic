"""动态 skill 安装注册表

每个已安装的 skill 在其目录内存储 skill_meta.json，注册表通过扫描目录动态生成。
无全局注册表文件，meta 随 skill 目录的生命周期自动维护。
"""
import json
import time
from pathlib import Path

from agentlang.logger import get_logger
from app.utils.async_file_utils import (
    async_exists, async_read_text, async_write_text, async_scandir, async_unlink,
)
from app.core.skill_utils.constants import get_skillhub_install_dir

logger = get_logger(__name__)

SKILL_META_FILENAME = "skill_meta.json"


async def load_skill_registry() -> dict:
    """扫描 skills 安装目录，读取所有 skill_meta.json，组装注册表

    Returns:
        dict，格式为 {code: {version, package_name, installed_at}}
    """
    install_dir = get_skillhub_install_dir()
    if not await async_exists(install_dir):
        return {}

    result = {}
    try:
        entries = await async_scandir(install_dir)
    except Exception as e:
        logger.warning(f"扫描 skills 目录失败: {e}")
        return {}

    for entry in entries:
        if not entry.is_dir():
            continue
        meta_file = Path(entry.path) / SKILL_META_FILENAME
        if not await async_exists(meta_file):
            continue
        try:
            content = await async_read_text(meta_file)
            data = json.loads(content)
            code = data.get("code", "")
            if code:
                result[code] = {
                    "version": data.get("version", ""),
                    "package_name": data.get("package_name", ""),
                    "installed_at": data.get("installed_at", 0),
                }
        except Exception as e:
            logger.warning(f"读取 {meta_file} 失败: {e}")

    return result


async def update_skill_registry(code: str, version: str, package_name: str) -> None:
    """将 skill 安装元数据写入 skills/<package_name>/skill_meta.json

    Args:
        code: skill 的唯一 code（来自 dynamic_config）
        version: skill 版本（来自 dynamic_config）
        package_name: 安装后的目录名（从 SKILL.md 解析）
    """
    meta_file = get_skillhub_install_dir() / package_name / SKILL_META_FILENAME
    meta = {
        "code": code,
        "version": version,
        "package_name": package_name,
        "installed_at": time.time(),
    }
    await async_write_text(meta_file, json.dumps(meta, ensure_ascii=False, indent=2))
    logger.info(f"已写入 skill 元数据: code={code}, version={version}, package_name={package_name}")


async def remove_registry_entries(codes: list[str]) -> None:
    """删除指定 code 对应的 skill_meta.json 文件

    此函数只删除元数据文件，不删除整个 skill 目录。
    若直接删除 skill 目录，skill_meta.json 会随之自动消失。

    Args:
        codes: 需要移除的 skill code 列表
    """
    if not codes:
        return

    registry = await load_skill_registry()
    for code in codes:
        entry = registry.get(code)
        if not entry:
            continue
        package_name = entry.get("package_name", "")
        if not package_name:
            continue
        meta_file = get_skillhub_install_dir() / package_name / SKILL_META_FILENAME
        await async_unlink(meta_file)
        logger.info(f"已删除 skill 元数据: code={code}, package_name={package_name}")
