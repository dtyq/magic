"""测试 SkillLoader"""

import pytest
import pytest_asyncio
from pathlib import Path
from agentlang.skills.loader import SkillLoader
from agentlang.skills.exceptions import (
    SkillLoadError,
    SkillParseError,
    SkillValidationError
)

pytestmark = pytest.mark.asyncio


class TestSkillLoader:
    """测试 SkillLoader 类"""

    @pytest.fixture
    def loader(self):
        """创建 SkillLoader 实例"""
        return SkillLoader()

    @pytest.fixture
    def valid_skill_file(self, tmp_path):
        """创建有效的 Skill 文件"""
        skill_file = tmp_path / "SKILL.md"
        skill_file.write_text("""---
name: test-skill
description: A test skill for unit testing
version: "1.0.0"
author: Test Author
tags:
  - test
  - example
---

# Test Skill

This is a test skill for unit testing.

## Usage

Just a test.
""")
        return skill_file

    async def test_load_valid_skill(self, loader, valid_skill_file):
        """测试加载有效的 Skill"""
        skill = await loader.load_from_file(valid_skill_file)

        assert skill.name == "test-skill"
        assert skill.description == "A test skill for unit testing"
        assert skill.version == "1.0.0"
        assert skill.author == "Test Author"
        assert "test" in skill.tags
        assert "example" in skill.tags
        assert "Test Skill" in skill.content
        assert skill.skill_file == valid_skill_file
        assert skill.skill_dir == valid_skill_file.parent

    async def test_load_minimal_skill(self, loader, tmp_path):
        """测试加载最小化的 Skill"""
        skill_file = tmp_path / "SKILL.md"
        skill_file.write_text("""---
name: minimal-skill
description: Minimal skill
---

# Minimal Skill
""")

        skill = await loader.load_from_file(skill_file)

        assert skill.name == "minimal-skill"
        assert skill.description == "Minimal skill"
        assert skill.version == "1.0.0"  # 默认值
        assert skill.author is None
        assert skill.dependencies == []

    async def test_load_nonexistent_file(self, loader):
        """测试加载不存在的文件"""
        with pytest.raises(SkillLoadError) as exc_info:
            await loader.load_from_file(Path("nonexistent.md"))
        assert "not found" in str(exc_info.value)

    async def test_load_invalid_frontmatter_no_start(self, loader, tmp_path):
        """测试无效的 frontmatter（没有开始标记）"""
        skill_file = tmp_path / "SKILL.md"
        skill_file.write_text("# No frontmatter")

        with pytest.raises(SkillParseError) as exc_info:
            await loader.load_from_file(skill_file)
        assert "must start with" in str(exc_info.value)

    async def test_load_invalid_frontmatter_no_end(self, loader, tmp_path):
        """测试无效的 frontmatter（没有结束标记）"""
        skill_file = tmp_path / "SKILL.md"
        skill_file.write_text("""---
name: test
description: test
# No closing ---
""")

        with pytest.raises(SkillParseError) as exc_info:
            await loader.load_from_file(skill_file)
        assert "missing closing" in str(exc_info.value)

    async def test_load_invalid_yaml(self, loader, tmp_path):
        """测试无效的 YAML"""
        skill_file = tmp_path / "SKILL.md"
        skill_file.write_text("""---
name: test
description: [unclosed
---
""")

        with pytest.raises(SkillParseError) as exc_info:
            await loader.load_from_file(skill_file)
        assert "Failed to parse YAML" in str(exc_info.value)

    async def test_load_missing_name(self, loader, tmp_path):
        """测试缺少必需字段 name"""
        skill_file = tmp_path / "SKILL.md"
        skill_file.write_text("""---
description: Missing name field
---
""")

        with pytest.raises(SkillValidationError) as exc_info:
            await loader.load_from_file(skill_file)
        assert "name" in str(exc_info.value)

    async def test_load_missing_description(self, loader, tmp_path):
        """测试缺少必需字段 description"""
        skill_file = tmp_path / "SKILL.md"
        skill_file.write_text("""---
name: test-skill
---
""")

        with pytest.raises(SkillValidationError) as exc_info:
            await loader.load_from_file(skill_file)
        assert "description" in str(exc_info.value)

    async def test_load_from_directory(self, loader, tmp_path):
        """测试从目录加载"""
        skill_dir = tmp_path / "test-skill"
        skill_dir.mkdir()

        skill_file = skill_dir / "SKILL.md"
        skill_file.write_text("""---
name: test-skill
description: Test
---

# Test
""")

        skill = await loader.load_from_directory(skill_dir)

        assert skill.name == "test-skill"
        assert skill.skill_dir == skill_dir

    async def test_parse_multiline_description(self, loader, tmp_path):
        """测试解析多行描述"""
        skill_file = tmp_path / "SKILL.md"
        skill_file.write_text("""---
name: test-skill
description: |
  This is a multi-line
  description for testing
  YAML parsing
---
""")

        skill = await loader.load_from_file(skill_file)

        assert "multi-line" in skill.description
        assert "YAML parsing" in skill.description
