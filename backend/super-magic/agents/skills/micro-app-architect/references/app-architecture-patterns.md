# App Architecture Patterns

Condensed architecture patterns for Simple, Medium, and Complex micro-apps. Focus on directory structure, key code patterns, and decision criteria.

---

## Pattern 1: Simple (Pure HTML)

**Characteristics:** All logic in `<script>`, no companion skill, uses `window.Magic.fs` and/or `window.Magic.llm` directly.

**Directory structure:**
```
<app-directory>/
├── index.html          (all UI + logic)
└── data/
    └── *.json          (optional persistence)
```

**Key code pattern:**
```javascript
// Load data + auto-refresh on change
async function loadAndRender() {
  const raw = await window.Magic.fs.readFile("data/sales.json");
  const sales = JSON.parse(raw);
  // ... render to DOM
}

loadAndRender();
window.Magic.fs.watchFile("data/sales.json", () => loadAndRender());
```

---

## Pattern 2: Medium (HTML + Companion Skill)

**Characteristics:** HTML handles UI, companion skill handles complex backend logic triggered via `createTopicAndSend()` (new topic + @file SKILL.md).

**Directory structure:**
```
<workspace-root>/
├── .magic/
│   └── skills/
│       └── report_writer/
│           └── SKILL.md          (multi-step analysis + report generation)
└── report-generator/
    ├── index.html                (upload UI, progress, results display, agent/model selector)
    └── data/
        ├── input.json            (user-uploaded raw data)
        ├── status.json           (processing status for progress bar)
        └── report.json           (generated report content)
```

**Key code pattern — trigger skill + watch progress:**
```javascript
// Trigger companion skill via new topic
generateBtn.addEventListener("click", async () => {
  // 1. Save input data
  await window.Magic.fs.writeFile("data/input.json", JSON.stringify({
    content: inputData, requestedAt: Date.now()
  }, null, 2));

  // 2. Initialize status
  await window.Magic.fs.writeFile("data/status.json", JSON.stringify({
    state: "queued", progress: 0, message: "Starting...", updatedAt: Date.now()
  }, null, 2));

  // 3. Trigger skill (createTopicAndSend + @file SKILL.md)
  const agentId = document.getElementById("agent-select").value || undefined;
  const model = document.getElementById("model-select").value || "auto";

  await window.Magic.project.createTopicAndSend({
    type: "doc",
    content: [{
      type: "paragraph",
      content: [
        { type: "text", text: "请阅读以下技能文件并按照其中的指引执行任务：" },
        { type: "mention", attrs: {
          type: "project_file",
          data: { file_id: "skill_ref", file_name: "SKILL.md", file_path: ".magic/skills/report_writer/SKILL.md", file_extension: "md" }
        }},
        { type: "text", text: "\n\n用户任务：分析 data/input.json 中的数据，生成报告写入 data/report.json" }
      ]
    }]
  }, { agentId, model });
});

// Watch status for progress updates
window.Magic.fs.watchFile("data/status.json", async () => {
  const status = JSON.parse(await window.Magic.fs.readFile("data/status.json"));
  statusText.textContent = status.message;
  progressBar.style.width = status.progress + "%";
  if (status.state === "complete") generateBtn.disabled = false;
});

// Watch report for final results
window.Magic.fs.watchFile("data/report.json", async () => {
  const report = JSON.parse(await window.Magic.fs.readFile("data/report.json"));
  if (report.content) reportDiv.textContent = report.content;
});
```

**Companion skill structure** (generated via skill-creator):
```yaml
---
name: report_writer
description: "Analyzes input data and generates comprehensive reports."
---
```
Workflow: read input → update status (25%) → analyze → update (50%) → generate report → update (75%) → write result → complete (100%).

---

## Pattern 3: Complex (Multi-Agent Orchestration)

**Characteristics:** HTML acts as a control panel dispatching tasks to different agents, tracking multiple concurrent workflows.

