"""Render available skill metadata into the agent system prompt."""
import asyncio
import concurrent.futures
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

from typing import Dict

from agentlang.skills.models import SkillMetadata
from agentlang.skills.loader import SkillLoader
from agentlang.agent.define import SkillsConfig
from agentlang.logger import get_logger
from agentlang.agent.syntax import SyntaxProcessor
from agentlang.environment import Environment
from agentlang.utils.token_estimator import num_tokens_from_string
from app.core.skill_utils.constants import SKILL_MAX_TOKENS, SKILL_READ_LIMIT_NOTICE
from app.utils.async_file_utils import async_exists, async_read_text, async_try_read_text
from app.core.skill_utils.runtime_policy import normalize_preload_path
from app.core.skill_utils.manager import GlobalSkillManager, get_global_skill_manager, find_skill
from app.core.skill_utils.skill_directory_scan import (
    discover_skills_in_directory,
    discover_skills_in_personal,
    discover_skills_in_workspace,
)
from app.core.skill_utils.skill_sources import get_agents_dir, get_system_skills_dir, get_skills_instructions_prompt_file, get_workspace_skills_dir, get_crew_skills_dir
logger = get_logger(__name__)

MAX_SKILLS = 150
MAX_CHARS = 30000


@dataclass
class SkillSources:
    """
    两类消费者共用同一发现结果：日常 Agent 预加载主文，后台维护再读取同来源的 reference。
    不根据 Skill 名称另找一份系统副本，否则自定义覆盖的主文和默认 reference 可能不一致。
    """
    metadata: list[SkillMetadata]
    region_filtered_names: list[str]


@dataclass(frozen=True)
class PreloadedSkillFile:
    """保存实际进入 system prompt 的源文本，不能用后来的磁盘内容冒充已读版本。"""
    path: Path
    source_content: str


@dataclass
class SkillPromptResult:
    """
    配置声明和实际加载分开：后续能力只使用真正生成成功的说明。
    MOCK DEMO：memory 的 SKILL.md 不可读 -> disabled_names 包含它；其它 Skill 照常返回。
    """
    content: str = ""
    loaded_names: list[str] = field(default_factory=list)
    disabled_names: list[str] = field(default_factory=list)
    preloaded_content: str = ""
    preloaded_files: tuple[Path, ...] = ()
    preloaded_file_contents: tuple[PreloadedSkillFile, ...] = ()


@dataclass
class PreloadedSkillsResult:
    """
    loaded_files 记录真正交付的文件，不是配置里「打算加载」的文件。
    只有 SKILL.md 确实展开后才从可发现列表移除该 Skill，避免主文没加载却也找不到入口。
    """
    content: str
    loaded_files: dict[str, tuple[str, ...]]
    disabled_names: list[str]
    preloaded_files: tuple[Path, ...] = ()
    read_notices: tuple[str, ...] = ()
    preloaded_file_contents: tuple[PreloadedSkillFile, ...] = ()


