"""
File Upload Service

Handles batch file uploads from .workspace directory to TOS and registration with Magic Service.
"""
import asyncio
import hashlib
import logging
import traceback
from pathlib import Path
from typing import List, Optional, Dict, Any

from app.infrastructure.storage.factory import StorageFactory
from app.infrastructure.storage.types import PlatformType
from app.infrastructure.storage.exceptions import InitException, UploadException
from app.infrastructure.magic_service import MagicServiceConfigLoader, MagicServiceClient
from app.infrastructure.magic_service.exceptions import ConfigurationError, ApiError
from app.api.http_dto.file_upload_dto import FileUploadResult, FileUploadResponse
from app.path_manager import PathManager
from app.core.base_service import Base

logger = logging.getLogger(__name__)


class FileUploadService(Base):
    SERVICE_TYPE = "file_upload"
    """Service for handling file uploads and registration"""

    def __init__(self):
        """Initialize the file upload service"""
        self.storage_service = None
        self.magic_service_client = None
        self.workspace_dir = None
        self.credentials_data = None

    async def upload_files_batch(
        self,
        file_paths: List[str],
        sandbox_id: str = None,
        organization_code: str = None,
        task_id: str = None
    ) -> FileUploadResponse:
        """
        Upload multiple files and register them

        Args:
            file_paths: List of file paths relative to .workspace
            sandbox_id: Sandbox ID for registration
            organization_code: Organization code
            task_id: Task ID

        Returns:
            FileUploadResponse with detailed results
        """
        try:
            logger.info(f"Starting batch upload for {len(file_paths)} files")
            logger.info(f"Sandbox ID: {sandbox_id}, Organization Code: {organization_code}, Task ID: {task_id}")

            # Initialize workspace directory
            self.workspace_dir = PathManager.get_project_root() / ".workspace"
            if not self.workspace_dir.exists():
                raise ValueError(f"Workspace directory does not exist: {self.workspace_dir}")

            # Validate and resolve file paths
            resolved_paths = await self._validate_and_resolve_paths(file_paths)
            if not resolved_paths:
                return FileUploadResponse(
                    total_count=len(file_paths),
                    success_count=0,
                    failed_count=len(file_paths),
                    registration_success_count=0,
                    all_success=False,
                    all_registered=False,
                    results=[
                        FileUploadResult(
                            file_path=path,
                            success=False,
                            error_message="No valid files found after validation"
                        )
                        for path in file_paths
                    ]
                )

            # Load credentials and initialize services
            await self._load_credentials()

            # Upload files concurrently
            upload_tasks = [
                self._upload_single_file(file_path, self.workspace_dir)
                for file_path in resolved_paths
            ]
            upload_results = await asyncio.gather(*upload_tasks, return_exceptions=True)

            # Process upload results
            processed_results = []
            for i, result in enumerate(upload_results):
                if isinstance(result, Exception):
                    # Handle upload exceptions
                    file_path = file_paths[i] if i < len(file_paths) else "unknown"
                    processed_results.append(FileUploadResult(
                        file_path=file_path,
                        success=False,
                        error_message=f"Upload failed: {str(result)}"
                    ))
                else:
                    processed_results.append(result)

            # Register uploaded files if sandbox_id is provided
            registration_success = False
            if sandbox_id:
                registration_success = await self._register_uploaded_files(
                    processed_results, sandbox_id, organization_code, task_id
                )

            # Calculate statistics
            success_count = sum(1 for r in processed_results if r.success)
            failed_count = len(processed_results) - success_count
            registration_success_count = sum(1 for r in processed_results if r.registration_success)

            response = FileUploadResponse(
                total_count=len(file_paths),
                success_count=success_count,
                failed_count=failed_count,
                registration_success_count=registration_success_count,
                all_success=success_count == len(file_paths),
                all_registered=registration_success_count == success_count if sandbox_id else True,
                results=processed_results
            )

            logger.info(f"Batch upload completed: {success_count}/{len(file_paths)} files uploaded successfully")
            if sandbox_id:
                logger.info(f"Registration completed: {registration_success_count}/{success_count} files registered successfully")

            return response

        except Exception as e:
            logger.error(f"Batch upload failed: {e}")
            logger.error(traceback.format_exc())
            raise

    async def _validate_and_resolve_paths(self, file_paths: List[str]) -> List[Path]:
        """
        Validate file paths and resolve to absolute paths

        Args:
            file_paths: List of relative file paths

        Returns:
            List of validated absolute file paths
        """
        resolved_paths = []

        for file_path in file_paths:
            try:
                # Resolve to absolute path within workspace
                absolute_path = self.workspace_dir / file_path

                # Security check: ensure path is within workspace
                try:
                    absolute_path.resolve().relative_to(self.workspace_dir.resolve())
                except ValueError:
                    logger.warning(f"File path outside workspace boundary: {file_path}")
                    continue

                # Check if file exists
                if not absolute_path.exists():
                    logger.warning(f"File does not exist: {file_path}")
                    continue

                # Check if it's a file (not directory)
                if not absolute_path.is_file():
                    logger.warning(f"Path is not a file: {file_path}")
                    continue

                # Check file size (max 5GB)
                file_size = absolute_path.stat().st_size
                if file_size > 5 * 1024 * 1024 * 1024:  # 5GB
                    logger.warning(f"File too large: {file_path} ({file_size} bytes)")
                    continue

                resolved_paths.append(absolute_path)
                logger.debug(f"Validated file path: {file_path} -> {absolute_path}")

            except Exception as e:
                logger.warning(f"Failed to validate file path {file_path}: {e}")
                continue

        logger.info(f"Validated {len(resolved_paths)} out of {len(file_paths)} file paths")
        return resolved_paths

    async def _load_credentials(self):
        """Load credentials and initialize storage and magic service clients"""
        try:
            # Load credentials using MagicServiceConfigLoader
            self.credentials_data = MagicServiceConfigLoader.load_config_data()
            logger.info(f"Loaded credentials with batch_id: {self.credentials_data.get('batch_id', '未设置')}")

            upload_config = self.credentials_data.get("upload_config", {})
            if not upload_config:
                raise ValueError("upload_config not found in credentials data")

            # Determine platform type
            platform_type = None
            if 'platform' in upload_config:
                try:
                    platform_type = PlatformType(upload_config['platform'])
                    logger.info(f"Determined platform type: {platform_type.value}")
                except (ValueError, TypeError):
                    logger.warning(f"Cannot convert platform value '{upload_config['platform']}' to PlatformType enum")
                    platform_type = PlatformType.tos  # Default to TOS
            else:
                platform_type = PlatformType.tos  # Default to TOS

            # Initialize storage service
            self.storage_service = await StorageFactory.get_storage(
                sts_token_refresh=None,
                metadata=None,
                platform=platform_type
            )

            # Set credentials based on platform type
            from app.infrastructure.storage.types import (
                VolcEngineCredentials,
                AliyunCredentials,
                LocalCredentials,
                S3Credentials
            )

            if platform_type == PlatformType.tos:
                credentials = VolcEngineCredentials(**upload_config)
            elif platform_type == PlatformType.aliyun:
                credentials = AliyunCredentials(**upload_config)
            elif platform_type == PlatformType.local:
                credentials = LocalCredentials(**upload_config)
            elif platform_type == PlatformType.minio:
                credentials = S3Credentials(**upload_config)
            else:
                raise ValueError(f"Unsupported platform type: {platform_type}")

            self.storage_service.set_credentials(credentials)

            # Initialize magic service client
            try:
                self.magic_service_client = MagicServiceClient(self.credentials_data)
                logger.info("Magic Service client initialized successfully")
            except Exception as e:
                logger.warning(f"Failed to initialize Magic Service client: {e}")
                self.magic_service_client = None

            logger.info("Credentials and services loaded successfully")

        except Exception as e:
            logger.error(f"Failed to load credentials: {e}")
            raise

    async def _upload_single_file(self, file_path: Path, workspace_dir: Path) -> FileUploadResult:
        """
        Upload a single file to storage

        Args:
            file_path: Absolute file path
            workspace_dir: Workspace directory path

        Returns:
            FileUploadResult with upload details
        """
        try:
            # Calculate relative path for object key
            relative_path = file_path.relative_to(workspace_dir)
            relative_path_str = relative_path.as_posix()

            # Skip .git files
            if ".git" in file_path.parts:
                logger.debug(f"Skipping .git file: {relative_path_str}")
                return FileUploadResult(
                    file_path=relative_path_str,
                    success=True,
                    error_message="Skipped .git file"
                )

            # Calculate file hash
            file_hash = self._get_file_hash(file_path)
            if not file_hash:
                return FileUploadResult(
                    file_path=relative_path_str,
                    success=False,
                    error_message="Failed to calculate file hash"
                )

            # Generate object key
            from app.utils.path_utils import get_workspace_dir
            base_dir = get_workspace_dir(self.storage_service.credentials)
            object_key = f"{base_dir}{relative_path_str}"

            logger.info(f"Uploading file: {relative_path_str} -> {object_key}")

            # Upload file to storage
            await self.storage_service.upload(file=str(file_path), key=object_key)

            # Get file size
            file_size = file_path.stat().st_size

            # Generate external URL
            external_url = None
            base_url = self.storage_service.credentials.get_public_access_base_url()
            if base_url:
                external_url = f"{base_url.strip('/')}/{object_key.lstrip('/')}"

            logger.info(f"File uploaded successfully: {relative_path_str}")

            return FileUploadResult(
                file_path=relative_path_str,
                success=True,
                file_size=file_size,
                object_key=object_key,
                external_url=external_url,
                registration_success=None  # Will be set during registration
            )

        except (InitException, UploadException) as e:
            logger.error(f"Storage upload failed for {file_path}: {e}")
            return FileUploadResult(
                file_path=relative_path_str if 'relative_path_str' in locals() else str(file_path),
                success=False,
                error_message=f"Storage upload failed: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Unexpected error during upload for {file_path}: {e}")
            logger.error(traceback.format_exc())
            return FileUploadResult(
                file_path=relative_path_str if 'relative_path_str' in locals() else str(file_path),
                success=False,
                error_message=f"Unexpected error: {str(e)}"
            )

    def _get_file_hash(self, file_path: Path) -> str:
        """
        Calculate MD5 hash of file

        Args:
            file_path: File path

        Returns:
            MD5 hash string
        """
        try:
            md5_hash = hashlib.md5()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    md5_hash.update(chunk)
            return md5_hash.hexdigest()
        except Exception as e:
            logger.error(f"Failed to calculate file hash for {file_path}: {e}")
            return ""

    async def _register_uploaded_files(
        self,
        upload_results: List[FileUploadResult],
        sandbox_id: str,
        organization_code: str = None,
        task_id: str = None
    ) -> bool:
        """
        Register uploaded files with Magic Service

        Args:
            upload_results: List of upload results
            sandbox_id: Sandbox ID for registration
            organization_code: Organization code
            task_id: Task ID

        Returns:
            True if registration was successful
        """
        try:
            if not self.magic_service_client:
                logger.warning("Magic Service client not available, skipping registration")
                return False

            # Prepare files for registration
            files_for_registration = []
            for result in upload_results:
                if result.success and result.object_key:
                    file_ext = Path(result.file_path).suffix.lstrip('.')
                    files_for_registration.append({
                        "file_key": result.object_key,
                        "file_extension": file_ext,
                        "filename": Path(result.file_path).name,
                        "file_size": result.file_size or 0,
                        "external_url": result.external_url,
                        "sandbox_id": sandbox_id
                    })

            if not files_for_registration:
                logger.info("No files to register")
                return True

            logger.info(f"Registering {len(files_for_registration)} files with Magic Service")

            # Register files
            await self.magic_service_client.register_files(
                files_for_registration, sandbox_id, organization_code, task_id
            )

            # Update registration status in results
            for result in upload_results:
                if result.success and result.object_key:
                    result.registration_success = True

            logger.info(f"Successfully registered {len(files_for_registration)} files")
            return True

        except (ApiError, ConfigurationError) as e:
            logger.error(f"File registration failed: {e}")
            # Mark all successful uploads as registration failed
            for result in upload_results:
                if result.success:
                    result.registration_success = False
            return False
        except Exception as e:
            logger.error(f"Unexpected error during file registration: {e}")
            logger.error(traceback.format_exc())
            # Mark all successful uploads as registration failed
            for result in upload_results:
                if result.success:
                    result.registration_success = False
            return False
