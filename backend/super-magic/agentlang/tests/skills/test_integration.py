"""集成测试 - 验证完整工作流"""

import pytest
from pathlib import Path
from agentlang.skills import SkillManager


class TestSkillsIntegration:
    """Skills 管理器集成测试"""

    @pytest.fixture
    def manager(self, tmp_path):
        """创建带测试 Skills 的管理器"""
        skills_dir = tmp_path / "skills"
        skills_dir.mkdir()

        # 创建测试 Skill
        skill_dir = skills_dir / "test-skill"
        skill_dir.mkdir()

        (skill_dir / "SKILL.md").write_text("""---
name: test-skill
description: Integration test skill
tags:
  - test
---

# Test Skill

Integration test.
""")

        # 创建脚本目录和脚本
        scripts_dir = skill_dir / "scripts"
        scripts_dir.mkdir()

        (scripts_dir / "hello.py").write_text("""
import sys
import json

args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
name = args.get("name", "World")
result = {"message": f"Hello, {name}!"}
print(json.dumps(result))
""")

        # 创建参考文档
        ref_dir = skill_dir / "reference"
        ref_dir.mkdir()
        (ref_dir / "guide.md").write_text("# Guide\n\nTest guide content.")

        # 创建资源
        res_dir = skill_dir / "resources"
        res_dir.mkdir()
        (res_dir / "data.txt").write_text("Test data")

        return SkillManager(skills_dirs=skills_dir)

    @pytest.mark.asyncio
    async def test_complete_workflow(self, manager):
        """测试完整工作流"""
        # 1. 加载所有 Skills
        await manager.load_all_skills()

        # 2. 获取 Skill
        skill = await manager.get_skill("test-skill")
        assert skill is not None
        assert skill.name == "test-skill"

        # 3. 列出 Skills
        skills = await manager.list_skills()
        assert len(skills) == 1

        # 4. 搜索 Skills
        results = await manager.search_skills("test")
        assert len(results) == 1

        # 5. 获取参考文档
        guide = await manager.get_reference_content("test-skill", "guide.md")
        assert "Test guide" in guide

        # 6. 获取资源路径
        data_path = await manager.get_resource_path("test-skill", "data.txt")
        assert data_path.exists()
        assert data_path.read_text() == "Test data"

    @pytest.mark.asyncio
    async def test_search_and_filter(self, manager):
        """测试搜索和过滤功能"""
        await manager.load_all_skills()

        # 按标签过滤
        test_skills = await manager.list_skills(tags=["test"])
        assert len(test_skills) == 1

        # 按描述搜索
        results = await manager.search_skills("Integration", search_in=["description"])
        assert len(results) == 1

        # 按内容搜索
        results = await manager.search_skills("Integration", search_in=["content"])
        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_reload_workflow(self, manager):
        """测试重新加载工作流"""
        await manager.load_all_skills()

        # 获取原始 Skill
        skill = await manager.get_skill("test-skill")
        original_description = skill.description

        # 修改 Skill 文件
        skill.skill_file.write_text("""---
name: test-skill
description: Modified description
---

# Modified
""")

        # 重新加载
        updated_skill = await manager.reload_skill("test-skill")
        assert updated_skill.description == "Modified description"
        assert updated_skill.description != original_description

    @pytest.mark.asyncio
    async def test_caching_behavior(self, manager):
        """测试缓存行为"""
        # 首次加载
        await manager.load_all_skills()
        first_load_time = manager._cache_timestamp

        # 第二次加载不应重新加载（使用缓存）
        await manager.load_all_skills()
        assert manager._cache_timestamp == first_load_time

        # 强制重新加载
        await manager.load_all_skills(force_reload=True)
        assert manager._cache_timestamp != first_load_time

    @pytest.mark.asyncio
    async def test_error_handling(self, manager):
        """测试错误处理"""
        from agentlang.skills.exceptions import (
            SkillNotFoundError,
            SkillResourceError
        )

        await manager.load_all_skills()

        # 获取不存在的 Skill
        skill = await manager.get_skill("nonexistent")
        assert skill is None

        # 访问不存在的参考文档
        with pytest.raises(SkillResourceError):
            await manager.get_reference_content("test-skill", "nonexistent.md")
