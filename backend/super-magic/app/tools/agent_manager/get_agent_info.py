"""get_agent_info - 获取指定 Agent 的详情信息"""

import json
import os
import zipfile
import tempfile
from pathlib import Path
from typing import Optional

import httpx
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from agentlang.utils.shadow_code import ShadowCode
from app.tools.core import BaseTool, BaseToolParams, tool
from app.paths import PathManager
from app.infrastructure.sdk.magic_service.result.agent_openapi_result import get_i18n_text
from app.i18n import i18n

logger = get_logger(__name__)


async def _download_and_extract_skill(url: str, skill_dir: Path) -> None:
    """Download a skill zip from URL and extract it to skill_dir.

    The zip is expected to contain a top-level folder named after the skill
    (e.g. my-skill/SKILL.md). We extract into skill_dir.parent so the folder
    unpacks naturally as skill_dir itself. If the zip has no top-level folder
    (bare SKILL.md at root), we fall back to extracting directly into skill_dir.
    """
    skill_dir.mkdir(parents=True, exist_ok=True)

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".zip")
    os.close(tmp_fd)
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
            response = await client.get(url)
            response.raise_for_status()
            with open(tmp_path, "wb") as f:
                f.write(response.content)

        with zipfile.ZipFile(tmp_path, "r") as zf:
            names = zf.namelist()
            # Check whether all entries share a common top-level directory
            top_dirs = {n.split("/")[0] for n in names if n}
            if len(top_dirs) == 1:
                # zip has a top-level folder → extract into parent so it unpacks as skill_dir
                zf.extractall(str(skill_dir.parent))
            else:
                # bare files at root → extract directly into skill_dir
                zf.extractall(str(skill_dir))
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass


class GetAgentInfoParams(BaseToolParams):
    """GetAgentInfo 工具参数"""
    agent_code: Optional[str] = Field(
        default=None,
        description="""<!--zh: 要查询的 Agent 编码。如不提供，则使用当前会话的 agent_code。
Agent code to query. If not provided, uses the current session's agent_code.-->"""
    )


