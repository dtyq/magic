# Report Templates

A report template supplies the visual language of `report.html`: colours, fonts, decoration, and supported interactions. The report contract below controls reading order, including with older copies of `templates/voices.html`. Keep the user's template source unchanged; when producing the report, rearrange its content and adapt layout styles so a full-height cover, CSS ordering, or positioned decoration cannot push the decision behind background material. Preserve its working scripts and their required hooks.

## Where Templates Live

- `templates/<name>.html` at the workspace root, one HTML file per template, shared by every study. The file name is the template's name.
- `templates/voices.html` is the default. `update_study` `created` copies the built-in template there when `templates/` holds no template yet.

## Which Template a Report Uses

1. The template the user names: `报告模板: templates/<name>.html` in the `【研究设置】` line, or a mentioned `templates/*.html` file.
2. Otherwise `templates/voices.html`; if it was deleted, the built-in `reference/report-template.html`.

Write the choice into `plan.md` deliverables as `Report template: templates/<name>.html`, and use that line when writing the report unless the user names another template later.

Use a template only if it is a readable, complete HTML document (`<html` or `<body>`), at most 200 KB, and does not load files from the workspace (relative image or CSS paths; CDN links are fine). Otherwise use the default and say once why. Never delete or fix a user's template on your own.

## Report Contract (Every Template)

- Use this section order and the built-in ids: `summary` (the bottom line, always first), `hypotheses`, `business`, `method`, `findings`, `real-voices`, `tensions`, `personas`, `voices`, `limitations`, `validation`, `sources`. Drop a section when it does not apply or would only repeat another section.
- Citations are `<a href="#q<N>" class="citation-ref">[Q<N>]</a>` and `<a href="#s<N>" class="citation-ref">[S<N>]</a>`. Each quote card has `id="q<N>"`, `data-source-name` (persona name), and `data-source-title` (the quote); each source card has `id="s<N>"`. Quote cards have no `href`: downloaded and shared reports carry only the page and its images, so links to `interviews/*.json` or `validation-questionnaire.*` would be dead. Name the questionnaire files in text instead; the chat reply links them.
- Each hypothesis, recommendation, and theme has a compact evidence bar linking only its relevant evidence, with plain labels in the user's language: interviews `[Q#]`, sources `[S#]`, and inference from those premises. Show a claim's real-person status there only after real answers have been compared. Do not repeat study-wide interview or source totals here; a completed interview is not automatically evidence for every claim.
- The bottom line opens with a decision badge (`decision-go`, `decision-conditional`, or `decision-nogo` in the default template) and a one-sentence answer before any detail; recommendations follow it, while findings retain the counter-evidence and uncertainty that qualify it.
- State once, next to the opening answer, that interviewees are AI-simulated (report-writing.md, "Say the AI Caveat Once") and give clearly labeled whole-study totals: completed AI interviews, external sources reviewed, and real-person validation status. Put planned, failed and downweighted sample accounting in `method` and `limitations`; these numbers do not measure support for a claim. Follow methods.md for qualitative frequency wording and evidence judgments.
- Charts and data tables are optional inline fragments chosen by report-charts.md, placed in `findings` (or `hypotheses`), never in `summary`. They carry their own styles, so any template shows them; a report without them is correct when the data does not warrant one.
- Replace every sample text in the template with study content, and set `<html lang>` to the user's language. This includes the verdict, decision and confidence badges, which must not stay in English for a non-English reader. The page chrome (top bar, contents, buttons, popover) fills itself from the `<title>`, the section titles and `<html lang>`: do not edit it by hand; for a language other than Chinese or English, add one entry to the `LABELS` map in the template's page script.
- Keep the template's own scripts. Behaviour a template lacks (citation popovers, persona portraits) is not added; citations then work as plain anchor links.

### Build report.html From the Template File

Never retype or rewrite a template: a full template is too long to reproduce, and a hand-written page loses its navigation, styles, scripts and structure. Build the report from the file itself, in a private draft, so the user never sees sample content in `report.html` while it is being edited:

1. Copy the chosen template file to a draft outside the workspace, with code, not by writing its text out. The draft lives in the sandbox-local runtime folder next to the workspace: `../.runtime/persona-report/<slug>.html` (relative to the workspace; create the folder first). For example: `shutil.copyfile("templates/voices.html", "../.runtime/persona-report/<slug>.html")`.
2. Edit the draft in place with `edit_file` or `multi_edit_file` (both accept that path), one section at a time. Replace only the sample content (text, quotes, citations, badges, figures); keep `<head>`, the `<style>` and `<script>` blocks, section ids, class names and data attributes. Duplicate a sample row for each extra item; delete a row or section only when it does not apply.
3. Before publishing, search the draft for sample leftovers (`Zhang Wei`, `Li Na`, `Illustrative`, `example.com`, `image-placeholder`), English badge or button text in a non-English report (for example `Open`, `Back to the text` in an older template copy that still has `TRANSLATE` labels: translate them), a second `<main>` or `<header>`, and links to `interviews/` or `validation-questionnaire`; fix anything found, then run the delivery check in report-writing.md.
4. Publish once: copy the finished draft to `studies/<slug>/report.html` with code, delete the draft, then send `report_written`. Never write a partly edited page to `report.html`; a rewrite of an existing report is built the same way and replaces the old file only when complete.

