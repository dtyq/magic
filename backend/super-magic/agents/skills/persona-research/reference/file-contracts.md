# Persona Research File Contracts

The research workspace UI parses these files. A file whose required fields are missing or whose `schema_version` is not `1` is shown as "not ready". Unknown extra fields are ignored by the UI.

Who writes each file:

| File | Written by |
|---|---|
| `study.json` | `update_study`; hypothesis verdicts by `save_study_synthesis` |
| `personas/*.json` optional `portrait` | `attach_persona_portrait` (image validation and binding only) |
| `personas/*.json`, `studies/<slug>/panel.json`, `panels/*.json` | `save_personas` |
| `interviews/*.json`, `discussions/*.json` | `persona_chat` (rounds) and `finish_persona_transcript` (summary, quotes, quality) |
| `synthesis.json` | `save_study_synthesis` |
| `validation-questionnaire.csv` | `save_validation_questionnaire` |
| `validation-results.json` | you, with `write_file`, following the contract below |

Use this document to understand the fields you pass to the tools and to read the files. Never edit a tool-written file with file tools or Python.

Rules for every file:

- `schema_version` is the number `1`.
- Field names and enum values are English and exactly as written below. Human-readable text (titles, summaries, answers) uses the user's language.
- Paths stored inside files are workspace-relative.
- Times use ISO 8601 with an explicit offset, for example `2026-10-18T14:20:00+08:00`.

## study.json

Path: `studies/<slug>/study.json`

| Field | Required | Values |
|---|---|---|
| `schema_version` | yes | `1` |
| `topic_id` | yes | the current topic ID from the latest `<super_magic_product_context>`, as a string; the research workspace finds the study of a topic by this field, so keep it on every rewrite |
| `title` | yes | short study title |
| `question` | yes | the user's original question, verbatim |
| `study_type` | no | `user_research` \| `product_rnd` \| `concept_test` \| `fast_insight` \| `panel_only` \| `persona_build` (persona building only: no plan, interviews, or report) |
| `framework` | no | list of framework names, for example `["JTBD"]` |
| `phase` | yes | `clarify` \| `plan` \| `desk_research` \| `interview` \| `report` \| `validation` \| `done` |
| `phases` | yes | all six phases in order, each `{ "key": <phase>, "status": "done" \| "running" \| "pending" \| "skipped" \| "failed" }` |
| `limits` | no | `{ "personas": <int>, "interview_rounds": <int> }`; interview rounds is a safety ceiling (1-20, new studies default to 20), not a quota; existing studies retain their saved ceiling. Depth and stopping criteria live in `plan.md` |
| `outputs` | no | `{ "plan": "plan.md", "report": "report.html", "validation": "validation-questionnaire.md" }`, paths relative to the study directory |
| `decision` | no | the business decision this study informs, one sentence |
| `hypotheses` | no | array of hypothesis objects, see below |
| `quota` | no | sample quota: array of `{ "segment", "criteria", "count" }`; `segment` is a short label reused in `panel.json` `selection[].segment` and `synthesis.json` `segments[].name`; `count` is an integer and all counts add up to `limits.personas` |
| `guide_review` | no | interview-guide self-check: `{ "items": [{ "issue", "before", "after" }] }`; `issue` is `leading` \| `double_barreled` \| `hypothesis_reveal` \| `jargon` \| `sequence_priming`; `items` is `[]` when no question needed a change |
| `social_sampling` | no | set at `desk_research_done`: `{ "status": "sampled" \| "unavailable" \| "not_relevant", "platforms": [<platform key>], "posts": <int>, "comments": <int>, "note" }` |
| `validated_count` | no | number of real respondents compared so far (equals `respondent_count` in `validation-results.json`); omit before any real-person answers arrive |

Hypothesis object:

| Field | Required | Values |
|---|---|---|
| `id` | yes | `H1`, `H2`, ... in plan order; never renumber after the plan is confirmed |
| `statement` | yes | one falsifiable sentence |
| `support_criteria` | yes | what answers or sources count as support |
| `refute_criteria` | yes | what answers or sources count as refutation |
| `outcome_terms` | no | short phrases naming the tested outcome; `save_personas` rejects personas whose stance fields contain them |
| `verdict` | yes | `pending` \| `supported` \| `refuted` \| `mixed` \| `insufficient`; `pending` until the report phase applies the verdict rules in methods.md |
| `verdict_reason` | no | one or two sentences explaining the verdict under the rules; `""` while pending |
| `evidence_refs` | no | array of evidence references, see below |
| `validation` | no | real-person result: `{ "verdict": "agree" \| "partial" \| "disagree", "summary" }`; omit until real-person answers are compared |

Evidence reference, one of two kinds:

- `{ "kind": "quote", "persona_id", "round_index", "text" }`: a persona's exact words. `round_index` is the 0-based index into the transcript's `rounds` array (each array item is one utterance, so it is not the question number) and must point to an item spoken by that persona. The transcript is `interviews/<persona_id>.json`; for a focus-group quote add `"file": "discussions/<discussion_id>.json"` (path relative to the study directory). `text` must appear verbatim in that item's `text`.
  `"prompted": true` marks a quote the persona gave only after the moderator's question named the idea.
- `{ "kind": "source", "ref": "S3", "claim", "covers": "core" | "context" }`: a numbered source from `desk-research.md`, what it says about this hypothesis, and whether it states the hypothesis's core claim or only gives context. Older studies have only `ref`.

Example (report written, real-person answers compared):

```json
{
  "schema_version": 1,
  "topic_id": "912345678901234567",
  "title": "AI call recorder for SMB owners",
  "question": "Would owners of small traditional businesses pay for an AI call recorder?",
  "study_type": "concept_test",
  "framework": ["JTBD"],
  "phase": "done",
  "phases": [
    { "key": "clarify", "status": "done" },
    { "key": "plan", "status": "done" },
    { "key": "desk_research", "status": "done" },
    { "key": "interview", "status": "done" },
    { "key": "report", "status": "done" },
    { "key": "validation", "status": "done" }
  ],
  "limits": { "personas": 8, "interview_rounds": 20 },
  "outputs": { "plan": "plan.md", "report": "report.html", "validation": "validation-questionnaire.md" },
  "decision": "Whether to start building an AI call recorder for business owners",
  "hypotheses": [
    {
      "id": "H1",
      "statement": "The biggest pain is verbal agreements without a record, not meeting notes.",
      "support_criteria": "Most participants describe a specific dispute over an unrecorded agreement.",
      "refute_criteria": "Most participants only mention taking meeting notes.",
      "verdict": "supported",
      "verdict_reason": "Most completed interviews describe a specific dispute over an unrecorded deal, and S3 reports the same pattern.",
      "evidence_refs": [
        { "kind": "quote", "persona_id": "p_zhangwei_7f3a", "round_index": 1, "text": "I had no record, so I gave in." },
        { "kind": "source", "ref": "S3" }
      ],
      "validation": { "verdict": "agree", "summary": "Most of the 12 real owners named an unrecorded agreement as their main pain." }
    },
    {
      "id": "H2",
      "statement": "An annual fee under 299 is not a purchase barrier.",
      "support_criteria": "Price is not among the first two concerns raised.",
      "refute_criteria": "Most participants raise price first.",
      "verdict": "mixed",
      "verdict_reason": "Pending real-person validation: only AI interviews address price, and AI answers on price tend to be optimistic.",
      "evidence_refs": [
        { "kind": "quote", "persona_id": "p_liumin_0b9e", "round_index": 2, "text": "299 is nothing if it saves my managers one hour a week.", "file": "discussions/fg_pricing_9d20.json" },
        { "kind": "quote", "persona_id": "p_zhangwei_7f3a", "round_index": 1, "text": "Not before I see a friend using it.", "file": "discussions/fg_pricing_9d20.json" }
      ],
      "validation": { "verdict": "partial", "summary": "Real owners accepted the price range but most asked for a free trial first." }
    }
  ],
  "quota": [
    { "segment": "Building materials", "criteria": "Wholesale or renovation owners, 5-50 staff; includes 1 non-user", "count": 3 },
    { "segment": "Restaurant chains", "criteria": "2-10 stores; includes 1 churned user", "count": 2 },
    { "segment": "Manufacturing", "criteria": "Factory owners who negotiate by phone; includes 1 skeptic", "count": 3 }
  ],
  "guide_review": {
    "items": [
      { "issue": "leading", "before": "Don't you find keeping records a hassle?", "after": "The last time a deal was not written down, what happened next?" }
    ]
  },
  "validated_count": 12
}
```

