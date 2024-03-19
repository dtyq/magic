"""
File Service Module

Provides file-related operations including version history retrieval.
"""

import traceback
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path

from app.infrastructure.git.git import GitService
from app.infrastructure.storage.factory import StorageFactory
from app.infrastructure.storage.types import (
    PlatformType,
    VolcEngineCredentials,
    AliyunCredentials,
    LocalCredentials,
    S3Credentials,
)
from app.infrastructure.storage.base import AbstractStorage
from app.core.config.communication_config import STSTokenRefreshConfig
from app.core.base_service import Base

logger = logging.getLogger(__name__)


class FileService(Base):
    SERVICE_TYPE = "file"
    """File service for handling file operations and version history with credential refresh support"""

    def __init__(self):
        """Initialize the file service"""
        self.git_service = None
        self._storage_service_cache = {}  # Cache storage services by platform type
        self._credentials_cache = {}  # Cache credentials data

    def _get_git_service(self) -> GitService:
        """Get or create GitService instance"""
        if self.git_service is None:
            self.git_service = GitService()
        return self.git_service

    async def _get_storage_service(
        self, platform_type: PlatformType = None, force_refresh: bool = False
    ) -> AbstractStorage:
        """
        Get storage service instance with credential refresh support

        Args:
            platform_type: Platform type, if None will determine from credentials
            force_refresh: Force refresh of cached service instance

        Returns:
            Configured storage service instance with credential refresh capability
        """
        try:
            # Load credentials data
            from app.infrastructure.magic_service import MagicServiceConfigLoader
            from app.infrastructure.magic_service.exceptions import ConfigurationError

            try:
                credentials_data = MagicServiceConfigLoader.load_config_data()
                logger.info(f"Loaded credentials with batch_id: {credentials_data.get('batch_id', 'Not set')}")
            except ConfigurationError as e:
                logger.error(f"Failed to load credentials: {e}")
                raise ValueError(f"Cannot load storage credentials: {e}")

            upload_config = credentials_data.get("upload_config", {})
            if not upload_config:
                raise ValueError("upload_config not found in credentials data")

            # Determine platform type from config if not provided
            if platform_type is None:
                platform_type = PlatformType.tos  # Default
                if "platform" in upload_config:
                    try:
                        platform_type = PlatformType(upload_config["platform"])
                        logger.info(f"Determined platform type from credentials: {platform_type.value}")
                    except (ValueError, TypeError):
                        logger.warning(
                            f"Cannot convert platform value '{upload_config['platform']}' to PlatformType enum, using TOS"
                        )

            # Check cache for existing service
            cache_key = platform_type.value
            if not force_refresh and cache_key in self._storage_service_cache:
                cached_service = self._storage_service_cache[cache_key]
                logger.debug(f"Using cached storage service for platform: {platform_type.value}")
                return cached_service

            # Load STS token refresh configuration and metadata from init client message
            sts_refresh_config = None
            metadata = {}

            try:
                # Load from init_client_message.json for STS config and metadata
                from app.paths import PathManager

                init_client_path = PathManager.get_init_client_message_file()
                init_client_data = MagicServiceConfigLoader.load_config_data(str(init_client_path))

                # Extract STS refresh config
                sts_config_data = init_client_data.get("sts_token_refresh")
                if sts_config_data:
                    try:
                        sts_refresh_config = STSTokenRefreshConfig(
                            url=sts_config_data["url"],
                            method=sts_config_data.get("method", "POST"),
                            headers=sts_config_data.get("headers", {}),
                        )
                        logger.info(f"STS token refresh configuration loaded: {sts_refresh_config.url}")
                    except Exception as e:
                        logger.warning(f"Failed to parse STS refresh config: {e}")

                # Extract metadata
                metadata = init_client_data.get("metadata", {})
                if metadata:
                    logger.info(f"Metadata loaded with {len(metadata)} fields")
                else:
                    logger.warning("No metadata found in init client message")

            except Exception as e:
                logger.warning(f"Failed to load init client message for STS config and metadata: {e}")
                logger.warning("STS refresh and metadata will not be available")

            # Create storage service with refresh support
            storage_service = await StorageFactory.get_storage(
                sts_token_refresh=sts_refresh_config, metadata=metadata, platform=platform_type
            )

            # Create appropriate credentials object based on platform
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

            # Set credentials on storage service
            storage_service.set_credentials(credentials)

            # Cache the service instance
            self._storage_service_cache[cache_key] = storage_service
            self._credentials_cache[cache_key] = credentials_data

            logger.info(f"Created and cached storage service for platform: {platform_type.value}")
            return storage_service

        except Exception as e:
            logger.error(f"Failed to get storage service: {e}")
            logger.error(traceback.format_exc())
            raise

    def get_file_version_history(self, file_key: str, git_directory: str = None) -> Dict[str, Any]:
        """
        Get file version history using git log

        Args:
            file_key: The file path/key to get version history for
            git_directory: The git directory to use (e.g., '.workspace', '.chat_history').
                          If None, uses the project root.

        Returns:
            Dict containing file version history information

        Raises:
            Exception: When git operation fails or file not found
        """
        try:
            logger.info(f"Getting file version history for: {file_key} in directory: {git_directory}")

            # Validate file_key
            if not file_key or not file_key.strip():
                raise ValueError("File key cannot be empty")

            # Get git service
            git_service = self._get_git_service()

            # Execute git log command
            commit_history = self._execute_git_log(git_service, file_key, git_directory)

            # Parse and structure the response
            version_history = self._parse_git_log_output(commit_history, file_key)

            logger.info(f"Successfully retrieved version history for {file_key}")

            return {
                "file_key": file_key,
                "git_directory": git_directory,
                "version_count": len(version_history),
                "versions": version_history,
            }

        except Exception as e:
            logger.error(f"Failed to get file version history for {file_key}: {e}")
            logger.error(traceback.format_exc())
            raise

    def _execute_git_log(self, git_service: GitService, file_key: str, git_directory: str = None) -> str:
        """
        Execute git log command for the specified file

        Args:
            git_service: GitService instance
            file_key: File path to get history for
            git_directory: The git directory to use. If None, uses project root.

        Returns:
            Git log output as string
        """
        try:
            import subprocess
            import os

            # Get the project root directory
            project_root = git_service._get_project_root()

            # Determine the working directory
            if git_directory:
                working_dir = project_root / git_directory
                if not working_dir.exists():
                    raise FileNotFoundError(f"Git directory {git_directory} does not exist at {working_dir}")
            else:
                raise ValueError("Git directory is required")

            logger.info(f"Working directory: {working_dir}")

            # Execute git log command
            result = subprocess.run(
                ["git", "log", "--stat", "--", file_key],
                cwd=working_dir,
                capture_output=True,
                text=True,
                timeout=30,  # 30 second timeout
            )
            logger.info(f"Git log command result: {result}")

            if result.returncode != 0:
                if "does not exist" in result.stderr or "fatal: bad revision" in result.stderr:
                    raise FileNotFoundError(f"File {file_key} not found in git repository at {working_dir}")
                else:
                    raise Exception(f"Git log command failed: {result.stderr}")

            return result.stdout

        except subprocess.TimeoutExpired:
            raise Exception("Git log command timed out")
        except Exception as e:
            logger.error(f"Error executing git log for {file_key}: {e}")
            raise

    def _parse_git_log_output(self, git_log_output: str, file_key: str) -> List[Dict[str, Any]]:
        """
        Parse git log output into structured data

        Args:
            git_log_output: Raw git log output
            file_key: Original file key for reference

        Returns:
            List of version information dictionaries
        """
        versions = []

        if not git_log_output.strip():
            return versions

        # Split by commit blocks
        commit_blocks = git_log_output.split("\ncommit ")

        for block in commit_blocks:
            if not block.strip():
                continue

            try:
                version_info = self._parse_commit_block(block)
                if version_info:
                    versions.append(version_info)
            except Exception as e:
                logger.warning(f"Failed to parse commit block: {e}")
                continue

        return versions

    def _parse_commit_block(self, commit_block: str) -> Optional[Dict[str, Any]]:
        """
        Parse a single commit block from git log output

        Args:
            commit_block: Single commit block string

        Returns:
            Parsed commit information dictionary
        """
        lines = commit_block.strip().split("\n")
        if not lines:
            return None

        # Extract commit hash and remove "commit " prefix if present
        commit_hash = lines[0].strip()
        if commit_hash.startswith("commit "):
            commit_hash = commit_hash[7:]  # Remove "commit " prefix
        if not commit_hash:
            return None

        # Parse commit information
        author = ""
        date = ""
        message_lines = []
        stats = {}

        i = 1
        while i < len(lines):
            line = lines[i].strip()

            if line.startswith("Author:"):
                author = line[7:].strip()
            elif line.startswith("Date:"):
                # Extract date and format it
                raw_date = line[5:].strip()
                try:
                    from datetime import datetime

                    # Parse the git date format and convert to yyyy-mm-dd H:i:s
                    # Git date format: "Tue Jun 17 20:23:36 2025 +0800"
                    parsed_date = datetime.strptime(raw_date, "%a %b %d %H:%M:%S %Y %z")
                    date = parsed_date.strftime("%Y-%m-%d %H:%M:%S")
                except ValueError:
                    # If parsing fails, keep original date
                    date = raw_date
            elif line.startswith(" ") and not line.startswith("    "):
                # This is part of the commit message
                message_lines.append(line.strip())
            elif "|" in line and "insertions" in line:
                # This is a stat line
                parts = line.split("|")
                if len(parts) >= 2:
                    file_info = parts[0].strip()
                    change_info = parts[1].strip()
                    stats = {"file": file_info, "changes": change_info}
            i += 1

        # Combine message lines
        message = " ".join(message_lines).strip()

        return {"commit_hash": commit_hash, "author": author, "date": date, "message": message, "stats": stats}

    async def get_file_content_from_commit(
        self, file_key: str, commit_hash: str, git_directory: str = None
    ) -> Dict[str, Any]:
        """
        Get file content from a specific commit and upload to storage

        Args:
            file_key: The file path/key to get content for
            commit_hash: The commit hash to get file from
            git_directory: The git directory to use (e.g., '.workspace', '.chat_history').
                          If None, uses the project root.

        Returns:
            Dict containing file content information and temporary URL

        Raises:
            Exception: When git operation fails or file not found
        """
        try:
            logger.info(
                f"Getting file content for: {file_key} from commit: {commit_hash} in directory: {git_directory}"
            )

            # Validate parameters
            if not file_key or not file_key.strip():
                raise ValueError("File key cannot be empty")
            if not commit_hash or not commit_hash.strip():
                raise ValueError("Commit hash cannot be empty")

            # Get git service
            git_service = self._get_git_service()

            # Get blob hash from commit
            blob_hash = self._get_blob_hash_from_commit(git_service, file_key, commit_hash, git_directory)
            if not blob_hash:
                raise FileNotFoundError(f"File {file_key} not found in commit {commit_hash}")

            # Get file content from blob
            file_content = self._get_file_content_from_blob(git_service, blob_hash, git_directory)
            if not file_content:
                raise Exception(f"Failed to get file content from blob {blob_hash}")

            # Write content to temporary file and upload to storage
            upload_result = await self._upload_file_content_to_storage(file_key, file_content, commit_hash)

            logger.info(f"Successfully retrieved and uploaded file content for {file_key} from commit {commit_hash}")

            return upload_result

        except Exception as e:
            logger.error(f"Failed to get file content for {file_key} from commit {commit_hash}: {e}")
            logger.error(traceback.format_exc())
            raise

    def _get_blob_hash_from_commit(
        self, git_service: GitService, file_key: str, commit_hash: str, git_directory: str = None
    ) -> Optional[str]:
        """
        Get blob hash for a file in a specific commit using git ls-tree

        Args:
            git_service: GitService instance
            file_key: File path to get blob for
            commit_hash: Commit hash to check
            git_directory: The git directory to use

        Returns:
            Blob hash string or None if not found
        """
        try:
            import subprocess

            # Get the project root directory
            project_root = git_service._get_project_root()

            # Determine the working directory
            if git_directory:
                working_dir = project_root / git_directory
                if not working_dir.exists():
                    raise FileNotFoundError(f"Git directory {git_directory} does not exist at {working_dir}")
            else:
                raise ValueError("Git directory is required")

            logger.info(f"Getting blob hash for {file_key} in commit {commit_hash} at {working_dir}")

            # Execute git ls-tree command
            result = subprocess.run(
                ["git", "ls-tree", commit_hash, file_key], cwd=working_dir, capture_output=True, text=True, timeout=30
            )

            if result.returncode != 0:
                if "not found" in result.stderr or "fatal: bad revision" in result.stderr:
                    logger.warning(f"File {file_key} not found in commit {commit_hash}")
                    return None
                else:
                    raise Exception(f"Git ls-tree command failed: {result.stderr}")

            # Parse the output to extract blob hash
            # git ls-tree output format: <mode> <type> <hash>\t<path>
            output_lines = result.stdout.strip().split("\n")
            if not output_lines or not output_lines[0]:
                return None

            # Parse the first line
            parts = output_lines[0].split("\t")
            if len(parts) != 2:
                logger.warning(f"Unexpected git ls-tree output format: {output_lines[0]}")
                return None

            # Extract hash from the first part (before \t)
            hash_part = parts[0].split()
            if len(hash_part) < 3:
                logger.warning(f"Unexpected git ls-tree hash format: {parts[0]}")
                return None

            blob_hash = hash_part[2]
            logger.info(f"Found blob hash: {blob_hash} for file {file_key}")
            return blob_hash

        except subprocess.TimeoutExpired:
            raise Exception("Git ls-tree command timed out")
        except Exception as e:
            logger.error(f"Error executing git ls-tree for {file_key}: {e}")
            raise

    def _get_file_content_from_blob(
        self, git_service: GitService, blob_hash: str, git_directory: str = None
    ) -> Optional[bytes]:
        """
        Get file content from blob hash using git cat-file

        Args:
            git_service: GitService instance
            blob_hash: Blob hash to get content from
            git_directory: The git directory to use

        Returns:
            File content as bytes or None if failed
        """
        try:
            import subprocess

            # Get the project root directory
            project_root = git_service._get_project_root()

            # Determine the working directory
            if git_directory:
                working_dir = project_root / git_directory
                if not working_dir.exists():
                    raise FileNotFoundError(f"Git directory {git_directory} does not exist at {working_dir}")
            else:
                raise ValueError("Git directory is required")

            logger.info(f"Getting file content from blob {blob_hash} at {working_dir}")

            # Execute git cat-file command - don't use text=True to handle binary files
            result = subprocess.run(
                ["git", "cat-file", "-p", blob_hash], cwd=working_dir, capture_output=True, timeout=30
            )

            if result.returncode != 0:
                if "not found" in result.stderr.decode(
                    "utf-8", errors="ignore"
                ) or "fatal: bad revision" in result.stderr.decode("utf-8", errors="ignore"):
                    logger.warning(f"Blob {blob_hash} not found")
                    return None
                else:
                    raise Exception(f"Git cat-file command failed: {result.stderr.decode('utf-8', errors='ignore')}")

            file_content = result.stdout
            logger.info(f"Successfully retrieved file content from blob {blob_hash}, size: {len(file_content)} bytes")
            return file_content

        except subprocess.TimeoutExpired:
            raise Exception("Git cat-file command timed out")
        except Exception as e:
            logger.error(f"Error executing git cat-file for blob {blob_hash}: {e}")
            raise

    async def _upload_file_content_to_storage(
        self, file_key: str, file_content: bytes, commit_hash: str
    ) -> Dict[str, Any]:
        """
        Write file content to temporary directory and upload to storage

        Args:
            file_key: Original file key
            file_content: File content as bytes
            commit_hash: Commit hash for reference

        Returns:
            Dict containing upload result with temporary URL
        """
        try:
            import hashlib

            # Create hash from filename and commit hash to ensure uniqueness
            hash_input = f"{file_key}_{commit_hash}"
            file_hash = hashlib.md5(hash_input.encode("utf-8")).hexdigest()

            # Upload with mandatory credential refresh
            upload_result = await self._upload_temp_file_to_storage(file_content, file_key, file_hash)

            return upload_result

        except Exception as e:
            logger.error(f"Failed to upload file content to storage: {e}")
            raise

    async def _upload_with_credential(
        self, file_content: bytes, original_file_key: str, file_hash: str, expires_in: int = 3600
    ) -> Dict[str, Any]:
        """
        Upload file with automatic credential refresh support

        Args:
            file_content: File content as bytes
            original_file_key: Original file key for reference
            file_hash: Hash for unique file naming
            expires_in: URL expiration time in seconds
        Returns:
            Dict containing upload result
        """
        try:
            from datetime import datetime
            from pathlib import Path
            from app.utils.path_utils import get_storage_dir

            # Get storage service with credential refresh support
            storage_service = await self._get_storage_service()

            # Generate object key for storage
            file_ext = Path(original_file_key).suffix
            unique_filename = f"{file_hash}{file_ext}"

            # Use tmp_dir from upload_config
            from app.utils.path_utils import get_workspace_dir

            upload_dir = get_workspace_dir(storage_service.credentials)
            object_key = f"{upload_dir}{unique_filename}"

            # Perform upload with automatic credential refresh
            await self._perform_storage_upload(storage_service, file_content, object_key)

            # Generate download URL with refresh support
            temporary_url = await self._generate_download_url(storage_service, object_key, expires_in)

            platform = storage_service.get_platform_name()

            logger.info(f"File uploaded successfully with credential refresh: {object_key} (hash: {file_hash})")

            return {
                "file_key": original_file_key,
                "temporary_url": temporary_url,
                "file_size": len(file_content),
                "object_key": object_key,
                "platform": platform,
                "file_hash": file_hash,
                "expires_in": expires_in,
            }

        except Exception as e:
            logger.error(f"Upload with credential refresh failed: {e}")
            logger.error(traceback.format_exc())
            raise

    async def _perform_storage_upload(self, storage_service: AbstractStorage, file_content: bytes, object_key: str):
        """
        Perform storage upload with automatic credential refresh

        Args:
            storage_service: Storage service instance
            file_content: File content to upload
            object_key: Storage object key
        """
        try:
            # Check if refresh configuration is available
            if not storage_service.sts_refresh_config:
                logger.warning("STS refresh config not available - cannot refresh expired credentials")
                logger.warning("Upload may fail if credentials are expired")

            # Refresh credentials if needed before upload
            logger.info("Checking and refreshing credentials before upload...")
            await storage_service.refresh_credentials()

            # Check if credentials are still expired after refresh attempt
            if hasattr(storage_service.credentials, "expires") and storage_service.credentials.expires:
                import time

                current_time = time.time()
                if current_time > storage_service.credentials.expires:
                    logger.error(
                        f"Credentials are still expired even after refresh attempt. Current: {current_time}, Expires: {storage_service.credentials.expires}"
                    )
                    raise Exception("Credentials expired and refresh failed")

            # Perform the upload
            logger.info(f"Performing upload to: {object_key}")
            await storage_service.upload(file=file_content, key=object_key)

        except Exception as e:
            logger.error(f"Storage upload failed even after credential refresh: {e}")
            raise

    async def _generate_download_url(self, storage_service: AbstractStorage, object_key: str, expires_in: int) -> str:
        """
        Generate download URL with automatic credential refresh

        Args:
            storage_service: Storage service instance
            object_key: Storage object key
            expires_in: URL expiration time in seconds

        Returns:
            Download URL string
        """
        try:
            # Check if refresh configuration is available
            if not storage_service.sts_refresh_config:
                logger.warning("STS refresh config not available - cannot refresh expired credentials")
                logger.warning("URL generation may fail if credentials are expired")

            # Refresh credentials if needed before generating URL
            logger.info("Checking and refreshing credentials before generating download URL...")
            await storage_service.refresh_credentials()

            # Check if credentials are still expired after refresh attempt
            if hasattr(storage_service.credentials, "expires") and storage_service.credentials.expires:
                import time

                current_time = time.time()
                if current_time > storage_service.credentials.expires:
                    logger.error(
                        f"Credentials are still expired even after refresh attempt. Current: {current_time}, Expires: {storage_service.credentials.expires}"
                    )
                    logger.warning("Proceeding with URL generation anyway - may fail")

            # Generate the download URL
            logger.info(f"Generating download URL for: {object_key}")
            return await storage_service.get_download_url(key=object_key, expires_in=expires_in)

        except Exception as e:
            logger.error(f"Failed to generate download URL even after credential refresh: {e}")
            raise

    async def _upload_temp_file_to_storage(
        self, file_content: bytes, original_file_key: str, file_hash: str
    ) -> Dict[str, Any]:
        """
        Upload temporary file to storage with automatic credential refresh support

        Token refresh is now mandatory, not optional.

        Args:
            file_content: File content as bytes
            original_file_key: Original file key for reference
            file_hash: Hash of the filename for unique naming

        Returns:
            Dict containing upload result
        """
        try:
            logger.info(f"Uploading temporary file with mandatory credential refresh: {original_file_key}")

            # Use the new credential refresh mechanism
            upload_result = await self._upload_with_credential(file_content, original_file_key, file_hash)

            logger.info(f"Temporary file uploaded successfully with credential refresh: {original_file_key}")
            return upload_result

        except Exception as e:
            logger.error(f"Temporary file upload failed: {e}")
            logger.error(traceback.format_exc())
            raise

    async def upload_local_file(
        self, file_path: str, expires_in: int = 3600, options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Upload local file to storage with automatic credential refresh support

        Args:
            file_path: Path to the local file to upload
            expires_in: URL expiration time in seconds, default 1 hour (3600 seconds)
            options: Optional configuration parameters, can include:
                    - custom_name: Custom filename for storage (if not provided, uses original filename)
                    - preserve_path: Whether to preserve directory structure in storage
                    - headers: Custom HTTP headers for upload
                    - content_type: Override content type detection

        Returns:
            Dict containing:
                - file_path: Original local file path
                - file_name: File name used in storage
                - temporary_url: Temporary download URL
                - file_size: File size in bytes
                - object_key: Storage object key
                - platform: Storage platform name
                - file_hash: Generated file hash for uniqueness
                - expires_in: URL expiration time in seconds
                - uploaded_at: Upload timestamp
                - content_type: Detected or specified content type

        Raises:
            FileNotFoundError: If the local file does not exist
            ValueError: If file path is empty or invalid
            Exception: If upload fails

        Example:
            ```python
            # Basic usage
            result = await file_service.upload_local_file("/path/to/document.pdf")
            download_url = result["temporary_url"]

            # With custom configuration
            result = await file_service.upload_local_file(
                file_path="/path/to/image.jpg",
                expires_in=1800,  # 30 minutes
                options={
                    "custom_name": "profile_image.jpg",
                    "content_type": "image/jpeg"
                }
            )
            ```
        """
        try:
            import hashlib
            import mimetypes
            from datetime import datetime
            from pathlib import Path

            logger.info(f"Uploading local file: {file_path}, expires_in: {expires_in}s")

            # Validate input parameters
            if not file_path or not file_path.strip():
                raise ValueError("File path cannot be empty")

            file_path_obj = Path(file_path)

            # Check if file exists and is readable
            if not file_path_obj.exists():
                raise FileNotFoundError(f"File not found: {file_path}")

            if not file_path_obj.is_file():
                raise ValueError(f"Path is not a file: {file_path}")

            # Read file content
            try:
                with open(file_path_obj, "rb") as f:
                    file_content = f.read()
                logger.info(f"Read file content: {len(file_content)} bytes")
            except Exception as e:
                raise Exception(f"Failed to read file {file_path}: {e}")

            # Get file information
            file_name = file_path_obj.name
            file_size = len(file_content)

            # Handle custom naming from options
            if options and options.get("custom_name"):
                custom_name = options["custom_name"].strip()
                if custom_name:
                    # Keep original extension if custom name doesn't have one
                    if not Path(custom_name).suffix and file_path_obj.suffix:
                        custom_name += file_path_obj.suffix
                    file_name = custom_name

            # Generate unique hash for file naming
            # Use file content and original path for uniqueness
            hash_input = f"{file_path_obj.name}_{file_size}_{datetime.now().isoformat()}"
            file_hash = hashlib.md5(hash_input.encode("utf-8")).hexdigest()

            # Detect content type
            content_type = None
            if options and options.get("content_type"):
                content_type = options["content_type"]
            else:
                # Auto-detect based on file extension
                detected_type, _ = mimetypes.guess_type(str(file_path_obj))
                content_type = detected_type or "application/octet-stream"

            logger.info(f"File info: name={file_name}, size={file_size}, type={content_type}, hash={file_hash[:8]}...")

            # Use existing upload mechanism with credential refresh
            upload_result = await self._upload_with_credential(
                file_content=file_content, original_file_key=file_name, file_hash=file_hash, expires_in=expires_in
            )

            # Enhance result with additional information
            enhanced_result = {
                **upload_result,
                "file_path": str(file_path),
                "file_name": file_name,
                "uploaded_at": datetime.now().isoformat(),
                "content_type": content_type,
            }

            logger.info(f"Local file uploaded successfully: {file_path} -> {upload_result.get('platform', 'unknown')}")
            logger.info(f"Download URL generated, expires in {expires_in} seconds")

            return enhanced_result

        except FileNotFoundError:
            # Re-raise FileNotFoundError as-is
            raise
        except ValueError:
            # Re-raise ValueError as-is
            raise
        except Exception as e:
            logger.error(f"Failed to upload local file {file_path}: {e}")
            logger.error(traceback.format_exc())
            raise Exception(f"Upload failed: {e}")

    async def get_file_download_url(
        self, file_path: str, expires_in: int = 3600, options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        根据文件相对路径获取临时下载链接

        Args:
            file_path: 文件的相对路径，例如 'documents/report.pdf'
            expires_in: URL过期时间（秒），默认1小时（3600秒）
            options: 可选配置参数，可包含：
                    - headers: 自定义HTTP请求头
                    - params: 平台特有的查询参数（如阿里云OSS的限速等）
                    - slash_safe: 是否对路径中的斜杠进行转义（阿里云OSS）
                    - resize: 图片缩放百分比（1-100），例如 50 表示缩放到 50%

        Returns:
            Dict containing:
                - file_path: 原始文件路径
                - download_url: 临时下载链接
                - expires_in: 过期时间（秒）
                - platform: 存储平台
                - generated_at: 生成时间

        Raises:
            ValueError: 如果文件路径为空或无效
            Exception: 如果获取下载链接失败

        Example:
            ```python
            # 基本用法
            result = await file_service.get_file_download_url("documents/report.pdf")
            download_url = result["download_url"]

            # 带自定义配置
            result = await file_service.get_file_download_url(
                file_path="videos/presentation.mp4",
                expires_in=1800,  # 30分钟
                options={
                    "headers": {"Content-Type": "video/mp4"},
                    "params": {"x-oss-traffic-limit": str(1024 * 1024 * 8)}  # 1MB/s限速
                }
            )

            # 图片缩放
            result = await file_service.get_file_download_url(
                file_path="images/photo.jpg",
                options={"resize": 50}  # 缩放到50%
            )
            ```
        """
        try:
            from datetime import datetime
            from app.utils.path_utils import get_storage_dir

            logger.info(f"获取文件下载链接: {file_path}, 有效期: {expires_in}秒")

            # 验证输入参数
            if not file_path or not file_path.strip():
                raise ValueError("文件路径不能为空")

            # 标准化文件路径（移除开头的斜杠）
            normalized_path = file_path.strip().lstrip("/")

            # 获取带凭证刷新功能的存储服务
            storage_service = await self._get_storage_service()

            # 构建完整的存储对象键
            from app.utils.path_utils import get_workspace_dir

            upload_dir = get_workspace_dir(storage_service.credentials)
            object_key = f"{upload_dir}{normalized_path}"

            # 处理图片缩放参数
            if options is None:
                options = {}

            resize = options.get("resize")
            if resize is not None:
                # Get platform name to determine which parameter to use
                platform = storage_service.get_platform_name()

                # Build image processing parameter
                image_process = f"image/resize,p_{resize}"

                # Add platform-specific parameter
                if "params" not in options:
                    options["params"] = {}

                if platform == "tos":
                    options["params"]["x-tos-process"] = image_process
                    logger.info(f"Adding TOS image resize parameter: {image_process}")
                elif platform == "oss":
                    options["params"]["x-oss-process"] = image_process
                    logger.info(f"Adding OSS image resize parameter: {image_process}")
                else:
                    logger.warning(f"Image resize not supported for platform: {platform}")

            # 生成下载链接（会自动刷新凭证）
            download_url = await self._generate_download_url(storage_service, object_key, expires_in)

            # 如果存储服务支持更多选项，尝试使用
            if options and hasattr(storage_service, "get_download_url"):
                try:
                    # 先刷新凭证
                    await storage_service.refresh_credentials()
                    download_url = await storage_service.get_download_url(
                        key=object_key, expires_in=expires_in, options=options
                    )
                except Exception as e:
                    logger.warning(f"使用选项参数生成下载链接失败，使用默认方法: {e}")

            # 获取平台信息
            platform = storage_service.get_platform_name()

            result = {
                "file_path": file_path,
                "download_url": download_url,
                "expires_in": expires_in,
                "platform": platform,
                "generated_at": datetime.now().isoformat(),
                "object_key": object_key,
            }

            logger.info(f"成功生成下载链接: {file_path} -> {platform}")
            return result

        except Exception as e:
            logger.error(f"获取文件下载链接失败: {file_path}, 错误: {e}")
            logger.error(traceback.format_exc())
            raise
