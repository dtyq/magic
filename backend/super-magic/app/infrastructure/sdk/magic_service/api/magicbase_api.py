"""
MagicBase API.

API wrapper for MagicBase endpoints hosted by Magic Service.
"""

from ..kernel.magic_service_api import MagicServiceAbstractApi
from ..parameter.create_magicbase_column_parameter import CreateMagicBaseColumnParameter
from ..parameter.create_magicbase_table_parameter import CreateMagicBaseTableParameter
from ..parameter.delete_magicbase_column_parameter import DeleteMagicBaseColumnParameter
from ..parameter.delete_magicbase_table_parameter import DeleteMagicBaseTableParameter
from ..parameter.get_magicbase_table_parameter import GetMagicBaseTableParameter
from ..parameter.magicbase_row_parameter import (
    BatchCreateMagicBaseRowsParameter,
    BatchDeleteMagicBaseRowsParameter,
    CreateMagicBaseRowParameter,
    DeleteMagicBaseRowParameter,
    GetMagicBaseRowParameter,
    QueryMagicBaseRowsParameter,
    UpdateMagicBaseRowParameter,
)
from ..parameter.query_magicbase_tables_parameter import QueryMagicBaseTablesParameter
from ..parameter.update_magicbase_column_parameter import UpdateMagicBaseColumnParameter
from ..parameter.update_magicbase_table_permissions_parameter import UpdateMagicBaseTablePermissionsParameter
from ..result.magicbase_column_result import MagicBaseColumnResult
from ..result.magicbase_row_result import (
    MagicBaseBatchCreateRowsResult,
    MagicBaseBatchDeleteRowsResult,
    MagicBaseRowResult,
    MagicBaseRowsResult,
)
from ..result.magicbase_table_result import MagicBaseTableResult, MagicBaseTablesResult


