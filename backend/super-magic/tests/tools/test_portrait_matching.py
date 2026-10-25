"""头像清单解析与打分：硬过滤、分层匹配等级、同分随机，纯函数不依赖网络。"""

import random

from app.tools.persona_research.portrait_matching import (
    MatchLevel,
    PortraitEntry,
    PortraitQuery,
    age_band,
    parse_catalog,
    rank,
)


def entry(entry_id, **tags):
    return PortraitEntry(id=entry_id, tags={k: frozenset(v) for k, v in tags.items()})


def test_age_band_boundaries():
    assert [age_band(a) for a in (18, 24, 25, 34, 44, 54, 64, 65, 90)] == [
        "18_24", "18_24", "25_34", "25_34", "35_44", "45_54", "55_64", "65_plus", "65_plus",
    ]  # fmt: skip


def test_exact_family_and_generic_levels():
    exact = entry(
        "exact", country=["CN"], gender=["feminine"], age_band=["35_44"], industry=["C"], scene_family=["workshop"]
    )
    family = entry(
        "family", country=["CN"], gender=["feminine"], age_band=["35_44"], industry=["B"], scene_family=["workshop"]
    )
    generic = entry(
        "generic", country=["US"], gender=["feminine"], age_band=["35_44"], industry=["I"], scene_family=["food"]
    )
    query = PortraitQuery(age=38, gender="feminine", country="CN", industry="C")
    ranked = rank([generic, family, exact], query, random.Random(1))
    assert [m.entry.id for m in ranked] == ["exact", "family", "generic"]
    assert [m.level for m in ranked] == [MatchLevel.EXACT, MatchLevel.FAMILY, MatchLevel.GENERIC]
    assert ranked[0].unmet == () and "industry_scene_family_only" in ranked[1].unmet
    assert set(ranked[2].unmet) == {"country", "industry"}


def test_gender_is_a_hard_filter_and_unknown_fields_do_not_filter():
    men = [entry("m", gender=["masculine"], age_band=["25_34"])]
    assert rank(men, PortraitQuery(gender="feminine"), random.Random(1)) == []
    assert [m.entry.id for m in rank(men, PortraitQuery(), random.Random(1))] == ["m"]


def test_adjacent_age_band_is_allowed_with_a_note_but_farther_is_excluded():
    near = entry("near", age_band=["35_44"])
    far = entry("far", age_band=["55_64"])
    ranked = rank([near, far], PortraitQuery(age=30), random.Random(1))
    assert [m.entry.id for m in ranked] == ["near"]
    assert ranked[0].unmet == ("age_band_adjacent",)
    # 目录项缺少年龄档时，不能声称符合明确的年龄
    assert rank([entry("untagged")], PortraitQuery(age=30), random.Random(1)) == []


def test_exact_age_outranks_adjacent_and_appearance_only_counts_when_requested():
    same = entry("same", age_band=["25_34"], hair=["short"], accessory=["glasses"])
    other = entry("other", age_band=["25_34"], hair=["long"])
    ranked = rank([other, same], PortraitQuery(age=28, hair="short", accessories=("glasses",)), random.Random(1))
    assert ranked[0].entry.id == "same" and ranked[0].score > ranked[1].score
    # 没写外观偏好时，发型不影响分数
    plain = rank([other, same], PortraitQuery(age=28), random.Random(1))
    assert plain[0].score == plain[1].score


def test_ties_are_shuffled_but_best_scores_stay_first():
    items = [entry(f"e{i}", country=["CN"], age_band=["25_34"]) for i in range(8)] + [entry("lower", country=["US"])]
    firsts = {rank(items, PortraitQuery(country="CN"), random.Random(seed))[0].entry.id for seed in range(12)}
    assert len(firsts) > 1 and "lower" not in firsts
    assert rank(items, PortraitQuery(country="CN"), random.Random(3))[-1].entry.id == "lower"


def test_parse_catalog_skips_malformed_items_and_duplicates():
    payload = {
        "items": [
            {"id": "a", "tags": {"country": ["CN", 1], "gender": "feminine"}},
            {"id": "a", "tags": {"country": ["US"]}},
            {"id": "", "tags": {}},
            {"tags": {}},
            "bad",
            {"id": 7, "tags": {"industry": ["C"]}},
        ]
    }
    entries = parse_catalog(payload)
    assert [e.id for e in entries] == ["a", "7"]
    assert entries[0].tags == {"country": frozenset({"CN"})}
    assert parse_catalog(None) == [] and parse_catalog({"items": "x"}) == []


def test_without_country_or_industry_the_level_is_generic():
    item = entry("a", gender=["feminine"], age_band=["25_34"], country=["CN"], industry=["C"])
    ranked = rank([item], PortraitQuery(age=28, gender="feminine"), random.Random(1))
    assert ranked[0].level == MatchLevel.GENERIC and ranked[0].unmet == ()
