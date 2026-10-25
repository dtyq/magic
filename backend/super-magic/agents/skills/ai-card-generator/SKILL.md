---
name: ai-card-generator
description: |
  Generate AI Cards — HTML visual pages (single-file or folder-based multi-file) for scheduled automated reports.
  Use when: user wants to create a recurring visual card, hotspot tracker, daily digest,
  analytics panel, inspiration page, or any HTML-based automated visualization that updates on schedule.
  Trigger signals: AI card, inspiration card, generated card, visual report, hotspot tracker, daily digest, dashboard card, scheduled visualization, and equivalent requests in any user language.
  Skip when: the task is about creating social media posts (use self-media-composer), or simple file generation without recurring schedule.

---

# AI Card Generator

Automatically generate and update HTML visual cards via scheduled tasks. Cards can be single-file or folder-based multi-file, and are generated from user prompts + templates with fresh data.

## Output Language Contract

The skill documentation, built-in templates, and prompt snippets are written in English. Generated card content must adapt to the user's language.

1. Infer the user's preferred output language from the current request first, then from existing card content, template language, project context, and explicit user instructions. Ask one concise clarification only when language choice materially changes the final card.
2. Write all user-facing generated text in the inferred language: card titles, descriptions, summaries, labels, badges, source notes, chart labels, AI follow-up prompts, status messages, placeholders, and schedule-created card metadata.
3. Keep machine contracts stable: `magic.project.js` keys, enum-like status values, paths, filenames, CSS class names, DOM ids, JS function names, Magic API calls, and template marker comments stay in their documented form.
4. Set HTML `lang` attributes to the inferred language for generated cards. Built-in English templates may use `lang="en"`, but cards generated for users should update it.
5. Do not translate brand names, product names, code identifiers, URLs, source quotes, or fixed schema values. Translate surrounding explanation and presentation text.

## Core Capabilities

- Create AI visual cards with scheduled updates
- Support user-customizable HTML templates (users can edit templates anytime)
- Each execution generates updated content based on template structure + latest data
- Automatic history version snapshot management
- Support multiple card types (hotspot tracker, daily digest, analytics panel, etc.)
- Design scenario-specific interactive templates instead of only filling the preset skeletons
- Preserve source links from fetched data and expose them through source lists, new-tab links, or safe iframe previews

## Related Skill Usage

When a card needs interactivity, web-page previews, file I/O, agent/model selectors, or AI deep-analysis actions, read and apply these skills first:

- `html-app-architect`: decompose the user's request, decide interaction/data/Agent boundaries, and choose Simple/Medium/Complex architecture for ordinary HTML projects.
- `html-api-sdk`: verify exact `window.Magic.*` API signatures, message formats, error handling, and fallback behavior.

Do not treat an AI Card as a static screenshot. It is an updateable HTML micro-page: the template owns the interaction and visual structure, while the scheduled Agent workflow owns data fetching, source tracking, and content replacement.

## Directory Structure Convention

Card directory name is user-defined, no fixed path required. The core requirement is the directory must contain `magic.project.js` with type set to `ai-card`.

Preferred mode is folder-based multi-file for maintainability. Single-file mode is still supported for backward compatibility.

```
{card-directory}/
├── magic.project.js                  # REQUIRED — type="ai-card"
├── template/                         # Preferred template folder
│   ├── index.html
│   ├── styles.css                    # Optional
│   ├── scripts.js                    # Optional
│   ├── data/                         # Optional seed schemas
│   │   ├── card-data.json
│   │   └── sources.json
│   └── prompts/                      # Optional analysis prompt snippets
│       └── deep-analysis.txt
├── latest/                           # Preferred output folder
│   ├── index.html
│   ├── styles.css                    # Optional
│   ├── scripts.js                    # Optional
│   └── data/                         # Optional generated structured data
│       ├── card-data.json
│       └── sources.json
└── history/
  ├── 2026-05-23_09-00/
  │   ├── index.html
  │   ├── styles.css                # Optional
  │   ├── scripts.js               # Optional
  │   └── data/                    # Optional snapshot data
  │       ├── card-data.json
  │       └── sources.json
  └── 2026-05-22_09-00/
    ├── index.html
    ├── styles.css                  # Optional
    └── scripts.js                  # Optional

Backward compatible (legacy):

{card-directory}/
├── magic.project.js
├── template.html
├── latest.html
└── history/
  └── YYYY-MM-DD_HH-mm.html
```

