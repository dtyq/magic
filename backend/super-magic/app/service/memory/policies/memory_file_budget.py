"""记忆主文件的 Token 预算与只读计数，不包含记忆维护指令。"""

import asyncio
import codecs
import stat
from contextlib import aclosing
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path

from agentlang.config.config import config
from agentlang.logger import get_logger
from agentlang.utils.token_estimator import TokenEstimateCounter
from app.utils.async_file_utils import async_fresh_stat, async_read_bytes_iter, async_stat

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class MemoryMdBudget:
    """
    每份全局／项目／Claw 主文件单独使用预算；target 是整理目标，max 才决定是否超限。
    MOCK DEMO：target=10,000、max=16,000；15,000 只做相关增量，16,000 仍未超限，
    16,001 才请求语义整理。不是把文件切到指定长度，也不能把两份文件的 Token 相加判断。
    """
    target_tokens: int
    max_tokens: int

    def __post_init__(self) -> None:
        if not 0 < self.target_tokens < self.max_tokens:
            raise ValueError("Memory budgets must satisfy 0 < target_tokens < max_tokens")

    @classmethod
    def from_config(cls) -> "MemoryMdBudget":
        values: list[int] = []
        for key in ("target_tokens", "max_tokens"):
            raw = config.get(f"memory.memory_md.{key}")
            if isinstance(raw, bool) or not isinstance(raw, (str, int)) or not str(raw).isdecimal():
                raise ValueError(f"memory.memory_md.{key} must be a positive integer")
            values.append(int(raw))
        return cls(target_tokens=values[0], max_tokens=values[1])

    def is_over_budget(self, estimated_tokens: int) -> bool:
        return estimated_tokens > self.max_tokens


class MemoryFileReadStatus(StrEnum):
    OK = "ok"
    MISSING = "missing"
    NOT_FILE = "not_file"
    UNREADABLE = "unreadable"
    INVALID_UTF8 = "invalid_utf8"
    UNSTABLE = "unstable"
    INVALID_PATH = "invalid_path"
    OUTSIDE_SCOPE = "outside_scope"


@dataclass(frozen=True, slots=True)
class MemoryFileTokenUsage:
    """
    MISSING 表示尚未建文件；UNREADABLE/UNSTABLE 表示本次不知道用量，均不能写成 0。
    例：真正的空文件可报告 0 Token；读取失败的旧文件不能被当成空文件直接覆盖。
    """
    path: Path
    status: MemoryFileReadStatus
    estimated_tokens: int | None
    error: str = ""
    size_bytes: int | None = None


def get_memory_md_budget() -> MemoryMdBudget | None:
    try:
        return MemoryMdBudget.from_config()
    except (TypeError, ValueError) as error:
        logger.error(f"记忆 Token 预算无效，跳过依赖预算的自动操作: {error}")
        return None


async def inspect_memory_file(
    path: Path, interruption_event: asyncio.Event | None = None,
) -> MemoryFileTokenUsage:
    """
    真正需要计数时才读取全文；它与 Horizon 的周期文件变化探测承担不同成本。
    MOCK DEMO：用户要求核实某 MEMORY.md 用量 -> 分块解码累计 -> 返回计数；正文不入上下文。
    中断同时取消计数任务和等待任务，不能让取消后的文件扫描继续占用 I/O。
    None 表示数值不可用，不是 0；调用方不能把读失败当空文件并据此覆盖记忆。
    """
    if interruption_event is None:
        return await _count_memory_file(path)
    if interruption_event.is_set():
        raise asyncio.CancelledError()
    work = asyncio.create_task(_count_memory_file(path))
    interrupt = asyncio.create_task(interruption_event.wait())
    try:
        await asyncio.wait((work, interrupt), return_when=asyncio.FIRST_COMPLETED)
        if interruption_event.is_set():
            raise asyncio.CancelledError()
        return await work
    finally:
        for task in (work, interrupt):
            if not task.done():
                task.cancel()
        await asyncio.gather(work, interrupt, return_exceptions=True)


async def _count_memory_file(path: Path) -> MemoryFileTokenUsage:
    """
    数据流：原始字节块 -> 增量 UTF-8 解码 -> 累计字符 -> 统一取整得到 Token 估算。
    一个中文字符的字节可能落在两块中，decoder 会等待后半段，不把它当成损坏文本。
    这里为测量而读完整个文件，降低的是峰值内存；Horizon 日常大文件探测仍使用 mtime。
    """
    try:
        if not stat.S_ISREG((await async_stat(path)).st_mode):
            return MemoryFileTokenUsage(path, MemoryFileReadStatus.NOT_FILE, None)
        before = await async_fresh_stat(path)
        if not stat.S_ISREG(before.st_mode):
            return MemoryFileTokenUsage(path, MemoryFileReadStatus.NOT_FILE, None)
        counter = TokenEstimateCounter()
        decoder = codecs.getincrementaldecoder("utf-8")()
        size_bytes = 0
        async with aclosing(async_read_bytes_iter(path)) as chunks:
            async for chunk in chunks:
                size_bytes += len(chunk)
                counter.add_text(decoder.decode(chunk))
                await asyncio.sleep(0)
        counter.add_text(decoder.decode(b"", final=True))
        after = await async_fresh_stat(path)
        """
        元数据只能证明此次观察可用；发生替换或写入时不发布混合版本的计数。
        例：统计一半时另一任务追加内容，前半份旧文件加后半份新文件不能称作某个版本的用量。
        本次返回不可用，由调用方说明事实；不在计数器内反复读取或替用户发起整理。
        """
        if size_bytes != after.st_size or any(
            left != right for left, right in (
                (before.st_dev, after.st_dev), (before.st_ino, after.st_ino),
                (before.st_size, after.st_size), (before.st_mtime_ns, after.st_mtime_ns),
                (before.st_ctime_ns, after.st_ctime_ns),
            )
        ):
            return MemoryFileTokenUsage(path, MemoryFileReadStatus.UNSTABLE, None)
        return MemoryFileTokenUsage(path, MemoryFileReadStatus.OK, counter.estimated_tokens, size_bytes=size_bytes)
    except FileNotFoundError:
        return MemoryFileTokenUsage(path, MemoryFileReadStatus.MISSING, None)
    except IsADirectoryError:
        return MemoryFileTokenUsage(path, MemoryFileReadStatus.NOT_FILE, None)
    except UnicodeError as error:
        return MemoryFileTokenUsage(path, MemoryFileReadStatus.INVALID_UTF8, None, type(error).__name__)
    except OSError as error:
        logger.warning(f"记忆文件计数失败: {path}: {error}")
        return MemoryFileTokenUsage(path, MemoryFileReadStatus.UNREADABLE, None, type(error).__name__)
