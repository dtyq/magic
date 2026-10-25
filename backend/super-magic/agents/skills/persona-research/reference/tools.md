# Persona Research Tools

These tools write every structured study file. Call them from `run_sdk_snippet` with `tool.call(...)` and print `result.content`. Never write `study.json`, `panel.json`, persona files, transcripts, `synthesis.json`, or the questionnaire CSV with `write_file`, `edit_file`, or Python; the tools assign ids, round indexes, and tiers, check the file contracts, and apply the rules in methods.md. When a tool rejects a call, `result.content` names the problem and nothing was written: fix the arguments and call it again.

Each tool returns `result.data["study_dir"]` where relevant. Pass `study_dir` as `studies/<slug>`.

```python
from sdk.tool import tool

result = tool.call("update_study", {"event": "clarified", "study_dir": "studies/<slug>"})
print(result.content)
```

## update_study

Creates the study and moves `study.json` through its phases. You report what happened; the tool sets every phase status, keeps `topic_id`, and refuses events that do not fit the current phase.

| `event` | Call it when | Extra arguments |
|---|---|---|
| `created` | After the pre-search, before clarifying questions; for a persona-building request, before reading the materials | `title`, `question` (the user's words, verbatim), `slug_hint` (short ASCII kebab-case topic summary; use pinyin or English for non-Latin topics), `study_type: "persona_build"` only for a persona-building request |
| `clarified` | Clarification answered, or nothing needed clarifying | — |
| `plan_confirmed` | The user chose the start option in `ask_user` | `study_type`, `framework`, `decision`, `hypotheses` (`[{statement, support_criteria, refute_criteria, outcome_terms}]` in plan order; ids `H1`, `H2`, ... are assigned; `outcome_terms` are 4-12 short phrases a persona would use to state the tested outcome, including everyday paraphrases, for example `["用不完", "剩着", "白交钱", "规则"]`, each at least 2 characters), `quota` (`[{segment, criteria, count}]`; counts add up to the persona count, at most 12), `interview_rounds` (automatic ceiling, default 20, at most 20; not a required count; a lower explicit user ceiling is allowed), `guide_review` (`[{issue, before, after}]`, `issue` is `leading`, `double_barreled`, `hypothesis_reveal`, `jargon`, or `sequence_priming`; `[]` when nothing changed) |
| `desk_research_done` | `desk-research.md` is written | `social_sampling`: `{status: "sampled", platforms, posts, comments}` (`posts`: social posts actually opened, not all desk-research sources; `comments`: comments actually read; both must match the counts stated in `desk-research.md`), or `{status: "unavailable" or "not_relevant", note}` with the reason |
| `desk_research_skipped` | A `panel_only` study skips desk research | — |
| `interviews_finished` | `check_interviews` shows no unfinished transcript | — (the tool marks the interview phase failed when no interview succeeded) |
| `report_written` | `synthesis.json` and `report.html` are written | — |
| `questionnaire_written` | `validation-questionnaire.md` and `.csv` are written | — |
| `validation_compared` | Real-person answers were compared | `validated_count`, `validations` (`[{hypothesis_id, verdict: agree, partial, or disagree, summary}]`) |

`created` returns the new directory in `result.data["study_dir"]`; use it for every later call.

```python
created = tool.call("update_study", {
    "event": "created",
    "title": "<short title in the user's language>",
    "question": "<the user's question, verbatim>",
    "slug_hint": "trial-churn-week-two",
})
print(created.content)
study_dir = created.data["study_dir"]
```

## save_personas

Saves the study's personas and `studies/<slug>/panel.json` in one call, in interview order. Call it in the `interview` phase, after `desk_research_done` or `desk_research_skipped`.

In a `persona_build` study, call it only after the user approved the drafts; at most 6 personas, `segment` is a short audience label, and the call finishes the study (`phase=done`). No other `update_study` event is accepted for that study.

- New persona: leave `id` empty and give `id_hint` (short ASCII, for example `zhangwei`), `name`, `tagline`, `tags`, all 7 `dimensions`, all 4 `layers`, `evidence` (`[{id: "e1", type, platform, title, url, file, quote}]`; `platform` only for `social`), `field_sources` for all 7 dimensions (evidence ids or `"inferred"`), `consistency_notes`, and `field_labels`: a display name in the user's language for every key you invent inside `dimensions` or `layers`, for example `{"monthly_allowance_cny": "月生活费（元）"}`. Standard keys need none: `age`, `gender`, `city`, `city_tier`, `region`, `education`, `income`, `occupation`, `values`, `risk_attitude`, `lifestyle`, `purchase_channel`, `device`. The tool creates the id, fills `schema_version`, `created_in`, and `updated_at`, and computes `tier` by rule.
- Reused persona: give its `id`. Identity and content fields stay unchanged; you may add new `evidence` (new ids), missing `field_sources`, `consistency_notes`, and missing `field_labels`. `imported` and `manual` personas keep their tier.
- The tool rejects a persona, new or reused, whose `tagline`, `tags`, `expression`, `needs_pains`, `tech_adoption`, or `decision_weights` factors contain a hypothesis's `outcome_terms`; rewrite those fields as situation and behavior facts, or do not select the reused persona. When `social_sampling` is `sampled`, every new persona needs at least one `social` evidence item.
- After the keyword check, a semantic check flags stance fields that state a hypothesis's outcome in other words, and the call is rejected with each flagged persona, field, text, and hypothesis. Fix all flags in one retry: rewrite a field as a past fact, or, when the text is already a dated concrete event, keep it with `leak_overrides`: `[{persona, field, hypothesis_id, reason}]` (`persona` is the name or id); overrides are recorded in `panel.json` and belong in the report limitations. The check rejects a study only once; a later save goes through and records the remaining flags (`leak_check.status` is `flagged`), which also belong in the report limitations.
- Every persona also needs `segment` (a quota segment) and `reason`. Set `from_uploaded_people: true` only for personas built from uploaded materials about real people.
- `panel_name` and `criteria` describe the group. Set `library_panel_name` only when the user asked to save the group to the library.
- `append: true` adds the listed personas to the existing panel instead of replacing it, from the `interview` phase on (also after `done`). Use it to bring new people into a follow-up focus group. The panel may hold at most 12 personas in total, listed personas must not already be on it, and the same outcome-term and semantic checks apply to them.

```python
result = tool.call("save_personas", {
    "study_dir": study_dir,
    "panel_name": "<panel name>",
    "criteria": "<how members were selected>",
    "personas": [
        {"id": "p_zhangwei_7f3a", "segment": "<quota segment>", "reason": "<why>"},
        {
            "id_hint": "liumin", "segment": "<quota segment>", "reason": "<why>",
            "name": "<name>", "tagline": "<one line>", "tags": ["<tag>"],
            "dimensions": {"demographics": {}, "geography": {}, "psychographics": {}, "behavior": {},
                           "needs_pains": [], "tech_adoption": "", "social": ""},
            "layers": {"expression": [], "story": "",
                       "cognition": {"decision_weights": [{"factor": "<factor>", "level": "high"}]},
                       "behavior": []},
            "evidence": [{"id": "e1", "type": "web", "title": "<title>", "url": "<url>", "quote": "<short quote>"}],
            "field_sources": {"demographics": "inferred", "geography": "inferred", "psychographics": "inferred",
                              "behavior": ["e1"], "needs_pains": ["e1"], "tech_adoption": "inferred", "social": "inferred"},
            "consistency_notes": [],
        },
    ],
})
print(result.content)
```

The content lists each persona id; use `personas/<persona_id>.json` in the interviewer briefs.

## check_interviews

Read-only. Lists every panel persona with its transcript status (`not_started`, `running`, `done`, `failed`), recorded rounds, and the round to continue from, plus focus groups and the effective sample. It also flags rounds that may join two questions under one question mark; in synthesis, mark answers to the second part of a flagged round as `prompted`. Call it after `wait_for_subagents`, and again after any interruption, before deciding what to re-dispatch.

```python
print(tool.call("check_interviews", {"study_dir": study_dir}).content)
```

## save_study_synthesis

Writes `synthesis.json` and the hypothesis verdicts in `study.json` together. Call it in the `report` phase after reading the completed transcripts. Give only judgments and exact words:

- `segments`: `[{name, persona_ids}]`, names equal to quota segments. Ids are assigned. Place each persona by what they said in the interview: when it contradicts the recruited segment (recruited as a current user, says they stopped), use the interview and say so in the report's method.
- `themes`: `[{name, description, stance_by_persona, quotes, source_refs, hypothesis_ids, confidence, confidence_reason, about_willingness_to_pay}]`. `quotes` are `[{persona_id, text, prompted}]` with the persona's exact words; set `prompted: true` when the moderator's question already named the idea. The tool finds the transcript file, `round_index`, and the question it answered. Personas you leave out of `stance_by_persona` become `not_mentioned`. Set `about_willingness_to_pay: true` for themes about price acceptance.
- `dimensions` (optional): `[{name, level_by_segment, quotes}]`, `level_by_segment` keyed by segment name.
- `hypotheses`: `[{id, verdict, verdict_reason, quotes, sources}]` for every examined hypothesis. `sources` are `[{ref, claim, covers}]`: the source id, one sentence on what it says about this hypothesis, and `covers: "core"` only when it states the hypothesis's core claim itself, otherwise `"context"`.

The tool drops quotes that are not that persona's exact words and source refs that are not in `desk-research.md`, lowers confidence and verdicts that break the rules in methods.md (and says why in the reason fields), and computes saturation and homogeneity. Read `result.content`, and use the adjusted verdicts and confidence. The same checks are saved in `synthesis.json` `checks`; take the removed quote count and adjustments for the report from there.

```python
result = tool.call("save_study_synthesis", {
    "study_dir": study_dir,
    "segments": [{"name": "<quota segment>", "persona_ids": ["p_zhangwei_7f3a"]}],
    "themes": [{
        "name": "<theme in the user's words>",
        "stance_by_persona": {"p_zhangwei_7f3a": "support", "p_liumin_0b9e": "oppose"},
        "quotes": [{"persona_id": "p_zhangwei_7f3a", "text": "<exact words>", "prompted": False}],
        "source_refs": ["S3"], "hypothesis_ids": ["H1"],
        "confidence": "medium", "confidence_reason": "<rule that applied>",
    }],
    "hypotheses": [{
        "id": "H1", "verdict": "supported", "verdict_reason": "<one or two sentences>",
        "quotes": [{"persona_id": "p_zhangwei_7f3a", "text": "<exact words>"}],
        "sources": [{"ref": "S3", "claim": "<what S3 says about H1>", "covers": "core"}],
    }],
})
print(result.content)
```

## save_validation_questionnaire

Writes `validation-questionnaire.csv` for survey tools. Write `validation-questionnaire.md` yourself first; then pass the same questions: screening questions (`S1`, `S2`, ..., no `hypothesis_id`) followed by guide questions (`Q1`, `Q2`, ..., each with its `hypothesis_id`). `type` is `single_choice`, `multiple_choice`, or `open`; choice questions need at least 2 `options`, open questions none.

```python
result = tool.call("save_validation_questionnaire", {
    "study_dir": study_dir,
    "questions": [
        {"id": "S1", "question": "<screening question>", "type": "single_choice", "options": ["<a>", "<b>"]},
        {"id": "Q1", "question": "<guide question>", "type": "open", "hypothesis_id": "H1"},
    ],
})
print(result.content)
```

## Interviewer Tools

Interviewer sub-agents record rounds with `persona_chat` (`transcript_path` plus `round_number`) and close each transcript with `finish_persona_transcript`. For a follow-up you run yourself ("Ask @persona ..."), call `persona_chat` the same way with the next `round_number`, then `finish_persona_transcript` again; the transcript reopens automatically when a finished one gets a new round.

## Persona Portrait Tools

For photographic avatars, read [persona-portraits.md](persona-portraits.md).

- `assign_persona_portraits`: `requests` (one entry per saved persona with only known `age`, `gender`, `country`, `industry` as an ISIC Rev.5 section letter, and explicitly stated `hair`, `facial_hair`, `accessories`), optional `replace`. Matches the official avatar library, downloads the chosen image, saves it as the persona's project-level WebP, and reports `match` as `exact`, `family`, or `generic` per persona. Never generates images; unresolved personas keep their existing display. Refuses an avatar another persona already uses, so personas never share a face.
- `attach_persona_portrait`: `persona_id` (existing saved ID), `image_path` (successful workspace-relative generation output), optional `replace` (default false; only for a requested appearance change). Validates the raster, saves a small project-level WebP, and updates only the persona's optional `portrait` and `updated_at`. A failed call preserves the previous avatar, including when the image is identical to another persona's avatar. No study-phase transition or interview is needed.
- `embed_persona_portraits`: `study_dir`. Embeds the panel's already bound WebP avatars into its existing `report.html`. The `report_written` event runs this automatically; call it directly only when a selected existing report needs its avatars refreshed. Repeat safely after a requested avatar replacement or report rewrite. It does not generate images, edit transcripts, change evidence, or edit templates.

Print and check each result's `content`. A failed generation or attachment leaves the existing image or SVG fallback; do not promise the portrait was installed.
