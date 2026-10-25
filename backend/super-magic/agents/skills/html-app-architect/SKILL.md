---
name: html-app-architect
description: |
  Use FIRST for building or modifying an interactive HTML app in an ordinary project context, including pages, tools, forms, dashboards, CRUD interfaces, data visualizations, and window.Magic API integrations. Use this skill for architecture, file persistence, Agent dispatch, and UI decisions. Do not use it for the built-in published micro-app development flow; use micro-app-architect for that scenario. Skip read-only documents, pure CLI/backend work, slides, canvas/media generation, and calendar projects handled by magic-calendar. For projects that need a package manager, a build toolchain, or a backend service, use vibe-coding.
---

# HTML App Architect

You are an HTML app architect. Your job is to transform user requirements into fully functional HTML applications following the **three-layer architecture**:

| Layer | Maps to | Responsibility |
| --- | --- | --- |
| HTML | Frontend | UI interaction, data rendering, user input |
| Workspace Skill | Backend | Complex business logic, workflow orchestration, multi-step LLM calls |
| Files (JSON/MD) | Database | Data persistence, state storage |

**Collaboration mechanism**: HTML sends task content via `createTopicAndSend()` or `sendMessage()` → the Agent receives the current ordinary project context → Agent follows explicitly referenced skills or files → skills write results to files → HTML watches via `watchFile()` and re-renders.

---

## How to Use This Document

- **Architecture decisions & constraints** → this document (read fully)
- **Any task using `window.Magic.*` APIs** → load this skill first, then use `read_skills(["html-api-sdk"])` for full API signatures, parameters, and usage examples
- **Companion skill templates & validation** → [references/skill-generation-patterns.md](references/skill-generation-patterns.md)
- **Detailed architecture code examples** → [references/app-architecture-patterns.md](references/app-architecture-patterns.md)

---

## Core Workflow

Every micro-app request follows this sequence:

```
1. Requirement Decomposition
   ├─ What features does the user need?
   ├─ What data needs to be stored/processed?
   ├─ What interactions are required?
   └─ ⚠️ If requirements are vague/ambiguous → use ask_user to clarify BEFORE planning

2. Architecture Decision (see Decision Tree below)
   ├─ Simple → Pure HTML + window.Magic API
   ├─ Medium → HTML + companion workspace skill(s)
   └─ Complex → HTML + multiple skills + multi-agent dispatch

3. Design Phase
   ├─ Data schema (file structure)
   ├─ HTML page structure
   ├─ API selection (which window.Magic.* APIs)
   └─ Companion skill scope (if needed)

4. ⭐ Design Review (output to user for confirmation)
   ├─ Product feature checklist
   ├─ Interaction flow
   ├─ Companion skill list + purpose (if any)
   ├─ Directory structure plan
   └─ Wait for user confirmation before proceeding

5. Generation Phase
   ├─ Generate app.json (micro-app manifest, always first)
   ├─ Generate install icon (`icon.svg`) by default (optional; omit only when user explicitly asks for no icon)
   ├─ Generate magic.project.js (minimal display bridge for file-tree metadata)
   ├─ Generate HTML file(s)
   ├─ Generate companion workspace skill(s) (if needed)
   ├─ Create initial data files (if needed)
   ├─ Generate README.md (for Medium/Complex apps)
   └─ Validate with quick_validate.py (for companion skills)

6. Delivery
   └─ Present the complete micro-app to user
```

### When to Clarify with User (ask_user)

Before diving into architecture design and code generation, **use `ask_user` to confirm with the user** when:

- The requirement is a single vague sentence (e.g. "make a management system") without specifying what to manage, what fields, what workflows
- Key functional scope is unclear — you cannot determine the feature list or data model confidently
- Interaction flow is ambiguous — unclear whether the user wants a simple CRUD or a complex multi-step pipeline
- Target audience or usage scenario is not specified and would significantly affect the design

**Do NOT over-ask** — if the requirement is clear enough to decompose (e.g. "make a todo app that supports adding, completing, and deleting items"), proceed directly. Only ask when the ambiguity would lead to fundamentally different architectures or wasted effort.

### Design Review (Step 4)

Before generating any code, **output a structured design document** for user confirmation. Format:

```markdown
## Product Design Confirmation

### Feature Checklist

1. [Feature name] — brief description
2. [Feature name] — brief description ...

### Interaction Flow

[Main user operation path, described with concise steps or a flow diagram]

### Technical Plan

- Architecture type: Simple / Medium / Complex
- Directory structure: list major files
- Companion skills: if any
  - `.magic/skills/<name>/SKILL.md` — purpose
  - `.magic/skills/<name2>/SKILL.md` — purpose

### Confirmation Items

- [ ] Is the feature scope correct?
- [ ] Are any features missing?
- [ ] Does the interaction flow match expectations?
```

