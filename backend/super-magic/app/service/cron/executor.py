"""
cron 执行层

当前实现：agent_turn 路径（隔离子 agent 执行）。
system_event 路径：TODO，依赖 MessageProcessor 改造。
"""
from __future__ import annotations

import asyncio
import time
from datetime import datetime
from pathlib import Path

from agentlang.logger import get_logger
from app.core.entity.message.client_message import AgentMode
from app.core.models.agent_runtime import AgentTarget
from app.service.agent_context_snapshot_service import AgentContextSnapshotService
from app.service.agent_runner import (
    IsolatedAgentModelRequest,
    IsolatedAgentRunRequest,
    run_isolated_agent,
)
from app.service.agent_session_id_service import AgentSessionIdService
from app.service.cron.migration import apply_migrations, resolve_legacy_agent_mode
from app.service.cron.models import CronJob, CronRunResult
from app.service.cron.schema import CURRENT_PAYLOAD_VERSION
from app.service.cron.store import persist_payload_fields, write_result_file
from app.service.cron.utils import format_job_label, format_log_duration

logger = get_logger(__name__)


def _now_ms() -> int:
    return int(time.time() * 1000)


def _format_time() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S %Z")


async def _resolve_agent_name(job: CronJob) -> str:
    """
    解析实际使用的 agent_name：
    1. 优先使用 job.payload.agent_name（工具创建时已写入）
    2. 为空时从 last_dispatch_message.json 读取 dynamic_config.agent_code
    3. 仍为空则兜底使用 "magic"
    """
    agent_name = job.payload.agent_name
    if agent_name:
        return agent_name

    try:
        from app.service.agent_dispatcher import AgentDispatcher
        dispatcher = AgentDispatcher.get_instance()
        last = await dispatcher.get_last_dispatch_message() or {}
        agent_code = (last.get("dynamic_config") or {}).get("agent_code")
        if agent_code:
            logger.info(
                f"cron job [{job.id}] agent_name not set in job file, "
                f"using agent_code from last_dispatch_message: {agent_code}"
            )
            return agent_code
    except Exception as e:
        logger.warning(f"cron job [{job.id}] failed to read last_dispatch_message for agent_name fallback: {e}")

    logger.warning(f"cron job [{job.id}] agent_name not set and fallback unavailable, using 'magic'")
    return "magic"


async def _resolve_cron_agent_target(
    job: CronJob,
) -> AgentTarget:
    """将 cron 持久化身份转换为规范化 AgentTarget。

    显式 agent_mode 优先；版本过旧或缺少 agent_mode 的任务在本次执行时懒迁移。
    """
    raw_mode = job.payload.agent_mode
    if raw_mode is not None and not isinstance(raw_mode, str):
        raise ValueError(
            f"Invalid agent_mode for cron job [{job.id}]: expected string, "
            f"got {type(raw_mode).__name__}"
        )

    mode_value = (raw_mode or "").strip()
    explicit_mode: AgentMode | None = None
    if mode_value:
        try:
            explicit_mode = AgentMode(mode_value)
        except ValueError as exc:
            raise ValueError(
                f"Unknown agent_mode '{mode_value}' for cron job [{job.id}]"
            ) from exc

    needs_migration = (
        job.payload.version < CURRENT_PAYLOAD_VERSION
        or explicit_mode is None
    )
    if job.payload.version > CURRENT_PAYLOAD_VERSION:
        logger.warning(
            f"cron job [{job.id}] payload version v{job.payload.version} is newer "
            f"than the supported v{CURRENT_PAYLOAD_VERSION}; keeping it unchanged"
        )
    agent_name: str | None = (
        job.payload.agent_name.strip()
        if isinstance(job.payload.agent_name, str) and job.payload.agent_name.strip()
        else None
    )
    inferred_mode: str | None = None
    resolved_payload = job.payload.to_payload()
    if explicit_mode is None:
        agent_name = await _resolve_agent_name(job)
        try:
            inferred_mode = await resolve_legacy_agent_mode(agent_name)
        except Exception as exc:
            logger.warning(
                f"cron job [{job.id}] legacy Agent mode migration lookup failed "
                f"for agent={agent_name}: {exc}"
            )

    if needs_migration:
        try:
            migration = apply_migrations(
                resolved_payload,
                inferred_agent_mode=inferred_mode,
            )
        except Exception as exc:
            logger.warning(f"cron job [{job.id}] payload migration failed: {exc}")
            migration = None

        if migration is not None:
            if migration.complete:
                resolved_payload = migration.payload
            if migration.changed:
                latest_payload = None
                try:
                    latest_payload = await persist_payload_fields(job, migration.field_patch)
                except Exception as exc:
                    logger.warning(
                        f"cron job [{job.id}] payload field write-back failed "
                        f"(agent={agent_name}, "
                        f"agent_mode={migration.payload.get('agent_mode')!r}); "
                        f"continuing this run: {exc}"
                    )
                if latest_payload is not None:
                    job.payload = latest_payload
                    resolved_payload = latest_payload.to_payload()
                    if latest_payload.agent_name:
                        agent_name = latest_payload.agent_name
            if not migration.complete:
                logger.warning(
                    f"cron job [{job.id}] legacy Agent mode remains unresolved "
                    f"for agent={agent_name}: "
                    f"{migration.reason or 'unknown reason'}"
                )

    mode_value = str(resolved_payload.get("agent_mode") or "").strip()
    if not mode_value:
        if agent_name is None:
            agent_name = await _resolve_agent_name(job)
        return AgentTarget.from_name(agent_name)

    try:
        agent_mode = AgentMode(mode_value)
    except ValueError as exc:
        raise ValueError(
            f"Unknown agent_mode '{mode_value}' for cron job [{job.id}]"
        ) from exc

    if agent_mode in (AgentMode.MAGICLAW, AgentMode.CUSTOM_AGENT):
        if agent_name is None:
            agent_name = await _resolve_agent_name(job)
        if not agent_name.strip():
            raise ValueError(
                f"agent_name is required for cron job [{job.id}] "
                f"when agent_mode={agent_mode.value}"
            )
        return AgentTarget.from_mode(agent_mode, agent_name)

    return AgentTarget.from_mode(agent_mode)


