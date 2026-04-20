"""
Init Client Message Utility Module

Provides utilities for reading and accessing initialization configuration data.
"""
import json
import os
from typing import Dict, Any, Optional

from agentlang.logger import get_logger

from app.core.entity.message.client_message import User
from app.path_manager import PathManager

logger = get_logger(__name__)


class InitializationError(Exception):
    """Custom exception for initialization failures"""
    pass


class InitClientMessageUtil:
    """Utility class for accessing init client message configuration

    Note: Cache mechanism has been removed to ensure data consistency.
    All methods now read directly from the configuration file to prevent
    stale data issues when the file is updated during runtime.
    """

    _config_path = PathManager.get_init_client_message_file()

    @classmethod
    def get_metadata(cls) -> Dict[str, Any]:
        """
        Get metadata from init client message configuration

        Note: This method always reads from file to ensure data consistency.
        The cache mechanism has been removed to prevent stale data issues
        when the configuration file is updated.

        The metadata in init_client_message.json is automatically updated
        when chat_client_message contains new metadata.

        Returns:
            Dict containing metadata information

        Raises:
            InitializationError: If configuration cannot be loaded or metadata is missing
        """
        logger.debug(f"Loading metadata from: {cls._config_path}")

        try:
            config_data = cls._load_config_file()

            metadata = config_data.get("metadata")
            if not metadata:
                raise InitializationError("初始化文件中缺少 'metadata' 字段")

            if not isinstance(metadata, dict):
                raise InitializationError("metadata 字段格式错误，应为对象类型")

            logger.debug(f"Successfully loaded metadata with keys: {list(metadata.keys())}")

            return metadata

        except InitializationError:
            raise
        except Exception as e:
            logger.error(f"获取 metadata 时发生未知错误: {e}")
            raise InitializationError(f"获取 metadata 失败: {e}")

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

        except InitializationError:
            logger.warning("无法加载配置文件，返回空的 chat_history_dir")
            return ""
        except Exception as e:
            logger.error(f"获取 chat_history_dir 时发生错误: {e}")
            return ""

    @classmethod
    def get_checkpoints_dir(cls) -> str:
        """
        Get checkpoints directory path

        Returns:
            str: Always returns 'checkpoints' as the directory name
        """
        return "checkpoints"

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

        except InitializationError:
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
            InitializationError: If configuration cannot be loaded
        """
        logger.debug(f"Loading full config from: {cls._config_path}")

        try:
            config_data = cls._load_config_file()

            logger.debug("Successfully loaded full configuration")

            return config_data

        except InitializationError:
            raise
        except Exception as e:
            logger.error(f"获取完整配置时发生未知错误: {e}")
            raise InitializationError(f"获取完整配置失败: {e}")

    @classmethod
    def get_magic_service_host(cls) -> str:
        """
        Get magic service host from init client message configuration

        Returns:
            str: Magic service host URL

        Raises:
            InitializationError: If configuration cannot be loaded or host is missing
        """
        try:
            config_data = cls._load_config_file()

            magic_service_host = config_data.get("magic_service_host")
            if not magic_service_host:
                raise InitializationError("配置中未找到 magic_service_host")

            logger.debug(f"获取到 Magic Service 主机: {magic_service_host}")
            return magic_service_host

        except InitializationError:
            raise
        except Exception as e:
            logger.error(f"获取 Magic Service 主机时发生未知错误: {e}")
            raise InitializationError(f"获取 Magic Service 主机失败: {e}")

    @classmethod
    def _load_config_file(cls) -> Dict[str, Any]:
        """
        Load and parse the configuration file

        Returns:
            Dict containing parsed configuration data

        Raises:
            InitializationError: If file cannot be loaded or parsed
        """
        # Check if file exists
        if not cls._config_path.exists():
            raise InitializationError(f"初始化文件未找到: {cls._config_path}")

        # Try to read and parse the file
        try:
            with open(cls._config_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            if not isinstance(data, dict):
                raise InitializationError("初始化文件格式错误，根对象应为 JSON 对象")

            return data

        except json.JSONDecodeError as e:
            raise InitializationError(f"初始化文件格式错误，无法解析 JSON: {e}")
        except FileNotFoundError:
            raise InitializationError(f"初始化文件未找到: {cls._config_path}")
        except PermissionError:
            raise InitializationError(f"无权限访问初始化文件: {cls._config_path}")
        except Exception as e:
            raise InitializationError(f"读取初始化文件失败: {e}")

    @classmethod
    def clear_cache(cls) -> None:
        """Clear cached configuration data

        Note: Since the cache mechanism has been removed, this method
        is kept for backward compatibility but does nothing now.
        """
        logger.debug("clear_cache called (no-op, cache removed)")

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
        except InitializationError:
            return False

    @classmethod
    def get_user(cls) -> Optional[User]:
        """
        从 metadata 获取 user 对象

        Returns:
            Optional[User]: User 对象，字段缺失或为空时对应属性为 None，获取失败返回 None
        """
        try:
            metadata = cls.get_metadata()
            user_data = metadata.get("user")
            if not user_data or not isinstance(user_data, dict):
                return None
            return User(**user_data)
        except Exception as e:
            logger.debug(f"获取 user 失败: {e}")
            return None

    @classmethod
    def get_user_authorization(cls) -> Optional[str]:
        """
        从 metadata 获取 user authorization

        Returns:
            Optional[str]: authorization 值，如果获取失败返回 None

        说明：
            这里保留 app 层实现，agentlang 层有独立实现，二者不能互相依赖，
            因此存在重复代码，但需保持逻辑一致。
        """
        try:
            metadata = cls.get_metadata()
            return metadata.get("authorization")
        except Exception as e:
            logger.debug(f"获取 user authorization 失败: {e}")
            return None

    @classmethod
    async def save_init_client_message(cls, init_message) -> None:
        """
        保存 InitClientMessage 到文件

        Args:
            init_message: InitClientMessage 对象
        """
        from app.utils.async_file_utils import async_mkdir, async_write_json
        await async_mkdir(cls._config_path.parent, parents=True, exist_ok=True)
        await async_write_json(cls._config_path, init_message.model_dump(), indent=2, ensure_ascii=False)
        logger.info(f"已保存 init_client_message 到文件: {cls._config_path}")

    @classmethod
    def get_memory(cls) -> Optional[str]:
        """
        从 init_client_message 获取 memory 字段

        Returns:
            Optional[str]: memory 值
        """
        config_data = cls.get_full_config()
        return config_data.get("memory")

    @classmethod
    def get_sts_token_refresh(cls) -> Optional[Dict[str, Any]]:
        """
        从 init_client_message 获取 sts_token_refresh 配置

        Returns:
            Optional[Dict[str, Any]]: sts_token_refresh 配置
        """
        config_data = cls.get_full_config()
        return config_data.get("sts_token_refresh")

    @classmethod
    def get_upload_config(cls) -> Optional[Dict[str, Any]]:
        """
        从 init_client_message 获取 upload_config 配置

        Returns:
            Optional[Dict[str, Any]]: upload_config 配置
        """
        config_data = cls.get_full_config()
        return config_data.get("upload_config")

    @classmethod
    def get_agent_type(cls) -> Optional[str]:
        """
        从 init_client_message 获取 agent.type。

        Returns:
            Optional[str]: agent.type 值，未配置时返回 None
        """
        try:
            config_data = cls.get_full_config()
            agent_config = config_data.get("agent")
            if not isinstance(agent_config, dict):
                return None
            agent_type = agent_config.get("type")
            if isinstance(agent_type, str) and agent_type.strip():
                return agent_type.strip()
        except Exception as e:
            logger.debug(f"获取 agent.type 失败: {e}")
        return None

    @classmethod
    def get_sandbox_id(cls) -> str:
        """
        Get sandbox_id from metadata, falling back to SANDBOX_ID env var.

        Returns:
            str: sandbox_id value, or empty string if not found anywhere
        """
        try:
            sandbox_id = cls.get_metadata().get("sandbox_id", "")
            if sandbox_id:
                return sandbox_id
        except Exception as e:
            logger.info(f"Failed to get sandbox_id from metadata: {e}")

        env_sandbox_id = os.environ.get("SANDBOX_ID", "")
        if env_sandbox_id:
            logger.info(f"Using sandbox_id from environment variable: {env_sandbox_id}")
        return env_sandbox_id

    @classmethod
    def get_platform_type(cls) -> Optional[str]:
        """
        从 init_client_message 获取平台类型

        Returns:
            Optional[str]: platform_type 值
        """
        upload_config = cls.get_upload_config()
        if upload_config and 'platform' in upload_config:
            return upload_config['platform']
        return None
