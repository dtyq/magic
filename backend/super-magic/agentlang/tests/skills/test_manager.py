"""测试 SkillManager"""

import pytest
import pytest_asyncio
from pathlib import Path

pytestmark = pytest.mark.asyncio
from agentlang.skills.manager import SkillManager
from agentlang.skills.exceptions import (
    SkillNotFoundError,
    SkillResourceError
)


class TestSkillManager:
    """测试 SkillManager 类"""

    @pytest.fixture
    def skills_dir(self, tmp_path):
        """创建测试 Skills 目录"""
        skills_dir = tmp_path / "skills"
        skills_dir.mkdir()

        # 创建 skill1
        skill1_dir = skills_dir / "skill1"
        skill1_dir.mkdir()
        (skill1_dir / "SKILL.md").write_text("""---
name: skill1
description: First test skill
tags:
  - test
  - demo
---

# Skill 1
""")

        # 创建 skill2
        skill2_dir = skills_dir / "skill2"
        skill2_dir.mkdir()
        (skill2_dir / "SKILL.md").write_text("""---
name: skill2
description: Second test skill
enabled: false
---

# Skill 2
""")

        # 创建带 reference 的 skill3
        skill3_dir = skills_dir / "skill3"
        skill3_dir.mkdir()
        (skill3_dir / "SKILL.md").write_text("""---
name: skill3
description: Third test skill with resources
tags:
  - test
---

# Skill 3
""")
        ref_dir = skill3_dir / "reference"
        ref_dir.mkdir()
        (ref_dir / "guide.md").write_text("# Guide\n\nThis is a guide.")

        # 创建带 resources 的目录
        res_dir = skill3_dir / "resources"
        res_dir.mkdir()
        (res_dir / "data.txt").write_text("sample data")

        return skills_dir

    async def test_init_with_custom_dir(self, skills_dir):
        """测试使用自定义目录初始化"""
        manager = SkillManager(skills_dirs=skills_dir)
        assert manager.skills_dirs == [skills_dir]

    async def test_load_all_skills(self, skills_dir):
        """测试加载所有 Skills"""
        manager = SkillManager(skills_dirs=skills_dir)
        await manager.load_all_skills()

        assert len(manager._skills_cache) == 3
        assert "skill1" in manager._skills_cache
        assert "skill2" in manager._skills_cache
        assert "skill3" in manager._skills_cache

    async def test_load_all_skills_no_duplicate(self, skills_dir):
        """测试重复加载不会导致问题"""
        manager = SkillManager(skills_dirs=skills_dir)
        await manager.load_all_skills()
        await manager.load_all_skills()  # 第二次不应重新加载

        assert len(manager._skills_cache) == 3

    async def test_load_all_skills_force_reload(self, skills_dir):
        """测试强制重新加载"""
        manager = SkillManager(skills_dirs=skills_dir)
        await manager.load_all_skills()

        # 强制重新加载
        await manager.load_all_skills(force_reload=True)

        assert len(manager._skills_cache) == 3

    async def test_get_skill(self, skills_dir):
        """测试获取单个 Skill"""
        manager = SkillManager(skills_dirs=skills_dir)

        skill = await manager.get_skill("skill1")

        assert skill is not None
        assert skill.name == "skill1"
        assert skill.description == "First test skill"

    async def test_get_nonexistent_skill(self, skills_dir):
        """测试获取不存在的 Skill"""
        manager = SkillManager(skills_dirs=skills_dir)

        skill = await manager.get_skill("nonexistent")

        assert skill is None

    async def test_list_skills_all(self, skills_dir):
        """测试列出所有 Skills"""
        manager = SkillManager(skills_dirs=skills_dir)

        skills = await manager.list_skills(enabled_only=False)

        assert len(skills) == 3

    async def test_list_skills_enabled_only(self, skills_dir):
        """测试只列出启用的 Skills"""
        manager = SkillManager(skills_dirs=skills_dir)

        skills = await manager.list_skills(enabled_only=True)

        assert len(skills) == 2
        skill_names = [s.name for s in skills]
        assert "skill1" in skill_names
        assert "skill3" in skill_names
        assert "skill2" not in skill_names

    async def test_list_skills_by_tags(self, skills_dir):
        """测试按标签过滤 Skills"""
        manager = SkillManager(skills_dirs=skills_dir)

        skills = await manager.list_skills(tags=["demo"])

        assert len(skills) == 1
        assert skills[0].name == "skill1"

    async def test_search_skills_by_name(self, skills_dir):
        """测试按名称搜索"""
        manager = SkillManager(skills_dirs=skills_dir)

        results = await manager.search_skills("skill1", search_in=["name"])

        assert len(results) == 1
        assert results[0].name == "skill1"

    async def test_search_skills_by_description(self, skills_dir):
        """测试按描述搜索"""
        manager = SkillManager(skills_dirs=skills_dir)

        results = await manager.search_skills("Second", search_in=["description"])

        assert len(results) == 1
        assert results[0].name == "skill2"

    async def test_search_skills_by_tags(self, skills_dir):
        """测试按标签搜索"""
        manager = SkillManager(skills_dirs=skills_dir)

        results = await manager.search_skills("test", search_in=["tags"])

        assert len(results) == 2

    async def test_search_skills_by_content(self, skills_dir):
        """测试按内容搜索"""
        manager = SkillManager(skills_dirs=skills_dir)

        results = await manager.search_skills("Skill 3", search_in=["content"])

        assert len(results) == 1
        assert results[0].name == "skill3"

    async def test_search_skills_all_fields(self, skills_dir):
        """测试在所有字段中搜索"""
        manager = SkillManager(skills_dirs=skills_dir)

        results = await manager.search_skills("test")

        assert len(results) >= 2

    async def test_reload_skill(self, skills_dir):
        """测试重新加载 Skill"""
        manager = SkillManager(skills_dirs=skills_dir)
        await manager.load_all_skills()

        # 修改 Skill 文件
        skill_file = skills_dir / "skill1" / "SKILL.md"
        skill_file.write_text("""---
name: skill1
description: Modified description
---

# Modified
""")

        # 重新加载
        updated_skill = await manager.reload_skill("skill1")

        assert updated_skill is not None
        assert updated_skill.description == "Modified description"

    async def test_get_reference_content(self, skills_dir):
        """测试获取参考文档内容"""
        manager = SkillManager(skills_dirs=skills_dir)

        content = await manager.get_reference_content("skill3", "guide.md")

        assert "Guide" in content
        assert "This is a guide" in content

    async def test_get_reference_content_skill_not_found(self, skills_dir):
        """测试获取不存在 Skill 的参考文档"""
        manager = SkillManager(skills_dirs=skills_dir)

        with pytest.raises(SkillNotFoundError):
            await manager.get_reference_content("nonexistent", "guide.md")

    async def test_get_reference_content_no_reference_dir(self, skills_dir):
        """测试获取没有 reference 目录的 Skill 的文档"""
        manager = SkillManager(skills_dirs=skills_dir)

        with pytest.raises(SkillResourceError):
            await manager.get_reference_content("skill1", "guide.md")

    async def test_get_reference_content_file_not_found(self, skills_dir):
        """测试获取不存在的参考文档"""
        manager = SkillManager(skills_dirs=skills_dir)

        with pytest.raises(SkillResourceError):
            await manager.get_reference_content("skill3", "nonexistent.md")

    async def test_get_resource_path(self, skills_dir):
        """测试获取资源文件路径"""
        manager = SkillManager(skills_dirs=skills_dir)

        path = await manager.get_resource_path("skill3", "data.txt")

        assert path.exists()
        assert path.name == "data.txt"

    async def test_get_resource_path_skill_not_found(self, skills_dir):
        """测试获取不存在 Skill 的资源"""
        manager = SkillManager(skills_dirs=skills_dir)

        with pytest.raises(SkillNotFoundError):
            await manager.get_resource_path("nonexistent", "data.txt")

    async def test_get_resource_path_no_resources_dir(self, skills_dir):
        """测试获取没有 resources 目录的 Skill 的资源"""
        manager = SkillManager(skills_dirs=skills_dir)

        with pytest.raises(SkillResourceError):
            await manager.get_resource_path("skill1", "data.txt")

    async def test_get_resource_path_file_not_found(self, skills_dir):
        """测试获取不存在的资源文件"""
        manager = SkillManager(skills_dirs=skills_dir)

        with pytest.raises(SkillResourceError):
            await manager.get_resource_path("skill3", "nonexistent.txt")
