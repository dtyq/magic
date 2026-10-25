"""persona-research 报告图表：执行 report-charts.md 里的示例代码，确认由 synthesis 数据确定性生成。"""

import re
from pathlib import Path

REFERENCE = Path(__file__).resolve().parents[2] / "agents/skills/persona-research/reference/report-charts.md"

SYNTHESIS = {
    "segments": [
        {"id": "seg_1", "name": "Heavy buyers", "persona_ids": ["p_a", "p_b"]},
        {"id": "seg_2", "name": "Light buyers", "persona_ids": ["p_c"]},
    ],
    "themes": [
        {"id": "T1", "name": "Terms first <b>", "confidence": "high",
         "stance_by_persona": {"p_a": "support", "p_b": "oppose", "p_c": "not_mentioned"}},
        {"id": "T2", "name": "Price anchor", "confidence": "to_validate",
         "stance_by_persona": {"p_a": "mixed", "p_b": "support", "p_c": "support"}},
    ],
}
NAMES = {"p_a": "Ann", "p_b": "Bo", "p_c": "Cy"}
LABELS = {"support": "Support", "oppose": "Oppose", "mixed": "Mixed", "not_mentioned": "Not mentioned"}


def _load():
    code = re.search(r"```python\n(.*?)```", REFERENCE.read_text(encoding="utf-8"), re.S).group(1)
    namespace = {}
    exec(code, namespace)  # noqa: S102 - 文档里的示例代码，测试其可运行
    return namespace


def test_stance_matrix_draws_every_cell_with_symbol_and_no_percentages():
    fragment = _load()["stance_matrix"](SYNTHESIS, NAMES, LABELS)

    assert fragment.count("<tr>") == 2 + len(SYNTHESIS["themes"])
    body = fragment.split("<tbody>")[1].split("</tbody>")[0]
    assert body.count("pr-chart-cell") == 6
    assert "pr-chart-oppose" in body and "✕" in body
    assert "pr-chart-not_mentioned" in body and "·" in body  # 沉默单独显示，不省略
    assert "&lt;b&gt;" in fragment  # 主题名被转义
    assert "%" not in fragment.replace("width:100%", "")


def test_range_strip_places_each_person_and_draws_no_average():
    points = [{"label": f"P{i} {v}", "value": v} for i, v in enumerate([10, 20, 30, 50, 100])]
    svg = _load()["range_strip"](points, 0, 100, " CNY")

    assert svg.count("<circle") == 5
    assert "P4 100" in svg
    assert "mean" not in svg.lower() and "avg" not in svg.lower()
