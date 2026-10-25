---
name: self-media-composer
description: >
  Use when the user wants to create, extend, or edit self-media posts or card/article projects for Rednote/Xiaohongshu, Instagram, WeChat Official Accounts, or similar platforms. Trigger on [@self_media_project:...], create/add post, make cards, generate social cards, write WeChat article, multilingual self-media requests, Rednote tags, WeChat article, Instagram cards, social media cards, content project. Also use for self-media post-publication operations such as immediate sync, real data refresh, published-data import, post-publication data sync, operations review dashboards, article ops review, and fixed `ops/*` data updates.
---

# Self-Media Composer Skill

Complete capability for building and managing self-media projects. One project groups many posts; each post is an independent folder with its own meta and card sequence. This skill scaffolds that structure, authors the cards, generates reference engagement data, and keeps the root index in sync.

---

## When to Load This Skill

Load this skill **immediately and before any other action** when the user's message matches any of the following patterns.

### English

| User says | Load reason |
| --- | --- |
| "create a post" / "add a post" | New post creation |
| "make cards for Rednote / Instagram" | Card-based post authoring |
| "write a WeChat article" / "WeChat official account post" | Article post authoring |
| "build a self-media project" / "start a content project" | Project scaffolding |
| "generate social cards" / "design card images" | Card design |
| "create content for [platform]" | Any platform post |
| "post-publication review" / "article ops review" | Operations data sync |
| "fetch published data" / "update ops files" | Operations data sync |
| "sync now" / "real data refresh" | Operations data sync |
| Contains `[@self_media_project:...]` | Existing project reference |

### Multilingual

Load for equivalent requests in any user language, including Chinese-language requests for Xiaohongshu/Rednote posts, WeChat Official Account articles, Instagram cards, card-based social posts, content projects, publishing-data import, immediate sync, real data refresh, operations review, or any message containing `[@self_media_project:...]`.

> **Note:** When localized platform aliases appear, treat them as the corresponding platform values. See Platform Aliases in the Platform Defaults section.

---

## Execution

All Python snippets in this document must run through `run_sdk_snippet`:

```python
run_sdk_snippet(
    python_code="""
from sdk.tool import tool
result = tool.call('create_self_media_project', {
    'project_path': 'ai-monthly',
    'platform': 'rednote'
})
print(result)
"""
)
```

`result` exposes `result.ok`, `result.content`, `result.data`. Access structured data via `result.data`; the object is not subscriptable.

---

## Output Language Contract

The skill documentation is written in English, but generated content must adapt to the user's language.

1. Infer the user's preferred output language from the current user message first, then from active draft content, existing post language, project context, and explicit platform requirements. If the target language is still ambiguous and the choice affects the final content, ask one concise clarification.
2. Write all user-facing text in the inferred language: questions, option labels, project/post display names, titles, subtitles, card copy, article prose, captions, comments, CTA text, placeholder labels, relative time strings, operations review prose, and template descriptions.
3. Keep machine contracts stable: platform values, preset IDs, JSON keys, enum values, CSS class names, JS namespaces, file extensions, and API/tool parameters stay in their documented form.
4. Use safe filesystem IDs. Prefer lowercase ASCII slugs for `project_path`, `post_id`, card filenames, and preset names unless the user explicitly needs localized filenames and the path is safe.
5. Do not translate brand names, platform names, product names, source quotes, code identifiers, or fixed schema values. Translate surrounding explanation and content intent.
6. For Rednote tags, choose tags that fit the user's output language and the platform's search behavior. The Chinese hashtag library is a reference set for Chinese/Xiaohongshu SEO, not a command to force Chinese tags in non-Chinese output.
7. Set HTML `lang` attributes to the inferred language when writing cards or articles (`zh-CN`, `en`, `ja`, etc.).

---

## Project Concept

A self-media project is a Magic Project folder whose `magic.project.js` declares `type: "self-media"`. It contains:

- `magic.project.js` at the root — JSONP, holds a per-platform posts index
- `posts/<post-id>/` — one folder per post, fully self-contained
- `shared/` — optional, assets shared across posts (including copied preset bundles)

Directory layout:

```
<project-root>/
├── magic.project.js
├── posts/
│   ├── <post-id>/
│   │   ├── post.json
│   │   ├── cards/           # rednote / instagram only
│   │   │   ├── <card>.html
│   │   │   └── ...
│   │   └── assets/
│   ├── <wechat-post-id>/    # wechat-official-accounts
│   │   ├── post.json
│   │   ├── <article>.html   # single article HTML
│   │   └── assets/
│   │       ├── cover-hero.jpg
│   │       └── cover-square.jpg
│   └── ...
└── shared/
    └── presets/
        └── <preset-name>/
            ├── <preset-name>.css
            └── <preset-name>.js
```

Preset source files (inside this skill) are organized by platform:

```
presets/
├── rednote/
│   ├── neo-brutalism/
│   ├── code-dispatch/
│   ├── dark-tech/
│   ├── gradient-editorial/
│   ├── personal-insight/
│   ├── film-vintage/
│   ├── warm-journal/
│   ├── paper-column/
│   ├── signal-grid/
│   └── product-launch-preset/
├── instagram/
│   ├── ins-modern/
│   ├── ins-minimal/
│   ├── ins-dark/
│   ├── ins-retro/
│   ├── ins-fluent-depth/
│   ├── ins-token-system/
│   ├── ins-creator-studio/
│   ├── ins-film-frame/
│   ├── ins-warm-journal/
│   └── ins-signal-grid/
└── wechat-official-accounts/
    └── (coming soon)
```

