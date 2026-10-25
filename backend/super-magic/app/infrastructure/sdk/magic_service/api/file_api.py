"""
File API

API implementation for file-related operations in Magic Service.

# TEMP: Currently contains only scan_wav_async, which is a temporary workaround
# to trigger MagicFS metadata refresh before local audio file scanning.
# Will be simplified or removed once MagicFS handles this automatically.
"""

from typing import Any

from ..kernel.magic_service_api import MagicServiceAbstractApi
from ..kernel.magic_service_parameter import MagicServiceAuthConfig
from ..parameter.product_parameter import ProductParameter
from ..parameter.scan_wav_parameter import ScanWavParameter
from ..parameter.update_file_source_parameter import UpdateFileSourceParameter
from ..result.scan_wav_result import ScanWavResult
from ..result.update_file_source_result import UpdateFileSourceResult


class FileApi(MagicServiceAbstractApi):
    """File API for Magic Service."""

    async def list_project_async(self, auth: MagicServiceAuthConfig, project_id: str, body: dict[str, Any]) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth, body=body), "POST", f"/api/v1/open-api/agent/projects/{project_id}/files/query")

    async def get_product_file_async(self, auth: MagicServiceAuthConfig, file_id: str) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth), "GET", f"/api/v1/super-agent/file/{file_id}")

    async def create_directory_async(self, auth: MagicServiceAuthConfig, body: dict[str, Any]) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth, body=body), "POST", "/api/v1/super-agent/file")

    async def rename_product_file_async(self, auth: MagicServiceAuthConfig, file_id: str, name: str) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth, body={"target_name": name}), "POST", f"/api/v1/super-agent/file/{file_id}/rename")

    async def batch_product_file_async(self, auth: MagicServiceAuthConfig, operation: str, body: dict[str, Any]) -> dict[str, Any]:
        if operation not in {"copy", "move", "delete"}:
            raise ValueError("Unsupported file operation")
        return await self.request_by_parameter_async(ProductParameter(auth, body=body), "POST", f"/api/v1/super-agent/file/batch-{operation}")

    async def batch_status_async(self, auth: MagicServiceAuthConfig, batch_key: str) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth, query={"batch_key": batch_key}), "GET", "/api/v1/super-agent/file/batch-operation/check")

    async def get_product_file_urls_async(self, auth: MagicServiceAuthConfig, file_ids: list[str]) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth, body={"file_ids": file_ids}), "POST", "/api/v1/open-api/super-magic/file/get-urls")

    async def update_file_source_async(self, parameter: UpdateFileSourceParameter) -> UpdateFileSourceResult:
        """
        Update the source field of a file record.

        The call is idempotent: repeated requests with the same arguments produce
        the same result without side effects.

        Args:
            parameter: UpdateFileSourceParameter with file_id and source.

        Returns:
            UpdateFileSourceResult containing the updated file_id and source.
        """
        endpoint_path = "/api/v1/open-api/sandbox/file/source"
        data = await self.request_by_parameter_async(parameter, "PATCH", endpoint_path)
        return UpdateFileSourceResult(data)

    async def scan_wav_async(self, parameter: ScanWavParameter) -> ScanWavResult:
        """
        Trigger object-storage scan for WAV files and update database records.

        The server scans the given directory in object storage, inserts any newly
        discovered .wav file records into the database, and increments the directory's
        metadata_version so that MagicFS clients can detect the change.

        This call is idempotent: already-known files are skipped and inserted=0 is
        returned for fully duplicate calls.

        # TEMP: Called before each local directory scan to ensure MagicFS exposes
        # newly uploaded shards on the local filesystem. Remove once MagicFS handles
        # metadata refresh automatically.

        Args:
            parameter: ScanWavParameter with project_id and relative_path.

        Returns:
            ScanWavResult containing scanned/inserted counts and a status message.
        """
        endpoint_path = "/api/v1/open-api/sandbox/file/scan-wav"
        data = await self.request_by_parameter_async(parameter, "POST", endpoint_path)
        return ScanWavResult(data)
