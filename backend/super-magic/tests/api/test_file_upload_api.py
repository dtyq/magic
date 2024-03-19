"""
Test file upload API endpoints
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
from pathlib import Path

from app.command.ws_server import get_app
from app.api.http_dto.file_upload_dto import FileUploadResponse, FileUploadResult

app = get_app()
client = TestClient(app)


class TestFileUploadAPI:
    """Test cases for file upload API"""

    def test_upload_files_success(self):
        """Test successful file upload"""
        # Mock the FileUploadService
        mock_response = FileUploadResponse(
            total_count=2,
            success_count=2,
            failed_count=0,
            registration_success_count=2,
            all_success=True,
            all_registered=True,
            results=[
                FileUploadResult(
                    file_path="docs/readme.md",
                    success=True,
                    file_size=1024,
                    object_key="base_dir/docs/readme.md",
                    external_url="https://example.com/base_dir/docs/readme.md",
                    registration_success=True,
                    error_message=None
                ),
                FileUploadResult(
                    file_path="src/main.py",
                    success=True,
                    file_size=2048,
                    object_key="base_dir/src/main.py",
                    external_url="https://example.com/base_dir/src/main.py",
                    registration_success=True,
                    error_message=None
                )
            ]
        )

        with patch('app.service.file_upload_service.FileUploadService.upload_files_batch', new_callable=AsyncMock) as mock_upload:
            mock_upload.return_value = mock_response

            request_data = {
                "file_paths": ["docs/readme.md", "src/main.py"],
                "sandbox_id": "sandbox_123",
                "organization_code": "org_456"
            }

            response = client.post("/api/file/upload", json=request_data)

            assert response.status_code == 200
            data = response.json()
            assert data["code"] == 1000
            assert "所有文件上传并注册成功" in data["message"]
            assert data["data"]["total_count"] == 2
            assert data["data"]["success_count"] == 2
            assert data["data"]["all_success"] is True

    def test_upload_files_validation_error(self):
        """Test file upload with validation error"""
        request_data = {
            "file_paths": [],  # Empty list should fail validation
            "sandbox_id": "sandbox_123"
        }

        response = client.post("/api/file/upload", json=request_data)

        assert response.status_code == 422  # FastAPI validation error
        data = response.json()
        assert "detail" in data
        assert len(data["detail"]) > 0
        assert data["detail"][0]["type"] == "value_error"
        assert "file_paths cannot be empty" in data["detail"][0]["msg"]

    def test_upload_files_too_many_files(self):
        """Test file upload with too many files"""
        request_data = {
            "file_paths": [f"file_{i}.txt" for i in range(25)],  # More than 20 files
            "sandbox_id": "sandbox_123"
        }

        response = client.post("/api/file/upload", json=request_data)

        assert response.status_code == 422  # FastAPI validation error
        data = response.json()
        assert "detail" in data
        assert len(data["detail"]) > 0
        assert data["detail"][0]["type"] == "value_error"

    def test_upload_files_dangerous_path(self):
        """Test file upload with dangerous path patterns"""
        request_data = {
            "file_paths": ["../etc/passwd"],  # Dangerous path
            "sandbox_id": "sandbox_123"
        }

        response = client.post("/api/file/upload", json=request_data)

        assert response.status_code == 422  # FastAPI validation error
        data = response.json()
        assert "detail" in data
        assert len(data["detail"]) > 0
        assert data["detail"][0]["type"] == "value_error"
        assert "File path contains dangerous patterns" in data["detail"][0]["msg"]

    def test_upload_files_partial_success(self):
        """Test file upload with partial success"""
        mock_response = FileUploadResponse(
            total_count=3,
            success_count=2,
            failed_count=1,
            registration_success_count=2,
            all_success=False,
            all_registered=True,
            results=[
                FileUploadResult(
                    file_path="docs/readme.md",
                    success=True,
                    file_size=1024,
                    object_key="base_dir/docs/readme.md",
                    external_url="https://example.com/base_dir/docs/readme.md",
                    registration_success=True,
                    error_message=None
                ),
                FileUploadResult(
                    file_path="src/main.py",
                    success=True,
                    file_size=2048,
                    object_key="base_dir/src/main.py",
                    external_url="https://example.com/base_dir/src/main.py",
                    registration_success=True,
                    error_message=None
                ),
                FileUploadResult(
                    file_path="nonexistent.txt",
                    success=False,
                    error_message="File not found"
                )
            ]
        )

        with patch('app.service.file_upload_service.FileUploadService.upload_files_batch', new_callable=AsyncMock) as mock_upload:
            mock_upload.return_value = mock_response

            request_data = {
                "file_paths": ["docs/readme.md", "src/main.py", "nonexistent.txt"],
                "sandbox_id": "sandbox_123"
            }

            response = client.post("/api/file/upload", json=request_data)

            assert response.status_code == 200
            data = response.json()
            assert data["code"] == 1000
            assert "部分文件上传成功" in data["message"]
            assert data["data"]["total_count"] == 3
            assert data["data"]["success_count"] == 2
            assert data["data"]["failed_count"] == 1

    def test_upload_files_without_registration(self):
        """Test file upload without sandbox_id (no registration)"""
        mock_response = FileUploadResponse(
            total_count=1,
            success_count=1,
            failed_count=0,
            registration_success_count=0,
            all_success=True,
            all_registered=True,  # True when no registration needed
            results=[
                FileUploadResult(
                    file_path="docs/readme.md",
                    success=True,
                    file_size=1024,
                    object_key="base_dir/docs/readme.md",
                    external_url="https://example.com/base_dir/docs/readme.md",
                    registration_success=None,  # None when no registration
                    error_message=None
                )
            ]
        )

        with patch('app.service.file_upload_service.FileUploadService.upload_files_batch', new_callable=AsyncMock) as mock_upload:
            mock_upload.return_value = mock_response

            request_data = {
                "file_paths": ["docs/readme.md"]
                # No sandbox_id, so no registration
            }

            response = client.post("/api/file/upload", json=request_data)

            assert response.status_code == 200
            data = response.json()
            assert data["code"] == 1000
            assert "所有文件上传成功" in data["message"]
            assert data["data"]["all_success"] is True
            assert data["data"]["all_registered"] is True

    def test_upload_files_all_failed(self):
        """Test file upload when all files fail"""
        mock_response = FileUploadResponse(
            total_count=2,
            success_count=0,
            failed_count=2,
            registration_success_count=0,
            all_success=False,
            all_registered=False,
            results=[
                FileUploadResult(
                    file_path="nonexistent1.txt",
                    success=False,
                    error_message="File not found"
                ),
                FileUploadResult(
                    file_path="nonexistent2.txt",
                    success=False,
                    error_message="File not found"
                )
            ]
        )

        with patch('app.service.file_upload_service.FileUploadService.upload_files_batch', new_callable=AsyncMock) as mock_upload:
            mock_upload.return_value = mock_response

            request_data = {
                "file_paths": ["nonexistent1.txt", "nonexistent2.txt"],
                "sandbox_id": "sandbox_123"
            }

            response = client.post("/api/file/upload", json=request_data)

            assert response.status_code == 200
            data = response.json()
            assert data["code"] == 2000  # Should be error code when all files fail
            assert "所有文件上传失败" in data["message"]
            assert data["data"]["total_count"] == 2
            assert data["data"]["success_count"] == 0
            assert data["data"]["failed_count"] == 2
            assert data["data"]["all_success"] is False
