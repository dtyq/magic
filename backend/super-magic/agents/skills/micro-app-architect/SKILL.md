---
name: micro-app-architect
description: "Micro-app architecture and full-stack generation. Decomposes requirements into HTML frontend + workspace skill backend + file-based data layer, generates all artifacts. Use when user wants to build ANY app, system, tool, page, or interactive experience running as HTML — regardless of domain or complexity. Also for agent-driven backend, multi-agent collaboration, or complex workflows. Covers: requirement decomposition, architecture design (Simple/Medium/Complex), companion skill creation, data schema, multi-agent dispatch. Triggers: 'make an app', 'build a tool', 'create a system', 'create a dashboard', 'make an HTML app', 'develop a micro-app', '做一个应用', '做一个系统', '做一个工具', '做一个页面', '创建HTML微应用', '开发网页工具', '数据看板', '交互式页面'."
---

# Micro-App Architect

You are a micro-app architect. Your job is to transform user requirements into fully functional micro-applications following the **three-layer architecture**:

| Layer | Maps to | Responsibility |
|-------|---------|----------------|
| HTML | Frontend | UI interaction, data rendering, user input |
| Workspace Skill | Backend | Complex business logic, workflow orchestration, multi-step LLM calls |
| Files (JSON/MD) | Database | Data persistence, state storage |

**Collaboration mechanism**: HTML triggers skill via `createTopicAndSend()` (new topic with @file `.magic/<name>/SKILL.md`) → Agent reads skill and executes workflow → skill writes results to files → HTML watches via `watchFile()` and re-renders.

---

## How to Use This Document

- **Architecture decisions & constraints** → this document (read fully)
- **Full API signatures, parameters & usage examples** → `read_skills(["html-api-sdk"])`
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
   ├─ Medium → HTML + companion workspace skill
   └─ Complex → HTML + multiple skills + agent dispatch

3. Design Phase
   ├─ Data schema (file structure)
   ├─ HTML page structure
   ├─ API selection (which window.Magic.* APIs)
   └─ Companion skill scope (if needed)

4. Generation Phase
   ├─ Generate HTML file(s)
   ├─ Generate companion workspace skill (if needed)
   ├─ Create initial data files (if needed)
   └─ Validate with quick_validate.py (for companion skills)

5. Delivery
   └─ Present the complete micro-app to user
```

### When to Clarify with User (ask_user)

Before diving into architecture design and code generation, **use `ask_user` to confirm with the user** when:
- The requirement is a single vague sentence (e.g. "做一个管理系统") without specifying what to manage, what fields, what workflows
- Key functional scope is unclear — you cannot determine the feature list or data model confidently
- Interaction flow is ambiguous — unclear whether the user wants a simple CRUD or a complex multi-step pipeline
- Target audience or usage scenario is not specified and would significantly affect the design

**Do NOT over-ask** — if the requirement is clear enough to decompose (e.g. "做一个待办事项应用，支持添加、完成、删除"), proceed directly. Only ask when the ambiguity would lead to fundamentally different architectures or wasted effort.

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
│   → HTML + ONE companion workspace skill
│   Examples: report generator, content creation tool, data analysis pipeline
│   Characteristics: backend logic too complex for inline JS, needs structured workflow
│
└─ Complex (multi-agent collaboration, long-running tasks, cross-topic orchestration)
    → HTML + multiple workspace skills + agent dispatch
    Examples: project management system, automated workflow platform, multi-role collaboration
    Characteristics: needs to drive different agents, manage multiple concurrent workflows
```

**Key decision factors:**
- Can all logic fit in a single `<script>` block without becoming unmaintainable? → Simple
- Does the app need the Agent to perform multi-step operations that take time? → Medium
- Does the app need to coordinate multiple agents/employees? → Complex

---

## API Capabilities Overview

The HTML layer has access to `window.Magic.*` APIs. Here is a quick categorization:

