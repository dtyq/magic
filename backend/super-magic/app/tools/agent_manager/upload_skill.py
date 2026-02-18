"""upload_skill - 上传技能 zip 并绑定到 Agent"""

import os
import re
import zipfile
import tempfile
from typing import Optional, Dict, Tuple, Any

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.core import BaseTool, BaseToolParams, tool
from app.core.entity.message.server_message import ToolDetail, DisplayType
from app.paths import PathManager
from app.i18n import i18n

logger = get_logger(__name__)


def _parse_skill_i18n(skill_md_path: str) -> Tuple[Optional[Dict[str, str]], Optional[Dict[str, str]]]:
    """Parse name and description i18n data from SKILL.md frontmatter.

    Returns:
        (name_i18n, description_i18n) dicts, or (None, None) on failure.
    """
    try:
        content = open(skill_md_path, 'r', encoding='utf-8').read()
    except Exception:
        return None, None

    fm_match = re.match(r'^---\s*\n(.*?)\n---', content, re.DOTALL)
    if not fm_match:
        return None, None

    fm = fm_match.group(1)

    def _get_simple(key: str) -> Optional[str]:
        m = re.search(rf'^{re.escape(key)}:\s*(.+)$', fm, re.MULTILINE)
        return m.group(1).strip().strip('"\'') if m else None

    def _get_block(key: str) -> Optional[str]:
        """Get value for a key that may use YAML block scalar (|) or simple inline value."""
        m = re.search(rf'^{re.escape(key)}:\s*\|?\s*\n((?:[ \t]+.+\n?)+)', fm, re.MULTILINE)
        if m:
            lines = m.group(1).splitlines()
            return '\n'.join(line.strip() for line in lines if line.strip())
        return _get_simple(key)

    name_en = _get_simple('name')
    name_cn = _get_simple('name-cn')
    desc_en = _get_block('description')
    desc_cn = _get_block('description-cn')

    name_i18n = None
    if name_en or name_cn:
        name_i18n = {}
        if name_en:
            name_i18n['en_US'] = name_en
        if name_cn:
            name_i18n['zh_CN'] = name_cn

    desc_i18n = None
    if desc_en or desc_cn:
        desc_i18n = {}
        if desc_en:
            desc_i18n['en_US'] = desc_en
        if desc_cn:
            desc_i18n['zh_CN'] = desc_cn

    return name_i18n, desc_i18n


class UploadSkillParams(BaseToolParams):
    """UploadSkill 工具参数"""
    agent_code: Optional[str] = Field(
        default=None,
        description="""<!--zh: Agent 编码。如不提供则使用当前会话的 agent_code。
Agent code. If not provided, uses the current session's agent_code.-->"""
    )
    skill_name: str = Field(
        ...,
        description="""<!--zh: 要上传的技能名称（kebab-case）。
Skill name to upload (kebab-case).-->"""
    )


@tool()
class UploadSkill(BaseTool[UploadSkillParams]):
    """<!--zh
    将本地技能目录打包为 zip，上传到服务端并绑定到指定 Agent。
    执行两步操作：1) import-from-agent（上传 zip）2) add-agent-skills（绑定技能编码）。
    -->
    Package a local skill directory as zip, upload to server and bind to the specified agent.
    Two-step operation: 1) import-from-agent (upload zip) 2) add-agent-skills (bind skill code).
    """

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        if not result.ok:
            return None
        skill_code = result.extra_info.get("skill_code")
        if not skill_code:
            return None
        return ToolDetail(
            type=DisplayType.CODE,
            data={"code": skill_code}
        )

    def _get_remark_content(self, result: ToolResult, arguments=None) -> str:
        if result.ok:
            skill_name = (arguments or {}).get("skill_name", "")
            if skill_name:
                return i18n.translate("agent_manager.upload_skill_success", category="tool.messages", skill_name=skill_name)
            return i18n.translate("agent_manager.upload_skill_default", category="tool.messages")
        return ""

    async def execute(self, tool_context: ToolContext, params: UploadSkillParams) -> ToolResult:
        from app.core.context.agent_context import AgentContext
        from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
        from app.infrastructure.sdk.magic_service.parameter.import_skill_from_agent_parameter import ImportSkillFromAgentParameter
        from app.infrastructure.sdk.magic_service.parameter.add_agent_skills_parameter import AddAgentSkillsParameter

        # Resolve agent_code
        agent_code = params.agent_code
        if not agent_code:
            agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
            if agent_context:
                agent_code = agent_context.get_agent_code()

        if not agent_code:
            return ToolResult(ok=False, content=i18n.translate("agent_manager.agent_code_not_found", category="tool.messages"))

        # Locate skill directory
        agent_dir = PathManager.get_agent_studio_dir(agent_code)
        skill_dir = agent_dir / "skills" / params.skill_name
        skill_file = skill_dir / "SKILL.md"

        if not skill_file.exists():
            return ToolResult(ok=False, content=i18n.translate("agent_manager.skill_not_found", category="tool.messages", skill_name=params.skill_name))

        try:
            # Step 1: Create zip with skill folder as top-level dir: {skill_name}/SKILL.md
            zip_fd, zip_path = tempfile.mkstemp(suffix=".zip", prefix=f"{params.skill_name}-")
            os.close(zip_fd)
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                for root, _dirs, files in os.walk(str(skill_dir)):
                    for file in files:
                        file_path = os.path.join(root, file)
                        rel = os.path.relpath(file_path, str(skill_dir))
                        arcname = os.path.join(params.skill_name, rel)
                        zf.write(file_path, arcname)

            logger.info(f"Created skill zip: {zip_path}")

            # Parse i18n data from SKILL.md frontmatter
            name_i18n, description_i18n = _parse_skill_i18n(str(skill_file))

            # Step 2: Upload via import-from-agent
            sdk = get_magic_service_sdk()
            import_param = ImportSkillFromAgentParameter(
                file_path=zip_path,
                source="AGENT_CREATED",
                name_i18n=name_i18n,
                description_i18n=description_i18n,
            )
            import_result = await sdk.agent.import_skill_from_agent_async(import_param)

            skill_code = import_result.code
            is_create = import_result.is_create
            action_key = "agent_manager.action_create" if is_create else "agent_manager.action_update"
            action = i18n.translate(action_key, category="tool.messages")
            logger.info(f"Skill {('created' if is_create else 'updated')}: code={skill_code}")

            # Step 3: Bind skill to agent
            bind_param = AddAgentSkillsParameter(
                code=agent_code,
                skill_codes=[skill_code]
            )
            await sdk.agent.add_agent_skills_async(bind_param)
            logger.info(f"Skill {skill_code} bound to agent {agent_code}")

            try:
                os.remove(zip_path)
            except OSError:
                pass

            _t = lambda key, **kw: i18n.translate(key, category="tool.messages", **kw)

            summary = (
                f"## {_t('agent_manager.summary_skill_uploaded')}\n\n"
                f"- **{_t('agent_manager.label_action')}**: {action}\n"
                f"- **{_t('agent_manager.label_skill_code')}**: {skill_code}\n"
                f"- **{_t('agent_manager.label_added_to_employee')}**: {agent_code}\n"
            )

            return ToolResult(content=summary, extra_info={"skill_code": skill_code})

        except Exception as e:
            logger.error(f"Failed to upload skill: {e}")
            return ToolResult(ok=False, content=i18n.translate("agent_manager.upload_error", category="tool.messages", error=str(e)))