> For `magic.project.js` and `post.json` format examples, path rules, and file authoring rules, see [references/file-formats.md](./references/file-formats.md).

### File authoring rules (summary)

- `magic.project.js` must be generated by `create_self_media_project`. Never create or overwrite it with `write_file`. Edit its inner `posts` array via `edit_file` only.
- `post.json` is produced by `create_self_media_post`. Edit it with `edit_file` for subsequent changes.
- Card HTML files can be authored directly with `write_file`.

---

## Platform Defaults

Currently supported `platform` values: `rednote`, `instagram`, `wechat-official-accounts`.

### Platform Aliases

| User says                          | Maps to platform           |
| ---------------------------------- | -------------------------- |
| 微信公众号 / 公众号 / 微信公众账号 | `wechat-official-accounts` |
| 小红书 / 红书 / RED                | `rednote`                  |
| ins / Instagram                    | `instagram`                |

When the user mentions any localized alias above, treat it as the corresponding platform value without asking for clarification. Keep the canonical platform values in files and tool calls.

The table below is a fallback only. When the user explicitly specifies card size or aspect ratio, follow the user's values; do not override them with the defaults.

| platform | Default size | Aspect | Notes |
| --- | --- | --- | --- |
| `rednote` | 540x720 | 3:4 | Xiaohongshu vertical card, standard feed |
| `instagram` | 540x675 | 4:5 | Instagram feed portrait |
| `wechat-official-accounts` | N/A | N/A | Article post: single HTML + heroCover + thumbnailCover |

Fallback rules inside `instagram`: if the user wants a square layout, use `540x540` (1:1); for stories or reels covers, use `540x960` (9:16). Ask before assuming.

Decision order every time you pick a card canvas size:

1. If the user specified a size or aspect ratio in the current session, use it.
2. Else, if the user specified only a platform, use the platform default from the table above.
3. Else, ask the user which platform and size they want before starting.

---

## Built-in Presets

Presets are organized by platform under `presets/<platform>/<preset>/`. Each preset is a pair of files (`<preset>.css` + `<preset>.js`).

| Platform | Preset | Style summary |
| --- | --- | --- |
| `rednote` | `neo-brutalism` | Neo-Brutalism: thick black borders, hard offset shadows, saturated palette. |
| `rednote` | `code-dispatch` | Code Dispatch: high-contrast editorial style, black/white/red palette, monospace labels, no rounded corners, grid background texture. Best for tech/coding/AI topics. |
| `rednote` | `dark-tech` | Dark-Tech: deep black background, gold accent, thin 1px borders, heavy/light font-weight contrast. Inspired by DJI-style review cards. Best for product/gear reviews. |
| `rednote` | `gradient-editorial` | Image Editorial: cover uses hero/theme image with gradient overlay for text readability, clean white content pages, rounded cards. Best for AI/tech insight articles. |
| `rednote` | `personal-insight` | Personal Insight: clean white background, profile avatar, numbered sections, reading-note style. Best for personal reflections and knowledge sharing. |
| `rednote` | `film-vintage` | Film Vintage: dark cinematic cover, polaroid-style photo frames, mono grain texture, red accent, serif+mono typography. Best for film photography, gear reviews, and city walk journals. |
| `rednote` | `warm-journal` | Warm Journal: photo-led journal pages, handwritten titles, khaki/beige paper textures, scattered notes, and polaroid frames. Best for lifestyle, product notes, and city records. |
| `rednote` | `paper-column` | Paper Column: paper texture, serif display titles, marginal notes, pull quotes, ledgers, and evidence frames. Best for essays, analysis, knowledge columns, and field-note narratives. |
| `rednote` | `signal-grid` | Signal Grid: strict grid rhythm, light display type, one accent color, matrix rows, KPI blocks, and ranking bars. Best for product notes, comparisons, launch explainers, and structured decisions. |
| `rednote` | `product-launch-preset` | Product Launch: white background, 6px red top accent bar, black text + red highlights only, sharp 2px badges, 10px rounded image containers. Best for product feature announcements and release notes. |
| `instagram` | `ins-modern` | Instagram Modern: bold white editorial cards, crisp black structure, hard shadows, and selective social accents. Best for creator productivity and punchy carousel hooks. |
| `instagram` | `ins-minimal` | Instagram Minimal: quiet premium whitespace, fine rules, serif display type, and calm editorial hierarchy. Best for digests, summaries, and point-of-view posts. |
| `instagram` | `ins-dark` | Instagram Dark Tech: dark product-launch energy, electric accents, console-like modules, and high-contrast data blocks. Best for tools, productivity, and technical topics. |
| `instagram` | `ins-retro` | Instagram Retro Story: warm paper, stamp details, ornamental rules, and story-first pacing. Best for storytelling content and visual guides. |
| `instagram` | `ins-fluent-depth` | Instagram Fluent Depth: soft layered surfaces, restrained depth, calm material feel, and readable product storytelling. Best for workflow explainers and high-trust product stories. |
| `instagram` | `ins-token-system` | Instagram Token System: neutral surfaces, semantic color roles, compact lozenges, and enterprise grid rhythm. Best for structured decisions and product comparisons. |
| `instagram` | `ins-creator-studio` | Instagram Creator Studio: profile-led structure, numbered lessons, credibility blocks, and personal voice cues. Best for personal insights and creator education. |
| `instagram` | `ins-film-frame` | Instagram Film Frame: cinematic black frame, contact-sheet rhythm, warm highlights, and review-ready panels. Best for photography, gear reviews, and city walk journals. |
| `instagram` | `ins-warm-journal` | Instagram Warm Journal: soft journal pages, taped-note modules, warm accents, and lifestyle-friendly grids. Best for lifestyle notes, product diaries, and cozy recommendations. |
| `instagram` | `ins-signal-grid` | Instagram Signal Grid: strict grid rhythm, matrix rows, KPI cells, and decision-oriented comparison blocks. Best for product comparisons, launch explainers, and structured decisions. |
| `wechat-official-accounts` | _(coming soon)_ | Presets for WeChat article style will be added here. |