## personas/<persona_id>.json

Path: `personas/<persona_id>.json` (project-level library). `id` format: `p_<short-ascii-slug>_<4 random hex>`.

| Field | Required | Values |
|---|---|---|
| `schema_version` | yes | `1` |
| `id` | yes | same as the file name without `.json` |
| `name` | yes | display name |
| `tagline` | no | one-line description |
| `tags` | no | short labels |
| `tier` | yes | `generated` \| `evidence_based` \| `imported` \| `manual` (filled in by the user in the persona library) |
| `dimensions` | no | `demographics` (object), `geography` (object), `psychographics` (object), `behavior` (object), `needs_pains` (array), `tech_adoption` (string), `social` (string) |
| `layers` | no | `expression` (array of typical phrasings), `story` (string, life and usage story), `cognition` (`{ "decision_weights": [{ "factor", "level": "high" \| "medium" \| "low" }] }`, a qualitative ranking with no numbers), `behavior` (array of concrete actions) |
| `evidence` | no | array of `{ "id", "type": "web" \| "social" \| "upload" \| "interview", "platform", "title", "url", "file", "quote" }`; `platform` only for `social` (for example `xiaohongshu`, `douyin`); `interview` evidence never counts toward `tier` |
| `field_sources` | no | per dimension key (`demographics`, `geography`, `psychographics`, `behavior`, `needs_pains`, `tech_adoption`, `social`): an array of evidence ids such as `["e1", "e3"]`, the string `"inferred"` when no evidence backs it, or `"user"` when the user filled in or edited it |
| `consistency_notes` | no | array of strings: contradictions between layers that are kept on purpose, for example "Says efficiency matters most, yet still keeps a paper ledger" |
| `field_labels` | no | object mapping each non-standard key used in `dimensions` or `layers` to its display name in the user's language, for example `{ "monthly_allowance_cny": "月生活费（元）" }`; required by `save_personas` for new personas |
| `portrait` | no | `{ "file": "personas/portraits/<persona_id>/<content-hash>.webp", "file_id": "<optional MagicFS file id>", "updated_at": "<ISO 8601 with offset>" }`; maintained by `attach_persona_portrait`, never a signed URL; absent or unreadable uses the original SVG |
| `created_in` | no | `studies/<slug>` of the study that created it |
| `updated_at` | no | ISO 8601 time with offset |
| `edited_at` | no | ISO 8601 time with offset of the user's last edit in the persona library |

Although `dimensions`, `layers`, `evidence`, and `field_sources` are optional for the UI, every persona you create fills all 7 dimensions, all 4 layers, `field_sources` for all 7 dimensions, and at least one evidence item when sources exist. `tier` follows the rule in SKILL.md, not your judgment.

Example:

