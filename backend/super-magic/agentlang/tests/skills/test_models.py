"""测试 SkillMetadata 模型"""

import pytest
import pytest_asyncio
from pathlib import Path

pytestmark = pytest.mark.asyncio
from agentlang.skills.models import SkillMetadata


class TestSkillMetadata:
    """测试 SkillMetadata 类"""

    async def test_create_minimal_skill(self):
        """测试创建最小化的 Skill"""
        skill = SkillMetadata(
            name="test-skill",
            description="A test skill"
        )

        assert skill.name == "test-skill"
        assert skill.description == "A test skill"
        assert skill.version == "1.0.0"
        assert skill.enabled is True
        assert skill.dependencies == []
        assert skill.tags == []

    async def test_create_full_skill(self):
        """测试创建完整的 Skill"""
        skill = SkillMetadata(
            name="advanced-skill",
            description="An advanced skill",
            version="2.0.0",
            author="Test Author",
            license="MIT",
            dependencies=["python>=3.8", "numpy"],
            tags=["data", "analysis"],
            enabled=False
        )

        assert skill.name == "advanced-skill"
        assert skill.version == "2.0.0"
        assert skill.author == "Test Author"
        assert skill.license == "MIT"
        assert len(skill.dependencies) == 2
        assert len(skill.tags) == 2
        assert skill.enabled is False

    async def test_has_scripts_without_dir(self):
        """测试没有设置目录时的 has_scripts"""
        skill = SkillMetadata(name="test", description="test")
        assert await skill.has_scripts() is False

    async def test_has_scripts_with_dir(self, tmp_path):
        """测试有目录时的 has_scripts"""
        skill_dir = tmp_path / "test-skill"
        skill_dir.mkdir()

        skill = SkillMetadata(
            name="test",
            description="test",
            skill_dir=skill_dir
        )

        # 不存在 scripts 目录
        assert await skill.has_scripts() is False

        # 创建 scripts 目录
        (skill_dir / "scripts").mkdir()
        assert await skill.has_scripts() is True

    async def test_has_reference(self, tmp_path):
        """测试 has_reference 方法"""
        skill_dir = tmp_path / "test-skill"
        skill_dir.mkdir()

        skill = SkillMetadata(
            name="test",
            description="test",
            skill_dir=skill_dir
        )

        assert await skill.has_reference() is False

        (skill_dir / "reference").mkdir()
        assert await skill.has_reference() is True

    async def test_has_resources(self, tmp_path):
        """测试 has_resources 方法"""
        skill_dir = tmp_path / "test-skill"
        skill_dir.mkdir()

        skill = SkillMetadata(
            name="test",
            description="test",
            skill_dir=skill_dir
        )

        assert await skill.has_resources() is False

        (skill_dir / "resources").mkdir()
        assert await skill.has_resources() is True

    async def test_get_scripts_dir(self, tmp_path):
        """测试 get_scripts_dir 方法"""
        skill_dir = tmp_path / "test-skill"
        skill_dir.mkdir()
        scripts_dir = skill_dir / "scripts"
        scripts_dir.mkdir()

        skill = SkillMetadata(
            name="test",
            description="test",
            skill_dir=skill_dir
        )

        result = await skill.get_scripts_dir()
        assert result == scripts_dir

    async def test_get_reference_dir(self, tmp_path):
        """测试 get_reference_dir 方法"""
        skill_dir = tmp_path / "test-skill"
        skill_dir.mkdir()
        ref_dir = skill_dir / "reference"
        ref_dir.mkdir()

        skill = SkillMetadata(
            name="test",
            description="test",
            skill_dir=skill_dir
        )

        result = await skill.get_reference_dir()
        assert result == ref_dir

    async def test_get_resources_dir(self, tmp_path):
        """测试 get_resources_dir 方法"""
        skill_dir = tmp_path / "test-skill"
        skill_dir.mkdir()
        res_dir = skill_dir / "resources"
        res_dir.mkdir()

        skill = SkillMetadata(
            name="test",
            description="test",
            skill_dir=skill_dir
        )

        result = await skill.get_resources_dir()
        assert result == res_dir
