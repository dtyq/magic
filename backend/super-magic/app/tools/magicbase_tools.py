import asyncio
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
from app.infrastructure.sdk.magic_service.kernel.magic_service_exception import MagicServiceException
from app.infrastructure.sdk.magic_service.parameter import (
    BatchCreateMagicBaseRowsParameter,
    BatchDeleteMagicBaseRowsParameter,
    CreateMagicBaseColumnParameter,
    CreateMagicBaseRowParameter,
    CreateMagicBaseTableParameter,
    DeleteMagicBaseColumnParameter,
    DeleteMagicBaseRowParameter,
    DeleteMagicBaseTableParameter,
    GetMagicBaseRowParameter,
    GetMagicBaseTableParameter,
    QueryMagicBaseRowsParameter,
    QueryMagicBaseTablesParameter,
    UpdateMagicBaseColumnParameter,
    UpdateMagicBaseRowParameter,
    UpdateMagicBaseTablePermissionsParameter,
)
from app.service.html_app_memory_service import (
    append_pending_migration,
    complete_migration,
    new_migration,
    read_migrations_state,
    record_column_success,
    record_table_success,
    sync_html_app_magicbase_model,
    upsert_column_model,
    upsert_table_model,
    write_migrations_state,
)
from app.service.mention.utils.micro_app_prompt import (
    get_micro_app_project_scopes,
    has_bound_micro_app_project_scope,
    resolve_magicbase_project_id,
)
from app.tools.core import BaseTool, BaseToolParams, tool
from app.tools.magicbase_tool_friendly import MagicBaseFriendlyRemarkMixin
from app.utils.init_client_message_util import InitClientMessageUtil

MAGICBASE_MYSQL_LIKE_DATA_TYPES = {"text", "number", "datetime", "boolean", "json"}


def _now_text() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def _json_safe(value: Any) -> Any:
    return json.loads(json.dumps(value, ensure_ascii=False, default=str))


def _coerce_permission_object(value: Any, field_name: str) -> Optional[Dict[str, Any]]:
    if value in (None, ""):
        return None
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError as e:
            raise ValueError(f"{field_name} must be an object or a valid JSON object string") from e
        if isinstance(parsed, dict):
            return parsed
    raise ValueError(f"{field_name} must be an object")


def _validate_mysql_like_data_type(value: str) -> str:
    data_type = str(value).strip()
    if data_type not in MAGICBASE_MYSQL_LIKE_DATA_TYPES:
        allowed = ", ".join(sorted(MAGICBASE_MYSQL_LIKE_DATA_TYPES))
        raise ValueError(f"data_type must be one of: {allowed}")
    return data_type


def _column_id(column: Dict[str, Any]) -> str:
    return str(column.get("column_id") or column.get("columnId") or column.get("id") or "").strip()


def _table_id(table: Dict[str, Any]) -> str:
    return str(table.get("table_id") or table.get("tableId") or table.get("id") or "").strip()


def _normalize_column(column: Dict[str, Any]) -> Dict[str, Any]:
    normalized = {
        "column_id": _column_id(column),
        "column_key": column.get("column_key") or column.get("columnKey") or "",
        "column_name": column.get("column_name") or column.get("columnName") or "",
        "data_type": column.get("data_type") or column.get("dataType") or "",
        "is_required": column.get("is_required") if "is_required" in column else column.get("isRequired", False),
    }
    for key in ("default_value", "dynamic_permission"):
        if column.get(key) is not None:
            normalized[key] = column.get(key)
    return {key: value for key, value in normalized.items() if value not in ("", None)}


def _planned_column(column: Any) -> Dict[str, Any]:
    return _normalize_column(column.to_body())


