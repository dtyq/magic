"""
环境配置类

管理与环境相关的参数设置
"""
import os
from typing import Optional, Any, Type, TypeVar, Union, cast

T = TypeVar('T')

class Environment:
    """环境配置类"""
    
    DEFAULT_AGENT_IDLE_TIMEOUT = 3600  # 默认超时时间：1小时
    DEFAULT_IDLE_MONITOR_INTERVAL = 60  # 默认监控间隔：60秒
    
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
    def is_dev() -> bool:
        """是否为开发环境
        
        Returns:
            bool: 是否为开发环境
        """
        # 优先从环境变量获取，如果不存在则从配置文件获取
        env_value = Environment.get_env("APP_ENV", "").lower()
        if env_value in ("dev", "development"):
            return True
        
        # 从配置文件获取
        try:
            from agentlang.config.config import config
            config_value = config.get("sandbox.app_env", "prod").lower()
            return config_value in ("dev", "development")
        except (ImportError, AttributeError):
            return False 