**Rules:**

- Simple apps with clear requirements (e.g. "make a calculator") can skip detailed review — just briefly confirm the plan
- Medium/Complex apps **must** output full design review and wait for user confirmation
- If user requests changes during review, update the design and re-confirm
- After confirmation, proceed to Generation Phase

---

## Architecture Decision Tree

```
User requirement complexity?
├─ Simple (CRUD, display, single LLM call, calculator-like)
│   → Pure HTML + window.Magic API
│   Examples: calculator, todolist, data dashboard, simple chat
│   Characteristics: all logic fits in <script> tags, no multi-step workflows
│
├─ Medium (multi-step LLM pipelines, data processing, scheduled tasks)
│   → HTML + companion workspace skill(s)
│   Examples: report generator, content creation tool, data analysis pipeline
│   Characteristics: backend logic too complex for inline JS, needs structured workflow
│   Skill count: split by responsibility — one skill per distinct workflow/domain
│   e.g. data_analyzer + report_writer if analysis and report generation are separate concerns
│
└─ Complex (multi-agent collaboration, long-running tasks, cross-topic orchestration)
    → HTML + multiple workspace skills + multi-agent dispatch
    Examples: project management system, automated workflow platform, multi-role collaboration
    Characteristics: needs to drive different agents/employees, manage multiple concurrent workflows
```

**Key decision factors:**

- Can all logic fit in a single `<script>` block without becoming unmaintainable? → Simple
- Does the app need the Agent to perform multi-step operations that take time? → Medium
- Does the app need to coordinate multiple agents/employees working in parallel? → Complex

**Medium vs Complex:** Both can have multiple skills. The difference is that Medium dispatches all tasks to general mode, while Complex assigns tasks to **different specialized agents** and coordinates their outputs.

---

## API Capabilities Overview

The HTML layer has access to `window.Magic.*` APIs (pre-injected, no imports needed):

| Namespace | Key Methods | Purpose |
| --- | --- | --- |
| `window.Magic.fs` | `readFile`, `writeFile`, `listFiles`, `listDir`, `watchFile`, `watchDir` | File read/write/watch (paths relative to app root) |
| `window.Magic.llm` | `getModels`, `chat`, `stream` | LLM calls (`model` required; show the model list and default to the first available model) |
| `window.Magic.agent` | `getAgents` | Discover available agents |
| `window.Magic.project` | `createTopicAndSend`, `sendMessage`, `uploadFiles`, `downloadFiles`, `addFilesToMessage` | Cross-topic messaging, file transfer |
| `window.Magic.getAppBasePath` | `getAppBasePath()` | Get workspace-relative app path for @file mentions |
| `window.Magic` (top-level) | `setInputMessage`, `reload` | Quick message to current agent, force refresh |

**For full API signatures, parameters, and constraints** → call `read_skills(["html-api-sdk"])` to load the complete API reference.

---

## HTML Generation Constraints (Must Follow)

1. **No inline event handlers** — All event bindings must use `addEventListener` in JS
2. **File paths are relative to app root** (the directory containing `index.html`)
3. **Using `../` to traverse parent directories is forbidden**
4. **`model` field is always required** — load the model list with `getModels()`, show it in the page, and default to the first available model when no model is selected
5. **Do NOT set `maxTokens` by default** — only specify when explicitly needed
6. **Prefer tiptap JSON for messages containing file paths** — use `@file` mention nodes in `createTopicAndSend`/`sendMessage`/`setInputMessage` when referencing files
7. **Proper file separation from the start** — during architecture design / requirement decomposition, plan a clear directory structure. Do NOT cram all content into a single file. For medium-to-large apps, apply these principles:
   - **Domain-based splitting**: group JS logic by business domain (e.g. `js/finance.js`, `js/reports.js`, `js/settings.js`), not by technical role
   - **View / Data layer separation**: UI rendering logic (DOM manipulation, templates) stays in view modules; data access and state management (read/write files, state objects) stays in data/service modules. Views import data services, not the other way around
   - **CSS separation**: dedicated `<style>` blocks or external CSS files per component/page
   - **Data templates**: initial data files in `data/`, configuration in dedicated config files
   - The directory structure must be decided in the Design Phase, not as an afterthought