| Namespace | Capabilities | When to use |
|-----------|-------------|-------------|
| `window.Magic.fs` | readFile, writeFile, listFiles, watchFile | Data persistence, file monitoring |
| `window.Magic.llm` | getModels, chat, stream | AI-powered features in HTML |
| `window.Magic.agent` | getAgents, selectAgent | Agent discovery and dispatch |
| `window.Magic.project` | uploadFiles, downloadFiles, createTopicAndSend, sendMessage, addFilesToMessage | Cross-topic communication, file transfer, multi-agent orchestration |
| `window.Magic.setInputMessage` | Send message to current Agent | Simple instructions (no skill trigger) |
| `window.Magic.reload` | Refresh current task | Force re-execution |

**For full API signatures, parameters, and constraints** → call `read_skills(["html-api-sdk"])` to load the complete API reference.

---

## HTML Generation Constraints (Must Follow)

1. **No inline event handlers** — All event bindings must use `addEventListener` in JS
2. **File paths are relative to app root** (the directory containing `index.html`)
3. **Using `../` to traverse parent directories is forbidden**
4. **`model` field is always required** — default to `"auto"` when no model is selected
5. **Do NOT set `maxTokens` by default** — only specify when explicitly needed
6. **Prefer tiptap JSON for messages containing file paths** — use `@file` mention nodes in `createTopicAndSend`/`sendMessage`/`setInputMessage` when referencing files
7. **Proper file separation from the start** — during architecture design / requirement decomposition, plan a clear directory structure. Do NOT cram all content into a single file. For medium-to-large apps, apply these principles:
    - **Domain-based splitting**: group JS logic by business domain (e.g. `js/finance.js`, `js/reports.js`, `js/settings.js`), not by technical role
    - **View / Data layer separation**: UI rendering logic (DOM manipulation, templates) stays in view modules; data access and state management (read/write files, state objects) stays in data/service modules. Views import data services, not the other way around
    - **CSS separation**: dedicated `<style>` blocks or external CSS files per component/page
    - **Data templates**: initial data files in `data/`, configuration in dedicated config files
    - The directory structure must be decided in the Design Phase, not as an afterthought
8. **Provide agent selector + model selector UI when dispatching skills** — when the app triggers companion skills via `createTopicAndSend`, provide UI for users to select agent (员工) and model. Defaults: general mode (不选员工) + model `"auto"`. Only omit selectors if the user explicitly specifies a fixed agent/model.
9. **Use `getAppBasePath()` for workspace-relative paths in mentions** — `window.Magic.fs.*` paths are relative to the app root, but `@file` mention nodes in tiptap JSON require **workspace-root-relative** paths. Always call `const basePath = await window.Magic.getAppBasePath()` and prefix data file paths: `file_path: basePath + "data/file.json"`. The `.magic/` directory is already at workspace root, so `.magic/` paths need no prefix.
10. **Data storage: files first, localStorage only for preferences** — app data (records, state, user content) must be stored in workspace files via `window.Magic.fs` (JSON/MD). `localStorage` is only for UI preferences (theme, language, collapsed state, etc.) that don't need to be shared or persisted across workspaces.
11. **File-based AI analysis: prefer topic + skill pattern for complex tasks** — when the app requires users to upload/select files and perform AI analysis on file contents, evaluate task complexity to choose the right approach:
    - **Simple tasks** (short text extraction, single-field parsing, brief summarization where file content fits in a few thousand tokens): acceptable to `readFile` + `window.Magic.llm.chat/stream` directly in HTML.
    - **Complex tasks** (long documents, multi-step analysis, cross-file reasoning, structured report generation, tasks needing tool use): strongly prefer the topic + skill pattern — (1) save file to workspace via `writeFile`/`uploadFiles`, (2) `createTopicAndSend` with `@file` mentions + `@skill` or `@file .magic/SKILL.md`. The agent has longer context, file parsing tools, and can orchestrate multi-step workflows. HTML app handles UI only (file picker, progress, result display) and watches output via `watchFile`.

---

## Companion Workspace Skill Generation

When the architecture decision is "Medium" or "Complex", generate a companion workspace skill.

### Generation Approach

**Delegate to skill-creator:** Do not write SKILL.md manually. Instead, invoke the `skill-creator` capability to generate the companion skill. Provide it with:
- The skill name (lowercase + underscores, reflecting the app domain)
- A clear description of what the skill should do
- The expected input/output files
- The workflow steps

The skill-creator will handle format validation, naming rules, and best practices automatically.

### Directory Structure

