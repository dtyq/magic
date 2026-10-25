"""
环境配置类

管理与环境相关的参数设置
"""
import os
from typing import Any, ClassVar, Optional, Type, TypeVar, Union, cast

from agentlang.logger import get_logger


logger = get_logger(__name__)

T = TypeVar('T')

class Environment:
    """环境配置类"""
    
    DEFAULT_AGENT_IDLE_TIMEOUT = 3600  # 默认超时时间：1小时
    DEFAULT_IDLE_MONITOR_INTERVAL = 60  # 默认监控间隔：60秒
    DEFAULT_AGENT_IDLE_MONITOR_ENABLED = True
    DEFAULT_SANDBOX_FORCE_SHUTDOWN_TIMEOUT_SECONDS = 25
    DEFAULT_SANDBOX_GRACEFUL_SHUTDOWN_TIMEOUT_SECONDS = 10
    _reported_invalid_shutdown_configs: ClassVar[set[str]] = set()
    
    @staticmethod
    def get_env(key: str, default: Optional[Any] = None, value_type: Optional[Type[T]] = None) -> Union[Optional[str], T]:
        """获取环境变量
        
        Args:
            key: 环境变量名
            default: 默认值
            value_type: 返回值类型，如 int, bool 等
            
        Returns:
            环境变量值，根据 value_type 转换类型
        """
        value = os.environ.get(key)
        if value is None:
            return default
            
        # 如果未指定类型，则返回字符串
        if value_type is None:
            return value
            
        # 根据指定类型转换
        if value_type is bool:
            return cast(T, value.lower() in ('true', '1', 'yes', 'y', 'on'))
        elif value_type is int:
            try:
                return cast(T, int(value))
            except ValueError:
                return default
        else:
            # 尝试使用类型构造函数进行转换
            try:
                return cast(T, value_type(value))
            except (ValueError, TypeError):
                return default
    
    @staticmethod
    def get_int_env(key: str, default: int) -> int:
        """获取整数类型的环境变量
        
        Args:
            key: 环境变量名
            default: 默认值
            
        Returns:
            环境变量值
        """
        return Environment.get_env(key, default, int)
    
    @staticmethod
    def get_bool_env(key: str, default: bool) -> bool:
        """获取布尔类型的环境变量
        
        Args:
            key: 环境变量名
            default: 默认值
            
        Returns:
            环境变量值
        """
        return Environment.get_env(key, default, bool)
    
    @staticmethod
    def get_agent_idle_timeout() -> int:
        """获取代理空闲超时时间（秒）
        
        Returns:
            int: 代理空闲超时时间
        """
        # 优先从环境变量获取，如果不存在则从配置文件获取，最后使用默认值
        env_value = Environment.get_int_env("AGENT_IDLE_TIMEOUT", -1)
        if env_value > 0:
            return env_value
            
        # 从配置文件获取
        try:
            from agentlang.config.config import config
            config_value = config.get("sandbox.agent_idle_timeout", -1)
            if config_value > 0:
                return config_value
        except (ImportError, AttributeError):
            pass
            
        return Environment.DEFAULT_AGENT_IDLE_TIMEOUT

    @staticmethod
    def is_agent_idle_monitor_enabled() -> bool:
        """是否启用代理空闲监控。"""
        env_value = os.getenv("ENABLE_AGENT_IDLE_MONITOR")
        if env_value is not None:
            return Environment.get_bool_env(
                "ENABLE_AGENT_IDLE_MONITOR",
                Environment.DEFAULT_AGENT_IDLE_MONITOR_ENABLED,
            )

        try:
            from agentlang.config.config import config
            config_value = config.get(
                "sandbox.idle_monitor_enabled",
                Environment.DEFAULT_AGENT_IDLE_MONITOR_ENABLED,
            )
            if isinstance(config_value, bool):
                return config_value
            if isinstance(config_value, str):
                return config_value.strip().lower() in ('true', '1', 'yes', 'y', 'on')
        except (ImportError, AttributeError):
            pass

        return Environment.DEFAULT_AGENT_IDLE_MONITOR_ENABLED
        
    @staticmethod
    def get_idle_monitor_interval() -> int:
        """获取空闲监控间隔时间（秒）
        
        Returns:
            int: 空闲监控间隔时间
        """
        # 优先从环境变量获取，如果不存在则从配置文件获取，最后使用默认值
        env_value = Environment.get_int_env("IDLE_MONITOR_INTERVAL", -1)
        if env_value > 0:
            return env_value
            
        # 从配置文件获取
        try:
            from agentlang.config.config import config
            config_value = config.get("sandbox.idle_monitor_interval", -1)
            if config_value > 0:
                return config_value
        except (ImportError, AttributeError):
            pass
            
        return Environment.DEFAULT_IDLE_MONITOR_INTERVAL

    @staticmethod
    def _parse_positive_int(value: object) -> Optional[int]:
        """把配置边界值规范化为正整数。"""
        if isinstance(value, bool):
            return None
        if isinstance(value, int):
            parsed = value
        elif isinstance(value, str):
            try:
                parsed = int(value.strip())
            except ValueError:
                return None
        else:
            return None
        return parsed if parsed > 0 else None

    @classmethod
    def _report_invalid_shutdown_config_once(cls, reason: str) -> None:
        if reason in cls._reported_invalid_shutdown_configs:
            return
        cls._reported_invalid_shutdown_configs.add(reason)
        logger.warning(
            "沙箱关闭超时配置无效，回退到默认值: "
            f"force_shutdown_timeout={cls.DEFAULT_SANDBOX_FORCE_SHUTDOWN_TIMEOUT_SECONDS}s, "
            f"graceful_shutdown_timeout={cls.DEFAULT_SANDBOX_GRACEFUL_SHUTDOWN_TIMEOUT_SECONDS}s, "
            f"reason={reason}"
        )

    @classmethod
    def _resolve_sandbox_shutdown_timeouts(cls) -> tuple[int, int]:
        """读取并联合校验进程强制退出超时和服务优雅退出超时。"""
        try:
            from agentlang.config.config import config

            configured_force: object = config.get(
                "sandbox.shutdown.force_shutdown_timeout_seconds",
                cls.DEFAULT_SANDBOX_FORCE_SHUTDOWN_TIMEOUT_SECONDS,
            )
            configured_graceful: object = config.get(
                "sandbox.shutdown.graceful_shutdown_timeout_seconds",
                cls.DEFAULT_SANDBOX_GRACEFUL_SHUTDOWN_TIMEOUT_SECONDS,
            )
        except (ImportError, AttributeError):
            configured_force = cls.DEFAULT_SANDBOX_FORCE_SHUTDOWN_TIMEOUT_SECONDS
            configured_graceful = cls.DEFAULT_SANDBOX_GRACEFUL_SHUTDOWN_TIMEOUT_SECONDS

        force_source: object = os.getenv(
            "SANDBOX_FORCE_SHUTDOWN_TIMEOUT_SECONDS",
            str(configured_force),
        )
        graceful_source: object = os.getenv(
            "SANDBOX_GRACEFUL_SHUTDOWN_TIMEOUT_SECONDS",
            str(configured_graceful),
        )
        force_seconds = cls._parse_positive_int(force_source)
        graceful_seconds = cls._parse_positive_int(graceful_source)

        if force_seconds is None or graceful_seconds is None:
            cls._report_invalid_shutdown_config_once(
                f"force_shutdown_timeout={force_source!r}, "
                f"graceful_shutdown_timeout={graceful_source!r}: values must be positive integers"
            )
            return (
                cls.DEFAULT_SANDBOX_FORCE_SHUTDOWN_TIMEOUT_SECONDS,
                cls.DEFAULT_SANDBOX_GRACEFUL_SHUTDOWN_TIMEOUT_SECONDS,
            )

        if graceful_seconds >= force_seconds:
            cls._report_invalid_shutdown_config_once(
                f"force_shutdown_timeout={force_seconds}, "
                f"graceful_shutdown_timeout={graceful_seconds}: "
                "graceful shutdown timeout must be shorter than force shutdown timeout"
            )
            return (
                cls.DEFAULT_SANDBOX_FORCE_SHUTDOWN_TIMEOUT_SECONDS,
                cls.DEFAULT_SANDBOX_GRACEFUL_SHUTDOWN_TIMEOUT_SECONDS,
            )

        return force_seconds, graceful_seconds

    @classmethod
    def get_sandbox_force_shutdown_timeout_seconds(cls) -> int:
        """获取从首次退出请求到强制结束进程的超时时间。"""
        force_seconds, _ = cls._resolve_sandbox_shutdown_timeouts()
        return force_seconds

    @classmethod
    def get_sandbox_graceful_shutdown_timeout_seconds(cls) -> int:
        """获取服务等待已有连接和请求正常结束的超时时间。"""
        _, graceful_seconds = cls._resolve_sandbox_shutdown_timeouts()
        return graceful_seconds
    
    @staticmethod
    def is_local() -> bool:
        """是否为本地开发环境（APP_ENV=local）
        
        本地环境用于开发者在本机运行，浏览器等外部依赖走本地模式。
        区别于 dev/test 等部署环境，这些环境虽然也是非生产环境，
        但运行在容器中，外部依赖通过 sidecar 服务提供。
        
        Returns:
            bool: 是否为本地开发环境
        """
        env_value = Environment.get_env("APP_ENV", "").lower()
        if env_value == "local":
            return True
        
        try:
            from agentlang.config.config import config
            config_value = config.get("sandbox.app_env", "prod").lower()
            return config_value == "local"
        except (ImportError, AttributeError):
            return False

    @staticmethod
    def is_dev() -> bool:
        """是否为开发环境（APP_ENV=dev/development）
        
        注意：不包含 local，local 是本地开发环境，通过 is_local() 判断。
        
        Returns:
            bool: 是否为开发环境
        """
        env_value = Environment.get_env("APP_ENV", "").lower()
        if env_value in ("dev", "development"):
            return True
        
        try:
            from agentlang.config.config import config
            config_value = config.get("sandbox.app_env", "prod").lower()
            return config_value in ("dev", "development")
        except (ImportError, AttributeError):
            return False

    @staticmethod
    def is_mainland() -> bool:
        """是否为中国大陆部署。

        与 APP_ENV（部署阶段：local/dev/prod）正交，独立标记沙盒部署区域。
        默认 False，即海外部署；中国大陆集群设置 MAINLAND=true 切换为大陆部署。

        优先级：环境变量 MAINLAND > 配置 sandbox.mainland > 默认 False。

        Returns:
            bool: True 表示中国大陆部署，False 表示海外部署。
        """
        if Environment.get_env("MAINLAND") is not None:
            return Environment.get_bool_env("MAINLAND", False)

        try:
            from agentlang.config.config import config
            return bool(config.get("sandbox.mainland", False))
        except (ImportError, AttributeError):
            return False