def _merge_columns(existing: List[Dict[str, Any]], incoming: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    merged = [_json_safe(column) for column in existing]
    for column in incoming:
        normalized = _normalize_column(column)
        key = normalized.get("column_key")
        column_id = normalized.get("column_id")
        match_index = -1
        for index, current in enumerate(merged):
            if column_id and current.get("column_id") == column_id:
                match_index = index
                break
            if key and current.get("column_key") == key:
                match_index = index
                break
        if match_index >= 0:
            merged[match_index] = {**merged[match_index], **normalized}
        else:
            merged.append(normalized)
    return merged


def _remove_table_model(data_model: Dict[str, Any], target_table_id: str) -> None:
    tables = data_model.setdefault("tables", [])
    data_model["tables"] = [table for table in tables if str(table.get("table_id") or "") != target_table_id]


def _remove_column_model(data_model: Dict[str, Any], target_table_id: str, target_column_id: str) -> None:
    for table in data_model.setdefault("tables", []):
        if str(table.get("table_id") or "") != target_table_id:
            continue
        table["columns"] = [
            column
            for column in table.get("columns") or []
            if str(column.get("column_id") or "") != target_column_id
        ]
        return


async def _record_table_update_success(migration_id: str, table: Dict[str, Any]) -> None:
    state = await read_migrations_state()
    upsert_table_model(state["data_model"], table)
    for migration in state["migrations"]:
        if migration.get("migration_id") == migration_id:
            migration["status"] = "Success"
            migration["applied_at"] = _now_text()
            migration["result_table_id"] = _table_id(table)
            break
    await write_migrations_state(state)
    await sync_html_app_magicbase_model(state["data_model"])


async def _record_table_delete_success(migration_id: str, target_table_id: str) -> None:
    state = await read_migrations_state()
    _remove_table_model(state["data_model"], target_table_id)
    for migration in state["migrations"]:
        if migration.get("migration_id") == migration_id:
            migration["status"] = "Success"
            migration["applied_at"] = _now_text()
            migration["result_table_id"] = target_table_id
            break
    await write_migrations_state(state)
    await sync_html_app_magicbase_model(state["data_model"])


async def _record_column_update_success(migration_id: str, target_table_id: str, column: Dict[str, Any]) -> None:
    state = await read_migrations_state()
    upsert_column_model(state["data_model"], target_table_id, column)
    for migration in state["migrations"]:
        if migration.get("migration_id") == migration_id:
            migration["status"] = "Success"
            migration["applied_at"] = _now_text()
            migration["result_column_id"] = _column_id(column)
            break
    await write_migrations_state(state)
    await sync_html_app_magicbase_model(state["data_model"])


async def _record_column_delete_success(migration_id: str, target_table_id: str, target_column_id: str) -> None:
    state = await read_migrations_state()
    _remove_column_model(state["data_model"], target_table_id, target_column_id)
    for migration in state["migrations"]:
        if migration.get("migration_id") == migration_id:
            migration["status"] = "Success"
            migration["applied_at"] = _now_text()
            migration["result_column_id"] = target_column_id
            break
    await write_migrations_state(state)
    await sync_html_app_magicbase_model(state["data_model"])


def _upsert_table_model(
    data_model: Dict[str, Any],
    table: Dict[str, Any],
    planned_columns: Optional[List[Dict[str, Any]]] = None,
) -> None:
    tables = data_model.setdefault("tables", [])
    table_id = _table_id(table)
    table_key = table.get("table_key") or table.get("tableKey") or ""
    columns = table.get("columns") or planned_columns or []
    incoming = {
        "table_id": table_id,
        "table_key": table_key,
        "table_name": table.get("table_name") or table.get("tableName") or "",
        "description": table.get("description") or "",
        "columns": [_normalize_column(column) for column in columns],
    }
    incoming = {key: value for key, value in incoming.items() if value not in ("", None)}

    match_index = -1
    for index, current in enumerate(tables):
        if table_id and current.get("table_id") == table_id:
            match_index = index
            break
        if table_key and current.get("table_key") == table_key:
            match_index = index
            break

    if match_index >= 0:
        existing = tables[match_index]
        tables[match_index] = {
            **existing,
            **{key: value for key, value in incoming.items() if key != "columns"},
            "columns": _merge_columns(existing.get("columns") or [], incoming.get("columns") or []),
        }
    else:
        tables.append(incoming)


def _upsert_column_model(data_model: Dict[str, Any], table_id: str, column: Dict[str, Any]) -> None:
    tables = data_model.setdefault("tables", [])
    for table in tables:
        if table.get("table_id") == table_id:
            table["columns"] = _merge_columns(table.get("columns") or [], [column])
            return
    tables.append({"table_id": table_id, "columns": [_normalize_column(column)]})


def _find_table(tables: List[Dict[str, Any]], target: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    target_table_id = str(target.get("table_id") or "").strip()
    target_table_key = str(target.get("table_key") or "").strip()
    target_table_name = str(target.get("table_name") or "").strip()
    for table in tables:
        if target_table_id and _table_id(table) == target_table_id:
            return table
        if target_table_key and (table.get("table_key") or table.get("tableKey")) == target_table_key:
            return table
        if target_table_name and (table.get("table_name") or table.get("tableName")) == target_table_name:
            return table
    return None


def _find_column(table: Dict[str, Any], column_key: str) -> Optional[Dict[str, Any]]:
    for column in table.get("columns") or []:
        if (column.get("column_key") or column.get("columnKey")) == column_key:
            return column
    return None


async def _reconcile_pending_migrations_with_tables(
    tables: List[Dict[str, Any]], *, project_id: str
) -> int:
    # 迁移文件属于当前沙箱工作区；引用项目中的同名表不能用于确认本地迁移。
    try:
        workspace_project_id = str(InitClientMessageUtil.get_metadata().get("project_id") or "").strip()
    except Exception:
        return 0
    if not workspace_project_id or workspace_project_id != project_id:
        return 0

    state = await read_migrations_state()
    data_model = state["data_model"]
    migrations = state["migrations"]
    changed = 0
    now = _now_text()

    for migration in migrations:
        if migration.get("status") != "Pending":
            continue

        target = migration.get("target") or {}
        operation = migration.get("operation")
        if operation == "create_table":
            table = _find_table(tables, target)
            if not table:
                continue
            migration["status"] = "Success"
            migration["applied_at"] = now
            migration["reconciled_at"] = now
            migration["result_table_id"] = _table_id(table)
            upsert_table_model(data_model, table)
            changed += 1
        elif operation == "create_column":
            table = _find_table(tables, target)
            if not table:
                continue
            column_key = str(target.get("column_key") or "").strip()
            column = _find_column(table, column_key)
            if not column:
                continue
            migration["status"] = "Success"
            migration["applied_at"] = now
            migration["reconciled_at"] = now
            migration["result_column_id"] = _column_id(column)
            upsert_column_model(data_model, _table_id(table), column)
            changed += 1

    if changed:
        await write_migrations_state(state)
        await sync_html_app_magicbase_model(data_model)
    return changed


async def _try_reconcile_pending_migrations(project_id: str) -> int:
    try:
        result = await get_magic_service_sdk().magicbase.query_tables_async(
            QueryMagicBaseTablesParameter(project_id=project_id)
        )
        tables = result.to_dict().get("tables", [])
        return await _reconcile_pending_migrations_with_tables(tables, project_id=project_id)
    except Exception:
        return 0


class MagicbaseProjectScopedParams(BaseToolParams):
    app_id: Optional[str] = Field(
        default=None,
        description="""<!--zh: 可选。会话绑定了多个 micro_app 时必填，取 mention 里的 app_id。-->
Optional micro-app app_id from the mention. Required when multiple micro-apps are bound.""",
    )


def _get_project_id(
    tool_context: Optional[ToolContext] = None,
    app_id: Optional[str] = None,
) -> str:
    try:
        metadata = InitClientMessageUtil.get_metadata()
    except Exception:
        metadata = {}

    micro_app_project_id = resolve_magicbase_project_id(app_id)
    if micro_app_project_id:
        # A micro-app Mention scopes MagicBase operations to its resolved project.
        # Never fall back to the conversation project once that scope exists.
        return micro_app_project_id

    persisted_project_id = str(metadata.get("project_id") or "").strip()
    context_project_id = ""
    if tool_context is not None:
        context_project_id = str(tool_context.get_metadata("project_id") or "").strip()

    if context_project_id and persisted_project_id and context_project_id != persisted_project_id:
        raise ValueError("MagicBase project context does not match the current persisted session")
    return context_project_id or persisted_project_id


def _requires_micro_app_confirmation(tool_context: ToolContext) -> bool:
    """Only conversational micro-app writes require the interactive confirmation gate."""
    return has_bound_micro_app_project_scope()


def _reject_schema_change_for_micro_app(tool_context: ToolContext) -> Optional[ToolResult]:
    """The use-magicbase runtime skill can access rows, never alter schema or permissions."""
    if _requires_micro_app_confirmation(tool_context):
        return ToolResult.error("MagicBase schema and permission changes are unavailable for a referenced micro-app.")
    return None


def _column_labels(columns: List[Dict[str, Any]]) -> str:
    labels = []
    for column in columns:
        key = column.get("column_key") or column.get("columnKey") or ""
        data_type = column.get("data_type") or column.get("dataType") or ""
        if key and data_type:
            labels.append(f"{key} ({data_type})")
        elif key:
            labels.append(key)
    return ", ".join(labels) if labels else "no columns"


def _table_summary(table: Dict[str, Any]) -> str:
    table_id = _table_id(table)
    table_key = table.get("table_key") or ""
    table_name = table.get("table_name") or ""
    columns = table.get("columns") or []
    return (
        f"table_id={table_id}, table_key={table_key}, table_name={table_name}, "
        f"columns=[{_column_labels(columns)}]"
    )


class MagicbaseColumnDefinition(BaseModel):
    column_key: str = Field(
        description="""<!--zh: 字段唯一 key，必须稳定，建议用英文小写加下划线。-->
Stable unique column key. Use lowercase English with underscores when possible."""
    )
    column_name: str = Field(
        description="""<!--zh: 展示给用户看的字段名。-->
Human-readable column name shown to users."""
    )
    data_type: str = Field(
        description="""<!--zh: 字段类型。必须使用 MagicBase 支持的枚举值。-->
Column data type. Must be one of the MySQL-like MagicBase types: text, number, datetime, boolean, json."""
    )
    is_required: bool = Field(
        default=False,
        description="""<!--zh: 是否必填。-->
Whether this column is required."""
    )
    default_value: Any = Field(
        default=None,
        description="""<!--zh: 默认值，不需要默认值时留空。-->
Default value. Leave empty when no default is needed."""
    )
    dynamic_permission: Optional[Dict[str, Any]] = Field(
        default=None,
        description="""<!--zh: 字段动态权限配置，可选。只有普通用户确实可直接修改的字段才使用 public edit；归属、审核、审计、派生或只展示字段应使用更严格 edit_scope 或不提供编辑入口。后端行归属使用系统 created_by，不依赖动态 creator_user_id 字段。字段权限无法强制状态流转、跨表、阈值、时间窗口、配额、流程或敏感业务规则；纯前端隐藏控件只是 ui_only_not_secure，这类规则 requires_backend。-->
Optional column dynamic permission object. Pass it as an object, not as a JSON string. Use public edit only for fields ordinary users may directly modify. Ownership, review, audit, derived, or display-only business fields should use a restrictive edit_scope or no edit UI; backend row ownership uses system created_by, not a dynamic creator_user_id column. Column permissions cannot enforce state-dependent, cross-table, threshold, time-window, quota, workflow, or sensitive business rules; hiding controls in HTML is ui_only_not_secure and those rules require backend or MagicBase permission-model extension."""
    )

    @field_validator("data_type")
    @classmethod
    def _validate_data_type(cls, value: str) -> str:
        return _validate_mysql_like_data_type(value)

    @field_validator("dynamic_permission", mode="before")
    @classmethod
    def _validate_dynamic_permission(cls, value: Any) -> Optional[Dict[str, Any]]:
        return _coerce_permission_object(value, "dynamic_permission")

    def to_body(self) -> Dict[str, Any]:
        body: Dict[str, Any] = {
            "column_key": self.column_key,
            "column_name": self.column_name,
            "data_type": self.data_type,
            "is_required": self.is_required,
        }
        if self.default_value is not None:
            body["default_value"] = self.default_value
        if self.dynamic_permission is not None:
            body["dynamic_permission"] = self.dynamic_permission
        return body


class QueryMagicbaseTablesParams(MagicbaseProjectScopedParams):
    table_key: Optional[str] = Field(
        default=None,
        description="""<!--zh: 可选。按 table_key 精确过滤结果。-->
Optional exact table_key filter."""
    )
    table_name: Optional[str] = Field(
        default=None,
        description="""<!--zh: 可选。按 table_name 精确过滤结果。-->
Optional exact table_name filter."""
    )


# Full model-facing usage guidance: agents/skills/use-magicbase/SKILL.md
@tool(name="query_magicbase_tables", code_mode_only=True)
class QueryMagicTables(MagicBaseFriendlyRemarkMixin, BaseTool[QueryMagicbaseTablesParams]):
    """<!--zh
    查询当前项目的 MagicBase 表。

    project_id 自动来自当前会话 metadata，模型不要填写 project_id。
    -->
    List MagicBase tables for the current project.

    The project_id is loaded from current session metadata automatically. Do not ask the user for project_id.
    """
    name = "query_magicbase_tables"

    async def execute(self, tool_context: ToolContext, params: QueryMagicbaseTablesParams) -> ToolResult:
        try:
            project_id = _get_project_id(tool_context, params.app_id)
        except ValueError as e:
            return ToolResult.error(str(e))
        if not project_id:
            return ToolResult.error("Project ID is not available in the current session. Cannot query MagicBase tables.")

        try:
            tables = await _query_magicbase_tables_for_project(
                project_id,
                params.table_key,
                params.table_name,
            )
        except (MagicServiceException, ValueError) as e:
            return ToolResult.error(f"Failed to query MagicBase tables: {e}")

        if not tables:
            return ToolResult(
                content="No MagicBase tables matched the current query.",
                data={"project_id": project_id, "tables": []},
            )

        summaries = "; ".join(_table_summary(table) for table in tables)
        content = f"Found {len(tables)} MagicBase table(s). {summaries}."
        return ToolResult(content=content, data={"project_id": project_id, "tables": tables})


class QueryMagicbaseTablesAllMentionedAppsParams(BaseToolParams):
    table_key: Optional[str] = Field(
        default=None,
        description="""<!--zh: 可选。按 table_key 精确过滤每个应用的结果。-->
Optional exact table_key filter applied to each app."""
    )
    table_name: Optional[str] = Field(
        default=None,
        description="""<!--zh: 可选。按 table_name 精确过滤每个应用的结果。-->
Optional exact table_name filter applied to each app."""
    )


async def _query_magicbase_tables_for_project(
    project_id: str,
    table_key: Optional[str],
    table_name: Optional[str],
) -> List[Dict[str, Any]]:
    result = await get_magic_service_sdk().magicbase.query_tables_async(
        QueryMagicBaseTablesParameter(project_id=project_id)
    )
    tables = result.to_dict().get("tables", [])
    await _reconcile_pending_migrations_with_tables(tables, project_id=project_id)
    if table_key:
        tables = [table for table in tables if table.get("table_key") == table_key]
    if table_name:
        tables = [table for table in tables if table.get("table_name") == table_name]
    return tables


# Full model-facing usage guidance: agents/skills/use-magicbase/SKILL.md
@tool(name="query_magicbase_tables_all_mentioned_apps", code_mode_only=True)
class QueryMagicTablesAllMentionedApps(
    MagicBaseFriendlyRemarkMixin, BaseTool[QueryMagicbaseTablesAllMentionedAppsParams]
):
    """<!--zh
    批量查询本会话已绑定的所有 @micro_app 的 MagicBase 表。

    仅在多个 micro_app 已绑定时使用；单个 micro_app 请用 query_magicbase_tables。
    -->
    List MagicBase tables for every micro-app bound in this conversation.

    Use when multiple micro-apps are bound. For a single micro-app, use query_magicbase_tables instead.
    """
    name = "query_magicbase_tables_all_mentioned_apps"

    async def execute(
        self,
        tool_context: ToolContext,
        params: QueryMagicbaseTablesAllMentionedAppsParams,
    ) -> ToolResult:
        scopes = get_micro_app_project_scopes()
        if len(scopes) < 2:
            return ToolResult.error(
                "This tool requires at least two referenced micro-apps. "
                "Use query_magicbase_tables for a single micro-app."
            )

        async def query_one(app_id: str, entry: Dict[str, str]) -> Dict[str, Any]:
            project_id = entry["project_id"]
            try:
                tables = await _query_magicbase_tables_for_project(
                    project_id,
                    params.table_key,
                    params.table_name,
                )
            except (MagicServiceException, ValueError) as e:
                return {
                    "app_id": app_id,
                    "app_name": entry.get("app_name") or app_id,
                    "project_id": project_id,
                    "error": str(e),
                    "tables": [],
                }
            return {
                "app_id": app_id,
                "app_name": entry.get("app_name") or app_id,
                "project_id": project_id,
                "tables": tables,
            }

        apps = await asyncio.gather(
            *[query_one(app_id, entry) for app_id, entry in scopes.items()]
        )
        total_tables = sum(len(app.get("tables") or []) for app in apps)
        summaries = []
        for app in apps:
            app_label = app.get("app_name") or app.get("app_id")
            if app.get("error"):
                summaries.append(f"{app_label}: failed ({app['error']})")
                continue
            table_count = len(app.get("tables") or [])
            summaries.append(f"{app_label}: {table_count} table(s)")
        content = (
            f"Queried {len(apps)} referenced micro-app(s), found {total_tables} table(s) total. "
            + "; ".join(summaries)
            + ". Use app_id on later calls to target one app."
        )
        return ToolResult(content=content, data={"apps": list(apps)})


class GetMagicbaseTableParams(MagicbaseProjectScopedParams):
    table_id: str = Field(
        description="""<!--zh: MagicBase 返回的真实 table.id，不是 table_key 或 table_name。-->
Real MagicBase table.id returned by MagicBase tools. Do not pass table_key or table_name."""
    )


@tool(name="get_magicbase_table", code_mode_only=True)
class GetMagicTable(MagicBaseFriendlyRemarkMixin, BaseTool[GetMagicbaseTableParams]):
    """<!--zh
    根据真实 table.id 获取当前项目的 MagicBase 表详情。
    -->
    Get a MagicBase table by its real table.id in the current project.
    """
    name = "get_magicbase_table"

    async def execute(self, tool_context: ToolContext, params: GetMagicbaseTableParams) -> ToolResult:
        try:
            project_id = _get_project_id(tool_context, params.app_id)
        except ValueError as e:
            return ToolResult.error(str(e))
        if not project_id:
            return ToolResult.error("Project ID is not available in the current session. Cannot get MagicBase table.")

        try:
            result = await get_magic_service_sdk().magicbase.get_table_async(
                GetMagicBaseTableParameter(project_id=project_id, table_id=params.table_id)
            )
        except (MagicServiceException, ValueError) as e:
            return ToolResult.error(f"Failed to get MagicBase table: {e}")

        table = result.to_dict()
        reconciled_count = await _reconcile_pending_migrations_with_tables([table], project_id=project_id)
        suffix = f" Reconciled {reconciled_count} pending MagicBase migration(s)." if reconciled_count else ""
        content = f"MagicBase table loaded. {_table_summary(table)}.{suffix}"
        return ToolResult(content=content, data={"project_id": project_id, "table": table})


class QueryMagicbaseRowsParams(MagicbaseProjectScopedParams):
    table_id: str = Field(description="Real MagicBase table.id in the current project.")
    filter: Dict[str, Any] = Field(
        default_factory=dict,
        description="Optional MagicBase filter object. Query before destructive operations to resolve real record IDs.",
    )
    sort: List[Dict[str, str]] = Field(default_factory=list, description="Optional MagicBase sort rules.")
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=1000)
    select: List[str] = Field(
        default_factory=list,
        description="Fields to return. Leave empty to return dynamic and supported system fields.",
    )


@tool(name="query_magicbase_rows", code_mode_only=True)
class QueryMagicRows(MagicBaseFriendlyRemarkMixin, BaseTool[QueryMagicbaseRowsParams]):
    """Query rows from a MagicBase table in the current project using the current user authorization."""
    name = "query_magicbase_rows"

    async def execute(self, tool_context: ToolContext, params: QueryMagicbaseRowsParams) -> ToolResult:
        try:
            project_id = _get_project_id(tool_context, params.app_id)
        except ValueError as e:
            return ToolResult.error(str(e))
        if not project_id:
            return ToolResult.error("Project ID is not available in the current session. Cannot query MagicBase rows.")

        try:
            result = await get_magic_service_sdk().magicbase.query_rows_async(
                QueryMagicBaseRowsParameter(
                    project_id=project_id,
                    table_id=params.table_id,
                    filter=params.filter,
                    sort=params.sort,
                    page=params.page,
                    page_size=params.page_size,
                    select=params.select,
                )
            )
        except (MagicServiceException, ValueError) as e:
            return ToolResult.error(f"Failed to query MagicBase rows: {e}")

        payload = result.to_dict()
        return ToolResult(
            content=f"Found {payload['total']} MagicBase row(s); returned {len(payload['rows'])} row(s) on page {payload['page']}.",
            data={"project_id": project_id, "table_id": params.table_id, **payload},
        )


class BatchGetMagicbaseRowsParams(MagicbaseProjectScopedParams):
    table_id: str = Field(description="Real MagicBase table.id in the current project.")
    record_ids: List[str] = Field(
        min_length=1,
        max_length=100,
        description="Real MagicBase row IDs to load. Maximum 100 IDs per call.",
    )
    select: List[str] = Field(
        default_factory=list,
        description="Fields to return for every row in addition to id. Leave empty to return dynamic and supported system fields.",
    )

    @field_validator("record_ids")
    @classmethod
    def _validate_record_ids(cls, values: List[str]) -> List[str]:
        normalized = [str(value).strip() for value in values]
        if any(not value.isdigit() for value in normalized):
            raise ValueError("record_ids must contain numeric strings")
        # MagicBase normalizes record IDs to integers before filtering and returns canonical strings.
        # Canonicalize here so rows such as input "0001" are not misclassified as missing when the service returns "1".
        return [str(int(value)) for value in normalized]


# Full model-facing usage guidance: agents/skills/use-magicbase/SKILL.md
@tool(name="batch_get_magicbase_rows", code_mode_only=True)
class BatchGetMagicRows(MagicBaseFriendlyRemarkMixin, BaseTool[BatchGetMagicbaseRowsParams]):
    """Load multiple MagicBase rows in one query while applying normal row permissions."""

    name = "batch_get_magicbase_rows"

    async def execute(self, tool_context: ToolContext, params: BatchGetMagicbaseRowsParams) -> ToolResult:
        try:
            project_id = _get_project_id(tool_context, params.app_id)
        except ValueError as e:
            return ToolResult.error(str(e))
        if not project_id:
            return ToolResult.error(
                "Project ID is not available in the current session. Cannot batch get MagicBase rows."
            )

        try:
            # 批量结果需要依靠稳定的记录 ID 恢复调用方顺序并识别未返回项。
            # 即使调用方只选择业务字段，也必须在内部查询中保留 id。
            select = list(dict.fromkeys(["id", *params.select])) if params.select else []
            result = await get_magic_service_sdk().magicbase.query_rows_async(
                QueryMagicBaseRowsParameter(
                    project_id=project_id,
                    table_id=params.table_id,
                    filter={"record_id": {"in": params.record_ids}},
                    page=1,
                    page_size=len(params.record_ids),
                    select=select,
                )
            )
        except (MagicServiceException, ValueError) as e:
            return ToolResult.error(f"Failed to batch get MagicBase rows: {e}")

        payload = result.to_dict()
        rows_by_id = {
            str(row.get("id") or row.get("record_id")): row
            for row in payload["rows"]
            if row.get("id") is not None or row.get("record_id") is not None
        }
        ordered_rows = [rows_by_id[record_id] for record_id in params.record_ids if record_id in rows_by_id]
        returned = len(ordered_rows)
        requested = len(params.record_ids)
        missing_record_ids = [record_id for record_id in params.record_ids if record_id not in rows_by_id]
        missing_summary = (
            f" {len(missing_record_ids)} requested row(s) were not found or not readable."
            if missing_record_ids
            else ""
        )
        return ToolResult(
            content=(
                f"Loaded {returned} of {requested} requested MagicBase row(s) "
                f"from table_id={params.table_id}.{missing_summary}"
            ),
            data={
                "project_id": project_id,
                "table_id": params.table_id,
                "requested_record_ids": params.record_ids,
                "rows": ordered_rows,
                "returned": returned,
                "missing_record_ids": missing_record_ids,
            },
        )

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: Dict[str, Any] = None,
    ) -> Optional[ToolDetail]:
        if result.ok:
            return None
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(
                file_name="magicbase-rows.md",
                content=i18n.translate(
                    "magicbase.batch_query_rows_detail_error",
                    category="tool.messages",
                ),
            ),
        )


