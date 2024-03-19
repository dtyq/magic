"""
SDK Base Configuration Management

Simple configuration management class, similar to PHP version's Dot configuration
"""

from typing import Dict, Any, Optional


class Config:
    """Simple configuration management class, similar to PHP version's Dot configuration"""

    def __init__(self, config_dict: Dict[str, Any]):
        self._config = config_dict.copy()

        # Validate required configuration items
        if not self.get('sdk_name'):
            raise ValueError("Missing required config: sdk_name")

    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value, supports dot notation"""
        keys = key.split('.')
        value = self._config

        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        return value

    def set(self, key: str, value: Any) -> None:
        """Set configuration value"""
        keys = key.split('.')
        target = self._config

        for k in keys[:-1]:
            if k not in target:
                target[k] = {}
            target = target[k]
        target[keys[-1]] = value

    def get_sdk_name(self) -> str:
        """Get SDK name"""
        return self.get('sdk_name', '')

    def get_base_url(self) -> str:
        """Get base URL"""
        return self.get('base_url', '')

    def get_timeout(self) -> int:
        """Get timeout value"""
        return self.get('timeout', 30)

    def has(self, key: str) -> bool:
        """Check if key exists"""
        return self.get(key) is not None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return self._config.copy()
