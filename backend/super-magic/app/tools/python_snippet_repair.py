"""Utilities for repairing common model-generated Python snippet syntax issues."""

import ast
import re
from logging import Logger

# Only used as a SyntaxError fallback: model-generated snippets often place file
# paths containing quotes directly in same-quoted string literals.
_PATH_LITERAL_PREFIX_PATTERNS = (
    re.compile(r"^(\s*[A-Za-z_]\w*\s*=\s*)([\"'])"),
    re.compile(r"^(\s*[A-Za-z_]\w*\s*=\s*Path\s*\(\s*)([\"'])"),
    re.compile(r"^(.{0,500}?[\"'][A-Za-z_]\w*[\"']\s*:\s*)([\"'])"),
)
_ABSOLUTE_PATH_PREFIX_PATTERN = re.compile(r"^(?:/|~[/\\]|[A-Za-z]:[/\\])")

# Covers one-line calls like add_body("... "inner quote" ...") generated for
# prose-heavy document writing. Multi-line strings are intentionally out of scope.
_SINGLE_ARG_CALL_PREFIX_PATTERN = re.compile(
    r"^(\s*[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\s*\(\s*)([\"'])(.*)$"
)


def _quote_python_string(value: str) -> str:
    return repr(value)


def _split_newline(line: str) -> tuple[str, str]:
    newline_match = re.search(r"(\r?\n)$", line)
    newline = newline_match.group(1) if newline_match else ""
    body = line[: -len(newline)] if newline else line
    return body, newline


def _repair_unescaped_path_quotes_in_line(line: str) -> str:
    """Repair same-quoted absolute path literals containing unescaped quotes."""
    body, newline = _split_newline(line)

    open_quote_index: int | None = None
    quote = ""
    for pattern in _PATH_LITERAL_PREFIX_PATTERNS:
        match = pattern.match(body)
        if match:
            open_quote_index = len(match.group(1))
            quote = match.group(2)
            break

    if open_quote_index is None:
        return line

    close_quote_index = body.rfind(quote)
    if close_quote_index <= open_quote_index:
        return line

    suffix = body[close_quote_index + 1:]
    if suffix and not re.fullmatch(r"[\s,\)\]\}]*", suffix):
        return line

    value = body[open_quote_index + 1:close_quote_index]
    if quote not in value or not _ABSOLUTE_PATH_PREFIX_PATTERN.match(value):
        return line

    return f"{body[:open_quote_index]}{_quote_python_string(value)}{suffix}{newline}"


def _repair_unescaped_path_quotes(python_code: str) -> str:
    return "".join(
        _repair_unescaped_path_quotes_in_line(line)
        for line in python_code.splitlines(keepends=True)
    )


def _repair_unescaped_call_string_quotes_in_line(line: str) -> str:
    """Repair one-line function-call string arguments with unescaped inner quotes."""
    body, newline = _split_newline(line)
    match = _SINGLE_ARG_CALL_PREFIX_PATTERN.match(body)
    if not match:
        return line

    prefix, quote, remainder = match.groups()
    close_quote_index = remainder.rfind(quote)
    if close_quote_index > 0:
        suffix = remainder[close_quote_index + 1:]
        if suffix and not re.fullmatch(r"[\s,\)]*", suffix):
            if ")" not in remainder:
                return f"{prefix}{_quote_python_string(remainder)}){newline}"
            return line

        value = remainder[:close_quote_index]
        if quote not in value:
            return line

        return f"{prefix}{_quote_python_string(value)}{suffix}{newline}"

    # Some generated prose calls miss both the closing string quote and the
    # function's closing parenthesis, e.g. add_heading2("... "keyword"）
    if quote in remainder and ")" not in remainder:
        return f"{prefix}{_quote_python_string(remainder)}){newline}"

    return line


def _repair_unescaped_call_string_quotes(python_code: str) -> str:
    return "".join(
        _repair_unescaped_call_string_quotes_in_line(line)
        for line in python_code.splitlines(keepends=True)
    )


def prepare_python_code(python_code: str, logger: Logger | None = None, caller: str = "python_snippet") -> str:
    """Return Python code as-is, or a SyntaxError-only repaired version.

    The repair is deliberately conservative: it only runs after parsing fails,
    and the repaired code must parse successfully before it is returned.
    """
    try:
        ast.parse(python_code)
        return python_code
    except SyntaxError:
        pass

    repaired_code = python_code
    applied_repairs: list[str] = []
    for repair_name, repair in (
        ("unescaped quotes in absolute path literals", _repair_unescaped_path_quotes),
        ("unescaped quotes in single-line string call arguments", _repair_unescaped_call_string_quotes),
    ):
        next_code = repair(repaired_code)
        if next_code == repaired_code:
            continue

        repaired_code = next_code
        applied_repairs.append(repair_name)

        try:
            ast.parse(repaired_code)
        except SyntaxError:
            continue

        if logger:
            logger.info(f"{caller} repaired {'; '.join(applied_repairs)}")
        return repaired_code

    return python_code
