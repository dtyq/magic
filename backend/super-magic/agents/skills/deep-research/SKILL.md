---
name: deep-research
description: |
  Read this skill when the user asks for a research report, deep research, industry report, analysis report, whitepaper, or any substantive document deliverable; or when the topic requires multi-source retrieval and cross-validation (competitive analysis, market analysis, industry research, deep dive, landscape survey); or when the user is unsatisfied with the depth of an existing answer. Keyword signals: research, deep research, deep dive, analysis, investigate, report, survey, industry analysis, competitive analysis, market analysis. Trigger when: (1) the user wants to produce a formal report or research document as the deliverable; (2) the topic requires current, verifiable data from multiple sources — news, market analysis, competitive landscape, industry research; (3) the user is unsatisfied with the depth of an existing answer. Skip when a single search or model recall suffices and no document output is needed.

---

# Deep Research Skill

Turn vague questions into verifiable, actionable, evidence-backed research outcomes, with polished HTML report as default deliverable.

---

## References (Read On Demand)

Each file maps to an independent condition — combine as needed:
- New research or deepening existing content -> [reference/research-workflow.md](reference/research-workflow.md) (full workflow, including gap diagnosis for deepening)
- Delivering an HTML report -> [reference/report-template.html](reference/report-template.html) (whether new or restructured)

---

## Non-Negotiable Rules

1. Plan and confirm before heavy execution: show the plan draft, then use `ask_user` under the interaction rules below. No heavy retrieval before user approval.
2. Minimize user typing: use interactive questions with useful choices and sensible preference defaults; do not present a text questionnaire or require answer codes.
3. Every major claim needs evidence: traceable to sources; include counter-evidence or uncertainty notes.
4. Default deliverable is HTML report: follow template rules for structure, citations, and visual quality.

---

## Immediate Actions After Trigger

### Step 1: Quick pre-search
Run one web_search call with 2-3 queries in parallel from different angles (e.g. "what is X" + "X current debates" + "X use cases"). No deep reading — just enough to understand the topic's shape and key concerns so the plan and questions are sharper.

### Step 2: Output the research plan draft
Include at least: objective and boundary, key question breakdown (3-7), source strategy, deliverable outline, expected depth mode.

### Step 3: Send kickoff questions with `ask_user`
Keep the plan in the assistant message. In one direct `ask_user` call, include:

1. Scope questions (≤3): unresolved choices that genuinely affect this research, customized from the pre-search rather than a fixed template. Reference dimensions (pick what applies): depth / time range / geography / source preference / angle of focus. Omit questions already answered by the user.
2. Optional add-ons (exactly 3): cross-domain or adjacent angles surfaced by the pre-search, outside the natural research scope but potentially valuable. Use one `confirm` question per angle; include only explicitly accepted add-ons. Do not put core research requirements here.
3. A final `confirm` question asking whether to begin with the displayed plan and the user's selections. This is separate from the scope questions; omit its `default` attribute.

Write questions and options in the user's language. Before the call, briefly explain that deep research takes longer than a quick answer because it involves multiple search rounds and cross-checking.

### Step 4: Continue from the user's answer
Let the tool pause and resume the task. Apply the shared interaction rules below before beginning retrieval.

### Interaction Rules (New Research, Deepening, and Follow-ups)

1. Call `ask_user` directly as the interactive main agent, never through `run_sdk_snippet`, `tool.call`, or a subagent. Send the questions as XML in `questions`. Omit `timeout` by default so the user can take the time needed. Use `timeout=60` only for a simple confirm or single-select question where every question has a safe default; never use it for input, multi-question forms, or decisions that materially change the research direction.
2. Use `confirm` for yes/no, `select` for one choice, `multi_select` for independent choices with suitable `min`/`max`, and `input` only for exact custom text without useful candidates. Each `<question>` asks one question; its `<option>` children are candidate answers. Explain option differences briefly. The system adds Other automatically. Set preference defaults to actual answer text, not letter codes; never default to approval to start research or restructure a report.
3. After calling, wait for the final tool `content`; do not poll or start dependent retrieval in the same tool batch. Read the result status, answers in question order, and any `remark`. A pending result is not an answer.
4. An `answered` result authorizes execution only when the user agrees to begin and any remarks are consistent with that agreement. Apply the chosen scope. If the user requests a revised plan, update it and confirm the revision through `ask_user` before executing it. If a critical answer remains ambiguous, ask only the single most important follow-up.
5. `timeout`, `skipped`, tool failure, or a policy skip does not grant approval, even when preference defaults are returned. Without prior explicit authorization, retain the plan, state that research has not started, and stop the dependent step. Do not automatically reissue the card or fall back to a text questionnaire. A refusal to begin also stops execution.
6. If the user explicitly says to skip questions and proceed with defaults, state assumptions and begin without asking again. Do not equate silence or refusal to execute with this instruction.
7. If `ask_user` is unavailable or forbidden in the current context (including subagents and non-interactive sources), do not attempt it repeatedly. Continue only when existing authorization and information suffice; otherwise explain the unresolved decision and stop that step. Subagents return unresolved questions to the parent agent. For invalid question arguments, correct them using the tool's error message and retry the direct call.

---

## When User Says "Too Shallow" / "Lacks Evidence" (Scenario B: Deepen Existing Content)

This is deepening mode, not a new report. Enter deepening mode instead of superficial rewriting.

Read `reference/research-workflow.md`, especially Phase 6's gap diagnosis. Inspect the existing content and the user's feedback, then show a concise deepening plan. In one direct `ask_user` call, collect only unresolved decisions:

- Biggest gap: insufficient evidence / vague conclusions / missing counterpoints / recommendations that cannot be acted on.
- Focus: data and facts / reasoning and methodology / industry cases and comparisons.
- For an existing HTML report (regardless of origin), use `confirm` to ask whether to restructure it using the full deep-research template, unless the user already made this choice. No automatic approval default.
- Confirm whether to begin the displayed deepening plan, following the shared interaction rules.

Use selection questions for gaps and focus, allowing multiple choices when appropriate. Do not ask the user to repeat feedback already provided; for example, "too little evidence and vague conclusions" answers the gap question.

If template restructuring is approved, read `reference/report-template.html` and restructure to it. Otherwise deepen within the existing format. Non-HTML content keeps its format. After approval to begin, retrieve evidence for weak areas and rewrite only affected sections, unless the user approved template restructuring.

---

## Minimal Execution Pseudoflow

```text
read this skill first
read research-workflow.md

if task is new research:
    quick pre-search -> draft plan
    if needed under interaction rules: direct ask_user kickoff
    apply interaction rules -> proceed only when authorized
    if output is HTML report: read report-template.html
    execute full workflow -> deliver

if task is deepening existing content:
    diagnose gaps (Phase 6 of research-workflow.md) -> show deepening plan
    if needed under interaction rules: direct ask_user for unresolved choices and confirmation
    apply interaction rules; if restructuring is approved: read report-template.html
    when authorized: re-run retrieval on weak areas
    rewrite affected sections, or restructure if approved -> deliver
```

---

## Output Style

- Planning and kickoff: concise, friendly, decision-ready
- Report phase: conclusion-first, evidence-transparent, method-reproducible
- Interaction: use `ask_user` for concise, clickable questions; ask more only when needed
