import yaml
from typing import Dict, Any, Optional, List, Tuple
from pathlib import Path

from agentlang.context.application_context import ApplicationContext
from agentlang.logger import get_logger
from agentlang.config.config import config  # 复用工具方法（环境变量处理等）


class DynamicConfig:
    """动态配置管理器 - 负责动态配置文件（dynamic_config.yaml）的读写管理

    只处理 ai_abilities、non_human_options 等非模型配置段。
    模型配置由 ModelConfigManager 统一管理，不再写入此文件。
    """

    DYNAMIC_CONFIG_FILE = "dynamic_config.yaml"

    _instance = None
    _logger = get_logger("agentlang.config.dynamic_config")

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DynamicConfig, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, "_initialized"):
            self._dynamic_config_path = self._get_dynamic_config_path()
            self._initialized = True

    def _get_dynamic_config_path(self) -> Path:
        """获取动态配置文件路径"""
        try:
            path_manager = ApplicationContext.get_path_manager()
            project_root = path_manager.get_project_root()
            config_dir = project_root / "config"
            dynamic_config_path = config_dir / self.DYNAMIC_CONFIG_FILE
            self._logger.debug(f"通过 ApplicationContext 确定动态配置路径: {dynamic_config_path}")
            return dynamic_config_path
        except (ImportError, AttributeError, RuntimeError) as e:
            self._logger.debug(f"无法通过 ApplicationContext 获取路径: {e}")
            config_dir = Path.cwd() / "config"
            dynamic_config_path = config_dir / self.DYNAMIC_CONFIG_FILE
            self._logger.debug(f"使用当前工作目录下的config目录: {dynamic_config_path}")
            return dynamic_config_path

    def _normalize_config_input(self, config_data: Any) -> Dict[str, Any]:
        """标准化配置输入，支持多种格式的空配置

        Args:
            config_data: 输入配置，支持 dict, list, None 等格式

        Returns:
            Dict[str, Any]: 标准化后的配置字典（{}、[]、null 均转换为 {}）
        """
        if config_data is None or config_data == [] or config_data == {}:
            return {}
        if not isinstance(config_data, dict):
            self._logger.info(f"Unsupported config format {type(config_data)}, converting to empty config")
            return {}
        return dict(config_data)

    def write_dynamic_config(self, config_data: Any) -> str:
        """写入完整的动态配置（同步版，内部备用）

        Args:
            config_data: 完整的动态配置

        Returns:
            str: 配置文件路径

        Raises:
            IOError: 文件写入失败
        """
        from datetime import datetime, timezone, timedelta

        normalized_config = self._normalize_config_input(config_data)

        try:
            config_dir = self._dynamic_config_path.parent
            config_dir.mkdir(parents=True, exist_ok=True)

            tz_utc8 = timezone(timedelta(hours=8))
            current_time = datetime.now(tz_utc8).isoformat()

            existing_created_at = None
            if self._dynamic_config_path.exists():
                try:
                    with open(self._dynamic_config_path, "r", encoding="utf-8") as f:
                        existing_config = yaml.safe_load(f)
                        if existing_config and isinstance(existing_config, dict):
                            file_metadata = existing_config.get("file_metadata", {})
                            old_created_at = file_metadata.get("created_at")
                            if old_created_at:
                                try:
                                    old_dt = datetime.fromisoformat(old_created_at.replace("Z", "+00:00"))
                                    existing_created_at = old_dt.astimezone(tz_utc8).isoformat()
                                except Exception as parse_error:
                                    self._logger.debug(f"Cannot convert created_at: {parse_error}")
                                    existing_created_at = old_created_at
                except Exception as e:
                    self._logger.debug(f"Cannot read existing config created_at: {e}")

            file_metadata = {
                "created_at": existing_created_at or current_time,
                "updated_at": current_time,
            }

            temp_file_path = self._dynamic_config_path.with_suffix(".tmp")
            with open(temp_file_path, "w", encoding="utf-8") as f:
                f.write("file_metadata:\n")
                f.write(f"  created_at: '{file_metadata['created_at']}'\n")
                f.write(f"  updated_at: '{file_metadata['updated_at']}'\n")
                if normalized_config:
                    f.write("\n")
                    yaml.dump(
                        normalized_config,
                        f,
                        default_flow_style=False,
                        allow_unicode=True,
                        indent=2,
                        sort_keys=False,
                    )

            temp_file_path.rename(self._dynamic_config_path)
            self._logger.info(f"Dynamic config written to: {self._dynamic_config_path}")
            return str(self._dynamic_config_path)

        except Exception as e:
            self._logger.error(f"Failed to write dynamic config: {e}")
            if "temp_file_path" in locals() and temp_file_path.exists():
                try:
                    temp_file_path.unlink()
                except Exception:
                    pass
            raise IOError(f"Cannot write dynamic config file: {e}")

    def read_dynamic_config(self) -> Optional[Dict[str, Any]]:
        """读取完整的动态配置文件，支持环境变量占位符处理

        Returns:
            Optional[Dict[str, Any]]: 完整的动态配置字典，如果文件不存在则返回 None
        """
        if not self._dynamic_config_path.exists():
            self._logger.debug(f"Dynamic config file not found: {self._dynamic_config_path}")
            return None

        try:
            with open(self._dynamic_config_path, "r", encoding="utf-8") as f:
                raw_config = yaml.safe_load(f)

            if not raw_config:
                self._logger.warning(f"Dynamic config file is empty: {self._dynamic_config_path}")
                return None

            if not isinstance(raw_config, dict):
                self._logger.warning(f"Dynamic config file format error: {self._dynamic_config_path}")
                return None

            processed_config = config.process_env_placeholders(raw_config)
            self._logger.debug(f"Dynamic config loaded: {self._dynamic_config_path}")
            return processed_config

        except yaml.YAMLError as e:
            self._logger.error(f"Failed to parse dynamic config YAML {self._dynamic_config_path}: {e}")
            return None
        except Exception as e:
            self._logger.error(f"Failed to read dynamic config {self._dynamic_config_path}: {e}")
            return None

    def clear_dynamic_config(self) -> bool:
        """清除动态配置文件

        Returns:
            bool: 是否成功清除
        """
        if not self._dynamic_config_path.exists():
            self._logger.debug("Dynamic config file not found, nothing to clear")
            return True

        try:
            self._dynamic_config_path.unlink()
            self._logger.info(f"Dynamic config cleared: {self._dynamic_config_path}")
            return True
        except Exception as e:
            self._logger.error(f"Failed to clear dynamic config: {e}")
            return False

    def has_dynamic_config(self) -> bool:
        """检查是否存在动态配置

        Returns:
            bool: 是否存在动态配置文件
        """
        return self._dynamic_config_path.exists()

    async def validate_and_write_dynamic_config(self, config_data: Any) -> Tuple[bool, str, List[str]]:
        """验证并写入动态配置（异步）

        models 段已由 ModelConfigManager 管理，调用方应在写入前剥离该键。

        Args:
            config_data: 动态配置数据（dict/list/None），不含 models 段

        Returns:
            Tuple[bool, str, List[str]]: (是否成功, 配置文件路径, 警告信息列表)
        """
        try:
            normalized_config = self._normalize_config_input(config_data)
        except Exception as e:
            self._logger.error(f"Config normalization failed: {e}")
            return False, "", [f"Config normalization failed: {str(e)}"]

        warnings: List[str] = []

        try:
            config_file_path = await self._write_dynamic_config_async(normalized_config)
            return True, config_file_path, warnings
        except Exception as e:
            self._logger.error(f"Failed to write dynamic config: {e}")
            return False, "", warnings + [f"Write failed: {str(e)}"]

    async def _write_dynamic_config_async(self, config_data: Dict[str, Any]) -> str:
        """异步写入动态配置文件

        Args:
            config_data: 要写入的配置数据

        Returns:
            str: 配置文件路径

        Raises:
            IOError: 文件写入失败时抛出
        """
        import aiofiles
        from datetime import datetime, timezone, timedelta

        try:
            config_dir = self._dynamic_config_path.parent
            config_dir.mkdir(parents=True, exist_ok=True)

            tz_utc8 = timezone(timedelta(hours=8))
            current_time = datetime.now(tz_utc8).isoformat()

            existing_created_at = None
            if self._dynamic_config_path.exists():
                try:
                    async with aiofiles.open(self._dynamic_config_path, "r", encoding="utf-8") as f:
                        content = await f.read()
                        existing_config = yaml.safe_load(content)
                        if existing_config and isinstance(existing_config, dict):
                            file_metadata = existing_config.get("file_metadata", {})
                            old_created_at = file_metadata.get("created_at")
                            if old_created_at:
                                try:
                                    old_dt = datetime.fromisoformat(old_created_at.replace("Z", "+00:00"))
                                    existing_created_at = old_dt.astimezone(tz_utc8).isoformat()
                                except Exception as parse_error:
                                    self._logger.debug(f"Cannot convert created_at: {parse_error}")
                                    existing_created_at = old_created_at
                except Exception as e:
                    self._logger.debug(f"Cannot read existing config created_at: {e}")

            file_metadata = {
                "created_at": existing_created_at or current_time,
                "updated_at": current_time,
            }

            temp_file_path = self._dynamic_config_path.with_suffix(".tmp")
            async with aiofiles.open(temp_file_path, "w", encoding="utf-8") as f:
                await f.write("file_metadata:\n")
                await f.write(f"  created_at: '{file_metadata['created_at']}'\n")
                await f.write(f"  updated_at: '{file_metadata['updated_at']}'\n")
                if config_data:
                    await f.write("\n")
                    yaml_content = yaml.dump(
                        config_data,
                        default_flow_style=False,
                        allow_unicode=True,
                        indent=2,
                        sort_keys=False,
                    )
                    await f.write(yaml_content)

            temp_file_path.rename(self._dynamic_config_path)
            self._logger.info(f"Dynamic config written to: {self._dynamic_config_path}")
            return str(self._dynamic_config_path)

        except Exception as e:
            self._logger.error(f"Failed to write dynamic config: {e}")
            if "temp_file_path" in locals() and temp_file_path.exists():
                try:
                    temp_file_path.unlink()
                except Exception:
                    pass
            raise


# 全局实例
dynamic_config = DynamicConfig()