class MagicBaseApi(MagicServiceAbstractApi):
    """MagicBase API for Magic Service."""

    async def query_tables_async(self, parameter: QueryMagicBaseTablesParameter) -> MagicBaseTablesResult:
        """List MagicBase tables for a project."""
        endpoint_path = f"/api/v1/magicbase/projects/{parameter.project_id}/tables"
        data = await self.request_by_parameter_async(parameter, "GET", endpoint_path)
        return MagicBaseTablesResult(data)

    async def get_table_async(self, parameter: GetMagicBaseTableParameter) -> MagicBaseTableResult:
        """Get one MagicBase table by its real table id."""
        endpoint_path = f"/api/v1/magicbase/projects/{parameter.project_id}/tables/{parameter.table_id}"
        data = await self.request_by_parameter_async(parameter, "GET", endpoint_path)
        return MagicBaseTableResult(data)

    async def create_table_async(self, parameter: CreateMagicBaseTableParameter) -> MagicBaseTableResult:
        """Create a MagicBase table in a project."""
        endpoint_path = f"/api/v1/magicbase/projects/{parameter.project_id}/tables"
        data = await self.request_by_parameter_async(parameter, "POST", endpoint_path)
        return MagicBaseTableResult(data)

    async def create_column_async(self, parameter: CreateMagicBaseColumnParameter) -> MagicBaseColumnResult:
        """Create a MagicBase column in an existing table."""
        endpoint_path = f"/api/v1/magicbase/projects/{parameter.project_id}/tables/{parameter.table_id}/columns"
        data = await self.request_by_parameter_async(parameter, "POST", endpoint_path)
        return MagicBaseColumnResult(data)

    async def update_table_permissions_async(
        self,
        parameter: UpdateMagicBaseTablePermissionsParameter,
    ) -> MagicBaseTableResult:
        """Update dynamic permissions for an existing MagicBase table."""
        endpoint_path = f"/api/v1/magicbase/projects/{parameter.project_id}/tables/{parameter.table_id}"
        data = await self.request_by_parameter_async(parameter, "PATCH", endpoint_path)
        return MagicBaseTableResult(data)

    async def delete_table_async(self, parameter: DeleteMagicBaseTableParameter) -> None:
        """Delete a MagicBase table."""
        endpoint_path = f"/api/v1/magicbase/projects/{parameter.project_id}/tables/{parameter.table_id}"
        await self.request_by_parameter_async(parameter, "DELETE", endpoint_path)

    async def update_column_async(self, parameter: UpdateMagicBaseColumnParameter) -> MagicBaseColumnResult:
        """Update an existing MagicBase column."""
        endpoint_path = (
            f"/api/v1/magicbase/projects/{parameter.project_id}"
            f"/tables/{parameter.table_id}/columns/{parameter.column_id}"
        )
        data = await self.request_by_parameter_async(parameter, "PATCH", endpoint_path)
        return MagicBaseColumnResult(data)

    async def delete_column_async(self, parameter: DeleteMagicBaseColumnParameter) -> None:
        """Delete a MagicBase column."""
        endpoint_path = (
            f"/api/v1/magicbase/projects/{parameter.project_id}"
            f"/tables/{parameter.table_id}/columns/{parameter.column_id}"
        )
        await self.request_by_parameter_async(parameter, "DELETE", endpoint_path)

    async def query_rows_async(self, parameter: QueryMagicBaseRowsParameter) -> MagicBaseRowsResult:
        endpoint_path = f"/api/v1/magicbase/projects/{parameter.project_id}/tables/{parameter.table_id}/query"
        data = await self.request_by_parameter_async(parameter, "POST", endpoint_path)
        return MagicBaseRowsResult(data)

    async def create_row_async(self, parameter: CreateMagicBaseRowParameter) -> MagicBaseRowResult:
        endpoint_path = f"/api/v1/magicbase/projects/{parameter.project_id}/tables/{parameter.table_id}/rows"
        data = await self.request_by_parameter_async(parameter, "POST", endpoint_path)
        return MagicBaseRowResult(data)

    async def get_row_async(self, parameter: GetMagicBaseRowParameter) -> MagicBaseRowResult:
        endpoint_path = (
            f"/api/v1/magicbase/projects/{parameter.project_id}/tables/{parameter.table_id}"
            f"/rows/{parameter.record_id}"
        )
        data = await self.request_by_parameter_async(parameter, "GET", endpoint_path)
        return MagicBaseRowResult(data)

    async def update_row_async(self, parameter: UpdateMagicBaseRowParameter) -> MagicBaseRowResult:
        endpoint_path = (
            f"/api/v1/magicbase/projects/{parameter.project_id}/tables/{parameter.table_id}"
            f"/rows/{parameter.record_id}"
        )
        data = await self.request_by_parameter_async(parameter, "PATCH", endpoint_path)
        return MagicBaseRowResult(data)

    async def batch_create_rows_async(
        self,
        parameter: BatchCreateMagicBaseRowsParameter,
    ) -> MagicBaseBatchCreateRowsResult:
        endpoint_path = f"/api/v1/magicbase/projects/{parameter.project_id}/tables/{parameter.table_id}/rows/batch"
        data = await self.request_by_parameter_async(parameter, "POST", endpoint_path)
        return MagicBaseBatchCreateRowsResult(data)

    async def delete_row_async(self, parameter: DeleteMagicBaseRowParameter) -> None:
        endpoint_path = (
            f"/api/v1/magicbase/projects/{parameter.project_id}/tables/{parameter.table_id}"
            f"/rows/{parameter.record_id}"
        )
        await self.request_by_parameter_async(parameter, "DELETE", endpoint_path)

    async def batch_delete_rows_async(
        self,
        parameter: BatchDeleteMagicBaseRowsParameter,
    ) -> MagicBaseBatchDeleteRowsResult:
        endpoint_path = (
            f"/api/v1/magicbase/projects/{parameter.project_id}/tables/{parameter.table_id}"
            "/rows/batch-delete"
        )
        data = await self.request_by_parameter_async(parameter, "POST", endpoint_path)
        return MagicBaseBatchDeleteRowsResult(data)
