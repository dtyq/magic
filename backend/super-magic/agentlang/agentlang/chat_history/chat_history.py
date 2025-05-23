# -*- coding: utf-8 -*-
"""
此模块定义了用于管理聊天记录的类。
"""

import json
import os
from dataclasses import asdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

import tiktoken

from agentlang.chat_history.chat_history_compressor import ChatHistoryCompressor

# 从新的模块导入类型和工具
from agentlang.chat_history.chat_history_models import (
    AssistantMessage,
    ChatMessage,
    CompressionConfig,
    FunctionCall,
    SystemMessage,
    ToolCall,
    ToolMessage,
    UserMessage,
    format_duration_to_str,
    parse_duration_from_str,
)
from agentlang.llms.token_usage.models import TokenUsage
from agentlang.logger import get_logger

logger = get_logger(__name__)

# ==============================================================================
# ChatHistory 类
# ==============================================================================

class ChatHistory:
    """
    管理 Agent 的聊天记录，提供加载、保存、添加和查询消息的功能。
    使用强类型的 ChatMessage 对象列表存储消息。
    """

    def __init__(self, agent_name: str, agent_id: str, chat_history_dir: str,
                 compression_config: Optional[CompressionConfig] = None):
        """
        初始化 ChatHistory。

        Args:
            agent_name (str): Agent 的名称，用于构建文件名。
            agent_id (str): Agent 的唯一 ID，用于构建文件名。
            chat_history_dir (str): 存储聊天记录文件的目录。
            compression_config (Optional[CompressionConfig]): 压缩配置，如不提供则使用默认配置。
        """
        if not agent_name:
            raise ValueError("agent_name 不能为空")
        if not agent_id:
            raise ValueError("agent_id 不能为空")
        if not chat_history_dir:
            raise ValueError("chat_history_dir 不能为空")

        self.agent_name = agent_name
        self.agent_id = agent_id
        self.chat_history_dir = chat_history_dir
        self.messages: List[ChatMessage] = []

        # 设置压缩配置，如未提供则使用默认配置
        self.compression_config = compression_config or CompressionConfig()
        self.compression_config.agent_name = agent_name
        self.compression_config.agent_id = agent_id

        # 压缩状态跟踪
        self._last_compression_message_count = 0
        self._last_compression_token_count = 0

        os.makedirs(self.chat_history_dir, exist_ok=True) # 确保目录存在
        self._history_file_path = self._build_chat_history_filename()
        self.load() # 初始化时尝试加载历史记录

        # 实例化压缩器
        self.compressor = ChatHistoryCompressor(self.compression_config)

    @property
    def count(self) -> int:
        """
        获取聊天历史中的消息数量。

        Returns:
            int: 消息数量
        """
        return len(self.messages)

    @property
    def tokens_count(self) -> int:
        """
        统计聊天历史中消耗的token总数。
        优先使用消息中已有的token_usage数据，对于没有token_usage的消息，
        使用tiktoken计算token数并保存到消息的token_usage属性中。

        Returns:
            int: token总数
        """
        encoding = None
        try:
            # 尝试加载编码器，如果失败则在后续步骤中处理
            encoding = tiktoken.get_encoding("cl100k_base")
        except Exception as e:
            logger.warning(f"加载tiktoken编码器失败: {e!s}，将在遇到无token_usage的消息时使用备选计算方法")

        total_tokens = 0
        history_updated = False

        for i, msg in enumerate(self.messages):
            msg_tokens = 0

            # 1. 优先使用已有的token_usage数据
            if isinstance(msg, AssistantMessage) and msg.token_usage is not None:
                # 对于 AssistantMessage 使用 token_usage 对象 (统一为 TokenUsage 类型)
                # 如果有 total_tokens，使用它；否则使用 output_tokens 或 input_tokens
                if hasattr(msg.token_usage, "total_tokens") and msg.token_usage.total_tokens > 0:
                    msg_tokens = msg.token_usage.total_tokens
                elif hasattr(msg.token_usage, "output_tokens") and msg.token_usage.output_tokens > 0:
                    msg_tokens = msg.token_usage.output_tokens
                elif hasattr(msg.token_usage, "input_tokens") and msg.token_usage.input_tokens > 0:
                    msg_tokens = msg.token_usage.input_tokens

                if msg_tokens > 0:
                    total_tokens += msg_tokens
                    continue  # 已有有效的token_usage数据，跳过tiktoken计算

            # 2. 无有效token_usage数据，使用tiktoken计算
            if encoding:
                try:
                    # 计算消息内容的token数
                    content = getattr(msg, 'content', '') or ''
                    content_tokens = len(encoding.encode(content))

                    # 估算消息元数据的token数（角色等）
                    metadata_tokens = 4  # 每条消息大约4个token用于角色等基本信息

                    # 处理工具调用消息
                    if isinstance(msg, AssistantMessage) and msg.tool_calls:
                        tool_tokens = 0
                        for tc in msg.tool_calls:
                            # 计算工具名称和参数的token
                            tool_name = tc.function.name
                            tool_args = tc.function.arguments

                            # 计算工具调用的token
                            tool_tokens += len(encoding.encode(tool_name)) + len(encoding.encode(tool_args)) + 10
                        content_tokens += tool_tokens

                    # 处理工具结果消息
                    if isinstance(msg, ToolMessage):
                        metadata_tokens += 4  # 工具结果消息额外token

                    msg_tokens = content_tokens + metadata_tokens

                    # 3. 将计算结果保存到消息的token_usage属性中
                    if isinstance(msg, AssistantMessage):
                        if msg.token_usage is None:
                            # 使用新的 TokenUsage 类创建对象
                            # 作为估算值，我们将 msg_tokens 全部分配给 output_tokens
                            msg.token_usage = TokenUsage(
                                input_tokens=0,
                                output_tokens=msg_tokens,
                                total_tokens=msg_tokens
                            )
                            history_updated = True

                    total_tokens += msg_tokens

                except Exception as e:
                    logger.warning(f"使用tiktoken计算第{i+1}条消息token失败: {e!s}")
                    # 计算失败时使用备选方案：根据消息内容长度估算
                    try:
                        content = getattr(msg, 'content', '') or ''
                        # 粗略估计：1个token约等于4个字符
                        estimated_tokens = len(content) // 4 + 5  # 5是基础开销
                        total_tokens += estimated_tokens
                        logger.warning(f"使用长度估算方法计算token: {estimated_tokens}")
                    except Exception as est_err:
                        logger.error(f"备选token估算也失败: {est_err!s}")
                        # 如果连估算都失败，加一个最小值
                        total_tokens += 5

            else:
                # 如果没有encoding，使用字符长度估算
                try:
                    content = getattr(msg, 'content', '') or ''
                    # 粗略估计：1个token约等于4个字符
                    estimated_tokens = len(content) // 4 + 5  # 5是基础开销
                    total_tokens += estimated_tokens
                except Exception as est_err:
                    logger.error(f"备选token估算失败: {est_err!s}")
                    total_tokens += 5

        # 如果有更新token_usage，保存聊天历史
        if history_updated:
            try:
                self.save()
                logger.debug("已更新消息的token_usage数据并保存聊天历史")
            except Exception as e:
                logger.warning(f"保存更新的token_usage数据失败: {e!s}")

        return total_tokens

    def _build_chat_history_filename(self) -> str:
        """构建聊天记录文件的完整路径"""
        filename = f"{self.agent_name}<{self.agent_id}>.json"
        return os.path.join(self.chat_history_dir, filename)

    def _build_tools_list_filename(self) -> str:
        """构建工具列表文件的完整路径"""
        filename = f"{self.agent_name}<{self.agent_id}>.tools.json"
        return os.path.join(self.chat_history_dir, filename)

    def exists(self) -> bool:
        """检查历史记录文件是否存在"""
        return os.path.exists(self._history_file_path)

    def load(self) -> None:
        """
        从 JSON 文件加载聊天记录。
        会查找 'duration' 字符串字段并尝试解析为 duration_ms (float)。
        会查找 'show_in_ui' 字段，如果不存在则默认为 True。
        """
        if not self.exists():
            logger.info(f"聊天记录文件不存在: {self._history_file_path}，将初始化为空历史。")
            self.messages = []
            return

        try:
            with open(self._history_file_path, "r", encoding='utf-8') as f:
                history_data = json.load(f)

            loaded_messages = []
            if isinstance(history_data, list):
                for msg_dict in history_data:
                    if not isinstance(msg_dict, dict):
                        logger.warning(f"加载历史时跳过无效的条目 (非字典): {msg_dict}")
                        continue

                    role = msg_dict.get("role")
                    # 创建一个副本用于实例化，只包含 dataclass 定义的字段
                    args_dict = {} # 从空字典开始，只添加需要的
                    # 通用字段 (移除单独的 token 字段)
                    for key in [
                        "content", "role", "tool_calls", "tool_call_id",
                        # "created_at", "system", "prompt_tokens", "completion_tokens", "cached_tokens",
                        #"cache_write_tokens", "cache_hit_tokens" #<-- 移除
                    ]:
                         if key in msg_dict:
                              args_dict[key] = msg_dict[key]
                              # # 对 token 字段做类型检查和转换，防止加载旧的错误数据 <-- 移除
                              # if key.endswith("_tokens"):
                              #     try:
                              #         args_dict[key] = int(msg_dict[key]) if msg_dict[key] is not None else None
                              #     except (ValueError, TypeError):
                              #         logger.warning(f"加载历史时 token 字段 '{key}' 值无效: {msg_dict[key]}，将忽略。")
                              #         args_dict[key] = None
                              # else:
                              #      args_dict[key] = msg_dict[key]

                    # 处理 show_in_ui (替换 is_internal)
                    # 默认为 True，除非显式指定为 False
                    show_ui_value = msg_dict.get("show_in_ui", msg_dict.get("is_internal") == False if "is_internal" in msg_dict else True)
                    args_dict["show_in_ui"] = bool(show_ui_value)

                    # 特殊处理 duration: 从 'duration' 字符串解析到 'duration_ms' float
                    parsed_duration_ms = None
                    duration_str = msg_dict.get("duration")
                    if duration_str is not None:
                        parsed_duration_ms = parse_duration_from_str(duration_str)
                        if parsed_duration_ms is None:
                             logger.warning(f"加载历史时未能解析 'duration' 字段: {duration_str}，将忽略。消息: {msg_dict}")

                    # 如果解析成功，添加到 args_dict (仅 assistant 和 tool)
                    if role in ["assistant", "tool"] and parsed_duration_ms is not None:
                        args_dict["duration_ms"] = parsed_duration_ms
                    # 兼容旧的 duration_ms float 字段（如果存在且 duration 字符串不存在）
                    elif role in ["assistant", "tool"] and "duration_ms" in msg_dict and duration_str is None:
                        try:
                             legacy_duration_ms = float(msg_dict["duration_ms"])
                             args_dict["duration_ms"] = legacy_duration_ms
                             logger.debug(f"从旧的 duration_ms 字段加载了耗时: {legacy_duration_ms}")
                        except (ValueError, TypeError):
                             logger.warning(f"无法将旧的 duration_ms 字段 {msg_dict['duration_ms']} 转为 float，已忽略。")

                    try:
                        # 根据 role 转换回相应的 dataclass
                        if role == "system":
                            message = SystemMessage(**args_dict)
                        elif role == "user":
                            message = UserMessage.from_dict(msg_dict) if UserMessage.from_dict else UserMessage(**args_dict)
                        elif role == "assistant":
                            message = AssistantMessage.from_dict(msg_dict)
                        elif role == "tool":
                            message = ToolMessage.from_dict(msg_dict)
                        else:
                            logger.warning(f"加载历史时发现未知的角色: {role}，跳过此消息: {msg_dict}")
                            continue
                        loaded_messages.append(message)
                    except TypeError as e:
                        logger.warning(f"加载历史时转换消息失败 (字段不匹配或类型错误): {args_dict} (原始: {msg_dict})，错误: {e}")
                    except Exception as e:
                        logger.error(f"加载历史时处理消息出错: {msg_dict}，错误: {e}", exc_info=True)

                self.messages = loaded_messages
                logger.info(f"成功从 {self._history_file_path} 加载 {len(self.messages)} 条聊天记录。")
            else:
                logger.warning(f"聊天记录文件格式无效 (不是列表): {self._history_file_path}")
                self.messages = []

        except json.JSONDecodeError as e:
            logger.error(f"解析聊天记录文件 JSON 失败: {self._history_file_path}，错误: {e}")
            self.messages = [] # 解析失败则清空
        except Exception as e:
            logger.error(f"加载聊天记录时发生未知错误: {self._history_file_path}，错误: {e}", exc_info=True)
            self.messages = [] # 其他错误也清空

    def save(self) -> None:
        """
        将当前聊天记录保存到 JSON 文件。
        对于 Assistant 和 Tool 消息，会将 duration_ms (float) 转换为 'duration' (str) 存储。
        会包含 show_in_ui 字段。
        可选字段如果等于 None 或默认值，则会被省略以减少冗余。
        """
        try:
            history_to_save = []
            for message in self.messages:
                # 将 dataclass 转为字典 (使用 to_dict 方法确保应用模型层的逻辑)
                if hasattr(message, 'to_dict') and callable(message.to_dict):
                    msg_dict = message.to_dict()
                else:
                    # 备选方案 (理论上不应执行，因为所有消息类型都有 to_dict)
                    msg_dict = asdict(message)
                    logger.warning(f"消息对象缺少 to_dict 方法: {type(message)}")

                # 1. 处理 duration (移除 duration_ms, 添加 duration str)
                if isinstance(message, (AssistantMessage, ToolMessage)):
                    duration_ms = msg_dict.pop('duration_ms', None) # 总是移除 ms 字段
                    if duration_ms is not None:
                        duration_str = format_duration_to_str(duration_ms)
                        if duration_str:
                            msg_dict['duration'] = duration_str
                # 确保其他类型也没有 duration_ms
                elif 'duration_ms' in msg_dict:
                     msg_dict.pop('duration_ms')

                # 2. 移除值为默认值的可选字段 (已在 to_dict 中处理 show_in_ui, content, tool_calls, system)
                # 这里我们额外检查 to_dict 可能仍保留的 None 值 (例如转换失败的 token_usage)
                # 并确保 compression_info 为 None 时被移除
                keys_to_remove = []
                for key, value in msg_dict.items():
                    # 移除值为 None 的字段 (除非是允许为 None 的 content 或 tool_calls)
                    if value is None and key not in ['content', 'tool_calls']:
                        keys_to_remove.append(key)
                    # 特别处理 compression_info，如果它是 None，也移除
                    elif key == 'compression_info' and value is None:
                         keys_to_remove.append(key)
                    # 检查 token_usage 是否为 None 或空字典
                    elif key == 'token_usage' and (value is None or (isinstance(value, dict) and not value)):
                        keys_to_remove.append(key)

                for key in keys_to_remove:
                    msg_dict.pop(key)

                # 移除消息字典中的 ID 字段，因为它仅用于运行时
                msg_dict.pop('id', None)

                history_to_save.append(msg_dict)

            # 使用 indent 美化 JSON 输出
            history_json = json.dumps(history_to_save, indent=4, ensure_ascii=False)
            with open(self._history_file_path, "w", encoding='utf-8') as f:
                f.write(history_json)
            # logger.debug(f"聊天记录已保存到: {self._history_file_path}")
        except Exception as e:
            logger.error(f"保存聊天记录到 {self._history_file_path} 时出错: {e}", exc_info=True)

    def save_tools_list(self, tools_list: List[Dict[str, Any]]) -> None:
        """
        将工具列表保存到与聊天记录文件同名的.tools.json文件中。

        Args:
            tools_list (List[Dict[str, Any]]): 要保存的工具列表。
        """
        try:
            tools_file_path = self._build_tools_list_filename()
            # 使用indent美化JSON输出
            tools_json = json.dumps(tools_list, indent=4, ensure_ascii=False)
            with open(tools_file_path, "w", encoding="utf-8") as f:
                f.write(tools_json)
            logger.debug(f"工具列表已保存到: {tools_file_path}")
        except Exception as e:
            logger.error(f"保存工具列表到 {tools_file_path} 时出错: {e}", exc_info=True)

    def _validate_and_standardize(self, message: ChatMessage) -> ChatMessage:
        """内部方法：验证和标准化消息，返回处理后的消息或引发 ValueError"""
        # ... (基础验证 role 不变) ...
        if not hasattr(message, 'role') or not message.role:
            raise ValueError("消息缺少 'role' 字段")

        is_assistant_with_tools = isinstance(message, AssistantMessage) and message.tool_calls
        content_missing = not hasattr(message, 'content') or message.content is None

        # 检查 content 是否缺失 (除非是带 tool_calls 的助手消息)
        if content_missing and not is_assistant_with_tools:
            if isinstance(message, ToolMessage):
                 raise ValueError(f"ToolMessage content 不能为空: {message}")
            else:
                 logger.warning(f"消息 content 为 None 或缺失，角色: {message.role}。将使用占位符。原始消息: {message}")
                 message.content = " " # 使用一个空格作为占位符
                 message.show_in_ui = False # <--- 内容被修改的消息不应展示

        # 检查 content 是否为空字符串 (对所有类型都标准化)
        if hasattr(message, 'content') and isinstance(message.content, str) and message.content.strip() == "":
             logger.warning(f"消息 content 为空字符串，角色: {message.role}。将使用占位符。原始消息: {message}")
             message.content = " " # 使用一个空格作为占位符
             message.show_in_ui = False # <--- 内容被修改的消息不应展示

        # ... (特定类型验证 tool_call_id, Assistant tool_calls 结构不变) ...
        if isinstance(message, ToolMessage):
            if not message.tool_call_id:
                raise ValueError(f"ToolMessage 缺少 'tool_call_id': {message}")

        if isinstance(message, AssistantMessage) and message.tool_calls:
             for tc in message.tool_calls:
                 if not isinstance(tc, ToolCall) or not tc.id or not tc.function or not tc.function.name:
                     raise ValueError(f"AssistantMessage 包含无效的 ToolCall 结构: {tc}")
                 # 确保 arguments 是字符串
                 if not isinstance(tc.function.arguments, str):
                     try:
                         # 尝试序列化，如果失败则报错
                         tc.function.arguments = json.dumps(tc.function.arguments, ensure_ascii=False)
                     except Exception as e:
                          raise ValueError(f"无法将 ToolCall arguments 转换为 JSON 字符串: {tc.function.arguments}, 错误: {e}")

        # 如果 content 为空字符串但有 tool_calls，确保 content 是 Continue (API 不允许为空或者None)
        if isinstance(message, AssistantMessage) and message.content == " " and message.tool_calls:
             message.content = "Continue"

        # 确保 created_at 存在且格式正确
        if not hasattr(message, 'created_at') or not isinstance(message.created_at, str):
             message.created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # 确保 show_in_ui 存在且是布尔值
        if not hasattr(message, 'show_in_ui') or not isinstance(message.show_in_ui, bool):
             logger.warning(f"消息缺少有效的 'show_in_ui' 字段，将设为 True。消息: {message}")
             message.show_in_ui = True

        return message

    def _should_skip_message(self, message: ChatMessage) -> bool:
        """
        判断是否应该跳过添加此消息。
        当消息的show_in_ui为false且与最近连续消息内容相同时，将跳过添加。

        Args:
            message (ChatMessage): 待添加的消息

        Returns:
            bool: 是否应该跳过添加此消息
        """

        # 如果消息列表为空，不跳过
        if not self.messages:
            return False

        # 获取当前消息的内容
        current_content = getattr(message, 'content', '')

        # 从最后一条消息开始检查
        for prev_msg in reversed(self.messages):
            # 如果前一条消息角色不同，则中断检查
            if prev_msg.role != message.role:
                break

            # 如果内容不同，则中断检查
            prev_content = getattr(prev_msg, 'content', '')
            if prev_content != current_content:
                break

            # 找到了相同内容、相同角色的消息，应该跳过
            return True

        # 没有找到匹配条件的消息，不跳过
        return False

    async def add_message(self, message: ChatMessage) -> bool:
        """
        向聊天记录中添加一条消息，并检查是否需要压缩。

        Args:
            message (ChatMessage): 要添加的消息对象。

        Returns:
            bool: 是否执行了压缩操作

        Raises:
            ValueError: 如果消息无效。
        """
        try:
            validated_message = self._validate_and_standardize(message)

            # 检查是否应该跳过添加此消息
            if self._should_skip_message(validated_message):
                return False

            self.messages.append(validated_message)
            self.save()

            # 异步检查并执行压缩
            compressed = await self.check_and_compress_if_needed()
            return compressed

        except ValueError as e:
            logger.error(f"异步添加无效消息失败: {e}")
            raise # 重新抛出异常，让调用者知道添加失败
        except Exception as e:
            logger.error(f"异步添加消息时发生意外错误: {e}", exc_info=True)
            # 根据策略决定是否抛出异常
            return False

    # --- 便捷的添加方法 --- (更新参数名为 show_in_ui)

    async def append_system_message(self, content: str, show_in_ui: bool = False) -> None:
        """添加一条系统消息"""
        message = SystemMessage(content=content, show_in_ui=show_in_ui)
        await self.add_message(message)

    async def append_user_message(self, content: str, show_in_ui: bool = True) -> None:
        """添加一条用户消息"""
        message = UserMessage(content=content, show_in_ui=show_in_ui)
        await self.add_message(message)

    async def append_assistant_message(self,
                                 content: Optional[str],
                                 tool_calls_data: Optional[List[Union[ToolCall, Dict]]] = None,
                                 show_in_ui: bool = True,
                                 duration_ms: Optional[float] = None,
                                 # --- 仅接受 TokenUsage 对象 ---
                                 token_usage: Optional[TokenUsage] = None
                                 ) -> None:
        """
        添加一条助手消息。

        Args:
            content (Optional[str]): 消息内容。
            tool_calls_data (Optional[List[Union[ToolCall, Dict]]]): 工具调用列表。
            show_in_ui (bool): 是否在 UI 中展示此消息。
            duration_ms (Optional[float]): LLM 调用耗时 (毫秒)。
            token_usage (Optional[TokenUsage]): token 使用信息对象。
        """
        processed_tool_calls: Optional[List[ToolCall]] = None
        contains_finish_task = False # 在循环外初始化
        if tool_calls_data:
            processed_tool_calls = []
            for tc_data in tool_calls_data:
                tool_call_obj = None
                function_name = None

                if isinstance(tc_data, ToolCall):
                    # 已经是 ToolCall 对象，检查并标准化 arguments
                    if not isinstance(tc_data.function.arguments, str):
                        try:
                            tc_data.function.arguments = json.dumps(tc_data.function.arguments, ensure_ascii=False)
                        except Exception as e:
                            logger.warning(f"标准化 AssistantMessage ToolCall arguments 失败: {tc_data.function.arguments}, 错误: {e}. 跳过此 ToolCall。")
                            continue
                    tool_call_obj = tc_data
                    function_name = tc_data.function.name

                elif isinstance(tc_data, dict):
                    # 从字典创建 ToolCall 对象
                    try:
                        function_data = tc_data.get("function", {})
                        if not isinstance(function_data, dict):
                             raise ValueError("Tool call 'function' 字段必须是字典")

                        arguments_raw = function_data.get("arguments")
                        arguments_str = None
                        # 确保 arguments 是 JSON 字符串
                        if isinstance(arguments_raw, str):
                            arguments_str = arguments_raw
                        else:
                             arguments_str = json.dumps(arguments_raw or {}, ensure_ascii=False) # 如果是None或非字符串，则序列化

                        # 获取必要字段
                        func_name = function_data.get("name")
                        tool_id = tc_data.get("id")
                        tool_type = tc_data.get("type", "function") # 默认为 function

                        if not func_name or not tool_id:
                             raise ValueError("Tool call 缺少必需的 'id' 或 'function.name'")

                        function_call = FunctionCall(name=func_name, arguments=arguments_str)
                        tool_call_obj = ToolCall(id=tool_id, type=tool_type, function=function_call)
                        function_name = func_name

                    except Exception as e:
                        logger.error(f"从字典创建 ToolCall 失败: {tc_data}, 错误: {e}", exc_info=True)
                        continue # 跳过这个错误的 tool_call
                else:
                     logger.warning(f"无法处理的 tool_call 数据类型: {type(tc_data)}, 已跳过: {tc_data}")
                     continue # 跳过无法处理的类型

                # 如果成功处理，添加到列表并检查 finish_task
                if tool_call_obj:
                    processed_tool_calls.append(tool_call_obj)
                    if function_name == "finish_task":
                         contains_finish_task = True

        # 如果包含 finish_task，则强制不在 UI 显示
        if contains_finish_task:
             show_in_ui = False

        message = AssistantMessage(
            content=content,
            tool_calls=processed_tool_calls if processed_tool_calls else None,
            show_in_ui=show_in_ui,
            duration_ms=duration_ms,
            token_usage=token_usage
        )
        await self.add_message(message)

    async def append_tool_message(self,
                            content: str,
                            tool_call_id: str,
                            system: Optional[str] = None,
                            show_in_ui: bool = True,
                            duration_ms: Optional[float] = None) -> None:
        """
        添加一条工具消息。

        Args:
            content (str): 工具结果内容。
            tool_call_id (str): 对应的 ToolCall ID。
            system (Optional[str]): 内部系统标志。
            show_in_ui (bool): 是否在 UI 中展示此消息。
            duration_ms (Optional[float]): 工具执行耗时 (毫秒)。
        """
        if not tool_call_id:
             raise ValueError("添加 ToolMessage 时必须提供 tool_call_id")
        message = ToolMessage(
            content=content,
            tool_call_id=tool_call_id,
            system=system,
            show_in_ui=show_in_ui,
            duration_ms=duration_ms
        )
        await self.add_message(message)

    # --- 查询方法 --- (修改 get_messages 过滤逻辑)

    def get_messages(self, include_hidden_in_ui: bool = False) -> List[ChatMessage]:
        """
        获取消息列表，可以选择是否包含不在 UI 中展示的消息。

        Args:
            include_hidden_in_ui (bool): 是否包含标记为 show_in_ui=False 的消息。默认为 False。

        Returns:
            List[ChatMessage]: 符合条件的消息对象列表。
        """
        if include_hidden_in_ui:
            return list(self.messages) # 返回所有消息的副本
        else:
            # 只返回 show_in_ui 为 True 的消息
            return [msg for msg in self.messages if msg.show_in_ui]

    def get_messages_for_llm(self) -> List[Dict[str, Any]]:
        """
        获取用于传递给 LLM API 的消息列表 (字典格式，严格白名单字段)。
        此方法确保只包含 LLM API 理解的字段，并且格式正确。
        所有内部使用的字段 (如 show_in_ui, duration_ms, token_usage, created_at, system(tool)) 都不会包含在内。
        """
        llm_messages = []
        # 遍历所有内部存储的消息
        for message in self.messages:
            # --- 白名单模式：只添加 API 需要的字段 --- #
            llm_msg: Dict[str, Any] = {"role": message.role}

            role = message.role

            if role == "system":
                # System 消息只需要 role 和 content
                content = getattr(message, 'content', ' ') # 确保 content 存在
                llm_msg["content"] = content if content and content.strip() else " "

            elif role == "user":
                # User 消息只需要 role 和 content
                content = getattr(message, 'content', ' ')
                llm_msg["content"] = content if content and content.strip() else " "

            elif role == "assistant":
                # Assistant 消息可以有 content, tool_calls, 或两者都有
                has_content = False
                content = getattr(message, 'content', None)
                # 只有当 content 存在且非空时才添加
                if content and content.strip():
                    llm_msg["content"] = content
                    has_content = True

                tool_calls = getattr(message, 'tool_calls', None)
                has_tool_calls = False
                if tool_calls:
                    # 格式化 tool_calls
                    formatted_tool_calls = []
                    for tc in tool_calls:
                         # 确保 tc 是 ToolCall 对象且结构有效
                         if isinstance(tc, ToolCall) and isinstance(tc.function, FunctionCall) and tc.id and tc.function.name:
                             arguments_str = tc.function.arguments
                             # 确保 arguments 是字符串
                             if not isinstance(arguments_str, str):
                                  try:
                                      arguments_str = json.dumps(arguments_str, ensure_ascii=False)
                                  except Exception:
                                       logger.warning(f"无法在 get_messages_for_llm 中序列化 assistant tool_call arguments: {arguments_str}。将使用空JSON对象字符串。")
                                       arguments_str = "{}"

                             formatted_tool_calls.append({
                                "id": tc.id,
                                "type": tc.type,
                                "function": {
                                    "name": tc.function.name,
                                    "arguments": arguments_str
                                }
                             })
                         else:
                              logger.warning(f"在 get_messages_for_llm 中跳过无效的 assistant tool_call 结构: {tc}")

                    if formatted_tool_calls:
                        llm_msg["tool_calls"] = formatted_tool_calls
                        has_tool_calls = True

                # 健全性检查: Assistant 消息必须至少有 content 或 tool_calls
                # 如果两者都没有，强制添加一个空格 content，以避免 API 错误
                if not has_content and not has_tool_calls:
                    logger.warning(f"为 LLM 准备的助手消息既无有效内容也无工具调用: {message}。强制添加空格 content。")
                    llm_msg["content"] = " "

            elif role == "tool":
                # Tool 消息需要 role, content, 和 tool_call_id
                content = getattr(message, 'content', ' ')
                llm_msg["content"] = content if content and content.strip() else " "
                tool_call_id = getattr(message, 'tool_call_id', None)
                if tool_call_id:
                    llm_msg["tool_call_id"] = tool_call_id
                else:
                    logger.error(f"为 LLM 准备的工具消息缺少 tool_call_id: {message}。这可能导致 API 错误。")
                    # 即使缺少 id，也继续添加消息，让 API 层处理错误

            # 其他 role 类型不应出现在这里，如果出现则忽略
            else:
                logger.warning(f"在 get_messages_for_llm 中遇到未知角色: {role}，已跳过。")
                continue # 跳过这条消息

            # --- 白名单构建结束，不需要 pop 任何字段 --- #
            llm_messages.append(llm_msg)

        return llm_messages

    def get_last_messages(self, n: int = 1) -> Union[Optional[ChatMessage], List[ChatMessage]]:
        """
        获取最后的n条消息。

        Args:
            n (int): 要获取的消息数量，默认为1。

        Returns:
            Union[Optional[ChatMessage], List[ChatMessage]]:
            - 当n=1时：返回最后一条消息，如果历史为空则返回None
            - 当n>1时：返回最后n条消息的列表，如果历史记录少于n条则返回所有可用消息
        """
        if not self.messages:
            return None if n == 1 else []

        if n == 1:
            # 返回单个消息对象，保持与旧get_last_message()相同的返回类型
            return self.messages[-1]
        else:
            # 返回最后n条消息的列表
            return self.messages[-min(n, len(self.messages)):]

    def get_last_message(self) -> Optional[ChatMessage]:
        """
        获取最后一条消息。

        注意: 此方法保留用于向后兼容性，建议使用get_last_messages()。

        Returns:
            Optional[ChatMessage]: 最后一条消息，如果历史为空则返回 None。
        """
        return self.get_last_messages(1)

    def get_second_last_message(self) -> Optional[ChatMessage]:
        """
        获取倒数第二条消息。

        注意: 此方法保留用于向后兼容性，建议使用get_last_messages(2)[0]。

        Returns:
            Optional[ChatMessage]: 倒数第二条消息，如果历史记录少于两条则返回 None。
        """
        if len(self.messages) >= 2:
            return self.messages[-2]
        return None

    def remove_last_message(self) -> Optional[ChatMessage]:
        """
        移除最后一条消息并保存。

        Returns:
            Optional[ChatMessage]: 被移除的消息，如果历史为空则返回 None。
        """
        if self.messages:
            removed_message = self.messages.pop()
            self.save()
            logger.debug(f"移除了最后一条消息: {removed_message}")
            return removed_message
        logger.debug("尝试移除最后一条消息，但历史记录为空。")
        return None

    def insert_message_before_last(self, message: ChatMessage) -> None:
        """
        在倒数第二条消息的位置插入一条消息，并保存。
        如果历史记录少于一条消息，则效果等同于追加。

        Args:
            message (ChatMessage): 要插入的消息对象。
        """
        try:
            validated_message = self._validate_and_standardize(message)
            if len(self.messages) > 0:
                 insert_index = len(self.messages) - 1
                 self.messages.insert(insert_index, validated_message)
                 logger.debug(f"在索引 {insert_index} 处插入消息: {validated_message}")
            else:
                 self.messages.append(validated_message) # 如果列表为空或只有一个元素，则追加
                 logger.debug(f"历史记录不足，追加消息: {validated_message}")

            self.save()
        except ValueError as e:
             logger.error(f"插入无效消息失败: {e}")
             raise
        except Exception as e:
            logger.error(f"插入消息时发生意外错误: {e}", exc_info=True)
            # 根据策略决定是否抛出异常

    def replace(self, new_messages: List[ChatMessage]) -> None:
        """
        替换当前的聊天历史为新的消息列表，并保存。

        Args:
            new_messages (List[ChatMessage]): 新的消息列表，用于替换当前历史。
        """
        try:
            # 验证每条消息
            validated_messages = []
            for message in new_messages:
                try:
                    validated_message = self._validate_and_standardize(message)
                    validated_messages.append(validated_message)
                except ValueError as e:
                    logger.warning(f"替换历史时跳过无效消息: {message}, 错误: {e}")

            # 清空原有消息并添加新消息
            self.messages.clear()
            self.messages.extend(validated_messages)

            # 保存更新后的历史
            self.save()
            logger.info(f"聊天历史已替换为 {len(validated_messages)} 条新消息")
        except Exception as e:
            logger.error(f"替换聊天历史时发生错误: {e}", exc_info=True)
            raise

    async def check_and_compress_if_needed(self) -> bool:
        """
        检查聊天历史是否需要压缩，如需要则执行压缩。
        此方法应在添加新消息后或其他适当时机调用。

        Returns:
            bool: 是否执行了压缩操作
        """
        # 获取当前消息数和token数
        current_message_count = self.count
        current_token_count = self.tokens_count

        # 判断是否需要压缩
        if not self.compressor.should_compress(current_message_count, current_token_count):
            return False

        logger.info("开始压缩聊天历史")
        # 执行压缩
        return await self._compress_history()

    async def _compress_history(self) -> bool:
        """
        历史压缩方法，实际执行压缩操作。

        Returns:
            bool: 是否执行了压缩操作
        """
        try:
            original_count = len(self.messages)
            # 筛选需要压缩的消息和需要保留的消息
            to_preserved, to_compress, recent_messages = self.compressor._filter_messages_to_compress(self.messages)

            if not to_compress:
                logger.info("没有需要压缩的消息")
                return False

            # 压缩消息
            compressed_message = await self.compressor.compress_messages(to_compress, to_preserved)
            if not compressed_message:
                logger.warning("压缩失败，保持原始消息不变")
                return False

            # 用压缩后的消息和保留的消息替换原消息列表
            new_messages = to_preserved + [compressed_message] + recent_messages

            # 更新消息列表
            self.replace(new_messages)

            # 更新压缩器状态
            self.compressor.update_compression_stats(
                message_count=self.count,
                token_count=self.tokens_count
            )

            # 记录压缩效果
            compressed_count = len(new_messages)
            logger.info(f"压缩完成：原消息数={original_count}，压缩后消息数={compressed_count}，"
                      f"压缩率={(original_count-compressed_count)/original_count:.1%}")

            return True

        except Exception as e:
            logger.exception(f"压缩历史记录时出错: {e}")
            return False

    async def compress_history(self) -> bool:
        """
        手动触发聊天历史压缩，不考虑任何阈值条件，强制执行压缩。

        Returns:
            bool: 是否成功执行了压缩
        """
        logger.info("手动触发聊天历史压缩")
        # 获取当前消息数和token数
        current_message_count = self.count
        current_token_count = self.tokens_count

        # 强制执行压缩
        if not self.compressor.should_compress(current_message_count, current_token_count, force=True):
            logger.info("即使强制压缩也无需执行压缩操作")
            return False

        return await self._compress_history()

    @staticmethod
    def upgrade_compression_config(chat_history: 'ChatHistory') -> 'ChatHistory':
        """
        为已有的ChatHistory对象升级添加压缩配置。
        在系统升级后，可能有些持久化的ChatHistory对象不包含压缩功能相关的字段，
        可以通过此方法升级它们。

        Args:
            chat_history (ChatHistory): 要升级的聊天历史对象

        Returns:
            ChatHistory: 升级后的聊天历史对象
        """
        # 检查是否已有压缩配置
        if hasattr(chat_history, 'compression_config') and chat_history.compression_config:
            logger.debug("聊天历史已有压缩配置，无需升级")
            return chat_history

        # 添加默认压缩配置
        logger.info(f"为聊天历史 {chat_history.agent_name}<{chat_history.agent_id}> 添加压缩配置")
        chat_history.compression_config = CompressionConfig()

        # 创建压缩器
        chat_history.compressor = ChatHistoryCompressor(chat_history.compression_config)

        return chat_history

    def get_first_user_message(self) -> Optional[str]:
        """
        获取聊天历史中第一条用户消息的内容。

        Returns:
            Optional[str]: 第一条用户消息的内容，如果没有用户消息则返回 None
        """
        for message in self.messages:
            if message.role == "user":
                return message.content
        return None

    def replace_last_user_message(self, new_content: str) -> bool:
        """
        替换聊天历史中最后一条用户消息的内容。

        Args:
            new_content (str): 新的消息内容

        Returns:
            bool: 是否成功替换了消息
        """
        # 从后向前查找第一条用户消息
        for i in range(len(self.messages) - 1, -1, -1):
            if self.messages[i].role == "user":
                # 找到了用户消息，替换内容
                self.messages[i].content = new_content
                # 保存更改
                self.save()
                logger.debug(f"已将最后一条用户消息内容替换为: {new_content}")
                return True

        # 未找到用户消息
        logger.warning("尝试替换最后一条用户消息，但未找到任何用户消息")
        return False
