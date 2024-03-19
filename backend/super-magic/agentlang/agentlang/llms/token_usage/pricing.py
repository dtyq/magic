"""
模型token价格配置模块
"""

from enum import Enum
from typing import Any, Dict, Optional, Tuple, TypedDict, List, cast, TypeVar, Type

from agentlang.llms.token_usage.models import TokenUsage
from agentlang.logger import get_logger

logger = get_logger(__name__)


class CurrencyType(Enum):
    """货币类型枚举"""
    USD = "USD"  # 美元
    RMB = "CNY"  # 人民币


class PricingInfo(TypedDict, total=False):
    """模型价格信息字典类型"""
    input_price: float
    output_price: float
    cache_write_price: float
    cache_hit_price: float
    currency: str


# 添加泛型类型变量，用于类型转换
T = TypeVar('T')


def safe_cast(value: Any, to_type: Type[T], default: T) -> T:
    """安全类型转换

    Args:
        value: 要转换的值
        to_type: 目标类型
        default: 转换失败时的默认值

    Returns:
        T: 转换后的值
    """
    try:
        return to_type(value)
    except (ValueError, TypeError):
        return default


class ModelPricing:
    """LLM模型价格配置和成本计算

    用于配置各模型的token价格，并基于使用情况计算成本
    """

    # 默认汇率 (USD -> RMB)
    DEFAULT_EXCHANGE_RATE = 7.2

    def __init__(self,
                 models_config: Optional[Dict[str, Dict[str, Any]]] = None,
                 exchange_rate: float = DEFAULT_EXCHANGE_RATE,
                 display_currency: str = CurrencyType.RMB.value):
        """初始化

        Args:
            models_config: 从主配置加载的模型配置字典
            exchange_rate: 汇率，用于USD到RMB的转换，默认为7.2
            display_currency: 显示货币，用于报告显示，默认为人民币
        """
        self.pricing: Dict[str, PricingInfo] = {}
        self.exchange_rate = exchange_rate
        self.display_currency = display_currency

        # 从models_config中加载价格信息，如果提供了配置
        if models_config:
            self._load_pricing_from_config(models_config)
        else:
            logger.warning("没有提供模型配置，将使用默认价格")
            # 设置默认价格
            self.pricing["default"] = {
                "input_price": 0.001,
                "output_price": 0.002,
                "currency": CurrencyType.USD.value
            }

    def _load_pricing_from_config(self, models_config: Dict[str, Dict[str, Any]]) -> None:
        """从配置中加载价格信息

        Args:
            models_config: 模型配置字典
        """
        for model_name, config in models_config.items():
            if "pricing" in config and isinstance(config["pricing"], dict):
                pricing_data = config["pricing"]

                # 创建价格信息对象
                price_info: PricingInfo = {}

                # 添加基本价格（必须）
                if "input_price" in pricing_data:
                    price_info["input_price"] = safe_cast(pricing_data["input_price"], float, 0.0)

                if "output_price" in pricing_data:
                    price_info["output_price"] = safe_cast(pricing_data["output_price"], float, 0.0)

                # 添加可选价格
                if "cache_write_price" in pricing_data:
                    price_info["cache_write_price"] = safe_cast(pricing_data["cache_write_price"], float, 0.0)

                if "cache_hit_price" in pricing_data:
                    price_info["cache_hit_price"] = safe_cast(pricing_data["cache_hit_price"], float, 0.0)

                # 添加货币
                if "currency" in pricing_data:
                    price_info["currency"] = str(pricing_data["currency"])
                else:
                    price_info["currency"] = CurrencyType.USD.value

                # 保存价格信息
                self.pricing[model_name] = price_info
            elif model_name != "default":  # 非默认模型缺少价格
                logger.warning(f"模型 '{model_name}' 配置中缺少价格信息")

        # 确保有默认价格配置
        if "default" not in self.pricing:
            # 创建默认价格配置
            self.pricing["default"] = {
                "input_price": 0.001,
                "output_price": 0.002,
                "currency": CurrencyType.USD.value
            }
            logger.info("已创建默认价格配置")

    def add_model_pricing(self, model_name: str, price_info: PricingInfo) -> None:
        """添加或更新模型价格配置

        Args:
            model_name: 模型名称
            price_info: 价格信息字典，包含input_price和output_price
        """
        self.pricing[model_name] = price_info

    def get_model_pricing(self, model_name: str) -> PricingInfo:
        """获取模型的价格配置

        Args:
            model_name: 模型名称

        Returns:
            PricingInfo: 包含价格信息的字典
        """
        # 尝试获取确切匹配的模型价格
        if model_name in self.pricing:
            return self.pricing[model_name]

        # 尝试前缀匹配
        for key in self.pricing:
            if model_name.startswith(key):
                return self.pricing[key]

        # 返回默认价格
        logger.info(f"未找到模型 '{model_name}' 的价格配置，使用默认价格")
        return self.pricing["default"]

    def get_currency_symbol(self, currency: Optional[str] = None) -> str:
        """获取货币符号

        Args:
            currency: 货币代码，默认为显示货币

        Returns:
            str: 货币符号
        """
        if currency is None:
            currency = self.display_currency

        if currency == CurrencyType.USD.value:
            return "$"
        elif currency == CurrencyType.RMB.value:
            return "¥"
        else:
            return currency

    def convert_currency(self, amount: float, from_currency: str, to_currency: str) -> float:
        """转换货币

        Args:
            amount: 金额
            from_currency: 原始货币
            to_currency: 目标货币

        Returns:
            float: 转换后的金额
        """
        if from_currency == to_currency:
            return amount

        if from_currency == CurrencyType.USD.value and to_currency == CurrencyType.RMB.value:
            return amount * self.exchange_rate
        elif from_currency == CurrencyType.RMB.value and to_currency == CurrencyType.USD.value:
            return amount / self.exchange_rate
        else:
            # 不支持的货币转换
            return amount

    def calculate_cost(self, model_name: str, token_usage: TokenUsage) -> Tuple[float, str]:
        """计算token使用成本

        Args:
            model_name: A模型名称
            token_usage: TokenUsage对象

        Returns:
            Tuple[float, str]: (成本, 货币类型)
        """
        pricing = self.get_model_pricing(model_name)
        input_price = pricing.get("input_price", 0.0)
        output_price = pricing.get("output_price", 0.0)
        currency = pricing.get("currency", CurrencyType.USD.value)

        # 使用TokenUsage对象
        input_tokens = token_usage.input_tokens
        output_tokens = token_usage.output_tokens

        # 从input_tokens_details中获取缓存信息
        cache_write_tokens = 0
        cached_tokens = 0

        if token_usage.input_tokens_details:
            cache_write_tokens = token_usage.input_tokens_details.cache_write_tokens or 0
            cached_tokens = token_usage.input_tokens_details.cached_tokens or 0

        # 基础成本计算（按千token）
        cost = (input_tokens * input_price + output_tokens * output_price) / 1000

        # 计算缓存成本
        if cache_write_tokens > 0 and "cache_write_price" in pricing:
            cost += (cache_write_tokens * cast(float, pricing["cache_write_price"])) / 1000

        if cached_tokens > 0 and "cache_hit_price" in pricing:
            cost += (cached_tokens * cast(float, pricing["cache_hit_price"])) / 1000

        # 确保结果为有效数字
        cost = max(0.0, cost)

        return cost, currency
