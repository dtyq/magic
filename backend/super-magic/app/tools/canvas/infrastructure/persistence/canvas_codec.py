"""Canvas 3.0 主文件编解码器。

该模块独立实现前后端约定的 3.0 格式，不依赖旧 Design Canvas 代码。
"""

from __future__ import annotations

import base64
import gzip
import json
import re
from copy import deepcopy
from typing import Any

from agentlang.logger import get_logger

from app.tools.canvas.domain.content_fields import ContentFieldsFactory
from app.tools.canvas.domain.errors import CanvasDomainError, CanvasProtocolError
from app.tools.canvas.domain.models import (
    CanvasConnection,
    CanvasContent,
    CanvasDocument,
    CanvasElement,
    CanvasProject,
    ElementProperties,
)
from app.tools.canvas.domain.protocol import BASE_ELEMENT_FIELDS, CONTENT_FIELDS, SUPPORTED_ELEMENT_TYPES
from app.tools.canvas.domain.types import JsonValue

logger = get_logger(__name__)

MAGIC_PROJECT_VERSION = "3.0.0"
MAGIC_PROJECT_TYPE = "design"
CANVAS_PREFIX = "MAGICPROJECTDESIGNDATA://"

_ENVELOPE_PATTERN = re.compile(r"(?:window\.)?magicProjectConfig\s*=\s*(\{.*\})\s*;?\s*$", re.DOTALL)


