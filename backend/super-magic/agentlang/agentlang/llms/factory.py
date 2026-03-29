"""
LLM Factory module for creating different LLM clients.

This module provides a factory pattern for creating different LLM clients
based on the model ID provided. It uses specialized processors for handling
streaming and regular calls.
"""

import os
import json
import asyncio
import uuid
import time
from typing import Any, Dict, List, Optional
from datetime import datetime

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletion
from pydantic import BaseModel

from agentlang.config.config import config
from agentlang.config.dynamic_config import dynamic_config
from agentlang.interface.context import AgentContextInterface
from agentlang.llms.token_usage.tracker import TokenUsageTracker
from agentlang.llms.token_usage.pricing import ModelPricing
from agentlang.llms.token_usage.report import TokenUsageReport
from agentlang.llms.processors import ProcessorConfig, ProcessorManager
from agentlang.llms.error_classifier import LLMErrorClassifier
from agentlang.logger import get_logger
from agentlang.utils.metadata import MetadataUtil
from agentlang.utils.security import sanitize_api_key
from agentlang.llms.utils.token_adjuster import get_current_tokens, adjust_max_tokens
from agentlang.llms.utils.debug_logger import save_llm_debug_log, LLMDebugInfo

logger = get_logger(__name__)

DEFAULT_TIMEOUT = int(config.get("llm.api_timeout", 300))
# 禁用 openai SDK 内部重试，项目自身已有重试机制，SDK 的静默重试会导致调用方长时间阻塞无感知
MAX_RETRIES = 0

class LLMClientConfig(BaseModel):
    """Configuration for LLM clients."""

    model_id: str
    api_key: str
    api_base_url: Optional[str] = None
    name: str
    provider: str
    temperature: float = 0.7
    max_output_tokens: int = 4 * 1024
    max_context_tokens: int = 8 * 1024
    top_p: float = 1.0
    stop: Optional[List[str]] = None
    extra_params: Dict[str, Any] = {}
    supports_tool_use: bool = True
    type: str = "llm"

