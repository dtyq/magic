"""从官方头像库绑定头像：成功、复用、图库不可用、候选顺延；使用假客户端，不访问网络。"""

import io
import json

import pytest
from PIL import Image

from agentlang.context.tool_context import ToolContext
from app.tools.persona_research import assign_persona_portraits as module
from app.tools.persona_research.assign_persona_portraits import (
    AssignPersonaPortraits,
    AssignPersonaPortraitsParams,
    PersonaPortraitRequest,
)
from app.utils.async_file_utils import async_mkdir, async_read_bytes, async_read_text, async_write_text

PID = "p_test_ab12"


def png(color="red"):
    output = io.BytesIO()
    Image.new("RGB", (400, 400), color).save(output, format="PNG")
    return output.getvalue()


class FakeClient:
    def __init__(self, catalog, files=None, catalog_error=None):
        self.catalog, self.files, self.catalog_error = catalog, files or {}, catalog_error
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get_persona_avatar_catalog(self, access):
        self.calls.append("catalog")
        if self.catalog_error:
            raise ConnectionError(self.catalog_error)
        return self.catalog

    async def get_persona_avatar_file_url(self, avatar_id, access):
        self.calls.append(f"url:{avatar_id}")
        return {"id": avatar_id, "file_url": f"https://files.test/{avatar_id}"}

    async def download_url_bytes(self, url, max_bytes):
        self.calls.append(f"download:{url.rsplit('/', 1)[1]}")
        data = self.files.get(url.rsplit("/", 1)[1])
        if data is None:
            raise ConnectionError("gone")
        return data


def install(monkeypatch, client):
    monkeypatch.setattr(module, "MagicServiceClient", lambda: client)


async def profile(root):
    target = root / f"personas/{PID}.json"
    await async_mkdir(target.parent, parents=True, exist_ok=True)
    await async_write_text(target, json.dumps({"schema_version": 1, "id": PID, "name": "Test", "tier": "generated"}))


async def run(root, replace=False, **request):
    params = AssignPersonaPortraitsParams(requests=[PersonaPortraitRequest(persona_id=PID, **request)], replace=replace)
    return await AssignPersonaPortraits(base_dir=root).execute(ToolContext(), params)


def item(entry_id, **tags):
    return {"id": entry_id, "tags": {k: v for k, v in tags.items()}}


@pytest.mark.asyncio
async def test_binds_best_match_as_small_webp_in_workspace(tmp_path, monkeypatch):
    await profile(tmp_path)
    catalog = {"items": [item("a1", country=["CN"], gender=["feminine"], age_band=["35_44"], industry=["C"]),
                         item("a2", country=["US"], gender=["feminine"], age_band=["35_44"], industry=["C"])]}  # fmt: skip
    client = FakeClient(catalog, {"a1": png("blue"), "a2": png("green")})
    install(monkeypatch, client)
    result = await run(tmp_path, age=38, gender="feminine", country="CN", industry="C")
    assert result.ok, result.content
    outcome = result.data["results"][0]
    assert outcome["status"] == "assigned" and outcome["asset_id"] == "a1" and outcome["match"] == "exact"
    saved = json.loads(await async_read_text(tmp_path / f"personas/{PID}.json"))
    assert saved["tier"] == "generated" and saved["portrait"]["file"].startswith(f"personas/portraits/{PID}/")
    with Image.open(io.BytesIO(await async_read_bytes(tmp_path / saved["portrait"]["file"]))) as image:
        assert image.format == "WEBP" and image.size == (320, 320)
    # 原图不落临时文件：工作区只有人设和最终头像
    files = sorted(p.relative_to(tmp_path).as_posix() for p in tmp_path.rglob("*") if p.is_file())
    assert files == [f"personas/{PID}.json", saved["portrait"]["file"]]


@pytest.mark.asyncio
async def test_reuses_existing_portrait_without_calling_the_library(tmp_path, monkeypatch):
    await profile(tmp_path)
    client = FakeClient({"items": [item("a1", gender=["feminine"], age_band=["25_34"])]}, {"a1": png()})
    install(monkeypatch, client)
    first = await run(tmp_path, gender="feminine")
    again_client = FakeClient({"items": []})
    install(monkeypatch, again_client)
    again = await run(tmp_path, gender="feminine")
    assert again.ok and again.data["results"][0]["status"] == "reused"
    assert again.data["results"][0]["portrait"] == first.data["results"][0]["portrait"]
    assert again_client.calls == []


