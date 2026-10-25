from typing import Any, Dict, Optional

from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n


def _text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _result_data(result: Optional[ToolResult]) -> Dict[str, Any]:
    if result is None or not isinstance(result.data, dict):
        return {}
    return result.data


def _table_name(arguments: Dict[str, Any], result: Optional[ToolResult]) -> str:
    table = _result_data(result).get("table")
    if not isinstance(table, dict):
        table = {}
    return _text(
        arguments.get("table_name")
        or table.get("table_name")
        or table.get("tableName")
        or arguments.get("table_key")
        or table.get("table_key")
        or table.get("tableKey")
    )


def _column_name(arguments: Dict[str, Any], result: Optional[ToolResult]) -> str:
    column = _result_data(result).get("column")
    if not isinstance(column, dict):
        column = {}
    return _text(
        arguments.get("column_name")
        or column.get("column_name")
        or column.get("columnName")
        or arguments.get("column_key")
        or column.get("column_key")
        or column.get("columnKey")
    )


def _table_reference(arguments: Dict[str, Any], result: Optional[ToolResult]) -> str:
    data = _result_data(result)
    return _table_name(arguments, result) or _text(
        arguments.get("table_id") or data.get("table_id")
    )


def _translated(code: str, **kwargs: Any) -> str:
    return i18n.translate(code, category="tool.messages", **kwargs)


def _query_rows_remark(
    arguments: Dict[str, Any],
    result: Optional[ToolResult],
) -> str:
    table = _table_reference(arguments, result)
    table_label = (
        _translated("magicbase.table_target", table=table)
        if table
        else _translated("magicbase.current_table")
    )
    data = _result_data(result)
    rows = data.get("rows")
    total = data.get("total")
    if isinstance(rows, list) and isinstance(total, int):
        return _translated(
            "magicbase.query_rows_result",
            table=table_label,
            returned=len(rows),
            total=total,
        )

    page = arguments.get("page") or data.get("page") or 1
    query_filter = arguments.get("filter")
    if isinstance(query_filter, dict) and query_filter:
        fields = "、".join(str(field) for field in query_filter)
        return _translated(
            "magicbase.query_rows_filtered_page",
            table=table_label,
            fields=fields,
            page=page,
        )
    return _translated("magicbase.query_rows_page", table=table_label, page=page)


def _batch_get_rows_remark(
    arguments: Dict[str, Any],
    result: Optional[ToolResult],
) -> str:
    table = _table_reference(arguments, result)
    table_label = (
        _translated("magicbase.table_target", table=table)
        if table
        else _translated("magicbase.current_table")
    )
    data = _result_data(result)
    requested = arguments.get("record_ids")
    if not isinstance(requested, list):
        requested = data.get("requested_record_ids")
    requested_count = len(requested) if isinstance(requested, list) else 0
    returned = data.get("returned")
    if not isinstance(returned, int):
        rows = data.get("rows")
        if not isinstance(rows, list):
            return _translated("magicbase.row_count", count=requested_count)
        returned = len(rows)
    return _translated(
        "magicbase.batch_query_rows_result",
        returned=returned,
        requested=requested_count,
        table=table_label,
    )


def build_magicbase_tool_remark(
    tool_name: str,
    arguments: Optional[Dict[str, Any]] = None,
    result: Optional[ToolResult] = None,
) -> str:
    arguments = arguments or {}
    data = _result_data(result)

    if tool_name == "query_magicbase_tables":
        target = _table_name(arguments, result)
        if target:
            return target
        tables = data.get("tables")
        if isinstance(tables, list) and tables:
            return _translated("magicbase.table_count", count=len(tables))
        return _translated("magicbase.current_micro_app")

    if tool_name == "query_magicbase_tables_all_mentioned_apps":
        apps = data.get("apps")
        if isinstance(apps, list) and apps:
            total = sum(len(app.get("tables") or []) for app in apps if isinstance(app, dict))
            return _translated("magicbase.table_count", count=total)
        return _translated("magicbase.current_micro_app")

    if tool_name == "create_magicbase_table":
        return _table_name(arguments, result)

    if tool_name in {"create_magicbase_column", "update_magicbase_column"}:
        return _column_name(arguments, result)

    if tool_name in {"batch_create_magicbase_rows", "batch_delete_magicbase_rows"}:
        values = arguments.get("rows") or arguments.get("record_ids") or []
        if not isinstance(values, list):
            values = []
        count = len(values) or data.get("created_count") or data.get("deleted_count") or 0
        return _translated("magicbase.row_count", count=count)

    if tool_name == "query_magicbase_rows":
        return _query_rows_remark(arguments, result)

    if tool_name == "batch_get_magicbase_rows":
        return _batch_get_rows_remark(arguments, result)

    message_by_tool = {
        "get_magicbase_table": "magicbase.table_structure",
        "get_magicbase_row": "magicbase.view_record",
        "create_magicbase_row": "magicbase.save_business_data",
        "update_magicbase_row": "magicbase.update_business_data",
        "delete_magicbase_row": "magicbase.selected_record",
        "update_magicbase_table_permissions": "magicbase.permission_scope",
        "delete_magicbase_table": "magicbase.selected_table",
        "delete_magicbase_column": "magicbase.selected_column",
    }
    if code := message_by_tool.get(tool_name):
        return _translated(code)

    return _translated("magicbase.current_micro_app")


class MagicBaseFriendlyRemarkMixin:
    async def get_before_tool_call_friendly_action_and_remark(
        self,
        tool_name,
        tool_context,
        arguments=None,
    ) -> Dict[str, Any]:
        friendly = await super().get_before_tool_call_friendly_action_and_remark(
            tool_name,
            tool_context,
            arguments,
        )
        friendly["remark"] = build_magicbase_tool_remark(self.name, arguments)
        return friendly

    def _get_remark_content(
        self,
        result: ToolResult,
        arguments: Optional[Dict[str, Any]] = None,
    ) -> str:
        return build_magicbase_tool_remark(self.name, arguments, result)
