from .magic_service import MagicServiceSearchDriver
from .bing import BingSearchDriver
from .tavily import TavilySearchDriver
from .metaso import MetasoSearchDriver
from .web_collector import WebCollectorSearchDriver

DRIVERS = {
    "magic": MagicServiceSearchDriver,
    "bing": BingSearchDriver,
    "tavily": TavilySearchDriver,
    "metaso": MetasoSearchDriver,
    "web_collector": WebCollectorSearchDriver,
}

__all__ = ["DRIVERS", "MagicServiceSearchDriver", "BingSearchDriver", "TavilySearchDriver", "MetasoSearchDriver", "WebCollectorSearchDriver"]
