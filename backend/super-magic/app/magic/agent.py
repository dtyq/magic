import asyncio
import json
import os
import random
import re  # 添加 re 模块引入
import string
import time
import traceback
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from openai.types.chat import ChatCompletion, ChatCompletionMessage, ChatCompletionMessageToolCall

from agentlang.agent.base import BaseAgent
from agentlang.agent.loader import AgentLoader
from agentlang.agent.state import AgentState
from agentlang.chat_history import AssistantMessage, CompressionConfig, FunctionCall, ToolCall, ToolMessage
from agentlang.chat_history.chat_history import ChatHistory
from agentlang.config.config import config
from agentlang.context.tool_context import ToolContext
from agentlang.event.data import (
    AfterLlmResponseEventData,
    AfterMainAgentRunEventData,
    AfterToolCallEventData,
    BeforeLlmRequestEventData,
    BeforeMainAgentRunEventData,
    BeforeToolCallEventData,
    ErrorEventData,
)
from agentlang.event.event import EventType
from agentlang.exceptions import UserFriendlyException
from agentlang.llms.factory import LLMFactory
from agentlang.llms.token_usage.models import TokenUsage
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from agentlang.utils.parallel import Parallel
from app.core.context.agent_context import AgentContext
from app.paths import PathManager
from app.tools.core.base_tool import BaseTool
from app.tools.core.tool_executor import tool_executor
from app.tools.core.tool_factory import tool_factory
from app.tools.list_dir import ListDir

logger = get_logger(__name__)


