"""
Socket.IO streaming driver package.

This package provides Socket.IO-based streaming implementation including:
- SocketIODriver: The driver implementation
- SocketIODriverConfig: The configuration class for Socket.IO driver
"""

from .driver import SocketIODriver
from .config import SocketIODriverConfig

__all__ = ['SocketIODriver', 'SocketIODriverConfig']