```json
{
  "schema_version": 1,
  "id": "p_zhangwei_7f3a",
  "name": "Zhang Wei",
  "tagline": "Owner of a building-materials wholesale shop, 52",
  "tags": ["skeptical of AI", "relationship-driven"],
  "tier": "evidence_based",
  "dimensions": {
    "demographics": { "age": 52, "gender": "male", "education": "high school", "income": "upper-middle" },
    "geography": { "city_tier": "tier 3", "region": "East China" },
    "psychographics": { "values": ["reliability", "face"], "risk_attitude": "cautious" },
    "behavior": { "purchase_channel": "offline dealers", "device": "Android phone, rarely a laptop" },
    "needs_pains": ["Forgets details agreed on phone calls", "Distrusts tools his staff cannot use"],
    "tech_adoption": "Late majority: adopts only after peers prove value",
    "social": "Decisions influenced by long-time suppliers and his eldest son"
  },
  "layers": {
    "expression": ["Show me who else is using it.", "Is it complicated?"],
    "story": "Runs a family shop for 20 years; staff of 6; closes most deals on calls and WeChat voice messages.",
    "cognition": {
      "decision_weights": [
        { "factor": "ease of use", "level": "high" },
        { "factor": "peer proof", "level": "high" },
        { "factor": "after-sales support", "level": "medium" }
      ]
    },
    "behavior": ["Keeps a paper notebook of orders", "Asks his son to set up new apps"]
  },
  "evidence": [
    {
      "id": "e1",
      "type": "web",
      "title": "Survey of SME owners' digital tool adoption",
      "url": "https://example.com/sme-survey",
      "file": "",
      "quote": "Over half of owners cite staff training as the main barrier."
    },
    {
      "id": "e2",
      "type": "social",
      "platform": "xiaohongshu",
      "title": "Xiaohongshu: How I keep track of phone orders in my shop",
      "url": "https://example.com/post/123",
      "file": "",
      "quote": "Every order still goes into my notebook first."
    },
    {
      "id": "e3",
      "type": "upload",
      "title": "Customer interview notes",
      "url": "",
      "file": "uploads/owner-interviews.docx",
      "quote": "Phone deals are the norm; nobody writes contracts for small orders."
    }
  ],
  "field_sources": {
    "demographics": ["e1"],
    "geography": "inferred",
    "psychographics": "inferred",
    "behavior": ["e2", "e3"],
    "needs_pains": ["e1", "e3"],
    "tech_adoption": ["e1"],
    "social": "inferred"
  },
  "consistency_notes": ["Complains about lost orders, yet refuses to let staff record calls"],
  "created_in": "studies/ai-recorder-smb-owners-3f9a",
  "updated_at": "2026-10-18T14:20:00+08:00"
}
```

## panels/<panel_id>.json

Path: `panels/<panel_id>.json` (project-level saved group).

| Field | Required | Values |
|---|---|---|
| `schema_version` | yes | `1` |
| `id` | yes | same as the file name without `.json` |
| `name` | yes | display name |
| `persona_ids` | yes | list of persona ids |
| `criteria` | no | how members were selected |

Example:

```json
{
  "schema_version": 1,
  "id": "panel_smb_owners_2c41",
  "name": "SMB owners, tier 2-3 cities",
  "persona_ids": ["p_zhangwei_7f3a", "p_liumin_0b9e"],
  "criteria": "Owners of businesses with 5-50 staff who negotiate deals by phone"
}
```

## studies/<slug>/panel.json

The personas used in this study. Same fields as a panel file, plus `selection` recording why each persona was chosen, whether it was reused from the library, and which quota segment it fills, and `leak_check` (`{ "status": "passed" | "skipped", "note", "overrides": [{ "persona", "field", "hypothesis_id", "reason" }] }`) when the study has hypotheses. The order of `persona_ids` is the interview order used for saturation in `synthesis.json`.

| Field | Required | Values |
|---|---|---|
| `schema_version`, `id`, `name`, `persona_ids`, `criteria` | as in the panel file | |
| `selection` | no | one item per persona: `{ "persona_id", "reason", "reused": true \| false, "segment" }`; `segment` equals a `study.json` `quota[].segment` |

Example:

