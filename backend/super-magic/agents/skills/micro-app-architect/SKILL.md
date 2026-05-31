---
name: micro-app-architect
description: "Micro-app architecture and full-stack generation. Decomposes requirements into HTML frontend + workspace skill backend + file-based data layer, generates all artifacts. Use when user wants to build ANY app, system, tool, page, or interactive experience running as HTML — regardless of domain or complexity. Also use when user wants to transform/renovate an existing HTML file into a micro-app (e.g. 'put this HTML into the app framework', 'add Magic API to this page', 'convert this to a micro-app', '把这个HTML改造成应用', '给这个页面接入Magic API'). Also use when user wants to modify, update, fix, or add features to an existing micro-app (e.g. 'modify the XX feature', 'update the dashboard', 'fix the bug in XX app', 'add a new button to XX', '修改XX功能', '更新XX应用', '给XX加个功能', '调整XX页面', '优化XX', '修复XX的bug'). Also for agent-driven backend, multi-agent collaboration, or complex workflows. Covers: requirement decomposition, architecture design (Simple/Medium/Complex), companion skill creation, data schema, multi-agent dispatch, and change management for existing apps. Triggers: 'make an app', 'build a tool', 'create a system', 'create a dashboard', 'make an HTML app', 'develop a micro-app', 'convert this HTML', 'renovate this page', 'modify feature', 'update app', 'fix app', 'change functionality', 'add feature', '做一个应用', '做一个系统', '做一个工具', '做一个页面', '创建HTML微应用', '开发网页工具', '数据看板', '交互式页面', '改造成应用', '接入Magic API', '修改功能', '更新应用', '修改XX功能', '给XX加功能', '调整功能', '优化功能', '修复bug', '改一下', '增加功能', '删除功能'."
---

# Micro-App Architect

You are a micro-app architect. Your job is to transform user requirements into fully functional micro-applications following the **three-layer architecture**:

| Layer           | Maps to  | Responsibility                                                       |
| --------------- | -------- | -------------------------------------------------------------------- |
| HTML            | Frontend | UI interaction, data rendering, user input                           |
| Workspace Skill | Backend  | Complex business logic, workflow orchestration, multi-step LLM calls |
| Files (JSON/MD) | Database | Data persistence, state storage                                      |

**Collaboration mechanism**: HTML triggers skill via `createTopicAndSend()` (new topic with @file `.magic/skills/<name>/SKILL.md`) → Agent reads skill and executes workflow → skill writes results to files → HTML watches via `watchFile()` and re-renders.

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
   ├─ Medium → HTML + companion workspace skill(s)
   └─ Complex → HTML + multiple skills + multi-agent dispatch

3. Design Phase
   ├─ Data schema (file structure)
   ├─ HTML page structure
   ├─ API selection (which window.Magic.* APIs)
   └─ Companion skill scope (if needed)

4. ⭐ Design Review (output to user for confirmation)
   ├─ Product feature checklist (功能清单)
   ├─ Interaction flow (交互流程)
   ├─ Companion skill list + purpose (if any)
   ├─ Directory structure plan
   └─ Wait for user confirmation before proceeding

5. Generation Phase
   ├─ Generate magic.project.js (project manifest, always first)
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

- The requirement is a single vague sentence (e.g. "做一个管理系统") without specifying what to manage, what fields, what workflows
- Key functional scope is unclear — you cannot determine the feature list or data model confidently
- Interaction flow is ambiguous — unclear whether the user wants a simple CRUD or a complex multi-step pipeline
- Target audience or usage scenario is not specified and would significantly affect the design

**Do NOT over-ask** — if the requirement is clear enough to decompose (e.g. "做一个待办事项应用，支持添加、完成、删除"), proceed directly. Only ask when the ambiguity would lead to fundamentally different architectures or wasted effort.

### Design Review (Step 4)

Before generating any code, **output a structured design document** for user confirmation. Format:

