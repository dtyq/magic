from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError

from agentlang.context.tool_context import ToolContext
from app.infrastructure.sdk.magic_service.api.magicbase_api import MagicBaseApi
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
from app.infrastructure.sdk.magic_service.result import (
    MagicBaseBatchCreateRowsResult,
    MagicBaseBatchDeleteRowsResult,
    MagicBaseRowResult,
    MagicBaseRowsResult,
    MagicBaseTableResult,
    MagicBaseTablesResult,
)
from app.tools.magicbase_tools import (
    BatchCreateMagicbaseRowsParams,
    BatchCreateMagicRows,
    BatchDeleteMagicbaseRowsParams,
    BatchDeleteMagicRows,
    BatchGetMagicbaseRowsParams,
    BatchGetMagicRows,
    CreateMagicbaseRowParams,
    CreateMagicbaseTableParams,
    CreateMagicColumn,
    CreateMagicRow,
    CreateMagicTable,
    DeleteMagicbaseRowParams,
    DeleteMagicColumn,
    DeleteMagicRow,
    DeleteMagicTable,
    GetMagicbaseRowParams,
    GetMagicbaseTableParams,
    GetMagicRow,
    GetMagicTable,
    MagicbaseColumnDefinition,
    QueryMagicbaseRowsParams,
    QueryMagicbaseTablesAllMentionedAppsParams,
    QueryMagicbaseTablesParams,
    QueryMagicRows,
    QueryMagicTables,
    QueryMagicTablesAllMentionedApps,
    UpdateMagicbaseRowParams,
    UpdateMagicColumn,
    UpdateMagicRow,
    UpdateMagicTablePermissions,
    _get_project_id,
)
from app.utils.async_file_utils import async_read_json

MAGICBASE_TOOL_CLASSES = (
    QueryMagicTables,
    QueryMagicTablesAllMentionedApps,
    GetMagicTable,
    QueryMagicRows,
    BatchGetMagicRows,
    GetMagicRow,
    CreateMagicRow,
    UpdateMagicRow,
    BatchCreateMagicRows,
    DeleteMagicRow,
    BatchDeleteMagicRows,
    CreateMagicTable,
    CreateMagicColumn,
    UpdateMagicTablePermissions,
    DeleteMagicTable,
    UpdateMagicColumn,
    DeleteMagicColumn,
)


def test_all_magicbase_tools_are_code_mode_only():
    for tool_class in MAGICBASE_TOOL_CLASSES:
        assert tool_class.code_mode_only is True, tool_class.__name__


@pytest.mark.parametrize(
    "record_ids",
    [
        ["not-a-record-id"],
        [str(index) for index in range(101)],
    ],
)
def test_batch_get_magicbase_rows_rejects_invalid_record_ids(record_ids):
    with pytest.raises(ValidationError):
        BatchGetMagicbaseRowsParams(table_id="200", record_ids=record_ids)


def test_batch_get_magicbase_rows_canonicalizes_numeric_ids():
    params = BatchGetMagicbaseRowsParams(table_id="200", record_ids=["0001", "2"])
    assert params.record_ids == ["1", "2"]


class RecordingMagicBaseApi(MagicBaseApi):
    def __init__(self):
        self.call = None
        self.response = {}

    async def request_by_parameter_async(self, parameter, method: str, endpoint_path: str):
        self.call = (parameter, method, endpoint_path)
        return self.response


