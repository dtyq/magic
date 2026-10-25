"""头像绑定的文件隔离、失败降级与报告可携带快照，不调用生图服务。"""

import base64
import io
import json
import re

import pytest
from PIL import Image

from agentlang.context.tool_context import ToolContext
from app.tools.persona_research.persona_portraits import AttachPersonaPortrait, AttachPersonaPortraitParams
from app.tools.persona_research.embed_persona_portraits import EmbedPersonaPortraits, EmbedPersonaPortraitsParams
from app.tools.persona_research.update_study import UpdateStudy, UpdateStudyParams
from app.tools.persona_research.save_personas import SavePersonas, SavePersonasParams
from app.utils.async_file_utils import (
    async_mkdir,
    async_read_bytes,
    async_read_text,
    async_write_bytes,
    async_write_text,
    async_symlink,
)

PID = "p_test_ab12"


async def write(root, path, value):
    target = root / path
    await async_mkdir(target.parent, parents=True, exist_ok=True)
    await async_write_text(target, json.dumps(value))


async def source(root, name="source.png", color="red"):
    output = io.BytesIO()
    Image.new("RGB", (640, 640), color).save(output, format="PNG")
    await async_write_bytes(root / name, output.getvalue())
    return name


async def profile(root):
    await write(
        root,
        f"personas/{PID}.json",
        {"schema_version": 1, "id": PID, "name": "Test", "tier": "generated", "evidence": []},
    )


async def attach(root, path="source.png", replace=False):
    return await AttachPersonaPortrait(base_dir=root).execute(
        ToolContext(),
        AttachPersonaPortraitParams(persona_id=PID, image_path=path, replace=replace),
    )


@pytest.mark.asyncio
async def test_binds_small_webp_without_changing_research_fields(tmp_path):
    await profile(tmp_path)
    await source(tmp_path)
    result = await attach(tmp_path)
    assert result.ok, result.content
    saved = json.loads(await async_read_text(tmp_path / f"personas/{PID}.json"))
    assert saved["tier"] == "generated" and saved["evidence"] == []
    bound = saved["portrait"]
    assert bound["file"].startswith(f"personas/portraits/{PID}/")
    data = await async_read_bytes(tmp_path / bound["file"])
    with Image.open(io.BytesIO(data)) as image:
        assert image.format == "WEBP" and image.size == (320, 320)
    assert len(data) < 40_000
    # 重复调用不换脸、不更新时间；即便调用参数里的新图片暂不可用。
    again = await attach(tmp_path, "missing.png")
    assert again.ok and again.data["portrait"] == bound


@pytest.mark.asyncio
@pytest.mark.parametrize("bad_path", ["missing.png", "invalid.png", "../escape.png", "/absolute.png"])
async def test_failed_replacement_preserves_previous_profile(tmp_path, bad_path):
    await profile(tmp_path)
    await source(tmp_path)
    assert (await attach(tmp_path)).ok
    previous = await async_read_text(tmp_path / f"personas/{PID}.json")
    await async_write_bytes(tmp_path / "invalid.png", b"not an image")
    result = await attach(tmp_path, bad_path, replace=True)
    assert not result.ok
    assert await async_read_text(tmp_path / f"personas/{PID}.json") == previous


@pytest.mark.asyncio
async def test_rejects_source_symlink_outside_workspace(tmp_path):
    root = tmp_path / "workspace"
    await async_mkdir(root)
    await profile(root)
    outside = tmp_path / "private.png"
    await source(tmp_path, outside.name)
    await async_symlink(outside, root / "escape.png")
    result = await attach(root, "escape.png")
    assert not result.ok
    assert "portrait" not in json.loads(await async_read_text(root / f"personas/{PID}.json"))


@pytest.mark.asyncio
async def test_report_embeds_same_bytes_once_and_retains_template_and_ai_disclosure(tmp_path):
    await profile(tmp_path)
    await source(tmp_path)
    attached = await attach(tmp_path)
    await write(tmp_path, "studies/s1/study.json", {"schema_version": 1})
    await write(tmp_path, "studies/s1/panel.json", {"persona_ids": [PID, "p_other_ab34"]})
    # 同名人设不允许按名字猜头像；有 ID 的引用才可明确匹配。
    await write(tmp_path, "personas/p_other_ab34.json", {"id": "p_other_ab34", "name": "Test"})
    report = tmp_path / "studies/s1/report.html"
    original = f'<html><body><p>AI-simulated</p><span data-persona="Test" data-persona-id="{PID}"><svg></svg></span><script>/* citations */</script></body></html>'
    await async_write_text(report, original)
    tool = EmbedPersonaPortraits(base_dir=tmp_path)
    params = EmbedPersonaPortraitsParams(study_dir="studies/s1")
    assert (await tool.execute(ToolContext(), params)).ok
    first = await async_read_text(report)
    assert "AI-simulated" in first and "/* citations */" in first and "<svg>" in first
    manifest = json.loads(re.search(r'id="persona-portrait-assets">(.*?)</script>', first, re.S).group(1))
    assert manifest[1]["src"] == ""  # 未生图的人保持插画，也参与同名歧义判断。
    actual = base64.b64decode(manifest[0]["src"].split(",", 1)[1])
    assert actual == await async_read_bytes(tmp_path / attached.data["portrait"]["file"])
    assert (await tool.execute(ToolContext(), params)).ok
    assert await async_read_text(report) == first