class Agent(BaseAgent):

    context_prompt = None  # 新增 context_prompt 属性，拆分 prompt 里的动态内容，确保不影响第一条 system prompt 命中缓存

    def _setup_agent_context(self, agent_context: Optional[AgentContext] = None) -> AgentContext:
        """
        设置和初始化Agent上下文

        Args:
            agent_context: 可选的Agent上下文实例，如果为None则创建新实例

        Returns:
            AgentContext: 设置好的Agent上下文实例
        """
        # 如果没有传入agent_context，则创建一个新的实例
        if agent_context is None:
            agent_context = AgentContext()
            logger.info("未提供agent_context，自动创建新的AgentContext实例")

        # 更新 agent 上下文的基本设置
        agent_context.agent_name = self.agent_name  # 设置agent_name
        agent_context.stream_mode = self.stream_mode
        agent_context.use_dynamic_prompt = False
        agent_context._workspace_dir = PathManager.get_workspace_dir()

        # 确保 context 中有 chat_history_dir
        if not hasattr(agent_context, 'chat_history_dir') or not agent_context.chat_history_dir:
            agent_context.chat_history_dir = PathManager.get_chat_history_dir()
            logger.warning(f"AgentContext 中未设置 chat_history_dir，使用默认值: {PathManager.get_chat_history_dir()}")

        return agent_context

    def __init__(self, agent_name: str, agent_context: AgentContext = None, agent_id: str = None):
        self.agent_name = agent_name

        # 设置Agent上下文
        self.agent_context = self._setup_agent_context(agent_context)
        agents_dir = Path(PathManager.get_project_root() / "agents")
        self._agent_loader = AgentLoader(agents_dir=agents_dir)

        # 是否启用多工具调用，默认禁用
        self.enable_multi_tool_calls = config.get("agent.enable_multi_tool_calls", False)
        # 是否启用并行工具调用，默认禁用
        self.enable_parallel_tool_calls = config.get("agent.enable_parallel_tool_calls", False)
        # 并行工具调用超时时间（秒），默认无超时
        self.parallel_tool_calls_timeout = config.get("agent.parallel_tool_calls_timeout", None)

        logger.info(f"初始化 agent: {self.agent_name}")
        self._initialize_agent()

        # 初始化完成后，更新context中的llm
        self.agent_context.llm = self.llm_name

        # agent id 处理
        if self.has_attribute("main"):
            if agent_id and agent_id != "main":
                logger.warning("禁止对主 Agent 使用 agent_id 参数")
                raise ValueError("禁止对主 Agent 使用 agent_id 参数")
            agent_id = "main"
            logger.info(f"使用默认 Agent ID: {agent_id}")

        if agent_id:
            # 不校验，大模型容易出错
            self.id = agent_id
            logger.info(f"使用提供的 Agent ID: {self.id}")
        else:
            # 如果未提供 agent_id，则生成一个新的
            self.id = self._generate_agent_id()

        # 检查 Agent 是否已存在，使用基类的 ACTIVE_AGENTS
        agent_key = (self.agent_name, self.id)
        if agent_key in self.ACTIVE_AGENTS:
            error_message = f"Agent (name='{self.agent_name}', id='{self.id}') 已经存在并且正在活动中。"
            logger.error(error_message)
            raise ValueError(error_message)
        self.ACTIVE_AGENTS.add(agent_key)
        logger.info(f"Agent (name='{self.agent_name}', id='{self.id}') 已添加到活动注册表。")

        # 初始化 ChatHistory 实例，配置压缩参数
        compression_config = CompressionConfig(
            enable_compression=True,  # 启用压缩功能
            preserve_recent_turns=5,  # 保留最近的5条消息
            llm_for_compression=self.llm_id, # 传入agent模型ID用于压缩，压缩模型的 max_context_tokens 需要大于等于 agent 模型的 max_context_tokens，否则可能会存在压缩失败的风险
            agent_name=self.agent_name,  # 传入agent名称
            agent_id=self.id,  # 传入agent ID
            agent_model_id=self.llm_id  # 传入agent模型ID
        )
        self.chat_history = ChatHistory(
            self.agent_name,
            self.id,
            self.agent_context.chat_history_dir,
            compression_config=compression_config  # 传递压缩配置
        )

        # 将 chat_history 设置到 agent_context 中，确保工具可以访问
        self.agent_context.chat_history = self.chat_history
        logger.debug("已将 chat_history 设置到 agent_context 中，以便工具访问")

    def _initialize_agent(self):
        """初始化 agent"""
        # 从 .agent 文件中加载 agent 配置
        self.load_agent_config(self.agent_name)

        # 提取 <context> 块内容
        context_match = re.search(r"<context>(.*?)</context>", self.system_prompt, re.DOTALL)
        if context_match:
            # 提取并暂存 context 内容
            context_content = "Current Context:\n" + context_match.group(1).strip()
            # 从 system prompt 中移除 context 块，保留一行空行
            self.system_prompt = re.sub(r"\s*<context>.*?</context>\s*", "\n\n", self.system_prompt, count=1, flags=re.DOTALL)
            self.system_prompt = self.system_prompt.strip()
            logger.debug("已从 system prompt 中提取 <context> 块")
        else:
            context_content = None
            logger.debug("system prompt 中未找到 <context> 块")

        # 收集工具提示
        tool_hints = []
        for tool_name in self.tools.keys():
            tool_instance = tool_factory.get_tool_instance(tool_name)
            if tool_instance and (hint := tool_instance.get_prompt_hint()):
                tool_hints.append((tool_name, hint))
        # 将工具提示追加到 system prompt
        if tool_hints:
            formatted_hints = [f"### {name}\n{hint}" for name, hint in tool_hints]
            for name, _ in tool_hints:
                logger.info(f"已追加{name}工具的提示到 system prompt")
            self.system_prompt += "\n\n---\n\n## Advanced Tool Usage Instructions:\n> You should strictly follow the examples to use the tools.\n" + "\n\n".join(formatted_hints)

            # 添加语言使用指导
            # 只针对 gpt-4.1 系列这类总是说英语的模型
            if self.llm_id in ["gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano"]:
                self.system_prompt += "\n\n---\n\nYou are a Simplified Chinese expert, skilled at communicating with users in Chinese. Your user is a Chinese person who only speaks Simplified Chinese and doesn't understand English at all. Your thinking process, outputs, explanatory notes when calling tools, and any other content that will be directly shown to the user must all be in Simplified Chinese. When you retrieve English materials, you need to translate them into Simplified Chinese before returning them to the user."

        if not self.system_prompt:
            raise ValueError("Prompt is not set")
        if not self.llm_id:
            raise ValueError("LLM model is not set")
        self.llm_client = LLMFactory.get(self.llm_id)
        model_config = LLMFactory.get_model_config(self.llm_id)
        self.llm_name = model_config.name
        self.model_config = model_config
        # 去掉 self.model_config 中的 api_key 和 api_base_url 等敏感信息
        self.model_config.api_key = None
        self.model_config.api_base_url = None

        # 准备变量并应用替换
        variables = self._prepare_prompt_variables()
        self.system_prompt = self._agent_loader.set_variables(self.system_prompt, variables)

        # 如果存在 context_content，进行变量替换并保存
        if context_content:
            self.context_prompt = self._agent_loader.set_variables(context_content, variables)
            logger.debug("已完成 context_prompt 的变量替换")

    def _prepare_prompt_variables(self) -> Dict[str, str]:
        """
        准备用于替换prompt中变量的字典

        Returns:
            Dict[str, str]: 包含变量名和对应值的字典
        """
        # 使用 ListDir 工具生成目录结构
        list_dir_tool = ListDir()
        workspace_dir = self.agent_context._workspace_dir

        # 调用 _run 方法获取格式化后的目录内容
        workspace_dir_files_list = list_dir_tool._run(
            relative_workspace_path=".",
            level=5,  # 设置合理的递归深度
            filter_binary=False,  # 不过滤二进制文件
            calculate_tokens=True,  # 计算 token 数量
        )

        # 如果目录为空，显示工作目录为空的信息
        if "目录为空，没有文件" in workspace_dir_files_list:
            workspace_dir_files_list = "当前工作目录为空，没有文件"

        # 构建变量字典
        variables = {
            "current_datetime": datetime.now().strftime("%Y年%m月%d日 %H:%M:%S 星期{}(第%W周)".format(["一", "二", "三", "四", "五", "六", "日"][datetime.now().weekday()])),
            "workspace_dir": self.agent_context._workspace_dir,
            "workspace_dir_files_list": workspace_dir_files_list,
            "recommended_max_output_tokens": 4096,
        }

        return variables

    def _generate_agent_id(self) -> str:
        """生成符合规范的 Agent ID"""
        first_char = random.choice(string.ascii_letters)
        remaining_chars = ''.join(random.choices(string.ascii_letters + string.digits, k=5))
        new_id = first_char + remaining_chars
        # 移除不必要的校验逻辑，生成逻辑已保证格式正确
        logger.info(f"自动生成新的 Agent ID: {new_id}")
        return new_id

    async def run_main_agent(self, query: str):
        """运行主 agent"""
        try:
            # 触发主 agent 运行前事件
            await self.agent_context.dispatch_event(EventType.BEFORE_MAIN_AGENT_RUN, BeforeMainAgentRunEventData(
                agent_context=self.agent_context,
                agent_name=self.agent_name,
                query=query,
            ))

            await self.run(query)

            # 触发主 agent 运行后事件
            await self.agent_context.dispatch_event(EventType.AFTER_MAIN_AGENT_RUN, AfterMainAgentRunEventData(
                agent_context=self.agent_context,
                agent_name=self.agent_name,
                agent_state=self.agent_state,
                query=query,
            ))
        except Exception as e:
            logger.error(f"主 agent 运行异常: {e!s}")
            if isinstance(e, UserFriendlyException):
                await self.agent_context.dispatch_event(EventType.ERROR, ErrorEventData(
                    exception=e,
                    agent_context=self.agent_context,
                    error_message=e.get_user_friendly_message()
                ))
    async def run(self, query: str):
        """运行 agent"""
        self.set_agent_state(AgentState.RUNNING)

        logger.info(f"开始运行 agent: {self.agent_name}, query: {query}")

        # 切换到工作空间目录
        try:
            # 使用os.chdir()替代os.chroot()，避免需要root权限
            workspace_dir = self.agent_context._workspace_dir
            if os.path.exists(workspace_dir):
                os.chdir(workspace_dir)
                logger.info(f"已切换工作目录到: {workspace_dir}")
            else:
                logger.warning(f"工作空间目录不存在: {workspace_dir}")
        except Exception as e:
            logger.error(f"切换工作目录时出错: {e!s}")

        # 构造 chat_history
        # ChatHistory 初始化时已加载历史
        # 检查是否需要添加 System Prompt (仅在历史为空时)
        if not self.chat_history.messages:
            logger.info("聊天记录为空，添加主 System Prompt")
            await self.chat_history.append_system_message(self.system_prompt)

            # 如果存在 context_prompt，添加为第二条 user message，确保不影响第一条 system prompt 命中缓存
            if self.context_prompt:
                logger.info("添加 Context System Prompt 作为第二条 user message")
                await self.chat_history.append_user_message(self.context_prompt)

        # 添加当前用户查询
        await self.chat_history.append_user_message(query)

        # 根据 stream_mode 选择不同的 Agent Loop 方式
        try:
            if self.stream_mode:
                return await self._handle_agent_loop_stream()
            else:
                return await self._handle_agent_loop()
        finally:
            # 从活动注册表中移除 Agent，使用基类的 ACTIVE_AGENTS
            agent_key = (self.agent_name, self.id)
            if agent_key in self.ACTIVE_AGENTS:
                self.ACTIVE_AGENTS.remove(agent_key)
                logger.info(f"Agent (name='{self.agent_name}', id='{self.id}') 已从活动注册表中移除。")
            else:
                # 理论上不应发生，但记录以防万一
                logger.warning(f"尝试移除 Agent (name='{self.agent_name}', id='{self.id}') 但未在活动注册表中找到。")
            # 任务被用户终止时，agent 协程会被 cancel 异常强制挂掉，需要在这里关闭所有资源
            await self.agent_context.close_all_resources()


    async def _handle_agent_loop(self) -> None:
        """处理 agent 循环"""
        no_tool_call_count = 0
        final_response = None
        run_exception_count = 0
        # last_llm_message 用于在循环结束时获取最后的消息内容
        last_llm_message: Optional[ChatCompletionMessage] = None

        while True:
            # 更新活动时间，用于活动追踪
            self.agent_context.update_activity_time()

            try:
                # 检查是否需要恢复会话
                skip_llm_call, tool_calls_to_execute, llm_response_message, assistant_message_to_restore = await self._check_and_restore_session()

                # 判断是否跳过LLM调用
                if skip_llm_call:
                    # 使用恢复的会话
                    tool_calls_to_execute, llm_response_message = await self._restore_session_state(
                        assistant_message_to_restore)
                    last_llm_message = llm_response_message  # 也更新last_llm_message
                    if not tool_calls_to_execute or not llm_response_message:
                        final_response = "恢复会话状态时发生内部错误。"
                        break
                else:
                    # 调用LLM获取响应
                    llm_response_message, tool_calls_to_execute, token_usage, llm_duration_ms = await self._prepare_and_call_llm()
                    last_llm_message = llm_response_message  # 保存用于循环结束时的最终响应

                    # 处理无工具调用的情况
                    if not tool_calls_to_execute and llm_response_message.role == "assistant":
                        no_tool_call_count, should_continue, new_final_response = await self._handle_no_tool_calls(
                            llm_response_message, no_tool_call_count, token_usage, llm_duration_ms)
                        if not should_continue:
                            final_response = new_final_response
                            break
                        continue

                    # 添加工具调用响应到历史
                    await self._add_tool_calls_to_history(llm_response_message, tool_calls_to_execute, token_usage, llm_duration_ms)

                # 执行工具调用并处理结果
                try:
                    finish_task_detected, final_response_from_tools = await self._execute_and_process_tool_calls(
                        tool_calls_to_execute, llm_response_message)

                    if finish_task_detected:
                        final_response = final_response_from_tools
                        break
                except asyncio.CancelledError:
                    # 捕获并处理来自ASK_USER的取消
                    logger.info("ASK_USER请求导致循环取消")
                    break  # 直接退出循环

            except Exception as e:
                # 处理异常情况
                should_continue, new_final_response, new_exception_count = await self._handle_agent_loop_exception(
                    e, run_exception_count)
                run_exception_count = new_exception_count
                if new_final_response:
                    final_response = new_final_response
                if not should_continue:
                    break

        # 8. 完成循环后的清理工作
        return await self._finalize_agent_loop(final_response, last_llm_message)

    async def _check_and_restore_session(self) -> tuple[bool, List[ToolCall], Optional[ChatCompletionMessage], Optional[AssistantMessage]]:
        """
        检查是否需要恢复上一次会话状态，并返回相应的执行配置

        Returns:
            Tuple: (是否跳过LLM调用, 要执行的工具调用列表, LLM响应消息, 要恢复的助手消息)
        """
        # 初始化默认返回值
        skip_llm_call = False
        tool_calls_to_execute = []
        llm_response_message = None
        assistant_message_to_restore = None

        # 获取最后和倒数第二条非内部消息
        last_message = self.chat_history.get_last_message()
        second_last_message = self.chat_history.get_second_last_message()

        # 检查是否满足恢复的基本条件
        if last_message and last_message.role == "user" and \
           second_last_message and second_last_message.role == "assistant" and \
           isinstance(second_last_message, AssistantMessage) and second_last_message.tool_calls:

            logger.info("进行恢复会话状态检查")
            last_user_query_content = last_message.content  # 用户输入内容

            # 检查是否是与第一次输入相同的情况（在call_agent工具调用中可能出现）
            first_user_message = self.chat_history.get_first_user_message()
            if last_user_query_content == first_user_message:
                logger.info("检测到最后一次用户输入与第一次用户输入相同，视为用户希望继续")
                last_user_query_content = "继续"
                # 更新历史中的用户消息
                self.chat_history.replace_last_user_message("继续")

            # 处理用户希望继续的情况
            if last_user_query_content.lower() in ["", " ", "继续", "continue"]:
                return await self._handle_continue_request(second_last_message)
            else:
                # 用户提出了新请求
                return await self._handle_new_request(second_last_message)

        # 不满足恢复条件
        logger.debug("最后消息非用户消息，或倒数第二条非带工具调用的助手消息，跳过恢复会话状态检查")
        return skip_llm_call, tool_calls_to_execute, llm_response_message, assistant_message_to_restore

    async def _handle_continue_request(self, second_last_message: AssistantMessage) -> tuple[bool, List[ToolCall], Optional[ChatCompletionMessage], Optional[AssistantMessage]]:
        """
        处理用户请求继续的情况

        Args:
            second_last_message: 倒数第二条消息（带工具调用的助手消息）

        Returns:
            Tuple: (是否跳过LLM调用, 要执行的工具调用列表, LLM响应消息, 要恢复的助手消息)
        """
        logger.info("检测到用户请求继续，尝试恢复上一次工具调用")

        # 检查是否有不可恢复的工具调用
        has_unrecoverable_tool_call = False
        has_tool_call_parse_error = False

        for tc in second_last_message.tool_calls:
            if tc.function.name == "call_agent":
                try:
                    # 解析参数和检查是否为stateful
                    tc_args = json.loads(tc.function.arguments)
                    agent_name_to_call = tc_args.get("agent_name")
                    if agent_name_to_call:
                        agent_to_check = Agent(agent_name_to_call, self.agent_context)
                        if agent_to_check.has_attribute("stateful"):
                            has_unrecoverable_tool_call = True
                            logger.warning(f"检测到不可恢复的 call_agent 调用 (agent: {agent_name_to_call})")
                            break
                except Exception as e:
                    logger.warning(f"检查 call_agent 是否可恢复时出错: {e!s}")
                    logger.warning(f"错误调用栈: {traceback.format_exc()}")
                    has_unrecoverable_tool_call = True
                    has_tool_call_parse_error = True
                    break

        # 处理可恢复的情况
        if not has_unrecoverable_tool_call:
            logger.info("未检测到不可恢复的工具调用，准备恢复会话")
            # 移除用户的"继续"消息
            self.chat_history.remove_last_message()
            # 准备跳过LLM，直接执行工具调用
            return True, [], None, second_last_message
        else:
            # 处理不可恢复的情况
            logger.warning("检测到不可恢复的工具调用，将放弃恢复，并继续执行 LLM 调用")
            # 添加中断提示
            if not has_tool_call_parse_error:
                message_content = "当前工具调用被用户打断且不可恢复，请重新调用工具。"
            else:
                message_content = "当前工具调用存在解析错误，请对工具参数格式进行检查，确保是语法正确的 JSON 对象，并重新调用工具。"

            # 为所有工具调用添加中断消息
            await self._add_interruption_messages(second_last_message.tool_calls, message_content)

            # 移除用户的"继续"消息
            self.chat_history.remove_last_message()
            logger.info("继续执行 LLM 调用")
            return False, [], None, None

    async def _handle_new_request(self, second_last_message: AssistantMessage) -> tuple[bool, List[ToolCall], Optional[ChatCompletionMessage], Optional[AssistantMessage]]:
        """
        处理用户提出新请求的情况

        Args:
            second_last_message: 倒数第二条消息（带工具调用的助手消息）

        Returns:
            Tuple: (是否跳过LLM调用, 要执行的工具调用列表, LLM响应消息, 要恢复的助手消息)
        """
        logger.info("检测到用户有新的请求，将中断之前的工具调用，并让 LLM 处理新请求")

        # 添加中断消息
        message_content = "当前工具调用被用户打断，请结合用户的新请求判断是否要继续执行之前的工具调用，如果需要，则以相同的调用参数继续执行，否则请忽略之前的工具调用，并根据用户的新请求给出新的响应"

        # 为所有工具调用添加中断消息
        await self._add_interruption_messages(second_last_message.tool_calls, message_content)

        # 继续 LLM 调用
        return False, [], None, None

    async def _add_interruption_messages(self, tool_calls: List[ToolCall], message_content: str) -> None:
        """
        为被中断的工具调用添加提示消息

        Args:
            tool_calls: 工具调用列表
            message_content: 提示消息内容
        """
        for tc in reversed(tool_calls):  # 反向遍历以保证插入顺序正确
            interrupt_tool_msg = ToolMessage(
                content=message_content,
                tool_call_id=tc.id,
            )
            try:
                self.chat_history.insert_message_before_last(interrupt_tool_msg)
            except ValueError as e:
                logger.error(f"插入工具中断消息时出错 (ValueError): {e}")
            except Exception as e:
                logger.error(f"插入工具中断消息时发生未知错误: {e}", exc_info=True)

    async def _restore_session_state(self, assistant_message_to_restore: AssistantMessage) -> tuple[List[ToolCall], Optional[ChatCompletionMessage]]:
        """
        从保存的助手消息中恢复会话状态

        Args:
            assistant_message_to_restore: 需要恢复的助手消息

        Returns:
            Tuple: (要执行的工具调用列表, 模拟的LLM响应消息)
        """
        logger.info("跳过LLM调用，直接使用上次会话的工具调用")

        # 确保消息和工具调用有效
        if assistant_message_to_restore and assistant_message_to_restore.tool_calls:
            tool_calls_to_execute = assistant_message_to_restore.tool_calls

            try:
                # 模拟LLM响应消息用于事件传递
                openai_tool_calls_for_sim = [
                    ChatCompletionMessageToolCall(
                        id=tc.id, type=tc.type,
                        function={"name": tc.function.name, "arguments": tc.function.arguments}
                    ) for tc in assistant_message_to_restore.tool_calls
                ]

                llm_response_message = ChatCompletionMessage(
                    role="assistant",
                    content=assistant_message_to_restore.content,
                    tool_calls=openai_tool_calls_for_sim
                )

                return tool_calls_to_execute, llm_response_message
            except Exception as e:
                logger.error(f"模拟恢复会话的 llm_response_message 时出错: {e}", exc_info=True)
                return [], None
        else:
            logger.error("尝试恢复会话，但 assistant_message_to_restore 无效或无工具调用。")
            return [], None

    async def _prepare_and_call_llm(self) -> tuple[ChatCompletionMessage, List[ToolCall], Optional[TokenUsage], float]:
        """
        准备与LLM的对话，处理消息，调用LLM并解析响应

        Returns:
            Tuple: (
                LLM响应消息: ChatCompletionMessage对象
                工具调用列表: 转换后的ToolCall对象列表
                Token使用量: TokenUsage对象
                LLM调用耗时: 毫秒值
            )
        """
        # 使用ChatHistory获取格式化后的消息列表
        messages_for_llm = self.chat_history.get_messages_for_llm()
        if not messages_for_llm:
            logger.error("无法获取用于LLM调用的消息列表(可能历史记录为空或只有内部消息)")
            self.set_agent_state(AgentState.ERROR)
            raise ValueError("无法准备与LLM的对话。")

        # 记录调用开始时间并调用LLM
        llm_start_time = time.time()
        chat_response = await self._call_llm(messages_for_llm)
        llm_duration_ms = (time.time() - llm_start_time) * 1000

        # 获取token使用数据
        token_usage = LLMFactory.token_tracker.extract_chat_history_usage_data(chat_response)

        # 获取LLM响应消息
        llm_response_message = chat_response.choices[0].message

        # 处理LLM响应内容为空的情况
        if llm_response_message.content is None or llm_response_message.content.strip() == "":
            if llm_response_message.tool_calls:
                logger.debug("LLM响应content为空，但包含tool_calls。")
                # 尝试从tool_call explanation获取
                for tool_call in llm_response_message.tool_calls:
                    try:
                        arguments = json.loads(tool_call.function.arguments)
                        if "explanation" in arguments:
                            llm_response_message.content = arguments["explanation"]
                            logger.debug(f"使用tool_call explanation作为LLM content: {llm_response_message.content}")
                            break
                    except (json.JSONDecodeError, AttributeError, TypeError):
                        continue

                # 如果仍为空，设为空字符串
                if llm_response_message.content is None:
                    llm_response_message.content = ""
            else:
                # 没有tool_calls，内容不应为空
                logger.warning("LLM响应消息内容为空且无tool_calls，使用默认值'Continue'")
                try:
                    message_dict = llm_response_message.model_dump()
                    formatted_json = json.dumps(message_dict, ensure_ascii=False, indent=2)
                    logger.warning(f"详细信息:\n{formatted_json}")
                except Exception as e:
                    logger.warning(f"尝试打印LLM响应消息失败: {e!s}")
                llm_response_message.content = "Continue"

        # 解析OpenAI的ToolCalls
        openai_tool_calls = self._parse_tool_calls(chat_response)
        logger.debug(f"来自chat_response的OpenAI tool_calls: {openai_tool_calls}")

        # 标准化并转换为内部ToolCall类型
        tool_calls_to_execute = await self._parse_and_convert_tool_calls(openai_tool_calls)

        # 检查多工具调用
        if not self.enable_multi_tool_calls and len(tool_calls_to_execute) > 1:
            logger.debug("检测到多个工具调用，但多工具调用处理已禁用，只保留第一个")
            tool_calls_to_execute = [tool_calls_to_execute[0]]

        return llm_response_message, tool_calls_to_execute, token_usage, llm_duration_ms

    async def _parse_and_convert_tool_calls(self, openai_tool_calls: List[ChatCompletionMessageToolCall]) -> List[ToolCall]:
        """
        将OpenAI工具调用转换为内部ToolCall格式

        Args:
            openai_tool_calls: OpenAI返回的工具调用列表

        Returns:
            List[ToolCall]: 内部格式的工具调用列表
        """
        tool_calls_to_execute = []

        for tc_openai in openai_tool_calls:
            # 确保类型正确
            if not isinstance(tc_openai, ChatCompletionMessageToolCall):
                logger.warning(f"跳过无效的tool_call类型: {type(tc_openai)}")
                continue

            try:
                # 解析属性
                arguments_str = getattr(getattr(tc_openai, 'function', None), 'arguments', None)
                func_name = getattr(getattr(tc_openai, 'function', None), 'name', None)
                tool_id = getattr(tc_openai, 'id', None)
                tool_type = getattr(tc_openai, 'type', 'function')  # 默认为function

                # 验证必要属性
                if not all([tool_id, func_name, arguments_str is not None]):
                    logger.warning(f"跳过结构不完整的OpenAI ToolCall: {tc_openai}")
                    continue

                # 处理非字符串参数
                if not isinstance(arguments_str, str):
                    logger.warning(f"OpenAI ToolCall arguments非字符串: {arguments_str}，尝试转为JSON字符串")
                    try:
                        arguments_str = json.dumps(arguments_str, ensure_ascii=False)
                    except Exception:
                        logger.error(f"无法将OpenAI ToolCall arguments转为JSON字符串: {arguments_str}，使用空对象字符串")
                        arguments_str = "{}"

                # 创建内部FunctionCall
                internal_func = FunctionCall(
                    name=func_name,
                    arguments=arguments_str
                )

                # 创建内部ToolCall
                internal_tc = ToolCall(
                    id=tool_id,
                    type=tool_type,
                    function=internal_func
                )

                tool_calls_to_execute.append(internal_tc)
            except AttributeError as ae:
                logger.error(f"访问OpenAI ToolCall属性时出错: {tc_openai}, 错误: {ae}", exc_info=True)
            except Exception as e:
                logger.error(f"转换OpenAI ToolCall到内部类型时出错: {tc_openai}, 错误: {e}", exc_info=True)

        return tool_calls_to_execute

    async def _add_tool_calls_to_history(self, llm_response_message: ChatCompletionMessage, tool_calls_to_execute: List[ToolCall], token_usage: Optional[TokenUsage], llm_duration_ms: float) -> None:
        """
        将工具调用响应添加到聊天历史

        Args:
            llm_response_message: LLM响应消息
            tool_calls_to_execute: 工具调用列表
            token_usage: token使用数据
            llm_duration_ms: LLM调用耗时
        """
        try:
            await self.chat_history.append_assistant_message(
                content=llm_response_message.content,
                tool_calls_data=tool_calls_to_execute,
                duration_ms=llm_duration_ms,
                token_usage=token_usage
            )
        except ValueError as e:
            logger.error(f"添加带工具调用的助手消息失败: {e}")
            self.set_agent_state(AgentState.ERROR)
            raise ValueError(f"无法记录助手响应 ({e})")

    async def _handle_no_tool_calls(self, llm_response_message: ChatCompletionMessage, no_tool_call_count: int, token_usage: Optional[TokenUsage], llm_duration_ms: float) -> tuple[int, bool, Optional[str]]:
        """
        处理LLM响应中没有工具调用的情况

        Args:
            llm_response_message: LLM响应消息
            no_tool_call_count: 连续无工具调用计数
            token_usage: token使用数据
            llm_duration_ms: LLM调用耗时

        Returns:
            Tuple: (更新后的无工具调用计数, 是否继续执行, 最终响应)
        """
        no_tool_call_count += 1
        logger.debug(f"检测到没有工具调用，开始检查是否需要退出循环，连续次数: {no_tool_call_count}")

        # 添加LLM响应到历史
        try:
            await self.chat_history.append_assistant_message(
                content=llm_response_message.content,
                duration_ms=llm_duration_ms,
                token_usage=token_usage
            )
        except ValueError as e:
            logger.error(f"添加无工具调用的助手响应时失败: {e}")
            self.set_agent_state(AgentState.ERROR)
            return no_tool_call_count, False, f"内部错误：无法记录助手响应 ({e})"

        # 检查是否达到退出条件
        if no_tool_call_count >= 3:
            logger.warning("检测到连续3次没有工具调用，退出循环")

            # 添加最后的消息到历史
            try:
                await self.chat_history.append_assistant_message(
                    content="看起来我们的任务已经告一段落啦，有什么新的问题可以随时找我✨",
                    show_in_ui=False
                )
            except Exception as e:
                logger.error(f"添加无工具调用退出消息时出错: {e}")

            self.set_agent_state(AgentState.ERROR)
            return no_tool_call_count, False, "任务因连续未调用工具而终止。"

        # 没有退出，追加内部提示消息
        append_content = self._get_no_tool_call_prompt()

        # 作为Assistant消息追加内部提示
        try:
            await self.chat_history.append_assistant_message(append_content, show_in_ui=False)
        except ValueError as e:
            logger.error(f"添加内部提示消息失败: {e}")
            self.set_agent_state(AgentState.ERROR)
            return no_tool_call_count, False, f"内部错误：无法添加内部提示 ({e})"

        return no_tool_call_count, True, None

    def _get_no_tool_call_prompt(self) -> str:
        """
        根据Agent属性获取适当的无工具调用提示

        Returns:
            str: 提示消息内容
        """
        if self.has_attribute("main"):
            return "内部思考(用户不能看到)：如果任务没完成，我就需要继续使用工具解决问题，如果我确定已经完成了所有任务（如：所有 todo.md 中的任务）并以文件的形式向用户交付了最终的结果产物时，我则需要调用 finish_task 工具结束任务。接下来我将检查我的任务是否已经完成，并决定是否调用 finish_task 工具。"
        else:
            return "内部思考(用户不能看到)：如果任务没完成，我就需要继续使用工具解决问题，如果我已经确定完成了用户的要求，或能以文件的形式向用户交付了最终的结果产物时，我需要调用 finish_task 工具结束任务，接下来我将检查我的任务是否已经完成并决定是否调用 finish_task 工具。"

    async def _execute_and_process_tool_calls(self, tool_calls: List[ToolCall], llm_response_message: ChatCompletionMessage) -> tuple[bool, Optional[str]]:
        """
        执行工具调用并处理结果

        Args:
            tool_calls: 工具调用列表
            llm_response_message: LLM响应消息

        Returns:
            Tuple: (是否检测到finish_task, 最终响应)
        """
        # 确保llm_response_message不为空
        if not llm_response_message:
            logger.error("llm_response_message在工具执行前未设置！")
            llm_response_message = ChatCompletionMessage(
                role="assistant",
                content="[Internal Error: Missing LLM Response]"
            )

        # 执行工具调用
        tool_call_results = await self._execute_tool_calls(tool_calls, llm_response_message)

        # 处理工具调用结果
        return await self._process_tool_call_results(tool_call_results)

    async def _process_tool_call_results(self, tool_call_results: List[ToolResult]) -> tuple[bool, Optional[str]]:
        """
        处理工具调用结果

        Args:
            tool_call_results: 工具调用结果列表

        Returns:
            Tuple: (是否检测到finish_task, 最终响应)
        """
        finish_task_detected = False
        final_response = None

        for result in tool_call_results:
            if not result:  # 跳过空结果
                continue

            try:
                # 计算工具执行耗时
                tool_duration_ms = None
                if hasattr(result, 'execution_time') and result.execution_time is not None:
                    try:
                        tool_duration_ms = float(result.execution_time) * 1000
                    except (ValueError, TypeError):
                        logger.warning(f"无法将工具执行时间 {result.execution_time} 转换为毫秒。")

                # 追加工具调用结果到聊天历史
                await self.chat_history.append_tool_message(
                    content=result.content,
                    tool_call_id=result.tool_call_id,
                    system=result.system,
                    duration_ms=tool_duration_ms,
                )

                # 检查特殊工具调用
                if result.system == "FINISH_TASK":
                    logger.info("检测到 FINISH_TASK 工具调用，立即退出循环")
                    final_response = result.content
                    self.set_agent_state(AgentState.FINISHED)
                    finish_task_detected = True
                    break
                elif result.system == "ASK_USER":
                    logger.info("检测到 ASK_USER 工具调用，退出循环")
                    final_response = result.content
                    self.set_agent_state(AgentState.FINISHED)  # Ask user 也算完成当前轮次
                    finish_task_detected = True
                    raise asyncio.CancelledError()
                elif result.name == "call_agent" and self.agent_name == "super-magic":
                    logger.info("检测到 super-magic 智能体进行了 call_agent 工具调用，将追加任务确认提醒消息")
                    await self.chat_history.append_assistant_message(
                        content="内部思考(用户不能看到)：我已经让其它智能体进行了任务，我需要检查它们的工作进度和结果，如果我确定它已经完成了它的任务，那么我应该确认 todo.md 文件中对应的任务是否已经完成，如果已经完成我需要将对应的任务状态标记为已完成，如果未完成那么我应该思考其它方法并通过调用 call_agent 工具来继续任务。注意不能让用户知道其它智能体的存在。",
                        show_in_ui=False
                    )

            except asyncio.CancelledError:
                # 重新抛出CancelledError，确保循环被终止
                logger.info("重新抛出CancelledError以终止循环")
                raise
            except ValueError as ve:
                logger.error(f"处理或追加工具调用结果时发生错误: {ve!s}")
            except Exception as e:
                logger.error(f"处理工具结果 '{getattr(result, 'name', 'unknown')}' 时发生未知错误: {e!r}", exc_info=True)

        # 检查是否需要退出
        if finish_task_detected:
            logger.info("特殊工具调用已处理，跳出主循环")

        return finish_task_detected, final_response

    async def _handle_agent_loop_exception(self, exception: Exception, current_exception_count: int) -> tuple[bool, Optional[str], int]:
        """
        处理Agent循环中的异常

        Args:
            exception: 捕获的异常
            current_exception_count: 当前异常计数

        Returns:
            Tuple: (是否继续循环, 最终响应, 更新后的异常计数)
        """
        logger.error(f"Agent循环执行过程中发生错误: {exception!r}")
        logger.error(f"错误堆栈: {traceback.format_exc()}")
        self.set_agent_state(AgentState.ERROR)

        # 处理中断的工具调用
        await self._handle_interrupted_tool_calls(exception)

        # 更新异常计数
        current_exception_count += 1

        # 计算重试策略
        max_retries = 10

        # 使用指数退避策略
        wait_time, total_retry_wait_time = self._apply_exponential_backoff(current_exception_count)

        # 判断是否可以继续重试
        can_continue = current_exception_count < max_retries and total_retry_wait_time < 900

        # 准备错误内容
        if can_continue:
            error_content = "任务执行过程中遇到了错误，通常是工具的参数有语法错误、类型错误或遗漏了参数，我将进行重试。"
            logger.info(f"将等待{wait_time:.1f}秒后进行第{current_exception_count}次重试（总计已等待{total_retry_wait_time:.1f}秒）")
        else:
            if current_exception_count >= max_retries:
                error_content = f"任务执行过程中遇到了错误，我已默默尝试了{current_exception_count}次修复，达到最大重试次数{max_retries}次。我应该已经完成了任务的一部分，可能需要你检查我当前的任务进度，并帮助我来继续任务。"
            else:  # 超过总等待时间
                error_content = "任务执行过程中遇到了错误，总等待时间已达到限制，不再继续重试。我应该已经完成了任务的一部分，可能需要你检查我当前的任务进度，并帮助我来继续任务。"

        # 检查特殊错误情况
        result = None  # 确保result变量在局部作用域中存在
        if 'result' in locals() and result and hasattr(result, 'ok') and not result.ok:
            error_content = result.content  # 使用工具返回的错误信息
        elif isinstance(exception, json.JSONDecodeError):
            error_content = f"工具参数解析失败，请检查JSON格式: {exception}"
        elif "Connection" in str(exception):
            error_content = "我遇到了一个网络连接错误，可能是因为我一次性输出了过大的内容。我将尝试分段输出。若还是失败我将换个方案以继续任务。"
        else:
            error_content = f"任务执行过程中遇到了错误: {type(exception).__name__}: {exception!s}"

        # 添加错误消息到历史
        try:
            await self.chat_history.append_assistant_message(error_content, show_in_ui=False)
        except Exception as append_err:
            logger.error(f"添加最终错误消息到历史记录时失败: {append_err}")

        # 如果可以继续，执行等待
        if can_continue:
            logger.warning(f"虽然遇到了错误，但还没有达到最大尝试次数，等待{wait_time:.1f}秒后继续下一次循环")
            time.sleep(wait_time)  # 确保执行实际的等待
            return True, None, current_exception_count
        else:
            logger.warning(f"已达到最大重试次数({max_retries})或最大等待时间(15分钟)，退出循环")
            return False, error_content, current_exception_count

    async def _handle_interrupted_tool_calls(self, exception: Exception) -> None:
        """
        处理因异常而中断的工具调用

        Args:
            exception: 捕获的异常
        """
        # 如果最后一条消息是带有工具调用的助手消息，为每个调用添加错误信息
        last_message = self.chat_history.get_last_message()
        if isinstance(last_message, AssistantMessage) and last_message.tool_calls:
            general_error_message = f"由于处理过程中出现意外错误 ({exception!s})，工具调用被中断，请重新检查工具调用的参数是否正确。"
            for tool_call in last_message.tool_calls:
                try:
                    await self.chat_history.append_tool_message(
                        content=general_error_message,
                        tool_call_id=tool_call.id,
                    )
                    logger.info(f"为中断的工具调用 {tool_call.id} ({tool_call.function.name}) 添加了错误消息。")
                except Exception as insert_err:
                    logger.error(f"插入工具调用 {tool_call.id} 的错误消息时失败: {insert_err!s}")

    def _apply_exponential_backoff(self, retry_count: int) -> tuple[float, float]:
        """
        应用指数退避策略计算重试等待时间

        Args:
            retry_count: 重试次数

        Returns:
            Tuple: (本次等待时间, 总计等待时间)
        """
        # 基础等待时间为2秒，每次失败后翻倍，最多等待5分钟
        base_wait_time = 2
        max_wait_time = 300

        # 计算当前等待时间
        wait_time = min(base_wait_time * (2 ** (retry_count - 1)), max_wait_time)

        # 计算总等待时间
        if not hasattr(self, '_total_retry_wait_time'):
            self._total_retry_wait_time = 0

        self._total_retry_wait_time += wait_time

        return wait_time, self._total_retry_wait_time

    async def _finalize_agent_loop(self, final_response: Optional[str], last_llm_message: Optional[ChatCompletionMessage]) -> Optional[str]:
        """
        完成Agent循环后的清理和结果处理

        Args:
            final_response: 最终响应内容
            last_llm_message: 最后的LLM响应消息

        Returns:
            str: 最终响应
        """
        # 处理循环正常结束但最终响应未设置的情况
        if not final_response and last_llm_message:
            # 获取最后添加的消息
            last_added_msg = self.chat_history.get_last_message()

            # 检查last_added_msg是否包含预期内容
            if last_added_msg and isinstance(last_added_msg, AssistantMessage) and last_added_msg.content == last_llm_message.content:
                final_response = last_llm_message.content
            else:
                # 如果最后消息不是预期的内容
                if last_llm_message.content:
                    final_response = last_llm_message.content
                    # 确保最终响应被记录（如果循环内没有添加）
                    if not (last_added_msg and isinstance(last_added_msg, AssistantMessage) and last_added_msg.content == final_response):
                        await self.chat_history.append_assistant_message(final_response)
                else:
                    # 如果最后LLM响应内容为空（理论上不应发生，除非只有tool_calls）
                    logger.info("循环结束，但最后的LLM响应内容为空。")
                    final_response = None  # 明确设为None

        # 记录最终响应
        if final_response:
            logger.info(f"最终响应: {final_response}")
        else:
            logger.info("最终响应为空")

        # 更新Agent状态 - 使用is_agent_running替代直接比较
        if self.is_agent_running():
            self.set_agent_state(AgentState.FINISHED)

        # 记录token使用情况 - 只在非流模式下打印
        if not self.stream_mode:
            self.print_token_usage()

        return final_response

    async def _handle_agent_loop_stream(self) -> None:
        """处理 agent 循环流"""
        # 目前未实现流式处理，返回空值
        return None

    async def _call_llm(self, messages: List[Dict[str, Any]]) -> ChatCompletion:
        """调用 LLM"""

        # 将工具实例转换为LLM需要的格式
        tools_list = []
        if self.tools:
            for tool_name in self.tools.keys():
                tool_instance: BaseTool = tool_factory.get_tool_instance(tool_name)
                # 确保工具实例有效
                if tool_instance:
                    tool_param = tool_instance.to_param()
                    tools_list.append(tool_param)
                else:
                    logger.warning(f"无法获取工具实例: {tool_name}")

        # 保存工具列表到与聊天记录同名的.tools.json文件
        if self.chat_history and tools_list:
            self.chat_history.save_tools_list(tools_list)

        # 创建 ToolContext 实例
        tool_context = ToolContext(metadata=self.agent_context.get_metadata())
        # 将 AgentContext 作为扩展注册
        tool_context.register_extension("agent_context", self.agent_context)

        await self.agent_context.dispatch_event(
            EventType.BEFORE_LLM_REQUEST,
            BeforeLlmRequestEventData(
                model_name=self.llm_name,
                chat_history=messages, # 传递格式化后的字典列表
                tools=tools_list,
                tool_context=tool_context
            )
        )

        # ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ 调用 LLM ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ #
        start_time = time.time()
        # logger.debug(f"发送给 LLM 的 messages: {messages}")

        # 使用 LLMFactory.call_with_tool_support 方法统一处理工具调用
        llm_response: ChatCompletion = await LLMFactory.call_with_tool_support(
            self.llm_id,
            messages, # 传递字典列表
            tools=tools_list if tools_list else None,
            stop=self.agent_context.stop_sequences if hasattr(self.agent_context, 'stop_sequences') else None,
            agent_context=self.agent_context
        )

        llm_response_message = llm_response.choices[0].message
        request_time = time.time() - start_time
        # ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ 调用 LLM 结束 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ #

        # 从 TokenUsageTracker 获取最近一次记录的、结构化的 TokenUsage 对象
        current_token_usage = LLMFactory.token_tracker.get_last_recorded_usage()

        # --- 处理 LLM 响应内容为空的情况 ---
        # ChatHistory 标准化应该已经处理了大部分情况，这里作为最后防线
        # 特别是处理 API 返回的 content 为 None 但有 tool_calls 的情况
        if llm_response_message.content is None or llm_response_message.content.strip() == "":
            if llm_response_message.tool_calls:
                 # 如果有 tool_calls，content 为 None 是合法的，不需要修改
                 # 但为了日志和后续处理，可以给一个内部标记或默认值
                 logger.debug("LLM 响应 content 为空，但包含 tool_calls。")
                 # 保持 llm_response_message.content 为 None 或空字符串
                 # 如果后续逻辑需要非空 content，可以在那里处理
                 # 这里我们尝试从 tool_call explanation 获取 (如果存在)
                 for tool_call in llm_response_message.tool_calls:
                      try:
                           arguments = json.loads(tool_call.function.arguments)
                           if "explanation" in arguments:
                                llm_response_message.content = arguments["explanation"]
                                # 从 arguments 里去掉 explanation (虽然这里修改的是响应对象，可能不影响历史记录)
                                # del arguments["explanation"]
                                # tool_call.function.arguments = json.dumps(arguments, ensure_ascii=False)
                                logger.debug(f"使用 tool_call explanation 作为 LLM content: {llm_response_message.content}")
                                break # 找到第一个就用
                      except (json.JSONDecodeError, AttributeError, TypeError):
                           continue # 忽略解析错误或无效结构
                 # 如果仍为空，保持原样 (None 或空)
                 if llm_response_message.content is None:
                     llm_response_message.content = "" # 设为空字符串而不是None，简化后续处理

            else:
                 # 没有 tool_calls，内容不应为空
                 logger.warning("LLM 响应消息内容为空且无 tool_calls，使用默认值 'Continue'")
                 # 使用漂亮的 JSON 格式打印有问题的消息
                 try:
                     message_dict = llm_response_message.model_dump() # pydantic v2
                     formatted_json = json.dumps(message_dict, ensure_ascii=False, indent=2)
                     logger.warning(f"详细信息:\n{formatted_json}")
                 except Exception as e:
                     logger.warning(f"尝试打印 LLM 响应消息失败: {e!s}")
                 llm_response_message.content = "Continue" # 强制设为 Continue


        logger.info(f"LLM 响应: role={llm_response_message.role}, content='{llm_response_message.content[:100]}...', tool_calls={llm_response_message.tool_calls is not None}")

        await self.agent_context.dispatch_event(
            EventType.AFTER_LLM_REQUEST,
            AfterLlmResponseEventData(
                model_name=self.llm_name,
                request_time=request_time,
                success=True,
                tool_context=tool_context,
                llm_response_message=llm_response_message, # 传递原始响应消息
                token_usage=current_token_usage # Added token_usage
            )
        )

        return llm_response

    async def _execute_tool_calls(self, tool_calls: List[ToolCall], llm_response_message: ChatCompletionMessage) -> List[ToolResult]:
        """执行 Tools 调用，支持并行执行"""
        if not self.enable_parallel_tool_calls or len(tool_calls) <= 1:
            # 非并行模式或只有一个工具调用时，使用原来的逻辑
            logger.debug("使用顺序执行模式处理工具调用")
            return await self._execute_tool_calls_sequential(tool_calls, llm_response_message)
        else:
            # 并行模式
            logger.info(f"使用并行执行模式处理 {len(tool_calls)} 个工具调用")
            return await self._execute_tool_calls_parallel(tool_calls, llm_response_message)

    async def _execute_tool_calls_sequential(self, tool_calls: List[ToolCall], llm_response_message: ChatCompletionMessage) -> List[ToolResult]:
        """使用顺序模式执行 Tools 调用（原始逻辑）"""
        results = []
        for tool_call in tool_calls:
            result = None
            tool_name = "[unknown]"
            try:
                tool_name = tool_call.function.name
                tool_arguments_str = tool_call.function.arguments

                # 尝试将参数字符串解析为字典，用于工具执行和事件传递
                try:
                    tool_arguments_dict = json.loads(tool_arguments_str)
                    if not isinstance(tool_arguments_dict, dict):
                        logger.warning(f"工具 '{tool_name}' 的参数解析后不是字典，将传递空字典。")
                        logger.warning(f"原始参数数据：{tool_arguments_str}")
                        logger.warning(f"解析后结果：{tool_arguments_dict}")
                        tool_arguments_for_exec = {}
                    else:
                        tool_arguments_for_exec = tool_arguments_dict
                except json.JSONDecodeError as e:
                    logger.warning(f"工具 '{tool_name}' 的参数无法解析为 JSON，将传递空字典。")
                    logger.warning(f"原始参数数据：{tool_arguments_str}")
                    logger.warning(f"完整报错信息：{e}")
                    tool_arguments_for_exec = {}

                try:
                    # 创建工具上下文，确保传递 agent_context 的 metadata
                    tool_context = ToolContext(
                        tool_call_id=tool_call.id,
                        tool_name=tool_name,
                        arguments=tool_arguments_for_exec,
                        metadata=self.agent_context.get_metadata()
                    )
                    # 添加 AgentContext 扩展
                    tool_context.register_extension("agent_context", self.agent_context)
                    # 添加EventContext扩展
                    from app.core.entity.event.event_context import EventContext
                    tool_context.register_extension("event_context", EventContext())

                    logger.info(f"开始执行工具: {tool_name}, 参数: {tool_arguments_for_exec}")

                    # --- 触发 before_tool_call 事件 ---
                    tool_instance = tool_factory.get_tool_instance(tool_name)
                    # 需要将内部 ToolCall 转换回 OpenAI 类型用于事件
                    openai_tool_call_for_event = ChatCompletionMessageToolCall(
                         id=tool_call.id, type=tool_call.type,
                         function={"name": tool_name, "arguments": tool_arguments_str}
                    )
                    await self.agent_context.dispatch_event(
                        EventType.BEFORE_TOOL_CALL,
                        BeforeToolCallEventData(
                            tool_call=openai_tool_call_for_event,
                            tool_context=tool_context,
                            tool_name=tool_name,
                            arguments=tool_arguments_for_exec,
                            tool_instance=tool_instance,
                            llm_response_message=llm_response_message
                        )
                    )

                    # --- 执行工具 ---
                    result = await tool_executor.execute_tool_call(
                        tool_context=tool_context,
                        arguments=tool_arguments_for_exec
                    )
                    # 确保 result.tool_call_id 已设置
                    if not result.tool_call_id:
                         result.tool_call_id = tool_call.id

                    # --- 触发 after_tool_call 事件 ---
                    await self.agent_context.dispatch_event(
                        EventType.AFTER_TOOL_CALL,
                        AfterToolCallEventData(
                            tool_call=openai_tool_call_for_event,
                            tool_context=tool_context,
                            tool_name=tool_name,
                            arguments=tool_arguments_for_exec,
                            result=result,
                            execution_time=result.execution_time,
                            tool_instance=tool_instance
                        )
                    )
                except Exception as e:
                    # 打印错误堆栈
                    print(traceback.format_exc())
                    logger.error(f"执行工具 '{tool_name}' 时出错: {e}", exc_info=True)
                    # 创建失败的 ToolResult，确保有 tool_call_id
                    result = ToolResult(
                        content=f"执行工具 '{tool_name}' 失败: {e!s}",
                        tool_call_id=tool_call.id,
                        ok=False
                    )

                results.append(result)
            except AttributeError as attr_err:
                 logger.error(f"处理工具调用对象时访问属性出错: {tool_call}, 错误: {attr_err!r}", exc_info=True)
                 # 如果在循环的早期阶段出错，尝试创建一个包含错误信息的 ToolResult
                 tool_call_id_fallback = getattr(tool_call, 'id', None)
                 tool_name_fallback = getattr(getattr(tool_call, 'function', None), 'name', '[unknown_early_error]')
                 if tool_call_id_fallback:
                     results.append(ToolResult(
                         content=f"处理工具调用失败 (AttributeError): {attr_err!s}",
                         tool_call_id=tool_call_id_fallback,
                         name=tool_name_fallback,
                         ok=False
                     ))
                 else:
                     # 如果连 id 都没有，无法创建 ToolResult，只能记录日志
                     logger.error(f"无法创建工具失败结果：缺少 tool_call_id。错误: {attr_err!s}")

            except Exception as outer_err:
                # 捕获 tool_call 对象本身处理（如属性访问）或 result 添加过程中的其他异常
                logger.error(f"处理工具调用对象或添加结果时发生严重错误: {tool_call}, 错误: {outer_err}", exc_info=True)
                tool_call_id_fallback = getattr(tool_call, 'id', None)
                tool_name_fallback = getattr(getattr(tool_call, 'function', None), 'name', '[unknown_outer_error]')
                if tool_call_id_fallback:
                    results.append(ToolResult(
                        content=f"处理工具调用或结果失败: {outer_err!s}",
                        tool_call_id=tool_call_id_fallback,
                        name=tool_name_fallback,
                        ok=False
                    ))
                else:
                    logger.error(f"无法创建工具失败结果：缺少 tool_call_id。错误: {outer_err!s}")

        return results

    async def _execute_tool_calls_parallel(self, tool_calls: List[ToolCall], llm_response_message: ChatCompletionMessage) -> List[ToolResult]:
        """使用并行模式执行 Tools 调用"""
        # 创建一个包含所有工具调用信息的列表，用于并行处理
        tool_tasks = []

        logger.info(f"准备并行执行 {len(tool_calls)} 个工具调用，超时设置：{self.parallel_tool_calls_timeout}秒")

        # 1. 预处理所有工具调用，生成执行任务
        for tool_call in tool_calls:
            try:
                tool_name = tool_call.function.name
                tool_arguments_str = tool_call.function.arguments
                tool_call_id = tool_call.id

                # 尝试将参数字符串解析为字典
                try:
                    tool_arguments_dict = json.loads(tool_arguments_str)
                    if not isinstance(tool_arguments_dict, dict):
                        logger.warning(f"并行工具调用：'{tool_name}' 的参数解析后不是字典，将传递空字典")
                        logger.warning(f"原始参数数据：{tool_arguments_str}")
                        logger.warning(f"解析后结果：{tool_arguments_dict}")
                        tool_arguments_for_exec = {}
                    else:
                        tool_arguments_for_exec = tool_arguments_dict
                except json.JSONDecodeError as e:
                    logger.warning(f"并行工具调用：'{tool_name}' 的参数无法解析为 JSON，将传递空字典")
                    logger.warning(f"原始参数数据：{tool_arguments_str}")
                    logger.warning(f"完整报错信息：{e}")
                    tool_arguments_for_exec = {}

                # 创建工具上下文
                tool_context = ToolContext(
                    tool_call_id=tool_call_id,
                    tool_name=tool_name,
                    arguments=tool_arguments_for_exec,
                    metadata=self.agent_context.get_metadata()
                )
                # 将 AgentContext 作为扩展注册
                tool_context.register_extension("agent_context", self.agent_context)

                # 添加 EventContext 扩展
                from app.core.entity.event.event_context import EventContext
                tool_context.register_extension("event_context", EventContext())

                # 获取工具实例
                tool_instance = tool_factory.get_tool_instance(tool_name)

                # 需要将内部 ToolCall 转换回 OpenAI 类型用于事件
                openai_tool_call = ChatCompletionMessageToolCall(
                    id=tool_call_id,
                    type=tool_call.type,
                    function={"name": tool_name, "arguments": tool_arguments_str}
                )

                # 将工具调用信息添加到任务列表
                tool_tasks.append({
                    "tool_call": tool_call,
                    "openai_tool_call": openai_tool_call,
                    "tool_context": tool_context,
                    "tool_name": tool_name,
                    "arguments": tool_arguments_for_exec,
                    "tool_instance": tool_instance
                })

            except Exception as e:
                logger.error(f"预处理工具调用时出错: {e}", exc_info=True)
                # 对于预处理失败的工具调用，添加错误结果
                try:
                    tool_call_id = getattr(tool_call, 'id', None)
                    tool_name = getattr(getattr(tool_call, 'function', None), 'name', '[unknown]')
                    if tool_call_id:
                        # 创建错误结果
                        error_result = ToolResult(
                            content=f"预处理工具调用 '{tool_name}' 失败: {e!s}",
                            tool_call_id=tool_call_id,
                            name=tool_name,
                            ok=False
                        )
                        # 单独处理这个错误结果
                        error_task = {
                            "error_result": error_result,
                            "is_error": True
                        }
                        tool_tasks.append(error_task)
                except Exception as err:
                    logger.error(f"创建工具调用错误结果时出错: {err}", exc_info=True)

        # 如果没有有效的工具调用任务，直接返回
        if not tool_tasks:
            logger.warning("没有有效的工具调用任务可执行")
            return []

        # 2. 定义单个工具执行的异步函数
        async def execute_single_tool(task_info):
            # 检查是否是预处理时的错误结果
            if task_info.get("is_error", False):
                return task_info.get("error_result")

            tool_call = task_info["tool_call"]
            openai_tool_call = task_info["openai_tool_call"]
            tool_context = task_info["tool_context"]
            tool_name = task_info["tool_name"]
            arguments = task_info["arguments"]
            tool_instance = task_info["tool_instance"]

            start_time = time.time()

            try:
                # 分发工具调用前事件
                await self.agent_context.dispatch_event(
                    EventType.BEFORE_TOOL_CALL,
                    BeforeToolCallEventData(
                        tool_call=openai_tool_call,
                        tool_context=tool_context,
                        tool_name=tool_name,
                        arguments=arguments,
                        tool_instance=tool_instance,
                        llm_response_message=llm_response_message
                    )
                )

                # 执行工具调用
                logger.info(f"并行执行工具: {tool_name}, 参数: {arguments}")
                result = await tool_executor.execute_tool_call(
                    tool_context=tool_context,
                    arguments=arguments
                )

                # 确保结果包含tool_call_id
                if not result.tool_call_id:
                    result.tool_call_id = tool_call.id

                # 计算执行时间
                execution_time = time.time() - start_time
                result.execution_time = execution_time

                # 分发工具调用后事件
                await self.agent_context.dispatch_event(
                    EventType.AFTER_TOOL_CALL,
                    AfterToolCallEventData(
                        tool_call=openai_tool_call,
                        tool_context=tool_context,
                        tool_name=tool_name,
                        arguments=arguments,
                        result=result,
                        execution_time=execution_time,
                        tool_instance=tool_instance
                    )
                )

                return result

            except Exception as e:
                logger.error(f"并行执行工具 '{tool_name}' 时出错: {e}", exc_info=True)
                # 计算执行时间（即使出错）
                execution_time = time.time() - start_time
                # 创建失败的 ToolResult
                error_result = ToolResult(
                    content=f"执行工具 '{tool_name}' 失败: {e!s}",
                    tool_call_id=tool_call.id,
                    name=tool_name,
                    ok=False,
                    execution_time=execution_time
                )
                return error_result

        # 3. 使用 Parallel 类并行执行所有工具调用
        parallel = Parallel(timeout=self.parallel_tool_calls_timeout)

        # 为每个工具调用添加任务
        for task_info in tool_tasks:
            parallel.add(execute_single_tool, task_info)

        # 并行执行所有工具调用并收集结果
        try:
            results = await parallel.run()
            logger.info(f"完成并行执行 {len(results)} 个工具调用")
            return results
        except asyncio.TimeoutError as e:
            logger.error(f"并行执行工具调用超时: {e}")
            # 超时处理：为每个工具调用创建超时错误结果
            timeout_results = []
            for task_info in tool_tasks:
                if task_info.get("is_error", False):
                    # 保留预处理错误
                    timeout_results.append(task_info.get("error_result"))
                else:
                    tool_call = task_info["tool_call"]
                    tool_name = task_info["tool_name"]
                    timeout_result = ToolResult(
                        content=f"执行工具 '{tool_name}' 超时，超过了 {self.parallel_tool_calls_timeout} 秒的限制",
                        tool_call_id=tool_call.id,
                        name=tool_name,
                        ok=False
                    )
                    timeout_results.append(timeout_result)
            return timeout_results