@pytest.mark.asyncio
async def test_magicbase_api_uses_expected_endpoint_paths():
    api = RecordingMagicBaseApi()

    api.response = []
    await api.query_tables_async(QueryMagicBaseTablesParameter(project_id="100"))
    assert api.call[1:] == ("GET", "/api/v1/magicbase/projects/100/tables")

    api.response = {"id": 200}
    await api.get_table_async(GetMagicBaseTableParameter(project_id="100", table_id="200"))
    assert api.call[1:] == ("GET", "/api/v1/magicbase/projects/100/tables/200")

    await api.create_table_async(
        CreateMagicBaseTableParameter(
            project_id="100",
            table_key="survey",
            table_name="Survey",
            columns=[{"column_key": "name", "column_name": "Name", "data_type": "text"}],
        )
    )
    assert api.call[1:] == ("POST", "/api/v1/magicbase/projects/100/tables")

    await api.create_column_async(
        CreateMagicBaseColumnParameter(
            project_id="100",
            table_id="200",
            column_key="name",
            column_name="Name",
            data_type="text",
        )
    )
    assert api.call[1:] == ("POST", "/api/v1/magicbase/projects/100/tables/200/columns")

    await api.update_table_permissions_async(
        UpdateMagicBaseTablePermissionsParameter(
            project_id="100",
            table_id="200",
            dynamic_permissions={"row": {"read_scope": "public", "edit_scope": "private_user"}},
        )
    )
    assert api.call[1:] == ("PATCH", "/api/v1/magicbase/projects/100/tables/200")

    await api.delete_table_async(DeleteMagicBaseTableParameter(project_id="100", table_id="200"))
    assert api.call[1:] == ("DELETE", "/api/v1/magicbase/projects/100/tables/200")

    await api.update_column_async(
        UpdateMagicBaseColumnParameter(
            project_id="100",
            table_id="200",
            column_id="300",
            column_key="name",
            column_name="Name",
            data_type="text",
        )
    )
    assert api.call[1:] == ("PATCH", "/api/v1/magicbase/projects/100/tables/200/columns/300")

    await api.delete_column_async(DeleteMagicBaseColumnParameter(project_id="100", table_id="200", column_id="300"))
    assert api.call[1:] == ("DELETE", "/api/v1/magicbase/projects/100/tables/200/columns/300")

    api.response = {"page": 1, "page_size": 20, "total": 1, "list": [{"id": 400}]}
    rows = await api.query_rows_async(
        QueryMagicBaseRowsParameter(project_id="100", table_id="200", select=["id"])
    )
    assert api.call[1:] == ("POST", "/api/v1/magicbase/projects/100/tables/200/query")
    assert rows.to_dict()["rows"][0]["id"] == "400"

    api.response = {"id": 401, "title": "Created"}
    row = await api.create_row_async(
        CreateMagicBaseRowParameter(project_id="100", table_id="200", data={"title": "Created"})
    )
    assert api.call[1:] == ("POST", "/api/v1/magicbase/projects/100/tables/200/rows")
    assert row.to_dict()["id"] == "401"

    api.response = {"id": 401, "title": "Loaded"}
    loaded = await api.get_row_async(
        GetMagicBaseRowParameter(project_id="100", table_id="200", record_id="401")
    )
    assert api.call[1:] == ("GET", "/api/v1/magicbase/projects/100/tables/200/rows/401")
    assert loaded.to_dict()["title"] == "Loaded"

    api.response = {"id": 401, "title": "Updated"}
    updated = await api.update_row_async(
        UpdateMagicBaseRowParameter(
            project_id="100",
            table_id="200",
            record_id="401",
            data={"title": "Updated"},
        )
    )
    assert api.call[1:] == ("PATCH", "/api/v1/magicbase/projects/100/tables/200/rows/401")
    assert updated.to_dict()["title"] == "Updated"

    api.response = {
        "created_count": 2,
        "record_ids": [402, 403],
        "rows": [{"id": 402}, {"id": 403}],
    }
    batch_created = await api.batch_create_rows_async(
        BatchCreateMagicBaseRowsParameter(
            project_id="100",
            table_id="200",
            rows=[{"title": "A"}, {"title": "B"}],
        )
    )
    assert api.call[1:] == ("POST", "/api/v1/magicbase/projects/100/tables/200/rows/batch")
    assert batch_created.to_dict()["record_ids"] == ["402", "403"]

    api.response = {}
    await api.delete_row_async(
        DeleteMagicBaseRowParameter(project_id="100", table_id="200", record_id="402")
    )
    assert api.call[1:] == ("DELETE", "/api/v1/magicbase/projects/100/tables/200/rows/402")

    api.response = {"deleted_count": 2, "record_ids": [402, 403]}
    batch_deleted = await api.batch_delete_rows_async(
        BatchDeleteMagicBaseRowsParameter(
            project_id="100",
            table_id="200",
            record_ids=["402", "403"],
        )
    )
    assert api.call[1:] == ("POST", "/api/v1/magicbase/projects/100/tables/200/rows/batch-delete")
    assert batch_deleted.to_dict()["record_ids"] == ["402", "403"]


