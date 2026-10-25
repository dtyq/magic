"""MagicBase row API parameters."""

from typing import Any, Dict, List, Optional

from .magicbase_base_parameter import MagicBaseBaseParameter


class MagicBaseTableRowsParameter(MagicBaseBaseParameter):
    def __init__(
        self,
        project_id: str,
        table_id: str,
        authorization: Optional[str] = None,
        organization_code: Optional[str] = None,
    ):
        super().__init__(project_id, authorization, organization_code)
        self.table_id = str(table_id).strip() if table_id is not None else ""

    def validate(self) -> None:
        super().validate()
        if not self.table_id:
            raise ValueError("table_id is required")
        if not self.table_id.isdigit():
            raise ValueError("table_id must be a numeric string")


class QueryMagicBaseRowsParameter(MagicBaseTableRowsParameter):
    def __init__(
        self,
        project_id: str,
        table_id: str,
        filter: Optional[Dict[str, Any]] = None,
        sort: Optional[List[Dict[str, str]]] = None,
        page: int = 1,
        page_size: int = 20,
        select: Optional[List[str]] = None,
        authorization: Optional[str] = None,
        organization_code: Optional[str] = None,
    ):
        super().__init__(project_id, table_id, authorization, organization_code)
        self.filter = filter or {}
        self.sort = sort or []
        self.page = page
        self.page_size = page_size
        self.select = select or []

    def to_body(self) -> Dict[str, Any]:
        body: Dict[str, Any] = {
            "filter": self.filter,
            "sort": self.sort,
            "page": self.page,
            "page_size": self.page_size,
        }
        if self.select:
            body["select"] = self.select
        return body

    def validate(self) -> None:
        super().validate()
        if not isinstance(self.filter, dict):
            raise ValueError("filter must be an object")
        if self.page < 1:
            raise ValueError("page must be at least 1")
        if self.page_size < 1 or self.page_size > 1000:
            raise ValueError("page_size must be between 1 and 1000")


class CreateMagicBaseRowParameter(MagicBaseTableRowsParameter):
    def __init__(
        self,
        project_id: str,
        table_id: str,
        data: Dict[str, Any],
        select: Optional[List[str]] = None,
        authorization: Optional[str] = None,
        organization_code: Optional[str] = None,
    ):
        super().__init__(project_id, table_id, authorization, organization_code)
        self.data = data
        self.select = select or []

    def to_body(self) -> Dict[str, Any]:
        body: Dict[str, Any] = {"data": self.data}
        if self.select:
            body["select"] = self.select
        return body

    def validate(self) -> None:
        super().validate()
        if not isinstance(self.data, dict):
            raise ValueError("data must be an object")


class GetMagicBaseRowParameter(MagicBaseTableRowsParameter):
    def __init__(
        self,
        project_id: str,
        table_id: str,
        record_id: str,
        select: Optional[List[str]] = None,
        authorization: Optional[str] = None,
        organization_code: Optional[str] = None,
    ):
        super().__init__(project_id, table_id, authorization, organization_code)
        self.record_id = str(record_id).strip() if record_id is not None else ""
        self.select = select or []

    def to_query_params(self) -> Dict[str, Any]:
        # GET 单行接口从 query string 读取 select，需要传逗号分隔字符串。
        if not self.select:
            return {}
        return {"select": ",".join(self.select)}

    def validate(self) -> None:
        super().validate()
        if not self.record_id:
            raise ValueError("record_id is required")
        if not self.record_id.isdigit():
            raise ValueError("record_id must be a numeric string")


class UpdateMagicBaseRowParameter(MagicBaseTableRowsParameter):
    def __init__(
        self,
        project_id: str,
        table_id: str,
        record_id: str,
        data: Dict[str, Any],
        select: Optional[List[str]] = None,
        authorization: Optional[str] = None,
        organization_code: Optional[str] = None,
    ):
        super().__init__(project_id, table_id, authorization, organization_code)
        self.record_id = str(record_id).strip() if record_id is not None else ""
        self.data = data
        self.select = select or []

    def to_body(self) -> Dict[str, Any]:
        body: Dict[str, Any] = {"data": self.data}
        if self.select:
            body["select"] = self.select
        return body

    def validate(self) -> None:
        super().validate()
        if not self.record_id:
            raise ValueError("record_id is required")
        if not self.record_id.isdigit():
            raise ValueError("record_id must be a numeric string")
        if not isinstance(self.data, dict):
            raise ValueError("data must be an object")
        if not self.data:
            raise ValueError("data must contain at least one column to update")


class BatchCreateMagicBaseRowsParameter(MagicBaseTableRowsParameter):
    def __init__(
        self,
        project_id: str,
        table_id: str,
        rows: List[Dict[str, Any]],
        select: Optional[List[str]] = None,
        authorization: Optional[str] = None,
        organization_code: Optional[str] = None,
    ):
        super().__init__(project_id, table_id, authorization, organization_code)
        self.rows = rows
        self.select = select or []

    def to_body(self) -> Dict[str, Any]:
        body: Dict[str, Any] = {"rows": self.rows}
        if self.select:
            body["select"] = self.select
        return body

    def validate(self) -> None:
        super().validate()
        if not self.rows:
            raise ValueError("rows is required")
        if len(self.rows) > 200:
            raise ValueError("rows cannot contain more than 200 items")
        if any(not isinstance(row, dict) for row in self.rows):
            raise ValueError("each row must be an object")


class DeleteMagicBaseRowParameter(MagicBaseTableRowsParameter):
    def __init__(
        self,
        project_id: str,
        table_id: str,
        record_id: str,
        authorization: Optional[str] = None,
        organization_code: Optional[str] = None,
    ):
        super().__init__(project_id, table_id, authorization, organization_code)
        self.record_id = str(record_id).strip() if record_id is not None else ""

    def to_body(self) -> Dict[str, Any]:
        return {}

    def validate(self) -> None:
        super().validate()
        if not self.record_id:
            raise ValueError("record_id is required")
        if not self.record_id.isdigit():
            raise ValueError("record_id must be a numeric string")


class BatchDeleteMagicBaseRowsParameter(MagicBaseTableRowsParameter):
    def __init__(
        self,
        project_id: str,
        table_id: str,
        record_ids: List[str],
        authorization: Optional[str] = None,
        organization_code: Optional[str] = None,
    ):
        super().__init__(project_id, table_id, authorization, organization_code)
        self.record_ids = [str(record_id).strip() for record_id in record_ids]

    def to_body(self) -> Dict[str, Any]:
        return {"record_ids": self.record_ids}

    def validate(self) -> None:
        super().validate()
        if not self.record_ids:
            raise ValueError("record_ids is required")
        if len(self.record_ids) > 200:
            raise ValueError("record_ids cannot contain more than 200 items")
        if any(not record_id.isdigit() for record_id in self.record_ids):
            raise ValueError("record_ids must contain numeric strings")
