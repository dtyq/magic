"""
Token使用统计系统的核心数据模型

定义强类型数据对象，用于在系统中传递token使用相关信息

## 系统级别的 Total Tokens 计算标准 ##

整个系统统一使用以下算法计算 total_tokens：

    total_tokens = input_tokens + output_tokens + cached_tokens + cache_write_tokens

这个算法在以下模块中被实现：
- models.py: OpenAIParser、SuperMagicParser、AnthropicParser 解析API响应时计算（按优先级排列）
- tracker.py: TokenUsageTracker 累加使用量时计算
- report.py: TokenUsageReport 反序列化和累加报告时计算

该算法确保了所有涉及token处理的情况都被完整统计，包括缓存相关的token。
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Protocol, Type, ClassVar
from datetime import datetime

from agentlang.logger import get_logger

logger = get_logger(__name__)


@dataclass
class InputTokensDetails:
    """输入tokens的详细信息"""
    cached_tokens: Optional[int] = 0  # 从缓存中读取的token数
    cache_write_tokens: Optional[int] = 0  # 写入缓存的token数

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典，只包含非零值"""
        data = {k: v for k, v in self.__dict__.items() if v is not None}
        return data if any(v != 0 for v in data.values() if isinstance(v, (int, float))) else None

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]) -> Optional['InputTokensDetails']:
        """从字典创建对象，如果全为0则返回None"""
        if not data:
            return None

        # 检查是否所有值都是0或None
        all_zero_or_none = True
        for value in data.values():
            if value is not None and value != 0:
                all_zero_or_none = False
                break

        if all_zero_or_none:
            return None

        return cls(
            cached_tokens=data.get("cached_tokens", 0),
            cache_write_tokens=data.get("cache_write_tokens", 0)
        )


