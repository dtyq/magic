import os
import yaml
import time
import uuid
from typing import Dict, Any, Optional, List, Tuple
from pathlib import Path

from agentlang.context.application_context import ApplicationContext
from agentlang.logger import get_logger
from agentlang.config.config import config  # 导入全局配置实例，复用工具方法


class DynamicConfig:
    """动态配置管理器 - 负责动态配置文件的读写管理

    采用组合模式复用Config类的工具方法，提供与全局配置一致的功能
    """

    DYNAMIC_CONFIG_FILE = "dynamic_config.yaml"

    _instance = None
    _logger = get_logger("agentlang.config.dynamic_config")

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DynamicConfig, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, '_initialized'):
            self._dynamic_config_path = self._get_dynamic_config_path()
            self._model_info_enricher = None  # Lazy initialization for model info enricher
            self._initialized = True

    def _get_dynamic_config_path(self) -> Path:
        """获取动态配置文件路径"""
        try:
            # 优先使用 ApplicationContext 获取项目根目录下的config目录
            path_manager = ApplicationContext.get_path_manager()
            project_root = path_manager.get_project_root()
            config_dir = project_root / "config"
            dynamic_config_path = config_dir / self.DYNAMIC_CONFIG_FILE
            self._logger.debug(f"通过 ApplicationContext 确定动态配置路径: {dynamic_config_path}")
            return dynamic_config_path
        except (ImportError, AttributeError, RuntimeError) as e:
            self._logger.debug(f"无法通过 ApplicationContext 获取路径: {e}")
            # 兜底：使用当前工作目录下的config目录
            config_dir = Path.cwd() / "config"
            dynamic_config_path = config_dir / self.DYNAMIC_CONFIG_FILE
            self._logger.debug(f"使用当前工作目录下的config目录: {dynamic_config_path}")
            return dynamic_config_path

    def _normalize_config_input(self, config_data: Any) -> Dict[str, Any]:
        """标准化配置输入，支持多种格式的空配置

        Args:
            config_data: 输入配置，支持 dict, list, None 等格式

        Returns:
            Dict[str, Any]: 标准化后的配置字典

        Note:
            - {}、[]、null 都转换为 {}
            - models段的 {}、[]、null 也转换为 {}
        """
        # 处理顶层配置：{}、[]、null -> {}
        if config_data is None or config_data == [] or config_data == {}:
            config_data = {}
        elif not isinstance(config_data, dict):
            self._logger.info(f"不支持的配置格式 {type(config_data)}，将转换为空配置")
            config_data = {}

        # 确保config_data是字典
        normalized_config = dict(config_data)

        # 处理models段：{}、[]、null -> {}
        if "models" in normalized_config:
            models_data = normalized_config["models"]
            if models_data is None or models_data == [] or models_data == {}:
                normalized_config["models"] = {}
            elif not isinstance(models_data, dict):
                self._logger.info(f"models段格式不支持 {type(models_data)}，将转换为空配置")
                normalized_config["models"] = {}

        return normalized_config

    def write_dynamic_config(self, config_data: Any) -> str:
        """写入完整的动态配置（从JSON转换为YAML）

        Automatically adds file_metadata with created_at and updated_at timestamps

        Args:
            config_data: 完整的动态配置，支持多种格式：
                        - dict: 标准配置字典
                        - list/None: 视为空配置，转换为 {}
                        - models段同样支持 dict/list/None

        Returns:
            str: 配置文件路径

        Raises:
            IOError: 文件写入失败
        """
        from datetime import datetime, timezone, timedelta

        # 标准化输入配置
        normalized_config = self._normalize_config_input(config_data)

        try:
            # 确保config目录存在
            config_dir = self._dynamic_config_path.parent
            config_dir.mkdir(parents=True, exist_ok=True)

            # Use UTC+8 timezone (China Standard Time)
            tz_utc8 = timezone(timedelta(hours=8))
            current_time = datetime.now(tz_utc8).isoformat()

            # Read existing file to preserve created_at timestamp
            existing_created_at = None
            if self._dynamic_config_path.exists():
                try:
                    with open(self._dynamic_config_path, 'r', encoding='utf-8') as f:
                        existing_config = yaml.safe_load(f)
                        if existing_config and isinstance(existing_config, dict):
                            file_metadata = existing_config.get("file_metadata", {})
                            old_created_at = file_metadata.get("created_at")

                            # Convert old timestamp to UTC+8 if needed
                            if old_created_at:
                                try:
                                    # Parse the ISO format timestamp
                                    old_dt = datetime.fromisoformat(old_created_at.replace('Z', '+00:00'))
                                    # Convert to UTC+8 timezone
                                    existing_created_at = old_dt.astimezone(tz_utc8).isoformat()
                                except Exception as parse_error:
                                    self._logger.debug(f"无法转换创建时间格式: {parse_error}，使用原值")
                                    existing_created_at = old_created_at
                except Exception as e:
                    self._logger.debug(f"无法读取现有配置文件的创建时间: {e}")

            # Prepare file_metadata
            file_metadata = {
                "created_at": existing_created_at or current_time,
                "updated_at": current_time
            }

            # 原子写入：先写入临时文件，再重命名
            temp_file_path = self._dynamic_config_path.with_suffix('.tmp')

            with open(temp_file_path, 'w', encoding='utf-8') as f:
                # Manually write file_metadata first
                f.write("file_metadata:\n")
                f.write(f"  created_at: '{file_metadata['created_at']}'\n")
                f.write(f"  updated_at: '{file_metadata['updated_at']}'\n")

                # Then write the rest of the config (only if not empty)
                if normalized_config:
                    f.write("\n")
                    yaml.dump(
                        normalized_config,
                        f,
                        default_flow_style=False,
                        allow_unicode=True,
                        indent=2,
                        sort_keys=False
                    )

            # 原子操作：重命名临时文件
            temp_file_path.rename(self._dynamic_config_path)

            self._logger.info(f"已写入动态配置到: {self._dynamic_config_path}")
            return str(self._dynamic_config_path)

        except Exception as e:
            self._logger.error(f"写入动态配置文件失败: {e}")
            # 清理临时文件
            if 'temp_file_path' in locals() and temp_file_path.exists():
                try:
                    temp_file_path.unlink()
                except:
                    pass
            raise IOError(f"无法写入动态配置文件: {e}")

    def read_models_config(self) -> Optional[Dict[str, Any]]:
        """从动态配置文件中读取models配置段，支持环境变量占位符处理

        注意：此方法专门用于LLMFactory读取models配置段，
        如需读取完整动态配置请使用其他方法

        Returns:
            Optional[Dict[str, Any]]: models配置段字典，如果文件不存在或无models段则返回None
        """
        if not self._dynamic_config_path.exists():
            self._logger.debug(f"动态配置文件不存在: {self._dynamic_config_path}")
            return None

        try:
            with open(self._dynamic_config_path, 'r', encoding='utf-8') as f:
                raw_config = yaml.safe_load(f)

            if not raw_config:
                self._logger.warning(f"动态配置文件为空: {self._dynamic_config_path}")
                return None

            if not isinstance(raw_config, dict) or "models" not in raw_config:
                self._logger.warning(f"动态配置文件格式错误，缺少models段: {self._dynamic_config_path}")
                return None

            # 处理环境变量占位符（复用Config类的实现）
            processed_config = config.process_env_placeholders(raw_config)
            models_config = processed_config.get("models", {})

            if not isinstance(models_config, dict):
                self._logger.warning(f"动态配置文件中models段不是字典格式: {self._dynamic_config_path}")
                return None

            self._logger.debug(f"成功读取动态配置文件: {self._dynamic_config_path}")
            return models_config

        except yaml.YAMLError as e:
            self._logger.error(f"解析动态配置YAML文件失败 {self._dynamic_config_path}: {e}")
            return None
        except Exception as e:
            self._logger.error(f"读取动态配置文件失败 {self._dynamic_config_path}: {e}")
            return None

    def read_dynamic_config(self) -> Optional[Dict[str, Any]]:
        """读取完整的动态配置文件，支持环境变量占位符处理

        Returns:
            Optional[Dict[str, Any]]: 完整的动态配置字典，如果文件不存在则返回None
        """
        if not self._dynamic_config_path.exists():
            self._logger.debug(f"动态配置文件不存在: {self._dynamic_config_path}")
            return None

        try:
            with open(self._dynamic_config_path, 'r', encoding='utf-8') as f:
                raw_config = yaml.safe_load(f)

            if not raw_config:
                self._logger.warning(f"动态配置文件为空: {self._dynamic_config_path}")
                return None

            if not isinstance(raw_config, dict):
                self._logger.warning(f"动态配置文件格式错误，不是字典格式: {self._dynamic_config_path}")
                return None

            # 处理环境变量占位符（复用Config类的实现）
            processed_config = config.process_env_placeholders(raw_config)

            self._logger.debug(f"成功读取完整动态配置文件: {self._dynamic_config_path}")
            return processed_config

        except yaml.YAMLError as e:
            self._logger.error(f"解析动态配置YAML文件失败 {self._dynamic_config_path}: {e}")
            return None
        except Exception as e:
            self._logger.error(f"读取动态配置文件失败 {self._dynamic_config_path}: {e}")
            return None

    def clear_dynamic_config(self) -> bool:
        """清除动态配置文件

        Returns:
            bool: 是否成功清除
        """
        if not self._dynamic_config_path.exists():
            self._logger.debug("动态配置文件不存在，无需清除")
            return True

        try:
            self._dynamic_config_path.unlink()
            self._logger.info(f"已清除动态配置文件: {self._dynamic_config_path}")
            return True
        except Exception as e:
            self._logger.error(f"清除动态配置文件失败: {e}")
            return False

    def has_dynamic_config(self) -> bool:
        """检查是否存在动态配置

        Returns:
            bool: 是否存在动态配置
        """
        return self._dynamic_config_path.exists()

    def get_model_config(self, model_id: str) -> Optional[Dict[str, Any]]:
        """根据模型ID获取单个模型配置（便捷方法）

        Args:
            model_id: 模型ID

        Returns:
            Optional[Dict[str, Any]]: 模型配置字典，如果不存在则返回None
        """
        models_config = self.read_models_config()
        if not models_config:
            return None
        return models_config.get(model_id)

    def has_model(self, model_id: str) -> bool:
        """检查是否存在指定的模型配置（便捷方法）

        Args:
            model_id: 模型ID

        Returns:
            bool: 是否存在该模型配置
        """
        models_config = self.read_models_config()
        if not models_config:
            return False
        return model_id in models_config

    def get_model_ids(self) -> List[str]:
        """获取所有动态配置中的模型ID列表（便捷方法）

        Returns:
            List[str]: 模型ID列表，如果无动态配置则返回空列表
        """
        models_config = self.read_models_config()
        if not models_config:
            return []
        return list(models_config.keys())

    async def validate_and_write_dynamic_config(self, config_data: Any) -> Tuple[bool, str, List[str]]:
        """验证并写入动态配置（异步版本，支持模型信息增强）

        Args:
            config_data: 完整的动态配置，支持多种格式：
                        - dict: 标准配置字典
                        - list/None: 视为空配置，转换为 {}
                        - models段同样支持 dict/list/None

        Returns:
            Tuple[bool, str, List[str]]: (是否成功, 配置文件路径, 警告信息列表)

        Raises:
            IOError: 文件写入失败时抛出
        """
        # 标准化输入配置
        try:
            normalized_config = self._normalize_config_input(config_data)
        except Exception as e:
            self._logger.error(f"配置标准化失败: {e}")
            return False, "", [f"配置标准化失败: {str(e)}"]

        warnings = []
        config_copy = normalized_config.copy()

        # 检查是否包含models配置段
        if "models" not in config_copy:
            self._logger.warning("动态配置缺少'models'配置段，将创建空的models配置")
            config_copy["models"] = {}
            warnings.append("动态配置缺少'models'配置段，已创建空配置")

        models_config = config_copy["models"]
        if not isinstance(models_config, dict):
            self._logger.warning("models配置段不是字典格式，将重置为空字典")
            config_copy["models"] = {}
            models_config = {}
            warnings.append("models配置段格式错误，已重置为空字典")

        # Record user-configured model IDs before enrichment
        user_configured_model_ids = set(models_config.keys()) if models_config else set()

        # Try to enrich model configurations from API
        original_model_count = len(models_config) if models_config else 0
        if models_config:
            try:
                enricher = self._get_model_info_enricher()
                enriched_models, enrich_warnings = await enricher.enrich_models_config(
                    models_config
                )

                # 提取别名映射（不是真正的模型配置，需单独处理）
                model_aliases = enriched_models.pop("__model_aliases__", {})
                if model_aliases:
                    config_copy["model_aliases"] = model_aliases

                models_config = enriched_models
                warnings.extend(enrich_warnings)

                # Calculate auto-discovered models
                total_models = len(enriched_models)
                auto_discovered = total_models - original_model_count

                if auto_discovered > 0:
                    self._logger.info(
                        f"Successfully enriched {total_models} models from API "
                        f"(用户配置: {original_model_count}, 自动发现: {auto_discovered})"
                    )
                else:
                    self._logger.info(f"Successfully enriched {total_models} model configurations from API")
            except Exception as e:
                self._logger.warning(f"Model config enrichment failed, continuing with original config: {e}")
                # Do not throw exception, do not add to warnings

        # 验证和补全每个模型配置（宽容模式）
        validated_models = {}
        for model_id, model_config in models_config.items():
            if not isinstance(model_config, dict):
                self._logger.warning(f"模型 {model_id} 的配置不是字典格式，跳过该模型")
                warnings.append(f"模型 {model_id} 配置格式错误，已跳过")
                continue

            # Check if this is a user-configured model
            is_user_configured = model_id in user_configured_model_ids

            # 验证并补全单个模型配置
            validated_model, model_warnings = self._validate_and_complete_model_config(
                model_id, model_config, is_user_configured
            )
            if validated_model:
                validated_models[model_id] = validated_model
                warnings.extend(model_warnings)
            else:
                warnings.append(f"模型 {model_id} 配置无效，已跳过")

        # 更新配置中的models段
        config_copy["models"] = validated_models

        # 记录处理结果
        if validated_models:
            model_ids = list(validated_models.keys())
            self._logger.info(f"动态配置验证完成，包含 {len(model_ids)} 个有效模型: {model_ids}")
        else:
            self._logger.warning("动态配置验证完成，但没有有效的模型配置")

        # 写入配置文件（异步）
        try:
            config_file_path = await self._write_dynamic_config_async(config_copy)

            # Sync pricing information (async in thread pool)
            await self._sync_models_pricing_async(validated_models)

            return True, config_file_path, warnings
        except Exception as e:
            self._logger.error(f"写入动态配置失败: {e}")
            return False, "", warnings + [f"写入配置失败: {str(e)}"]

    def _validate_and_complete_model_config(
        self,
        model_id: str,
        model_config: Dict[str, Any],
        is_user_configured: bool = True
    ) -> Tuple[Optional[Dict[str, Any]], List[str]]:
        """验证并补全单个模型配置（宽容模式）

        Args:
            model_id: 模型ID
            model_config: 单个模型的配置字典
            is_user_configured: 是否是用户配置的模型（非自动发现的）

        Returns:
            Tuple[Optional[Dict[str, Any]], List[str]]: (验证后的配置或None, 警告信息列表)
        """
        warnings = []
        validated_config = model_config.copy()

        # 验证必需字段
        required_fields = ["api_key", "api_base_url", "name"]
        for field in required_fields:
            if not model_config.get(field):
                self._logger.error(f"模型 {model_id} 缺少必需字段: {field}")
                return None, [f"模型 {model_id} 缺少必需字段: {field}"]

        # 补全可选字段的默认值（优先使用全局配置中同名模型的值）
        defaults = self._get_model_defaults(model_id)

        for field, default_value in defaults.items():
            if field not in validated_config:
                validated_config[field] = default_value
                # 检查默认值来源
                source = "全局配置同名模型" if self._is_from_global_config(model_id, field) else "兜底默认值"
                # Format default value for display
                if isinstance(default_value, dict):
                    value_display = str(default_value)
                elif isinstance(default_value, (list, tuple)):
                    value_display = str(default_value)
                else:
                    value_display = repr(default_value)
                self._logger.debug(f"模型 {model_id}: 字段 '{field}' 缺失，使用{source}: {default_value}")
                warnings.append(f"模型 {model_id}: 字段 '{field}' 使用默认值({source}: {value_display})")

        # 类型转换和范围检查（宽容模式）
        try:
            # 转换数值类型
            if "temperature" in validated_config:
                temp = float(validated_config["temperature"])
                if not (0.0 <= temp <= 2.0):
                    self._logger.warning(f"模型 {model_id}: temperature {temp} 超出建议范围 [0.0, 2.0]，但仍会使用")
                    warnings.append(f"模型 {model_id}: temperature 超出建议范围")
                validated_config["temperature"] = temp

            if "top_p" in validated_config:
                top_p = float(validated_config["top_p"])
                if not (0.0 <= top_p <= 1.0):
                    self._logger.warning(f"模型 {model_id}: top_p {top_p} 超出建议范围 [0.0, 1.0]，但仍会使用")
                    warnings.append(f"模型 {model_id}: top_p 超出建议范围")
                validated_config["top_p"] = top_p

            # Check and enforce minimum token limits (only for user-configured models)
            if is_user_configured:
                MIN_CONTEXT_TOKENS = 120000
                MIN_OUTPUT_TOKENS = 4096
                DEFAULT_CONTEXT_TOKENS = 200000
                DEFAULT_OUTPUT_TOKENS = 4096

                if "max_output_tokens" in validated_config:
                    max_output = int(validated_config["max_output_tokens"])
                    if max_output < MIN_OUTPUT_TOKENS:
                        self._logger.warning(
                            f"模型 {model_id}: max_output_tokens ({max_output}) 低于最低限制 {MIN_OUTPUT_TOKENS}，"
                            f"已自动调整为 {DEFAULT_OUTPUT_TOKENS}"
                        )
                        warnings.append(
                            f"模型 {model_id}: max_output_tokens 低于最低限制 {MIN_OUTPUT_TOKENS}，"
                            f"已调整为 {DEFAULT_OUTPUT_TOKENS}"
                        )
                        validated_config["max_output_tokens"] = DEFAULT_OUTPUT_TOKENS
                    else:
                        validated_config["max_output_tokens"] = max_output

                if "max_context_tokens" in validated_config:
                    max_context = int(validated_config["max_context_tokens"])
                    if max_context < MIN_CONTEXT_TOKENS:
                        self._logger.warning(
                            f"模型 {model_id}: max_context_tokens ({max_context}) 低于最低限制 {MIN_CONTEXT_TOKENS}，"
                            f"已自动调整为 {DEFAULT_CONTEXT_TOKENS}"
                        )
                        warnings.append(
                            f"模型 {model_id}: max_context_tokens 低于最低限制 {MIN_CONTEXT_TOKENS}，"
                            f"已调整为 {DEFAULT_CONTEXT_TOKENS}"
                        )
                        validated_config["max_context_tokens"] = DEFAULT_CONTEXT_TOKENS
                    else:
                        validated_config["max_context_tokens"] = max_context
            else:
                # For auto-discovered models, just convert to int without validation
                if "max_output_tokens" in validated_config:
                    validated_config["max_output_tokens"] = int(validated_config["max_output_tokens"])
                if "max_context_tokens" in validated_config:
                    validated_config["max_context_tokens"] = int(validated_config["max_context_tokens"])

            # 转换布尔类型
            if "supports_tool_use" in validated_config:
                validated_config["supports_tool_use"] = config._convert_value_type(validated_config["supports_tool_use"])

        except (ValueError, TypeError) as e:
            self._logger.warning(f"模型 {model_id}: 类型转换失败: {e}，将使用原始值")
            warnings.append(f"模型 {model_id}: 部分字段类型转换失败")

        # 验证字符串字段（警告但不拒绝）
        string_fields = ["api_key", "api_base_url", "name", "provider"]
        for field in string_fields:
            if field in validated_config and not isinstance(validated_config[field], str):
                validated_config[field] = str(validated_config[field])
                self._logger.debug(f"模型 {model_id}: 字段 '{field}' 已转换为字符串")

        self._logger.debug(f"模型 {model_id} 配置验证完成")
        return validated_config, warnings

    def _get_model_defaults(self, model_id: str) -> Dict[str, Any]:
        """获取模型的默认配置值（优先使用全局配置中的同名模型）

        Args:
            model_id: 模型ID

        Returns:
            Dict[str, Any]: 模型的默认配置字典
        """
        # 硬编码的兜底默认值
        fallback_defaults = {
            "type": "llm",
            "supports_tool_use": True,
            "provider": "openai",
            "max_output_tokens": 8192 * 2,
            "max_context_tokens": 200000,
            "temperature": 0.7,
            "top_p": 1.0,
            "pricing": {
                "input_price": 0.003,
                "output_price": 0.015,
                "cache_write_price": 0.00375,
                "cache_hit_price": 0.0003,
                "currency": "USD"
            }
        }

        try:
            # 尝试从全局配置中获取同名模型的配置
            global_models_config = config.get("models", {})
            if model_id in global_models_config:
                global_model_config = global_models_config[model_id]
                if isinstance(global_model_config, dict):
                    # 使用全局配置作为基础，对缺失字段补充兜底默认值
                    defaults = fallback_defaults.copy()

                    # 更新基本字段
                    for field in ["type", "supports_tool_use", "provider", "max_output_tokens",
                                "max_context_tokens", "temperature", "top_p"]:
                        if field in global_model_config:
                            defaults[field] = global_model_config[field]

                    # 特别处理pricing字段
                    if "pricing" in global_model_config and isinstance(global_model_config["pricing"], dict):
                        # 使用全局配置的pricing，对缺失字段补充默认值
                        global_pricing = global_model_config["pricing"]
                        defaults["pricing"] = fallback_defaults["pricing"].copy()

                        # 安全地更新pricing字段
                        for price_key, price_value in global_pricing.items():
                            if isinstance(price_key, str):  # 确保key是字符串
                                defaults["pricing"][price_key] = price_value

                        self._logger.debug(f"模型 {model_id}: 使用全局配置中的价格信息作为默认值")

                    self._logger.debug(f"模型 {model_id}: 使用全局配置中的同名模型作为默认值基础")
                    return defaults

            # 没有找到全局配置中的同名模型，使用兜底默认值
            self._logger.debug(f"模型 {model_id}: 全局配置中未找到同名模型，使用兜底默认值")
            return fallback_defaults

        except Exception as e:
            self._logger.warning(f"获取模型 {model_id} 默认配置时出错: {e}，使用兜底默认值")
            return fallback_defaults

    def _is_from_global_config(self, model_id: str, field: str) -> bool:
        """判断指定字段是否来自全局配置中的同名模型

        Args:
            model_id: 模型ID
            field: 字段名

        Returns:
            bool: 是否来自全局配置
        """
        try:
            global_models_config = config.get("models", {})
            if model_id in global_models_config:
                global_model_config = global_models_config[model_id]
                if isinstance(global_model_config, dict):
                    # 检查基本字段
                    if field in global_model_config:
                        return True
                    # 检查pricing字段
                    if field == "pricing" and "pricing" in global_model_config:
                        return True
            return False
        except Exception:
            return False

    def _sync_models_pricing(self, models_config: Dict[str, Dict[str, Any]]) -> None:
        """同步所有动态模型的价格信息到ModelPricing系统

        Args:
            models_config: 验证后的模型配置字典
        """
        if not models_config:
            self._logger.debug("无动态模型配置，跳过价格同步")
            return

        try:
            # 导入所需的模块（延迟导入避免循环依赖）
            from agentlang.llms.factory import LLMFactory
            from agentlang.llms.token_usage.pricing import PricingInfo

            synced_count = 0

            for model_id, model_config in models_config.items():
                try:
                    # 检查是否包含价格信息
                    if "pricing" not in model_config:
                        self._logger.debug(f"模型 {model_id} 配置中无价格信息，跳过")
                        continue

                    pricing_data = model_config["pricing"]
                    if not isinstance(pricing_data, dict):
                        self._logger.warning(f"模型 {model_id} 的价格信息格式不正确，跳过")
                        continue

                    # 构建价格信息对象
                    price_info: PricingInfo = {}

                    # 添加基本价格
                    if "input_price" in pricing_data:
                        price_info["input_price"] = float(pricing_data["input_price"])
                    if "output_price" in pricing_data:
                        price_info["output_price"] = float(pricing_data["output_price"])

                    # 添加缓存价格（如果存在）
                    if "cache_write_price" in pricing_data:
                        price_info["cache_write_price"] = float(pricing_data["cache_write_price"])
                    if "cache_hit_price" in pricing_data:
                        price_info["cache_hit_price"] = float(pricing_data["cache_hit_price"])

                    # 添加货币
                    price_info["currency"] = pricing_data.get("currency", "USD")

                    # 添加到ModelPricing系统
                    LLMFactory.pricing.add_model_pricing(model_id, price_info)
                    synced_count += 1

                    self._logger.debug(f"已同步模型 {model_id} 的价格信息: "
                                     f"input=${price_info.get('input_price', 0):.4f}, "
                                     f"output=${price_info.get('output_price', 0):.4f} "
                                     f"{price_info.get('currency', 'USD')}")

                except Exception as e:
                    self._logger.warning(f"同步模型 {model_id} 价格信息失败: {e}")
                    continue

            if synced_count > 0:
                self._logger.info(f"已同步 {synced_count} 个动态模型的价格信息到ModelPricing系统")
            else:
                self._logger.debug("无有效的价格信息需要同步")

        except Exception as e:
            self._logger.warning(f"同步动态模型价格信息失败: {e}")
            # 不抛出异常，避免影响主流程

    def _get_model_info_enricher(self):
        """Get model info enricher instance (singleton)

        Returns:
            ModelInfoEnricher: The enricher instance
        """
        if self._model_info_enricher is None:
            from agentlang.config.model_info_enricher import ModelInfoEnricher
            self._model_info_enricher = ModelInfoEnricher(logger=self._logger)
        return self._model_info_enricher

    async def _write_dynamic_config_async(self, config_data: Dict[str, Any]) -> str:
        """Asynchronously write dynamic configuration file

        Uses aiofiles for async file operations
        Automatically adds file_metadata with created_at and updated_at timestamps

        Args:
            config_data: Configuration data to write

        Returns:
            str: Configuration file path

        Raises:
            IOError: If file write fails
        """
        import aiofiles
        from datetime import datetime, timezone, timedelta

        try:
            # Ensure config directory exists
            config_dir = self._dynamic_config_path.parent
            config_dir.mkdir(parents=True, exist_ok=True)

            # Use UTC+8 timezone (China Standard Time)
            tz_utc8 = timezone(timedelta(hours=8))
            current_time = datetime.now(tz_utc8).isoformat()

            # Read existing file to preserve created_at timestamp
            existing_created_at = None
            if self._dynamic_config_path.exists():
                try:
                    async with aiofiles.open(self._dynamic_config_path, 'r', encoding='utf-8') as f:
                        content = await f.read()
                        existing_config = yaml.safe_load(content)
                        if existing_config and isinstance(existing_config, dict):
                            file_metadata = existing_config.get("file_metadata", {})
                            old_created_at = file_metadata.get("created_at")

                            # Convert old timestamp to UTC+8 if needed
                            if old_created_at:
                                try:
                                    # Parse the ISO format timestamp
                                    old_dt = datetime.fromisoformat(old_created_at.replace('Z', '+00:00'))
                                    # Convert to UTC+8 timezone
                                    existing_created_at = old_dt.astimezone(tz_utc8).isoformat()
                                except Exception as parse_error:
                                    self._logger.debug(f"无法转换创建时间格式: {parse_error}，使用原值")
                                    existing_created_at = old_created_at
                except Exception as e:
                    self._logger.debug(f"无法读取现有配置文件的创建时间: {e}")

            # Prepare file_metadata
            file_metadata = {
                "created_at": existing_created_at or current_time,
                "updated_at": current_time
            }

            # Atomic write: write to temp file first, then rename
            temp_file_path = self._dynamic_config_path.with_suffix('.tmp')

            # Asynchronously write file
            async with aiofiles.open(temp_file_path, 'w', encoding='utf-8') as f:
                # Manually write file_metadata first
                await f.write("file_metadata:\n")
                await f.write(f"  created_at: '{file_metadata['created_at']}'\n")
                await f.write(f"  updated_at: '{file_metadata['updated_at']}'\n")

                # Then write the rest of the config (only if not empty)
                if config_data:
                    await f.write("\n")
                    yaml_content = yaml.dump(
                        config_data,
                        default_flow_style=False,
                        allow_unicode=True,
                        indent=2,
                        sort_keys=False
                    )
                    await f.write(yaml_content)

            # Atomic operation: rename temp file (synchronous, but fast)
            temp_file_path.rename(self._dynamic_config_path)

            self._logger.info(f"已写入动态配置到: {self._dynamic_config_path}")
            return str(self._dynamic_config_path)

        except Exception as e:
            self._logger.error(f"写入动态配置文件失败: {e}")
            # Cleanup temp file
            if temp_file_path.exists():
                try:
                    temp_file_path.unlink()
                except:
                    pass
            raise

    async def _sync_models_pricing_async(self, validated_models: Dict[str, Any]):
        """Asynchronously sync model pricing information to ModelPricing

        Note: If _sync_models_pricing is synchronous, run it in thread pool

        Args:
            validated_models: Validated models configuration
        """
        import asyncio

        # Run synchronous method in thread pool
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,  # Use default thread pool
            self._sync_models_pricing,
            validated_models
        )

    # 注意：环境变量处理、字符串占位符解析、类型转换等工具方法
    # 直接复用全局配置实例 config 的实现，避免代码重复


# 全局实例
dynamic_config = DynamicConfig()