Companion skills are placed in the `.magic/` directory at the **workspace root** (not inside the app directory):

```
<workspace-root>/
├── .magic/
│   └── <skill_name>/
│       └── SKILL.md            (companion skill definition)
└── <app-directory>/
    ├── index.html          (frontend)
    └── data/               (data layer — JSON files)
```

### Runtime Trigger Mechanism

The companion skill is **not** auto-loaded. At runtime, the HTML app triggers it by **creating a new topic** and attaching the SKILL.md as context:

```javascript
// Get workspace-relative base path for file mentions
const basePath = await window.Magic.getAppBasePath(); // e.g. "个人财务记账/"

// Trigger companion skill via new topic with @file mentions
const { topicId } = await window.Magic.project.createTopicAndSend({
  type: "doc",
  content: [{
    type: "paragraph",
    content: [
      { type: "text", text: "请阅读以下技能文件并按照其中的指引执行任务：" },
      { type: "mention", attrs: {
        type: "project_file",
        data: { file_id: "skill_ref", file_name: "SKILL.md", file_path: ".magic/report_writer/SKILL.md", file_extension: "md" }
      }},
      { type: "text", text: "\n\n数据文件：" },
      { type: "mention", attrs: {
        type: "project_file",
        data: { file_id: "data_ref", file_name: "records.json", file_path: basePath + "data/records.json", file_extension: "json" }
      }},
      { type: "text", text: "\n\n用户任务：" + userTaskDescription }
    ]
  }]
}, { model: "auto" });
// Note: no agentId → defaults to general mode (topic_pattern: "general")
```

**Key points:**
- Do NOT pass `agentId` — defaults to general mode (通用模式)
- Model: always `"auto"` unless user selects otherwise
- Message format: tiptap JSON with @file mention of `.magic/<name>/SKILL.md` + user task text
- **Path rules for mentions**: `.magic/` paths stay as-is (already at workspace root); app data file paths must be prefixed with `basePath` from `getAppBasePath()`
- Each skill invocation creates a **new topic** for isolation

---

## Data Layer Design Patterns

Files serve as the database. Follow these patterns:

### Single-Entity Storage
```
data/config.json          — app configuration
data/state.json           — current app state
```

### Collection Storage
```
data/items.json           — array of items [{id, ...}, ...]
data/users.json           — array of user records
```

### Event Log / Append-Only
```
data/history.json         — ordered array of events [{timestamp, action, ...}]
```

### Multi-File Organization (for complex apps)
```
data/
├── meta.json             — app metadata and indices
├── users/
│   ├── user_001.json
│   └── user_002.json
└── reports/
    ├── 2024-01-report.md
    └── 2024-02-report.md
```

**Rules:**
- Always use JSON for structured data (parseable by both HTML and skill)
- Use Markdown for generated content (reports, articles)
- Include `id` fields for collection items
- Include `updatedAt` timestamps for watched files
- Initialize data files with sensible defaults when creating the app

---

## Agent Dispatch Patterns

For apps that need to trigger backend skills or drive multiple agents:

**Important rules:**
- When sending messages that contain file paths, **always use tiptap JSON format** with `@file` mention nodes
- When triggering a companion skill, **always create a new topic** (`createTopicAndSend`) — do NOT use `setInputMessage`
- Default: no `agentId` (general mode), model `"auto"`
- Provide agent selector + model selector UI when user may want to override defaults

### Pattern 1: Skill Dispatch via New Topic (Primary Pattern)

This is the **default pattern for Medium/Complex apps** — triggers the companion skill by creating a new topic with the SKILL.md attached as context:

```javascript
// Trigger companion skill: create new topic, attach SKILL.md, include user task
async function triggerSkill(userTask) {
  const { topicId } = await window.Magic.project.createTopicAndSend({
    type: "doc",
    content: [{
      type: "paragraph",
      content: [
        { type: "text", text: "请阅读以下技能文件并按照其中的指引执行任务：" },
        { type: "mention", attrs: {
          type: "project_file",
          data: { file_id: "skill_ref", file_name: "SKILL.md", file_path: ".magic/report_writer/SKILL.md", file_extension: "md" }
        }},
        { type: "text", text: "\n\n用户任务：" + userTask }
      ]
    }]
  }, { model: "auto" });
  // No agentId → general mode (通用模式)
  return topicId;
}
```