```json
{
  "schema_version": 1,
  "id": "panel_ai-recorder-smb-owners-3f9a",
  "name": "Study panel",
  "persona_ids": ["p_zhangwei_7f3a", "p_liumin_0b9e"],
  "criteria": "SMB owners who rely on phone calls to close deals",
  "selection": [
    { "persona_id": "p_zhangwei_7f3a", "reason": "Non-user who closes deals by phone; covers the skeptic quota", "reused": true, "segment": "Building materials" },
    { "persona_id": "p_liumin_0b9e", "reason": "Runs 6 stores and already uses a scheduling app; covers current tool users", "reused": false, "segment": "Restaurant chains" }
  ]
}
```

## studies/<slug>/interviews/<persona_id>.json

| Field | Required | Values |
|---|---|---|
| `schema_version` | yes | `1` |
| `persona_id` | yes | interviewed persona |
| `status` | yes | `done` \| `running` \| `failed` |
| `error` | no | reason when `status` is `failed`, otherwise `""` |
| `rounds` | yes | array of `{ "role": "moderator" \| "persona", "text" }` in speaking order |
| `rounds[].request_id` | no | copied from an explicit user chat request onto its question and answer; retries reuse it and do not append another answer |
| `rounds[].source` | no | `user` on a question typed by the user; absent for automatic moderator questions |
| `insights_outdated` | no | `true` after user chat adds answers without regenerating the original summary and report |
| `summary` | no | short summary of the interview |
| `key_findings` | no | array of strings |
| `quotes` | no | array of `{ "text", "theme" }`; `text` is the persona's exact words from `rounds` |
| `quality` | no | written by the interviewer when the transcript ends: `{ "concrete_stories", "inferred_ratio", "agreement_flags", "notes" }` |

`quality` fields:

- `concrete_stories`: integer, persona answers that describe a specific past event (when, who, what happened).
- `inferred_ratio`: number from 0 to 1 with two decimals, the share of the persona's sentences that contain `(inferred)`.
- `agreement_flags`: integer, answers that merely agree with the moderator's framing without adding the persona's own experience.
- `notes`: one short sentence on anything that weakens the transcript, or `""`.

Round references: other files point into a transcript with `round_index`, the 0-based index into `rounds`. In the example below, index 1 is the persona's first answer. Append new rounds at the end and never reorder, merge, or delete earlier items, so existing references stay valid.

Example:

```json
{
  "schema_version": 1,
  "persona_id": "p_zhangwei_7f3a",
  "status": "done",
  "error": "",
  "rounds": [
    { "role": "moderator", "text": "Tell me about the last time you lost track of what was agreed on a call." },
    { "role": "persona", "text": "Last month a contractor said we agreed on a lower price. I had no record, so I gave in." },
    { "role": "moderator", "text": "Why did you give in instead of checking?" },
    { "role": "persona", "text": "He has ordered from me for ten years. Arguing costs more than the discount." }
  ],
  "summary": "Values relationships over records; losses from verbal agreements are accepted as a cost of business.",
  "key_findings": ["Pain is real but tolerated", "Trust and peer proof matter more than features"],
  "quotes": [{ "text": "Arguing costs more than the discount.", "theme": "relationship over records" }],
  "quality": { "concrete_stories": 1, "inferred_ratio": 0.0, "agreement_flags": 0, "notes": "" }
}
```

## studies/<slug>/discussions/<discussion_id>.json

The same fields as an interview file without `persona_id`, plus `id` and `participants`. Each round uses `speaker` instead of `role`: `"moderator"` or a participant's `persona_id`.

| Field | Required | Values |
|---|---|---|
| `schema_version` | yes | `1` |
| `id` | no | same as the file name without `.json` |
| `participants` | yes | list of persona ids (3-6) |
| `topic` | no | the discussion topic in one short line, in the user's language; `persona_chat` saves it from the first round's `topic` and the UI shows it as the discussion title |
| `status` | yes | `done` \| `running` \| `failed` |
| `error` | no | reason when `status` is `failed` |
| `rounds` | yes | array of `{ "speaker": "moderator" \| <persona_id>, "text" }` |
| `summary`, `key_findings`, `quotes`, `quality` | no | as in the interview file; `quality` counts all participants' answers together |

