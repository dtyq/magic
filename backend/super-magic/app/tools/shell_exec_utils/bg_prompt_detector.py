"""
交互式命令 Prompt 特征检测。

维护三组规则，提供 looks_like_prompt() 单行检测函数：
- 固定子串组：已知 CLI 工具输出的精确字符串，直接 `in` 判断，无误判风险
- 高置信正则组：误判率极低，直接匹配即可触发
- 严格正则组：`>` / `$` / `>>>` 等字符在 git diff、cmake 等输出中大量出现，
  仅当整行只含该字符（可选前缀空白）时才命中

本模块只负责单次检测，「静默窗口」确认逻辑由调用方（ProcessExecutor / shell_await）持有。
"""

import re

# ── 固定子串组：已知 CLI 工具的精确输出，直接 in 判断，无误判风险 ─────────────
# 新增已知工具时在此追加，格式：(子串, 说明注释)

_FIXED_SUBSTRINGS: list[str] = [
    # lark-cli config init --new：展示二维码后输出的最终等待行
    "正在获取你的应用配置结果",
    # lark-cli config init --new（部分版本）：另一种等待提示
    "等待配置应用",
    # 终端 QR 码渲染：U+2588 FULL BLOCK 连续填充（lark-cli / dws 等使用）
    "████████",
    # 终端 QR 码渲染：U+2584 LOWER HALF BLOCK 连续填充（wecom-cli 等使用）
    "▄▄▄▄▄▄▄▄",
    # dws auth login --device：等待用户在浏览器完成授权（Step 2 提示 + 每轮 polling 行均含此串）
    "Waiting for user authorization",
    # wecom-cli init：展示二维码后输出的最终等待行
    "等待扫码中",
]

# ── 高置信正则组：误判率极低，直接匹配 ──────────────────────────────────────

_HIGH_CONFIDENCE_PATTERNS: list[re.Pattern] = [p for p in (
    re.compile(r"\(y/n\)|\[Y/n\]|\(yes/no\)", re.IGNORECASE),
    re.compile(r"Do you .+\?$", re.IGNORECASE),
    re.compile(r"Are you sure\b", re.IGNORECASE),
    re.compile(r"Press (any key|Enter)", re.IGNORECASE),
    re.compile(r"(Continue|Overwrite|Proceed)\?", re.IGNORECASE),
    re.compile(r"Password:\s*$", re.IGNORECASE),
    re.compile(r"Enter password", re.IGNORECASE),
    re.compile(r"(Username|Login):\s*$", re.IGNORECASE),
    re.compile(r"\[sudo\] password for", re.IGNORECASE),
)]

# ── 严格组：仅整行只含该字符时才命中 ─────────────────────────────────────────

_STRICT_PATTERNS: list[re.Pattern] = [p for p in (
    re.compile(r"^\s*>\s*$"),       # 交互式 shell 续行提示符
    re.compile(r"^\s*\$\s*$"),      # 极罕见，普通输出中几乎不单独出现
    re.compile(r"^\s*>>>\s*$"),     # Python / Node REPL 提示符
    re.compile(r"^\s*\.\.\.\s*$"),  # Python REPL 续行提示符
)]


def looks_like_prompt(last_line: str) -> bool:
    """
    判断末尾行是否看起来像交互式 Prompt。

    调用方应传入输出末尾去掉尾部空白后的最后一行。
    依次检测：固定子串组（最快）→ 高置信正则组 → 严格正则组。
    任意命中返回 True，否则返回 False。
    """
    stripped = last_line.rstrip()
    if not stripped:
        return False

    for substr in _FIXED_SUBSTRINGS:
        if substr in stripped:
            return True

    for pattern in _HIGH_CONFIDENCE_PATTERNS:
        if pattern.search(stripped):
            return True

    for pattern in _STRICT_PATTERNS:
        if pattern.match(stripped):
            return True

    return False


def extract_last_line(text: str) -> str:
    """
    从多行文本中提取末尾非空行，用于传给 looks_like_prompt()。

    去掉尾部空白行后返回最后一行（含该行内容，不含换行符）。
    """
    lines = text.rstrip().splitlines()
    return lines[-1] if lines else ""


def scan_chunk_for_prompt(chunk: str) -> bool:
    """
    对整块 chunk 文本扫描固定子串。

    与 looks_like_prompt() 互补：
    - looks_like_prompt() 只看末尾行，适合正则（避免历史输出误触）
    - scan_chunk_for_prompt() 扫描全文，适合固定子串（例如 QR 码渲染行在 chunk 中间出现）

    典型场景：lark-cli / wecom-cli 把 QR 码 + 等待提示行放在同一个大 chunk 里，
    末尾行不含 QR 码字符，只有全文扫描才能命中。
    """
    for substr in _FIXED_SUBSTRINGS:
        if substr in chunk:
            return True
    return False
