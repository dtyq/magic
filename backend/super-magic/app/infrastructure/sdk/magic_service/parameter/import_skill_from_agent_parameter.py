"""
Import Skill From Agent Parameter

Parameter class for importing skill via multipart upload.
"""

import json
from pathlib import Path
from typing import Dict, Any, Optional
from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class ImportSkillFromAgentParameter(MagicServiceAbstractParameter):
    """Parameter for importing skill zip via multipart upload"""

    def __init__(
        self,
        file_path: str,
        source: str = "AGENT_CREATED",
        name_i18n: Optional[Dict[str, str]] = None,
        description_i18n: Optional[Dict[str, str]] = None,
    ):
        """
        Initialize import skill parameter

        Args:
            file_path: Path to the zip file
            source: Skill source type, "AGENT_CREATED" or "AGENT_THIRD_PARTY_IMPORT"
            name_i18n: i18n name dict, e.g. {"zh_CN": "技能名", "en_US": "Skill Name"}
            description_i18n: i18n description dict, e.g. {"zh_CN": "描述", "en_US": "Description"}
        """
        super().__init__()
        self.file_path = file_path
        self.source = source
        self.name_i18n = name_i18n
        self.description_i18n = description_i18n
        self._file_handle = None

    def to_body(self) -> Dict[str, Any]:
        """Multipart request, body handled in to_options"""
        return {}

    def to_query_params(self) -> Dict[str, Any]:
        """POST multipart, no query params"""
        return {}

    def _build_form_data(self) -> Dict[str, str]:
        """Build form data dict, only including non-None fields."""
        data: Dict[str, str] = {'source': self.source}
        if self.name_i18n:
            data['name_i18n'] = json.dumps(self.name_i18n, ensure_ascii=False)
        if self.description_i18n:
            data['description_i18n'] = json.dumps(self.description_i18n, ensure_ascii=False)
        return data

    def to_options(self, method: str) -> Dict[str, Any]:
        """
        Convert to HTTP request options with multipart file upload.
        Note: Content-Type is NOT set manually; httpx auto-generates the multipart boundary.
        """
        headers = self.to_headers()
        # Remove Content-Type if present — httpx needs to set its own for multipart
        headers.pop('Content-Type', None)

        file_path = Path(self.file_path)
        self._file_handle = open(file_path, 'rb')

        options = {
            'headers': headers,
            'files': {
                'file': (file_path.name, self._file_handle, 'application/zip')
            },
            'data': self._build_form_data()
        }
        return options

    def close(self) -> None:
        """Close the file handle if open"""
        if self._file_handle and not self._file_handle.closed:
            self._file_handle.close()

    def validate(self) -> None:
        """Validate parameter data"""
        super().validate()
        if not self.file_path:
            raise ValueError("file_path is required")
        file_path = Path(self.file_path)
        if not file_path.exists():
            raise ValueError(f"File not found: {self.file_path}")
        if not file_path.suffix == '.zip':
            raise ValueError("File must be a .zip archive")
