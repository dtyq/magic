"""人设头像与图库清单的匹配打分。

纯函数，不访问网络和文件。清单来自后端 open 接口，每张图带若干维度的取值编码，例如
{"country": ["CN"], "gender": ["feminine"], "age_band": ["25_34"], "industry": ["C"]}。

匹配规则（人设里没有的信息不参与打分，也不由本模块推测）：

| 维度               | 规则                                                     |
| ------------------ | -------------------------------------------------------- |
| gender             | 人设明确时硬过滤                                         |
| age_band           | 同档 +2；相邻档 +0.5 并记 age_band_adjacent；更远的排除   |
| country            | 命中 +4                                                  |
| industry           | 门类相同 +3；仅场景族相同 +1.5；都不同不加分              |
| hair / facial_hair | 人设明确写了才用，命中各 +1                              |
| accessories        | 人设明确写了才用，每命中一个 +1                          |

例：人设是「35 岁、中国、制造业、女」。图库里有 C 门类的中国 35–44 岁女性图 → exact；
没有 C 门类但有同属车间场景的图 → family；只有性别和年龄档相符 → generic。
人设没给国家和行业时，结果一律是 generic。
"""

from __future__ import annotations

import random
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

AGE_BANDS = ("18_24", "25_34", "35_44", "45_54", "55_64", "65_plus")
_AGE_UPPER = (24, 34, 44, 54, 64)

# ISIC Rev.5 门类 → (英文名, 场景族)。编码与头像库 taxonomy/axes.v1.json 一致；
# 场景族是库内自定义，用于某个门类没有图时退到场景相近的图。
INDUSTRY_SECTIONS: dict[str, tuple[str, str]] = {
    "A": ("Agriculture, forestry and fishing", "outdoor"),
    "B": ("Mining and quarrying", "workshop"),
    "C": ("Manufacturing", "workshop"),
    "D": ("Electricity, gas, steam and air conditioning supply", "workshop"),
    "E": ("Water supply; sewerage, waste management and remediation", "workshop"),
    "F": ("Construction", "outdoor"),
    "G": ("Wholesale and retail trade", "retail_service"),
    "H": ("Transportation and storage", "transport"),
    "I": ("Accommodation and food service", "food"),
    "J": ("Publishing, broadcasting and content production and distribution", "office"),
    "K": (
        "Telecommunications, computer programming, consulting, computing infrastructure and other information services",
        "office",
    ),
    "L": ("Financial and insurance activities", "office"),
    "M": ("Real estate", "office"),
    "N": ("Professional, scientific and technical activities", "office"),
    "O": ("Administrative and support services", "office"),
    "P": ("Public administration and defence; compulsory social security", "office"),
    "Q": ("Education", "classroom"),
    "R": ("Human health and social work", "health"),
    "S": ("Arts, sports and recreation", "office"),
    "T": ("Other service activities", "retail_service"),
    "U": ("Households as employers", "home"),
    "V": ("Extraterritorial organizations and bodies", "office"),
}

W_AGE_EXACT = 2.0
W_AGE_ADJACENT = 0.5
W_COUNTRY = 4.0
W_INDUSTRY = 3.0
W_SCENE_FAMILY = 1.5
W_APPEARANCE = 1.0

MAX_CATALOG_ITEMS = 5000
MAX_TAGS_PER_DIMENSION = 16


def age_band(age: int) -> str:
    """成年年龄 → 年龄档编码；18 岁以下由调用方先排除。"""
    for band, upper in zip(AGE_BANDS, _AGE_UPPER):
        if age <= upper:
            return band
    return AGE_BANDS[-1]


class MatchLevel(StrEnum):
    EXACT = "exact"  # 人设给出的国家和行业都命中
    FAMILY = "family"  # 行业退到同场景族
    GENERIC = "generic"  # 只有性别和年龄档符合


@dataclass(frozen=True)
class PortraitEntry:
    id: str
    tags: Mapping[str, frozenset[str]]

    def has(self, dimension: str, value: str) -> bool:
        return value in self.tags.get(dimension, frozenset())


@dataclass(frozen=True)
class PortraitQuery:
    """人设中明确给出的信息；未知字段保持 None，不参与匹配。"""

    age: int | None = None
    gender: str | None = None
    country: str | None = None
    industry: str | None = None
    hair: str | None = None
    facial_hair: str | None = None
    accessories: tuple[str, ...] = ()


