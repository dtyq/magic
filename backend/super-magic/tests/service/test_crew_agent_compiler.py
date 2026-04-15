import re

import pytest
import yaml

from app.path_manager import PathManager
from app.service.crew_agent_compiler import KNOWLEDGE_SEARCH_TOOL, CrewAgentCompiler


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
        "---\nllm: main_llm\n---\n<identity>\nCREW_ROLE\n</identity>\n",
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
    monkeypatch.setattr(
        "app.service.crew_agent_compiler.get_magic_service_sdk",
        lambda: (_ for _ in ()).throw(
            AssertionError("compile should not query knowledge binding state")
        ),
        raising=False,
    )

    compiler = CrewAgentCompiler()
    await compiler.compile("SMA-test-agent", crew_dir)

    compiled = output_path.read_text(encoding="utf-8")
    frontmatter = _extract_frontmatter(compiled)

    assert KNOWLEDGE_SEARCH_TOOL in frontmatter["tools"]
    assert frontmatter["tools"].count(KNOWLEDGE_SEARCH_TOOL) == 1
