import pytest

from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n
from app.tools.magicbase_tools import (
    BatchCreateMagicRows,
    BatchDeleteMagicRows,
    BatchGetMagicRows,
    CreateMagicColumn,
    CreateMagicRow,
    CreateMagicTable,
    DeleteMagicColumn,
    DeleteMagicRow,
    DeleteMagicTable,
    GetMagicRow,
    GetMagicTable,
    QueryMagicRows,
    QueryMagicTables,
    UpdateMagicColumn,
    UpdateMagicRow,
    UpdateMagicTablePermissions,
)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tool_class", "tool_name", "zh_action", "en_action"),
    [
        (QueryMagicTables, "query_magicbase_tables", "查询数据表", "Query tables"),
        (GetMagicTable, "get_magicbase_table", "查看数据表", "View table"),
        (QueryMagicRows, "query_magicbase_rows", "查询数据记录", "Query rows"),
        (BatchGetMagicRows, "batch_get_magicbase_rows", "批量查看数据记录", "Batch view rows"),
        (GetMagicRow, "get_magicbase_row", "查看数据记录", "View row"),
        (CreateMagicRow, "create_magicbase_row", "新增数据记录", "Create row"),
        (UpdateMagicRow, "update_magicbase_row", "更新数据记录", "Update row"),
        (
            BatchCreateMagicRows,
            "batch_create_magicbase_rows",
            "批量新增数据记录",
            "Batch create rows",
        ),
        (DeleteMagicRow, "delete_magicbase_row", "删除数据记录", "Delete row"),
        (
            BatchDeleteMagicRows,
            "batch_delete_magicbase_rows",
            "批量删除数据记录",
            "Batch delete rows",
        ),
        (CreateMagicTable, "create_magicbase_table", "创建数据表", "Create table"),
        (CreateMagicColumn, "create_magicbase_column", "创建字段", "Create field"),
        (
            UpdateMagicTablePermissions,
            "update_magicbase_table_permissions",
            "更新数据表权限",
            "Update table permissions",
        ),
        (DeleteMagicTable, "delete_magicbase_table", "删除数据表", "Delete table"),
        (UpdateMagicColumn, "update_magicbase_column", "更新字段", "Update field"),
        (DeleteMagicColumn, "delete_magicbase_column", "删除字段", "Delete field"),
    ],
)
async def test_magicbase_tool_actions_are_localized(tool_class, tool_name, zh_action, en_action):
    tool = tool_class()
    try:
        i18n.set_language("zh_CN")
        zh = await tool.get_before_tool_call_friendly_action_and_remark(tool_name, None, {})
        assert zh["action"] == zh_action

        i18n.set_language("en_US")
        en = await tool.get_before_tool_call_friendly_action_and_remark(tool_name, None, {})
        assert en["action"] == en_action
    finally:
        i18n.reset_language()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tool", "tool_name", "arguments", "expected_remark"),
    [
        (QueryMagicTables(), "query_magicbase_tables", {}, "当前微应用"),
        (GetMagicTable(), "get_magicbase_table", {"table_id": "table-1"}, "表结构与权限"),
        (QueryMagicRows(), "query_magicbase_rows", {"table_id": "table-1"}, "表 table-1"),
        (
            BatchGetMagicRows(),
            "batch_get_magicbase_rows",
            {"table_id": "table-1", "record_ids": ["1", "2"]},
            "2 条记录",
        ),
        (GetMagicRow(), "get_magicbase_row", {"table_id": "table-1"}, "查看记录详情"),
        (CreateMagicRow(), "create_magicbase_row", {"table_id": "table-1"}, "保存业务数据"),
        (UpdateMagicRow(), "update_magicbase_row", {"table_id": "table-1"}, "更新业务数据"),
        (
            BatchCreateMagicRows(),
            "batch_create_magicbase_rows",
            {"table_id": "table-1", "rows": [{}, {}]},
            "2 条记录",
        ),
        (
            DeleteMagicRow(),
            "delete_magicbase_row",
            {"table_id": "table-1", "record_id": "row-1"},
            "指定记录",
        ),
        (
            BatchDeleteMagicRows(),
            "batch_delete_magicbase_rows",
            {"table_id": "table-1", "record_ids": ["row-1", "row-2"]},
            "2 条记录",
        ),
        (CreateMagicTable(), "create_magicbase_table", {"table_name": "客户反馈"}, "客户反馈"),
        (CreateMagicColumn(), "create_magicbase_column", {"column_name": "联系电话"}, "联系电话"),
        (
            UpdateMagicTablePermissions(),
            "update_magicbase_table_permissions",
            {"table_id": "table-1"},
            "读写范围",
        ),
        (DeleteMagicTable(), "delete_magicbase_table", {"table_id": "table-1"}, "指定数据表"),
        (
            UpdateMagicColumn(),
            "update_magicbase_column",
            {"column_id": "column-1", "column_name": "联系电话"},
            "联系电话",
        ),
        (DeleteMagicColumn(), "delete_magicbase_column", {"column_id": "column-1"}, "指定字段"),
    ],
)
async def test_magicbase_tools_describe_their_target_before_and_after_execution(
    tool, tool_name, arguments, expected_remark
):
    try:
        i18n.set_language("zh_CN")
        before = await tool.get_before_tool_call_friendly_action_and_remark(
            tool_name, None, arguments
        )
        after = await tool.get_after_tool_call_friendly_action_and_remark(
            tool_name,
            None,
            ToolResult(content="ok"),
            0.1,
            arguments,
        )

        assert before["remark"]
        assert expected_remark in before["remark"]
        assert after["remark"]
        assert expected_remark in after["remark"]
    finally:
        i18n.reset_language()


