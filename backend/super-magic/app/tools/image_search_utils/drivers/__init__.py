from .magic_service import MagicImageSearchDriver
from .bing import BingImageSearchDriver
from .serpapi import SerpApiImageSearchDriver
from .web_collector import WebCollectorImageSearchDriver

DRIVERS = {
    "magic": MagicImageSearchDriver,
    "bing": BingImageSearchDriver,
    "serpapi": SerpApiImageSearchDriver,
    "web_collector": WebCollectorImageSearchDriver,
}

__all__ = ["DRIVERS", "MagicImageSearchDriver", "BingImageSearchDriver", "SerpApiImageSearchDriver", "WebCollectorImageSearchDriver"]
