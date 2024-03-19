"""
Magic Gateway SDK

SDK for Magic Gateway AI-generated content signing service.
"""

from .magic_gateway import MagicGateway
from .api.sign_api import SignApi
from .parameter.sign_parameter import SignParameter
from .result.sign_result import SignResult
from .factory import create_magic_gateway_sdk, get_magic_gateway_sdk
from .exceptions import MagicGatewayException

__all__ = [
    'MagicGateway',
    'SignApi',
    'SignParameter',
    'SignResult',
    'create_magic_gateway_sdk',
    'get_magic_gateway_sdk',
    'MagicGatewayException'
]