Source paths inside this skill:

```
presets/rednote/neo-brutalism/neo-brutalism.{css,js}
presets/rednote/code-dispatch/code-dispatch.{css,js}
presets/rednote/dark-tech/dark-tech.{css,js}
presets/rednote/gradient-editorial/gradient-editorial.{css,js}
presets/rednote/personal-insight/personal-insight.{css,js}
presets/rednote/film-vintage/film-vintage.{css,js}
presets/rednote/warm-journal/warm-journal.{css,js}
presets/rednote/paper-column/paper-column.{css,js}
presets/rednote/signal-grid/signal-grid.{css,js}
presets/rednote/product-launch-preset/product-launch.{css,js}
presets/instagram/ins-modern/ins-modern.{css,js}
presets/instagram/ins-minimal/ins-minimal.{css,js}
presets/instagram/ins-dark/ins-dark.{css,js}
presets/instagram/ins-retro/ins-retro.{css,js}
presets/instagram/ins-fluent-depth/ins-fluent-depth.{css,js}
presets/instagram/ins-token-system/ins-token-system.{css,js}
presets/instagram/ins-creator-studio/ins-creator-studio.{css,js}
presets/instagram/ins-film-frame/ins-film-frame.{css,js}
presets/instagram/ins-warm-journal/ins-warm-journal.{css,js}
presets/instagram/ins-signal-grid/ins-signal-grid.{css,js}
```

When the user picks a preset (see Workflow Step 4.1), read the source files from `presets/<platform>/<preset>/` and copy both files once into the project at `shared/presets/<preset>/`. Reference them from every card with `<link>` and `<script>` tags using `../../../shared/presets/<preset>/<preset>.css|.js`.

### Custom Preset Generation (Optional Sub-Skill)

When the user wants a visual style that is not covered by any built-in preset, a custom preset can be generated from a free-form description. This capability is encapsulated in the **`generate-preset`** sub-skill:

```
generate-preset/SKILL.md   (inside this skill folder)
```

**Load this sub-skill when:**

- The user selects "Custom style" in the Step 4.1 picker.
- The user explicitly asks to "create a new preset", "design a theme", or "generate a style".
- The user provides a reference image / Figma frame and asks for a matching preset.

**What it produces:** a `<preset-name>.css` + `<preset-name>.js` pair, saved to `<project-root>/shared/presets/<preset-name>/`, ready to be linked from cards exactly like a built-in preset.

---

## Core Tools

### create_self_media_project

Scaffolds a new self-media project. Creates the project folder, `posts/`, `shared/`, and a valid `magic.project.js`. It does not generate any frontend loader HTML - rendering lives in other frontends.

| Parameter | Required | Description |
| --- | --- | --- |
| `project_path` | Yes | Project folder path, workspace-relative. Reflect the topic; prefer a safe ASCII slug unless the user explicitly needs a localized filesystem name. |
| `platform` | Yes | One of `rednote`, `instagram`, `wechat-official-accounts`. |
| `posts` | No | Optional pre-registered post index entries. Each item `{ "id": "...", "name": "..." }`. Default `[]`. |

Returns: `{ project_path, project_name, platform, posts_count }`.

### create_self_media_post

Creates a single post directory (`posts/<post_id>/`) with `post.json` and an empty `assets/`. For card-based platforms (rednote / instagram) also creates an empty `cards/`. Optionally registers the post in the root `magic.project.js` posts array of the project's platform.

| Parameter | Required | Description |
| --- | --- | --- |
| `project_path` | Yes | Self-media project root, workspace-relative. |
| `post_id` | Yes | Stable id, safe for filesystem (for example `ai-bill`). Used as folder name and `post.json.id`. |
| `post_name` | Yes | Display name written into the root `posts[]` entry and as the fallback `meta.title`. |
| `meta` | No | Object merged into `post.json.meta`. Free-form fields: `title`, `subtitle`, `tags`, `author`, `feedTitle`, `feedLikes`, `commentCount`, `comments`, `time` (wechat), `interactionReference`, etc. For `rednote`, `tags` should use the structured hashtag pyramid unless the user supplied a legacy string/array format. |
| `cards` | No | **rednote / instagram only.** Initial value for `post.json.cards`. Paths relative to the post folder, for example `"cards/01.html"`. |
| `article` | No | **wechat-official-accounts only.** Relative path to the single HTML article file, for example `"my-article.html"`. When provided, the post is treated as a WeChat article post; `cards` is ignored. |
| `hero_cover` | No | **wechat-official-accounts only.** Relative path to the hero cover image (21:9), for example `"assets/cover-hero.jpg"`. Written as `heroCover` in `post.json`. |
| `thumbnail_cover` | No | **wechat-official-accounts only.** Relative path to the square thumbnail cover image, for example `"assets/cover-square.jpg"`. Written as `thumbnailCover` in `post.json`. |
| `register_in_project` | No | Default `true`. Append/update the entry in the root `magic.project.js` posts array. If the frontend prompt says the post is already pre-registered, explicitly pass `false` and do not edit the root index. |