Example:

```json
{
  "schema_version": 1,
  "id": "fg_pricing_9d20",
  "participants": ["p_zhangwei_7f3a", "p_liumin_0b9e", "p_chenjing_51ac"],
  "status": "done",
  "error": "",
  "rounds": [
    { "speaker": "moderator", "text": "Would you pay 299 a year for automatic call notes?" },
    { "speaker": "p_zhangwei_7f3a", "text": "Not before I see a friend using it." },
    { "speaker": "p_liumin_0b9e", "text": "299 is nothing if it saves my managers one hour a week." },
    { "speaker": "p_chenjing_51ac", "text": "I agree with Liu on value, but my staff will not record customers." }
  ],
  "summary": "Price is acceptable to efficiency-driven owners; trust and recording consent block others.",
  "key_findings": ["Disagreement: value vs. trust", "Recording consent is an unaddressed barrier"],
  "quotes": [{ "text": "Not before I see a friend using it.", "theme": "peer proof" }],
  "quality": { "concrete_stories": 0, "inferred_ratio": 0.0, "agreement_flags": 1, "notes": "p_chenjing_51ac opened by agreeing with the previous speaker." }
}
```

## studies/<slug>/synthesis.json

The structured analysis behind the report and the analysis board. Write it in the report phase before `report.html`; the report's findings must match it.

| Field | Required | Values |
|---|---|---|
| `schema_version` | yes | `1` |
| `segments` | yes | array of `{ "id", "name", "persona_ids" }`; `id` is `seg_<short-ascii>`, `name` equals a `quota[].segment` |
| `themes` | yes | array of theme objects, see below |
| `dimensions` | no | array of `{ "id", "name", "level_by_segment", "quote_refs" }`: `id` is `D1`, `D2`, ...; `level_by_segment` maps segment id to `high` \| `medium` \| `low`; `quote_refs` as in themes |
| `saturation` | yes | `{ "new_themes_per_interview": [<int>, ...], "saturated": true \| false }`, see methods.md |
| `homogeneity` | no | `{ "unanimous_theme_ids": ["T1", ...], "warning": true \| false }`, see methods.md |
| `checks` | no | written by the tool: `{ "quotes_total", "removed_quotes", "ignored_source_refs", "adjustments", "downweighted_interviews" }`; the report's limitations take the removed-quote count and rule adjustments from here |

Theme object:

| Field | Required | Values |
|---|---|---|
| `id` | yes | `T1`, `T2`, ... |
| `name` | yes | short theme name |
| `description` | no | one or two sentences |
| `stance_by_persona` | yes | maps every interviewed persona id to `support` \| `oppose` \| `mixed` \| `not_mentioned` |
| `quote_refs` | no | array of `{ "persona_id", "source": "interview" \| "discussion", "file", "round_index", "text", "prompted", "question" }`; `question` is the moderator message the quote answered; `file` is relative to the study directory (`interviews/<persona_id>.json` or `discussions/<discussion_id>.json`); `round_index` and `text` follow the evidence-reference rules in study.json |
| `source_refs` | no | desk-research source numbers, for example `["S3"]` |
| `hypothesis_ids` | no | related hypotheses, for example `["H1"]` |
| `confidence` | yes | `high` \| `medium` \| `low` \| `to_validate`, set by the confidence rules in methods.md |
| `confidence_reason` | no | one sentence naming the rule that applied |

Example:

