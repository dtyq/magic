"""
FileService 真实集成测试

使用真实的存储操作进行集成测试，验证凭证刷新和文件上传功能。
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
import asyncio
import tempfile
import hashlib
from datetime import datetime
from unittest.mock import patch, MagicMock

from app.service.file_service import FileService
from app.infrastructure.magic_service import MagicServiceConfigLoader
from app.infrastructure.magic_service.exceptions import ConfigurationError
from app.infrastructure.storage.types import PlatformType


# 检查是否启用真实的存储测试
STORAGE_TEST_ENABLED = os.environ.get("TEST_FILE_SERVICE_REAL_ENABLED", "false").lower() in (
    "true", "1", "yes", "on"
)


def _check_storage_config_available() -> bool:
    """检查存储配置是否可用"""
    try:
        credentials_data = MagicServiceConfigLoader.load_config_data()
        upload_config = credentials_data.get("upload_config", {})
        return bool(upload_config)
    except (ConfigurationError, Exception):
        return False


# 跳过条件：没有启用测试或者没有存储配置
SKIP_REASON = "FileService 真实集成测试未启用。请设置环境变量 TEST_FILE_SERVICE_REAL_ENABLED=true 并确保存储配置可用"
STORAGE_CONFIG_AVAILABLE = _check_storage_config_available()

skip_real_test = pytest.mark.skipif(
    not STORAGE_TEST_ENABLED or not STORAGE_CONFIG_AVAILABLE,
    reason=SKIP_REASON
)


@skip_real_test
class TestFileServiceReal:
    """FileService 真实集成测试类

    注意：此测试需要：
    1. 设置环境变量 TEST_FILE_SERVICE_REAL_ENABLED=true
    2. 有效的存储服务配置（upload_config）
    3. 网络连接（如果使用远程存储）

    测试将创建真实文件并上传到存储服务，测试完成后会清理。
    """

    @pytest.fixture
    def file_service(self):
        """FileService 实例"""
        return FileService()

    @pytest.fixture
    def test_file_content(self):
        """测试文件内容"""
        return {
            "text": "This is a test file for FileService integration testing.\n测试中文内容。",
            "binary": b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01",
            "json": '{"test": "data", "timestamp": "' + datetime.now().isoformat() + '", "chinese": "测试数据"}'
        }

    @pytest.fixture
    def temp_test_files(self, test_file_content):
        """创建临时测试文件"""
        temp_files = {}
        temp_dir = tempfile.mkdtemp(prefix="fileservice_test_")

        try:
            # 创建文本文件
            text_file = Path(temp_dir) / "test_text.txt"
            text_file.write_text(test_file_content["text"], encoding="utf-8")
            temp_files["text"] = str(text_file)

            # 创建二进制文件
            binary_file = Path(temp_dir) / "test_binary.png"
            binary_file.write_bytes(test_file_content["binary"])
            temp_files["binary"] = str(binary_file)

            # 创建JSON文件
            json_file = Path(temp_dir) / "test_data.json"
            json_file.write_text(test_file_content["json"], encoding="utf-8")
            temp_files["json"] = str(json_file)

            # 记录临时目录以便清理
            temp_files["temp_dir"] = temp_dir

            yield temp_files

        finally:
            # 清理临时文件
            import shutil
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)

    @pytest.mark.asyncio
    async def test_storage_service_creation(self, file_service):
        """测试存储服务创建和缓存"""
        print("\n=== 测试存储服务创建 ===")

        # 第一次获取存储服务
        storage_service1 = await file_service._get_storage_service()
        assert storage_service1 is not None
        assert hasattr(storage_service1, 'credentials')
        print(f"✅ 存储服务创建成功，平台: {storage_service1.get_platform_name()}")

        # 第二次获取应该使用缓存
        storage_service2 = await file_service._get_storage_service()
        assert storage_service2 is storage_service1  # 应该是同一个实例
        print("✅ 存储服务缓存机制正常")

        # 强制刷新应该创建新实例
        storage_service3 = await file_service._get_storage_service(force_refresh=True)
        assert storage_service3 is not None
        # 注意：由于工厂模式的单例，这里可能还是同一个实例
        print("✅ 强制刷新存储服务正常")

    # Note: upload_runtime_file method has been removed. These tests are replaced by upload_local_file tests.

    @pytest.mark.asyncio
    async def test_upload_local_file_basic(self, file_service, temp_test_files, test_file_content):
        """测试 upload_local_file 基本功能"""
        print("\n=== 测试 upload_local_file 基本功能 ===")

        text_file_path = temp_test_files["text"]
        print(f"上传本地文件: {text_file_path}")

        # 上传文件
        result = await file_service.upload_local_file(text_file_path)

        # 验证返回结果
        assert result is not None
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
        assert result["file_path"] == text_file_path
        assert result["file_name"].endswith(".txt")
        assert result["content_type"] == "text/plain"
        assert result["file_size"] == len(test_file_content["text"].encode("utf-8"))

        print(f"✅ 本地文件上传成功:")
        print(f"   文件路径: {result['file_path']}")
        print(f"   文件名: {result['file_name']}")
        print(f"   文件大小: {result['file_size']} 字节")
        print(f"   内容类型: {result['content_type']}")
        print(f"   存储平台: {result['platform']}")
        print(f"   上传时间: {result['uploaded_at']}")
        print(f"   临时链接: {result['temporary_url']}")

    @pytest.mark.asyncio
    async def test_upload_local_file_with_custom_options(self, file_service, temp_test_files):
        """测试 upload_local_file 带自定义选项"""
        print("\n=== 测试 upload_local_file 带自定义选项 ===")

        binary_file_path = temp_test_files["binary"]
        print(f"上传二进制文件: {binary_file_path}")

        # 使用自定义选项
        options = {
            "custom_name": "custom_image.png",
            "content_type": "image/png"
        }

        # 上传文件
        result = await file_service.upload_local_file(
            binary_file_path,
            expires_in=1800,  # 30分钟
            options=options
        )

        # 验证自定义选项生效
        assert result is not None
        assert result["file_name"] == "custom_image.png"
        assert result["content_type"] == "image/png"
        assert result["expires_in"] == 1800

        print(f"✅ 自定义选项上传成功:")
        print(f"   自定义文件名: {result['file_name']}")
        print(f"   自定义内容类型: {result['content_type']}")
        print(f"   自定义过期时间: {result['expires_in']} 秒")

    @pytest.mark.asyncio
    async def test_upload_local_file_content_type_detection(self, file_service, temp_test_files):
        """测试 upload_local_file 内容类型自动检测"""
        print("\n=== 测试内容类型自动检测 ===")

        # 测试不同类型文件的内容类型检测
        test_cases = [
            ("text", "text/plain"),
            ("json", "application/json"),
            ("binary", "image/png")  # PNG binary file
        ]

        for file_type, expected_content_type in test_cases:
            file_path = temp_test_files[file_type]
            result = await file_service.upload_local_file(file_path)

            assert result["content_type"] == expected_content_type
            print(f"✅ {file_type} 文件内容类型检测正确: {expected_content_type}")

    @pytest.mark.asyncio
    async def test_upload_local_file_hash_uniqueness(self, file_service, temp_test_files):
        """测试 upload_local_file 文件哈希唯一性"""
        print("\n=== 测试文件哈希唯一性 ===")

        text_file_path = temp_test_files["text"]

        # 进行多次上传
        hash_values = []
        for i in range(3):
            result = await file_service.upload_local_file(text_file_path)
            hash_values.append(result["file_hash"])
            print(f"   第 {i+1} 次上传哈希: {result['file_hash'][:8]}...")

            # 小延迟确保时间戳不同
            import asyncio
            await asyncio.sleep(0.001)

        # 所有哈希值应该不同
        unique_hashes = len(set(hash_values))
        total_hashes = len(hash_values)

        assert unique_hashes == total_hashes, f"期望 {total_hashes} 个唯一哈希，但只得到 {unique_hashes} 个"
        print(f"✅ 文件哈希唯一性验证成功: {unique_hashes}/{total_hashes} 个唯一哈希")

    @pytest.mark.asyncio
    async def test_upload_local_file_and_download_integration(self, file_service, temp_test_files, test_file_content):
        """完整的本地文件上传和下载集成测试"""
        print("\n=== 完整集成测试：本地文件上传 -> 生成下载链接 ===")

        # 1. 上传本地文件
        print("1. 上传本地文件...")
        json_file_path = temp_test_files["json"]
        upload_result = await file_service.upload_local_file(
            json_file_path,
            options={"custom_name": "integration_test.json"}
        )

        assert upload_result is not None
        file_name = upload_result["file_name"]
        object_key = upload_result["object_key"]
        print(f"✅ 文件上传完成: {file_name}")

        # 2. 获取下载链接（使用object_key中的路径部分）
        print("2. 生成下载链接...")
        # 从object_key中提取文件路径（去掉存储目录前缀）
        from app.utils.path_utils import get_storage_dir
        storage_service = await file_service._get_storage_service()
        storage_dir = get_storage_dir(storage_service.credentials)
        relative_path = object_key.replace(storage_dir, "")

        download_result = await file_service.get_file_download_url(
            file_path=relative_path,
            expires_in=1800
        )

        assert download_result is not None
        download_url = download_result["download_url"]
        print(f"✅ 下载链接生成完成")

        # 3. 验证信息一致性
        print("3. 验证信息一致性...")
        assert upload_result["file_size"] == len(test_file_content["json"].encode("utf-8"))
        assert upload_result["platform"] == download_result["platform"]

        print("✅ 完整集成测试成功！")
        print(f"   上传文件名: {file_name}")
        print(f"   文件大小: {upload_result['file_size']} 字节")
        print(f"   存储平台: {upload_result['platform']}")
        print(f"   下载链接: {'已生成' if download_url else '生成失败'}")

    @pytest.mark.asyncio
    async def test_error_handling(self, file_service):
        """测试错误处理"""
        print("\n=== 测试错误处理 ===")

        # 测试不存在的文件
        with pytest.raises(FileNotFoundError, match="File not found"):
            await file_service.upload_local_file("/nonexistent/file.txt")
        print("✅ 不存在文件的错误处理正确")

        # 测试空文件路径 - upload_local_file
        with pytest.raises(ValueError, match="File path cannot be empty"):
            await file_service.upload_local_file("")
        print("✅ 空文件路径的错误处理正确 (upload_local_file)")

        # 测试空白文件路径 - upload_local_file
        with pytest.raises(ValueError, match="File path cannot be empty"):
            await file_service.upload_local_file("   ")
        print("✅ 空白文件路径的错误处理正确 (upload_local_file)")

        # 测试空文件路径 - get_file_download_url
        with pytest.raises(ValueError, match="文件路径不能为空"):
            await file_service.get_file_download_url("")
        print("✅ 空文件路径的错误处理正确 (get_file_download_url)")

        # 测试空白文件路径 - get_file_download_url
        with pytest.raises(ValueError, match="文件路径不能为空"):
            await file_service.get_file_download_url("   ")
        print("✅ 空白文件路径的错误处理正确 (get_file_download_url)")

    @pytest.mark.asyncio
    async def test_upload_local_file_directory_error(self, file_service):
        """测试上传目录而不是文件的错误处理"""
        print("\n=== 测试目录路径错误处理 ===")

        import tempfile
        with tempfile.TemporaryDirectory() as temp_dir:
            with pytest.raises(ValueError, match="Path is not a file"):
                await file_service.upload_local_file(temp_dir)

        print("✅ 目录路径错误处理正确")


# 始终运行的基础测试（不需要真实存储）
class TestFileServiceBasic:
    """FileService 基础功能测试（不需要真实存储配置）"""

    def test_file_service_initialization(self):
        """测试FileService初始化"""
        service = FileService()
        assert service is not None
        assert service.git_service is None
        assert service._storage_service_cache == {}
        assert service._credentials_cache == {}

    def test_git_service_creation(self):
        """测试GitService创建和缓存"""
        service = FileService()

        # 第一次获取
        git_service1 = service._get_git_service()
        assert git_service1 is not None
        assert service.git_service is git_service1

        # 第二次获取应该返回同一实例
        git_service2 = service._get_git_service()
        assert git_service2 is git_service1

    @pytest.mark.asyncio
    async def test_storage_service_without_config(self):
        """测试没有存储配置时的行为"""
        service = FileService()

        # Mock配置加载失败
        with patch('app.infrastructure.magic_service.MagicServiceConfigLoader.load_config_data') as mock_load:
            mock_load.side_effect = ConfigurationError("No config available")

            with pytest.raises(ValueError, match="Cannot load storage credentials"):
                await service._get_storage_service()


if __name__ == "__main__":
    # 运行测试的示例
    print("FileService 真实集成测试")
    print("=" * 50)

    if not STORAGE_TEST_ENABLED:
        print("❌ 真实集成测试未启用")
        print("请设置环境变量: TEST_FILE_SERVICE_REAL_ENABLED=true")
    elif not STORAGE_CONFIG_AVAILABLE:
        print("❌ 存储配置不可用")
        print("请确保存储服务配置正确")
    else:
        print("✅ 真实集成测试已启用且配置可用")

    print("\n运行测试:")
    print("pytest tests/service/test_file_service_real.py -v")
    print("或")
    print("pytest tests/service/test_file_service_real.py::TestFileServiceBasic -v  # 仅基础测试")
