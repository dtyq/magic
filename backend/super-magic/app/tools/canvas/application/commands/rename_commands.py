"""标题、明确版本文件与有序批量命名输入。"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class VersionFileName(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content_id: str
    file_id: str = Field(min_length=1)
    expected_file_name: str = Field(min_length=1)
    file_name: str = Field(min_length=1)


class BatchNaming(BaseModel):
    model_config = ConfigDict(extra="forbid")
    base_name: str = Field(min_length=1)
    target: Literal["title", "file", "both"]
    start_number: int = Field(1, ge=0)
    digits: int = Field(2, ge=1)


class RenameElement(BaseModel):
    model_config = ConfigDict(extra="forbid")
    element_id: str
    canvas_title: str | None = Field(None, min_length=1)
    files: list[VersionFileName] = Field(default_factory=list)
    all_versions_base_name: str | None = Field(None, min_length=1)
    file_scope: Literal["current", "all"] | None = None

    @model_validator(mode="after")
    def validate_operation(self) -> RenameElement:
        if self.files and self.all_versions_base_name:
            raise ValueError("Use files or all_versions_base_name")
        return self
