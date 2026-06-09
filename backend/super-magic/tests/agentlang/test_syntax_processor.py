from agentlang.agent import syntax as syntax_module
from agentlang.agent.syntax import SyntaxProcessor


def test_literal_double_brace_blocks_remain_raw():
    processor = SyntaxProcessor()
    prompt = '所有 `{{占位符}}` 必须替换，示例 {{ @ }} 和 {{ @unknown("x") }}'

    assert processor.process_dynamic_syntax(prompt) == prompt


def test_variable_blocks_resolve_or_fallback_with_warning(monkeypatch):
    warnings = []
    monkeypatch.setattr(syntax_module.logger, "warning", lambda message, *args, **kwargs: warnings.append(message))

    processor = SyntaxProcessor()
    processor.set_variables({"name": "Alice"})

    result = processor.process_dynamic_syntax(
        '{{ @variable("name") }} {{ @variable("missing") }} {{ @variable("missing_with_default", "fallback") }}'
    )

    assert result == 'Alice {{ @variable("missing") }} fallback'
    assert len(warnings) == 1
    assert "syntax=@variable" in warnings[0]
    assert "key=missing" in warnings[0]


def test_missing_include_falls_back_with_warning(monkeypatch, tmp_path):
    warnings = []
    monkeypatch.setattr(syntax_module.logger, "warning", lambda message, *args, **kwargs: warnings.append(message))

    processor = SyntaxProcessor(tmp_path)
    prompt = 'before {{ @include(path="./missing.prompt") }} after'

    assert processor.process_dynamic_syntax(prompt) == prompt
    assert len(warnings) == 1
    assert "syntax=@include" in warnings[0]
    assert "path=./missing.prompt" in warnings[0]


def test_existing_include_resolves_and_recurses_best_effort(tmp_path):
    (tmp_path / "exists.prompt").write_text(
        'Hello {{ @variable("name") }} {{占位符}} {{ @include(path="./missing.prompt") }}',
        encoding="utf-8",
    )
    processor = SyntaxProcessor(tmp_path)
    processor.set_variables({"name": "Alice"})

    result = processor.process_dynamic_syntax('{{ @include(path="./exists.prompt") }}')

    assert result == 'Hello Alice {{占位符}} {{ @include(path="./missing.prompt") }}'
