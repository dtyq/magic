"""
Pytest tests for file API functionality
"""
import pytest
from unittest.mock import Mock, patch
from app.service.file_service import FileService
from app.api.routes.file import FileVersionRequest


class TestFileVersionRequest:
    """Test cases for FileVersionRequest model"""

    def test_file_version_request_creation(self):
        """Test FileVersionRequest can be created"""
        request = FileVersionRequest(file_key="test.py")
        assert request.file_key == "test.py"
        assert request.git_directory is None

    def test_file_version_request_with_git_directory(self):
        """Test FileVersionRequest with git_directory"""
        request = FileVersionRequest(file_key="test.py", git_directory=".workspace")
        assert request.file_key == "test.py"
        assert request.git_directory == ".workspace"

    def test_file_version_request_default(self):
        """Test FileVersionRequest with default values"""
        request = FileVersionRequest()
        assert request.file_key is None
        assert request.git_directory is None


class TestFileService:
    """Test cases for FileService"""

    def test_file_service_initialization(self):
        """Test FileService can be initialized"""
        service = FileService()
        assert service is not None
        assert service.git_service is None

    def test_get_file_version_history_empty_file_key(self):
        """Test get_file_version_history with empty file_key"""
        service = FileService()

        with pytest.raises(ValueError, match="File key cannot be empty"):
            service.get_file_version_history("")

        with pytest.raises(ValueError, match="File key cannot be empty"):
            service.get_file_version_history("   ")

    @patch('app.service.file_service.subprocess.run')
    def test_get_file_version_history_success(self, mock_run):
        """Test successful file version history retrieval"""
        # Mock git log output
        mock_output = """
commit abc123def456
Author: Test User <test@example.com>
Date:   Mon Jan 15 10:30:00 2024 +0800

    Update test file

    This is a test commit message

 app/main.py | 5 +++++
 1 file changed, 5 insertions(+)
"""
        mock_run.return_value.stdout = mock_output
        mock_run.return_value.returncode = 0
        mock_run.return_value.stderr = ""

        service = FileService()

        # Mock the git service
        mock_git_service = Mock()
        mock_git_service._get_project_root.return_value = "/test/project"
        service.git_service = mock_git_service

        result = service.get_file_version_history("app/main.py")

        assert result["file_key"] == "app/main.py"
        assert result["git_directory"] is None
        assert result["version_count"] == 1
        assert len(result["versions"]) == 1

        version = result["versions"][0]
        assert version["commit_hash"] == "abc123def456"  # Should remove "commit " prefix
        assert version["author"] == "Test User <test@example.com>"
        assert version["date"] == "2024-01-15 10:30:00"  # Should be formatted
        assert "Update test file" in version["message"]
        assert "app/main.py" in version["stats"]["file"]

    @patch('app.service.file_service.subprocess.run')
    def test_get_file_version_history_with_git_directory(self, mock_run):
        """Test file version history retrieval with specific git directory"""
        # Mock git log output
        mock_output = """
commit def456ghi789
Author: Test User <test@example.com>
Date:   Mon Jan 15 11:30:00 2024 +0800

    Update workspace file

 app/workspace.py | 3 +++
 1 file changed, 3 insertions(+)
"""
        mock_run.return_value.stdout = mock_output
        mock_run.return_value.returncode = 0
        mock_run.return_value.stderr = ""

        service = FileService()

        # Mock the git service
        mock_git_service = Mock()
        mock_git_service._get_project_root.return_value = "/test/project"
        service.git_service = mock_git_service

        # Mock Path.exists to return True for .workspace directory
        with patch('pathlib.Path.exists', return_value=True):
            result = service.get_file_version_history("app/workspace.py", ".workspace")

        assert result["file_key"] == "app/workspace.py"
        assert result["git_directory"] == ".workspace"
        assert result["version_count"] == 1
        assert len(result["versions"]) == 1

        version = result["versions"][0]
        assert version["commit_hash"] == "def456ghi789"  # Should remove "commit " prefix
        assert version["date"] == "2024-01-15 11:30:00"  # Should be formatted
        assert "Update workspace file" in version["message"]

    @patch('app.service.file_service.subprocess.run')
    def test_get_file_version_history_git_directory_not_found(self, mock_run):
        """Test file version history with non-existent git directory"""
        service = FileService()

        # Mock the git service
        mock_git_service = Mock()
        mock_git_service._get_project_root.return_value = "/test/project"
        service.git_service = mock_git_service

        # Mock Path.exists to return False for non-existent directory
        with patch('pathlib.Path.exists', return_value=False):
            with pytest.raises(FileNotFoundError, match="Git directory .nonexistent does not exist"):
                service.get_file_version_history("app/main.py", ".nonexistent")

    @patch('app.service.file_service.subprocess.run')
    def test_get_file_version_history_file_not_found(self, mock_run):
        """Test file not found scenario"""
        mock_run.return_value.returncode = 1
        mock_run.return_value.stderr = "fatal: bad revision 'nonexistent.py'"

        service = FileService()

        # Mock the git service
        mock_git_service = Mock()
        mock_git_service._get_project_root.return_value = "/test/project"
        service.git_service = mock_git_service

        with pytest.raises(FileNotFoundError, match="File nonexistent.py not found in git repository"):
            service.get_file_version_history("nonexistent.py")

    @patch('app.service.file_service.subprocess.run')
    def test_get_file_version_history_timeout(self, mock_run):
        """Test git command timeout"""
        from subprocess import TimeoutExpired
        mock_run.side_effect = TimeoutExpired(['git', 'log'], 30)

        service = FileService()

        # Mock the git service
        mock_git_service = Mock()
        mock_git_service._get_project_root.return_value = "/test/project"
        service.git_service = mock_git_service

        with pytest.raises(Exception, match="Git log command timed out"):
            service.get_file_version_history("app/main.py")

    def test_parse_commit_block_valid(self):
        """Test parsing a valid commit block"""
        service = FileService()

        commit_block = """abc123def456
Author: Test User <test@example.com>
Date:   Mon Jan 15 10:30:00 2024 +0800

    Update test file

    This is a test commit message

 app/main.py | 5 +++++
 1 file changed, 5 insertions(+)"""

        result = service._parse_commit_block(commit_block)

        assert result is not None
        assert result["commit_hash"] == "abc123def456"
        assert result["author"] == "Test User <test@example.com>"
        assert result["date"] == "2024-01-15 10:30:00"
        assert "Update test file" in result["message"]
        assert "app/main.py" in result["stats"]["file"]

    def test_parse_commit_block_with_commit_prefix(self):
        """Test parsing commit block with 'commit ' prefix"""
        service = FileService()

        commit_block = """commit abc123def456
Author: Test User <test@example.com>
Date:   Mon Jan 15 10:30:00 2024 +0800

    Update test file"""

        result = service._parse_commit_block(commit_block)

        assert result is not None
        assert result["commit_hash"] == "abc123def456"  # Should remove "commit " prefix
        assert result["author"] == "Test User <test@example.com>"
        assert result["date"] == "2024-01-15 10:30:00"

    def test_parse_commit_block_date_formatting(self):
        """Test date formatting in commit block"""
        service = FileService()

        commit_block = """abc123def456
Author: Test User <test@example.com>
Date:   Tue Jun 17 20:23:36 2025 +0800

    Update test file"""

        result = service._parse_commit_block(commit_block)

        assert result is not None
        assert result["commit_hash"] == "abc123def456"
        assert result["date"] == "2025-06-17 20:23:36"  # Should be formatted as yyyy-mm-dd H:i:s

    def test_parse_commit_block_invalid(self):
        """Test parsing an invalid commit block"""
        service = FileService()

        # Empty block
        result = service._parse_commit_block("")
        assert result is None

        # Block without commit hash
        result = service._parse_commit_block("Author: Test User")
        assert result is None

    def test_parse_git_log_output_empty(self):
        """Test parsing empty git log output"""
        service = FileService()

        result = service._parse_git_log_output("", "test.py")
        assert result == []

        result = service._parse_git_log_output("   ", "test.py")
        assert result == []

    def test_parse_git_log_output_multiple_commits(self):
        """Test parsing multiple commits"""
        service = FileService()

        git_log_output = """commit abc123
Author: User1 <user1@example.com>
Date:   Mon Jan 15 10:30:00 2024 +0800

    First commit

commit def456
Author: User2 <user2@example.com>
Date:   Mon Jan 15 11:30:00 2024 +0800

    Second commit"""

        result = service._parse_git_log_output(git_log_output, "test.py")

        assert len(result) == 2
        assert result[0]["commit_hash"] == "abc123"
        assert result[1]["commit_hash"] == "def456"
