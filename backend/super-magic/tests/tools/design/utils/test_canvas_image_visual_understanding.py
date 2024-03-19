"""
Tests for canvas_image_visual_understanding utility
"""

import json
import pytest
from unittest.mock import AsyncMock, Mock, patch
from pathlib import Path

from agentlang.tools.tool_result import ToolResult
from app.tools.design.utils.canvas_image_visual_understanding import (
    analyze_image_for_canvas,
    _parse_structured_response,
    _parse_markdown_response,
    _ensure_summary_length,
    _get_cache_key,
    _load_from_cache,
    _save_to_cache,
    CANVAS_IMAGE_ANALYSIS_QUERY,
    CANVAS_IMAGE_SIMPLE_QUERY
)
from app.tools.design.utils.magic_project_design_parser import VisualUnderstanding


class TestAnalyzeImageForCanvas:
    """Test analyze_image_for_canvas function"""

    @pytest.mark.asyncio
    async def test_analyze_with_valid_json_response(self, tmp_path):
        """Test analyzing image with valid JSON response"""
        # 创建测试图片文件
        test_image = tmp_path / "test.jpg"
        test_image.write_bytes(b"fake image data")

        # Mock VisualUnderstanding 返回结构化 JSON
        mock_result = ToolResult(
            content=json.dumps({
                "summary": "美丽的日落风景",
                "detailed": {
                    "theme": "自然风光",
                    "visual_elements": "暖色调，橙色和粉色天空",
                    "style": "摄影",
                    "mood": "宁静祥和",
                    "use_cases": "背景图、壁纸"
                }
            }, ensure_ascii=False),
            ok=True
        )

        with patch('app.tools.design.utils.canvas_image_visual_understanding.VisualUnderstanding') as mock_class:
            mock_instance = AsyncMock()
            mock_instance.execute_purely = AsyncMock(return_value=mock_result)
            mock_class.return_value = mock_instance

            with patch('app.tools.design.utils.canvas_image_visual_understanding.PathManager.get_workspace_dir', return_value=tmp_path):
                result = await analyze_image_for_canvas(str(test_image), use_cache=False)

        # 验证结果
        assert isinstance(result, VisualUnderstanding)
        assert result.summary == "美丽的日落风景"
        assert result.detailed is not None
        assert result.detailed["theme"] == "自然风光"
        assert result.detailed["image_source"] == str(test_image)
        assert result.analyzedAt is not None

    @pytest.mark.asyncio
    async def test_analyze_with_markdown_code_block(self, tmp_path):
        """Test analyzing image when response contains markdown code block"""
        # 创建测试图片文件
        test_image = tmp_path / "test.jpg"
        test_image.write_bytes(b"fake image data")

        # Mock VisualUnderstanding 返回带 markdown 代码块的 JSON
        json_content = {
            "summary": "现代办公室环境",
            "detailed": {
                "theme": "室内设计",
                "visual_elements": "简洁白色装修",
                "style": "现代简约",
                "mood": "专业整洁",
                "use_cases": "办公场景展示"
            }
        }
        mock_result = ToolResult(
            content=f"```json\n{json.dumps(json_content, ensure_ascii=False)}\n```",
            ok=True
        )

        with patch('app.tools.design.utils.canvas_image_visual_understanding.VisualUnderstanding') as mock_class:
            mock_instance = AsyncMock()
            mock_instance.execute_purely = AsyncMock(return_value=mock_result)
            mock_class.return_value = mock_instance

            with patch('app.tools.design.utils.canvas_image_visual_understanding.PathManager.get_workspace_dir', return_value=tmp_path):
                result = await analyze_image_for_canvas(str(test_image), use_cache=False)

        # 验证结果
        assert result.summary == "现代办公室环境"
        assert result.detailed["theme"] == "室内设计"

    @pytest.mark.asyncio
    async def test_analyze_with_simple_query(self, tmp_path):
        """Test analyzing image with simple query (no detailed analysis)"""
        # 创建测试图片文件
        test_image = tmp_path / "test.jpg"
        test_image.write_bytes(b"fake image data")

        # Mock VisualUnderstanding 返回简单文本
        mock_result = ToolResult(
            content="这是一张展示城市天际线的照片，高楼林立，现代感十足。",
            ok=True
        )

        with patch('app.tools.design.utils.canvas_image_visual_understanding.VisualUnderstanding') as mock_class:
            mock_instance = AsyncMock()
            mock_instance.execute_purely = AsyncMock(return_value=mock_result)
            mock_class.return_value = mock_instance

            with patch('app.tools.design.utils.canvas_image_visual_understanding.PathManager.get_workspace_dir', return_value=tmp_path):
                result = await analyze_image_for_canvas(
                    str(test_image),
                    include_detailed_analysis=False,
                    use_cache=False
                )

        # 验证结果
        assert result.summary == "这是一张展示城市天际线的照片，高楼林立，现代感十足。"
        assert result.detailed is None

        # 验证调用时使用了简单查询
        mock_instance.execute_purely.assert_called_once()
        call_args = mock_instance.execute_purely.call_args
        assert CANVAS_IMAGE_SIMPLE_QUERY in call_args[0][0].query

    @pytest.mark.asyncio
    async def test_analyze_with_custom_query(self, tmp_path):
        """Test analyzing image with custom query"""
        # 创建测试图片文件
        test_image = tmp_path / "test.jpg"
        test_image.write_bytes(b"fake image data")

        custom_query = "请描述这个产品的外观特征、材质和设计风格"

        mock_result = ToolResult(
            content="这是一款圆形的智能手表，采用不锈钢材质，简约科技风格。",
            ok=True
        )

        with patch('app.tools.design.utils.canvas_image_visual_understanding.VisualUnderstanding') as mock_class:
            mock_instance = AsyncMock()
            mock_instance.execute_purely = AsyncMock(return_value=mock_result)
            mock_class.return_value = mock_instance

            with patch('app.tools.design.utils.canvas_image_visual_understanding.PathManager.get_workspace_dir', return_value=tmp_path):
                result = await analyze_image_for_canvas(
                    str(test_image),
                    custom_query=custom_query,
                    use_cache=False
                )

        # 验证使用了自定义查询
        call_args = mock_instance.execute_purely.call_args
        assert call_args[0][0].query == custom_query

        # 验证结果
        assert result.summary == "这是一款圆形的智能手表，采用不锈钢材质，简约科技风格。"

    @pytest.mark.asyncio
    async def test_analyze_with_nonexistent_image(self, tmp_path):
        """Test analyzing nonexistent image raises ValueError"""
        nonexistent_image = tmp_path / "nonexistent.jpg"

        with patch('app.tools.design.utils.canvas_image_visual_understanding.PathManager.get_workspace_dir', return_value=tmp_path):
            with pytest.raises(ValueError, match="图片文件不存在"):
                await analyze_image_for_canvas(str(nonexistent_image))

    @pytest.mark.asyncio
    async def test_analyze_with_visual_understanding_failure(self, tmp_path):
        """Test handling visual understanding failure"""
        # 创建测试图片文件
        test_image = tmp_path / "test.jpg"
        test_image.write_bytes(b"fake image data")

        # Mock VisualUnderstanding 返回错误
        mock_result = ToolResult(
            content="视觉理解服务暂时不可用",
            ok=False
        )

        with patch('app.tools.design.utils.canvas_image_visual_understanding.VisualUnderstanding') as mock_class:
            mock_instance = AsyncMock()
            mock_instance.execute_purely = AsyncMock(return_value=mock_result)
            mock_class.return_value = mock_instance

            with patch('app.tools.design.utils.canvas_image_visual_understanding.PathManager.get_workspace_dir', return_value=tmp_path):
                with pytest.raises(ValueError, match="视觉理解失败"):
                    await analyze_image_for_canvas(str(test_image))


