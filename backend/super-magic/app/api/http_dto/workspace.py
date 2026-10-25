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

    type: Literal[
        "agent_creator",
        "skill_creator",
        "slides_template_creator",
        "custom_agent",
        "custom_skill",
    ] = Field(
        ...,
        description="Export type: agent, skill, or slides template (legacy: custom_agent/custom_skill)",
    )
    code: str = Field(
        ..., description="Unique identifier for the agent/skill (e.g. 'SMA_XXXXXX')"
    )
    upload_config: Dict[str, Any] = Field(
        ..., description="Object storage credentials and configuration (platform-specific)"
    )
    public_upload_config: Optional[Dict[str, Any]] = Field(
        None,
        description="Public object storage credentials for slides template preview assets",
    )
    source_path: str = Field(
        "",
        description="""<!--zh: 相对于工作区根目录的子目录路径（如 'skills/my-skill'），留空则导出整个工作区-->
Relative path within the workspace root to export (e.g. 'skills/my-skill'). Defaults to the entire workspace.""",
    )
    archive_root: str = Field(
        "",
        description="Optional root directory name inside the ZIP archive. Defaults to code.",
    )
    file_name: str = Field(
        "",
        description="Optional ZIP file name to upload. Defaults to '{code}_{timestamp}.zip'.",
    )

    exclude_paths: list[str] = Field(default_factory=list, description="Paths relative to the exported directory to omit.")
    skills_md_hash: str | None = Field(None, description="Expected SHA-256 of SKILLS.md for a reference-only employee export.")


class WorkspaceExportData(BaseModel):
    """Workspace export response payload."""

    file_key: str = Field(..., description="Object storage file key of the uploaded ZIP")
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Extracted metadata from workspace files",
    )


class WorkspaceExportTaskRequest(WorkspaceExportRequest):
    """异步工作区导出请求。"""

    task_key: str = Field(..., min_length=1, description="幂等任务标识")


class WorkspaceExportTaskData(BaseModel):
    """异步工作区导出任务状态。"""

    task_key: str
    status: str
    progress: int | None = None
    file_key: str | None = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    error: str | None = None


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


class WorkspaceFileContentRequest(BaseModel):
    """Read a text file from the workspace."""

    path: str = Field(..., description="Relative path under workspace root")


class WorkspaceFileWriteRequest(BaseModel):
    """Write a text file into the workspace."""

    path: str = Field(..., description="Relative path under workspace root")
    content: str = Field("", description="Text content to write")
    create_parent_dirs: bool = Field(True, description="Create missing parent directories")
    overwrite: bool = Field(True, description="Overwrite existing file")


class WorkspaceDirectoryCreateRequest(BaseModel):
    """Create a directory under the workspace."""

    path: str = Field(..., description="Relative directory path under workspace root")


class WorkspaceFileDeleteRequest(BaseModel):
    """Delete a file or directory under the workspace."""

    path: str = Field(..., description="Relative path under workspace root")
    recursive: bool = Field(False, description="Recursively delete directories")


class WorkspaceFileMoveRequest(BaseModel):
    """Move or rename a workspace file or directory."""

    source_path: str = Field(..., description="Relative source path under workspace root")
    target_path: str = Field(..., description="Relative target path under workspace root")
    overwrite: bool = Field(False, description="Overwrite target if it exists")


class WorkspaceFileUploadRequest(BaseModel):
    """Upload a base64 encoded file into the workspace."""

    target_dir: str = Field("", description="Relative target directory under workspace root")
    filename: str = Field(..., description="Uploaded file name")
    content_base64: str = Field(..., description="Base64 encoded file content")
    overwrite: bool = Field(True, description="Overwrite existing file")
