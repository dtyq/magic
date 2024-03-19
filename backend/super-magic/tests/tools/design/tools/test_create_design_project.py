"""Tests for create_design_project tool

This module contains unit tests for the CreateDesignProject tool.
"""

import json
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, Mock, patch

from agentlang.context.tool_context import ToolContext
from app.tools.design.tools.create_design_project import (
    CreateDesignProject,
    CreateDesignProjectParams,
)

# Mark all tests in this module as async
pytestmark = pytest.mark.asyncio


class TestCreateDesignProject:
    """Test cases for CreateDesignProject tool"""

    @pytest.fixture
    def tool(self, tmp_path):
        """Create a CreateDesignProject tool instance with temp workspace"""
        tool = CreateDesignProject()
        tool.base_dir = tmp_path
        return tool

    @pytest.fixture
    def tool_context(self):
        """Create a mock tool context"""
        context = MagicMock(spec=ToolContext)

        # Mock agent_context with AsyncMock dispatch_event
        mock_agent_context = MagicMock()
        mock_agent_context.dispatch_event = AsyncMock()
        context.get_extension_typed = Mock(return_value=mock_agent_context)

        return context

    async def test_create_project_basic(self, tool, tool_context, tmp_path):
        """Test basic project creation"""
        params = CreateDesignProjectParams(
            project_path="test-design"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "Project structure:" in result.content

        # Verify project structure
        project_path = tmp_path / "test-design"
        assert project_path.exists()
        assert (project_path / "magic.project.js").exists()
        assert (project_path / "images").exists()

        # Verify magic.project.js content
        config_content = (project_path / "magic.project.js").read_text(encoding='utf-8')
        assert "window.magicProjectConfig" in config_content
        assert '"type": "design"' in config_content
        assert '"name": "test-design"' in config_content

    async def test_create_project_name_extraction(self, tool, tool_context, tmp_path):
        """Test project name is extracted from path"""
        params = CreateDesignProjectParams(
            project_path="nested/folder/my-design"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok

        # Verify name is extracted from path (should be 'my-design')
        project_path = tmp_path / "nested" / "folder" / "my-design"
        config_content = (project_path / "magic.project.js").read_text(encoding='utf-8')
        assert '"name": "my-design"' in config_content

    async def test_create_project_empty_canvas(self, tool, tool_context, tmp_path):
        """Test that created project has empty canvas"""
        params = CreateDesignProjectParams(
            project_path="test-design"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "Project structure:" in result.content

        # Verify magic.project.js was created from template
        project_path = tmp_path / "test-design"
        config_path = project_path / "magic.project.js"
        assert config_path.exists()

        config_content = config_path.read_text(encoding='utf-8')

        # Extract JSON from JSONP format
        config_json_start = config_content.find('{')
        config_json_end = config_content.rfind('}') + 1
        config_json = config_content[config_json_start:config_json_end]
        config_data = json.loads(config_json)

        assert len(config_data["canvas"]["elements"]) == 0
        assert config_data["canvas"]["elements"] == []

    async def test_create_project_already_exists(self, tool, tool_context, tmp_path):
        """Test creating project when folder already exists"""
        # Create project folder first
        project_path = tmp_path / "test-design"
        project_path.mkdir()

        params = CreateDesignProjectParams(
            project_path="test-design"
        )

        result = await tool.execute(tool_context, params)

        # Should succeed and use existing folder
        assert result.ok
        assert (project_path / "magic.project.js").exists()

    async def test_verify_config_structure(self, tool, tool_context, tmp_path):
        """Test that generated config has correct structure"""
        params = CreateDesignProjectParams(
            project_path="test-design"
        )

        result = await tool.execute(tool_context, params)
        assert result.ok

        # Read and parse config
        project_path = tmp_path / "test-design"
        config_content = (project_path / "magic.project.js").read_text(encoding='utf-8')

        # Extract JSON from JSONP format
        config_json_start = config_content.find('{')
        config_json_end = config_content.rfind('}') + 1
        config_json = config_content[config_json_start:config_json_end]
        config_data = json.loads(config_json)

        # Verify structure
        assert config_data["version"] == "1.0.0"
        assert config_data["type"] == "design"
        assert "name" in config_data
        assert "canvas" in config_data
        assert "elements" in config_data["canvas"]
        assert isinstance(config_data["canvas"]["elements"], list)

    async def test_create_project_idempotent(self, tool, tool_context, tmp_path):
        """Test that creation is idempotent - can retry on failure"""
        params = CreateDesignProjectParams(
            project_path="test-design"
        )

        # First attempt - simulate failure when writing magic.project.js
        with patch('pathlib.Path.write_text', side_effect=Exception("Write failed")):
            result = await tool.execute(tool_context, params)

        # Should fail
        assert not result.ok
        assert "Failed to create" in result.content

        # Project folder may exist after failure (this is OK - we support retry)
        project_path = tmp_path / "test-design"

        # Second attempt - should succeed (no mock, normal execution)
        result = await tool.execute(tool_context, params)

        # Should succeed this time
        assert result.ok
        assert (project_path / "magic.project.js").exists()
        assert (project_path / "images").exists()

    async def test_images_folder_creation(self, tool, tool_context, tmp_path):
        """Test that images folder is created correctly"""
        params = CreateDesignProjectParams(
            project_path="test-design"
        )

        result = await tool.execute(tool_context, params)
        assert result.ok

        # Verify images folder exists and is a directory
        images_path = tmp_path / "test-design" / "images"
        assert images_path.exists()
        assert images_path.is_dir()

    async def test_result_content_format(self, tool, tool_context, tmp_path):
        """Test that result content is properly formatted"""
        params = CreateDesignProjectParams(
            project_path="test-design"
        )

        result = await tool.execute(tool_context, params)
        assert result.ok

        # Check result content format
        assert "Project structure:" in result.content
        assert "test-design/" in result.content
        assert "magic.project.js" in result.content
        assert "images/" in result.content
