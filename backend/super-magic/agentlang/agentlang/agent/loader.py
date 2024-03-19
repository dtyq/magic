import re
from pathlib import Path
from typing import Any, Dict, Tuple, List

# 新增：导入全局配置
from agentlang.config import config
from agentlang.logger import get_logger

# 导入语法处理器
from .syntax import SyntaxProcessor

logger = get_logger(__name__)


class AgentLoader:
    def __init__(self, agents_dir: Path):
        self._agents: Dict[str, Dict[str, Any]] = {}
        # 设置 agent 文件目录
        self._agents_dir = agents_dir
        # 初始化语法处理器
        self._syntax_processor = SyntaxProcessor(agents_dir)

    def load_agent(self, agent_name: str, variables: Dict[str, Any] = None) -> Tuple[
        str, Dict[str, Any], Dict[str, Any], str]:
        """
        加载 agent 文件内容，并设置变量

        Args:
            agent_name: agent 名称
            variables: 变量，可选参数

        Returns:
            Tuple[str, Dict[str, Any], Dict[str, Any], str]: 解析后的模型ID、工具配置、属性配置、提示词
        """
        # 确保 variables 不为 None
        if variables is None:
            variables = {}

        # 检查 agent_name 是否已经加载
        if agent_name in self._agents:
            agent_data = self._agents[agent_name]
            return agent_data["model_id"], agent_data["tools_config"], agent_data["attributes_config"], agent_data["prompt"]

        # 获取 agent 文件内容
        agent_file_content = self._get_agent_file_content(agent_name)
        # 解析 agent 文件内容
        model_id, tools_config, attributes_config, prompt, skills_list = self._parse_agent_file_content(agent_file_content)

        # 设置变量到语法处理器中
        if variables:
            self._syntax_processor.set_variables(variables)

        # 使用语法处理器处理动态语法（包括变量）
        prompt = self._syntax_processor.process_dynamic_syntax(prompt)

        # 根据 agent_name 保存到 self._agents 中
        self._agents[agent_name] = {
            "model_id": model_id,
            "tools_config": tools_config,
            "attributes_config": attributes_config,
            "prompt": prompt,
            "skills_list": skills_list,  # 存储 skills 配置
        }

        return model_id, tools_config, attributes_config, prompt

    def get_skills_list(self, agent_name: str) -> List[str]:
        """获取 agent 的 skills 列表

        Args:
            agent_name: agent 名称

        Returns:
            List[str]: skills 列表，如果没有配置则返回空列表
        """
        if agent_name in self._agents:
            return self._agents[agent_name].get("skills_list", [])
        return []

    def _get_agent_file_content(self, agent_name: str) -> str:
        """
        获取 agent 文件内容

        Args:
            agent_name: agent 名称

        Returns:
            str: agent 文件内容
        """
        # 获取 agent 文件路径
        agent_file = self._agents_dir / f"{agent_name}.agent"
        # 检查 agent 文件是否存在
        if not agent_file.exists():
            raise FileNotFoundError(f"Agent 文件不存在: {agent_file}")
        # 读取 agent 文件内容
        with open(agent_file, "r", encoding="utf-8") as f:
            return f.read()

    def _parse_agent_file_content(self, agent_file_content: str) -> Tuple[str, Dict[str, Any], Dict[str, Any], str, List[str]]:
        """解析 agent 文件内容

        Args:
            agent_file_content: agent 文件内容

        Returns:
            Tuple[str, Dict[str, Any], Dict[str, Any], str, List[str]]: 解析后的模型ID、工具配置、属性配置、提示词、skills列表
        """
        # 初始化配置
        tools_config = {}
        model_id = ""  # 修改：不再是字典
        attributes_config = {}
        skills_list = []
        prompt = ""

        # 解析 tools_config
        tools_pattern = r"<!--\s*tools:\s*([\w,\s\.-]+)\s*-->"
        match = re.search(tools_pattern, agent_file_content)
        if match:
            tools_str = match.group(1).strip()
            tools = {tool.strip(): {} for tool in tools_str.split(",") if tool.strip()}
            logger.debug(f"从 agent 文件中解析到工具配置: {tools}")
            tools_config = tools
        else:
            logger.error("未在 agent 文件中找到工具配置")
            raise ValueError("未在 agent 文件中找到工具配置")

        # 解析 model_config
        model_pattern = r"<!--\s*llm:\s*([\w,\s\.-]+)\s*-->"
        match = re.search(model_pattern, agent_file_content)
        if match:
            # 提取模型名称或别名（假设只有一个）
            model_str = match.group(1).strip()
            # 解析别名
            resolved_model_id = config.resolve_model_alias(model_str)
            logger.debug(f"从 agent 文件中解析到模型标识 '{model_str}', 解析为 '{resolved_model_id}'")
            model_id = resolved_model_id  # 修改：存储解析后的ID
        else:
            logger.error("未在 agent 文件中找到模型配置")
            # 考虑是否应该在此处引发错误，如果模型是必需的
            # raise ValueError("未在 agent 文件中找到模型配置")

        # 解析 attributes_config
        attributes_pattern = r"<!--\s*attributes:\s*([\w,\s\.-]+)\s*-->"
        match = re.search(attributes_pattern, agent_file_content)
        if match:
            attributes_str = match.group(1).strip()
            attributes = {attribute.strip(): True for attribute in attributes_str.split(",") if attribute.strip()}
            logger.debug(f"从 agent 文件中解析到属性配置: {attributes}")
            attributes_config = attributes
        else:
            logger.debug("未在 agent 文件中找到属性配置")

        # 解析 skills 配置
        skills_pattern = r"<!--\s*skills:\s*([\w,\s\.-]+)\s*-->"
        match = re.search(skills_pattern, agent_file_content)
        if match:
            skills_str = match.group(1).strip()
            skills_list = [skill.strip() for skill in skills_str.split(",") if skill.strip()]
            logger.debug(f"从 agent 文件中解析到 skills 配置: {skills_list}")
        else:
            logger.debug("未在 agent 文件中找到 skills 配置")

        # 当配置了 skills 时，自动注入 skill 相关工具，无需在 tools 中显式声明
        if skills_list:
            skill_tools = ["skills_read", "skill_read_references", "run_skills_snippet"]
            injected = []
            for skill_tool in skill_tools:
                if skill_tool not in tools_config:
                    tools_config[skill_tool] = {}
                    injected.append(skill_tool)
            if injected:
                logger.debug(f"因配置了 skills，自动注入工具: {injected}")

        # 解析 prompt，移除注释但保留动态语法
        prompt = re.sub(r"<!--(.*?)-->", "", agent_file_content, flags=re.DOTALL)
        prompt = prompt.strip()

        # 注意：这里不再调用语法处理器，留给load_agent方法统一处理

        return model_id, tools_config, attributes_config, prompt, skills_list

    def set_variables(self, content: str, variables: Dict[str, Any]) -> str:
        """
        设置变量并处理内容中的变量替换

        Args:
            content: 需要处理的内容
            variables: 变量字典

        Returns:
            str: 处理后的内容
        """
        # 设置变量到语法处理器
        self._syntax_processor.set_variables(variables)
        # 处理动态语法（包括变量）
        return self._syntax_processor.process_dynamic_syntax(content)
