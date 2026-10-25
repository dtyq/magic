# Persona Research Methods

## Study Types

Pick one `study_type` in the plan. Types set the default mix of methods; you may combine methods when the question needs it.

| `study_type` | Use when | Default method mix | Typical frameworks |
|---|---|---|---|
| `user_research` | Understanding needs, motives, pain points, or churn of a known audience | Desk research + one-on-one interviews; optional focus group to test disagreement | JTBD, user journey |
| `product_rnd` | Deciding what to build or improve: feature priority, requirements, product-market fit | Desk research (competitors, reviews) + interviews probing current workarounds | KANO, JTBD |
| `concept_test` | Reacting to a specific concept, message, package, or price | Short desk research + interviews presenting the concept + focus group comparing variants | KANO, STP |
| `fast_insight` | A quick directional read on a narrow question | Light desk research + 3-5 personas with 3 rounds each; no focus group | any one framework |
| `panel_only` | Interviewing an existing persona panel without new desk research | Reuse panel personas; skip desk research (mark `desk_research=skipped`) | as the question requires |

## Frameworks

- JTBD (Jobs to Be Done): identify the job the person hires a product for, in the form "When <situation>, I want to <motivation>, so I can <outcome>". Probe the trigger, the current solution and its workarounds, anxieties about switching, and the habits that keep the old solution.
- KANO: classify features as must-be, performance, attractive, indifferent, or reverse. Ask paired questions: "How would you feel if the product had X?" and "How would you feel if it did not?" Report the classification per segment, not one global answer.
- STP (Segmentation, Targeting, Positioning): segment by needs and behavior rather than demographics alone, assess segment attractiveness and fit, then test positioning statements with each target segment.
- User journey: map stages (aware, consider, try, adopt, renew or churn), the actions, touchpoints, emotions, and pain points at each stage, and the moments that decide progress or drop-off.

## Hypotheses

- Write 3-5 hypotheses that the decision depends on. Each is one falsifiable sentence about one claim; split "A and B are both preconditions" into two hypotheses, or a verdict on one half will be read as a verdict on both. Give each `support_criteria` and `refute_criteria` stated as observable answers or source findings, not as feelings.
- [Good] "Owners' biggest pain is unrecorded verbal agreements, not meeting notes." Support: most participants describe a specific dispute over an unrecorded deal. Refute: most only mention meeting notes.
- [Bad] "Owners like AI tools." It cannot be refuted and does not inform a decision.
- Give each hypothesis `outcome_terms`: 4-12 short phrases a respondent would use to state the tested outcome in the user's language, including the everyday paraphrases, because personas leak conclusions in other words. For "low-frequency buyers will not use up a monthly card": "用不完", "回不了本", "剩着", "白交钱", "去不了几次", "浪费". Pick phrases specific to the outcome, not generic words every persona needs ("咖啡", "老板"). `save_personas` blocks personas whose stance fields contain any of them.

## Sample Quota and Anti-Homogenization

- Build the quota from demographic, situational, and behavioral variables only: industry, company size, city tier, role, usage stage (current user, churned, never used), current workaround. Never stratify on the outcome being tested (willingness to pay, price sensitivity, intent to switch).
- At least 25% of the panel are non-users, skeptics, or churned users (2 of 8, 3 of 12). Spread them across segments.
- Each `quota[]` row names the segment, the selection criteria including the usage stage mix, and the count; counts add up to the persona limit.
- Within a segment, vary behavior and circumstances (budget, staff size, who decides, current tools), not only names and ages.
- Keep contradictions inside a persona (`consistency_notes`) instead of smoothing them out; real people are inconsistent.

### Personas Describe Situations, Not Verdicts

A persona that already holds the tested opinion turns the interview into an echo: the respondent repeats the profile and the hypothesis looks supported. Write personas as if you did not know the hypotheses.

- Stance fields (`tagline`, `tags`, `expression`, `needs_pains`, `tech_adoption`, `decision_weights`) describe the person's situation and general habits, never their view of the tested concept or outcome. Put past behavior in `story` and `behavior` as facts: what they did, when, at what cost.
- [Wrong] tagline "believes monthly cards are a bet you won't use them up"; decision weight "rules transparency: high" in a study testing whether rules matter more than price.
- [Right] "buys 2-3 coffees a week, usually with colleagues in the afternoon; turned off auto-renew on two video subscriptions last year".
- `expression` lines are voice samples about everyday life, not about the study topic.
- Reuse a library persona only when it belongs to this study's category and quota segment. A persona built for another product category (an electrolyte-drink persona in a coffee study) is not reused; draft a new one.
- When desk research sampled social platforms, anchor each new persona's situation in at least one real voice from the "Real Voices" section and cite it as `social` evidence.