8. **Provide agent selector + model selector UI when dispatching skills** — when the app triggers companion skills via `createTopicAndSend`, provide UI for users to select agent and model. Defaults: general mode (no agent selected) + the first available model from `getModels()`. Only omit selectors if the user explicitly specifies a fixed agent/model.
9. **Use `getAppBasePath()` for workspace-relative paths in mentions** — `window.Magic.fs.*` paths are relative to the app root, but `@file` mention nodes in tiptap JSON require **workspace-root-relative** paths. Always call `const basePath = await window.Magic.getAppBasePath()` and prefix data file paths: `file_path: basePath + "data/file.json"`. The `.magic/` directory is already at workspace root, so `.magic/` paths need no prefix.
10. **Data storage: files first, localStorage only for preferences** — app data (records, state, user content) must be stored in workspace files via `window.Magic.fs` (JSON/MD). `localStorage` is only for UI preferences (theme, language, collapsed state, etc.) that don't need to be shared or persisted across workspaces.
11. **CRUD records use incremental files by default** — assume generated micro-apps may be shared by multiple users. Config and single-state files may be overwritten, but user-created business records must default to one file per record under a directory, such as `data/tasks/<record-file>.json`. List pages use `listDir()` and file-name projection; read record JSON only when opening, editing, or analyzing details. Do not generate `data/items.json` as a single array for shared CRUD collections.
12. **Record file names are bounded list projections** — generated CRUD apps must include `buildRecordFileName(record)`, `parseRecordFileName(name)`, `slugifyTitle(title)`, and `truncateUtf8Bytes(input, maxBytes)`. Use `<sortKey>__<status>__<shortId>__<titleSlug>.json`; keep the full file name under 120 UTF-8 bytes, `titleSlug` under 40 bytes, hard-limit 255 bytes, and never put private fields or long text into names. Always include stable `shortId`.
13. **Directory change notifications are snapshot-based** — use `watchDir()` for direct child additions/removals after host attachment refresh, and `watchFile()` for content changes. Treat `renameFile()` projection changes as `removed + added` and match the same record by `shortId`.
14. **Escalate complex query needs** — file-name projection is only for list display, sorting, status filters, and simple title search. If the app needs complex filtering across more than two detail fields, amount ranges, tag combinations, owners, or more than 500 expected records, design an index-file strategy, backend query capability, or bucketed directories with pagination/virtual scrolling.
15. **File-based AI analysis: prefer topic + skill pattern for complex tasks** — when the app requires users to upload/select files and perform AI analysis on file contents, evaluate task complexity to choose the right approach:
    - **Simple tasks** (short text extraction, single-field parsing, brief summarization where file content fits in a few thousand tokens): acceptable to `readFile` + `window.Magic.llm.chat/stream` directly in HTML.
    - **Complex tasks** (long documents, multi-step analysis, cross-file reasoning, structured report generation, tasks needing tool use): strongly prefer the topic + skill pattern — (1) save file to workspace via `writeFile`/`uploadFiles`, (2) send the task with `createTopicAndSend` and explicitly attach the required skill or file mentions. The agent has longer context, file parsing tools, and can orchestrate multi-step workflows. HTML app handles UI only (file picker, progress, result display) and watches output via `watchFile`.
16. **Error logging and user feedback** — every `catch` block and error callback must call `console.error` with useful operation context; never silently swallow errors. Errors that block the user from completing the current task must be surfaced in the UI with a clear, actionable message. Non-blocking errors may degrade gracefully but must still be logged.
17. **Refresh button on lists and volatile data (default)** — add a Refresh button on lists and other views whose data may change, so the user can reload the current data manually.

---

## Companion Workspace Skill Generation

When the architecture decision is "Medium" or "Complex", generate a companion workspace skill.

### Generation Approach

**Always use the `skill-creator` skill to create companion skills.** Do not write SKILL.md manually. Provide the following information when calling `skill-creator`:

- Skill name: lowercase + underscores, reflecting the app domain
- Clear description of the skill's purpose
- Expected input/output files
- Workflow steps

`skill-creator` handles format validation, naming rules, directory placement, and best practices.

### Runtime Trigger Mechanism

At runtime, the HTML app sends messages in the current ordinary project context. Companion skills are not auto-loaded; explicitly attach the required `.magic/skills/<name>/SKILL.md` with an `@file` mention when the task needs one. Example: `createTopicAndSend(messageWithSkillFile, { model: selectedModelId })`, where `selectedModelId` comes from the page model selector and defaults to the first available model. If the skill file does not exist, report the problem or continue without it according to the task's impact.