def test_magicbase_result_normalizes_camel_and_snake_case():
    table = MagicBaseTableResult(
        {
            "id": 200,
            "projectId": 100,
            "tableKey": "survey",
            "tableName": "Survey",
            "columns": [
                {
                    "id": 300,
                    "columnKey": "name",
                    "columnName": "Name",
                    "dataType": "text",
                    "isRequired": True,
                }
            ],
        }
    ).to_dict()

    assert table["table_id"] == "200"
    assert table["project_id"] == "100"
    assert table["table_key"] == "survey"
    assert table["columns"][0]["column_id"] == "300"
    assert table["columns"][0]["column_key"] == "name"
    assert table["columns"][0]["is_required"] is True

    tables = MagicBaseTablesResult([{"id": 201, "table_key": "logs", "table_name": "Logs"}]).to_dict()
    assert tables["tables"][0]["table_id"] == "201"
    assert tables["tables"][0]["table_key"] == "logs"


def test_magicbase_table_parameter_strips_legacy_column_options():
    parameter = CreateMagicBaseTableParameter(
        project_id="100",
        table_key="survey",
        table_name="Survey",
        columns=[
            {
                "column_key": "status",
                "column_name": "Status",
                "data_type": "text",
                "options": [{"label": "Open", "value": "open"}],
            }
        ],
    )

    body = parameter.to_body()

    assert "options" not in body["columns"][0]


def test_magicbase_sdk_parameters_reject_legacy_low_code_types():
    with pytest.raises(ValueError):
        CreateMagicBaseColumnParameter(
            project_id="100",
            table_id="200",
            column_key="usage_purpose",
            column_name="Usage Purpose",
            data_type="multi_select",
        ).validate()

    with pytest.raises(ValueError):
        CreateMagicBaseTableParameter(
            project_id="100",
            table_key="survey",
            table_name="Survey",
            columns=[
                {
                    "column_key": "usage_purpose",
                    "column_name": "Usage Purpose",
                    "data_type": "multi_select",
                }
            ],
        ).validate()


def test_magicbase_column_definition_rejects_legacy_low_code_types():
    with pytest.raises(ValidationError):
        MagicbaseColumnDefinition(
            column_key="usage_purpose",
            column_name="Usage Purpose",
            data_type="multi_select",
        )


@pytest.mark.asyncio
async def test_query_magicbase_tables_fails_without_project_id():
    with patch("app.tools.magicbase_tools.InitClientMessageUtil.get_metadata", return_value={}):
        result = await QueryMagicTables().execute(None, QueryMagicbaseTablesParams())

    assert result.ok is False
    assert "Project ID is not available" in result.content


def test_magicbase_row_parameter_uses_current_session_identity():
    with (
        patch(
            "app.utils.init_client_message_util.InitClientMessageUtil.get_full_config",
            return_value={"metadata": {"user_id": "user-1"}},
        ),
        patch(
            "app.utils.init_client_message_util.InitClientMessageUtil.get_user_authorization",
            return_value="Bearer current-user",
        ),
        patch(
            "app.utils.init_client_message_util.InitClientMessageUtil.get_metadata",
            return_value={"organization_code": "org-1"},
        ),
    ):
        parameter = CreateMagicBaseRowParameter(
            project_id="100",
            table_id="200",
            data={"title": "Current user row"},
        )

    parameter.validate()
    assert parameter.to_headers()["Authorization"] == "Bearer current-user"
    assert parameter.to_headers()["organization-code"] == "org-1"
    assert "token" not in parameter.to_headers()