class CreateMagicbaseRowParams(MagicbaseProjectScopedParams):
    table_id: str = Field(description="Real MagicBase table.id in the current project.")
    data: Dict[str, Any] = Field(description="Dynamic row values keyed by MagicBase column_key.")
    select: List[str] = Field(
        default_factory=list,
        description="Fields to return after creation. System fields such as id and created_by may be included.",
    )
    confirmed_by_user: bool = Field(default=False, description="Set true only after ask_user explicitly confirms this write.")



@tool(name="create_magicbase_row", code_mode_only=True)
class CreateMagicRow(MagicBaseFriendlyRemarkMixin, BaseTool[CreateMagicbaseRowParams]):
    """Create one MagicBase row as the current authenticated user."""
    name = "create_magicbase_row"

    async def execute(self, tool_context: ToolContext, params: CreateMagicbaseRowParams) -> ToolResult:
        if _requires_micro_app_confirmation(tool_context) and not params.confirmed_by_user:
            return ToolResult.error("Creating a MagicBase row requires ask_user confirmation first.")
        try:
            project_id = _get_project_id(tool_context, params.app_id)
        except ValueError as e:
            return ToolResult.error(str(e))
        if not project_id:
            return ToolResult.error("Project ID is not available in the current session. Cannot create a MagicBase row.")

        try:
            result = await get_magic_service_sdk().magicbase.create_row_async(
                CreateMagicBaseRowParameter(
                    project_id=project_id,
                    table_id=params.table_id,
                    data=params.data,
                    select=params.select,
                )
            )
        except (MagicServiceException, ValueError) as e:
            return ToolResult.error(f"Failed to create MagicBase row: {e}")

        row = result.to_dict()
        return ToolResult(
            content=f"Created MagicBase row record_id={row.get('id') or row.get('record_id') or ''} in table_id={params.table_id}.",
            data={"project_id": project_id, "table_id": params.table_id, "row": row},
        )