The app may still explicitly reference a skill file when a task needs an exact workflow or a particular skill:

```javascript
// Get workspace-relative base path for file mentions
const basePath = await window.Magic.getAppBasePath(); // e.g. "personal-finance/"
const selectedRecordPath =
  "data/records/20260624153000__open__a8f3k2__record.json";
const selectedRecordName = selectedRecordPath.split("/").pop();

// Optional explicit skill-file reference for an exact workflow
const { topicId } = await window.Magic.project.createTopicAndSend(
  {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Read the following skill file and follow its instructions: ",
          },
          {
            type: "mention",
            attrs: {
              type: "project_file",
              data: {
                file_id: "skill_ref",
                file_name: "SKILL.md",
                file_path: ".magic/skills/report_writer/SKILL.md",
                file_extension: "md",
              },
            },
          },
          { type: "text", text: "\n\nData file: " },
          {
            type: "mention",
            attrs: {
              type: "project_file",
              data: {
                file_id: "data_ref",
                file_name: selectedRecordName,
                file_path: basePath + selectedRecordPath,
                file_extension: "json",
              },
            },
          },
          { type: "text", text: "\n\nUser task: " + userTaskDescription },
        ],
      },
    ],
  },
  { model: selectedModelId },
);
// Note: no agentId → defaults to general mode (topic_pattern: "general")
```

**Key points:**

- Do NOT pass `agentId` — defaults to general mode
- Model: use the model selected in the page model selector; default to the first available model
- Message format: use tiptap JSON with an explicit @file mention of `.magic/skills/<name>/SKILL.md` when a companion workflow is required; plain text is sufficient for tasks that do not need a skill.
- **Path rules for mentions**: `.magic/` paths stay as-is (already at workspace root); app data file paths must be prefixed with `basePath` from `getAppBasePath()`
- Each skill invocation creates a **new topic** for isolation

### Invoking Built-in System Skills (`@skill` mention)

Built-in system skills, such as web search or code execution, are invoked through `@skill` mentions. This differs from generated companion skills, which use `@file` mentions pointing to SKILL.md.

**Two skill invocation styles:**

| Type | mention type | Data structure | Use case |
| --- | --- | --- | --- |
| Generated companion skill | `project_file` | `{file_id, file_name, file_path, file_extension}` | Custom workflows |
| Built-in system skill | `skill` | `{id, name, icon, description, mention_source}` | Platform-registered capabilities |

**`@skill` mention structure:**

```javascript
{
  type: "mention",
  attrs: {
      type: "skill",       // Note: not "project_file"
      data: {
      id: "skill_unique_id",         // Platform-assigned skill ID. Required.
      name: "Web Search",            // Skill display name. Required.
      icon: "https://...",           // Skill icon URL. Required.
      description: "Search the internet for information", // Skill description. Required.
      mention_source: "system",      // Optional: "system" | "agent" | "mine"
    },
  },
}
```

**`mention_source` values:**

| Value      | Meaning                                        |
| ---------- | ---------------------------------------------- |
| `"system"` | Built-in system skill provided by the platform |
| `"agent"`  | Skill bound to a specific agent                |
| `"mine"`   | Skill from the user's My Library provider      |

**Invocation example — reference a system skill in a message:**

```javascript
// Create a topic and send a message with an @skill reference so the agent uses the specified skill.
const { topicId } = await window.Magic.project.createTopicAndSend(
  {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Use " },
          {
            type: "mention",
            attrs: {
              type: "skill",
              data: {
                id: "web_search_001",
                name: "Web Search",
                icon: "https://example.com/icons/search.svg",
                description: "Search the internet for latest information",
                mention_source: "system",
              },
            },
          },
          {
            type: "text",
            text: " to find the latest AI industry reports and write the results to ",
          },
          {
            type: "mention",
            attrs: {
              type: "project_file",
              data: {
                file_id: "output_ref",
                file_name: "research.md",
                file_path: basePath + "data/research.md",
                file_extension: "md",
              },
            },
          },
        ],
      },
    ],
  },
  { model: selectedModelId },
);
```

**When to use `@skill` vs `@file` SKILL.md:**

- Need a platform-registered standard capability such as search or code execution → `@skill` mention
- Need a custom multi-step workflow such as data analysis pipeline or report generation → `@file` mention pointing to `.magic/skills/<name>/SKILL.md`
- Both can be combined in one message by referencing system skills and companion skill files together

---

## Data Layer Design Patterns

Files serve as the database. Follow these patterns:

### Single-Entity Storage (Allowed To Overwrite)

