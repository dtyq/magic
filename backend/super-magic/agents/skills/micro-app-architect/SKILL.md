---
name: micro-app-architect
description: "Micro-app architecture and full-stack generation skill. Decomposes user requirements into HTML frontend + workspace skill backend + file-based data layer, then generates all artifacts in one shot. Use when the user wants to build ANY application, system, tool, page, or interactive experience that will run as HTML in the workspace — regardless of domain or complexity. Also use when user needs to create an app with agent-driven backend logic, multi-agent collaboration, or complex workflows beyond simple HTML. Covers: requirement decomposition, feature planning, architecture design, HTML generation with window.Magic.* APIs, companion workspace skill creation, data schema design, and multi-agent dispatch patterns. Trigger phrases: 'make an app', 'build a tool', 'create a system', 'develop an application', 'create a dashboard', 'write a page', 'make an HTML app', 'build a web tool', 'develop a micro-app', 'write an interactive page', 'build a form app', 'create a chat interface', 'read workspace files in HTML', 'call LLM from HTML', 'stream AI output', 'notify Agent from HTML', '做一个应用', '做一个系统', '做一个工具', '做一个页面', '创建HTML微应用', '开发网页工具', '数据看板', '交互式页面', '读写工作区文件', '调用大模型', '流式输出', '上传下载文件', '新建话题', '选择员工'."
---

# Micro-App Architect

You are a micro-app architect. Your job is to transform user requirements into fully functional micro-applications following the **three-layer architecture**:

| Layer | Maps to | Responsibility |
|-------|---------|----------------|
| HTML | Frontend | UI interaction, data rendering, user input |
| Workspace Skill | Backend | Complex business logic, workflow orchestration, multi-step LLM calls |
| Files (JSON/MD) | Database | Data persistence, state storage |

**Collaboration mechanism**: HTML triggers Agent via `setInputMessage()` → Agent executes workspace skill → skill writes results to files → HTML watches via `watchFile()` and re-renders.

---

## Core Workflow

Every micro-app request follows this sequence:

```
1. Requirement Decomposition
   ├─ What features does the user need?
   ├─ What data needs to be stored/processed?
   └─ What interactions are required?

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
| `window.Magic.setInputMessage` | Send message to current Agent | Trigger backend skill execution |
| `window.Magic.reload` | Refresh current task | Force re-execution |

**For full API signatures, parameters, and constraints** → read [references/html-api-reference.md](references/html-api-reference.md)

---

## HTML Generation Constraints (Must Follow)

1. **No inline event handlers** — All event bindings must use `addEventListener` in JS
2. **No external script imports** — `window.Magic.*` APIs are injected by the host environment
3. **File paths are relative to app root** (the directory containing `index.html`)
4. **Using `../` to traverse parent directories is forbidden**
5. **`model` field is always required** — default to `"auto"` when no model is selected
6. **Do NOT set `maxTokens` by default** — only specify when explicitly needed
7. **Prefer tiptap JSON for messages containing file paths** — use `@file` mention nodes in `createTopicAndSend`/`sendMessage`/`setInputMessage` when referencing files
8. **Single HTML file preferred** — unless the app is genuinely multi-page
9. **Use semantic HTML** — proper structure, accessibility considerations
10. **Responsive design** — apps should work at various viewport sizes

---

## Companion Workspace Skill Generation

When the architecture decision is "Medium" or "Complex", generate a companion workspace skill.

### Format Rules (from skill-creator standards)

**Directory structure:**
```
<app-directory>/
├── index.html              (frontend)
├── data/                   (data layer — JSON files)
└── skills/
    └── <skill-name>/
        └── SKILL.md        (companion skill definition)
```

**SKILL.md format:**
```markdown
---
name: <skill_name>
description: "What this skill does. Use when [trigger condition]."
---

# <Skill Title>

