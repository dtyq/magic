import re

import pytest
import yaml

from app.path_manager import PathManager
from app.service.crew_agent_compiler import CrewAgentCompiler


def _extract_frontmatter(content: str) -> dict:
    match = re.match(r"^---\n(.*?)\n---\n", content, re.S)
    assert match is not None
    return yaml.safe_load(match.group(1))


@pytest.mark.asyncio
async def test_compile_includes_knowledge_search_tool_by_default(monkeypatch, tmp_path):
    crew_dir = tmp_path / "crew"
    crew_dir.mkdir()

    (crew_dir / "IDENTITY.md").write_text(
        "---\nname: Knowledge Agent\n---\nYou answer with enterprise context.\n",
        encoding="utf-8",
    )
    (crew_dir / "TOOLS.md").write_text(
        "---\ntools:\n  - web_search\n---\n",
        encoding="utf-8",
    )

    template_path = tmp_path / "crew.template.agent"
    template_path.write_text(
        "---\nllm: main_llm\ntools:\n  - web_search\n  - search_knowledge\n---\n<identity>\nCREW_ROLE\n</identity>\n",
        encoding="utf-8",
    )
    output_path = tmp_path / "compiled.agent"

    monkeypatch.setattr(
        PathManager,
        "get_crew_template_file",
        classmethod(lambda cls: template_path),
    )
    monkeypatch.setattr(
        PathManager,
        "get_compiled_agent_file",
        classmethod(lambda cls, agent_code: output_path),
    )

    compiler = CrewAgentCompiler()
    await compiler.compile("SMA-test-agent", crew_dir)

    compiled = output_path.read_text(encoding="utf-8")
    frontmatter = _extract_frontmatter(compiled)

    assert "search_knowledge" in frontmatter["tools"]
    assert frontmatter["tools"].count("search_knowledge") == 1


@pytest.mark.asyncio
async def test_compile_respects_template_defaults_and_tool_overrides(monkeypatch, tmp_path):
    crew_dir = tmp_path / "crew"
    crew_dir.mkdir()

    (crew_dir / "IDENTITY.md").write_text(
        "---\nname: Tool Agent\n---\nYou resolve tool combinations.\n",
        encoding="utf-8",
    )
    (crew_dir / "TOOLS.md").write_text(
        "---\ntools:\n  - web_search\n  - custom_tool\nexclude_builtin_tools:\n  - search_knowledge\n  - read_webpages_as_markdown\n---\n",
        encoding="utf-8",
    )

    template_path = tmp_path / "crew.template.agent"
    template_path.write_text(
        "---\nllm: main_llm\ntools:\n  - web_search\n  - search_knowledge\n  - read_webpages_as_markdown\n  - visual_understanding\n---\n<identity>\nCREW_ROLE\n</identity>\n",
        encoding="utf-8",
    )
    output_path = tmp_path / "compiled.agent"

    monkeypatch.setattr(
        PathManager,
        "get_crew_template_file",
        classmethod(lambda cls: template_path),
    )
    monkeypatch.setattr(
        PathManager,
        "get_compiled_agent_file",
        classmethod(lambda cls, agent_code: output_path),
    )

    compiler = CrewAgentCompiler()
    await compiler.compile("SMA-test-agent", crew_dir)

    compiled = output_path.read_text(encoding="utf-8")
    frontmatter = _extract_frontmatter(compiled)

    assert frontmatter["tools"] == [
        "web_search",
        "visual_understanding",
        "custom_tool",
    ]
