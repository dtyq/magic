"""Workspace export API route.

POST /v1/workspace/export
  - Extracts metadata from workspace files (IDENTITY.md / TOOLS.md / SKILLS.md / SKILL.md)
  - Packages the .workspace directory into a ZIP archive
  - Uploads the archive to object storage using caller-supplied temporary credentials
  - Returns the uploaded file key and the extracted metadata
"""

import traceback
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from agentlang.logger import get_logger
from app.api.http_dto.response import BaseResponse, create_error_response, create_success_response
from app.service.workspace_export_service import export_workspace

router = APIRouter(prefix="/v1/workspace", tags=["工作区导出"])

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Request DTOs
# ---------------------------------------------------------------------------

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
    """Request body for the workspace export endpoint."""

    type: Literal["custom_agent", "custom_skill"] = Field(
        ..., description="Export type: 'custom_agent' or 'custom_skill'"
    )
    code: str = Field(
        ..., description="Unique identifier for the agent/skill (e.g. 'SMA_XXXXXX')"
    )
    upload_config: UploadConfigRequest = Field(
        ..., description="Object storage credentials and configuration"
    )


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/export", response_model=BaseResponse)
async def export_workspace_endpoint(request: WorkspaceExportRequest) -> BaseResponse:
    """Package and upload the current workspace, returning file key and metadata.

    Behaviour by export type:

    **custom_agent**
    - Reads IDENTITY.md → name_i18n, role_i18n, description_i18n
    - Reads TOOLS.md   → tools list
    - Reads SKILLS.md  → skills list
    - Missing files are silently skipped

    **custom_skill**
    - Reads SKILL.md   → name_i18n, description_i18n
    - Missing file is silently skipped

    The entire .workspace directory (contents only) is zipped and uploaded to
    the object storage location specified by upload_config.
    """
    try:
        upload_config_dict = request.upload_config.model_dump()

        result = await export_workspace(
            export_type=request.type,
            code=request.code,
            upload_config=upload_config_dict,
        )

        return create_success_response(
            message="Workspace exported successfully",
            data=result,
        )

    except ValueError as exc:
        logger.error(f"Invalid export request: {exc}")
        return create_error_response(
            message=str(exc),
            data=None,
        )
    except Exception as exc:
        logger.error(f"Workspace export failed: {exc}")
        logger.error(traceback.format_exc())
        return create_error_response(
            message=f"Workspace export failed: {exc}",
            data=None,
        )