[Instructions for the Agent when this skill is triggered]
```

**Naming rules:**
- Lowercase letters, digits, underscores only (no hyphens)
- Must start with a letter
- No trailing underscore; no consecutive underscores (`__`)
- Length 2–64 characters
- Name must match the directory name exactly
- Name must reflect the app's domain (e.g., `sales_analyzer`, `content_writer`)

**Content guidelines:**
- Describe what the Agent should do step-by-step when triggered
- Specify which files to read/write
- Define expected outputs
- Keep under 200 lines for companion skills (they're focused, not general-purpose)

### Validation

After generating a companion skill, if the `skill-creator` skill's `scripts/quick_validate.py` is available in the environment, run it to verify format correctness. This is optional but recommended.

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

For complex apps that drive multiple agents:

**Important rule:** When sending messages to the editor input that contain file paths, **always prefer tiptap JSON format** with `@file` mention nodes. This gives the Agent precise file context instead of relying on path string parsing.

### Pattern 1: Topic-per-Task (with file reference)
```javascript
// Create a new topic for a specific agent — use tiptap JSON for file mentions
const { topicId } = await window.Magic.project.createTopicAndSend({
  type: "doc",
  content: [{
    type: "paragraph",
    content: [
      { type: "text", text: "Analyze this sales data: " },
      { type: "mention", attrs: {
        type: "project_file",
        data: { file_id: "sales_01", file_name: "sales.csv", file_path: "data/sales.csv", file_extension: "csv" }
      }},
      { type: "text", text: " and generate a report" }
    ]
  }]
}, { agentId: "data_analysis", model: "auto" });
```

### Pattern 2: Sequential Multi-Agent Pipeline
```javascript
// Agent A does research → Agent B writes content → Agent C reviews
const agents = await window.Magic.agent.getAgents();
const researcher = agents.find(a => a.name.includes("Research"));
const writer = agents.find(a => a.name.includes("Writer"));

// Step 1: Research — use tiptap JSON to reference output file
await window.Magic.project.createTopicAndSend({
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
// Watch for research output file, then trigger writer...
```

### Pattern 3: Current-Topic Delegation
```javascript
// Ask the current agent to execute a skill by describing the task
// When the message includes file paths, prefer tiptap JSON with @file mentions
window.Magic.setInputMessage(
  "Based on data/raw.json, run the analysis workflow and write results to data/results.json"
);
```

**Choosing a pattern:**
- Single agent, current conversation → Pattern 3 (`setInputMessage`)
- Specific agent for a specific task → Pattern 1 (`createTopicAndSend`)
- Multi-step pipeline across agents → Pattern 2 (sequential topics)

---

## Output Spec

This skill generates the following artifacts:

| Artifact | Location | Always generated? |
|----------|----------|-------------------|
| Main HTML | `<app-dir>/index.html` | Yes |
| Data files | `<app-dir>/data/*.json` | If app needs persistence |
| Companion skill | `<app-dir>/skills/<name>/SKILL.md` | If Medium/Complex architecture |
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
- `data-analyzer/index.html` — upload UI, results display, watch for report
- `data-analyzer/data/` — uploaded data storage
- `data-analyzer/skills/data_analyzer/SKILL.md` — defines the analysis workflow

### Complex App (Multi-Agent)
User: "做一个内容创作工作台，能让研究员搜集资料，写手写文章，编辑审核"
→ Generate:
- `content-studio/index.html` — agent selector, task dispatch UI, status dashboard
- `content-studio/data/` — tasks, drafts, reviews
- `content-studio/skills/content_pipeline/SKILL.md` — orchestration workflow

---

## Reference Documents

Load these when you need detailed information:

- **[references/html-api-reference.md](references/html-api-reference.md)** — Complete `window.Magic.*` API signatures, parameters, return types, and constraints. **Read this before generating any HTML.**
- **[references/skill-generation-patterns.md](references/skill-generation-patterns.md)** — Companion skill templates, validation rules, and best practices.
- **[references/app-architecture-patterns.md](references/app-architecture-patterns.md)** — Detailed architecture patterns with full code examples for Simple/Medium/Complex apps.

**When to read references:**
- Before writing any HTML → always read `html-api-reference.md`
- Before generating a companion skill → read `skill-generation-patterns.md`
- For complex multi-agent apps → read `app-architecture-patterns.md`
