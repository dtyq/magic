"""
Token使用统计系统的核心数据模型

定义强类型数据对象，用于在系统中传递token使用相关信息
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, ClassVar, Dict, List, Optional, Protocol, Type

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
    def parse(cls, response: Any) -> tuple[int, int, int, Optional[InputTokensDetails], Optional[OutputTokensDetails]]:
        """
        解析响应，提取token使用信息

        Args:
            response: API响应

        Returns:
            tuple: (input_tokens, output_tokens, total_tokens, input_tokens_details, output_tokens_details)
        """
        ...


@dataclass
class TokenUsage:
    """基本token使用量数据"""
    input_tokens: int
    output_tokens: int
    total_tokens: int
    input_tokens_details: Optional[InputTokensDetails] = None
    output_tokens_details: Optional[OutputTokensDetails] = None

    # 注册的解析器，按优先级顺序排列
    _parsers: ClassVar[List[Type[TokenUsageParser]]] = []

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        data = {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
        }

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
        """从字典创建对象"""
        return cls(
            input_tokens=data.get("input_tokens", 0),
            output_tokens=data.get("output_tokens", 0),
            total_tokens=data.get("total_tokens", 0),
            input_tokens_details=InputTokensDetails.from_dict(data.get("input_tokens_details")),
            output_tokens_details=OutputTokensDetails.from_dict(data.get("output_tokens_details")),
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
        """
        if not response_usage:
            return cls(input_tokens=0, output_tokens=0, total_tokens=0)

        # 尝试已注册的所有解析器
        for parser in cls._parsers:
            try:
                if parser.can_parse(response_usage):
                    input_tokens, output_tokens, total_tokens, input_details, output_details = parser.parse(response_usage)
                    logger.debug(f"使用 {parser.__name__} 解析token信息: input={input_tokens}, output={output_tokens}, total={total_tokens}")
                    return cls(
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        total_tokens=total_tokens,
                        input_tokens_details=input_details,
                        output_tokens_details=output_details
                    )
            except Exception as e:
                logger.warning(f"{parser.__name__} 解析失败: {e}")
                continue

        # 如果没有合适的解析器，使用默认解析器
        logger.warning("没有找到合适的解析器，使用默认解析器")
        try:
            return DefaultParser.create_token_usage(response_usage)
        except Exception as e:
            logger.error(f"默认解析器失败: {e}")
            return cls(input_tokens=0, output_tokens=0, total_tokens=0)


# 更新DefaultParser，使其可以处理所有主流格式
class DefaultParser:
    """默认解析器，处理所有主流格式，包括OpenAI和Anthropic"""

    @classmethod
    def can_parse(cls, response: Any) -> bool:
        """
        默认解析器尝试处理所有格式，优先检查常见格式

        - OpenAI格式: prompt_tokens/completion_tokens
        - Anthropic格式: prompt_tokens/completion_tokens，带有特殊的details结构
        - 其他格式: 任何包含token信息的响应
        """
        # 检查是否有token相关字段
        if isinstance(response, dict):
            token_fields = ["prompt_tokens", "completion_tokens", "total_tokens",
                           "input_tokens", "output_tokens"]
            return any(field in response for field in token_fields)
        elif response:
            # 对于对象，检查是否有任何token相关属性
            return any(hasattr(response, field) for field in ["prompt_tokens", "completion_tokens",
                                                             "input_tokens", "output_tokens"])
        return False

    @staticmethod
    def get_value(obj: Any, key: str, default: Any = 0) -> Any:
        """从对象或字典中获取值"""
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    @classmethod
    def parse(cls, response: Any) -> tuple[int, int, int, Optional[InputTokensDetails], Optional[OutputTokensDetails]]:
        """解析响应，支持所有主流格式（OpenAI, Anthropic等）"""
        try:
            # 提取基本token统计信息
            input_tokens = cls.get_value(response, "prompt_tokens", 0)
            output_tokens = cls.get_value(response, "completion_tokens", 0)
            total_tokens = cls.get_value(response, "total_tokens", 0)

            # 尝试替代字段名
            if input_tokens == 0:
                input_tokens = cls.get_value(response, "input_tokens", 0)

            if output_tokens == 0:
                output_tokens = cls.get_value(response, "output_tokens", 0)

            # 如果没有提供total_tokens，则计算得出
            if total_tokens == 0 and (input_tokens > 0 or output_tokens > 0):
                total_tokens = input_tokens + output_tokens

            # 处理输入详情
            parsed_input_details: Optional[InputTokensDetails] = None
            prompt_details = cls.get_value(response, "prompt_tokens_details", None)

            if prompt_details:
                # 提取cached_tokens
                cached_tokens = cls.get_value(prompt_details, "cached_tokens", 0)
                # 映射规则: prompt_tokens_details.cache_read_input_tokens => input_tokens_details.cached_tokens
                if cached_tokens == 0:
                    cached_tokens = cls.get_value(prompt_details, "cache_read_input_tokens", 0)

                # 提取cache_write_tokens
                cache_write_tokens = cls.get_value(prompt_details, "cache_write_input_tokens", 0)

                # 只有当至少有一个值非零时才创建对象
                if cached_tokens > 0 or cache_write_tokens > 0:
                    parsed_input_details = InputTokensDetails(
                        cached_tokens=cached_tokens,
                        cache_write_tokens=cache_write_tokens
                    )

            # 处理输出详情
            parsed_output_details: Optional[OutputTokensDetails] = None
            completion_details = cls.get_value(response, "completion_tokens_details", None)

            if completion_details:
                reasoning_tokens = cls.get_value(completion_details, "reasoning_tokens", 0)
                if reasoning_tokens > 0:
                    parsed_output_details = OutputTokensDetails(reasoning_tokens=reasoning_tokens)

            return input_tokens, output_tokens, total_tokens, parsed_input_details, parsed_output_details

        except Exception as e:
            logger.error(f"默认解析器解析失败: {e}")
            return 0, 0, 0, None, None

    @classmethod
    def create_token_usage(cls, response: Any) -> TokenUsage:
        """创建TokenUsage对象"""
        input_tokens, output_tokens, total_tokens, input_details, output_details = cls.parse(response)
        return TokenUsage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            input_tokens_details=input_details,
            output_tokens_details=output_details
        )