```
data/config.json          — app configuration
data/state.json           — current app state
```

### Record Collection Storage (Default For CRUD)

```
data/tasks/
├── 20260624153000__open__a8f3k2__follow-up-acme.json
└── 20260625100000__done__p9x7m1__record.json
```

- One user-created business record = one JSON file.
- List pages use `listDir("data/tasks/")` and parse file names. Do not batch `readFile()` every detail record just to render a list.
- Detail JSON is authoritative and stores the stable `id`, full title, private fields, notes, and all business fields.
- File names are only limited list projections: `<sortKey>__<status>__<shortId>__<titleSlug>.json`.
- Generated apps must provide `buildRecordFileName`, `parseRecordFileName`, `slugifyTitle`, and `truncateUtf8Bytes`.
- File-name generation target: max 120 UTF-8 bytes including `.json`; hard limit 255 bytes; `titleSlug` max 40 bytes. Forbidden: `/`, `\`, `<`, `>`, `:`, `"`, `|`, `?`, `*`, control chars, `..`, leading/trailing spaces.
- If title may contain sensitive information or cannot be safely slugified, use `record` as `titleSlug`.
- Always include stable `shortId`; never derive the file name from title alone.
- Sort by parsed `sortKey`, not backend return order.

### Event Log / Append-Only

```
data/events/
├── 20260624153001__evt_a8f3k2.json
└── 20260624153620__evt_b7p9q4.json
```

### Derived Output / Cache (Allowed To Overwrite)

```
data/reports/latest.json
data/cache/summary.json
```

### Large Or Complex Collections

```
data/tasks/2026-06/
data/tasks/open/
data/index/tasks.json
```

**Rules:**

- Always use JSON for structured data (parseable by both HTML and skill)
- Use Markdown for generated content (reports, articles)
- Include stable `id` and `shortId` fields in each record JSON
- Include `updatedAt` timestamps for watched files
- Initialize config files and empty record directories with sensible defaults when creating the app
- Before projection rename, call `listDir()` and reject if the target name exists with a different `shortId`
- If file-name projection and JSON disagree, list uses the file name, detail uses JSON, and a background rename repair may run only when it cannot overwrite another file
- Use an index file or backend query capability when filters require multiple detail fields, amount ranges, tags, owners, or other database-like queries

---

## Agent Dispatch Patterns

For apps that need to trigger backend skills or drive multiple agents:

**Important rules:**

- When sending messages that contain file paths, **always use tiptap JSON format** with `@file` mention nodes
- When triggering a companion skill, **always create a new topic** (`createTopicAndSend`) — do NOT use `setInputMessage`
- Default: no `agentId` (general mode), with the first available model selected from the page model selector
- Provide agent selector + model selector UI when user may want to override defaults

### Built-in Agent IDs

| agentId | Name | Description |
| --- | --- | --- |
| `general` | General mode | General-purpose assistant. This is the default when no `agentId` is passed. |
| `chat` | Chat mode | Assistant focused on conversation. |
| `data_analysis` | Data analysis | Assistant for data analysis and processing. |
| `ppt` | PPT | Assistant for presentation creation. |
| `summary` | Recording summary | Assistant for summarizing recorded content. |

In addition to built-in agent IDs, generated micro-apps can call `window.Magic.agent.getAgents()` to fetch the user's available agents at runtime and use each returned `id` as `agentId`.

### Available Agents at Generation Time

Prefer runtime discovery with `window.Magic.agent.getAgents()` in the generated micro-app. This lets the user choose from their latest available agents.

Use this skill's helper script only when generation-time code must inspect real `agentId` values before writing the app, such as when the user asks to bind a fixed agent or preselect a default agent.

```bash
# List all available agents for the current user.
python agents/skills/html-app-architect/scripts/list_agents.py

# Filter by display name.
python agents/skills/html-app-architect/scripts/list_agents.py --name-filter "Data"

# Filter by type: official, custom, or public.
python agents/skills/html-app-architect/scripts/list_agents.py --type-filter custom
```

The result includes each agent's `code` as the `agentId`, plus `name`, `description`, and `type` (`official`, `custom`, or `public`). Usually do not hardcode real `agentId` values into generated HTML. Write a real `agentId` only when the user requested a fixed agent or an initial default selection. Normal agent pickers should call `window.Magic.agent.getAgents()` at runtime.

### Agent Selector UI Pattern

When the user may want to call a custom agent, provide an agent selector in the UI and support default selection by display-name matching.

