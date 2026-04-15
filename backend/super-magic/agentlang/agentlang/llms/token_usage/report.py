"""
Token使用报告模块

负责将TokenUsageTracker中的数据生成报告
"""

import json
import os
from datetime import datetime
from typing import Any, Dict, Optional

from agentlang.context.application_context import ApplicationContext
from agentlang.llms.token_usage.pricing import ModelPricing
from agentlang.llms.token_usage.models import TokenUsage, CostReport, ModelUsage, InputTokensDetails, get_currency_symbol
from agentlang.logger import get_logger
from agentlang.config import config

# 为避免循环导入，使用字符串类型注解
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from agentlang.llms.token_usage.tracker import TokenUsageTracker

logger = get_logger(__name__)


class TokenUsageReport:
    """Token使用统计报告生成器

    负责将TokenUsageTracker中的数据生成各种格式的报告
    支持按照sandbox_id维度汇总token使用情况
    使用标准化的数据对象处理报告
    """

    # 保存全局的报告实例，按sandbox_id索引
    _instances = {}

    @classmethod
    def get_instance(cls, sandbox_id: str = "default", token_tracker: Optional[Any] = None,
                     pricing: Optional[ModelPricing] = None,
                    report_dir: str = None) -> 'TokenUsageReport':
        """获取或创建指定sandbox_id的TokenUsageReport实例

        Args:
            sandbox_id: 沙箱ID
            token_tracker: token使用跟踪器
            pricing: 模型价格配置
            report_dir: 报告文件保存目录，默认为None表示使用默认目录

        Returns:
            TokenUsageReport: 对应sandbox_id的实例
        """
        if sandbox_id not in cls._instances:
            # 没有提供pricing时创建默认实例
            if pricing is None:
                try:
                    # 尝试从配置中加载模型价格
                    models_config = config.get("models", {})
                    pricing = ModelPricing(models_config=models_config)
                    logger.info("已从配置加载模型价格信息")
                except Exception as e:
                    # 配置获取失败时，使用默认价格
                    logger.warning(f"无法从配置加载模型价格，使用默认价格: {e}")
                    pricing = ModelPricing()

            # 创建实例
            cls._instances[sandbox_id] = cls(token_tracker, pricing, sandbox_id, report_dir)

            # 设置token_tracker的report_manager（如果提供了）
            if token_tracker:
                token_tracker.set_report_manager(cls._instances[sandbox_id])

        return cls._instances[sandbox_id]

    def __init__(self, token_tracker: 'TokenUsageTracker', pricing: ModelPricing,
                sandbox_id: str = "default", report_dir: Optional[str] = None):
        """初始化

        Args:
            token_tracker: token使用跟踪器
            pricing: 模型价格配置
            sandbox_id: 沙箱ID，用于区分不同的使用环境
            report_dir: 报告文件保存目录，默认为None表示使用默认目录
        """
        self.token_tracker = token_tracker
        self.pricing = pricing
        self.sandbox_id = sandbox_id
        self.report_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        if report_dir is None:
            try:
                path_manager = ApplicationContext.get_path_manager()
                self.report_dir = path_manager.get_chat_history_dir()
            except (ImportError, RuntimeError):
                # 导入失败时使用备用目录
                logger.warning("无法导入 PathManager 或获取聊天历史目录，使用备用目录")
                self.report_dir = os.path.join(os.getcwd(), ".chat_history")
        else:
            self.report_dir = report_dir

        # 确保报告目录存在
        os.makedirs(self.report_dir, exist_ok=True)

        # 文件名前缀，可通过 set_file_prefix() 更新为 agent_name<agent_id> 格式
        self._file_prefix: Optional[str] = None

    def set_file_prefix(self, prefix: str) -> None:
        """设置报告文件名前缀，使其与聊天历史文件命名保持一致。

        Args:
            prefix: 文件名前缀，通常为 {agent_name}<{agent_id}>
        """
        self._file_prefix = prefix
        logger.debug(f"Token usage 报告文件前缀已更新为: {prefix}")

    def get_report_file_path(self) -> str:
        """获取报告文件的路径

        Returns:
            str: 报告文件的完整路径
        """
        prefix = self._file_prefix if self._file_prefix else self.sandbox_id
        file_name = f"{prefix}.token_usage.json"
        return os.path.join(self.report_dir, file_name)

    def _serialize_report(self, report: CostReport) -> Dict[str, Any]:
        """将CostReport序列化为可JSON化的字典

        Args:
            report: 报告对象

        Returns:
            Dict[str, Any]: 可JSON化的字典
        """
        models_data = []
        for model in report.models:
            # 按照指定顺序构建字典
            model_data = {
                "model_name": model.model_name,
                "input_tokens": model.usage.input_tokens,
                "output_tokens": model.usage.output_tokens,
            }
            if model.resolved_model_id:
                model_data["resolved_model_id"] = model.resolved_model_id

            # 添加缓存相关数据（按顺序）
            if model.usage.input_tokens_details:
                if model.usage.input_tokens_details.cached_tokens:
                    model_data["cached_tokens"] = model.usage.input_tokens_details.cached_tokens
                if model.usage.input_tokens_details.cache_write_tokens:
                    model_data["cache_write_tokens"] = model.usage.input_tokens_details.cache_write_tokens

            # 继续添加剩余字段
            model_data.update({
                "total_tokens": model.usage.total_tokens,
                "currency": model.currency,
                "cost": model.cost
            })

            models_data.append(model_data)

        return {
            "timestamp": report.timestamp,
            "currency_code": report.currency_code,
            "models": models_data
        }

    def _deserialize_report(self, data: Dict[str, Any]) -> CostReport:
        """从字典反序列化CostReport

        Args:
            data: 字典数据

        Returns:
            CostReport: 报告对象
        """
        report = CostReport()
        report.timestamp = data.get("timestamp", report.timestamp)
        report.currency_code = data.get("currency_code", report.currency_code)

        # 解析模型数据
        for model_data in data.get("models", []):
            model_name = model_data.get("model_name", "")

            # 创建输入token详情对象（兼容新旧字段名）
            input_details = InputTokensDetails(
                cache_write_tokens=model_data.get("cache_write_tokens", 0),
                cached_tokens=model_data.get("cached_tokens") or model_data.get("cache_hit_tokens", 0)
            )

            # 创建token使用量对象（包含缓存tokens）
            cache_tokens = 0
            if input_details:
                cache_tokens += (input_details.cached_tokens or 0)
                cache_tokens += (input_details.cache_write_tokens or 0)

            usage = TokenUsage(
                input_tokens=model_data.get("input_tokens", 0),
                output_tokens=model_data.get("output_tokens", 0),
                total_tokens=model_data.get("input_tokens", 0) + model_data.get("output_tokens", 0) + cache_tokens,
                input_tokens_details=input_details
            )

            # 创建模型使用对象
            model_usage = ModelUsage(
                model_name=model_name,
                usage=usage,
                cost=model_data.get("cost", 0.0),
                currency=model_data.get("currency", report.currency_code),
                resolved_model_id=model_data.get("resolved_model_id") or None
            )

            report.models.append(model_usage)

        return report

    def _get_or_create_report(self) -> CostReport:
        """获取现有报告对象或创建新的报告对象

        Returns:
            CostReport: 报告对象
        """
        file_path = self.get_report_file_path()

        # 如果文件存在，尝试从文件加载
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    report_data = json.load(f)
                    return self._deserialize_report(report_data)
            except Exception as e:
                logger.error(f"读取现有token使用报告失败: {e!s}")

        # 如果文件不存在或读取失败，创建新的报告对象
        return CostReport(currency_code=self.pricing.display_currency)

    def _save_report(self, report: CostReport) -> bool:
        """保存报告到文件

        Args:
            report: 报告对象

        Returns:
            bool: 是否保存成功
        """
        file_path = self.get_report_file_path()

        try:
            # 将报告转换为可JSON化的字典
            report_dict = self._serialize_report(report)

            # 保存到文件
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(report_dict, f, ensure_ascii=False, indent=2)

            logger.info(f"保存token使用报告到文件成功: {file_path}")
            return True
        except Exception as e:
            logger.error(f"保存token使用报告到文件失败: {e!s}")
            return False

    def update_and_save_usage(self, model_id: str, token_usage: TokenUsage, resolved_model_id: Optional[str] = None) -> None:
        """更新并保存当前token使用情况到JSON文件

        Args:
            model_id: 模型ID
            token_usage: TokenUsage对象
        """
        # 检查是否有token_tracker
        if not self.token_tracker:
            logger.error(f"无法更新token使用情况，未设置token_tracker")
            return

        # 获取或创建报告
        report = self._get_or_create_report()

        # 计算成本
        cost, currency = self.pricing.calculate_cost(model_id, token_usage)

        # 如果货币不匹配，转换成本
        if currency != report.currency_code:
            cost = self.pricing.convert_currency(cost, currency, report.currency_code)

        # 查找现有模型或创建新模型
        existing_model = next((m for m in report.models if m.model_name == model_id), None)

        if existing_model:
            # 更新现有模型
            existing_model.usage.input_tokens += token_usage.input_tokens
            existing_model.usage.output_tokens += token_usage.output_tokens

            # 更新缓存相关数据
            if token_usage.input_tokens_details:
                if not existing_model.usage.input_tokens_details:
                    existing_model.usage.input_tokens_details = InputTokensDetails()

                if token_usage.input_tokens_details.cache_write_tokens:
                    existing_model.usage.input_tokens_details.cache_write_tokens = (
                        (existing_model.usage.input_tokens_details.cache_write_tokens or 0) +
                        token_usage.input_tokens_details.cache_write_tokens
                    )

                if token_usage.input_tokens_details.cached_tokens:
                    existing_model.usage.input_tokens_details.cached_tokens = (
                        (existing_model.usage.input_tokens_details.cached_tokens or 0) +
                        token_usage.input_tokens_details.cached_tokens
                    )

            # 更新总tokens（包含缓存tokens）
            cache_tokens = 0
            if existing_model.usage.input_tokens_details:
                cache_tokens += (existing_model.usage.input_tokens_details.cached_tokens or 0)
                cache_tokens += (existing_model.usage.input_tokens_details.cache_write_tokens or 0)

            existing_model.usage.total_tokens = (
                existing_model.usage.input_tokens +
                existing_model.usage.output_tokens +
                cache_tokens
            )

            # 更新成本
            existing_model.cost += cost
        else:
            # 创建新的模型使用记录
            model_usage = ModelUsage(
                model_name=model_id,
                usage=token_usage,
                cost=cost,
                currency=report.currency_code,
                resolved_model_id=resolved_model_id or None
            )
            report.models.append(model_usage)

        # 保存报告
        self._save_report(report)

        # 重置累计使用量，避免下次再次累加
        self.token_tracker.reset()

    def format_report(self, report: CostReport) -> str:
        """格式化报告为可读字符串

        Args:
            report: 报告对象

        Returns:
            str: 格式化后的报告字符串
        """
        currency_symbol = get_currency_symbol(report.currency_code)

        formatted = "Token使用统计报告\n"
        formatted += "-" * 40 + "\n"

        # 添加每个模型的使用情况
        for model in report.models:
            formatted += f"模型: {model.model_name}\n"
            formatted += f"  输入tokens: {model.usage.input_tokens:,}\n"
            formatted += f"  输出tokens: {model.usage.output_tokens:,}\n"

            # 添加缓存相关信息
            if model.usage.input_tokens_details:
                if model.usage.input_tokens_details.cache_write_tokens:
                    formatted += f"  缓存写入tokens: {model.usage.input_tokens_details.cache_write_tokens:,}\n"
                if model.usage.input_tokens_details.cached_tokens:
                    formatted += f"  缓存命中tokens: {model.usage.input_tokens_details.cached_tokens:,}\n"

            formatted += f"  总tokens: {model.usage.total_tokens:,}\n"
            formatted += f"  估算成本: {currency_symbol}{model.cost:.6f}\n\n"

        # 添加总计
        formatted += f"总计:\n"
        formatted += f"  总输入tokens: {report.total_input_tokens:,}\n"
        formatted += f"  总输出tokens: {report.total_output_tokens:,}\n"

        # 计算缓存相关总计
        total_cache_write_tokens = sum(
            (m.usage.input_tokens_details.cache_write_tokens or 0)
            for m in report.models
            if m.usage.input_tokens_details and m.usage.input_tokens_details.cache_write_tokens
        )

        total_cached_tokens = sum(
            (m.usage.input_tokens_details.cached_tokens or 0)
            for m in report.models
            if m.usage.input_tokens_details and m.usage.input_tokens_details.cached_tokens
        )

        if total_cache_write_tokens > 0:
            formatted += f"  总缓存写入tokens: {total_cache_write_tokens:,}\n"
        if total_cached_tokens > 0:
            formatted += f"  总缓存命中tokens: {total_cached_tokens:,}\n"

        formatted += f"  所有tokens总计: {report.total_tokens:,}\n"
        formatted += f"  总估算成本: {currency_symbol}{report.total_cost:.6f}\n"

        formatted += f"\n报告时间: {report.timestamp}"

        return formatted

    def get_cost_report(self) -> CostReport:
        """获取token使用和成本报告

        Returns:
            CostReport: 成本报告对象
        """
        file_path = self.get_report_file_path()

        # 尝试读取文件
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    report_data = json.load(f)

                # 转换为CostReport对象
                return self._deserialize_report(report_data)

            except Exception as e:
                logger.error(f"读取token使用报告失败: {e}")

        # 如果文件不存在或读取失败，创建新的报告
        return CostReport(currency_code=self.pricing.display_currency)