@dataclass
class OutputTokensDetails:
    """输出tokens的详细信息"""
    reasoning_tokens: Optional[int] = 0  # 推理使用的token数

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典，只包含非零值"""
        data = {k: v for k, v in self.__dict__.items() if v is not None}
        return data if any(v != 0 for v in data.values() if isinstance(v, (int, float))) else None

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]) -> Optional['OutputTokensDetails']:
        """从字典创建对象，如果全为0则返回None"""
        if not data:
            return None

        # 检查是否所有值都是0或None
        all_zero_or_none = True
        for value in data.values():
            if value is not None and value != 0:
                all_zero_or_none = False
                break

        if all_zero_or_none:
            return None

        return cls(
            reasoning_tokens=data.get("reasoning_tokens", 0)
        )


class TokenUsageParser(Protocol):
    """Token使用量解析器协议

    定义解析不同API响应格式的接口，新的解析器只需实现这个协议
    """
    @classmethod
    def can_parse(cls, response: Any) -> bool:
        """
        检查是否可以解析特定响应格式

        Args:
            response: API响应

        Returns:
            bool: 是否可以解析
        """
        ...

    @classmethod
    def parse(cls, response: Any) -> 'TokenUsage':
        """
        解析响应，提取token使用信息

        Args:
            response: API响应

        Returns:
            TokenUsage: 解析后的token使用对象
        """
        ...


@dataclass
class TokenUsage:
    """基本token使用量数据

    这是系统中用于统计和记录LLM API调用token使用情况的核心数据结构。

    ## Total Tokens 计算算法 ##

    total_tokens 的计算包含所有相关的token使用量：

    total_tokens = input_tokens + output_tokens + cached_tokens + cache_write_tokens

    详细说明：
    - input_tokens: 输入到LLM的token数量（新内容）
    - output_tokens: LLM生成的输出token数量
    - cached_tokens: 从缓存中读取的token数量（input_tokens_details.cached_tokens）
    - cache_write_tokens: 写入缓存的token数量（input_tokens_details.cache_write_tokens）

    这种计算方式确保了统计的完整性，包含了所有实际处理的token，
    无论是新处理的还是缓存相关的token。

    ## 字段说明 ##
    """
    input_tokens: int
    output_tokens: int
    total_tokens: int
    input_tokens_details: Optional[InputTokensDetails] = None
    output_tokens_details: Optional[OutputTokensDetails] = None
    model_id: Optional[str] = None  # Added field for model ID
    model_name: Optional[str] = None  # Added field for model name

    # 注册的解析器，按优先级顺序排列
    _parsers: ClassVar[List[Type[TokenUsageParser]]] = []

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        data = {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
        }
        if self.model_id:
            data["model_id"] = self.model_id
        if self.model_name:
            data["model_name"] = self.model_name

        # 只有当details对象存在且其to_dict()结果不为None时才加入
        if self.input_tokens_details:
            input_details_dict = self.input_tokens_details.to_dict()
            if input_details_dict:
                data["input_tokens_details"] = input_details_dict

        if self.output_tokens_details:
            output_details_dict = self.output_tokens_details.to_dict()
            if output_details_dict:
                data["output_tokens_details"] = output_details_dict

        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TokenUsage':
        """
        从字典创建对象，智能检测并处理多种数据格式

        这个方法会自动检测数据格式：
        - 如果是标准格式（input_tokens/output_tokens），直接创建对象
        - 如果是 LLM API 格式（如 OpenAI 的 prompt_tokens/completion_tokens），
          会自动调用 from_response 进行解析

        这种设计提供了最大的健壮性和灵活性，无论数据来源如何都能正确处理。

        Args:
            data: 包含 token 使用信息的字典

        Returns:
            TokenUsage: 标准化的 TokenUsage 对象
        """
        if not data:
            return cls(input_tokens=0, output_tokens=0, total_tokens=0)

        # 智能检测数据格式：
        # 1. 如果有 OpenAI 特征字段（prompt_tokens/completion_tokens），且没有标准格式的完整字段，使用 from_response
        # 2. 否则使用标准格式直接创建

        has_openai_fields = ("prompt_tokens" in data or "completion_tokens" in data)
        has_standard_format = (
            "input_tokens" in data and
            "output_tokens" in data and
            "total_tokens" in data  # 标准格式应该有 total_tokens
        )

        # 如果检测到 OpenAI 格式，且不是完整的标准格式，使用 from_response
        if has_openai_fields and not has_standard_format:
            logger.debug("检测到 OpenAI API 格式数据，使用 from_response 解析")
            return cls.from_response(data)

        # 标准格式，直接创建对象
        return cls(
            input_tokens=data.get("input_tokens", 0),
            output_tokens=data.get("output_tokens", 0),
            total_tokens=data.get("total_tokens", 0),
            input_tokens_details=InputTokensDetails.from_dict(data.get("input_tokens_details")),
            output_tokens_details=OutputTokensDetails.from_dict(data.get("output_tokens_details")),
            model_id=data.get("model_id"),
            model_name=data.get("model_name"),
        )

    @classmethod
    def register_parser(cls, parser: Type[TokenUsageParser]) -> None:
        """
        注册新的解析器

        Args:
            parser: 解析器类，必须实现TokenUsageParser协议
        """
        if parser not in cls._parsers:
            # 检查parser是否实现了必要的方法
            if not (hasattr(parser, 'can_parse') and hasattr(parser, 'parse')):
                raise ValueError(f"解析器 {parser.__name__} 必须实现 can_parse 和 parse 方法")
            cls._parsers.append(parser)
            logger.debug(f"已注册token使用解析器: {parser.__name__}")

    @classmethod
    def from_response(cls, response_usage: Any) -> 'TokenUsage':
        """
        从API响应中提取token使用数据并创建TokenUsage对象。
        尝试所有注册的解析器，直到找到适合的解析器。

        Args:
            response_usage: API响应中的usage部分

        Returns:
            TokenUsage: 标准化的TokenUsage对象

        Note:
            如果response_usage是字典且包含model_id和model_name字段，
            这些字段会被保留到返回的TokenUsage对象中。
            这提供了额外的健壮性，即使误用此方法也不会丢失模型信息。
        """
        if not response_usage:
            return cls(input_tokens=0, output_tokens=0, total_tokens=0)

        # 如果是字典，提前提取model_id和model_name（如果存在）
        model_id = None
        model_name = None
        if isinstance(response_usage, dict):
            model_id = response_usage.get("model_id")
            model_name = response_usage.get("model_name")

        # 尝试已注册的所有解析器
        for parser in cls._parsers:
            try:
                if parser.can_parse(response_usage):
                    token_usage = parser.parse(response_usage)
                    logger.debug(f"使用 {parser.__name__} 解析token信息: input={token_usage.input_tokens}, output={token_usage.output_tokens}, total={token_usage.total_tokens}")

                    # 如果原始数据中有model_id和model_name，且解析后的对象中没有，则补充
                    if model_id and not token_usage.model_id:
                        token_usage.model_id = model_id
                    if model_name and not token_usage.model_name:
                        token_usage.model_name = model_name

                    return token_usage
            except Exception as e:
                logger.warning(f"{parser.__name__} 解析失败: {e}")
                continue

        # 如果没有合适的解析器，抛出致命错误，避免计费异常
        logger.error(f"致命错误：没有找到合适的token usage解析器，response_usage: {response_usage}")
        raise ValueError(f"无法解析token usage数据，可能导致计费异常。response_usage类型: {type(response_usage)}, 内容: {str(response_usage)[:500]}")


class OpenAIParser:
    """
    OpenAI API专用解析器，处理prompt_tokens/completion_tokens格式

    OpenAI的prompt_tokens包含了所有缓存相关tokens：
    - prompt_tokens = input_tokens + cached_tokens + cache_write_tokens
    - 需要转换为标准的计费格式：
    - input_tokens: 不包含任何缓存的纯新输入tokens
        计算公式：input_tokens = prompt_tokens - cached_tokens - cache_write_tokens
    - output_tokens: LLM生成的输出token数量
    - cached_tokens: 从缓存中读取的token数量（input_tokens_details.cached_tokens）
    - cache_write_tokens: 写入缓存的token数量（input_tokens_details.cache_write_tokens）
    """

    @classmethod
    def can_parse(cls, response: Any) -> bool:
        """
        检查是否为OpenAI格式
        OpenAI特征：有prompt_tokens字段
        """
        if isinstance(response, dict):
            return "prompt_tokens" in response
        return hasattr(response, "prompt_tokens")

    @staticmethod
    def get_value(obj: Any, key: str, default: Any = 0) -> Any:
        """从对象或字典中获取值"""
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    @classmethod
    def parse(cls, response: Any) -> 'TokenUsage':
        """
        解析OpenAI格式响应

        注意：OpenAI的prompt_tokens现在包含了所有缓存相关tokens：
        prompt_tokens = actual_input_tokens + cached_tokens + cache_write_tokens

        需要转换为我们的SuperMagic Model格式：
        - input_tokens: 不包含任何缓存的纯新输入tokens
        - cached_tokens/cache_write_tokens: 在input_tokens_details中单独记录
        """
        try:
            # 提取OpenAI的原始数据
            prompt_tokens = cls.get_value(response, "prompt_tokens", 0) or 0  # 包含缓存的总输入tokens
            output_tokens = cls.get_value(response, "completion_tokens", 0) or 0
            total_tokens = cls.get_value(response, "total_tokens", 0) or 0

            # 处理OpenAI的输入详情（嵌套在prompt_tokens_details中）
            parsed_input_details: Optional[InputTokensDetails] = None
            cached_tokens = 0
            cache_write_tokens = 0
            prompt_details = cls.get_value(response, "prompt_tokens_details", None)

            if prompt_details:
                # 提取缓存tokens
                cached_tokens = cls.get_value(prompt_details, "cached_tokens", 0) or 0
                if cached_tokens == 0:
                    cached_tokens = cls.get_value(prompt_details, "cache_read_input_tokens", 0) or 0

                cache_write_tokens = cls.get_value(prompt_details, "cache_write_input_tokens", 0) or 0

                # 创建缓存详情对象
                if cached_tokens > 0 or cache_write_tokens > 0:
                    parsed_input_details = InputTokensDetails(
                        cached_tokens=cached_tokens,
                        cache_write_tokens=cache_write_tokens
                    )

                        # 重要：计算实际的input_tokens（不包含任何缓存tokens）
            # prompt_tokens = actual_input_tokens + cached_tokens + cache_write_tokens
            # 所以 actual_input_tokens = prompt_tokens - cached_tokens - cache_write_tokens
            actual_input_tokens = prompt_tokens - cached_tokens - cache_write_tokens

            # 确保不为负数
            if actual_input_tokens < 0:
                logger.warning(f"OpenAI解析器：calculated input_tokens({actual_input_tokens}) < 0, "
                             f"prompt_tokens={prompt_tokens}, cached_tokens={cached_tokens}, cache_write_tokens={cache_write_tokens}")
                actual_input_tokens = 0

            # 重新计算total_tokens（按我们的模型算法）
            if total_tokens == 0:
                total_tokens = actual_input_tokens + output_tokens + cached_tokens + cache_write_tokens

            # 处理OpenAI的输出详情
            parsed_output_details: Optional[OutputTokensDetails] = None
            completion_details = cls.get_value(response, "completion_tokens_details", None)

            if completion_details:
                reasoning_tokens = cls.get_value(completion_details, "reasoning_tokens", 0) or 0
                if reasoning_tokens > 0:
                    parsed_output_details = OutputTokensDetails(reasoning_tokens=reasoning_tokens)

            return TokenUsage(
                input_tokens=actual_input_tokens,  # 使用计算后的实际input_tokens
                output_tokens=output_tokens,
                total_tokens=total_tokens,
                input_tokens_details=parsed_input_details,
                output_tokens_details=parsed_output_details
            )

        except Exception as e:
            logger.error(f"OpenAI解析器解析失败: {e}")
            return TokenUsage(
                input_tokens=0,
                output_tokens=0,
                total_tokens=0,
                input_tokens_details=None,
                output_tokens_details=None
            )


class AnthropicParser:
    """
    Anthropic API专用解析器，处理input_tokens/output_tokens格式

    Anthropic格式特点：
    - 使用input_tokens/output_tokens作为基础字段
    - 缓存字段使用cache_read_input_tokens/cache_creation_input_tokens（Anthropic原生命名）
    - 缓存字段是平级的，不嵌套在details结构中
    - 通常不提供total_tokens，需要计算得出
    """

    @classmethod
    def can_parse(cls, response: Any) -> bool:
        """
        检查是否为Anthropic格式
        特征：有input_tokens且使用cache_read_input_tokens/cache_creation_input_tokens缓存字段
        """
        if isinstance(response, dict):
            # 必须有input_tokens且不是OpenAI格式
            if "input_tokens" not in response or "prompt_tokens" in response:
                return False

            # 检查是否有Anthropic特有的缓存字段
            has_anthropic_cache = ("cache_read_input_tokens" in response or
                                 "cache_creation_input_tokens" in response)
            return has_anthropic_cache

        # 对象格式检查
        if not (hasattr(response, "input_tokens") and not hasattr(response, "prompt_tokens")):
            return False

        return (hasattr(response, "cache_read_input_tokens") or
                hasattr(response, "cache_creation_input_tokens"))

    @staticmethod
    def get_value(obj: Any, key: str, default: Any = 0) -> Any:
        """从对象或字典中获取值"""
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    @classmethod
    def parse(cls, response: Any) -> 'TokenUsage':
        """解析Anthropic格式响应"""
        try:
            # 提取基本token统计信息 - Anthropic格式
            input_tokens = cls.get_value(response, "input_tokens", 0) or 0
            output_tokens = cls.get_value(response, "output_tokens", 0) or 0
            # Anthropic通常不提供total_tokens，需要计算
            total_tokens = cls.get_value(response, "total_tokens", 0) or 0

            # 处理Anthropic的缓存详情（平级字段，不嵌套）
            parsed_input_details: Optional[InputTokensDetails] = None
            cached_tokens = cls.get_value(response, "cache_read_input_tokens", 0) or 0
            cache_write_tokens = cls.get_value(response, "cache_creation_input_tokens", 0) or 0

            # 只有当至少有一个值非零时才创建对象
            if cached_tokens > 0 or cache_write_tokens > 0:
                parsed_input_details = InputTokensDetails(
                    cached_tokens=cached_tokens,
                    cache_write_tokens=cache_write_tokens
                )

            # 计算total_tokens，包含缓存tokens
            if total_tokens == 0:
                total_tokens = input_tokens + output_tokens + cached_tokens + cache_write_tokens

            # Anthropic目前没有类似reasoning_tokens的输出详情字段
            parsed_output_details: Optional[OutputTokensDetails] = None

            return TokenUsage(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
                input_tokens_details=parsed_input_details,
                output_tokens_details=parsed_output_details
            )

        except Exception as e:
            logger.error(f"Anthropic解析器解析失败: {e}")
            return TokenUsage(
                input_tokens=0,
                output_tokens=0,
                total_tokens=0,
                input_tokens_details=None,
                output_tokens_details=None
            )


class GenericParser:
    """
    通用兜底解析器，处理只有基本字段的token usage数据

    当其他专用解析器都无法匹配时，这个解析器作为最后的选择，
    能够处理任何包含input_tokens/output_tokens字段的数据格式，
    对于缺失的字段使用默认值0。
    """

    @classmethod
    def can_parse(cls, response: Any) -> bool:
        """
        通用检查逻辑：只要有input_tokens或output_tokens字段就能解析
        这个解析器优先级最低，只有其他解析器都无法匹配时才会使用
        """
        if isinstance(response, dict):
            # 只要有基本的token字段就能解析
            return ("input_tokens" in response or
                    "output_tokens" in response or
                    "prompt_tokens" in response or
                    "completion_tokens" in response)

        # 对象格式检查
        return (hasattr(response, "input_tokens") or
                hasattr(response, "output_tokens") or
                hasattr(response, "prompt_tokens") or
                hasattr(response, "completion_tokens"))

    @staticmethod
    def get_value(obj: Any, key: str, default: Any = 0) -> Any:
        """从对象或字典中获取值，缺失时返回默认值"""
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    @classmethod
    def parse(cls, response: Any) -> 'TokenUsage':
        """
        通用解析逻辑，适应各种可能的字段组合
        对于缺失的字段使用默认值0
        """
        try:
            # 尝试多种可能的字段名组合
            input_tokens = 0
            output_tokens = 0
            total_tokens = 0

            # 优先使用标准字段名
            if cls.get_value(response, "input_tokens", None) is not None:
                input_tokens = cls.get_value(response, "input_tokens", 0)
            elif cls.get_value(response, "prompt_tokens", None) is not None:
                # OpenAI风格字段名
                input_tokens = cls.get_value(response, "prompt_tokens", 0)

            if cls.get_value(response, "output_tokens", None) is not None:
                output_tokens = cls.get_value(response, "output_tokens", 0)
            elif cls.get_value(response, "completion_tokens", None) is not None:
                # OpenAI风格字段名
                output_tokens = cls.get_value(response, "completion_tokens", 0)

            total_tokens = cls.get_value(response, "total_tokens", 0)

            # 如果没有total_tokens，计算得出
            if total_tokens == 0 and (input_tokens > 0 or output_tokens > 0):
                total_tokens = input_tokens + output_tokens

            # 提取model信息
            model_id = cls.get_value(response, "model_id", None)
            model_name = cls.get_value(response, "model_name", None)

            return TokenUsage(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
                input_tokens_details=None,  # 通用解析器不处理详细信息
                output_tokens_details=None,
                model_id=model_id,
                model_name=model_name
            )

        except Exception as e:
            logger.error(f"通用解析器解析失败: {e}")
            return TokenUsage(
                input_tokens=0,
                output_tokens=0,
                total_tokens=0,
                input_tokens_details=None,
                output_tokens_details=None
            )


class SuperMagicParser:
    """
    超级麦吉特有格式解析器，处理系统内部标准格式，与TokenUsage.to_dict()兼容

    超级麦吉格式是大一统格式，统一了所有模型厂商的token usage格式：
    - 使用input_tokens/output_tokens作为基础字段
    - 缓存字段使用cached_tokens/cache_write_tokens（统一命名）
    - 支持嵌套的input_tokens_details/output_tokens_details结构
    - 与TokenUsage.to_dict()完全兼容
    """

    @classmethod
    def can_parse(cls, response: Any) -> bool:
        """
        检查是否为超级麦吉特有格式
        特征：有input_tokens且不是其他厂商格式

        SuperMagic格式支持两种情况：
        1. 完整版：带有input_tokens_details嵌套结构的缓存字段
        2. 简化版：只有基础字段(input_tokens, output_tokens, total_tokens)
        """
        if isinstance(response, dict):
            # 必须有input_tokens且不是OpenAI格式
            if "input_tokens" not in response or "prompt_tokens" in response:
                return False

            # 不能是Anthropic格式（检查input_token而不是input_tokens）
            if "input_token" in response and "output_token" in response:
                return False

            # SuperMagic格式的特征1：完整版带有缓存字段
            input_details = response.get("input_tokens_details", {})
            if isinstance(input_details, dict):
                has_supermagic_cache = ("cached_tokens" in input_details or
                                       "cache_write_tokens" in input_details)
                if has_supermagic_cache:
                    return True

            # SuperMagic格式的特征2：简化版只要有基础字段即可
            has_basic_fields = ("input_tokens" in response and
                               "output_tokens" in response)
            if has_basic_fields:
                return True

            return False

        # 对象格式检查
        if not (hasattr(response, "input_tokens") and not hasattr(response, "prompt_tokens")):
            return False

        # 完整版：缓存字段在input_tokens_details嵌套结构中
        input_details = getattr(response, "input_tokens_details", None)
        if input_details and (hasattr(input_details, "cached_tokens") or hasattr(input_details, "cache_write_tokens")):
            return True

        # 简化版：只要有基础字段
        if hasattr(response, "output_tokens"):
            return True

        return False

    @staticmethod
    def get_value(obj: Any, key: str, default: Any = 0) -> Any:
        """从对象或字典中获取值"""
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    @classmethod
    def parse(cls, response: Any) -> 'TokenUsage':
        """解析超级麦吉特有格式响应"""
        try:
            # 直接提取标准字段
            input_tokens = cls.get_value(response, "input_tokens", 0) or 0
            output_tokens = cls.get_value(response, "output_tokens", 0) or 0
            total_tokens = cls.get_value(response, "total_tokens", 0) or 0

            # 提取details
            input_details_data = cls.get_value(response, "input_tokens_details", None)
            output_details_data = cls.get_value(response, "output_tokens_details", None)

            # 解析详情
            input_details = InputTokensDetails.from_dict(input_details_data) if input_details_data else None
            output_details = OutputTokensDetails.from_dict(output_details_data) if output_details_data else None

            # 如果没有total_tokens，计算得出（包含缓存tokens）
            if total_tokens == 0:
                cache_tokens = 0
                if input_details:
                    cache_tokens += (input_details.cached_tokens or 0)
                    cache_tokens += (input_details.cache_write_tokens or 0)
                total_tokens = input_tokens + output_tokens + cache_tokens

            return TokenUsage(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
                input_tokens_details=input_details,
                output_tokens_details=output_details
            )

        except Exception as e:
            logger.error(f"超级麦吉解析器解析失败: {e}")
            return TokenUsage(
                input_tokens=0,
                output_tokens=0,
                total_tokens=0,
                input_tokens_details=None,
                output_tokens_details=None
            )


# 注册内置的解析器，按优先级顺序：
# 1. OpenAI格式（prompt_tokens） - 最明确的标识
# 2. SuperMagic格式（input_tokens + cached_tokens/cache_write_tokens）
# 3. Anthropic格式（input_tokens + cache_read_input_tokens/cache_creation_input_tokens）
# 4. Generic格式（通用兜底解析器） - 最低优先级，处理只有基本字段的情况
TokenUsage.register_parser(OpenAIParser)      # 最高优先级，OpenAI API格式
TokenUsage.register_parser(SuperMagicParser)  # 系统内部特有格式
TokenUsage.register_parser(AnthropicParser)   # Anthropic API格式
TokenUsage.register_parser(GenericParser)     # 最低优先级，通用兜底解析器


@dataclass
class ModelUsage:
    """单个模型的使用情况"""
    model_name: str
    usage: TokenUsage
    cost: float = 0.0
    currency: str = "CNY"


@dataclass
class CostReport:
    """成本报告对象"""
    models: List[ModelUsage] = field(default_factory=list)
    timestamp: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    currency_code: str = "CNY"

    @property
    def total_input_tokens(self) -> int:
        """计算总输入token数"""
        return sum(model.usage.input_tokens for model in self.models)

    @property
    def total_output_tokens(self) -> int:
        """计算总输出token数"""
        return sum(model.usage.output_tokens for model in self.models)

    @property
    def total_cache_write_tokens(self) -> int:
        """计算总缓存写入token数"""
        return sum(
            (model.usage.input_tokens_details.cache_write_tokens
             if model.usage.input_tokens_details else 0)
            for model in self.models
        )

    @property
    def total_cached_tokens(self) -> int:
        """计算总缓存命中token数"""
        return sum(
            (model.usage.input_tokens_details.cached_tokens
             if model.usage.input_tokens_details else 0)
            for model in self.models
        )

    @property
    def total_tokens(self) -> int:
        """计算总token数"""
        return sum(model.usage.total_tokens for model in self.models)

    @property
    def total_cost(self) -> float:
        """计算总成本"""
        return sum(model.cost for model in self.models)


def get_currency_symbol(currency_code: str) -> str:
    """获取货币符号

    Args:
        currency_code: 货币代码

    Returns:
        str: 货币符号
    """
    currency_symbols = {
        "CNY": "¥",
        "USD": "$",
        "EUR": "€",
        "GBP": "£",
        "JPY": "¥"
    }
    return currency_symbols.get(currency_code, currency_code)


@dataclass
class TokenUsageCollection:
    """Token使用统计集合对象，用于包装token使用统计信息"""
    type: str  # "summary" 或 "item"
    usages: List[TokenUsage] = field(default_factory=list)

    @classmethod
    def create_item_report(cls, token_usage: TokenUsage) -> 'TokenUsageCollection':
        """创建单次调用的token使用统计报告

        Args:
            token_usage: 单次调用的token使用统计

        Returns:
            TokenUsageCollection: 包含单次调用token使用统计的报告
        """
        return cls(type="item", usages=[token_usage])

    @classmethod
    def create_summary_report(cls, usages: List[TokenUsage]) -> 'TokenUsageCollection':
        """创建汇总的token使用统计报告

        Args:
            usages: 所有模型的token使用统计列表

        Returns:
            TokenUsageCollection: 包含所有模型token使用统计的汇总报告
        """
        return cls(type="summary", usages=usages)

    @classmethod
    def from_cost_report(cls, cost_report: CostReport) -> 'TokenUsageCollection':
        """从CostReport创建TokenUsageCollection

        Args:
            cost_report: 成本报告对象

        Returns:
            TokenUsageCollection: 包含所有模型token使用统计的汇总报告
        """
        usages = []
        for model in cost_report.models:
            # 创建新的TokenUsage对象，并设置model_id和model_name
            token_usage = TokenUsage(
                input_tokens=model.usage.input_tokens,
                output_tokens=model.usage.output_tokens,
                total_tokens=model.usage.total_tokens,
                input_tokens_details=model.usage.input_tokens_details,
                output_tokens_details=model.usage.output_tokens_details,
                model_id=model.model_name,  # CostReport中的model_name对应TokenUsage中的model_id
                model_name=model.model_name
            )
            usages.append(token_usage)

        return cls.create_summary_report(usages)
