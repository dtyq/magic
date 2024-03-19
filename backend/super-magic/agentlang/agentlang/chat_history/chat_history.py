# -*- coding: utf-8 -*-
"""
此模块定义了用于管理聊天记录的类。
"""

import json
import os
from dataclasses import asdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
import aiofiles

from agentlang.llms.token_usage.models import TokenUsage
from agentlang.utils.token_estimator import num_tokens_from_string
from agentlang.utils.tool_param_utils import preprocess_tool_call_arguments

# 从新的模块导入类型和工具
from agentlang.chat_history.chat_history_models import (
    format_duration_to_str, parse_duration_from_str,
    SystemMessage, UserMessage,
    AssistantMessage, ToolMessage, ChatMessage,
    FunctionCall, ToolCall
)
from agentlang.logger import get_logger

# 导入事件相关模块
from agentlang.event.interface import EventDispatcherInterface
from agentlang.event.event import Event, EventType
from agentlang.event.data import ChatHistoryChangedEventData

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
                 event_dispatcher: EventDispatcherInterface):
        """
        初始化 ChatHistory。

        Args:
            agent_name (str): Agent 的名称，用于构建文件名。
            agent_id (str): Agent 的唯一 ID，用于构建文件名。
            chat_history_dir (str): 存储聊天记录文件的目录。
            event_dispatcher (EventDispatcherInterface): 事件分发器，用于触发历史记录变更事件。
        """
        if not agent_name:
            raise ValueError("agent_name 不能为空")
        if not agent_id:
            raise ValueError("agent_id 不能为空")
        if not chat_history_dir:
            raise ValueError("chat_history_dir 不能为空")
        if not event_dispatcher:
            raise ValueError("event_dispatcher 不能为空")

        self.agent_name = agent_name
        self.agent_id = agent_id
        self.chat_history_dir = chat_history_dir
        self.messages: List[ChatMessage] = []

        # 事件分发器（必需）
        self.event_dispatcher = event_dispatcher

        os.makedirs(self.chat_history_dir, exist_ok=True) # 确保目录存在
        self._history_file_path = self._build_chat_history_filename()
        self.load() # 初始化时尝试加载历史记录

    def _calculate_message_tokens(self, msg: ChatMessage) -> int:
        """
        Calculate tokens for a single message.

        Args:
            msg: The message to calculate tokens for

        Returns:
            int: Token count for the message
        """
        try:
            # Calculate content tokens
            content = getattr(msg, 'content', '') or ''
            content_tokens = num_tokens_from_string(content)

            # Calculate tool calls tokens for AssistantMessage
            tool_calls_tokens = 0
            if isinstance(msg, AssistantMessage) and msg.tool_calls:
                for tc in msg.tool_calls:
                    tool_name = tc.function.name or ""
                    tool_args = tc.function.arguments or "{}"
                    tool_calls_tokens += num_tokens_from_string(tool_name)
                    tool_calls_tokens += num_tokens_from_string(tool_args)

            # Calculate tool_call_id tokens for ToolMessage
            tool_call_id_tokens = 0
            if isinstance(msg, ToolMessage):
                tool_call_id = getattr(msg, 'tool_call_id', '') or ''
                tool_call_id_tokens = num_tokens_from_string(tool_call_id)

            # Total tokens = content + tool_calls + tool_call_id + base message structure (approx 4)
            msg_tokens = content_tokens + tool_calls_tokens + tool_call_id_tokens + 4
            return msg_tokens
        except Exception as e:
            logger.warning(f"Failed to calculate tokens for message: {e!s}, using minimum value")
            return 1000

    async def tokens_count(self) -> int:
        """
        统计聊天历史中消耗的token总数。

        策略：
        1. 找到最新的一条有token_usage的消息，使用其total_tokens（这是累计结果）
           如果该消息之后还有新消息（没有token_usage），需要计算这些新消息的token并累加
        2. 如果没有任何消息有token_usage，则逐条模拟计算累加

        Returns:
            int: token总数
        """
        # 从后往前查找最新的带有token_usage的消息
        latest_token_usage_index = -1
        base_total_tokens = 0

        for i in range(len(self.messages) - 1, -1, -1):
            msg = self.messages[i]
            if (hasattr(msg, "token_usage") and
                msg.token_usage and
                isinstance(msg.token_usage, TokenUsage)):

                latest_token_usage_index = i

                # 1. 优先使用 total_tokens（累计结果）
                if msg.token_usage.total_tokens > 0:
                    base_total_tokens = msg.token_usage.total_tokens
                    logger.debug(f"Found latest token_usage at message {i+1}: {base_total_tokens} total tokens")
                    break

                # 2. 如果没有total_tokens，计算完整的token使用量
                elif msg.token_usage.input_tokens > 0 or msg.token_usage.output_tokens > 0:
                    # 计算基础tokens
                    base_tokens = msg.token_usage.input_tokens + msg.token_usage.output_tokens

                    # 加上缓存相关tokens
                    cached_tokens = 0
                    cache_write_tokens = 0
                    if msg.token_usage.input_tokens_details:
                        cached_tokens = msg.token_usage.input_tokens_details.cached_tokens or 0
                        cache_write_tokens = msg.token_usage.input_tokens_details.cache_write_tokens or 0

                    base_total_tokens = base_tokens + cached_tokens + cache_write_tokens
                    logger.debug(f"Calculated latest token_usage from message {i+1}: input:{msg.token_usage.input_tokens} + output:{msg.token_usage.output_tokens} + cached:{cached_tokens} + cache_write:{cache_write_tokens} = {base_total_tokens} tokens")
                    break

        # 计算该消息之后所有新消息的token（如果有的话）
        additional_tokens = 0
        if 0 <= latest_token_usage_index < len(self.messages) - 1:
            for i in range(latest_token_usage_index + 1, len(self.messages)):
                msg = self.messages[i]
                msg_tokens = self._calculate_message_tokens(msg)
                additional_tokens += msg_tokens
                logger.debug(f"Message {i+1} (after token_usage): Calculated tokens - {msg_tokens} tokens")

        # 如果有base_total_tokens，返回累计值加上新消息的token
        if base_total_tokens > 0:
            total_tokens = base_total_tokens + additional_tokens
            if additional_tokens > 0:
                logger.debug(f"Total tokens: base={base_total_tokens} + additional={additional_tokens} = {total_tokens}")
            return total_tokens

        # 如果没有任何消息有token_usage，进行模拟计算
        logger.debug("No token_usage found in any message, falling back to content-based calculation")
        total_tokens = 0
        history_updated = False

        for i, msg in enumerate(self.messages):
            msg_tokens = self._calculate_message_tokens(msg)
            logger.debug(f"Message {i+1}: Calculated tokens - {msg_tokens} tokens")

            # 将计算结果保存到AssistantMessage的token_usage属性中
            if isinstance(msg, AssistantMessage) and msg.token_usage is None:
                # 使用新的 TokenUsage 类创建对象
                # 作为估算值，我们将 msg_tokens 全部分配给 output_tokens
                msg.token_usage = TokenUsage(
                    input_tokens=0,
                    output_tokens=msg_tokens,
                    total_tokens=msg_tokens
                )
                history_updated = True

            total_tokens += msg_tokens

        # 如果有更新token_usage，保存聊天历史
        if history_updated:
            try:
                await self.save()
                logger.debug("已更新消息的token_usage数据并保存聊天历史")
            except Exception as e:
                logger.warning(f"保存更新的token_usage数据失败: {e!s}")

        logger.debug(f"Total tokens across all messages: {total_tokens}")
        return total_tokens

    def _build_chat_history_filename(self) -> str:
        """构建聊天记录文件的完整路径"""
        filename = f"{self.agent_name}<{self.agent_id}>.json"
        return os.path.join(self.chat_history_dir, filename)

    def _build_tools_list_filename(self) -> str:
        """构建工具列表文件的完整路径"""
        filename = f"{self.agent_name}<{self.agent_id}>.tools.json"
        return os.path.join(self.chat_history_dir, filename)

    def _build_model_config_filename(self) -> str:
        """
        构建会话配置文件名。

        Returns:
            str: 会话配置文件的完整路径
        """
        filename = f"{self.agent_name}<{self.agent_id}>.session.json"
        return os.path.join(self.chat_history_dir, filename)

    def get_last_session_config(self) -> Dict[str, Any]:
        """
        获取上次保存的会话配置（last）。

        Returns:
            Dict[str, Any]: 包含 model_id、image_model_id、image_model_sizes 和 mcp_servers 的字典
        """
        config_file = self._build_model_config_filename()
        try:
            if os.path.exists(config_file):
                with open(config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    last_config = config.get("last", {})
                    return {
                        "model_id": last_config.get("model_id"),
                        "image_model_id": last_config.get("image_model_id"),
                        "image_model_sizes": last_config.get("image_model_sizes"),
                        "mcp_servers": last_config.get("mcp_servers")
                    }
        except Exception as e:
            logger.debug(f"读取会话配置失败: {e}")
        return {"model_id": None, "image_model_id": None, "image_model_sizes": None, "mcp_servers": None}

    def save_session_config(self, model_id: Optional[str], image_model_id: Optional[str], image_model_sizes: Optional[List[Dict[str, Any]]] = None, mcp_servers: Optional[Dict[str, List[str]]] = None) -> None:
        """
        保存当前会话配置。

        内部维护两个对象：last 和 current
        - 每次调用时，把之前的 current 更新到 last 中
        - 把本次的请求更新到 current 中
        - 如果没有，那么都是 null

        Args:
            model_id: 当前使用的 LLM 模型 ID
            image_model_id: 当前使用的图片生成模型 ID
            image_model_sizes: 当前图片生成模型可用的尺寸列表
            mcp_servers: 当前可用的 MCP 服务器及其工具列表
        """
        config_file = self._build_model_config_filename()
        try:
            # 读取现有配置
            current_config = {
                "model_id": model_id,
                "image_model_id": image_model_id,
                "image_model_sizes": image_model_sizes,
                "mcp_servers": mcp_servers
            }

            last_config = None
            if os.path.exists(config_file):
                try:
                    with open(config_file, 'r', encoding='utf-8') as f:
                        existing_config = json.load(f)
                        # 把之前的 current 更新到 last 中
                        last_config = existing_config.get("current", {})
                except Exception:
                    pass

            # 构建新的配置：last 和 current
            config = {
                "last": last_config if last_config else {
                    "model_id": None,
                    "image_model_id": None,
                    "image_model_sizes": None,
                    "mcp_servers": None
                },
                "current": current_config
            }

            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            logger.debug(f"会话配置已保存: current model_id={model_id}, image_model_id={image_model_id}, mcp_servers={len(mcp_servers) if mcp_servers else 0} servers")
        except Exception as e:
            logger.warning(f"保存会话配置失败: {e}")

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
                        #"cache_write_tokens", "cached_tokens" #<-- 移除
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
                            message = SystemMessage.from_dict(msg_dict)
                        elif role == "user":
                            message = UserMessage.from_dict(msg_dict)
                        elif role == "assistant":
                            message = AssistantMessage.from_dict(msg_dict)
                        elif role == "tool":
                            message = ToolMessage.from_dict(msg_dict)
                        else:
                            logger.warning(f"加载历史时发现未知的角色: {role}，跳过此消息: {msg_dict}")
                            continue

                        # 验证加载的消息（防止外部文件注入无效数据）
                        validated_message = self._add_message_internal(message)
                        loaded_messages.append(validated_message)
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

    async def save(self, custom_file_path: Optional[str] = None) -> None:
        """
        将当前聊天记录保存到 JSON 文件。
        对于 Assistant 和 Tool 消息，会将 duration_ms (float) 转换为 'duration' (str) 存储。
        会包含 show_in_ui 字段。
        可选字段如果等于 None 或默认值，则会被省略以减少冗余。

        Args:
            custom_file_path (Optional[str]): 自定义保存路径，如果提供则保存到指定位置，
                                             否则使用默认的聊天记录文件路径
        """
        # Determine the target file path
        target_file_path = custom_file_path if custom_file_path else self._history_file_path

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
                # 并确保 compaction_info 为 None 时被移除
                keys_to_remove = []
                for key, value in msg_dict.items():
                    # 移除值为 None 的字段 (除非是允许为 None 的 content 或 tool_calls)
                    if value is None and key not in ['content', 'tool_calls']:
                        keys_to_remove.append(key)
                    # 特别处理 compaction_info，如果它是 None，也移除
                    elif key == 'compaction_info' and value is None:
                         keys_to_remove.append(key)
                    # 检查 token_usage 是否为 None 或空字典
                    elif key == 'token_usage' and (value is None or (isinstance(value, dict) and not value)):
                        keys_to_remove.append(key)

                for key in keys_to_remove:
                    msg_dict.pop(key)

                # 移除消息字典中的运行时字段，因为它们仅用于运行时
                msg_dict.pop('id', None)
                msg_dict.pop('_is_validated', None)

                history_to_save.append(msg_dict)

            # Ensure target directory exists
            target_dir = os.path.dirname(target_file_path)
            if target_dir:
                os.makedirs(target_dir, exist_ok=True)

            # 使用 indent 美化 JSON 输出
            history_json = json.dumps(history_to_save, indent=4, ensure_ascii=False)
            async with aiofiles.open(target_file_path, "w", encoding='utf-8') as f:
                await f.write(history_json)
            # Only log for custom paths to avoid cluttering default saves
            if custom_file_path:
                logger.debug(f"聊天记录已保存到自定义路径: {target_file_path}")

            # 触发聊天历史变更事件
            await self._trigger_chat_history_changed_event(target_file_path)

        except Exception as e:
            logger.error(f"保存聊天记录到 {target_file_path} 时出错: {e}", exc_info=True)

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

    def _add_message_internal(self, message: ChatMessage) -> ChatMessage:
        """
        内部方法：专门用于 load() 方法的消息验证。

        从文件加载的消息需要验证以防止外部文件注入无效数据，
        但不需要保存、压缩检查等 add_message() 的完整流程。

        Args:
            message (ChatMessage): 从文件加载创建的消息对象

        Returns:
            ChatMessage: 验证后的消息对象
        """
        return self._validate_and_standardize(message)

    def _validate_and_standardize(self, message: ChatMessage) -> ChatMessage:
        """内部方法：验证和标准化消息，返回处理后的消息或引发 ValueError"""
        # Quick path: skip validation if already validated
        if hasattr(message, '_is_validated') and message._is_validated:
            return message

        # 基础验证：确保 role 字段存在
        if not hasattr(message, 'role') or not message.role:
            raise ValueError("消息缺少 'role' 字段")

        # 特定类型验证：ToolMessage 必须有 tool_call_id
        if isinstance(message, ToolMessage):
            if not message.tool_call_id:
                raise ValueError(f"ToolMessage 缺少 'tool_call_id': {message}")

        # 特定类型验证：AssistantMessage 的 tool_calls 结构
        if isinstance(message, AssistantMessage) and message.tool_calls:
             for tc in message.tool_calls:
                 if not isinstance(tc, ToolCall) or not tc.id or not tc.function or not tc.function.name:
                     raise ValueError(f"AssistantMessage 包含无效的 ToolCall 结构: {tc}")

                 # 验证和修复工具调用参数的 JSON 格式
                 # 这确保了无论是新创建的消息还是从外部文件加载的消息，
                 # 其工具调用参数都是有效的 JSON 格式，避免后续执行时出错
                 if isinstance(tc.function.arguments, str):
                     # 预处理工具调用参数的 JSON 格式
                     preprocess_tool_call_arguments(tc)

        # 确保 created_at 存在且格式正确
        if not hasattr(message, 'created_at') or not isinstance(message.created_at, str):
             message.created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # 确保 show_in_ui 存在且是布尔值
        if not hasattr(message, 'show_in_ui') or not isinstance(message.show_in_ui, bool):
             logger.warning(f"消息缺少有效的 'show_in_ui' 字段，将设为 True。消息: {message}")
             message.show_in_ui = True

        # Mark as validated after successful validation
        if hasattr(message, '_is_validated'):
            message._is_validated = True

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
            await self.save()

        except ValueError as e:
            logger.error(f"异步添加无效消息失败: {e}")
            raise # 重新抛出异常，让调用者知道添加失败
        except Exception as e:
            logger.error(f"异步添加消息时发生意外错误: {e}", exc_info=True)
            # 根据策略决定是否抛出异常
            return False

    def _is_tool_call_sequence_complete(self) -> bool:
        """
        检查消息序列是否完整，特别是工具调用序列。

        这个方法用于判断是否可以安全地进行消息压缩或调用 API，
        确保不会因为工具调用序列不完整而导致 API 调用失败。

        规则：
        1. 如果最后一条消息是带 tool_calls 的 AssistantMessage，序列不完整
        2. 如果存在任何 AssistantMessage 的 tool_calls 没有对应的 ToolMessage，序列不完整
        3. 其他情况认为序列完整

        Returns:
            bool: 如果消息序列完整返回 True，否则返回 False
        """
        if not self.messages:
            return True

        # 检查最后一条消息
        last_message = self.messages[-1]

        # 如果最后一条是带 tool_calls 的 AssistantMessage，序列不完整
        if (isinstance(last_message, AssistantMessage) and
            hasattr(last_message, 'tool_calls') and
            last_message.tool_calls):
            return False

        # 从后往前查找最近的带 tool_calls 的 AssistantMessage
        for i in range(len(self.messages) - 1, -1, -1):
            msg = self.messages[i]
            if (isinstance(msg, AssistantMessage) and
                hasattr(msg, 'tool_calls') and
                msg.tool_calls):
                # 检查这个 AssistantMessage 的所有 tool_calls 是否都有对应的 ToolMessage
                tool_call_ids = {tc.id for tc in msg.tool_calls}
                found_tool_messages = set()

                # 向后查找对应的 ToolMessage
                for j in range(i + 1, len(self.messages)):
                    next_msg = self.messages[j]
                    if (isinstance(next_msg, ToolMessage) and
                        hasattr(next_msg, 'tool_call_id') and
                        next_msg.tool_call_id in tool_call_ids):
                        found_tool_messages.add(next_msg.tool_call_id)

                    # 如果遇到另一个 AssistantMessage，可以停止查找
                    elif isinstance(next_msg, AssistantMessage):
                        break

                # 如果有未找到对应 ToolMessage 的 tool_call，序列不完整
                if len(found_tool_messages) < len(tool_call_ids):
                    missing_ids = tool_call_ids - found_tool_messages
                    logger.debug(f"发现不完整的工具调用序列，缺失 tool results: {missing_ids}")
                    return False

                # 只检查最近的一个带 tool_calls 的 AssistantMessage
                break

        return True

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
                                 token_usage: Optional[TokenUsage] = None,
                                 request_id: Optional[str] = None,
                                 reasoning_content: Optional[str] = None
                                 ) -> None:
        """
        添加一条助手消息。

        Args:
            content (Optional[str]): 消息内容。
            tool_calls_data (Optional[List[Union[ToolCall, Dict]]]): 工具调用列表。
            show_in_ui (bool): 是否在 UI 中展示此消息。
            duration_ms (Optional[float]): LLM 调用耗时 (毫秒)。
            token_usage (Optional[TokenUsage]): token 使用信息对象。
            request_id (Optional[str]): LLM请求的唯一标识符。
            reasoning_content (Optional[str]): 思考内容（用于思考模型）。
        """
        processed_tool_calls: Optional[List[ToolCall]] = None
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

                # 如果成功处理，添加到列表
                if tool_call_obj:
                    processed_tool_calls.append(tool_call_obj)

        message = AssistantMessage(
            content=content,
            tool_calls=processed_tool_calls if processed_tool_calls else None,
            show_in_ui=show_in_ui,
            duration_ms=duration_ms,
            token_usage=token_usage,
            request_id=request_id,
            reasoning_content=reasoning_content
        )
        await self.add_message(message)

    async def append_tool_message(self,
                            content: str,
                            tool_call_id: str,
                            system: Optional[str] = None,
                            show_in_ui: bool = False,
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

        同时会自动修复历史消息中的序列错误，确保tool消息前都有对应的assistant消息。
        """
        llm_messages = []
        # 遍历所有内部存储的消息，使用各消息类型的 to_llm_dict 方法
        for message in self.messages:
            try:
                # Use the message's to_llm_dict method for consistent LLM API formatting
                llm_msg = message.to_llm_dict()
                llm_messages.append(llm_msg)
            except Exception as e:
                logger.error(f"转换消息为 LLM 格式时出错: {message}, 错误: {e}")
                # Skip invalid messages to prevent API errors
                continue

        # 🔧 修复历史消息中的序列错误（兼容已存在的错误历史）
        fixed_messages = self._fix_message_sequence_errors(llm_messages)
        return fixed_messages

    def _fix_message_sequence_errors(self, llm_messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        修复历史消息中的序列错误，确保tool_use和tool_result正确匹配

        修复策略：
        1. 去除没有对应tool_result的带tool_calls的assistant消息
        2. 将孤立的tool消息转换为assistant消息（保持语义合理性）
        3. 去除连续重复的相同内容消息，只保留一条
        4. 记录修复操作以供调试

        Args:
            llm_messages: 原始的LLM消息列表

        Returns:
            List[Dict[str, Any]]: 修复后的消息列表
        """
        if not llm_messages:
            return llm_messages

        # 第一步：标记需要移除的消息索引
        messages_to_remove = set()
        fixes_applied = 0

        # 检查带tool_calls的assistant消息，如果没有对应的tool_result就标记移除
        for i, message in enumerate(llm_messages):
            if message.get("role") == "assistant" and message.get("tool_calls"):
                tool_calls = message.get("tool_calls", [])
                all_tools_have_results = True

                for tool_call in tool_calls:
                    tool_call_id = tool_call.get("id")
                    if not tool_call_id:
                        continue

                    # 向后查找对应的tool消息
                    found_tool_result = False
                    for j in range(i + 1, len(llm_messages)):
                        next_msg = llm_messages[j]
                        if next_msg.get("role") == "tool" and next_msg.get("tool_call_id") == tool_call_id:
                            found_tool_result = True
                            break
                        elif next_msg.get("role") == "assistant":
                            # 如果遇到下一个assistant消息，停止查找
                            break

                    if not found_tool_result:
                        all_tools_have_results = False
                        break

                # 如果有工具调用但没有完整的结果，标记移除这个assistant消息
                if not all_tools_have_results:
                    messages_to_remove.add(i)
                    fixes_applied += 1
                    tool_names = [tc.get("function", {}).get("name", "unknown") for tc in tool_calls]
                    logger.warning(f"修复历史消息序列错误：移除没有完整tool_result的assistant消息 (工具: {tool_names})")

        # 第二步：过滤消息并处理孤立的tool消息
        filtered_messages = []
        for i, message in enumerate(llm_messages):
            if i in messages_to_remove:
                continue

            if message.get("role") == "tool":
                tool_call_id = message.get("tool_call_id")

                # 查找对应的assistant消息（向前搜索，排除已标记移除的消息）
                found_corresponding_assistant = False
                for j in range(i-1, -1, -1):
                    if j in messages_to_remove:
                        continue

                    prev_msg = llm_messages[j]
                    if prev_msg.get("role") == "assistant":
                        tool_calls = prev_msg.get("tool_calls", [])
                        # 检查是否有匹配的tool_call_id
                        for tc in tool_calls:
                            if tc.get("id") == tool_call_id:
                                found_corresponding_assistant = True
                                break
                        if found_corresponding_assistant:
                            break
                    elif prev_msg.get("role") == "user":
                        # 如果遇到user消息，说明中间没有对应的assistant消息
                        break

                if not found_corresponding_assistant:
                    # 将孤立的tool消息转换为assistant消息
                    tool_content = message.get("content", "")
                    converted_message = {
                        "role": "assistant",
                        "content": f"⚠️ 工具执行结果：{tool_content}" if tool_content else "⚠️ 工具执行完成"
                    }
                    filtered_messages.append(converted_message)
                    fixes_applied += 1
                    logger.warning(f"修复历史消息序列错误：将孤立的tool消息转换为assistant消息 (tool_call_id: {tool_call_id})")
                else:
                    # tool消息有对应的assistant消息，保持原样
                    filtered_messages.append(message)
            else:
                # 其他消息，直接保持原样
                filtered_messages.append(message)

        # 第三步：去除连续重复的消息内容
        final_messages = []
        for i, message in enumerate(filtered_messages):
            should_add = True

            # 检查是否与前一条消息内容完全相同
            if i > 0:
                prev_message = filtered_messages[i-1]

                # 比较角色和内容
                if (message.get("role") == prev_message.get("role") and
                    message.get("content") == prev_message.get("content")):

                    # 对于assistant消息，还要比较tool_calls
                    if message.get("role") == "assistant":
                        prev_tool_calls = prev_message.get("tool_calls", [])
                        curr_tool_calls = message.get("tool_calls", [])

                        # 简单比较tool_calls的数量和ID
                        if len(prev_tool_calls) == len(curr_tool_calls):
                            prev_ids = sorted([tc.get("id", "") for tc in prev_tool_calls])
                            curr_ids = sorted([tc.get("id", "") for tc in curr_tool_calls])
                            if prev_ids == curr_ids:
                                should_add = False
                        elif len(prev_tool_calls) == 0 and len(curr_tool_calls) == 0:
                            should_add = False
                    else:
                        should_add = False

                    if not should_add:
                        fixes_applied += 1
                        logger.warning(f"修复历史消息序列错误：移除重复的消息内容 (角色: {message.get('role')})")

            if should_add:
                final_messages.append(message)

        if fixes_applied > 0:
            logger.info(f"📋 历史消息序列修复完成：共修复 {fixes_applied} 个消息序列错误")

        return final_messages

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

    async def remove_last_message(self) -> Optional[ChatMessage]:
        """
        移除最后一条消息并保存。

        Returns:
            Optional[ChatMessage]: 被移除的消息，如果历史为空则返回 None。
        """
        if self.messages:
            removed_message = self.messages.pop()
            await self.save()
            logger.debug(f"移除了最后一条消息: {removed_message}")
            return removed_message
        logger.debug("尝试移除最后一条消息，但历史记录为空。")
        return None

    async def insert_message_before_last(self, message: ChatMessage) -> None:
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

            await self.save()
        except ValueError as e:
             logger.error(f"插入无效消息失败: {e}")
             raise
        except Exception as e:
            logger.error(f"插入消息时发生意外错误: {e}", exc_info=True)
            # 根据策略决定是否抛出异常

    async def replace(self, new_messages: List[ChatMessage]) -> None:
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
            await self.save()
            logger.info(f"聊天历史已替换为 {len(validated_messages)} 条新消息")
        except Exception as e:
            logger.error(f"替换聊天历史时发生错误: {e}", exc_info=True)
            raise

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

    async def replace_last_user_message(self, new_content: str) -> bool:
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
                await self.save()
                logger.debug(f"已将最后一条用户消息内容替换为: {new_content}")
                return True

        # 未找到用户消息
        logger.warning("尝试替换最后一条用户消息，但未找到任何用户消息")
        return False

    async def update_first_system_prompt(self, new_system_prompt: str) -> bool:
        """
        更新聊天历史中第一条系统消息的内容。

        当代码更新时，聊天记录不会自动更新，此方法用于确保使用最新的 system prompt。

        Args:
            new_system_prompt (str): 新的系统提示内容

        Returns:
            bool: 是否成功更新了系统消息
        """
        if not self.messages:
            logger.debug("聊天记录为空，无法更新系统消息")
            return False

        first_message = self.messages[0]
        if not hasattr(first_message, 'role') or first_message.role != "system":
            logger.warning("第一条消息不是 system 消息，无法更新 system prompt")
            return False

        # 更新系统消息内容
        first_message.content = new_system_prompt
        await self.save()
        logger.info("已更新第一条 System Prompt 为最新版本")
        return True

    async def _trigger_chat_history_changed_event(self, file_path: str) -> None:
        """
        触发聊天历史变更事件（异步分发）

        Args:
            file_path: 保存的文件路径
        """
        try:
            # 创建事件数据
            event_data = ChatHistoryChangedEventData(
                agent_name=self.agent_name,
                agent_id=self.agent_id,
                chat_history_dir=self.chat_history_dir,
                file_path=file_path
            )

            # 创建并分发事件
            event = Event(EventType.CHAT_HISTORY_CHANGED, event_data)

            # 直接异步分发事件
            await self.event_dispatcher.dispatch(event)
            logger.debug(f"聊天历史变更事件已分发: {file_path}")

        except Exception as e:
            # 事件分发失败不应该影响保存操作
            logger.error(f"触发聊天历史变更事件失败: {e}", exc_info=True)
