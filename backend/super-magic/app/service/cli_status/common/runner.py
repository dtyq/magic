"""短时 CLI 探测命令的默认执行器。"""
from __future__ import annotations

import asyncio
import time
from typing import Sequence

from agentlang.logger import get_logger
from app.service.cli_status.common.interfaces import CliCommandResult

logger = get_logger(__name__)

CLI_STATUS_COMMAND_TIMEOUT_SECONDS = 1.0


async def run_cli_command(argv: Sequence[str], timeout: float) -> CliCommandResult:
    """执行只读 CLI 命令，并把异常统一降级成可解析状态。

    命令超时时会 kill 子进程并标记 timed_out；命令不存在返回 127；其他异常返回 -1。
    上层 provider 只根据状态做摘要，不让探测失败阻断主链路。
    """
    start = time.monotonic()
    try:
        proc = await asyncio.create_subprocess_exec(
            *argv,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            # 探测命令必须短时结束，避免 init 后台任务长期占用资源。
            try:
                proc.kill()
            except ProcessLookupError:
                pass
            await proc.wait()
            return CliCommandResult(
                tuple(argv),
                exit_code=-1,
                timed_out=True,
                elapsed_seconds=time.monotonic() - start,
            )

        return CliCommandResult(
            tuple(argv),
            exit_code=proc.returncode if proc.returncode is not None else -1,
            stdout=stdout_bytes.decode("utf-8", errors="replace"),
            stderr=stderr_bytes.decode("utf-8", errors="replace"),
            elapsed_seconds=time.monotonic() - start,
        )
    except FileNotFoundError:
        return CliCommandResult(tuple(argv), exit_code=127, elapsed_seconds=time.monotonic() - start)
    except Exception as exc:
        logger.debug(f"[CliStatusRunner] command failed: argv={tuple(argv)} error={exc}")
        return CliCommandResult(tuple(argv), exit_code=-1, elapsed_seconds=time.monotonic() - start)
