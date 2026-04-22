# -*- coding: utf-8 -*-
"""
此模块定义了用于管理聊天记录的类。
"""

import asyncio
import json
import os
from dataclasses import asdict, dataclass
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

# Horizon 注入消息的安全上限；超过此值说明历史中存在异常膨胀的 diff bomb，
# 需要在 load 时自动修复以避免后续每轮都把垃圾内容发给 LLM
_HORIZON_MSG_CONTENT_MAX_CHARS = 32 * 1024  # 32 KB


@dataclass
class RuleResult:
    """单条序列修复规则的执行结果。"""
    name: str
    fixes: int


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
        self._loaded = False  # load() 幂等标记

        # 事件分发器（必需）
        self.event_dispatcher = event_dispatcher

        os.makedirs(self.chat_history_dir, exist_ok=True) # 确保目录存在
        self._history_file_path = self._build_chat_history_filename()
        # load() 改为 async，不在 __init__ 中调用，由外部显式 await chat_history.load()

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

    @staticmethod
    def _default_session_config_block() -> Dict[str, Any]:
        """默认的会话配置块。"""
        return {
            "model_id": None,
            "image_model_id": None,
            "image_model_sizes": None,
            "video_model_id": None,
            "video_generation_config": None,
            "mcp_servers": None,
            "message_version": None,
        }

    def _load_session_document(self) -> Dict[str, Any]:
        """读取完整会话状态文档，保留未知字段以支持未来扩展。"""
        config_file = self._build_model_config_filename()
        default_document = {
            "last": self._default_session_config_block(),
            "current": self._default_session_config_block(),
        }
        try:
            if not os.path.exists(config_file):
                return default_document
            with open(config_file, 'r', encoding='utf-8') as f:
                loaded = json.load(f)
            if not isinstance(loaded, dict):
                return default_document
            document = default_document | loaded
            if not isinstance(document.get("last"), dict):
                document["last"] = self._default_session_config_block()
            if not isinstance(document.get("current"), dict):
                document["current"] = self._default_session_config_block()
            return document
        except Exception as e:
            logger.debug(f"读取会话状态文档失败: {e}")
            return default_document

    def _save_session_document(self, document: Dict[str, Any]) -> None:
        """保存完整会话状态文档。"""
        config_file = self._build_model_config_filename()
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(document, f, ensure_ascii=False, indent=2)

    def get_last_session_config(self) -> Dict[str, Any]:
        """
        获取上次保存的会话配置（last）。

        Returns:
            Dict[str, Any]: 包含 model_id、image/video model 配置和 mcp_servers 的字典
        """
        try:
            last_config = self._load_session_document().get("last", {})
            return {
                "model_id": last_config.get("model_id"),
                "image_model_id": last_config.get("image_model_id"),
                "image_model_sizes": last_config.get("image_model_sizes"),
                "video_model_id": last_config.get("video_model_id"),
                "video_generation_config": last_config.get("video_generation_config"),
                "mcp_servers": last_config.get("mcp_servers")
            }
        except Exception as e:
            logger.debug(f"读取会话配置失败: {e}")
        return {
            "model_id": None,
            "image_model_id": None,
            "image_model_sizes": None,
            "video_model_id": None,
            "video_generation_config": None,
            "mcp_servers": None,
        }

    def get_last_message_version(self) -> Optional[str]:
        """
        获取上次保存的 message_version（读取 current 块）。

        Returns:
            Optional[str]: 上次保存的 message_version，不存在时返回 None
        """
        try:
            current_config = self._load_session_document().get("current", {})
            if isinstance(current_config, dict):
                return current_config.get("message_version") or None
        except Exception as e:
            logger.debug(f"读取 message_version 失败: {e}")
        return None

    def save_session_config(
        self,
        model_id: Optional[str],
        image_model_id: Optional[str],
        image_model_sizes: Optional[List[Dict[str, Any]]] = None,
        video_model_id: Optional[str] = None,
        video_generation_config: Optional[Dict[str, Any]] = None,
        mcp_servers: Optional[Dict[str, List[str]]] = None,
        message_version: Optional[str] = None,
    ) -> None:
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
            video_model_id: 当前使用的视频生成模型 ID
            video_generation_config: 当前视频生成模型 featured 配置
            mcp_servers: 当前可用的 MCP 服务器及其工具列表
            message_version: 当前消息版本号，如 "v1"、"v2"
        """
        try:
            current_config = {
                "model_id": model_id,
                "image_model_id": image_model_id,
                "image_model_sizes": image_model_sizes,
                "video_model_id": video_model_id,
                "video_generation_config": video_generation_config,
                "mcp_servers": mcp_servers,
                "message_version": message_version,
            }
            existing_config = self._load_session_document()
            last_config = existing_config.get("current", {})
            existing_config["last"] = last_config if isinstance(last_config, dict) and last_config else self._default_session_config_block()
            existing_config["current"] = current_config
            self._save_session_document(existing_config)
            logger.debug(
                f"会话配置已保存: current model_id={model_id}, image_model_id={image_model_id}, "
                f"video_model_id={video_model_id}, mcp_servers={len(mcp_servers) if mcp_servers else 0} servers, "
                f"message_version={message_version}"
            )
        except Exception as e:
            logger.warning(f"保存会话配置失败: {e}")

    def exists(self) -> bool:
        """检查历史记录文件是否存在"""
        return os.path.exists(self._history_file_path)

    async def load(self) -> None:
        """
        从 JSON 文件异步加载聊天记录。
        会查找 'duration' 字符串字段并尝试解析为 duration_ms (float)。
        会查找 'show_in_ui' 字段，如果不存在则默认为 True。
        加载后执行全量序列修复并立即落盘（如有修复）。
        幂等：重复调用不会重新从磁盘加载。
        """
        if self._loaded:
            return

        if not self.exists():
            logger.info(f"聊天记录文件不存在: {self._history_file_path}，将初始化为空历史。")
            self.messages = []
            self._loaded = True
            return

        try:
            async with aiofiles.open(self._history_file_path, "r", encoding='utf-8') as f:
                raw = await f.read()
            history_data = json.loads(raw)

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
                self._sanitize_oversized_messages()
                fixes = self._sanitize_message_sequences()
                if fixes > 0:
                    await self.save()
                    logger.info(f"[ChatHistory] 序列修复已落盘")
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
        finally:
            self._loaded = True

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
                await asyncio.to_thread(os.makedirs, target_dir, exist_ok=True)

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

    def _sanitize_oversized_messages(self) -> None:
        """Load 时自动修复历史中异常膨胀的 horizon 注入消息。

        之前的 diff bug 可能导致 5MB+ 的内容被持久化到 source="horizon" 的 UserMessage 中，
        后续每轮 LLM 调用都会带上这些垃圾内容，直接撑爆上下文。
        修复后下次 save() 会自动落盘。
        """
        for msg in self.messages:
            if not isinstance(msg, UserMessage):
                continue
            if getattr(msg, "source", None) != "horizon":
                continue
            content_len = len(msg.content)
            if content_len <= _HORIZON_MSG_CONTENT_MAX_CHARS:
                continue
            msg.content = (
                "<system_injected_context>\n"
                "[auto-repaired: oversized historical context removed "
                f"({content_len:,} chars, limit {_HORIZON_MSG_CONTENT_MAX_CHARS:,})]\n"
                "</system_injected_context>"
            )
            logger.warning(
                f"[ChatHistory] 修复异常膨胀的 horizon 消息: "
                f"{content_len:,} chars → sanitized"
            )

    def _sanitize_message_sequences(self) -> int:
        """Load 时对 self.messages 执行全量序列修复并持久化。

        覆盖 4 类修复，与 _fix_message_sequence_errors（运行时 dict 副本兜底）对齐：
        0. 重排工具调用序列：确保 assistant(tool_calls) 紧跟其所有 tool_result，
           同时处理 tool_result 位移和夹缝 user 消息两类问题
        1. 为缺失的 tool_result 补合成占位 ToolMessage
        2. 将孤立的 tool 消息（找不到对应 assistant）转换为 assistant 消息
        3. 去除连续重复的相同内容消息

        Returns:
            int: 修复操作总数
        """
        # 各规则修复计数
        rules = [
            RuleResult("规则0·重排",    self._sanitize_displaced_tool_results()),
            RuleResult("规则1·补占位",  self._sanitize_incomplete_tool_sequences()),
            RuleResult("规则2·孤立转换", self._sanitize_orphaned_tool_messages()),
            RuleResult("规则3·去重",    self._sanitize_consecutive_duplicates()),
        ]

        total_fixes = sum(r.fixes for r in rules)
        if total_fixes > 0:
            triggered = ", ".join(f"{r.name}×{r.fixes}" for r in rules if r.fixes > 0)
            logger.warning(
                f"[ChatHistory] load 序列修复完成：{triggered}，"
                f"共 {total_fixes} 项，总消息数 {len(self.messages)}"
            )

        return total_fixes

    def _sanitize_displaced_tool_results(self) -> int:
        """一步到位地重排工具调用序列，确保每个 assistant(tool_calls) 紧跟其所有 tool_result。

        同时处理两类问题：
        - tool_result 被其他 assistant(tool_calls) 隔开（连续多条 assistant 的场景）
        - user/其他消息被夹在 assistant(tool_calls) 和 tool_result 之间（Horizon 误注入场景）

        与 _reorder_displaced_tool_results（运行时 dict 副本兜底）算法对齐。
        """
        # 建立 tool_call_id → 首次出现的 tool_result 消息索引
        tr_idx: dict[str, int] = {}
        for idx, msg in enumerate(self.messages):
            if isinstance(msg, ToolMessage) and msg.tool_call_id:
                tr_idx.setdefault(msg.tool_call_id, idx)

        # 建立 assistant 消息索引 → 它所拥有的 tool_result 索引集合
        assistant_owned: dict[int, set[int]] = {}
        claimed: set[int] = set()
        for i, msg in enumerate(self.messages):
            if isinstance(msg, AssistantMessage) and msg.tool_calls:
                owned = set()
                for tc in msg.tool_calls:
                    if tc.id and tc.id in tr_idx:
                        owned.add(tr_idx[tc.id])
                assistant_owned[i] = owned
                claimed |= owned

        # 分类检测：遍历全量，不提前 break，确保同时识别两种错位情况
        has_displacement = False  # tool_result 在其他 assistant 之后（连续多条 assistant 场景）
        has_interleaved = False   # 非 tool 消息夹在 assistant(tool_calls) 和 tool_result 之间
        for assistant_idx, owned_set in assistant_owned.items():
            if not owned_set:
                continue
            expected = set(range(assistant_idx + 1, assistant_idx + 1 + len(owned_set)))
            if owned_set != expected:
                has_displacement = True
            else:
                for k in range(assistant_idx + 1, assistant_idx + 1 + len(owned_set)):
                    if not isinstance(self.messages[k], ToolMessage):
                        has_interleaved = True
                        break

        if not has_displacement and not has_interleaved:
            return 0

        # 一步重排
        result: List[ChatMessage] = []
        consumed: set[int] = set()

        for i, msg in enumerate(self.messages):
            if i in consumed:
                continue
            if i in claimed:
                continue

            result.append(msg)
            consumed.add(i)

            if i in assistant_owned and isinstance(msg, AssistantMessage) and msg.tool_calls:
                for tc in msg.tool_calls:
                    if not tc.id:
                        continue
                    ri = tr_idx.get(tc.id)
                    if ri is not None and ri not in consumed:
                        result.append(self.messages[ri])
                        consumed.add(ri)

        for i in range(len(self.messages)):
            if i not in consumed and i not in claimed:
                result.append(self.messages[i])

        if len(result) != len(self.messages):
            logger.error(
                f"[ChatHistory·规则0·重排] 消息数量不一致 "
                f"({len(self.messages)} → {len(result)})，放弃重排"
            )
            return 0

        self.messages = result
        affected_count = sum(1 for owned in assistant_owned.values() if owned)
        patterns: list[str] = []
        if has_displacement:
            patterns.append(
                "❌ assistant(A)→assistant(B)→tool(A)→tool(B)  →  ✅ assistant(A)→tool(A)→assistant(B)→tool(B)"
            )
        if has_interleaved:
            patterns.append(
                "❌ assistant([A,B])→user→tool(A)→tool(B)  →  ✅ assistant([A,B])→tool(A)→tool(B)→user"
            )
        logger.warning(
            f"[ChatHistory·规则0·重排] {affected_count} 个 assistant(tool_calls) 的 "
            f"{len(claimed)} 个 tool_result 错位｜{'  |  '.join(patterns)}"
        )
        return 1

    def _sanitize_incomplete_tool_sequences(self) -> int:
        """为缺失的 tool_result 补合成占位 ToolMessage。"""
        fixes = 0
        i = 0
        while i < len(self.messages):
            msg = self.messages[i]
            if not isinstance(msg, AssistantMessage) or not msg.tool_calls:
                i += 1
                continue

            # 收集此 assistant 之后、下一个 assistant 之前的所有 tool_call_id
            expected_ids = {tc.id for tc in msg.tool_calls if tc.id}
            found_ids = set()
            j = i + 1
            while j < len(self.messages):
                next_msg = self.messages[j]
                if isinstance(next_msg, AssistantMessage):
                    break
                if isinstance(next_msg, ToolMessage) and next_msg.tool_call_id in expected_ids:
                    found_ids.add(next_msg.tool_call_id)
                j += 1

            missing_ids = expected_ids - found_ids
            if missing_ids:
                # 找到 assistant 之后连续 tool 消息的末尾位置
                insert_pos = i + 1
                while insert_pos < len(self.messages) and isinstance(self.messages[insert_pos], ToolMessage):
                    insert_pos += 1

                for tc in msg.tool_calls:
                    if tc.id not in missing_ids:
                        continue
                    tool_name = tc.function.name if tc.function else "unknown"
                    synthetic = ToolMessage(
                        content="[Tool result missing — call was likely interrupted or truncated]",
                        tool_call_id=tc.id,
                        show_in_ui=False,
                    )
                    self.messages.insert(insert_pos, synthetic)
                    insert_pos += 1
                    fixes += 1
                    logger.warning(
                        f"[ChatHistory·规则1·补占位] msg[{i}] assistant 的 {tool_name}"
                        f"(id={tc.id}) 缺少 tool_result → 已补合成占位"
                    )

            i += 1
        return fixes

    def _sanitize_orphaned_tool_messages(self) -> int:
        """将孤立的 tool 消息（找不到对应 assistant(tool_calls)）转为 assistant 消息。"""
        fixes = 0
        i = 0
        while i < len(self.messages):
            msg = self.messages[i]
            if not isinstance(msg, ToolMessage):
                i += 1
                continue

            # 向前搜索对应的 assistant
            found = False
            for j in range(i - 1, -1, -1):
                prev = self.messages[j]
                if isinstance(prev, AssistantMessage):
                    if prev.tool_calls:
                        for tc in prev.tool_calls:
                            if tc.id == msg.tool_call_id:
                                found = True
                                break
                    # 遇到 assistant 就停，tool_result 只能属于紧邻的 assistant
                    break
                elif isinstance(prev, UserMessage):
                    break

            if not found:
                tool_content = msg.content or ""
                content_preview = tool_content[:80] + "..." if len(tool_content) > 80 else tool_content
                replacement = AssistantMessage(
                    content=f"⚠️ 工具执行结果：{tool_content}" if tool_content else "⚠️ 工具执行完成",
                    show_in_ui=msg.show_in_ui,
                )
                self.messages[i] = replacement
                fixes += 1
                logger.warning(
                    f"[ChatHistory·规则2·孤立转换] msg[{i}] tool(id={msg.tool_call_id}) "
                    f"找不到对应 assistant → 已转为 assistant 消息 (content={content_preview!r})"
                )
            i += 1
        return fixes

    def _sanitize_consecutive_duplicates(self) -> int:
        """去除连续重复的相同内容消息（role + content 都相同）。"""
        if len(self.messages) < 2:
            return 0

        fixes = 0
        result: List[ChatMessage] = [self.messages[0]]

        for i in range(1, len(self.messages)):
            curr = self.messages[i]
            prev = self.messages[i - 1]

            is_dup = False
            if type(curr) is type(prev) and curr.content == prev.content:
                if isinstance(curr, AssistantMessage):
                    # assistant 消息还需比较 tool_calls
                    prev_tc = prev.tool_calls or []
                    curr_tc = curr.tool_calls or []
                    if len(prev_tc) == len(curr_tc):
                        prev_ids = sorted(tc.id for tc in prev_tc)
                        curr_ids = sorted(tc.id for tc in curr_tc)
                        if prev_ids == curr_ids:
                            is_dup = True
                    elif not prev_tc and not curr_tc:
                        is_dup = True
                elif isinstance(curr, ToolMessage):
                    # tool 消息还需比较 tool_call_id，避免将不同调用的相同结果误判为重复
                    if curr.tool_call_id == prev.tool_call_id:
                        is_dup = True
                else:
                    is_dup = True

            if is_dup:
                fixes += 1
                content_hint = (curr.content or "")[:60]
                logger.warning(
                    f"[ChatHistory·规则3·去重] msg[{i}] 与 msg[{i-1}] 完全重复 "
                    f"(role={curr.role}) → 已移除 (content={content_hint!r})"
                )
            else:
                result.append(curr)

        if fixes > 0:
            self.messages = result
        return fixes

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

            # tool 消息还需比较 tool_call_id，避免将不同调用的相同结果误判为重复
            if isinstance(message, ToolMessage):
                if getattr(prev_msg, 'tool_call_id', None) != getattr(message, 'tool_call_id', None):
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

        这个方法用于判断是否可以安全地注入 Horizon user 消息或执行其他操作，
        确保不会因为工具调用序列不完整而导致消息被插入到错误位置。

        规则：
        1. 如果最后一条消息是带 tool_calls 的 AssistantMessage，序列不完整
        2. 检查**所有** AssistantMessage 的 tool_calls 是否都有对应的 ToolMessage
           （不只是最近的一个，避免连续多条 assistant(tool_calls) 时漏检）
        3. 其他情况认为序列完整

        Returns:
            bool: 如果消息序列完整返回 True，否则返回 False
        """
        if not self.messages:
            return True

        # 检查最后一条消息
        last_message = self.messages[-1]
        if (isinstance(last_message, AssistantMessage) and
            hasattr(last_message, 'tool_calls') and
            last_message.tool_calls):
            return False

        # 收集所有 tool_result 的 tool_call_id（全局视角）
        all_tool_result_ids: set[str] = set()
        for msg in self.messages:
            if (isinstance(msg, ToolMessage) and
                hasattr(msg, 'tool_call_id') and
                msg.tool_call_id):
                all_tool_result_ids.add(msg.tool_call_id)

        # 从后往前检查所有带 tool_calls 的 AssistantMessage
        # 任何一个 assistant 有未匹配的 tool_call 就判定为不完整
        for msg in reversed(self.messages):
            if not (isinstance(msg, AssistantMessage) and
                    hasattr(msg, 'tool_calls') and
                    msg.tool_calls):
                continue

            tool_call_ids = {tc.id for tc in msg.tool_calls if tc.id}
            missing_ids = tool_call_ids - all_tool_result_ids
            if missing_ids:
                logger.debug(f"发现不完整的工具调用序列，缺失 tool results: {missing_ids}")
                return False

        return True

    # --- 便捷的添加方法 --- (更新参数名为 show_in_ui)

    async def append_system_message(self, content: str, show_in_ui: bool = False) -> None:
        """添加一条系统消息"""
        message = SystemMessage(content=content, show_in_ui=show_in_ui)
        await self.add_message(message)

    async def append_user_message(self, content: str, show_in_ui: bool = True, source: Optional[str] = None) -> None:
        """添加一条用户消息。source 用于标记消息来源（None=用户，"horizon"=系统注入等）。"""
        message = UserMessage(content=content, show_in_ui=show_in_ui, source=source)
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

                if isinstance(tc_data, ToolCall):
                    # 标准化 arguments：确保是字符串，且 \u 转义还原为真实 Unicode
                    if not isinstance(tc_data.function.arguments, str):
                        try:
                            tc_data.function.arguments = json.dumps(tc_data.function.arguments, ensure_ascii=False)
                        except Exception as e:
                            logger.warning(f"标准化 AssistantMessage ToolCall arguments 失败: {tc_data.function.arguments}, 错误: {e}. 跳过此 ToolCall。")
                            continue
                    else:
                        try:
                            tc_data.function.arguments = json.dumps(json.loads(tc_data.function.arguments), ensure_ascii=False)
                        except Exception:
                            pass
                    tool_call_obj = tc_data

                elif isinstance(tc_data, dict):
                    # 从字典创建 ToolCall 对象
                    try:
                        function_data = tc_data.get("function", {})
                        if not isinstance(function_data, dict):
                             raise ValueError("Tool call 'function' 字段必须是字典")

                        arguments_raw = function_data.get("arguments")
                        arguments_str = None
                        # 确保 arguments 是字符串，且 \u 转义还原为真实 Unicode
                        if isinstance(arguments_raw, str):
                            try:
                                arguments_str = json.dumps(json.loads(arguments_raw), ensure_ascii=False)
                            except Exception:
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

    def _reorder_displaced_tool_results(self, llm_messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """一步到位地重排工具调用序列，确保每个 assistant(tool_calls) 紧跟其所有 tool_result。

        同时处理两类问题：
        - tool_result 被其他 assistant(tool_calls) 隔开（连续多条 assistant 的场景）
        - user/其他消息被夹在 assistant(tool_calls) 和 tool_result 之间（Horizon 误注入场景）

        算法：遇到 assistant(tool_calls) 时，从全局按 tool_call_id 把它的所有 tool_result
        拉到紧跟其后；已被认领的 tool_result 在原位跳过；其余消息保持相对顺序。
        """
        if not llm_messages:
            return llm_messages

        # 建立 tool_call_id → 首次出现的 tool_result 消息索引
        tr_idx: dict[str, int] = {}
        for idx, msg in enumerate(llm_messages):
            if msg.get("role") == "tool" and msg.get("tool_call_id"):
                tr_idx.setdefault(msg["tool_call_id"], idx)

        # 建立 assistant 消息索引 → 它所拥有的 tool_result 索引集合
        assistant_owned: dict[int, set[int]] = {}
        claimed: set[int] = set()  # 被某个 assistant 认领的 tool_result 索引
        for i, msg in enumerate(llm_messages):
            if msg.get("role") == "assistant" and msg.get("tool_calls"):
                owned = set()
                for tc in msg["tool_calls"]:
                    tid = tc.get("id")
                    if tid and tid in tr_idx:
                        owned.add(tr_idx[tid])
                assistant_owned[i] = owned
                claimed |= owned

        # 分类检测：遍历全量，不提前 break，确保同时识别两种错位情况
        has_displacement = False  # tool_result 在其他 assistant 之后（连续多条 assistant 场景）
        has_interleaved = False   # 非 tool 消息夹在 assistant(tool_calls) 和 tool_result 之间
        for assistant_idx, owned_set in assistant_owned.items():
            if not owned_set:
                continue
            expected = set(range(assistant_idx + 1, assistant_idx + 1 + len(owned_set)))
            if owned_set != expected:
                has_displacement = True
            else:
                for k in range(assistant_idx + 1, assistant_idx + 1 + len(owned_set)):
                    if llm_messages[k].get("role") != "tool":
                        has_interleaved = True
                        break

        if not has_displacement and not has_interleaved:
            return llm_messages

        # 一步重排：assistant(tool_calls) 出现时拉取其所有 tool_result，
        # 已认领的 tool_result 在原位跳过，其余消息保持相对顺序
        result: List[Dict[str, Any]] = []
        consumed: set[int] = set()

        for i, msg in enumerate(llm_messages):
            if i in consumed:
                continue

            if i in claimed:
                # 该 tool_result 会在其所属 assistant 处理时被拉取，此处跳过
                continue

            result.append(msg)
            consumed.add(i)

            if i in assistant_owned:
                # 按 tool_calls 声明顺序拉取 tool_result，保证顺序确定性
                for tc in msg["tool_calls"]:
                    tid = tc.get("id")
                    if not tid:
                        continue
                    ri = tr_idx.get(tid)
                    if ri is not None and ri not in consumed:
                        result.append(llm_messages[ri])
                        consumed.add(ri)

        # 兜底：将未被任何 assistant 认领的遗漏消息追加到末尾（理论上不会发生）
        for i in range(len(llm_messages)):
            if i not in consumed and i not in claimed:
                result.append(llm_messages[i])

        if len(result) != len(llm_messages):
            logger.error(
                f"[ChatHistory·规则0·重排] 消息数量不一致 "
                f"({len(llm_messages)} → {len(result)})，放弃重排"
            )
            return llm_messages

        affected_count = sum(1 for owned in assistant_owned.values() if owned)
        patterns: list[str] = []
        if has_displacement:
            patterns.append(
                "❌ assistant(A)→assistant(B)→tool(A)→tool(B)  →  ✅ assistant(A)→tool(A)→assistant(B)→tool(B)"
            )
        if has_interleaved:
            patterns.append(
                "❌ assistant([A,B])→user→tool(A)→tool(B)  →  ✅ assistant([A,B])→tool(A)→tool(B)→user"
            )
        logger.warning(
            f"[ChatHistory·规则0·重排] {affected_count} 个 assistant(tool_calls) 的 "
            f"{len(claimed)} 个 tool_result 错位｜{'  |  '.join(patterns)}"
        )
        return result

    def _fix_message_sequence_errors(self, llm_messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        修复历史消息中的序列错误，确保tool_use和tool_result正确匹配

        修复策略：
        0. 重排工具调用序列：确保每个 assistant(tool_calls) 紧跟其所有 tool_result，
           同时处理 tool_result 位移和夹缝 user 消息两类问题
        1. 为缺少 tool_result 的 tool_call 补合成占位（保留 assistant 消息结构）
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

        # 步骤0：重排工具调用序列（一步到位处理 tool_result 位移 + 夹缝 user 消息）
        llm_messages = self._reorder_displaced_tool_results(llm_messages)

        # 第一步：为缺少 tool_result 的 tool_call 补合成占位（对齐 CC 的 ensureToolResultPairing）
        # 不移除 assistant 消息，保留结构，让模型知道调用过哪些工具
        fixes_applied = 0
        synthetic_inserts: dict[int, list[dict]] = {}  # insert_after_index → [synthetic tool messages]

        for i, message in enumerate(llm_messages):
            if message.get("role") == "assistant" and message.get("tool_calls"):
                tool_calls_in_msg = message.get("tool_calls", [])
                # 找到下一个 assistant 消息的位置作为搜索边界
                next_assistant_idx = len(llm_messages)
                for j in range(i + 1, len(llm_messages)):
                    if llm_messages[j].get("role") == "assistant":
                        next_assistant_idx = j
                        break

                # 收集此 assistant 消息已有的 tool_result id
                found_ids = {
                    llm_messages[j].get("tool_call_id")
                    for j in range(i + 1, next_assistant_idx)
                    if llm_messages[j].get("role") == "tool"
                }

                # 找到 assistant 之后连续 tool 消息的末尾位置，
                # 合成占位必须紧跟 assistant + 已有 tool results，不能隔着 user 消息，
                # 否则 step2 的向后搜索遇到 user 会提前终止，导致合成 tool 被误判为孤立消息。
                # 注意：只有属于当前 assistant 的 tool result 才算入连续块；
                # 遇到不属于当前 assistant 的孤立 tool 消息（如 ask_user 的回答）立即停止，
                # 否则合成占位会被插在孤立 tool 之后，导致 step2 将孤立 tool 转换的 assistant
                # 消息夹在 tool_calls 和其真正的 tool results 之间，触发大模型 400 错误。
                assistant_tool_call_ids = {tc.get("id") for tc in tool_calls_in_msg}
                contiguous_tool_end = i  # 默认紧跟 assistant
                for k in range(i + 1, next_assistant_idx):
                    if llm_messages[k].get("role") == "tool":
                        if llm_messages[k].get("tool_call_id") in assistant_tool_call_ids:
                            contiguous_tool_end = k
                        else:
                            break  # 遇到不属于当前 assistant 的孤立 tool，停止扩展连续块
                    else:
                        break

                for tool_call in tool_calls_in_msg:
                    tool_call_id = tool_call.get("id")
                    if not tool_call_id or tool_call_id in found_ids:
                        continue
                    # 缺少对应 tool_result，补合成占位
                    tool_name = tool_call.get("function", {}).get("name", "unknown")
                    synthetic = {
                        "role": "tool",
                        "tool_call_id": tool_call_id,
                        "content": "[Tool result missing — call was likely truncated by output token limit]",
                    }
                    insert_after = contiguous_tool_end
                    if insert_after not in synthetic_inserts:
                        synthetic_inserts[insert_after] = []
                    synthetic_inserts[insert_after].append(synthetic)
                    fixes_applied += 1
                    logger.warning(
                        f"[ChatHistory·规则1·补占位] assistant 的 {tool_name}"
                        f"(id={tool_call_id}) 缺少 tool_result → 已补合成占位"
                    )

        # 将合成 tool_result 插入消息列表
        # insert_after 始终 <= len-1（取的是 contiguous_tool_end，即 i 或区间内某个 tool 位置），无 len(llm_messages) key
        if synthetic_inserts:
            patched: List[Dict[str, Any]] = []
            for i, msg in enumerate(llm_messages):
                patched.append(msg)
                if i in synthetic_inserts:
                    patched.extend(synthetic_inserts[i])
            llm_messages = patched

        # 第二步：过滤消息并处理孤立的tool消息
        filtered_messages = []
        for i, message in enumerate(llm_messages):
            if message.get("role") == "tool":
                tool_call_id = message.get("tool_call_id")

                # 查找对应的assistant消息（向前搜索）
                found_corresponding_assistant = False
                for j in range(i-1, -1, -1):
                    prev_msg = llm_messages[j]
                    if prev_msg.get("role") == "assistant":
                        tool_calls = prev_msg.get("tool_calls", [])
                        # 检查是否有匹配的tool_call_id
                        for tc in tool_calls:
                            if tc.get("id") == tool_call_id:
                                found_corresponding_assistant = True
                                break
                        # 无论是否匹配，遇到 assistant 消息就停止向前搜索：
                        # tool_result 只能属于紧邻的那个 assistant，不能跨轮匹配
                        break
                    elif prev_msg.get("role") == "user":
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
                    logger.warning(
                        f"[ChatHistory·规则2·孤立转换] tool(id={tool_call_id}) "
                        f"找不到对应 assistant → 已转为 assistant 消息"
                    )
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
                    elif message.get("role") == "tool":
                        # tool 消息还需比较 tool_call_id，避免将不同调用的相同结果误判为重复
                        if message.get("tool_call_id") == prev_message.get("tool_call_id"):
                            should_add = False
                    else:
                        should_add = False

                    if not should_add:
                        fixes_applied += 1
                        logger.warning(
                            f"[ChatHistory·规则3·去重] 连续消息完全重复 "
                            f"(role={message.get('role')}) → 已移除"
                        )

            if should_add:
                final_messages.append(message)

        if fixes_applied > 0:
            logger.warning(
                f"[ChatHistory] 运行时序列修复完成：共 {fixes_applied} 项"
            )

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
