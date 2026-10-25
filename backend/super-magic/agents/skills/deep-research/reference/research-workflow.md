# Deep Research Workflow

> This document applies to both scenarios: new research reports and deepening existing content. Phase 5 is optional — only execute when the output is an HTML report.

---

## Phase 0: Input Clarification (Before Plan)

Convert the raw request into:
- research objective
- decision context
- constraints (time, geography, industry, entities)
- output preferences (depth, style, length)

If information is insufficient, do not start heavy execution; follow the `ask_user` interaction rules in [SKILL.md](../SKILL.md) to resolve missing decisions.

---

## Phase 1: Research Plan Draft (Show User First)

Plan should include:
1. scope boundary (in-scope / out-of-scope)
2. question breakdown (3-7 key questions) — format as a numbered TODO list; these questions are the execution contract for Phase 3: every search round must be driven by unchecked TODOs, and Phase 4 only begins once all critical TODOs have at least one citable source
3. source strategy (at least 3 source categories)
4. method (retrieve, filter, compare, synthesize)
5. deliverable structure (if output is HTML report, must include these sections in order):
   - TL;DR / Core Conclusion: one-paragraph verdict, high-confidence label
   - Executive Summary: key metrics (count-up numbers), adoption trend chart, strategic implications
   - Research Scope: goal, sources count, constraints
   - Reality Check: myth-buster cards (claim vs. reality) + polarity spectrum
   - Deep Analysis: long-form prose with inline citations, key-driver cards, stakeholder impact matrix
   - Market Landscape: ecosystem tree or relationship chart
   - Comparative Analysis: radar chart for multi-option comparison
   - SWOT Analysis: four-quadrant grid
   - Evidence Matrix: table with claim / source / data point / confidence
   - Timeline: evolution roadmap
   - Case Studies: 2+ real-world examples with challenge / solution / result
   - Strategic Verdict: strong conviction statement + forward-looking signals + role-based perspectives
   - Methodology: research funnel (Sankey chart) + method description
   - Sources & References: traceable list with hover-preview tooltips

---

## Phase 2: Low-Input Kickoff Confirmation

Show the plan draft in the assistant message, then call `ask_user` directly according to [SKILL.md](../SKILL.md). Follow its shared interaction rules for questions, existing authorization, answers, and unavailable-tool cases. Begin heavy retrieval only when those rules permit execution.

---

## Phase 3: Retrieval and Evidence Collection

### Execution principle: TODO-driven, broad before deep

Before each search round, check the TODO list from Phase 1: which questions still lack citable evidence? Use that to decide the direction and queries for this round. After reading pages, mark which TODOs are now covered and which still have gaps.

Gate to Phase 4: all critical TODOs have at least one citable source — not "enough rounds have been run."

When to keep searching: TODOs still have uncovered key questions; counterpoints or dissenting data are missing; sources are too homogeneous.

When to stop: all critical TODOs are covered, the source count threshold is met, further searches would likely return duplicates. Don't search for the sake of searching.

Full-page reading is mandatory after every search: `web_search` returns snippets, not evidence. From each result set, pick the most relevant URLs and read them in full with `read_webpages_as_markdown`. Skipping this step means the research has not actually been done.

Control search cost: each search call costs money — set limit to 20 to maximize yield per call; keep queries differentiated to avoid overlapping results; prefer reading fewer high-quality pages deeply over running more searches blindly.

### Tool combination
- `web_search` (limit up to 20): locate candidate URLs
- `read_webpages_as_markdown`: read full page content (mandatory every round)
- local file reading when needed for supplemental evidence

### Evidence card (required for major claims)
Record at least:
- claim_id
- claim_text
- source_title
- source_url
- publish_date (if available)
- evidence_quote
- confidence (high/medium/low)

---

## Phase 4: Analysis and Synthesis

Must produce content for all conclusion sections. Depth requirement: each sub-topic needs at least 3 paragraphs of prose, each built around one argument (observation → cause → implication). Do not substitute bullet lists for paragraphs; always explain the significance of cited data. Key requirements:

1. Core conclusion — one clear, high-confidence verdict sentence
2. Key metrics — 2-4 quantitative data points, each with a brief explanation of what it means
3. Reality Check — identify 3-4 common myths. For each, the "Truth" must go beyond a one-liner: explain *why* the myth is wrong (the underlying mechanism), add a concrete analogy to make it click (e.g. "it's an OS, not a library"), and state what the reader should do or avoid as a result. Also place the subject on 2-4 polarity axes (e.g. "Experimental -- current position -- Production-ready"), each with a one-sentence annotation
4. Key drivers — supply-side and demand-side forces behind the main finding; each force developed in its own paragraph
5. Stakeholder impact matrix — how different roles are affected (positive / negative / magnitude)
6. Claim-to-evidence mapping — every major claim traceable to a citation [SN]
7. Counterpoints — at least one section challenging the main narrative, fully developed — not just a single sentence
8. Limitations — data scope, time window, sample bias
9. Case studies — at least 2 real-world examples, each covering: background, challenge, actions taken, results, reusable lessons
10. Strategic verdict — strong opinionated stance with conviction language; include 3-5 forward-looking signals (green/yellow/red) and 3 role-based perspectives describing distinct implications

