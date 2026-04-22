"""ask_user 问题解析器：从模型输出的 <question> 标签中提取结构化问题列表。

采用正则 + 局部 ET 的两阶段策略：
1. 正则切分出每个 <question ...>...</question> 片段（容忍片段外的乱码）
2. 对每个片段单独做 ET 解析，失败时回退到纯正则提取属性和选项

这样即使大模型写的 XML 有局部错误（未转义 &、多余空行、属性引号缺失等），
也不会让整批问题全部丢失。
"""

import re
import uuid
from typing import List, Optional
from xml.etree import ElementTree

from agentlang.logger import get_logger

logger = get_logger(__name__)

# "其它"选项标记，前端据此渲染自由文本输入框
OTHER_OPTION_LABEL = "Other"

# ---------- 正则常量 ----------
# 匹配单个 <question ...>...</question> 片段（DOTALL，非贪婪）
_QUESTION_BLOCK_RE = re.compile(
    r"<question\b([^>]*)>(.*?)</question>",
    re.DOTALL | re.IGNORECASE,
)
# 从属性字符串中提取 key="value" 或 key='value' 或 key=value
_ATTR_RE = re.compile(r'(\w+)\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|(\S+))')
# 匹配 <option>...</option>
_OPTION_RE = re.compile(r"<option\b[^>]*>(.*?)</option>", re.DOTALL | re.IGNORECASE)

_VALID_TYPES = {"confirm", "input", "select", "multi_select"}


def parse_questions_xml(raw_xml: str) -> List[dict]:
    """将模型输出的 <question> 标签解析为结构化问题列表。

    宽容策略：单个片段解析失败时回退到正则，不影响其他问题。
    """
    if not raw_xml or not raw_xml.strip():
        return []

    questions: List[dict] = []

    for match in _QUESTION_BLOCK_RE.finditer(raw_xml):
        attrs_str = match.group(1)
        body = match.group(2)
        parsed = _try_parse_with_et(attrs_str, body)
        if parsed is None:
            parsed = _parse_with_regex(attrs_str, body)
        if parsed is not None:
            questions.append(parsed)

    if not questions:
        # 连正则都没匹配到 <question>，尝试把整个输入当成一个问题
        logger.warning(f"No <question> tags found, treating entire input as a single question: {raw_xml[:120]}")
        questions.append({
            "sub_id": str(uuid.uuid4()),
            "question": raw_xml.strip(),
            "interaction_type": "input",
            "options": None,
            "placeholder": None,
            "min_select": None,
            "max_select": None,
            "default_value": None,
        })

    return questions


# ---------- 策略一：ET 解析（精确）----------

def _try_parse_with_et(attrs_str: str, body: str) -> Optional[dict]:
    """尝试用 ElementTree 解析单个 <question> 片段，失败返回 None。"""
    fragment = f"<question{attrs_str}>{body}</question>"
    # 修复常见的未转义 &
    fragment = re.sub(r"&(?!amp;|lt;|gt;|quot;|apos;|#)", "&amp;", fragment)
    try:
        elem = ElementTree.fromstring(fragment)
    except ElementTree.ParseError:
        return None

    q_type = _normalize_type(elem.get("type"))

    # 问题文本：elem.text（不含子元素文本）
    question_text = (elem.text or "").strip()

    options = []
    for opt in elem.findall("option"):
        t = (opt.text or "").strip()
        if t:
            options.append(t)

    _maybe_append_other(q_type, options)

    return _build_question_dict(
        q_type=q_type,
        question_text=question_text,
        options=options,
        placeholder=elem.get("placeholder"),
        default=elem.get("default"),
        min_val=elem.get("min"),
        max_val=elem.get("max"),
    )


# ---------- 策略二：纯正则回退 ----------

def _parse_with_regex(attrs_str: str, body: str) -> Optional[dict]:
    """ET 失败时，用正则从属性字符串和 body 中尽量提取信息。"""
    attrs = _extract_attrs(attrs_str)
    q_type = _normalize_type(attrs.get("type"))

    # 问题文本：去掉 <option> 标签后的剩余文本
    text_only = _OPTION_RE.sub("", body).strip()
    # 去掉残余 HTML 标签
    text_only = re.sub(r"<[^>]+>", "", text_only).strip()

    options = [m.group(1).strip() for m in _OPTION_RE.finditer(body) if m.group(1).strip()]
    _maybe_append_other(q_type, options)

    return _build_question_dict(
        q_type=q_type,
        question_text=text_only,
        options=options,
        placeholder=attrs.get("placeholder"),
        default=attrs.get("default"),
        min_val=attrs.get("min"),
        max_val=attrs.get("max"),
    )


# ---------- 公共辅助 ----------

def _normalize_type(raw: Optional[str]) -> str:
    if not raw:
        return "input"
    t = raw.strip().lower().replace("-", "_")
    return t if t in _VALID_TYPES else "input"


def _extract_attrs(s: str) -> dict:
    """从属性字符串中提取 key-value 对。"""
    result = {}
    for m in _ATTR_RE.finditer(s):
        key = m.group(1)
        value = m.group(2) or m.group(3) or m.group(4) or ""
        result[key] = value
    return result


def _maybe_append_other(q_type: str, options: list) -> None:
    if q_type in ("select", "multi_select") and options:
        if not any(o.lower() == OTHER_OPTION_LABEL.lower() for o in options):
            options.append(OTHER_OPTION_LABEL)


def _parse_int(value: Optional[str], default=None):
    """安全解析整数属性"""
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def _build_question_dict(
    *,
    q_type: str,
    question_text: str,
    options: list,
    placeholder: Optional[str],
    default: Optional[str],
    min_val: Optional[str],
    max_val: Optional[str],
) -> dict:
    return {
        "sub_id": str(uuid.uuid4()),
        "question": question_text,
        "interaction_type": q_type,
        "options": options if options else None,
        "placeholder": placeholder,
        "min_select": _parse_int(min_val, default=1) if q_type == "multi_select" else None,
        "max_select": _parse_int(max_val, default=None) if q_type == "multi_select" else None,
        "default_value": default,
    }