```markdown
## 产品设计确认

### 功能清单

1. [功能名称] — 简要描述
2. [功能名称] — 简要描述
   ...

### 交互流程

[主要用户操作路径，用简明的步骤或流程图描述]

### 技术方案

- 架构类型: Simple / Medium / Complex
- 目录结构: (列出主要文件)
- 伴生技能: (如有)
  - `.magic/skills/<name>/SKILL.md` — 作用说明
  - `.magic/skills/<name2>/SKILL.md` — 作用说明

### 确认项

- [ ] 功能范围是否正确？
- [ ] 是否有遗漏的功能？
- [ ] 交互流程是否符合预期？
```

**Rules:**

- Simple apps with clear requirements (e.g. "做一个计算器") can skip detailed review — just briefly confirm the plan
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

**Medium vs Complex:** Both can have multiple skills. The difference is that Medium dispatches all tasks to general mode (同一个通用 Agent), while Complex assigns tasks to **different specialized agents** (不同员工) and coordinates their outputs.

---

## API Capabilities Overview

The HTML layer has access to `window.Magic.*` APIs (pre-injected, no imports needed):

| Namespace                     | Key Methods                                                                              | Purpose                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `window.Magic.fs`             | `readFile`, `writeFile`, `listFiles`, `watchFile`                                        | File read/write/watch (paths relative to app root) |
| `window.Magic.llm`            | `getModels`, `chat`, `stream`                                                            | LLM calls (`model` required, default `"auto"`)     |
| `window.Magic.agent`          | `getAgents`                                                                              | Discover available agents                          |
| `window.Magic.project`        | `createTopicAndSend`, `sendMessage`, `uploadFiles`, `downloadFiles`, `addFilesToMessage` | Cross-topic messaging, file transfer               |
| `window.Magic.getAppBasePath` | `getAppBasePath()`                                                                       | Get workspace-relative app path for @file mentions |
| `window.Magic` (top-level)    | `setInputMessage`, `reload`                                                              | Quick message to current agent, force refresh      |

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
    - **Complex tasks** (long documents, multi-step analysis, cross-file reasoning, structured report generation, tasks needing tool use): strongly prefer the topic + skill pattern — (1) save file to workspace via `writeFile`/`uploadFiles`, (2) `createTopicAndSend` with `@file` mentions + `@skill` or `@file .magic/skills/SKILL.md`. The agent has longer context, file parsing tools, and can orchestrate multi-step workflows. HTML app handles UI only (file picker, progress, result display) and watches output via `watchFile`.

---

## Companion Workspace Skill Generation

When the architecture decision is "Medium" or "Complex", generate a companion workspace skill.

### Generation Approach

**始终使用 `skill-creator` 技能来创建伴生技能。** 不要手动编写 SKILL.md。调用 `skill-creator` 时提供以下信息：

- 技能名称（小写 + 下划线，反映应用领域）
- 技能功能的清晰描述
- 预期的输入/输出文件
- 工作流步骤

`skill-creator` 会自动处理格式校验、命名规则、目录放置和最佳实践。

### Runtime Trigger Mechanism

The companion skill is **not** auto-loaded. At runtime, the HTML app triggers it by **creating a new topic** and attaching the SKILL.md as context:

```javascript
// Get workspace-relative base path for file mentions
const basePath = await window.Magic.getAppBasePath(); // e.g. "个人财务记账/"

// Trigger companion skill via new topic with @file mentions
const { topicId } = await window.Magic.project.createTopicAndSend(
  {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "请阅读以下技能文件并按照其中的指引执行任务：",
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
          { type: "text", text: "\n\n数据文件：" },
          {
            type: "mention",
            attrs: {
              type: "project_file",
              data: {
                file_id: "data_ref",
                file_name: "records.json",
                file_path: basePath + "data/records.json",
                file_extension: "json",
              },
            },
          },
          { type: "text", text: "\n\n用户任务：" + userTaskDescription },
        ],
      },
    ],
  },
  { model: "auto" },
);
// Note: no agentId → defaults to general mode (topic_pattern: "general")
```

