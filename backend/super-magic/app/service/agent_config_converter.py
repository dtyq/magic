# app/service/agent_config_converter.py
import os
import tempfile
from typing import Dict, List, Optional, Tuple
from pathlib import Path
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
        from app.paths import PathManager
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
        """基于 user.agent.template 构建 .agent 文件内容"""
        # 读取模板文件
        template_path = self.agents_dir / "user.agent.template"

        if not await async_exists(template_path):
            raise FileNotFoundError(f"模板文件不存在: {template_path}")

        template_content = await async_read_text(template_path)

        # 获取 API 返回的提示词
        prompt_string = agent_details.get_prompt_string()
        if prompt_string:
            # 有提示词，替换占位符
            agent_content = template_content.replace("USER_CUSTOM_PROMPT", prompt_string)
        else:
            # 无提示词，移除整个 user_custom_instructions 块（含前置的 <!--zh ... --> 注释块）
            import re
            agent_content = re.sub(
                r'<!--zh\s*\n<user_custom_instructions>.*?</user_custom_instructions>\s*\n-->\s*\n'
                r'<user_custom_instructions>.*?</user_custom_instructions>\s*\n?',
                '',
                template_content,
                flags=re.DOTALL,
            )

        # 添加工具到现有工具列表（不覆盖模板中的固定工具）
        if agent_details.has_tools():
            remote_tools = []
            for tool in agent_details.get_tools():
                # 根据工具类型决定使用 code 还是 name
                # type=1: 本地工具，使用 code（如 "list_dir"），因为 ToolFactory 用 code 注册和查找
                # type=2,3: 远程工具，使用 name（如果有）或 code，与 RemoteTool.get_effective_name() 逻辑一致
                if tool.type == 1:
                    # 本地工具使用 code
                    tool_identifier = tool.code
                else:
                    # 远程工具使用 name（如果没有 name 则使用 code）
                    tool_identifier = tool.name if tool.name else tool.code
                remote_tools.append(tool_identifier)

            if remote_tools:
                # 找到模板中的工具配置行并添加远程工具
                lines = agent_content.split('\n')
                for i, line in enumerate(lines):
                    if line.strip().startswith('<!-- tools:'):
                        # 解析现有工具列表
                        existing_tools_part = line.strip()[12:-4]  # 移除 '<!-- tools: ' 和 ' -->'
                        existing_tools = [tool.strip() for tool in existing_tools_part.split(',') if tool.strip()]

                        # 合并工具列表：现有工具 + 远程工具，去重但保持顺序
                        all_tools = existing_tools.copy()
                        for remote_tool in remote_tools:
                            if remote_tool not in all_tools:
                                all_tools.append(remote_tool)

                        # 重新生成工具配置行
                        tools_line = "<!-- tools: " + ", ".join(all_tools) + " -->"
                        lines[i] = tools_line
                        break

                agent_content = '\n'.join(lines)

        logger.info(f"基于模板 {template_path} 生成 Agent 配置")
        return agent_content