Idempotence: if `posts/<post_id>/` already exists, the tool merges `meta` (shallow merge, new keys win), keeps existing `cards` / `article` / `heroCover` / `thumbnailCover` untouched unless the caller passes new values, and preserves the root posts entry order.

Returns: `{ post_path, post_json_path, registered }`.

---

## Workflow

Follow this loop until the user's intent is fully served.

### Step 0 - check for existing planning data (automatic)

Before asking any questions, check if the project already contains user planning data from the frontend:

1. Look for `__drafts/draft.json` in the self-media folder.
2. If found, `read_files` to load it. See [Drafts & Templates Format](./references/drafts-format.md) for the schema.
3. If `__drafts/reference-index.json` exists, read it immediately after `draft.json`. Treat it as the unified reference entry point.
4. If brand context is needed and `draft.json.global` is missing, sparse, or stale, try to read `__brand/brand-config.json` before asking the user. Treat it as an optional fallback. Current-session user instructions and explicit `draft.json.global` values outrank it.
5. Extract and apply context:
   - `global.author` / `global.brandPosition` / `global.targetAudience` → brand context (no need to ask)
   - `global.brandImages` → brand IP image assets for image generation reference (use in Step 4.3)
   - `__brand/brand-config.json` fields → brand context fallback when `global` fields are unavailable
   - `articles[].title` / `articles[].outline` → content structure is pre-planned
   - `articles[].visualPreset` → visual preset is pre-selected (skip Step 4.1 for that article)
   - `articles[].style` → content tone is chosen
   - `articles[].platform` → known platform for that article
   - `articles[].materials` → article-level reference files available via `relativePath`
   - `articles[].outline[].materials` → node-scoped reference files available via `relativePath`
   - `articles[].visualReferenceFiles` → visual-style references available via `file_path` or inline `content`
   - `articles[].notes` → explicit user instructions to follow
   - `articles[].cardCount` → target card count
6. Read and understand all uploaded references before drafting, designing, or generating images. This rule applies regardless of where the user attached the file in the frontend.
7. If the draft provides enough information to proceed (at least one article with title plus either platform or clear continuation context), skip directly to the appropriate step. If the draft is incomplete, proceed from Step 1 but pre-fill known fields.

> This step is silent — do not announce "I found a draft" unless the data is ambiguous and needs user confirmation.

### Step 0.1 - read uploaded references before creation

This step is mandatory whenever uploaded references exist.

1. Resolve references from `reference-index.json` first.
2. If `reference-index.json` is missing or incomplete, fall back to:
   - `__brand/brand-config.json`, when brand context is needed
   - `global.brandImages`
   - `articles[].materials`
   - `articles[].outline[].materials`
   - `articles[].visualReferenceFiles`
3. Resolve each reference in this order:
   - `relativePath`
   - `file_path` / `file_id`
   - inline `content`
4. Read and understand the reference before drafting copy, generating images, or designing cards.
5. Group the references by role:
   - `brand`
   - `article-material`
   - `outline-material`
   - `visual-reference`
6. Apply them at the correct scope. Outline-node references should influence the matching node first, not the whole post by default.
7. If a reference cannot be fully read, do not ignore it. State the limitation explicitly and still use its name, description, path, and surrounding context.

### Step 1 - understand intent and platform

- Clarify the topic and target platform. If platform or content type is missing, ask one question before proceeding.
- For `wechat-official-accounts`: the post is a single long-form HTML article plus two cover images — not a card sequence.
- For `rednote` / `instagram`: the post is a sequence of fixed-size card HTML files.
- Outline how many posts the request implies, and for each post the rough number of cards (or confirm it is a single article for WeChat).

### Step 2 - research factual content (when needed)

- Use `web_search` and `read_webpages_as_markdown` to gather up-to-date facts, data points, quotes, or source material for the copy.
- Always incorporate the uploaded references from Step 0.1 before expanding with external research. Uploaded references outrank generic web research when they cover the same topic.
- **Do not** search or generate images in this step. Images must serve the visual language, and the visual language is only fixed in Step 4.1. Collecting or generating images before the style is resolved will force the cards to accommodate mismatched visuals instead of the other way around.

### Step 3 - scaffold the project (first time only)

- Call `create_self_media_project` with `project_path` and `platform`.
- Optionally pass `posts=[{id, name}, ...]` if you already know the full post list.

### Step 4 - author each post

For every post, run this ordered sub-flow. Do not skip or reorder steps.

Before running 4.1-4.5 for a post, confirm that you have already read and understood:

- article-level materials for that post
- outline-node materials for that post
- visual reference files for that post
- any brand image assets that influence stylistic or brand consistency

**4.1 Ask the user which preset to use (mandatory for all platforms)**

Before creating any post content, call `ask_user` exactly once and let the user pick the visual template. Render the question and option labels in the user's preferred output language while keeping the canonical preset IDs unchanged. Present only the presets available for the current platform, plus an explicit "No template" option:

**For `rednote`:**

