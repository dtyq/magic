"""图片引用应用层规范化服务测试。"""

from unittest.mock import Mock

import pytest

from app.core.context.agent_context import AgentContext
from app.service.image_ref_normalizer import ImageRefNormalizer
from app.service.mention.builder import MentionContextBuilder


@pytest.mark.asyncio
async def test_normalize_keeps_workspace_refs_and_existing_external_files(tmp_path):
    """规范化服务应过滤路径逃逸和不存在的外部文件。"""
    workspace_dir = tmp_path / "workspace"
    workspace_image = workspace_dir / "images" / "mock.png"
    external_image = tmp_path / "external.png"
    workspace_image.parent.mkdir(parents=True)
    workspace_image.write_bytes(b"mock image")
    external_image.write_bytes(b"mock image")

    result = await ImageRefNormalizer(workspace_dir).normalize(
        [
            "images/mock.png",
            str(workspace_image),
            "../outside.png",
            str(external_image),
            str(tmp_path / "missing.png"),
        ]
    )

    assert result == [
        "images/mock.png",
        "images/mock.png",
        str(external_image.resolve()),
    ]


@pytest.mark.asyncio
async def test_extract_image_refs_returns_normalized_deduplicated_refs(tmp_path):
    """mention 图片提取结果应可直接传给 AgentRunRequest。"""
    workspace_dir = tmp_path / "workspace"
    workspace_image = workspace_dir / "images" / "mock.png"
    external_image = tmp_path / "external.png"
    workspace_image.parent.mkdir(parents=True)
    workspace_image.write_bytes(b"mock image")
    external_image.write_bytes(b"mock image")
    agent_context = Mock(spec=AgentContext)
    agent_context.get_workspace_dir.return_value = str(workspace_dir)

    mentions = [
        {"type": "file", "file_path": "images/mock.png"},
        {"type": "project_file", "file_path": str(workspace_image)},
        {"type": "upload_file", "file_path": str(external_image)},
        {"type": "file", "file_path": "documents/mock.txt"},
    ]

    result = await MentionContextBuilder().extract_image_refs(
        mentions,
        agent_context,
    )

    assert result == ["images/mock.png", str(external_image.resolve())]
