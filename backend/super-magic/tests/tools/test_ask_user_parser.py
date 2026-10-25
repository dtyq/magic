"""使用合成问卷验证边界恢复，不读取生产数据。"""

import pytest

from app.tools.ask_user_parser import (
    AskUserQuestionParseError,
    QuestionRepairKind,
    parse_questions_xml,
    parse_questions_xml_with_report,
)


@pytest.mark.parametrize("ending", ["</select>", "", "</question>"])
def test_recovers_all_questions_without_crossing_boundaries(ending):
    """错闭合、缺闭合和合法闭合都不吞并相邻题。"""
    raw = (
        '<question type="confirm">确认测试方案？</question>'
        f'<question type="select">选择测试样式？<option>A</option><option>B</option>{ending}'
        f'<question type="select">选择测试声音？<option>C</option><option>D</option>{ending}'
        '</questions>'
    )
    result = parse_questions_xml_with_report(raw)
    assert [q["question"] for q in result.questions] == ["确认测试方案？", "选择测试样式？", "选择测试声音？"]
    assert result.questions[1]["options"] == ["A", "B", "Other"]
    assert result.questions[2]["options"] == ["C", "D", "Other"]
    assert len({q["sub_id"] for q in result.questions}) == 3
    assert QuestionRepairKind.STRAY_CONTAINER_CLOSE in [r.kind for r in result.repairs]


@pytest.mark.parametrize("raw,code", [
    ('<question type="input"> </question>', "empty_question"),
    ('<question type="select">测试？</question>', "missing_choices"),
    ('<question type="select">测试？<option>A</question>', "incomplete_options"),
    ('<question type="input">测试？</question><question type="select"', "incomplete_question_open"),
    ('<question type="select">测试？<option><option>A</option></option></question>', "nested_options"),
])
def test_rejects_partial_or_ambiguous_questionnaire(raw, code):
    """任何题目无效都不能返回前面题目的成功子集。"""
    with pytest.raises(AskUserQuestionParseError) as caught:
        parse_questions_xml('<question type="confirm">占位确认？</question>' + raw)
    assert caught.value.code == code


def test_preserves_legacy_attributes_and_valid_question_types():
    """属性兼容与默认值保持原有语义。"""
    raw = (
        '<questions><question type="confirm" default="yes">A & B？</question>'
        "<question type='input' placeholder='测试占位'>输入？</question>"
        '<question type=multi_select min=1 max=2>多选？<option>A</option></question>'
        '<question type="unknown">备注？</question></questions>'
    )
    result = parse_questions_xml_with_report(raw)
    assert not result.repairs
    assert [q["interaction_type"] for q in result.questions] == ["confirm", "input", "multi_select", "input"]
    assert result.questions[0]["question"] == "A & B？"
    assert result.questions[0]["default_value"] == "yes"
    assert result.questions[1]["placeholder"] == "测试占位"
    assert result.questions[2]["min_select"] == 1
    assert result.questions[2]["max_select"] == 2


def test_empty_input_has_no_questions_or_repairs():
    """无题内容仍由工具入口统一拒绝。"""
    assert parse_questions_xml("") == []
    assert parse_questions_xml("普通说明") == []


def test_preserves_valid_closing_whitespace_and_uppercase_options():
    """合法闭合空格与大小写不能被完整性检查误判。"""
    result = parse_questions_xml('<QUESTION type="select">测试？<OPTION>A</OPTION ></QUESTION >')
    assert result[0]["options"] == ["A", "Other"]


@pytest.mark.parametrize("raw", [
    '<question>外层？<question>内层？</question></question>',
    '<question>占位？</question><option>A</option>',
    '<question type="select">占位？<option>A</option><option> </option></question>',
    '<question type="select">占位？<option>A</option></select><option>B</option>',
    '<question type="input">占位？</confirm>',
])
def test_rejects_nested_or_trailing_structural_data(raw):
    """未知结构和闭合后候选不能被丢弃为成功问卷。"""
    with pytest.raises(AskUserQuestionParseError):
        parse_questions_xml(raw)


@pytest.mark.parametrize("kind", ["confirm", "input", "multi_select"])
def test_recovers_other_type_closing_names(kind):
    """各已识别题型的自然错写均通过同一恢复规则。"""
    options = '<option>A</option>' if kind == 'multi_select' else ''
    result = parse_questions_xml_with_report(f'<question type="{kind}">占位？{options}</{kind}>')
    assert len(result.questions) == 1
    assert result.repairs[0].kind == QuestionRepairKind.WRONG_CLOSE
