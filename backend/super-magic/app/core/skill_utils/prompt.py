"""Skills prompt 生成：将可用 skill 元数据渲染为 agent 系统提示片段"""
import asyncio
import concurrent.futures
from typing import List, Optional

from agentlang.skills.models import SkillMetadata
from agentlang.logger import get_logger
from agentlang.agent.syntax import SyntaxProcessor
from app.utils.async_file_utils import async_exists, async_read_text
from app.core.skill_utils.manager import GlobalSkillManager, get_global_skill_manager
from app.core.skill_utils.skillhub import scan_workspace_skills
from app.core.skill_utils.dynamic_config import load_dynamic_config_skills
from app.core.skill_utils.registry import load_skill_registry

logger = get_logger(__name__)

MAX_SKILLS = 150
MAX_CHARS = 30000


def generate_skills_prompt(skills_list: List[str], agent_name: str = "") -> Optional[str]:
    """生成 skills prompt（包含指导说明和可用技能列表）

    Args:
        skills_list: skills 名称列表
        agent_name: 当前 agent 的类型名称（如 "skill"、"magic"），用于按 agent 隔离
            动态配置 skills；为空时使用 GlobalSkillManager 缓存的当前 agent 类型

    Returns:
        str: 生成的完整 skills prompt，如果失败则返回 None
    """
    if not skills_list:
        return None

    try:
        def _run_in_thread():
            """在新线程中运行独立的事件循环，避免与外层事件循环冲突"""
            return asyncio.run(_do_generate(skills_list, agent_name))

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            return executor.submit(_run_in_thread).result()

    except Exception as e:
        logger.error(f"生成 skills prompt 失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None


async def _do_generate(skills_list: List[str], agent_name: str) -> Optional[str]:
    """在独立事件循环中完成 skills 加载、XML 构建和 prompt 渲染"""
    if agent_name:
        GlobalSkillManager.set_current_agent_type(agent_name)

    # ── 1. 收集 skills 元数据 ──────────────────────────────────────────
    skill_manager = get_global_skill_manager()
    loaded_names: set = set()
    skills_metadata: List[SkillMetadata] = []

    for skill_name in skills_list:
        loaded_skill = await skill_manager.get_skill(skill_name)
        if loaded_skill:
            skills_metadata.append(loaded_skill)
            loaded_names.add(loaded_skill.name)
            logger.info(f"加载 skill: {skill_name}")
        else:
            logger.warning(f"Skill 不存在: {skill_name}")

    # 直接扫描 workspace/skills/ 目录发现用户创建和 skillhub 安装的 skill
    for workspace_skill in await scan_workspace_skills():
        if workspace_skill.name not in loaded_names:
            skills_metadata.append(workspace_skill)
            loaded_names.add(workspace_skill.name)
            logger.info(f"扫描发现并追加 workspace skill: {workspace_skill.name}")

    dynamic_skills = await load_dynamic_config_skills()
    registry = await load_skill_registry()
    for ds in dynamic_skills:
        ds_name = ds.get("name") or ds.get("code", "")
        if not ds_name or ds_name in loaded_names:
            continue
        description = ds.get("description", "")
        ds_code = ds.get("code", "")
        reg_entry = registry.get(ds_code, {}) if ds_code else {}
        pkg_name = reg_entry.get("package_name", "")
        if pkg_name:
            disk_skill = await skill_manager.get_skill(pkg_name)
            if disk_skill and disk_skill.name not in loaded_names:
                skills_metadata.append(disk_skill)
                loaded_names.add(disk_skill.name)
                loaded_names.add(ds_name)
                logger.info(f"从 dynamic_config 追加已安装 skill（磁盘）: {disk_skill.name}")
                continue
        skills_metadata.append(SkillMetadata(name=ds_name, description=description))
        loaded_names.add(ds_name)
        logger.info(f"从 dynamic_config 追加 skill 元数据（未安装）: {ds_name}")

    if not skills_metadata:
        logger.warning(f"未能加载任何 skills，skills_list: {skills_list}")
        return None

    # ── 2. 构建 skills XML 内容 ─────────────────────────────────────────
    if len(skills_metadata) > MAX_SKILLS:
        logger.warning(f"skills 数量 ({len(skills_metadata)}) 超过限制 ({MAX_SKILLS})，截断到前 {MAX_SKILLS} 个")
        skills_metadata = skills_metadata[:MAX_SKILLS]

    skills_xml_parts = []
    total_chars = 0
    for skill_metadata in skills_metadata:
        parts = [
            "<skill>\n",
            f"<name>{skill_metadata.name}</name>\n",
            f"<description>{skill_metadata.description}</description>\n",
        ]
        location = skill_metadata.skill_file or skill_metadata.skill_dir
        if location:
            parts.append(f"<location>{location}</location>\n")
        parts.append("</skill>")
        skill_xml = "".join(parts)

        if total_chars + len(skill_xml) > MAX_CHARS:
            logger.warning(
                f"skills_content 超过字符限制 ({MAX_CHARS})，"
                f"已截断，实际输出 {len(skills_xml_parts)} 个 skills"
            )
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

    # ── 3. 渲染 prompt 模板 ─────────────────────────────────────────────
    try:
        project_root = GlobalSkillManager.get_project_root()
        agents_dir = project_root / "agents"
        prompt_file = agents_dir / "prompts" / "skills_instructions.prompt"

        if not await async_exists(prompt_file):
            logger.error(f"模板文件不存在: {prompt_file}")
            return None

        template_content = await async_read_text(prompt_file)

        syntax_processor = SyntaxProcessor(agents_dir=agents_dir)
        syntax_processor.set_variables({
            "mcp_notice": mcp_notice,
            "skills_content": skills_content,
        })

        skills_prompt = syntax_processor.process_dynamic_syntax(template_content)
        logger.info(f"成功生成 {len(skills_metadata)} 个 skills 的完整 prompt，总长度: {len(skills_prompt)} 字符")
        return skills_prompt

    except Exception as e:
        logger.error(f"使用模板生成 skills prompt 失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None
