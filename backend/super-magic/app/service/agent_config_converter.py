# app/service/agent_config_converter.py
import re
from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path

import yaml

from app.utils.async_file_utils import async_exists, async_read_text, async_write_text
from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
from app.infrastructure.sdk.magic_service.parameter.get_agent_details_parameter import GetAgentDetailsParameter
from app.infrastructure.sdk.magic_service.result.agent_details_result import AgentDetailsResult, Tool
from app.tools.remote.remote_tool_manager import remote_tool_manager
from agentlang.logger import get_logger

logger = get_logger(__name__)


class AgentConfigConverter:
    def __init__(self):
        # 使用主 agents/ 目录存储生成的 .agent 文件，这样 AgentLoader 可以直接找到
        from app.path_manager import PathManager
        self.agents_dir = Path(PathManager.get_project_root()) / "agents"

    async def convert_api_to_agent_file(self, agent_id: str) -> Tuple[str, AgentDetailsResult]:
        """将 API 配置转换为 .agent 文件，返回 (文件路径, agent_details)"""
        try:
            # 获取 Agent 详情
            magic_api = get_magic_service_sdk()
            parameter = GetAgentDetailsParameter(
                agent_id=agent_id,
                with_prompt_string=True,
                with_tool_schema=True
            )

            agent_details = await magic_api.agent.get_agent_details_async(parameter)

            # 重置并注册远程工具（类似于 MCP 工具管理）
            tools = agent_details.get_tools() if agent_details.has_tools() else []
            remote_tool_manager.reset_and_register(tools, agent_id)

            # 构建 .agent 文件内容
            agent_file_content = await self._build_agent_file_content(agent_details)

            # 生成自定义 .agent 文件到主 agents 目录（AgentLoader 可以直接找到）
            agent_file_path = self.agents_dir / f"{agent_id}.agent"
            await async_write_text(agent_file_path, agent_file_content)

            logger.info(f"生成自定义 .agent 文件: {agent_file_path}")
            return str(agent_file_path), agent_details

        except Exception as e:
            logger.error(f"转换 API 配置为 .agent 文件失败 (agent_id: {agent_id}): {e}")
            raise

    async def _build_agent_file_content(self, agent_details: AgentDetailsResult) -> str:
        """基于 user.template.agent 构建 .agent 文件内容"""
        template_path = self.agents_dir / "user.template.agent"
        if not await async_exists(template_path):
            raise FileNotFoundError(f"模板文件不存在: {template_path}")

        template_content = await async_read_text(template_path)
        agent_content = self._apply_prompt(template_content, agent_details.get_prompt_string())

        if agent_details.has_tools():
            remote_tools = [self._get_tool_identifier(t) for t in agent_details.get_tools()]
            if remote_tools:
                frontmatter, body = self._split_frontmatter(agent_content)
                existing_tools = self._parse_tools_list(frontmatter.get("tools"))
                frontmatter["tools"] = self._merge_tools(existing_tools, remote_tools)
                agent_content = self._render_agent_content(frontmatter, body)

        logger.info(f"基于模板 {template_path} 生成 Agent 配置")
        return agent_content

    def _apply_prompt(self, template: str, prompt: Optional[str]) -> str:
        """将 API 提示词填入模板，无提示词时删除整个 user_custom_instructions 块。"""
        if prompt:
            return template.replace("USER_CUSTOM_PROMPT", prompt)
        return re.sub(
            r'<!--zh\s*\n<user_custom_instructions>.*?</user_custom_instructions>\s*\n-->\s*\n'
            r'<user_custom_instructions>.*?</user_custom_instructions>\s*\n?',
            '',
            template,
            flags=re.DOTALL,
        )

    def _get_tool_identifier(self, tool: Tool) -> str:
        """返回工具的有效标识符。
        本地工具（type=1）按 ToolFactory 的注册方式使用 code；
        远程工具优先使用 name，与 RemoteTool.get_effective_name() 保持一致。
        """
        if tool.type == 1:
            return tool.code
        return tool.name or tool.code

    def _split_frontmatter(self, content: str) -> Tuple[Dict[str, Any], str]:
        """拆分 YAML frontmatter 与正文。"""
        match = re.match(r"^---\n(.*?)\n---\n?", content, re.DOTALL)
        if not match:
            raise ValueError("模板缺少 YAML frontmatter")
        frontmatter = yaml.safe_load(match.group(1)) or {}
        if not isinstance(frontmatter, dict):
            raise ValueError("模板 frontmatter 格式不合法")
        return frontmatter, content[match.end():]

    def _parse_tools_list(self, raw: Any) -> List[str]:
        """将 frontmatter 中的 tools 字段解析为字符串列表。"""
        if raw is None:
            return []
        if isinstance(raw, list):
            return [str(t).strip() for t in raw if str(t).strip()]
        if isinstance(raw, str):
            return [raw.strip()] if raw.strip() else []
        raise ValueError(f"tools 字段格式不合法: {type(raw)}")

    def _merge_tools(self, existing: List[str], additions: List[str]) -> List[str]:
        """将 additions 追加到 existing 末尾，保持顺序去重（含 additions 内部去重）。"""
        seen = set(existing)
        return existing + [t for t in dict.fromkeys(additions) if t not in seen]

    def _render_agent_content(self, frontmatter: Dict[str, Any], body: str) -> str:
        """重新拼装 frontmatter 与正文为 .agent 文件内容。"""
        yaml_text = yaml.safe_dump(frontmatter, allow_unicode=True, sort_keys=False).strip()
        return f"---\n{yaml_text}\n---\n\n{body.lstrip()}"
