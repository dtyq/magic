"""
Unit tests for non-human rate limiting configuration module
"""

import pytest
from pydantic import ValidationError

from agentlang.config.non_human_config import (
    DelayConfig,
    NonHumanOptions,
    NonHumanConfigManager
)


class TestDelayConfig:
    """Test DelayConfig class"""

    def test_valid_delay_config(self):
        """Test creating valid delay configuration"""
        config = DelayConfig(min=1.0, max=3.0)
        assert config.min == 1.0
        assert config.max == 3.0

    def test_default_values(self):
        """Test default values"""
        config = DelayConfig()
        assert config.min == 2.0
        assert config.max == 5.0

    def test_invalid_min_negative(self):
        """Test min value cannot be negative"""
        with pytest.raises(ValidationError) as exc_info:
            DelayConfig(min=-1.0, max=3.0)
        assert "min must be >= 0" in str(exc_info.value)

    def test_invalid_min_too_large(self):
        """Test min value cannot exceed 30 seconds"""
        with pytest.raises(ValidationError) as exc_info:
            DelayConfig(min=35.0, max=40.0)
        assert "min must be <= 30.0 to avoid timeout" in str(exc_info.value)

    def test_invalid_max_less_than_min(self):
        """Test max value must be >= min value"""
        with pytest.raises(ValidationError) as exc_info:
            DelayConfig(min=5.0, max=3.0)
        assert "max must be >= min" in str(exc_info.value)

    def test_invalid_max_too_large(self):
        """Test max value cannot exceed 60 seconds"""
        with pytest.raises(ValidationError) as exc_info:
            DelayConfig(min=5.0, max=65.0)
        assert "max must be <= 60.0 to avoid timeout" in str(exc_info.value)

    def test_get_random_delay(self):
        """Test get_random_delay returns value within range"""
        config = DelayConfig(min=1.0, max=3.0)

        # Test multiple times to ensure randomness works
        for _ in range(10):
            delay = config.get_random_delay()
            assert 1.0 <= delay <= 3.0

    def test_get_random_delay_same_min_max(self):
        """Test get_random_delay when min equals max"""
        config = DelayConfig(min=2.5, max=2.5)
        delay = config.get_random_delay()
        assert delay == 2.5


