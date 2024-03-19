"""
Sign API

API implementation for signing operations in Magic Gateway.
"""

from app.infrastructure.sdk.base import AbstractApi
from ..parameter.sign_parameter import SignParameter
from ..result.sign_result import SignResult


class SignApi(AbstractApi):
    """Sign API for Magic Gateway"""

    def sign(self, parameter: SignParameter) -> SignResult:
        """
        Sign data using Magic Gateway signing API

        Args:
            parameter: SignParameter instance containing data to sign

        Returns:
            SignResult containing the signature

        Raises:
            MagicGatewaySignError: If signing operation fails
        """
        endpoint_path = "/api/ai-generated/sign"
        response = self.request_by_parameter(parameter, 'POST', endpoint_path)
        return SignResult(response)

    async def sign_async(self, parameter: SignParameter) -> SignResult:
        """
        Sign data using Magic Gateway signing API (async version)

        Args:
            parameter: SignParameter instance containing data to sign

        Returns:
            SignResult containing the signature

        Raises:
            MagicGatewaySignError: If signing operation fails
        """
        endpoint_path = "/api/ai-generated/sign"
        response = await self.request_by_parameter_async(parameter, 'POST', endpoint_path)
        return SignResult(response)