class GetMagicbaseRowParams(MagicbaseProjectScopedParams):
    table_id: str = Field(
        description="""<!--zh: 当前项目内的真实 MagicBase table.id。-->
Real MagicBase table.id in the current project."""
    )
    record_id: str = Field(
        description="""<!--zh: 查询或创建操作返回的真实 MagicBase 记录 id。-->
Real MagicBase row id returned by a query or create operation."""
    )
    select: List[str] = Field(
        default_factory=list,
        description="""<!--zh: 返回字段列表。留空时返回动态字段和默认系统字段。-->
Fields to return. Leave empty to return dynamic fields and default system fields.""",
    )


@tool(name="get_magicbase_row", code_mode_only=True)
class GetMagicRow(MagicBaseFriendlyRemarkMixin, BaseTool[GetMagicbaseRowParams]):
    """<!--zh
    使用当前用户授权按真实记录 id 获取单条 MagicBase 数据记录。
    -->
    Get one MagicBase row by its real record id using the current user authorization.
    """
    name = "get_magicbase_row"

    async def execute(self, tool_context: ToolContext, params: GetMagicbaseRowParams) -> ToolResult:
        try:
            project_id = _get_project_id(tool_context, params.app_id)
        except ValueError as e:
            return ToolResult.error(str(e))
        if not project_id:
            return ToolResult.error("Project ID is not available in the current session. Cannot get MagicBase row.")

        try:
            result = await get_magic_service_sdk().magicbase.get_row_async(
                GetMagicBaseRowParameter(
                    project_id=project_id,
                    table_id=params.table_id,
                    record_id=params.record_id,
                    select=params.select,
                )
            )
        except (MagicServiceException, ValueError) as e:
            return ToolResult.error(f"Failed to get MagicBase row: {e}")

        row = result.to_dict()
        return ToolResult(
            content=f"Loaded MagicBase row record_id={params.record_id} from table_id={params.table_id}.",
            data={"project_id": project_id, "table_id": params.table_id, "row": row},
        )


class UpdateMagicbaseRowParams(MagicbaseProjectScopedParams):
    table_id: str = Field(
        description="""<!--zh: 当前项目内的真实 MagicBase table.id。-->
Real MagicBase table.id in the current project."""
    )
    record_id: str = Field(
        description="""<!--zh: 查询或创建操作返回的真实 MagicBase 记录 id。-->
Real MagicBase row id returned by a query or create operation."""
    )
    data: Dict[str, Any] = Field(
        description="""<!--zh: 待更新的字段，按 MagicBase column_key 组织。只传真实业务字段，不要传 created_by、organization_code、created_at、updated_at 等系统字段。-->
Fields to update, keyed by MagicBase column_key. Pass only dynamic business fields, not system fields such as created_by, organization_code, created_at, or updated_at."""
    )
    select: List[str] = Field(
        default_factory=list,
        description="""<!--zh: 更新后返回的字段。-->
Fields to return after the update.""",
    )
    confirmed_by_user: bool = Field(default=False, description="Set true only after ask_user explicitly confirms this write.")


@tool(name="update_magicbase_row", code_mode_only=True)
class UpdateMagicRow(MagicBaseFriendlyRemarkMixin, BaseTool[UpdateMagicbaseRowParams]):
    """<!--zh
    以当前登录用户身份更新一条 MagicBase 数据记录。
    -->
    Update one MagicBase row as the current authenticated user.
    """
    name = "update_magicbase_row"

    async def execute(self, tool_context: ToolContext, params: UpdateMagicbaseRowParams) -> ToolResult:
        if _requires_micro_app_confirmation(tool_context) and not params.confirmed_by_user:
            return ToolResult.error("Updating a MagicBase row requires ask_user confirmation first.")
        try:
            project_id = _get_project_id(tool_context, params.app_id)
        except ValueError as e:
            return ToolResult.error(str(e))
        if not project_id:
            return ToolResult.error("Project ID is not available in the current session. Cannot update MagicBase row.")

        try:
            result = await get_magic_service_sdk().magicbase.update_row_async(
                UpdateMagicBaseRowParameter(
                    project_id=project_id,
                    table_id=params.table_id,
                    record_id=params.record_id,
                    data=params.data,
                    select=params.select,
                )
            )
        except (MagicServiceException, ValueError) as e:
            return ToolResult.error(f"Failed to update MagicBase row: {e}")

        row = result.to_dict()
        return ToolResult(
            content=f"Updated MagicBase row record_id={params.record_id} in table_id={params.table_id}.",
            data={"project_id": project_id, "table_id": params.table_id, "row": row},
        )


class BatchCreateMagicbaseRowsParams(MagicbaseProjectScopedParams):
    table_id: str = Field(description="Real MagicBase table.id in the current project.")
    rows: List[Dict[str, Any]] = Field(
        min_length=1,
        max_length=200,
        description="Rows to create, each keyed by MagicBase column_key. Maximum 200 rows per call.",
    )
    select: List[str] = Field(default_factory=list, description="Fields to return for every created row.")
    confirmed_by_user: bool = Field(
        default=False,
        description="Set true only after ask_user explicitly confirms this batch write.",
    )


