"""同步当前项目的路径引用，保留历史生成名称和稳定素材标识。"""

from __future__ import annotations

from pathlib import Path
from typing import cast

from app.tools.canvas.domain.content_fields.factory import ContentFieldsFactory
from app.tools.canvas.domain.models import CanvasProject
from app.tools.canvas.domain.types import JsonObject, JsonValue
from app.tools.canvas.infrastructure.assets.project_asset_path_resolver import ProjectAssetPathResolver


class CanvasFileReferenceUpdates:
    # 仅处理正式素材路径字段；canvas_path／mask_path／mark_path 是生成内部文件，不能跟随改名。
    PATH_FIELDS = frozenset(
        {"src", "uri", "path", "file_path", "outputUri", "assetPath", "frame_start_path", "frame_end_path"}
    )
    PATH_LIST_FIELDS = frozenset(
        {"reference_images", "reference_image_paths", "reference_video_paths", "reference_audio_paths"}
    )

    def __init__(self, paths: ProjectAssetPathResolver, project_path: str, old_path: Path, new_path: Path):
        self.paths, self.project_path = paths, project_path
        self.old_path, self.new_path = old_path, new_path

    def matches(self, value: str) -> bool:
        if "://" in value or value.startswith("data:"):
            return False
        try:
            relative = self.paths.to_workspace_reference_path(self.project_path, value)
            return self.paths.workspace / relative == self.old_path
        except ValueError:
            return False

    def replace(self, value: str) -> str:
        # 项目 URI 与 Workspace 路径各自保持原有语义，不能把参考图的工作区路径变成另一种基准。
        if value.startswith("./"):
            return self.paths.to_project_uri(self.project_path, self.new_path)
        if Path(value).is_absolute():
            return str(self.new_path)
        return self.new_path.relative_to(self.paths.workspace).as_posix()

    def update_json(self, document: JsonValue) -> None:
        if isinstance(document, list):
            for item in document:
                self.update_json(item)
        elif isinstance(document, dict):
            for key, value in document.items():
                if key in self.PATH_FIELDS and isinstance(value, str) and self.matches(value):
                    document[key] = self.replace(value)
                elif key in self.PATH_LIST_FIELDS and isinstance(value, list):
                    for i, item in enumerate(value):
                        if isinstance(item, str) and self.matches(item):
                            value[i] = self.replace(item)
                        else:
                            self.update_json(item)
                else:
                    self.update_json(value)

    def apply(self, project: CanvasProject, sidecar: JsonObject) -> None:
        for element in project.canvas.iter_elements():
            if element.element_type not in {"image", "video", "audio", "storyboard"}:
                continue
            for content in element.contents:
                fields = cast(JsonObject, content.fields.to_dict())
                self.update_json(fields)
                content.fields = ContentFieldsFactory.from_protocol(element.element_type, fields)
        self.update_json(sidecar)