```javascript
// 1. Load available agents and render the selector.
async function initAgentSelector(defaultAgentName) {
  const agents = await window.Magic.agent.getAgents();

  // 2. Preselect by fuzzy display-name matching.
  let selectedAgent = null;
  if (defaultAgentName) {
    selectedAgent = agents.find(
      (a) => a.name === defaultAgentName || a.name.includes(defaultAgentName),
    );
  }

  // 3. Render the selector UI.
  const selector = document.getElementById("agent-selector");
  selector.innerHTML = `<option value="">General mode (no agent)</option>`;
  agents.forEach((agent) => {
    const selected =
      selectedAgent && agent.id === selectedAgent.id ? "selected" : "";
    selector.innerHTML += `<option value="${agent.id}" ${selected}>${agent.name}</option>`;
  });
}

// 4. Read the selected agentId before dispatch.
function getSelectedAgentId() {
  const selector = document.getElementById("agent-selector");
  return selector.value || undefined; // Empty means general mode.
}

// 5. Pass it when dispatching.
const { topicId } = await window.Magic.project.createTopicAndSend(
  tiptapMessage,
  { agentId: getSelectedAgentId(), model: getSelectedModel() },
);
```

Rules:

- The default selector option is general mode, with no `agentId`.
- If the user names an agent in the request, match by `name.includes()` and preselect it.
- Provide a model selector as well, defaulting to the first available model returned by `getModels()`.
- When `agentId` is empty or unselected, omit the field; this is equivalent to general mode.

### Pattern 1: Skill Dispatch via New Topic (Primary Pattern)

This is the **default pattern for Medium/Complex apps** — create a new topic and explicitly attach the companion skill file:

```javascript
// Create a new topic and attach the companion skill as an @file mention
async function triggerSkill(userTask) {
  const { topicId } = await window.Magic.project.createTopicAndSend(
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Follow this skill: " },
            {
              type: "mention",
              attrs: {
                type: "project_file",
                data: {
                  file_id: "skill_ref",
                  file_name: "SKILL.md",
                  file_path: ".magic/skills/inventory_manager/SKILL.md",
                  file_extension: "md",
                },
              },
            },
            { type: "text", text: "\n\nUser task: " + userTask },
          ],
        },
      ],
    },
    { model: selectedModelId },
  );
  return topicId;
}
```

### Pattern 2: Agent-Specific Task Dispatch

For complex apps that assign tasks to specific agents (research agent, writer agent, etc.):

```javascript
// Dispatch to a specific agent for a specific task
const agents = await window.Magic.agent.getAgents();
const researcher = agents.find((a) => a.name.includes("Research"));

const { topicId } = await window.Magic.project.createTopicAndSend(
  {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Research the topic: " + topic + ". Write findings to ",
          },
          {
            type: "mention",
            attrs: {
              type: "project_file",
              data: {
                file_id: "research_out",
                file_name: "research.md",
                file_path: "data/outputs/research.md",
                file_extension: "md",
              },
            },
          },
        ],
      },
    ],
  },
  { agentId: researcher.id, model: selectedModelId },
);
```

### Pattern 3: Sequential Multi-Agent Pipeline

Chain multiple agents where each step depends on previous output:

```javascript
async function runPipeline(steps) {
  // steps = [{ agentId, skillPath, prompt_template }, ...]
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const outputPath = `data/outputs/pipeline-step-${i}.md`;

    const content = [{ type: "text", text: step.prompt_template }];
    // Attach skill file if this step has one
    if (step.skillPath) {
      content.unshift(
        { type: "text", text: "Read the skill file " },
        {
          type: "mention",
          attrs: {
            type: "project_file",
            data: {
              file_id: `skill_${i}`,
              file_name: "SKILL.md",
              file_path: step.skillPath,
              file_extension: "md",
            },
          },
        },
        { type: "text", text: " and execute: " },
      );
    }

    await window.Magic.project.createTopicAndSend(
      {
        type: "doc",
        content: [{ type: "paragraph", content }],
      },
      { agentId: step.agentId, model: selectedModelId },
    );

    // Wait for output
    await waitForFile(outputPath);
  }
}
```

### Pattern 4: Simple Current-Topic Message (No skill, no new topic)

For simple commands in the current conversation that don't require a companion skill:

```javascript
// Only use for quick, stateless instructions to the current agent
window.Magic.setInputMessage("Please summarize the data in data/results.json");
```

**Choosing a pattern:**