@pytest.mark.asyncio
async def test_magicbase_row_tool_rejects_project_context_mismatch():
    tool_context = ToolContext(metadata={"project_id": "200"})
    with patch(
        "app.tools.magicbase_tools.InitClientMessageUtil.get_metadata",
        return_value={"project_id": "100"},
    ):
        result = await QueryMagicRows().execute(
            tool_context,
            QueryMagicbaseRowsParams(table_id="300"),
        )

    assert result.ok is False
    assert "does not match" in result.content


def test_micro_app_scope_overrides_conversation_project():
    tool_context = ToolContext(metadata={"project_id": "123"})
    with (
        patch(
            "app.tools.magicbase_tools.resolve_magicbase_project_id",
            return_value="456",
        ),
        patch(
            "app.tools.magicbase_tools.InitClientMessageUtil.get_metadata",
            return_value={"project_id": "123"},
        ),
    ):
        assert _get_project_id(tool_context) == "456"


def test_get_project_id_requires_app_id_when_multiple_scopes():
    def resolve(app_id=None):
        if not app_id:
            raise ValueError("Pass app_id from the mention on this MagicBase tool call.")
        return "project-2"

    with patch("app.tools.magicbase_tools.resolve_magicbase_project_id", side_effect=resolve):
        with pytest.raises(ValueError, match="Pass app_id"):
            _get_project_id(None, None)
        assert _get_project_id(None, "app-2") == "project-2"


@pytest.mark.asyncio
async def test_query_magicbase_tables_uses_app_id_for_multi_scope():
    sdk = MagicMock()
    sdk.magicbase.query_tables_async = AsyncMock(
        return_value=type("Result", (), {"to_dict": lambda self: {"tables": []}})()
    )
    with (
        patch(
            "app.tools.magicbase_tools.resolve_magicbase_project_id",
            return_value="project-2",
        ),
        patch(
            "app.tools.magicbase_tools.get_magic_service_sdk",
            return_value=sdk,
        ),
        patch(
            "app.tools.magicbase_tools._reconcile_pending_migrations_with_tables",
            new=AsyncMock(return_value=0),
        ),
    ):
        result = await QueryMagicTables().execute(
            None,
            QueryMagicbaseTablesParams(app_id="app-2"),
        )

    assert result.ok is True
    sdk.magicbase.query_tables_async.assert_awaited_once()
    assert sdk.magicbase.query_tables_async.await_args.args[0].project_id == "project-2"


@pytest.mark.asyncio
async def test_query_magicbase_tables_all_mentioned_apps_requires_multiple_scopes():
    with patch(
        "app.tools.magicbase_tools.get_micro_app_project_scopes",
        return_value={"app-1": {"project_id": "project-1", "app_name": "App One"}},
    ):
        result = await QueryMagicTablesAllMentionedApps().execute(
            None,
            QueryMagicbaseTablesAllMentionedAppsParams(),
        )
    assert result.ok is False
    assert "at least two" in result.content


@pytest.mark.asyncio
async def test_query_magicbase_tables_all_mentioned_apps_queries_each_scope():
    scopes = {
        "app-1": {"project_id": "project-1", "app_name": "App One"},
        "app-2": {"project_id": "project-2", "app_name": "App Two"},
    }
    sdk = MagicMock()
    sdk.magicbase.query_tables_async = AsyncMock(
        side_effect=[
            type("Result", (), {"to_dict": lambda self: {"tables": [{"table_id": "t1"}]}})(),
            type("Result", (), {"to_dict": lambda self: {"tables": []}})(),
        ]
    )
    with (
        patch("app.tools.magicbase_tools.get_micro_app_project_scopes", return_value=scopes),
        patch("app.tools.magicbase_tools.get_magic_service_sdk", return_value=sdk),
        patch(
            "app.tools.magicbase_tools._reconcile_pending_migrations_with_tables",
            new=AsyncMock(return_value=0),
        ),
    ):
        result = await QueryMagicTablesAllMentionedApps().execute(
            None,
            QueryMagicbaseTablesAllMentionedAppsParams(),
        )

    assert result.ok is True
    assert len(result.data["apps"]) == 2
    assert result.data["apps"][0]["tables"][0]["table_id"] == "t1"
    assert sdk.magicbase.query_tables_async.await_count == 2


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tool", "params"),
    [
        (
            DeleteMagicRow(),
            DeleteMagicbaseRowParams(table_id="200", record_id="300"),
        ),
        (
            BatchDeleteMagicRows(),
            BatchDeleteMagicbaseRowsParams(table_id="200", record_ids=["300", "301"]),
        ),
    ],
)
async def test_magicbase_delete_tools_require_explicit_confirmation(tool, params):
    with patch("app.tools.magicbase_tools.get_magic_service_sdk", new_callable=AsyncMock) as get_sdk:
        result = await tool.execute(ToolContext(metadata={"project_id": "100"}), params)

    assert result.ok is False
    assert "confirm_delete=true" in result.content
    get_sdk.assert_not_called()