@tool(name="batch_create_magicbase_rows", code_mode_only=True)
class BatchCreateMagicRows(MagicBaseFriendlyRemarkMixin, BaseTool[BatchCreateMagicbaseRowsParams]):
    """Batch create MagicBase rows as the current authenticated user."""
    name = "batch_create_magicbase_rows"

    async def execute(self, tool_context: ToolContext, params: BatchCreateMagicbaseRowsParams) -> ToolResult:
        if _requires_micro_app_confirmation(tool_context) and not params.confirmed_by_user:
            return ToolResult.error("Batch creating MagicBase rows for a micro-app requires ask_user confirmation first.")
        try:
            project_id = _get_project_id(tool_context, params.app_id)
        except ValueError as e:
            return ToolResult.error(str(e))
        if not project_id:
            return ToolResult.error("Project ID is not available in the current session. Cannot batch create MagicBase rows.")

        try:
            result = await get_magic_service_sdk().magicbase.batch_create_rows_async(
                BatchCreateMagicBaseRowsParameter(
                    project_id=project_id,
                    table_id=params.table_id,
                    rows=params.rows,
                    select=params.select,
                )
            )
        except (MagicServiceException, ValueError) as e:
            return ToolResult.error(f"Failed to batch create MagicBase rows: {e}")

        payload = result.to_dict()
        return ToolResult(
            content=f"Created {payload['created_count']} MagicBase row(s) in table_id={params.table_id}.",
            data={"project_id": project_id, "table_id": params.table_id, **payload},
        )


class DeleteMagicbaseRowParams(MagicbaseProjectScopedParams):
    table_id: str = Field(description="Real MagicBase table.id in the current project.")
    record_id: str = Field(description="Real MagicBase row id returned by a query or create operation.")
    confirm_delete: bool = Field(
        default=False,
        description="Set to true only after the user explicitly confirms deleting this row.",
    )
    confirmed_by_user: bool = Field(default=False, description="Set true only after ask_user explicitly confirms this write.")


@tool(name="delete_magicbase_row", code_mode_only=True)
class DeleteMagicRow(MagicBaseFriendlyRemarkMixin, BaseTool[DeleteMagicbaseRowParams]):
    """Delete one MagicBase row after explicit user confirmation."""
    name = "delete_magicbase_row"

    async def execute(self, tool_context: ToolContext, params: DeleteMagicbaseRowParams) -> ToolResult:
        if not params.confirm_delete:
            return ToolResult.error("Deleting a MagicBase row requires confirm_delete=true after explicit user confirmation.")
        if _requires_micro_app_confirmation(tool_context) and not params.confirmed_by_user:
            return ToolResult.error("Deleting a MagicBase row for a micro-app requires ask_user confirmation first.")
        try:
            project_id = _get_project_id(tool_context, params.app_id)
        except ValueError as e:
            return ToolResult.error(str(e))
        if not project_id:
            return ToolResult.error("Project ID is not available in the current session. Cannot delete a MagicBase row.")

        try:
            await get_magic_service_sdk().magicbase.delete_row_async(
                DeleteMagicBaseRowParameter(
                    project_id=project_id,
                    table_id=params.table_id,
                    record_id=params.record_id,
                )
            )
        except (MagicServiceException, ValueError) as e:
            return ToolResult.error(f"Failed to delete MagicBase row: {e}")

        return ToolResult(
            content=f"Deleted MagicBase row record_id={params.record_id} from table_id={params.table_id}.",
            data={"project_id": project_id, "table_id": params.table_id, "record_id": params.record_id},
        )


class BatchDeleteMagicbaseRowsParams(MagicbaseProjectScopedParams):
    table_id: str = Field(description="Real MagicBase table.id in the current project.")
    record_ids: List[str] = Field(
        min_length=1,
        max_length=200,
        description="Real MagicBase row IDs to delete. Resolve them with query_magicbase_rows first.",
    )
    confirm_delete: bool = Field(
        default=False,
        description="Set to true only after the user explicitly confirms the complete deletion scope.",
    )
    confirmed_by_user: bool = Field(default=False, description="Set true only after ask_user explicitly confirms this write.")


@tool(name="batch_delete_magicbase_rows", code_mode_only=True)
class BatchDeleteMagicRows(MagicBaseFriendlyRemarkMixin, BaseTool[BatchDeleteMagicbaseRowsParams]):
    """Batch delete MagicBase rows after explicit user confirmation."""
    name = "batch_delete_magicbase_rows"

    async def execute(self, tool_context: ToolContext, params: BatchDeleteMagicbaseRowsParams) -> ToolResult:
        if not params.confirm_delete:
            return ToolResult.error("Batch deleting MagicBase rows requires confirm_delete=true after explicit user confirmation.")
        if _requires_micro_app_confirmation(tool_context) and not params.confirmed_by_user:
            return ToolResult.error("Batch deleting MagicBase rows for a micro-app requires ask_user confirmation first.")
        try:
            project_id = _get_project_id(tool_context, params.app_id)
        except ValueError as e:
            return ToolResult.error(str(e))
        if not project_id:
            return ToolResult.error("Project ID is not available in the current session. Cannot batch delete MagicBase rows.")

        try:
            result = await get_magic_service_sdk().magicbase.batch_delete_rows_async(
                BatchDeleteMagicBaseRowsParameter(
                    project_id=project_id,
                    table_id=params.table_id,
                    record_ids=params.record_ids,
                )
            )
        except (MagicServiceException, ValueError) as e:
            return ToolResult.error(f"Failed to batch delete MagicBase rows: {e}")

        payload = result.to_dict()
        return ToolResult(
            content=f"Deleted {payload['deleted_count']} MagicBase row(s) from table_id={params.table_id}.",
            data={"project_id": project_id, "table_id": params.table_id, **payload},
        )


class CreateMagicbaseTableParams(MagicbaseProjectScopedParams):
    table_key: str = Field(
        description="""<!--zh: 表唯一 key，必须稳定，建议用英文小写加下划线。-->
Stable unique table key. Use lowercase English with underscores when possible."""
    )
    table_name: str = Field(
        description="""<!--zh: 展示给用户看的表名。-->
Human-readable table name shown to users."""
    )
    columns: List[MagicbaseColumnDefinition] = Field(
        description="""<!--zh: 建表时同时创建的字段列表。-->
Columns to create with the table."""
    )
    description: Optional[str] = Field(
        default=None,
        description="""<!--zh: 表说明，可选。-->
Optional table description."""
    )
    project_name: Optional[str] = Field(
        default=None,
        description="""<!--zh: 项目名称，可选。-->
Optional project name for MagicBase."""
    )
    dynamic_permissions: Optional[Dict[str, Any]] = Field(
        default=None,
        description="""<!--zh
        表、行、列动态权限配置。只要应用存在所有权、隐私、协作、组织、部门、只读或受限编辑语义，就必须传对象形式的 dynamic_permissions，不能依赖默认 public。
        常见组合：全员协作 row read/edit/delete=public；所有人可读但创建人编辑/删除 row read=public, edit/delete=private_user；私有数据 row read/edit/delete=private_user；组织共享用 private_org；部门共享用 private_department；提交后不可改不要给 public edit/delete，可用 disabled 或显式管理员权限。
        private_user 基于系统 created_by，不要为了权限单独创建 creator_user_id。
        MagicBase 只能强制表/行/列/静态授权；状态流转、跨表成员关系、直属上下级、金额阈值、时间窗口、配额、审批/支付/库存/财务/积分等业务规则 requires_backend。纯前端隐藏按钮、禁用输入或列表过滤是 ui_only_not_secure，不能说成已强制权限。
        -->
Table, row, and column dynamic permissions. Pass this as an object, never as a JSON string. If the app has ownership, privacy, collaboration, organization, department, read-only, or restricted-edit semantics, include this field instead of relying on defaults. Common row scopes: full collaboration => read/edit/delete public; everyone can read but only creators edit/delete => read public, edit/delete private_user; private personal rows => read/edit/delete private_user; organization-shared => use private_org where org-wide access is intended; department-shared => use private_department where department access is intended; intake/read-only data => do not grant public edit/delete, use disabled or explicit admin permissions. private_user uses system created_by; do not create creator_user_id only for permission enforcement. MagicBase can enforce table/row/column/static grants only; status transitions, cross-table membership, manager hierarchy, thresholds, time windows, quotas, workflow rules, payments, approvals, inventory, finance, points, and other sensitive business rules are requires_backend. Front-end hidden buttons or filters are ui_only_not_secure and must not be described as enforced permission."""
    )

    @field_validator("dynamic_permissions", mode="before")
    @classmethod
    def _validate_dynamic_permissions(cls, value: Any) -> Optional[Dict[str, Any]]:
        return _coerce_permission_object(value, "dynamic_permissions")


