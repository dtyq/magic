"""
Unit tests for app-level AI abilities definitions

Tests the AIAbility enum and get_ability_config helper function.
"""
import pytest
from app.core.ai_abilities import AIAbility, AI_ABILITY_DEFAULTS, get_ability_config


class TestAIAbilityEnum:
    """Test AIAbility enumeration"""

    def test_ai_ability_enum_values(self):
        """Test AI ability enum values"""
        assert AIAbility.VISUAL_UNDERSTANDING.value == "visual_understanding"
        assert AIAbility.SUMMARIZE.value == "summarize"

    def test_ai_ability_enum_string_conversion(self):
        """Test that AIAbility can be used as string"""
        ability = AIAbility.VISUAL_UNDERSTANDING
        # AIAbility inherits from str, so it can be used directly as a string
        assert ability.value == "visual_understanding"
        # When passed as argument, it works as string
        assert AIAbility.VISUAL_UNDERSTANDING == "visual_understanding"

    def test_ai_ability_enum_iteration(self):
        """Test that AIAbility enum can be iterated"""
        abilities = list(AIAbility)
        assert len(abilities) == 6  # v1.0 has 2, v1.1 has 4 more
        assert AIAbility.VISUAL_UNDERSTANDING in abilities
        assert AIAbility.SUMMARIZE in abilities
        assert AIAbility.SMART_FILENAME in abilities
        assert AIAbility.PURIFY in abilities
        assert AIAbility.DEEP_WRITE in abilities
        assert AIAbility.ANALYSIS_SLIDE in abilities


class TestAIAbilityDefaults:
    """Test AI_ABILITY_DEFAULTS configuration"""

    def test_visual_understanding_defaults(self):
        """Test visual understanding default configuration"""
        visual_defaults = AI_ABILITY_DEFAULTS[AIAbility.VISUAL_UNDERSTANDING]

        assert visual_defaults["model_id"] == "doubao-seed-1.6-vision"
        assert visual_defaults["timeout"] == 120
        assert visual_defaults["max_images"] == 10
        assert visual_defaults["enabled"] is True

    def test_summarize_defaults(self):
        """Test summarize default configuration"""
        summarize_defaults = AI_ABILITY_DEFAULTS[AIAbility.SUMMARIZE]

        assert summarize_defaults["model_id"] == "qwen-flash"
        assert summarize_defaults["default_target_length"] == 500
        assert summarize_defaults["enabled"] is True

    def test_all_abilities_have_defaults(self):
        """Test that all abilities have default configurations"""
        for ability in AIAbility:
            assert ability in AI_ABILITY_DEFAULTS
            assert isinstance(AI_ABILITY_DEFAULTS[ability], dict)

    def test_defaults_contain_model_id(self):
        """Test that all defaults contain model_id"""
        for ability in AIAbility:
            assert "model_id" in AI_ABILITY_DEFAULTS[ability]
            assert isinstance(AI_ABILITY_DEFAULTS[ability]["model_id"], str)


class TestGetAbilityConfig:
    """Test get_ability_config helper function"""

    def test_get_ability_config_basic(self):
        """Test basic usage of get_ability_config"""
        model_id = get_ability_config(AIAbility.VISUAL_UNDERSTANDING, "model_id")
        assert model_id is not None
        assert isinstance(model_id, str)

    def test_get_ability_config_with_custom_default(self):
        """Test get_ability_config with custom default"""
        value = get_ability_config(
            AIAbility.VISUAL_UNDERSTANDING,
            "non_existent_key",
            default="custom_default"
        )
        assert value == "custom_default"

    def test_get_ability_config_uses_app_defaults(self):
        """Test that get_ability_config falls back to app defaults"""
        # Get a config that doesn't exist in config files
        # Should fall back to AI_ABILITY_DEFAULTS
        value = get_ability_config(AIAbility.VISUAL_UNDERSTANDING, "timeout")
        # Should get from config.yaml or fall back to defaults
        assert value is not None

    def test_get_ability_config_all_abilities(self):
        """Test get_ability_config works for all abilities"""
        for ability in AIAbility:
            model_id = get_ability_config(ability, "model_id")
            assert model_id is not None
            assert isinstance(model_id, str)
