from .bing import BingSearchDriver
from .magic_service import MagicServiceSearchDriver
from .metaso import MetasoSearchDriver
from .parallel import ParallelSearchDriver
from .tavily import TavilySearchDriver
from .web_collector import WebCollectorSearchDriver

DRIVERS = {
    "magic": MagicServiceSearchDriver,
    "bing": BingSearchDriver,
    "tavily": TavilySearchDriver,
    "metaso": MetasoSearchDriver,
    "web_collector": WebCollectorSearchDriver,
    "parallel": ParallelSearchDriver,
}

__all__ = [
    "DRIVERS",
    "BingSearchDriver",
    "MagicServiceSearchDriver",
    "MetasoSearchDriver",
    "ParallelSearchDriver",
    "TavilySearchDriver",
    "WebCollectorSearchDriver",
]