class StandardParser:
    """标准格式解析器，与TokenUsage.to_dict()兼容"""

    @classmethod
    def can_parse(cls, response: Any) -> bool:
        """检查是否为标准格式"""
        if isinstance(response, dict):
            # 标准格式使用input_tokens和output_tokens
            return "input_tokens" in response and "output_tokens" in response
        return hasattr(response, "input_tokens") and hasattr(response, "output_tokens")

    @classmethod
    def parse(cls, response: Any) -> tuple[int, int, int, Optional[InputTokensDetails], Optional[OutputTokensDetails]]:
        """解析标准格式响应"""
        get_value = DefaultParser.get_value

        # 直接提取标准字段
        input_tokens = get_value(response, "input_tokens", 0)
        output_tokens = get_value(response, "output_tokens", 0)
        total_tokens = get_value(response, "total_tokens", 0)

        # 如果没有total_tokens，计算得出
        if total_tokens == 0:
            total_tokens = input_tokens + output_tokens

        # 提取details
        input_details_data = get_value(response, "input_tokens_details", None)
        output_details_data = get_value(response, "output_tokens_details", None)

        # 解析详情
        input_details = InputTokensDetails.from_dict(input_details_data) if input_details_data else None
        output_details = OutputTokensDetails.from_dict(output_details_data) if output_details_data else None

        return input_tokens, output_tokens, total_tokens, input_details, output_details


# 简化注册部分，只注册两个解析器
# 注册内置的解析器 - 先注册StandardParser优先使用标准格式
TokenUsage.register_parser(StandardParser)
TokenUsage.register_parser(DefaultParser)


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
    def total_cache_hit_tokens(self) -> int:
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


# 向后兼容函数，用于支持旧代码
def is_prompt_tokens_details(data: Any) -> bool:
    """
    判断对象是否为输入token详情数据结构（向后兼容）

    Args:
        data: 要检查的对象

    Returns:
        bool: 是否为输入token详情结构
    """
    if not isinstance(data, dict):
        return False

    # 检查是否包含任何缓存相关字段
    cache_fields = ["cached_tokens", "cache_write_tokens", "cache_read_input_tokens", "cache_write_input_tokens"]
    return any(field in data for field in cache_fields)


def is_llm_usage_info(data: Any) -> bool:
    """
    判断对象是否为LLM使用信息数据结构（向后兼容）

    Args:
        data: 要检查的对象

    Returns:
        bool: 是否为LLM使用信息结构
    """
    if not isinstance(data, dict):
        return False

    # 检查是否包含token相关字段
    token_fields = ["input_tokens", "output_tokens", "prompt_tokens", "completion_tokens", "total_tokens"]
    return any(field in data for field in token_fields)


@dataclass
class TokenUsageReport:
    """Token使用统计报告对象，用于包装token使用统计信息"""
    type: str  # "summary" 或 "item"
    usages: List[TokenUsage] = field(default_factory=list)

    @classmethod
    def create_item_report(cls, token_usage: TokenUsage) -> 'TokenUsageReport':
        """创建单次调用的token使用统计报告

        Args:
            token_usage: 单次调用的token使用统计

        Returns:
            TokenUsageReport: 包含单次调用token使用统计的报告
        """
        return cls(type="item", usages=[token_usage])

    @classmethod
    def create_summary_report(cls, usages: List[TokenUsage]) -> 'TokenUsageReport':
        """创建汇总的token使用统计报告

        Args:
            usages: 所有模型的token使用统计列表

        Returns:
            TokenUsageReport: 包含所有模型token使用统计的汇总报告
        """
        return cls(type="summary", usages=usages)

    @classmethod
    def from_cost_report(cls, cost_report: CostReport) -> 'TokenUsageReport':
        """从CostReport创建TokenUsageReport

        Args:
            cost_report: 成本报告对象

        Returns:
            TokenUsageReport: 包含所有模型token使用统计的汇总报告
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
