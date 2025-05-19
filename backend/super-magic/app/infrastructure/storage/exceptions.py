"""
Exceptions for storage SDK.
"""

from enum import Enum
from typing import List, Optional


class InitExceptionCode(str, Enum):
    """Initialization exception codes."""
    CREDENTIAL_ERROR = "CREDENTIAL_ERROR"
    MISSING_CREDENTIALS_PARAMS = "MISSING_CREDENTIALS_PARAMS"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"

class UploadExceptionCode(str, Enum):
    """Upload exception codes."""
    CREDENTIALS_EXPIRED = "CREDENTIALS_EXPIRED"
    NETWORK_ERROR = "NETWORK_ERROR"
    INVALID_RESPONSE = "INVALID_RESPONSE"

class DownloadExceptionCode(str, Enum):
    """Download exception codes."""
    CREDENTIALS_EXPIRED = "CREDENTIALS_EXPIRED"
    NETWORK_ERROR = "NETWORK_ERROR"
    INVALID_RESPONSE = "INVALID_RESPONSE"
    FILE_NOT_FOUND = "FILE_NOT_FOUND"

class StorageError(Exception):
    """Base exception for storage SDK."""
    def __init__(self, message: str, code: str):
        self.code = code
        super().__init__(message)

class InitException(StorageError):
    """Exception raised for initialization errors."""
    def __init__(
        self,
        code: InitExceptionCode,
        platform: str,
        missing_params: Optional[List[str]] = None,
        file_name: Optional[str] = None
    ):
        self.platform = platform
        self.missing_params = missing_params or []
        self.file_name = file_name

        if code == InitExceptionCode.MISSING_CREDENTIALS_PARAMS:
            message = f"Missing credentials params for {platform} upload: {', '.join(self.missing_params)}"
        elif code == InitExceptionCode.FILE_TOO_LARGE:
            message = f"File {file_name} is too big for upload (max 5GB)"
        else:
            message = "Unknown initialization error"

        super().__init__(message, code)

class UploadException(StorageError):
    """Exception raised for upload errors."""
    def __init__(self, code: UploadExceptionCode, detail: Optional[str] = None):
        if code == UploadExceptionCode.CREDENTIALS_EXPIRED:
            message = "Upload credentials have expired"
        elif code == UploadExceptionCode.NETWORK_ERROR:
            message = f"Network error occurred during upload: {detail}" if detail else "Network error occurred during upload"
        elif code == UploadExceptionCode.INVALID_RESPONSE:
            message = f"Invalid response from server: {detail}" if detail else "Invalid response from server"
        else:
            message = "Unknown upload error"

        super().__init__(message, code)

class DownloadException(StorageError):
    """Exception raised for download errors."""
    def __init__(self, code: DownloadExceptionCode, detail: Optional[str] = None):
        if code == DownloadExceptionCode.CREDENTIALS_EXPIRED:
            message = "Download credentials have expired"
        elif code == DownloadExceptionCode.NETWORK_ERROR:
            message = f"Network error occurred during download: {detail}" if detail else "Network error occurred during download"
        elif code == DownloadExceptionCode.INVALID_RESPONSE:
            message = f"Invalid response from server: {detail}" if detail else "Invalid response from server"
        elif code == DownloadExceptionCode.FILE_NOT_FOUND:
            message = f"File not found: {detail}" if detail else "File not found"
        else:
            message = "Unknown download error"

        super().__init__(message, code) 
