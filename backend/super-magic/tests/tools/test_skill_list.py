"""Unit tests for SkillList tool — shadow 标注、source 过滤、空结果等核心逻辑。

采用 patch 替换三个内部 _list_* 方法，完全不依赖真实磁盘目录。
"""

import sys
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

import pytest

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

from app.paths import PathManager
PathManager.set_project_root(project_root)

from agentlang.context.tool_context import ToolContext
from app.tools.skill_list import SkillItem, SkillList, SkillListParams, _SHADOW_SAME_NAME_NOTE


# ---------------------------------------------------------------------------
# 辅助工厂
# ---------------------------------------------------------------------------

def _item(name: str, source: str, can_override: bool, description: str = "") -> SkillItem:
    return SkillItem(name=name, source=source, can_override=can_override, description=description)


def _mock_ctx() -> Mock:
    return Mock(spec=ToolContext)


def _tool() -> SkillList:
    return SkillList()


def _params(source: str = "all") -> SkillListParams:
    return SkillListParams(source=source)


# ---------------------------------------------------------------------------
# 测试：SkillItem 结构
# ---------------------------------------------------------------------------

class TestSkillItem:
    def test_defaults(self):
        item = SkillItem(name="foo", source="system", can_override=False)
        assert item.description == ""
        assert item.path == ""
        assert item.note is None

    def test_note_assignable(self):
        item = SkillItem(name="foo", source="crew", can_override=True)
        item.note = "some note"
        assert item.note == "some note"


# ---------------------------------------------------------------------------
# 测试：source=all，无同名冲突
# ---------------------------------------------------------------------------

class TestExecuteAllNoConflict:
    @pytest.fixture
    def skills(self):
        return {
            "system": [_item("alpha", "system", False), _item("beta", "system", False)],
            "crew":   [_item("gamma", "crew",   True)],
            "workspace": [_item("delta", "workspace", True)],
        }

    @pytest.mark.asyncio
    async def test_all_sources_returned(self, skills):
        tool = _tool()
        tool._list_system_skills = AsyncMock(return_value=skills["system"])
        tool._list_crew_skills   = AsyncMock(return_value=skills["crew"])
        tool._list_workspace_skills = AsyncMock(return_value=skills["workspace"])

        result = await tool.execute(_mock_ctx(), _params("all"))
        content = result.content

        for name in ("alpha", "beta", "gamma", "delta"):
            assert name in content

    @pytest.mark.asyncio
    async def test_no_shadow_note_when_no_conflict(self, skills):
        tool = _tool()
        tool._list_system_skills    = AsyncMock(return_value=skills["system"])
        tool._list_crew_skills      = AsyncMock(return_value=skills["crew"])
        tool._list_workspace_skills = AsyncMock(return_value=skills["workspace"])

        result = await tool.execute(_mock_ctx(), _params("all"))
        assert "NOTE" not in result.content


# ---------------------------------------------------------------------------
# 测试：crew 与 system 同名 → crew 被 shadow
# ---------------------------------------------------------------------------

class TestShadowCrewBySytem:
    @pytest.mark.asyncio
    async def test_crew_same_name_as_system_gets_shadow(self):
        system_skills    = [_item("shared", "system", False)]
        crew_skills      = [_item("shared", "crew",   True)]
        workspace_skills: list = []

        tool = _tool()
        tool._list_system_skills    = AsyncMock(return_value=system_skills)
        tool._list_crew_skills      = AsyncMock(return_value=crew_skills)
        tool._list_workspace_skills = AsyncMock(return_value=workspace_skills)

        result = await tool.execute(_mock_ctx(), _params("all"))
        # 返回文本中应出现两个 [system] shared 和 [crew] shared，后者带 NOTE
        assert _SHADOW_SAME_NAME_NOTE in result.content
        # crew 上的 note 被设置
        assert crew_skills[0].note == _SHADOW_SAME_NAME_NOTE

    @pytest.mark.asyncio
    async def test_unrelated_crew_not_shadowed(self):
        system_skills    = [_item("alpha", "system", False)]
        crew_skills      = [_item("beta",  "crew",   True)]
        workspace_skills: list = []

        tool = _tool()
        tool._list_system_skills    = AsyncMock(return_value=system_skills)
        tool._list_crew_skills      = AsyncMock(return_value=crew_skills)
        tool._list_workspace_skills = AsyncMock(return_value=workspace_skills)

        await tool.execute(_mock_ctx(), _params("all"))
        assert crew_skills[0].note is None


