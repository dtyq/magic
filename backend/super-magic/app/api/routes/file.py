"""
File API Routes

Provides HTTP endpoints for file operations including version history retrieval, file uploads, and file saving.
"""
import traceback
from typing import Dict, Any, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ValidationError

from agentlang.logger import get_logger
from app.api.http_dto.file_notification_dto import FileNotificationRequest
from app.api.http_dto.file_save_dto import FileEditRequest
from app.api.http_dto.file_upload_dto import FileUploadRequest
from app.api.http_dto.response import (
    BaseResponse,
    create_error_response,
    create_success_response,
    ResponseCode,
)
from app.infrastructure.magic_service import MagicServiceClient, MagicServiceConfigLoader
from app.infrastructure.magic_service.exceptions import ApiError, ConnectionError as MagicServiceConnectionError
from app.path_manager import PathManager
from app.service.file_save_service import FileSaveService
from app.service.file_service import FileService
from app.service.file_upload_service import FileUploadService
from app.utils.init_client_message_util import InitClientMessageUtil, InitializationError

router = APIRouter()

logger = get_logger(__name__)


class FileVersionRequest(BaseModel):
    """Request model for file version history"""
    file_key: str = None
    git_directory: str = None


class FileContentRequest(BaseModel):
    """Request model for file content retrieval"""
    file_key: str = None
    commit_hash: str = None
    git_directory: str = None


class FileDownloadUrlRequest(BaseModel):
    """Request model for file download URL generation"""
    file_path: str
    expires_in: int = 3600  # Default 1 hour
    options: Dict[str, Any] = None


@router.post("/file/versions", response_model=BaseResponse, tags=["文件管理"])
async def get_file_version_history(request: FileVersionRequest) -> BaseResponse:
    """
    Get file version history

    Retrieves the complete version history of a file using git log.
    The file_key should be a path relative to the git repository root.
    The git_directory specifies which git repository to use (e.g., '.workspace', '.chat_history').

    Args:
        request: FileVersionRequest object containing file_key and optional git_directory

    Returns:
        BaseResponse: Response object containing file version history

    Raises:
        HTTPException: When file not found or git operation fails

    Example:
        ```bash
        curl -X POST "http://localhost:8000/api/file/versions" \
             -H "Content-Type: application/json" \
             -d '{"file_key": "app/main.py", "git_directory": ".workspace"}'
        ```

        Response:
        ```json
        {
            "code": 1000,
            "message": "获取文件版本历史成功",
            "data": {
                "file_key": "app/main.py",
                "git_directory": ".workspace",
                "version_count": 3,
                "versions": [
                    {
                        "commit_hash": "abc123...",
                        "author": "John Doe <john@example.com>",
                        "date": "2024-01-15 10:30:00 +0800",
                        "message": "Update main.py with new features",
                        "stats": {
                            "file": "app/main.py",
                            "changes": "5 insertions(+), 2 deletions(-)"
                        }
                    }
                ]
            }
        }
        ```
    """
    try:
        file_key = request.file_key
        git_directory = request.git_directory
        logger.info(f"API request to get file version history for: {file_key} in directory: {git_directory}")

        # Validate file_key
        if not file_key or not file_key.strip():
            logger.warning("Empty file_key provided")
            return create_error_response(
                message="文件路径不能为空",
                data={"file_key": file_key}
            )

        # Create file service instance
        file_service = FileService()

        # Get file version history
        version_history = file_service.get_file_version_history(file_key, git_directory)

        logger.info(f"Successfully retrieved version history for {file_key}")

        return create_success_response(
            message="获取文件版本历史成功",
            data=version_history
        )

    except FileNotFoundError as e:
        logger.warning(f"File not found: {file_key} - {e}")
        return create_error_response(
            message="文件未找到",
            data={
                "file_key": file_key,
                "git_directory": git_directory,
                "error": str(e)
            }
        )

    except ValueError as e:
        logger.warning(f"Invalid file_key: {file_key} - {e}")
        return create_error_response(
            message="无效的文件路径",
            data={
                "file_key": file_key,
                "git_directory": git_directory,
                "error": str(e)
            }
        )

    except Exception as e:
        logger.error(f"Failed to get file version history for {file_key}: {e}")
        logger.error(traceback.format_exc())

        return create_error_response(
            message="获取文件版本历史失败",
            data={
                "file_key": file_key,
                "git_directory": git_directory,
                "error": str(e)
            }
        )


