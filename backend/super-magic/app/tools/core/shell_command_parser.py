"""
Shell命令解析器

用于解析shell命令中的文件操作，识别需要dispatch的文件事件
"""
import getopt
import stat
import sys
from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path

from agentlang.event.event import EventType
from agentlang.logger import get_logger
from app.tools.shell_exec_utils.command_parser import extract_literal_and_commands
from app.utils.async_file_utils import async_exists, async_stat

logger = get_logger(__name__)


class ShellFileCommand(StrEnum):
    TOUCH = "touch"
    MKDIR = "mkdir"
    COPY = "cp"
    MOVE = "mv"
    REMOVE = "rm"
    RMDIR = "rmdir"


class ShellFileState(StrEnum):
    MISSING = "missing"
    FILE = "file"
    DIRECTORY = "directory"
    OTHER = "other"
    UNKNOWN = "unknown"


@dataclass(frozen=True, slots=True)
class ShellFileOperation:
    command: ShellFileCommand
    paths: tuple[Path, ...]


@dataclass(slots=True)
class ShellFileChanges:
    """仅保留本次调用的候选与执行前类型，不保存正文或创建新快照。"""

    operations: tuple[ShellFileOperation, ...] = ()
    before: dict[Path, ShellFileState] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class ShellFileEvent:
    path: Path
    event_type: EventType


# 参数规则交给 getopt；条件写入和交互选项不在此集合，避免成功退出却未写入。
_OPTION_SPECS: dict[ShellFileCommand, str] = {
    ShellFileCommand.TOUCH: "amcr:t:",
    ShellFileCommand.MKDIR: "pm:",
    ShellFileCommand.COPY: "fpvrR",
    ShellFileCommand.MOVE: "fv",
    ShellFileCommand.REMOVE: "frRv",
    ShellFileCommand.RMDIR: "p",
}
_VIEW_COMMANDS: frozenset[str] = frozenset({"ls", "pwd", "cat", "head", "tail", "grep", "wc", "echo", "true", "false"})


class ShellCommandParser:
    """Shell命令解析器，用于识别文件操作命令"""

    @staticmethod
    async def prepare_file_operations(command: str, work_dir: Path) -> ShellFileChanges:
        """执行前只登记候选；解析或文件检查失败不阻断真实 shell 命令。"""
        try:
            operations = ShellCommandParser._parse_operations(command, work_dir)
            paths: dict[Path, None] = {}
            for operation in operations:
                if operation.command in (ShellFileCommand.COPY, ShellFileCommand.MOVE):
                    destination = operation.paths[-1]
                    paths[destination] = None
                    # mkdir dst && cp src dst：执行前 dst 可能不存在，需保留两种目标形态。
                    for source in operation.paths[:-1]:
                        paths[destination / source.name] = None
                        paths[source] = None
                elif operation.command in (ShellFileCommand.TOUCH, ShellFileCommand.REMOVE):
                    paths.update(dict.fromkeys(operation.paths))
            before = {path: await ShellCommandParser._file_state(path) for path in paths}
            return ShellFileChanges(operations, before)
        except Exception as exc:
            logger.warning(f"识别 shell 文件操作失败，跳过本次文件事件: {exc}")
            return ShellFileChanges()

    @staticmethod
    def _parse_operations(command: str, work_dir: Path) -> tuple[ShellFileOperation, ...]:
        commands = extract_literal_and_commands(command)
        if not commands:
            return ()
        operations: list[ShellFileOperation] = []
        for subcommand in commands:
            name = Path(subcommand.binary).name
            if subcommand.binary not in (name, f"/bin/{name}", f"/usr/bin/{name}"):
                return ()
            if name in _VIEW_COMMANDS:
                continue
            try:
                kind = ShellFileCommand(name)
                # Linux 的 GNU 工具允许选项与操作数混排，macOS 按 POSIX 顺序处理。
                parse_options = getopt.gnu_getopt if sys.platform == "linux" else getopt.getopt
                _, operands = parse_options(list(subcommand.args), _OPTION_SPECS[kind])
            except (ValueError, getopt.GetoptError):
                return ()
            if not operands or any(not value or "\0" in value for value in operands):
                return ()
            if kind in (ShellFileCommand.COPY, ShellFileCommand.MOVE) and len(operands) < 2:
                return ()
            paths = tuple(Path(value) if Path(value).is_absolute() else work_dir / value for value in operands)
            operations.append(ShellFileOperation(kind, paths))
        return tuple(operations)

    @staticmethod
    async def collect_file_events(changes: ShellFileChanges) -> list[ShellFileEvent]:
        """仅供实际完成且 exit_code == 0 的命令调用，复用逐工具附件事件。

        | 执行前 → 执行后 | 对应明确操作 | 事件 |
        | 不存在 → 文件 | touch/cp/mv | 创建 |
        | 文件 → 文件 | touch/cp/mv | 更新通知，不证明内容哈希改变 |
        | 文件 → 不存在 | rm/mv 源 | 删除 |
        目录不作为普通文件附件；不使用存在延迟的 mtime 判断写入是否发生。
        """
        after = {path: await ShellCommandParser._file_state(path) for path in changes.before}
        events: dict[Path, EventType] = {}
        for operation in changes.operations:
            writes: tuple[Path, ...] = ()
            deletions: tuple[Path, ...] = ()
            if operation.command == ShellFileCommand.TOUCH:
                writes = operation.paths
            elif operation.command == ShellFileCommand.REMOVE:
                deletions = operation.paths
            elif operation.command in (ShellFileCommand.COPY, ShellFileCommand.MOVE):
                sources, destination = operation.paths[:-1], operation.paths[-1]
                if after[destination] == ShellFileState.DIRECTORY:
                    # 目录递归的内容不靠 basename 猜测；源文件已移动时用前置类型确认。
                    writes = tuple(
                        destination / source.name for source in sources
                        if ShellFileState.FILE in (changes.before[source], after[source])
                    )
                elif len(sources) == 1:
                    writes = (destination,)
                if operation.command == ShellFileCommand.MOVE:
                    deletions = sources

            for path in deletions:
                if changes.before[path] == ShellFileState.FILE and after[path] == ShellFileState.MISSING:
                    events[path] = EventType.FILE_DELETED
            for path in writes:
                previous = changes.before[path]
                if previous == ShellFileState.UNKNOWN or after[path] != ShellFileState.FILE:
                    continue
                events[path] = EventType.FILE_UPDATED if previous == ShellFileState.FILE else EventType.FILE_CREATED
        return [ShellFileEvent(path, event_type) for path, event_type in events.items()]

    @staticmethod
    async def _file_state(path: Path) -> ShellFileState:
        try:
            # 候选可能形如“尚为文件的目标/源文件名”；exists 将 ENOTDIR 视为缺失，
            # 避免正常的目标形态探测被 async_stat 记录成文件系统错误。
            if not await async_exists(path):
                return ShellFileState.MISSING
            mode = (await async_stat(path)).st_mode
        except (FileNotFoundError, NotADirectoryError):
            return ShellFileState.MISSING
        except OSError as exc:
            logger.warning(f"检查 shell 文件候选失败，跳过该路径: {path}: {exc}")
            return ShellFileState.UNKNOWN
        if stat.S_ISREG(mode):
            return ShellFileState.FILE
        if stat.S_ISDIR(mode):
            return ShellFileState.DIRECTORY
        return ShellFileState.OTHER