A report whose HTML has none of the template's section ids, `<nav class="top-bar">`, contents list or script blocks was not built from the template; rebuild it.

## Writing and Analysis

Write every visible word by [report-writing.md](report-writing.md): analysis depth, structure, wording, the one-time AI caveat, language conventions and the delivery check. The rest of this file covers layout and section content.

## Keep the Opening Small and Honest

Before any image, method card or persona panel: short title, decision badge, one-sentence answer, the few cited reasons needed to explain it, whole-study evidence scope and the one AI-simulation note, then what could change the answer. List at most 3 remaining validation priorities, each tied to a hypothesis and a concrete test; one is enough when only one matters, and none is needed when no material check remains. If evidence is incomplete, say what cannot yet be decided. Neither reasons nor validation tasks are quotas to fill.

Keep the title compact enough for the answer to be visible on a typical laptop. Do not force a one-screen fit by clipping, shrinking or hiding material caveats. Use readable body text near 16px, relaxed line-height and a bounded reading width; let long titles, source names and badges wrap. Use spacing and type weight to group content, with one restrained emphasis color. No decorative cover before the decision, fixed-height text boxes, or walls of bold text. Images are optional supporting material after the decision content.

## What Each Section Contains

| Section | Content |
|---|---|
| `summary` | Opening described above; decision classes and confidence follow methods.md. Show a homogeneity warning or a skipped or overridden leak check beside the verdict, in plain words (for example "the four interviewees answered almost alike, which more likely reflects one model playing four people"). |
| `hypotheses` | Each hypothesis's finding as a judgment heading, a plain verdict badge, the analysis (observation, interpretation, implication) and evidence; fold support/refute criteria. |
| `business` | Decision-relevant recommendations using methods.md, labeled as tests, conditional actions or supported actions. Omit unrelated commercial topics; for no-go, title it "If you still want to try" and give only stopping conditions or cheap tests. |
| `method` | Scope, framework, completed vs. planned interviews and rounds, and focus groups planned vs. actually run. |
| `findings` | Themes not already explained under `hypotheses`: at most 6 in full, strongest first, with segment differences and counter-evidence beside the claim; other themes get one line and a citation each. A theme that restates a hypothesis is dropped, with one line pointing to it. End with the cross-finding connection when one exists. |
| `real-voices` | Apply the comparison rules in methods.md. Explain decision-relevant conflicts or evidence gaps in full; compatible or non-comparable observations need only a short cited explanation. |
| `tensions`, `personas`, `voices` | Disagreements not already stated beside a finding, the persona panel (tiers in plain words), and exact interview quotes without links. |
| `limitations` | In plain words: AI simulation and what it rules out, effective sample, failed and downweighted interviews, whether later interviews still raised new themes, removed quotes (or that all quotes matched), search-only social evidence, and a leak-check override or skipped check (omit the leak check when it simply passed). |
| `validation`, `sources` | Real-person validation plan/results and all cited sources. Show the comparison table only after answers have actually been compared. |

## Images

- Image slots are `figure[data-image-slot]` elements. `data-image-hint` says what fits, `data-image-source` is `search`, `generate`, or `any` (search first), and `data-image-ratio` is the shape. A template without slots gets no images; never add images it does not ask for.
- Fill each slot with one image that fits this study, or delete the whole figure. A finished report never contains `.image-placeholder` or a broken image.
- Search with `image_search` for real products, places, and settings. Use the returned image URL as `src` and caption it with the source site, linked to its page.
- Generate with `generate_images` for concepts and scenes no photo shows. Save into `studies/<slug>/images/`, use `src="images/<file>"`, and caption it as an AI-generated illustration.
- Images illustrate; they are never evidence. Do not cite them as `[S#]` or `[Q#]` or base claims on them. Never generate a real person, a real brand's product, or persona portraits for decorative image slots (requested fictional avatars follow persona-portraits.md), and skip photos of identifiable private people.
- Per report: at most 4 images, one `image_search` call, and one `generate_images` call. On an error or no fitting result, delete the slot instead of retrying.

## Bound Persona Avatars

After writing the report, send `update_study` event `report_written` as usual; it automatically embeds the panel's bound portraits. For a specifically requested update to an existing report, `embed_persona_portraits` can also be called directly. Read [persona-portraits.md](persona-portraits.md) for generation and binding. This tool adds only a portable snapshot of the panel's already bound images; preserve the template's scripts, AI-simulation disclosure, and SVG fallback. On each existing portrait element keep `data-persona` and add `data-persona-id` with its saved ID. Do not place avatars in decorative image slots or generate them again for the report. A template with no persona elements needs no new ones.

## Creating or Changing Templates

When the user asks to create or change a template, write only `templates/<name>.html`. No study, no `update_study`, no report.

- Change ("make @templates/x.html green"): edit that file in place.
- Create ("a darker one", "from this uploaded HTML"): write a new `templates/<short-ascii-name>.html` and never overwrite an existing file unless asked. Base it on the mentioned template, the uploaded file, or the built-in `reference/report-template.html`, and keep realistic sample content in every section so the template library can preview it. Image slots stay as placeholders in a template.
- To restyle an existing report, rewrite `studies/<slug>/report.html` from `synthesis.json` with the chosen template.
