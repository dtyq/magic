#!/usr/bin/env python3
"""
Unit tests for MultiEditFileRange tool with realistic complex replacements.
"""

import shutil
import sys
import tempfile
import textwrap
from pathlib import Path
from unittest.mock import AsyncMock, Mock

import pytest

# Add project root directory to Python path
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

# Set project root directory
from app.paths import PathManager

PathManager.set_project_root(project_root)

from agentlang.context.tool_context import ToolContext
from app.tools.multi_edit_file_range import (
    MultiEditFileRange,
    MultiEditFileRangeParams,
    RangeEditChunk,
)
from app.utils.file_timestamp_manager import get_global_timestamp_manager


class TestMultiEditFileRangeComplexScenarios:
    """Complex replacement scenarios for range-based batch editing."""

    @pytest.fixture
    def temp_workspace(self):
        temp_dir = tempfile.mkdtemp()
        workspace = Path(temp_dir)
        yield workspace
        shutil.rmtree(temp_dir)

    @pytest.fixture
    def mock_tool_context(self):
        context = Mock(spec=ToolContext)
        context._metadata = {}
        context.get_metadata = Mock(side_effect=lambda key: context._metadata.get(key))
        context.set_metadata = Mock(side_effect=lambda key, value: context._metadata.update({key: value}))

        mock_agent_context = Mock()
        mock_agent_context.dispatch_event = AsyncMock()
        context.get_extension_typed = Mock(return_value=mock_agent_context)
        return context

    @pytest.fixture
    def multi_edit_file_range_tool(self, temp_workspace):
        tool = MultiEditFileRange()
        tool.base_dir = temp_workspace
        return tool

    @pytest.mark.asyncio
    async def test_multi_chunk_replace_html_and_multilingual_doc(self, multi_edit_file_range_tool, mock_tool_context, temp_workspace):
        file_path = temp_workspace / "content.mdx"
        original = textwrap.dedent(
            """\
            <Page>
              <section id="hero">
                <h1>旧标题</h1>
                <p>Old subtitle</p>
                <button>Start</button>
              </section><!-- hero -->

              <section id="content">
                <p>Body</p>
              </section>
            </Page>

            ## 概览
            这是旧的中文描述。
            This is old English content.
            关键字：Agent、Workflow。

            ## Usage
            1. Install
            2. Run
            """
        )
        file_path.write_text(original, encoding="utf-8")
        await get_global_timestamp_manager().update_timestamp(file_path)

        params = MultiEditFileRangeParams(
            file_path="content.mdx",
            chunks=[
                RangeEditChunk(
                    replace_start='  <section id="hero">\n',
                    replace_end='  </section><!-- hero -->\n',
                    new_content=textwrap.dedent(
                        """\
                          <section id="hero">
                            <h1>新标题</h1>
                            <p>New subtitle</p>
                            <button>Launch</button>
                            <small>Updated 2026</small>
                          </section><!-- hero -->
                        """
                    ),
                ),
                RangeEditChunk(
                    replace_start="## 概览\n",
                    replace_end="## Usage\n",
                    new_content=textwrap.dedent(
                        """\
                        ## 概览
                        本节已更新，支持中英混排与术语统一。
                        Updated section with multilingual alignment and clearer wording.
                        关键字：Agent、Range Edit、Workflow。

                        ## Usage
                        """
                    ),
                ),
            ],
        )

        result = await multi_edit_file_range_tool.execute(mock_tool_context, params)
        assert result.ok, f"Expected success, got error: {result.content}"
        assert "Applied 2 range chunk(s) successfully" in result.content

        edited = file_path.read_text(encoding="utf-8")
        assert "<h1>新标题</h1>" in edited
        assert "Launch" in edited
        assert "multilingual alignment" in edited
        assert "<section id=\"content\">" in edited
        assert edited.count("## Usage") == 1

    @pytest.mark.asyncio
    async def test_overlapping_chunks_should_fail_atomically(self, multi_edit_file_range_tool, mock_tool_context, temp_workspace):
        file_path = temp_workspace / "doc.md"
        original = textwrap.dedent(
            """\
            # Title
            ## A
            line a1
            line a2
            ## B
            line b1
            ## C
            line c1
            """
        )
        file_path.write_text(original, encoding="utf-8")
        await get_global_timestamp_manager().update_timestamp(file_path)

        params = MultiEditFileRangeParams(
            file_path="doc.md",
            chunks=[
                RangeEditChunk(
                    replace_start="## A\n",
                    replace_end="## B\n",
                    new_content="## A\nA replaced\n## B\n",
                ),
                RangeEditChunk(
                    replace_start="line a2\n",
                    replace_end="## C\n",
                    new_content="line a2\nBetween replaced\n## C\n",
                ),
            ],
        )

        result = await multi_edit_file_range_tool.execute(mock_tool_context, params)
        assert not result.ok
        assert "Chunk range conflict detected" in result.content

        # Atomic behavior: file should remain unchanged on conflict.
        assert file_path.read_text(encoding="utf-8") == original

    @pytest.mark.asyncio
    async def test_ambiguous_anchor_chunk_should_fail_and_keep_original(self, multi_edit_file_range_tool, mock_tool_context, temp_workspace):
        file_path = temp_workspace / "list.html"
        original = textwrap.dedent(
            """\
            <ul>
              <li>
                Alpha
              </li>
              <li>
                Beta
              </li>
            </ul>
            """
        )
        file_path.write_text(original, encoding="utf-8")
        await get_global_timestamp_manager().update_timestamp(file_path)

        params = MultiEditFileRangeParams(
            file_path="list.html",
            chunks=[
                RangeEditChunk(
                    replace_start="  <li>\n",
                    replace_end="  </li>\n",
                    new_content="  <li>\n    Replaced\n  </li>\n",
                ),
                RangeEditChunk(
                    replace_start="<ul>\n",
                    replace_end="</ul>\n",
                    new_content="<ul>\n  <li>Only One</li>\n</ul>\n",
                ),
            ],
        )

        result = await multi_edit_file_range_tool.execute(mock_tool_context, params)
        assert not result.ok
        assert "Chunk 1 range match failed" in result.content
        assert "ambiguous" in result.content.lower()
        assert file_path.read_text(encoding="utf-8") == original

    @pytest.mark.asyncio
    async def test_mixed_chunks_with_tail_replacement(self, multi_edit_file_range_tool, mock_tool_context, temp_workspace):
        file_path = temp_workspace / "release.md"
        original = textwrap.dedent(
            """\
            # Release Notes

            ## Hero
            Legacy line 1
            Legacy line 2

            ## Changelog
            - v1.0 初始版本
            - v1.1 修复 typo
            """
        )
        file_path.write_text(original, encoding="utf-8")
        await get_global_timestamp_manager().update_timestamp(file_path)

        params = MultiEditFileRangeParams(
            file_path="release.md",
            chunks=[
                RangeEditChunk(
                    replace_start="## Hero\n",
                    replace_end="Legacy line 2\n",
                    new_content=textwrap.dedent(
                        """\
                        ## Hero
                        New hero block for multilingual docs.
                        """
                    ),
                ),
                RangeEditChunk(
                    replace_start="## Changelog\n",
                    replace_end="",
                    new_content=textwrap.dedent(
                        """\
                        ## Changelog
                        - v2.0 统一 inclusive 区间语义
                        - v2.1 新增批量 range 编辑能力
                        """
                    ),
                ),
            ],
        )

        result = await multi_edit_file_range_tool.execute(mock_tool_context, params)
        assert result.ok, f"Expected success, got error: {result.content}"

        edited = file_path.read_text(encoding="utf-8")
        assert "New hero block for multilingual docs." in edited
        assert "v2.0 统一 inclusive 区间语义" in edited
        assert "v1.0 初始版本" not in edited