@router.post("/file/content", response_model=BaseResponse, tags=["文件管理"])
async def get_file_content(request: FileContentRequest) -> BaseResponse:
    """
    Get file content from a specific commit

    Retrieves file content from a specific commit using git commands and uploads it to storage
    with a temporary access URL. The file_key should be a path relative to the git repository root.

    Args:
        request: FileContentRequest object containing file_key, commit_hash, and optional git_directory

    Returns:
        BaseResponse: Response object containing file content information and temporary URL

    Raises:
        HTTPException: When file not found or git operation fails

    Example:
        ```bash
        curl -X POST "http://localhost:8000/api/file/content" \
             -H "Content-Type: application/json" \
             -d '{
                 "file_key": "app/main.py",
                 "commit_hash": "847558c2b2c122e0b9a082bf0a128110848c7d60",
                 "git_directory": ".workspace"
             }'
        ```

        Response:
        ```json
        {
            "code": 1000,
            "message": "获取文件内容成功",
            "data": {
                "file_key": "app/main.py",
                "commit_hash": "847558c2b2c122e0b9a082bf0a128110848c7d60",
                "git_directory": ".workspace",
                "temporary_url": "https://example.com/temp/file_12345.py",
                "file_size": 1024,
                "object_key": "base_dir/temp/abc123.py",
                "platform": "tos",
                "file_hash": "a1b2c3d4e5f678901234567890123456"
            }
        }
        ```
    """
    try:
        file_key = request.file_key
        commit_hash = request.commit_hash
        git_directory = request.git_directory
        logger.info(f"API request to get file content for: {file_key} from commit: {commit_hash} in directory: {git_directory}")

        # Validate parameters
        if not file_key or not file_key.strip():
            logger.warning("Empty file_key provided")
            return create_error_response(
                message="文件路径不能为空",
                data={"file_key": file_key}
            )

        if not commit_hash or not commit_hash.strip():
            logger.warning("Empty commit_hash provided")
            return create_error_response(
                message="提交哈希不能为空",
                data={"commit_hash": commit_hash}
            )

        # Create file service instance
        file_service = FileService()

        # Get file content from commit
        content_result = await file_service.get_file_content_from_commit(file_key, commit_hash, git_directory)

        logger.info(f"Successfully retrieved file content for {file_key} from commit {commit_hash}")

        return create_success_response(
            message="获取文件内容成功",
            data=content_result
        )

    except FileNotFoundError as e:
        logger.warning(f"File not found: {file_key} - {e}")
        return create_error_response(
            message="文件未找到",
            data={
                "file_key": file_key,
                "commit_hash": commit_hash,
                "git_directory": git_directory,
                "error": str(e)
            }
        )

    except ValueError as e:
        logger.warning(f"Invalid parameters: {e}")
        return create_error_response(
            message="无效的参数",
            data={
                "file_key": file_key,
                "commit_hash": commit_hash,
                "git_directory": git_directory,
                "error": str(e)
            }
        )

    except Exception as e:
        logger.error(f"Failed to get file content for {file_key} from commit {commit_hash}: {e}")
        logger.error(traceback.format_exc())

        return create_error_response(
            message="获取文件内容失败",
            data={
                "file_key": file_key,
                "commit_hash": commit_hash,
                "git_directory": git_directory,
                "error": str(e)
            }
        )


