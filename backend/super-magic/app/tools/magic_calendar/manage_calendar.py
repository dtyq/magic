"""manage_calendar: 日历日程管理工具

单工具多 action 模式（参照 ManageCron），CRUD 日程和分类。
数据存储在 magic.project.js（JSONP 格式）中。
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Literal, Optional

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool
from app.tools.magic_calendar.calendar_utils import (
    find_event_by_id,
    generate_event_id,
    get_month_key,
    get_month_keys_in_range,
    read_all_events,
    read_calendar_meta,
    read_events_for_range,
    read_month_events,
    sync_event_files_index,
    write_calendar_meta,
    write_month_events,
)
from app.tools.workspace_tool import WorkspaceTool

logger = get_logger(__name__)

# 合法的 status 值（前三个来自 RFC 5545，completed 为扩展）
_VALID_STATUSES = {"confirmed", "tentative", "cancelled", "completed"}


class ManageCalendarParams(BaseToolParams):
    action: Literal[
        "add_event", "list_events", "update_event", "delete_event",
        "add_category", "list_categories",
    ] = Field(
        ...,
        description="""<!--zh: 操作类型及各自必填参数：
- add_event: 必填 project_path/title/start，可选 end/all_day/description/location/status/category/recurrence
- list_events: 必填 project_path，可选 date_from/date_to/category/keyword
- update_event: 必填 project_path/event_id，其余字段按需传（省略则保持原值）
- delete_event: 必填 project_path/event_id
- add_category: 必填 project_path/category_id/category_name/category_color
- list_categories: 必填 project_path
-->
Action to perform. Per-action required fields:
- add_event: project_path + title + start required; end/all_day/description/location/status/category/recurrence optional
- list_events: project_path required; date_from/date_to/category/keyword optional
- update_event: project_path + event_id required; any other field optional (omitted fields keep current value)
- delete_event: project_path + event_id required
- add_category: project_path + category_id + category_name + category_color required
- list_categories: project_path required"""
    )

    project_path: str = Field(
        ...,
        description="""<!--zh: 日历项目文件夹路径-->
Calendar project folder path"""
    )

    # ── 日程字段 ──────────────────────────────────────────────────────────────

    event_id: Optional[str] = Field(
        None,
        description="""<!--zh: 日程 ID（evt_ 前缀）。update_event/delete_event 时必填。-->
Event ID (evt_ prefix). Required for update_event/delete_event."""
    )

    title: Optional[str] = Field(
        None,
        description="""<!--zh: 日程标题。add_event 时必填。-->
Event title. Required for add_event."""
    )

    start: Optional[str] = Field(
        None,
        description="""<!--zh: 开始时间。格式：'YYYY-MM-DD HH:MM'（非全天）或 'YYYY-MM-DD'（全天）。add_event 时必填。-->
Start time. Format: 'YYYY-MM-DD HH:MM' (timed) or 'YYYY-MM-DD' (all-day). Required for add_event."""
    )

    end: Optional[str] = Field(
        None,
        description="""<!--zh: 结束时间，格式同 start。不填则自动推算：非全天默认 start+1h，全天默认当天结束。-->
End time, same format as start. If omitted: timed events default to start+1h, all-day events default to end of start day."""
    )

    all_day: Optional[bool] = Field(
        None,
        description="""<!--zh: 是否全天日程。不传时根据 start 格式自动判断（无时间部分 → 全天）。-->
Whether all-day event. When omitted, auto-detected from start format (no time part → all-day)."""
    )

    description: Optional[str] = Field(
        None,
        description="""<!--zh: 日程详细描述-->
Event description"""
    )

    location: Optional[str] = Field(
        None,
        description="""<!--zh: 地点-->
Location"""
    )

    status: Optional[str] = Field(
        None,
        description="""<!--zh: 日程状态：confirmed（默认）/ tentative（占位）/ cancelled（已取消）/ completed（已完成）-->