class TestParseStructuredResponse:
    """Test _parse_structured_response function"""

    def test_parse_valid_json(self):
        """Test parsing valid JSON response"""
        content = json.dumps({
            "summary": "测试摘要",
            "detailed": {
                "theme": "测试主题",
                "visual_elements": "测试元素"
            }
        }, ensure_ascii=False)

        summary, detailed = _parse_structured_response(content, "test.jpg")

        assert summary == "测试摘要"
        assert detailed["theme"] == "测试主题"
        assert detailed["image_source"] == "test.jpg"

    def test_parse_json_with_markdown_wrapper(self):
        """Test parsing JSON wrapped in markdown code block"""
        json_obj = {
            "summary": "Markdown包装的JSON",
            "detailed": {"theme": "测试"}
        }
        content = f"```json\n{json.dumps(json_obj, ensure_ascii=False)}\n```"

        summary, detailed = _parse_structured_response(content, "test.jpg")

        assert summary == "Markdown包装的JSON"
        assert detailed["theme"] == "测试"

    def test_parse_json_with_extra_text(self):
        """Test parsing JSON with extra text before/after"""
        json_obj = {
            "summary": "带额外文本的JSON",
            "detailed": {"theme": "测试"}
        }
        content = f"这是分析结果：\n{json.dumps(json_obj, ensure_ascii=False)}\n希望对你有帮助"

        summary, detailed = _parse_structured_response(content, "test.jpg")

        assert summary == "带额外文本的JSON"

    def test_parse_json_without_summary(self):
        """Test parsing JSON without summary field"""
        content = json.dumps({
            "detailed": {"theme": "仅有详细信息"}
        }, ensure_ascii=False)

        summary, detailed = _parse_structured_response(content, "test.jpg")

        # 应该降级到使用整个 content 作为摘要
        assert len(summary) > 0

    def test_parse_invalid_json_fallback_to_markdown(self):
        """Test fallback to markdown parsing when JSON is invalid"""
        content = """### 摘要
这是一个无效的JSON，应该降级到markdown解析

### 详细分析
**主题：** 测试主题"""

        summary, detailed = _parse_structured_response(content, "test.jpg")

        assert "无效的JSON" in summary or "markdown解析" in summary

    def test_parse_long_summary_truncated(self):
        """Test that long summary is truncated"""
        long_summary = "这是一个" + "非常" * 100 + "长的摘要"
        content = json.dumps({
            "summary": long_summary,
            "detailed": {"theme": "测试"}
        }, ensure_ascii=False)

        summary, detailed = _parse_structured_response(content, "test.jpg")

        assert len(summary) <= 83  # 80 + "..."