Persona self-check, before calling `save_personas` (the tool also runs keyword and semantic leak checks): for every persona and every hypothesis, ask "could someone predict this persona's answer to the hypothesis from its stance fields alone?" If yes, rewrite the field as a past fact (what happened, when, at what cost) and drop the attitude. [Leak] needs_pains "afraid of buying another card and leaving sessions unused again" for a hypothesis about unused sessions. [Fact] behavior "last year's 10-session card: used 6, the rest expired".

### Optional Generated Portraits

When the user requests photographic persona avatars, read [persona-portraits.md](persona-portraits.md). Choose a photographic direction from each saved persona's situation; a panel may mix everyday, outdoor, and simple editorial portraits. Match from the official library with `assign_persona_portraits` first, generate through the product's `generate_images` tool only for gaps, reuse an existing suitable portrait, and keep the AI-simulation disclosure. Portraits are presentation assets, never research evidence or a reason to change the persona.

## Interview Guide

- Use 3-5 shared core questions for comparable coverage across personas, or fewer for a quick interview or an explicitly lower ceiling (never fewer than 1). The rest of the interview consists of probes chosen from each persona's actual answers, not a longer fixed questionnaire. Order them from broad to specific: recent behavior, the problem, current solutions, reaction to the concept, then price or switching. Cut the least decision-relevant question instead of merging two, but never the only question that tests a hypothesis.
- Round budget: core questions, the negative question and the pressure round must fit the ceiling with room for at least one probe (core + 3 <= ceiling). With a low ceiling, reduce the number of core questions in the plan rather than letting interviewers drop them later. During an interview, when rounds run short, keep this priority: core questions, then the negative question, then the pressure round, then probes.
- One question per round. `persona_chat` rejects a message with several question marks or a numbered list.
- Open questions only; never ask two things in one question.
- Do not reveal the hypothesis before the participant has described their own behavior.
- Include at least one negative question: "In what situation would you not use this, or give up on it?"
- Use the participant's everyday words instead of research or industry jargon.
- Treat depth as a preference, not a quota: quick usually takes 3-5 rounds, standard/auto usually 8-12, and deep explores remaining useful details, always at most 20. After each answer, choose the most decision-relevant unresolved detail (episode, motive, constraint, contradiction or counterexample). Stop once core coverage is sufficient and two consecutive probes add no new useful information; end earlier when no relevant gap remains. Never force equal question counts across personas. Record the stopping reason and remaining gaps in the interview summary. The guide is not a script to read verbatim.

### Guide Self-Check

Before showing the plan, check every guide question against this list, rewrite the ones that fail, and record each change in `plan.md` ("Guide self-check"); pass the same changes as `guide_review` when you send `plan_confirmed`.

| `issue` | Fails when | Before | After |
|---|---|---|---|
| `leading` | The question suggests the expected answer | "Don't you find keeping records a hassle?" | "The last time a deal was not written down, what happened next?" |
| `double_barreled` | One question asks two things | "How do you choose and pay for software?" | "How did you choose the last tool you bought?" (ask about paying separately) |
| `hypothesis_reveal` | The question states the hypothesis before the participant describes their behavior | "Would a recorder that stops customers backing out of deals help you?" | "Tell me about a deal where the customer later remembered it differently." |
| `jargon` | The question uses terms the audience does not use | "How do you manage your private-domain retention?" | "How do you get past customers to come back?" |
| `double_barreled` (one question mark) | Two questions are joined by a comma under one question mark | "What kind of membership would you not buy, and if that were fixed would you buy it?" | Ask "What would make you decide not to buy it?" now and "If that changed, what would you do?" next round |
| `sequence_priming` | An earlier question's wording steers a later answer, or a question presupposes the hypothesis's situation | "What would you want to know first?" followed by "Which rules would make it a bad deal?" | "What would you want to know first?" followed by "What would make you decide not to buy it?" |

Also check the guide as a whole. Coverage: every hypothesis is tested by at least one core question; list the question number(s) beside each hypothesis in `plan.md` (the interviewers never see this map). A rewritten question replaces its original in the final guide; a question that exists only in the self-check table is not in the guide. Balance: if a hypothesis says X matters more than Y, the guide must ask about X and Y with equal weight, or neither by name.

## Interview Techniques

Probing protocol for every one-on-one interview:

1. Episode first: before any opinion, get the most recent concrete occasion ("the last time you..., what happened?").
2. One layer deeper on every key answer: "why", "what else did you consider", or "what did it cost you".
3. One pressure round: present the strongest counter-argument or alternative ("Some people say typing it into WeChat is enough. What do you think?") and record whether the persona holds or shifts.
4. Never put profile details the persona has not said in this interview into a question; that invites them to recite the profile.

