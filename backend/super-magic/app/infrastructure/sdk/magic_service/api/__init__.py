"""
Magic Service API Implementations

Concrete API implementations for various Magic Service endpoints.
"""

from .agent_api import AgentApi
from .share_api import ShareApi
from app.infrastructure.sdk.magic_service.api.web_scrape_client import WebScrapeClient, WebScrapeResponse


__all__ = [
    'AgentApi',
    'ShareApi',
    "WebScrapeClient",
    "WebScrapeResponse",
]