**Key points:**

- Do NOT pass `agentId` — defaults to general mode (通用模式)
- Model: always `"auto"` unless user selects otherwise
- Message format: tiptap JSON with @file mention of `.magic/skills/<name>/SKILL.md` + user task text
- **Path rules for mentions**: `.magic/` paths stay as-is (already at workspace root); app data file paths must be prefixed with `basePath` from `getAppBasePath()`
- Each skill invocation creates a **new topic** for isolation

### Invoking Built-in System Skills (`@skill` mention)

内置系统技能（如网页搜索、代码执行等）通过 `@skill` mention 调用，与生成的伴生技能使用 `@file` mention 引用 SKILL.md 文件不同。

**两种技能调用方式对比：**

| 类型 | mention type | 数据结构 | 适用场景 |
|------|-------------|----------|----------|
| 生成的伴生技能 | `project_file` | `{file_id, file_name, file_path, file_extension}` | 自定义工作流 |
| 内置系统技能 | `skill` | `{id, name, icon, description, mention_source}` | 平台预注册的能力 |

**`@skill` mention 结构：**

```javascript
{
  type: "mention",
  attrs: {
    type: "skill",       // ← 注意：不是 "project_file"
    data: {
      id: "skill_unique_id",         // 平台分配的技能 ID（必填）
      name: "网页搜索",               // 技能显示名称（必填）
      icon: "https://...",           // 技能图标 URL（必填）
      description: "搜索互联网获取信息", // 技能描述（必填）
      mention_source: "system",      // 可选: "system" | "agent" | "mine"
    },
  },
}
```

**`mention_source` 说明：**

| 值 | 含义 |
|-----|------|
| `"system"` | 系统内置技能（平台默认提供） |
| `"agent"` | 绑定在某个员工上的技能 |
| `"mine"` | 用户自己的技能库（my_library） |

**调用示例 — 在消息中引用系统技能：**

```javascript
// 创建话题并发送消息，附带 @skill 引用让 Agent 使用指定技能
const { topicId } = await window.Magic.project.createTopicAndSend(
  {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "请使用 " },
          {
            type: "mention",
            attrs: {
              type: "skill",
              data: {
                id: "web_search_001",
                name: "网页搜索",
                icon: "https://example.com/icons/search.svg",
                description: "搜索互联网获取最新信息",
                mention_source: "system",
              },
            },
          },
          { type: "text", text: " 查找最新的AI行业报告，并将结果整理写入 " },
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
  { model: "auto" },
);
```

**何时使用 `@skill` vs `@file` SKILL.md：**

- 需要调用平台已注册的标准能力（搜索、代码执行等）→ `@skill` mention
- 需要执行自定义的多步骤工作流（数据分析管道、报告生成等）→ `@file` mention 指向 `.magic/skills/<name>/SKILL.md`
- 两者可以组合使用 — 在同一条消息中同时引用系统技能和伴生技能文件

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

### Built-in Agent IDs

| agentId | 名称 | 说明 |
|---------|------|------|
| `general` | 通用模式 | 适用于各种通用场景的智能助手（默认，不传 agentId 即使用此模式） |
| `chat` | 聊天模式 | 专注于对话交流的智能助手 |
| `data_analysis` | 数据分析 | 专业的数据分析和处理助手 |
| `ppt` | PPT | 专业的PPT制作和演示助手 |
| `summary` | 录音总结 | 专业的录音内容总结助手 |

> 注：除内置 agentId 外，也可以通过 `window.Magic.agent.getAgents()` 获取用户自定义的员工（Agent）列表，使用其 `id` 字段作为 `agentId`。

### Agent Selector UI Pattern

当用户需要调用自定义员工时，应在界面上提供**员工选择器**，并支持通过名称匹配默认选中。实现要点：