```xml
<question type="select">
Please choose a visual template for the cards:
<option>neo-brutalism — thick black borders, hard offset shadows, saturated palette</option>
<option>code-dispatch — high-contrast editorial, black/white/red, monospace labels, grid texture; ideal for tech/coding/AI topics</option>
<option>dark-tech — deep black background, gold accent, thin borders, DJI-style; ideal for product/gear reviews</option>
<option>gradient-editorial — hero image with gradient overlay, clean white content pages, modern editorial style; ideal for AI/tech insight articles</option>
<option>personal-insight — clean white background, profile avatar, numbered sections; ideal for personal reflections and knowledge sharing</option>
<option>film-vintage — cinematic cover, polaroid photo frames, grain texture, red accent; ideal for photography, gear reviews, and city walks</option>
<option>warm-journal — photo-led journal pages, handwritten titles, khaki/beige paper textures; ideal for lifestyle, product notes, and city records</option>
<option>paper-column — paper texture, serif titles, marginal notes, pull quotes, and ledgers; ideal for essays, analysis, and knowledge columns</option>
<option>signal-grid — strict grid rhythm, one accent color, KPI blocks, matrix rows, and ranking bars; ideal for comparisons, product notes, and decisions</option>
<option>product-launch-preset — white background, red top accent bar, sharp badges, minimal dual-color; ideal for product feature announcements and release notes</option>
<option>Custom style — describe the visual language you want and a preset will be generated for you</option>
<option>No template — design freely following the platform baseline</option>
</question>
```

**For `instagram`:**

```xml
<question type="select">
Please choose a visual template for the cards:
<option>ins-modern — white background, generous whitespace, minimal typography</option>
<option>ins-minimal — restrained whitespace, fine dividers, minimal hierarchy; ideal for digests and summary posts</option>
<option>ins-dark — dark tech styling, neon accents, high-contrast modules; ideal for tools, productivity, and technical topics</option>
<option>ins-retro — retro headlines, warm paper tones, ornamental marks; ideal for storytelling and visual guides</option>
<option>ins-fluent-depth — soft layered surfaces, restrained depth, calm product storytelling; ideal for workflow explainers and product stories</option>
<option>ins-token-system — neutral surfaces, semantic color roles, compact lozenges, enterprise grid rhythm; ideal for product comparisons and structured decisions</option>
<option>ins-creator-studio — profile-led lessons, credibility blocks, personal voice cues; ideal for creator education and reflections</option>
<option>ins-film-frame — cinematic frame, contact-sheet rhythm, warm highlights; ideal for photography, gear reviews, and city walks</option>
<option>ins-warm-journal — soft journal pages, taped-note modules, warm lifestyle grids; ideal for product notes and cozy recommendations</option>
<option>ins-signal-grid — strict grid rhythm, KPI cells, matrix rows; ideal for comparisons, launch explainers, and decisions</option>
<option>Custom style — describe the visual language you want and a preset will be generated for you</option>
<option>No template — design freely following the platform baseline</option>
</question>
```

**For `wechat-official-accounts`:**

```xml
<question type="select">
Please choose a visual template for the article:
<option>Custom style — describe the visual language you want and a preset will be generated for you</option>
<option>No template — design freely following the WeChat article baseline (presets coming soon)</option>
</question>
```

Rules:

- Do **not** skip this prompt for any platform — even when the user already described a style vaguely, the preset choice must be explicit.
- If the user picks a **built-in preset**, read the source files from `presets/<platform>/<preset>/` inside this skill and copy them into the project once:
  - source: `presets/<platform>/<preset>/<preset>.css` and `presets/<platform>/<preset>/<preset>.js`.
  - destination: `<project-root>/shared/presets/<preset>/<preset>.css` and `<preset>.js`.
  - Use `read_files` to load the sources and `write_file` to copy; skip the copy if the destination already exists.
- If the user picks **Custom style**, ask a follow-up free-text question:
  ```xml
  <question type="text">
  Describe the visual style you want (e.g. mood, colors, font feel, decoration, content domain):
  </question>
  ```
  Then load and follow the **`generate-preset` sub-skill** (`generate-preset/SKILL.md` inside this skill folder) to generate a custom CSS + JS preset bundle. Save the generated files to `<project-root>/shared/presets/<preset-name>/` before proceeding to Step 4.2. Treat the generated preset exactly like a built-in preset for all subsequent card authoring steps.
- If the user picks **No template**, go straight to 4.2 without copying anything; content will be authored against the plain platform defaults.
- When the user explicitly provides their own HTML template, screenshot, Figma link, or CSS spec in this session, that artifact outranks the preset choice. You may still copy a preset in parallel for icon/helper utilities, but layout and colors must follow the user artifact.

**4.2 Create the post folder**

Before calling `create_self_media_post`, generate a complete `meta` object from the planned article/card content. Besides title, subtitle, tags, author, and feed title, every new post must include reference engagement data:

- `feedLikes`: a platform-appropriate display string, such as `"1.8w"`, `"12.3k"`, or `"860"`.
- `commentCount`: a display string aligned with `feedLikes` and the likely engagement level.
- `comments`: 3-5 plausible sample evaluations for every generated post, written in the audience's voice and tied to the actual content. Rednote / Instagram previewers render them; WeChat stores them as a reference evaluation pool. Do not use generic praise such as "Great post".
- `time`: for `wechat-official-accounts`, a natural relative feed time in the user's output language, such as `"4 minutes ago"` or the localized equivalent.
- `interactionReference`: optional but recommended. Use it for non-rendered notes such as `{ "level": "medium-high", "basis": "product launch / strong pain point", "disclaimer": "reference display data, not real platform analytics" }`.

Treat these numbers and evaluations as reference/display data, not verified analytics. They should feel credible for the platform, topic, audience size, and content intensity; do not invent factual performance claims such as "real launch data" unless the user supplied the data.

**4.2.1 Build `meta.tags` for `rednote`**

For every `rednote` post, load [Rednote Hashtag Library](./references/hashtag-library.md) before calling `create_self_media_post`. Populate `meta.tags` with the four-layer pyramid:

```json
{
  "core": ["workwear"],
  "mid": ["commute outfits", "petite styling"],
  "longtail": ["outfits for new office workers", "155cm styling tips"],
  "trend": ["dopamine dressing"]
}
```

