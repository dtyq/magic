import time
from typing import Dict

from pydantic import BaseModel, Field


class ArchiveDetail(BaseModel):
    """Single archive detail information with independent version"""
    file_key: str  # File storage key
    file_size: int  # File size in bytes
    file_md5: str  # MD5 hash of the file
    version: int  # Independent version number for this archive
    upload_timestamp: int = Field(default_factory=lambda: int(time.time()))  # Upload timestamp


class ProjectArchiveInfo(BaseModel):
    """Project archive manifest containing multiple independent archives"""
    archives: Dict[str, ArchiveDetail]  # Dictionary of archive type to archive detail

    def get_workspace_archive(self) -> ArchiveDetail:
        """Get workspace archive detail"""
        return self.archives.get("workspace")

    def set_workspace_archive(self, archive_detail: ArchiveDetail) -> None:
        """Set workspace archive detail"""
        self.archives["workspace"] = archive_detail


# Legacy model for backward compatibility during migration
class LegacyProjectArchiveInfo(BaseModel):
    """Legacy project archive info model for backward compatibility"""
    file_key: str  # File storage key
    file_size: int  # File size in bytes
    file_md5: str  # MD5 hash of the file
    upload_timestamp: int = Field(default_factory=lambda: int(time.time()))  # Upload timestamp
    version: int = 0
