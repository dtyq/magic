"""
Non-human request rate limiting configuration module

Provides type-safe configuration management and access interfaces
"""

import random
from typing import Optional, Dict, Any
from pydantic import BaseModel, validator
from agentlang.logger import get_logger

logger = get_logger(__name__)


class DelayConfig(BaseModel):
    """Delay configuration"""
    min: float = 2.0
    max: float = 5.0

    @validator('min')
    def validate_min(cls, v):
        if v < 0:
            raise ValueError('min must be >= 0')
        if v > 30.0:
            raise ValueError('min must be <= 30.0 to avoid timeout')
        return v

    @validator('max')
    def validate_max(cls, v, values):
        if 'min' in values and v < values['min']:
            raise ValueError('max must be >= min')
        if v > 60.0:
            raise ValueError('max must be <= 60.0 to avoid timeout')
        return v

    def get_random_delay(self) -> float:
        """Get random delay time

        Returns:
            float: Random delay time in seconds
        """
        return random.uniform(self.min, self.max)


class NonHumanOptions(BaseModel):
    """Non-human request rate limiting configuration"""
    enabled: bool = False
    round_delay: Optional[DelayConfig] = None
    chunk_delay: Optional[DelayConfig] = None

    def is_enabled(self) -> bool:
        """Check if rate limiting is enabled"""
        return self.enabled

    def has_round_delay(self) -> bool:
        """Check if round delay is configured"""
        return self.enabled and self.round_delay is not None

    def has_chunk_delay(self) -> bool:
        """Check if chunk delay is configured"""
        return self.enabled and self.chunk_delay is not None

    def get_round_delay(self) -> Optional[float]:
        """Get random round delay time

        Returns:
            Optional[float]: Delay time in seconds, None if not configured
        """
        if not self.has_round_delay():
            return None
        return self.round_delay.get_random_delay()

    def get_chunk_delay(self) -> Optional[float]:
        """Get random chunk delay time

        Returns:
            Optional[float]: Delay time in seconds, None if not configured
        """
        if not self.has_chunk_delay():
            return None
        return self.chunk_delay.get_random_delay()


class NonHumanConfigManager:
    """Non-human rate limiting configuration manager

    Provides configuration loading, validation and access interfaces
    """

    @staticmethod
    def parse_and_validate(config_dict: Optional[Dict[str, Any]]) -> Optional[NonHumanOptions]:
        """Parse and validate configuration

        Args:
            config_dict: Configuration dictionary

        Returns:
            Optional[NonHumanOptions]: Validated configuration object, None if invalid
        """
        if not config_dict:
            return None

        try:
            options = NonHumanOptions(**config_dict)

            if options.is_enabled():
                logger.info(
                    f"非人类限流配置验证通过: "
                    f"round_delay={options.round_delay.dict() if options.round_delay else None}, "
                    f"chunk_delay={options.chunk_delay.dict() if options.chunk_delay else None}"
                )
            else:
                logger.info("非人类限流配置已禁用")

            return options

        except Exception as e:
            logger.error(f"非人类限流配置验证失败: {e}")
            return None