class TestNonHumanOptions:
    """Test NonHumanOptions class"""

    def test_default_disabled(self):
        """Test default configuration is disabled"""
        options = NonHumanOptions()
        assert not options.is_enabled()
        assert not options.has_round_delay()
        assert not options.has_chunk_delay()

    def test_enabled_with_round_delay(self):
        """Test enabling with round delay only"""
        options = NonHumanOptions(
            enabled=True,
            round_delay=DelayConfig(min=2.0, max=5.0)
        )
        assert options.is_enabled()
        assert options.has_round_delay()
        assert not options.has_chunk_delay()

    def test_enabled_with_chunk_delay(self):
        """Test enabling with chunk delay only"""
        options = NonHumanOptions(
            enabled=True,
            chunk_delay=DelayConfig(min=1.0, max=3.0)
        )
        assert options.is_enabled()
        assert not options.has_round_delay()
        assert options.has_chunk_delay()

    def test_enabled_with_both_delays(self):
        """Test enabling with both delays"""
        options = NonHumanOptions(
            enabled=True,
            round_delay=DelayConfig(min=2.0, max=5.0),
            chunk_delay=DelayConfig(min=1.0, max=3.0)
        )
        assert options.is_enabled()
        assert options.has_round_delay()
        assert options.has_chunk_delay()

    def test_disabled_with_delays_configured(self):
        """Test disabled state overrides delay configuration"""
        options = NonHumanOptions(
            enabled=False,
            round_delay=DelayConfig(min=2.0, max=5.0),
            chunk_delay=DelayConfig(min=1.0, max=3.0)
        )
        assert not options.is_enabled()
        # Even with delays configured, they shouldn't be active when disabled
        assert not options.has_round_delay()
        assert not options.has_chunk_delay()

    def test_get_round_delay(self):
        """Test get_round_delay returns valid delay"""
        options = NonHumanOptions(
            enabled=True,
            round_delay=DelayConfig(min=2.0, max=5.0)
        )

        delay = options.get_round_delay()
        assert delay is not None
        assert 2.0 <= delay <= 5.0

    def test_get_round_delay_when_disabled(self):
        """Test get_round_delay returns None when disabled"""
        options = NonHumanOptions(
            enabled=False,
            round_delay=DelayConfig(min=2.0, max=5.0)
        )

        delay = options.get_round_delay()
        assert delay is None

    def test_get_round_delay_when_not_configured(self):
        """Test get_round_delay returns None when not configured"""
        options = NonHumanOptions(enabled=True)

        delay = options.get_round_delay()
        assert delay is None

    def test_get_chunk_delay(self):
        """Test get_chunk_delay returns valid delay"""
        options = NonHumanOptions(
            enabled=True,
            chunk_delay=DelayConfig(min=1.0, max=3.0)
        )

        delay = options.get_chunk_delay()
        assert delay is not None
        assert 1.0 <= delay <= 3.0

    def test_get_chunk_delay_when_disabled(self):
        """Test get_chunk_delay returns None when disabled"""
        options = NonHumanOptions(
            enabled=False,
            chunk_delay=DelayConfig(min=1.0, max=3.0)
        )

        delay = options.get_chunk_delay()
        assert delay is None

    def test_get_chunk_delay_when_not_configured(self):
        """Test get_chunk_delay returns None when not configured"""
        options = NonHumanOptions(enabled=True)

        delay = options.get_chunk_delay()
        assert delay is None


class TestNonHumanConfigManager:
    """Test NonHumanConfigManager class"""

    def test_parse_and_validate_valid_config(self):
        """Test parsing valid configuration"""
        config_dict = {
            "enabled": True,
            "round_delay": {"min": 2.0, "max": 5.0},
            "chunk_delay": {"min": 1.0, "max": 3.0}
        }

        options = NonHumanConfigManager.parse_and_validate(config_dict)
        assert options is not None
        assert options.is_enabled()
        assert options.has_round_delay()
        assert options.has_chunk_delay()

    def test_parse_and_validate_none(self):
        """Test parsing None returns None"""
        options = NonHumanConfigManager.parse_and_validate(None)
        assert options is None

    def test_parse_and_validate_empty_dict(self):
        """Test parsing empty dict returns None"""
        options = NonHumanConfigManager.parse_and_validate({})
        assert options is None

    def test_parse_and_validate_invalid_config(self):
        """Test parsing invalid configuration returns None"""
        config_dict = {
            "enabled": True,
            "round_delay": {"min": -1.0, "max": 5.0}  # Invalid: negative min
        }

        options = NonHumanConfigManager.parse_and_validate(config_dict)
        assert options is None

    def test_parse_and_validate_disabled_config(self):
        """Test parsing disabled configuration"""
        config_dict = {
            "enabled": False,
            "round_delay": {"min": 2.0, "max": 5.0}
        }

        options = NonHumanConfigManager.parse_and_validate(config_dict)
        assert options is not None
        assert not options.is_enabled()

    def test_direct_context_access(self):
        """Test direct access to context methods"""
        # Mock agent context
        class MockAgentContext:
            def __init__(self):
                self._non_human_options = None

            def set_non_human_options(self, options):
                self._non_human_options = options

            def get_non_human_options(self):
                return self._non_human_options

        agent_context = MockAgentContext()

        # Create options
        options = NonHumanOptions(
            enabled=True,
            round_delay=DelayConfig(min=2.0, max=5.0),
            chunk_delay=DelayConfig(min=1.0, max=3.0)
        )

        # Store directly to context
        agent_context.set_non_human_options(options)

        # Load directly from context
        loaded_options = agent_context.get_non_human_options()

        assert loaded_options is not None
        assert loaded_options.is_enabled()
        assert loaded_options.has_round_delay()
        assert loaded_options.has_chunk_delay()

    def test_get_from_context_when_not_set(self):
        """Test getting from context when nothing is set"""
        class MockAgentContext:
            def __init__(self):
                self._non_human_options = None

            def get_non_human_options(self):
                return self._non_human_options

        agent_context = MockAgentContext()

        loaded_options = agent_context.get_non_human_options()
        assert loaded_options is None

    def test_set_and_get_directly(self):
        """Test setting and getting from context directly"""
        class MockAgentContext:
            def __init__(self):
                self._non_human_options = None

            def set_non_human_options(self, options):
                self._non_human_options = options

            def get_non_human_options(self):
                return self._non_human_options

        agent_context = MockAgentContext()

        # Create and set options object
        options = NonHumanOptions(
            enabled=True,
            round_delay=DelayConfig(min=2.0, max=5.0)
        )
        agent_context.set_non_human_options(options)

        # Get should return the same object
        loaded_options = agent_context.get_non_human_options()

        assert loaded_options is not None
        assert loaded_options.is_enabled()
        assert loaded_options.has_round_delay()

    def test_context_dedicated_api(self):
        """Test using context's dedicated API for non-human options"""
        class MockAgentContext:
            def __init__(self):
                self._non_human_options = None

            def set_non_human_options(self, options):
                self._non_human_options = options

            def get_non_human_options(self):
                return self._non_human_options

        agent_context = MockAgentContext()

        # Verify no options set initially
        assert agent_context.get_non_human_options() is None

        # Set options using dedicated API
        options = NonHumanOptions(enabled=True, round_delay=DelayConfig(min=1.0, max=2.0))
        agent_context.set_non_human_options(options)

        # Verify options can be retrieved
        retrieved = agent_context.get_non_human_options()
        assert retrieved is not None
        assert retrieved.is_enabled()
        assert retrieved.has_round_delay()


