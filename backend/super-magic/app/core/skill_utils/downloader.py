"""动态 skill 下载、解压、安装和按需触发逻辑"""
import asyncio
from pathlib import Path
from typing import Optional

from agentlang.skills.models import SkillMetadata
from agentlang.logger import get_logger
from app.core.skill_utils.constants import dynamic_skill_install_lock, get_skillhub_install_dir
from app.core.skill_utils.registry import load_skill_registry, update_skill_registry
from app.core.skill_utils.dynamic_config import load_dynamic_config_skills

logger = get_logger(__name__)


async def download_and_install_dynamic_skill(skill_item: dict) -> Optional[str]:
    """下载并安装来自 dynamic_config 的 skill

    流程：
    1. 通过 SDK 获取 skill 文件下载 URL
    2. 下载 zip 包
    3. 解压，从 SKILL.md 解析 package_name
    4. 安装到 project_root/skills/<package_name>/
    5. 更新注册表

    Args:
        skill_item: dynamic_config skill 信息，包含 id, code, name, version, source

    Returns:
        安装成功的 package_name（目录名），失败返回 None
    """
    import tempfile
    import zipfile
    import shutil

    skill_id = skill_item.get("id", "")
    skill_code = skill_item.get("code", "")
    skill_version = skill_item.get("version", "")
    skill_name = skill_item.get("name", "")

    if not skill_id:
        logger.error(f"动态 skill 缺少 id 字段: {skill_item}")
        return None

    logger.info(f"开始下载动态 skill: id={skill_id}, name={skill_name}")

    try:
        import httpx
        from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
        from app.infrastructure.sdk.magic_service.parameter.get_skill_file_urls_parameter import GetSkillFileUrlsParameter

        sdk = get_magic_service_sdk()
        parameter = GetSkillFileUrlsParameter(skill_ids=[skill_id])
        result = await sdk.skill.get_skill_file_urls_async(parameter)

        if not result.items:
            logger.error(f"获取 skill 文件 URL 失败: id={skill_id}，返回空列表")
            return None

        download_url = result.items[0].file_url
        if not download_url:
            logger.error(f"skill file_url 为空: id={skill_id}")
            return None

        logger.info(f"获取到 skill 下载 URL，开始下载: id={skill_id}")

        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            response = await client.get(download_url)
            response.raise_for_status()
            zip_content = response.content

        logger.info(f"skill zip 下载完成，大小: {len(zip_content)} 字节")

        def _extract_and_install() -> Optional[str]:
            """在线程中执行解压和文件复制（阻塞 IO）"""
            with tempfile.TemporaryDirectory() as tmp_dir:
                zip_path = Path(tmp_dir) / "skill.zip"
                zip_path.write_bytes(zip_content)

                extract_dir = Path(tmp_dir) / "extracted"
                extract_dir.mkdir()

                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(extract_dir)

                skill_md_path = extract_dir / "SKILL.md"
                if not skill_md_path.exists():
                    logger.error(f"skill zip 中未找到 SKILL.md: id={skill_id}")
                    return None

                pkg_name = None
                for line in skill_md_path.read_text(encoding="utf-8", errors="replace").splitlines():
                    line = line.strip()
                    if line.startswith("name:"):
                        pkg_name = line[5:].strip().strip("\"'")
                        break

                if not pkg_name:
                    logger.error(f"无法从 SKILL.md 解析 package_name: id={skill_id}")
                    return None

                skills_dir = get_skillhub_install_dir()
                skills_dir.mkdir(parents=True, exist_ok=True)
                install_dir = skills_dir / pkg_name

                if install_dir.exists():
                    shutil.rmtree(str(install_dir))

                shutil.copytree(str(extract_dir), str(install_dir))
                logger.info(f"skill 文件已安装到: {install_dir}")
                return pkg_name

        package_name = await asyncio.to_thread(_extract_and_install)
        if not package_name:
            return None

        await update_skill_registry(skill_code, skill_version, package_name)
        logger.info(f"动态 skill 安装完成: id={skill_id}, package_name={package_name}")
        return package_name

    except Exception as e:
        logger.error(f"下载安装动态 skill 失败: id={skill_id}, error={e}")
        import traceback
        logger.error(traceback.format_exc())
        return None


async def _try_install_from_dynamic_config(skill_name: str) -> Optional[SkillMetadata]:
    """从 dynamic_config skills 查找并按需下载安装 skill

    匹配逻辑：
    1. 按 name 字段（大小写不敏感）匹配 dynamic_config skill
    2. 若未按 name 匹配到，则检查注册表中 package_name 是否匹配

    Args:
        skill_name: 请求的 skill 名称

    Returns:
        SkillMetadata or None
    """
    # manager 必须懒加载：manager 顶层导入了 downloader，若 downloader 顶层再导入 manager 则循环
    from app.core.skill_utils.manager import _find_skill_case_insensitive

    dynamic_skills = await load_dynamic_config_skills()
    if not dynamic_skills:
        return None

    skill_name_lower = skill_name.lower()

    matched = next(
        (s for s in dynamic_skills if s.get("name", "").lower() == skill_name_lower),
        None,
    )

    if not matched:
        registry = await load_skill_registry()
        for code, info in registry.items():
            if str(info.get("package_name", "")).lower() == skill_name_lower:
                matched = next(
                    (s for s in dynamic_skills if s.get("code", "") == code),
                    None,
                )
                if matched:
                    break

    if not matched:
        logger.debug(f"dynamic_config 中未找到 skill: {skill_name}")
        return None

    # SYSTEM source 为系统内置 skill，不走下载流程
    if matched.get("source") == "SYSTEM":
        logger.warning(f"SYSTEM skill '{skill_name}' 未在本地磁盘找到，跳过下载（内置 skill 应已随项目部署）")
        return None

    skill_code = matched.get("code", "")
    skill_version = matched.get("version", "")

    async with dynamic_skill_install_lock:
        registry = await load_skill_registry()
        registry_entry = registry.get(skill_code, {}) if skill_code else {}
        registered_version = registry_entry.get("version", "")
        package_name = registry_entry.get("package_name", "")

        # 版本一致且文件已在磁盘，直接返回
        if package_name and (not skill_version or registered_version == skill_version):
            existing = await _find_skill_case_insensitive(package_name)
            if existing:
                return existing

        # 需要下载（首次安装或版本更新）
        logger.info(f"从 dynamic_config 下载安装 skill: name={matched.get('name')}, id={matched.get('id')}")
        installed_name = await download_and_install_dynamic_skill(matched)
        if not installed_name:
            return None

    # 以 package_name 查找（安装完成后）
    skill = await _find_skill_case_insensitive(installed_name)
    if not skill:
        skill = await _find_skill_case_insensitive(skill_name)
    return skill