# ---------------------------------------------------------------------------
# 测试：workspace 与 system/crew 同名 → workspace 被 shadow
# ---------------------------------------------------------------------------

class TestShadowWorkspace:
    @pytest.mark.asyncio
    async def test_workspace_same_name_as_system_gets_shadow(self):
        system_skills    = [_item("shared", "system",    False)]
        crew_skills:list = []
        workspace_skills = [_item("shared", "workspace", True)]

        tool = _tool()
        tool._list_system_skills    = AsyncMock(return_value=system_skills)
        tool._list_crew_skills      = AsyncMock(return_value=crew_skills)
        tool._list_workspace_skills = AsyncMock(return_value=workspace_skills)

        result = await tool.execute(_mock_ctx(), _params("all"))
        assert _SHADOW_SAME_NAME_NOTE in result.content
        assert workspace_skills[0].note == _SHADOW_SAME_NAME_NOTE

    @pytest.mark.asyncio
    async def test_workspace_same_name_as_crew_gets_shadow(self):
        system_skills:list = []
        crew_skills      = [_item("shared", "crew",      True)]
        workspace_skills = [_item("shared", "workspace", True)]

        tool = _tool()
        tool._list_system_skills    = AsyncMock(return_value=system_skills)
        tool._list_crew_skills      = AsyncMock(return_value=crew_skills)
        tool._list_workspace_skills = AsyncMock(return_value=workspace_skills)

        result = await tool.execute(_mock_ctx(), _params("all"))
        assert _SHADOW_SAME_NAME_NOTE in result.content
        assert workspace_skills[0].note == _SHADOW_SAME_NAME_NOTE

    @pytest.mark.asyncio
    async def test_workspace_unique_name_not_shadowed(self):
        system_skills    = [_item("alpha",  "system",    False)]
        crew_skills:list = []
        workspace_skills = [_item("unique", "workspace", True)]

        tool = _tool()
        tool._list_system_skills    = AsyncMock(return_value=system_skills)
        tool._list_crew_skills      = AsyncMock(return_value=crew_skills)
        tool._list_workspace_skills = AsyncMock(return_value=workspace_skills)

        await tool.execute(_mock_ctx(), _params("all"))
        assert workspace_skills[0].note is None


# ---------------------------------------------------------------------------
# 测试：source 过滤
# ---------------------------------------------------------------------------

class TestSourceFilter:
    @pytest.mark.asyncio
    async def test_source_system_only(self):
        tool = _tool()
        tool._list_system_skills    = AsyncMock(return_value=[_item("sys-skill", "system", False)])
        tool._list_crew_skills      = AsyncMock(return_value=[_item("crew-skill", "crew", True)])
        tool._list_workspace_skills = AsyncMock(return_value=[_item("ws-skill", "workspace", True)])

        result = await tool.execute(_mock_ctx(), _params("system"))
        assert "[system]" in result.content
        assert "crew-skill" not in result.content
        assert "ws-skill" not in result.content
        tool._list_crew_skills.assert_not_called()
        tool._list_workspace_skills.assert_not_called()

    @pytest.mark.asyncio
    async def test_source_crew_only(self):
        tool = _tool()
        tool._list_system_skills    = AsyncMock(return_value=[_item("sys-skill", "system", False)])
        tool._list_crew_skills      = AsyncMock(return_value=[_item("crew-skill", "crew", True)])
        tool._list_workspace_skills = AsyncMock(return_value=[_item("ws-skill", "workspace", True)])

        result = await tool.execute(_mock_ctx(), _params("crew"))
        assert "crew-skill" in result.content
        assert "sys-skill" not in result.content
        tool._list_system_skills.assert_not_called()

    @pytest.mark.asyncio
    async def test_source_workspace_only(self):
        tool = _tool()
        tool._list_system_skills    = AsyncMock(return_value=[_item("sys-skill", "system", False)])
        tool._list_crew_skills      = AsyncMock(return_value=[_item("crew-skill", "crew", True)])
        tool._list_workspace_skills = AsyncMock(return_value=[_item("ws-skill", "workspace", True)])

        result = await tool.execute(_mock_ctx(), _params("workspace"))
        assert "ws-skill" in result.content
        assert "sys-skill" not in result.content

    @pytest.mark.asyncio
    async def test_invalid_source_falls_back_to_all(self):
        tool = _tool()
        tool._list_system_skills    = AsyncMock(return_value=[_item("a", "system", False)])
        tool._list_crew_skills      = AsyncMock(return_value=[])
        tool._list_workspace_skills = AsyncMock(return_value=[_item("b", "workspace", True)])

        result = await tool.execute(_mock_ctx(), _params("unknown_source"))
        # 回退 all，三个方法均被调用
        assert "[system]" in result.content
        assert "[workspace]" in result.content


