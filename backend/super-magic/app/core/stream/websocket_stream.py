"""
WebSocket流实现

提供基于WebSocket的流实现，用于数据的读写
"""

from typing import Optional

from fastapi import WebSocket

from app.core.stream import Stream


class WebSocketStream(Stream):
    """A Stream implementation for handling data over WebSocket connections.
    
    This class provides a way to read and write string data through a WebSocket connection.
    """

    def __init__(self, websocket: WebSocket):
        """Initialize the WebSocket stream.
        
        Args:
            websocket: The WebSocket connection to use for communication.
        """
        super().__init__()
        self._websocket = websocket

    async def read(self, size: Optional[int] = None) -> str:
        """Read string data from the WebSocket stream.
        
        Args:
            size: Ignored for WebSocket streams as messages are atomic.
            
        Returns:
            The string data received from the WebSocket.
            
        Raises:
            EOFError: When the WebSocket connection is closed.
            IOError: When there's an error reading from the WebSocket.
        """
        try:
            data = await self._websocket.receive_text()
            return data
        except Exception as e:
            if self._websocket.closed:
                raise EOFError("WebSocket connection closed")
            raise IOError(f"Failed to read from WebSocket: {e!s}")

    async def write(self, data: str, data_type: str = "json") -> int:
        """Write string data to the WebSocket stream.
        
        Args:
            data: The string data to be sent.
            
        Returns:
            The number of bytes written.
            
        Raises:
            IOError: When there's an error writing to the WebSocket.
        """
        try:
            await self._websocket.send_text(data)
            return len(data)
        except Exception as e:
            raise IOError(f"Failed to write to WebSocket: {e!s}") 