class TestParseMarkdownResponse:
    """Test _parse_markdown_response function"""

    def test_parse_markdown_with_sections(self):
        """Test parsing markdown with summary and detailed sections"""
        content = """### 摘要
这是一张美丽的风景照片

### 详细分析
**主题：** 自然风光
**视觉元素：** 山川河流"""

        summary, detailed = _parse_markdown_response(content, "test.jpg")

        assert summary == "这是一张美丽的风景照片"
        assert detailed is not None
        assert "自然风光" in detailed["full_analysis"]

    def test_parse_markdown_without_sections(self):
        """Test parsing markdown without section headers"""
        content = """这是第一段内容，应该作为摘要。

这是第二段内容，提供更多细节。"""

        summary, detailed = _parse_markdown_response(content, "test.jpg")

        assert summary == "这是第一段内容，应该作为摘要。"

    def test_parse_markdown_single_line(self):
        """Test parsing single line markdown"""
        content = "简单的单行描述"

        summary, detailed = _parse_markdown_response(content, "test.jpg")

        assert summary == "简单的单行描述"
        assert detailed is None


class TestRealIntegration:
    """Real integration tests (manually skip by default)"""

    @pytest.mark.skip(reason="Manual test - fill in IMAGE_PATH to run real integration test")
    @pytest.mark.asyncio
    async def test_real_image_analysis(self):
        """
        Real integration test with actual VisualUnderstanding tool.

        To run this test:
        1. Fill in IMAGE_PATH with a real image file path
        2. Remove the @pytest.mark.skip decorator or run with: pytest -v -k test_real_image_analysis -s
        3. Make sure you have proper API credentials configured

        Example IMAGE_PATH values:
        - "/path/to/your/test/image.jpg"
        - "workspace/project/images/photo.png"
        """
        # TODO: Fill in your test image path here
        IMAGE_PATH = "Demo/images/christmas_tree.jpg"  # <-- Replace with your actual image path

        if not IMAGE_PATH:
            pytest.skip("IMAGE_PATH not configured - fill in a real image path to test")

        # Test with detailed analysis
        print("\n" + "="*60)
        print("Testing image analysis with detailed=True...")
        print("="*60)
        result = await analyze_image_for_canvas(
            IMAGE_PATH,
            include_detailed_analysis=True,
            use_cache=False
        )

        print(f"\n✓ Summary ({len(result.summary)} chars): {result.summary}")
        print(f"\n✓ Analyzed At: {result.analyzedAt}")

        if result.detailed:
            print("\n✓ Detailed Analysis:")
            for key, value in result.detailed.items():
                if isinstance(value, str) and len(value) > 100:
                    print(f"  - {key}: {value[:100]}...")
                else:
                    print(f"  - {key}: {value}")

        # Verify structure
        assert result.summary is not None
        assert len(result.summary) > 0
        assert len(result.summary) <= 83  # 80 + "..."
        assert result.analyzedAt is not None

        if result.detailed:
            assert "theme" in result.detailed
            assert "visual_elements" in result.detailed
            assert "style" in result.detailed
            assert "mood" in result.detailed
            assert "use_cases" in result.detailed
            assert "image_source" in result.detailed

        print("\n✓ All assertions passed!")

        # Test with simple analysis (summary only)
        print("\n" + "="*60)
        print("Testing image analysis with detailed=False...")
        print("="*60)
        result_simple = await analyze_image_for_canvas(
            IMAGE_PATH,
            include_detailed_analysis=False
        )

        print(f"\n✓ Summary ({len(result_simple.summary)} chars): {result_simple.summary}")
        print(f"✓ Analyzed At: {result_simple.analyzedAt}")
        print(f"✓ Detailed: {result_simple.detailed}")

        assert result_simple.summary is not None
        assert len(result_simple.summary) > 0
        assert result_simple.detailed is None

        print("\n✓ All assertions passed!")
        print("\n" + "="*60)
        print("Real integration test completed successfully!")
        print("="*60)