Rules:

1. Total count must be 5-8 tags. Hard cap: 10.
2. Output order is `core -> mid -> longtail -> trend`.
3. `core`: 1-2 category anchors.
4. `mid`: 2-3 scenario, style, or search-intent tags.
5. `longtail`: 2-3 audience, pain-point, location, body-type, budget, or use-case tags.
6. `trend`: 0-1 current trend or official activity tag. Omit stale trend tags.
7. Travel posts must include a concrete city, area, route, or attraction tag.
8. If the user supplies tags as a string or array, preserve them only when they are relevant and within the cap; otherwise normalize them into the four fields and remove off-topic tags.
9. If the topic is outside the built-in categories, build the same four layers from the post's audience, scenario, pain point, and trend. Do not force a mismatched category from the library.

🔴 CHECKPOINT · Rednote tag confirmation:

- If the user did not provide tags, propose the final 5-8 tags once before creating the post.
- If a draft or frontend planning payload already contains tag intent, use it as the source of truth and do not ask again unless the tags violate the cap, contain irrelevant traffic-bait, or miss a required concrete qualifier such as a travel location.

**For `rednote` / `instagram`:** call `create_self_media_post` with `post_id`, `post_name`, the complete `meta`, and the planned `cards` list. This yields `posts/<id>/post.json`, `cards/`, and `assets/`. If the frontend prompt states that the post was pre-registered in `magic.project.js`, pass `register_in_project=false`.

**For `wechat-official-accounts`:** call `create_self_media_post` with `post_id`, `post_name`, the complete `meta`, `article` (the filename), `hero_cover` (e.g. `"assets/cover-hero.jpg"`), and `thumbnail_cover` (e.g. `"assets/cover-square.jpg"`). This yields `posts/<id>/post.json` and `assets/`. No `cards/` folder is created. If the frontend prompt states that the post was pre-registered in `magic.project.js`, pass `register_in_project=false`.

**4.3 Collect or generate images (after the style is fixed)**

Only after the preset decision in 4.1 is done are images allowed to enter the pipeline. Images serve the style; never let images dictate it.

**4.3.0 Check for brand image assets (automatic)**

Before generating any images, check if the user provided brand image / IP assets in the global settings:

1. Look for `global.brandImages` in the draft data (or files in `__drafts/brand-images/`).
2. If brand images exist, look at each one to understand the IP character, color palette, art style, and key visual elements; call `visual_understanding` only for images not already visible in your context.
3. When generating illustrations, card decorations, or any post imagery:
   - Incorporate the brand IP character or elements where contextually appropriate (e.g., as mascot illustrations, corner decorations, section dividers).
   - Match the brand's color palette and art style to maintain visual consistency.
   - When imagery should show the brand character or style, pass the brand image in `reference_images` and state its role in the prompt (e.g., "the mascot from Image 1, same character design", "in the art style of Image 1"). The generation model sees the brand image directly; your own description of it is a weaker copy that can drift from the real character. When a brand element must stand out, such as a signature color or the mascot's pose, name it as the thing to keep or emphasize.
   - For `wechat-official-accounts` cover images, make a case-by-case decision on whether to incorporate brand elements. Use them when they strengthen recognition, trust, or thematic fit; skip them when they would reduce clarity, editorial quality, or topic accuracy.
4. If no brand images exist, proceed normally without this constraint.

> This step ensures all generated visuals feel cohesive with the user's established brand identity.

**4.3.1 Check outline image materials for reference-based recreation (automatic)**

When `articles[].outline[].materials` or `articles[].materials` includes screenshots, charts, UI captures, product images, diagrams, or other content-relevant images, do not treat them as passive attachments.

For each image material:

1. Look at the image to identify what it shows, what information matters, and which outline node or card it should support; call `visual_understanding` only if it is not already visible in your context.
2. If the image is useful for the final content, prefer a new generated asset instead of placing the raw screenshot directly into a card.
3. Call `generate_images` with the source image in `reference_images`. The prompt should name which information in Image 1 to keep and how to adapt it to the resolved preset/style.
4. Add visual emphasis where it helps comprehension: highlighted key areas, zoom callouts, arrows, labels, comparison boxes, focus rings, cropped detail panels, or before/after framing.
5. Save the generated result under `posts/<post_id>/assets/` and use that generated asset in the card or article HTML.
6. Keep node scope: an image attached to one outline node should primarily influence that node/card. Expand it to other cards only when the image clearly supports the broader narrative.

Raw image materials may still be used as factual references, but card-facing visuals should be recreated or annotated when that makes the message clearer.

**4.3.2 Handle missing images with generation or placeholders (automatic)**

When a card or article section needs an image but the user did not provide one, first decide whether image generation is appropriate.

Generate an image when the needed visual is:

- a conceptual cover, atmosphere image, section opener, trend, emotion, vision, or abstract topic visual
- a diagram-like illustration, analogy, workflow, comparison, pain-point scene, before/after change, or methodology explanation
- a brand/IP extension based on provided brand assets or style requirements
- a card-level visual enhancement that improves attention, hierarchy, or memorability
- not dependent on exact real people, exact real events, strict evidence, or precise source data

Do not generate an image when the needed visual must be strictly factual or would be misleading if invented:

- data charts, financial reports, product dashboards, experiment results, legal/medical/financial evidence
- exact real people, real brand/product UI details, news scenes, accident scenes, user reviews, chat logs
- local explanations that require an original screenshot or source image that the user did not provide
- article transitions where a styled placeholder or information layout communicates better than an illustration

