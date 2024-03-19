"""
File Upload API DTOs

Request and response models for file upload operations.
"""
from typing import List, Optional
from pydantic import BaseModel, Field, validator


class FileUploadRequest(BaseModel):
    """Request model for file upload"""
    file_paths: List[str] = Field(..., description="Array of file paths relative to .workspace directory")
    sandbox_id: Optional[str] = Field(None, description="Sandbox ID for file registration")
    organization_code: Optional[str] = Field(None, description="Organization code for multi-tenant scenarios")
    task_id: Optional[str] = Field(None, description="Task ID for file registration")

    @validator('file_paths')
    def validate_file_paths(cls, v):
        if not v:
            raise ValueError("file_paths cannot be empty")
        return v

    @validator('file_paths', each_item=True)
    def validate_individual_file_paths(cls, v):
        if not v or not v.strip():
            raise ValueError("Individual file path cannot be empty")

        # Clean path
        clean_path = v.strip().lstrip('/')

        # Security check - prevent directory traversal
        dangerous_patterns = ['../', '..\\', '..\\\\']
        if any(pattern in clean_path for pattern in dangerous_patterns):
            raise ValueError(f"File path contains dangerous patterns: {v}")

        # Reject absolute paths
        if clean_path.startswith('/') or (len(clean_path) > 1 and clean_path[1] == ':'):
            raise ValueError(f"File path must be relative: {v}")

        return clean_path


class FileUploadResult(BaseModel):
    """Individual file upload result"""
    file_path: str
    success: bool
    file_size: Optional[int] = None
    object_key: Optional[str] = None
    external_url: Optional[str] = None
    registration_success: Optional[bool] = None
    error_message: Optional[str] = None


class FileUploadResponse(BaseModel):
    """Overall upload response"""
    total_count: int
    success_count: int
    failed_count: int
    registration_success_count: int
    all_success: bool
    all_registered: bool
    results: List[FileUploadResult]