```json
{
  "schema_version": 1,
  "segments": [
    { "id": "seg_build", "name": "Building materials", "persona_ids": ["p_zhangwei_7f3a"] },
    { "id": "seg_food", "name": "Restaurant chains", "persona_ids": ["p_liumin_0b9e"] }
  ],
  "themes": [
    {
      "id": "T1",
      "name": "Unrecorded verbal agreements",
      "description": "Deals agreed by phone are later disputed and the owner gives in.",
      "stance_by_persona": { "p_zhangwei_7f3a": "support", "p_liumin_0b9e": "mixed" },
      "quote_refs": [
        { "persona_id": "p_zhangwei_7f3a", "source": "interview", "file": "interviews/p_zhangwei_7f3a.json", "round_index": 1, "text": "I had no record, so I gave in." }
      ],
      "source_refs": ["S3"],
      "hypothesis_ids": ["H1"],
      "confidence": "medium",
      "confidence_reason": "One external source and consistent interviews; not yet validated with real people."
    },
    {
      "id": "T2",
      "name": "Peer proof before trying",
      "stance_by_persona": { "p_zhangwei_7f3a": "support", "p_liumin_0b9e": "not_mentioned" },
      "quote_refs": [
        { "persona_id": "p_zhangwei_7f3a", "source": "discussion", "file": "discussions/fg_pricing_9d20.json", "round_index": 1, "text": "Not before I see a friend using it." }
      ],
      "source_refs": [],
      "hypothesis_ids": ["H2"],
      "confidence": "to_validate",
      "confidence_reason": "Supported by AI interviews only."
    }
  ],
  "dimensions": [
    {
      "id": "D1",
      "name": "Price",
      "level_by_segment": { "seg_build": "medium", "seg_food": "low" },
      "quote_refs": [
        { "persona_id": "p_liumin_0b9e", "source": "discussion", "file": "discussions/fg_pricing_9d20.json", "round_index": 2, "text": "299 is nothing if it saves my managers one hour a week." }
      ]
    }
  ],
  "saturation": { "new_themes_per_interview": [4, 2, 1, 0, 0], "saturated": true }
}
```

## studies/<slug>/validation-results.json

The comparison between AI findings and real respondents' answers. Write it only when at least one real respondent's answers were read.

| Field | Required | Values |
|---|---|---|
| `schema_version` | yes | `1` |
| `respondent_count` | yes | integer, real respondents whose answers were read (at least 1) |
| `source_files` | no | workspace-relative paths of the uploaded files |
| `by_hypothesis` | yes | array of `{ "hypothesis_id", "ai_verdict", "human_verdict", "agreement", "summary", "human_quotes" }`: `ai_verdict` and `human_verdict` use the hypothesis verdict enum; `agreement` is `agree` \| `partial` \| `disagree`; `human_quotes` are short de-identified quotes |
| `by_question` | no | array of `{ "question_id", "hypothesis_id", "ai_summary", "human_summary", "agreement" }`; `question_id` matches the questionnaire (`Q1`, `Q2`, ...) |
| `summary` | no | which conclusions real people confirmed and which need revision |

Example:

```json
{
  "schema_version": 1,
  "respondent_count": 12,
  "source_files": ["uploads/validation-answers.xlsx"],
  "by_hypothesis": [
    {
      "hypothesis_id": "H1",
      "ai_verdict": "supported",
      "human_verdict": "supported",
      "agreement": "agree",
      "summary": "Most real owners described losing money on an unrecorded phone deal.",
      "human_quotes": ["A customer denied the price we agreed on, and I had nothing to show."]
    },
    {
      "hypothesis_id": "H2",
      "ai_verdict": "mixed",
      "human_verdict": "mixed",
      "agreement": "partial",
      "summary": "Price was acceptable, but most wanted a free trial before paying.",
      "human_quotes": ["I'd pay if I can try it for a month first."]
    }
  ],
  "by_question": [
    { "question_id": "Q1", "hypothesis_id": "H1", "ai_summary": "Disputes over verbal deals are common.", "human_summary": "Most had at least one dispute in the past year.", "agreement": "agree" }
  ],
  "summary": "Real owners confirmed the recording pain; the price hypothesis holds only with a free trial."
}
```
