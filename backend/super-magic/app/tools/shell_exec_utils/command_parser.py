"""基于 bashlex 的 shell 命令解析。

将复合命令（如 `echo hello && lark-cli auth login`）拆分为独立子命令列表，
供 dispatcher 对每个子命令逐一匹配 handler。
也可用于未来的命令行安全检测（如识别 rm 操作）。
"""
import re
import shlex
from dataclasses import dataclass
from pathlib import Path

import bashlex
from bashlex.ast import node as BashNode
from loguru import logger


@dataclass(frozen=True, slots=True)
class SubCommand:
    """从复合命令中提取出的单个子命令。"""

    binary: str  # 命令的二进制名（第一个词），如 "lark-cli"
    text: str  # 完整子命令文本，如 "lark-cli auth login"
    args: tuple[str, ...]  # 所有参数词，如 ("auth", "login")


def extract_read_file_path(command: str, work_dir: Path) -> Path | None:
    """提取单条正文查看命令的文件；是否实际读到内容由执行结果决定。

    cat 'my file.py' 可以归因；false && cat file.py、管道和重定向不可以。
    不复用展平后的子命令或失败降级，避免把未执行的读取登记成观察。
    """
    try:
        nodes = bashlex.parse(command.strip())
    except Exception:
        # bashlex 对部分合法 shell 语法也会抛 NotImplementedError；不影响命令执行。
        return None
    if len(nodes) != 1 or nodes[0].kind != "command":
        return None
    words = _literal_command_words(nodes[0], command.strip())
    if not words:
        return None
    binary = Path(words[0])
    name = binary.name
    if words[0] not in (name, f"/bin/{name}", f"/usr/bin/{name}"):
        return None
    args = words[1:]
    if name == "cat":
        file_name = _cat_read_file(args)
    elif name == "sed":
        file_name = _sed_read_file(args)
    elif name in ("head", "tail"):
        file_name = _head_tail_read_file(args, tail=name == "tail")
    elif name in ("grep", "egrep", "fgrep"):
        file_name = _grep_read_file(args)
    else:
        return None
    if not file_name or file_name == "-":
        return None
    path = Path(file_name)
    # 保留 .. 与符号链接的实际解析语义；此处只拼接，不执行文件 I/O。
    return path if path.is_absolute() else work_dir / path


def extract_literal_and_commands(command: str) -> list[SubCommand] | None:
    """仅提取单条字面命令或 && 链，供成功后的文件事件确认使用。

    调用方还需排除 exit、cd 等改变控制流或工作目录的命令，再以整链返回 0
    确认执行完成；||、管道、分组和动态展开不能按这个条件判断。
    这里不使用 dispatcher 的展平和 split 降级。
    """
    source = command.strip()
    try:
        roots = bashlex.parse(source)
        if len(roots) != 1:
            return None
        root = roots[0]
        if root.kind == "command":
            nodes = [root]
        elif root.kind == "list":
            parts = root.parts
            if len(parts) % 2 != 1 or any(
                part.kind != "operator" or part.op != "&&" for part in parts[1::2]
            ):
                return None
            nodes = parts[::2]
        else:
            return None
        commands: list[SubCommand] = []
        for node in nodes:
            if node.kind != "command":
                return None
            words = _literal_command_words(node, source)
            if not words:
                return None
            commands.append(SubCommand(words[0], source[node.pos[0]:node.pos[1]], tuple(words[1:])))
        return commands
    except Exception:
        # bashlex 的不支持语法也可能抛 NotImplementedError；只放弃事件识别。
        return None


def _literal_command_words(node: BashNode, source: str) -> list[str] | None:
    """复用读取观察的字面参数规则，不执行替换或通配符展开。"""
    words: list[str] = []
    for part in node.parts:
        if part.kind != "word" or part.parts:
            return None
        raw_word = source[part.pos[0]:part.pos[1]]
        if not _is_literal_shell_word(raw_word):
            return None
        # bashlex 的引号移除不覆盖全部转义细节；解析不一致时不猜测文件名。
        try:
            if shlex.split(raw_word) != [part.word]:
                return None
        except ValueError:
            return None
        words.append(part.word)
    return words


def _is_literal_shell_word(source: str) -> bool:
    """AST 已排除替换节点；另排除 bashlex 不展开的通配符和花括号。

    引号或反斜杠保护的特殊字符是字面内容，例如 grep 'a.*' file.py。
    """
    quote = ""
    escaped = False
    for char in source:
        if escaped:
            escaped = False
        elif char == "\\" and quote != "'":
            escaped = True
        elif quote:
            if char == quote:
                quote = ""
        elif char in ("'", '"'):
            quote = char
        elif char in "*?[{}~$`":
            return False
    return not quote and not escaped