@pytest.mark.asyncio
async def test_library_unavailable_keeps_persona_unchanged(tmp_path, monkeypatch):
    await profile(tmp_path)
    before = await async_read_text(tmp_path / f"personas/{PID}.json")
    install(monkeypatch, FakeClient({}, catalog_error="down"))
    result = await run(tmp_path, gender="feminine")
    assert not result.ok and result.data["results"][0]["status"] == "unavailable"
    assert await async_read_text(tmp_path / f"personas/{PID}.json") == before
    # 空目录同样视为暂不可用，而不是「没有合适的图」
    install(monkeypatch, FakeClient({"items": []}))
    assert (await run(tmp_path)).data["results"][0]["status"] == "unavailable"


@pytest.mark.asyncio
async def test_failed_download_falls_through_to_next_candidate(tmp_path, monkeypatch):
    await profile(tmp_path)
    catalog = {
        "items": [item("best", country=["CN"], age_band=["25_34"]), item("next", country=["US"], age_band=["25_34"])]
    }
    client = FakeClient(catalog, {"next": png()})  # best 下载失败
    install(monkeypatch, client)
    result = await run(tmp_path, age=28, country="CN")
    outcome = result.data["results"][0]
    assert outcome["status"] == "assigned" and outcome["asset_id"] == "next" and outcome["match"] == "generic"
    assert "country" in outcome["unmet"]


@pytest.mark.asyncio
async def test_no_match_is_valid_and_leaves_persona_unchanged(tmp_path, monkeypatch):
    await profile(tmp_path)
    install(monkeypatch, FakeClient({"items": [item("m", gender=["masculine"], age_band=["25_34"])]}, {"m": png()}))
    result = await run(tmp_path, gender="feminine")
    assert result.ok and result.data["results"][0]["status"] == "no_match" and result.data["unresolved"] == 1
    assert "portrait" not in json.loads(await async_read_text(tmp_path / f"personas/{PID}.json"))


@pytest.mark.asyncio
async def test_replace_rebinds_and_unknown_persona_fails_alone(tmp_path, monkeypatch):
    await profile(tmp_path)
    # 换形象要选另一张库图：原来那张（及其素材 ID）不再参与选择。
    catalog = {"items": [item("a1", age_band=["25_34"]), item("a2", age_band=["25_34"])]}
    files = {"a1": png("red"), "a2": png("yellow")}
    install(monkeypatch, FakeClient(catalog, files))
    first = await run(tmp_path)
    install(monkeypatch, FakeClient(catalog, files))
    second = await run(tmp_path, replace=True)
    assert second.data["results"][0]["status"] == "assigned"
    assert second.data["results"][0]["portrait"]["file"] != first.data["results"][0]["portrait"]["file"]
    params = AssignPersonaPortraitsParams(requests=[PersonaPortraitRequest(persona_id="p_missing_01")])
    missing = await AssignPersonaPortraits(base_dir=tmp_path).execute(ToolContext(), params)
    assert not missing.ok and missing.data["results"][0]["status"] == "failed"


def test_duplicate_persona_ids_are_rejected():
    with pytest.raises(ValueError):
        AssignPersonaPortraitsParams(requests=[PersonaPortraitRequest(persona_id=PID)] * 2)


async def add_persona(root, persona_id):
    target = root / f"personas/{persona_id}.json"
    await async_mkdir(target.parent, parents=True, exist_ok=True)
    await async_write_text(target, json.dumps({"schema_version": 1, "id": persona_id, "name": persona_id}))


async def run_many(root, ids, replace=False, **request):
    params = AssignPersonaPortraitsParams(
        requests=[PersonaPortraitRequest(persona_id=i, **request) for i in ids], replace=replace
    )
    return await AssignPersonaPortraits(base_dir=root).execute(ToolContext(), params)


@pytest.mark.asyncio
async def test_personas_in_one_batch_never_share_an_avatar(tmp_path, monkeypatch):
    ids = ["p_a_01", "p_b_02", "p_c_03"]
    for persona_id in ids:
        await add_persona(tmp_path, persona_id)
    catalog = {"items": [item(f"a{i}", gender=["feminine"], age_band=["25_34"]) for i in range(5)]}
    install(
        monkeypatch,
        FakeClient(
            catalog, {f"a{i}": png(color) for i, color in enumerate(["red", "green", "blue", "yellow", "black"])}
        ),
    )
    result = await run_many(tmp_path, ids, gender="feminine", age=30)
    assert result.ok and result.data["bound"] == 3
    files = [r["portrait"]["file"] for r in result.data["results"]]
    assert len(set(files)) == 3
    assert len({r["asset_id"] for r in result.data["results"]}) == 3


