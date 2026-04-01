"""测试 GenerateImagesToCanvas 返回更新后的元素详情。"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.design.tools.generate_images_to_canvas import (
    GenerateImagesToCanvas,
    GenerateImagesToCanvasParams,
    GeneratedImageInfo,
    ImageGenerationResult,
)


@pytest.fixture
def tool(tmp_path):
    tool_instance = GenerateImagesToCanvas()
    tool_instance.base_dir = tmp_path
    return tool_instance


@pytest.fixture
def tool_context(tmp_path):
    context = ToolContext(metadata={"workspace_dir": str(tmp_path)})
    agent_context = MagicMock()
    agent_context.dispatch_event = AsyncMock()
    context.register_extension("agent_context", agent_context)
    return context


@pytest.fixture
def setup_project(tmp_path):
    project_path = tmp_path / "test-project"
    project_path.mkdir()
    (project_path / "magic.project.js").write_text(
        """window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "design",
  "name": "test-project",
  "canvas": {
    "viewport": {"scale": 1.0, "x": 0, "y": 0},
    "elements": []
  }
};""",
        encoding="utf-8",
    )
    (project_path / "images").mkdir()
    return project_path


class TestGenerateImagesToCanvasDetail:
    @pytest.mark.asyncio
    async def test_creates_images_directory_on_demand(self, tool, tool_context, tmp_path):
        project_path = tmp_path / "test-project"
        project_path.mkdir()
        (project_path / "magic.project.js").write_text(
            """window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "design",
  "name": "test-project",
  "canvas": {
    "viewport": {"scale": 1.0, "x": 0, "y": 0},
    "elements": []
  }
};""",
            encoding="utf-8",
        )

        with patch.object(tool._batch_create_tool, "execute", new_callable=AsyncMock) as mock_batch_create, \
             patch.object(tool, "_generate_images_single_prompt", new_callable=AsyncMock) as mock_generate_single, \
             patch.object(tool._batch_update_tool, "execute", new_callable=AsyncMock) as mock_batch_update, \
             patch.object(tool, "_get_model_from_config", return_value="doubao-seedream-4-0-250828"):

            mock_batch_create.return_value = ToolResult(
                success=True,
                content="placeholder created",
                extra_info={
                    "created_elements": [
                        {
                            "id": "img_elem_1",
                            "name": "海报图",
                            "type": "image",
                            "x": 100.0,
                            "y": 100.0,
                            "width": 1024.0,
                            "height": 1024.0,
                        }
                    ],
                    "elements": [],
                },
            )
            mock_generate_single.return_value = [
                ImageGenerationResult(
                    index=0,
                    success=True,
                    image_info=GeneratedImageInfo(
                        relative_path="test-project/images/poster.png",
                        width=1024,
                        height=1024,
                        generate_request={
                            "model_id": "doubao-seedream-4-0-250828",
                            "prompt": "生成一张海报",
                            "size": "1024x1024",
                            "resolution": "1024x1024",
                            "image_id": "img_1",
                        },
                    ),
                )
            ]
            mock_batch_update.return_value = ToolResult(
                success=True,
                content="updated",
                extra_info={
                    "elements": [
                        {
                            "id": "img_elem_1",
                            "name": "海报图",
                            "type": "image",
                            "src": "test-project/images/poster.png",
                            "status": "completed",
                        }
                    ]
                },
            )

            result = await tool.execute(
                tool_context,
                GenerateImagesToCanvasParams(
                    project_path="test-project",
                    prompts=["生成一张海报"],
                    size="1024x1024",
                    name="海报图",
                ),
            )

        assert result.ok
        assert (project_path / "images").exists()

    @pytest.mark.asyncio
    async def test_returns_batch_updated_elements_detail(self, tool, tool_context, setup_project):
        with patch.object(tool._batch_create_tool, "execute", new_callable=AsyncMock) as mock_batch_create, \
             patch.object(tool, "_generate_images_single_prompt", new_callable=AsyncMock) as mock_generate_single, \
             patch.object(tool._batch_update_tool, "execute", new_callable=AsyncMock) as mock_batch_update, \
             patch.object(tool, "_get_model_from_config", return_value="doubao-seedream-4-0-250828"):

            mock_batch_create.return_value = ToolResult(
                success=True,
                content="placeholder created",
                extra_info={
                    "created_elements": [
                        {
                            "id": "img_elem_1",
                            "name": "海报图",
                            "type": "image",
                            "x": 100.0,
                            "y": 100.0,
                            "width": 1024.0,
                            "height": 1024.0,
                        }
                    ],
                    "elements": [
                        {
                            "id": "img_elem_1",
                            "name": "海报图",
                            "type": "image",
                            "status": "processing",
                        }
                    ],
                },
            )
            mock_generate_single.return_value = [
                ImageGenerationResult(
                    index=0,
                    success=True,
                    image_info=GeneratedImageInfo(
                        relative_path="test-project/images/poster.png",
                        width=1024,
                        height=1024,
                        generate_request={
                            "model_id": "doubao-seedream-4-0-250828",
                            "prompt": "生成一张海报",
                            "size": "1024x1024",
                            "resolution": "1024x1024",
                            "image_id": "img_1",
                        },
                    ),
                )
            ]
            mock_batch_update.return_value = ToolResult(
                success=True,
                content="updated",
                extra_info={
                    "elements": [
                        {
                            "id": "img_elem_1",
                            "name": "海报图",
                            "type": "image",
                            "src": "test-project/images/poster.png",
                            "status": "completed",
                        }
                    ]
                },
            )

            result = await tool.execute(
                tool_context,
                GenerateImagesToCanvasParams(
                    project_path="test-project",
                    prompts=["生成一张海报"],
                    size="1024x1024",
                    name="海报图",
                ),
            )

        assert result.ok
        assert result.extra_info["elements"][0]["src"] == "test-project/images/poster.png"
        assert result.extra_info["elements"][0]["status"] == "completed"

    @pytest.mark.asyncio
    async def test_falls_back_to_placeholder_elements_when_batch_update_fails(self, tool, tool_context, setup_project):
        with patch.object(tool._batch_create_tool, "execute", new_callable=AsyncMock) as mock_batch_create, \
             patch.object(tool, "_generate_images_single_prompt", new_callable=AsyncMock) as mock_generate_single, \
             patch.object(tool._batch_update_tool, "execute", new_callable=AsyncMock) as mock_batch_update, \
             patch.object(tool, "_get_model_from_config", return_value="doubao-seedream-4-0-250828"):

            placeholder_elements = [
                {
                    "id": "img_elem_1",
                    "name": "海报图",
                    "type": "image",
                    "status": "processing",
                }
            ]
            mock_batch_create.return_value = ToolResult(
                success=True,
                content="placeholder created",
                extra_info={
                    "created_elements": [
                        {
                            "id": "img_elem_1",
                            "name": "海报图",
                            "type": "image",
                            "x": 100.0,
                            "y": 100.0,
                            "width": 1024.0,
                            "height": 1024.0,
                        }
                    ],
                    "elements": placeholder_elements,
                },
            )
            mock_generate_single.return_value = [
                ImageGenerationResult(
                    index=0,
                    success=True,
                    image_info=GeneratedImageInfo(
                        relative_path="test-project/images/poster.png",
                        width=1024,
                        height=1024,
                        generate_request={
                            "model_id": "doubao-seedream-4-0-250828",
                            "prompt": "生成一张海报",
                            "size": "1024x1024",
                            "resolution": "1024x1024",
                            "image_id": "img_1",
                        },
                    ),
                )
            ]
            mock_batch_update.return_value = ToolResult(success=False, content="update failed")

            result = await tool.execute(
                tool_context,
                GenerateImagesToCanvasParams(
                    project_path="test-project",
                    prompts=["生成一张海报"],
                    size="1024x1024",
                    name="海报图",
                ),
            )

        assert result.ok
        assert result.extra_info["elements"] == placeholder_elements
