"""
cron 执行层

当前实现：agent_turn 路径（隔离子 agent 执行）。
system_event 路径：TODO，依赖 MessageProcessor 改造。
"""
from __future__ import annotations

import asyncio
import time
from datetime import datetime

from agentlang.logger import get_logger
from app.service.agent_runner import run_isolated_agent
from app.service.cron.models import CronJob, CronRunResult
from app.service.cron.store import write_result_file

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


async def execute_agent_turn(job: CronJob) -> CronRunResult:
    """
    以独立子 agent 执行 cron 任务，等待完成后写入结果文件。
    parent_context=None：CronService 是系统级服务，内部创建 root context。
    """
    agent_id = f"cron-{job.id}"
    # <!--zh
    # 明确告知子 agent 当前是自动化执行模式，不是用户对话：
    # - 禁止自我介绍或添加元评论
    # - 直接处理任务内容并输出结果
    # 这样可以避免子 agent 误以为在和用户聊天，输出自我介绍等无关内容。
    # -->
    # Explicitly set automated execution context so the sub-agent does not introduce
    # itself or add conversational meta-commentary — just execute and return a result.
    prompt = (
        f"[Automated task execution — do not introduce yourself]\n"
        f"Task: {job.name or job.id}\n"
        f"Triggered at: {_format_time()}\n\n"
        f"{job.body}"
    )

    start_ms = _now_ms()
    status = "ok"
    result = ""
    error = ""

    agent_name = await _resolve_agent_name(job)
    logger.info(f"cron job [{job.id}] starting (agent={agent_name})")

    timeout = job.payload.timeout_seconds
    try:
        coro = run_isolated_agent(
            agent_name=agent_name,
            agent_id=agent_id,
            prompt=prompt,
            parent_context=None,
            model_id=job.payload.model_id,
            image_model_id=job.payload.image_model_id,
        )
        if timeout:
            raw = await asyncio.wait_for(coro, timeout=timeout)
        else:
            raw = await coro
        result = raw or ""
    except asyncio.TimeoutError:
        status, error = "error", f"timeout after {timeout}s"
        logger.warning(f"cron job [{job.id}] timed out after {timeout}s")
    except asyncio.CancelledError:
        status, error = "error", "cancelled"
        logger.warning(f"cron job [{job.id}] was cancelled")
        raise
    except Exception as e:
        status, error = "error", str(e)
        logger.exception(f"cron job [{job.id}] failed")

    duration_ms = _now_ms() - start_ms
    if status == "ok":
        logger.info(f"cron job [{job.id}] completed in {duration_ms}ms")
    else:
        logger.warning(f"cron job [{job.id}] finished with status={status} error={error!r} duration={duration_ms}ms")

    run_result = CronRunResult(
        status=status,
        result=result,
        error=error,
        duration_ms=duration_ms,
        started_at_ms=start_ms,
    )

    result_file = None
    try:
        result_file = await write_result_file(job, run_result)
    except Exception as e:
        logger.error(f"cron: failed to write result file for [{job.id}]: {e}")

    if job.payload.notify_user:
        try:
            from app.service.cron.notification import append_notification, try_notify_main_agent
            from pathlib import Path
            await append_notification(job, run_result, result_file or Path())
            asyncio.create_task(try_notify_main_agent(), name=f"cron-notify-{job.id}")
        except Exception as e:
            logger.error(f"cron: failed to handle notification for [{job.id}]: {e}")

    return run_result
