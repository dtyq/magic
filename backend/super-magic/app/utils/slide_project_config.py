"""只解析 JSON 兼容的配置对象字面量，不执行脚本或自动修复数据。"""

import ast
import json
import re
from dataclasses import dataclass

_SKIP = r"(?:\s|//[^\n]*(?:\n|$)|/\*[\s\S]*?\*/)*"
_ASSIGNMENT = re.compile(_SKIP + r"window\.magicProjectConfig\s*=\s*")
_TOKEN = re.compile(
    r'''(?P<skip>\s+|//[^\n]*|/\*[\s\S]*?\*/)|'''
    r'''(?P<string>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|'''
    r'''(?P<number>-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)|'''
    r'''(?P<identifier>[A-Za-z_$][A-Za-z0-9_$]*)|(?P<punct>[{}\[\]:,])'''
)


@dataclass(frozen=True)
class ProjectConfigObject:
    config: dict
    start: int
    end: int


def parse_project_config(content: str) -> ProjectConfigObject:
    assignment = _ASSIGNMENT.match(content)
    if not assignment:
        raise ValueError("Expected window.magicProjectConfig; no changes were saved.")
    start = assignment.end()
    offset = start
    tokens = []
    depth = 0
    while offset < len(content):
        match = _TOKEN.match(content, offset)
        if not match:
            raise ValueError("The project contains unsupported executable syntax; no changes were saved.")
        offset = match.end()
        kind, token = match.lastgroup, match.group()
        if kind == "skip":
            continue
        if not tokens and token != "{":
            raise ValueError("The project configuration must be an object.")
        if kind == "string":
            # literal_eval 只用于单个字符串字面量，不接受调用、表达式或对象。
            value = json.loads(token) if token.startswith('"') else ast.literal_eval(token)
            token = json.dumps(value, ensure_ascii=False)
        elif kind == "identifier":
            following = re.match(_SKIP, content[offset:]).end()
            if content[offset + following:offset + following + 1] == ":":
                token = json.dumps(token)
            elif token not in {"true", "false", "null"}:
                raise ValueError("Only literal configuration values are supported.")
        elif kind == "punct":
            if token in "{[":
                depth += 1
            elif token in "}]":
                depth -= 1
                if tokens and tokens[-1] == ",":
                    tokens.pop()
        tokens.append(token)
        if depth == 0:
            break
    suffix = content[offset:]
    wrapper = _SKIP + r";" + _SKIP + r"window\.magicProjectConfigure\(\s*window\.magicProjectConfig\s*\)\s*;?" + _SKIP
    if depth or not re.fullmatch(wrapper, suffix):
        raise ValueError("Unsupported project wrapper; no changes were saved.")
    try:
        config = json.loads(" ".join(tokens), object_pairs_hook=_unique_object)
    except (ValueError, TypeError) as exc:
        raise ValueError("The project configuration is invalid or ambiguous; no changes were saved.") from exc
    return ProjectConfigObject(config=config, start=start, end=offset)


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result or key in {"__proto__", "constructor", "prototype"}:
            raise ValueError("Duplicate or unsafe configuration key.")
        result[key] = value
    return result