- Five whys: on a key answer, ask "why" (in natural variations) until the answer reaches a motive, value, or constraint rather than a surface reason. Usually 2-4 steps are enough.
- Scenario simulation: ground answers in a concrete situation, either the most recent real one ("Walk me through the last time...") or a hypothetical one ("Suppose tomorrow your supplier offers... what do you do first?").
- Contrast probing: ask the participant to compare two options, brands, prices, or past and present behavior, and to explain what made the difference.
- Behavior over opinion: when an answer is a general opinion ("I like convenience"), ask for an example of what they actually did.
- Neutral follow-ups: repeat the participant's own words ("You said it felt risky — risky how?") instead of adding your interpretation.

## Focus Group Moderation

- 3-6 participants with deliberately different attitudes on the topic, including at least one skeptic.
- Open with a round where everyone answers the same warm-up question so every participant speaks.
- Rotate the speaking order every round (pass `persona_paths` in a different order) so the same person does not always set the tone.
- When opinions diverge, ask each side to respond directly to the other's point.
- If a participant keeps agreeing with others, probe them alone on their own experience.
- Do not take sides, summarize a consensus that did not happen, or let one participant dominate several rounds in a row.
- Record disagreements explicitly in `key_findings`.

## Synthesis

Save the synthesis with `save_study_synthesis` first, then write the report from it. Each step below is required; the tool enforces the parts marked as checked.

### Theme Coding

1. Read every completed transcript (`status=done`) in `panel.json` `persona_ids` order, then the focus groups.
2. For each transcript, list the distinct ideas the persona expressed in their own answers. Ignore what the moderator said.
3. Merge ideas with the same meaning into themes across transcripts; name each theme in the user's words, not a framework label.
4. For each theme, set the stance of every interviewed persona: `support` (they affirm it with their own experience), `oppose` (they contradict it), `mixed` (both), `not_mentioned`.
5. Attach 1-3 quotes per theme in the persona's exact words, link `source_refs` and `hypothesis_ids`, then apply the confidence rules.
6. Use `dimensions` only for factors compared across segments (for example purchase considerations); levels are `high`, `medium`, or `low`, never numbers.

### Saturation

- Checked by the tool: `new_themes_per_interview` counts, for each completed one-on-one interview in `panel.json` order, the themes whose first non-`not_mentioned` stance is that persona. Focus groups are not counted.
- `saturated` is `true` only when the last 2 entries are both `0`. Otherwise the report recommends a larger sample.

### Prompted Answers

Mark a quote `prompted` when the moderator's question already named the idea before the persona said it, including answers to the second part of a round `check_interviews` flagged as two questions in one (asked "which rules bother you", persona answers about rules). Volunteered ideas are stronger evidence. The tool records the question each quote answered and caps a theme whose quotes are all prompted at `low`.

### Homogeneity

Checked by the tool: a theme is unanimous when at least 3 personas support it, nobody opposes or is mixed, and at most one did not mention it. When more than half of the themes are unanimous, `homogeneity.warning` is true, unanimous themes are capped at `medium`, and the report's limitations must say that the AI respondents answered alike, which signals model homogeneity rather than strong evidence. Real samples rarely agree this uniformly. Saturation reached under a homogeneity warning is not a strength; do not present it as one.

### Downweighting

- Interviews with `quality.inferred_ratio` of 0.4 or more are downweighted: do not count them toward "most" in verdicts or confidence, and do not use them as the lead quote for a claim. The tool lists them and lowers a theme to `low` when all its quotes come from them.

### Hypothesis Verdict Rules

"External source" means a desk-research source or persona evidence of type `web`, `social`, or `upload`. AI interviews are never an external source.

| `verdict` | When |
|---|---|
| `pending` | Before the report phase, or the hypothesis was not examined |
| `supported` | The support criteria are met in most relevant completed interviews, at least one external source states the core claim (`covers: core`), and no external source contradicts it |
| `refuted` | The refute criteria are met in most relevant completed interviews and at least one external source states the refutation (`covers: core`) |
| `mixed` | Evidence splits across segments, interviews and sources disagree, or the AI-only cap below applies |
| `insufficient` | Fewer than 3 completed interviews address it and no external source covers it (checked by the tool: interviewees quoted for the hypothesis or holding a stance on its themes) |

A source covers the core claim only when it says the hypothesis itself, not just its background. [Context] "Users complain about auto-renewal" for "rules deter buyers more than price". [Core] "In a 2,000-person survey, most who dropped monthly cards cited expiry rules, few cited price". Sources about price levels or competitors' prices are context for any willingness-to-pay hypothesis.