@router.post("/file/download-url", response_model=BaseResponse, tags=["文件管理"])
async def get_file_download_url(request: FileDownloadUrlRequest) -> BaseResponse:
    """
    获取文件临时下载链接

    根据文件相对路径生成临时下载链接，支持多云存储平台（火山云TOS、阿里云OSS、本地存储）。
    该接口会自动处理STS凭证刷新，确保生成的下载链接有效。

    Args:
        request: FileDownloadUrlRequest对象，包含文件路径、过期时间和可选配置

    Returns:
        BaseResponse: 包含下载链接信息的响应对象

    Raises:
        HTTPException: 当文件路径无效或生成链接失败时

    Example:
        ```bash
        # 基本用法
        curl -X POST "http://localhost:8000/api/file/download-url" \
             -H "Content-Type: application/json" \
             -d '{"file_path": "documents/report.pdf"}'

        # 带自定义过期时间和选项
        curl -X POST "http://localhost:8000/api/file/download-url" \
             -H "Content-Type: application/json" \
             -d '{
                 "file_path": "videos/presentation.mp4",
                 "expires_in": 1800,
                 "options": {
                     "headers": {"Content-Type": "video/mp4"},
                     "params": {"x-oss-traffic-limit": "1048576"}
                 }
             }'
        ```

        Response:
        ```json
        {
            "code": 1000,
            "message": "获取下载链接成功",
            "data": {
                "file_path": "documents/report.pdf",
                "download_url": "https://example.tos.com/workspace/documents/report.pdf?x-tos-signature=...",
                "expires_in": 3600,
                "platform": "tos",
                "generated_at": "2024-01-15T10:30:00",
                "object_key": "workspace/documents/report.pdf"
            }
        }
        ```
    """
    try:
        file_path = request.file_path
        expires_in = request.expires_in
        options = request.options

        logger.info(f"API request to get download URL for: {file_path}, expires_in: {expires_in}")

        # 验证文件路径
        if not file_path or not file_path.strip():
            logger.warning("Empty file_path provided")
            return create_error_response(
                message="文件路径不能为空",
                data={"file_path": file_path}
            )

        # 验证过期时间
        if expires_in <= 0:
            logger.warning(f"Invalid expires_in: {expires_in}")
            return create_error_response(
                message="过期时间必须大于0",
                data={"expires_in": expires_in}
            )

        # 创建文件服务实例
        file_service = FileService()

        # 获取文件下载链接
        download_result = await file_service.get_file_download_url(
            file_path=file_path,
            expires_in=expires_in,
            options=options
        )

        logger.info(f"Successfully generated download URL for {file_path} on platform {download_result['platform']}")

        return create_success_response(
            message="获取下载链接成功",
            data=download_result
        )

    except ValueError as e:
        logger.warning(f"Invalid parameters for file download URL: {e}")
        return create_error_response(
            message="参数错误",
            data={
                "file_path": request.file_path,
                "expires_in": request.expires_in,
                "error": str(e)
            }
        )

    except Exception as e:
        logger.error(f"Failed to generate download URL for {request.file_path}: {e}")
        logger.error(traceback.format_exc())

        return create_error_response(
            message="生成下载链接失败",
            data={
                "file_path": request.file_path,
                "expires_in": request.expires_in,
                "error": str(e)
            }
        )


@router.post("/file/upload", response_model=BaseResponse, tags=["文件管理"])
async def upload_files(request: FileUploadRequest) -> BaseResponse:
    """
    Upload multiple files from .workspace directory to TOS and register them

    Uploads files from the .workspace directory to TOS (VolcEngine Object Storage) and
    optionally registers them with the Magic Service if sandbox_id is provided.

    Args:
        request: FileUploadRequest containing file paths and optional parameters

    Returns:
        BaseResponse with upload and registration results

    Raises:
        HTTPException: When validation fails or upload process fails

    Example:
        ```bash
        curl -X POST "http://localhost:8000/api/file/upload" \
             -H "Content-Type: application/json" \
             -d '{
                 "file_paths": ["docs/readme.md", "src/main.py"],
                 "sandbox_id": "sandbox_123",
                 "organization_code": "org_456"
             }'
        ```

        Response:
        ```json
        {
            "code": 1000,
            "message": "文件上传完成",
            "data": {
                "total_count": 2,
                "success_count": 2,
                "failed_count": 0,
                "registration_success_count": 2,
                "all_success": true,
                "all_registered": true,
                "results": [
                    {
                        "file_path": "docs/readme.md",
                        "success": true,
                        "file_size": 1024,
                        "object_key": "base_dir/docs/readme.md",
                        "external_url": "https://example.com/base_dir/docs/readme.md",
                        "registration_success": true,
                        "error_message": null
                    }
                ]
            }
        }
        ```
    """
    try:
        logger.info(f"API request to upload {len(request.file_paths)} files")
        logger.info(f"Sandbox ID: {request.sandbox_id}, Organization Code: {request.organization_code}, Task ID: {request.task_id}")

        # Create file upload service instance
        upload_service = FileUploadService()

        # Upload files and register them
        upload_result = await upload_service.upload_files_batch(
            file_paths=request.file_paths,
            sandbox_id=request.sandbox_id,
            organization_code=request.organization_code,
            task_id=request.task_id
        )

        # Determine response message and status based on results
        if upload_result.all_success:
            if request.sandbox_id and upload_result.all_registered:
                message = f"所有文件上传并注册成功 ({upload_result.success_count}/{upload_result.total_count})"
            elif request.sandbox_id:
                message = f"所有文件上传成功，部分注册失败 ({upload_result.registration_success_count}/{upload_result.success_count} 注册成功)"
            else:
                message = f"所有文件上传成功 ({upload_result.success_count}/{upload_result.total_count})"

            logger.info(f"File upload completed: {upload_result.success_count}/{upload_result.total_count} files uploaded successfully")
            return create_success_response(
                message=message,
                data=upload_result.model_dump()
            )
        elif upload_result.success_count > 0:
            if request.sandbox_id:
                message = f"部分文件上传成功 ({upload_result.success_count}/{upload_result.total_count})，注册成功 ({upload_result.registration_success_count}/{upload_result.success_count})"
            else:
                message = f"部分文件上传成功 ({upload_result.success_count}/{upload_result.total_count})"

            logger.warning(f"Partial file upload: {upload_result.success_count}/{upload_result.total_count} files uploaded successfully")
            return create_success_response(
                message=message,
                data=upload_result.model_dump()
            )
        else:
            message = "所有文件上传失败"
            logger.error(f"All file uploads failed: {upload_result.total_count} files")
            return create_error_response(
                message=message,
                data=upload_result.model_dump()
            )

    except ValidationError as e:
        logger.error(f"Request validation failed: {e}")
        return create_error_response(
            message=f"请求参数验证失败: {str(e)}",
            data={"validation_errors": str(e)}
        )

    except ValueError as e:
        logger.warning(f"Invalid request parameters: {e}")
        return create_error_response(
            message=f"无效的请求参数: {str(e)}",
            data={"error": str(e)}
        )

    except Exception as e:
        logger.error(f"File upload failed: {e}")
        logger.error(traceback.format_exc())
        return create_error_response(
            message="文件上传失败",
            data={
                "file_paths": request.file_paths,
                "error": str(e)
            }
        )


