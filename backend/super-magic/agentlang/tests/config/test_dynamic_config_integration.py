"""Integration tests for DynamicConfig with real API

These tests use real API calls with credentials from environment variables:
- MAGIC_API_BASE_URL: The base URL of the Magic API
- MAGIC_API_KEY: The API key for authentication

These tests are skipped if environment variables are not set.
"""

import os
import tempfile
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
import yaml

from agentlang.config.dynamic_config import DynamicConfig


# Check if environment variables are set
MAGIC_API_BASE_URL = os.getenv("MAGIC_API_BASE_URL")
MAGIC_API_KEY = os.getenv("MAGIC_API_KEY")

# Skip all tests in this module if credentials are not available
pytestmark = pytest.mark.skipif(
    not MAGIC_API_BASE_URL or not MAGIC_API_KEY,
    reason="MAGIC_API_BASE_URL and MAGIC_API_KEY environment variables must be set for integration tests"
)


class TestDynamicConfigIntegration:
    """Integration test suite for DynamicConfig with real API"""

    @pytest.fixture
    def temp_config_dir(self):
        """Create temporary directory for test config"""
        temp_dir = tempfile.mkdtemp()
        temp_config_dir = Path(temp_dir) / "config"
        temp_config_dir.mkdir(parents=True, exist_ok=True)
        yield temp_dir, temp_config_dir

        # Cleanup
        import shutil
        if Path(temp_dir).exists():
            shutil.rmtree(temp_dir)

    @pytest.fixture
    def config_instance(self, temp_config_dir):
        """Create DynamicConfig instance with mocked path"""
        temp_dir, temp_config_dir = temp_config_dir

        # Reset singleton
        DynamicConfig._instance = None

        # Mock ApplicationContext to use temp directory
        with patch('agentlang.config.dynamic_config.ApplicationContext') as mock_app_context:
            mock_path_manager = MagicMock()
            mock_path_manager.get_project_root.return_value = Path(temp_dir)
            mock_app_context.get_path_manager.return_value = mock_path_manager

            instance = DynamicConfig()
            yield instance

        # Reset singleton after test
        DynamicConfig._instance = None

    @pytest.mark.asyncio
    async def test_validate_and_write_with_real_api_enrichment(self, config_instance):
        """Test complete flow: validate -> enrich from real API -> write config"""
        # Get first available model from API to use as test model
        from agentlang.config.model_info_enricher import ModelInfoEnricher
        enricher = ModelInfoEnricher()

        try:
            models_map = await enricher.fetch_models_info(
                api_base_url=MAGIC_API_BASE_URL,
                api_key=MAGIC_API_KEY
            )

            assert models_map is not None, "Failed to fetch models from API"
            assert len(models_map) > 0, "No models available"

            # Get first model ID
            test_model_id = list(models_map.keys())[0]

            print(f"\n✅ Using test model: {test_model_id}")

            # Create minimal config (only required fields)
            test_config = {
                "models": {
                    test_model_id: {
                        "api_key": MAGIC_API_KEY,
                        "api_base_url": MAGIC_API_BASE_URL,
                        "name": test_model_id
                    }
                }
            }

            # Call validate_and_write (should enrich from API)
            success, config_path, warnings = await config_instance.validate_and_write_dynamic_config(
                test_config
            )

            # Verify success
            assert success is True, f"Config validation failed: {warnings}"
            assert config_path == str(config_instance._dynamic_config_path)
            assert config_instance._dynamic_config_path.exists()

            print(f"\n✅ Config written successfully to: {config_path}")
            if warnings:
                print(f"⚠️  Warnings: {warnings}")

            # Read back the written config
            with open(config_instance._dynamic_config_path, 'r', encoding='utf-8') as f:
                written_config = yaml.safe_load(f)

            assert "models" in written_config
            assert test_model_id in written_config["models"]

            enriched_model = written_config["models"][test_model_id]

            print(f"\n✅ Enriched model config for '{test_model_id}':")
            for key, value in enriched_model.items():
                if key not in ["api_key"]:  # Don't print sensitive data
                    if key == "metadata" and isinstance(value, dict):
                        print(f"  {key}:")
                        for meta_key, meta_value in value.items():
                            print(f"    {meta_key}: {meta_value}")
                    elif key == "pricing" and isinstance(value, dict):
                        print(f"  {key}:")
                        for price_key, price_value in value.items():
                            print(f"    {price_key}: {price_value}")
                    else:
                        print(f"  {key}: {value}")

            # Verify required fields are preserved
            assert enriched_model["api_key"] == MAGIC_API_KEY
            assert enriched_model["api_base_url"] == MAGIC_API_BASE_URL
            assert enriched_model["name"] == test_model_id

            # Check if enrichment worked (model should have enriched fields)
            # These fields might be enriched from API
            enriched_fields = []
            if "max_context_tokens" in enriched_model:
                enriched_fields.append("max_context_tokens")
            if "max_output_tokens" in enriched_model:
                enriched_fields.append("max_output_tokens")
            if "temperature" in enriched_model:
                enriched_fields.append("temperature")
            if "supports_tool_use" in enriched_model:
                enriched_fields.append("supports_tool_use")
            if "metadata" in enriched_model:
                enriched_fields.append("metadata")

            if enriched_fields:
                print(f"\n✅ Successfully enriched fields from API: {enriched_fields}")
            else:
                print("\n⚠️  No fields were enriched from API (model might not have extended info)")

        finally:
            await enricher.close()

    @pytest.mark.asyncio
    async def test_validate_and_write_multiple_models_real_api(self, config_instance):
        """Test enriching multiple models with real API"""
        from agentlang.config.model_info_enricher import ModelInfoEnricher
        enricher = ModelInfoEnricher()

        try:
            # Fetch available models
            models_map = await enricher.fetch_models_info(
                api_base_url=MAGIC_API_BASE_URL,
                api_key=MAGIC_API_KEY
            )

            assert models_map is not None
            assert len(models_map) > 0

            # Get first 3 models
            test_model_ids = list(models_map.keys())[:3]

            print(f"\n✅ Testing with {len(test_model_ids)} models: {test_model_ids}")

            # Create config for multiple models
            test_config = {
                "models": {}
            }

            for model_id in test_model_ids:
                test_config["models"][model_id] = {
                    "api_key": MAGIC_API_KEY,
                    "api_base_url": MAGIC_API_BASE_URL,
                    "name": model_id
                }

            # Validate and write
            success, config_path, warnings = await config_instance.validate_and_write_dynamic_config(
                test_config
            )

            assert success is True
            assert config_instance._dynamic_config_path.exists()

            # Read and verify
            models_config = config_instance.read_models_config()
            assert models_config is not None

            for model_id in test_model_ids:
                assert model_id in models_config
                print(f"✅ Model '{model_id}' written successfully")

            print(f"\n✅ All {len(test_model_ids)} models enriched and written successfully")

        finally:
            await enricher.close()

    @pytest.mark.asyncio
    async def test_validate_and_write_with_user_overrides(self, config_instance):
        """Test that user-provided values take priority over API values"""
        from agentlang.config.model_info_enricher import ModelInfoEnricher
        enricher = ModelInfoEnricher()

        try:
            # Fetch models
            models_map = await enricher.fetch_models_info(
                api_base_url=MAGIC_API_BASE_URL,
                api_key=MAGIC_API_KEY
            )

            assert models_map is not None
            assert len(models_map) > 0

            test_model_id = list(models_map.keys())[0]

            # Create config with user-specified values
            user_temperature = 0.9
            user_max_tokens = 32000  # Above minimum limit of 8192

            test_config = {
                "models": {
                    test_model_id: {
                        "api_key": MAGIC_API_KEY,
                        "api_base_url": MAGIC_API_BASE_URL,
                        "name": test_model_id,
                        "temperature": user_temperature,  # User override
                        "max_output_tokens": user_max_tokens  # User override (above minimum)
                    }
                }
            }

            # Validate and write
            success, config_path, warnings = await config_instance.validate_and_write_dynamic_config(
                test_config
            )

            assert success is True

            # Read back and verify user values are preserved
            models_config = config_instance.read_models_config()
            enriched_model = models_config[test_model_id]

            # User-specified values should be preserved (when above minimum limits)
            assert enriched_model["temperature"] == user_temperature, \
                f"User temperature should be preserved, got {enriched_model['temperature']}"
            assert enriched_model["max_output_tokens"] == user_max_tokens, \
                f"User max_output_tokens should be preserved, got {enriched_model['max_output_tokens']}"

            print(f"\n✅ User-specified values correctly preserved:")
            print(f"  temperature: {enriched_model['temperature']} (user value: {user_temperature})")
            print(f"  max_output_tokens: {enriched_model['max_output_tokens']} (user value: {user_max_tokens})")

        finally:
            await enricher.close()

    @pytest.mark.asyncio
    async def test_validate_and_write_nonexistent_model_with_fallback(self, config_instance):
        """Test handling of nonexistent model (should use defaults)"""
        # Create config with a model that doesn't exist
        nonexistent_model = "nonexistent-test-model-12345"

        test_config = {
            "models": {
                nonexistent_model: {
                    "api_key": MAGIC_API_KEY,
                    "api_base_url": MAGIC_API_BASE_URL,
                    "name": nonexistent_model
                }
            }
        }

        # Validate and write
        success, config_path, warnings = await config_instance.validate_and_write_dynamic_config(
            test_config
        )

        # Should still succeed (will use defaults)
        assert success is True

        # Read back and verify defaults were used
        models_config = config_instance.read_models_config()
        assert nonexistent_model in models_config

        model_config = models_config[nonexistent_model]

        # Should have default values
        assert "type" in model_config
        assert "provider" in model_config
        assert "supports_tool_use" in model_config

        print(f"\n✅ Nonexistent model handled correctly with defaults:")
        print(f"  type: {model_config.get('type')}")
        print(f"  provider: {model_config.get('provider')}")
        print(f"  supports_tool_use: {model_config.get('supports_tool_use')}")

    @pytest.mark.asyncio
    async def test_api_enrichment_failure_graceful_fallback(self, config_instance):
        """Test graceful fallback when API enrichment fails"""
        # Use an invalid API URL to simulate failure
        test_config = {
            "models": {
                "test-model": {
                    "api_key": MAGIC_API_KEY,
                    "api_base_url": "https://invalid-api-url-that-does-not-exist.com/v1",
                    "name": "test-model"
                }
            }
        }

        # Should still succeed (fallback to defaults)
        success, config_path, warnings = await config_instance.validate_and_write_dynamic_config(
            test_config
        )

        assert success is True, "Should succeed even when API enrichment fails"

        # Verify config was written
        models_config = config_instance.read_models_config()
        assert "test-model" in models_config

        print("\n✅ Gracefully handled API enrichment failure")

    @pytest.mark.asyncio
    async def test_real_config_file_structure(self, config_instance):
        """Test the structure of generated config file with real API"""
        from agentlang.config.model_info_enricher import ModelInfoEnricher
        enricher = ModelInfoEnricher()

        try:
            # Fetch models
            models_map = await enricher.fetch_models_info(
                api_base_url=MAGIC_API_BASE_URL,
                api_key=MAGIC_API_KEY
            )

            assert models_map is not None
            test_model_id = list(models_map.keys())[0]

            # Create config
            test_config = {
                "models": {
                    test_model_id: {
                        "api_key": MAGIC_API_KEY,
                        "api_base_url": MAGIC_API_BASE_URL,
                        "name": test_model_id
                    }
                }
            }

            # Write config
            success, config_path, warnings = await config_instance.validate_and_write_dynamic_config(
                test_config
            )

            assert success is True

            # Read the raw YAML file
            with open(config_instance._dynamic_config_path, 'r', encoding='utf-8') as f:
                file_content = f.read()
                yaml_config = yaml.safe_load(file_content)

            print(f"\n✅ Generated config file structure:")
            print(f"{'='*60}")
            print(file_content)
            print(f"{'='*60}")

            # Verify structure
            assert isinstance(yaml_config, dict)
            assert "models" in yaml_config
            assert isinstance(yaml_config["models"], dict)
            assert test_model_id in yaml_config["models"]

            model_config = yaml_config["models"][test_model_id]

            # Verify required fields
            required_fields = ["api_key", "api_base_url", "name"]
            for field in required_fields:
                assert field in model_config, f"Required field '{field}' missing"

            # Check for enriched fields
            optional_enriched_fields = [
                "max_context_tokens",
                "max_output_tokens",
                "temperature",
                "supports_tool_use",
                "metadata",
                "type",
                "provider"
            ]

            found_fields = [f for f in optional_enriched_fields if f in model_config]
            print(f"\n✅ Config contains {len(found_fields)} enriched/default fields: {found_fields}")

        finally:
            await enricher.close()

    @pytest.mark.asyncio
    async def test_pricing_sync_with_real_data(self, config_instance):
        """Test that pricing information is synced to ModelPricing"""
        from agentlang.config.model_info_enricher import ModelInfoEnricher
        enricher = ModelInfoEnricher()

        try:
            # Fetch models
            models_map = await enricher.fetch_models_info(
                api_base_url=MAGIC_API_BASE_URL,
                api_key=MAGIC_API_KEY
            )

            assert models_map is not None
            test_model_id = list(models_map.keys())[0]

            # Create config with pricing info
            test_config = {
                "models": {
                    test_model_id: {
                        "api_key": MAGIC_API_KEY,
                        "api_base_url": MAGIC_API_BASE_URL,
                        "name": test_model_id,
                        "pricing": {
                            "input_price": 0.001,
                            "output_price": 0.002,
                            "currency": "USD"
                        }
                    }
                }
            }

            # Write config (should sync pricing)
            success, config_path, warnings = await config_instance.validate_and_write_dynamic_config(
                test_config
            )

            assert success is True

            # Note: We can't easily verify ModelPricing sync without access to LLMFactory,
            # but we can verify the pricing info is in the written config
            models_config = config_instance.read_models_config()
            assert "pricing" in models_config[test_model_id]

            print(f"\n✅ Pricing info included in config:")
            print(f"  {models_config[test_model_id]['pricing']}")

        finally:
            await enricher.close()