class TestEnsureSummaryLength:
    """Test _ensure_summary_length function"""

    def test_short_text_unchanged(self):
        """Test that short text is returned unchanged"""
        text = "短文本"
        result = _ensure_summary_length(text)
        assert result == "短文本"

    def test_exact_length_unchanged(self):
        """Test that text at exact max length is unchanged"""
        text = "a" * 80
        result = _ensure_summary_length(text)
        assert result == text

    def test_long_text_truncated_at_sentence(self):
        """Test that long text is truncated at sentence boundary"""
        text = "这是第一句话。" + "这是很长的第二句话" * 20
        result = _ensure_summary_length(text)
        assert result == "这是第一句话。"

    def test_long_text_hard_truncate(self):
        """Test hard truncation when no sentence boundary found"""
        text = "这是一段没有标点符号的很长很长的文本" * 20
        result = _ensure_summary_length(text, max_length=50)
        assert len(result) == 53  # 50 + "..."
        assert result.endswith("...")

    def test_text_with_multiple_punctuation(self):
        """Test truncation with different punctuation marks"""
        test_cases = [
            ("这是第一句。这是第二句。这是第三句。" * 10, "。"),
            ("这是第一句！这是第二句！这是第三句！" * 10, "！"),
            ("这是第一句？这是第二句？这是第三句？" * 10, "？"),
        ]

        for text, punct in test_cases:
            result = _ensure_summary_length(text, max_length=50)
            assert len(result) <= 100  # 应该在合理范围内
            assert punct in result  # 应该包含标点符号

    def test_whitespace_handling(self):
        """Test that leading/trailing whitespace is stripped"""
        text = "  \n  文本内容  \n  "
        result = _ensure_summary_length(text)
        assert result == "文本内容"