## Creation Workflow

### Step 0: Requirement Decomposition and Template Design

Before creating or modifying a card, decompose the user's request into: information type, data sources, update cadence, expected interactions, source-link display mode, and whether Agent deep analysis is needed.

Design the template for the scenario instead of mechanically applying the three presets:

- Hotspot / public-opinion cards: ranking, trend lines, platform distribution, sentiment/risk, lifecycle, source preview.
- Daily / weekly digest cards: executive summary, metric groups, event timeline, action list, citations, expandable source text.
- Analytics dashboards: KPIs, funnels, cohorts, anomaly alerts, range switching, follow-up insight prompts.
- Research / intelligence cards: claim cards, evidence matrix, source reliability, iframe source preview, comparison view.
- Decision / planning cards: option comparison, risk/reward, milestones, owners, next actions.

Prefer interactions that help judgment and action: filters, tabs, sorting, expand/collapse, chart hover, time-range switches, source drawers, iframe previews, and AI follow-up buttons. Avoid decorative-only interactions.

### Self-Media Operations Boundary

When the prompt is for a self-media article/post review, post-publication retrospective, published-data import, operations review dashboard, article operations dashboard, or localized equivalent, do not generate or update `ops/*` files in this skill. Route the work to `self-media-composer` or the self-media/IP-operations data-sync workflow, which owns `ops/source.json`, `ops/metrics.json`, `ops/comments.json`, and `ops/review.html`.

AI Card may read already-produced self-media operation files only when the user explicitly asks for a separate visual card based on those existing files. It must not create, overwrite, backfill, or pretend to fetch self-media operation data.

### Step 1: Create Card Directory Structure

Based on user requirements, create directory and write all required files:

```
1. Create the directory (name specified by the user or inferred from the content)
2. Write `magic.project.js` (triggers frontend rendering recognition and contains card config plus metadata)
3. Generate the template (recommended `template/index.html`, legacy-compatible `template.html`)
4. Fetch initial data and generate the latest card (recommended `latest/index.html`, legacy-compatible `latest.html`)
5. If scheduled updates are needed, create the scheduled task with using-cron
```

### Step 2: magic.project.js Format

Must follow this format strictly — both frontend and backend depend on it for type recognition:

```javascript
window.magicProjectConfig = {
  type: "ai-card",
  card_id: "stable_id_from_creation_message",
  name: "Card name",
  description: "Card description",
  prompt: "Full user prompt",
  card_path_or_link: "https://example.com/global/super/{project_id}/{topic_id}?ai_card=stable_id_from_creation_message",
  cards: [{ file: "latest/index.html", label: "Latest" }],
  template: "template/index.html",
  schedule_id: "", // Will be filled after scheduled task creation
  notification: {
    channels: [
      {
        channel: "dingtalk", // dingtalk | wecom | lark
        targetDescription: "Send to the Ops Daily group",
      },
    ],
  }, // Optional. Omit or leave channels empty when notification delivery is not needed.
  last_generated: "", // ISO 8601 timestamp, updated each generation
  generation_count: 0, // Incremented each generation
  status: "active", // active | paused | error
};

// Legacy compatible example:
// cards: [{ file: "latest.html", label: "Latest" }],
// template: "template.html",
```

If the creation message includes a card id and card link, copy both values into `magic.project.js` as `card_id` and `card_path_or_link`. The frontend owns URL generation. This skill stores and uses the provided URL; it must not guess the frontend domain or route base.

Creation messages may provide these values as friendly text instead of raw JSON:

```text
卡片编号：stable_id_from_creation_message
卡片链接：https://example.com/global/super/{project_id}/{topic_id}?ai_card=stable_id_from_creation_message
```

Field rules:

1. `卡片编号` is the stable frontend deep-link identifier for this AI Card. Write it to top-level `magic.project.js.card_id`.
2. `卡片链接` is the full frontend URL that opens the topic and targets this card. Write it to top-level `magic.project.js.card_path_or_link`.
3. Do not require the creation message to explain why these fields exist or to use JSON. This skill owns the mapping and usage rules.
4. Use `card_path_or_link` in notification content when present.

Creation messages intentionally keep execution details concise. Treat sections such as `创建需求`, `创建位置`, `模板`, `更新方式`, `定时`, and `分析指令` as inputs. Apply this skill's Creation Workflow, Template Specification, Scheduled Update Workflow, and Notification Dispatch rules to decide the actual file structure, template behavior, scheduled task setup, and update process. Do not require the message itself to repeat these execution steps.

### Notification Dispatch

AI Cards can optionally deliver a short update notice after a card is created or refreshed. The v1 configuration only stores notification channel and target description. Do not ask the frontend or user to provide platform credentials, webhook secrets, SMTP settings, message templates, target IDs, or channel-specific delivery options in `magic.project.js`.

Supported shape:

```javascript
notification: {
  channels: [
    {
      channel: "dingtalk",
      targetDescription: "Send to the Ops Daily group",
    },
    {
      channel: "wecom",
      targetDescription: "Send to the WeCom Ops group",
    },
    {
      channel: "lark",
      targetDescription: "Send to: <target user>",
    },
  ],
}
```

Rules:

1. Treat missing `notification`, missing `channels`, or an empty `channels` array as notification disabled.
2. Supported `channel` values are `dingtalk`, `wecom`, and `lark` only. Ignore unknown channels and explain the skipped channel in the current topic.
3. `targetDescription` is natural-language user intent. It may describe a person, group, chat, or another platform-specific target. Do not invent a target when it is ambiguous.
4. Send notifications only after the card output has been written successfully, history has been archived when needed, and `magic.project.js` has been updated.
5. For `dingtalk`, load `dingtalk-cli` and use its normal routing and authentication flow to resolve and send the message.
6. For `wecom`, guide the user to configure a WeCom group bot webhook outside `magic.project.js`; after the webhook is configured, the next card update can use the configured webhook delivery path.
7. For `lark`, load `lark-cli` and use its normal routing and authentication flow to resolve and send the message.
8. Do not put channel routing rules, skill names, credentials, or fallback execution details into the scheduled task message. The scheduled task should instruct the agent to update the card; this skill owns notification behavior.
9. If authentication, webhook configuration, target resolution, or delivery fails, report the concrete missing information in the current topic. Do not claim the notification was sent.

Recommended notification content:

```text
AI card updated: {card_name}
Updated at: {generated_at}
Latest card: {magic.project.js.card_path_or_link}
```

### Step 3: Template Specification (`template/index.html` or `template.html`)

The template is the card's "skeleton", defining layout and styling. The agent reads the template each execution to understand the structure, then fills in new data to generate the latest card output (recommended `latest/index.html`).

**Template Rules:**

1. Prefer folder-based templates: `template/index.html` plus optional `styles.css` / `scripts.js`, generated into the same structure under `latest/`
2. Include `<meta charset="utf-8">` and viewport meta
3. Support dark mode (`prefers-color-scheme`)
4. When archiving history snapshots, copy the HTML, CSS, JS, and other same-folder assets together so relative links keep working
5. External resources are default-deny, but ECharts CDN is allowed for chart-driven cards
6. Use iframe-width responsive design: narrow card iframes should render a compact cover/summary view, while wide iframes render the full report
7. Use HTML comments to mark data sections for easy replacement:

```html
<!DOCTYPE html>
<html lang="{user-language}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{CARD_TITLE}}</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header>
      <h1>{{CARD_TITLE}}</h1>
      <time>{{GENERATED_AT}}</time>
    </header>

    <!-- DATA_SECTION_START -->
    <main class="data-container">
      <!-- Agent fills this section with latest data -->
    </main>
    <!-- DATA_SECTION_END -->

    <footer>
      <p>Updated: {{GENERATED_AT}}</p>
    </footer>
    <script src="scripts.js"></script>
  </body>
</html>
```

## Responsive iframe Display

AI Cards are rendered inside iframes in both grid cards and detail pages. The template must adapt to the iframe viewport, not the parent page.

Required display modes:

- **Compact card mode (`<= 420px`)**: show a unified card-like cover with title, timestamp, 1-3 headline metrics or summary points, and status/source badges. Hide dense tables, long lists, iframe source previews, large charts, and secondary AI controls. Keep content visually complete within a portrait card frame.
- **Mobile detail mode (`421px-767px`)**: single-column readable report. Preserve all core content, but stack charts/lists and reduce chart height.
- **Desktop detail mode (`>= 768px`)**: full dashboard/report layout with multi-column sections and richer interaction.

Implementation rules:

- Use CSS media queries inside the card HTML (`@media (max-width: 420px)`, `@media (max-width: 767px)`, `@media (min-width: 768px)`). These queries naturally follow the iframe width.
- Prefer semantic sections that can be hidden/reordered in compact mode: header/summary/metrics/detail/sources/actions.
- In compact mode, avoid horizontal scroll and avoid text clipping. Use `line-clamp`, smaller fixed chart heights, or hide nonessential sections.
- If a template supports iframe source preview, hide the preview frame in compact card mode but keep source count or source badge visible.
- The card should still be usable if the host iframe height is clipped: important title/time/status content belongs near the top or bottom, not only after long scroll.

## Scheduled Execution Workflow

When a scheduled task triggers, execute the following:

```
1. Read `magic.project.js` for the prompt and context configuration
2. Read the template directory (prefer `template/`, support legacy `template.html`) to understand layout structure and data markers
3. Use `web_search` / `read_webpages_as_markdown` to fetch fresh data, recording all available source URLs
4. Analyze and organize data according to the prompt; write sources into the HTML source area and optional `latest/data/sources.json`
5. Archive: copy all current files under `latest/` to `history/YYYY-MM-DD_HH-mm/` (legacy mode: rename `latest.html`)
6. Copy template: copy all files under `template/` to `latest/` (overwrite) as the base for this generation
7. Modify data zones only: update content between `<!-- DATA_SECTION_START -->` and `<!-- DATA_SECTION_END -->`, or named DATA zones, in `latest/index.html`; usually leave `styles.css` / `scripts.js` unchanged unless the template structure must evolve
8. Update `last_generated` and `generation_count` in `magic.project.js`
9. If `notification.channels` is configured, deliver the update notice according to the Notification Dispatch rules in this skill
```

## Source Link and Web Preview Requirements

When fetched data contains links, preserve them. Do not summarize away provenance.

Recommended source record shape:

```json
{
  "id": "src-001",
  "title": "Source title",
  "url": "https://example.com/article",
  "site": "Example",
  "type": "article",
  "publishedAt": "2026-06-10T08:00:00+08:00",
  "retrievedAt": "2026-06-10T09:00:00+08:00",
  "summary": "One-line relevance note",
  "linkedClaimIds": ["claim-01"],
  "display": "iframe"
}
```

Render sources according to content type and embed safety:

- Use an `<iframe>` preview for public pages that are likely useful to inspect inline, such as articles, dashboards, docs, charts, maps, public reports, PDFs that the browser can render, or generated local HTML.
- Always include an `<a href="..." target="_blank" rel="noopener noreferrer">` open-in-new-tab fallback next to iframe previews.
- Use link-only display for pages likely to block embedding, require login, contain payment flows, or show sensitive/private data.
- If an iframe fails to load or is blocked by the site, show a clear fallback message and keep the new-tab link.
- Use `sandbox`, `loading="lazy"`, and `referrerpolicy="no-referrer"` on iframes unless the scenario explicitly needs more permissions.