@pytest.mark.asyncio
async def test_unreadable_persona_does_not_block_other_report_portraits(tmp_path):
    await profile(tmp_path)
    await source(tmp_path)
    assert (await attach(tmp_path)).ok
    await write(tmp_path, "studies/s1/study.json", {})
    broken_id = "p_broken_ab34"
    await write(tmp_path, "studies/s1/panel.json", {"persona_ids": [broken_id, PID]})
    await async_write_text(tmp_path / f"personas/{broken_id}.json", '{"id":')
    report = tmp_path / "studies/s1/report.html"
    await async_write_text(report, '<body>AI-simulated<span data-persona="Test"><svg></svg></span></body>')
    result = await EmbedPersonaPortraits(base_dir=tmp_path).execute(
        ToolContext(), EmbedPersonaPortraitsParams(study_dir="studies/s1")
    )
    assert result.ok, result.content
    assert "Embedded 1 bound portraits" in result.content and broken_id in result.content
    html = await async_read_text(report)
    manifest = json.loads(re.search(r'id="persona-portrait-assets">(.*?)</script>', html, re.S).group(1))
    assert manifest[0]["src"] == "" and manifest[1]["src"].startswith("data:image/webp;base64,")
    assert "AI-simulated" in html and "<svg>" in html


@pytest.mark.asyncio
async def test_malformed_panel_id_cannot_read_another_file(tmp_path):
    await write(tmp_path, "studies/s1/study.json", {})
    await write(tmp_path, "studies/s1/panel.json", {"persona_ids": ["../../private"]})
    report = tmp_path / "studies/s1/report.html"
    await async_write_text(report, "<body>AI-simulated</body>")
    result = await EmbedPersonaPortraits(base_dir=tmp_path).execute(
        ToolContext(), EmbedPersonaPortraitsParams(study_dir="studies/s1")
    )
    assert not result.ok
    assert await async_read_text(report) == "<body>AI-simulated</body>"


async def study(root, phase="report", study_type="concept_test"):
    phases = ["clarify", "plan", "desk_research", "interview", "report", "validation"]
    await write(
        root,
        "studies/s1/study.json",
        {
            "schema_version": 1,
            "topic_id": "t1",
            "title": "Study",
            "question": "Question",
            "study_type": study_type,
            "phase": phase,
            "phases": [{"key": key, "status": "running" if key == phase else "done"} for key in phases],
        },
    )


@pytest.mark.asyncio
async def test_report_written_event_automatically_embeds_avatars(tmp_path):
    await profile(tmp_path)
    await source(tmp_path)
    assert (await attach(tmp_path)).ok
    await study(tmp_path)
    await write(tmp_path, "studies/s1/panel.json", {"persona_ids": [PID]})
    await write(tmp_path, "studies/s1/synthesis.json", {})
    report = tmp_path / "studies/s1/report.html"
    await async_write_text(report, '<body>AI-simulated<span data-persona="Test"><svg></svg></span></body>')
    result = await UpdateStudy(base_dir=tmp_path).execute(
        ToolContext(), UpdateStudyParams(event="report_written", study_dir="studies/s1")
    )
    assert result.ok, result.content
    assert "Embedded 1 bound portraits" in result.content
    assert "persona-portrait-assets" in await async_read_text(report)
    assert result.data["phase"] == "validation"


@pytest.mark.asyncio
async def test_saving_personas_preserves_a_concurrent_portrait_binding(tmp_path, monkeypatch):
    await profile(tmp_path)
    await study(tmp_path, phase="done", study_type="persona_build")
    portrait = {"file": f"personas/portraits/{PID}/01234567890123456789.webp", "updated_at": "new"}

    async def prepare(self, base, item, created_in):
        stale = json.loads(await async_read_text(tmp_path / f"personas/{PID}.json"))
        # 准备研究内容之后，另一话题先完成了头像绑定。
        await write(tmp_path, f"personas/{PID}.json", {**stale, "portrait": portrait})
        return stale, True

    monkeypatch.setattr(SavePersonas, "_prepare", prepare)
    result = await SavePersonas(base_dir=tmp_path).execute(
        ToolContext(),
        SavePersonasParams(
            study_dir="studies/s1",
            personas=[{"id": PID, "segment": "Adults", "reason": "Existing persona"}],
            panel_name="Panel",
        ),
    )
    assert result.ok, result.content
    saved = json.loads(await async_read_text(tmp_path / f"personas/{PID}.json"))
    assert saved["portrait"] == portrait


async def second_profile(root, persona_id="p_second_cd34"):
    await write(root, f"personas/{persona_id}.json", {"schema_version": 1, "id": persona_id, "name": "Second", "tier": "generated", "evidence": []})
    return persona_id


@pytest.mark.asyncio
async def test_two_personas_cannot_share_the_same_portrait(tmp_path):
    await profile(tmp_path)
    other = await second_profile(tmp_path)
    await source(tmp_path)
    assert (await attach(tmp_path)).ok
    duplicate = await AttachPersonaPortrait(base_dir=tmp_path).execute(
        ToolContext(), AttachPersonaPortraitParams(persona_id=other, image_path="source.png")
    )
    assert not duplicate.ok and "distinct avatar" in duplicate.content
    assert "portrait" not in json.loads(await async_read_text(tmp_path / f"personas/{other}.json"))
    # 换一张不同的图就可以
    await source(tmp_path, "other.png", "blue")
    different = await AttachPersonaPortrait(base_dir=tmp_path).execute(
        ToolContext(), AttachPersonaPortraitParams(persona_id=other, image_path="other.png")
    )
    assert different.ok, different.content


@pytest.mark.asyncio
async def test_a_persona_can_rebind_its_own_portrait(tmp_path):
    await profile(tmp_path)
    await source(tmp_path)
    first = await attach(tmp_path)
    again = await attach(tmp_path, replace=True)
    assert first.ok and again.ok and again.data["portrait"]["file"] == first.data["portrait"]["file"]
