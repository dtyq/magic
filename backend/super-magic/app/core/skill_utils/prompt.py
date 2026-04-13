"""Skills prompt 生成：将可用 skill 元数据渲染为 agent 系统提示片段"""
import asyncio
import concurrent.futures
from pathlib import Path
from typing import List, Optional

from typing import Dict

from agentlang.skills.models import SkillMetadata
from agentlang.skills.loader import SkillLoader
from agentlang.agent.define import SkillsConfig
from agentlang.logger import get_logger
from agentlang.agent.syntax import SyntaxProcessor
from app.utils.async_file_utils import async_exists, async_read_text, async_try_read_text
from app.core.skill_utils.manager import GlobalSkillManager, get_global_skill_manager, find_skill
from app.core.skill_utils.skill_directory_scan import discover_skills_in_directory, discover_skills_in_workspace
from app.core.skill_utils.skill_sources import get_agents_dir, get_system_skills_dir, get_skills_instructions_prompt_file, get_workspace_skills_dir, get_crew_skills_dir
logger = get_logger(__name__)

MAX_SKILLS = 150
MAX_CHARS = 30000


def generate_skills_prompt(
    skills_config: SkillsConfig,
    agent_name: str = "",
) -> Optional[str]:
    """生成 skills prompt（包含指导说明和可用技能列表）

    Args:
        skills_config: 来自 .agent YAML frontmatter 的 skills 完整配置
        agent_name: 当前 agent 类型名称，用于定位 crew skills 目录

    Returns:
        str: 生成的完整 skills prompt，如果失败则返回 None
    """
    if skills_config.is_empty():
        return None

    try:
        def _run_in_thread():
            return asyncio.run(_do_generate(skills_config, agent_name))

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            return executor.submit(_run_in_thread).result()

    except Exception as e:
        logger.error(f"生成 skills prompt 失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None


async def _do_generate(
    skills_config: SkillsConfig,
    agent_name: str,
) -> Optional[str]:
    """在独立事件循环中完成 skills 加载、XML 构建和 prompt 渲染"""
    if agent_name:
        GlobalSkillManager.set_current_agent_type(agent_name)

    skill_manager = get_global_skill_manager()
    loaded_names: set = set()
    skills_metadata: List[SkillMetadata] = []

    # preload 配置独立于加载方式，从顶层 preload 字段统一收集
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
                logger.info(f"扫描追加 system skill: {scanned.name}")
    elif isinstance(skills_config.system_skills, list):
        for entry in skills_config.system_skills:
            if entry.path:
                skill = await _load_skill_from_path(entry.name, Path(entry.path))
            else:
                skill = await skill_manager.get_skill(entry.name, search_path=system_skills_dir)
            if skill:
                skills_metadata.append(skill)
                loaded_names.add(skill.name)
                logger.info(f"加载 system skill: {entry.name}")
            else:
                logger.warning(f"System skill 不存在: {entry.name}")

    # ── 2. crew_skills ───────────────────────────────────────────────────
    if agent_name:
        try:
            crew_skills_dir = get_crew_skills_dir(agent_name)
            if skills_config.crew_skills == "*":
                for crew_skill in await discover_skills_in_directory(crew_skills_dir):
                    if crew_skill.name in loaded_names:
                        skills_metadata = [s for s in skills_metadata if s.name != crew_skill.name]
                        logger.info(f"Crew skill 覆盖同名 system skill: {crew_skill.name}")
                    skills_metadata.append(crew_skill)
                    loaded_names.add(crew_skill.name)
                    logger.info(f"加载 crew skill: {crew_skill.name}")
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
                        logger.info(f"加载 crew skill: {entry.name}")
                    else:
                        logger.warning(f"Crew skill 不存在: {entry.name}")
        except ValueError as e:
            logger.warning(f"当前 agent 标识非法，跳过 crew skills 加载: {e}")

    # ── 3. workspace_skills ──────────────────────────────────────────────
    if skills_config.workspace_skills == "*":
        for ws_skill in await discover_skills_in_workspace():
            if ws_skill.name not in loaded_names:
                skills_metadata.append(ws_skill)
                loaded_names.add(ws_skill.name)
                logger.info(f"扫描追加 workspace skill: {ws_skill.name}")
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
                logger.info(f"加载 workspace skill: {entry.name}")
            else:
                logger.warning(f"Workspace skill 不存在: {entry.name}")

    # ── 3b. 过滤 excluded_skills（仅针对 system 来源，crew/workspace 不受影响）──
    excluded_names = set(skills_config.excluded_skills)
    if excluded_names:
        before_names = {s.name for s in skills_metadata}
        skills_metadata = [s for s in skills_metadata if s.name not in excluded_names]
        actually_excluded = excluded_names & before_names
        if actually_excluded:
            logger.info(f"已排除 {len(actually_excluded)} 个 system skill: {actually_excluded}")

    # ── 3c. 永久挂载 compact-chat-history（excluded_skills 之后追加，确保始终可见）──
    _ALWAYS_MOUNT_SKILL = "compact-chat-history"
    if _ALWAYS_MOUNT_SKILL not in loaded_names:
        compact_skill = await skill_manager.get_skill(_ALWAYS_MOUNT_SKILL, search_path=system_skills_dir)
        if compact_skill:
            skills_metadata.append(compact_skill)
            loaded_names.add(_ALWAYS_MOUNT_SKILL)
            logger.info(f"永久挂载 compact skill: {_ALWAYS_MOUNT_SKILL}")
        else:
            logger.warning(f"永久挂载 skill 未找到，跳过: {_ALWAYS_MOUNT_SKILL}")

    # ── 3d. 补齐 preload 中未被任何来源加载的 skill ──────────────────────
    # preload 不需要在 system_skills 里重复声明，此处自动兜底加载
    for skill_name in preload_map:
        if skill_name in loaded_names:
            continue
        skill = await find_skill(skill_name)
        if skill:
            skills_metadata.append(skill)
            loaded_names.add(skill.name)
            logger.info(f"preload 自动补加载 skill: {skill_name}")
        else:
            logger.warning(f"preload skill 未找到，内容将无法展开: {skill_name}")

    if not skills_metadata:
        logger.warning("未能加载任何 skills")
        return None

    # ── 4. 构建 skills XML ──────────────────────────────────────────────
    if len(skills_metadata) > MAX_SKILLS:
        logger.warning(f"skills 数量超过限制 ({MAX_SKILLS})，已截断")
        skills_metadata = skills_metadata[:MAX_SKILLS]

    skills_xml_parts = []
    total_chars = 0
    for meta in skills_metadata:
        # 已预加载内容的 skill 不再出现在 available_skills 列表中
        if meta.name in preload_map:
            continue

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
            logger.warning(f"skills_content 超过字符限制，已截断，实际输出 {len(skills_xml_parts)} 个")
            break

        skills_xml_parts.append(skill_xml)
        total_chars += len(skill_xml)

    skills_content = "\n\n".join(skills_xml_parts)

    # ── 5. 渲染 prompt 模板 ──────────────────────────────────────────────
    try:
        prompt_file = get_skills_instructions_prompt_file()
        agents_dir = get_agents_dir()

        if not await async_exists(prompt_file):
            logger.error(f"模板文件不存在: {prompt_file}")
            return None

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
                logger.warning(f"无法计算 crew skills 目录: agent_name={agent_name}")
        preloaded_skills_content = await _build_preloaded_skills_xml(
            skills_metadata, preload_map
        )

        syntax_processor.set_variables({
            "skills_content": skills_content,
            "preloaded_skills_content": preloaded_skills_content,
            "system_skills_dir": system_skills_dir,
            "workspace_skills_dir": workspace_skills_dir,
            "crew_skills_dir": crew_skills_dir,
        })

        skills_prompt = syntax_processor.process_dynamic_syntax(template_content)
        logger.info(f"成功生成 {len(skills_metadata)} 个 skills 的 prompt，总长度: {len(skills_prompt)} 字符")
        return skills_prompt

    except Exception as e:
        logger.error(f"使用模板生成 skills prompt 失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None


async def _load_skill_from_path(name: str, path: Path) -> Optional[SkillMetadata]:
    """从自定义目录加载 skill 元数据（path 覆盖默认查找路径）"""
    skills = await asyncio.to_thread(discover_skills_in_directory, path)
    for s in skills:
        if s.name == name:
            return s
    logger.warning(f"在自定义路径 {path} 中未找到 skill: {name}")
    return None


async def _build_preloaded_skills_xml(
    skills_metadata: List[SkillMetadata],
    preload_map: Dict[str, List[str]],
) -> str:
    """构建 <preloaded_skills> XML 块，内容不受 MAX_CHARS 限制。

    每个 skill 对应一个 <skill> 块，其下每个预加载文件对应一个 <file> 子块。
    文件不存在时记录 warning 并跳过，不抛异常。
    """
    if not preload_map:
        return ""

    meta_by_name = {m.name: m for m in skills_metadata}
    skill_parts: List[str] = []

    for skill_name, files in preload_map.items():
        meta = meta_by_name.get(skill_name)
        if not meta:
            logger.warning(f"preload_map 中的 skill 未找到元数据，跳过: {skill_name}")
            continue

        file_blocks: List[str] = []
        for filename in files:
            is_skill_md = filename.upper() == "SKILL.MD"
            if is_skill_md:
                if not meta.skill_dir:
                    logger.warning(f"skill {skill_name} 无 skill_dir，无法读取 SKILL.md")
                    continue
                skill_file_path = meta.skill_file or (meta.skill_dir / "SKILL.md")
                try:
                    loaded = await SkillLoader().load_from_file(skill_file_path)
                    file_content = loaded.content
                    file_path = loaded.skill_file
                except Exception as e:
                    logger.warning(f"preload skill {skill_name} SKILL.md 加载失败: {e}")
                    continue
            else:
                if not meta.skill_dir:
                    logger.warning(f"skill {skill_name} 无 skill_dir，无法读取 {filename}")
                    continue
                file_path = meta.skill_dir / filename
                file_content = await async_try_read_text(file_path)
                if file_content is None:
                    logger.warning(f"preload 文件不存在，跳过: {file_path}")
                    continue

            file_blocks.append(f'<file location="{file_path}">\n{file_content}\n</file>')

        if not file_blocks:
            continue

        parts = [f'<skill name="{skill_name}">']
        if meta.skill_dir:
            parts.append(f"<skill_dir>{meta.skill_dir}</skill_dir>")
        parts.append("")
        parts.extend(file_blocks)
        parts.append(f"</skill>")
        skill_parts.append("\n".join(parts))

    if not skill_parts:
        return ""

    header = (
        "<!--zh\n"
        "preloaded_skills 说明：此块内包含已预加载的 skill 文件内容，这些内容已在系统提示词中，直接使用，无需再调用任何工具。\n"
        "每个 <skill> 块对应一个 skill，<skill_dir> 标明其根目录，<file location=\"...\"> 子块标明已加载的文件及其完整路径。\n"
        "- 某 <skill> 下存在 location 以 /SKILL.md 结尾的 <file>：该 skill 主文档内容已预加载在上方，直接读取即可，无需再调 read_skills（调了也只是重复加载已有内容）\n"
        "  如需该 skill 的其他 reference 文件，查看 SKILL.md 中给出的相对路径，拼接 skill_dir 得到绝对路径，再调 read_files\n"
        "- 某 <skill> 下无 /SKILL.md 结尾的 <file>：仅预加载了 reference 文件，主文档不在当前上下文\n"
        "  需要主文档时，调 read_skills({\"skill_names\": [\"<skill name 属性值>\"]}) 加载\n"
        "-->\n"
        "IMPORTANT: The `<preloaded_skills>` block contains skill files already injected into this system prompt — use them directly.\n"
        "Each `<skill>` block groups all preloaded files for one skill. `<skill_dir>` is the skill's root directory.\n"
        "Each `<file location=\"...\">` sub-block holds the content of one preloaded file at that absolute path.\n"
        "- A `<skill>` that has a `<file>` whose `location` ends with `/SKILL.md`: the full documentation is already in this system prompt above.\n"
        "  No need to call `read_skills` for it — the content is already here (calling it would just reload what is already present).\n"
        "  To load additional reference files, find the relative path in SKILL.md, prepend `<skill_dir>`, and call `read_files`.\n"
        "- A `<skill>` with no `/SKILL.md` `<file>`: only reference files were preloaded; the main documentation is NOT in context yet.\n"
        "  Call `read_skills({\"skill_names\": [\"<name>\"]})` (using the `name` attribute of the `<skill>` tag) to load the full documentation."
    )
    return "<preloaded_skills>\n" + header + "\n\n" + "\n\n".join(skill_parts) + "\n\n</preloaded_skills>"
