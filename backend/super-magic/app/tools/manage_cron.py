"""
manage_cron: cron 定时任务管理工具

每个任务以 Markdown 文件存储（.workspace/.magic/cron/{job_id}.md），
frontmatter 定义调度参数，正文是任务内容/提示词。
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Literal, Optional

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n
from app.path_manager import PathManager
from app.service.cron.store import build_job_md, patch_job_md
from app.service.cron.utils import ms_to_iso, name_to_job_id
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool
from app.utils.async_file_utils import (
    async_exists,
    async_mkdir,
    async_read_text,
    async_scandir,
    async_try_read_markdown,
    async_unlink,
    async_write_text,
)

logger = get_logger(__name__)

# runs 最多展示的结果条数
_RUNS_LIMIT = 20


class ManageCronParams(BaseToolParams):
    action: Literal["status", "list", "add", "update", "remove", "run", "runs"] = Field(
        ...,
        description="""<!--zh: 操作类型及各自必填参数：
- status: 无需额外参数
- list: 可选 include_disabled
- add: 必填 name / schedule / message，可选 payload_kind / timeout_seconds / enabled / notify_main_agent
- update: 必填 job_id，其余字段按需传，省略则保持原值
- remove: 必填 job_id
- run: 必填 job_id（立即触发，忽略调度时间）
- runs: 必填 job_id（查看执行历史）
-->
Action to perform. Per-action required fields:
- status: no extra params
- list: optional include_disabled
- add: name + schedule + message required; payload_kind/timeout_seconds/enabled/notify_main_agent optional
- update: job_id required; any other field optional (omitted fields keep current value)
- remove: job_id required
- run: job_id required (triggers immediately, ignores schedule)
- runs: job_id required (view execution history)"""
    )
    job_id: Optional[str] = Field(
        None,
        description="""<!--zh: 任务 ID，即文件名（无需 .md 后缀）。update/remove/run/runs 时必填。-->
Job ID (filename without .md). Required for update/remove/run/runs."""
    )
    name: Optional[str] = Field(
        None,
        description="""<!--zh: add 时用于生成文件名的任务名称。必填于 add。
kind=at 的一次性任务必须在名称中包含触发时间，例如 "remind me to review PR at 2026-03-27 14:00"，
这样生成的 job_id 才能唯一标识该任务，避免同名覆盖。-->
Human-readable name used to derive the job ID. Required for add.
For kind=at one-shot jobs, the name must include the trigger time so the job ID is unique and self-describing,
e.g. "remind me to review PR at 2026-03-27 14:00" → remind-me-to-review-pr-at-2026-03-27-1400.md."""
    )
    schedule: Optional[Dict[str, Any]] = Field(
        None,
        description="""<!--zh: 调度配置，add/update 时使用。三种类型：
- cron 表达式（最小粒度分钟）：{"kind":"cron","expr":"0 9 * * 1-5","tz":"Asia/Shanghai"}
- 固定间隔（every_ms 为毫秒，3600000=1h，86400000=1d）：{"kind":"every","every_ms":3600000}
- 一次性指定时间：{"kind":"at","at":"2024-12-31T18:00:00+08:00"}
cron 和 every 类型可加 end_at（ISO 8601）；达到该时间后任务自动禁用：
  {"kind":"cron","expr":"0 9 * * 1-5","tz":"Asia/Shanghai","end_at":"2026-12-31T23:59:59+08:00"}
-->
Schedule config. Required for add; optional for update (omit to keep unchanged).
  {"kind":"cron",  "expr":"<5-field>", "tz":"<IANA>"}       cron expr, minute-level minimum
  {"kind":"every", "every_ms":<ms>}                          fixed interval (3600000=1h, 86400000=1d)
  {"kind":"at",    "at":"<ISO-8601>"}                        one-shot at specific time
