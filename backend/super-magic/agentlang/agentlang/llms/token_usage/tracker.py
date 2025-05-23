"""
Token使用跟踪模块

提供LLM请求Token使用情况的跟踪功能
"""

import copy
import threading

# 延迟导入TokenUsageReport，避免循环引用
from typing import TYPE_CHECKING, Any, Dict, Optional, Protocol

from agentlang.llms.token_usage.models import InputTokensDetails, TokenUsage
from agentlang.logger import get_logger

if TYPE_CHECKING:
    from agentlang.llms.token_usage.report import TokenUsageReport


logger = get_logger(__name__)


class LlmUsageResponse(Protocol):
    """LLM使用量响应的协议类型"""
    recorded: bool
    model_id: str
    model_name: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cache_write_tokens: Optional[int]
    cache_hit_tokens: Optional[int]


class TokenUsageTracker:
    """Token用量跟踪器

    跟踪LLM请求的token用量，支持多线程安全的累计统计
    负责从LLM响应中提取token使用信息
    使用标准化的TokenUsage对象统一数据格式
    """

    def __init__(self) -> None:
        """初始化Token用量跟踪器"""
        # 使用字典记录每个模型的TokenUsage对象
        self._usage: Dict[str, TokenUsage] = {}
        # 使用锁确保线程安全
        self._lock = threading.Lock()
        # 报告管理器
        self._report_manager: Optional['TokenUsageReport'] = None
        # 存储最近一次记录的TokenUsage
        self._last_recorded_usage: Optional[TokenUsage] = None

    def add_usage(self, model_id: str, token_usage: TokenUsage) -> None:
        """添加token使用记录

        Args:
            model_id: 模型ID
            token_usage: TokenUsage对象
        """
        with self._lock:
            if model_id not in self._usage:
                # 创建一个初始的TokenUsage对象
                self._usage[model_id] = TokenUsage(
                    input_tokens=0,
                    output_tokens=0,
                    total_tokens=0,
                    input_tokens_details=InputTokensDetails()
                )

            # 累加基本使用量
            self._usage[model_id].input_tokens += token_usage.input_tokens
            self._usage[model_id].output_tokens += token_usage.output_tokens

            # 更新总量
            self._usage[model_id].total_tokens = (
                self._usage[model_id].input_tokens + self._usage[model_id].output_tokens
            )

            # 累加缓存使用量（如果存在）
            if token_usage.input_tokens_details:
                if not self._usage[model_id].input_tokens_details:
                    self._usage[model_id].input_tokens_details = InputTokensDetails()

                # 添加缓存写入量
                if token_usage.input_tokens_details.cache_write_tokens:
                    self._usage[model_id].input_tokens_details.cache_write_tokens = (
                        (self._usage[model_id].input_tokens_details.cache_write_tokens or 0) +
                        (token_usage.input_tokens_details.cache_write_tokens or 0)
                    )

                # 添加缓存命中量
                if token_usage.input_tokens_details.cached_tokens:
                    self._usage[model_id].input_tokens_details.cached_tokens = (
                        (self._usage[model_id].input_tokens_details.cached_tokens or 0) +
                        (token_usage.input_tokens_details.cached_tokens or 0)
                    )

    def record_llm_usage(self, response_usage: Any, model_id: str,
                         user_id: Optional[str] = None,
                         model_name: Optional[str] = None) -> LlmUsageResponse:
        """记录LLM使用情况，并生成报告

        Args:
            response_usage: LLM响应对象的usage属性
            model_id: 模型ID
            user_id: 用户ID，可选
            model_name: 模型名称，可选

        Returns:
            LlmUsageResponse: 记录结果
        """
        # 记录原始usage数据以进行调试
        try:
            if response_usage:
                if hasattr(response_usage, '__dict__'):
                    logger.debug(f"记录LLM使用量 - 原始usage数据(dict): {response_usage.__dict__}")
                else:
                    logger.debug(f"记录LLM使用量 - 原始usage数据(str): {str(response_usage)[:500]}")
        except Exception as e:
            logger.warning(f"记录原始usage数据时出错: {e}")

        # 从响应中提取token使用情况
        token_usage = TokenUsage.from_response(response_usage)

        # 记录解析后的token_usage对象
        logger.debug(f"记录LLM使用量 - 解析后的token_usage: {token_usage.to_dict()}, model_id={model_id}")

        # token_usage.model_id = 配置文件中的 name 字段的值
        # token_usage.model_name = 配置键
        token_usage.model_id = model_name if model_name else model_id 
        token_usage.model_name = model_id

        # 存储最近一次的TokenUsage
        with self._lock: # 确保线程安全地更新 _last_recorded_usage
            self._last_recorded_usage = token_usage

        # 添加使用记录到跟踪器
        self.add_usage(model_id, token_usage)

        # 如果有报告管理器，则生成报告
        if self._report_manager:
            self._report_manager.update_and_save_usage(model_id, token_usage)

        # 返回处理结果，实现LlmUsageResponse协议
        class UsageResult:
            def __init__(self, usage: TokenUsage, mid: str, name: str):
                self.recorded = True
                self.model_id = mid
                self.model_name = name or mid
                self.input_tokens = usage.input_tokens
                self.output_tokens = usage.output_tokens
                self.total_tokens = usage.total_tokens

                # 从input_tokens_details获取缓存信息
                self.cache_write_tokens = None
                self.cache_hit_tokens = None

                if usage.input_tokens_details:
                    if usage.input_tokens_details.cache_write_tokens and usage.input_tokens_details.cache_write_tokens > 0:
                        self.cache_write_tokens = usage.input_tokens_details.cache_write_tokens

                    if usage.input_tokens_details.cached_tokens and usage.input_tokens_details.cached_tokens > 0:
                        self.cache_hit_tokens = usage.input_tokens_details.cached_tokens

        return UsageResult(token_usage, model_id, model_name)

    def extract_chat_history_usage_data(self, chat_response: Any) -> TokenUsage:
        """从LLM响应对象中提取处理好的token使用数据，用于chat_history

        为agent.py提供的便捷方法，从LLM响应中提取token使用数据但不记录到使用统计中

        Args:
            chat_response: 完整的LLM响应对象

        Returns:
            TokenUsage: 标准化的token使用量对象，如果无法提取则返回空对象
        """
        # 检查响应对象是否有效
        if not chat_response:
            logger.warning("extract_chat_history_usage_data: chat_response为空")
            return TokenUsage(input_tokens=0, output_tokens=0, total_tokens=0)

        try:
            # 记录原始chat_response对象类型和结构
            logger.debug(f"提取token用量 - chat_response类型: {type(chat_response)}")

            # 提取usage属性，注意使用属性访问
            usage = getattr(chat_response, "usage", None)

            if not usage:
                logger.warning(f"提取token用量 - 没有找到usage属性: {str(chat_response)[:200]}...")
                return TokenUsage(input_tokens=0, output_tokens=0, total_tokens=0)

            # 记录原始usage数据结构
            try:
                if hasattr(usage, '__dict__'):
                    logger.debug(f"提取token用量 - 原始usage数据: {usage.__dict__}")
                else:
                    logger.debug(f"提取token用量 - 原始usage数据: {str(usage)[:500]}")
            except Exception as e:
                logger.warning(f"记录usage数据时出错: {e}")

            # 使用TokenUsage的from_response方法直接从API响应提取标准化的数据
            # 这样可以确保正确处理任何可能的响应格式（如OpenAI的新旧格式）
            token_usage = TokenUsage.from_response(usage)

            # 记录解析后的token_usage对象
            logger.debug(f"提取token用量 - 解析后的token_usage: {token_usage.to_dict()}")

            return token_usage
        except Exception as e:
            logger.error(f"提取chat_history token使用数据失败: {e}", exc_info=True)
            return TokenUsage(input_tokens=0, output_tokens=0, total_tokens=0)

    def set_report_manager(self, report_manager: 'TokenUsageReport') -> None:
        """设置报告管理器

        Args:
            report_manager: TokenUsageReport 实例
        """
        self._report_manager = report_manager

    def get_usage_data(self) -> Dict[str, TokenUsage]:
        """获取所有使用数据

        Returns:
            Dict[str, TokenUsage]: 所有模型的使用数据
        """
        with self._lock:
            # 返回深拷贝避免外部修改
            return copy.deepcopy(self._usage)

    def reset(self) -> None:
        """重置所有使用统计"""
        with self._lock:
            self._usage.clear()
            logger.info("TokenUsageTracker已重置")

    def get_last_recorded_usage(self) -> Optional[TokenUsage]:
        """获取最近一次通过 record_llm_usage 记录的 TokenUsage 对象。

        Returns:
            Optional[TokenUsage]: 最近一次记录的TokenUsage，如果还没有记录则为None。
        """
        with self._lock: # 确保线程安全地读取
            # 可以返回一个深拷贝以防止外部修改，如果 TokenUsage 对象是可变的
            # 但如果 TokenUsage 是 Pydantic 模型（通常是不可变的或推荐视为不可变），直接返回也可
            return copy.deepcopy(self._last_recorded_usage) if self._last_recorded_usage else None

    def get_formatted_report(self) -> str:
        """获取格式化的报告（一步到位）

        Returns:
            str: 格式化后的token使用报告
        """
        if not self._report_manager:
            # 如果没有报告管理器，使用简单格式输出当前累计数据
            lines = ["Token使用统计（临时报告）："]

            with self._lock:
                if not self._usage:
                    return "无Token使用记录"

                for model_name, usage in self._usage.items():
                    lines.append(f"\n模型: {model_name}")
                    lines.append(f"  输入tokens: {usage.input_tokens:,}")
                    lines.append(f"  输出tokens: {usage.output_tokens:,}")

                    # 使用input_tokens_details代替直接访问cache
                    if usage.input_tokens_details:
                        if usage.input_tokens_details.cache_write_tokens and usage.input_tokens_details.cache_write_tokens > 0:
                            lines.append(f"  缓存写入tokens: {usage.input_tokens_details.cache_write_tokens:,}")
                        if usage.input_tokens_details.cached_tokens and usage.input_tokens_details.cached_tokens > 0:
                            lines.append(f"  缓存命中tokens: {usage.input_tokens_details.cached_tokens:,}")

                    lines.append(f"  总tokens: {usage.total_tokens:,}")

            return "\n".join(lines)
        else:
            # 使用报告管理器生成完整报告
            cost_report = self._report_manager.get_cost_report()
            return self._report_manager.format_report(cost_report)