@pytest.mark.asyncio
async def test_duplicate_content_under_different_catalog_ids_is_still_rejected(tmp_path, monkeypatch):
    ids = ["p_a_01", "p_b_02"]
    for persona_id in ids:
        await add_persona(tmp_path, persona_id)
    # a1 和 a2 是库里重复入库的同一张图；a3 是另一张。
    catalog = {
        "items": [item("a1", age_band=["25_34"]), item("a2", age_band=["25_34"]), item("a3", age_band=["25_34"])]
    }
    same, other = png("red"), png("blue")
    install(monkeypatch, FakeClient(catalog, {"a1": same, "a2": same, "a3": other}))
    result = await run_many(tmp_path, ids)
    files = [r["portrait"]["file"] for r in result.data["results"] if r["status"] == "assigned"]
    assert len(files) == 2 and len(set(files)) == 2


@pytest.mark.asyncio
async def test_a_later_call_does_not_reuse_an_avatar_already_bound_to_another_persona(tmp_path, monkeypatch):
    await add_persona(tmp_path, "p_a_01")
    await add_persona(tmp_path, "p_b_02")
    catalog = {"items": [item("only", age_band=["25_34"])]}
    install(monkeypatch, FakeClient(catalog, {"only": png("red")}))
    first = await run_many(tmp_path, ["p_a_01"])
    assert first.data["results"][0]["status"] == "assigned"
    second = await run_many(tmp_path, ["p_b_02"])
    outcome = second.data["results"][0]
    # 库里只有这一张：宁可留空让上层决定是否另行生成，也不能让两个人同脸。
    assert second.ok and outcome["status"] == "no_match" and "already used" in outcome["reason"]
    assert "portrait" not in json.loads(await async_read_text(tmp_path / "personas/p_b_02.json"))


@pytest.mark.asyncio
async def test_replace_never_picks_the_current_portrait_again(tmp_path, monkeypatch):
    await add_persona(tmp_path, "p_a_01")
    catalog = {"items": [item("a1", age_band=["25_34"]), item("a2", age_band=["25_34"])]}
    install(monkeypatch, FakeClient(catalog, {"a1": png("red"), "a2": png("blue")}))
    first = await run_many(tmp_path, ["p_a_01"])
    install(monkeypatch, FakeClient(catalog, {"a1": png("red"), "a2": png("blue")}))
    second = await run_many(tmp_path, ["p_a_01"], replace=True)
    assert second.data["results"][0]["status"] == "assigned"
    assert second.data["results"][0]["asset_id"] != first.data["results"][0]["asset_id"]


@pytest.mark.asyncio
async def test_used_library_avatars_are_excluded_before_any_download(tmp_path, monkeypatch):
    await add_persona(tmp_path, "p_a_01")
    await add_persona(tmp_path, "p_b_02")
    catalog = {"items": [item("a1", age_band=["25_34"]), item("a2", age_band=["25_34"])]}
    files = {"a1": png("red"), "a2": png("blue")}
    install(monkeypatch, FakeClient(catalog, files))
    first = await run_many(tmp_path, ["p_a_01"])
    used = first.data["results"][0]["asset_id"]
    # 绑定时记下了来源素材 ID，下一次选图在下载之前就把它排除，只会取另一张。
    saved = json.loads(await async_read_text(tmp_path / "personas/p_a_01.json"))
    assert saved["portrait"]["library_id"] == used
    client = FakeClient(catalog, files)
    install(monkeypatch, client)
    second = await run_many(tmp_path, ["p_b_02"])
    assert second.data["results"][0]["asset_id"] != used
    assert f"download:{used}" not in client.calls


@pytest.mark.asyncio
async def test_lookalike_avatars_are_not_given_to_two_personas(tmp_path, monkeypatch):
    for persona_id in ("p_a_01", "p_b_02", "p_c_03"):
        await add_persona(tmp_path, persona_id)
    # a1 和 a2 被检查标为同一个相似组；a3 是另一个人。
    catalog = {"items": [
        item("a1", age_band=["25_34"], lookalike=["lk01"]),
        item("a2", age_band=["25_34"], lookalike=["lk01"]),
        item("a3", age_band=["25_34"]),
    ]}  # fmt: skip
    install(monkeypatch, FakeClient(catalog, {"a1": png("red"), "a2": png("green"), "a3": png("blue")}))
    result = await run_many(tmp_path, ["p_a_01", "p_b_02", "p_c_03"])
    assigned = [r["asset_id"] for r in result.data["results"] if r["status"] == "assigned"]
    # 三个人只能拿到两张：a1/a2 里只会用到一张，另一个人拿 a3，剩下的人保持无匹配
    assert len(assigned) == 2 and "a3" in assigned and len({"a1", "a2"} & set(assigned)) == 1
    assert [r["status"] for r in result.data["results"]].count("no_match") == 1
