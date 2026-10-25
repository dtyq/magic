import pytest

from app.i18n import i18n
from app.tools.core import AutoMount, tool_factory
from app.tools.get_user_language import GetUserLanguage, GetUserLanguageParams


@pytest.fixture(autouse=True)
def reset_language():
    i18n.reset_language()
    yield
    i18n.reset_language()


@pytest.mark.asyncio
async def test_get_user_language_returns_current_agent_task_language():
    i18n.set_language("fr_FR")

    result = await GetUserLanguage().execute(None, GetUserLanguageParams())

    assert result.ok is True
    assert result.content == "The current Agent task language is fr_FR."
    assert result.data == {"language": "fr_FR"}


@pytest.mark.asyncio
async def test_get_user_language_uses_default_language():
    result = await GetUserLanguage().execute(None, GetUserLanguageParams())

    assert result.ok is True
    assert result.data == {"language": "zh_CN"}


def test_get_user_language_is_available_to_agents_and_skill_auto_mount():
    tool_info = tool_factory.get_tool("get_user_language")

    assert tool_info is not None
    assert tool_info.code_mode_only is False
    assert tool_info.auto_mount == AutoMount.SKILLS
    assert "get_user_language" in tool_factory.get_auto_mount_tool_names(AutoMount.SKILLS)
