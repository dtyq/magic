import os
import re
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Dict, Generic, Optional, Type, TypeVar

import yaml
from pydantic import BaseModel

from agentlang.context.application_context import ApplicationContext
from agentlang.logger import get_logger

T = TypeVar("T", bound=BaseModel)

_SIZE_VALUE_PATTERN = re.compile(
    r"^\s*(?P<number>(?:\d+(?:\.\d*)?|\.\d+))\s*(?P<unit>[A-Za-z]+)?\s*$"
)
_SIZE_UNIT_FACTORS: dict[str, int] = {
    "B": 1,
    "KB": 1024,
    "KIB": 1024,
    "MB": 1024**2,
    "MIB": 1024**2,
    "GB": 1024**3,
    "GIB": 1024**3,
    "TB": 1024**4,
    "TIB": 1024**4,
}


def parse_size_bytes(value: int | float | str) -> int:
    """Parse a human-readable size value into bytes."""
    if isinstance(value, bool):
        raise ValueError(f"Boolean is not a valid size: {value!r}")

    if isinstance(value, int):
        if value < 0:
            raise ValueError(f"Size must not be negative: {value!r}")
        return value

    if isinstance(value, float):
        if value != value or value in {float("inf"), float("-inf")}:
            raise ValueError(f"Size must be finite: {value!r}")
        numeric_value = Decimal(str(value))
        factor = 1
    elif isinstance(value, str):
        match = _SIZE_VALUE_PATTERN.fullmatch(value)
        if match is None:
            raise ValueError(f"Invalid size value: {value!r}")
        try:
            numeric_value = Decimal(match.group("number"))
        except InvalidOperation as exc:
            raise ValueError(f"Invalid size value: {value!r}") from exc
        unit = (match.group("unit") or "B").upper()
        factor = _SIZE_UNIT_FACTORS.get(unit)
        if factor is None:
            raise ValueError(f"Unsupported size unit {unit!r} in {value!r}")
    else:
        raise ValueError(f"Unsupported size value type: {type(value).__name__}")

    if numeric_value < 0:
        raise ValueError(f"Size must not be negative: {value!r}")
    return int((numeric_value * factor).to_integral_value(rounding=ROUND_HALF_UP))


class Config(Generic[T]):
    """配置管理器，支持 YAML 配置文件和 Pydantic 模型验证"""

    _instance = None
    _config: Dict[str, Any] = {}
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
            self._config_loaded = True
            return

        self._config_path = config_path
        self._raw_config = self._merge_local_model_config(config_path, self._raw_config)

        # 处理配置中的环境变量占位符
        self._config = self._process_env_placeholders(self._raw_config)
        self._config_loaded = True

        # 如果提供了模型类，进行验证
        if model is not None:
            try:
                self._model = model(**self._config)
                # 更新配置字典，确保所有默认值都被包含
                self._config = self._model.model_dump()
            except Exception as e:
                self._logger.error(f"使用 Pydantic 模型验证配置失败: {e}")
                self._model = None

    def _merge_local_model_config(self, config_path: str, base_config: Any) -> Any:
        """合并同目录 config.local.yaml 中的本地 provider/profile 配置"""
        if not isinstance(base_config, dict):
            return base_config

        local_config_path = Path(config_path).with_name("config.local.yaml")
        if not local_config_path.exists():
            return base_config

        try:
            with open(local_config_path, "r", encoding="utf-8") as f:
                local_config = yaml.safe_load(f) or {}
        except Exception as e:
            self._logger.error(f"加载或解析本地配置文件失败 {local_config_path}: {e}，将忽略本地模型配置")
            return base_config

        if not isinstance(local_config, dict):
            self._logger.warning(f"本地配置文件 {local_config_path} 不是字典格式，将忽略本地模型配置")
            return base_config

        self._merge_local_dict_section(
            base_config=base_config,
            local_config=local_config,
            section="providers",
            local_config_path=local_config_path,
        )
        self._merge_local_dict_section(
            base_config=base_config,
            local_config=local_config,
            section="model_profiles",
            local_config_path=local_config_path,
        )
        self._merge_local_default_model(
            base_config=base_config,
            local_config=local_config,
            local_config_path=local_config_path,
        )
        self._logger.info(f"已合并本地模型配置: {local_config_path}")
        return base_config

    def _merge_local_dict_section(
        self,
        *,
        base_config: Dict[str, Any],
        local_config: Dict[str, Any],
        section: str,
        local_config_path: Path,
    ) -> None:
        """按顶层 section 合并本地字典配置，同名叶子节点由本地配置覆盖。"""
        local_section = local_config.get(section)
        if local_section is None:
            return
        if not isinstance(local_section, dict):
            self._logger.warning(f"本地配置文件 {local_config_path} 的 '{section}' 不是字典格式，将忽略")
            return

        base_section = base_config.get(section)
        if base_section is None:
            base_config[section] = dict(local_section)
            return
        if not isinstance(base_section, dict):
            self._logger.warning(f"默认配置中的 '{section}' 不是字典格式，将忽略本地配置")
            return

        self._merge_dict(base_section, local_section)

    def _merge_dict(self, base: Dict[str, Any], override: Dict[str, Any]) -> None:
        """递归合并字典，保留默认 provider 字段并允许本地补充 models。"""
        for key, value in override.items():
            current = base.get(key)
            if isinstance(current, dict) and isinstance(value, dict):
                self._merge_dict(current, value)
            else:
                base[key] = value

    def _merge_local_default_model(
        self,
        *,
        base_config: Dict[str, Any],
        local_config: Dict[str, Any],
        local_config_path: Path,
    ) -> None:
        """允许本地私有模型把 default_model 指向本地 provider 中的模型入口。"""
        if "default_model" not in local_config:
            return

        value = local_config.get("default_model")
        if not isinstance(value, str) or not value.strip():
            self._logger.warning(f"本地配置文件 {local_config_path} 的 'default_model' 不是非空字符串，将忽略")
            return

        base_config["default_model"] = value

    def get_model(self) -> Optional[T]:
        """获取验证后的 Pydantic 模型实例"""
        self._ensure_config_loaded()
        return self._model

    def get(self, key_path: str, default: Any = None) -> Any:
        """获取配置值，支持点号路径。

        Args:
            key_path: 配置键路径，例如 'openai.api_key'
            default: 默认值，当配置项不存在时返回

        Returns:
            配置值或默认值
        """
        self._ensure_config_loaded()

        if not key_path:
            return default

        current = self._config
        try:
            for key in key_path.split("."):
                if isinstance(current, dict) and key in current:
                    current = current[key]
                elif isinstance(current, list):
                    index = int(key)
                    if 0 <= index < len(current):
                        current = current[index]
                    else:
                        return default
                else:
                    return default
        except (TypeError, ValueError, IndexError):
            return default

        return current

    def get_size_bytes(self, key_path: str, default: int | str | float | None = None) -> int | None:
        """Read a size configuration value and convert it to bytes."""
        value = self.get(key_path, default)
        if value is None:
            return None
        try:
            return parse_size_bytes(value)
        except ValueError as exc:
            raise ValueError(f"Invalid size configuration {key_path}={value!r}: {exc}") from exc

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

        仅对完整环境变量占位符的解析结果进行数据类型转换，普通 YAML 字符串保持原样:
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
        """仅转换完整环境变量占位符的结果，保留 YAML 已确定的字符串类型。"""
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
            # 例：YAML 的 "4.10"、"00123"、"false"、"" 都是文本，不能再次猜成数值、开关或 None。
            # 原生数值／布尔由 YAML 解析；环境变量结果仍在上面的分支转换。
            return value

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