For cron/every, optional end_at (ISO-8601) stops the job after that time:
  {"kind":"every", "every_ms":3600000, "end_at":"2026-12-31T23:59:59+08:00"}"""
    )
    payload_kind: Optional[str] = Field(
        None,
        description="""<!--zh: 执行类型，默认 agent_turn（当前唯一可用值）-->
Payload kind. Only "agent_turn" is currently supported (default)."""
    )
    message: Optional[str] = Field(
        None,
        description="""<!--zh: 任务正文（Markdown），agent_turn 时是发给 agent 的完整 prompt。add 时必填。-->
Task body (Markdown). For agent_turn this is the full prompt sent to the agent. Required for add."""
    )
    enabled: Optional[bool] = Field(
        None,
        description="""<!--zh: 是否启用任务。add 时默认 true；update 时可用于启用/禁用任务。-->
Whether the job is enabled. Defaults to true for add. Use in update to enable/disable."""
    )
    timeout_seconds: Optional[int] = Field(
        None,
        description="""<!--zh: 可选，单次执行超时时间（秒），不传或 null 表示不限-->
Optional per-run timeout in seconds. Omit or null for no timeout."""
    )
    include_disabled: Optional[bool] = Field(
        None,
        description="""<!--zh: list 时是否包含已禁用的任务，默认只列出启用的-->
For list: include disabled jobs. Defaults to false (only enabled jobs shown)."""
    )
    notify_main_agent: Optional[bool] = Field(
        None,
        description="""<!--zh: 任务完成后是否通知主 agent。默认 true（即默认通知）。仅对不需要告知用户结果的后台周期性任务显式设为 false。-->
Whether to notify the main agent when this job completes. Defaults to true. Set to false only for silent background jobs whose results do not need to be reported to the user."""
    )

    @field_validator("schedule", mode="before")
    @classmethod
    def parse_schedule(cls, v):
        """兼容模型将 schedule 序列化为 JSON 字符串的情况"""
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, dict):
                    return parsed
                raise ValueError(
                    f"schedule must be a JSON object, got {type(parsed).__name__}: {parsed!r}"
                )
            except json.JSONDecodeError as e:
                raise ValueError(f"schedule is not valid JSON: {e}") from e
        return v


@tool()
class ManageCron(BaseTool[ManageCronParams]):
    """<!--zh
管理定时 cron 任务。每个任务存储为 .workspace/.magic/cron/ 下的 Markdown 文件。

何时使用 — 遇到以下情况应立即调用此工具，不能只回复文字：
- 用户说"在某个时间提醒我"或"某件事前提醒我"   → add，kind=at
- 用户说"每天/每周/每小时提醒我"               → add，kind=cron 或 kind=every
- 用户想设置任何周期性或一次性定时任务          → add
- 用户问"我有哪些提醒/定时任务"                → list
- 用户想取消或删除某个提醒                      → remove
- 用户想暂时停用某个提醒                        → update，enabled=false
- 用户询问某个提醒是否已触发或想查看执行历史    → runs

快速参考：
  status                                   → 调度器状态 + 各任务摘要
  list   [include_disabled]                → 列出任务
  add    name schedule message [opts]      → 创建任务
  update job_id [schedule] [message] [..] → 更新任务（省略的字段保持原值）
  remove job_id                            → 删除任务文件
  run    job_id                            → 立即触发（忽略调度时间）
  runs   job_id                            → 执行历史（含状态和耗时）

调度类型：
  {"kind":"cron",  "expr":"0 9 * * 1-5", "tz":"Asia/Shanghai"}   cron 表达式
  {"kind":"every", "every_ms":3600000}                            固定间隔（毫秒）
  {"kind":"at",    "at":"2024-12-31T09:00:00+08:00"}             一次性指定时间

