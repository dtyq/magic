"""
File API

API implementation for file-related operations in Magic Service.

# TEMP: Currently contains only scan_wav_async, which is a temporary workaround
# to trigger MagicFS metadata refresh before local audio file scanning.
# Will be simplified or removed once MagicFS handles this automatically.
"""

from ..kernel.magic_service_api import MagicServiceAbstractApi
from ..parameter.scan_wav_parameter import ScanWavParameter
from ..result.scan_wav_result import ScanWavResult


class FileApi(MagicServiceAbstractApi):
    """File API for Magic Service."""

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
