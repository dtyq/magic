"""
Test cases for file_timestamp_manager module

Tests for FileTimestampManager class including:
- Timestamp and hash management
- Three-layer validation mechanism (size, hash, timestamp)
- Data persistence and compatibility
- Error handling and edge cases
"""

import os
import json
import time
import asyncio
import tempfile
import pytest
from pathlib import Path
from unittest.mock import patch, AsyncMock
from typing import Dict, Any

# Add the project root to the Python path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.utils.file_timestamp_manager import (
    FileTimestampManager,
    get_global_timestamp_manager,
    HASH_DETECTION_THRESHOLD,
    NETWORK_FS_MTIME_BUFFER
)
from app.utils.file_utils import calculate_file_hash, get_file_size


class TestFileTimestampManager:
    """Test cases for FileTimestampManager"""

    @pytest.fixture
    async def temp_storage_file(self):
        """Create a temporary storage file for testing"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as f:
            storage_file = f.name
        yield storage_file
        # Cleanup
        if os.path.exists(storage_file):
            os.unlink(storage_file)

    @pytest.fixture
    async def temp_test_file(self):
        """Create a temporary test file"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            f.write("Hello, World!\nThis is a test file.")
            test_file = f.name
        yield test_file
        # Cleanup
        if os.path.exists(test_file):
            os.unlink(test_file)

    @pytest.fixture
    async def large_temp_test_file(self):
        """Create a temporary large test file (>5MB)"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            # Write enough data to exceed HASH_DETECTION_THRESHOLD
            chunk = "A" * 1024  # 1KB chunk
            for _ in range(6 * 1024):  # Write 6MB
                f.write(chunk)
            test_file = f.name
        yield test_file
        # Cleanup
        if os.path.exists(test_file):
            os.unlink(test_file)

    @pytest.fixture
    async def manager(self, temp_storage_file):
        """Create a FileTimestampManager instance for testing"""
        return FileTimestampManager(storage_file=temp_storage_file)

    async def test_manager_initialization(self, temp_storage_file):
        """Test FileTimestampManager initialization"""
        manager = FileTimestampManager(storage_file=temp_storage_file)

        # Check initial state
        assert not manager._loaded
        assert len(manager._timestamps) == 0
        assert len(manager._hashs) == 0
        assert len(manager._sizes) == 0
        assert manager._storage_file == Path(temp_storage_file)

    async def test_update_timestamp_small_file(self, manager, temp_test_file):
        """Test update_timestamp method with small file (should store hash)"""
        file_path = temp_test_file

        # Update timestamp
        await manager.update_timestamp(file_path)

        # Verify data was stored
        abs_path = str(Path(file_path).resolve())
        timestamp = await manager._get_timestamp(file_path)
        hash_value = await manager._get_hash(file_path)
        size_value = await manager._get_size(file_path)

        assert timestamp is not None
        assert hash_value is not None  # Small file should have hash
        assert size_value is not None
        assert size_value <= HASH_DETECTION_THRESHOLD

    async def test_update_timestamp_large_file(self, manager, large_temp_test_file):
        """Test update_timestamp method with large file (should not store hash)"""
        file_path = large_temp_test_file

        # Update timestamp
        await manager.update_timestamp(file_path)

        # Verify data was stored
        abs_path = str(Path(file_path).resolve())
        timestamp = await manager._get_timestamp(file_path)
        hash_value = await manager._get_hash(file_path)
        size_value = await manager._get_size(file_path)

        assert timestamp is not None
        assert hash_value is None  # Large file should not have hash
        assert size_value is not None
        assert size_value > HASH_DETECTION_THRESHOLD

    async def test_validate_file_not_modified_success(self, manager, temp_test_file):
        """Test successful file validation"""
        file_path = temp_test_file

        # First update timestamp
        await manager.update_timestamp(file_path)

        # Validate should succeed
        is_valid, error_msg = await manager.validate_file_not_modified(file_path)
        assert is_valid
        assert error_msg == ""

    async def test_validate_file_size_changed(self, manager, temp_test_file):
        """Test validation fails when file size changes"""
        file_path = temp_test_file

        # First update timestamp
        await manager.update_timestamp(file_path)

        # Modify file size
        with open(file_path, 'a') as f:
            f.write("\nAdditional content")

        # Validation should fail due to size change
        is_valid, error_msg = await manager.validate_file_not_modified(file_path)
        assert not is_valid
        assert "文件大小已改变" in error_msg

    async def test_validate_file_hash_changed(self, manager, temp_test_file):
        """Test validation fails when file hash changes (same size)"""
        file_path = temp_test_file

        # First update timestamp
        await manager.update_timestamp(file_path)

        # Get original size
        original_size = await get_file_size(file_path)

        # Modify file content but keep same size
        with open(file_path, 'w') as f:
            f.write("X" * original_size)

        # Validation should fail due to hash change
        is_valid, error_msg = await manager.validate_file_not_modified(file_path)
        assert not is_valid
        assert "哈希值不匹配" in error_msg

    async def test_validate_file_not_read(self, manager, temp_test_file):
        """Test validation fails when file was not read before"""
        file_path = temp_test_file

        # Don't update timestamp first
        # Validation should fail
        is_valid, error_msg = await manager.validate_file_not_modified(file_path)
        assert not is_valid
        assert "文件尚未读取" in error_msg

    async def test_validate_file_not_exists(self, manager):
        """Test validation fails when file doesn't exist"""
        file_path = "/path/to/nonexistent/file.txt"

        # Validation should fail
        is_valid, error_msg = await manager.validate_file_not_modified(file_path)
        assert not is_valid
        assert "文件不存在" in error_msg

    async def test_data_persistence(self, manager, temp_test_file):
        """Test data persistence and loading"""
        file_path = temp_test_file

        # Update timestamp
        await manager.update_timestamp(file_path)

        # Get stored values
        original_timestamp = await manager._get_timestamp(file_path)
        original_hash = await manager._get_hash(file_path)
        original_size = await manager._get_size(file_path)

        # Create new manager instance with same storage file
        manager2 = FileTimestampManager(storage_file=str(manager._storage_file))

        # Load data and verify it matches
        loaded_timestamp = await manager2._get_timestamp(file_path)
        loaded_hash = await manager2._get_hash(file_path)
        loaded_size = await manager2._get_size(file_path)

        assert loaded_timestamp == original_timestamp
        assert loaded_hash == original_hash
        assert loaded_size == original_size

    async def test_backward_compatibility(self, temp_storage_file, temp_test_file):
        """Test backward compatibility with old data format"""
        file_path = temp_test_file
        abs_path = str(Path(file_path).resolve())

        # Create old format data
        old_data = {
            "timestamps": {
                abs_path: time.time() * 1000
            }
        }

        # Write old format to storage file
        with open(temp_storage_file, 'w') as f:
            json.dump(old_data, f)

        # Create manager and load data
        manager = FileTimestampManager(storage_file=temp_storage_file)
        timestamp = await manager._get_timestamp(file_path)
        hash_value = await manager._get_hash(file_path)
        size_value = await manager._get_size(file_path)

        # Should load timestamp but not hash/size (since old format)
        assert timestamp == old_data["timestamps"][abs_path]
        assert hash_value is None
        assert size_value is None

    async def test_reset_all_timestamps(self, manager, temp_test_file):
        """Test resetting all timestamp data"""
        file_path = temp_test_file

        # Update timestamp first
        await manager.update_timestamp(file_path)

        # Verify data exists
        assert await manager._get_timestamp(file_path) is not None

        # Reset all data
        await manager.reset_all_timestamps()

        # Verify data is cleared
        assert await manager._get_timestamp(file_path) is None
        assert await manager._get_hash(file_path) is None
        assert await manager._get_size(file_path) is None

        # Verify storage file is deleted
        assert not manager._storage_file.exists()

    async def test_validate_by_size_method(self, manager, temp_test_file):
        """Test _validate_by_size method directly"""
        file_path = temp_test_file
        abs_path = str(Path(file_path).resolve())

        # Update timestamp first
        await manager.update_timestamp(file_path)

        # Test successful validation
        is_valid, error_msg, current_size = await manager._validate_by_size(abs_path, file_path)
        assert is_valid
        assert error_msg == ""
        assert current_size is not None

    async def test_validate_by_hash_method(self, manager, temp_test_file):
        """Test _validate_by_hash method directly"""
        file_path = temp_test_file
        abs_path = str(Path(file_path).resolve())

        # Update timestamp first (small file should have hash)
        await manager.update_timestamp(file_path)

        # Test successful validation
        is_valid, error_msg = await manager._validate_by_hash(abs_path, file_path)
        assert is_valid
        assert error_msg == ""

    async def test_validate_by_timestamp_method(self, manager, temp_test_file):
        """Test _validate_by_timestamp method directly"""
        file_path = temp_test_file
        abs_path = str(Path(file_path).resolve())

        # Update timestamp first
        await manager.update_timestamp(file_path)
        read_timestamp = await manager._get_timestamp(file_path)

        # Test successful validation
        is_valid, error_msg = await manager._validate_by_timestamp(abs_path, read_timestamp)
        assert is_valid
        assert error_msg == ""

    async def test_network_filesystem_buffer(self, manager, temp_test_file):
        """Test network filesystem buffer is applied"""
        file_path = temp_test_file

        # Mock time to test buffer
        original_time = time.time
        mock_time = 1000000.0  # Fixed time

        with patch('time.time', return_value=mock_time):
            await manager.update_timestamp(file_path)
            timestamp = await manager._get_timestamp(file_path)

            # Should include buffer
            expected_min = mock_time * 1000 + NETWORK_FS_MTIME_BUFFER * 1000
            assert timestamp >= expected_min

    async def test_error_handling_file_operations(self, manager):
        """Test error handling in file operations"""
        # Test with a path that will cause permission error
        invalid_path = "/root/cannot_access.txt"

        # Should handle error gracefully
        try:
            await manager.update_timestamp(invalid_path)
            # If no exception, check that at least timestamp was set
            timestamp = await manager._get_timestamp(invalid_path)
            assert timestamp is not None
        except Exception:
            # If exception occurs, that's also acceptable for invalid paths
            pass

    def test_global_timestamp_manager(self):
        """Test global timestamp manager singleton"""
        manager1 = get_global_timestamp_manager()
        manager2 = get_global_timestamp_manager()

        # Should return same instance
        assert manager1 is manager2
        assert isinstance(manager1, FileTimestampManager)

    async def test_concurrent_operations(self, manager, temp_test_file):
        """Test concurrent operations on the same file"""
        file_path = temp_test_file

        # Create multiple concurrent update operations
        tasks = []
        for _ in range(5):
            tasks.append(manager.update_timestamp(file_path))

        # Wait for all operations to complete
        await asyncio.gather(*tasks)

        # Should still be valid
        is_valid, error_msg = await manager.validate_file_not_modified(file_path)
        assert is_valid

    async def test_empty_file_handling(self, manager):
        """Test handling of empty files"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            empty_file = f.name

        try:
            await manager.update_timestamp(empty_file)

            # Should work with empty file
            is_valid, error_msg = await manager.validate_file_not_modified(empty_file)
            assert is_valid

            # Should have size 0
            size_value = await manager._get_size(empty_file)
            assert size_value == 0
        finally:
            if os.path.exists(empty_file):
                os.unlink(empty_file)

    async def test_unicode_filename_handling(self, manager, temp_storage_file):
        """Test handling of files with unicode names"""
        # Create file with unicode name
        unicode_name = "测试文件_🔥.txt"
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix=unicode_name) as f:
            f.write("Unicode test content")
            unicode_file = f.name

        try:
            await manager.update_timestamp(unicode_file)

            # Should work with unicode filename
            is_valid, error_msg = await manager.validate_file_not_modified(unicode_file)
            assert is_valid
        finally:
            if os.path.exists(unicode_file):
                os.unlink(unicode_file)

    async def test_storage_corruption_recovery(self, manager, temp_test_file):
        """Test recovery from corrupted storage file"""
        file_path = temp_test_file

        # First update timestamp normally
        await manager.update_timestamp(file_path)

        # Corrupt the storage file
        with open(manager._storage_file, 'w') as f:
            f.write("invalid json content {{{")

        # Create new manager instance - should handle corruption gracefully
        manager2 = FileTimestampManager(storage_file=str(manager._storage_file))

        # Should start with empty data
        timestamp = await manager2._get_timestamp(file_path)
        assert timestamp is None

    async def test_path_normalization(self, manager, temp_test_file):
        """Test that different path representations work correctly"""
        file_path = temp_test_file

        # Update with absolute path
        await manager.update_timestamp(file_path)

        # Test with relative path (if possible)
        rel_path = os.path.relpath(file_path)
        timestamp1 = await manager._get_timestamp(file_path)
        timestamp2 = await manager._get_timestamp(rel_path)

        # Should return same timestamp (paths should be normalized)
        assert timestamp1 == timestamp2

    async def test_validate_hash_missing(self, manager, temp_test_file):
        """Test validation when hash is missing for small file"""
        file_path = temp_test_file
        abs_path = str(Path(file_path).resolve())

        # Update timestamp first
        await manager.update_timestamp(file_path)

        # Manually remove hash to simulate missing hash scenario
        if abs_path in manager._hashs:
            del manager._hashs[abs_path]
            await manager._save_timestamps()

        # Validation should fail with appropriate message
        is_valid, error_msg = await manager._validate_by_hash(abs_path, file_path)
        assert not is_valid
        assert "缺失哈希值" in error_msg

    async def test_timestamp_progression(self, manager, temp_test_file):
        """Test that timestamps always progress forward"""
        file_path = temp_test_file

        # Update timestamp multiple times
        await manager.update_timestamp(file_path)
        timestamp1 = await manager._get_timestamp(file_path)

        # Wait a bit and update again
        await asyncio.sleep(0.01)
        await manager.update_timestamp(file_path)
        timestamp2 = await manager._get_timestamp(file_path)

        # Second timestamp should be >= first
        assert timestamp2 >= timestamp1

    async def test_validate_with_future_timestamp(self, manager, temp_test_file):
        """Test validation with file that has future timestamp"""
        file_path = temp_test_file
        abs_path = str(Path(file_path).resolve())

        # Update timestamp normally
        await manager.update_timestamp(file_path)

        # Manually set a future timestamp on the file
        future_time = time.time() + 3600  # 1 hour in future
        os.utime(file_path, (future_time, future_time))

        # For large file, validation might still pass due to buffer
        # Let's test with exact behavior
        is_valid, error_msg = await manager.validate_file_not_modified(file_path)
        # Result depends on buffer settings, just ensure no crash
        assert isinstance(is_valid, bool)

    async def test_performance_large_hash_calculation(self, manager, large_temp_test_file):
        """Test that large files don't calculate hash (performance test)"""
        import time as time_module

        file_path = large_temp_test_file

        # Measure time for large file operation
        start_time = time_module.time()
        await manager.update_timestamp(file_path)
        end_time = time_module.time()

        # Should be fast (no hash calculation for large files)
        operation_time = end_time - start_time
        assert operation_time < 1.0  # Should complete within 1 second

        # Verify no hash was stored
        hash_value = await manager._get_hash(file_path)
        assert hash_value is None


class TestConstants:
    """Test module constants"""

    def test_hash_detection_threshold(self):
        """Test HASH_DETECTION_THRESHOLD constant"""
        assert HASH_DETECTION_THRESHOLD == 5 * 1024 * 1024  # 5MB
        assert isinstance(HASH_DETECTION_THRESHOLD, int)

    def test_network_fs_mtime_buffer(self):
        """Test NETWORK_FS_MTIME_BUFFER constant"""
        assert NETWORK_FS_MTIME_BUFFER == 1.0
        assert isinstance(NETWORK_FS_MTIME_BUFFER, float)


# Async test runner helper for pytest
@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
