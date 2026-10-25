import json
from contextlib import asynccontextmanager
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from agentlang.agent.define.parser import parse_agent_file
from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.utils.syntax_checker import SyntaxCheckResult
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.analysis_slide_webpage import AnalysisSlideWebpage, AnalysisSlideWebpageParams
from app.tools.core import tool_factory
from app.tools.core.tool_executor import ToolExecutor
from app.tools.create_slide import CreateSlide, CreateSlideParams, _extract_slide_notes
from app.tools.create_slide_project import CreateSlideProject, CreateSlideProjectParams
from app.utils.async_file_utils import async_exists, async_read_text, async_write_text


SLIDE_ARGS = {
    "file_path": "deck/cover.html",
    "content": "<html><body><main>Cover</main></body></html>",
    "max_width": 1920,
    "max_height": 1080,
    "analysis_js": "return {issues: []};",
    "insert_after_slide": "",
}
TOOLS = [
    ("create_slide_project", CreateSlideProject, CreateSlideProjectParams, {"project_path": "deck"}),
    ("create_slide", CreateSlide, CreateSlideParams, SLIDE_ARGS),
    ("analysis_slide_webpage", AnalysisSlideWebpage, AnalysisSlideWebpageParams,
     {"target": "deck/cover.html", "max_width": 1920, "max_height": 1080}),
]


def context_for(name, code_mode=True):
    context = ToolContext(tool_name=name, tool_call_id="slide-code-mode-test")
    context.register_extension("is_code_mode", code_mode)
    return context


@pytest.mark.parametrize("name,tool_class,params_class,arguments", TOOLS)
def test_slide_tools_are_available_only_through_code_mode(name, tool_class, params_class, arguments):
    assert tool_factory.is_code_mode_only_tool(name)
    assert name not in tool_factory.get_llm_direct_tool_names()
    with pytest.raises(ValueError, match="Code Mode only"):
        tool_factory.get_llm_direct_tool_param_from_definition(name)
    assert tool_factory.get_tool_instance(name).allow_code_mode()


@pytest.mark.asyncio
@pytest.mark.parametrize("name,tool_class,params_class,arguments", TOOLS)
@pytest.mark.parametrize("code_mode", [False, True])
async def test_executor_routes_slide_tools_only_from_code_mode(
    name, tool_class, params_class, arguments, code_mode,
):
    # 隔离写入及浏览器依赖，保留真实执行入口、注册策略和参数转换。
    with patch.object(tool_class, "execute", AsyncMock(return_value=ToolResult(content="Completed"))) as execute:
        result = await ToolExecutor().execute_tool_call(context_for(name, code_mode), arguments)

    assert result.ok is code_mode
    if code_mode:
        execute.assert_awaited_once()
        assert isinstance(execute.await_args.args[1], params_class)
        assert execute.await_args.args[1].model_dump() == params_class(**arguments).model_dump()
    else:
        assert "Code Mode only" in result.content
        execute.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("name,tool_class,params_class,arguments", TOOLS)
async def test_code_mode_rejects_invalid_slide_parameters_before_execution(
    name, tool_class, params_class, arguments,
):
    invalid = dict(arguments)
    invalid.pop(next(iter(arguments)))
    with patch.object(tool_class, "execute", AsyncMock()) as execute:
        result = await ToolExecutor().execute_tool_call(context_for(name), invalid)
    assert not result.ok
    execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_slider_loads_skill_without_direct_slide_tool_mounts():
    root = Path(__file__).parents[2]
    agent = parse_agent_file(await async_read_text(root / "agents/slider.agent"))[0]
    assert "creating-slides" in agent.skills_config.get_system_skill_names()
    assert not {item[0] for item in TOOLS}.intersection(agent.tools_config)


@pytest.mark.asyncio
async def test_code_mode_project_and_page_updates_preserve_deck_state(tmp_path):
    project = CreateSlideProject(base_dir=tmp_path)
    page = CreateSlide(base_dir=tmp_path)
    instances = {"create_slide_project": project, "create_slide": page}
    executor = ToolExecutor()

    @asynccontextmanager
    async def local_versioning(_self, _context, file_path, track_in_horizon=True):
        # 只隔离远程版本事件，保留真实文件写入、备注处理及项目解析。
        yield await async_exists(file_path)

    with (
        patch.object(executor, "get_tool", side_effect=instances.get),
        patch.object(AbstractFileTool, "_file_versioning_context", local_versioning),
        patch.object(CreateSlide, "_analyze_with_browser", AsyncMock(return_value='{"issues": []}')),
        patch("app.tools.write_file.SyntaxChecker.check_syntax", AsyncMock(return_value=SyntaxCheckResult(is_valid=True))),
    ):
        result = await executor.execute_tool_call(context_for("create_slide_project"), {"project_path": "deck"})
        assert result.ok, result.content
        deck = tmp_path / "deck"
        for name in ("index.html", "magic.project.js", "slide-bridge.js", "images"):
            assert await async_exists(deck / name)
        assert not await async_exists(deck / "slide-todo.md")
        assert not await async_exists(deck / "slide-images.md")

        for filename, anchor, notes in (("cover.html", "", "Opening notes"), ("body.html", "cover.html", "Body notes")):
            arguments = {**SLIDE_ARGS, "file_path": f"deck/{filename}", "insert_after_slide": anchor, "speaker_notes": notes}
            result = await executor.execute_tool_call(context_for("create_slide"), arguments)
            assert result.ok, result.content

        config_path = deck / "magic.project.js"
        config = await page._parse_magic_project_config(config_path)
        assert config["slides"] == ["cover.html", "body.html"]
        transitions = {"default": {"effect": "none"}, "slides": {"cover.html": {
            "effect": "fade", "duration_ms": 400, "easing": "linear",
        }}}
        config["transitions"] = transitions
        await async_write_text(config_path, "window.magicProjectConfig = " + json.dumps(config) + ";\n")
        original_config = await async_read_text(config_path)

        # 二次编辑省略备注、给出不同锚点，原备注/页面顺序/过渡配置仍应保留。
        result = await executor.execute_tool_call(context_for("create_slide"), {
            **SLIDE_ARGS, "content": "<html><body><main>Updated cover</main></body></html>",
            "insert_after_slide": "body.html",
        })
        assert result.ok, result.content
        saved = await async_read_text(deck / "cover.html")
        assert "Updated cover" in saved
        assert _extract_slide_notes(saved) == "Opening notes"
        assert await async_read_text(config_path) == original_config

        result = await executor.execute_tool_call(context_for("create_slide"), {**SLIDE_ARGS, "speaker_notes": ""})
        assert result.ok, result.content
        assert _extract_slide_notes(await async_read_text(deck / "cover.html")) == ""
        assert await async_read_text(config_path) == original_config
