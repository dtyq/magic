"""读取员工技能引用；首次使用时安装到员工的本地目录。"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from weakref import WeakValueDictionary
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext
    from agentlang.context.tool_context import ToolContext
    from agentlang.skills.models import SkillMetadata

from app.core.skill_utils.skill_sources import get_crew_skills_dir
from app.path_manager import PathManager
from app.utils.async_file_utils import async_exists, async_read_markdown, async_try_read_json


@dataclass(frozen=True)
class MarketSkillReference:
    code: str
    description: str


_locks: WeakValueDictionary[tuple[str, str], asyncio.Lock] = WeakValueDictionary()


async def load_market_references(agent_name: str) -> dict[str, MarketSkillReference]:
    # A Crew's missing/empty declaration must not import another employee's workspace refs.
    if agent_name.startswith("SMA-"):
        path = PathManager.get_crew_agent_dir(agent_name) / "SKILLS.md"
    else:
        path = PathManager.get_magic_dir() / "SKILLS.md"
    if not await async_exists(path):
        return {}
    import yaml

    try:
        markdown = await async_read_markdown(path)
    except (OSError, ValueError, yaml.YAMLError):
        return {}
    if not isinstance(markdown.meta, dict):
        return {}
    entries = markdown.meta.get("market_skills", [])
    if not isinstance(entries, list):
        return {}
    references = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        name, code = entry.get("name"), entry.get("code")
        if not isinstance(name, str) or not isinstance(code, str) or not name.strip() or not code.strip():
            continue
        from app.core.skill_utils.safe_download import validate_package_name

        try:
            validate_package_name(name)
        except ValueError:
            continue
        description = entry.get("description", "")
        references[name] = MarketSkillReference(code.strip(), description if isinstance(description, str) else "")
    return references


async def is_current_reference_skill(skill: SkillMetadata, agent_name: str) -> bool:
    """已移除或换绑同名技能时忽略旧缓存；手动目录和历史实体不受影响。"""
    from app.core.skill_utils.manifest import MANIFEST_FILENAME

    if skill.skill_dir is None:
        return True
    manifest = await async_try_read_json(skill.skill_dir / MANIFEST_FILENAME)
    if not isinstance(manifest, dict) or manifest.get("installed_by") != "market_reference":
        return True
    references = await load_market_references(agent_name)
    reference = next((ref for name, ref in references.items() if name.casefold() == skill.name.casefold()), None)
    return reference is not None and reference.code == manifest.get("source_id")


async def install_market_reference(
    skill_name: str, agent_name: str, agent_context: AgentContext | None, tool_context: ToolContext | None
) -> bool:
    """返回是否声明该技能；声明存在但拉取失败时抛出明确的错误。"""
    from app.core.skill_utils.manager import find_skill
    from app.core.skill_utils.installer import InstallService, SkillRef
    from app.core.skill_utils.providers.my_library import MyLibraryProvider

    references = await load_market_references(agent_name)
    match = next(((name, ref) for name, ref in references.items() if name.casefold() == skill_name.casefold()), None)
    if match is None:
        return False
    from app.tools.core.tool_keepalive import start_tool_keep_alive, stop_tool_keep_alive

    name, reference = match
    if not agent_name:
        raise RuntimeError(f"Skill '{name}' is declared but cannot be fetched without an agent context.")
    target_dir = get_crew_skills_dir(agent_name)
    key = (str(target_dir), reference.code)
    lock = _locks.setdefault(key, asyncio.Lock())

    async def install():
        async with lock:
            if await find_skill(name, agent_name=agent_name):
                return
            agent_code = agent_context.get_agent_code() if agent_context is not None else None
            provider = MyLibraryProvider(
                agent_code=agent_code, agent_draft=agent_name == "crew-creator", expected_name=name
            )
            from app.core.skill_utils.manifest import MANIFEST_FILENAME

            manifest = await async_try_read_json(target_dir / name / MANIFEST_FILENAME)
            mode = (
                "upgrade"
                if isinstance(manifest, dict) and manifest.get("installed_by") == "market_reference"
                else "install"
            )
            results = await InstallService(target_dir=target_dir, installed_by="market_reference").install(
                SkillRef(provider="my_library", id=reference.code, mode=mode),
                provider=provider,
            )
            if not any(result.ok and result.name == name for result in results):
                raise RuntimeError(
                    f"Skill '{name}' is declared but could not be fetched. Access may have changed or the package may be unavailable."
                )

    keep_alive = start_tool_keep_alive(tool_context)
    work = asyncio.create_task(install())
    interruption = (
        asyncio.create_task(agent_context.get_interruption_event().wait()) if agent_context is not None else None
    )
    try:
        if interruption is None:
            await work
        else:
            await asyncio.wait([work, interruption], return_when=asyncio.FIRST_COMPLETED)
            if interruption.done():
                raise asyncio.CancelledError()
            await work
        return True
    finally:
        work.cancel()
        if interruption is not None:
            interruption.cancel()
        await asyncio.gather(work, *([interruption] if interruption is not None else []), return_exceptions=True)
        stop_tool_keep_alive(keep_alive)