---

## Phase 5: HTML Report Generation (Optional — only when output is HTML)

Core principle: use report-template.html as the structural and interactive specification, then generate a fully original HTML report with all mock content replaced by real research data.

The report is long — split into at least 3 passes, each under 500 lines / 30,000 characters, to avoid connection timeouts from oversized single outputs:
- Pass 1: output the complete skeleton — `<head>`, all CSS, all section containers (titles and `<!-- ANCHOR: section-name -->` placeholders only, no prose), all JavaScript
- Passes 2, 3, …: use edit_file to fill content by anchor; decide split points yourself based on actual content volume, keeping each pass under 500 lines / 30,000 characters

Execution requirements:
1. Reference report-template.html (already read) for its HTML structure, CSS conventions, and all JavaScript interaction logic; read it now if not yet in context.
   **Topic identity (mandatory, never use generic defaults)**:
   - `<title>`: `[Topic Name] — Deep Research [Year]`, e.g. `OpenClaw — Deep Research 2026`
   - Nav icon (`fa-solid fa-*`): choose one that semantically matches the topic (e.g. `fa-robot` for AI agents, `fa-chart-line` for markets, `fa-shield-halved` for security, `fa-flask` for biotech, `fa-landmark` for policy)
   - Nav label: short topic keyword ≤15 chars, e.g. `OpenAI`, `EV Market`, `Carbon Neutral`, `Apple Vision Pro` — **never** leave as `Deep Research`
2. Include as many sections from Phase 1 as the topic allows — omit only sections that genuinely do not apply to the subject matter.
3. The following JavaScript components must be reproduced verbatim (they are topic-agnostic and reusable as-is):
   - Citation hover-preview: this is a standalone `<script>` block using `DOMContentLoaded` (separate from the ECharts `window.onload` block). Copy it verbatim — it creates the `.citation-tooltip` div, reads source name/title from the target element, and positions the tooltip on hover. Positioning pitfall: `top` uses `scrollTop`, `left` uses `scrollLeft` — never mix them or the tooltip will drift sideways.
   - CountUp animation: use IntersectionObserver to trigger number animations on `.count-up` elements.
   - Typewriter effect: animate `#core-conclusion` text character-by-character over 1.5 seconds, preserving original HTML node structure and styles.
4. ECharts charts must use real research data (tree map, radar chart, Sankey diagram, etc.) — no mock values. Chart rendering rules: always call echarts.init() inside window.onload (not DOMContentLoaded); listen to window.resize and call resize() on all chart instances; reserve sufficient margin so labels are never clipped.
   **Chart placement rule**: complex wide charts (architecture tree, relationship graph, ecosystem map, Sankey) must be placed inline in the main content flow with a full-width container (`w-full`). Never place them in the sidebar (4/12-col column) — labels will be truncated and the chart becomes unreadable. The sidebar is only suitable for simple, compact charts like small bar or scatter charts.
5. Analysis sections must have substantial paragraph-level prose — follow the depth standard in Phase 4 (at least 3 paragraphs per sub-topic, observation → cause → implication). Never substitute bullets for prose in narrative sections.
6. All major claims must include [SN] citation anchors; source cards must have real URLs and matching id attributes.

If output format is not HTML, skip this phase and deliver Phase 4 analysis in the user's preferred format.

---

## Phase 6: Quality Gates (All Must Pass Before Delivery)

### Pre-Delivery Gates
1. Question coverage: every planned key question has a conclusion or explicit "insufficient evidence" note
2. Evidence completeness: all major claims have source citations; at least one counterpoint or uncertainty note
3. Source diversity: sources are not overly concentrated in one channel type
4. Actionable recommendations: include priority, preconditions, and risks
5. Readable structure: sections complete, logic clear, terminology consistent
6. HTML completeness (if applicable): all 14 sections present; all ECharts, CountUp, typewriter, and citation-tooltip scripts are intact and functional

If any gate fails, loop back to Phase 3/4 to deepen.

### Depth Mode Thresholds

| Mode | Sources | Evidence Density | Typical Use |
|---|---|---|---|
| Quick | >= 10 | Key claims covered | Fast but non-shallow answer |
| Standard | >= 15 | Key + supporting claims | Default decision support |
| Expert | >= 25 | Full claim map + counterpoints | High-stakes or strategic decisions |

### Deepening Scenario: Gap Diagnosis and Fix

When the task is to deepen existing content, diagnose gaps first, then fix targeted sections:
- A. Insufficient evidence density -> more retrieval rounds, diversify sources
- B. Conclusions too generic -> rewrite as "condition + conclusion + implication"
- C. Missing counterpoints -> add counterpoint section
- D. Recommendations not actionable -> add priority, prerequisites, risks

Rewrite impacted sections only; avoid unrelated changes.
