# Report Writing Rules

The reader runs the business and has to decide what to do next; they are not a researcher. Write the way a good business reporter writes a field story: a concrete person and scene, a plain judgment, the reasoning, then the evidence beside it. These rules cover every visible word of `report.html`: title, headings, badges, cards, captions and limitations. The universal rules come first; then follow the section for the report's language.

## Analyse, Do Not Just Assemble

A report that lines up quotes under themes only tells the reader what was said. Before drafting, write a short analysis outline for yourself from `synthesis.json` and the transcripts, and build each core judgment from it.

Climb three steps for every finding:

1. Observation: what the personas said or did, attributed and cited.
2. Interpretation: why it happens. Trace the causal chain link by link (who does what, under which constraint, at what cost) without skipping a step, and keep it separate from the observation.
3. Implication: what it changes for the decision: which option it favours, for which kind of store or user, and what result would prove it wrong.

Then add the one or two of these that change the decision, not all of them:

- Boundary: compare the personas whose answers differ and name the condition that separates them (staff count, store type, layout, shift), instead of calling the result "split".
- Connection: one cause behind several findings, a trade-off between two remedies, or a loop that keeps the problem invisible to whoever could fix it.
- Second-order effect: the consequence of the consequence (for example, new staff leave early, so senior staff spend the rush training replacements).
- Surprise: an answer that contradicts the brief's assumption or the obvious remedy, and what it implies.
- Other accounts side by side: when a manager, a rule or a source says something different from what a persona describes, put the two next to each other and say what the gap means.

Each section or theme proves one claim, and every quote in it serves that claim. Alternate claim, quote and a one-sentence "so what" that says which link of the claim the quote shows; never stack several quotes and close with "this shows the pressure is high". End a section with one plain sentence that states the mechanism as a principle, not a slogan.

A theme earns its own section only when it has an interpretation and at least one boundary, connection or consequence; otherwise merge it into another section or give it one line. Name a theme by its explanation, not its topic: "Restocking always gives way to the lunch queue", not "Restocking". Test: a theme name that would fit any other study is too vague.

