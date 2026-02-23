from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field


class WorkspaceInfo(BaseModel):
    """工作区信息模型"""

    id: Any  # 可以是数字或字符串
    workspace_name: str
    sort: int


# 请求模型
class GetWorkspacesRequest(BaseModel):
    """获取工作区列表请求模型"""
    pass


class SaveWorkspaceRequest(BaseModel):
    """保存工作区请求模型"""

    id: Optional[Any] = None  # 可选，编辑时提供
    name: str  # 工作区名称


class DeleteWorkspaceRequest(BaseModel):
    """删除工作区请求模型"""

    id: Any  # 工作区ID


# 响应模型
class WorkspaceResponse(BaseModel):
    """工作区响应模型"""

    id: Any


class WorkspaceStatusData(BaseModel):
    """Workspace initialization status payload."""

    status: int = Field(..., description="Workspace status code")
    description: str = Field(..., description="Human-readable status description")


class WorkspaceStatusesData(BaseModel):
    """All workspace status mappings payload."""

    statuses: Dict[str, str] = Field(
        ..., description="Workspace status mapping with stringified status codes as keys"
    )


class TemporaryCredentialDataRequest(BaseModel):
    """STS temporary credential fields."""

    ExpiredTime: str = Field(..., description="Credential expiry time (ISO 8601)")
    CurrentTime: str = Field(..., description="Current time at credential issuance (ISO 8601)")
    AccessKeyId: str = Field(..., description="Temporary access key ID")
    SecretAccessKey: str = Field(..., description="Temporary secret access key")
    SessionToken: str = Field(..., description="STS session token")


class TemporaryCredentialsRequest(BaseModel):
    """STS temporary credentials bundle."""

    host: str = Field(..., description="Storage service host URL")
    region: str = Field(..., description="Storage region (e.g. cn-beijing)")
    endpoint: str = Field(..., description="Storage endpoint URL")
    credentials: TemporaryCredentialDataRequest = Field(..., description="STS credential data")
    bucket: str = Field(..., description="Target bucket name")
    dir: str = Field(..., description="Upload directory prefix within the bucket")
    expires: int = Field(..., description="Credential validity duration in seconds")
    callback: str = Field("", description="Optional callback URL after upload")


class UploadConfigRequest(BaseModel):
    """Storage upload configuration supplied by the caller."""

    platform: str = Field(..., description="Storage platform identifier (e.g. 'tos')")
    temporary_credential: TemporaryCredentialsRequest = Field(
        ..., description="Temporary credentials for the upload"
    )


class WorkspaceExportRequest(BaseModel):
    """Request body for workspace export endpoint."""

    type: Literal["custom_agent", "custom_skill"] = Field(
        ..., description="Export type: 'custom_agent' or 'custom_skill'"
    )
    code: str = Field(
        ..., description="Unique identifier for the agent/skill (e.g. 'SMA_XXXXXX')"
    )
    upload_config: Dict[str, Any] = Field(
        ..., description="Object storage credentials and configuration (platform-specific)"
    )


class WorkspaceExportData(BaseModel):
    """Workspace export response payload."""

    file_key: str = Field(..., description="Object storage file key of the uploaded ZIP")
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Extracted metadata from workspace files",
    )


class WorkspaceImportRequest(BaseModel):
    """Request body for workspace import endpoint."""

    url: str = Field(..., description="Remote ZIP archive URL")
    target_dir: str = Field(
        "",
        description="Target subdirectory under workspace root (e.g. 'a/' -> .workspace/a)",
    )


class WorkspaceImportData(BaseModel):
    """Workspace import response payload."""

    workspace_dir: str = Field(..., description="Workspace directory path")
    extracted_files: int = Field(..., description="Number of extracted files")
