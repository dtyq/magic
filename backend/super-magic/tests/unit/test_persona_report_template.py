"""验证报告模板的阅读顺序与引用完整性，不依赖 Agent 运行环境。"""

from html.parser import HTMLParser
from pathlib import Path
import unittest


TEMPLATE = Path(__file__).resolve().parents[2] / "agents/skills/persona-research/reference/report-template.html"


class ReportDocument(HTMLParser):
    def __init__(self, content):
        super().__init__()
        self.ids = []
        self.sections = []
        self.contents = []
        self.citations = []
        self.before_summary = []
        self.in_contents = False
        self.generated_contents = False
        self.summary_seen = False
        self.current_section = None
        self.evidence_bars = []
        self.bar_depth = 0
        self.in_citation = False
        self.feed(content)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get("class", "").split()
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if self.bar_depth:
            self.bar_depth += 1
        elif "evidence-bar" in classes:
            self.bar_depth = 1
            self.evidence_bars.append({"section": self.current_section, "citations": [], "text": ""})
        if tag == "section":
            self.current_section = attrs.get("id")
            self.sections.append(attrs.get("id"))
            self.summary_seen |= attrs.get("id") == "summary"
        if not self.summary_seen:
            self.before_summary.append((tag, attrs))
        if tag == "aside" and "toc" in classes:
            self.in_contents = True
            self.generated_contents = "data-contents-from-headings" in attrs
        if tag == "a" and self.in_contents:
            self.contents.append(attrs.get("href", "").removeprefix("#"))
        if tag == "a" and "citation-ref" in classes:
            self.citations.append(attrs.get("href", "").removeprefix("#"))
            if self.bar_depth:
                self.in_citation = True
                self.evidence_bars[-1]["citations"].append(attrs.get("href"))

    def handle_data(self, data):
        if self.bar_depth and not self.in_citation:
            self.evidence_bars[-1]["text"] += data

    def handle_endtag(self, tag):
        if self.bar_depth:
            self.bar_depth -= 1
        if tag == "a":
            self.in_citation = False
        if tag == "aside":
            self.in_contents = False


class PersonaReportTemplateTest(unittest.TestCase):
    def setUp(self):
        self.document = ReportDocument(TEMPLATE.read_text(encoding="utf-8"))

    def test_reading_order_and_contents_agree(self):
        expected = [
            "summary", "hypotheses", "business", "method", "findings", "real-voices",
            "tensions", "personas", "voices", "limitations", "validation", "sources",
        ]
        self.assertEqual(self.document.sections, expected)
        # 目录由页面脚本按各章节的标题生成，模板里不再手写一份会漏译的链接清单。
        self.assertTrue(self.document.generated_contents)
        self.assertEqual(self.document.contents, [])

    def test_page_chrome_has_no_hand_written_labels(self):
        text = TEMPLATE.read_text(encoding="utf-8")
        for sample in ("Trial Churn", "Template preview", "TRANSLATE"):
            self.assertNotIn(sample, text.split("<main")[0].split("<body")[1], sample)
        self.assertIn("window.reportLabels", text)
        self.assertIn("data-contents-list", text)

    def test_decision_precedes_decorative_and_method_content(self):
        for tag, attrs in self.document.before_summary:
            self.assertNotEqual(tag, "figure")
            self.assertNotIn("data-persona", attrs)
            self.assertNotIn("fact", attrs.get("class", "").split())

    def test_citations_resolve_to_unique_targets(self):
        self.assertTrue(self.document.citations)
        self.assertEqual(len(self.document.ids), len(set(self.document.ids)))
        self.assertEqual(set(self.document.citations) - set(self.document.ids), set())

    def test_claim_evidence_is_cited_without_recycling_study_totals(self):
        study_bars = [bar for bar in self.document.evidence_bars if bar["section"] == "summary"]
        claim_bars = [bar for bar in self.document.evidence_bars if bar["section"] != "summary"]
        self.assertEqual(len(study_bars), 1)
        self.assertRegex(study_bars[0]["text"], r"\d")
        self.assertTrue(claim_bars)
        for bar in claim_bars:
            self.assertTrue(bar["citations"], bar["section"])
            self.assertNotRegex(bar["text"], r"(?:interviews|sources)[^.;]*:\s*\d", bar["section"])


if __name__ == "__main__":
    unittest.main()