Mark reasoning that goes beyond what was said as "our inference" (in the report's language) and cite its premises; analysis may propose a mechanism, never present it as proven. Depth means reasoning, not length: drop a sub-point that adds no new consequence.

The three steps and the strengtheners shape your outline; they are not visible labels. In the report, write them as connected sentences. Do not open paragraph after paragraph with the same scaffold words ("Boundary:", "Implication for the decision:", "Why:", or their equivalents in the report's language), and do not narrate the structure ("each item below first says what we found, then why"). A label is fine once where it genuinely helps scanning, for example a single "what would change this" line in the opening.

[Assembled] Two interviewees want more staff, one wants the packing table moved, one wants the manager to leave later.
[Analysed] The three requests come from different stores. Where three people are on shift, the bottleneck is the shared counter, so moving the packing table helps; where one person is left alone at noon, layout cannot help and only staffing or the manager's timing can. Our inference: the first change depends on how many people a store actually has at noon, which is the first thing to ask real staff.

[Assembled] Staff are blamed for mistakes regardless of how many people were working.
[Analysed] Blame falls on whoever was on shift, and nobody records how many people were there. So the store's records show individual mistakes, never a staffing gap, and the person who sets the rota never sees the problem. Our inference: recording the head count beside each mistake makes the cause visible at no cost.

## Structure: Answer First, Then Reasoning and Evidence

- Draft the answer, its strongest evidence, what remains unknown and the next action before styling. A reader who sees only the title, opening and headings can state the recommendation, what it rests on, the main uncertainty and the next test.
- The opening may start with one concrete scene from the interviews, but the answer comes within the first few sentences, never after background.
- The report title names the research subject and the decision it informs, without the verdict.
- Every other heading is a complete judgment sentence in plain words: the subject and what was found about it. A hypothesis heading states what the study found (the badge says how strong the evidence is); a recommendation heading states the action. Never use a quote, a bare number, a coined label, a metaphor or an unexplained abbreviation as a heading, and never give two items the same heading. A section title may be a short plain question the reader would ask.
- Open a finding with a person and a scene when one exists (who, when, what happened, what it cost), then the judgment and its analysis.
- Each fact appears in full once; later mentions point back. `findings` does not restate a hypothesis already explained; `tensions` does not restate the remaining gaps given beside a finding; `limitations` does not repeat the opening note sentence by sentence.
- Keep it short enough to read in about ten minutes: roughly 6,000 Chinese characters or 3,000 English words of body text, excluding the quote list, sources and tables. A hypothesis or theme usually needs a heading and two or three paragraphs. When over budget, cut restated evidence, secondary examples and duplicated caveats before cutting reasoning.
- When the opening already states a finding, the hypothesis section adds the reasoning and evidence; it does not restate the opening sentence.
- One point per paragraph, 1-3 sentences, with connected reasoning rather than slogans. Give one or two examples for a claim, not every persona who said it; the comparison table or quote list carries the rest. A short list for parallel items, a table for a real comparison. Bold only the judgment or action.

## Words

- Short sentences, everyday words, specific subjects and verbs, active voice. Use the words of the interviewees' trade, not research or management vocabulary. The register is fit to forward to a manager: no slang, exclamations, rhetorical questions in body text or slogans, and no literal translations of idioms from another language.
- No internal names in visible text: hypothesis ids (`H1`), framework acronyms (`JTBD`, `KANO`), field names and enum values (`evidence_based`, `generated`, `to_validate`, `override`, `covers: core`), tool names, saturation arrays such as `[7, 0, 0, 0]`, or phrases that translate them literally ("AI interview signal", "external source covers the core claim"). Refer to a hypothesis by an ordinal word in the report's language; describe a framework by what it did; write persona tiers as "built from public sources" or "mostly inferred by the model"; write saturation as "the last two interviews raised nothing new".
- Replace abstractions and metaphors with the actual object, action and result. [Unclear] "no recovery window after the peak". [Clear] "after one o'clock they make up the restocking skipped at noon, so there is no time to rest".
- Remove AI writing habits: inflated significance ("crucial", "reveals", "empower", "closed loop"), a "not X but Y" reveal when nobody claimed X, forced groups of three, rotating synonyms for one idea, empty openers and wrap-ups ("it is worth noting", "in summary"), vague attribution when a named source exists, stacked dashes and decorative bold.
- Attribute by name, beside the claim, with a neutral verb. When several personas share a point, name them or count them against the panel ("three of the four interviewees"), and the count must match the citations; vague words such as "some" or "many" say less than a name or a count. No percentages, averages or words implying how common something is among real people.
- Numbers come only from sources or transcripts. Do not invent a number, owner, deadline, threshold, price, cause or quote to sound concrete; say what is missing instead.
- `[Q#]` means an interview quote in the report. Refer to questionnaire items by number in words ("question 6 of the questionnaire"), never as `Q6`. When a sentence covers the whole panel, cite the comparison table or the two or three clearest quotes instead of a wall of eight citations.
- One term for one idea; define a necessary term once at first use; keep names, numbers, units and quotes exactly as in the source.

## Say the AI Caveat Once

- The opening says once that interviewees are AI-simulated, how many real people have been asked (often none yet), and what that means: leads to test, not a measure of how common anything is. Add that the rest of the report will not repeat it.
- After that, badges, cards, quotes, evidence bars and persona tiles do not repeat "AI-simulated", "pending real-person validation" or similar. `limitations` restates it once with its consequences.
- A limit that affects only one claim (one store's example, a persona recalling events after leaving, a source from another industry) stays beside that claim; that is not a repetition of the general caveat.
- Badges use plain words for how far the evidence goes. The verdict and confidence rules in methods.md are unchanged; only the wording is plain.
- After real answers are compared, show per-claim status where it matters ("real staff said the same", "real staff disagreed").

## Recommendations

Name an action, the stores or users it applies to, the finding it rests on, and the observable result to check. Order them by expected impact and effort, and say these are qualitative judgments when no data measures them. Say what is missing when the evidence cannot support a decision.

## Language Conventions

Apply the section for the report's language. For another language, follow the conventions of that language's quality business journalism with the same universal rules above, and write the equivalent badge words and ordinals naturally.

### When the Report Is in Chinese

- Full-width punctuation; use one quotation mark style throughout (「」 or “”). Arabic numerals for counts, times and money.
- Attribution usually precedes the quote ("陈舒说：……"); vary only between neutral verbs (说、提到、回忆), never loaded ones (承认、声称).
- Prefer a name or a count ("四位里有三位") to 部分、不少、大多数. Avoid long chains of parallel clauses and passive 被 constructions; split them into sentences with a subject and a verb.
- Ordinals: 判断一、判断二. Badge words, for example: 访谈支持、只在部分门店成立、依据不足; confidence 把握较大、把握一般、只有访谈.
- Typical failures from real reports and their fixes:

| Avoid | Write |
|---|---|
| 峰后没有恢复窗口 | 忙完也歇不下来，午饭不是提前就是凑合 |
| 冲突挤在收银台到后仓的那几步路上 | 问题出在店里的布局：打包台挤着收银台，后仓在最里面 |
| 冲突来自三件事都不能等，而不是员工不会排优先级 | 店员知道先做什么，难在三件事都等不了 |
| H3 · 峰段人力 / AI 访谈信号 [Q9] / 外部来源覆盖核心命题 [S10] | 判断三 · 中午几个人 / 访谈 [Q9] / 报道 [S10] |
| 饱和度 [7, 0, 0, 0] 达到饱和 | 最后两位受访者没有再提出新话题 |
| 受访者表示 / 四位都……（只引两人） | 陈舒说……[Q6] / 四位里有三位……（三人都引） |
| 三条引语连放，结尾"可见压力很大" | 先下判断，再放一条引语，再用一句话说明它证明了哪一环 |
| 整体而言存在多方面挑战 | 中午的瓶颈不在人数，在于三件事抢同一个人 |

### When the Report Is in English

- Headlines and headings in sentence case, present tense, with a verb: "Restocking gives way to the lunch queue".
- Attribution with "said", usually after the quote or after the first clause of it ("…," Chen Shu said.); avoid "claimed", "admitted", "stressed". Use curly quotes with commas and periods inside; single quotes inside a quote.
- Small samples as "three of the four interviewees", never "75%". Spell out one to nine, numerals from 10.
- Plain English: the short word over the long one, active voice, cut words that add nothing ("in order to", "it is important to note that"), no corporate filler ("leverage", "robust", "seamless", "unlock").
- Ordinals: Hypothesis 1, Hypothesis 2. Badge words, for example: Supported by interviews, Holds in some stores, Not enough evidence; confidence Fairly confident, Moderately confident, Interviews only.

## Delivery Check

Before publishing, compare the draft with `synthesis.json`, the persona files and the transcripts, and fix every failure:

1. Counts and examples match the citations: a sentence about "all four" cites all four, and every named example cites that person's own quote, never a quote number belonging to another persona.
2. Facts about a persona (staff count, shift, store type, city, tenure) match the persona card and file; a store the card describes as staffed by three is not called a two-person store in the text.
3. No claim is stronger than the synthesis, no condition is dropped, no number or specific is invented, and no paragraph repeats another section.
4. The body text fits the length budget, and no scaffold label repeats across sections. Each core judgment climbs from observation to interpretation to implication, with at least one boundary, connection or consequence; inference is labeled and its premises cited.
5. Visible text has none of the internal names listed above, and the general AI caveat appears only in the opening and once in limitations.
6. The title and headings, read alone as a native reader, state plain judgments, and a reader can state the recommendation, its evidence, the main uncertainty and the next test.
7. The language conventions for the report's language are followed.
8. Every citation resolves; inspect the rendered page at wide and narrow widths when a preview is available; unrendered output is not visual acceptance.
