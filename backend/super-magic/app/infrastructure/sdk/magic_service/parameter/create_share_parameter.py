"""
Create Share Parameter

Parameter class for creating or updating a share via the Open API sandbox endpoint.
"""

from typing import Dict, Any, Optional, List
from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class TargetId:
    """Target entry for team share with designated recipients"""

    def __init__(self, target_type: str, target_id: str):
        """
        Args:
            target_type: 'User' or 'Department'
            target_id: User ID or department ID
        """
        self.target_type = target_type
        self.target_id = target_id

    def to_dict(self) -> Dict[str, str]:
        return {'target_type': self.target_type, 'target_id': self.target_id}


class CreateShareParameter(MagicServiceAbstractParameter):
    """Parameter for creating or updating a share"""

    def __init__(
        self,
        resource_id: str,
        resource_type: int,
        share_type: int,
        resource_name: Optional[str] = None,
        password: Optional[str] = None,
        expire_days: Optional[int] = None,
        share_range: Optional[str] = None,
        target_ids: Optional[List[TargetId]] = None,
        file_ids: Optional[List[str]] = None,
        file_paths: Optional[List[str]] = None,
        project_id: Optional[str] = None,
        share_project: Optional[bool] = None,
        default_open_file_id: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None,
    ):
        """
        Args:
            resource_id: Resource ID (snowflake ID from generate_resource_id, or topic ID for topic shares)
            resource_type: Resource type enum value (5=Topic, 13=FileCollection, 15=File)
            share_type: Share type enum value (2=TeamShare, 4=Internet, 5=PasswordProtected)
            resource_name: Share title; optional only for topic shares (resource_type=5)
            password: Access password (4-32 chars); required when share_type=5
            expire_days: Valid days (1-365); omit or pass 0/None for permanent
            share_range: Share scope for team share ('all' or 'designated'); required when share_type=2
            target_ids: Designated recipients; required when share_type=2 and share_range='designated'
            file_ids: File ID list; required when resource_type=13 or 15 on creation
            file_paths: Relative file paths for auto-resolving file_ids when file_ids is empty
            project_id: Project ID; required when using file_paths or for project share
            share_project: True to share the entire project (converts resource_type to 12 internally)
            default_open_file_id: Default file to open when accessing the share
            extra: Extra config (allowed keys: allow_copy_project_files, show_original_info,
                   view_file_list, hide_created_by_super_magic, allow_download_project_file)
        """
        super().__init__()
        self.resource_id = resource_id
        self.resource_type = resource_type
        self.share_type = share_type
        self.resource_name = resource_name
        self.password = password
        self.expire_days = expire_days
        self.share_range = share_range
        self.target_ids = target_ids
        self.file_ids = file_ids
        self.file_paths = file_paths
        self.project_id = project_id
        self.share_project = share_project
        self.default_open_file_id = default_open_file_id
        self.extra = extra

    def to_body(self) -> Dict[str, Any]:
        """Build request body, omitting None fields"""
        body: Dict[str, Any] = {
            'resource_id': self.resource_id,
            'resource_type': self.resource_type,
            'share_type': self.share_type,
        }
        if self.resource_name is not None:
            body['resource_name'] = self.resource_name
        if self.password is not None:
            body['password'] = self.password
        if self.expire_days is not None:
            body['expire_days'] = self.expire_days
        if self.share_range is not None:
            body['share_range'] = self.share_range
        if self.target_ids is not None:
            body['target_ids'] = [t.to_dict() for t in self.target_ids]
        if self.file_ids is not None:
            body['file_ids'] = self.file_ids
        if self.file_paths is not None:
            body['file_paths'] = self.file_paths
        if self.project_id is not None:
            body['project_id'] = self.project_id
        if self.share_project is not None:
            body['share_project'] = self.share_project
        if self.default_open_file_id is not None:
            body['default_open_file_id'] = self.default_open_file_id
        if self.extra is not None:
            body['extra'] = self.extra
        return body

    def to_query_params(self) -> Dict[str, Any]:
        return {}

    def validate(self) -> None:
        super().validate()
        if not self.resource_id:
            raise ValueError("resource_id is required")
        if self.resource_type is None:
            raise ValueError("resource_type is required")
        if self.share_type is None:
            raise ValueError("share_type is required")
