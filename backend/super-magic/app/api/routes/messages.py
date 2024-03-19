import asyncio
import json
import os
import time
import traceback
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from typing import Union
from pydantic import ValidationError, Field, validator

from app.api.dto.base import WebSocketMessage
from app.api.http_dto.response import (
    BaseResponse,
    create_success_response,
    create_error_response,
    ResponseCode
)
from app.service.agent_dispatcher import AgentDispatcher
from app.core.context.agent_context import AgentContext
from agentlang.config.non_human_config import NonHumanConfigManager
from app.core.entity.event.event import AfterClientChatEventData
from agentlang.event.data import AgentSuspendedEventData, ErrorEventData
from app.core.entity.message.client_message import (
    ChatClientMessage,
    ContextType,
    InitClientMessage
)
from app.core.entity.message.message import MessageType
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from agentlang.utils.snowflake import Snowflake
from app.core.stream.websocket_stream import WebSocketStream
from agentlang.config.dynamic_config import dynamic_config
from app.paths import PathManager

router = APIRouter(prefix="/v1/messages", tags=["消息处理"])

logger = get_logger(__name__)


class MessageProcessor:
    """HTTP消息处理器，复用WebSocket的处理逻辑"""

    # TTL for processed message deduplication (seconds)
    # Messages within this window will be deduplicated
    _MESSAGE_DEDUP_TTL: float = 600.0

    def __init__(self):
        self.worker_task: Optional[asyncio.Task] = None

        self.agent_dispatcher = AgentDispatcher.get_instance()

        # 进程内中断互斥锁，用于进行中防抖
        self._interrupt_lock: asyncio.Lock = asyncio.Lock()

        # Message deduplication cache: message_id -> (start_timestamp, is_processing)
        # Used to prevent duplicate message processing when client retries
        self._processing_messages: Dict[str, tuple[float, bool]] = {}

    async def cancel_task(self):
        """取消任务"""
        if self.worker_task and not self.worker_task.done():
            self.worker_task.cancel()
            try:
                await self.worker_task
            except asyncio.CancelledError:
                logger.info("已取消正在运行的worker任务")

    def _cleanup_expired_messages(self) -> None:
        """Clean up expired message entries from deduplication cache"""
        current_time = time.time()
        expired_keys = [
            msg_id for msg_id, (timestamp, _) in self._processing_messages.items()
            if current_time - timestamp > self._MESSAGE_DEDUP_TTL
        ]
        for key in expired_keys:
            del self._processing_messages[key]

    def _is_message_processing(self, message_id: str) -> bool:
        """
        Check if a message is currently being processed or was recently processed.

        Args:
            message_id: The message ID to check

        Returns:
            True if the message is in processing or was recently processed (within TTL)
        """
        if not message_id:
            return False

        # Cleanup expired entries first
        self._cleanup_expired_messages()

        if message_id in self._processing_messages:
            timestamp, is_processing = self._processing_messages[message_id]
            # Message is still within TTL window
            if time.time() - timestamp <= self._MESSAGE_DEDUP_TTL:
                return True
        return False

    def _mark_message_processing(self, message_id: str) -> None:
        """Mark a message as being processed"""
        if message_id:
            self._processing_messages[message_id] = (time.time(), True)

    def _mark_message_completed(self, message_id: str) -> None:
        """Mark a message as completed (still kept for deduplication within TTL)"""
        if message_id and message_id in self._processing_messages:
            timestamp, _ = self._processing_messages[message_id]
            self._processing_messages[message_id] = (timestamp, False)

    def _save_chat_message(self, message: ChatClientMessage):
        """保存聊天消息到文件"""
        try:
            # 获取文件路径
            chat_message_file = PathManager.get_chat_client_message_file()

            # 确保目录存在
            chat_message_file.parent.mkdir(exist_ok=True)

            # 将消息转换为字典并保存
            message_dict = message.dict()
            with open(chat_message_file, 'w', encoding='utf-8') as f:
                json.dump(message_dict, f, ensure_ascii=False, indent=2)

            logger.info(f"已保存聊天消息到: {chat_message_file}")

            # 如果 chat_client_message 包含 metadata，则更新 init_client_message 的 metadata
            self._update_init_metadata_from_chat(message)

        except Exception as e:
            logger.error(f"保存聊天消息失败: {e}")

    def _update_init_metadata_from_chat(self, message: ChatClientMessage):
        """
        将 chat_client_message 中的 metadata 覆盖到 init_client_message 中

        只有当 chat_client_message 的 metadata 包含 super_magic_task_id 时才更新

        Args:
            message: 聊天客户端消息
        """
        # 检查 chat_client_message 是否包含 metadata
        if not message.metadata:
            logger.debug("chat_client_message 中没有 metadata，跳过更新")
            return

        # 检查 metadata 中是否包含 super_magic_task_id
        if not message.metadata.super_magic_task_id:
            logger.debug("chat_client_message 的 metadata 中没有 super_magic_task_id，跳过更新")
            return

        # 获取 init_client_message 文件路径
        init_message_file = PathManager.get_init_client_message_file()

        # 检查 init_client_message 文件是否存在
        if not init_message_file.exists():
            logger.warning(f"init_client_message 文件不存在: {init_message_file}，跳过 metadata 更新")
            return

        # 读取 init_client_message
        with open(init_message_file, 'r', encoding='utf-8') as f:
            init_data = json.load(f)

        # 将 chat_client_message 的 metadata 覆盖到 init_client_message 中
        chat_metadata = message.metadata.dict()
        init_data['metadata'] = chat_metadata

        # 写回 init_client_message 文件
        with open(init_message_file, 'w', encoding='utf-8') as f:
            json.dump(init_data, f, ensure_ascii=False, indent=2)

        logger.info(f"已将 chat_client_message 的 metadata 更新到 init_client_message: {init_message_file}")
        logger.debug(f"更新的 metadata 字段: {list(chat_metadata.keys())}")

    def _load_last_chat_message(self) -> Optional[ChatClientMessage]:
        """从文件加载最后一条聊天消息"""
        try:
            chat_message_file = PathManager.get_chat_client_message_file()

            if not chat_message_file.exists():
                logger.warning("未找到上一条聊天消息文件")
                return None

            with open(chat_message_file, 'r', encoding='utf-8') as f:
                message_dict = json.load(f)

            # 重新构造ChatClientMessage对象
            return ChatClientMessage(**message_dict)

        except Exception as e:
            logger.error(f"加载聊天消息失败: {e}")
            return None

    async def _dispatch_delayed_init_event_if_needed(self, agent_context: AgentContext) -> None:
        """
        在 chat 消息处理时，检查并发送延迟的 init 事件

        仅在以下情况下发送 init 事件：
        1. init 事件尚未发送过
        2. 当前 skip_init_messages 为 False（可以发送消息了）

        Args:
            agent_context: Agent 上下文
        """
        # 检查 init 事件是否已经发送过
        if self.agent_dispatcher.is_init_event_dispatched():
            logger.debug("init 事件已经发送过，跳过延迟发送")
            return

        # 检查当前是否允许发送 init 消息
        metadata = agent_context.get_init_client_message_metadata()
        if metadata and metadata.skip_init_messages is True:
            logger.debug("当前 skip_init_messages=True，暂不发送延迟的 init 事件")
            return

        # 满足条件，发送延迟的 init 事件
        logger.info("检测到沙箱预启动场景，开始发送延迟的 init 事件")

        try:
            from agentlang.context.tool_context import ToolContext
            from agentlang.event.data import BeforeInitEventData, AfterInitEventData

            # 创建 ToolContext
            tool_context = ToolContext(metadata=agent_context.get_metadata())
            tool_context.register_extension("agent_context", agent_context)

            # 发送 BEFORE_INIT 事件
            before_init_data = BeforeInitEventData(tool_context=tool_context)
            await agent_context.dispatch_event(EventType.BEFORE_INIT, before_init_data)
            logger.info("已发送延迟的 BEFORE_INIT 事件")

            # 发送 AFTER_INIT 事件
            after_init_data = AfterInitEventData(
                tool_context=tool_context,
                agent_context=agent_context,
                success=True
            )
            await agent_context.dispatch_event(EventType.AFTER_INIT, after_init_data)
            logger.info("已发送延迟的 AFTER_INIT 事件")

            # 标记 init 事件已发送
            self.agent_dispatcher.set_init_event_dispatched(True)

        except Exception as e:
            logger.error(f"发送延迟的 init 事件时出错: {e}")
            import traceback
            logger.error(traceback.format_exc())

    async def handle_chat(self, message: ChatClientMessage) -> BaseResponse:
        """处理聊天消息"""
        try:
            agent_context = self.agent_dispatcher.agent_context
            if not agent_context:
                return create_error_response("Agent context 未初始化")

            # Message deduplication: prevent duplicate processing when client retries
            message_id = getattr(message, 'message_id', None)
            if message_id and self._is_message_processing(message_id):
                logger.info(
                    f"Ignoring duplicate message: message_id={message_id}, "
                    f"context_type={message.context_type}"
                )
                return create_success_response("消息正在处理中，忽略重复请求")

            # Mark message as processing (for NORMAL/FOLLOW_UP messages only)
            if message_id and message.context_type in [ContextType.NORMAL, ContextType.FOLLOW_UP]:
                self._mark_message_processing(message_id)

            # 检查是否已有 task_id，如果没有才生成新的
            existing_task_id = agent_context.get_task_id()
            if not existing_task_id:
                snowflake = Snowflake.create_default()
                task_id = str(snowflake.get_id())
                agent_context.set_task_id(task_id)
                logger.info(f"生成新的任务ID: {task_id}")
            else:
                logger.info(f"使用现有的任务ID: {existing_task_id}")

            # 🔥 处理动态配置和模型选择（容错模式：失败不影响聊天流程）
            try:
                # 将 agent_mode 解析为 agent_type，用于 dynamic_config skills 按 agent 隔离
                _agent_type = self._resolve_agent_type(message.agent_mode)
                await self._handle_dynamic_config(message.dynamic_config, _agent_type)
            except Exception as e:
                logger.error(f"动态配置处理失败: {e}")
                logger.info("🔄 动态配置处理失败，将使用全局配置继续聊天流程")

            try:
                await self._handle_dynamic_model_selection(message.model_id, agent_context)
            except Exception as e:
                logger.error(f"动态模型选择处理失败: {e}")
                logger.info("🔄 动态模型选择处理失败，将使用Agent默认模型继续聊天流程")

            # 处理非人类限流配置（容错模式：失败不影响聊天流程）
            await self._handle_non_human_options(message.dynamic_config, agent_context)

            # 保存聊天消息
            if message.context_type in [ContextType.NORMAL, ContextType.FOLLOW_UP]:
                self._save_chat_message(message)

            # 检查并发送延迟的 init 事件（沙箱预启动场景）
            await self._dispatch_delayed_init_event_if_needed(agent_context)

            # 🔥 ASR 录音纪要聊天模式路由：检测 asr_task_key 并切换 agent
            try:
                if message.dynamic_config and message.dynamic_config.get("asr_task_key"):
                    asr_task_key = message.dynamic_config["asr_task_key"]
                    message.agent_mode = "summary-chat"
                    logger.info(f"✅ [ASR-CHAT] 检测到 asr_task_key={asr_task_key}，切换到 summary-chat agent")
            except Exception as e:
                logger.error(f"❌ [ASR-CHAT] ASR agent 路由切换失败: {e}")
                # 失败不影响聊天流程，继续使用原 agent_mode

            await agent_context.dispatch_event(
                EventType.AFTER_CLIENT_CHAT,
                AfterClientChatEventData(
                    agent_context=agent_context,
                    client_message=message
                )
            )

            if message.context_type in [ContextType.NORMAL, ContextType.FOLLOW_UP, ContextType.CONTINUE]:

                success = await agent_context.handle_user_interruption(
                    cancel_task_func=self.cancel_task,
                    reason=message.remark or "新消息打断",
                    timeout=5
                )

                if not success:
                    logger.error("用户中断处理失败，但将继续执行后续逻辑")

                self.worker_task = asyncio.create_task(self._dispatch_agent_task(message))
                return create_success_response("消息处理成功")

            elif message.context_type == ContextType.INTERRUPT:
                logger.info("收到中断请求")
                # 进行中防抖：若已有中断在处理，忽略本次请求
                if self._interrupt_lock.locked():
                    try:
                        logger.info(
                            f"忽略重复中断请求: task_id={agent_context.get_task_id() if agent_context else 'unknown'}, "
                            f"message_id={getattr(message, 'message_id', 'unknown')}"
                        )
                    except Exception:
                        logger.info("忽略重复中断请求")
                    return create_success_response("中断处理中，忽略重复请求")

                try:
                    async with self._interrupt_lock:
                        success = await agent_context.handle_user_interruption(
                            cancel_task_func=self.cancel_task,
                            reason=message.remark or "",
                            timeout=5
                        )
                        if success:
                            await agent_context.dispatch_event(
                                EventType.AGENT_SUSPENDED,
                                AgentSuspendedEventData(
                                    agent_context=agent_context,
                                    remark=message.remark,
                                )
                            )
                            return create_success_response("任务已中断")
                        else:
                            logger.info("中断已在进行或已完成，跳过重复触发")
                            return create_success_response("任务已中断")
                except Exception as e:
                    logger.error(f"中断处理异常: {e}")
                    logger.error(traceback.format_exc())
                    return create_error_response("中断处理异常")

            else:
                logger.warning(f"未知的上下文类型: {message.context_type}")
                return create_error_response(f"不支持的上下文类型: {message.context_type}")

        except Exception as e:
            logger.error(f"处理聊天消息失败: {e}")
            logger.error(traceback.format_exc())

            if self.agent_dispatcher.agent_context:
                await self.agent_dispatcher.agent_context.dispatch_event(
                    EventType.ERROR,
                    ErrorEventData(
                        agent_context=self.agent_dispatcher.agent_context,
                        error_message="消息处理异常",
                        exception=e
                    )
                )
            return create_error_response("消息处理失败")

    async def handle_workspace_init(self, message: InitClientMessage) -> BaseResponse:
        """处理工作区初始化消息"""
        try:
            logger.info(f"收到{MessageType.INIT}消息")

            # 初始化工作区
            await self.agent_dispatcher.initialize_workspace(message)

            logger.info("工作区初始化完成")
            return create_success_response("工作区初始化成功")

        except Exception as e:
            logger.error(f"工作区初始化失败: {e}")
            logger.error(traceback.format_exc())
            return create_error_response("工作区初始化失败")

    async def handle_continue(self) -> BaseResponse:
        """处理继续指令"""
        try:
            # 加载上一条聊天消息
            last_message = self._load_last_chat_message()
            if not last_message:
                return create_error_response("未找到上一条聊天消息，无法继续")

            # 直接修改prompt为"继续"
            last_message.prompt = "继续"
            last_message.context_type = ContextType.NORMAL  # 确保是NORMAL类型

            logger.info("处理继续指令，恢复上一条消息并设置prompt为'继续'")

            # 调用handle_chat处理继续消息
            return await self.handle_chat(last_message)

        except Exception as e:
            logger.error(f"处理继续指令失败: {e}")
            logger.error(traceback.format_exc())
            return create_error_response("继续指令处理失败")

    async def _dispatch_agent_task(self, message: ChatClientMessage):
        """在异步任务中调度 agent"""
        try:
            # 调度 agent
            await self.agent_dispatcher.dispatch_agent(message)
        except Exception as e:
            logger.error(f"异步任务执行失败: {e}")
            logger.error(traceback.format_exc())

            # 发送错误事件和消息，确保用户能收到失败反馈
            try:
                agent_context = self.agent_dispatcher.agent_context
                if agent_context:
                    # 使用通用的错误消息，不暴露内部错误细节
                    error_message = "Failed to process the request. Please contact the administrator."

                    # 触发错误事件
                    await agent_context.dispatch_event(
                        EventType.ERROR,
                        ErrorEventData(
                            agent_context=agent_context,
                            error_message=error_message,
                            exception=e
                        )
                    )
                    logger.info("已发送错误事件和消息到客户端")
                else:
                    logger.warning("agent_context 不可用，无法发送错误消息")
            except Exception as notify_error:
                logger.error(f"发送错误通知失败: {notify_error}")
                logger.error(traceback.format_exc())

    def _resolve_agent_type(self, agent_mode) -> str:
        """将 agent_mode（枚举或字符串）解析为 agent_type 字符串

        Args:
            agent_mode: AgentMode 枚举或自定义 agent ID 字符串

        Returns:
            str: agent_type，如 "skill"、"magic"、"slider" 等
        """
        from app.core.entity.message.client_message import AgentMode

        if not agent_mode:
            return AgentMode.GENERAL.get_agent_type()
        try:
            return AgentMode(agent_mode).get_agent_type()
        except ValueError:
            # 自定义 agent ID 直接作为 agent_type
            return str(agent_mode).strip() or AgentMode.GENERAL.get_agent_type()

    async def _handle_dynamic_config(self, dynamic_config_data: Optional[Dict[str, Any]], agent_type: str = ""):
        """处理动态配置注入（容错模式：失败不影响聊天流程）"""
        if not dynamic_config_data:
            return

        try:
            success, config_file_path, warnings = await dynamic_config.validate_and_write_dynamic_config(
                dynamic_config_data
            )

            if success:
                model_ids = dynamic_config.get_model_ids()
                if model_ids:
                    logger.info(f"✅ 已写入动态配置: {len(model_ids)}个模型 {model_ids} -> {config_file_path}")
                else:
                    logger.info(f"✅ 已写入空的动态配置 -> {config_file_path}")

                if warnings:
                    logger.debug(f"⚠️  动态配置写入时有警告: {'; '.join(warnings)}")
            else:
                error_msg = f"动态配置验证失败: {'; '.join(warnings)}"
                logger.error(f"❌ {error_msg}")
                logger.info("🔄 动态配置注入失败，将使用全局配置继续聊天流程")

        except Exception as e:
            logger.error(f"❌ 动态配置注入异常: {e}")
            logger.error(f"错误详情: {traceback.format_exc()}")
            logger.info("🔄 动态配置注入失败，将使用全局配置继续聊天流程")

        # 保存 dynamic_config.skill 列表到 workspace，按 agent_type 隔离（容错）
        try:
            skill_list = dynamic_config_data.get("skill") or dynamic_config_data.get("skills")
            if isinstance(skill_list, list) and skill_list:
                from app.core.skill_manager import save_dynamic_config_skills
                await save_dynamic_config_skills(skill_list, agent_type)
                logger.info(f"✅ 已保存 dynamic_config skills: {len(skill_list)} 个 (agent_type={agent_type or 'default'})")
        except Exception as e:
            logger.error(f"❌ 保存 dynamic_config skills 失败: {e}")

    async def _handle_dynamic_model_selection(self, model_id: Optional[str], agent_context):
        """处理动态模型选择（容错模式：失败不影响聊天流程）"""
        if not model_id or not model_id.strip():
            return

        try:
            # 直接设置动态模型ID，让LLMFactory.call_with_tool_support()在实际使用时进行兜底处理
            agent_context.set_dynamic_model_id(model_id)
            logger.info(f"✅ 已设置动态模型选择: {model_id}")

        except Exception as e:
            logger.error(f"❌ 动态模型选择设置异常: {e}")
            logger.info("🔄 动态模型选择设置失败，将使用Agent默认模型继续聊天流程")

    async def _handle_non_human_options(
        self,
        dynamic_config_data: Optional[Dict[str, Any]],
        agent_context
    ):
        """处理非人类限流配置

        Args:
            dynamic_config_data: 动态配置数据
            agent_context: Agent 上下文
        """
        if not dynamic_config_data:
            return

        non_human_config = dynamic_config_data.get("non_human_options")
        if not non_human_config:
            return

        try:
            # 使用配置管理器解析并验证配置
            options = NonHumanConfigManager.parse_and_validate(non_human_config)

            if options and options.is_enabled():
                # 直接使用 agent_context 存储配置
                agent_context.set_non_human_options(options)
                logger.info("非人类限流配置已加载并存储到上下文")

        except Exception as e:
            logger.error(f"处理非人类限流配置异常: {e}")
            raise