class TestIntegrationScenarios:
    """Integration test scenarios"""

    def test_complete_workflow(self):
        """Test complete workflow from parsing to usage"""
        # 1. Parse configuration from request
        config_dict = {
            "enabled": True,
            "round_delay": {"min": 2.0, "max": 5.0},
            "chunk_delay": {"min": 1.0, "max": 3.0}
        }

        options = NonHumanConfigManager.parse_and_validate(config_dict)
        assert options is not None

        # 2. Store to agent context
        class MockAgentContext:
            def __init__(self):
                self._non_human_options = None

            def set_non_human_options(self, options):
                self._non_human_options = options

            def get_non_human_options(self):
                return self._non_human_options

        agent_context = MockAgentContext()
        agent_context.set_non_human_options(options)

        # 3. Get from context in different part of code
        loaded_options = agent_context.get_non_human_options()
        assert loaded_options is not None

        # 4. Check and get delays
        if loaded_options.has_round_delay():
            delay = loaded_options.get_round_delay()
            assert 2.0 <= delay <= 5.0

        if loaded_options.has_chunk_delay():
            delay = loaded_options.get_chunk_delay()
            assert 1.0 <= delay <= 3.0

    def test_edge_case_zero_delay(self):
        """Test edge case with zero delay (min=0, max=0)"""
        options = NonHumanOptions(
            enabled=True,
            round_delay=DelayConfig(min=0.0, max=0.0)
        )

        assert options.has_round_delay()
        delay = options.get_round_delay()
        assert delay == 0.0

    def test_edge_case_max_allowed_delay(self):
        """Test edge case with maximum allowed delays"""
        options = NonHumanOptions(
            enabled=True,
            round_delay=DelayConfig(min=30.0, max=60.0)
        )

        assert options.has_round_delay()
        delay = options.get_round_delay()
        assert 30.0 <= delay <= 60.0