class CanvasCodec:
    """负责 3.0 magic.project.js 文本和领域对象之间的转换。"""

    @classmethod
    def decode(cls, source: str) -> CanvasProject:
        """解码并校验 3.0 项目，保留协议未声明的前端扩展字段。"""
        try:
            match = _ENVELOPE_PATTERN.search(source.strip())
            if match is None:
                raise ValueError("magic.project.js does not contain a JSON project envelope")
            envelope = json.loads(match.group(1))
        except (json.JSONDecodeError, ValueError) as exc:
            raise CanvasProtocolError("INVALID_CANVAS_DOCUMENT", str(exc)) from exc
        if envelope.get("version") != MAGIC_PROJECT_VERSION:
            raise CanvasProtocolError("UNSUPPORTED_CANVAS_VERSION", "Only the current Canvas project format is supported.")
        if envelope.get("type") != MAGIC_PROJECT_TYPE:
            raise CanvasProtocolError("INVALID_CANVAS_PROJECT_TYPE", "Only design Canvas projects are supported.")
        name = envelope.get("name")
        if not isinstance(name, str):
            raise CanvasProtocolError("INVALID_CANVAS_DOCUMENT", "Project name must be a string.")
        encoded_canvas = envelope.get("canvas")
        if not isinstance(encoded_canvas, str) or not encoded_canvas.startswith(CANVAS_PREFIX):
            raise CanvasProtocolError("INVALID_CANVAS_COMPRESSION", "Canvas data uses an unsupported encoding.")
        try:
            raw = base64.b64decode(encoded_canvas[len(CANVAS_PREFIX):], validate=True)
            canvas_data = json.loads(gzip.decompress(raw).decode("utf-8"))
        except (ValueError, OSError, json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise CanvasProtocolError("INVALID_CANVAS_COMPRESSION", "Canvas data could not be decoded.") from exc
        project = CanvasProject(
            version=MAGIC_PROJECT_VERSION,
            project_type=MAGIC_PROJECT_TYPE,
            name=name,
            canvas=cls._decode_document(canvas_data),
            extra_data={key: deepcopy(value) for key, value in envelope.items() if key not in {"version", "type", "name", "canvas"}},
        )
        project.canvas.validate()
        return project

    @classmethod
    def encode(cls, project: CanvasProject) -> str:
        """校验并编码 3.0 项目。"""
        if project.version != MAGIC_PROJECT_VERSION:
            raise CanvasProtocolError("UNSUPPORTED_CANVAS_VERSION", "Only the current Canvas project format is supported.")
        if project.project_type != MAGIC_PROJECT_TYPE:
            raise CanvasProtocolError("INVALID_CANVAS_PROJECT_TYPE", "Only design Canvas projects are supported.")
        project.canvas.validate()
        payload = json.dumps(project.canvas.to_dict(), ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
        encoded = CANVAS_PREFIX + base64.b64encode(gzip.compress(payload)).decode("ascii")
        envelope = {
            **deepcopy(project.extra_data),
            "version": MAGIC_PROJECT_VERSION,
            "type": MAGIC_PROJECT_TYPE,
            "name": project.name,
            "canvas": encoded,
        }
        return f"window.magicProjectConfig = {json.dumps(envelope, ensure_ascii=False, separators=(',', ':'))};\n"

    @classmethod
    def empty_project(cls, name: str) -> CanvasProject:
        """创建空的合法 3.0 项目。"""
        return CanvasProject(MAGIC_PROJECT_VERSION, MAGIC_PROJECT_TYPE, name, CanvasDocument())

    @classmethod
    def _decode_document(cls, data: Any) -> CanvasDocument:
        """解码 Canvas 文档主体。"""
        if not isinstance(data, dict):
            raise CanvasProtocolError("INVALID_CANVAS_DOCUMENT", "Canvas data must be an object.")
        elements = data.get("elements", [])
        connections = data.get("connections", [])
        if not isinstance(elements, list) or not isinstance(connections, list):
            raise CanvasProtocolError("INVALID_CANVAS_DOCUMENT", "Canvas elements and connections must be arrays.")
        decoded_elements, opaque_elements = cls._decode_element_list(elements, "elements")
        document = CanvasDocument(
            elements=decoded_elements,
            extra_data={key: deepcopy(value) for key, value in data.items() if key not in {"elements", "connections"}},
            opaque_elements=opaque_elements,
        )
        decoded_connections, opaque_connections = cls._decode_connection_list(
            connections,
            "connections",
            known_element_ids={element.element_id for element in document.iter_elements()} | document.opaque_element_ids(),
        )
        document.connections = decoded_connections
        document.opaque_connections = opaque_connections
        return document

    @classmethod
    def _decode_element_list(
        cls,
        items: list[Any],
        path_prefix: str,
    ) -> tuple[list[CanvasElement], list[tuple[int, JsonValue]]]:
        """解析节点列表。未支持类型或单个节点损坏时跳过该节点，并保留原始 JSON。"""
        decoded: list[CanvasElement] = []
        opaques: list[tuple[int, JsonValue]] = []
        for index, item in enumerate(items):
            path = f"{path_prefix}[{index}]"
            if isinstance(item, dict) and item.get("type") not in SUPPORTED_ELEMENT_TYPES:
                logger.warning(
                    "Skip unsupported canvas element at %s: type=%s",
                    path,
                    item.get("type"),
                )
                opaques.append((index, deepcopy(item)))
                continue
            try:
                decoded.append(cls._decode_element(item, path))
            except CanvasDomainError as error:
                logger.warning("Skip invalid canvas element at %s: %s", path, error.message)
                opaques.append((index, deepcopy(item)))
        return decoded, opaques

    @classmethod
    def _decode_connection_list(
        cls,
        items: list[Any],
        path_prefix: str,
        known_element_ids: set[str],
    ) -> tuple[list[CanvasConnection], list[tuple[int, JsonValue]]]:
        """解析连线列表。单条损坏或端点无法对应到可读节点时跳过，并保留原始 JSON。"""
        decoded: list[CanvasConnection] = []
        opaques: list[tuple[int, JsonValue]] = []
        connection_ids: set[str] = set()
        connection_pairs: set[tuple[str, str]] = set()
        for index, item in enumerate(items):
            path = f"{path_prefix}[{index}]"
            try:
                connection = cls._decode_connection(item, path)
            except CanvasDomainError as error:
                logger.warning("Skip invalid canvas connection at %s: %s", path, error.message)
                opaques.append((index, deepcopy(item)))
                continue
            pair = (connection.source_element_id, connection.target_element_id)
            if (
                connection.source_element_id not in known_element_ids
                or connection.target_element_id not in known_element_ids
                or connection.source_element_id == connection.target_element_id
                or connection.connection_id in connection_ids
                or pair in connection_pairs
            ):
                logger.warning("Skip unusable canvas connection at %s: id=%s", path, connection.connection_id)
                opaques.append((index, deepcopy(item)))
                continue
            connection_ids.add(connection.connection_id)
            connection_pairs.add(pair)
            decoded.append(connection)
        return decoded, opaques

    @classmethod
    def _decode_element(cls, data: Any, path: str) -> CanvasElement:
        """解码单个 Element，并保留前端新增的未知字段。"""
        if not isinstance(data, dict):
            raise CanvasProtocolError("INVALID_ELEMENT", f"{path} must be an object.")
        element_id = data.get("id")
        element_type = data.get("type")
        if not isinstance(element_id, str) or not element_id:
            raise CanvasProtocolError("INVALID_ELEMENT", f"{path}.id must be a non-empty string.")
        if element_type not in SUPPORTED_ELEMENT_TYPES:
            raise CanvasProtocolError("INVALID_ELEMENT", f"{path}.type is unsupported.")
        allowed = BASE_ELEMENT_FIELDS | ({"children"} if element_type in {"frame", "group"} else set())
        extra_data = {
            key: deepcopy(value)
            for key, value in data.items()
            if key not in allowed
        }
        raw_contents = data.get("contents")
        if not isinstance(raw_contents, list):
            raise CanvasProtocolError("INVALID_ELEMENT", f"{path}.contents must be an array.")
        contents = [cls._decode_content(item, element_type, f"{path}.contents[{index}]") for index, item in enumerate(raw_contents)]
        content_ids = [content.content_id for content in contents]
        active = data.get("activeContentId")
        main = data.get("mainContentId")
        if contents and (active not in content_ids or main not in content_ids):
            raise CanvasProtocolError("INVALID_ELEMENT", f"{path} Content pointers must reference existing Content.")
        if not contents and (active is not None or main is not None):
            raise CanvasProtocolError("INVALID_ELEMENT", f"{path} empty contents require null pointers.")
        children = None
        opaque_children: list[tuple[int, JsonValue]] = []
        if element_type in {"frame", "group"} and "children" in data:
            raw_children = data["children"]
            if not isinstance(raw_children, list):
                raise CanvasProtocolError("INVALID_ELEMENT", f"{path}.children must be an array.")
            children, opaque_children = cls._decode_element_list(raw_children, f"{path}.children")
        properties = ElementProperties.from_dict({
            key: value
            for key, value in data.items()
            if key not in {"id", "type", "contents", "activeContentId", "mainContentId", "children"}
        })
        return CanvasElement(
            element_id=element_id,
            element_type=element_type,
            properties=properties,
            contents=contents,
            active_content_id=active,
            main_content_id=main,
            children=children,
            extra_data=extra_data,
            opaque_children=opaque_children,
        )

    @classmethod
    def _decode_content(cls, data: Any, element_type: str, path: str) -> CanvasContent:
        """解码 Element Content，并保留前端新增的未知字段。"""
        if not isinstance(data, dict):
            raise CanvasProtocolError("INVALID_CONTENT", f"{path} must be an object.")
        content_id = data.get("contentId")
        if not isinstance(content_id, str) or not content_id or "id" in data or "type" in data:
            raise CanvasProtocolError("INVALID_CONTENT", f"{path} has an invalid contentId or forbidden field.")
        allowed = CONTENT_FIELDS[element_type] | {"contentId"}
        extra_data = {
            key: deepcopy(value)
            for key, value in data.items()
            if key not in allowed
        }
        fields = ContentFieldsFactory.from_protocol(
            element_type,
            {
                key: deepcopy(value)
                for key, value in data.items()
                if key in allowed and key != "contentId"
            },
        )
        return CanvasContent(content_id, fields, extra_data)

    @staticmethod
    def _decode_connection(data: Any, path: str) -> CanvasConnection:
        """解码一条 Element Connection，并保留前端新增的未知字段。"""
        if not isinstance(data, dict):
            raise CanvasProtocolError("INVALID_CONNECTION", f"{path} must be an object.")
        values = (data.get("id"), data.get("sourceElementId"), data.get("targetElementId"))
        if not all(isinstance(value, str) and value for value in values):
            raise CanvasProtocolError("INVALID_CONNECTION", f"{path} contains invalid identifiers.")
        extra_data = {
            key: deepcopy(value)
            for key, value in data.items()
            if key not in {"id", "sourceElementId", "targetElementId"}
        }
        return CanvasConnection(*values, extra_data=extra_data)
