"""Skills prompt 生成：将可用 skill 元数据渲染为 agent 系统提示片段"""
import asyncio
import concurrent.futures
from pathlib import Path
from typing import List, Optional

from agentlang.skills.models import SkillMetadata
from agentlang.agent.define import SkillsConfig
from agentlang.logger import get_logger
from agentlang.agent.syntax import SyntaxProcessor
from app.utils.async_file_utils import async_exists, async_read_text
from app.core.skill_utils.manager import GlobalSkillManager, get_global_skill_manager
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

    system_skills_dir = get_system_skills_dir()

    # ── 1. system_skills：按条目逐一加载，支持 path 覆盖 ────────────────
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

    # ── 1b. system_skills_scan="*"：全量扫描 agents/skills/ ──────────────
    if skills_config.system_skills_scan == "*":
        for scanned in await discover_skills_in_directory(system_skills_dir):
            if scanned.name not in loaded_names:
                skills_metadata.append(scanned)
                loaded_names.add(scanned.name)
                logger.info(f"全量扫描追加 system skill: {scanned.name}")

    # ── 2. crew_skills：扫描 crew 私有 skills 目录，同名覆盖 system ────
    if skills_config.crew_skills == "*" and agent_name:
        try:
            crew_skills_dir = get_crew_skills_dir(agent_name)
            for crew_skill in await discover_skills_in_directory(crew_skills_dir):
                if crew_skill.name in loaded_names:
                    skills_metadata = [s for s in skills_metadata if s.name != crew_skill.name]
                    logger.info(f"Crew skill 覆盖同名 system skill: {crew_skill.name}")
                skills_metadata.append(crew_skill)
                loaded_names.add(crew_skill.name)
                logger.info(f"加载 crew skill: {crew_skill.name}")
        except ValueError as e:
            logger.warning(f"当前 agent 标识非法，跳过 crew skills 扫描: {e}")

    # ── 3. workspace_skills：整目录扫描 ─────────────────────────────────
    if skills_config.workspace_skills == "*":
        for ws_skill in await discover_skills_in_workspace():
            if ws_skill.name not in loaded_names:
                skills_metadata.append(ws_skill)
                loaded_names.add(ws_skill.name)
                logger.info(f"扫描追加 workspace skill: {ws_skill.name}")

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

    has_using_mcp = any(m.name == "using-mcp" for m in skills_metadata)
    mcp_notice = (
        "IMPORTANT: This agent has MCP servers available. You MUST load and read the "
        "'using-mcp' skill to learn how to use MCP tools. Do NOT attempt to call MCP "
        "tools before reading the skill documentation."
        if has_using_mcp else ""
    )

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
        syntax_processor.set_variables({
            "mcp_notice": mcp_notice,
            "skills_content": skills_content,
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
