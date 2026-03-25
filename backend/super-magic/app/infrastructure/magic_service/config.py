"""
Magic Service Configuration Module

Handles loading and managing Magic Service API configuration from various sources.
"""

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

from agentlang.logger import get_logger

from app.path_manager import PathManager
from .exceptions import ConfigurationError

logger = get_logger(__name__)


@dataclass
class MagicServiceConfig:
    """Magic Service configuration data class"""

    api_base_url: str
    api_key: Optional[str] = None


    def __post_init__(self):
        """Validate and normalize configuration after initialization"""
        if not self.api_base_url:
            raise ConfigurationError("API base URL is required")

        # Normalize URL format
        if not self.api_base_url.startswith(("http://", "https://")):
            self.api_base_url = f"https://{self.api_base_url}"
        if not self.api_base_url.endswith("/"):
            self.api_base_url += "/"

    @property
    def file_registration_url(self) -> str:
        """Get the complete file registration API URL"""
        return f"{self.api_base_url.rstrip('/')}/api/v1/super-agent/file/process-attachments"


class MagicServiceConfigLoader:
    """Utility class for loading Magic Service configuration from various sources"""

    @staticmethod
    def load_config_data(config_file: Optional[str] = None) -> Dict[str, Any]:
        """
        Load raw configuration data from file

        Args:
            config_file: Optional specific configuration file path

        Returns:
            Dict containing configuration data

        Raises:
            ConfigurationError: If configuration file cannot be loaded
        """
        try:
            if not config_file:
                config_file = PathManager.get_upload_credentials_file()
            config_path = MagicServiceConfigLoader._resolve_config_file_path(config_file)
            logger.info(f"Loading configuration data from: {config_path}")
            with open(config_path, "r") as f:
                config_data = json.load(f)

            logger.info(f"Loaded configuration data from: {config_path}")
            return config_data

        except FileNotFoundError:
            raise ConfigurationError("Configuration file not found")
        except json.JSONDecodeError as e:
            raise ConfigurationError(f"Invalid JSON in configuration file: {e}")
        except Exception as e:
            raise ConfigurationError(f"Failed to load configuration data: {e}")

    @staticmethod
    def from_config_file(
        config_file: Optional[str] = None
    ) -> MagicServiceConfig:
        """
        Load configuration from init client message file

        Args:
            config_file: Path to configuration file, if None uses default location

        Returns:
            MagicServiceConfig: Loaded configuration

        Raises:
            ConfigurationError: If configuration cannot be loaded or is invalid
        """
        try:
            # Determine configuration file path
            config_path = MagicServiceConfigLoader._resolve_config_file_path(config_file)

            # Load configuration data
            with open(config_path, "r") as f:
                config_data = json.load(f)
            # Extract API base URL
            api_base_url = MagicServiceConfigLoader._extract_api_base_url(config_data)

            # Extract API key (optional)
            api_key = MagicServiceConfigLoader._extract_api_key(config_data)

            logger.info(f"Loaded Magic Service configuration from: {config_path}")
            if config_data.get("batch_id"):
                logger.info(f"Batch ID: {config_data.get('batch_id')}")

            return MagicServiceConfig(
                api_base_url=api_base_url,
                api_key=api_key
            )

        except FileNotFoundError:
            raise ConfigurationError(f"Configuration file not found: {config_path}")
        except json.JSONDecodeError as e:
            raise ConfigurationError(f"Invalid JSON in configuration file: {e}")
        except Exception as e:
            raise ConfigurationError(f"Failed to load configuration: {e}")

    @staticmethod
    def from_environment() -> MagicServiceConfig:
        """
        Load configuration from environment variables

        Returns:
            MagicServiceConfig: Loaded configuration

        Raises:
            ConfigurationError: If required environment variables are missing
        """
        api_base_url = os.getenv("MAGIC_API_SERVICE_BASE_URL")
        if not api_base_url:
            raise ConfigurationError("MAGIC_API_SERVICE_BASE_URL environment variable not set")

        api_key = os.getenv("MAGIC_API_SERVICE_KEY")
        if api_key:
            logger.info("Loaded API key from MAGIC_API_SERVICE_KEY environment variable")

        logger.info("Loaded Magic Service configuration from environment variables")

        return MagicServiceConfig(
            api_base_url=api_base_url,
            api_key=api_key
        )

    @staticmethod
    def load_with_fallback(
        config_file: Optional[str] = None
    ) -> MagicServiceConfig:
        """
        Load configuration with fallback strategy:
        1. Try init client message file (magic_service_host)
        2. Fall back to environment variables (MAGIC_API_SERVICE_BASE_URL)

        Args:
            config_file: Path to configuration file

        Returns:
            MagicServiceConfig: Loaded configuration

        Raises:
            ConfigurationError: If no valid configuration source is found
        """
        try:
            # Try configuration file first
            logger.info(f"Loading configuration from file: {config_file}")
            if config_file is None:
                config_file = PathManager.get_init_client_message_file()

            return MagicServiceConfigLoader.from_config_file(
                config_file=config_file
            )
        except ConfigurationError as e:
            logger.error(f"Failed to load from configuration file: {e}")

            try:
                # Fall back to environment variables
                logger.info("Falling back to environment variables")
                return MagicServiceConfigLoader.from_environment()
            except ConfigurationError as env_error:
                logger.error(f"Failed to load from environment: {env_error}")
                raise ConfigurationError(
                    "Failed to load Magic Service configuration from both configuration file and environment variables"
                )

    @staticmethod
    def _resolve_config_file_path(config_file: Optional[str]) -> Path:
        """
        Resolve the configuration file path

        Args:
            config_file: Optional specific configuration file path

        Returns:
            Path: Resolved configuration file path

        Raises:
            ConfigurationError: If no valid configuration file found
        """
        if not config_file:
            raise ConfigurationError("No configuration file specified")

        # Convert to Path object
        config_path = Path(config_file)

        # If it's an absolute path, use it directly
        if config_path.is_absolute():
            if config_path.exists():
                logger.info(f"使用指定的绝对路径配置文件: {config_path}")
                return config_path.resolve()
        else:
            # For relative paths, try current directory first
            # logger.info(f"当前工作目录: {Path.cwd()}")
            # logger.info(f"检查相对路径: {config_path}")
            if config_path.exists():
                logger.info(f"使用当前目录下的配置文件: {config_path}")
                return config_path.resolve()

            # If not found in current directory, try from project root
            # Find project root by looking for common project markers
            current_dir = Path.cwd()
            logger.info(f"从当前目录查找项目根目录: {current_dir}")
            project_root = MagicServiceConfigLoader._find_project_root(current_dir)

            if project_root:
                project_config_path = project_root / config_file
                logger.info(f"尝试项目根目录下的路径: {project_config_path}")
                if project_config_path.exists():
                    logger.info(f"使用项目根目录下的配置文件: {project_config_path}")
                    return project_config_path.resolve()
                else:
                    logger.info(f"项目根目录下的配置文件不存在: {project_config_path}")
            else:
                logger.info("未找到项目根目录")
                #将当前目录的上一级目录作为项目根目录
                project_root = Path.cwd().parent
                logger.info(f"使用当前目录的上一级目录作为项目根目录: {project_root}")
                fallback_config_path = project_root / config_file
                logger.info(f"使用备用配置文件路径: {fallback_config_path}")
                if fallback_config_path.exists():
                    return fallback_config_path.resolve()
                else:
                    logger.error(f"备用配置文件也不存在: {fallback_config_path}")

        raise ConfigurationError(f"未找到配置文件: {config_file}")

    @staticmethod
    def _find_project_root(start_path: Path) -> Optional[Path]:
        """
        Find project root directory by looking for common project markers

        Args:
            start_path: Path to start searching from

        Returns:
            Path to project root, or None if not found
        """
        current = start_path
        # 优先查找更具有标识性的项目根标志，避免误识别子目录的.git
        primary_markers = ['requirements.txt', 'pyproject.toml', 'setup.py', 'main.py']
        secondary_markers = ['.git']

        found_roots = []

        # Search up the directory tree
        while current != current.parent:
            # 首先检查主要标志
            for marker in primary_markers:
                if (current / marker).exists():
                    logger.debug(f"找到项目根目录主要标志 {marker} 在: {current}")
                    found_roots.append((current, marker, True))  # True表示主要标志

            # 然后检查次要标志
            for marker in secondary_markers:
                if (current / marker).exists():
                    logger.debug(f"找到项目根目录次要标志 {marker} 在: {current}")
                    found_roots.append((current, marker, False))  # False表示次要标志

            current = current.parent

        # 优先返回有主要标志的目录
        for root_path, marker, is_primary in found_roots:
            if is_primary:
                logger.debug(f"选择具有主要标志 {marker} 的目录作为项目根: {root_path}")
                return root_path

        # 如果没有主要标志，返回最上级的次要标志目录
        if found_roots:
            # 选择路径最短的（最上级的）目录
            root_path, marker, _ = min(found_roots, key=lambda x: len(str(x[0])))
            # 检查是否已经到达文件系统根目录
            if root_path == root_path.parent:
                logger.info(f"已到达文件系统根目录，使用当前目录作为项目根: {root_path}")
                return root_path
            # 返回最上级次要标志目录的父目录作为根目录
            parent_path = root_path.parent
            logger.info(f"选择具有次要标志 {marker} 的目录的父目录作为项目根: {parent_path}")
            return parent_path

        # If no markers found, return None
        return None

    @staticmethod
    def _extract_api_key(config_data: Dict[str, Any]) -> Optional[str]:
        """Extract API key from configuration data"""
        # Try magic_service_api_key first
        api_key = config_data.get("magic_service_api_key")
        if api_key:
            logger.info("Using magic_service_api_key from configuration file")
            return api_key

        # Fall back to environment variable
        env_api_key = os.getenv("MAGIC_API_SERVICE_KEY")
        if env_api_key:
            logger.info("Using MAGIC_API_SERVICE_KEY environment variable")
            return env_api_key

        logger.info("No API key found in configuration file or environment")
        return None

    @staticmethod
    def _extract_api_base_url(config_data: Dict[str, Any]) -> str:
        """Extract API base URL from configuration data with fallback"""
        # Try magic_service_host first
        magic_service_host = config_data.get("magic_service_host")
        if magic_service_host:
            logger.info("Using magic_service_host from configuration file")
            return magic_service_host

        # Fall back to environment variable
        api_base_url = os.getenv("MAGIC_API_SERVICE_BASE_URL")
        if api_base_url:
            logger.info("Using MAGIC_API_SERVICE_BASE_URL environment variable")
            return api_base_url

        raise ConfigurationError(
            "No API base URL found in configuration file (magic_service_host) or environment (MAGIC_API_SERVICE_BASE_URL)"
        )
