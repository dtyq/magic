"""
测试各种类型的 mention 处理

验证 file、mcp、agent、design_marker 等类型的 mention 字段验证和上下文构建逻辑
"""
import pytest
from unittest.mock import Mock, patch
from typing import Dict, Any, List

from app.core.entity.message.client_message import ChatClientMessage
from app.service.agent_service import AgentService


# 标记所有涉及 _build_mentions_context 的测试为异步测试
pytestmark = pytest.mark.asyncio


class TestDesignMarkerMentionValidation:
    """测试 design_marker mention 的验证逻辑"""

    def test_design_marker_mention_valid(self):
        """测试有效的 design_marker mention"""
        message = ChatClientMessage(
            message_id="test-001",
            prompt="帮我把这个地方修改为红色",
            mentions=[
                {
                    "type": "design_marker",
                    "image": "/新建画布/images/d1e68175-b629-4515-8ca3-c87803cebe67.jpg",
                    "label": "棕色耳尖",
                    "kind": "object",
                    "bbox": {
                        "x": 0.64,
                        "y": 0.07,
                        "width": 0.13,
                        "height": 0.21
                    }
                }
            ]
        )

        assert len(message.mentions) == 1
        assert message.mentions[0]["type"] == "design_marker"
        assert message.mentions[0]["label"] == "棕色耳尖"

    def test_design_marker_mention_missing_type(self):
        """测试缺少 type 字段的 mention 会报错"""
        with pytest.raises(ValueError, match="Mention必须包含'type'字段"):
            ChatClientMessage(
                message_id="test-002",
                prompt="Test message",
                mentions=[
                    {
                        "image": "/test.jpg",
                        "label": "test"
                    }
                ]
            )

    def test_design_marker_mention_multiple_types(self):
        """测试混合多种类型的 mentions"""
        message = ChatClientMessage(
            message_id="test-003",
            prompt="修改图片和查看文件",
            mentions=[
                {
                    "type": "file",
                    "file_path": "/test/file.py",
                    "filename": "file.py",
                    "file_key": "key1",
                    "file_size": 1024,
                    "file_url": "http://example.com/file.py"
                },
                {
                    "type": "design_marker",
                    "image": "/images/test.jpg",
                    "label": "背景",
                    "kind": "background",
                    "bbox": {"x": 0.1, "y": 0.2, "width": 0.5, "height": 0.6}
                }
            ]
        )

        assert len(message.mentions) == 2
        assert message.mentions[0]["type"] == "file"
        assert message.mentions[1]["type"] == "design_marker"

    def test_design_marker_without_bbox(self):
        """测试不带 bbox 的 design_marker"""
        message = ChatClientMessage(
            message_id="test-004",
            prompt="修改这张图片的猫耳朵",
            mentions=[
                {
                    "type": "design_marker",
                    "image": "/images/cat.jpg",
                    "label": "猫耳朵"
                }
            ]
        )

        assert len(message.mentions) == 1
        assert message.mentions[0]["type"] == "design_marker"
        assert message.mentions[0]["label"] == "猫耳朵"
        assert "bbox" not in message.mentions[0]

    def test_design_marker_without_kind(self):
        """测试不带 kind 字段的 design_marker"""
        message = ChatClientMessage(
            message_id="test-005",
            prompt="修改图片",
            mentions=[
                {
                    "type": "design_marker",
                    "image": "/images/test.jpg",
                    "label": "测试区域",
                    "bbox": {"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.2}
                }
            ]
        )

        assert len(message.mentions) == 1
        assert message.mentions[0]["type"] == "design_marker"
        assert "kind" not in message.mentions[0]

    def test_design_marker_bbox_variations(self):
        """测试 bbox 的各种空值表示"""
        test_cases = [
            (None, "bbox 为 None"),
            ({}, "bbox 为空字典"),
            ([], "bbox 为空数组"),
        ]

        for bbox_value, description in test_cases:
            message = ChatClientMessage(
                message_id="test-006",
                prompt=f"测试 {description}",
                mentions=[
                    {
                        "type": "design_marker",
                        "image": "/images/test.jpg",
                        "label": "测试",
                        "bbox": bbox_value
                    }
                ]
            )

            assert len(message.mentions) == 1
            assert message.mentions[0]["type"] == "design_marker"
            # 验证消息可以正常创建


class TestDesignMarkerContextBuilding:
    """测试 design_marker 的上下文构建逻辑"""

    def setup_method(self):
        """设置测试环境"""
        self.agent_service = AgentService()

    async def test_build_context_with_design_marker(self):
        """测试构建包含 design_marker 的上下文"""
        mentions = [
            {
                "type": "design_marker",
                "image": "/新建画布/images/test.jpg",
                "label": "棕色耳尖",
                "kind": "object",
                "bbox": {
                    "x": 0.64,
                    "y": 0.07,
                    "width": 0.13,
                    "height": 0.21
                }
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证基本结构
        assert "<mentions>" in context
        assert "</mentions>" in context
        assert "[@design_marker:棕色耳尖]" in context

        # 验证路径信息
        assert "新建画布/images/test.jpg" in context

        # 验证类型信息
        assert "标记类型: object" in context

        # 验证坐标信息
        assert "左上角(64.0%, 7.0%)" in context
        assert "尺寸13.0%×21.0%" in context

        # 验证位置描述（右上方）
        assert "上方" in context
        assert "右侧" in context

        # 验证提示信息（只验证有 tip 即可）
        assert "在执行任务前" in context

    async def test_build_context_position_descriptions(self):
        """测试不同位置的描述是否正确"""
        test_cases = [
            # (center_x, center_y, expected_h_position, expected_v_position)
            (0.15, 0.15, "左侧", "上方"),      # 左上
            (0.50, 0.15, "中间", "上方"),      # 中上
            (0.85, 0.15, "右侧", "上方"),      # 右上
            (0.15, 0.50, "左侧", "中部"),      # 左中
            (0.50, 0.50, "中间", "中部"),      # 中心
            (0.85, 0.50, "右侧", "中部"),      # 右中
            (0.15, 0.85, "左侧", "下方"),      # 左下
            (0.50, 0.85, "中间", "下方"),      # 中下
            (0.85, 0.85, "右侧", "下方"),      # 右下
        ]

        for center_x, center_y, expected_h, expected_v in test_cases:
            # 计算 bbox（让中心点位于指定位置）
            width = 0.1
            height = 0.1
            x = center_x - width / 2
            y = center_y - height / 2

            mentions = [{
                "type": "design_marker",
                "image": "/test.jpg",
                "label": f"测试_{expected_h}_{expected_v}",
                "kind": "test",
                "bbox": {"x": x, "y": y, "width": width, "height": height}
            }]

            context = await self.agent_service._build_mentions_context(mentions)

            assert expected_h in context, f"期望水平位置 '{expected_h}' 在上下文中 (center_x={center_x})"
            assert expected_v in context, f"期望垂直位置 '{expected_v}' 在上下文中 (center_y={center_y})"

    async def test_build_context_size_descriptions(self):
        """测试不同大小的区域描述"""
        test_cases = [
            # (width, height, expected_size)
            (0.05, 0.05, "小区域"),     # area = 0.0025 < 0.1
            (0.2, 0.2, "小区域"),        # area = 0.04 < 0.1
            (0.35, 0.35, "中等区域"),    # area = 0.1225 between 0.1-0.3
            (0.6, 0.6, "大区域"),        # area = 0.36 > 0.3
        ]

        for width, height, expected_size in test_cases:
            mentions = [{
                "type": "design_marker",
                "image": "/test.jpg",
                "label": "测试区域",
                "kind": "test",
                "bbox": {"x": 0.2, "y": 0.2, "width": width, "height": height}
            }]

            context = await self.agent_service._build_mentions_context(mentions)
            assert expected_size in context, f"期望大小描述 '{expected_size}' (area={width*height})"

    async def test_build_context_with_multiple_design_markers(self):
        """测试构建包含多个 design_marker 的上下文"""
        mentions = [
            {
                "type": "design_marker",
                "image": "/images/cat.jpg",
                "label": "耳朵",
                "kind": "object",
                "bbox": {"x": 0.6, "y": 0.1, "width": 0.1, "height": 0.2}
            },
            {
                "type": "design_marker",
                "image": "/images/cat.jpg",
                "label": "尾巴",
                "kind": "object",
                "bbox": {"x": 0.2, "y": 0.7, "width": 0.15, "height": 0.2}
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证两个标记都存在
        assert "[@design_marker:耳朵]" in context
        assert "[@design_marker:尾巴]" in context

        # 验证编号
        assert "1. [@design_marker:耳朵]" in context
        assert "2. [@design_marker:尾巴]" in context

    async def test_build_context_mixed_mention_types(self):
        """测试混合不同类型的 mentions"""
        mentions = [
            {
                "type": "file",
                "file_path": "/test/config.yaml",
                "filename": "config.yaml",
                "file_key": "key1",
                "file_size": 1024,
                "file_url": "http://example.com/config.yaml"
            },
            {
                "type": "design_marker",
                "image": "/images/design.jpg",
                "label": "logo区域",
                "kind": "logo",
                "bbox": {"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.2}
            },
            {
                "type": "mcp",
                "name": "search_tool"
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证所有类型都被正确处理
        assert "[@file_path:test/config.yaml]" in context
        assert "[@design_marker:logo区域]" in context
        assert "[@mcp:search_tool]" in context

        # 验证提示信息存在
        assert "在执行任务前" in context

    async def test_path_normalization(self):
        """测试路径标准化处理"""
        mentions = [
            {
                "type": "design_marker",
                "image": "/项目/images/test.jpg",  # 绝对路径
                "label": "测试",
                "kind": "test",
                "bbox": {"x": 0.5, "y": 0.5, "width": 0.1, "height": 0.1}
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证路径被标准化（去除前导斜杠）
        assert "项目/images/test.jpg" in context
        assert "/项目/images/test.jpg" not in context or "图片位置: 项目/images/test.jpg" in context

    async def test_build_context_without_bbox(self):
        """测试不带 bbox 的上下文构建"""
        mentions = [
            {
                "type": "design_marker",
                "image": "/images/cat.jpg",
                "label": "猫耳朵"
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证基本结构
        assert "<mentions>" in context
        assert "</mentions>" in context
        assert "[@design_marker:猫耳朵]" in context

        # 验证路径信息
        assert "images/cat.jpg" in context

        # 验证类型信息（默认为 object）
        assert "标记类型: object" in context

        # 验证不包含 bbox 相关信息
        assert "bbox坐标" not in context
        assert "标记区域" not in context

        # 验证提示信息仍然存在
        assert "在执行任务前" in context

    async def test_build_context_mixed_with_and_without_bbox(self):
        """测试混合带 bbox 和不带 bbox 的 mentions"""
        mentions = [
            {
                "type": "design_marker",
                "image": "/images/poster.jpg",
                "label": "标题",
                "kind": "text",
                "bbox": {"x": 0.2, "y": 0.1, "width": 0.6, "height": 0.15}
            },
            {
                "type": "design_marker",
                "image": "/images/poster.jpg",
                "label": "logo"
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证两个标记都存在
        assert "[@design_marker:标题]" in context
        assert "[@design_marker:logo]" in context

        # 验证第一个有 bbox 信息
        assert "bbox坐标: 左上角(20.0%, 10.0%)" in context

        # 验证编号
        assert "1. [@design_marker:标题]" in context
        assert "2. [@design_marker:logo]" in context

    async def test_build_context_bbox_empty_dict(self):
        """测试 bbox 为空字典的情况"""
        mentions = [
            {
                "type": "design_marker",
                "image": "/images/test.jpg",
                "label": "空bbox",
                "bbox": {}
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证基本结构
        assert "[@design_marker:空bbox]" in context
        assert "images/test.jpg" in context

        # 验证不包含 bbox 相关信息（空字典应被视为无效）
        assert "bbox坐标" not in context
        assert "标记区域" not in context

    async def test_build_context_bbox_empty_array(self):
        """测试 bbox 为空数组的情况"""
        mentions = [
            {
                "type": "design_marker",
                "image": "/images/test.jpg",
                "label": "空数组bbox",
                "bbox": []
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证基本结构
        assert "[@design_marker:空数组bbox]" in context
        assert "images/test.jpg" in context

        # 验证不包含 bbox 相关信息（空数组应被视为无效）
        assert "bbox坐标" not in context
        assert "标记区域" not in context

    async def test_build_context_bbox_null(self):
        """测试 bbox 为 None 的情况"""
        mentions = [
            {
                "type": "design_marker",
                "image": "/images/test.jpg",
                "label": "null bbox",
                "bbox": None
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证基本结构
        assert "[@design_marker:null bbox]" in context
        assert "images/test.jpg" in context

        # 验证不包含 bbox 相关信息
        assert "bbox坐标" not in context
        assert "标记区域" not in context

    async def test_build_context_all_bbox_variations(self):
        """测试混合所有 bbox 变体的情况"""
        mentions = [
            {
                "type": "design_marker",
                "image": "/images/test1.jpg",
                "label": "有效bbox",
                "bbox": {"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.2}
            },
            {
                "type": "design_marker",
                "image": "/images/test2.jpg",
                "label": "无bbox字段"
            },
            {
                "type": "design_marker",
                "image": "/images/test3.jpg",
                "label": "bbox为None",
                "bbox": None
            },
            {
                "type": "design_marker",
                "image": "/images/test4.jpg",
                "label": "bbox为空字典",
                "bbox": {}
            },
            {
                "type": "design_marker",
                "image": "/images/test5.jpg",
                "label": "bbox为空数组",
                "bbox": []
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证所有标记都存在
        assert "[@design_marker:有效bbox]" in context
        assert "[@design_marker:无bbox字段]" in context
        assert "[@design_marker:bbox为None]" in context
        assert "[@design_marker:bbox为空字典]" in context
        assert "[@design_marker:bbox为空数组]" in context

        # 验证只有第一个有 bbox 坐标信息
        bbox_count = context.count("bbox坐标")
        assert bbox_count == 1, f"应该只有1个 bbox 坐标信息，实际有 {bbox_count} 个"

        # 验证有效 bbox 的坐标信息存在
        assert "bbox坐标: 左上角(10.0%, 10.0%)" in context


class TestFileMentionValidation:
    """测试 file 类型 mention 的验证逻辑"""

    def test_file_mention_valid(self):
        """测试有效的 file mention"""
        message = ChatClientMessage(
            message_id="test-file-001",
            prompt="查看这个文件",
            mentions=[
                {
                    "type": "file",
                    "file_path": "/project/src/main.py",
                    "filename": "main.py",
                    "file_key": "key123",
                    "file_size": 2048,
                    "file_url": "http://example.com/main.py"
                }
            ]
        )

        assert len(message.mentions) == 1
        assert message.mentions[0]["type"] == "file"
        assert message.mentions[0]["filename"] == "main.py"

    def test_project_file_mention_valid(self):
        """测试有效的 project_file mention"""
        message = ChatClientMessage(
            message_id="test-file-002",
            prompt="查看项目文件",
            mentions=[
                {
                    "type": "project_file",
                    "file_path": "/workspace/config.yaml",
                    "filename": "config.yaml",
                    "file_key": "proj_key",
                    "file_size": 1024
                }
            ]
        )

        assert len(message.mentions) == 1
        assert message.mentions[0]["type"] == "project_file"

    def test_upload_file_mention_valid(self):
        """测试有效的 upload_file mention"""
        message = ChatClientMessage(
            message_id="test-file-003",
            prompt="处理上传的文件",
            mentions=[
                {
                    "type": "upload_file",
                    "file_path": "/uploads/document.pdf",
                    "filename": "document.pdf",
                    "file_key": "upload_key",
                    "file_size": 4096,
                    "file_url": "http://example.com/uploads/document.pdf"
                }
            ]
        )

        assert len(message.mentions) == 1
        assert message.mentions[0]["type"] == "upload_file"

    def test_file_mention_without_url(self):
        """测试不带 file_url 的 file mention"""
        message = ChatClientMessage(
            message_id="test-file-004",
            prompt="查看本地文件",
            mentions=[
                {
                    "type": "file",
                    "file_path": "/local/file.txt",
                    "filename": "file.txt",
                    "file_key": "local_key",
                    "file_size": 512
                }
            ]
        )

        assert len(message.mentions) == 1
        assert message.mentions[0]["type"] == "file"
        assert "file_url" not in message.mentions[0]

    def test_multiple_file_mentions(self):
        """测试多个文件 mentions"""
        message = ChatClientMessage(
            message_id="test-file-005",
            prompt="查看多个文件",
            mentions=[
                {
                    "type": "file",
                    "file_path": "/src/file1.py",
                    "filename": "file1.py",
                    "file_key": "key1",
                    "file_size": 1024
                },
                {
                    "type": "project_file",
                    "file_path": "/src/file2.py",
                    "filename": "file2.py",
                    "file_key": "key2",
                    "file_size": 2048
                },
                {
                    "type": "upload_file",
                    "file_path": "/uploads/file3.txt",
                    "filename": "file3.txt",
                    "file_key": "key3",
                    "file_size": 512
                }
            ]
        )

        assert len(message.mentions) == 3
        assert message.mentions[0]["type"] == "file"
        assert message.mentions[1]["type"] == "project_file"
        assert message.mentions[2]["type"] == "upload_file"


class TestFileMentionContextBuilding:
    """测试 file 类型 mention 的上下文构建逻辑"""

    def setup_method(self):
        """设置测试环境"""
        self.agent_service = AgentService()

    async def test_build_context_with_file(self):
        """测试构建包含 file 的上下文"""
        mentions = [
            {
                "type": "file",
                "file_path": "/project/src/main.py",
                "filename": "main.py",
                "file_key": "key123",
                "file_size": 2048,
                "file_url": "http://example.com/main.py"
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证基本结构
        assert "<mentions>" in context
        assert "</mentions>" in context
        assert "[@file_path:project/src/main.py]" in context

        # 验证 URL 信息
        assert "访问地址: http://example.com/main.py" in context

        # 验证提示信息
        assert "在执行任务前" in context

    async def test_build_context_with_file_without_url(self):
        """测试构建不带 URL 的 file 上下文"""
        mentions = [
            {
                "type": "file",
                "file_path": "/local/config.yaml",
                "filename": "config.yaml",
                "file_key": "key456",
                "file_size": 1024
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证基本结构
        assert "[@file_path:local/config.yaml]" in context

        # 验证不包含 URL 信息
        assert "访问地址" not in context

    async def test_build_context_with_multiple_files(self):
        """测试构建包含多个文件的上下文"""
        mentions = [
            {
                "type": "file",
                "file_path": "/src/file1.py",
                "filename": "file1.py",
                "file_key": "key1",
                "file_size": 1024
            },
            {
                "type": "project_file",
                "file_path": "/src/file2.py",
                "filename": "file2.py",
                "file_key": "key2",
                "file_size": 2048,
                "file_url": "http://example.com/file2.py"
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证两个文件都存在
        assert "[@file_path:src/file1.py]" in context
        assert "[@file_path:src/file2.py]" in context

        # 验证编号
        assert "1. [@file_path:src/file1.py]" in context
        assert "2. [@file_path:src/file2.py]" in context

        # 验证第二个文件有 URL
        assert "访问地址: http://example.com/file2.py" in context

    async def test_file_path_normalization(self):
        """测试文件路径标准化处理"""
        mentions = [
            {
                "type": "file",
                "file_path": "/workspace/src/main.py",  # 绝对路径
                "filename": "main.py",
                "file_key": "key789",
                "file_size": 2048
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证路径被标准化（去除前导斜杠）
        assert "workspace/src/main.py" in context


class TestMcpMentionValidation:
    """测试 mcp 类型 mention 的验证逻辑"""

    def test_mcp_mention_valid(self):
        """测试有效的 mcp mention"""
        message = ChatClientMessage(
            message_id="test-mcp-001",
            prompt="使用搜索工具",
            mentions=[
                {
                    "type": "mcp",
                    "name": "search_tool"
                }
            ]
        )

        assert len(message.mentions) == 1
        assert message.mentions[0]["type"] == "mcp"
        assert message.mentions[0]["name"] == "search_tool"

    def test_multiple_mcp_mentions(self):
        """测试多个 MCP mentions"""
        message = ChatClientMessage(
            message_id="test-mcp-002",
            prompt="使用多个工具",
            mentions=[
                {
                    "type": "mcp",
                    "name": "search_tool"
                },
                {
                    "type": "mcp",
                    "name": "database_tool"
                },
                {
                    "type": "mcp",
                    "name": "api_tool"
                }
            ]
        )

        assert len(message.mentions) == 3
        assert all(m["type"] == "mcp" for m in message.mentions)


class TestMcpMentionContextBuilding:
    """测试 mcp 类型 mention 的上下文构建逻辑"""

    def setup_method(self):
        """设置测试环境"""
        self.agent_service = AgentService()

    async def test_build_context_with_mcp(self):
        """测试构建包含 MCP 的上下文"""
        mentions = [
            {
                "type": "mcp",
                "name": "search_tool"
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证基本结构
        assert "<mentions>" in context
        assert "</mentions>" in context
        assert "[@mcp:search_tool]" in context

        # 验证提示信息
        assert "在执行任务前" in context

    async def test_build_context_with_multiple_mcps(self):
        """测试构建包含多个 MCP 的上下文"""
        mentions = [
            {
                "type": "mcp",
                "name": "search_tool"
            },
            {
                "type": "mcp",
                "name": "database_tool"
            },
            {
                "type": "mcp",
                "name": "api_tool"
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证所有 MCP 都存在
        assert "[@mcp:search_tool]" in context
        assert "[@mcp:database_tool]" in context
        assert "[@mcp:api_tool]" in context

        # 验证编号
        assert "1. [@mcp:search_tool]" in context
        assert "2. [@mcp:database_tool]" in context
        assert "3. [@mcp:api_tool]" in context


class TestAgentMentionValidation:
    """测试 agent 类型 mention 的验证逻辑"""

    def test_agent_mention_valid_with_name(self):
        """测试使用 name 字段的有效 agent mention"""
        message = ChatClientMessage(
            message_id="test-agent-001",
            prompt="调用代码审查 Agent",
            mentions=[
                {
                    "type": "agent",
                    "name": "code_reviewer"
                }
            ]
        )

        assert len(message.mentions) == 1
        assert message.mentions[0]["type"] == "agent"
        assert message.mentions[0]["name"] == "code_reviewer"

    def test_agent_mention_valid_with_agent_name(self):
        """测试使用 agent_name 字段的有效 agent mention"""
        message = ChatClientMessage(
            message_id="test-agent-002",
            prompt="调用测试 Agent",
            mentions=[
                {
                    "type": "agent",
                    "agent_name": "test_runner"
                }
            ]
        )

        assert len(message.mentions) == 1
        assert message.mentions[0]["type"] == "agent"
        assert message.mentions[0]["agent_name"] == "test_runner"

    def test_multiple_agent_mentions(self):
        """测试多个 Agent mentions"""
        message = ChatClientMessage(
            message_id="test-agent-003",
            prompt="调用多个 Agent",
            mentions=[
                {
                    "type": "agent",
                    "name": "code_reviewer"
                },
                {
                    "type": "agent",
                    "agent_name": "test_runner"
                },
                {
                    "type": "agent",
                    "name": "deployer"
                }
            ]
        )

        assert len(message.mentions) == 3
        assert all(m["type"] == "agent" for m in message.mentions)


class TestAgentMentionContextBuilding:
    """测试 agent 类型 mention 的上下文构建逻辑"""

    def setup_method(self):
        """设置测试环境"""
        self.agent_service = AgentService()

    async def test_build_context_with_agent_using_name(self):
        """测试构建使用 name 字段的 Agent 上下文"""
        mentions = [
            {
                "type": "agent",
                "name": "code_reviewer"
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证基本结构
        assert "<mentions>" in context
        assert "</mentions>" in context
        assert "[@agent:code_reviewer]" in context

        # 验证提示信息
        assert "在执行任务前" in context

    async def test_build_context_with_agent_using_agent_name(self):
        """测试构建使用 agent_name 字段的 Agent 上下文"""
        mentions = [
            {
                "type": "agent",
                "agent_name": "test_runner"
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证基本结构
        assert "[@agent:test_runner]" in context

        # 验证提示信息
        assert "在执行任务前" in context

    async def test_build_context_with_multiple_agents(self):
        """测试构建包含多个 Agent 的上下文"""
        mentions = [
            {
                "type": "agent",
                "name": "code_reviewer"
            },
            {
                "type": "agent",
                "agent_name": "test_runner"
            },
            {
                "type": "agent",
                "name": "deployer"
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证所有 Agent 都存在
        assert "[@agent:code_reviewer]" in context
        assert "[@agent:test_runner]" in context
        assert "[@agent:deployer]" in context

        # 验证编号
        assert "1. [@agent:code_reviewer]" in context
        assert "2. [@agent:test_runner]" in context
        assert "3. [@agent:deployer]" in context

    async def test_build_context_with_agent_missing_both_names(self):
        """测试构建缺少 name 和 agent_name 字段的 Agent 上下文"""
        mentions = [
            {
                "type": "agent"
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证使用默认名称
        assert "[@agent:未知Agent]" in context


class TestMixedMentionTypes:
    """测试混合不同类型的 mentions"""

    def setup_method(self):
        """设置测试环境"""
        self.agent_service = AgentService()

    async def test_all_mention_types_together(self):
        """测试所有类型的 mentions 同时存在"""
        mentions = [
            {
                "type": "file",
                "file_path": "/src/config.py",
                "filename": "config.py",
                "file_key": "key1",
                "file_size": 1024,
                "file_url": "http://example.com/config.py"
            },
            {
                "type": "mcp",
                "name": "database_tool"
            },
            {
                "type": "agent",
                "name": "code_reviewer"
            },
            {
                "type": "design_marker",
                "image": "/images/design.jpg",
                "label": "logo",
                "kind": "logo",
                "bbox": {"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.2}
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证所有类型都被正确处理
        assert "[@file_path:src/config.py]" in context
        assert "[@mcp:database_tool]" in context
        assert "[@agent:code_reviewer]" in context
        assert "[@design_marker:logo]" in context

        # 验证编号
        assert "1. [@file_path:src/config.py]" in context
        assert "2. [@mcp:database_tool]" in context
        assert "3. [@agent:code_reviewer]" in context
        assert "4. [@design_marker:logo]" in context

        # 验证提示信息存在
        assert "在执行任务前" in context

    async def test_mixed_tips_ordering(self):
        """测试混合类型时提示信息的顺序"""
        mentions = [
            {
                "type": "design_marker",
                "image": "/images/test.jpg",
                "label": "测试区域",
                "bbox": {"x": 0.5, "y": 0.5, "width": 0.1, "height": 0.1}
            },
            {
                "type": "file",
                "file_path": "/test.py",
                "filename": "test.py",
                "file_key": "key",
                "file_size": 512
            },
            {
                "type": "agent",
                "name": "tester"
            },
            {
                "type": "mcp",
                "name": "api_tool"
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证提示信息存在
        assert "在执行任务前" in context

    async def test_file_and_mcp_only(self):
        """测试只有 file 和 mcp 的情况"""
        mentions = [
            {
                "type": "file",
                "file_path": "/config.yaml",
                "filename": "config.yaml",
                "file_key": "key",
                "file_size": 1024
            },
            {
                "type": "mcp",
                "name": "search_tool"
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证提示信息存在
        assert "在执行任务前" in context
        assert "标记" not in context

    async def test_agent_and_design_marker_only(self):
        """测试只有 agent 和 design_marker 的情况"""
        mentions = [
            {
                "type": "agent",
                "name": "designer"
            },
            {
                "type": "design_marker",
                "image": "/images/ui.jpg",
                "label": "按钮",
                "bbox": {"x": 0.3, "y": 0.4, "width": 0.1, "height": 0.05}
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证提示信息存在
        assert "在执行任务前" in context
        assert "MCP 工具" not in context

    async def test_empty_mentions(self):
        """测试空的 mentions 列表"""
        mentions = []

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证返回空字符串
        assert context == ""

    async def test_unknown_mention_type(self):
        """测试未知类型的 mention"""
        mentions = [
            {
                "type": "unknown_type",
                "data": "some data"
            }
        ]

        context = await self.agent_service._build_mentions_context(mentions)

        # 验证包含基本结构
        assert "<mentions>" in context
        assert "</mentions>" in context

        # 验证包含通用引用格式
        assert "引用:" in context
