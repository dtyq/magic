"""
AI ability configuration manager with flexible, priority-based configuration access

This is a generic configuration manager that provides priority-based configuration access
for AI abilities. It does not define specific abilities - that should be done in the
application layer.
"""
from typing import Any
from agentlang.config.config import config
from agentlang.config.dynamic_config import dynamic_config
from agentlang.logger import get_logger

logger = get_logger(__name__)


class AIAbilityManager:
    """Generic AI ability configuration manager

    Provides flexible configuration access with the following priority:
    1. Dynamic configuration (dynamic_config.yaml - ai_abilities section)
       - Supports environment variable placeholders via ${ENV_VAR:-default}
       - read_dynamic_config() automatically processes placeholders
    2. Static configuration (config.yaml - ai_abilities section)
       - Supports environment variable placeholders via ${ENV_VAR:-default}
    3. Custom default values (provided when calling get())

    This is a generic manager that doesn't know about specific AI abilities.
    The application layer should define what abilities exist.

    Usage:
        from agentlang.config.ai_ability_manager import ai_ability_manager

        # Get configuration value
        model_id = ai_ability_manager.get(
            "visual_understanding",
            "model_id",
            default="gpt-4o"
        )
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AIAbilityManager, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, '_initialized'):
            self._initialized = True
            logger.debug("AIAbilityManager initialized")

    def get(
        self,
        ability_key: str,
        config_key: str,
        default: Any = None
    ) -> Any:
        """Get configuration value for an AI ability

        Args:
            ability_key: AI ability identifier (e.g., "visual_understanding")
            config_key: Configuration key (e.g., "model_id", "timeout")
            default: Optional default value if not found in any config

        Returns:
            Configuration value following priority order, or default if not found

        Note:
            - None, empty string (""), and whitespace-only strings are treated as "not found"
            - This ensures that invalid configurations don't block fallback to defaults
            - For boolean/numeric values, 0 and False are considered valid configurations

        Examples:
            # Basic usage
            model_id = manager.get("visual_understanding", "model_id")

            # With custom default
            timeout = manager.get("visual_understanding", "timeout", default=180)

            # Any ability key works - not limited to predefined ones
            custom_config = manager.get("my_custom_ability", "some_param", default="value")
        """
        if not isinstance(ability_key, str):
            logger.warning(f"ability_key must be string, got {type(ability_key)}")
            return default

        if not isinstance(config_key, str):
            logger.warning(f"config_key must be string, got {type(config_key)}")
            return default

        # Priority 1: Try dynamic configuration
        dynamic_value = self._get_from_dynamic_config(ability_key, config_key)
        if self._is_valid_value(dynamic_value):
            logger.info(f"Using dynamic config for {ability_key}.{config_key}: {dynamic_value}")
            return dynamic_value

        # Priority 2: Try static configuration
        static_value = self._get_from_static_config(ability_key, config_key)
        if self._is_valid_value(static_value):
            logger.info(f"Using static config for {ability_key}.{config_key}: {static_value}")
            return static_value

        # Priority 3: Use provided default
        if default is not None:
            logger.info(f"Using provided default for {ability_key}.{config_key}: {default}")
            return default

        # Nothing found
        logger.debug(f"No configuration found for {ability_key}.{config_key}")
        return None

    def _get_from_dynamic_config(self, ability_key: str, config_key: str) -> Any:
        """Get value from dynamic configuration

        Dynamic config supports environment variable placeholders via ${ENV_VAR:-default}.
        The placeholder processing is handled by the dynamic_config.read_dynamic_config() method.

        Args:
            ability_key: Ability identifier (e.g., "visual_understanding")
            key: Configuration key (e.g., "model_id")

        Returns:
            Configuration value or None if not found
        """
        try:
            # read_dynamic_config() automatically processes ${ENV_VAR:-default} placeholders
            dynamic_full_config = dynamic_config.read_dynamic_config()
            if not dynamic_full_config:
                return None

            ai_abilities = dynamic_full_config.get("ai_abilities", {})
            ability_config = ai_abilities.get(ability_key, {})
            return ability_config.get(config_key)
        except Exception as e:
            logger.debug(f"Error reading dynamic config for {ability_key}.{config_key}: {e}")
            return None

    def _get_from_static_config(self, ability_key: str, config_key: str) -> Any:
        """Get value from static configuration

        Static config supports environment variable placeholders via ${ENV_VAR:-default}.

        Args:
            ability_key: Ability identifier (e.g., "visual_understanding")
            key: Configuration key (e.g., "model_id")

        Returns:
            Configuration value or None if not found
        """
        try:
            ai_abilities = config.get("ai_abilities", {})
            ability_config = ai_abilities.get(ability_key, {})
            return ability_config.get(config_key)
        except Exception as e:
            logger.debug(f"Error reading static config for {ability_key}.{config_key}: {e}")
            return None

    def _is_valid_value(self, value: Any) -> bool:
        """Check if a configuration value is valid (not None, empty, or whitespace-only)

        Args:
            value: Configuration value to validate

        Returns:
            True if value is valid, False otherwise

        Note:
            - None is invalid
            - Empty string ("") is invalid
            - Whitespace-only strings ("  ") are invalid
            - Empty containers ([], {}) are invalid
            - 0, False are VALID (they are meaningful configurations)
        """
        # None is invalid
        if value is None:
            return False

        # Empty string or whitespace-only string is invalid
        if isinstance(value, str):
            if not value or not value.strip():
                return False

        # Empty containers are invalid
        if isinstance(value, (list, dict)):
            if not value:
                return False

        # All other values are valid (including 0, False, etc.)
        return True

    def reload(self) -> None:
        """Reload configuration from files

        Note: This reloads the underlying config instances.
        No internal cache to clear in this manager as it reads fresh on each get().
        """
        logger.info("Reloading AI ability configuration...")
        config.reload_config()
        logger.info("AI ability configuration reloaded")


# Global singleton instance
ai_ability_manager = AIAbilityManager()
