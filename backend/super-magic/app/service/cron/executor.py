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
from typing import Optional

from agentlang.logger import get_logger
from app.paths import PathManager
from app.service.agent_runner import run_isolated_agent
from app.service.cron.models import CronJob, CronRunResult
from app.service.cron.store import write_result_file

logger = get_logger(__name__)


def _now_ms() -> int:
    return int(time.time() * 1000)


def _format_time() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S %Z")


async def execute_agent_turn(job: CronJob) -> CronRunResult:
    """
    以独立子 agent 执行 cron 任务，等待完成后写入结果文件。
    parent_context=None：CronService 是系统级服务，内部创建 root context。
    """
    agent_id = f"cron-{job.id}"
    prompt = (
        f"[Scheduled task: {job.name or job.id}]\n"
        f"Current time: {_format_time()}\n\n"
        f"{job.body}"
    )

    start_ms = _now_ms()
    status = "ok"
    result = ""
    error = ""

    timeout = job.payload.timeout_seconds
    try:
        coro = run_isolated_agent(
            agent_name=job.payload.agent_name,
            agent_id=agent_id,
            prompt=prompt,
            parent_context=None,
            model_id=job.payload.model_id,
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
    run_result = CronRunResult(
        status=status,
        result=result,
        error=error,
        duration_ms=duration_ms,
    )

    try:
        await write_result_file(job, run_result)
    except Exception as e:
        logger.error(f"cron: failed to write result file for [{job.id}]: {e}")

    # TODO: 通知主 agent（依赖 system_event / MessageProcessor 改造）

    return run_result