# 创建消息处理器实例
message_processor = MessageProcessor()


@router.post("/chat", response_model=BaseResponse)
async def process_message(
    message_data: dict
) -> BaseResponse:
    """
    处理客户端消息

    支持的消息类型：
    - CHAT: 聊天消息（包括normal、follow_up、interrupt）
    - INIT: 工作区初始化消息
    - CONTINUE: 继续指令
    """
    try:
        # 调试：打印接收到的 message_data
        logger.info(f"收到的 message_data: {message_data}")
        logger.info(f"message_data 类型: {type(message_data)}")
        logger.info(f"message_data 键: {list(message_data.keys()) if isinstance(message_data, dict) else 'Not a dict'}")

        ws_message = WebSocketMessage(**message_data)
        message_type = ws_message.type

        if message_type == MessageType.CHAT.value:
            try:
                chat_message = ChatClientMessage(**message_data)
                # 保存聊天消息
                message_processor._save_chat_message(chat_message)

                return await message_processor.handle_chat(chat_message)
            except ValidationError as e:
                return create_error_response(f"CHAT消息格式错误: {str(e)}")

        elif message_type == MessageType.INIT.value:
            try:
                init_message = InitClientMessage(**message_data)
                asyncio.create_task(message_processor.handle_workspace_init(init_message))
                return create_success_response("工作区初始化成功")
            except ValidationError as e:
                return create_error_response(f"INIT消息格式错误: {str(e)}")

        elif message_type == MessageType.CONTINUE.value:
            # 处理继续指令
            return await message_processor.handle_continue()

        else:
            valid_types = [MessageType.CHAT.value, MessageType.INIT.value, MessageType.CONTINUE.value]
            return create_error_response(
                f"不支持的消息类型: {message_type}，支持的类型: {valid_types}"
            )

    except ValidationError as e:
        return create_error_response(f"消息格式错误: {str(e)}")
    except Exception as e:
        logger.error(f"消息处理异常: {e}")
        logger.error(traceback.format_exc())
        return create_error_response("服务异常")

