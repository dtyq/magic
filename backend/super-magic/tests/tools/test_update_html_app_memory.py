import pytest

from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n
from app.tools import UpdateHtmlAppMemory as ExportedUpdateHtmlAppMemory
from app.tools.update_html_app_memory import UpdateHtmlAppMemory


def test_update_html_app_memory_is_exported_for_packaging():
    assert ExportedUpdateHtmlAppMemory is UpdateHtmlAppMemory


@pytest.mark.asyncio
async def test_update_html_app_memory_has_localized_action_and_remark():
    tool = UpdateHtmlAppMemory()
    try:
        i18n.set_language("zh_CN")
        before = await tool.get_before_tool_call_friendly_action_and_remark(
            tool.name, None, {"app_name": "客户反馈"}
        )
        after = await tool.get_after_tool_call_friendly_action_and_remark(
            tool.name,
            None,
            ToolResult(content="ok"),
            0.1,
            {"app_name": "客户反馈"},
        )

        assert before["action"] == "更新微应用信息"
        assert before["remark"] == "记录最新功能与数据结构"
        assert after["remark"] == "记录最新功能与数据结构"

        detail = await tool.get_tool_detail(None, ToolResult(content="ok"))
        assert detail.data.content == "微应用信息已更新。"

        i18n.set_language("en_US")
        english = await tool.get_before_tool_call_friendly_action_and_remark(
            tool.name, None, {"app_name": "Customer feedback"}
        )
        assert english["action"] == "Update micro-app details"
        assert english["remark"] == "Record the latest features and data model"
    finally:
        i18n.reset_language()
