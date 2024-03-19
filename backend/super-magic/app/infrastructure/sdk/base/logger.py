"""
SDK Base Logger Proxy

Simple logger proxy class for SDK logging
"""

import logging
from typing import Dict, Any, Optional


class LoggerProxy:
    """Simple logger proxy class"""

    def __init__(self, sdk_name: str, level: str = "INFO"):
        self.sdk_name = sdk_name
        self.logger = logging.getLogger(f"sdk.{sdk_name}")

        # Add default console handler if no handlers exist
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)

            # Set log level
            log_level = getattr(logging, level.upper(), logging.INFO)
            self.logger.setLevel(log_level)

    def info(self, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log info message"""
        self.logger.info(f"[{self.sdk_name}] {message}", extra=extra)

    def error(self, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log error message"""
        self.logger.error(f"[{self.sdk_name}] {message}", extra=extra)

    def debug(self, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log debug message"""
        self.logger.debug(f"[{self.sdk_name}] {message}", extra=extra)

    def warning(self, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log warning message"""
        self.logger.warning(f"[{self.sdk_name}] {message}", extra=extra)

    def set_level(self, level: str):
        """Set log level"""
        log_level = getattr(logging, level.upper(), logging.INFO)
        self.logger.setLevel(log_level)