### Pattern 2: Agent-Specific Task Dispatch

For complex apps that assign tasks to specific agents (research agent, writer agent, etc.):

```javascript
// Dispatch to a specific agent for a specific task
const agents = await window.Magic.agent.getAgents();
const researcher = agents.find(a => a.name.includes("Research"));

const { topicId } = await window.Magic.project.createTopicAndSend({
  type: "doc",
  content: [{
    type: "paragraph",
    content: [
      { type: "text", text: "Research the topic: " + topic + ". Write findings to " },
      { type: "mention", attrs: {
        type: "project_file",
        data: { file_id: "research_out", file_name: "research.md", file_path: "data/outputs/research.md", file_extension: "md" }
      }}
    ]
  }]
}, { agentId: researcher.id, model: "auto" });
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
        { type: "text", text: "请阅读技能文件 " },
        { type: "mention", attrs: {
          type: "project_file",
          data: { file_id: `skill_${i}`, file_name: "SKILL.md", file_path: step.skillPath, file_extension: "md" }
        }},
        { type: "text", text: " 并执行：" }
      );
    }
    
    await window.Magic.project.createTopicAndSend({
      type: "doc",
      content: [{ type: "paragraph", content }]
    }, { agentId: step.agentId, model: "auto" });
    
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
- Triggering a companion skill → **Pattern 1** (`createTopicAndSend` + @file SKILL.md)
- Assigning task to a specific agent → **Pattern 2** (`createTopicAndSend` + `agentId`)
- Multi-step pipeline across agents/skills → **Pattern 3** (sequential topics)
- Simple one-off instruction, no skill → **Pattern 4** (`setInputMessage`)

---

## Output Spec

This skill generates the following artifacts:

| Artifact | Location | Always generated? |
|----------|----------|-------------------|
| Main HTML | `<app-dir>/index.html` | Yes |
| Data files | `<app-dir>/data/*.json` | If app needs persistence |
| Companion skill | `.magic/<name>/SKILL.md` (workspace root) | If Medium/Complex architecture |
| README | `<app-dir>/README.md` | For Complex apps only |

**Naming the app directory:** Use the user's language for the directory name. If the user says "做一个销售看板", the directory should be named descriptively (e.g., `销售看板/` or `sales-dashboard/`).

---

## Quick Start Examples

### Simple App (Pure HTML)
User: "做一个计算器"
→ Generate `calculator/index.html` with all logic in `<script>`, no companion skill needed.

### Medium App (HTML + Skill)
User: "做一个能自动分析CSV数据并生成报告的工具"
→ Generate:
- `data-analyzer/index.html` — upload UI, results display, watch for report, agent/model selector
- `data-analyzer/data/` — uploaded data storage
- `.magic/data_analyzer/SKILL.md` — created via skill-creator, defines the analysis workflow

Runtime: HTML references `.magic/data_analyzer/SKILL.md` via @file mention → `createTopicAndSend` → general mode agent reads skill and executes

### Complex App (Multi-Agent)
User: "做一个内容创作工作台，能让研究员搜集资料，写手写文章，编辑审核"
→ Generate:
- `content-studio/index.html` — agent selector, model selector, task dispatch UI, status dashboard
- `content-studio/data/` — tasks, drafts, reviews
- `.magic/content_pipeline/SKILL.md` — orchestration workflow

---

## Reference Documents

Load these when you need detailed information:

- **`read_skills(["html-api-sdk"])`** — Complete `window.Magic.*` API signatures, parameters, return types, and constraints. **Read this before generating any HTML.**
- **[references/skill-generation-patterns.md](references/skill-generation-patterns.md)** — Companion skill templates, validation rules, and best practices.
- **[references/app-architecture-patterns.md](references/app-architecture-patterns.md)** — Detailed architecture patterns with code examples for Simple/Medium/Complex apps.

**When to read references:**
- Before writing any HTML → always call `read_skills(["html-api-sdk"])`
- Before generating a companion skill → read `skill-generation-patterns.md`
- For complex multi-agent apps → read `app-architecture-patterns.md`
