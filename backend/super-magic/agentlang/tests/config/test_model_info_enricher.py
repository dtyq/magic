"""Tests for ModelInfoEnricher"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import httpx

from agentlang.config.model_info_enricher import ModelInfoEnricher


class TestModelInfoEnricher:
    """Test suite for ModelInfoEnricher"""

    @pytest.fixture
    def enricher(self):
        """Create enricher instance"""
        return ModelInfoEnricher()

    @pytest.fixture
    def mock_models_response_with_info(self):
        """Mock models API response with info"""
        return {
            "object": "list",
            "data": [
                {
                    "id": "test-model",
                    "object": "model",
                    "created_at": 1743771205,
                    "owner_by": "Test",
                    "info": {
                        "options": {
                            "max_tokens": 128000,
                            "max_output_tokens": 64000,
                            "default_temperature": 0.7,
                            "function_call": True,
                            "multi_modal": True
                        },
                        "attributes": {
                            "label": "Test Model",
                            "icon": "https://example.com/icon.png",
                            "provider_alias": "Test Provider",
                            "provider_model_id": "test-123",
                            "provider_id": "provider-456"
                        }
                    }
                }
            ]
        }

    @pytest.fixture
    def mock_models_response_no_info(self):
        """Mock standard OpenAI models API response (no info)"""
        return {
            "object": "list",
            "data": [
                {
                    "id": "test-model",
                    "object": "model",
                    "created": 1686935002,
                    "owned_by": "openai"
                }
            ]
        }

    @pytest.mark.asyncio
    async def test_fetch_models_info_success(self, enricher, mock_models_response_with_info):
        """Test successful fetch of models info"""
        # Mock HTTP client
        mock_response = MagicMock()
        mock_response.json = MagicMock(return_value=mock_models_response_with_info)
        mock_response.raise_for_status = MagicMock()

        enricher._client.get = AsyncMock(return_value=mock_response)

        # Call method
        result = await enricher.fetch_models_info(
            "https://api.example.com/v1",
            "sk-test-key"
        )

        # Verify
        assert result is not None
        assert "test-model" in result
        assert result["test-model"]["id"] == "test-model"
        assert "info" in result["test-model"]

        # Verify HTTP call
        enricher._client.get.assert_called_once()
        call_args = enricher._client.get.call_args
        assert call_args[0][0] == "https://api.example.com/v1/models"
        assert call_args[1]["params"] == {"with_info": "1", "type": "chat"}
        assert "Authorization" in call_args[1]["headers"]

    @pytest.mark.asyncio
    async def test_fetch_models_info_no_info(self, enricher, mock_models_response_no_info):
        """Test fetch with standard OpenAI format (no info)"""
        # Mock HTTP client
        mock_response = MagicMock()
        mock_response.json = MagicMock(return_value=mock_models_response_no_info)
        mock_response.raise_for_status = MagicMock()

        enricher._client.get = AsyncMock(return_value=mock_response)

        # Call method
        result = await enricher.fetch_models_info(
            "https://api.openai.com/v1",
            "sk-test-key"
        )

        # Verify - should still work
        assert result is not None
        assert "test-model" in result

    @pytest.mark.asyncio
    async def test_fetch_models_info_network_error(self, enricher):
        """Test network error handling"""
        # Mock network error
        enricher._client.get = AsyncMock(side_effect=httpx.RequestError("Network error"))

        # Call method
        result = await enricher.fetch_models_info(
            "https://api.example.com/v1",
            "sk-test-key"
        )

        # Should return None on error
        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_models_info_http_error(self, enricher):
        """Test HTTP error handling"""
        # Mock HTTP error
        mock_response = MagicMock()
        mock_response.status_code = 401
        enricher._client.get = AsyncMock(
            side_effect=httpx.HTTPStatusError("Unauthorized", request=MagicMock(), response=mock_response)
        )

        # Call method
        result = await enricher.fetch_models_info(
            "https://api.example.com/v1",
            "sk-invalid-key"
        )

        # Should return None on error
        assert result is None

    def test_extract_model_config_from_info(self, enricher):
        """Test extraction of config from info"""
        model_data = {
            "id": "test-model",
            "info": {
                "options": {
                    "max_tokens": 128000,
                    "max_output_tokens": 64000,
                    "default_temperature": 0.7,
                    "function_call": True
                },
                "attributes": {
                    "label": "Test Model",
                    "provider_alias": "Test Provider"
                }
            }
        }

        result = enricher.extract_model_config_from_info(model_data)

        assert result["max_context_tokens"] == 128000
        assert result["max_output_tokens"] == 64000
        assert result["temperature"] == 0.7
        assert result["supports_tool_use"] is True
        assert result["metadata"]["label"] == "Test Model"
        assert result["metadata"]["provider_alias"] == "Test Provider"

    def test_extract_model_config_no_info(self, enricher):
        """Test extraction when no info field"""
        model_data = {
            "id": "test-model",
            "object": "model"
        }

        result = enricher.extract_model_config_from_info(model_data)

        # Should return empty dict
        assert result == {}

    def test_extract_temperature_priority(self, enricher):
        """Test temperature priority: fixed_temperature > default_temperature"""
        # Test with only fixed_temperature
        model_data_fixed = {
            "id": "test-model",
            "info": {
                "options": {
                    "fixed_temperature": 1.0
                }
            }
        }
        result = enricher.extract_model_config_from_info(model_data_fixed)
        assert result["temperature"] == 1.0

        # Test with only default_temperature
        model_data_default = {
            "id": "test-model",
            "info": {
                "options": {
                    "default_temperature": 0.7
                }
            }
        }
        result = enricher.extract_model_config_from_info(model_data_default)
        assert result["temperature"] == 0.7

        # Test with both (should use fixed_temperature)
        model_data_both = {
            "id": "test-model",
            "info": {
                "options": {
                    "fixed_temperature": 1.0,
                    "default_temperature": 0.7
                }
            }
        }
        result = enricher.extract_model_config_from_info(model_data_both)
        assert result["temperature"] == 1.0

    def test_merge_model_config(self, enricher):
        """Test config merging"""
        base_config = {
            "api_key": "sk-test",
            "api_base_url": "https://api.example.com/v1",
            "name": "test-model",
            "temperature": 0.8  # User-specified
        }

        info_config = {
            "max_context_tokens": 128000,
            "max_output_tokens": 64000,
            "temperature": 0.7,  # From API, should not override
            "supports_tool_use": True,
            "metadata": {
                "label": "Test Model"
            }
        }

        result = enricher.merge_model_config(base_config, info_config)

        # User-specified value should be preserved
        assert result["temperature"] == 0.8
        # API values should be added
        assert result["max_context_tokens"] == 128000
        assert result["max_output_tokens"] == 64000
        assert result["supports_tool_use"] is True
        assert result["metadata"]["label"] == "Test Model"

    def test_merge_model_config_priority(self, enricher):
        """Test config merge priority"""
        base_config = {
            "api_key": "sk-test",
            "max_output_tokens": 10000  # User wants lower value
        }

        info_config = {
            "max_output_tokens": 64000,  # API default
            "max_context_tokens": 128000
        }

        result = enricher.merge_model_config(base_config, info_config)

        # User value has priority
        assert result["max_output_tokens"] == 10000
        # New field from API should be added
        assert result["max_context_tokens"] == 128000

    @pytest.mark.asyncio
    async def test_enrich_models_config(self, enricher, mock_models_response_with_info):
        """Test batch enrichment"""
        models_config = {
            "test-model": {
                "api_key": "sk-test",
                "api_base_url": "https://api.example.com/v1",
                "name": "test-model"
            }
        }

        # Mock HTTP client
        mock_response = MagicMock()
        mock_response.json = MagicMock(return_value=mock_models_response_with_info)
        mock_response.raise_for_status = MagicMock()
        enricher._client.get = AsyncMock(return_value=mock_response)

        # Call method
        result, warnings = await enricher.enrich_models_config(models_config)

        # Verify enrichment
        assert "test-model" in result
        assert result["test-model"]["max_context_tokens"] == 128000
        assert result["test-model"]["max_output_tokens"] == 64000

    @pytest.mark.asyncio
    async def test_enrich_models_config_with_errors(self, enricher):
        """Test batch enrichment with partial failures"""
        models_config = {
            "model-1": {
                "api_key": "sk-test-1",
                "api_base_url": "https://api1.example.com/v1",
                "name": "model-1"
            },
            "model-2": {
                "api_key": "sk-test-2",
                "api_base_url": "https://api2.example.com/v1",
                "name": "model-2"
            }
        }

        # Mock first call success, second call failure
        call_count = 0
        async def mock_get(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                mock_response = MagicMock()
                mock_response.json = MagicMock(return_value={
                    "object": "list",
                    "data": [{"id": "model-1", "info": {"options": {"max_tokens": 100000}}}]
                })
                mock_response.raise_for_status = MagicMock()
                return mock_response
            else:
                raise httpx.RequestError("Network error")

        enricher._client.get = AsyncMock(side_effect=mock_get)

        # Call method
        result, warnings = await enricher.enrich_models_config(models_config)

        # Both models should be in result (failed one uses original config)
        assert "model-1" in result
        assert "model-2" in result
        # model-1 should be enriched
        assert "max_context_tokens" in result["model-1"]
        # model-2 should keep original config
        assert result["model-2"]["api_key"] == "sk-test-2"

    def test_group_models_by_url(self, enricher):
        """Test grouping models by URL"""
        models_config = {
            "model-1": {
                "api_base_url": "https://api1.example.com/v1/"
            },
            "model-2": {
                "api_base_url": "https://api1.example.com/v1"  # Same URL, different trailing slash
            },
            "model-3": {
                "api_base_url": "https://api2.example.com/v1"
            }
        }

        result = enricher._group_models_by_url(models_config)

        # Should normalize URLs and group correctly
        assert len(result) == 2
        assert "https://api1.example.com/v1" in result
        assert len(result["https://api1.example.com/v1"]) == 2
        assert "model-1" in result["https://api1.example.com/v1"]
        assert "model-2" in result["https://api1.example.com/v1"]