# 在最后添加WebSocket端点
@router.websocket("/subscribe")
async def websocket_subscription_endpoint(websocket: WebSocket):
    """
    WebSocket消息订阅端点

    客户端通过此端点建立WebSocket连接，接收系统推送的实时消息
    """
    await websocket.accept()
    logger.info("WebSocket连接已建立")

    websocket_stream = WebSocketStream(websocket)

    try:
        agent_context = message_processor.agent_dispatcher.agent_context
        if not agent_context:
            logger.error("Agent context 未初始化，无法处理WebSocket连接")
            return

        agent_context.add_stream(websocket_stream)
        logger.info("WebSocket流已加入到agent context")

        while True:
            try:
                data = await websocket.receive_text()
                logger.debug(f"收到WebSocket消息: {data}")

            except WebSocketDisconnect:
                logger.info("WebSocket客户端主动断开连接")
                break
            except Exception as e:
                logger.error(f"WebSocket处理消息时出错: {e}")
                break

    except WebSocketDisconnect:
        logger.info("WebSocket连接断开")
    except Exception as e:
        logger.error(f"WebSocket连接处理异常: {e}")
    finally:
        try:
            agent_context = message_processor.agent_dispatcher.agent_context
            if agent_context:
                agent_context.remove_stream(websocket_stream)
                logger.info("WebSocket流已从agent context中移除")
        except Exception as e:
            logger.error(f"清理WebSocket流时出错: {e}")