class TestCacheMechanism:
    """测试缓存机制"""

    def test_cache_key_generation(self):
        """测试缓存键生成"""
        # 相同的参数应该生成相同的缓存键
        key1 = _get_cache_key("test.jpg", "query1", 123456.0)
        key2 = _get_cache_key("test.jpg", "query1", 123456.0)
        assert key1 == key2

        # 不同的参数应该生成不同的缓存键
        key3 = _get_cache_key("test.jpg", "query2", 123456.0)
        key4 = _get_cache_key("test2.jpg", "query1", 123456.0)
        key5 = _get_cache_key("test.jpg", "query1", 123457.0)

        assert key1 != key3  # 不同的查询
        assert key1 != key4  # 不同的图片
        assert key1 != key5  # 不同的修改时间

    def test_cache_save_and_load(self, tmp_path):
        """测试缓存保存和加载"""
        # 准备测试数据
        test_result = VisualUnderstanding(
            summary="测试摘要",
            detailed={
                "theme": "测试主题",
                "visual_elements": "测试元素"
            },
            analyzedAt="2024-01-01T00:00:00"
        )

        cache_key = "test_cache_key_123"

        # Mock 缓存目录
        with patch('app.tools.design.utils.canvas_image_visual_understanding._get_cache_dir', return_value=tmp_path):
            # 保存到缓存
            _save_to_cache(cache_key, test_result)

            # 从缓存加载
            loaded_result = _load_from_cache(cache_key)

        # 验证加载的结果
        assert loaded_result is not None
        assert loaded_result.summary == test_result.summary
        assert loaded_result.detailed == test_result.detailed
        assert loaded_result.analyzedAt == test_result.analyzedAt

    def test_cache_load_nonexistent(self, tmp_path):
        """测试加载不存在的缓存"""
        with patch('app.tools.design.utils.canvas_image_visual_understanding._get_cache_dir', return_value=tmp_path):
            result = _load_from_cache("nonexistent_key")

        assert result is None

    @pytest.mark.asyncio
    async def test_analyze_with_cache_enabled(self, tmp_path):
        """测试启用缓存时的分析"""
        # 创建测试图片文件
        test_image = tmp_path / "test.jpg"
        test_image.write_bytes(b"fake image data")

        # Mock VisualUnderstanding 返回
        mock_result = ToolResult(
            content=json.dumps({
                "summary": "缓存测试",
                "detailed": {"theme": "测试"}
            }, ensure_ascii=False),
            ok=True
        )

        with patch('app.tools.design.utils.canvas_image_visual_understanding.VisualUnderstanding') as mock_class:
            mock_instance = AsyncMock()
            mock_instance.execute_purely = AsyncMock(return_value=mock_result)
            mock_class.return_value = mock_instance

            cache_dir = tmp_path / "cache"
            with patch('app.tools.design.utils.canvas_image_visual_understanding.PathManager.get_workspace_dir', return_value=tmp_path):
                with patch('app.tools.design.utils.canvas_image_visual_understanding._get_cache_dir', return_value=cache_dir):
                    # 第一次调用 - 应该调用 LLM
                    result1 = await analyze_image_for_canvas(str(test_image), use_cache=True)
                    assert mock_instance.execute_purely.call_count == 1

                    # 第二次调用 - 应该使用缓存，不再调用 LLM
                    result2 = await analyze_image_for_canvas(str(test_image), use_cache=True)
                    assert mock_instance.execute_purely.call_count == 1  # 仍然是1次，没有增加

                    # 验证两次结果相同
                    assert result1.summary == result2.summary
                    assert result1.detailed == result2.detailed