@pytest.mark.asyncio
async def test_micro_app_batch_create_requires_confirmation():
    params = BatchCreateMagicbaseRowsParams(table_id="200", rows=[{"name": "Alice"}])
    with (
        patch(
            "app.tools.magicbase_tools.has_bound_micro_app_project_scope",
            return_value=True,
        ),
        patch("app.tools.magicbase_tools.get_magic_service_sdk", new_callable=AsyncMock) as get_sdk,
    ):
        result = await BatchCreateMagicRows().execute(
            ToolContext(metadata={"project_id": "100"}),
            params,
        )

    assert result.ok is False
    assert "ask_user" in result.content
    get_sdk.assert_not_called()


@pytest.mark.asyncio
async def test_micro_app_schema_changes_are_rejected():
    with patch(
        "app.tools.magicbase_tools.has_bound_micro_app_project_scope",
        return_value=True,
    ):
        result = await CreateMagicTable().execute(
            ToolContext(metadata={"project_id": "100"}),
            CreateMagicbaseTableParams(table_key="demo", table_name="Demo", columns=[]),
        )

    assert result.ok is False
    assert "schema" in result.content.lower()


@pytest.mark.asyncio
async def test_magicbase_row_tools_forward_expected_payloads():
    class FakeMagicBase:
        def __init__(self):
            self.calls = []

        async def query_rows_async(self, parameter):
            self.calls.append(("query", parameter))
            if parameter.filter.get("record_id"):
                return MagicBaseRowsResult(
                    {"page": 1, "page_size": 2, "total": 1, "list": [{"id": 301, "title": "A"}]}
                )
            return MagicBaseRowsResult(
                {"page": 1, "page_size": 20, "total": 1, "list": [{"id": 300, "title": "A"}]}
            )

        async def create_row_async(self, parameter):
            self.calls.append(("create", parameter))
            return MagicBaseRowResult({"id": 301, **parameter.data})

        async def get_row_async(self, parameter):
            self.calls.append(("get", parameter))
            return MagicBaseRowResult({"id": 301, "title": "A"})

        async def update_row_async(self, parameter):
            self.calls.append(("update", parameter))
            return MagicBaseRowResult({"id": 301, **parameter.data})

        async def batch_create_rows_async(self, parameter):
            self.calls.append(("batch_create", parameter))
            return MagicBaseBatchCreateRowsResult(
                {
                    "created_count": len(parameter.rows),
                    "record_ids": [302, 303],
                    "rows": [{"id": 302}, {"id": 303}],
                }
            )

        async def delete_row_async(self, parameter):
            self.calls.append(("delete", parameter))

        async def batch_delete_rows_async(self, parameter):
            self.calls.append(("batch_delete", parameter))
            return MagicBaseBatchDeleteRowsResult(
                {"deleted_count": len(parameter.record_ids), "record_ids": parameter.record_ids}
            )

    class FakeSdk:
        magicbase = FakeMagicBase()

    tool_context = ToolContext(metadata={"project_id": "100"})
    with (
        patch("app.tools.magicbase_tools.InitClientMessageUtil.get_metadata", return_value={"project_id": "100"}),
        patch("app.tools.magicbase_tools.get_magic_service_sdk", return_value=FakeSdk()),
    ):
        query_result = await QueryMagicRows().execute(
            tool_context,
            QueryMagicbaseRowsParams(table_id="200", filter={"status": {"eq": "open"}}, select=["id"]),
        )
        create_result = await CreateMagicRow().execute(
            tool_context,
            CreateMagicbaseRowParams(table_id="200", data={"title": "A"}, select=["id"]),
        )
        get_result = await GetMagicRow().execute(
            tool_context,
            GetMagicbaseRowParams(table_id="200", record_id="301", select=["id"]),
        )
        batch_get_result = await BatchGetMagicRows().execute(
            tool_context,
            BatchGetMagicbaseRowsParams(table_id="200", record_ids=["301", "302"], select=["title"]),
        )
        update_result = await UpdateMagicRow().execute(
            tool_context,
            UpdateMagicbaseRowParams(table_id="200", record_id="301", data={"title": "B"}),
        )
        batch_create_result = await BatchCreateMagicRows().execute(
            tool_context,
            BatchCreateMagicbaseRowsParams(table_id="200", rows=[{"title": "A"}, {"title": "B"}]),
        )
        delete_result = await DeleteMagicRow().execute(
            tool_context,
            DeleteMagicbaseRowParams(table_id="200", record_id="302", confirm_delete=True),
        )
        batch_delete_result = await BatchDeleteMagicRows().execute(
            tool_context,
            BatchDeleteMagicbaseRowsParams(
                table_id="200",
                record_ids=["302", "303"],
                confirm_delete=True,
            ),
        )

    assert query_result.ok is True
    assert create_result.data["row"]["id"] == "301"
    assert get_result.data["row"]["title"] == "A"
    assert batch_get_result.data["rows"] == [{"id": "301", "title": "A"}]
    assert batch_get_result.data["missing_record_ids"] == ["302"]
    assert "1 requested row(s) were not found or not readable" in batch_get_result.content
    batch_query_parameter = FakeSdk.magicbase.calls[3][1]
    assert batch_query_parameter.filter == {"record_id": {"in": ["301", "302"]}}
    assert batch_query_parameter.page_size == 2
    assert batch_query_parameter.select == ["id", "title"]
    assert update_result.data["row"]["title"] == "B"
    assert batch_create_result.data["record_ids"] == ["302", "303"]
    assert delete_result.ok is True
    assert batch_delete_result.data["deleted_count"] == 2
    assert [call[0] for call in FakeSdk.magicbase.calls] == [
        "query",
        "create",
        "get",
        "query",
        "update",
        "batch_create",
        "delete",
        "batch_delete",
    ]