def _cat_read_file(args: list[str]) -> str | None:
    index = 0
    while index < len(args) and args[index].startswith("-"):
        option = args[index]
        index += 1
        if option == "--":
            break
        if len(option) < 2 or any(char not in "nbsvETAet" for char in option[1:]):
            return None
    return args[index] if len(args) == index + 1 else None


def _sed_read_file(args: list[str]) -> str | None:
    if not args or args[0] != "-n":
        return None
    index = 1
    options_ended = False
    if index < len(args) and args[index] == "-e":
        index += 1
    elif index < len(args) and args[index] == "--":
        options_ended = True
        index += 1
    if index >= len(args) or not re.fullmatch(r"[1-9][0-9]*(?:,(?:[1-9][0-9]*|\$))?p", args[index]):
        return None
    index += 1
    if not options_ended and index < len(args) and args[index] == "--":
        options_ended = True
        index += 1
    if len(args) != index + 1:
        return None
    if not options_ended and args[index].startswith("-"):
        return None
    return args[index]


def _head_tail_read_file(args: list[str], *, tail: bool) -> str | None:
    index = 0
    if args and args[0].startswith("-") and args[0] != "--":
        option = args[0]
        index = 1
        if option == "-n":
            if index >= len(args):
                return None
            count = args[index]
            index += 1
        else:
            count = option[2:] if option.startswith("-n") else option[1:]
        count_pattern = r"\+?[1-9][0-9]*" if tail and option.startswith("-n") else r"[1-9][0-9]*"
        if not re.fullmatch(count_pattern, count):
            return None
    if index < len(args) and args[index] == "--":
        index += 1
        return args[index] if len(args) == index + 1 else None
    if len(args) != index + 1 or args[index].startswith("-"):
        return None
    return args[index]


def _grep_read_file(args: list[str]) -> str | None:
    index = 0
    has_pattern = False
    options_ended = False
    while index < len(args) and args[index].startswith("-"):
        option = args[index]
        index += 1
        if option == "--":
            options_ended = True
            break
        if len(option) < 2:
            return None
        offset = 1
        while offset < len(option):
            flag = option[offset]
            offset += 1
            if flag in "nivwxEFahH":
                continue
            if flag not in "eABCm":
                return None
            value = option[offset:]
            if not value:
                if index >= len(args):
                    return None
                value = args[index]
                index += 1
            if flag == "e":
                if has_pattern:
                    return None
                has_pattern = True
            elif not re.fullmatch(r"[0-9]+", value):
                return None
            break
    # -e 已提供 pattern 时只剩文件；否则剩下一个 pattern 和一个文件。
    expected = 1 if has_pattern else 2
    if len(args) - index != expected:
        return None
    file_name = args[-1]
    # pattern 后的 - 开头参数在不同 grep 实现中可能仍被当作选项，不猜测。
    if not options_ended and file_name.startswith("-"):
        return None
    return file_name


def extract_sub_commands(command: str) -> list[SubCommand]:
    """将 shell 命令字符串拆分为独立子命令列表。

    支持 &&、||、;、| 等 bash 复合语法。
    解析失败时降级为将整个字符串视为单条命令，保证不会因解析异常阻断命令执行。

    Args:
        command: 完整的 shell 命令字符串（已去除首尾空白）。

    Returns:
        子命令列表，至少包含一个元素。
    """
    command = command.strip()
    if not command:
        return [SubCommand(binary="", text="", args=())]

    try:
        parts = bashlex.parse(command)
    except bashlex.errors.ParsingError:
        logger.debug(f"bashlex 无法解析命令，降级为原始命令: {command!r}")
        return _fallback_parse(command)

    results: list[SubCommand] = []
    _visit_nodes(parts, command, results)
    return results or _fallback_parse(command)


def _visit_nodes(
    nodes: list,
    source: str,
    results: list[SubCommand],
) -> None:
    """递归遍历 AST 节点，提取所有 CommandNode。"""
    for node in nodes:
        if node.kind == "command":
            words = [p.word for p in node.parts if p.kind == "word"]
            if words:
                text = source[node.pos[0] : node.pos[1]]
                results.append(
                    SubCommand(
                        binary=words[0],
                        text=text,
                        args=tuple(words[1:]),
                    )
                )
        elif hasattr(node, "parts"):
            _visit_nodes(
                [p for p in node.parts if hasattr(p, "kind")],
                source,
                results,
            )


def _fallback_parse(command: str) -> list[SubCommand]:
    """解析失败时的降级方案：把整个字符串当作单条命令。"""
    parts = command.split()
    return [
        SubCommand(
            binary=parts[0] if parts else "",
            text=command,
            args=tuple(parts[1:]) if len(parts) > 1 else (),
        )
    ]
