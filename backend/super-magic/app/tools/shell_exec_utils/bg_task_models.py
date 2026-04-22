"""
后台 shell 任务的数据模型与常量配置。

所有后台任务状态仅在内存中维护（_tasks 字典），不做外部持久化。
Agent 重启后通过扫描日志文件目录 + 解析 header/footer 恢复只读元数据。
"""

import asyncio
from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path
from typing import Optional

# ── 常量配置 ──────────────────────────────────────────────────────────────────

# 同时运行的最大后台任务数
BG_MAX_CONCURRENT_TASKS: int = 10

# 单任务最长存活时间（秒），超过后 Reaper 协程强制 kill
BG_MAX_TASK_LIFETIME_SECS: int = 3600

# 单日志文件最大字节数（2MB）
BG_LOG_MAX_FILE_SIZE_BYTES: int = 2 * 1024 * 1024

# 截断时保留的头部字节数（512KB）
BG_LOG_HEAD_KEEP_BYTES: int = 512 * 1024

# 截断时保留的尾部字节数（512KB）
BG_LOG_TAIL_KEEP_BYTES: int = 512 * 1024

# 最多保留的日志文件数量
BG_LOG_MAX_FILE_COUNT: int = 50

# 交互式 Prompt 静默确认窗口（秒）：正则命中后，须持续此时长无新输出才最终确认
PROMPT_QUIET_SECS: int = 3

# 普通同步模式下的 Prompt 静默确认窗口（秒）：比后台模式更保守，减少误判
PROMPT_QUIET_SECS_SYNC: int = 5


# ── 枚举 ──────────────────────────────────────────────────────────────────────

class TaskStatus(StrEnum):
    """后台任务生命周期状态。"""
    RUNNING   = "running"
    COMPLETED = "completed"
    KILLED    = "killed"
    ERROR     = "error"


# ── 数据类 ────────────────────────────────────────────────────────────────────

@dataclass
class BackgroundTask:
    """
    单个后台 shell 任务的内存状态。

    task_id 同时用作日志文件名（{task_id}.log），是跨重启的唯一稳定标识。
    process 字段仅在当前进程生命周期内有效；Agent 重启后句柄丢失，置为 None。
    """

    # 唯一标识，UUID 格式，同时也是 log 文件名
    task_id: str

    # 原始命令字符串
    command: str

    # 命令执行时的工作目录
    cwd: str

    # 子进程 PID（注：重启后 PID 可能已被系统复用，仅供参考）
    pid: int

    # 当前任务状态
    status: TaskStatus

    # 进程退出码；RUNNING 状态下为 None
    exit_code: Optional[int] = None

    # 任务创建时间戳（Unix 时间戳，秒）
    created_at: float = field(default_factory=lambda: __import__("time").time())

    # 任务结束时间戳（Unix 时间戳，秒）；未结束时为 None
    finished_at: Optional[float] = None

    # 子进程句柄；Agent 重启后为 None（句柄已失效）
    process: Optional[asyncio.subprocess.Process] = None


# ── ProcessExecutor 流式模式的返回值 ──────────────────────────────────────────

@dataclass
class BackgroundStartResult:
    """
    ProcessExecutor.execute_command 在后台触发时的返回值。

    与 TerminalToolResult 区分使用：
    - 进程在 timeout 前正常结束 → TerminalToolResult
    - 超时转后台 / prompt 检测触发 → BackgroundStartResult

    调用方（shell_exec.py）收到此对象后，应：
    1. 调用 BackgroundProcessManager.register() 注册任务
    2. 根据 trigger 字段构建对模型友好的响应
    """

    # 子进程句柄（仍在运行，流式读取协程也仍在后台继续写日志）
    process: asyncio.subprocess.Process

    # 日志文件路径（即 bg_shell_dir/{task_id}.log）
    log_path: Path

    # 转后台时已写入日志文件的文本内容（快照）
    current_output: str

    # 触发原因："timeout"（超时）或 "prompt"（prompt 检测命中）
    trigger: str

    # 后台文件写入协程 Task（drain buf → 写日志），供监控任务等待写完再追加 footer
    file_writer_task: Optional[asyncio.Task] = None

    @property
    def task_id(self) -> str:
        """从日志文件名派生 task_id。"""
        return self.log_path.stem
