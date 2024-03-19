import os
import re
from typing import Any, Dict, Generic, Optional, Type, TypeVar
from pathlib import Path

import yaml
from pydantic import BaseModel

from agentlang.context.application_context import ApplicationContext
from agentlang.logger import get_logger

T = TypeVar("T", bound=BaseModel)


class Config(Generic[T]):
    """配置管理器，支持 YAML 配置文件、Pydantic 模型验证和 Agent 模式切换"""

    _instance = None
    _config: Dict[str, Any] = {}
    _model_aliases: Dict[str, str] = {}
    _model: Optional[T] = None
    _logger = get_logger("agentlang.config.config_manager")
    _config_loaded = False
    _config_path = None
    _raw_config: Dict[str, Any] = {} # 保存原始加载的配置，用于 reload

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Config, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        self.load_config()

    def set(self, key_path: str, value: Any) -> None:
        """设置配置值，支持使用点号(.)表示层级关系

        Args:
            key_path: 配置键路径，例如 'openai.api_key'
            value: 要设置的值
        """
        if not key_path:
            return

        # 将点号分隔的路径转换为键列表
        keys = key_path.split(".")

        # 从配置字典中逐层设置值
        current = self._config
        for key in keys[:-1]:
            current = current.setdefault(key, {})
        current[keys[-1]] = value

        # 重新加载模型别名，因为相关配置可能已更改
        self._load_model_aliases()

        # 如果有模型类，重新验证
        if self._model is not None:
            self._model = self._model.__class__(**self._config)

    def _ensure_config_loaded(self) -> None:
        """确保配置已加载，如果未加载则进行加载"""
        if not self._config_loaded:
            self.load_config()
            self._config_loaded = True

    def load_config(self, config_path: Optional[str] = None, model: Optional[Type[T]] = None) -> None:
        """加载配置文件并处理模式

        Args:
            config_path: 配置文件路径，如果为 None 则自动寻找
            model: Pydantic 模型类，用于配置验证
        """
        # 尝试确定配置文件路径
        if config_path is None:
            # 尝试从环境变量获取配置路径
            config_path = os.getenv("CONFIG_PATH")

            # 如果环境变量中没有配置路径，尝试从项目根目录确定
            if not config_path:
                try:
                    # 优先使用 ApplicationContext 获取路径管理器
                    path_manager = ApplicationContext.get_path_manager()
                    config_path = str(path_manager.get_project_root() / "config/config.yaml")
                    self._logger.info(f"通过 ApplicationContext 确定配置路径: {config_path}")
                except (ImportError, AttributeError, RuntimeError) as e:
                    self._logger.debug(f"无法通过 ApplicationContext 获取路径: {e}")

                # 如果仍然无法确定配置路径，使用空配置
                if not config_path or not os.path.exists(config_path):
                    config_file_found = False
                else:
                    config_file_found = True
            else:
                config_file_found = os.path.exists(config_path)
        else:
            config_file_found = os.path.exists(config_path)

        # 处理配置文件不存在的情况
        if not config_file_found:
            if config_path:
                self._logger.warning(f"配置文件不存在: {config_path}，将使用空配置")
            else:
                self._logger.warning("无法确定配置文件路径，将使用空配置")
            self._config = {}
            self._raw_config = {}
            self._model_aliases = {}
            self._config_loaded = True
            return

        try:
            # 加载 YAML 配置
            with open(config_path, "r", encoding="utf-8") as f:
                self._raw_config = yaml.safe_load(f) or {}
        except Exception as e:
            self._logger.error(f"加载或解析配置文件失败 {config_path}: {e}")
            self._config = {}
            self._raw_config = {}
            self._model_aliases = {}
            self._config_loaded = True
            return

        # 处理配置中的环境变量占位符
        self._config = self._process_env_placeholders(self._raw_config)
        self._config_loaded = True

        # 加载模型别名（基于处理后的配置，特别是 active_agent_mode）
        self._load_model_aliases()

        # 如果提供了模型类，进行验证
        if model is not None:
            try:
                self._model = model(**self._config)
                # 更新配置字典，确保所有默认值都被包含
                self._config = self._model.model_dump()
                # 重新加载别名以防 Pydantic 模型有影响
                self._load_model_aliases()
            except Exception as e:
                self._logger.error(f"使用 Pydantic 模型验证配置失败: {e}")
                self._model = None

    def _load_model_aliases(self) -> None:
        """根据当前激活的模式加载和解析模型别名"""
        if not self._config:
            self._logger.debug("配置尚未加载，无法加载模型别名。")
            self._model_aliases = {}
            return

        # 获取激活模式名称，默认为 'apex'
        active_mode_name = self.get('active_agent_mode', 'apex')
        self._logger.info(f"当前活动的 Agent 模式: {active_mode_name}")

        agent_modes_config = self.get('agent_modes', {})
        if not isinstance(agent_modes_config, dict):
            self._logger.warning("'agent_modes' 配置不是字典格式，将忽略模式配置。")
            agent_modes_config = {}

        active_mode_data = agent_modes_config.get(active_mode_name, {})
        if not isinstance(active_mode_data, dict):
             self._logger.warning(f"模式 '{active_mode_name}' 的配置不是字典格式，将忽略。")
             active_mode_data = {}

        if not active_mode_data and active_mode_name != 'apex': # 如果指定模式不存在且不是默认的apex
            self._logger.warning(f"未找到名为 '{active_mode_name}' 的 Agent 模式配置。将检查是否存在全局默认别名。")

        # 从激活的模式中获取别名配置
        mode_aliases = active_mode_data.get('model_aliases', {})
        if not isinstance(mode_aliases, dict):
            self._logger.warning(f"模式 '{active_mode_name}' 中的 'model_aliases' 不是字典格式，将忽略。")
            mode_aliases = {}

        # (可选) 获取全局默认别名作为基础
        fallback_aliases = self.get('model_aliases', {})
        if not isinstance(fallback_aliases, dict):
             self._logger.warning("全局 'model_aliases' 配置不是字典格式，将忽略。")
             fallback_aliases = {}

        # 合并：模式别名优先于全局别名
        combined_aliases = {**fallback_aliases, **mode_aliases}

        final_aliases = {}
        # 处理环境变量覆盖
        for alias_key, model_in_config in combined_aliases.items():
            # 构造对应的环境变量名 (e.g., main_llm -> MAIN_LLM)
            env_var_name = alias_key.upper()
            env_value = os.getenv(env_var_name)

            if env_value:
                resolved_model = self._convert_value_type(env_value)
                final_aliases[alias_key] = resolved_model
                if resolved_model != model_in_config:
                     self._logger.debug(f"模型别名 '{alias_key}' (模式 '{active_mode_name}') 被环境变量 '{env_var_name}' 覆盖为 '{resolved_model}' (原为 '{model_in_config}')")
                else:
                     self._logger.debug(f"模型别名 '{alias_key}' (模式 '{active_mode_name}') 由环境变量 '{env_var_name}' 确认为 '{resolved_model}'")
            else:
                final_aliases[alias_key] = model_in_config # 使用配置文件中的值
                self._logger.debug(f"模型别名 '{alias_key}' 使用模式 '{active_mode_name}' (或默认) 配置为 '{model_in_config}'")

        # 检查是否有仅通过环境变量定义的别名 (例如，如果设置了 FOO_LLM 但配置文件没有 foo_llm)
        for env_key, env_val in os.environ.items():
            # 简单的启发式检查，可能需要根据实际命名调整
            if env_key.endswith("_LLM") and not env_key.startswith("_"):
                potential_alias_key = env_key.lower()
                if potential_alias_key not in final_aliases:
                    resolved_model = self._convert_value_type(env_val)
                    final_aliases[potential_alias_key] = resolved_model
                    self._logger.debug(f"模型别名 '{potential_alias_key}' 直接从环境变量 '{env_key}' 添加，值为 '{resolved_model}'")

        self._model_aliases = final_aliases
        self._logger.info(f"最终加载的模型别名 ({active_mode_name} 模式): {self._model_aliases}")

    def get_model(self) -> Optional[T]:
        """获取验证后的 Pydantic 模型实例"""
        self._ensure_config_loaded()
        return self._model

    def get(self, key_path: str, default: Any = None) -> Any:
        """获取配置值，支持点号路径，并考虑模式覆盖

        Args:
            key_path: 配置键路径，例如 'openai.api_key'
            default: 默认值，当配置项不存在时返回

        Returns:
            配置值或默认值
        """
        self._ensure_config_loaded()

        if not key_path:
            return default

        keys = key_path.split(".")

        # 优先尝试从当前激活模式获取值
        active_mode_name = self._config.get('active_agent_mode', 'apex')
        mode_config = self._config.get('agent_modes', {}).get(active_mode_name, {})

        current_mode = mode_config
        found_in_mode = True
        try:
            for key in keys:
                if isinstance(current_mode, dict) and key in current_mode:
                    current_mode = current_mode[key]
                elif isinstance(current_mode, list):
                     index = int(key)
                     if 0 <= index < len(current_mode):
                         current_mode = current_mode[index]
                     else:
                        found_in_mode = False
                        break
                else:
                    found_in_mode = False
                    break
        except (TypeError, ValueError, IndexError):
            found_in_mode = False

        if found_in_mode:
             return current_mode

        # 如果模式中没找到，再从全局配置查找
        current_global = self._config
        found_in_global = True
        try:
             for key in keys:
                if isinstance(current_global, dict) and key in current_global:
                    current_global = current_global[key]
                elif isinstance(current_global, list):
                    index = int(key)
                    if 0 <= index < len(current_global):
                        current_global = current_global[index]
                    else:
                        found_in_global = False
                        break
                else:
                    found_in_global = False
                    break
        except (TypeError, ValueError, IndexError):
             found_in_global = False

        if found_in_global:
            return current_global

        return default

    def resolve_model_alias(self, alias_or_model_name: str) -> str:
        """解析模型别名或返回原始名称

        Args:
            alias_or_model_name: 模型别名或实际模型名称

        Returns:
            解析后的实际模型名称
        """
        self._ensure_config_loaded() # 确保别名已加载
        resolved_name = self._model_aliases.get(alias_or_model_name, alias_or_model_name)

        if resolved_name != alias_or_model_name:
            self._logger.debug(f"模型别名 '{alias_or_model_name}' 解析为 '{resolved_name}'")

        # 直接检查模型定义是否存在于 self._config['models']
        models_dict = self._config.get('models', {}) # 直接获取 models 字典
        if not isinstance(models_dict, dict):
             self._logger.error("配置结构错误: 'models' 键丢失或不是字典格式。")
             # 返回一个明确的错误标识，方便下游处理
             return "error-config-models-missing"
        if resolved_name not in models_dict:
             self._logger.error(f"致命错误：解析或直接使用的模型名称 '{resolved_name}' (来自别名 '{alias_or_model_name}') 在 config.models 中没有定义！请检查配置文件。")
             # 返回一个明确的错误标识
             return "error-model-not-defined"

        return resolved_name

    def reload_config(self) -> None:
        """重新加载配置，会重新处理环境变量和模式"""
        self._logger.info("正在重新加载配置...")

        if self._config_path and os.path.exists(self._config_path):
            self.load_config(config_path=self._config_path)
        else:
            self._config_loaded = False
            self.load_config()

        self._logger.info("配置重新加载完成")

    def process_env_placeholders(self, config_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Public method to process environment variable placeholders in configuration

        Supports two formats:
        1. ${ENV_VAR} - Get value from environment variable, no default
        2. ${ENV_VAR:-default} - Get value from environment, use default if not exists

        Args:
            config_dict: Configuration dictionary that may contain placeholders

        Returns:
            Configuration dictionary with placeholders resolved to actual values
        """
        return self._process_env_placeholders(config_dict)

    def _process_env_placeholders(self, config_dict: Dict[str, Any]) -> Dict[str, Any]:
        """处理配置中的环境变量占位符

        支持两种格式:
        1. ${ENV_VAR} - 从环境变量获取值，无默认值
        2. ${ENV_VAR:-default} - 从环境变量获取值，如果不存在则使用默认值

        同时会进行数据类型转换:
        - 如果值为 "true" 或 "false"，会转换为对应的布尔值
        - 如果值看起来像数字，会转换为对应的数字类型

        Args:
            config_dict: 原始配置字典

        Returns:
            处理后的配置字典
        """
        if not isinstance(config_dict, dict):
            return config_dict

        result = {}
        for key, value in config_dict.items():
            if isinstance(value, dict):
                # 递归处理嵌套字典
                result[key] = self._process_env_placeholders(value)
            elif isinstance(value, list):
                # 递归处理列表中的字典或字符串
                result[key] = [self._process_env_placeholders(item) if isinstance(item, dict) else self._process_string_placeholder(item) if isinstance(item, str) else item for item in value]
            elif isinstance(value, str):
                # 处理字符串中的环境变量占位符
                result[key] = self._process_string_placeholder(value)
            else:
                # 非字符串/字典/列表值直接保留
                result[key] = value

        return result

    def _process_string_placeholder(self, value: str) -> Any:
        """处理字符串中的环境变量占位符并转换类型"""
        pattern = r"\${([A-Za-z0-9_]+)(?::-([^}]*))?\}"
        match = re.fullmatch(pattern, value)
        if match:
            env_var = match.group(1)
            default_value = match.group(2) if match.group(2) is not None else ""

            # 从环境变量获取值，如果不存在则使用默认值
            env_value = os.getenv(env_var)
            if env_value is not None:
                return self._convert_value_type(env_value)
            else:
                return self._convert_value_type(default_value)
        else:
            # 如果字符串不是 ${ENV_VAR:-default} 格式，仍然尝试类型转换
            return self._convert_value_type(value)

    def _convert_value_type(self, value: Any) -> Any:
        """转换值的数据类型

        - 将 "true"/"false" 转换为布尔值
        - 将数字字符串转换为整数或浮点数

        Args:
            value: 要转换的字符串值

        Returns:
            转换后的值
        """
        if not isinstance(value, str): # 如果已经是其他类型，直接返回
            return value

        # 处理布尔值
        val_lower = value.lower()
        if val_lower == "true":
            return True
        elif val_lower == "false":
            return False
        elif val_lower == "none" or value == "": # 处理 "none" 和空字符串
            return None # 或者根据需要返回 ""

        # 处理数字
        try:
            # 尝试转换为整数
            if value.isdigit() or (value.startswith("-") and value[1:].isdigit()):
                return int(value)

            # 尝试转换为浮点数
            if "." in value:
                float_val = float(value)
                # 检查是否是整数值的浮点数（如 5.0）
                if float_val.is_integer():
                    return int(float_val)
                return float_val
        except (ValueError, TypeError):
            pass

        # 无法转换，返回原始值
        return value

# 创建全局配置管理器实例
config = Config()