class TestRetryMechanism:
    """测试重试机制"""

    @pytest.mark.asyncio
    async def test_retry_on_llm_failure(self, tmp_path):
        """测试 LLM 失败时的重试"""
        # 创建测试图片文件
        test_image = tmp_path / "test.jpg"
        test_image.write_bytes(b"fake image data")

        # Mock VisualUnderstanding: 第一次失败，第二次成功
        failed_result = ToolResult(content="Error occurred", ok=False)
        success_result = ToolResult(
            content=json.dumps({
                "summary": "重试成功",
                "detailed": {"theme": "测试"}
            }, ensure_ascii=False),
            ok=True
        )

        with patch('app.tools.design.utils.canvas_image_visual_understanding.VisualUnderstanding') as mock_class:
            mock_instance = AsyncMock()
            # 第一次调用失败，第二次成功
            mock_instance.execute_purely = AsyncMock(side_effect=[failed_result, success_result])
            mock_class.return_value = mock_instance

            with patch('app.tools.design.utils.canvas_image_visual_understanding.PathManager.get_workspace_dir', return_value=tmp_path):
                result = await analyze_image_for_canvas(str(test_image), use_cache=False, max_retries=1)

            # 验证重试成功
            assert result.summary == "重试成功"
            assert mock_instance.execute_purely.call_count == 2  # 调用了2次

    @pytest.mark.asyncio
    async def test_retry_exhausted(self, tmp_path):
        """测试重试次数用尽后抛出异常"""
        # 创建测试图片文件
        test_image = tmp_path / "test.jpg"
        test_image.write_bytes(b"fake image data")

        # Mock VisualUnderstanding: 始终失败
        failed_result = ToolResult(content="Error occurred", ok=False)

        with patch('app.tools.design.utils.canvas_image_visual_understanding.VisualUnderstanding') as mock_class:
            mock_instance = AsyncMock()
            mock_instance.execute_purely = AsyncMock(return_value=failed_result)
            mock_class.return_value = mock_instance

            with patch('app.tools.design.utils.canvas_image_visual_understanding.PathManager.get_workspace_dir', return_value=tmp_path):
                with pytest.raises(ValueError) as exc_info:
                    await analyze_image_for_canvas(str(test_image), use_cache=False, max_retries=1)

            # 验证异常消息包含重试信息
            assert "已重试 1 次" in str(exc_info.value)
            # 验证尝试了2次（初始 + 1次重试）
            assert mock_instance.execute_purely.call_count == 2

    @pytest.mark.asyncio
    async def test_retry_on_parse_failure(self, tmp_path):
        """测试解析失败时的重试"""
        # 创建测试图片文件
        test_image = tmp_path / "test.jpg"
        test_image.write_bytes(b"fake image data")

        # Mock VisualUnderstanding: 第一次返回无效 JSON，第二次返回有效 JSON
        invalid_result = ToolResult(content="这不是有效的JSON", ok=True)
        valid_result = ToolResult(
            content=json.dumps({
                "summary": "解析成功",
                "detailed": {"theme": "测试"}
            }, ensure_ascii=False),
            ok=True
        )

        with patch('app.tools.design.utils.canvas_image_visual_understanding.VisualUnderstanding') as mock_class:
            mock_instance = AsyncMock()
            # 第一次返回无效内容，但由于有降级方案（markdown/纯文本），实际不会失败
            # 让我们模拟一个真正的解析错误
            mock_instance.execute_purely = AsyncMock(side_effect=[
                Exception("解析错误"),
                valid_result
            ])
            mock_class.return_value = mock_instance

            with patch('app.tools.design.utils.canvas_image_visual_understanding.PathManager.get_workspace_dir', return_value=tmp_path):
                result = await analyze_image_for_canvas(str(test_image), use_cache=False, max_retries=1)

            # 验证重试成功
            assert result.summary == "解析成功"
            assert mock_instance.execute_purely.call_count == 2