@pytest.mark.asyncio
async def test_query_magicbase_rows_remark_exposes_query_scope_and_result_count():
    tool = QueryMagicRows()
    arguments = {
        "table_id": "table-orders",
        "filter": {"status": {"eq": "pending"}},
        "page": 2,
    }
    result = ToolResult(
        content="ok",
        data={
            "table_id": "table-orders",
            "page": 2,
            "total": 37,
            "rows": [{"id": "row-21"}, {"id": "row-22"}],
        },
    )

    try:
        i18n.set_language("zh_CN")
        before = await tool.get_before_tool_call_friendly_action_and_remark(
            "query_magicbase_rows", None, arguments
        )
        after = await tool.get_after_tool_call_friendly_action_and_remark(
            "query_magicbase_rows", None, result, 0.1, arguments
        )

        assert before["remark"] == "status 筛选 · 第 2 页 · 表 table-orders"
        assert after["remark"] == "返回 2/37 条 · 表 table-orders"

        i18n.set_language("en_US")
        before = await tool.get_before_tool_call_friendly_action_and_remark(
            "query_magicbase_rows", None, arguments
        )
        after = await tool.get_after_tool_call_friendly_action_and_remark(
            "query_magicbase_rows", None, result, 0.1, arguments
        )

        assert before["remark"] == "Filtered by status · Page 2 · Table table-orders"
        assert after["remark"] == "2/37 rows returned · Table table-orders"
    finally:
        i18n.reset_language()


@pytest.mark.asyncio
async def test_batch_get_magicbase_rows_exposes_localized_error_detail():
    tool = BatchGetMagicRows()
    result = ToolResult.error("internal service error")

    try:
        i18n.set_language("zh_CN")
        detail = await tool.get_tool_detail(None, result, {})

        assert detail is not None
        assert detail.data.content == "批量查看数据记录失败，请稍后重试或检查记录范围。"
        assert "internal service error" not in detail.data.content
    finally:
        i18n.reset_language()


@pytest.mark.asyncio
async def test_batch_get_magicbase_rows_remark_reports_completed_count():
    tool = BatchGetMagicRows()
    arguments = {"table_id": "table-orders", "record_ids": ["1", "2"]}
    result = ToolResult(
        content="ok",
        data={"table_id": "table-orders", "returned": 1, "rows": [{"id": "1"}]},
    )

    try:
        i18n.set_language("zh_CN")
        after = await tool.get_after_tool_call_friendly_action_and_remark(
            "batch_get_magicbase_rows", None, result, 0.1, arguments
        )

        assert after["remark"] == "返回 1/2 条 · 表 table-orders"
    finally:
        i18n.reset_language()
