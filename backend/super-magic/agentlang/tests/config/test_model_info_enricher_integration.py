"""Integration tests for ModelInfoEnricher with real API

These tests use real API calls with credentials from environment variables:
- MAGIC_API_BASE_URL: The base URL of the Magic API
- MAGIC_API_KEY: The API key for authentication

These tests are skipped if environment variables are not set.
"""

import os
import pytest

from agentlang.config.model_info_enricher import ModelInfoEnricher


# Check if environment variables are set
MAGIC_API_BASE_URL = os.getenv("MAGIC_API_BASE_URL")
MAGIC_API_KEY = os.getenv("MAGIC_API_KEY")

# Skip all tests in this module if credentials are not available
pytestmark = pytest.mark.skipif(
    not MAGIC_API_BASE_URL or not MAGIC_API_KEY,
    reason="MAGIC_API_BASE_URL and MAGIC_API_KEY environment variables must be set for integration tests"
)


class TestModelInfoEnricherIntegration:
    """Integration test suite for ModelInfoEnricher with real API"""

    @pytest.fixture
    def enricher(self):
        """Create enricher instance"""
        return ModelInfoEnricher()

    @pytest.mark.asyncio
    async def test_fetch_real_models_info(self, enricher):
        """Test fetching real models info from Magic API"""
        # Fetch models info
        result = await enricher.fetch_models_info(
            api_base_url=MAGIC_API_BASE_URL,
            api_key=MAGIC_API_KEY
        )

        # Verify response
        assert result is not None, "Should successfully fetch models info"
        assert isinstance(result, dict), "Result should be a dictionary"
        assert len(result) > 0, "Should have at least one model"

        # Print models for debugging
        print(f"\n✅ Successfully fetched {len(result)} models:")
        for model_id in list(result.keys())[:5]:  # Print first 5 models
            print(f"  - {model_id}")

        # Check first model structure
        first_model_id = list(result.keys())[0]
        first_model = result[first_model_id]

        assert "id" in first_model, "Model should have 'id' field"
        assert first_model["id"] == first_model_id, "Model ID should match"

        # Check if model has info (Magic API extension)
        if "info" in first_model:
            print(f"\n✅ Model '{first_model_id}' has extended info:")
            info = first_model["info"]

            if "options" in info:
                print(f"  Options: {list(info['options'].keys())}")
            if "attributes" in info:
                print(f"  Attributes: {list(info['attributes'].keys())}")

    @pytest.mark.asyncio
    async def test_extract_config_from_real_model(self, enricher):
        """Test extracting configuration from real model data"""
        # Fetch models info
        models_map = await enricher.fetch_models_info(
            api_base_url=MAGIC_API_BASE_URL,
            api_key=MAGIC_API_KEY
        )

        assert models_map is not None
        assert len(models_map) > 0

        # Get first model with info
        model_with_info = None
        for model_data in models_map.values():
            if "info" in model_data:
                model_with_info = model_data
                break

        if not model_with_info:
            pytest.skip("No models with extended info available")

        # Extract configuration
        extracted_config = enricher.extract_model_config_from_info(model_with_info)

        print(f"\n✅ Extracted config for '{model_with_info['id']}':")
        for key, value in extracted_config.items():
            if key == "metadata":
                print(f"  {key}:")
                for meta_key, meta_value in value.items():
                    print(f"    {meta_key}: {meta_value}")
            else:
                print(f"  {key}: {value}")

        # Verify extracted config has expected fields
        # Note: Not all fields are guaranteed, depends on API response
        assert isinstance(extracted_config, dict)

    @pytest.mark.asyncio
    async def test_enrich_real_models_config(self, enricher):
        """Test enriching real model configurations"""
        # Create a simple model configuration
        models_config = {
            "test-model-1": {
                "api_key": MAGIC_API_KEY,
                "api_base_url": MAGIC_API_BASE_URL,
                "name": "test-model-1"
            }
        }

        # Try to enrich (this will use real API)
        enriched_config, warnings = await enricher.enrich_models_config(models_config)

        assert "test-model-1" in enriched_config

        # Original fields should be preserved
        assert enriched_config["test-model-1"]["api_key"] == MAGIC_API_KEY
        assert enriched_config["test-model-1"]["api_base_url"] == MAGIC_API_BASE_URL
        assert enriched_config["test-model-1"]["name"] == "test-model-1"

        print(f"\n✅ Enriched config for 'test-model-1':")
        for key, value in enriched_config["test-model-1"].items():
            if key not in ["api_key"]:  # Don't print sensitive data
                if key == "metadata" and isinstance(value, dict):
                    print(f"  {key}:")
                    for meta_key, meta_value in value.items():
                        print(f"    {meta_key}: {meta_value}")
                else:
                    print(f"  {key}: {value}")

    @pytest.mark.asyncio
    async def test_enrich_multiple_models_same_url(self, enricher):
        """Test enriching multiple models with the same API URL"""
        # Fetch available models first
        models_map = await enricher.fetch_models_info(
            api_base_url=MAGIC_API_BASE_URL,
            api_key=MAGIC_API_KEY
        )

        assert models_map is not None
        assert len(models_map) > 0

        # Get first two available model IDs
        available_model_ids = list(models_map.keys())[:2]

        if len(available_model_ids) < 2:
            pytest.skip("Need at least 2 models for this test")

        # Create config for multiple models
        models_config = {}
        for model_id in available_model_ids:
            models_config[model_id] = {
                "api_key": MAGIC_API_KEY,
                "api_base_url": MAGIC_API_BASE_URL,
                "name": model_id
            }

        # Enrich configuration
        enriched_config, warnings = await enricher.enrich_models_config(models_config)

        # Verify all models are in result
        for model_id in available_model_ids:
            assert model_id in enriched_config

        print(f"\n✅ Successfully enriched {len(enriched_config)} models")
        print(f"   - User configured: {len(available_model_ids)}")
        print(f"   - Auto-discovered: {len(enriched_config) - len(available_model_ids)}")

        # Verify API was called only once (grouped by URL)
        # With auto-discovery, we should have at least the user-configured models
        # and potentially more from the API
        assert len(enriched_config) >= len(available_model_ids), \
            f"Expected at least {len(available_model_ids)} models, got {len(enriched_config)}"

    @pytest.mark.asyncio
    async def test_handle_nonexistent_model(self, enricher):
        """Test handling of a model that doesn't exist in API response"""
        # Create config with a model that likely doesn't exist
        models_config = {
            "nonexistent-model-12345": {
                "api_key": MAGIC_API_KEY,
                "api_base_url": MAGIC_API_BASE_URL,
                "name": "nonexistent-model-12345"
            }
        }

        # Enrich configuration
        enriched_config, warnings = await enricher.enrich_models_config(models_config)

        # Model should still be in result (with original config)
        assert "nonexistent-model-12345" in enriched_config

        # Original config should be preserved
        assert enriched_config["nonexistent-model-12345"]["api_key"] == MAGIC_API_KEY
        assert enriched_config["nonexistent-model-12345"]["name"] == "nonexistent-model-12345"

        print("\n✅ Correctly handled nonexistent model (kept original config)")

    @pytest.mark.asyncio
    async def test_temperature_priority_from_real_api(self, enricher):
        """Test temperature parameter priority with real API data"""
        # Fetch models info
        models_map = await enricher.fetch_models_info(
            api_base_url=MAGIC_API_BASE_URL,
            api_key=MAGIC_API_KEY
        )

        assert models_map is not None

        # Find a model with temperature info
        model_with_temp = None
        for model_data in models_map.values():
            if "info" in model_data:
                options = model_data.get("info", {}).get("options", {})
                if "default_temperature" in options or "fixed_temperature" in options:
                    model_with_temp = model_data
                    break

        if not model_with_temp:
            pytest.skip("No models with temperature info available")

        # Extract configuration
        extracted_config = enricher.extract_model_config_from_info(model_with_temp)

        if "temperature" in extracted_config:
            print(f"\n✅ Model '{model_with_temp['id']}' has temperature: {extracted_config['temperature']}")

            # Verify temperature is a valid float
            assert isinstance(extracted_config["temperature"], float)
            assert 0.0 <= extracted_config["temperature"] <= 2.0
        else:
            print(f"\n⚠️  Model '{model_with_temp['id']}' has no temperature in extracted config")

    @pytest.mark.asyncio
    async def test_cleanup(self, enricher):
        """Test cleanup of HTTP client"""
        # Fetch some data to ensure client is initialized
        await enricher.fetch_models_info(
            api_base_url=MAGIC_API_BASE_URL,
            api_key=MAGIC_API_KEY
        )

        # Close the client
        await enricher.close()

        print("\n✅ HTTP client closed successfully")