@tool(name="create_magicbase_table", code_mode_only=True)
class CreateMagicTable(MagicBaseFriendlyRemarkMixin, BaseTool[CreateMagicbaseTableParams]):
    """<!--zh
    在当前项目创建 MagicBase 表，并返回真实 table.id。

    project_id 自动来自当前会话 metadata，模型不要填写 project_id。
    -->
    Create a MagicBase table in the current project and return the real table.id.

    The project_id is loaded from current session metadata automatically. Do not ask the user for project_id.
    """
    name = "create_magicbase_table"

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
HTML 微应用工作流中，create_magicbase_table 会自动维护 MagicBase schema 记录：
- 调用 MagicBase 前自动在 workspace 根目录 `.magicbase/migrations.json` 追加 Pending migration
- 成功后自动更新为 Success，补真实 table_id，并刷新 `MICRO-APP.md` 里的最新 MagicBase 表结构
- 失败后自动更新为 Failed，并记录简短错误原因，不修改 `MICRO-APP.md` 的正式表结构

不要为了 schema migration 单独调用编辑文件工具。普通项目记忆由 `update_html_app_memory` 在开发任务结束前统一整理。
-->
	For HTML micro-app work, create_magicbase_table automatically maintains MagicBase schema records:
	- Before calling MagicBase, it appends a Pending migration to the workspace-root `.magicbase/migrations.json`.
	- On success, it updates that migration to Success, records the real table_id, and refreshes the latest MagicBase data model in `MICRO-APP.md`.
	- On failure, it updates that migration to Failed with a short error summary and does not modify the official data model in `MICRO-APP.md`.

	For any multi-user data app, decide who can read, insert, edit, and delete rows before creating the table. When the app has ownership, privacy, collaboration, organization, department, read-only, or restricted-edit semantics, keep `dynamic_permissions` in the table creation request. Do not fall back to public table creation after a permission parameter error.

	Use the appropriate row scope combination: full collaboration uses public read/edit/delete; everyone-can-read but creator-only editing uses row read public and edit/delete private_user; private personal data uses private_user for read/edit/delete; organization-shared data uses private_org where org-wide access is intended; department-shared data uses private_department where department access is intended; read-only or intake flows must not grant public edit/delete. `private_user` uses MagicBase system `created_by`; do not create `creator_user_id` only for permission enforcement.

	Before promising a permission feature, classify it as enforceable_by_magicbase, ui_only_not_secure, or requires_backend. MagicBase can enforce table/row/column/static grants. Status transitions, cross-table membership, manager hierarchy, thresholds, time windows, quotas, workflow rules, payments, approvals, inventory, finance, points, and other sensitive business validations require backend or a MagicBase permission-model extension. Front-end hidden buttons, disabled fields, or filtered lists are ui_only_not_secure and must not be described as enforced permissions.

	Do not call file-editing tools just to maintain schema migrations. Ordinary project memory is summarized with `update_html_app_memory` once before the development task ends.
	"""

    async def execute(self, tool_context: ToolContext, params: CreateMagicbaseTableParams) -> ToolResult:
        schema_error = _reject_schema_change_for_micro_app(tool_context)
        if schema_error:
            return schema_error
        try:
            project_id = _get_project_id(tool_context, params.app_id)
        except ValueError as e:
            return ToolResult.error(str(e))
        if not project_id:
            return ToolResult.error("Project ID is not available in the current session. Cannot create MagicBase table.")

        await _try_reconcile_pending_migrations(project_id)
        columns = [column.to_body() for column in params.columns]
        planned_columns = [_planned_column(column) for column in params.columns]
        migration = new_migration(
            operation="create_table",
            target={"table_key": params.table_key, "table_name": params.table_name},
            planned_schema={
                "columns": planned_columns,
                "description": params.description,
                "dynamic_permissions": params.dynamic_permissions,
            },
            reason="Create a MagicBase table for the HTML micro-app data model.",
        )
        try:
            await append_pending_migration(migration)
        except Exception as e:
            return ToolResult.error(f"Failed to update .magicbase/migrations.json before creating MagicBase table: {e}")

        try:
            result = await get_magic_service_sdk().magicbase.create_table_async(
                CreateMagicBaseTableParameter(
                    project_id=project_id,
                    table_key=params.table_key,
                    table_name=params.table_name,
                    columns=columns,
                    description=params.description,
                    project_name=params.project_name,
                    dynamic_permissions=params.dynamic_permissions,
                )
            )
        except (MagicServiceException, ValueError) as e:
            try:
                await complete_migration(migration["migration_id"], "Failed", error_summary=str(e))
            except Exception:
                pass
            return ToolResult.error(f"Failed to create MagicBase table: {e}")

        table = result.to_dict()
        memory_warning = ""
        try:
            await record_table_success(migration["migration_id"], table, planned_columns)
        except Exception as e:
            memory_warning = f" MagicBase memory update failed after table creation: {e}."
        content = (
            f"Created MagicBase table. {_table_summary(table)}. "
            f"Use the real table_id {_table_id(table)} in window.Magic.db row APIs."
            f"{memory_warning}"
        )
        return ToolResult(content=content, data={"project_id": project_id, "table": table})


class CreateMagicbaseColumnParams(MagicbaseProjectScopedParams):
    table_id: str = Field(
        description="""<!--zh: MagicBase 返回的真实 table.id，不是 table_key 或 table_name。-->
Real MagicBase table.id returned by MagicBase tools. Do not pass table_key or table_name."""
    )
    column_key: str = Field(
        description="""<!--zh: 字段唯一 key，必须稳定，建议用英文小写加下划线。-->
Stable unique column key. Use lowercase English with underscores when possible."""
    )
    column_name: str = Field(
        description="""<!--zh: 展示给用户看的字段名。-->
Human-readable column name shown to users."""
    )
    data_type: str = Field(
        description="""<!--zh: 字段类型。必须使用 MagicBase 支持的枚举值。-->
Column data type. Must be one of the MySQL-like MagicBase types: text, number, datetime, boolean, json."""
    )
    is_required: bool = Field(
        default=False,
        description="""<!--zh: 是否必填。-->
Whether this column is required."""
    )
    default_value: Any = Field(
        default=None,
        description="""<!--zh: 默认值，不需要默认值时留空。-->
Default value. Leave empty when no default is needed."""
    )
    dynamic_permission: Optional[Dict[str, Any]] = Field(
        default=None,
        description="""<!--zh: 字段动态权限配置，可选。只有普通用户确实可直接修改的字段才使用 public edit；归属、审核、审计、派生或只展示字段应使用更严格 edit_scope 或不提供编辑入口。后端行归属使用系统 created_by，不依赖动态 creator_user_id 字段。字段权限无法强制状态流转、跨表、阈值、时间窗口、配额、流程或敏感业务规则；纯前端隐藏控件只是 ui_only_not_secure，这类规则 requires_backend。-->