Recommended iframe pattern:

```html
<button
  type="button"
  class="source-preview"
  data-preview-url="https://example.com/article"
>
  Preview source
</button>
<a href="https://example.com/article" target="_blank" rel="noopener noreferrer"
  >Open in a new tab</a
>
<iframe
  class="source-frame"
  title="Source preview"
  sandbox="allow-scripts allow-same-origin allow-popups"
  loading="lazy"
  referrerpolicy="no-referrer"
></iframe>
```

## Integration with using-cron

After creating a card, if scheduled updates are needed, use using-cron to create a scheduled task through Code Mode. For long update instructions, pass a Python triple-quoted string as `message_content`.

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

message = \"\"\"Update the AI card {card_name}. Read {card_directory}/magic.project.js for
configuration and prompts. Steps:
1. Archive: copy ALL files in latest/ to history/YYYY-MM-DD_HH-mm/
2. Copy template: copy ALL files from template/ to latest/ (overwrite)
3. Fetch fresh data based on the prompt in magic.project.js
4. Modify only the DATA_SECTION in latest/index.html with the new data
5. Update last_generated and generation_count in magic.project.js
Fallback for legacy single-file mode: use template.html -> latest.html.\"\"\"

result = tool.call("scheduled_task_create", {
    "task_name": "AI Card: {card_name}",
    "message_content": message,
    "schedule_type": "daily_repeat",
    "time": "09:00"
})
print(result.content)
""")
```

After successful creation, write the returned `id` into `schedule_id` in magic.project.js.

## User Template Modification

Users can modify template/index.html (or template.html in legacy mode) anytime to change card layout and styling. Methods:

1. Edit template/index.html directly in the frontend (using existing HTML editing capability)
2. Tell the agent via conversation (e.g. "change the template to a three-column layout")

After modification, the next scheduled execution will automatically use the new template.

## html-api-sdk Integration (Optional but Recommended)

For interactive cards, you can use `window.Magic.*` APIs in HTML:

1. For substantial follow-up work, prefer `window.Magic.project.createTopicAndSend(message, { model })`; include agent/model selectors when users may want control.
2. Use `window.Magic.setInputMessage(message)` only as a lightweight fallback for current-topic prefill.
3. Optionally use `window.Magic.fs.readFile` / `writeFile` for local card context, generated notes, `data/card-data.json`, or `data/sources.json` within the card app root.
4. Use `window.Magic.fs.watchFile` only when the card needs to react to data-file edits without a full refresh.
5. Bind actions via `addEventListener` only (no inline onclick).

Example pattern in card UI:

1. Source preview controls: open trusted source URLs in a sandboxed iframe and always keep a new-tab `<a>` fallback.
2. "Generate analysis request" button: extract key text and source links from card sections.
3. "Send to Agent" button: display the available model list, select the first model by default, and call `window.Magic.project.createTopicAndSend(...)` with `{ model: selectedModelId }`; fall back to `setInputMessage(...)` when project APIs are unavailable.
4. Show status text if Magic API is unavailable in current runtime.

When sending file paths, follow `html-api-sdk` and `html-app-architect`: use tiptap JSON with `@file` mentions, call `getAppBasePath()` for app-relative data files, and keep `.magic/` skill paths workspace-root relative.

## Preset Templates

This skill provides the following preset templates for reference, located in the templates/ directory (folder-based structure):

- `hotspot-tracker/` — Hotspot tracker (rankings, platform distribution, trend charts, AI follow-ups, source preview)
- `daily-digest/` — Daily digest (summary, metric groups, timeline, action list, source cards, AI follow-ups)
- `analytics-panel/` — Analytics panel (KPIs, funnels, channel breakdowns, range tabs, alerts, source preview, AI follow-ups)

Each template folder contains: `index.html`, `styles.css`, `scripts.js`, and `prompts/` (optional analysis prompt snippets). When creating cards, use these as module examples, not as fixed limits. Compose or extend modules according to the user's domain, source types, and desired interactions.