```javascript
// 1. 加载员工列表并渲染选择器
async function initAgentSelector(defaultAgentName) {
  const agents = await window.Magic.agent.getAgents();

  // 2. 通过名称模糊匹配默认选中
  let selectedAgent = null;
  if (defaultAgentName) {
    selectedAgent = agents.find(
      (a) => a.name === defaultAgentName || a.name.includes(defaultAgentName)
    );
  }

  // 3. 渲染选择器 UI
  const selector = document.getElementById("agent-selector");
  selector.innerHTML = `<option value="">通用模式（不选员工）</option>`;
  agents.forEach((agent) => {
    const selected = selectedAgent && agent.id === selectedAgent.id ? "selected" : "";
    selector.innerHTML += `<option value="${agent.id}" ${selected}>${agent.name}</option>`;
  });
}

// 4. 派发任务时读取选中的 agentId
function getSelectedAgentId() {
  const selector = document.getElementById("agent-selector");
  return selector.value || undefined; // 空值 → 通用模式
}

// 5. 调用时传入
const { topicId } = await window.Magic.project.createTopicAndSend(
  tiptapMessage,
  { agentId: getSelectedAgentId(), model: getSelectedModel() }
);
```

**规则：**

- 选择器默认选项为"通用模式"（不传 agentId）
- 如果用户在需求中指定了员工名称（如"让研究员去搜集资料"），通过 `name.includes()` 模糊匹配并默认选中
- 选择器应同时提供**模型选择器**（默认 `"auto"`）
- 当 `agentId` 为空或未选择时，不传该字段（等同于通用模式）

### Pattern 1: Skill Dispatch via New Topic (Primary Pattern)

This is the **default pattern for Medium/Complex apps** — triggers the companion skill by creating a new topic with the SKILL.md attached as context:

```javascript
// Trigger companion skill: create new topic, attach SKILL.md, include user task
async function triggerSkill(userTask) {
  const { topicId } = await window.Magic.project.createTopicAndSend(
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "请阅读以下技能文件并按照其中的指引执行任务：",
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
            { type: "text", text: "\n\n用户任务：" + userTask },
          ],
        },
      ],
    },
    { model: "auto" },
  );
  // No agentId → general mode (通用模式)
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
  { agentId: researcher.id, model: "auto" },
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
        { type: "text", text: "请阅读技能文件 " },
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
        { type: "text", text: " 并执行：" },
      );
    }

    await window.Magic.project.createTopicAndSend(
      {
        type: "doc",
        content: [{ type: "paragraph", content }],
      },
      { agentId: step.agentId, model: "auto" },
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

- Triggering a companion skill → **Pattern 1** (`createTopicAndSend` + @file SKILL.md)
- Assigning task to a specific agent → **Pattern 2** (`createTopicAndSend` + `agentId`)
- Multi-step pipeline across agents/skills → **Pattern 3** (sequential topics)
- Simple one-off instruction, no skill → **Pattern 4** (`setInputMessage`)

---

## Output Spec

This skill generates the following artifacts:

| Artifact         | Location                     | Always generated?              |
| ---------------- | ---------------------------- | ------------------------------ |
| magic.project.js | `<app-dir>/magic.project.js` | Yes                            |
| Main HTML        | `<app-dir>/index.html`       | Yes                            |
| Data files       | `<app-dir>/data/*.json`      | If app needs persistence       |
| Companion skill  | 由 `skill-creator` 技能创建  | If Medium/Complex architecture |
| README           | `<app-dir>/README.md`        | For Medium/Complex apps        |

**Naming the app directory:** Use the user's language for the directory name. If the user says "做一个销售看板", the directory should be named descriptively (e.g., `销售看板/` or `sales-dashboard/`).

### magic.project.js (Project Manifest)

Every micro-app **must** include a `magic.project.js` file in the app root directory. This file tells the frontend to treat the folder as a Magic Project — clicking the folder icon directly opens `index.html` instead of expanding the file tree.

**Format:** JSONP (not plain JSON). Use this exact template:

```javascript
window.magicProjectConfig = {
  version: "1.0.0",
  type: "micro-app",
  name: "<app display name>",
};

window.magicProjectConfigure(window.magicProjectConfig);
```

**Rules:**

- `type` must be `"micro-app"` — this enables the micro-app icon and click-to-open behavior
- `name` should be user-friendly (e.g., `"销售看板"`, `"Task Manager"`)
- Always include the `window.magicProjectConfigure(...)` call at the end
- Generate this file **before** `index.html` so the frontend recognizes the project immediately

**Optional: Custom Icon (`icon` field)**

You can provide a custom icon for the app folder by adding an `icon` field to `magic.project.js`. The value can be:

- A relative path (relative to the app root) pointing to an SVG, PNG, or any image file you generate alongside the app
- A `data:` URL (inline base64 image) for self-contained manifests
- An `https://` URL for remote images

```javascript
window.magicProjectConfig = {
  version: "1.0.0",
  type: "micro-app",
  name: "销售看板",
  icon: "icon.svg",          // relative path to an SVG in the same directory
};

window.magicProjectConfigure(window.magicProjectConfig);
```

**When to use a custom icon:**

- For business/domain apps where a unique icon adds context (e.g., a chart icon for a dashboard, a calendar icon for a scheduler)
- When the user explicitly asks for a custom icon
- For apps that will be shared or presented — a custom icon makes them easier to identify

**How to generate an icon:**

Use `write_file` to create a simple SVG in the app directory (e.g., `icon.svg`), then reference it in `magic.project.js`. Example SVG for a sales dashboard:

```svg
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- design a clean, recognizable icon that reflects the app's purpose -->
</svg>
```

Keep SVG icons at 24×24, use flat/modern style with 2–3 colors, and ensure the design reflects the app's core function.

---

## Documentation & Change Management

### README.md Structure

For Medium/Complex apps, generate a `README.md` in the app directory documenting:

```markdown
# [App Name]

## 功能说明

- 功能1: 描述
- 功能2: 描述

## 目录结构
```

app-dir/
├── magic.project.js
├── index.html
├── data/
│ └── ...
└── ...

```

## 伴生技能
| 技能 | 路径 | 作用 |
|------|------|------|
| [name] | `.magic/skills/[name]/SKILL.md` | 描述 |

## 交互流程
[主要操作流程说明]

## 变更记录
| 日期 | 变更内容 |
|------|----------|
| YYYY-MM-DD | 初始版本 |
```

### Change Management Rules

When user requests feature changes to an existing micro-app:

1. **Identify scope** — determine which files/skills are affected
2. **Update README.md** — add entry to 变更记录, update 功能说明 if features changed
3. **Update companion skills** — if workflow logic changes, regenerate or edit the relevant SKILL.md
4. **Update data schema** — if data model changes, migrate existing data files
5. **Notify user** — summarize what was changed and what was preserved

---

## Quick Start Examples

### Simple App (Pure HTML)

User: "做一个计算器"
→ Generate `calculator/magic.project.js` + `calculator/index.html` with all logic in `<script>`, no companion skill needed.

### Medium App (HTML + Skill)

User: "做一个能自动分析CSV数据并生成报告的工具"
→ Generate:

- `data-analyzer/magic.project.js` — project manifest (`type: "micro-app"`)
- `data-analyzer/index.html` — upload UI, results display, watch for report, agent/model selector
- `data-analyzer/data/` — uploaded data storage
- 通过 `skill-creator` 创建 `data_analyzer` 伴生技能，定义分析工作流

Runtime: HTML 通过 @file mention 引用伴生技能 → `createTopicAndSend` → general mode agent 读取技能并执行

### Complex App (Multi-Agent)

User: "做一个内容创作工作台，能让研究员搜集资料，写手写文章，编辑审核"
→ Generate:

- `content-studio/magic.project.js` — project manifest (`type: "micro-app"`)
- `content-studio/index.html` — agent selector, model selector, task dispatch UI, status dashboard
- `content-studio/data/` — tasks, drafts, reviews
- 通过 `skill-creator` 创建 `content_pipeline` 伴生技能，定义编排工作流

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