Event status: confirmed (default) / tentative (placeholder) / cancelled / completed"""
    )

    category: Optional[str] = Field(
        None,
        description="""<!--zh: 分类 ID，引用 categories 中已有分类的 id-->
Category ID, references an existing category id"""
    )

    recurrence: Optional[str] = Field(
        None,
        description="""<!--zh: 重复规则 JSON。示例：{"type":"weekly","interval":1,"days_of_week":[1,3,5]}-->
Recurrence rule as JSON. Example: {"type":"weekly","interval":1,"days_of_week":[1,3,5]}"""
    )

    # ── 查询字段 ──────────────────────────────────────────────────────────────

    date_from: Optional[str] = Field(
        None,
        description="""<!--zh: 查询起始日期（YYYY-MM-DD），list_events 时可选-->
Query start date (YYYY-MM-DD), optional for list_events"""
    )

    date_to: Optional[str] = Field(
        None,
        description="""<!--zh: 查询结束日期（YYYY-MM-DD），list_events 时可选-->
Query end date (YYYY-MM-DD), optional for list_events"""
    )

    keyword: Optional[str] = Field(
        None,
        description="""<!--zh: 关键词搜索（匹配 title/description），list_events 时可选-->
Keyword search (matches title/description), optional for list_events"""
    )

    # ── 分类字段 ──────────────────────────────────────────────────────────────

    category_id: Optional[str] = Field(
        None,
        description="""<!--zh: 分类 ID（英文标识符）。add_category 时必填。-->
Category ID (alphanumeric identifier). Required for add_category."""
    )

    category_name: Optional[str] = Field(
        None,
        description="""<!--zh: 分类显示名。add_category 时必填。-->
Category display name. Required for add_category."""
    )

    category_color: Optional[str] = Field(
        None,
        description="""<!--zh: 分类颜色（十六进制）。add_category 时必填。示例：#4CAF50-->
Category color (hex). Required for add_category. Example: #4CAF50"""
    )

    @field_validator("recurrence", mode="before")
    @classmethod
    def parse_recurrence(cls, v):
        """兼容模型将 recurrence 序列化为 JSON 字符串的情况"""
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, dict):
                    return json.dumps(parsed)  # 保持为字符串，execute 中再解析
            except json.JSONDecodeError:
                pass
        return v