@tool()
class GetAgentInfo(BaseTool[GetAgentInfoParams]):
    """<!--zh
    获取指定自定义 Agent 的详情信息，包括名称、描述、提示词（明文）、已绑定的技能列表。
    调用后会将 Agent 信息缓存到本地 .agent_studio 目录。
    -->
    Get details of a custom agent, including name, description, prompt (plaintext),
    and bound skills. Caches agent info to local .agent_studio directory.
    """

    def _get_remark_content(self, result: ToolResult, arguments=None) -> str:
        if result.ok:
            return i18n.translate("agent_manager.get_info_success", category="tool.messages")
        return ""

    async def execute(self, tool_context: ToolContext, params: GetAgentInfoParams) -> ToolResult:
        from app.core.context.agent_context import AgentContext
        from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
        from app.infrastructure.sdk.magic_service.parameter.get_agent_openapi_parameter import GetAgentOpenApiParameter
        from app.infrastructure.sdk.magic_service.parameter.get_skill_file_urls_parameter import GetSkillFileUrlsParameter

        # Resolve agent_code
        agent_code = params.agent_code
        if not agent_code:
            agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
            if agent_context:
                agent_code = agent_context.get_agent_code()

        if not agent_code:
            return ToolResult(ok=False, content=i18n.translate("agent_manager.agent_code_not_found", category="tool.messages"))

        try:
            sdk = get_magic_service_sdk()
            parameter = GetAgentOpenApiParameter(code=agent_code)
            result = await sdk.agent.get_agent_by_code_async(parameter)

            # Unshadow prompt
            prompt_plaintext = None
            if result.prompt:
                prompt_string = result.get_prompt_string()
                if prompt_string:
                    try:
                        prompt_plaintext = ShadowCode.unshadow(prompt_string)
                    except Exception as e:
                        logger.warning(f"Prompt unshadow failed: {e}")
                        prompt_plaintext = prompt_string

            # Build local cache
            agent_dir = PathManager.get_agent_studio_dir(agent_code)
            agent_info = {
                "id": result.id,
                "code": result.code,
                "name": result.name,
                "name_i18n": result.name_i18n,
                "description": result.description,
                "description_i18n": result.description_i18n,
                "role_i18n": result.role_i18n,
                "icon": result.icon,
                "icon_type": result.icon_type,
                "prompt": {
                    "version": result.get_prompt_version() or "1.0.0",
                    "structure": {
                        "string": prompt_plaintext or ""
                    }
                },
                "prompt_shadow_raw": result.get_prompt_string(),
                "enabled": result.enabled,
                "source_type": result.source_type,
                "skills": [s.to_dict() for s in result.skills],
                "created_at": result.created_at,
                "updated_at": result.updated_at,
            }

            agent_json_path = agent_dir / "agent.json"
            agent_json_path.write_text(json.dumps(agent_info, ensure_ascii=False, indent=2), encoding="utf-8")

            # Download skill zips that are not already cached locally
            skills_downloaded = []
            skills_skipped = []
            if result.skills:
                skill_ids = result.get_skill_ids()
                if skill_ids:
                    try:
                        urls_param = GetSkillFileUrlsParameter(skill_ids=skill_ids)
                        urls_result = await sdk.agent.get_skill_file_urls_async(urls_param)

                        for skill in result.skills:
                            skill_dir_local = agent_dir / "skills" / skill.skill_code
                            skill_file_local = skill_dir_local / "SKILL.md"

                            if skill_file_local.exists():
                                skills_skipped.append(skill.skill_code)
                                continue

                            file_url = urls_result.get_file_url(str(skill.skill_id))
                            if not file_url:
                                logger.warning(f"Skill {skill.skill_code}: download URL not found, skipping")
                                continue

                            await _download_and_extract_skill(file_url, skill_dir_local)
                            skills_downloaded.append(skill.skill_code)
                            logger.info(f"Downloaded and extracted skill: {skill.skill_code}")
                    except Exception as e:
                        logger.warning(f"Failed to download skill files (non-blocking): {e}")

            # Format response
            _t = lambda key, **kw: i18n.translate(key, category="tool.messages", **kw)

            skills_summary = ""
            if result.skills:
                skill_lines = []
                for s in result.skills:
                    name = get_i18n_text(s.name_i18n) or s.skill_code
                    skill_lines.append(f"  - {s.skill_code}: {name}")
                skills_summary = "\n".join(skill_lines)
            else:
                skills_summary = f"  {_t('agent_manager.no_skills')}"

            cache_notes = [f"*{_t('agent_manager.cache_note', agent_code=agent_code)}*"]
            if skills_downloaded:
                cache_notes.append(f"*{_t('agent_manager.skills_downloaded', skills=', '.join(skills_downloaded))}*")
            if skills_skipped:
                cache_notes.append(f"*{_t('agent_manager.skills_cached', skills=', '.join(skills_skipped))}*")

            display_name = get_i18n_text(result.name_i18n) or result.name or result.code
            display_desc = get_i18n_text(result.description_i18n) or result.description or _t('agent_manager.no_desc')
            status_text = _t('agent_manager.label_enabled') if result.enabled else _t('agent_manager.label_disabled')

            summary = (
                f"## {_t('agent_manager.summary_employee_detail')}\n\n"
                f"- **{_t('agent_manager.label_code')}**: {result.code}\n"
                f"- **{_t('agent_manager.label_name')}**: {display_name}\n"
                f"- **{_t('agent_manager.label_desc')}**: {display_desc}\n"
                f"- **{_t('agent_manager.label_status')}**: {status_text}\n\n"
                f"### {_t('agent_manager.label_prompt')}\n\n```\n{prompt_plaintext or _t('agent_manager.no_prompt')}\n```\n\n"
                f"### {_t('agent_manager.label_skills')}\n{skills_summary}\n\n"
                + "\n".join(cache_notes)
            )

            return ToolResult(content=summary)

        except Exception as e:
            logger.error(f"Failed to get agent info: {e}")
            return ToolResult(ok=False, content=i18n.translate("agent_manager.get_info_error", category="tool.messages", error=str(e)))