- Triggering a companion skill → **Pattern 1** (`createTopicAndSend` + explicit @file SKILL.md)
- Assigning task to a specific agent → **Pattern 2** (`createTopicAndSend` + `agentId`)
- Multi-step pipeline across agents/skills → **Pattern 3** (sequential topics)
- Simple one-off instruction, no skill → **Pattern 4** (`setInputMessage`)

---

## Output Spec

This skill generates the following artifacts:

| Artifact | Location | Always generated? |
| --- | --- | --- |
| app.json | `<app-dir>/app.json` | Yes |
| Install icon | `<app-dir>/icon.svg` | Default (optional) |
| magic.project.js | `<app-dir>/magic.project.js` | Yes |
| Main HTML | `<app-dir>/index.html` | Yes |
| Data files | `<app-dir>/data/*.json` | If app needs persistence |
| Companion skill | Created by the `skill-creator` skill | If Medium/Complex architecture |
| README | `<app-dir>/README.md` | For Medium/Complex apps |

**Naming the app directory:** Use the user's language for the directory name. If the user asks for a sales dashboard, the directory should be named descriptively, such as `sales-dashboard/` in English or an equivalent name in the user's language.

### app.json (Micro-App Manifest)

Every new HTML micro-app **must** include an `app.json` file in the app root directory. This is the source-of-truth manifest for the micro-app scenario. It tells the host to treat the folder as a micro-app, defines the entry file, and declares host-readable metadata and permissions.

**Format:** plain JSON. Use this template:

```json
{
  "version": "1.0.0",
  "type": "micro-app",
  "name": "<app display name>",
  "entry": "index.html",
  "icon": "icon.svg",
  "files": {},
  "watch": [],
  "permissions": {}
}
```

**Rules:**

