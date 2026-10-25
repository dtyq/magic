#!/usr/bin/env python3
"""Build the HTML design style catalog from bundled DESIGN.md resources.

The bundled DESIGN.md files are owned by Magic Service and stored under
``storage/html-design-style/styles/<style_code>/DESIGN.md``. This script only
generates the frontend catalog snapshot and never modifies the source files.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parents[2]
STYLES_ROOT = ROOT / "storage" / "html-design-style" / "styles"
FRONTEND_CATALOG = (
    Path(__file__).resolve().parents[4]
    / "frontend"
    / "magic-web"
    / "public"
    / "html-design-style"
    / "catalog.json"
)

CATEGORIES = {
    "ai",
    "developer",
    "productivity",
    "finance",
    "commerce",
    "media",
    "design",
    "automotive",
    "retro",
    "scenario",
}

CATEGORY_KEYWORDS = {
    "ai": ("ai", "llm", "model", "assistant", "prompt", "anthropic"),
    "developer": ("developer", "code", "dev", "api", "terminal", "database", "cloud"),
    "finance": ("finance", "fintech", "crypto", "bank", "trading", "payment", "wallet"),
    "commerce": ("commerce", "shop", "retail", "market", "store", "product", "e-commerce"),
    "media": ("media", "music", "video", "photo", "stream", "editorial", "news"),
    "design": ("design", "creative", "studio", "figma", "agency", "portfolio"),
    "automotive": ("automotive", "car", "auto", "motor", "vehicle"),
    "retro": ("retro", "vintage", "pixel", "classic", "1996", "2001"),
    "scenario": ("dashboard", "landing", "health", "wellness", "saas", "app", "workspace"),
}

STYLE_ORDER = [
    # Tier 1: Featured (36 styles) - Top visually stunning, famous flagships
    "apple", "linear.app", "stripe", "vercel", "figma", "notion", "ferrari", "airbnb",
    "claude", "cursor", "warp", "framer", "spotify", "raycast", "nvidia", "runwayml",
    "supabase", "theverge", "wired", "broadsheet", "tesla", "spacex", "bugatti", "bmw-m",
    "nike", "playstation", "superhuman", "resend", "mintlify", "binance", "wise", "revolut",
    "luxcart", "creative-agency", "rawblock", "dell-1996",

    # Tier 2: Major Brand & Flagships (45 styles)
    "aurora-gl", "pureform", "owl-green", "clickhouse", "starbucks", "shopify", "streamflix", "meta",
    "slack", "cal", "miro", "posthog", "hashicorp", "coinbase", "kraken", "mastercard",
    "bmw", "lamborghini", "webflow", "airtable", "clay", "uber", "pinterest", "ibm",
    "x.ai", "mistral.ai", "together.ai", "cohere", "elevenlabs", "ollama", "replicate",
    "expo", "sentry", "sanity", "mongodb", "intercom", "zapier", "hp", "renault",
    "nintendo-2001", "vodafone", "flip7-card-game", "lovable", "opencode.ai", "octo-code",

    # Tier 3: Modern Tech, Media, Analytics & Commerce (45 styles)
    "apivault", "security-diagnostics", "voltagent", "docuforge", "adminforge",
    "crypto-dashboard", "crypto-blue", "green-trade", "fintech-dashboard-clean", "fintech-dashboard-pro", "vaultline",
    "healhub", "health-wellness", "pharmflow", "wellpath", "tavily-web-access-layer-for-ai-agents", "composio", "minimax",
    "vertex-digital-infrastructure", "vertex", "enterprise-saas", "saas-dashboard", "saas-landing",
    "portfolio-creative", "agency-landing", "createspace", "neural-synthesis", "magspread", "marblecrest", "red-broadcast", "serif-journal", "media-editorial",
    "shopvibe", "e-commerce-minimal", "lime-commerce", "spark-mart", "auction-quad", "farmtable",
    "blurple-guild", "chatbubble", "green-chat", "feedloop", "voicebox", "teamsync", "thoughtstream",

    # Tier 4: Operations, Logistics, Hardware, Systems & Decks (45 styles)
    "autonomous-traffic-vectors", "supplygrid", "propertyvue", "bookingflow", "insureshield", "hrflow",
    "command-center", "genesis", "metric-flow", "navystack", "threadweave",
    "galaxycore-ppt", "green-deck", "skylearn", "doodlepad", "nomadkit", "urbanloft",
    "aurelia-systems-grid", "design-tokens", "generium-design-kit", "validata-design-system", "journey-ui", "utility-app", "softro-saas",
    "design-md-sistema-de-monitoreo-el-ctrico-wattvision", "heyalpha-ai-kiosk-design-system-v1-2", "ibox-3-0", "midnight-debt-payoff-and-income-injection-tracker", "mise", "mountain-view-bright",
    "blue-grid", "bullseye-red", "channel-palette", "dark-green-interface", "pink-shot", "swoosh-bold",
    "abugo-design-system-and-vizu-ln-identita", "african-mobile-first", "design-system-tra-o-feito-sinal", "ifraldas-design-system", "dokturek-ui-kit-copy-design-guidelines", "ks-tools-france", "realsee-homeui-design-system-v2", "verdana-health-design-system", "al-razi-hub-design-system",
]

FEATURED = set(STYLE_ORDER[:36])

AI_CODES = {
    "claude",
    "cohere",
    "elevenlabs",
    "minimax",
    "mistral.ai",
    "ollama",
    "opencode.ai",
    "replicate",
    "runwayml",
    "together.ai",
    "voltagent",
    "x.ai",
}
DEVELOPER_CODES = {
    "clickhouse",
    "composio",
    "cursor",
    "expo",
    "hashicorp",
    "mongodb",
    "posthog",
    "sanity",
    "sentry",
    "supabase",
    "warp",
}
PRODUCTIVITY_CODES = {
    "cal",
    "intercom",
    "linear.app",
    "mintlify",
    "notion",
    "resend",
    "slack",
    "superhuman",
    "zapier",
    "saas-dashboard",
    "saas-landing",
    "utility-app",
    "enterprise-saas",
}
FINANCE_CODES = {
    "binance",
    "coinbase",
    "kraken",
    "mastercard",
    "revolut",
    "stripe",
    "wise",
    "crypto-dashboard",
    "fintech-dashboard-clean",
    "fintech-dashboard-pro",
}
COMMERCE_CODES = {"airbnb", "meta", "nike", "shopify", "starbucks", "e-commerce-minimal"}
MEDIA_CODES = {
    "apple",
    "hp",
    "ibm",
    "nvidia",
    "pinterest",
    "playstation",
    "spotify",
    "theverge",
    "uber",
    "vodafone",
    "wired",
}
DESIGN_CODES = {"airtable", "clay", "figma", "framer", "miro", "webflow"}
AUTOMOTIVE_CODES = {"bmw", "bmw-m", "bugatti", "ferrari", "lamborghini", "renault", "tesla"}
RETRO_CODES = {"dell-1996", "nintendo-2001"}
SCENARIO_CODES = {
    "african-mobile-first",
    "agency-landing",
    "creative-agency",
    "crypto-dashboard",
    "e-commerce-minimal",
    "enterprise-saas",
    "fintech-dashboard-clean",
    "fintech-dashboard-pro",
    "health-wellness",
    "media-editorial",
    "portfolio-creative",
    "saas-dashboard",
    "saas-landing",
    "utility-app",
}


def json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def flatten_tokens(value: Any, prefix: str = "") -> list[tuple[str, Any]]:
    if isinstance(value, dict):
        result: list[tuple[str, Any]] = []
        for key, child in value.items():
            child_prefix = f"{prefix}.{key}" if prefix else str(key)
            result.extend(flatten_tokens(child, child_prefix))
        return result
    return [(prefix, value)]


def parse_document(path: Path) -> tuple[dict[str, Any], dict[str, str], str]:
    text = path.read_text(encoding="utf-8")
    frontmatter: dict[str, Any] = {}
    body = text
    if text.startswith("---\n"):
        lines = text.splitlines(keepends=True)
        closing_line = next(
            (index for index, line in enumerate(lines[1:], start=1) if line.strip() == "---"),
            None,
        )
        if closing_line is not None:
            frontmatter = load_frontmatter("".join(lines[1:closing_line]))
            body = "".join(lines[closing_line + 1 :])

    sections: dict[str, str] = {}
    matches = list(re.finditer(r"^#{2,6}\s+(.+?)\s*$", body, re.MULTILINE))
    for index, match in enumerate(matches):
        title = match.group(1).strip()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(body)
        section_text = body[start:end].strip()
        if section_text:
            sections[title] = section_text

    return json_safe(frontmatter), sections, body


def load_frontmatter(value: str) -> dict[str, Any]:
    """Parse YAML while tolerating community descriptions with unquoted colons."""
    try:
        return yaml.safe_load(value) or {}
    except yaml.YAMLError:
        repaired_lines = []
        for line in value.splitlines():
            match = re.match(r"^([^\s:#][^:]*):\s+(.+)$", line)
            if match and ": " in match.group(2) and not match.group(2).startswith(("|", ">", '"', "'", "[", "{")):
                repaired_lines.append(f"{match.group(1)}: {json.dumps(match.group(2))}")
                continue
            repaired_lines.append(line)
        return yaml.safe_load("\n".join(repaired_lines)) or {}


def first_sentence(value: str | None, limit: int = 180) -> str:
    if not value:
        return ""
    normalized = re.sub(r"\s+", " ", value).strip()
    normalized = re.sub(r"^[-*]\s+", "", normalized)
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[: limit - 1].rstrip()}…"


def category_for(code: str, title: str = "", description: str = "") -> str:
    """Infer a broad presentation category from semantic style text."""
    haystack = f"{code} {title} {description}".lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword in haystack for keyword in keywords):
            return category
    return "productivity"


def read_style(path: Path) -> dict[str, Any]:
    code = path.parent.name
    frontmatter, sections, body = parse_document(path)
    body_colors = extract_body_colors(body)
    body_typography = extract_body_typography(sections)
    colors = [
        {"name": name, "value": value}
        for name, value in flatten_tokens(frontmatter.get("colors", {}))
        if value is not None
    ]
    if not colors:
        colors = body_colors
    typography = []
    for name, value in (frontmatter.get("typography") or {}).items():
        if not isinstance(value, dict):
            continue
        typography.append(
            {
                "name": name,
                "fontFamily": value.get("fontFamily"),
                "fontSize": value.get("fontSize"),
                "fontWeight": value.get("fontWeight"),
                "lineHeight": value.get("lineHeight"),
                "letterSpacing": value.get("letterSpacing"),
            }
        )
    if not typography:
        typography = body_typography
    spacing = [
        {"name": name, "value": value}
        for name, value in flatten_tokens(frontmatter.get("spacing", {}))
        if value is not None
    ]
    rounded = [
        {"name": name, "value": value}
        for name, value in flatten_tokens(frontmatter.get("rounded", {}))
        if value is not None
    ]
    section_summaries = {
        title: first_sentence(content.split("\n\n", 1)[0])
        for title, content in sections.items()
    }
    component_names = list((frontmatter.get("components") or {}).keys())
    if not component_names:
        component_section = next(
            (content for title, content in sections.items() if title.lower() == "components"),
            "",
        )
        component_names = re.findall(r"^###\s+(.+?)\s*$", component_section, re.MULTILINE)

    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    name = str(frontmatter.get("name") or code.replace("-", " ").title())
    description = str(frontmatter.get("description") or section_summaries.get("Overview") or "")
    category = category_for(code, name, description)
    return {
        "code": code,
        "title": name,
        "description": first_sentence(description),
        "category": category,
        "tags": [category, *[str(tag) for tag in (frontmatter.get("tags") or [])]],
        "featured": code in FEATURED,
        "file": f"storage/html-design-style/styles/{code}/DESIGN.md",
        "sha256": digest,
        "design": {
            "colors": colors,
            "typography": typography,
            "spacing": spacing,
            "rounded": rounded,
            "components": component_names,
            "sections": section_summaries,
        },
    }


def extract_body_colors(body: str) -> list[dict[str, str]]:
    values = re.findall(
        r"#[0-9a-fA-F]{3,8}\b|(?:rgb|rgba|hsl|hsla)\([^\)]+\)",
        body,
    )
    unique_values = list(dict.fromkeys(values))
    return [{"name": f"color-{index + 1}", "value": value} for index, value in enumerate(unique_values[:18])]


def extract_body_typography(sections: dict[str, str]) -> list[dict[str, str]]:
    font_text = "\n\n".join(
        content
        for title, content in sections.items()
        if re.search(r"font family|font families|font stack|typeface", title, re.IGNORECASE)
    )
    typography_text = "\n\n".join(
        content
        for title, content in sections.items()
        if re.search(r"typograph|font family|font stack|type scale|hierarchy", title, re.IGNORECASE)
    )
    quoted_names = [
        value
        for line in font_text.splitlines()
        for value in re.findall(r"`([^`\n]{2,80})`", line)
    ]
    generic_names = {
        "body",
        "commitment",
        "display",
        "feature",
        "font",
        "fallback stack",
        "heading",
        "inherit",
        "initial",
        "normal",
        "official",
        "sans",
        "sans-serif",
        "serif",
        "system",
        "system-ui",
        "text",
        "title",
        "unset",
        "ui-monospace",
        "ui-sans-serif",
        "variable",
        "weight range",
    }

    def normalize_font_name(value: str) -> str | None:
        candidate = value.strip(" `\"'(),")
        candidate = candidate.split(",", 1)[0].strip(" `\"'()")
        if not candidate or len(candidate) > 40:
            return None
        if candidate.lower() in generic_names:
            return None
        if candidate.lower().endswith(" fallback"):
            return None
        if re.search(r"[#{}:;]|^--|^[-*]", candidate):
            return None
        if re.search(r"^(?:text-|color-|on-|.*-link|.*fallback$|text-transform)", candidate, re.IGNORECASE):
            return None
        if not re.search(r"[A-Za-z]", candidate):
            return None
        return candidate

    names = [
        normalized
        for name in quoted_names
        if (normalized := normalize_font_name(name)) is not None
    ]

    if not names:
        for line in font_text.splitlines():
            if not re.search(r"font|typeface|family|fallback", line, re.IGNORECASE):
                continue
            for match in re.findall(r"\*\*([^*]{2,60})\*\*", line):
                normalized = normalize_font_name(match)
                if normalized:
                    names.append(normalized)
            value = re.sub(r"^\s*[-*]\s*", "", line)
            if ":" in value:
                value = value.split(":", 1)[1]
            value = re.split(r",|—|\bfallback\b", value, maxsplit=1, flags=re.IGNORECASE)[0]
            normalized = normalize_font_name(re.sub(r"\*+", "", value))
            if normalized:
                names.append(normalized)

    names = list(dict.fromkeys(names))
    sizes = list(
        dict.fromkeys(
            re.findall(
                r"(?:font[- ]size|type scale|headline|body|label|display)[^\n]{0,50}?\b(\d{1,3}(?:\.\d+)?(?:px|rem|em))\b",
                typography_text,
                re.IGNORECASE,
            )
        )
    )
    if not names:
        names = ["System UI"]
    return [
        {
            "name": "body" if index == 0 else f"level-{index + 1}",
            "fontFamily": name,
            "fontSize": sizes[index] if index < len(sizes) else None,
            "fontWeight": None,
            "lineHeight": None,
            "letterSpacing": None,
        }
        for index, name in enumerate(names[:6])
    ]


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{json.dumps(value, ensure_ascii=False, separators=(',', ':'))}\n", encoding="utf-8")


LAYOUT_KEYWORDS = {
    "dashboard": ("dashboard", "analytics", "admin", "monitor", "metric", "data", "finance"),
    "commerce": ("commerce", "shop", "retail", "market", "store", "product", "e-commerce"),
    "editorial": ("editorial", "magazine", "blog", "article", "journal", "news", "content"),
}


def infer_preview_layout(style: dict[str, Any]) -> str:
    """Infer a small art-direction hint from the document semantics."""
    design = style["design"]
    haystack = " ".join(
        [
            style.get("title", ""),
            style.get("description", ""),
            " ".join(style.get("tags", [])),
            " ".join(design.get("components", [])),
            " ".join(design.get("sections", {}).keys()),
        ]
    ).lower()
    for layout, keywords in LAYOUT_KEYWORDS.items():
        if any(keyword in haystack for keyword in keywords):
            return layout
    return "poster"


def build_frontend_style(style: dict[str, Any]) -> dict[str, Any]:
    design = style["design"]
    sections = {
        title: summary
        for title, summary in design["sections"].items()
        if re.search(r"overview|visual theme|layout|composition|responsive|component", title, re.IGNORECASE)
    }
    return {
        **{
            key: style[key]
            for key in ("code", "title", "description", "category", "tags", "featured")
        },
        "preview": {"layout": infer_preview_layout(style)},
        "design": {
            "colors": design["colors"],
            "typography": design["typography"],
            "spacing": design["spacing"],
            "rounded": design["rounded"],
            "components": design["components"][:12],
            "sections": sections,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument(
        "--output",
        type=Path,
        default=FRONTEND_CATALOG,
        help="Output path for the frontend catalog",
    )
    args = parser.parse_args()

    paths = sorted(STYLES_ROOT.glob("*/DESIGN.md"))
    if len(paths) < 80:
        raise SystemExit(f"expected at least 80 styles, found {len(paths)}")
    styles = [read_style(path) for path in paths]
    codes = [style["code"] for style in styles]
    if len(codes) != len(set(codes)):
        raise SystemExit("style codes must be unique")

    order_index = {code: i for i, code in enumerate(STYLE_ORDER)}
    styles.sort(key=lambda s: order_index.get(s["code"], 9999))

    catalog = {
        "format": "design-md",
        "formatVersion": 2,
        "styles": styles,
    }
    frontend_catalog = {
        "format": catalog["format"],
        "formatVersion": catalog["formatVersion"],
        "styles": [build_frontend_style(style) for style in styles],
    }
    output_path = args.output if args.output.is_absolute() else (Path.cwd() / args.output)
    expected_catalog = json.dumps(frontend_catalog, ensure_ascii=False, separators=(',', ':')) + "\n"
    if args.check:
        if not output_path.exists() or output_path.read_text(encoding="utf-8") != expected_catalog:
            raise SystemExit(f"catalog is out of date: {output_path}")
        return

    write_json(output_path, frontend_catalog)


if __name__ == "__main__":
    main()
