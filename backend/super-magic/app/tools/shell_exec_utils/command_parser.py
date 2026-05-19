"""基于 bashlex 的 shell 命令解析。

将复合命令（如 `echo hello && lark-cli auth login`）拆分为独立子命令列表，
供 dispatcher 对每个子命令逐一匹配 handler。
也可用于未来的命令行安全检测（如识别 rm 操作）。
"""
from dataclasses import dataclass

import bashlex
from loguru import logger


@dataclass(frozen=True, slots=True)
class SubCommand:
    """从复合命令中提取出的单个子命令。"""

    binary: str  # 命令的二进制名（第一个词），如 "lark-cli"
    text: str  # 完整子命令文本，如 "lark-cli auth login"
    args: tuple[str, ...]  # 所有参数词，如 ("auth", "login")


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