Optional column dynamic permission object. Pass it as an object, not as a JSON string. Use public edit only for fields ordinary users may directly modify. Ownership, review, audit, derived, or display-only business fields should use a restrictive edit_scope or no edit UI; backend row ownership uses system created_by, not a dynamic creator_user_id column. Column permissions cannot enforce state-dependent, cross-table, threshold, time-window, quota, workflow, or sensitive business rules; hiding controls in HTML is ui_only_not_secure and those rules require backend or MagicBase permission-model extension."""
    )

    @field_validator("data_type")
    @classmethod
    def _validate_data_type(cls, value: str) -> str:
        return _validate_mysql_like_data_type(value)

    @field_validator("dynamic_permission", mode="before")
    @classmethod
    def _validate_dynamic_permission(cls, value: Any) -> Optional[Dict[str, Any]]:
        return _coerce_permission_object(value, "dynamic_permission")


@tool(name="create_magicbase_column", code_mode_only=True)
class CreateMagicColumn(MagicBaseFriendlyRemarkMixin, BaseTool[CreateMagicbaseColumnParams]):
    """<!--zh
    给当前项目内已有 MagicBase 表新增字段。
    -->
    Create a column in an existing MagicBase table in the current project.
    """
    name = "create_magicbase_column"

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
HTML 微应用工作流中，create_magicbase_column 会自动维护 MagicBase schema 记录：
- 调用 MagicBase 前自动在 workspace 根目录 `.magicbase/migrations.json` 追加 Pending migration
- 成功后自动更新为 Success，补真实 column_id，并刷新 `MICRO-APP.md` 里的最新 MagicBase 表结构
- 失败后自动更新为 Failed，并记录简短错误原因，不修改 `MICRO-APP.md` 的正式表结构

不要为了 schema migration 单独调用编辑文件工具。普通项目记忆由 `update_html_app_memory` 在开发任务结束前统一整理。
-->
For HTML micro-app work, create_magicbase_column automatically maintains MagicBase schema records:
- Before calling MagicBase, it appends a Pending migration to the workspace-root `.magicbase/migrations.json`.
- On success, it updates that migration to Success, records the real column_id, and refreshes the latest MagicBase data model in `MICRO-APP.md`.
- On failure, it updates that migration to Failed with a short error summary and does not modify the official data model in `MICRO-APP.md`.

Do not call file-editing tools just to maintain schema migrations. Ordinary project memory is summarized with `update_html_app_memory` once before the development task ends.
"""

    async def execute(self, tool_context: ToolContext, params: CreateMagicbaseColumnParams) -> ToolResult:
        schema_error = _reject_schema_change_for_micro_app(tool_context)
        if schema_error:
            return schema_error
        try:
            project_id = _get_project_id(tool_context, params.app_id)
        except ValueError as e:
            return ToolResult.error(str(e))
        if not project_id:
            return ToolResult.error("Project ID is not available in the current session. Cannot create MagicBase column.")

        await _try_reconcile_pending_migrations(project_id)
        planned_column = _normalize_column(
            {
                "column_key": params.column_key,
                "column_name": params.column_name,
                "data_type": params.data_type,
                "is_required": params.is_required,
                "default_value": params.default_value,
                "dynamic_permission": params.dynamic_permission,
            }
        )
        migration = new_migration(
            operation="create_column",
            target={"table_id": params.table_id, "column_key": params.column_key},
            planned_schema={"column": planned_column},
            reason="Create a MagicBase column for the HTML micro-app data model.",
        )
        try:
            await append_pending_migration(migration)
        except Exception as e:
            return ToolResult.error(f"Failed to update .magicbase/migrations.json before creating MagicBase column: {e}")

        try:
            result = await get_magic_service_sdk().magicbase.create_column_async(
                CreateMagicBaseColumnParameter(
                    project_id=project_id,
                    table_id=params.table_id,
                    column_key=params.column_key,
                    column_name=params.column_name,
                    data_type=params.data_type,
                    is_required=params.is_required,
                    default_value=params.default_value,
                    dynamic_permission=params.dynamic_permission,
                )
            )
        except (MagicServiceException, ValueError) as e:
            try:
                await complete_migration(migration["migration_id"], "Failed", error_summary=str(e))
            except Exception:
                pass
            return ToolResult.error(f"Failed to create MagicBase column: {e}")

        column = result.to_dict()
        memory_warning = ""
        try:
            await record_column_success(migration["migration_id"], params.table_id, column)
        except Exception as e:
            memory_warning = f" MagicBase memory update failed after column creation: {e}."
        content = (
            f"Created MagicBase column column_id={column.get('column_id')}, "
            f"column_key={column.get('column_key')}, column_name={column.get('column_name')}, "
            f"data_type={column.get('data_type')} for table_id={params.table_id}."
            f"{memory_warning}"
        )
        return ToolResult(content=content, data={"project_id": project_id, "table_id": params.table_id, "column": column})


class UpdateMagicbaseTablePermissionsParams(MagicbaseProjectScopedParams):
    table_id: str = Field(
        description="""<!--zh: MagicBase 返回的真实 table.id，不是 table_key 或 table_name。-->
Real MagicBase table.id returned by MagicBase tools. Do not pass table_key or table_name."""
    )
    dynamic_permissions: Dict[str, Any] = Field(
        description="""<!--zh
        新的完整表动态权限配置。用于修改已有表的 table/row/columns dynamic_permissions。
        必须传完整对象，不要只传局部字段；未包含的部分会按 MagicBase 后端默认规则归一化。
        修改权限前应先用 get_magicbase_table 确认当前表结构和真实 table_id。
        -->
Full replacement dynamic permissions object for an existing table. Use this to update table/row/columns dynamic_permissions. Pass the complete object, not a partial patch; missing parts are normalized by MagicBase backend defaults. Call get_magicbase_table first to confirm the real table_id and current schema before changing permissions."""
    )

    @field_validator("dynamic_permissions", mode="before")
    @classmethod
    def _validate_dynamic_permissions(cls, value: Any) -> Dict[str, Any]:
        parsed = _coerce_permission_object(value, "dynamic_permissions")
        if parsed is None:
            raise ValueError("dynamic_permissions is required")
        return parsed


@tool(name="update_magicbase_table_permissions", code_mode_only=True)
class UpdateMagicTablePermissions(
    MagicBaseFriendlyRemarkMixin,
    BaseTool[UpdateMagicbaseTablePermissionsParams],
):
    """<!--zh
    修改当前项目内已有 MagicBase 表的动态权限。

    只用于更新 table/row/columns dynamic_permissions，不修改字段结构。
    -->
    Update dynamic permissions for an existing MagicBase table in the current project.

    This only updates table/row/columns dynamic_permissions and does not change columns.
    """
    name = "update_magicbase_table_permissions"

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
修改已有表权限前，必须先确认权限意图和真实 table_id。传入完整 dynamic_permissions 对象，不要只传局部 patch。
如果用户只是要求前端隐藏按钮但后端权限也需要强制生效，优先调用本工具更新 MagicBase 动态权限。
-->
Before updating an existing table's permissions, confirm the permission intent and real table_id. Pass a complete dynamic_permissions object, not a partial patch. If the user needs backend-enforced permissions rather than only hidden buttons, use this tool to update MagicBase dynamic permissions.
"""

    async def execute(self, tool_context: ToolContext, params: UpdateMagicbaseTablePermissionsParams) -> ToolResult:
        schema_error = _reject_schema_change_for_micro_app(tool_context)
        if schema_error:
            return schema_error
        try:
            project_id = _get_project_id(tool_context, params.app_id)
        except ValueError as e:
            return ToolResult.error(str(e))
        if not project_id:
            return ToolResult.error("Project ID is not available in the current session. Cannot update MagicBase table permissions.")

        await _try_reconcile_pending_migrations(project_id)
        migration = new_migration(
            operation="update_table_permissions",
            target={"table_id": params.table_id},
            planned_schema={"dynamic_permissions": params.dynamic_permissions},
            reason="Update dynamic permissions for an existing MagicBase table.",
        )
        try:
            await append_pending_migration(migration)
        except Exception as e:
            return ToolResult.error(f"Failed to update .magicbase/migrations.json before updating MagicBase table permissions: {e}")

        try:
            result = await get_magic_service_sdk().magicbase.update_table_permissions_async(
                UpdateMagicBaseTablePermissionsParameter(
                    project_id=project_id,
                    table_id=params.table_id,
                    dynamic_permissions=params.dynamic_permissions,
                )
            )
        except (MagicServiceException, ValueError) as e:
            try:
                await complete_migration(migration["migration_id"], "Failed", error_summary=str(e))
            except Exception:
                pass
            return ToolResult.error(f"Failed to update MagicBase table permissions: {e}")

        table = result.to_dict()
        memory_warning = ""
        try:
            await _record_table_update_success(migration["migration_id"], table)
        except Exception as e:
            memory_warning = f" MagicBase memory update failed after table permission update: {e}."
        content = f"Updated MagicBase table permissions. {_table_summary(table)}.{memory_warning}"
        return ToolResult(content=content, data={"project_id": project_id, "table": table})


class DeleteMagicbaseTableParams(MagicbaseProjectScopedParams):
    table_id: str = Field(
        description="""<!--zh: 要删除的 MagicBase 真实 table.id。删除表会删除表结构及其字段元数据，属于破坏性操作。-->
Real MagicBase table.id to delete. This is destructive and removes the table schema and column metadata."""
    )
    confirm_delete: bool = Field(
        default=False,
        description="""<!--zh: 删除表前必须已有用户明确确认；确认后传 true。-->
Set to true only after the user explicitly confirms deleting this table."""
    )


@tool(name="delete_magicbase_table", code_mode_only=True)
class DeleteMagicTable(MagicBaseFriendlyRemarkMixin, BaseTool[DeleteMagicbaseTableParams]):
    """<!--zh
    删除当前项目内已有 MagicBase 表。

    这是破坏性 schema 操作，必须在用户明确确认后使用。
    -->
    Delete an existing MagicBase table in the current project.

    This is a destructive schema operation and must only be used after explicit user confirmation.
    """
    name = "delete_magicbase_table"

    async def execute(self, tool_context: ToolContext, params: DeleteMagicbaseTableParams) -> ToolResult:
        schema_error = _reject_schema_change_for_micro_app(tool_context)
        if schema_error:
            return schema_error
        if not params.confirm_delete:
            return ToolResult.error("Deleting a MagicBase table requires confirm_delete=true after explicit user confirmation.")

        try:
            project_id = _get_project_id(tool_context, params.app_id)
        except ValueError as e:
            return ToolResult.error(str(e))
        if not project_id:
            return ToolResult.error("Project ID is not available in the current session. Cannot delete MagicBase table.")

        await _try_reconcile_pending_migrations(project_id)
        migration = new_migration(
            operation="delete_table",
            target={"table_id": params.table_id},
            planned_schema={},
            reason="Delete an existing MagicBase table after explicit user confirmation.",
        )
        try:
            await append_pending_migration(migration)
        except Exception as e:
            return ToolResult.error(f"Failed to update .magicbase/migrations.json before deleting MagicBase table: {e}")

        try:
            await get_magic_service_sdk().magicbase.delete_table_async(
                DeleteMagicBaseTableParameter(project_id=project_id, table_id=params.table_id)
            )
        except (MagicServiceException, ValueError) as e:
            try:
                await complete_migration(migration["migration_id"], "Failed", error_summary=str(e))
            except Exception:
                pass
            return ToolResult.error(f"Failed to delete MagicBase table: {e}")

        memory_warning = ""
        try:
            await _record_table_delete_success(migration["migration_id"], params.table_id)
        except Exception as e:
            memory_warning = f" MagicBase memory update failed after table deletion: {e}."
        content = f"Deleted MagicBase table table_id={params.table_id}.{memory_warning}"
        return ToolResult(content=content, data={"project_id": project_id, "table_id": params.table_id})


class UpdateMagicbaseColumnParams(MagicbaseProjectScopedParams):
    table_id: str = Field(
        description="""<!--zh: MagicBase 返回的真实 table.id。-->