async def execute_agent_turn(job: CronJob) -> CronRunResult:
    """
    以独立子 agent 执行 cron 任务，等待完成后写入结果文件。
    parent_context=None：CronService 是系统级服务，内部创建 root context。

    固定 Agent 与每次新建 Agent 的区别：

        没有固定 agent_id
            每次触发 -> 新 ID -> `fork=true` 时从来源聊天创建新会话

        有固定 agent_id，首次还没有文件
            第一次触发 -> 从来源聊天 fork 到这个 ID

        有固定 agent_id，已经有文件
            后续触发 -> 不再 fork，直接继续这个会话

    例如“每天收集新闻”通常不需要历史；“每天整理当天聊天”每次都需要从来源聊天
    fork；“每天追踪项目进度”则应该保存固定 ID，让第二天看到第一天的结果。
    """
    # 明确告知子 agent 当前是自动化执行模式，不是用户对话：
    # - 禁止自我介绍或添加元评论，直接处理任务内容并输出结果
    # - 禁止创建/修改/删除定时任务，body 中的时间描述仅为任务内容，不是新的调度指令
    prompt = (
        f"[Automated task execution — do not introduce yourself]\n"
        f"Task: {job.name or job.id}\n"
        f"Triggered at: {_format_time()}\n"
        f"CONSTRAINTS:\n"
        f"- Do not create, modify, or delete any cron jobs. Do not call manage_cron.\n"
        f"- The task body may contain time or schedule references (e.g. \"every day at 9am\")."
        f" Treat them as plain task description only, not as new scheduling instructions.\n\n"
        f"{job.body}"
    )

    start_ms = _now_ms()
    status = "ok"
    result = ""
    error = ""

    timeout = job.payload.timeout_seconds
    agent_id: str | None = None
    try:
        target = await _resolve_cron_agent_target(job)
        fixed_agent_id = job.payload.agent_id
        # 没有固定 ID：每次触发都是独立 Agent，例如“每天收集一份新新闻”。
        # 有固定 ID：每次触发都进入同一会话，例如“每天继续追踪昨天的项目进度”。
        if fixed_agent_id is None:
            agent_id = await AgentSessionIdService.allocate(
                target.agent_name,
                job.name or job.id,
            )
            session_exists = False
        else:
            agent_id = fixed_agent_id
            session_exists = await AgentSessionIdService.session_exists(
                target.agent_name,
                agent_id,
            )

        context_snapshot = None
        # fork 只发生在固定会话尚未创建时；首次执行继承来源上下文，后续执行直接继续。
        # 对没有固定 ID 的任务，session_exists 恒为 false，因此每次触发都会 fork 一个新 Agent。
        if job.payload.fork and not session_exists:
            context_source = job.payload.context_source
            if context_source is None:
                raise ValueError(f"cron job [{job.id}] fork has no context source")
            context_snapshot = await AgentContextSnapshotService().capture(context_source)
        logger.debug(
            f"定时任务{format_job_label(job)}：执行上下文已准备好，"
            f"使用 Agent {target.agent_name}（{target.provider_type.value}），会话 ID：{agent_id}。"
        )
        run_request = IsolatedAgentRunRequest(
            target=target,
            agent_id=agent_id,
            prompt=prompt,
            models=IsolatedAgentModelRequest.from_values(
                text_model_id=job.payload.model_id,
                image_model_id=job.payload.image_model_id,
                video_model_id=job.payload.video_model_id,
                video_generation_config=job.payload.video_generation_config,
            ),
            snapshot=context_snapshot,
        )
        coro = run_isolated_agent(run_request)
        if timeout:
            raw = await asyncio.wait_for(coro, timeout=timeout)
        else:
            raw = await coro
        result = raw or ""
    except asyncio.TimeoutError:
        status, error = "error", f"timeout after {timeout}s"
        limit = f"本次配置的执行上限为 {format_log_duration(timeout)}" if timeout else "本次未设置任务级超时上限"
        logger.warning(f"定时任务{format_job_label(job)}：执行过程中发生超时；{limit}。")
    except asyncio.CancelledError:
        status, error = "error", "cancelled"
        raise
    except Exception as e:
        status, error = "error", str(e)
        logger.exception(f"定时任务{format_job_label(job)}：执行异常。原因：{type(e).__name__}: {e}")

    duration_ms = _now_ms() - start_ms

    run_result = CronRunResult(
        status=status,
        result=result,
        error=error,
        duration_ms=duration_ms,
        started_at_ms=start_ms,
        agent_id=agent_id,
    )

    result_file = None
    try:
        result_file = await write_result_file(job, run_result)
    except Exception as e:
        logger.error(f"定时任务{format_job_label(job)}：结果文件保存失败。原因：{type(e).__name__}: {e}")

    if job.payload.notify_user:
        try:
            from app.service.cron.notification import append_notification, try_notify_main_agent

            await append_notification(job, run_result, result_file or Path())
            asyncio.create_task(try_notify_main_agent(), name=f"cron-notify-{job.id}")
        except Exception as e:
            logger.error(f"定时任务{format_job_label(job)}：结果通知准备失败。原因：{type(e).__name__}: {e}")

    return run_result