@pytest.mark.asyncio
async def test_create_magicbase_table_returns_real_table_id(tmp_path):
    class FakeMagicBase:
        async def create_table_async(self, parameter):
            assert parameter.project_id == "100"
            assert parameter.table_key == "survey"
            return MagicBaseTableResult(
                {
                    "id": 200,
                    "tableKey": "survey",
                    "tableName": "Survey",
                    "columns": [
                        {
                            "id": 300,
                            "columnKey": "name",
                            "columnName": "Name",
                            "dataType": "text",
                        }
                    ],
                }
            )

    class FakeSdk:
        magicbase = FakeMagicBase()

    params = CreateMagicbaseTableParams(
        table_key="survey",
        table_name="Survey",
        columns=[
            MagicbaseColumnDefinition(
                column_key="name",
                column_name="Name",
                data_type="text",
            )
        ],
    )

    with (
        patch("app.service.html_app_memory_service.PathManager.get_workspace_dir", return_value=tmp_path),
        patch("app.tools.magicbase_tools.InitClientMessageUtil.get_metadata", return_value={"project_id": "100"}),
        patch("app.tools.magicbase_tools.get_magic_service_sdk", return_value=FakeSdk()),
    ):
        result = await CreateMagicTable().execute(None, params)

    assert result.ok is True
    assert "Use the real table_id 200" in result.content
    assert result.data["table"]["table_id"] == "200"

    state = await async_read_json(tmp_path / ".magicbase" / "migrations.json")
    assert len(state["migrations"]) == 1
    assert state["migrations"][0]["result_table_id"] == "200"
    assert "result" not in state["migrations"][0]


