"""可生成媒体 Content Fields 抽象基类。"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from typing import Literal

from app.tools.canvas.domain.content_fields.base import CanvasContentFields
from app.tools.canvas.domain.types import JsonObject

GenerationStatus = Literal["pending", "processing", "completed", "failed", "terminated"]


@dataclass
class GeneratedMediaContentFields(CanvasContentFields):
    """封装图片和视频共享的生成状态与媒体路径。"""

    src: str | None = None
    status: GenerationStatus | None = None
    stored_error_message: str | None = None
    visual_understanding: JsonObject | None = field(default=None, kw_only=True)

    @property
    def generated_request_field(self) -> str | None:
        """返回当前媒体类型对应的生成请求字段。"""
        return None

    def set_generation_request(self, request: JsonObject) -> None:
        """保存生成请求；具体媒体类型负责提供字段映射。"""
        raise NotImplementedError("Generated media fields must define a generation request field.")

    def clear_generation_request(self) -> None:
        """清除生成请求；具体媒体类型负责清除对应字段。"""
        raise NotImplementedError("Generated media fields must define a generation request field.")

    def clear_sidecar_fields(self) -> None:
        """清除写入公共 Sidecar 的重字段，避免主文件重复保存。"""
        self.clear_generation_request()
        self.visual_understanding = None

    @property
    def generation_status(self) -> str | None:
        """返回当前生成状态。"""
        return self.status

    @property
    def error_message(self) -> str | None:
        """返回当前生成错误。"""
        return self.stored_error_message

    @property
    def asset_path(self) -> str | None:
        """返回当前媒体路径。"""
        return self.src

    def update_generation_result(
        self,
        status: GenerationStatus,
        output_uri: str | None,
        error_message: str | None,
    ) -> None:
        """原子更新生成状态、输出路径和错误信息。"""
        self.status = status
        if output_uri is not None:
            self.src = output_uri
        self.stored_error_message = error_message

    def mark_pending(self) -> str | None:
        """进入重试等待状态并返回先前状态。"""
        previous = self.status
        self.status = "pending"
        self.stored_error_message = None
        return previous

    def _media_dict(self) -> dict[str, object]:
        """生成图片和视频共享的协议字段。"""
        values: dict[str, object | None] = {
            "src": self.src,
            "status": self.status,
            "errorMessage": self.stored_error_message,
            "visualUnderstanding": deepcopy(self.visual_understanding),
        }
        return {key: value for key, value in values.items() if value is not None}