Real MagicBase table.id returned by MagicBase tools."""
    )
    column_id: str = Field(
        description="""<!--zh: MagicBase 返回的真实 column.id，不是 column_key。-->
Real MagicBase column.id returned by MagicBase tools. Do not pass column_key."""
    )
    column_key: str = Field(
        description="""<!--zh: 更新后的完整字段 key。更新字段时必须传完整目标字段定义。-->
Complete desired column key after update. Updating a column requires the full target column definition."""
    )
    column_name: str = Field(
        description="""<!--zh: 更新后的完整字段名。-->
Complete desired human-readable column name after update."""
    )
    data_type: str = Field(
        description="""<!--zh: 更新后的完整字段类型。必须使用 MagicBase MySQL-like 类型。-->
Complete desired column data type after update. Must be one of the MagicBase MySQL-like types: text, number, datetime, boolean, json."""
    )
    is_required: bool = Field(
        default=False,
        description="""<!--zh: 更新后的是否必填。-->
Whether this column should be required after update."""
    )
    default_value: Any = Field(
        default=None,
        description="""<!--zh: 更新后的默认值，不需要默认值时留空。-->
Default value after update. Leave empty when no default is needed."""
    )
    dynamic_permission: Optional[Dict[str, Any]] = Field(
        default=None,
        description="""<!--zh: 更新后的字段动态权限配置，可选。若要保留原字段权限，先 get_magicbase_table 确认后传入相同配置；只有确认该字段不需要字段级权限时才省略。-->
Optional column dynamic permission after update. To preserve existing permissions, call get_magicbase_table first and pass the same permission object. Omit this field only when the column should not carry field-level dynamic permissions."""
    )

    @field_validator("data_type")
    @classmethod
    def _validate_data_type(cls, value: str) -> str:
        return _validate_mysql_like_data_type(value)

    @field_validator("dynamic_permission", mode="before")
    @classmethod
    def _validate_dynamic_permission(cls, value: Any) -> Optional[Dict[str, Any]]:
        return _coerce_permission_object(value, "dynamic_permission")


@tool(name="update_magicbase_column", code_mode_only=True)
class UpdateMagicColumn(MagicBaseFriendlyRemarkMixin, BaseTool[UpdateMagicbaseColumnParams]):
    """<!--zh
    修改当前项目内已有 MagicBase 字段。

    更新字段时传完整目标字段定义。建议先 get_magicbase_table 确认当前字段。
    -->
    Update an existing MagicBase column in the current project.

    Pass the complete desired column definition. Prefer calling get_magicbase_table first.
    """
    name = "update_magicbase_column"

    async def execute(self, tool_context: ToolContext, params: UpdateMagicbaseColumnParams) -> ToolResult:
        schema_error = _reject_schema_change_for_micro_app(tool_context)
        if schema_error:
            return schema_error
        try:
            project_id = _get_project_id(tool_context, params.app_id)
        except ValueError as e:
            return ToolResult.error(str(e))
        if not project_id:
            return ToolResult.error("Project ID is not available in the current session. Cannot update MagicBase column.")

        await _try_reconcile_pending_migrations(project_id)
        planned_column = _normalize_column(
            {
                "column_id": params.column_id,
                "column_key": params.column_key,
                "column_name": params.column_name,
                "data_type": params.data_type,
                "is_required": params.is_required,
                "default_value": params.default_value,
                "dynamic_permission": params.dynamic_permission,
            }
        )
        migration = new_migration(
            operation="update_column",
            target={"table_id": params.table_id, "column_id": params.column_id},
            planned_schema={"column": planned_column},
            reason="Update an existing MagicBase column for the HTML micro-app data model.",
        )
        try:
            await append_pending_migration(migration)
        except Exception as e:
            return ToolResult.error(f"Failed to update .magicbase/migrations.json before updating MagicBase column: {e}")

        try:
            result = await get_magic_service_sdk().magicbase.update_column_async(
                UpdateMagicBaseColumnParameter(
                    project_id=project_id,
                    table_id=params.table_id,
                    column_id=params.column_id,
                    column_key=params.column_key,
                    column_name=params.column_name,
                    data_type=params.data_type,
                    is_required=params.is_required,
                    default_value=params.default_value,
                    dynamic_permission=params.dynamic_permission,
                )
            )
        except (MagicServiceException, ValueError) as e:
            try:
                await complete_migration(migration["migration_id"], "Failed", error_summary=str(e))
            except Exception:
                pass
            return ToolResult.error(f"Failed to update MagicBase column: {e}")

        column = result.to_dict()
        memory_warning = ""
        try:
            await _record_column_update_success(migration["migration_id"], params.table_id, column)
        except Exception as e:
            memory_warning = f" MagicBase memory update failed after column update: {e}."
        content = (
            f"Updated MagicBase column column_id={column.get('column_id')}, "
            f"column_key={column.get('column_key')}, column_name={column.get('column_name')}, "
            f"data_type={column.get('data_type')} for table_id={params.table_id}."
            f"{memory_warning}"
        )
        return ToolResult(content=content, data={"project_id": project_id, "table_id": params.table_id, "column": column})


class DeleteMagicbaseColumnParams(MagicbaseProjectScopedParams):
    table_id: str = Field(
        description="""<!--zh: MagicBase 返回的真实 table.id。-->
Real MagicBase table.id returned by MagicBase tools."""
    )
    column_id: str = Field(
        description="""<!--zh: 要删除的 MagicBase 真实 column.id。删除字段属于破坏性操作。-->
Real MagicBase column.id to delete. This is a destructive schema operation."""
    )
    confirm_delete: bool = Field(
        default=False,
        description="""<!--zh: 删除字段前必须已有用户明确确认；确认后传 true。-->
Set to true only after the user explicitly confirms deleting this column."""
    )


@tool(name="delete_magicbase_column", code_mode_only=True)
class DeleteMagicColumn(MagicBaseFriendlyRemarkMixin, BaseTool[DeleteMagicbaseColumnParams]):
    """<!--zh
    删除当前项目内已有 MagicBase 字段。

    这是破坏性 schema 操作，必须在用户明确确认后使用。
    -->
    Delete an existing MagicBase column in the current project.

    This is a destructive schema operation and must only be used after explicit user confirmation.
    """
    name = "delete_magicbase_column"

    async def execute(self, tool_context: ToolContext, params: DeleteMagicbaseColumnParams) -> ToolResult:
        schema_error = _reject_schema_change_for_micro_app(tool_context)
        if schema_error:
            return schema_error
        if not params.confirm_delete:
            return ToolResult.error("Deleting a MagicBase column requires confirm_delete=true after explicit user confirmation.")

        try:
            project_id = _get_project_id(tool_context, params.app_id)
        except ValueError as e:
            return ToolResult.error(str(e))
        if not project_id:
            return ToolResult.error("Project ID is not available in the current session. Cannot delete MagicBase column.")

        await _try_reconcile_pending_migrations(project_id)
        migration = new_migration(
            operation="delete_column",
            target={"table_id": params.table_id, "column_id": params.column_id},
            planned_schema={},
            reason="Delete an existing MagicBase column after explicit user confirmation.",
        )
        try:
            await append_pending_migration(migration)
        except Exception as e:
            return ToolResult.error(f"Failed to update .magicbase/migrations.json before deleting MagicBase column: {e}")

        try:
            await get_magic_service_sdk().magicbase.delete_column_async(
                DeleteMagicBaseColumnParameter(
                    project_id=project_id,
                    table_id=params.table_id,
                    column_id=params.column_id,
                )
            )
        except (MagicServiceException, ValueError) as e:
            try:
                await complete_migration(migration["migration_id"], "Failed", error_summary=str(e))
            except Exception:
                pass
            return ToolResult.error(f"Failed to delete MagicBase column: {e}")

        memory_warning = ""
        try:
            await _record_column_delete_success(migration["migration_id"], params.table_id, params.column_id)
        except Exception as e:
            memory_warning = f" MagicBase memory update failed after column deletion: {e}."
        content = f"Deleted MagicBase column column_id={params.column_id} for table_id={params.table_id}.{memory_warning}"
        return ToolResult(
            content=content,
            data={"project_id": project_id, "table_id": params.table_id, "column_id": params.column_id},
        )