# ---------------------------------------------------------------------------
# 测试：空结果
# ---------------------------------------------------------------------------

class TestEmptyResult:
    @pytest.mark.asyncio
    async def test_all_empty_returns_no_skills_found(self):
        tool = _tool()
        tool._list_system_skills    = AsyncMock(return_value=[])
        tool._list_crew_skills      = AsyncMock(return_value=[])
        tool._list_workspace_skills = AsyncMock(return_value=[])

        result = await tool.execute(_mock_ctx(), _params("all"))
        assert result.content == "No skills found."

    @pytest.mark.asyncio
    async def test_crew_empty_no_agent_type(self):
        """当 GlobalSkillManager 返回空 agent type 时，_list_crew_skills 应返回空列表"""
        with patch("app.tools.skill_list.GlobalSkillManager") as mock_mgr:
            mock_mgr.get_current_agent_type.return_value = ""
            tool = _tool()
            result = await tool._list_crew_skills()
        assert result == []


# ---------------------------------------------------------------------------
# 测试：输出格式
# ---------------------------------------------------------------------------

class TestOutputFormat:
    @pytest.mark.asyncio
    async def test_priority_header_present(self):
        tool = _tool()
        tool._list_system_skills    = AsyncMock(return_value=[_item("x", "system", False)])
        tool._list_crew_skills      = AsyncMock(return_value=[])
        tool._list_workspace_skills = AsyncMock(return_value=[])

        result = await tool.execute(_mock_ctx(), _params("all"))
        assert "Priority: system > crew > workspace" in result.content

    @pytest.mark.asyncio
    async def test_total_count_in_output(self):
        tool = _tool()
        tool._list_system_skills    = AsyncMock(return_value=[_item("a", "system", False), _item("b", "system", False)])
        tool._list_crew_skills      = AsyncMock(return_value=[_item("c", "crew", True)])
        tool._list_workspace_skills = AsyncMock(return_value=[])

        result = await tool.execute(_mock_ctx(), _params("all"))
        assert "Total: 3 skill(s)" in result.content

    @pytest.mark.asyncio
    async def test_description_shown_when_present(self):
        tool = _tool()
        tool._list_system_skills    = AsyncMock(return_value=[_item("sk", "system", False, description="does something")])
        tool._list_crew_skills      = AsyncMock(return_value=[])
        tool._list_workspace_skills = AsyncMock(return_value=[])

        result = await tool.execute(_mock_ctx(), _params("system"))
        assert "does something" in result.content

    @pytest.mark.asyncio
    async def test_can_override_false_for_system(self):
        tool = _tool()
        tool._list_system_skills    = AsyncMock(return_value=[_item("sk", "system", False)])
        tool._list_crew_skills      = AsyncMock(return_value=[])
        tool._list_workspace_skills = AsyncMock(return_value=[])

        result = await tool.execute(_mock_ctx(), _params("system"))
        assert "can_override=False" in result.content

    @pytest.mark.asyncio
    async def test_can_override_true_for_workspace(self):
        tool = _tool()
        tool._list_system_skills    = AsyncMock(return_value=[])
        tool._list_crew_skills      = AsyncMock(return_value=[])
        tool._list_workspace_skills = AsyncMock(return_value=[_item("ws", "workspace", True)])

        result = await tool.execute(_mock_ctx(), _params("workspace"))
        assert "can_override=True" in result.content
