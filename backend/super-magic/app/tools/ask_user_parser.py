"""ask_user 问题解析器：先按题目开始标签切分，再恢复局部格式并校验完整性。"""

import re
import uuid
from dataclasses import dataclass
from enum import StrEnum
from typing import List, Optional
from xml.etree import ElementTree

# "其它"选项标记，前端据此渲染自由文本输入框
OTHER_OPTION_LABEL = "Other"

# ---------- 正则常量 ----------
# 先限定相邻开始标签的边界，再处理闭合，避免缺闭合时吞并下一题。
_QUESTION_OPEN_RE = re.compile(r"<question\b((?:\"[^\"]*\"|'[^']*'|[^'\">])*)>", re.IGNORECASE)
_QUESTION_START_RE = re.compile(r"<question(?=\s|/|>|$)", re.IGNORECASE)
_QUESTION_CLOSE_RE = re.compile(r"</question\s*>", re.IGNORECASE)
_CONTAINER_CLOSE_RE = re.compile(r"</questions\s*>", re.IGNORECASE)
# 从属性字符串中提取 key="value" 或 key='value' 或 key=value
_ATTR_RE = re.compile(r'(\w+)\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|(\S+))')
# 匹配 <option>...</option>
_OPTION_RE = re.compile(r"<option\b[^>]*>(.*?)</option\s*>", re.DOTALL | re.IGNORECASE)

_VALID_TYPES = {"confirm", "input", "select", "multi_select"}


class QuestionRepairKind(StrEnum):
    """本解析器能够可靠恢复的格式偏差。"""

    WRONG_CLOSE = "wrong_close"
    MISSING_CLOSE = "missing_close"
    STRAY_CONTAINER_CLOSE = "stray_container_close"


@dataclass(frozen=True)
class QuestionRepair:
    """只记录题序与修复类别，不携带用户题目正文。"""

    question_index: int
    kind: QuestionRepairKind


@dataclass(frozen=True)
class QuestionParseResult:
    """完整问卷与本次修复事实，供展示和模型纠正使用。"""

    questions: List[dict]
    repairs: tuple[QuestionRepair, ...]


class AskUserQuestionParseError(ValueError):
    """无法完整还原问卷时拒绝返回部分题目。"""

    def __init__(self, code: str, question_index: int):
        """保存脱敏诊断，异常消息不包含原始输入。"""
        self.code = code
        self.question_index = question_index
        super().__init__(f"{code}: question {question_index}")


def parse_questions_xml(raw_xml: str) -> List[dict]:
    """兼容既有列表入口，实际解析与报告入口共享同一组问题 ID。"""
    return parse_questions_xml_with_report(raw_xml).questions


def parse_questions_xml_with_report(raw_xml: str) -> QuestionParseResult:
    """按开始边界恢复完整问卷；任何已发现题目无效时整批失败。"""
    if not raw_xml or not raw_xml.strip():
        return QuestionParseResult([], ())

    opens = list(_QUESTION_OPEN_RE.finditer(raw_xml))
    if len(opens) != len(list(_QUESTION_START_RE.finditer(raw_xml))):
        raise AskUserQuestionParseError("incomplete_question_open", len(opens) + 1)
    questions: List[dict] = []
    repairs: list[QuestionRepair] = []
    # 容器尾标签可单独恢复；合法成对容器无需纠正模型。
    container_opens = len(re.findall(r"<questions\b[^>]*>", raw_xml, re.IGNORECASE))
    if len(_CONTAINER_CLOSE_RE.findall(raw_xml)) > container_opens:
        repairs.append(QuestionRepair(0, QuestionRepairKind.STRAY_CONTAINER_CLOSE))

    for index, match in enumerate(opens):
        number = index + 1
        attrs_str = match.group(1)
        end = opens[index + 1].start() if index + 1 < len(opens) else len(raw_xml)
        body = raw_xml[match.end():end]
        q_type = _normalize_type(_extract_attrs(attrs_str).get("type"))
        close = _QUESTION_CLOSE_RE.search(body)
        if close:
            # 闭合后的说明不属于题干，但结构标签不能被当成说明静默丢弃。
            if re.search(r"</?(?:question|option|select|multi_select|confirm|input)\b", body[close.end():], re.IGNORECASE):
                raise AskUserQuestionParseError("ambiguous_question_close", number)
            body = body[:close.start()]
        else:
            wrong_close = re.search(rf"</{q_type}\s*>", body, re.IGNORECASE)
            if wrong_close:
                if re.search(r"</?(?:question|option|select|multi_select|confirm|input)\b", body[wrong_close.end():], re.IGNORECASE):
                    raise AskUserQuestionParseError("ambiguous_question_close", number)
                body = body[:wrong_close.start()]
                repairs.append(QuestionRepair(number, QuestionRepairKind.WRONG_CLOSE))
            else:
                body = _CONTAINER_CLOSE_RE.sub("", body)
                repairs.append(QuestionRepair(number, QuestionRepairKind.MISSING_CLOSE))
        # 不能把其他题型闭合猜成当前题目结束，也不能让正则回退静默遗漏选项。
        if re.search(r"</(?:question|select|multi_select|confirm|input|questions)\b", body, re.IGNORECASE):
            raise AskUserQuestionParseError("ambiguous_question_close", number)
        option_opens = len(re.findall(r"<option\b", body, re.IGNORECASE))
        option_closes = len(re.findall(r"</option\s*>", body, re.IGNORECASE))
        options = list(_OPTION_RE.finditer(body))
        if any(not option.group(1).strip() for option in options):
            raise AskUserQuestionParseError("empty_option", number)
        if any(re.search(r"<option\b", option.group(1), re.IGNORECASE) for option in options):
            raise AskUserQuestionParseError("nested_options", number)
        if option_opens != option_closes or option_opens != len(options):
            raise AskUserQuestionParseError("incomplete_options", number)

        parsed = _try_parse_with_et(attrs_str, body)
        if parsed is None:
            parsed = _parse_with_regex(attrs_str, body)
        if not parsed or not parsed["question"]:
            raise AskUserQuestionParseError("empty_question", number)
        if parsed["interaction_type"] in {"select", "multi_select"}:
            actual_options = [o for o in (parsed["options"] or []) if o.lower() != OTHER_OPTION_LABEL.lower()]
            if not actual_options:
                raise AskUserQuestionParseError("missing_choices", number)
        questions.append(parsed)

    return QuestionParseResult(questions, tuple(repairs))


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
    for opt in elem:
        if not isinstance(opt.tag, str) or opt.tag.lower() != "option":
            continue
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
    """沿用旧题型归一规则，未知题型作为输入题处理。"""
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
    """有候选的选择题仅补充一次保留的自由输入选项。"""
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
    """生成本次准备过程共享的题目身份与既有结构字段。"""
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
