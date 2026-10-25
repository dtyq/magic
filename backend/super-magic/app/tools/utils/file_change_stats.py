"""文本写入工具的用量反馈；数字供模型判断，不代表记忆整理的语义质量。"""

from dataclasses import dataclass
from pathlib import Path

from agentlang.logger import get_logger
from agentlang.utils.token_estimator import num_tokens_from_string
from app.utils.async_file_utils import async_read_bytes

logger = get_logger(__name__)


@dataclass(frozen=True)
class FileContentMetrics:
    """
    None 表示这次无法确认；0 表示已经确认没有内容，二者会影响模型对覆盖结果的判断。
    """
    byte_count: int | None
    estimated_tokens: int | None


@dataclass(frozen=True)
class FileChangeMetrics:
    before: FileContentMetrics
    after: FileContentMetrics


@dataclass(frozen=True)
class FileTextSnapshot:
    """
    复用一次文件读取，同时保留编辑文本和读取到的真实字节用量。

    MOCK DEMO：磁盘 CRLF 文本有 100 bytes，编辑工具按原逻辑转换成 LF 后可能更短。
    content 延续编辑工具原有换行／容错解码行为，metrics 记录转换前的真实字节。
    这只支持本次写入反馈，不增加文件版本、编辑权限或 Horizon 观察状态。
    """

    content: str
    metrics: FileContentMetrics


def measure_text(content: str, byte_count: int) -> FileContentMetrics:
    """
    统计实际准备写入的文本，包含工具原有的末尾换行和 JSON 修复结果。

    | 用途           | 口径                              |
    | 文字长度       | 字符数，len(text)                 |
    | 文件大小       | UTF-8 字节数，由读取或写入统计提供 |
    | 模型上下文用量 | 项目 Token 估算器                 |
    例：「中文」是 2 个字符、6 个 UTF-8 字节；Token 按现有公式估算。
    调用方已有字节数，这里只估算 Token，不为反馈再次编码整段文本。
    """
    try:
        tokens = num_tokens_from_string(content)
    except Exception as error:
        logger.warning(f"文本 Token 统计不可用: {error}")
        tokens = None
    return FileContentMetrics(byte_count, tokens)


async def read_text_snapshot(
    path: Path, normalize_newlines: bool = True, replace_errors: bool = True,
) -> FileTextSnapshot:
    """
    一次读取分出两条用途：原始字节长度用于文件大小，解码后的文本用于原有匹配和编辑。
    不为统计改变编辑工具既有的换行规则；解码需容错时，保留字节数但不猜原文 Token 数。
    """
    raw = await async_read_bytes(path)
    try:
        content = raw.decode("utf-8")
        metrics = measure_text(content, len(raw))
    except UnicodeError:
        if not replace_errors:
            raise
        content = raw.decode("utf-8", errors="replace")
        metrics = FileContentMetrics(len(raw), None)
    if normalize_newlines:
        content = content.replace("\r\n", "\n").replace("\r", "\n")
    return FileTextSnapshot(content, metrics)


async def read_file_metrics(path: Path) -> FileContentMetrics:
    """
    覆盖写之前的可选测量；无法读取旧值不能变成新的写入前置条件。

    Write 原本可以覆盖目标，不能因为新增反馈读不到旧内容就拒绝这次合法写入。
    返回 unavailable 让模型知道缺少对照，不把「不知道旧大小」误报成「从空文件创建」。
    """
    try:
        return (await read_text_snapshot(path, normalize_newlines=False)).metrics
    except Exception as error:
        logger.warning(f"覆盖写入前的文件用量不可读取: {path}: {error}")
        return FileContentMetrics(None, None)


def _format_change(before: int | None, after: int | None, percentage: bool = False) -> str:
    old = f"{before:,}" if before is not None else "unavailable"
    new = f"{after:,}" if after is not None else "unavailable"
    if before is None or after is None:
        return f"{old} -> {new}"
    change = after - before
    delta = f"{change:+,}"
    if percentage and before > 0:
        delta += f"; {change / before * 100:+.1f}%"
    return f"{old} -> {new} ({delta})"


def format_file_change_metrics(metrics: FileChangeMetrics, include_bytes: bool = True) -> str:
    """
    MOCK DEMO：1,000 -> 800 (-200; -20.0%) 只说明用量变化，不能推导删掉了哪条记忆。
    Edit 继续使用原 generate_summary_diff 的行数／字节／增删改，只追加 Token 一行；
    Write、Append 可在这里取得完整的前后字节。旧值为 0 时不计算增长率，未知值不伪装成 0。
    例：before=(4,000 bytes, 1,000 tokens)，after=(3,200 bytes, 800 tokens)，默认返回：
    Tokens (estimated): 1,000 -> 800 (-200; -20.0%)
    Bytes: 4,000 -> 3,200 (-800)
    include_bytes=False 时只返回上面第一行，两种结果都保留末尾换行。
    同样写入 800 tokens，旧计数为 0 与不可得时的 Token 行分别为：
    Tokens (estimated): 0 -> 800 (+800)
    Tokens (estimated): unavailable -> 800
    前者确认从空内容增加，后者无法判断增加或减少；不能给它们编造百分比。
    """
    tokens = _format_change(metrics.before.estimated_tokens, metrics.after.estimated_tokens, percentage=True)
    result = f"Tokens (estimated): {tokens}\n"
    if include_bytes:
        result += f"Bytes: {_format_change(metrics.before.byte_count, metrics.after.byte_count)}\n"
    return result
