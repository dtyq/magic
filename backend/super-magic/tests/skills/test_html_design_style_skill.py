"""html-design-style Skill 的静态契约测试。"""

from pathlib import Path

SKILL_ROOT = Path(__file__).parents[2] / "agents" / "skills" / "html-design-style"
SKILL_PATH = SKILL_ROOT / "SKILL.md"


def test_skill_has_no_local_design_md_copy() -> None:
    """设计源文由 Magic Service 持有，Skill 目录不得保留副本。"""
    assert not (SKILL_ROOT / "references").exists()
    assert not list(SKILL_ROOT.rglob("DESIGN.md"))


def test_skill_fetches_source_through_code_mode_tool() -> None:
    """Skill 必须通过 Code Mode 工具调用 Magic Service，而不是读取本地文件或另起 python 进程。"""
    content = SKILL_PATH.read_text(encoding="utf-8")

    assert 'tool.call("get_html_design_style_source"' in content
    assert "get_design_style_source.py" not in content
    assert not (SKILL_ROOT / "scripts").exists()
    assert "references/styles" not in content
    assert "Magic Service" in content
    assert "Do not reconstruct the design system from a catalog" in content


def test_skill_preserves_content_and_reports_failure() -> None:
    """Skill 必须保留原有内容与行为、创建新版本，并在失败时不覆盖文件。"""
    content = SKILL_PATH.read_text(encoding="utf-8")

    assert "Preserve the current page content" in content
    assert "creates a new file version" in content
    assert "keeps the previous version available for restore" in content
    assert "do not overwrite the target file" in content
    assert "MagicAgentApi" in content
