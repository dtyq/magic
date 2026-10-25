"""
AI Ability Runtime Config Result

Result class for Magic Service AI ability runtime config response.
"""

from dataclasses import dataclass
from typing import Any, Dict

from app.infrastructure.sdk.base import AbstractResult


@dataclass(frozen=True)
class AiAbilityRuntimeConfigItem:
    """Single AI ability runtime config item."""

    ability_key: str
    enabled: bool
    config: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        """Return item as dictionary."""
        return {
            "enabled": self.enabled,
            "config": self.config,
        }


class AiAbilityRuntimeConfigResult(AbstractResult):
    """Result for GET /api/v1/open-api/sandbox/ai-abilities/runtime-config."""

    def __init__(self, data: Dict[str, Any]):
        """Initialize runtime config result."""
        super().__init__(data)

    def _parse_data(self) -> None:
        """Parse response data."""
        global_system_prompt = self.get("global_system_prompt", "")
        self.global_system_prompt = global_system_prompt if isinstance(global_system_prompt, str) else ""
        ai_abilities = self.get("ai_abilities", {})
        self.ai_abilities: Dict[str, AiAbilityRuntimeConfigItem] = {}
        if not isinstance(ai_abilities, dict):
            return

        for ability_key, raw_item in ai_abilities.items():
            if not isinstance(raw_item, dict):
                continue

            normalized_key = str(ability_key)
            raw_config = raw_item.get("config", {})
            self.ai_abilities[normalized_key] = AiAbilityRuntimeConfigItem(
                ability_key=normalized_key,
                enabled=self._parse_enabled(raw_item.get("enabled", True)),
                config=raw_config if isinstance(raw_config, dict) else {},
            )

    def get_ai_abilities(self) -> Dict[str, AiAbilityRuntimeConfigItem]:
        """Return AI ability runtime config mapping."""
        return self.ai_abilities

    def get_global_system_prompt(self) -> str:
        """Return the global system prompt."""
        return self.global_system_prompt

    def _parse_enabled(self, value: Any) -> bool:
        """Parse enabled value."""
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() not in {"", "0", "false", "off", "no"}
        return bool(value)

    def to_dict(self) -> Dict[str, Any]:
        """Return result as dictionary."""
        return {
            "ai_abilities": {
                ability_key: item.to_dict()
                for ability_key, item in self.ai_abilities.items()
            },
            "global_system_prompt": self.global_system_prompt,
        }
