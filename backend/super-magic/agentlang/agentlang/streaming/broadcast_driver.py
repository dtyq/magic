from typing import List

from agentlang.logger import get_logger

from .interface import StreamingInterface
from .models import ChunkData, StreamingResult

logger = get_logger(__name__)


class BroadcastStreamingDriver(StreamingInterface):
    """Fan-out driver: broadcasts initialize/push/finalize to a list of drivers.

    The first driver in the list is treated as primary — its results are
    returned and its failures propagate. Extra drivers log warnings on failure
    so a broken side-channel never kills the main stream.
    """

    def __init__(self, drivers: List[StreamingInterface]) -> None:
        if not drivers:
            raise ValueError("BroadcastStreamingDriver requires at least one driver")
        self._drivers = drivers

    async def initialize(self) -> StreamingResult:
        result = await self._drivers[0].initialize()
        for driver in self._drivers[1:]:
            try:
                await driver.initialize()
            except Exception as e:
                logger.warning(f"[BroadcastStreamingDriver] {driver.get_driver_name()} initialize failed: {e}")
        return result

    async def push(self, chunk_data: ChunkData) -> StreamingResult:
        result = await self._drivers[0].push(chunk_data)
        for driver in self._drivers[1:]:
            try:
                await driver.push(chunk_data)
            except Exception as e:
                logger.warning(f"[BroadcastStreamingDriver] {driver.get_driver_name()} push failed: {e}")
        return result

    async def finalize(self) -> StreamingResult:
        result = await self._drivers[0].finalize()
        for driver in self._drivers[1:]:
            try:
                await driver.finalize()
            except Exception as e:
                logger.warning(f"[BroadcastStreamingDriver] {driver.get_driver_name()} finalize failed: {e}")
        return result

    async def is_available(self) -> bool:
        return await self._drivers[0].is_available()

    def get_driver_name(self) -> str:
        return "+".join(d.get_driver_name() for d in self._drivers)
