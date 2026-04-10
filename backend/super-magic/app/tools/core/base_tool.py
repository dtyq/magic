"""工具基类模块

定义所有工具的基础类，提供共同功能和接口
"""

from app.i18n import i18n
import time
import os
import inspect
import re
import difflib
from abc import ABC, abstractmethod
from typing import Any, Dict, Generic, Optional, Type, TypeVar, ClassVar, get_args, get_origin, List, Tuple

from pydantic import ConfigDict, ValidationError

from agentlang.utils.snowflake import Snowflake
from agentlang.utils.annotation_remover import remove_developer_annotations
from agentlang.context.tool_context import ToolContext
from app.core.entity.message.server_message import ToolDetail
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.core.base_tool_params import BaseToolParams

# OpenTelemetry imports for tool execution tracking
try:
    from opentelemetry import trace
    from opentelemetry.trace import Status, StatusCode
    from app.infrastructure.observability.telemetry import is_telemetry_enabled, get_tracer
    from app.infrastructure.observability.constants import (
        ToolStatus,
        LogLevel,
        OpenTelemetryAttributes,
    )
except ImportError:
    # If OpenTelemetry is not installed, set to None
    # is_telemetry_enabled() will handle the check
    trace = None
    Status = None
    StatusCode = None
    is_telemetry_enabled = lambda: False
    get_tracer = None
    ToolStatus = None
    LogLevel = None
    OpenTelemetryAttributes = None

# 定义参数类型变量
T = TypeVar('T', bound=BaseToolParams)


