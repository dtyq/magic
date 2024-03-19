"""
AgentLang Logger Adapter

Adapter to integrate agentlang.logger with SDK base
"""

from typing import Dict, Any, Optional

try:
    from agentlang.logger import get_logger
    AGENTLANG_LOGGER_AVAILABLE = True
except ImportError:
    AGENTLANG_LOGGER_AVAILABLE = False


class AgentLangLoggerAdapter:
    """Adapter for agentlang.logger to work with SDK base"""

    def __init__(self, sdk_name: str, logger_name: Optional[str] = None):
        if not AGENTLANG_LOGGER_AVAILABLE:
            raise RuntimeError("agentlang.logger is not available. Please ensure agentlang package is installed.")

        self.sdk_name = sdk_name
        # Use provided logger_name or default to sdk.{sdk_name}
        self.logger_name = logger_name or f"sdk.{sdk_name}"
        self.logger = get_logger(self.logger_name)

    def info(self, message: str, extra: Optional[Dict[str, Any]] = None, **kwargs):
        """Log info message"""
        formatted_message = f"[{self.sdk_name}] {message}"
        self.logger.info(formatted_message, **kwargs)

    def error(self, message: str, extra: Optional[Dict[str, Any]] = None, **kwargs):
        """Log error message"""
        formatted_message = f"[{self.sdk_name}] {message}"
        self.logger.error(formatted_message, **kwargs)

    def debug(self, message: str, extra: Optional[Dict[str, Any]] = None, **kwargs):
        """Log debug message"""
        formatted_message = f"[{self.sdk_name}] {message}"
        self.logger.debug(formatted_message, **kwargs)

    def warning(self, message: str, extra: Optional[Dict[str, Any]] = None, **kwargs):
        """Log warning message"""
        formatted_message = f"[{self.sdk_name}] {message}"
        self.logger.warning(formatted_message, **kwargs)


def is_agentlang_logger_available() -> bool:
    """Check if agentlang.logger is available"""
    return AGENTLANG_LOGGER_AVAILABLE


def create_agentlang_logger(sdk_name: str, logger_name: Optional[str] = None) -> AgentLangLoggerAdapter:
    """Create an AgentLang logger adapter"""
    return AgentLangLoggerAdapter(sdk_name, logger_name)
