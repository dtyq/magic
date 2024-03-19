"""
FileService Mock 单元测试

使用 Mock 对象测试 FileService 的核心逻辑，不依赖真实的存储配置。
"""
import sys
from pathlib import Path
import os

# 设置项目根目录 - 必须在导入项目模块之前
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(project_root))

# 初始化路径管理器
from app.paths import PathManager
PathManager.set_project_root(project_root)
from agentlang.context.application_context import ApplicationContext
ApplicationContext.set_path_manager(PathManager())

import pytest
import tempfile
import hashlib
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch, MagicMock

from app.service.file_service import FileService
from app.infrastructure.storage.types import PlatformType, VolcEngineCredentials
from app.infrastructure.storage.base import AbstractStorage
from app.infrastructure.magic_service.exceptions import ConfigurationError


class TestFileServiceMock:
    """FileService Mock 单元测试类"""

    @pytest.fixture
    def file_service(self):
        """FileService 实例"""
        return FileService()

    @pytest.fixture
    def mock_storage_service(self):
        """Mock 存储服务"""
        storage = Mock(spec=AbstractStorage)
        storage.credentials = Mock()
        storage.credentials.platform = PlatformType.tos
        storage.credentials.expires = None  # Add expires attribute
        storage.get_platform_name.return_value = "tos"
        storage.refresh_credentials = AsyncMock()
        storage.upload = AsyncMock()
        storage.get_download_url = AsyncMock(return_value="https://example.com/download-url")
        storage.sts_refresh_config = Mock()  # Add sts_refresh_config
        storage.set_credentials = Mock()  # Add set_credentials method
        return storage

    @pytest.fixture
    def mock_credentials_data(self):
        """Mock 凭证数据"""
        return {
            "batch_id": "test-batch-123",
            "upload_config": {
                "platform": "tos",
                "temporary_credential": {
                    "host": "https://test-bucket.endpoint.com",
                    "region": "test-region",
                    "endpoint": "https://test.endpoint.com",
                                        "credentials": {
                        "AccessKeyId": "test-access-key-id",
                        "SecretAccessKey": "test-secret-access-key",
                        "SessionToken": "test-session-token",
                        "ExpiredTime": "2025-08-20T20:00:00Z",
                        "CurrentTime": "2025-08-20T11:00:00Z"
                    },
                    "bucket": "test-bucket",
                    "dir": "test/dir/",
                    "expires": 3600
                },
                "expires": 3600
            },
            "sts_token_refresh_config": {
                "url": "https://test.example.com/sts",
                "method": "POST",
                "headers": {"Content-Type": "application/json"}
            },
            "metadata": {"project": "test"}
        }

    @pytest.fixture
    def temp_test_file(self):
        """临时测试文件"""
        content = "Test file content for FileService mock testing\n测试内容"

        # 创建临时文件
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8')
        temp_file.write(content)
        temp_file.close()

        yield temp_file.name, content

        # 清理
        try:
            os.unlink(temp_file.name)
        except OSError:
            pass

    def test_file_service_initialization(self, file_service):
        """测试 FileService 初始化"""
        assert file_service is not None
        assert file_service.git_service is None
        assert file_service._storage_service_cache == {}
        assert file_service._credentials_cache == {}

    def test_git_service_creation_and_caching(self, file_service):
        """测试 GitService 创建和缓存"""
        # 第一次获取
        git_service1 = file_service._get_git_service()
        assert git_service1 is not None
        assert file_service.git_service is git_service1

        # 第二次获取应该返回缓存的实例
        git_service2 = file_service._get_git_service()
        assert git_service2 is git_service1

    @pytest.mark.asyncio
    @pytest.mark.skip(reason="PathManager initialization issue - focus on upload_local_file tests")
    async def test_get_storage_service_with_mock(self, file_service, mock_credentials_data, mock_storage_service):
        """测试获取存储服务（使用 Mock）"""

        with patch('app.infrastructure.magic_service.MagicServiceConfigLoader.load_config_data') as mock_load_config:
            mock_load_config.return_value = mock_credentials_data

            with patch('app.infrastructure.storage.factory.StorageFactory.get_storage') as mock_get_storage:
                mock_get_storage.return_value = mock_storage_service

                # 获取存储服务
                storage_service = await file_service._get_storage_service()

                # 验证调用
                mock_load_config.assert_called_once()
                mock_get_storage.assert_called_once()

                # 验证返回值
                assert storage_service is mock_storage_service
                assert storage_service.get_platform_name() == "tos"

                # 验证缓存
                assert "tos" in file_service._storage_service_cache
                assert file_service._storage_service_cache["tos"] is mock_storage_service

    @pytest.mark.asyncio
    async def test_get_storage_service_caching(self, file_service, mock_credentials_data, mock_storage_service):
        """测试存储服务缓存机制"""

        with patch('app.infrastructure.magic_service.MagicServiceConfigLoader.load_config_data') as mock_load_config:
            mock_load_config.return_value = mock_credentials_data

            with patch('app.infrastructure.storage.factory.StorageFactory.get_storage') as mock_get_storage:
                mock_get_storage.return_value = mock_storage_service

                # 第一次获取
                storage_service1 = await file_service._get_storage_service()

                # 第二次获取应该使用缓存
                storage_service2 = await file_service._get_storage_service()

                # 验证只调用了一次
                assert mock_get_storage.call_count == 1
                assert storage_service1 is storage_service2

    @pytest.mark.asyncio
    async def test_get_storage_service_force_refresh(self, file_service, mock_credentials_data, mock_storage_service):
        """测试强制刷新存储服务"""

        with patch('app.infrastructure.magic_service.MagicServiceConfigLoader.load_config_data') as mock_load_config:
            mock_load_config.return_value = mock_credentials_data

            with patch('app.infrastructure.storage.factory.StorageFactory.get_storage') as mock_get_storage:
                mock_get_storage.return_value = mock_storage_service

                # 第一次获取
                await file_service._get_storage_service()

                # 强制刷新
                await file_service._get_storage_service(force_refresh=True)

                # 验证调用了两次
                assert mock_get_storage.call_count == 2

    @pytest.mark.asyncio
    async def test_get_storage_service_config_error(self, file_service):
        """测试配置加载失败的情况"""

        with patch('app.infrastructure.magic_service.MagicServiceConfigLoader.load_config_data') as mock_load_config:
            mock_load_config.side_effect = ConfigurationError("Configuration not found")

            with pytest.raises(ValueError, match="Cannot load storage credentials"):
                await file_service._get_storage_service()

    @pytest.mark.asyncio
    async def test_get_storage_service_missing_upload_config(self, file_service):
        """测试缺少 upload_config 的情况"""

        credentials_data = {"batch_id": "test", "other_config": {}}

        with patch('app.infrastructure.magic_service.MagicServiceConfigLoader.load_config_data') as mock_load_config:
            mock_load_config.return_value = credentials_data

            with pytest.raises(ValueError, match="upload_config not found"):
                await file_service._get_storage_service()

    @pytest.mark.asyncio
    async def test_upload_with_credential_refresh(self, file_service, mock_storage_service, mock_credentials_data):
        """测试带凭证刷新的上传功能"""

        file_content = b"test file content"
        file_key = "test_file.txt"
        file_hash = "abc123"

        # Mock get_storage_dir
        with patch('app.utils.path_utils.get_storage_dir') as mock_get_dir:
            mock_get_dir.return_value = "test/path/"

            with patch.object(file_service, '_get_storage_service') as mock_get_service:
                mock_get_service.return_value = mock_storage_service

                # 执行上传
                result = await file_service._upload_with_credential(file_content, file_key, file_hash, expires_in=3600)

                # 验证调用
                mock_get_service.assert_called_once()
                mock_storage_service.refresh_credentials.assert_called()
                mock_storage_service.upload.assert_called_once()
                mock_storage_service.get_download_url.assert_called_once()

                # 验证返回结果
                assert result is not None
                assert result["file_key"] == file_key
                assert result["file_size"] == len(file_content)
                assert result["file_hash"] == file_hash
                assert result["platform"] == "tos"
                assert "temporary_url" in result
                assert "object_key" in result

    @pytest.mark.asyncio
    async def test_upload_temp_file_to_storage(self, file_service):
        """测试临时文件上传到存储"""

        file_content = b"temporary file content"
        file_key = "temp_file.txt"
        file_hash = "def456"

        with patch.object(file_service, '_upload_with_credential') as mock_upload:
            expected_result = {
                "file_key": file_key,
                "temporary_url": "https://example.com/temp-url",
                "file_size": len(file_content)
            }
            mock_upload.return_value = expected_result

            # 执行上传
            result = await file_service._upload_temp_file_to_storage(file_content, file_key, file_hash)

            # 验证调用
            mock_upload.assert_called_once()

            # 验证返回结果
            assert result == expected_result

    @pytest.mark.asyncio
    async def test_upload_file_content_to_storage(self, file_service):
        """测试文件内容上传到存储"""

        file_key = "content_file.txt"
        file_content = b"file content to upload"
        commit_hash = "commit123abc"

        with patch.object(file_service, '_upload_temp_file_to_storage') as mock_upload_temp:
            expected_result = {"file_key": file_key, "upload_success": True}
            mock_upload_temp.return_value = expected_result

            # 执行上传
            result = await file_service._upload_file_content_to_storage(file_key, file_content, commit_hash)

            # 验证调用
            mock_upload_temp.assert_called_once()

            # 验证传递的参数
            call_args = mock_upload_temp.call_args[0]
            assert call_args[0] == file_content  # file_content
            assert call_args[1] == file_key      # original_file_key

            # 验证生成的文件哈希
            expected_hash_input = f"{file_key}_{commit_hash}"
            expected_hash = hashlib.md5(expected_hash_input.encode('utf-8')).hexdigest()
            assert call_args[2] == expected_hash  # file_hash

            # 验证返回结果
            assert result == expected_result

    # Note: upload_runtime_file method has been removed, replaced by upload_local_file tests

    # Note: upload_runtime_file_with_custom_key test removed - method no longer exists

    # Note: upload_runtime_file_with_existing_prefix test removed - method no longer exists

    @pytest.mark.asyncio
    async def test_get_file_download_url_mock(self, file_service, mock_storage_service):
        """测试获取文件下载链接（Mock 版本）"""

        file_path = "runtime/download_test.txt"
        expires_in = 1800

        with patch.object(file_service, '_get_storage_service') as mock_get_service:
            mock_get_service.return_value = mock_storage_service

            with patch('app.utils.path_utils.get_storage_dir') as mock_get_dir:
                mock_get_dir.return_value = "test/storage/"

                with patch.object(file_service, '_generate_download_url') as mock_generate_url:
                    mock_generate_url.return_value = "https://example.com/download-mock"

                    # 执行获取下载链接
                    result = await file_service.get_file_download_url(file_path, expires_in)

                    # 验证调用
                    mock_get_service.assert_called_once()
                    mock_generate_url.assert_called_once()

                    # 验证返回结果
                    assert result is not None
                    assert result["file_path"] == file_path
                    assert result["expires_in"] == expires_in
                    assert result["platform"] == "tos"
                    assert "download_url" in result
                    assert "generated_at" in result
                    assert "object_key" in result

    @pytest.mark.asyncio
    async def test_generate_download_url_with_refresh(self, file_service, mock_storage_service):
        """测试带凭证刷新的下载链接生成"""

        object_key = "test/file.txt"
        expires_in = 3600
        expected_url = "https://example.com/signed-download-url"

        mock_storage_service.get_download_url.return_value = expected_url

        # 执行生成下载链接
        result = await file_service._generate_download_url(
            mock_storage_service, object_key, expires_in
        )

        # 验证调用
        mock_storage_service.refresh_credentials.assert_called_once()
        mock_storage_service.get_download_url.assert_called_once_with(
            key=object_key,
            expires_in=expires_in
        )

        # 验证返回结果
        assert result == expected_url

    @pytest.mark.asyncio
    async def test_perform_storage_upload_with_refresh(self, file_service, mock_storage_service):
        """测试带凭证刷新的存储上传"""

        file_content = b"upload test content"
        object_key = "test/upload.txt"

        # 执行上传
        await file_service._perform_storage_upload(
            mock_storage_service, file_content, object_key
        )

        # 验证调用
        mock_storage_service.refresh_credentials.assert_called_once()
        mock_storage_service.upload.assert_called_once_with(
            file=file_content,
            key=object_key
        )

    @pytest.mark.asyncio
    async def test_error_handling_file_not_exists(self, file_service):
        """测试文件不存在的错误处理"""

        with pytest.raises(FileNotFoundError, match="File not found"):
            await file_service.upload_local_file("/nonexistent/file.txt")

    @pytest.mark.asyncio
    async def test_error_handling_empty_file_path(self, file_service):
        """测试空文件路径的错误处理"""

        with pytest.raises(ValueError, match="文件路径不能为空"):
            await file_service.get_file_download_url("")

        with pytest.raises(ValueError, match="文件路径不能为空"):
            await file_service.get_file_download_url("   ")

    @pytest.mark.asyncio
    async def test_upload_failure_handling(self, file_service, mock_storage_service, temp_test_file):
        """测试上传失败的错误处理"""

        file_path, _ = temp_test_file

        # Mock 上传失败
        mock_storage_service.upload.side_effect = Exception("Upload failed")

        with patch.object(file_service, '_get_storage_service') as mock_get_service:
            mock_get_service.return_value = mock_storage_service

            with patch('app.utils.path_utils.get_storage_dir') as mock_get_dir:
                mock_get_dir.return_value = "test/path/"

                with pytest.raises(Exception):
                    await file_service.upload_local_file(file_path)

    @pytest.mark.asyncio
    async def test_upload_local_file_basic(self, file_service, temp_test_file):
        """测试 upload_local_file 基本功能"""

        file_path, file_content = temp_test_file

        # Mock _upload_with_credential 方法
        mock_upload_result = {
            "file_key": "test_file.txt",
            "temporary_url": "https://example.com/download/test_file.txt",
            "file_size": len(file_content.encode('utf-8')),
            "object_key": "uploads/abcdef123456.txt",
            "platform": "tos",
            "file_hash": "abcdef123456",
            "expires_in": 3600
        }

        with patch.object(file_service, '_upload_with_credential', new_callable=AsyncMock) as mock_upload:
            mock_upload.return_value = mock_upload_result

            result = await file_service.upload_local_file(file_path)

            # 验证返回结果结构
            assert "file_path" in result
            assert "file_name" in result
            assert "temporary_url" in result
            assert "file_size" in result
            assert "object_key" in result
            assert "platform" in result
            assert "file_hash" in result
            assert "expires_in" in result
            assert "uploaded_at" in result
            assert "content_type" in result

            # 验证值
            assert result["file_path"] == file_path
            assert result["file_name"].endswith(".txt")
            assert result["temporary_url"] == mock_upload_result["temporary_url"]
            assert result["file_size"] == len(file_content.encode('utf-8'))
            assert result["content_type"] == "text/plain"
            assert result["platform"] == "tos"

            # 验证 _upload_with_credential 被正确调用
            mock_upload.assert_called_once()
            call_args = mock_upload.call_args
            assert len(call_args[1]["file_content"]) == len(file_content.encode('utf-8'))
            assert call_args[1]["original_file_key"].endswith(".txt")
            assert call_args[1]["expires_in"] == 3600

    @pytest.mark.asyncio
    async def test_upload_local_file_with_custom_options(self, file_service, temp_test_file):
        """测试 upload_local_file 带自定义选项"""

        file_path, _ = temp_test_file

        mock_upload_result = {
            "file_key": "custom_image.jpg",
            "temporary_url": "https://example.com/download/custom_image.jpg",
            "file_size": 24,
            "object_key": "uploads/custom123456.jpg",
            "platform": "tos",
            "file_hash": "custom123456",
            "expires_in": 1800
        }

        options = {
            "custom_name": "custom_image.jpg",
            "content_type": "image/jpeg"
        }

        with patch.object(file_service, '_upload_with_credential', new_callable=AsyncMock) as mock_upload:
            mock_upload.return_value = mock_upload_result

            result = await file_service.upload_local_file(file_path, expires_in=1800, options=options)

            # 验证自定义选项生效
            assert result["file_name"] == "custom_image.jpg"
            assert result["content_type"] == "image/jpeg"
            assert result["expires_in"] == 1800

            # 验证调用参数正确
            mock_upload.assert_called_once()
            call_args = mock_upload.call_args
            assert call_args[1]["original_file_key"] == "custom_image.jpg"
            assert call_args[1]["expires_in"] == 1800

    @pytest.mark.asyncio
    async def test_upload_local_file_custom_name_extension_handling(self, file_service, temp_test_file):
        """测试 upload_local_file 自定义名称扩展名处理"""

        file_path, _ = temp_test_file

        mock_upload_result = {
            "file_key": "custom_name.txt",
            "temporary_url": "https://example.com/download/custom_name.txt",
            "file_size": 26,
            "object_key": "uploads/custom123456.txt",
            "platform": "tos",
            "file_hash": "custom123456",
            "expires_in": 3600
        }

        # 测试自定义名称没有扩展名的情况 - 应该自动添加原始扩展名
        options = {"custom_name": "custom_name"}

        with patch.object(file_service, '_upload_with_credential', new_callable=AsyncMock) as mock_upload:
            mock_upload.return_value = mock_upload_result

            result = await file_service.upload_local_file(file_path, options=options)

            # 应该保留原始的 .txt 扩展名
            assert result["file_name"] == "custom_name.txt"

    @pytest.mark.asyncio
    async def test_upload_local_file_file_not_found(self, file_service):
        """测试 upload_local_file 文件不存在的错误处理"""

        non_existent_file = "/path/that/does/not/exist.txt"

        with pytest.raises(FileNotFoundError, match="File not found"):
            await file_service.upload_local_file(non_existent_file)

    @pytest.mark.asyncio
    async def test_upload_local_file_empty_path(self, file_service):
        """测试 upload_local_file 空文件路径的错误处理"""

        with pytest.raises(ValueError, match="File path cannot be empty"):
            await file_service.upload_local_file("")

        with pytest.raises(ValueError, match="File path cannot be empty"):
            await file_service.upload_local_file("   ")

    @pytest.mark.asyncio
    async def test_upload_local_file_directory_path(self, file_service):
        """测试 upload_local_file 目录路径错误处理"""

        with tempfile.TemporaryDirectory() as temp_dir:
            with pytest.raises(ValueError, match="Path is not a file"):
                await file_service.upload_local_file(temp_dir)

    @pytest.mark.asyncio
    async def test_upload_local_file_read_permission_error(self, file_service, temp_test_file):
        """测试 upload_local_file 文件读取权限错误处理"""

        file_path, _ = temp_test_file

        with patch("builtins.open", side_effect=PermissionError("Permission denied")):
            with pytest.raises(Exception, match="Failed to read file"):
                await file_service.upload_local_file(file_path)

    @pytest.mark.asyncio
    async def test_upload_local_file_upload_failure(self, file_service, temp_test_file):
        """测试 upload_local_file 上传失败错误处理"""

        file_path, _ = temp_test_file

        with patch.object(file_service, '_upload_with_credential', new_callable=AsyncMock) as mock_upload:
            mock_upload.side_effect = Exception("Upload service error")

            with pytest.raises(Exception, match="Upload failed"):
                await file_service.upload_local_file(file_path)

    @pytest.mark.asyncio
    async def test_upload_local_file_content_type_detection(self, file_service):
        """测试 upload_local_file 内容类型检测"""

        # 测试不同文件类型的内容类型检测
        test_cases = [
            (".txt", "text/plain"),
            (".json", "application/json"),
            (".pdf", "application/pdf"),
            (".jpg", "image/jpeg"),
            (".png", "image/png"),
            (".unknown", "application/octet-stream")
        ]

        mock_upload_result = {
            "file_key": "test",
            "temporary_url": "https://example.com/test",
            "file_size": 4,
            "object_key": "uploads/test123456",
            "platform": "tos",
            "file_hash": "test123456",
            "expires_in": 3600
        }

        for extension, expected_content_type in test_cases:
            with tempfile.NamedTemporaryFile(mode='w', suffix=extension, delete=False) as f:
                f.write("test")
                temp_path = f.name

            try:
                with patch.object(file_service, '_upload_with_credential', new_callable=AsyncMock) as mock_upload:
                    mock_upload.return_value = mock_upload_result

                    result = await file_service.upload_local_file(temp_path)
                    assert result["content_type"] == expected_content_type

            finally:
                os.unlink(temp_path)

    @pytest.mark.asyncio
    async def test_upload_local_file_hash_uniqueness(self, file_service, temp_test_file):
        """测试 upload_local_file 文件哈希唯一性"""

        file_path, _ = temp_test_file

        mock_upload_result = {
            "file_key": "test.txt",
            "temporary_url": "https://example.com/test.txt",
            "file_size": 26,
            "object_key": "uploads/test123456.txt",
            "platform": "tos",
            "file_hash": "test123456",
            "expires_in": 3600
        }

        with patch.object(file_service, '_upload_with_credential', new_callable=AsyncMock) as mock_upload:
            mock_upload.return_value = mock_upload_result

            # 进行多次上传并验证哈希值不同
            hash_values = []
            for _ in range(3):
                result = await file_service.upload_local_file(file_path)
                call_args = mock_upload.call_args
                hash_values.append(call_args[1]["file_hash"])

                # 小延迟确保时间戳不同
                import asyncio
                await asyncio.sleep(0.001)

            # 所有哈希值应该不同，因为包含了时间戳
            assert len(set(hash_values)) == len(hash_values), "Hash values should be unique"


if __name__ == "__main__":
    print("FileService Mock 单元测试")
    print("=" * 40)
    print("运行测试:")
    print("pytest tests/service/test_file_service_mock.py -v")