**Directory structure:**
```
<workspace-root>/
├── .magic/
│   └── content_pipeline/
│       └── SKILL.md              (orchestration: assign tasks to agents)
└── content-studio/
    ├── index.html                (control panel: task creation, agent/model selector, status)
    └── data/
        ├── tasks.json            (task queue with status per task)
        ├── agents.json           (cached agent list)
        └── outputs/
            ├── task-001-research.md
            └── task-001-draft.md
```

**Key code patterns:**

```javascript
// 1. Discover available agents on load
async function loadAgents() {
  const agents = await window.Magic.agent.getAgents();
  await window.Magic.fs.writeFile("data/agents.json", JSON.stringify(agents, null, 2));
  renderAgentSelector(agents);
}

// 2. Dispatch task to specific agent
async function dispatchToAgent(agentId, taskDescription, taskId) {
  const outputPath = `data/outputs/task-${taskId}-result.md`;
  const { topicId } = await window.Magic.project.createTopicAndSend({
    type: "doc",
    content: [{
      type: "paragraph",
      content: [
        { type: "text", text: taskDescription + "\n\nWrite results to: " },
        { type: "mention", attrs: {
          type: "project_file",
          data: { file_id: `task_${taskId}`, file_name: `task-${taskId}-result.md`, file_path: outputPath, file_extension: "md" }
        }}
      ]
    }]
  }, { agentId, model: "auto" });
  return topicId;
}

// 3. Sequential pipeline across agents
async function runPipeline(steps) {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    await window.Magic.project.createTopicAndSend({
      type: "doc",
      content: [{ type: "paragraph", content: [
        { type: "text", text: step.prompt + "\n\nWrite output to: " },
        { type: "mention", attrs: {
          type: "project_file",
          data: { file_id: `step_${i}`, file_name: `pipeline-step-${i}.md`, file_path: `data/outputs/pipeline-step-${i}.md`, file_extension: "md" }
        }}
      ]}]
    }, { agentId: step.agentId, model: "auto" });
    await waitForFile(`data/outputs/pipeline-step-${i}.md`);
  }
}

// 4. Wait for file helper
function waitForFile(path) {
  return new Promise((resolve) => {
    const unwatch = window.Magic.fs.watchFile(path, () => { unwatch(); resolve(); });
    window.Magic.fs.readFile(path).then(resolve).catch(() => {});
  });
}
```

**tasks.json schema:**
```json
[{
  "id": "task-001",
  "title": "Research AI trends",
  "status": "complete",
  "assignedTo": "research_agent",
  "topicId": "topic_abc123",
  "createdAt": 1706000000000,
  "completedAt": 1706000060000
}]
```

---

## Pattern Selection Cheat Sheet

| User Request | Pattern | Key APIs Used |
|--------------|---------|---------------|
| "做一个计算器" | Simple | (pure JS, no Magic API) |
| "做一个 todolist" | Simple | `fs.readFile`, `fs.writeFile` |
| "做一个 AI 聊天界面" | Simple | `llm.stream`, `llm.getModels` |
| "做一个数据分析工具" | Medium | `fs.*`, `createTopicAndSend` + @file skill |
| "做一个自动化报告生成器" | Medium | `fs.*`, `createTopicAndSend`, companion skill |
| "做一个多人协作的内容工作台" | Complex | `createTopicAndSend`, `getAgents`, `watchFile` |
| "做一个项目管理系统，自动分配任务给不同员工" | Complex | Full API suite + multiple companion skills |

---

## Data Initialization

Always create initial data files when generating the app:

```javascript
async function initializeData() {
  try {
    await window.Magic.fs.readFile("data/config.json");
  } catch {
    await window.Magic.fs.writeFile("data/config.json", JSON.stringify({
      appName: "My App", version: "1.0.0", createdAt: Date.now()
    }, null, 2));
    await window.Magic.fs.writeFile("data/items.json", "[]");
  }
}
```

Or generate initial data files alongside the HTML:
```
app-dir/
├── index.html
└── data/
    ├── config.json      ← generated with defaults
    └── items.json       ← generated as empty array []
```