@tool()
class ManageCalendar(WorkspaceTool[ManageCalendarParams]):
    """<!--zh
    管理日历日程。数据存储在项目文件夹的 magic.project.js 中。

    何时使用 — 遇到以下情况应调用此工具：
    - 用户想添加日程/安排/活动/计划                → add_event
    - 用户想查看/查询某段时间的日程                → list_events
    - 用户想修改已有日程的时间/标题/描述等        → update_event
    - 用户想删除/取消某个日程                      → delete_event
    - 用户想添加新的日程分类                       → add_category
    - 用户想查看有哪些分类                         → list_categories

    快速参考：
      add_event      title + start               → 添加日程（最少只需 2 个字段）
      list_events    [date_from] [date_to]       → 查询日程
      update_event   event_id + [fields]          → 更新日程（只传要改的字段）
      delete_event   event_id                     → 删除日程
      add_category   category_id + name + color   → 添加分类
      list_categories                             → 列出所有分类

    日程状态：
      confirmed  默认状态，已确认的日程
      tentative  占位/暂定的日程
      cancelled  已取消（前端显示删除线）
      completed  已完成（前端显示 ✓ 标记）
    -->
    Manage calendar events. Data is stored in magic.project.js in the project folder.

    WHEN TO USE — call this tool for:
    - User wants to add an event/schedule/activity/plan          → add_event
    - User wants to view/query events in a time range           → list_events
    - User wants to modify an existing event's time/title/etc   → update_event
    - User wants to delete/cancel an event                      → delete_event
    - User wants to add a new event category                    → add_category
    - User wants to see available categories                    → list_categories

    QUICK REFERENCE:
      add_event      title + start               → add event (minimum 2 fields)
      list_events    [date_from] [date_to]       → query events
      update_event   event_id + [fields]          → update event (only changed fields)
      delete_event   event_id                     → delete event
      add_category   category_id + name + color   → add category
      list_categories                             → list all categories

    EVENT STATUS:
      confirmed  default, confirmed event
      tentative  placeholder/tentative event
      cancelled  cancelled (shown with strikethrough)
      completed  completed (shown with ✓ mark)"""

    async def execute(self, tool_context: ToolContext, params: ManageCalendarParams) -> ToolResult:
        try:
            if params.action == "add_event":
                return await self._add_event(params)
            elif params.action == "list_events":
                return await self._list_events(params)
            elif params.action == "update_event":
                return await self._update_event(params)
            elif params.action == "delete_event":
                return await self._delete_event(params)
            elif params.action == "add_category":
                return await self._add_category(params)
            elif params.action == "list_categories":
                return await self._list_categories(params)
            else:
                return ToolResult.error(f"Unknown action: {params.action}")
        except FileNotFoundError as e:
            return ToolResult.error(str(e))
        except Exception as e:
            logger.exception(f"manage_calendar [{params.action}] failed: {e}")
            return ToolResult.error(str(e))

    # ── action 实现 ───────────────────────────────────────────────────────────

    async def _add_event(self, params: ManageCalendarParams) -> ToolResult:
        if not params.title:
            return ToolResult.error("title is required for add_event")
        if not params.start:
            return ToolResult.error("start is required for add_event")

        project_path = self.resolve_path(params.project_path)
        meta = await read_calendar_meta(project_path)

        # 自动判断全天
        is_all_day = params.all_day
        if is_all_day is None:
            is_all_day = len(params.start.strip()) <= 10  # YYYY-MM-DD 长度为 10

        # 自动推算 end
        end = params.end
        if not end:
            end = _calculate_default_end(params.start, is_all_day)

        # 校验 status
        status = params.status or "confirmed"
        if status not in _VALID_STATUSES:
            return ToolResult.error(
                f"Invalid status '{status}'. Valid values: {', '.join(sorted(_VALID_STATUSES))}"
            )

        event = {
            "id": generate_event_id(),
            "title": params.title,
            "start": params.start,
            "end": end,
            "all_day": is_all_day,
            "description": params.description or "",
            "location": params.location or "",
            "status": status,
            "category": params.category or "",
            "recurrence": json.loads(params.recurrence) if params.recurrence else None,
        }

        # 写入对应月份文件
        month_key = get_month_key(params.start)
        month_events = await read_month_events(project_path, month_key)
        month_events.append(event)
        await write_month_events(project_path, month_key, month_events)

        # 更新元数据索引
        meta["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        await sync_event_files_index(project_path, meta)
        await write_calendar_meta(project_path, meta)

        return ToolResult(
            content=f"Added event '{params.title}' ({event['id']}) at {params.start}",
            data={"event": event},
        )

    async def _list_events(self, params: ManageCalendarParams) -> ToolResult:
        project_path = self.resolve_path(params.project_path)
        meta = await read_calendar_meta(project_path)

        # 按日期范围只加载相关月份
        month_keys = get_month_keys_in_range(meta, params.date_from, params.date_to)
        events = await read_events_for_range(project_path, month_keys)

        # 按条件过滤
        if params.date_from:
            events = [e for e in events if e.get("start", "") >= params.date_from]
        if params.date_to:
            # date_to 是包含的，所以比较到 date_to 的下一天
            date_to_next = params.date_to + "~"  # ~ 的 ASCII 码大于所有 digit/space/colon
            events = [e for e in events if e.get("start", "") < date_to_next]
        if params.category:
            events = [e for e in events if e.get("category") == params.category]
        if params.keyword:
            kw = params.keyword.lower()
            events = [
                e for e in events
                if kw in e.get("title", "").lower() or kw in e.get("description", "").lower()
            ]

        # 按 start 排序
        events.sort(key=lambda e: e.get("start", ""))

        if not events:
            return ToolResult(content="No events found.", data={"events": [], "total": 0})

        lines = [f"Found {len(events)} event(s):"]
        for e in events:
            status_mark = _status_mark(e.get("status", "confirmed"))
            cat = f" [{e['category']}]" if e.get("category") else ""
            lines.append(f"  {status_mark} {e['id']} | {e['start']} | {e['title']}{cat}")

        return ToolResult(
            content="\n".join(lines),
            data={"events": events, "total": len(events)},
        )

    async def _update_event(self, params: ManageCalendarParams) -> ToolResult:
        if not params.event_id:
            return ToolResult.error("event_id is required for update_event")

        project_path = self.resolve_path(params.project_path)
        meta = await read_calendar_meta(project_path)

        # 跨月查找事件
        result = await find_event_by_id(project_path, meta, params.event_id)
        if result is None:
            return ToolResult.error(f"Event '{params.event_id}' not found")
        old_month_key, month_events, event = result

        # 按需更新字段（None 表示不更新）
        updated_fields: List[str] = []
        if params.title is not None:
            event["title"] = params.title
            updated_fields.append("title")
        if params.start is not None:
            event["start"] = params.start
            updated_fields.append("start")
        if params.end is not None:
            event["end"] = params.end
            updated_fields.append("end")
        if params.all_day is not None:
            event["all_day"] = params.all_day
            updated_fields.append("all_day")
        if params.description is not None:
            event["description"] = params.description
            updated_fields.append("description")
        if params.location is not None:
            event["location"] = params.location
            updated_fields.append("location")
        if params.status is not None:
            if params.status not in _VALID_STATUSES:
                return ToolResult.error(
                    f"Invalid status '{params.status}'. Valid: {', '.join(sorted(_VALID_STATUSES))}"
                )
            event["status"] = params.status
            updated_fields.append("status")
        if params.category is not None:
            event["category"] = params.category
            updated_fields.append("category")
        if params.recurrence is not None:
            event["recurrence"] = json.loads(params.recurrence) if params.recurrence else None
            updated_fields.append("recurrence")

        if not updated_fields:
            return ToolResult(content=f"No fields to update for event '{params.event_id}'")

        # 如果 start 变了，可能需要迁移到新月份
        new_month_key = get_month_key(event["start"])
        if new_month_key != old_month_key:
            # 从旧月份移除
            month_events[:] = [e for e in month_events if e.get("id") != params.event_id]
            await write_month_events(project_path, old_month_key, month_events)
            # 写入新月份
            new_month_events = await read_month_events(project_path, new_month_key)
            new_month_events.append(event)
            await write_month_events(project_path, new_month_key, new_month_events)
            # 同步索引（旧月可能被清空删除，新月可能是新文件）
            await sync_event_files_index(project_path, meta)
        else:
            await write_month_events(project_path, old_month_key, month_events)

        meta["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        await write_calendar_meta(project_path, meta)

        return ToolResult(
            content=f"Updated event '{params.event_id}': {', '.join(updated_fields)}",
            data={"event": event, "updated_fields": updated_fields},
        )

    async def _delete_event(self, params: ManageCalendarParams) -> ToolResult:
        if not params.event_id:
            return ToolResult.error("event_id is required for delete_event")

        project_path = self.resolve_path(params.project_path)
        meta = await read_calendar_meta(project_path)

        # 跨月查找事件
        result = await find_event_by_id(project_path, meta, params.event_id)
        if result is None:
            return ToolResult.error(f"Event '{params.event_id}' not found")
        month_key, month_events, _ = result

        # 从月份文件中移除
        month_events[:] = [e for e in month_events if e.get("id") != params.event_id]
        await write_month_events(project_path, month_key, month_events)

        # 同步索引（空月份文件会被自动删除）
        meta["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        await sync_event_files_index(project_path, meta)
        await write_calendar_meta(project_path, meta)

        return ToolResult(content=f"Deleted event '{params.event_id}'")

    async def _add_category(self, params: ManageCalendarParams) -> ToolResult:
        if not params.category_id:
            return ToolResult.error("category_id is required for add_category")
        if not params.category_name:
            return ToolResult.error("category_name is required for add_category")
        if not params.category_color:
            return ToolResult.error("category_color is required for add_category")

        project_path = self.resolve_path(params.project_path)
        meta = await read_calendar_meta(project_path)
        categories: List[Dict] = meta.setdefault("categories", [])

        # 检查重复
        if any(c.get("id") == params.category_id for c in categories):
            return ToolResult.error(f"Category '{params.category_id}' already exists")

        new_category = {
            "id": params.category_id,
            "name": params.category_name,
            "color": params.category_color,
        }
        categories.append(new_category)
        meta["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        await write_calendar_meta(project_path, meta)

        return ToolResult(
            content=f"Added category '{params.category_name}' ({params.category_id})",
            data={"category": new_category},
        )

    async def _list_categories(self, params: ManageCalendarParams) -> ToolResult:
        project_path = self.resolve_path(params.project_path)
        meta = await read_calendar_meta(project_path)
        categories: List[Dict] = meta.get("categories", [])

        if not categories:
            return ToolResult(content="No categories defined.", data={"categories": []})

        lines = [f"{len(categories)} category(ies):"]
        for c in categories:
            lines.append(f"  {c['id']}: {c['name']} ({c.get('color', '')})")

        return ToolResult(
            content="\n".join(lines),
            data={"categories": categories},
        )

    # ── 展示层 ────────────────────────────────────────────────────────────────

    async def get_before_tool_call_friendly_content(
        self, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> str:
        action = (arguments or {}).get("action", "")
        return i18n.translate(f"manage_calendar.{action}", category="tool.messages") if action else ""

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        action = (arguments or {}).get("action", "")
        base_action = i18n.translate("manage_calendar", category="tool.actions")

        if not result.ok:
            return {
                "action": base_action,
                "remark": i18n.translate(
                    "manage_calendar.error", category="tool.messages", error=result.content
                ),
            }

        event_id = (arguments or {}).get("event_id", "")
        title = (arguments or {}).get("title", "")
        display_name = title or event_id

        remark_map = {
            "add_event": i18n.translate(
                "manage_calendar.event_added", category="tool.messages", title=title
            ),
            "list_events": i18n.translate(
                "manage_calendar.events_listed", category="tool.messages"
            ),
            "update_event": i18n.translate(
                "manage_calendar.event_updated", category="tool.messages", event_id=event_id
            ),
            "delete_event": i18n.translate(
                "manage_calendar.event_deleted", category="tool.messages", event_id=event_id
            ),
            "add_category": i18n.translate(
                "manage_calendar.category_added", category="tool.messages",
                name=(arguments or {}).get("category_name", ""),
            ),
            "list_categories": i18n.translate(
                "manage_calendar.categories_listed", category="tool.messages"
            ),
        }
        remark = remark_map.get(action, base_action)
        return {"action": base_action, "remark": remark}


# ── 辅助函数 ──────────────────────────────────────────────────────────────────


def _calculate_default_end(start: str, is_all_day: bool) -> str:
    """根据 start 和 all_day 推算默认 end。"""
    if is_all_day:
        # 全天日程，end 就是当天（与 start 相同的日期）
        return start[:10]

    # 非全天日程，默认 start + 1 小时
    try:
        dt = datetime.strptime(start.strip(), "%Y-%m-%d %H:%M")
        end_dt = dt + timedelta(hours=1)
        return end_dt.strftime("%Y-%m-%d %H:%M")
    except ValueError:
        # 格式解析失败时直接返回 start
        return start


def _status_mark(status: str) -> str:
    """返回日程状态的显示标记。"""
    marks = {
        "confirmed": "●",
        "tentative": "○",
        "cancelled": "✗",
        "completed": "✓",
    }
    return marks.get(status, "●")
