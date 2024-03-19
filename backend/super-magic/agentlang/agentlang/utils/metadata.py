"""
Init Client Message Utility Module

Provides utilities for reading and accessing initialization configuration data.
"""
import json
from pathlib import Path
from typing import Dict, Any, Optional

from agentlang.logger import get_logger
from agentlang.config.config import config
from agentlang.paths import PathManager

logger = get_logger(__name__)


class MetadataError(Exception):
    """Custom exception for initialization failures"""
    pass


class MetadataUtil:
    """Utility class for accessing init client message configuration

    Note: Cache mechanism has been removed to ensure data consistency.
    All methods now read directly from the configuration file to prevent
    stale data issues when the file is updated during runtime.
    """

    _config_path_cache: Optional[Path] = None  # Only cache the file path

    @classmethod
    def _get_config_path(cls) -> Path:
        """Get the configuration file path"""
        if cls._config_path_cache is None:
            cls._config_path_cache = PathManager.get_credentials_dir() / "init_client_message.json"
        return cls._config_path_cache

    @classmethod
    def get_metadata(cls) -> Dict[str, Any]:
        """
        Get metadata from init client message configuration

        Note: This method always reads from file to ensure data consistency.
        The cache mechanism has been removed to prevent stale data issues
        when the configuration file is updated.

        Returns:
            Dict containing metadata information

        Raises:
            MetadataError: If configuration cannot be loaded or metadata is missing
        """
        config_path = cls._get_config_path()
        logger.debug(f"Loading metadata from: {config_path}")

        try:
            config_data = cls._load_config_file()

            metadata = config_data.get("metadata")
            if not metadata:
                raise MetadataError("初始化文件中缺少 'metadata' 字段")

            if not isinstance(metadata, dict):
                raise MetadataError("metadata 字段格式错误，应为对象类型")

            logger.debug(f"Successfully loaded metadata with keys: {list(metadata.keys())}")

            return metadata

        except MetadataError:
            raise
        except Exception as e:
            logger.error(f"获取 metadata 时发生未知错误: {e}")
            raise MetadataError(f"获取 metadata 失败: {e}")

    @classmethod
    def get_chat_history_dir(cls) -> str:
        """
        Get chat_history_dir from init client message configuration

        Returns:
            str: chat_history_dir value if exists, empty string otherwise
        """
        try:
            config_data = cls.get_full_config()
            chat_history_dir = config_data.get("chat_history_dir", "")

            if chat_history_dir:
                logger.debug(f"Found chat_history_dir: {chat_history_dir}")
            else:
                logger.debug("chat_history_dir not found or empty")

            return chat_history_dir

        except MetadataError:
            logger.warning("无法加载配置文件，返回空的 chat_history_dir")
            return ""
        except Exception as e:
            logger.error(f"获取 chat_history_dir 时发生错误: {e}")
            return ""

    @classmethod
    def get_work_dir(cls) -> str:
        """
        Get work_dir from init client message configuration

        Returns:
            str: work_dir value if exists, empty string otherwise
        """
        try:
            config_data = cls.get_full_config()
            work_dir = config_data.get("work_dir", "")

            if work_dir:
                logger.debug(f"Found work_dir: {work_dir}")
            else:
                logger.debug("work_dir not found or empty")

            return work_dir

        except MetadataError:
            logger.warning("无法加载配置文件，返回空的 work_dir")
            return ""
        except Exception as e:
            logger.error(f"获取 work_dir 时发生错误: {e}")
            return ""

    @classmethod
    def get_full_config(cls) -> Dict[str, Any]:
        """
        Get the complete init client message configuration

        Note: This method always reads from file to ensure data consistency.
        The cache mechanism has been removed to prevent stale data issues
        when the configuration file is updated.

        Returns:
            Dict containing full configuration data

        Raises:
            MetadataError: If configuration cannot be loaded
        """
        config_path = cls._get_config_path()
        logger.debug(f"Loading full config from: {config_path}")

        try:
            config_data = cls._load_config_file()

            logger.debug("Successfully loaded full configuration")

            return config_data

        except MetadataError:
            raise
        except Exception as e:
            logger.error(f"获取完整配置时发生未知错误: {e}")
            raise MetadataError(f"获取完整配置失败: {e}")

    @classmethod
    def _load_config_file(cls) -> Dict[str, Any]:
        """
        Load and parse the configuration file

        Returns:
            Dict containing parsed configuration data

        Raises:
            InitializationError: If file cannot be loaded or parsed
        """
        config_path = cls._get_config_path()

        # Check if file exists
        if not config_path.exists():
            raise MetadataError(f"初始化文件未找到: {config_path}")

        # Try to read and parse the file
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            if not isinstance(data, dict):
                raise MetadataError("初始化文件格式错误，根对象应为 JSON 对象")

            return data

        except json.JSONDecodeError as e:
            raise MetadataError(f"初始化文件格式错误，无法解析 JSON: {e}")
        except FileNotFoundError:
            raise MetadataError(f"初始化文件未找到: {config_path}")
        except PermissionError:
            raise MetadataError(f"无权限访问初始化文件: {config_path}")
        except Exception as e:
            raise MetadataError(f"读取初始化文件失败: {e}")

    @classmethod
    def clear_cache(cls) -> None:
        """Clear cached configuration data

        Note: Since the cache mechanism has been removed, this method
        now only clears the config path cache. It's kept for backward
        compatibility.
        """
        cls._config_path_cache = None
        logger.debug("已清除配置路径缓存")

    @classmethod
    def is_initialized(cls) -> bool:
        """
        Check if the system is properly initialized

        Returns:
            bool: True if initialization file exists and contains valid metadata
        """
        try:
            cls.get_metadata()
            return True
        except MetadataError:
            return False

    @classmethod
    def get_llm_request_headers(cls) -> Dict[str, str]:
        """
        Get LLM request headers from metadata
        
        注意：此方法只返回业务元数据（如 Magic-Task-Id 等），不包含 Authorization header。
        Authorization 的处理通过 OpenAI 客户端的 api_key 参数完成，优先级在 factory.py 中处理。

        Returns:
            Dict[str, str]: Headers dictionary for LLM requests (business metadata only)
        """
        headers = {}

        try:
            metadata = cls.get_metadata()

            # 定义字段映射：metadata_key -> header_name
            header_mapping = {
                "super_magic_task_id": "Magic-Task-Id",
                "topic_id": "Magic-Topic-Id",
                "chat_topic_id": "Magic-Chat-Topic-Id",
                "language": "Magic-Language"
            }

            # Extract values from metadata
            for meta_key, header_name in header_mapping.items():
                if value := metadata.get(meta_key):
                    headers[header_name] = value

        except MetadataError:
            # Return empty dict if metadata not available
            logger.debug("Metadata not initialized, returning empty headers")
        except Exception as e:
            logger.warning(f"Failed to get LLM headers from metadata: {e}")

        return headers

    @classmethod
    def get_user_authorization(cls) -> Optional[str]:
        """
        从 metadata 获取 user authorization

        Returns:
            Optional[str]: authorization 值，如果获取失败返回 None

        说明：
            agentlang 层不能依赖 app 层的工具类，因此在此处保留一份
            与 app/utils/init_client_message_util.py 对等的实现，便于在
            框架层独立使用。
        """
        try:
            metadata = cls.get_metadata()
            return metadata.get("authorization")
        except Exception as e:
            logger.debug(f"获取 user authorization 失败: {e}")
            return None

    @staticmethod
    def _find_header_key(headers: Dict[str, Any], target_header: str) -> Optional[str]:
        target = target_header.lower()
        for key in headers.keys():
            if key.lower() == target:
                return key
        return None

    @classmethod
    def add_magic_and_user_authorization_headers(
        cls,
        headers: Dict[str, Any],
        magic_authorization: Optional[str] = None,
    ) -> None:
        """
        为请求头添加 Magic-Authorization 与 User-Authorization 认证头

        Args:
            headers: 请求头字典，会被原地修改
            magic_authorization: 可选的 Magic-Authorization 值，未传入时从配置读取

        说明：
            仅在请求头中存在 Magic-Authorization 时，按配置转发 User-Authorization，
            以避免无意扩大转发范围。
        """
        if magic_authorization is None:
            magic_authorization = config.get("sandbox.magic_authorization")

        magic_header_key = cls._find_header_key(headers, "Magic-Authorization")
        magic_header_value = headers.get(magic_header_key) if magic_header_key else None
        should_set_magic = bool(magic_authorization) and (magic_header_key is None or not magic_header_value)
        if should_set_magic:
            headers[magic_header_key or "Magic-Authorization"] = magic_authorization

        has_magic = magic_header_key is not None or should_set_magic
        if not has_magic:
            return

        forward_user_auth = config.get("sandbox.forward_user_authorization", "true")
        if str(forward_user_auth).lower() != "true":
            return

        user_header_key = cls._find_header_key(headers, "User-Authorization")
        user_header_value = headers.get(user_header_key) if user_header_key else None
        if user_header_value:
            return

        user_auth = cls.get_user_authorization()
        if not user_auth:
            return

        if user_header_key and user_header_key != "User-Authorization":
            headers.pop(user_header_key, None)
        headers["User-Authorization"] = user_auth