def generate_skills_prompt(
    skills_config: SkillsConfig,
    agent_name: str = "",
    required_preloads: dict[str, tuple[str, ...]] | None = None,
) -> SkillPromptResult:
    """Generate the skills prompt with instructions and available skill metadata.

    Args:
        skills_config: Complete skills config from the .agent YAML frontmatter.
        agent_name: Current agent type, used to locate crew skill directories.

    Returns:
        Framework instructions, raw preload content, paths, and loaded or disabled skill names.
    """
    try:
        def _run_in_thread() -> SkillPromptResult:
            return asyncio.run(_do_generate(skills_config, agent_name, required_preloads))

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            return executor.submit(_run_in_thread).result()

    except Exception as e:
        logger.error(f"Failed to generate skills prompt: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return SkillPromptResult(disabled_names=list(required_preloads or {}))


async def resolve_skills_metadata(skills_config: SkillsConfig, agent_name: str) -> SkillSources:
    """
    保留原有来源顺序和目录容错，供日常 preload 和后台 reference 选择同一份 Skill。
    preload 补载发生在最终过滤之前，防止已排除或地区不可用的 Skill 被补载重新放回。
    """
    from app.core.skill_utils.skill_references import load_market_references

    references = await load_market_references(agent_name)
    personal_skills = await discover_skills_in_personal()

    # Personal Skills are an independent source. Keep the prompt when they exist even if
    # the Agent frontmatter does not explicitly configure system, Crew, or workspace Skills.
    if skills_config.is_empty() and not personal_skills and not references:
        return SkillSources([], [])

    if agent_name:
        GlobalSkillManager.set_current_agent_type(agent_name)

    skill_manager = get_global_skill_manager()
    loaded_names: set = set()
    skills_metadata: List[SkillMetadata] = []

    # Preload config is independent of loading mode and is collected from the top-level preload field.
    preload_map: Dict[str, List[str]] = {
        entry.name: entry.files for entry in skills_config.preload
    }

    system_skills_dir = get_system_skills_dir()

    # ── 1. system_skills ─────────────────────────────────────────────────
    if skills_config.system_skills == "*":
        for scanned in await discover_skills_in_directory(system_skills_dir):
            if scanned.name not in loaded_names:
                skills_metadata.append(scanned)
                loaded_names.add(scanned.name)
                logger.info(f"Scanned and appended system skill: {scanned.name}")
    elif isinstance(skills_config.system_skills, list):
        for entry in skills_config.system_skills:
            if entry.path:
                skill = await _load_skill_from_path(entry.name, Path(entry.path))
            else:
                skill = await skill_manager.get_skill(entry.name, search_path=system_skills_dir)
            if skill:
                skills_metadata.append(skill)
                loaded_names.add(skill.name)
                logger.info(f"Loaded system skill: {entry.name}")
            else:
                logger.warning(f"System skill not found: {entry.name}")

    # ── 2. crew_skills ───────────────────────────────────────────────────
    if agent_name:
        try:
            crew_skills_dir = get_crew_skills_dir(agent_name)
            if skills_config.crew_skills == "*":
                for crew_skill in await discover_skills_in_directory(crew_skills_dir):
                    if crew_skill.name in loaded_names:
                        skills_metadata = [s for s in skills_metadata if s.name != crew_skill.name]
                        logger.info(f"Crew skill overrides same-named system skill: {crew_skill.name}")
                    skills_metadata.append(crew_skill)
                    loaded_names.add(crew_skill.name)
                    logger.info(f"Loaded crew skill: {crew_skill.name}")
            elif isinstance(skills_config.crew_skills, list):
                for entry in skills_config.crew_skills:
                    if entry.path:
                        skill = await _load_skill_from_path(entry.name, Path(entry.path))
                    else:
                        skill = await skill_manager.get_skill(entry.name, search_path=crew_skills_dir)
                    if skill:
                        if skill.name in loaded_names:
                            skills_metadata = [s for s in skills_metadata if s.name != skill.name]
                        skills_metadata.append(skill)
                        loaded_names.add(skill.name)
                        logger.info(f"Loaded crew skill: {entry.name}")
                    else:
                        logger.warning(f"Crew skill not found: {entry.name}")
        except ValueError as e:
            logger.warning(f"Invalid current agent identifier; skipping crew skills: {e}")

    # ── 3. workspace_skills ──────────────────────────────────────────────
    if skills_config.workspace_skills == "*":
        for ws_skill in await discover_skills_in_workspace():
            if ws_skill.name not in loaded_names:
                skills_metadata.append(ws_skill)
                loaded_names.add(ws_skill.name)
                logger.info(f"Scanned and appended workspace skill: {ws_skill.name}")
    elif isinstance(skills_config.workspace_skills, list):
        ws_skills_dir = get_workspace_skills_dir()
        for entry in skills_config.workspace_skills:
            if entry.path:
                skill = await _load_skill_from_path(entry.name, Path(entry.path))
            else:
                skill = await skill_manager.get_skill(entry.name, search_path=ws_skills_dir)
            if skill:
                if skill.name not in loaded_names:
                    skills_metadata.append(skill)
                    loaded_names.add(skill.name)
                logger.info(f"Loaded workspace skill: {entry.name}")
            else:
                logger.warning(f"Workspace skill not found: {entry.name}")

    # ── 3a. personal_skills: independent of workspace_skills config. ───────
    for personal_skill in personal_skills:
        if personal_skill.name not in loaded_names:
            skills_metadata.append(personal_skill)
            loaded_names.add(personal_skill.name)
            logger.info(f"Scanned and appended personal skill: {personal_skill.name}")

    # Ignore stale market-reference downloads and expose declared references so
    # ReadSkills can install a missing skill on first use.
    from app.core.skill_utils.skill_references import is_current_reference_skill

    skills_metadata = [
        skill for skill in skills_metadata
        if await is_current_reference_skill(skill, agent_name)
    ]
    loaded_names = {skill.name for skill in skills_metadata}
    loaded_name_keys = {name.casefold() for name in loaded_names}
    for name, reference in references.items():
        if name.casefold() in loaded_name_keys:
            continue
        disk_skill = await find_skill(name, agent_name=agent_name)
        skills_metadata.append(
            disk_skill or SkillMetadata(name=name, description=reference.description)
        )
        loaded_names.add(name)
        loaded_name_keys.add(name.casefold())

    """
    ── 3e. Load skills referenced by preload but not loaded from any source. ──────────────────────
    Preloaded skills do not need duplicate system_skills declarations; this is the fallback load.
    """
    for skill_name in preload_map:
        if skill_name in loaded_names:
            continue
        skill = await find_skill(skill_name)
        if skill:
            skills_metadata.append(skill)
            loaded_names.add(skill.name)
            logger.info(f"Auto-loaded preloaded skill: {skill_name}")
        else:
            logger.warning(f"Preloaded skill not found; content cannot be expanded: {skill_name}")

    # ── 3b. Region filtering: hide international-platform skills in mainland environments. ──
    region_filtered_names: list[str] = []
    if Environment.is_mainland():
        region_filtered_names = [s.name for s in skills_metadata if s.region == "international"]
        if region_filtered_names:
            skills_metadata = [s for s in skills_metadata if s.region != "international"]
            logger.info(f"Filtered {len(region_filtered_names)} international skills in mainland environment: {region_filtered_names}")

    # ── 3c. Filter excluded_skills after all configured and personal sources are loaded. ──
    excluded_names = set(skills_config.excluded_skills)
    if excluded_names:
        before_names = {s.name for s in skills_metadata}
        skills_metadata = [s for s in skills_metadata if s.name not in excluded_names]
        actually_excluded = excluded_names & before_names
        if actually_excluded:
            logger.info(f"Excluded {len(actually_excluded)} system skills: {actually_excluded}")

    # Context compaction relies on this fallback skill even when an agent omits
    # it from frontmatter, so keep it discoverable after normal exclusions.
    always_mount = "compact-chat-history"
    if always_mount not in {skill.name for skill in skills_metadata}:
        compact_skill = await skill_manager.get_skill(always_mount, search_path=system_skills_dir)
        if compact_skill:
            skills_metadata.append(compact_skill)
            loaded_names.add(always_mount)
            logger.info(f"Always mounted compact skill: {always_mount}")

    if not skills_metadata:
        logger.warning("No skills were loaded")
        return SkillSources([], [])

    return SkillSources(skills_metadata, region_filtered_names)


async def _do_generate(
    skills_config: SkillsConfig,
    agent_name: str,
    required_preloads: dict[str, tuple[str, ...]] | None = None,
) -> SkillPromptResult:
    sources = await resolve_skills_metadata(skills_config, agent_name)
    skills_metadata = sources.metadata
    region_filtered_names = sources.region_filtered_names
    preload_map = {entry.name: entry.files for entry in skills_config.preload}
    required = required_preloads or {}
    # ── 4. Build skills XML ──────────────────────────────────────────────
    if len(skills_metadata) > MAX_SKILLS:
        logger.warning(f"Skill count exceeds limit ({MAX_SKILLS}); truncating")
        skills_metadata = skills_metadata[:MAX_SKILLS]

    preload_result = await _build_preloaded_skills_xml(skills_metadata, preload_map, required)
    skills_metadata = [meta for meta in skills_metadata if meta.name not in preload_result.disabled_names]
    if not skills_metadata:
        return SkillPromptResult(disabled_names=list(required))
    skills_xml_parts = []
    total_chars = 0
    degraded = False
    for meta in skills_metadata:
        # Skills whose content is preloaded do not appear in the available_skills list.
        if "SKILL.md" in preload_result.loaded_files.get(meta.name, ()):
            continue

        if not degraded:
            # Full mode: include name, description, and location.
            parts = [
                "<skill>\n",
                f"<name>{meta.name}</name>\n",
                f"<description>{meta.description}</description>\n",
            ]
            location = meta.skill_file or meta.skill_dir
            if location:
                parts.append(f"<location>{location}</location>\n")
            parts.append("</skill>")
            skill_xml = "".join(parts)

            if total_chars + len(skill_xml) > MAX_CHARS:
                # Degraded mode: output names only.
                degraded = True
                logger.warning(
                    f"skills_content reached the character limit ({MAX_CHARS}); "
                    f"emitted {len(skills_xml_parts)} full skills, remaining skills degrade to name only"
                )

        if degraded:
            # Degraded mode keeps only the name to save tokens.
            skill_xml = f"<skill>\n<name>{meta.name}</name>\n</skill>"

        skills_xml_parts.append(skill_xml)
        total_chars += len(skill_xml)

    skills_content = "\n\n".join(skills_xml_parts)

    # ── 5. Render prompt template ──────────────────────────────────────────────
    try:
        prompt_file = get_skills_instructions_prompt_file()
        agents_dir = get_agents_dir()

        if not await async_exists(prompt_file):
            logger.error(f"Prompt template file does not exist: {prompt_file}")
            return SkillPromptResult(disabled_names=list(required))

        template_content = await async_read_text(prompt_file)
        syntax_processor = SyntaxProcessor(agents_dir=agents_dir)
        from app.path_manager import PathManager
        project_root = PathManager.get_project_root()
        workspace_dir = PathManager.get_workspace_dir()
        system_skills_dir = str(get_system_skills_dir().relative_to(project_root))
        workspace_skills_dir = str(get_workspace_skills_dir().relative_to(workspace_dir))
        crew_skills_dir = ""
        if agent_name:
            try:
                crew_skills_dir = str(get_crew_skills_dir(agent_name).relative_to(project_root))
            except (ValueError, Exception):
                logger.warning(f"Failed to resolve crew skills directory: agent_name={agent_name}")
        syntax_processor.set_variables({
            "skills_content": skills_content,
            "system_skills_dir": system_skills_dir,
            "workspace_skills_dir": workspace_skills_dir,
            "crew_skills_dir": crew_skills_dir,
        })

        skills_prompt = syntax_processor.process_dynamic_syntax(template_content)
        logger.info(f"Generated skills prompt with {len(skills_metadata)} skills; total length: {len(skills_prompt)} characters")

        # ── 6. Mainland SaaS environment: inject international-platform guidance. ──
        if region_filtered_names:
            from app.utils.deployment_util import is_saas_deployment, SAAS_INTERNATIONAL_SITE_URL
            if is_saas_deployment():
                filtered_list = ", ".join(region_filtered_names)
                notice = (
                    "\n\n<region_notice>\n"
                    f"The following skills are only available in the international version and are not supported in the current environment: {filtered_list}\n"
                    "When a user requests content from these platforms, politely explain that the current environment does not support them, "
                    f"and suggest visiting the international site ({SAAS_INTERNATIONAL_SITE_URL}) to use these features.\n"
                    "</region_notice>"
                )
                skills_prompt += notice
                logger.info(f"Injected SaaS international-platform guidance for skills: {region_filtered_names}")

        if not skills_prompt or not skills_prompt.strip():
            return SkillPromptResult(disabled_names=list(required))
        return SkillPromptResult(
            content=skills_prompt + ("\n\n" + "\n\n".join(preload_result.read_notices) if preload_result.read_notices else ""),
            loaded_names=[meta.name for meta in skills_metadata],
            disabled_names=preload_result.disabled_names,
            preloaded_content=preload_result.content,
            preloaded_files=preload_result.preloaded_files,
            preloaded_file_contents=preload_result.preloaded_file_contents,
        )

    except Exception as e:
        logger.error(f"Failed to generate skills prompt from template: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return SkillPromptResult(disabled_names=list(required))


async def _load_skill_from_path(name: str, path: Path) -> Optional[SkillMetadata]:
    """Load skill metadata from a custom directory that overrides default lookup paths."""
    skills = await discover_skills_in_directory(path)
    for s in skills:
        if s.name == name:
            return s
    logger.warning(f"Skill not found in custom path {path}: {name}")
    return None


async def _build_preloaded_skills_xml(
    skills_metadata: List[SkillMetadata],
    preload_map: Dict[str, List[str]],
    required_preloads: dict[str, tuple[str, ...]] | None = None,
) -> PreloadedSkillsResult:
    """Build the <preloaded_skills> XML block, not constrained by MAX_CHARS.

    Each skill maps to a <skill> block, and each preloaded file becomes one
    <file> child block. Missing files are logged and skipped instead of raising.
    """
    required = required_preloads or {}
    """
    可选文件缺失只跳过该文件；必需文件缺失会停用整个 Skill，但不终止主 Agent。
    例：某 Skill 的参考例子没找到，主文仍可用；memory 的必需主文没读到，则不能自动维护。
    """
    loaded_files: dict[str, tuple[str, ...]] = {}
    if not preload_map:
        return PreloadedSkillsResult("", loaded_files, list(required))

    meta_by_name = {m.name: m for m in skills_metadata}
    skill_parts: List[str] = []
    preloaded_files: list[Path] = []
    preloaded_file_contents: list[PreloadedSkillFile] = []
    notices: list[str] = []

    for skill_name, files in preload_map.items():
        meta = meta_by_name.get(skill_name)
        if not meta:
            logger.warning(f"Skill metadata missing for preload_map entry; skipping: {skill_name}")
            continue

        file_blocks: List[str] = []
        successful: list[str] = []
        successful_paths: list[Path] = []
        successful_contents: list[PreloadedSkillFile] = []
        for filename in files:
            try:
                filename = normalize_preload_path(filename)
            except ValueError as error:
                logger.warning(f"Invalid preload path for {skill_name}: {error}")
                continue
            if filename in successful:
                continue
            is_skill_md = filename.upper() == "SKILL.MD"
            if is_skill_md:
                if not meta.skill_dir:
                    logger.warning(f"Skill {skill_name} has no skill_dir; cannot read SKILL.md")
                    continue
                skill_file_path = meta.skill_file or (meta.skill_dir / "SKILL.md")
                try:
                    loaded = await SkillLoader().load_from_file(skill_file_path)
                    if not loaded.enabled or (Environment.is_mainland() and loaded.region == "international"):
                        logger.warning(f"Preloaded skill is disabled or unavailable in this region: {skill_name}")
                        continue
                    file_path = skill_file_path
                except Exception as e:
                    logger.warning(f"Failed to load preloaded SKILL.md for {skill_name}: {e}")
                    continue
            else:
                if not meta.skill_dir:
                    logger.warning(f"Skill {skill_name} has no skill_dir; cannot read {filename}")
                    continue
                file_path = meta.skill_dir / filename
            file_content = await async_try_read_text(file_path)
            if file_content is None:
                logger.warning(f"Preload file could not be read; skipping: {file_path}")
                continue
            if is_skill_md and num_tokens_from_string(file_content) > SKILL_MAX_TOKENS:
                notices.append(
                    f"Skill '{skill_name}' ({file_path}) was not preloaded. {SKILL_READ_LIMIT_NOTICE}"
                )
                continue

            if not file_content or not file_content.strip():
                logger.warning(f"Preloaded file is empty: {file_path}")
                continue
            successful.append(filename)
            file_blocks.append(f'<file location="{file_path}">\n{file_content}\n</file>')
            successful_paths.append(file_path)
            successful_contents.append(PreloadedSkillFile(file_path, file_content))

        loaded_files[skill_name] = tuple(successful)
        # 先记录真实读取结果，再判断是否交付这一整项 Skill；不能以目录存在或配置声明代替成功。
        if not set(required.get(skill_name, ())).issubset(successful):
            continue
        if not file_blocks:
            continue

        parts = [f'<skill name="{skill_name}">']
        if meta.skill_dir:
            parts.append(f"<skill_dir>{meta.skill_dir}</skill_dir>")
        parts.append("")
        parts.extend(file_blocks)
        parts.append(f"</skill>")
        skill_parts.append("\n".join(parts))
        preloaded_files.extend(successful_paths)
        preloaded_file_contents.extend(successful_contents)

    disabled = [name for name, files in required.items() if not set(files).issubset(loaded_files.get(name, ()))]
    if not skill_parts:
        return PreloadedSkillsResult("", loaded_files, disabled, read_notices=tuple(notices))

    header = (
        "IMPORTANT: The `<preloaded_skills>` block contains skill files already injected into this system prompt — use them directly.\n"
        "Each `<skill>` block groups all preloaded files for one skill. `<skill_dir>` is the skill's root directory.\n"
        "Each `<file location=\"...\">` sub-block holds the content of one preloaded file at that absolute path.\n"
        "- A `<skill>` that has a `<file>` whose `location` ends with `/SKILL.md`: the full documentation is already in this system prompt above.\n"
        "  No need to call `read_skills` for it — the content is already here (calling it would just reload what is already present).\n"
        "  To load additional reference files, find the relative path in SKILL.md, prepend `<skill_dir>`, and call `read_files`.\n"
        "- A `<skill>` with no `/SKILL.md` `<file>`: only reference files were preloaded; the main documentation is NOT in context yet.\n"
        "  Call `read_skills({\"skill_names\": [\"<name>\"]})` (using the `name` attribute of the `<skill>` tag) to load the full documentation."
    )
    content = "<preloaded_skills>\n" + header + "\n\n" + "\n\n".join(skill_parts) + "\n\n</preloaded_skills>"
    return PreloadedSkillsResult(
        content, loaded_files, disabled, tuple(dict.fromkeys(preloaded_files)), tuple(notices),
        tuple(preloaded_file_contents),
    )