重要约束：
- 最小调度粒度为 1 分钟，every_ms < 60000 会被调度器忽略。
- payload_kind 目前只支持 "agent_turn"。
- job_id 在创建时由 name 派生，不能通过 update 修改。
- 修改调度/内容/启用状态用 update；重命名任务用 remove + add。
- notify_main_agent 默认 true（默认通知）；仅对不需要告知用户结果的后台任务显式设为 false。
-->
Manage scheduled cron jobs. Each job is stored as a Markdown file under .workspace/.magic/cron/.

WHEN TO USE — call this tool immediately (do not just reply with text):
- User says "remind me at [time]" or "remind me before [event]" → add, kind=at
- User says "remind me every day/week/hour"                     → add, kind=cron or kind=every
- User wants to set up any recurring or one-shot scheduled task → add
- User asks "what reminders/tasks do I have scheduled"         → list
- User wants to cancel or delete a reminder                    → remove
- User wants to temporarily pause a reminder                   → update, enabled=false
- User asks whether a reminder fired or wants to see history   → runs

QUICK REFERENCE:
  status                                   → scheduler status + per-job summary
  list   [include_disabled]                → list jobs
  add    name schedule message [opts]      → create job
  update job_id [schedule] [message] [..] → patch job (omitted fields unchanged)
  remove job_id                            → delete job file
  run    job_id                            → trigger immediately (ignore schedule)
  runs   job_id                            → execution history with status/duration

SCHEDULE TYPES:
  {"kind":"cron",  "expr":"0 9 * * 1-5", "tz":"Asia/Shanghai"}   cron expression
  {"kind":"every", "every_ms":3600000}                            interval (ms)
  {"kind":"at",    "at":"2024-12-31T09:00:00+08:00"}             one-shot
For cron/every, add end_at (ISO-8601) to auto-disable after that time:
  {"kind":"every", "every_ms":3600000, "end_at":"2026-12-31T23:59:59+08:00"}

