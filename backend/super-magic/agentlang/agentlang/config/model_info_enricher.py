"""Model Info Enricher - Fetches and enriches model configurations from OpenAI Models API

This module provides functionality to automatically fetch model details from the Models API
and enrich model configurations with accurate information like context tokens, output tokens,
temperature settings, and metadata.
"""

import httpx
from typing import Dict, Any, Optional, List, Tuple

from agentlang.logger import get_logger
from agentlang.config.config import config
from agentlang.utils.metadata import MetadataUtil


class ModelInfoEnricher:
    """Model configuration enricher

    Fetches model details from OpenAI Models API and enriches configurations
    with accurate information to reduce reliance on hardcoded defaults.
    """

    def __init__(self, logger=None):
        """Initialize the enricher

        Args:
            logger: Optional logger instance
        """
        self._logger = logger or get_logger(__name__)
        self._client = httpx.AsyncClient(timeout=10.0)

    async def fetch_models_info(
        self,
        api_base_url: str,
        api_key: str
    ) -> Optional[Dict[str, Any]]:
        """Fetch model information from models endpoint

        Fixed parameters: with_info=1 and type=chat (proxy API extensions)

        Args:
            api_base_url: API base URL
            api_key: API key for authentication

        Returns:
            Dictionary mapping model ID to model data, or None if failed
        """
        try:
            # Build request URL
            url = f"{api_base_url.rstrip('/')}/models"

            # Build query parameters (fixed proxy API extension parameters)
            params = {
                "with_info": "1",  # Request extended information
                "type": "chat"     # Only get chat models
            }

            # Build request headers
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }

            # Add Magic-Authorization and User-Authorization headers
            MetadataUtil.add_magic_and_user_authorization_headers(headers)

            # Send request
            response = await self._client.get(url, params=params, headers=headers)
            response.raise_for_status()

            # Parse response
            data = response.json()

            # Validate response format
            if not isinstance(data, dict) or "data" not in data:
                self._logger.warning(f"Models list response format unexpected: {data}")
                return None

            # Build mapping from model ID to model data
            models_map = {}
            for model_data in data.get("data", []):
                if isinstance(model_data, dict) and "id" in model_data:
                    model_id = model_data["id"]
                    models_map[model_id] = model_data

            self._logger.info(f"Successfully fetched {len(models_map)} models info")
            return models_map

        except httpx.HTTPStatusError as e:
            self._logger.warning(f"Models list request failed (HTTP {e.response.status_code}): {e}")
            return None
        except httpx.RequestError as e:
            self._logger.warning(f"Models list network error: {e}")
            return None
        except Exception as e:
            self._logger.warning(f"Models list exception: {e}")
            return None

    def extract_model_config_from_info(
        self,
        model_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Extract configuration information from model info

        Args:
            model_data: Complete model data (including info)

        Returns:
            Extracted configuration dictionary
        """
        extracted = {}

        # Check for info field
        info = model_data.get("info")
        if not info or not isinstance(info, dict):
            self._logger.debug(f"Model {model_data.get('id')} has no info")
            return extracted

        # Extract options configuration
        options = info.get("options", {})
        if isinstance(options, dict):
            # max_tokens -> max_context_tokens
            if "max_tokens" in options and options["max_tokens"]:
                try:
                    extracted["max_context_tokens"] = int(options["max_tokens"])
                except (ValueError, TypeError):
                    pass

            # max_output_tokens
            if "max_output_tokens" in options and options["max_output_tokens"]:
                try:
                    extracted["max_output_tokens"] = int(options["max_output_tokens"])
                except (ValueError, TypeError):
                    pass

            # temperature priority: fixed_temperature > default_temperature > fallback default
            # Note: fixed_temperature represents a fixed temperature (highest priority)
            #       default_temperature represents the default temperature (second priority)
            if "fixed_temperature" in options and options["fixed_temperature"] is not None:
                try:
                    extracted["temperature"] = float(options["fixed_temperature"])
                except (ValueError, TypeError):
                    pass
            elif "default_temperature" in options and options["default_temperature"] is not None:
                try:
                    extracted["temperature"] = float(options["default_temperature"])
                except (ValueError, TypeError):
                    pass

            # supports_tool_use <- function_call
            if "function_call" in options:
                extracted["supports_tool_use"] = bool(options["function_call"])

        # Extract attributes metadata
        attributes = info.get("attributes", {})
        if isinstance(attributes, dict):
            metadata = {}

            if "label" in attributes and attributes["label"]:
                metadata["label"] = str(attributes["label"])

            if "icon" in attributes and attributes["icon"]:
                metadata["icon"] = str(attributes["icon"])

            if "provider_alias" in attributes and attributes["provider_alias"]:
                metadata["provider_alias"] = str(attributes["provider_alias"])

            if "provider_model_id" in attributes and attributes["provider_model_id"]:
                metadata["provider_model_id"] = str(attributes["provider_model_id"])

            if "provider_id" in attributes and attributes["provider_id"]:
                metadata["provider_id"] = str(attributes["provider_id"])

            if metadata:
                extracted["metadata"] = metadata

        return extracted

    def merge_model_config(
        self,
        base_config: Dict[str, Any],
        info_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Merge base config and info config

        Priority: base_config existing values > info_config values > defaults

        Args:
            base_config: Base configuration (user provided)
            info_config: Configuration extracted from info

        Returns:
            Merged configuration
        """
        # Start with base config
        merged = base_config.copy()

        # Merge info_config values (only when not present in base_config)
        for key, value in info_config.items():
            if key == "metadata":
                # Metadata special handling: deep merge
                if "metadata" not in merged:
                    merged["metadata"] = {}
                if isinstance(value, dict):
                    merged["metadata"].update(value)
            elif key not in merged or merged[key] is None:
                # Other fields: only fill when not present or None
                merged[key] = value

        return merged

    async def enrich_models_config(
        self,
        models_config: Dict[str, Dict[str, Any]]
    ) -> Tuple[Dict[str, Dict[str, Any]], List[str]]:
        """Enrich model configuration collection

        Args:
            models_config: Original model configuration dictionary

        Returns:
            Tuple of (enriched configuration dictionary, warning messages list)
        """
        warnings = []
        enriched_config = {}

        # Process environment variable placeholders before grouping
        # This ensures ${...} placeholders are resolved to actual values
        processed_models_config = config.process_env_placeholders(models_config)

        # Group models by api_base_url
        url_groups = self._group_models_by_url(processed_models_config)

        # Request models endpoint once for each URL
        for api_base_url, model_ids in url_groups.items():
            # Get api_key from first model
            first_model_id = model_ids[0]
            api_key = processed_models_config[first_model_id].get("api_key")

            if not api_key:
                self._logger.warning(f"Model group [{', '.join(model_ids)}] missing api_key, skipping enrichment")
                # Keep original config
                for model_id in model_ids:
                    enriched_config[model_id] = models_config[model_id]
                continue

            # Request model information
            models_info_map = await self.fetch_models_info(
                api_base_url=api_base_url,
                api_key=api_key
            )

            if not models_info_map:
                self._logger.warning(f"Failed to fetch models info from {api_base_url}, using original config")
                # Keep original config
                for model_id in model_ids:
                    enriched_config[model_id] = models_config[model_id]
                continue

            # Step 1: Enrich user-provided model configurations
            for model_id in model_ids:
                # Use original config (with placeholders) for merging and return
                base_config = models_config[model_id]

                try:
                    # Find corresponding model info
                    model_info = models_info_map.get(model_id)

                    if model_info:
                        # Extract configuration
                        info_config = self.extract_model_config_from_info(model_info)

                        # Merge configuration (preserves original placeholders in base_config)
                        enriched_config[model_id] = self.merge_model_config(
                            base_config, info_config
                        )

                        self._logger.debug(f"Model {model_id} config enriched: {list(info_config.keys())}")
                    else:
                        # Model info not found in API response, keep original config
                        enriched_config[model_id] = base_config
                        self._logger.warning(f"Model {model_id} not found in API response, using original config")

                except Exception as e:
                    # Single model parsing failed, don't throw exception, log warning
                    self._logger.warning(f"Model {model_id} parsing exception, using original config: {e}")
                    enriched_config[model_id] = base_config

            # Step 2: Add all other models from API response (auto-discovery)
            auto_discovered_models = []
            for api_model_id, model_info in models_info_map.items():
                # Skip if already processed by user
                if api_model_id in enriched_config:
                    continue

                try:
                    # Extract configuration from API
                    info_config = self.extract_model_config_from_info(model_info)

                    # Create base config with api_key and api_base_url from original config (with placeholders)
                    # Use the first model's original config to inherit api_key and api_base_url
                    original_first_model = models_config[first_model_id]
                    auto_config = {
                        "api_key": original_first_model.get("api_key"),
                        "api_base_url": original_first_model.get("api_base_url"),
                        "name": api_model_id
                    }

                    # Merge with API info
                    enriched_config[api_model_id] = self.merge_model_config(
                        auto_config, info_config
                    )

                    auto_discovered_models.append(api_model_id)
                    self._logger.debug(f"Auto-discovered model: {api_model_id}")

                except Exception as e:
                    self._logger.warning(f"Failed to add auto-discovered model {api_model_id}: {e}")
                    continue

            # Log auto-discovery summary
            if auto_discovered_models:
                self._logger.info(
                    f"Auto-discovered {len(auto_discovered_models)} models: "
                    f"{', '.join(auto_discovered_models[:5])}"
                    f"{f' ... (+{len(auto_discovered_models) - 5} more)' if len(auto_discovered_models) > 5 else ''}"
                )

        return enriched_config, warnings

    def _group_models_by_url(
        self,
        models_config: Dict[str, Dict[str, Any]]
    ) -> Dict[str, List[str]]:
        """Group model IDs by api_base_url

        Args:
            models_config: Model configuration dictionary

        Returns:
            Dictionary mapping api_base_url to list of model IDs
        """
        url_groups = {}

        for model_id, config in models_config.items():
            api_base_url = config.get("api_base_url")

            if not api_base_url:
                continue

            # Normalize URL (remove trailing slash)
            api_base_url = api_base_url.rstrip("/")

            if api_base_url not in url_groups:
                url_groups[api_base_url] = []

            url_groups[api_base_url].append(model_id)

        return url_groups

    async def close(self):
        """Close HTTP client"""
        await self._client.aclose()
