"""Canvas 工具面向用户的详情展示构建器。"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.tools.canvas.presentation.batch_status import summarize_items


class CanvasToolDetailBuilder:
    """在保留结构化值的前提下构建国际化 Canvas Markdown 详情。"""

    _MARKDOWN_EXTENSION = ".md"
    _MAX_LIST_ITEMS = 20
    _MAX_TEXT_LENGTH = 500
    _SENSITIVE_INPUT_KEYS = frozenset(
        {
            "authorization",
            "access_token",
            "api_key",
            "base64_data",
            "password",
            "refresh_token",
            "secret",
            "token",
        }
    )

    def __init__(
        self,
        file_name: str,
        title_key: str,
        result: ToolResult,
        arguments: Mapping[str, Any] | None = None,
    ) -> None:
        """初始化详情标题、状态和工具结果数据。"""
        self._file_name = self._normalize_markdown_file_name(file_name)
        self._data = result.data or {}
        self._arguments = arguments or {}
        self._result_content = result.content
        self._result_ok = result.ok
        batch_status = summarize_items(self._data.get("items"), fallback_ok=result.ok)
        self._title = self._translate(f"canvas.detail.title.{title_key}")
        self._input_lines = self._render_input_lines(self._arguments)
        self._output_lines = [self._field_line("status", self.status_value(batch_status.status))]
        self._output_field_keys = {"status"}

    @classmethod
    def _normalize_markdown_file_name(cls, file_name: str) -> str:
        """确保 Markdown 详情文件名带有正确的 .md 后缀。"""
        normalized = file_name.strip() or "canvas_tool"
        if normalized.lower().endswith(cls._MARKDOWN_EXTENSION):
            return normalized
        return f"{normalized}{cls._MARKDOWN_EXTENSION}"

    @property
    def data(self) -> dict[str, Any]:
        """返回工具结构化结果数据。"""
        return self._data

    @property
    def arguments(self) -> Mapping[str, Any]:
        """返回工具调用参数。"""
        return self._arguments

    def add_field(self, field_key: str, value: Any, *, label_key: str | None = None) -> None:
        """追加一个带翻译标签的详情字段。"""
        # 字段身份仍用于摘要去重；概览可把 elements 标为「本页返回节点数」，不改变其他工具的标签。
        self._output_lines.append(self._field_line(label_key or field_key, self.localized_field_value(field_key, value)))
        self._output_field_keys.add(field_key)

    def add_item(self, fields: Mapping[str, Any]) -> None:
        """追加一条带翻译字段标签的批量结果。"""
        rendered = []
        for field_key, value in fields.items():
            rendered.append(
                f"{self._translate(f'canvas.detail.field.{field_key}')}="
                f"{self.localized_field_value(field_key, value)}"
            )
        self._output_lines.append(f"- {' | '.join(rendered)}")

    def add_warning(self, value: Any) -> None:
        """追加一条用户可读的警告信息。"""
        self.add_field("warning", value)

    def build(self) -> ToolDetail:
        """生成最终的 Markdown ToolDetail。"""
        lines = [
            f"# {self._title}",
            "",
            f"## {self._translate('canvas.detail.section.input')}",
            *self._input_lines,
            "",
            f"## {self._translate('canvas.detail.section.output')}",
            *self._render_output_lines(),
        ]
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name=self._file_name, content="\n".join(lines)),
        )

    @staticmethod
    def display_value(value: Any) -> str:
        """把空值转换为稳定的用户展示占位符。"""
        if value is None or value == "":
            return "-"
        if isinstance(value, Mapping):
            return i18n.translate(
                "canvas.detail.value.field_count",
                category="tool.messages",
                count=len(value),
            )
        if isinstance(value, (list, tuple, set)):
            return i18n.translate(
                "canvas.detail.value.item_count",
                category="tool.messages",
                count=len(value),
            )
        return str(value)

    @classmethod
    def status_value(cls, status: Any) -> str:
        """翻译已知状态，未知状态保留原始值。"""
        return cls.enum_value("status", status)

    @classmethod
    def enum_value(cls, category: str, value: Any) -> str:
        """翻译指定类别的稳定枚举值，未知值保留原文。"""
        display = cls.display_value(value)
        code = f"canvas.detail.{category}.{display}"
        translated = i18n.translate(code, category="tool.messages")
        return display if translated == code else translated

    @classmethod
    def localized_field_value(cls, field_key: str, value: Any) -> str:
        """根据字段语义选择状态、枚举或普通值的展示方式。"""
        if field_key == "status":
            return cls.status_value(value)
        if field_key in {"state", "type", "rule"}:
            return cls.enum_value(field_key, value)
        if field_key == "timed_out":
            return cls.boolean_value(value)
        return cls.display_value(value)

    @classmethod
    def boolean_value(cls, value: Any) -> str:
        """把布尔值转换为当前语言的可读文本。"""
        code = "canvas.detail.boolean.true" if bool(value) else "canvas.detail.boolean.false"
        return i18n.translate(code, category="tool.messages")

    @staticmethod
    def _translate(code: str, **kwargs: Any) -> str:
        """翻译详情内部文案键。"""
        return i18n.translate(code, category="tool.messages", **kwargs)

    @classmethod
    def _field_line(cls, field_key: str, value: str) -> str:
        """生成带翻译字段标签的 Markdown 行。"""
        return f"- {cls._translate(f'canvas.detail.field.{field_key}')}: {value}"

    def _render_input_lines(self, arguments: Mapping[str, Any]) -> list[str]:
        """把工具入参转换为面向用户的 Markdown 摘要。"""
        if not arguments:
            return [f"- {self._translate('canvas.detail.value.none')}"]

        lines: list[str] = []
        for key, value in arguments.items():
            lines.extend(self._render_value(str(key), value, indent=""))
        return lines

    def _render_output_lines(self) -> list[str]:
        """把工具出参转换为摘要，并保留工具专属的业务明细。"""
        lines: list[str] = []
        if not self._data:
            lines.append(f"- {self._translate('canvas.detail.value.none')}")
        else:
            for key, value in self._data.items():
                if key in self._output_field_keys:
                    continue
                if key in {"items", "elements", "connections", "results", "warnings"} and isinstance(value, list):
                    lines.append(
                        f"- {self._field_label(key)}: "
                        f"{self._translate('canvas.detail.value.item_count', count=len(value))}"
                    )
                elif isinstance(value, (Mapping, list, tuple, set)):
                    lines.append(f"- {self._field_label(key)}: {self.display_value(value)}")
                else:
                    lines.append(f"- {self._field_label(key)}: {self.localized_field_value(key, value)}")
        if not self._result_ok and "error" not in self._data and self._result_content:
            lines.append(self._field_line("error", self._single_line(self._truncate(self._result_content))))
        lines.extend(self._output_lines)
        return lines

    @classmethod
    def _render_value(cls, key: str, value: Any, indent: str) -> list[str]:
        """递归渲染入参字段，避免直接输出 JSON。"""
        label = cls._field_label(key)
        prefix = f"{indent}- {label}"
        if cls._is_sensitive_key(key):
            return [f"{prefix}: {cls._translate('canvas.detail.value.provided')}"]
        if isinstance(value, Mapping):
            if not value:
                return [f"{prefix}: -"]
            lines = [f"{prefix}:"]
            for child_key, child_value in value.items():
                lines.extend(cls._render_value(str(child_key), child_value, indent + "  "))
            return lines
        if isinstance(value, (list, tuple, set)):
            values = list(value)
            lines = [
                f"{prefix}: "
                f"{cls._translate('canvas.detail.value.item_count', count=len(values))}"
            ]
            for index, item in enumerate(values[: cls._MAX_LIST_ITEMS], start=1):
                if isinstance(item, Mapping):
                    lines.append(f"{indent}  - {cls._translate('canvas.detail.value.item_index', index=index)}:")
                    for child_key, child_value in item.items():
                        lines.extend(cls._render_value(str(child_key), child_value, indent + "    "))
                else:
                    lines.append(f"{indent}  - {cls._truncate(str(item))}")
            if len(values) > cls._MAX_LIST_ITEMS:
                more_items = cls._translate(
                    "canvas.detail.value.more_items",
                    count=len(values) - cls._MAX_LIST_ITEMS,
                )
                lines.append(f"{indent}  - {more_items}")
            return lines
        return [f"{prefix}: {cls.localized_field_value(key, cls._truncate(value))}"]

    @classmethod
    def _field_label(cls, key: str) -> str:
        """返回字段的本地化名称，未知字段使用可读化名称。"""
        normalized = key.strip()
        translated = cls._translate(f"canvas.detail.field.{normalized}")
        if translated != f"canvas.detail.field.{normalized}":
            return translated
        return normalized.replace("_", " ") or cls._translate("canvas.detail.value.unknown")

    @classmethod
    def _is_sensitive_key(cls, key: str) -> bool:
        """判断入参字段是否应只展示已提供，避免展示凭证或大段 Base64。"""
        normalized = key.casefold()
        return (
            normalized in cls._SENSITIVE_INPUT_KEYS
            or "base64" in normalized
            or normalized.endswith(("_token", "_secret"))
        )

    @classmethod
    def _truncate(cls, value: Any) -> Any:
        """限制长文本长度，避免详情卡片被提示词或错误正文撑大。"""
        if isinstance(value, str) and len(value) > cls._MAX_TEXT_LENGTH:
            return value[: cls._MAX_TEXT_LENGTH] + "..."
        return value

    @staticmethod
    def _single_line(value: str) -> str:
        """把多行结果压缩为单行，避免破坏字段列表的 Markdown 结构。"""
        return " ".join(value.split())
