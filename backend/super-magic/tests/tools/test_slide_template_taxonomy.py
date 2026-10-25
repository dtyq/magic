import pytest

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.infrastructure.magic_service.client import MagicServiceClient
from app.infrastructure.magic_service.config import MagicServiceConfig
from app.tools.slide_template_builder import QuerySlideTemplateTaxonomy
from app.tools.slide_template_builder.query_taxonomy import QuerySlideTemplateTaxonomyParams
from app.tools.slide_template_builder.taxonomy import load_taxonomy
from app.tools.slide_template_builder.taxonomy_source import TaxonomySnapshot
from tests.tools.conftest import ORIGINAL_RESOLVE_TAXONOMY


def _tool() -> QuerySlideTemplateTaxonomy:
    return QuerySlideTemplateTaxonomy()


def _context() -> ToolContext:
    return ToolContext(tool_name="query_slide_template_taxonomy", arguments={})


def test_query_slide_template_taxonomy_is_code_mode_only():
    assert QuerySlideTemplateTaxonomy.code_mode_only is True


@pytest.mark.asyncio
async def test_query_returns_index_in_content_and_full_catalog_in_data():
    result = await _tool().execute(_context(), QuerySlideTemplateTaxonomyParams())

    assert result.ok
    assert result.data["source"] == "fallback"
    assert any(item["code"] == "PPT-CATE-education-training" for item in result.data["categories"])
    purpose = next(item for item in result.data["groups"] if item["code"] == "purpose_group")
    assert any(tag["code"] == "purpose-training-course" for tag in purpose["tags"])
    assert purpose["tags"][0]["zh"]
    assert "PPT-CATE-education-training" in result.content
    assert "Education" in result.content
    assert "purpose_group" in result.content
    assert "purpose-training-course" not in result.content
    # 片段之间不共享状态，第二次查目录比一次全量打印更贵
    assert "does not survive into your next snippet" in result.content
    assert "Do not substring-search names" in result.content
    assert "audience, use case, and decision" in result.content


@pytest.mark.asyncio
async def test_query_uses_live_catalog(monkeypatch):
    live = {
        "categories": [
            {
                "code": "PPT-CATE-education-training",
                "name_i18n": {"zh_CN": "教育培训", "en_US": "Education"},
                "status": 1,
            }
        ],
        "groups": [{"code": "purpose_group", "name_i18n": {"zh_CN": "用途", "en_US": "Purpose"}}],
        "tags": [
            {
                "code": "purpose-live-only",
                "group_code": "purpose_group",
                "name_i18n": {"zh_CN": "线上标签", "en_US": "Live"},
                "status": 1,
            }
        ],
    }

    async def _resolve(access_context=None):
        return TaxonomySnapshot(catalog=live, source="live")

    monkeypatch.setattr("app.tools.slide_template_builder.taxonomy_source.resolve_taxonomy", _resolve)
    result = await _tool().execute(_context(), QuerySlideTemplateTaxonomyParams())

    assert result.ok
    assert result.data["source"] == "live"
    assert result.data["groups"][0]["tags"][0]["code"] == "purpose-live-only"
    assert "purpose-live-only" not in result.content
    assert "purpose-training-course" not in result.content


@pytest.mark.asyncio
async def test_resolve_taxonomy_falls_back_when_api_fails(monkeypatch):
    class BoomClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get_slides_template_taxonomy(self, access_context=None):
            raise RuntimeError("taxonomy api down")

    monkeypatch.setattr("app.tools.slide_template_builder.taxonomy_source.MagicServiceClient", BoomClient)
    monkeypatch.setattr(
        "app.tools.slide_template_builder.taxonomy_source.resolve_taxonomy",
        ORIGINAL_RESOLVE_TAXONOMY,
    )
    snapshot = await ORIGINAL_RESOLVE_TAXONOMY()

    assert snapshot.source == "fallback"
    assert snapshot.catalog == load_taxonomy()


@pytest.mark.asyncio
async def test_magic_service_client_resolves_taxonomy_endpoint():
    class RecordingMagicServiceClient(MagicServiceClient):
        def __init__(self):
            super().__init__(MagicServiceConfig(api_base_url="https://magic.example.test"))
            self.call = None

        async def _request_json(
            self,
            method,
            path,
            payload=None,
            operation_name="Magic Service API",
            params=None,
        ):
            self.call = (method, path, payload, operation_name, params)
            return {"categories": [], "groups": [], "tags": []}

    client = RecordingMagicServiceClient()
    result = await client.get_slides_template_taxonomy(
        {"topic_id": " topic-1 ", "project_id": "project-1", "task_id": ""}
    )

    assert client.call == (
        "GET",
        "/api/v1/open-api/slides-templates/taxonomy",
        None,
        "幻灯片模板分类标签获取",
        {"topic_id": "topic-1", "project_id": "project-1"},
    )
    assert result == {"categories": [], "groups": [], "tags": []}


@pytest.mark.asyncio
async def test_query_has_product_facing_remarks():
    tool = _tool()
    before = await tool.get_before_tool_call_friendly_action_and_remark(tool.name, _context(), {})
    after = await tool.get_after_tool_call_friendly_action_and_remark(
        tool.name,
        _context(),
        ToolResult(content="ok", data={"source": "live"}),
        0.1,
        {},
    )

    assert before["action"]
    assert "分类" in before["remark"] or "categor" in before["remark"].lower()
    assert after["action"]
    assert "列出" in after["remark"] or "listed" in after["remark"].lower()
