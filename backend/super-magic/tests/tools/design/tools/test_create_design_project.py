from unittest.mock import AsyncMock, MagicMock

import pytest

from agentlang.context.tool_context import ToolContext
from app.tools.design.tools.create_design_project import (
    CreateDesignProject,
    CreateDesignProjectParams,
)


@pytest.fixture
def tool(tmp_path):
    return CreateDesignProject(base_dir=tmp_path)


@pytest.fixture
def tool_context():
    context = ToolContext(metadata={})
    agent_context = MagicMock()
    agent_context.dispatch_event = AsyncMock()
    context.register_extension("agent_context", agent_context)
    return context


class TestCreateDesignProject:
    @pytest.mark.asyncio
    async def test_create_project_does_not_create_images_directory(self, tool, tool_context, tmp_path):
        result = await tool.execute(
            tool_context,
            CreateDesignProjectParams(project_path="duck-swimming-video"),
        )

        project_path = tmp_path / "duck-swimming-video"

        assert result.ok
        assert (project_path / "magic.project.js").exists()
        assert not (project_path / "images").exists()
        assert "images/" not in result.content
