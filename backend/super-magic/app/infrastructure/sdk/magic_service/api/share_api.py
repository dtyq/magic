"""
Share API

API implementation for share management Open API endpoints in Magic Service.
"""

from ..kernel.magic_service_api import MagicServiceAbstractApi
from ..parameter.share_resource_id_parameter import ShareResourceIdParameter
from ..parameter.create_share_parameter import CreateShareParameter
from ..parameter.find_similar_share_parameter import FindSimilarShareParameter
from ..parameter.cancel_share_parameter import CancelShareParameter
from ..result.share_result import (
    ShareResourceIdResult,
    ShareResult,
    CancelShareResult,
    FindSimilarSharesResult,
)

_BASE_PATH = '/api/v1/open-api/sandbox/share/resources'


class ShareApi(MagicServiceAbstractApi):
    """Share management API for Magic Service Open API (sandbox)"""

    async def generate_resource_id_async(self) -> ShareResourceIdResult:
        """
        Generate a snowflake resource ID required before creating a file or file-collection share.

        Returns:
            ShareResourceIdResult containing the generated id
        """
        parameter = ShareResourceIdParameter()
        data = await self.request_by_parameter_async(parameter, 'POST', f'{_BASE_PATH}/id')
        return ShareResourceIdResult(data)

    async def create_share_async(self, parameter: CreateShareParameter) -> ShareResult:
        """
        Create a new share or update an existing share with the same resource_id.

        Args:
            parameter: CreateShareParameter instance

        Returns:
            ShareResult containing share details including share_code
        """
        data = await self.request_by_parameter_async(parameter, 'POST', f'{_BASE_PATH}/create')
        return ShareResult(data)

    async def find_similar_shares_async(self, parameter: FindSimilarShareParameter) -> FindSimilarSharesResult:
        """
        Find existing shares matching the given file IDs or project to avoid duplicates.

        Args:
            parameter: FindSimilarShareParameter instance

        Returns:
            FindSimilarSharesResult wrapping a list of matching ShareResult items
        """
        data = await self.request_by_parameter_async(parameter, 'POST', f'{_BASE_PATH}/find-similar')
        items = data if isinstance(data, list) else []
        return FindSimilarSharesResult(items)

    async def cancel_share_async(self, parameter: CancelShareParameter) -> CancelShareResult:
        """
        Cancel (soft-delete) a share by resource ID. Only the share creator can cancel.

        Args:
            parameter: CancelShareParameter instance

        Returns:
            CancelShareResult containing the cancelled resource id
        """
        endpoint = f'{_BASE_PATH}/{parameter.get_resource_id()}/cancel'
        data = await self.request_by_parameter_async(parameter, 'POST', endpoint)
        return CancelShareResult(data)