- `type` must be `"micro-app"` — this enables the micro-app icon and click-to-open behavior
- Do not use `"webapp"` for `app.json`; `webapp` may appear in legacy display/share metadata, but the micro-app manifest type is `"micro-app"`
- `name` should be user-friendly (e.g., `"Sales Dashboard"`, `"Task Manager"`, or an equivalent name in the user's language)
- `entry` defaults to `"index.html"`; include it explicitly for new apps
- Include `"icon": "icon.svg"` by default when you generate `icon.svg`; omit the `icon` field entirely when the user explicitly asks for no icon or when icon generation fails
- Generate this file **before** `magic.project.js` and `index.html` so the source-of-truth manifest exists first
- Do not put runtime business state in `app.json`; use data files under `data/` for app state

### magic.project.js (Display Bridge)

Every new HTML micro-app **must also** include a minimal `magic.project.js` file in the app root directory. This file is a legacy display bridge for current file-tree metadata consumers: it lets existing folder icon, title, and project-type detection paths keep working without requiring the frontend attachment list to fetch and parse `app.json`.

`app.json` remains the source of truth. `magic.project.js` must only mirror the small display subset that existing metadata consumers need.

**Format:** JSONP-style assignment plus guarded configure call:

```js
window.magicProjectConfig = {
  version: "1.0.0",
  type: "html-app",
  name: "<app display name>",
  entry: "index.html",
  icon: "icon.svg",
};

if (typeof window.magicProjectConfigure === "function") {
  window.magicProjectConfigure(window.magicProjectConfig);
}
```

**Rules:**

- New HTML apps must use `type: "html-app"` in `magic.project.js`. Existing projects with `type: "micro-app"` remain supported and may be migrated when they are otherwise updated.
- Keep the display bridge type consistent with the convention of the file being generated; `app.json.type` remains `"micro-app"` as the publish manifest source of truth.
- Mirror only `version`, `type`, `name`, `entry`, and `icon`
- Include `entry` whenever `app.json.entry` is present; default to `"index.html"`
- Include `icon` only when the app has an icon
- Do not copy `permissions`, `files`, `watch`, data schemas, user data, app state, or workflow state into `magic.project.js`
- For `version`, `name`, `entry`, and `icon`, `app.json` is the authoritative source and the display bridge should be repaired to match. The `type` values intentionally differ: `app.json` uses `"micro-app"`, while new `magic.project.js` files use `"html-app"`.
- Generate this file before `index.html` when possible, so current file-tree metadata can recognize the folder as an HTML app early

**Install Icon (`icon` field, optional, generated by default)**

By default, generate one `icon.svg` file in the app root for host install and home-screen display. Omit it only when the user explicitly asks for no icon. When omitted, do not include an `icon` field in `app.json` or `magic.project.js`, and do not reference a file that does not exist.

When generated, `app.json.icon` and `magic.project.js.icon` must both point to `icon.svg`. Use a relative local file only. Do not use a remote URL, a published cover, raster image, or data URL for the micro-app icon.

```json
{
  "version": "1.0.0",
  "type": "micro-app",
  "name": "Sales Dashboard",
  "entry": "index.html",
  "icon": "icon.svg"
}
```

**How to generate an icon:**

1. Design one square icon that reflects the app's main purpose. Use a simple symbol, 2–3 colors, and a solid background. Do not include small text, screenshots, detailed charts, or a pre-rounded app-icon mask. Keep the meaningful symbol inside the central 80% safe area.
2. Use `write_file` to create `icon.svg` in the micro-app directory. Keep the SVG self-contained, with a `viewBox`, no external references, no scripts, no event-handler attributes, and no embedded HTML.
3. Validate that the file is well-formed SVG and contains no active content before writing `app.json` and `magic.project.js`.
4. If generation or validation fails, report the failure; do not reference a missing file—omit the `icon` field instead.

---

## Documentation & Change Management

### README.md Structure

For Medium/Complex apps, generate a `README.md` in the app directory documenting:

```markdown
# [App Name]

## Feature Overview

- Feature 1: description
- Feature 2: description

## Directory Structure
```

app-dir/ ├── app.json ├── icon.svg (optional, generated by default) ├── magic.project.js ├── index.html ├── data/ │ └── ... └── ...

```

## Companion Skills
| Skill | Path | Purpose |
|------|------|------|
| [name] | `.magic/skills/[name]/SKILL.md` | Description |

## Interaction Flow
[Main operation flow description]

## Change Log
| Date | Change |
|------|----------|
| YYYY-MM-DD | Initial version |
```

### Change Management Rules

When user requests feature changes to an existing micro-app:

1. **Identify scope** — determine which files/skills are affected
2. **Update README.md** — add a Change Log entry and update Feature Overview if features changed
3. **Update companion skills** — if workflow logic changes, regenerate or edit the relevant SKILL.md
4. **Update data schema** — if data model changes, migrate existing data files
5. **Notify user** — summarize what was changed and what was preserved

---

## Quick Start Examples

### Simple App (Pure HTML)

User: "Make a calculator" → Generate `calculator/app.json` + `calculator/magic.project.js` + `calculator/index.html` with all logic in `<script>`, no companion skill needed.

### Medium App (HTML + Skill)

User: "Make a tool that can automatically analyze CSV data and generate a report" → Generate:

- `data-analyzer/app.json` — source-of-truth micro-app manifest (`type: "micro-app"`)
- `data-analyzer/magic.project.js` — minimal display bridge with `type: "html-app"`, mirroring `version/name/entry/icon`
- `data-analyzer/index.html` — upload UI, results display, watch for report, agent/model selector
- `data-analyzer/data/` — uploaded data storage
- Create the `data_analyzer` companion skill via `skill-creator`, defining the analysis workflow

Runtime: HTML sends a task with an explicit `@file` skill mention → `createTopicAndSend` → the Agent reads the attached skill and executes the workflow

### Complex App (Multi-Agent)

User: "Make a content creation workspace where researchers collect materials, writers draft articles, and editors review" → Generate:

- `content-studio/app.json` — source-of-truth micro-app manifest (`type: "micro-app"`)
- `content-studio/magic.project.js` — minimal display bridge with `type: "html-app"`, mirroring `version/name/entry/icon`
- `content-studio/index.html` — agent selector, model selector, task dispatch UI, status dashboard
- `content-studio/data/` — tasks, drafts, reviews
- Create the `content_pipeline` companion skill via `skill-creator`, defining the orchestration workflow

---

## Reference Documents

Load these when you need detailed information:

- **`read_skills(["html-api-sdk"])`** — Complete `window.Magic.*` API signatures, parameters, return types, and constraints. **Read this before generating any HTML.**
- **[references/skill-generation-patterns.md](references/skill-generation-patterns.md)** — Companion skill templates, validation rules, and best practices.
- **[references/app-architecture-patterns.md](references/app-architecture-patterns.md)** — Detailed architecture patterns with code examples for Simple/Medium/Complex apps.
- **[references/legacy-migration.md](references/legacy-migration.md)** — Migration steps for old `.magic/<name>/` path convention.

**When to read references:**

- Before writing any HTML → always call `read_skills(["html-api-sdk"])`
- Before generating a companion skill → read `skill-generation-patterns.md`
- For complex multi-agent apps → read `app-architecture-patterns.md`
- When detecting legacy `.magic/<name>/SKILL.md` paths → read `legacy-migration.md`