class BaseTool(Generic[T], ABC):
    """工具基类

    所有工具的基类，定义共同接口和功能
    """
    # 工具元数据（类级别）
    name: ClassVar[str] = ""
    description: ClassVar[str] = ""
    params_class: ClassVar[Type[T]] = None

    # 配置项
    model_config = ConfigDict(arbitrary_types_allowed=True)

    def is_available(self) -> bool:
        """
        检查工具是否可用

        子类可以重写此方法以提供特定的可用性检查，
        例如检查所需的环境变量、API密钥或其他依赖是否已正确配置

        Returns:
            bool: 如果工具可用返回True，否则返回False
        """
        return True

    def get_horizon(self, tool_context: "ToolContext") -> "AgentHorizon":
        """从 tool_context 获取当前 agent 的 AgentHorizon 实例。"""
        from app.core.context.agent_context import AgentContext
        from app.core.horizon import AgentHorizon
        agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
        return agent_context.horizon

    def __init_subclass__(cls, **kwargs):
        """子类初始化时处理元数据

        在子类定义时自动执行，确定最终的类级别元数据
        """
        super().__init_subclass__(**kwargs)
        logger = get_logger(__name__)

        # 确保子类被标记为未注册
        cls._registered = False

        # ---------- 确定工具名称 (name) ----------
        if cls.__dict__.get('name'):  # 优先级1: 子类直接定义的name属性
            # 保持不变，使用子类定义的值
            pass
        elif hasattr(cls, '_initial_name') and cls._initial_name:  # 优先级2: 装饰器提供的name
            cls.name = cls._initial_name
        else:  # 优先级3: 从文件名自动推断
            try:
                # 获取子类的模块文件路径
                module = inspect.getmodule(cls)
                if module:
                    # 从模块文件路径中提取文件名（不含扩展名）
                    file_path = module.__file__
                    file_name = os.path.basename(file_path)
                    name_without_ext = os.path.splitext(file_name)[0]
                    # 转换为小写
                    generated_name = name_without_ext.lower()
                    logger.debug(f"从文件名 {file_name} 自动生成工具名: {generated_name}")
                    cls.name = generated_name
                else:
                    # 备用方案：从类名生成 (驼峰转下划线)
                    fallback_name = re.sub(r'(?<!^)(?=[A-Z])', '_', cls.__name__).lower()
                    logger.debug(f"无法获取模块文件名，从类名生成工具名: {fallback_name}")
                    cls.name = fallback_name
            except Exception as e:
                logger.warning(f"从文件名生成工具名失败: {e}")
                # 备用方案：使用类名
                cls.name = cls.__name__.lower()

        # ---------- 确定工具描述 (description) ----------
        if cls.__dict__.get('description'):  # 优先级1: 子类直接定义的description
            # 保持不变，使用子类定义的值
            pass
        elif hasattr(cls, '_initial_description') and cls._initial_description:  # 优先级2: 装饰器提供的description
            cls.description = cls._initial_description
        elif cls.__doc__:  # 优先级3: 从类的文档字符串提取
            # 使用inspect.cleandoc处理文档字符串
            cls.description = inspect.cleandoc(cls.__doc__)
        else:
            # 如果都没有，使用默认描述
            cls.description = f"Tool for {cls.name}"
            logger.warning(f"工具 {cls.name} 没有描述信息")

        # ---------- 确定参数类 (params_class) ----------
        if cls.__dict__.get('params_class'):  # 优先级1: 子类直接定义的params_class
            # 保持不变，使用子类定义的值
            pass
        elif hasattr(cls, '__orig_bases__'):  # 优先级2: 从泛型基类(Generic[T])提取参数类型
            for base in cls.__orig_bases__:
                if hasattr(base, '__origin__') and base.__origin__ is Generic:
                    # 检查是否为BaseTool[ParamType]形式
                    continue  # Generic基类不提取

                # 检查是否为像WorkspaceTool[ParamType]这样的特定泛型工具
                if hasattr(base, '__origin__') and hasattr(base, '__args__') and len(base.__args__) > 0:
                    origin = get_origin(base)
                    if origin is not None and issubclass(origin, BaseTool):
                        args = get_args(base)
                        if args and len(args) > 0 and isinstance(args[0], type):
                            cls.params_class = args[0]
                            logger.debug(f"从泛型基类 {base} 提取参数类: {cls.params_class}")
                            break

        if not cls.params_class and hasattr(cls, 'execute'):  # 优先级3: 从execute方法签名提取
            try:
                sig = inspect.signature(cls.execute)
                # 查找第3个参数(跳过self和tool_context)
                params = list(sig.parameters.values())
                if len(params) >= 3:
                    param = params[2]
                    # 检查参数是否有类型注解
                    if param.annotation != inspect.Parameter.empty:
                        cls.params_class = param.annotation
                        logger.debug(f"从execute方法签名提取参数类: {cls.params_class}")
            except Exception as e:
                logger.warning(f"从execute方法签名提取参数类失败: {e}")

        # 更新工厂注册用的内部键
        cls._tool_name = cls.name
        cls._tool_description = cls.description
        cls._params_class = cls.params_class

        # 确保工具被标记为工具
        if not hasattr(cls, '_is_tool'):
            cls._is_tool = True

        logger.debug(f"工具元数据确定: name={cls.name}, params_class={cls.params_class}")

    def __init__(self, **data):
        """初始化工具"""
        # 保存实例级别的覆盖值
        self._custom_name = data.get('name', None)
        self._custom_description = data.get('description', None)

        # 设置其他实例属性（跳过name和description）
        for key, value in data.items():
            if key not in ['name', 'description']:
                setattr(self, key, value)

    @abstractmethod
    async def execute(self, tool_context: ToolContext, params: T) -> ToolResult:
        """执行工具

        Args:
            tool_context: 工具上下文
            params: 工具参数

        Returns:
            ToolResult: 工具执行结果
        """
        pass

    def get_effective_name(self) -> str:
        """获取最终生效的工具名称

        优先级：实例自定义名称 > 类名称

        Returns:
            str: 工具名称
        """
        return self._custom_name if self._custom_name is not None else self.__class__.name

    def get_effective_description(self) -> str:
        """获取最终生效的工具描述

        优先级：实例自定义描述 > 类描述

        Returns:
            str: 工具描述
        """

        return self._custom_description if self._custom_description is not None else self.__class__.description

    def get_params_class(self) -> Type[T]:
        """获取工具参数类

        子类可以重写此方法来提供动态参数类

        Returns:
            Type[T]: 工具参数类
        """
        return self.__class__.params_class

    def should_trigger_events(self) -> bool:
        """获取工具是否应该触发事件

        默认返回 True，表示正常触发事件

        Returns:
            bool: 如果应该触发事件返回 True，否则返回 False
        """
        return True

    def _create_tool_span(self, tool_context: ToolContext, kwargs: Dict[str, Any]) -> Optional[Any]:
        """
        Create OpenTelemetry span for tool execution tracking

        Following Langfuse best practices for tool observation:
        - Marks observation as type "tool" for Langfuse dashboard
        - Adds metadata for success/failure tracking
        - Includes tool name, parameters, and context information

        Args:
            tool_context: Tool context
            kwargs: Tool parameters

        Returns:
            OpenTelemetry span or None if telemetry is disabled
        """
        if not is_telemetry_enabled():
            return None

        try:
            if trace is None or get_tracer is None:
                return None

            tracer = get_tracer(__name__)
            tool_name = self.get_effective_name()
            span = tracer.start_span(f"tool.{tool_name}")

            # Langfuse-specific: Mark as tool observation type
            # This enables Langfuse to identify this span as a tool call
            span.set_attribute("observation.type", "tool")
            span.set_attribute("langfuse.observation.type", "tool")

            # Set basic tool attributes
            span.set_attribute("tool.name", tool_name)
            span.set_attribute("tool.class", self.__class__.__name__)
            span.set_attribute("tool.module", self.__module__)

            # Add tool description for better visibility in Langfuse
            tool_description = self.get_effective_description()
            if tool_description:
                span.set_attribute("tool.description", tool_description[:500])  # Limit length

            # Add tool context information
            if tool_context:
                if hasattr(tool_context, 'tool_call_id') and tool_context.tool_call_id:
                    span.set_attribute("tool.call_id", str(tool_context.tool_call_id))
                if hasattr(tool_context, 'tool_name') and tool_context.tool_name:
                    span.set_attribute("tool.context_name", tool_context.tool_name)
                # Add user/session context if available
                if hasattr(tool_context, 'user_id') and tool_context.user_id:
                    span.set_attribute("user.id", str(tool_context.user_id))
                if hasattr(tool_context, 'session_id') and tool_context.session_id:
                    span.set_attribute("session.id", str(tool_context.session_id))

            # Add parameter information
            if kwargs:
                # Add parameter keys for tracking which params are used
                span.set_attribute("tool.params.keys", ", ".join(kwargs.keys()))
                span.set_attribute("tool.params.count", len(kwargs))

                # Add sanitized parameter values for debugging (limit size)
                for key, value in kwargs.items():
                    try:
                        # Convert to string and limit length to avoid large attributes
                        value_str = str(value)
                        if len(value_str) > 200:
                            value_str = value_str[:200] + "..."
                        span.set_attribute(f"tool.params.{key}", value_str)
                    except Exception:
                        # Skip parameters that can't be converted to string
                        pass

            # Initialize metadata for success/failure tracking
            span.set_attribute("tool.status", "running")
            span.set_attribute("tool.started", True)

            return span
        except Exception as e:
            # Don't fail tool execution if tracing fails
            logger = get_logger(__name__)
            logger.debug(f"Failed to create tool span: {e}")
            return None

    def _end_tool_span(self, span: Optional[Any], result: ToolResult, execution_time: float, error: Optional[Exception] = None) -> None:
        """
        End OpenTelemetry span and record tool execution result

        Following Langfuse best practices:
        - Records success/failure status for dashboard metrics
        - Adds level (INFO/ERROR) for filtering in Langfuse
        - Includes detailed error information for debugging

        Args:
            span: OpenTelemetry span to end
            result: Tool execution result
            execution_time: Tool execution time in seconds
            error: Exception if any occurred
        """
        if not span or Status is None or StatusCode is None:
            return

        try:
            # Set execution time
            if OpenTelemetryAttributes:
                span.set_attribute(OpenTelemetryAttributes.TOOL_EXECUTION_TIME, execution_time)
                span.set_attribute(OpenTelemetryAttributes.TOOL_EXECUTION_TIME_MS, int(execution_time * 1000))

            # Set result status and metadata
            if result:
                success = result.ok if hasattr(result, 'ok') else False
                if OpenTelemetryAttributes:
                    span.set_attribute(OpenTelemetryAttributes.TOOL_RESULT_OK, success)
                    span.set_attribute(OpenTelemetryAttributes.TOOL_SUCCESS, success)

                # Langfuse-specific: Set level for filtering
                # Level can be used to filter success/failure in Langfuse dashboard
                if success:
                    if LogLevel and OpenTelemetryAttributes:
                        span.set_attribute(OpenTelemetryAttributes.LEVEL, LogLevel.INFO.value)
                    if ToolStatus and OpenTelemetryAttributes:
                        span.set_attribute(OpenTelemetryAttributes.TOOL_STATUS, ToolStatus.SUCCESS.value)
                    span.set_status(Status(StatusCode.OK))

                    # Add result summary if available
                    if hasattr(result, 'content') and result.content and OpenTelemetryAttributes:
                        content_preview = str(result.content)[:500]  # Limit length
                        span.set_attribute(OpenTelemetryAttributes.TOOL_RESULT_PREVIEW, content_preview)
                else:
                    # Tool execution failed
                    if LogLevel and OpenTelemetryAttributes:
                        span.set_attribute(OpenTelemetryAttributes.LEVEL, LogLevel.ERROR.value)
                    if ToolStatus and OpenTelemetryAttributes:
                        span.set_attribute(OpenTelemetryAttributes.TOOL_STATUS, ToolStatus.FAILED.value)

                    # Extract error message
                    error_msg = getattr(result, 'content', '') or getattr(result, 'error', '') or "工具执行失败"
                    span.set_status(Status(StatusCode.ERROR, str(error_msg)))
                    if OpenTelemetryAttributes:
                        span.set_attribute(OpenTelemetryAttributes.ERROR, True)
                        span.set_attribute(OpenTelemetryAttributes.ERROR_MESSAGE, str(error_msg))
                        span.set_attribute(OpenTelemetryAttributes.ERROR_TYPE, "tool_execution_failed")

                        # Add detailed error information for debugging
                        span.set_attribute(OpenTelemetryAttributes.TOOL_ERROR_DETAILS, str(error_msg)[:1000])
            else:
                # No result returned
                if LogLevel and OpenTelemetryAttributes:
                    span.set_attribute(OpenTelemetryAttributes.LEVEL, LogLevel.ERROR.value)
                if ToolStatus and OpenTelemetryAttributes:
                    span.set_attribute(OpenTelemetryAttributes.TOOL_STATUS, ToolStatus.FAILED.value)
                if OpenTelemetryAttributes:
                    span.set_attribute(OpenTelemetryAttributes.TOOL_RESULT_OK, False)
                    span.set_attribute(OpenTelemetryAttributes.TOOL_SUCCESS, False)
                span.set_status(Status(StatusCode.ERROR, "工具返回空结果"))
                if OpenTelemetryAttributes:
                    span.set_attribute(OpenTelemetryAttributes.ERROR, True)
                    span.set_attribute(OpenTelemetryAttributes.ERROR_TYPE, "empty_result")
                    span.set_attribute(OpenTelemetryAttributes.ERROR_MESSAGE, "工具返回空结果")

            # Record exception if any
            if error:
                if LogLevel and OpenTelemetryAttributes:
                    span.set_attribute(OpenTelemetryAttributes.LEVEL, LogLevel.ERROR.value)
                if ToolStatus and OpenTelemetryAttributes:
                    span.set_attribute(OpenTelemetryAttributes.TOOL_STATUS, ToolStatus.EXCEPTION.value)
                if OpenTelemetryAttributes:
                    span.set_attribute(OpenTelemetryAttributes.TOOL_SUCCESS, False)
                span.set_status(Status(StatusCode.ERROR, str(error)))
                if OpenTelemetryAttributes:
                    span.set_attribute(OpenTelemetryAttributes.ERROR, True)
                    span.set_attribute(OpenTelemetryAttributes.ERROR_TYPE, type(error).__name__)
                    span.set_attribute(OpenTelemetryAttributes.ERROR_MESSAGE, str(error))
                span.record_exception(error)

            # Add completion timestamp
            import time
            if OpenTelemetryAttributes:
                span.set_attribute(OpenTelemetryAttributes.TOOL_COMPLETED_AT, int(time.time() * 1000))

            span.end()
        except Exception as e:
            # Don't fail tool execution if tracing fails
            logger = get_logger(__name__)
            logger.warning("Failed to end tool span", exc_info=True)

    async def __call__(self, tool_context: ToolContext, **kwargs) -> ToolResult:
        """执行工具

        这是工具调用的主要入口点，支持通过参数字典调用工具

        此方法会自动完成以下工作：
        1. 参数验证和转换：将传入的字典参数转换为工具需要的Pydantic模型
        2. 性能计时：记录工具执行时间
        3. 结果处理：确保结果包含必要字段
        4. 错误处理：通过自定义错误消息机制提供更友好的错误提示
        5. 追踪：自动创建 OpenTelemetry span 追踪工具执行

        Args:
            tool_context: 工具上下文
            **kwargs: 参数字典

        Returns:
            ToolResult: 工具执行结果
        """
        start_time = time.time()
        logger = get_logger(__name__)

        # Create tracing span
        span = self._create_tool_span(tool_context, kwargs)

        try:
            # 获取参数类
            params_class = self.get_params_class()

            # 没有参数模型类型的工具是无效的
            if not params_class:
                error_msg = f"工具 {self.get_effective_name()} 没有定义参数模型类型"
                logger.error(error_msg)
                result = ToolResult.error(error_msg, name=str(self.get_effective_name()))
                execution_time = time.time() - start_time
                self._end_tool_span(span, result, execution_time)
                return result

            # 尝试根据参数字典创建参数模型实例
            try:
                params = params_class(**kwargs)
            except ValidationError as e:
                # 参数验证失败处理
                error_details = e.errors()
                logger.debug(f"验证错误详情: {error_details}")

                # 检查是否有自定义错误消息
                # 此处实现了错误回调机制，允许工具参数类为特定字段和错误类型提供自定义错误消息
                for err in error_details:
                    if err.get("loc"):
                        field_name = err.get("loc")[0]
                        error_type = err.get("type")

                        # 调用参数类的自定义错误消息方法
                        custom_error = params_class.get_custom_error_message(field_name, error_type)
                        if custom_error:
                            logger.info(f"使用自定义错误消息: field={field_name}, type={error_type}")
                            result = ToolResult.error(custom_error, name=str(self.get_effective_name()))
                            execution_time = time.time() - start_time
                            self._end_tool_span(span, result, execution_time, e)
                            return result

                # 如果没有自定义错误消息，使用友好的错误处理逻辑
                # 判断错误类型并生成相应的友好错误消息
                pretty_error_msg = self._generate_friendly_validation_error(error_details, str(self.get_effective_name()))
                result = ToolResult.error(pretty_error_msg, name=str(self.get_effective_name()))
                execution_time = time.time() - start_time
                self._end_tool_span(span, result, execution_time, e)
                return result
            except Exception as e:
                # 其他类型的异常
                logger.error(f"参数验证失败: {e!s}")
                pretty_error = f"工具 '{self.get_effective_name()}' 的参数验证失败，请检查输入参数的格式是否正确"
                result = ToolResult.error(pretty_error, name=str(self.get_effective_name()))
                execution_time = time.time() - start_time
                self._end_tool_span(span, result, execution_time, e)
                return result

            # 执行工具
            execution_error = None
            try:
                result = await self.execute(tool_context, params)
            except Exception as e:
                logger.error(f"工具 {self.get_effective_name()} 执行出错: {e}", exc_info=True)
                execution_error = e
                # 捕获执行错误并返回错误结果
                result = ToolResult.error(f"工具执行失败: {e!s}", name=str(self.get_effective_name()))

            # 设置执行时间和名称
            execution_time = time.time() - start_time
            result.execution_time = execution_time
            result.name = str(self.get_effective_name())

            # End tracing span
            self._end_tool_span(span, result, execution_time, execution_error)

            return result

        except Exception as e:
            # Catch any unexpected errors
            execution_time = time.time() - start_time
            result = ToolResult.error(f"工具调用异常: {e!s}", name=str(self.get_effective_name()))
            result.execution_time = execution_time
            self._end_tool_span(span, result, execution_time, e)
            return result

    def _detect_json_serialization_error(self, input_value: Any, received_type: str, err_type: str) -> Optional[str]:
        """检测 JSON 序列化错误（通用逻辑）

        识别 AI 把 JSON 结构序列化成字符串的常见错误模式

        Args:
            input_value: 输入的值
            received_type: 接收到的类型
            err_type: 错误类型（如 list_type, dict_type, int_type 等）

        Returns:
            如果检测到序列化错误，返回友好提示；否则返回 None
        """
        # 只处理类型是 str 的情况（把其他类型序列化成字符串）
        if received_type != "str":
            return None

        input_str = str(input_value).strip()
        if not input_str:
            return None

        patterns = {
            "list": {
                "prefixes": ("[", "'[", '"['),
                "type_names": ("list_type", "array"),
                "correct_example": '["item1", "item2"]',
                "description": "array"
            },
            "dict": {
                "prefixes": ("{", "'{", '"{'),
                "type_names": ("dict_type", "object", "model"),
                "correct_example": '{"key": "value"}',
                "description": "object"
            },
            "int": {
                "check": lambda s: s.isdigit() or (s.startswith("-") and s[1:].isdigit()),
                "type_names": ("int_type", "integer"),
                "correct_example": '123',
                "description": "integer"
            },
            "float": {
                "check": lambda s: s.replace(".", "", 1).replace("-", "", 1).isdigit(),
                "type_names": ("float_type", "number"),
                "correct_example": '123.45',
                "description": "float"
            },
            "bool": {
                "check": lambda s: s.lower() in ("true", "false"),
                "type_names": ("bool_type", "boolean"),
                "correct_example": 'true or false',
                "description": "boolean"
            }
        }

        # 遍历模式进行匹配
        for pattern_name, pattern_config in patterns.items():
            matched = False

            # 检查前缀匹配（用于 list, dict）
            if "prefixes" in pattern_config:
                if any(input_str.startswith(prefix) for prefix in pattern_config["prefixes"]):
                    matched = True

            # 检查自定义匹配函数（用于 int, float, bool）
            elif "check" in pattern_config:
                try:
                    if pattern_config["check"](input_str):
                        matched = True
                except:
                    pass

            # 如果匹配，且错误类型也对应，生成提示
            if matched and any(type_name in err_type for type_name in pattern_config["type_names"]):
                desc = pattern_config["description"]
                example = pattern_config["correct_example"]

                # 截断过长的输入值
                display_value = input_str if len(input_str) <= 50 else input_str[:50] + "..."

                return (
                    f"\nYou passed a string that looks like a serialized {desc}."
                    f"\n  Got: \"{display_value}\""
                    f"\n  Expected: raw JSON {desc}, e.g. {example}"
                    f"\n  Do NOT stringify JSON values — pass them directly."
                )

        return None

    def _generate_type_hint(self, err_type: str, expected_type: str) -> str:
        """根据类型错误生成通用提示

        Args:
            err_type: 错误类型
            expected_type: 期望的类型

        Returns:
            类型提示文本
        """
        type_hints = {
            "list": 'Expected array, e.g. ["value1", "value2"]',
            "array": 'Expected array, e.g. ["value1", "value2"]',
            "dict": 'Expected object, e.g. {"key": "value"}',
            "object": 'Expected object, e.g. {"key": "value"}',
            "int": 'Expected integer, e.g. 123',
            "integer": 'Expected integer, e.g. 123',
            "float": 'Expected number, e.g. 123.45',
            "number": 'Expected number, e.g. 123 or 123.45',
            "bool": 'Expected boolean, e.g. true or false',
            "boolean": 'Expected boolean, e.g. true or false',
            "string": 'Expected string, e.g. "text"',
            "str": 'Expected string, e.g. "text"',
        }

        for key, hint in type_hints.items():
            if key in err_type.lower() or key in expected_type.lower():
                return f"\n{hint}"

        return f"\nExpected type: {expected_type}"

    def _find_similar_param_names(self, wrong_param: str, valid_params: List[str], threshold: float = 0.6) -> List[Tuple[str, float]]:
        """查找相似的参数名（模糊匹配）

        效果：当 AI 传入 'file_path' 但工具只有 'target_file' 时，能识别出相似度 73%，提示 AI 可能写错了
        场景：工具更新后参数名变更，AI 上下文中还存着旧参数名，通过相似度匹配帮助 AI 快速纠正

        Args:
            wrong_param: AI 传入的错误参数名
            valid_params: 工具实际定义的有效参数名列表
            threshold: 相似度阈值 0.6（60%），低于此值不认为相似

        Returns:
            最多 3 个最相似参数的 (参数名, 相似度) 列表，按相似度降序排列
        """
        if not wrong_param or not valid_params:
            return []

        similar_params = []
        for valid_param in valid_params:
            # 使用编辑距离算法计算相似度，不区分大小写
            similarity = difflib.SequenceMatcher(None, wrong_param.lower(), valid_param.lower()).ratio()

            if similarity >= threshold:
                similar_params.append((valid_param, similarity))

        # 返回最相似的前 3 个，避免输出过多干扰信息
        similar_params.sort(key=lambda x: x[1], reverse=True)
        return similar_params[:3]

    def _generate_friendly_validation_error(self, error_details, tool_name: str) -> str:
        """生成友好的验证错误消息

        Args:
            error_details: pydantic验证错误详情
            tool_name: 工具名称

        Returns:
            str: 友好的错误消息
        """
        logger = get_logger(__name__)

        # 提取工具的所有有效参数名，用于后续检测未知参数时进行相似度匹配
        # 效果：AI 传入未定义参数时，能提示"你是否想用 'xxx'？"而非简单报错
        valid_params = []
        try:
            params_class = self.get_params_class()
            if params_class:
                schema = params_class.model_json_schema_clean()
                valid_params = list(schema.get('properties', {}).keys())
        except Exception as e:
            logger.debug(f"获取有效参数名列表失败: {e}")

        missing_fields = []
        type_errors = []
        unknown_param_errors = []
        other_errors = []

        for err in error_details:
            err_type = err.get("type", "")
            field_path = ".".join(str(loc) for loc in err.get("loc", []))

            if err_type == "missing":
                missing_fields.append(field_path)
            elif err_type == "extra_forbidden":
                wrong_param = field_path
                similar_params = self._find_similar_param_names(wrong_param, valid_params)

                error_msg = f"Unknown parameter '{wrong_param}'"
                if similar_params:
                    error_msg += "\nDid you mean:"
                    for param_name, similarity in similar_params:
                        error_msg += f"\n  - '{param_name}' ({int(similarity * 100)}% match)"
                else:
                    error_msg += "\nThis parameter is not defined. Check spelling or tool documentation."

                unknown_param_errors.append(error_msg)
            elif "type" in err_type:
                expected_type = "valid value"
                if "expected_type" in err.get("ctx", {}):
                    expected_type = err["ctx"]["expected_type"]
                elif "expected" in err.get("ctx", {}):
                    expected_type = err["ctx"]["expected"]

                received_type = "invalid type"
                input_value = err.get("input", "")
                if "input_type" in err.get("ctx", {}):
                    received_type = err["ctx"]["input_type"]
                elif "received" in err.get("ctx", {}):
                    received_type = str(type(err["ctx"]["received"]).__name__)

                error_msg = f"Parameter '{field_path}': expected {expected_type}, got {received_type}"

                serialization_hint = self._detect_json_serialization_error(input_value, received_type, err_type)
                if serialization_hint:
                    error_msg += serialization_hint
                else:
                    type_hint = self._generate_type_hint(err_type, expected_type)
                    error_msg += type_hint

                type_errors.append(error_msg)
            else:
                msg = err.get("msg", "unknown error")
                other_errors.append(f"Parameter '{field_path}': {msg}")

        pretty_msg_parts = []

        if missing_fields:
            fields_str = ", ".join(missing_fields)
            pretty_msg_parts.append(f"Missing required parameter(s): {fields_str}")

        if unknown_param_errors:
            pretty_msg_parts.append("\n\n".join(unknown_param_errors))

        if type_errors:
            pretty_msg_parts.append("\n".join(type_errors))

        if other_errors:
            pretty_msg_parts.append("\n".join(other_errors))

        if not pretty_msg_parts:
            return f"Tool '{tool_name}' parameter validation failed."

        result = "Tool call failed\n\n" + "\n\n".join(pretty_msg_parts)
        result += (
            "\n\nIf arguments were too long and got truncated, "
            "break the work into smaller pieces."
        )

        return result

    def to_param(self) -> Dict:
        """转换工具为函数调用格式

        Returns:
            Dict: 函数调用格式的工具描述
        """
        logger = get_logger(__name__)

        # 注意：移除了这里的 "additionalProperties": False
        parameters = {
            "type": "object",
            "properties": {},
            "required": [],
        }

        params_class = self.get_params_class()
        if params_class:
            try:
                # 使用 params_class 的清理方法生成 schema
                schema = params_class.model_json_schema_clean()

                # 复制 properties 和 required（$defs 已经被展开为内联定义）
                if 'properties' in schema:
                    parameters['properties'] = schema['properties']

                if 'required' in schema:
                    parameters['required'] = schema['required']
                else:
                    # 如果原始 schema 没有 required，则默认所有非 Optional 字段为必填
                    if 'properties' in parameters:
                         parameters['required'] = list(parameters['properties'].keys())

                # 全局参数已删除，不再需要强制必填验证

            except Exception as e:
                logger.error(f"生成工具参数模式时出错: {e!s}", exc_info=True)

        # 如果清理后 properties 为空，也移除它
        if not parameters['properties']:
            parameters.pop('properties')
            # 如果 properties 为空，required 也应该为空
            parameters.pop('required', None)

        # 获取最终生效的工具名称和描述
        effective_name = self.get_effective_name()
        effective_description = self.get_effective_description()

        # 确保是字符串
        if not isinstance(effective_name, str):
            effective_name = str(effective_name)
        if not isinstance(effective_description, str):
            effective_description = str(effective_description)

        result = {
            "type": "function",
            "function": {
                "name": effective_name,
                "description": effective_description,
                "parameters": parameters,
            },
        }

        # 递归移除人类注解（唯一过滤出口）
        self._remove_annotations_recursive(result)
        return result

    @staticmethod
    def _remove_annotations_recursive(obj):
        """递归移除对象中所有字符串的开发者注解（唯一过滤点）"""
        if isinstance(obj, dict):
            for key, value in obj.items():
                if isinstance(value, str):
                    obj[key] = remove_developer_annotations(value)
                elif isinstance(value, (dict, list)):
                    BaseTool._remove_annotations_recursive(value)
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                if isinstance(item, str):
                    obj[i] = remove_developer_annotations(item)
                elif isinstance(item, (dict, list)):
                    BaseTool._remove_annotations_recursive(item)

    def generate_message_id(self) -> str:
        """生成消息ID

        使用默认方式生成
        """
        # 使用雪花算法生成ID
        snowflake = Snowflake.create_default()
        return str(snowflake.get_id())

    def get_prompt_hint(self) -> str:
        """
        获取工具想要附加到主 Prompt 的提示信息。

        子类可以覆盖此方法以提供特定于工具的上下文或指令，
        这些信息将在 Agent 初始化时被追加到基础 Prompt 中。

        Returns:
            str: 要追加到 Prompt 的提示字符串，默认为空。
        """
        return ""

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """
        获取备注内容，子类可重写

        Args:
            result: 工具执行结果
            arguments: 执行参数

        Returns:
            str: 备注内容
        """
        return ""

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """
        根据工具执行结果获取对应的ToolDetail

        每个工具类可以重写此方法，提供适合该工具的ToolDetail
        可以返回None表示没有需要展示的工具详情

        Args:
            tool_context: 工具上下文
            result: 工具执行的结果
            arguments: 其他额外参数字典，用于构建特定类型的详情

        Returns:
            Optional[ToolDetail]: 工具详情对象，可能为None
        """
        # 默认实现：返回None
        return None

    async def get_before_tool_detail(self, tool_context: ToolContext, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """
        获取工具调用前的详细信息

        每个工具类可以重写此方法，提供适合该工具的ToolDetail
        可以返回None表示没有需要展示的工具详情

        Args:
            tool_context: 工具上下文
            arguments: 工具执行的参数字典

        Returns:
            Optional[ToolDetail]: 工具详情对象，可能为None
        """
        # 默认实现：返回None
        return None

    async def get_before_tool_call_friendly_content(self, tool_context: ToolContext, arguments: Dict[str, Any] = None) -> str:
        """获取工具调用前的友好内容"""
        return ""  # explanation 参数已删除，返回空字符串

    async def get_after_tool_call_friendly_content(self, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> str:
        """
        获取工具调用后的友好内容

        Args:
            tool_context: 工具上下文
            result: 工具执行结果
            execution_time: 执行耗时
            arguments: 执行参数

        Returns:
            str: 友好的执行结果消息
        """
        return ""

    async def get_before_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None) -> Dict:
        """
        获取工具调用前的友好动作和备注

        Args:
            tool_name: 工具名称
            tool_context: 工具上下文
            arguments: 执行参数

        Returns:
            Dict: 包含action、remark和tool_name的字典
        """
        action = i18n.translate(self.name, category="tool.actions")
        remark = ""  # 工具调用前通常没有详细的remark

        return {
            "action": action,
            "remark": remark,
            "tool_name": tool_name
        }

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """
        获取工具调用后的友好动作和备注

        Args:
            tool_name: 工具名称
            tool_context: 工具上下文
            result: 工具执行结果
            execution_time: 执行耗时
            arguments: 执行参数

        Returns:
            Dict: 包含action和remark的字典
        """
        if result.ok:
            action = i18n.translate(self.name, category="tool.actions")
            remark = self._get_remark_content(result, arguments)
        else:
            action = i18n.translate(self.name, category="tool.actions")
            remark = i18n.translate("tool.error", category="tool.messages", error=result.content)

        return {
            "action": action,
            "remark": remark
        }
