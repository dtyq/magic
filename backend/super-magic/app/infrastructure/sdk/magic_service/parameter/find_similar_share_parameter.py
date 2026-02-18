"""
Find Similar Share Parameter

Parameter class for finding existing shares by file IDs or project ID.
"""

from typing import Dict, Any, Optional, List
from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class FindSimilarShareParameter(MagicServiceAbstractParameter):
    """Parameter for finding similar (existing) shares to avoid duplicates"""

    def __init__(
        self,
        file_ids: Optional[List[str]] = None,
        project_id: Optional[str] = None,
        share_project: Optional[bool] = None,
    ):
        """
        At least one of file_ids or (project_id + share_project=True) must be provided.

        Args:
            file_ids: File ID list (1-100 numeric strings) for file-based search
            project_id: Project ID for project-based search
            share_project: True to search for project-type shares
        """
        super().__init__()
        self.file_ids = file_ids
        self.project_id = project_id
        self.share_project = share_project

    def to_body(self) -> Dict[str, Any]:
        body: Dict[str, Any] = {}
        if self.file_ids is not None:
            body['file_ids'] = self.file_ids
        if self.project_id is not None:
            body['project_id'] = self.project_id
        if self.share_project is not None:
            body['share_project'] = self.share_project
        return body

    def to_query_params(self) -> Dict[str, Any]:
        return {}

    def validate(self) -> None:
        super().validate()
        has_file_ids = self.file_ids is not None and len(self.file_ids) > 0
        has_project = self.project_id is not None and self.share_project
        if not has_file_ids and not has_project:
            raise ValueError(
                "Either file_ids or (project_id + share_project=True) must be provided"
            )