If generation is appropriate, call `generate_images` after style is resolved and save the result under `posts/<post_id>/assets/`. If generation is not appropriate, create a styled placeholder instead:

- Card placeholders should match the preset: dashed frame, icon block, muted panel, label chip, decorative grid, or "pending screenshot/data chart" module.
- WeChat article placeholders should use a clear placeholder line such as `【Image placeholder: purpose or scene description】`.
- For missing screenshots or data charts, label them as pending replacement assets. Do not fabricate evidence-like visuals.

For every image the cards need:

1. Derive the visual brief from the resolved style (preset palette / user artifact / platform default).
2. Pick the tool that best preserves the style:
   - `generate_image` — preferred when the preset or user artifact implies a specific illustrative language. Pass the style cues explicitly in the prompt (color tokens, mood words, composition, negative prompts for styles to avoid).
   - `image_search` — acceptable for neutral, topic-driven photography or real-world references. Use batch mode (one call, multiple requirements). Before accepting any returned image, verify with `visual_understanding` that its colors, lighting, and composition do not fight the style; discard mismatches rather than force-fit.
   - `visual_understanding` — also used to read the dimensions / content of a user-supplied reference image that is not already visible in your context before placing it into a card.
3. Save the files:
   - Card-local → `posts/<post_id>/assets/<name>.<ext>`.
   - Cross-post → `shared/<name>.<ext>`.

**4.4 Write the content**

Load [Human Writing Style](./references/human-writing-style.md) before drafting card copy or article prose. This reference is the internal source of truth for human texture, author voice, anti-generic-copy checks, and platform-specific writing self-checks.

**4.4.0 Build the human-writing brief**

Before authoring HTML, write a short internal brief from the available context:

- author voice: who is speaking and why the reader should trust this voice
- target reader: the concrete reader state, pain, desire, or decision moment
- reader action: save, comment, follow, consult, compare, try, buy, or remember a viewpoint
- evidence: uploaded references, product details, screenshots, comparisons, cases, constraints, or observed scenes

Infer from `global.author`, `global.brandPosition`, `global.targetAudience`, optional `__brand/brand-config.json`, `articles[].style`, `articles[].notes`, title, outline, and uploaded materials. Ask only when the missing answer changes the direction of the post and no brand config fallback can answer it. Do not invent first-person experience, customer proof, metrics, or quotes to create human texture.

**4.4.1 Author the platform content**

**For `rednote` / `instagram`:** use `write_file` to author each card HTML at the exact path declared in `cards`. Match the resolved style:

- Preset chosen → link the copied CSS/JS from `../../../shared/presets/<preset>/`, follow its class naming conventions, reuse its tokens.
- User artifact → reproduce layout, colors, typography, and component treatments faithfully.
- No preset and no artifact → follow the Platform Defaults and the constraints in [references/card-html-constraints.md](./references/card-html-constraints.md).

Reference only local image files saved in 4.3. Load [Card HTML Constraints](./references/card-html-constraints.md) for the full technical rules, content density requirements, and minimal HTML skeleton before writing any card.

**For `wechat-official-accounts`:** use `write_file` to author the article HTML at the path declared in `post.json.article` (e.g. `posts/<id>/my-article.html`). The article is a full-width scrollable HTML document — no fixed canvas, no Tailwind card skeleton. Use `write_file` to also place `assets/cover-hero.jpg` and `assets/cover-square.jpg` (or generate them via `generate_image`). If brand image assets are available, evaluate whether the covers should include brand elements; include them only when they support the article topic and cover communication, not as a mandatory overlay.

**4.4.2 Human-writing self-check**

Before finalizing files, run the self-check in [Human Writing Style](./references/human-writing-style.md):

- remove AI press-release flavor: macro openings, generic value words, mechanical three-part structure, vague authority, and slogan endings
- remove fake human texture: unsupported first-person stories, fake casual tone, forced jokes, and exaggerated emotion
- confirm at least one detail could only come from this topic, product, route, uploaded material, reader, or author
- confirm the strongest promise appears early enough for the platform
- confirm title, tags, comments, CTA, and card/article body all support the same reader promise

After writing the final card or article content, re-open `post.json` mentally against the finished copy. If the title, angle, tags, or interaction assumptions changed during authoring, update `post.json.meta` with `edit_file` so `feedTitle`, `feedLikes`, `commentCount`, `comments`, and `interactionReference` still match the final content.

**4.4.3 Final post folder-name check**

After the post content is complete, check whether the current post folder name is semantic enough for the final article. The goal is user-facing clarity in the file tree: users should be able to distinguish posts by folder name without opening each `post.json`.

Rename `posts/<post_id>/` when a clearer, topic-specific folder name would help users identify the article, especially when the current name is generic, placeholder-like, stale, misleading, or no longer aligned with the final title/topic. Do not rename a deliberate user-provided folder name merely for stylistic preference.

If a rename is needed:

1. Choose one safe, stable filesystem id. Prefer a lowercase ASCII slug, and avoid `/`, `\`, `..`, spaces-only names, query characters, or punctuation that can break paths. Keep the user-facing display title in the user's output language.
2. Rename the folder from `posts/<old_id>/` to `posts/<new_id>/`.
3. Update `posts/<new_id>/post.json` so its top-level `id` equals `<new_id>`.
4. Update the root `magic.project.js` platform post entry so:
   - `id` equals `<new_id>`
   - `name` matches the final display title
   - `entry` equals `posts/<new_id>/post.json`
5. Keep all paths inside `post.json` relative to the post folder. Do not rewrite card paths or asset paths unless they incorrectly include the old folder name.

If the frontend prompt says the post was pre-registered in `magic.project.js`, still update the root index when and only when you rename the folder; otherwise the pre-registered `entry` will point to the wrong `post.json`.

**4.5 Adjust later (optional)**

- Reorder cards (rednote/instagram) → `edit_file` on `post.json` to rearrange the `cards` array.
- Update article path / cover images (wechat) → `edit_file` on `post.json`.
- Switch presets later → re-run 4.1 with the new choice, copy the new preset bundle, and update the card HTML links.
- Refresh Rednote trend tags every 2-4 weeks when editing an old post. Replace only stale `trend` items; preserve proven `core`, `mid`, and content-specific `longtail` tags unless the article angle changed.

### Step 5 - maintain the posts index

- Adding a post: rely on `create_self_media_post` with `register_in_project=true`, unless the frontend prompt says the post is already pre-registered. In pre-registered batch flows, use `register_in_project=false` and never edit the root `magic.project.js` posts index.
- Reordering or renaming posts: use `edit_file` on the root `magic.project.js`, keeping `window.magicProjectConfigure(window.magicProjectConfig);` untouched at the bottom. When a post folder is renamed after creation, update the matching `id` and `entry` immediately so `entry` remains `posts/<post-id>/post.json`.
- Removing a post: use `delete_files` on `posts/<id>/`, then `edit_file` on `magic.project.js` to drop the matching entry under the platform's `posts` array.

---

### Step 6 - generate template (optional, AI-initiated)

When the AI has authored a complete post set and the result forms a reusable pattern (e.g. "tech product review 6-card template"), it may save the planning data as a template for the user's future reuse:

1. Generate a unique template ID: `tpl-{timestamp36}-{random4}`.
2. Write a TemplatePayload JSON to `__drafts/templates/{id}.json` — see [Drafts & Templates Format](./references/drafts-format.md) for the schema.
3. Optionally write a companion `{id}.md` for human readability.
4. The frontend will automatically discover the new template and show it in the template selector next time the user starts a new project.

This step is entirely optional. Only generate a template when:

- The user explicitly asks to "save this as a template".
- The current workflow produced a structure that is clearly reusable (multiple articles with the same visual preset and content pattern).

---

## Frontend Integration — Visual Preset Handoff

When the frontend self-media creation panel sends a prompt to the AI, it may include a standardized visual requirement block that specifies the visual preset chosen by the user. The transport is TipTap JSONContent, so the final message may be paragraph-based rather than Markdown, but the semantic fields remain the same. This eliminates the need for Step 4.1's `ask_user` prompt.

### Prompt Format

The frontend injects a visual requirement section equivalent to:

```
Visual requirements
Preset ID: {preset_id}
Platform: {platform}
Preset description: {description}
```

### Behavior When Received

| `Preset ID` value | Action |
| --- | --- |
| Any built-in preset ID listed in Built-in Presets | Skip Step 4.1. Read preset from `presets/<platform>/<preset>/` and copy to project. |
| `custom:{user_description}` | Skip Step 4.1. Load `generate-preset` sub-skill with the description. |
| `none` | Skip Step 4.1. Design freely per platform defaults. |
| _(absent — no visual template section)_ | Run Step 4.1 normally (ask the user). |

For backward compatibility, accept localized legacy field labels that carry the same meaning, but normalize them internally to the English field names above.

### Draft Context Recovery

When the project contains `__drafts/draft.json`, read it at the **start** of the workflow (before Step 1) to recover user planning context:

1. Load [Drafts & Templates Format](./references/drafts-format.md) for schema details.
2. `read_files` on `__drafts/draft.json`.
3. If present, also `read_files` on `__drafts/reference-index.json`.
4. Extract `global` fields → skip asking for author, brand position, and target audience if already filled.
5. If those fields are missing and brand context matters, try `__brand/brand-config.json` before asking.
6. Extract `articles[].platform` → skip platform questions for that article when already resolved.
7. Extract `articles[].outline` → use as the content structure for card authoring.
8. Extract `articles[].visualPreset` → treat as if the visual requirement block was present.
9. Extract `articles[].materials`, `articles[].outline[].materials`, and `articles[].visualReferenceFiles` → read all of them before creating.
10. Extract `articles[].notes` → treat as explicit user instructions.
11. If archive recovery is requested, inspect `__drafts/archive/<archiveId>/manifest.json`, then read the matching archived `draft.json` and `reference-index.json`.

This allows the AI to seamlessly continue where the user left off in the frontend planning panel.

---

## References

Load these files on demand during the corresponding workflow steps:

| Reference | When to load |
| --- | --- |
| [File Formats & Examples](./references/file-formats.md) | When you need `magic.project.js` / `post.json` format, path rules, or file authoring rules |
| [Card HTML Constraints](./references/card-html-constraints.md) | Before writing any card HTML (Step 4.4 for rednote / instagram) |
| [Post Meta Field Reference](./references/post-meta.md) | When populating `post.json.meta` fields |
| [Rednote Hashtag Library](./references/hashtag-library.md) | Before filling `meta.tags` for rednote, or when the user asks to optimize Xiaohongshu tags |
| [Human Writing Style](./references/human-writing-style.md) | Before drafting card copy or WeChat article prose, and before final writing self-check |
| [Tool Selection Decision Tree](./references/tool-decision-tree.md) | When unsure which tool or action to take next |
| [Common Failure Modes](./references/failure-modes.md) | Before submitting — verify no violations |
| [Drafts & Templates Format](./references/drafts-format.md) | When reading/writing `__drafts/` files, `__brand/brand-config.json`, or recovering user planning context |