@router.post("/v1/files/notifications", response_model=BaseResponse, tags=["文件操作"])
async def notify_file_change(request: FileNotificationRequest) -> BaseResponse:
    """
    接收文件变更通知并转发给 Magic Service

    接收文件系统的变更通知（创建、修改、删除等操作），并将这些通知转发给后端的 Magic Service。
    系统需要先进行初始化，否则将返回 500 错误。

    Args:
        request: 文件变更通知请求，包含时间戳、操作类型、文件路径、文件大小和是否为目录

    Returns:
        BaseResponse: 包含处理结果的响应

    Example:
        POST /v1/files/notifications
        {
            "timestamp": 1757041481,
            "operation": "CREATE",
            "file_path": ".visual",
            "file_size": 0,
            "is_directory": 1,
            "source": 3
        }
    """
    try:
        # 1. 打印请求参数，方便后续调试
        logger.info(f"收到文件变更通知: {request.model_dump_json()}")
        logger.info(f"文件路径: {request.file_path}, 操作: {request.operation}, 大小: {request.file_size} bytes, 是否目录: {request.is_directory}")

        # 2. 调用 InitClientMessageUtil 获取 metadata
        try:
            metadata = InitClientMessageUtil.get_metadata()
            logger.info(f"成功获取系统初始化 metadata，包含 {len(metadata)} 个字段")
        except InitializationError as e:
            logger.error(f"系统未初始化: {e}")
            return create_error_response(
                "系统未初始化，无法处理文件变更通知"
            )

        # 3. 初始化 magic-service 客户端并调用远程接口
        try:
            config = MagicServiceConfigLoader.load_with_fallback()
            logger.info(f"Magic Service 配置加载成功: {config.api_base_url}")

            async with MagicServiceClient(config) as client:
                logger.info(f"即将调用 Magic Service API: {client._send_file_notification_internal}")
                result = await client.send_file_notification(
                    metadata=metadata,
                    notification_data=request.model_dump()
                )

            logger.info("文件变更通知成功转发到 Magic Service")

        except (ApiError, MagicServiceConnectionError) as e:
            logger.error(f"调用 Magic Service 失败: {e}")
            return create_error_response(
                "转发通知到 Magic Service 失败",
                data={"error": str(e)}
            )
        except Exception as e:
            logger.error(f"Magic Service 配置或调用异常: {e}")
            logger.error(traceback.format_exc())
            return create_error_response(
                "Magic Service 服务异常",
                data={"error": str(e)}
            )

        # 4. 返回成功响应
        return create_success_response(
            message="文件变更通知已成功处理",
            data={
                "notification": request.model_dump(),
                "magic_service_response": result
            }
        )

    except ValidationError as e:
        logger.error(f"请求参数验证失败: {e}")
        return create_error_response(
            f"请求参数格式错误: {str(e)}",
            ResponseCode.INVALID_PARAMS
        )
    except Exception as e:
        logger.error(f"处理文件变更通知时发生未知错误: {e}")
        logger.error(traceback.format_exc())
        return create_error_response(
            "处理通知时发生内部错误"
        )