@dataclass(frozen=True)
class PortraitMatch:
    entry: PortraitEntry
    score: float
    level: MatchLevel
    # 未满足的偏好，如 country、industry、age_band_adjacent；为空表示全部满足。
    unmet: tuple[str, ...]


def parse_catalog(payload: object) -> list[PortraitEntry]:
    """解析接口返回的清单；格式不合法的条目直接跳过，不让一条坏数据拖垮整次匹配。"""
    items = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(items, list):
        return []
    entries: list[PortraitEntry] = []
    seen: set[str] = set()
    for item in items[:MAX_CATALOG_ITEMS]:
        if not isinstance(item, dict):
            continue
        entry_id = item.get("id")
        raw_tags = item.get("tags")
        if not isinstance(entry_id, (str, int)) or not isinstance(raw_tags, dict):
            continue
        entry_id = str(entry_id)
        if not entry_id or entry_id in seen:
            continue
        tags: dict[str, frozenset[str]] = {}
        for dimension, values in raw_tags.items():
            if isinstance(dimension, str) and isinstance(values, list):
                tags[dimension] = frozenset(v for v in values[:MAX_TAGS_PER_DIMENSION] if isinstance(v, str))
        seen.add(entry_id)
        entries.append(PortraitEntry(id=entry_id, tags=tags))
    return entries


def _score(entry: PortraitEntry, query: PortraitQuery) -> PortraitMatch | None:
    score = 0.0
    unmet: list[str] = []

    if query.gender and not entry.has("gender", query.gender):
        return None

    if query.age is not None:
        band = age_band(query.age)
        if entry.has("age_band", band):
            score += W_AGE_EXACT
        else:
            index = AGE_BANDS.index(band)
            neighbours = {AGE_BANDS[i] for i in (index - 1, index + 1) if 0 <= i < len(AGE_BANDS)}
            if not entry.tags.get("age_band", frozenset()) & neighbours:
                return None
            score += W_AGE_ADJACENT
            unmet.append("age_band_adjacent")

    country_ok = True
    if query.country:
        if entry.has("country", query.country):
            score += W_COUNTRY
        else:
            country_ok = False
            unmet.append("country")

    industry_exact = True
    family_ok = False
    if query.industry in INDUSTRY_SECTIONS:
        family = INDUSTRY_SECTIONS[query.industry][1]
        if entry.has("industry", query.industry):
            score += W_INDUSTRY
        elif entry.has("scene_family", family):
            industry_exact = False
            family_ok = True
            score += W_SCENE_FAMILY
            unmet.append("industry_scene_family_only")
        else:
            industry_exact = False
            unmet.append("industry")

    if query.hair:
        if entry.has("hair", query.hair):
            score += W_APPEARANCE
        else:
            unmet.append("hair")
    if query.facial_hair:
        if entry.has("facial_hair", query.facial_hair):
            score += W_APPEARANCE
        else:
            unmet.append("facial_hair")
    for accessory in query.accessories:
        if entry.has("accessory", accessory):
            score += W_APPEARANCE
        else:
            unmet.append(f"accessory_{accessory}")

    # 国家和行业都没给时没有可核对的「精确」依据，按 generic 处理，避免把随便一张图说成精确匹配
    constrained = bool(query.country) or query.industry in INDUSTRY_SECTIONS
    if constrained and country_ok and industry_exact:
        level = MatchLevel.EXACT
    elif country_ok and family_ok:
        level = MatchLevel.FAMILY
    else:
        level = MatchLevel.GENERIC
    return PortraitMatch(entry=entry, score=score, level=level, unmet=tuple(unmet))


def rank(
    entries: Sequence[PortraitEntry],
    query: PortraitQuery,
    rng: random.Random | None = None,
) -> list[PortraitMatch]:
    """按分数从高到低返回候选；同分随机，让同一类人设不会总拿到同一张图。"""
    rng = rng or random.Random()
    scored = [m for m in (_score(e, query) for e in entries) if m is not None]
    rng.shuffle(scored)
    scored.sort(key=lambda m: m.score, reverse=True)
    return scored


def query_from_fields(fields: Mapping[str, Any]) -> PortraitQuery:
    """工具参数 → 查询；只做字段搬运，合法性由参数模型保证。"""
    return PortraitQuery(
        age=fields.get("age"),
        gender=fields.get("gender"),
        country=fields.get("country"),
        industry=fields.get("industry"),
        hair=fields.get("hair"),
        facial_hair=fields.get("facial_hair"),
        accessories=tuple(fields.get("accessories") or ()),
    )