class LLMFactory:
    """Factory for creating LLM clients."""

    _clients = {}
    _configs = {}

    # 初始化 token 使用跟踪器和相关服务
    token_tracker = TokenUsageTracker()

    # 从配置中加载价格配置
    models_config = config.get("models", {})
    pricing = ModelPricing(models_config=models_config)
    sandbox_id = os.environ.get("SANDBOX_ID", "default")

    # 初始化 TokenUsageReport
    _ = TokenUsageReport.get_instance(
        sandbox_id=sandbox_id,
        token_tracker=token_tracker,
        pricing=pricing
    )

    @classmethod
    def register_config(cls, llm_config: LLMClientConfig) -> None:
        """Register a configuration for a model ID.

        Args:
            llm_config: The configuration to register.
        """
        cls._configs[llm_config.model_id] = llm_config

    @classmethod
    def get(cls, model_id: str) -> AsyncOpenAI:
        """Get a client for the given model ID.

        Args:
            model_id: The model ID to get a client for.

        Returns:
            The client for the given model ID.

        Raises:
            ValueError: If the model ID is not supported.
        """
        if model_id in cls._clients:
            return cls._clients[model_id]

        # 加载模型配置
        llm_config = cls.get_model_config(model_id, "llm")

        # 检查provider支持
        available_providers = ["openai"]
        if llm_config.provider not in available_providers:
            raise ValueError(f"不支持的provider: {llm_config.provider}")

        try:
            # 创建客户端
            if llm_config.provider == "openai":
                client = cls._create_openai_client(llm_config)
                cls._clients[model_id] = client
                return client

        except Exception as e:
            logger.error(f"创建 LLM 客户端失败: {e}")
            raise ValueError(f"无法为模型 {model_id} 创建客户端")

    @classmethod
    async def call_with_tool_support(
        cls,
        model_id: str,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        stop: Optional[List[str]] = None,
        agent_context: Optional[AgentContextInterface] = None,
        processor_config: Optional[ProcessorConfig] = None,
        enable_llm_response_events: bool = False,
        retry_count: int = 0
    ) -> ChatCompletion:
        """使用工具支持调用 LLM。

        根据模型配置使用工具调用。
        对于支持工具调用的模型，直接使用 OpenAI API 的工具调用功能。

        Args:
            model_id: 要使用的模型 ID。
            messages: 聊天消息历史。
            tools: 可用工具的列表，可选。
            stop: 终止序列列表，可选。
            agent_context: Agent 上下文接口，可选。
            processor_config: 处理器配置，包含流式模式、推流配置等，可选。
            enable_llm_response_events: 是否开启LLM响应事件触发，默认为 False。
            retry_count: 重试次数，0表示第一次调用，>0表示重试调用，默认为 0。

        Returns:
            LLM 响应。

        Raises:
            ValueError: 如果模型 ID 不支持。
        """
        # 默认配置创建
        if processor_config is None:
            processor_config = ProcessorConfig.create_default()

        use_stream_mode = processor_config.is_streaming_enabled()

        # 生成请求ID和记录开始时间
        request_id = str(uuid.uuid4())

        start_time = time.time()
        start_timestamp = datetime.now().isoformat()

        # 将 request_id 存储到 agent_context 中，以便 Agent 可以访问
        if agent_context:
            agent_context.set_current_llm_request_id(request_id)

        client: AsyncOpenAI = cls.get(model_id)
        if not client:
            raise ValueError(f"无法获取模型 ID 为 {model_id} 的客户端")

        # 获取模型配置
        llm_config = cls.get_model_config(model_id)

        # Get current token count from chat history
        current_tokens = await get_current_tokens(agent_context, request_id)

        # 构建请求参数
        request_params = {
            "model": llm_config.name,
            "messages": messages,
            "temperature": llm_config.temperature,
            "max_tokens": llm_config.max_output_tokens,
            "top_p": llm_config.top_p,
        }

        # 部分模型测试应用 max_tokens 参数
        if llm_config.name == "deepseek-reasoner" or llm_config.name == "deepseek-chat":
            request_params["max_tokens"] = 16384

        if llm_config.name == "doubao-seed-1.6" or llm_config.name == "doubao-seed-1.6-thinking" or llm_config.name == "doubao-seed-1.6-flash":
            request_params["max_tokens"] = 8192

        if llm_config.name == "deepseek-v3.2-exp":
            request_params["max_tokens"] = 8192

        # Dynamically adjust max_tokens to fit within context window based on actual token usage
        request_params["max_tokens"] = adjust_max_tokens(
            requested_max_tokens=request_params["max_tokens"],
            current_input_tokens=current_tokens,
            max_context_tokens=llm_config.max_context_tokens,
            request_id=request_id
        )

        # 添加终止序列（如果提供）
        if stop:
            request_params["stop"] = stop

        # 添加工具（如果提供且模型支持工具使用）
        if tools and llm_config.supports_tool_use:
            request_params["tools"] = tools
            # 添加 tool_choice 参数，设置为 "auto" 以允许 LLM 返回多个工具调用
            request_params["tool_choice"] = "auto"

        # 添加额外参数
        for key, value in llm_config.extra_params.items():
            request_params[key] = value

        # 动态设置最新的 metadata 到请求头（每次调用都获取最新值）
        extra_headers = MetadataUtil.get_llm_request_headers()
        if extra_headers:
            request_params["extra_headers"] = extra_headers
            logger.debug(f"[{request_id}] 动态设置请求头: {list(extra_headers.keys())}")

        # 发送请求并获取响应
        retry_info = f" (重试第 {retry_count} 次)" if retry_count > 0 else ""
        logger.info(f"[{request_id}] 发送聊天完成请求到 {model_id}:{llm_config.name}, 流式模式: {use_stream_mode}{retry_info}")

        # 执行 LLM 调用（统一管理流式/非流式及降级重试）
        response = None
        exception = None
        try:
            response = await ProcessorManager.execute_llm_call(
                client=client,
                llm_config=llm_config,
                request_params=request_params,
                model_id=model_id,
                processor_config=processor_config,
                agent_context=agent_context,
                request_id=request_id,
                enable_llm_response_events=enable_llm_response_events,
                retry_count=retry_count
            )

            # 统一修复工具调用参数的JSON格式
            if response and response.choices and len(response.choices) > 0:
                message = response.choices[0].message
                if message and message.tool_calls:
                    from agentlang.utils.tool_param_utils import preprocess_tool_calls_batch
                    # 保存修复前的原始参数，用于修复后对比日志
                    original_arguments = [tc.function.arguments for tc in message.tool_calls]
                    processed_count = preprocess_tool_calls_batch(message.tool_calls)
                    if processed_count > 0:
                        logger.info(f"[{request_id}] LLM响应修复了 {processed_count} 个工具调用的参数格式")
                        for i, tc in enumerate(message.tool_calls):
                            logger.info(f"[{request_id}] [修复前] Tool Call #{i}: id={tc.id}, name={tc.function.name}, arguments: {original_arguments[i]}")
                            logger.info(f"[{request_id}] [修复后] Tool Call #{i} arguments: {tc.function.arguments}")

            # 统一记录 token 使用情况
            cls.token_tracker.record_llm_usage(
                response.usage,
                model_id,
                user_id=agent_context.get_user_id() if agent_context else None,
                model_name=llm_config.name
            )

            # 记录成功响应日志和耗时
            end_time = time.time()
            elapsed_time = (end_time - start_time) * 1000  # 转换为毫秒
            logger.info(f"[{request_id}] 请求完成 {model_id}:{llm_config.name}, 耗时: {elapsed_time:.2f}ms, tokens: {response.usage.total_tokens if response.usage else 'N/A'}")

            return response
        except Exception as e:
            exception = e
            # Check for resource limit errors (insufficient points, consumption rounds limit, concurrency limit)
            cls._check_and_handle_resource_limit_error(e, request_id)
            cls._check_and_handle_context_window_error(e, request_id)

            # 记录错误耗时
            end_time = time.time()
            elapsed_time = (end_time - start_time) * 1000  # 转换为毫秒

            # 简洁的错误日志
            retry_info = f" (重试第 {retry_count} 次)" if retry_count > 0 else ""
            logger.critical(f"[{request_id}] 调用 LLM {model_id} 时出错: {str(e)}，耗时: {elapsed_time:.2f}ms{retry_info}")

            raise
        finally:
            # 统一记录调试日志（内部根据环境变量决定是否记录成功请求，失败请求总是记录）
            end_timestamp = datetime.now().isoformat()
            debug_info = LLMDebugInfo(
                model_id=model_id,
                model_name=llm_config.name,
                provider=llm_config.provider,
                api_base_url=llm_config.api_base_url,
                api_key=llm_config.api_key
            )
            asyncio.create_task(save_llm_debug_log(
                debug_info=debug_info,
                request_params=request_params,
                response=response,
                exception=exception,
                start_timestamp=start_timestamp,
                end_timestamp=end_timestamp
            ))

    @classmethod
    def get_embedding_client(cls, model_id: str) -> Any:
        """Get an embedding client for the given model ID.

        Args:
            model_id: The model ID to get an embedding client for.

        Returns:
            The embedding client for the given model ID.
        """
        if model_id in cls._clients:
            return cls._clients[model_id]

        # 加载模型配置
        llm_config = cls.get_model_config(model_id, "embedding")
        logger.info(f"创建embedding客户端 - llm_config: {llm_config}")

        # 检查provider支持
        available_providers = ["openai"]
        if llm_config.provider not in available_providers:
            raise ValueError(f"不支持的provider: {llm_config.provider}")

        try:
            # 创建客户端
            if llm_config.provider == "openai":
                client = cls._create_openai_client(llm_config)
                cls._clients[model_id] = client
                return client
        except Exception as e:
            logger.error(f"创建 Embedding 客户端失败: {e}")
            raise ValueError(f"无法为模型 {model_id} 创建客户端")

    @classmethod
    def get_model_config(cls, model_id: str, expected_type: str = None) -> LLMClientConfig:
        """Get the model config for the given model ID.

        Args:
            model_id: The model ID to get the config for.
            expected_type: Expected model type (e.g., "llm", "embedding"). If None, no type validation.

        Returns:
            The model config for the given model ID.

        Raises:
            ValueError: If the model ID is not supported or configuration is invalid.
        """
        if model_id in cls._configs:
            return cls._configs[model_id]

        # 优先读取动态配置文件
        model_config = dynamic_config.get_model_config(model_id)
        if model_config:
            # 使用动态配置
            logger.debug(f"使用动态配置创建模型客户端: {model_id}")
        else:
            # 兜底：从全局配置文件读取
            global_models_config = config.get("models", {})
            if model_id in global_models_config:
                model_config = global_models_config[model_id]
                logger.debug(f"使用全局配置创建模型客户端: {model_id}")
            else:
                raise ValueError(f"找不到模型 ID 为 {model_id} 的配置")

        # 验证模型类型（如果指定了预期类型）
        if expected_type and (not model_config or model_config.get("type") != expected_type):
            raise ValueError(f"模型 {model_id} 不是 {expected_type.upper()} 类型")

        # 检查必需字段并创建配置对象
        try:
            return LLMClientConfig(
                model_id=model_id,
                api_key=model_config["api_key"],
                api_base_url=model_config["api_base_url"],
                name=str(model_config["name"]),
                provider=model_config["provider"],
                supports_tool_use=model_config.get("supports_tool_use", False),
                max_output_tokens=model_config.get("max_output_tokens", 4 * 1024),
                max_context_tokens=model_config.get("max_context_tokens", 8 * 1024),
                temperature=model_config.get("temperature", 0.7),
                top_p=model_config.get("top_p", 1.0),
                type=model_config["type"],
            )
        except Exception as e:
            logger.error(f"创建配置失败: {e}")
            raise ValueError(f"无法为模型 {model_id} 创建配置")

    @classmethod
    def is_supports_tool_use(cls, model_id: str) -> bool:
        """Check if the model supports tool use.

        Args:
            model_id: The model ID to check.

        Returns:
            True if the model supports tool use, False otherwise.
        """
        llm_config = cls.get_model_config(model_id)
        return llm_config.supports_tool_use

    @classmethod
    def _create_openai_client(cls, llm_config: LLMClientConfig) -> Any:
        """创建 OpenAI 客户端。

        Args:
            llm_config: LLM 客户端配置。

        Returns:
            AsyncOpenAI 客户端实例。
        """
        default_headers = cls._build_default_headers()

        logger.debug(
            f"OpenAI 客户端配置 - base_url: {llm_config.api_base_url}, "
            f"headers: {list(default_headers.keys())}"
        )

        return AsyncOpenAI(
            api_key=llm_config.api_key,
            base_url=llm_config.api_base_url,
            timeout=DEFAULT_TIMEOUT,
            max_retries=MAX_RETRIES,
            default_headers=default_headers
        )

    @classmethod
    def _build_default_headers(cls) -> Dict[str, str]:
        """构建 OpenAI 客户端的默认请求头。

        包含以下请求头（按优先级顺序添加）：
        1. Magic-Authorization：Magic 认证头
        2. User-Authorization：用户授权转发（如果启用）
        3. metadata headers：业务元数据（如 Magic-Task-Id 等）
        4. custom headers：配置文件中的自定义请求头

        Returns:
            请求头字典。
        """
        headers: Dict[str, str] = {}

        # 1-2. 添加 Magic-Authorization 与 User-Authorization
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        # 3. 添加业务元数据请求头
        headers.update(MetadataUtil.get_llm_request_headers())

        # 4. 添加自定义请求头
        headers.update(cls._parse_custom_headers())

        return headers

    @classmethod
    def _parse_custom_headers(cls) -> Dict[str, str]:
        """解析配置文件中的自定义请求头。

        支持 dict 或 JSON 字符串格式。

        Returns:
            解析后的请求头字典，解析失败返回空字典。
        """
        try:
            raw = config.get("llm.custom_api_headers", {})

            if isinstance(raw, dict):
                return raw

            if isinstance(raw, str) and raw.strip():
                parsed = json.loads(raw)
                if isinstance(parsed, dict):
                    return parsed

        except json.JSONDecodeError as e:
            logger.warning(f"解析自定义 API 请求头 JSON 失败: {e}")
        except Exception as e:
            logger.warning(f"处理自定义 API 请求头配置时出错: {e}")

        return {}

    @classmethod
    def get_embedding_dimension(cls, model_id: str) -> int:
        """Get the embedding dimension for the given model ID.

        Args:
            model_id: The model ID to get the embedding dimension for.

        Returns:
            The embedding dimension for the given model ID.
        """
        # 加载模型配置
        llm_config = cls.get_model_config(model_id, "embedding")
        model_name = llm_config.name.lower()

        # 根据模型名称返回对应的向量维度
        if "text-embedding-3-large" in model_name:
            return 3072
        elif "text-embedding-3-small" in model_name:
            return 1536
        elif "text-embedding-ada-002" in model_name:
            return 1536
        else:
            # 默认维度为1536
            return 1536

    @classmethod
    def _check_and_handle_resource_limit_error(cls, exception: Exception, request_id: str) -> None:
        """Check and handle resource limit errors

        This method checks if the exception represents a resource limit error
        (insufficient points, consumption rounds limit, concurrency limit) and
        raises the appropriate ResourceLimitExceededException.

        Args:
            exception: The exception to check
            request_id: Request ID for logging

        Raises:
            ResourceLimitExceededException: If the exception represents a resource limit error
        """
        try:
            from agentlang.exceptions import ResourceLimitExceededException, APIErrorResponse

            # Extract error message from different exception types
            error_message = ""
            response = None

            # Handle different exception types
            if hasattr(exception, 'response'):
                response = exception.response

            if hasattr(exception, 'message'):
                error_message = str(exception.message)
            elif hasattr(exception, 'body'):
                error_message = str(exception.body)
            else:
                error_message = str(exception)

            # Parse API error response
            api_error = APIErrorResponse.from_response_or_message(response, error_message)

            # Check if this is a resource limit error
            if api_error.is_resource_limit_error():
                error_code = api_error.get_error_code()
                error_msg = api_error.get_error_message()

                logger.warning(f"[{request_id}] 检测到资源限制错误: 错误码={error_code}, 消息={error_msg}")

                # Create error details
                error_details = {
                    "error_code": error_code,
                    "error_message": error_msg,
                    "request_id": request_id,
                    "original_exception": str(exception)
                }

                # Raise the appropriate ResourceLimitExceededException
                raise ResourceLimitExceededException(
                    error_code=error_code,
                    error_details=error_details,
                    message=error_msg or ""
                )

        except ResourceLimitExceededException:
            # Re-raise the ResourceLimitExceededException
            raise
        except Exception as e:
            # If error handling itself fails, log and continue
            logger.debug(f"[{request_id}] 资源限制错误检查失败: {e}")
            # Don't raise here, let the original exception propagate

    @classmethod
    def _check_and_handle_context_window_error(cls, exception: Exception, request_id: str) -> None:
        """检查并标记上下文超长/请求体过大的不可恢复错误"""
        try:
            error_snapshot = LLMErrorClassifier.extract_snapshot(exception)

            if LLMErrorClassifier.is_context_window_exceeded(error_snapshot):
                logger.warning(
                    f"[{request_id}] 检测到上下文超长错误: status_code={error_snapshot.status_code}, message={error_snapshot.primary_message}"
                )
                LLMErrorClassifier.attach_snapshot(exception, error_snapshot)

        except Exception as e:
            logger.debug(f"[{request_id}] 上下文超长错误检查失败: {e}")