AI-only cap (checked by the tool): when no source covers the core claim, the verdict is at most `mixed`, and every `mixed` verdict without such a source has a `verdict_reason` that starts with "Pending real-person validation" (in the user's language). Real-person results go into `validation`; they do not overwrite `verdict`.

### Theme Confidence Rules

| `confidence` | When |
|---|---|
| `high` | Real-person validation agrees, or at least 2 external sources agree and the relevant interviews are consistent |
| `medium` | 1 external source agrees and the relevant interviews are mostly consistent |
| `low` | External sources and interviews conflict, or the support rests mainly on downweighted interviews |
| `to_validate` | Supported by AI interviews only, however many personas agree; also any theme about willingness to pay (`about_willingness_to_pay`) until real people confirm it |

The tool lowers `high` and `medium` that lack the required external sources, rest on prompted answers or downweighted interviews, or concern willingness to pay, and records the rule in `confidence_reason`.

### Quote Checks

Use exact persona words when presenting interview evidence. `save_study_synthesis` locates each quote in that persona's own answers and drops the ones it cannot find; report how many were removed in the report's limitations (from `synthesis.json` `checks`), and never re-add a removed quote by paraphrasing it. Cite external facts to their external sources. Label your inference and cite its premises; reasoned inference about mechanisms, boundaries and consequences is expected (report-writing.md, "Analyse, Do Not Just Assemble"), presented as inference, not as an established cause. Recommendations explain which finding motivates the action and how to test it. An external fact or a recommendation does not require a persona quote.

### Writing Findings

Bottom line (the report's opening verdict):

- `go` only when every hypothesis the decision depends on is `supported` (or `refuted`, for a no-go) with a source that covers the core claim. When any of them is `mixed`, `insufficient`, or pending real-person validation, the verdict is at most `conditional`, and the conditions are exactly the things to validate first.
- When synthesis raised a homogeneity warning, or the leak check was skipped or overridden, say so beside the opening judgment. Keep counter-evidence and minority views beside the findings they qualify; when selecting the top themes, include a relevant opposing or mixed theme if one exists.
- AI-simulated samples do not support statistical inference. Never report percentages, ratios or averages from AI interviews, or words that imply prevalence among real people. Naming the personas who said something, or a plain count of them ("three of the four interviewees"), is concrete and allowed when it matches the cited quotes; it describes this panel only. Effective sample accounting describes the study as a whole, not support for an individual claim. A theme raised by one persona is a signal, not a pattern; `not_mentioned` is silence, never agreement.
- Compare public voices and AI interviews only on the same claim in comparable circumstances. Opposite answers are conflicting evidence; answers about different questions are not comparable, and silence leaves an evidence gap. For example, "I check the price before buying" and "a friend prompted me to try" can both be true. Do not infer disagreement or weaken a hypothesis merely because the statements emphasize different things.

Use [report-templates.md](report-templates.md) for report structure, attribution display and sample accounting, and [report-charts.md](report-charts.md) to decide whether a chart adds information. These presentation choices do not change the verdict or confidence rules above.

### Recommendations

Answer the decision in the confirmed plan. Include only actions relevant to that decision and supported by the findings; each identifies its hypothesis, evidence or inference, and the observable result that would justify proceeding. Untested actions remain candidates. A conditional verdict gives tests and the actions conditional on their results; a no-go gives stopping conditions or cheap tests, not a launch plan. Feature and usability studies need no positioning, pricing, channel strategy or 30-day launch plan unless the confirmed decision calls for them.

When pricing is relevant, give a direction and range only if cited evidence supports them; otherwise state the missing evidence and how to collect it. Never invent a range, derive one from AI answers, or present one AI answer as a recommended price. AI price and willingness-to-pay answers may be optimistic and cannot set a price without real-person validation; state this beside any AI-derived pricing direction. Report observed spending as an observation, not as a price recommendation.

## Real Voices (Desk Research)

Real users' own words on social platforms are the closest thing to real respondents before validation. Sample them directly whenever a platform data skill is available.

- Choose platforms by audience: consumer products and lifestyle topics → Xiaohongshu and Douyin; professional, B2B, and technical audiences → Zhihu and Bilibili. Sample 1-2 platforms.
- Search with the audience's everyday words, open the most relevant high-engagement posts, and read their comments; comments carry more honest objections than the posts.
- In `desk-research.md`, add a "Real Voices" section: group short anonymized quotes by theme, each citing its post as a numbered source `[S#]`, and note how many posts and comments each theme draws on. Include voices that contradict the brief's assumptions.
- Report what happened with `social_sampling` at `desk_research_done`: `sampled` with platforms and counts; `unavailable` when no platform skill exists or calls failed, with the reason; `not_relevant` only when the audience has no public discussion of the topic, with the reason.

