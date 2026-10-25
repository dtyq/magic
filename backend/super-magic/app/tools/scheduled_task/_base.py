"""定时任务 Code Mode 工具共享基类。"""

from __future__ import annotations

import json
import re
from abc import ABC
from datetime import datetime
from typing import Any, ClassVar, Generic, Optional, TypeVar

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.context.agent_context import AgentContext
from app.core.entity.message.client_message import AgentMode
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk_with_defaults
from app.infrastructure.sdk.magic_service.magic_service import MagicService
from app.infrastructure.sdk.magic_service.parameter.message_schedule_parameter import TimeConfig
from app.tools.core import BaseTool, BaseToolParams, tool
from app.utils.init_client_message_util import InitClientMessageUtil

P = TypeVar("P", bound=BaseToolParams)


@tool(code_mode_only=True)
class BaseScheduledTaskTool(BaseTool[P], Generic[P], ABC):
    """仅允许从 Code Mode 调用的定时任务工具基类。"""

    default_agent_mode: ClassVar[str] = AgentMode.MAGIC.value
    agent_mode_to_topic_pattern: ClassVar[dict[AgentMode, str]] = {
        AgentMode.GENERAL: AgentMode.GENERAL.value,
        AgentMode.MAGIC: AgentMode.GENERAL.value,
        AgentMode.PPT: AgentMode.PPT.value,
        AgentMode.DATA_ANALYSIS: AgentMode.DATA_ANALYSIS.value,
        AgentMode.SUMMARY: AgentMode.SUMMARY.value,
        AgentMode.SUMMARY_CHAT: AgentMode.SUMMARY_CHAT.value,
        AgentMode.SUMMARY_VIDEO: AgentMode.SUMMARY_VIDEO.value,
        AgentMode.DESIGN: AgentMode.DESIGN.value,
        AgentMode.VIDEO_PRODUCTION: AgentMode.VIDEO_PRODUCTION.value,
        AgentMode.TEST: AgentMode.TEST.value,
        AgentMode.CREW_CREATOR: AgentMode.CREW_CREATOR.value,
        AgentMode.SKILL_CREATOR: AgentMode.SKILL_CREATOR.value,
        AgentMode.MAGICLAW: AgentMode.MAGICLAW.value,
    }
    agent_type_to_topic_pattern: ClassVar[dict[str, str]] = {
        "magic": AgentMode.GENERAL.value,
        "slider": AgentMode.PPT.value,
        "data-analyst": AgentMode.DATA_ANALYSIS.value,
        "audio": AgentMode.SUMMARY.value,
        "audio-chat": AgentMode.SUMMARY_CHAT.value,
        "video": AgentMode.SUMMARY_VIDEO.value,
        "design": AgentMode.DESIGN.value,
        "video-production": AgentMode.VIDEO_PRODUCTION.value,
        "test": AgentMode.TEST.value,
        "crew-creator": AgentMode.CREW_CREATOR.value,
        "skill-creator": AgentMode.SKILL_CREATOR.value,
        "magiclaw": AgentMode.MAGICLAW.value,
    }
    before_message_keys: ClassVar[dict[str, str]] = {
        "create": "scheduled_task.create.creating",
        "list": "scheduled_task.list.listing",
        "get": "scheduled_task.get.getting",
        "update": "scheduled_task.update.updating",
        "delete": "scheduled_task.delete.deleting",
    }
    after_success_message_keys: ClassVar[dict[str, str]] = {
        "create": "scheduled_task.create.created",
        "list": "scheduled_task.list.listed",
        "get": "scheduled_task.get.got",
        "update": "scheduled_task.update.updated",
        "delete": "scheduled_task.delete.deleted",
    }
    after_failed_message_keys: ClassVar[dict[str, str]] = {
        "create": "scheduled_task.create.failed",
        "list": "scheduled_task.list.failed",
        "get": "scheduled_task.get.failed",
        "update": "scheduled_task.update.failed",
        "delete": "scheduled_task.delete.failed",
    }
    detail_field_message_keys: ClassVar[dict[str, str]] = {
        "id": "scheduled_task.detail.id",
        "task_name": "scheduled_task.detail.task_name",
        "task_describe": "scheduled_task.detail.task_describe",
        "status": "scheduled_task.detail.task_status",
        "enabled": "scheduled_task.detail.enabled",
        "deadline": "scheduled_task.detail.deadline",
        "agent_mode": "scheduled_task.detail.agent_mode",
    }

    @staticmethod
    def magic_service_sdk() -> MagicService:
        """创建 magic-service SDK 实例。"""
        return create_magic_service_sdk_with_defaults()

    @staticmethod
    def resolve_agent_context(tool_context: ToolContext) -> AgentContext | None:
        """从 ToolContext 解析当前 AgentContext。"""
        try:
            return tool_context.get_extension_typed("agent_context", AgentContext)
        except Exception:
            value = tool_context.get_extension("agent_context")
            return value if isinstance(value, AgentContext) else None

    @classmethod
    def resolve_metadata(cls, tool_context: ToolContext) -> dict[str, Any]:
        """解析当前会话 metadata，优先使用 AgentContext。"""
        agent_context = cls.resolve_agent_context(tool_context)
        if agent_context is not None and hasattr(agent_context, "get_metadata"):
            metadata = agent_context.get_metadata()
            return dict(metadata or {})
        return dict(InitClientMessageUtil.get_metadata() or {})

    @classmethod
    def resolve_topic_id(cls, tool_context: ToolContext) -> str:
        """从当前会话 metadata 解析 Super Magic 话题 ID。"""
        topic_id = str(cls.resolve_metadata(tool_context).get("topic_id") or "").strip()
        if not topic_id:
            raise ValueError("无法从当前会话获取 topic_id")
        return topic_id

    @classmethod
    def resolve_project_id(cls, tool_context: ToolContext) -> str:
        """从当前会话 metadata 解析项目 ID。"""
        project_id = str(cls.resolve_metadata(tool_context).get("project_id") or "").strip()
        if not project_id:
            raise ValueError("无法从当前会话获取 project_id")
        return project_id

    @classmethod
    def resolve_model_id(cls, tool_context: ToolContext) -> str:
        """从 AgentContext 模型上下文解析当前文本模型 ID。"""
        agent_context = cls.resolve_agent_context(tool_context)
        model_context = getattr(agent_context, "model_context", None) if agent_context else None
        model_id = str(getattr(model_context, "current_text_model_id", "") or "").strip()
        if not model_id:
            raise ValueError("无法从当前会话获取 model_id")
        return model_id

    @staticmethod
    def normalize_deadline(value: Optional[str]) -> Optional[str]:
        """将 deadline 规范为 YYYY-MM-DD HH:MM:SS。"""
        if value is None or not str(value).strip():
            return None

        raw = str(value).strip()
        if re.match(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$", raw):
            return raw

        match = re.match(r"^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$", raw)
        if match:
            return f"{match.group(1)} {match.group(2)}:00"

        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(raw, fmt)
                if fmt == "%Y-%m-%d %H:%M:%S":
                    return raw
                return dt.strftime("%Y-%m-%d 00:00:00")
            except ValueError:
                continue

        match = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", raw)
        if match:
            year = match.group(1)
            month = match.group(2).zfill(2)
            day = match.group(3).zfill(2)
            return f"{year}-{month}-{day} 00:00:00"

        raise ValueError("deadline must be YYYY-MM-DD, YYYY-MM-DD HH:MM, or YYYY-MM-DD HH:MM:SS")

    @staticmethod
    def build_time_config(schedule_type: str, time: str, day: Optional[str] = None) -> TimeConfig:
        """构造并校验定时任务时间配置。"""
        normalized_time = str(time or "").strip()
        if not normalized_time:
            raise ValueError("time is required")

        normalized_day = str(day).strip() if day is not None else None
        if schedule_type in {
            TimeConfig.TYPE_NO_REPEAT,
            TimeConfig.TYPE_WEEKLY_REPEAT,
            TimeConfig.TYPE_MONTHLY_REPEAT,
        } and not normalized_day:
            raise ValueError(f"day is required for schedule_type={schedule_type}")

        return TimeConfig(
            schedule_type=schedule_type,
            time=normalized_time,
            day=normalized_day,
        )

    @staticmethod
    def stringify_agent_mode(agent_mode: Any) -> str:
        """将 AgentMode 枚举或字符串统一转换为干净的模式值。"""
        return str(getattr(agent_mode, "value", agent_mode) or "").strip()

    @classmethod
    def resolve_context_agent_code(cls, agent_context: AgentContext) -> str:
        """从当前上下文解析自定义 Agent code。"""
        if hasattr(agent_context, "get_agent_code"):
            agent_code = cls.stringify_agent_mode(agent_context.get_agent_code())
            if agent_code:
                return agent_code

        chat_message = (
            agent_context.get_chat_client_message()
            if hasattr(agent_context, "get_chat_client_message")
            else None
        )
        dynamic_config = getattr(chat_message, "dynamic_config", None) or {}
        if isinstance(dynamic_config, dict):
            return cls.stringify_agent_mode(dynamic_config.get("agent_code"))
        return ""

    @classmethod
    def resolve_current_agent_mode(cls, tool_context: ToolContext) -> str:
        """从当前运行上下文解析默认 agent_mode。"""
        agent_context = cls.resolve_agent_context(tool_context)
        if agent_context is not None:
            runtime_agent_name = cls.stringify_agent_mode(getattr(agent_context, "agent_name", ""))
            if runtime_agent_name and runtime_agent_name != "base_agent":
                if runtime_agent_name in {"agent_creator", "custom_agent"}:
                    agent_code = cls.resolve_context_agent_code(agent_context)
                    if agent_code:
                        return agent_code
                return runtime_agent_name

            chat_message = (
                agent_context.get_chat_client_message()
                if hasattr(agent_context, "get_chat_client_message")
                else None
            )
            agent_code = cls.resolve_context_agent_code(agent_context)
            message_agent_mode = getattr(chat_message, "agent_mode", None)
            message_agent_mode_value = cls.stringify_agent_mode(message_agent_mode)
            if agent_code and message_agent_mode_value in {"agent_creator", "custom_agent"}:
                return agent_code
            if message_agent_mode_value:
                return message_agent_mode_value

        agent_type = InitClientMessageUtil.get_agent_type()
        if agent_type:
            return agent_type
        return cls.default_agent_mode

    @classmethod
    def resolve_known_agent_mode(cls, normalized_mode: str) -> tuple[str, str] | None:
        """将内置模式解析为 magic-service topic_pattern 和友好展示值。"""
        mode_key = normalized_mode.lower()
        try:
            agent_mode = AgentMode(mode_key)
            return cls.agent_mode_to_topic_pattern[agent_mode], agent_mode.get_agent_type()
        except ValueError:
            pass

        topic_pattern = cls.agent_type_to_topic_pattern.get(mode_key)
        if topic_pattern:
            return topic_pattern, mode_key
        return None

    @classmethod
    def resolve_agent_mode(
        cls,
        agent_mode: Optional[str],
        default_agent_mode: Optional[str] = None,
    ) -> tuple[str, Optional[str], str]:
        """将用户友好的 agent_mode 转换为 magic-service 调度参数。"""
        raw_mode = str(agent_mode or "").strip()
        normalized_mode = raw_mode or str(default_agent_mode or "").strip() or cls.default_agent_mode

        resolved_known_mode = cls.resolve_known_agent_mode(normalized_mode)
        if resolved_known_mode:
            topic_pattern, resolved_agent_mode = resolved_known_mode
            return topic_pattern, None, resolved_agent_mode

        return "custom_agent", normalized_mode, normalized_mode

    @classmethod
    def resolve_schedule_agent_mode(cls, data: dict[str, Any]) -> str:
        """从 magic-service 返回字段解析用户友好的 agent_mode。"""
        raw_agent_mode = cls.stringify_agent_mode(data.get("agent_mode"))
        if raw_agent_mode:
            return raw_agent_mode

        topic_pattern = cls.stringify_agent_mode(data.get("topic_pattern"))
        agent_code = cls.stringify_agent_mode(data.get("agent_code"))
        if topic_pattern == "custom_agent" and agent_code:
            return agent_code
        if not topic_pattern and agent_code:
            return agent_code
        if not topic_pattern:
            return ""

        resolved_known_mode = cls.resolve_known_agent_mode(topic_pattern)
        if resolved_known_mode:
            return resolved_known_mode[1]
        return topic_pattern

    @classmethod
    def normalize_schedule_fields(cls, data: dict[str, Any]) -> dict[str, Any]:
        """补齐定时任务展示层需要的友好字段。"""
        normalized = dict(data)
        agent_mode = cls.resolve_schedule_agent_mode(normalized)
        if agent_mode:
            normalized["agent_mode"] = agent_mode
        return normalized

    @staticmethod
    def text_to_json_content(text: str) -> dict[str, Any]:
        """将纯文本转换为 Tiptap JSONContent。"""
        paragraphs: list[dict[str, Any]] = []
        for line in text.split("\n"):
            if line:
                paragraphs.append({
                    "type": "paragraph",
                    "content": [{"type": "text", "text": line}],
                })
            else:
                paragraphs.append({"type": "paragraph"})
        return {"type": "doc", "content": paragraphs}

    @classmethod
    def parse_message_content(cls, raw: Any) -> tuple[dict[str, Any], str]:
        """解析消息内容，返回 JSONContent 和消息类型。"""
        if isinstance(raw, dict):
            if raw.get("type"):
                return raw, "rich_text"
            raise ValueError("message_content dict must be a JSONContent object with a type field")

        if not isinstance(raw, str):
            raise ValueError("message_content must be a string or JSONContent dict")
        if not raw.strip():
            raise ValueError("message_content must not be empty")

        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict) and parsed.get("type"):
                return parsed, "rich_text"
        except (json.JSONDecodeError, TypeError):
            pass

        return cls.text_to_json_content(raw), "rich_text"

    @staticmethod
    def whitelist_fields(data: dict[str, Any], fields: tuple[str, ...]) -> dict[str, Any]:
        """按白名单过滤返回字段。"""
        return {key: data[key] for key in fields if key in data}

    @staticmethod
    def json_content(data: dict[str, Any]) -> str:
        """将结构化结果转换为模型可读 JSON 字符串。"""
        return json.dumps(data, ensure_ascii=False, indent=2)

    @classmethod
    def success_result(cls, data: dict[str, Any]) -> ToolResult:
        """构造成功的 ToolResult。"""
        return ToolResult(content=cls.json_content(data), data=data, extra_info=data)

    @staticmethod
    def user_error(result: ToolResult) -> str:
        """从 ToolResult 提取用户可见错误信息。"""
        return (result.extra_info or {}).get("user_error") or i18n.translate(
            "scheduled_task.error.default",
            category="tool.messages",
        )

    @staticmethod
    def markdown_file(file_name: str, lines: list[str]) -> ToolDetail | None:
        """将工具自定义展示内容包装成 Markdown 详情。"""
        if not lines:
            return None
        return ToolDetail(type=DisplayType.MD, data=FileContent(file_name=file_name, content="\n".join(lines)))

    @staticmethod
    def result_info(result: ToolResult) -> dict[str, Any]:
        """从 ToolResult 中提取用户展示用结构化信息。"""
        if isinstance(result.extra_info, dict) and result.extra_info:
            return result.extra_info
        if isinstance(result.data, dict) and result.data:
            return result.data
        return {}

    def tool_operation(self) -> str:
        """根据工具名称解析当前定时任务操作。"""
        return str(self.name or "").removeprefix("scheduled_task_")

    def tool_action(self) -> str:
        """返回当前工具的用户可见 action。"""
        return i18n.translate(self.name, category="tool.actions")

    @staticmethod
    def tool_message(code: str, **kwargs: Any) -> str:
        """返回工具消息国际化文案。"""
        return i18n.translate(code, category="tool.messages", **kwargs)

    def empty_value(self) -> str:
        """返回空值展示文案。"""
        return self.tool_message("scheduled_task.detail.empty")

    def target_label(self, arguments: dict[str, Any] | None, info: dict[str, Any] | None = None) -> str:
        """从入参和结果中提取当前操作对象的展示标签。"""
        args = arguments or {}
        values = info or {}
        if self.tool_operation() == "list":
            task_name = self.first_present_value("task_name", values, args)
            return str(task_name).strip() if task_name else self.tool_message("scheduled_task.detail.all_tasks")

        for key in ("task_name", "id"):
            value = self.first_present_value(key, values, args)
            if value is not None and str(value).strip():
                return str(value).strip()
        return self.empty_value()

    @staticmethod
    def first_present_value(key: str, *sources: dict[str, Any]) -> Any:
        """按顺序从多个来源读取非空字段值。"""
        for source in sources:
            if key in source and source[key] not in (None, ""):
                return source[key]
        return None

    def result_count(self, info: dict[str, Any]) -> int:
        """提取列表结果数量。"""
        total = info.get("total")
        if isinstance(total, int):
            return total
        schedules = info.get("schedules")
        return len(schedules) if isinstance(schedules, list) else 0

    def time_config_value(self, arguments: dict[str, Any] | None, info: dict[str, Any]) -> Any:
        """从结果或入参中提取时间配置展示值。"""
        args = arguments or {}
        value = self.first_present_value("time_config", info, args)
        if value is not None:
            return value
        partial = {
            key: args[key]
            for key in ("schedule_type", "time", "day")
            if key in args and args[key] not in (None, "")
        }
        if not partial:
            return None
        if "schedule_type" in partial:
            partial["type"] = partial.pop("schedule_type")
        return partial

    def enabled_label(self, value: Any) -> str:
        """将启用状态转换为用户可见文案。"""
        if value is None or value == "":
            return self.empty_value()
        if isinstance(value, bool):
            return self.tool_message(
                "scheduled_task.detail.enabled_yes" if value else "scheduled_task.detail.enabled_no"
            )
        normalized = str(value).strip().lower()
        if normalized in {"1", "true", "enabled"}:
            return self.tool_message("scheduled_task.detail.enabled_yes")
        if normalized in {"0", "false", "disabled"}:
            return self.tool_message("scheduled_task.detail.enabled_no")
        return self.empty_value() if not normalized else str(value)

    def format_value(self, value: Any, *, max_length: int = 300) -> str:
        """格式化单行展示值。"""
        if value is None or value == "":
            return self.empty_value()
        if isinstance(value, (dict, list)):
            text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        else:
            text = str(value)
        if len(text) > max_length:
            text = text[:max_length] + "..."
        return text

    def format_json_block(self, value: Any) -> str:
        """格式化多行 JSON 展示值。"""
        if value is None or value == "":
            return self.empty_value()
        if isinstance(value, str):
            return value
        return json.dumps(value, ensure_ascii=False, indent=2)

    @staticmethod
    def table_cell(value: Any) -> str:
        """转义 Markdown 表格单元格内容。"""
        text = str(value).replace("\n", " ").replace("|", "\\|")
        return text if text else "-"

    def append_field_line(
        self,
        lines: list[str],
        field: str,
        arguments: dict[str, Any] | None,
        info: dict[str, Any],
    ) -> None:
        """向详情 Markdown 追加一个通用字段。"""
        args = arguments or {}
        value = self.first_present_value(field, info, args)
        if value is None:
            return
        label = self.tool_message(self.detail_field_message_keys[field])
        display_value = self.enabled_label(value) if field == "enabled" else self.format_value(value)
        lines.append(f"- {label}: {display_value}")

    def build_list_detail(self, result: ToolResult, info: dict[str, Any]) -> ToolDetail | None:
        """构造查询列表工具的详情展示。"""
        lines = [
            f"# {self.tool_message('scheduled_task.detail.list_title')}",
            "",
            f"- {self.tool_message('scheduled_task.detail.operation')}: {self.tool_action()}",
            "- {label}: {status}".format(
                label=self.tool_message("scheduled_task.detail.result_status"),
                status=self.tool_message(
                    "scheduled_task.detail.success" if result.ok else "scheduled_task.detail.failed"
                ),
            ),
        ]
        if not result.ok:
            lines.append(f"- {self.tool_message('scheduled_task.detail.error')}: {self.user_error(result)}")
            return self.markdown_file("scheduled_task.md", lines)

        schedules = info.get("schedules") if isinstance(info.get("schedules"), list) else []
        lines.append(f"- {self.tool_message('scheduled_task.detail.total')}: {self.result_count(info)}")
        if not schedules:
            lines.extend(["", self.tool_message("scheduled_task.detail.no_schedules")])
            return self.markdown_file("scheduled_task.md", lines)

        headers = [
            self.tool_message("scheduled_task.detail.id"),
            self.tool_message("scheduled_task.detail.task_name"),
            self.tool_message("scheduled_task.detail.agent_mode"),
            self.tool_message("scheduled_task.detail.task_status"),
            self.tool_message("scheduled_task.detail.enabled"),
            self.tool_message("scheduled_task.detail.deadline"),
            self.tool_message("scheduled_task.detail.time_config"),
        ]
        lines.extend(["", "| " + " | ".join(headers) + " |", "| --- | --- | --- | --- | --- | --- | --- |"])
        for item in schedules:
            if not isinstance(item, dict):
                continue
            lines.append(
                "| {id} | {task_name} | {agent_mode} | {status} | {enabled} | {deadline} | {time_config} |".format(
                    id=self.table_cell(self.format_value(item.get("id"), max_length=80)),
                    task_name=self.table_cell(self.format_value(item.get("task_name"), max_length=80)),
                    agent_mode=self.table_cell(self.format_value(item.get("agent_mode"), max_length=80)),
                    status=self.table_cell(self.format_value(item.get("status"), max_length=80)),
                    enabled=self.table_cell(self.enabled_label(item.get("enabled"))),
                    deadline=self.table_cell(self.format_value(item.get("deadline"), max_length=80)),
                    time_config=self.table_cell(self.format_value(item.get("time_config"), max_length=120)),
                )
            )
        return self.markdown_file("scheduled_task.md", lines)

    def build_single_detail(
        self,
        result: ToolResult,
        arguments: dict[str, Any] | None,
        info: dict[str, Any],
    ) -> ToolDetail | None:
        """构造单个定时任务操作的详情展示。"""
        lines = [
            f"# {self.tool_message('scheduled_task.detail.title')}",
            "",
            f"- {self.tool_message('scheduled_task.detail.operation')}: {self.tool_action()}",
            "- {label}: {status}".format(
                label=self.tool_message("scheduled_task.detail.result_status"),
                status=self.tool_message(
                    "scheduled_task.detail.success" if result.ok else "scheduled_task.detail.failed"
                ),
            ),
        ]
        for field in ("id", "task_name", "task_describe", "agent_mode", "status", "enabled", "deadline"):
            self.append_field_line(lines, field, arguments, info)

        if not result.ok:
            lines.append(f"- {self.tool_message('scheduled_task.detail.error')}: {self.user_error(result)}")
            return self.markdown_file("scheduled_task.md", lines)

        time_config = self.time_config_value(arguments, info)
        if time_config is not None:
            lines.extend([
                "",
                f"## {self.tool_message('scheduled_task.detail.time_config')}",
                "",
                "```json",
                self.format_json_block(time_config),
                "```",
            ])
        return self.markdown_file("scheduled_task.md", lines)

    async def get_before_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        arguments: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """返回定时任务工具调用前的展示文案。"""
        operation = self.tool_operation()
        return {
            "action": self.tool_action(),
            "remark": self.tool_message(
                self.before_message_keys.get(operation, "scheduled_task.operation.running"),
                target=self.target_label(arguments),
            ),
            "tool_name": tool_name,
        }

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """返回定时任务工具调用后的展示文案。"""
        operation = self.tool_operation()
        info = self.result_info(result)
        message_keys = self.after_success_message_keys if result.ok else self.after_failed_message_keys
        return {
            "action": self.tool_action(),
            "remark": self.tool_message(
                message_keys.get(operation, "scheduled_task.operation.done"),
                target=self.target_label(arguments, info),
                count=self.result_count(info),
                error=self.user_error(result),
            ),
            "tool_name": tool_name,
        }

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: dict[str, Any] | None = None,
    ) -> ToolDetail | None:
        """返回定时任务工具的 Markdown 详情。"""
        info = self.result_info(result)
        if self.tool_operation() == "list":
            return self.build_list_detail(result, info)
        return self.build_single_detail(result, arguments, info)