CRITICAL CONSTRAINTS:
- Minimum scheduling unit is 1 minute (every_ms < 60000 is ignored by scheduler).
- payload_kind only supports "agent_turn" currently.
- job_id is derived from name at creation time and cannot be changed via update.
- Use update to change schedule/message/enabled; use remove+add to rename a job.
- notify_main_agent defaults to true; set notify_main_agent=false only for silent background jobs whose results should not be reported to the user."""

    async def execute(self, tool_context: ToolContext, params: ManageCronParams) -> ToolResult:
        try:
            if params.action == "status":
                return await self._status()
            elif params.action == "list":
                return await self._list(params)
            elif params.action == "add":
                return await self._add(params, tool_context)
            elif params.action == "update":
                return await self._update(params)
            elif params.action == "remove":
                return await self._remove(params)
            elif params.action == "run":
                return await self._run_now(params)
            elif params.action == "runs":
                return await self._runs(params)
            else:
                return ToolResult.error(f"Unknown action: {params.action}")
        except Exception as e:
            logger.exception(f"manage_cron [{params.action}] failed: {e}")
            return ToolResult.error(str(e))

    # ── action 实现 ───────────────────────────────────────────────────────────

    async def _status(self) -> ToolResult:
        from app.service.cron.store import load_cron_state, scan_jobs
        cron_dir = PathManager.get_cron_dir()
        jobs = await scan_jobs({})
        state = await load_cron_state()
        lines = [f"Cron dir: {cron_dir}", f"Total jobs: {len(jobs)}"]
        for job in jobs:
            js = state.jobs.get(job.id)
            next_iso = ms_to_iso(js.next_run_at_ms) if js else "-"
            last_iso = ms_to_iso(js.last_run_at_ms) if js else "-"
            running = js.running_at_ms is not None if js else False
            last_status = js.last_status if js else "-"
            lines.append(
                f"  [{job.id}] enabled={job.enabled} running={running} "
                f"last_status={last_status} last_run={last_iso} next_run={next_iso}"
            )
        return ToolResult(content="\n".join(lines))

    async def _list(self, params: ManageCronParams) -> ToolResult:
        from app.service.cron.store import scan_jobs
        jobs = await scan_jobs({})
        include_disabled = bool(params.include_disabled)
        if not include_disabled:
            jobs = [j for j in jobs if j.enabled]
        if not jobs:
            hint = "" if include_disabled else " (use include_disabled=true to see disabled jobs)"
            return ToolResult(content=f"No cron jobs found{hint}.")
        lines = []
        for job in jobs:
            display = job.name or job.id
            lines.append(
                f"- {job.id} ({display}): enabled={job.enabled}, "
                f"schedule={job.schedule.kind}, payload={job.payload.kind}"
            )
        return ToolResult(content="\n".join(lines), data={
            "jobs": [
                {"id": j.id, "name": j.name, "enabled": j.enabled,
                 "schedule_kind": j.schedule.kind, "payload_kind": j.payload.kind}
                for j in jobs
            ]
        })

    async def _add(self, params: ManageCronParams, tool_context: ToolContext) -> ToolResult:
        if not params.name:
            return ToolResult.error("name is required for action=add")
        if not params.schedule:
            return ToolResult.error("schedule is required for action=add")
        if not params.message:
            return ToolResult.error("message is required for action=add")

        job_id = name_to_job_id(params.name)
        path = PathManager.get_cron_dir() / f"{job_id}.md"
        await async_mkdir(PathManager.get_cron_dir(), parents=True, exist_ok=True)
        if await async_exists(path):
            return ToolResult.error(
                f"Job '{job_id}' already exists. Use action=update to modify, or action=remove then action=add to replace."
            )

        agent_ctx = tool_context.get_extension("agent_context")

        model_id = None
        if agent_ctx and hasattr(agent_ctx, "get_real_model_id"):
            model_id = agent_ctx.get_real_model_id() or None

        image_model_id = None
        if agent_ctx and hasattr(agent_ctx, "get_dynamic_image_model_id"):
            image_model_id = agent_ctx.get_dynamic_image_model_id() or None

        user_timezone = None
        if agent_ctx and hasattr(agent_ctx, "get_user_timezone"):
            user_timezone = agent_ctx.get_user_timezone() or None

        # 继承当前 agent 的文件标识符（如 openclaw、magic），不暴露给 LLM 作为参数。
        # 必须用 agent_ctx.agent_name（文件标识符），不能用 get_agent_name()（返回展示名，如"龙虾"）。
        agent_name = "magic"
        if agent_ctx and hasattr(agent_ctx, "agent_name") and agent_ctx.agent_name:
            agent_name = agent_ctx.agent_name

        content = build_job_md(
            schedule=params.schedule,
            payload_kind=params.payload_kind or "agent_turn",
            agent_name=agent_name,
            model_id=model_id,
            image_model_id=image_model_id,
            timeout_seconds=params.timeout_seconds,
            enabled=True if params.enabled is None else params.enabled,
            name=params.name,
            body=params.message,
            timezone=user_timezone,
            notify_main_agent=True if params.notify_main_agent is None else params.notify_main_agent,
        )
        await async_write_text(path, content)
        return ToolResult(content=f"Created cron job '{job_id}' at {path}")

    async def _update(self, params: ManageCronParams) -> ToolResult:
        if not params.job_id:
            return ToolResult.error("job_id is required for action=update")
        path = PathManager.get_cron_dir() / f"{params.job_id}.md"
        if not await async_exists(path):
            return ToolResult.error(f"Job '{params.job_id}' not found")

        existing = await async_read_text(path)
        updated = patch_job_md(
            existing=existing,
            schedule=params.schedule,
            payload_kind=params.payload_kind,
            agent_name=None,  # agent_name 不允许通过 update 修改，创建时已绑定当前 agent
            model_id=None,
            image_model_id=None,
            timeout_seconds=params.timeout_seconds,
            enabled=params.enabled,
            body=params.message,
            notify_main_agent=params.notify_main_agent,
        )
        await async_write_text(path, updated)
        return ToolResult(content=f"Updated cron job '{params.job_id}'")

    async def _remove(self, params: ManageCronParams) -> ToolResult:
        if not params.job_id:
            return ToolResult.error("job_id is required for action=remove")
        path = PathManager.get_cron_dir() / f"{params.job_id}.md"
        if not await async_exists(path):
            return ToolResult.error(f"Job '{params.job_id}' not found")
        await async_unlink(path)
        return ToolResult(content=f"Removed cron job '{params.job_id}'")

    async def _run_now(self, params: ManageCronParams) -> ToolResult:
        if not params.job_id:
            return ToolResult.error("job_id is required for action=run")
        from app.service.cron.store import scan_jobs
        jobs = await scan_jobs({})
        job = next((j for j in jobs if j.id == params.job_id), None)
        if job is None:
            return ToolResult.error(f"Job '{params.job_id}' not found or has parse errors")

        import asyncio
        from app.service.cron.executor import execute_agent_turn
        asyncio.create_task(execute_agent_turn(job), name=f"cron-manual-{job.id}")
        return ToolResult(
            content=f"Triggered job '{params.job_id}' immediately. "
                    f"Check results with action=runs job_id={params.job_id}."
        )

    async def _runs(self, params: ManageCronParams) -> ToolResult:
        if not params.job_id:
            return ToolResult.error("job_id is required for action=runs")
        result_dir = PathManager.get_cron_result_dir()
        if not await async_exists(result_dir):
            return ToolResult(content="No results yet.")

        entries = await async_scandir(result_dir)
        prefix = f"{params.job_id}-"
        names = sorted(
            [e.name for e in entries if e.name.startswith(prefix) and e.name.endswith(".md")],
            reverse=True,
        )[:_RUNS_LIMIT]

        if not names:
            return ToolResult(content=f"No result files found for job '{params.job_id}'.")

        records: List[Dict[str, Any]] = []
        lines: List[str] = []
        for name in names:
            path = result_dir / name
            md = await async_try_read_markdown(path)
            meta = (md.meta or {}) if md else {}
            run_at = meta.get("run_at", "-")
            status = meta.get("status", "-")
            duration_ms = meta.get("duration_ms", "-")
            lines.append(f"- {name}: status={status} duration={duration_ms}ms run_at={run_at}")
            records.append({
                "file": str(path),
                "run_at": run_at,
                "status": status,
                "duration_ms": duration_ms,
            })

        return ToolResult(
            content="\n".join(lines),
            data={"job_id": params.job_id, "runs": records},
        )

    # ── 展示层 ────────────────────────────────────────────────────────────────

    async def get_before_tool_call_friendly_content(
        self, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> str:
        action = (arguments or {}).get("action", "")
        return i18n.translate(f"manage_cron.{action}", category="tool.messages") if action else ""

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        action = (arguments or {}).get("action", "")
        job_id = (arguments or {}).get("job_id", "") or (arguments or {}).get("name", "")

        base_action = i18n.translate("manage_cron", category="tool.actions")

        if not result.ok:
            return {
                "action": base_action,
                "remark": i18n.translate("manage_cron.error", category="tool.messages", error=result.content),
            }

        remark_map = {
            "status": i18n.translate("manage_cron.status", category="tool.messages"),
            "list": i18n.translate("manage_cron.list", category="tool.messages"),
            "add": i18n.translate("manage_cron.added", category="tool.messages", job_id=job_id),
            "update": i18n.translate("manage_cron.updated", category="tool.messages", job_id=job_id),
            "remove": i18n.translate("manage_cron.removed", category="tool.messages", job_id=job_id),
            "run": i18n.translate("manage_cron.triggered", category="tool.messages", job_id=job_id),
            "runs": i18n.translate("manage_cron.runs", category="tool.messages"),
        }
        remark = remark_map.get(action, base_action)
        return {"action": base_action, "remark": remark}

