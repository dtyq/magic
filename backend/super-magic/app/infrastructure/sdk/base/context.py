"""
SDK Base Context Management

Global context manager for SDK instances, consistent with PHP version
"""

from typing import Dict
from .sdk_base import SdkBase


class SdkContext:
    """Global context manager, consistent with PHP version"""

    _containers: Dict[str, SdkBase] = {}

    @classmethod
    def get(cls, key: str) -> SdkBase:
        """Get SDK instance"""
        container = cls._containers.get(key)
        if container is None:
            raise RuntimeError(f"{key} is not registered")
        return container

    @classmethod
    def register(cls, key: str, container: SdkBase) -> None:
        """Register SDK instance"""
        if key in cls._containers:
            raise RuntimeError(f"{key} is already registered")
        cls._containers[key] = container

    @classmethod
    def has(cls, key: str) -> bool:
        """Check if instance exists"""
        return key in cls._containers

    @classmethod
    def remove(cls, key: str) -> None:
        """Remove instance"""
        if key in cls._containers:
            container = cls._containers[key]
            container.close()  # Close HTTP clients
            del cls._containers[key]

    @classmethod
    def clear(cls) -> None:
        """Clear all instances"""
        for key in list(cls._containers.keys()):
            cls.remove(key)
