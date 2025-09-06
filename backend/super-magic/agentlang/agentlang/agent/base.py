"""
BaseAgent 抽象类定义

定义Agent的基本接口和抽象方法，所有Agent实现必须继承此类
"""

import random
import string
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from openai.types.chat import ChatCompletion, ChatCompletionMessage, ChatCompletionMessageToolCall

from agentlang.agent.loader import AgentLoader
from agentlang.agent.state import AgentState
from agentlang.chat_history import ToolCall
from agentlang.llms.factory import LLMFactory
from agentlang.llms.token_usage.models import TokenUsageReport
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.context.agent_context import AgentContext
from app.tools.core.tool_factory import tool_factory

logger = get_logger(__name__)


class BaseAgent(ABC):
    """
    Agent 基类，定义了所有 Agent 实现必须遵循的接口。

    BaseAgent 负责处理：
    1. 基本 Agent 属性管理
    2. 生命周期管理
    3. LLM 交互
    4. 工具调用处理
    """

    # 全局活动 Agent 集合
    ACTIVE_AGENTS = set()

    # Agent基本属性
    agent_name = None
    agent_context = None
    stream_mode = False
    attributes = {}

    tools = []
    llm_client = None
    system_prompt = None
    agent_state = AgentState.IDLE
    chat_history = None
    max_iterations = 100
    _agent_loader: AgentLoader = None

    @abstractmethod
    def __init__(self, agent_name: str, agent_context: Optional[AgentContext] = None, agent_id: Optional[str] = None) -> None:
        """初始化 Agent 实例。

        Args:
            agent_name: Agent 名称
            agent_context: Agent 上下文，如果为 None 则会创建一个新的实例
            agent_id: Agent 唯一标识，如果为 None 则会自动生成
        """
        self.agent_name = agent_name
        self.agent_context = agent_context or AgentContext()
        self.agent_context.set_agent_name(agent_name)
        self.id = agent_id or self._generate_agent_id()

    def _generate_agent_id(self) -> str:
        """
        生成唯一的 Agent ID。

        Returns:
            str: 生成的 Agent ID
        """
        first_char = random.choice(string.ascii_letters)
        remaining_chars = ''.join(random.choices(string.ascii_letters + string.digits, k=5))
        new_id = first_char + remaining_chars
        logger.info(f"自动生成新的 Agent ID: {new_id}")
        return new_id

    def set_stream_mode(self, stream_mode: bool) -> None:
        """
        设置是否使用流模式。

        Args:
            stream_mode: 是否启用流模式
        """
        self.stream_mode = stream_mode
        if self.agent_context:
            self.agent_context.set_stream_mode(stream_mode)

    def has_attribute(self, attribute_name: str) -> bool:
        """
        检查是否存在某个属性。

        Args:
            attribute_name: 属性名称

        Returns:
            bool: 是否存在该属性
        """
        return attribute_name in self.attributes

    @abstractmethod
    def _initialize_agent(self) -> None:
        """初始化 Agent 配置、工具和 LLM。

        此方法应在构造函数中调用，负责：
        1. 加载 Agent 配置文件
        2. 初始化 LLM 客户端
        3. 设置工具集合
        4. 准备系统提示词
        """
        pass

    @abstractmethod
    def _prepare_prompt_variables(self) -> Dict[str, str]:
        """
        准备用于替换prompt中变量的字典。

        Returns:
            Dict[str, str]: 包含变量名和对应值的字典
        """
        pass

    @abstractmethod
    async def run(self, query: str):
        """
        运行 Agent 处理查询。

        Args:
            query: 用户查询/指令
        """
        pass

    @abstractmethod
    async def run_main_agent(self, query: str):
        """
        以主 Agent 身份运行，通常包含额外的事件处理和错误管理。

        Args:
            query: 用户查询/指令
        """
        pass

    @abstractmethod
    async def _handle_agent_loop(self) -> None:
        """
        处理 Agent 的主循环逻辑，包括:
        1. LLM 调用
        2. 解析 LLM 响应
        3. 执行工具调用
        4. 处理工具结果
        5. 添加历史记录
        6. 循环终止条件检查
        """
        pass

    @abstractmethod
    async def _handle_agent_loop_stream(self) -> None:
        """处理流模式下的 Agent 循环。"""
        pass

    @abstractmethod
    async def _call_llm(self, messages: List[Dict[str, Any]]) -> ChatCompletion:
        """
        调用 LLM 获取响应。

        Args:
            messages: 消息历史列表

        Returns:
            ChatCompletion: LLM 响应
        """
        pass

    def _parse_tool_calls(self, chat_response: ChatCompletion) -> List[ChatCompletionMessageToolCall]:
        """
        从 LLM 响应中解析工具调用。

        Args:
            chat_response: LLM 响应

        Returns:
            List[ChatCompletionMessageToolCall]: 工具调用列表
        """
        tools = []
        for choice in chat_response.choices:
            if choice.message.tool_calls:
                tools.extend(choice.message.tool_calls)
        return tools

    @abstractmethod
    async def _execute_tool_calls(self, tool_calls: List[ToolCall], llm_response_message: ChatCompletionMessage) -> List[ToolResult]:
        """
        执行工具调用，可能是并行或串行。

        Args:
            tool_calls: 工具调用列表
            llm_response_message: LLM 响应消息

        Returns:
            List[ToolResult]: 工具调用结果列表
        """
        pass

    @abstractmethod
    async def _execute_tool_calls_sequential(self, tool_calls: List[ToolCall], llm_response_message: ChatCompletionMessage) -> List[ToolResult]:
        """
        串行执行工具调用。

        Args:
            tool_calls: 工具调用列表
            llm_response_message: LLM 响应消息

        Returns:
            List[ToolResult]: 工具调用结果列表
        """
        pass

    @abstractmethod
    async def _execute_tool_calls_parallel(self, tool_calls: List[ToolCall], llm_response_message: ChatCompletionMessage) -> List[ToolResult]:
        """
        并行执行工具调用。

        Args:
            tool_calls: 工具调用列表
            llm_response_message: LLM 响应消息

        Returns:
            List[ToolResult]: 工具调用结果列表
        """
        pass

    def set_parallel_tool_calls(self, enable: bool, timeout: Optional[float] = None) -> None:
        """
        设置是否启用并行工具调用。

        Args:
            enable: 是否启用并行工具调用
            timeout: 并行执行超时时间（秒），None表示不设置超时
        """
        self.enable_parallel_tool_calls = enable
        self.parallel_tool_calls_timeout = timeout
        logger.info(f"设置并行工具调用: 启用={enable}, 超时={timeout}秒")

    def register_tools(self, tools_definition: Dict[str, Dict]) -> None:
        """
        注册工具。

        Args:
            tools_definition: 工具定义
        """
        # 注册工具
        for tool_name, tool_config in tools_definition.items():
            # 注意：新工具系统使用@tool装饰器自动注册工具
            # 这里只是为了兼容旧代码，不做实际注册操作
            logger.debug(f"工具 {tool_name} 已通过装饰器注册，无需手动注册")

    def print_token_usage(self) -> None:
        """
        打印token使用报告。

        在会话结束时调用，打印整个会话的token使用统计报告。
        """
        try:
            # 获取格式化报告
            formatted_report = LLMFactory.token_tracker.get_formatted_report()
            logger.info(f"===== Token 使用报告 ({self.agent_name}) =====")
            logger.info(formatted_report)
        except Exception as e:
            logger.error(f"打印Token使用报告时出错: {e!s}")
            
    def get_token_usage_report(self) -> TokenUsageReport:
        """
        获取token使用报告。
        
        Returns:
            TokenUsageReport: token使用报告
        """
        try:
            # 从LLMFactory获取token使用报告
            token_report = LLMFactory.token_tracker.get_usage_report()
            return token_report
        except Exception as e:
            logger.error(f"获取token使用报告时出错: {e!s}")
            # 返回空报告
            from agentlang.llms.token_usage.models import TokenUsageReport
            return TokenUsageReport.create_summary_report([])

    def load_agent_config(self, agent_name: str) -> None:
        """
        从 .agent 文件加载 agent 配置并设置相关属性

        从.agent文件中加载模型定义、工具定义、属性定义和提示词，并设置到实例属性中
        """
        logger.info(f"加载 agent 配置: {agent_name}")
        model_id, tools_definition, attributes_definition, prompt = self._agent_loader.load_agent(agent_name)
        self.system_prompt = prompt

        # 检查工具是否存在且可用，若不存在或不可用则忽略并抛出 warning
        valid_tools = {}
        for tool_name in tools_definition.keys():
            try:
                # 获取工具实例（不是工具信息）
                tool_instance = tool_factory.get_tool_instance(tool_name)

                # 检查工具是否可用
                if not tool_instance.is_available():
                    logger.warning(f"工具 '{tool_name}' 不可用（环境变量未配置或依赖缺失），将在 Agent 定义中被忽略")
                    continue

                valid_tools[tool_name] = tools_definition[tool_name]
            except ValueError as e:
                # 工具不存在
                logger.warning(f"工具 '{tool_name}' 不存在，将在 Agent 定义中被忽略: {e}")
                continue
            except Exception as e:
                # 其他错误
                logger.warning(f"加载工具 '{tool_name}' 时发生错误，将在 Agent 定义中被忽略: {e}")
                continue

        self.tools = valid_tools
        self.attributes = attributes_definition
        self.llm_id = model_id
        logger.info(f"加载完成: 模型={model_id}, 工具数量={len(valid_tools)}")

    def set_agent_state(self, state: AgentState) -> None:
        """
        设置 Agent 状态

        Args:
            state: 新的 Agent 状态
        """
        logger.info(f"Agent '{self.agent_name}' 状态变更: {self.agent_state.value} -> {state.value}")
        self.agent_state = state

    def is_agent_running(self) -> bool:
        """
        检查 Agent 是否正在运行

        Returns:
            bool: 如果 Agent 正在运行则返回 True，否则返回 False
        """
        return self.agent_state == AgentState.RUNNING

    def is_agent_finished(self) -> bool:
        """
        检查 Agent 是否已完成

        Returns:
            bool: 如果 Agent 已完成则返回 True，否则返回 False
        """
        return self.agent_state == AgentState.FINISHED

    def is_agent_error(self) -> bool:
        """
        检查 Agent 是否发生错误

        Returns:
            bool: 如果 Agent 发生错误则返回 True，否则返回 False
        """
        return self.agent_state == AgentState.ERROR

    def is_agent_idle(self) -> bool:
        """
        检查 Agent 是否处于空闲状态

        Returns:
            bool: 如果 Agent 处于空闲状态则返回 True，否则返回 False
        """
        return self.agent_state == AgentState.IDLE