@pytest.mark.asyncio
@pytest.mark.parametrize("operation", ["query", "get", "query_all"])
@pytest.mark.parametrize("host_project_id", ["100", ""])
async def test_referenced_table_reads_do_not_reconcile_host_migrations(operation, host_project_id):
    table = {"id": "foreign-table", "table_key": "orders", "table_name": "Orders"}
    state = {
        "data_model": {"tables": []},
        "migrations": [{"status": "Pending", "operation": "create_table", "target": {"table_key": "orders"}}],
    }
    sdk = MagicMock()
    sdk.magicbase.query_tables_async = AsyncMock(return_value=MagicMock(to_dict=lambda: {"tables": [table]}))
    sdk.magicbase.get_table_async = AsyncMock(return_value=MagicMock(to_dict=lambda: table))
    scopes = {
        "app-1": {"project_id": "200", "app_name": "App One"},
        "app-2": {"project_id": "300", "app_name": "App Two"},
    }
    with (
        patch("app.tools.magicbase_tools.InitClientMessageUtil.get_metadata", return_value={"project_id": host_project_id}),
        patch("app.tools.magicbase_tools.resolve_magicbase_project_id", return_value="200"),
        patch("app.tools.magicbase_tools.get_micro_app_project_scopes", return_value=scopes),
        patch("app.tools.magicbase_tools.get_magic_service_sdk", return_value=sdk),
        patch("app.tools.magicbase_tools.read_migrations_state", new=AsyncMock(return_value=state)) as read,
        patch("app.tools.magicbase_tools.write_migrations_state", new=AsyncMock()) as write,
        patch("app.tools.magicbase_tools.sync_html_app_magicbase_model", new=AsyncMock()) as sync,
    ):
        if operation == "query":
            result = await QueryMagicTables().execute(None, QueryMagicbaseTablesParams(app_id="app-1"))
        elif operation == "get":
            result = await GetMagicTable().execute(None, GetMagicbaseTableParams(table_id="foreign-table", app_id="app-1"))
        else:
            result = await QueryMagicTablesAllMentionedApps().execute(None, QueryMagicbaseTablesAllMentionedAppsParams())

    assert result.ok
    read.assert_not_awaited()
    write.assert_not_awaited()
    sync.assert_not_awaited()
    assert state["migrations"][0]["status"] == "Pending"
    assert state["data_model"]["tables"] == []


@pytest.mark.asyncio
@pytest.mark.parametrize("operation", ["query", "get"])
async def test_host_table_reads_still_reconcile_pending_migrations(operation):
    table = {"id": "host-table", "table_key": "orders", "table_name": "Orders"}
    state = {
        "data_model": {"tables": []},
        "migrations": [{"status": "Pending", "operation": "create_table", "target": {"table_key": "orders"}}],
    }
    sdk = MagicMock()
    sdk.magicbase.query_tables_async = AsyncMock(return_value=MagicMock(to_dict=lambda: {"tables": [table]}))
    sdk.magicbase.get_table_async = AsyncMock(return_value=MagicMock(to_dict=lambda: table))
    with (
        patch("app.tools.magicbase_tools.InitClientMessageUtil.get_metadata", return_value={"project_id": "100"}),
        patch("app.tools.magicbase_tools.resolve_magicbase_project_id", return_value=None),
        patch("app.tools.magicbase_tools.get_magic_service_sdk", return_value=sdk),
        patch("app.tools.magicbase_tools.read_migrations_state", new=AsyncMock(return_value=state)),
        patch("app.tools.magicbase_tools.write_migrations_state", new=AsyncMock()) as write,
        patch("app.tools.magicbase_tools.sync_html_app_magicbase_model", new=AsyncMock()) as sync,
    ):
        if operation == "query":
            result = await QueryMagicTables().execute(None, QueryMagicbaseTablesParams())
        else:
            result = await GetMagicTable().execute(None, GetMagicbaseTableParams(table_id="host-table"))

    assert result.ok
    assert state["migrations"][0]["status"] == "Success"
    assert state["migrations"][0]["result_table_id"] == "host-table"
    write.assert_awaited_once()
    sync.assert_awaited_once()
