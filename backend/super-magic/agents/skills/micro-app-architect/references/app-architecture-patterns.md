# App Architecture Patterns

Detailed architecture patterns with full code examples for Simple, Medium, and Complex micro-apps.

---

## Pattern 1: Simple (Pure HTML)

**Characteristics:** All logic in `<script>`, no companion skill, uses `window.Magic.fs` and/or `window.Magic.llm` directly.

### Example: Interactive Data Dashboard

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sales Dashboard</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 0 auto; padding: 20px; }
    .card { background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 12px 0; }
    .metric { font-size: 2em; font-weight: bold; color: #2563eb; }
  </style>
</head>
<body>
  <h1>Sales Dashboard</h1>
  <div id="metrics"></div>
  <div id="status">Loading...</div>

  <script>
    async function loadAndRender() {
      try {
        const raw = await window.Magic.fs.readFile("data/sales.json");
        const sales = JSON.parse(raw);
        
        const total = sales.reduce((s, o) => s + o.amount, 0);
        const count = sales.length;
        const avg = count > 0 ? (total / count).toFixed(2) : 0;

        document.getElementById("metrics").innerHTML = `
          <div class="card">
            <div>Total Revenue</div>
            <div class="metric">$${total.toLocaleString()}</div>
          </div>
          <div class="card">
            <div>Orders</div>
            <div class="metric">${count}</div>
          </div>
          <div class="card">
            <div>Average Order</div>
            <div class="metric">$${avg}</div>
          </div>
        `;
        document.getElementById("status").textContent = "Last updated: " + new Date().toLocaleString();
      } catch (err) {
        document.getElementById("status").textContent = "Error: " + err.message;
      }
    }

    loadAndRender();
    // Auto-refresh when data changes
    window.Magic.fs.watchFile("data/sales.json", () => loadAndRender());
  </script>
</body>
</html>
```

**Data file (`data/sales.json`):**
```json
[
  {"id": 1, "product": "Widget A", "amount": 150, "date": "2024-01-15"},
  {"id": 2, "product": "Widget B", "amount": 230, "date": "2024-01-16"}
]
```

---

## Pattern 2: Medium (HTML + Companion Skill)

**Characteristics:** HTML handles UI, companion skill handles complex backend logic triggered by `setInputMessage()`.

### Example: AI Report Generator

**Architecture:**
```
report-generator/
├── index.html                    (upload UI, progress, results display)
├── data/
│   ├── input.json                (user-uploaded raw data)
│   ├── status.json               (processing status for progress bar)
│   └── report.json               (generated report content)
└── skills/
    └── report_writer/
        └── SKILL.md              (multi-step analysis + report generation)
```

**index.html:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AI Report Generator</title>
  <style>
    body { font-family: system-ui; max-width: 900px; margin: 0 auto; padding: 20px; }
    textarea { width: 100%; height: 150px; margin: 10px 0; }
    button { padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; }
    button:disabled { background: #94a3b8; cursor: not-allowed; }
    .progress { height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin: 10px 0; }
    .progress-bar { height: 100%; background: #2563eb; transition: width 0.3s; }
    #report { white-space: pre-wrap; background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>AI Report Generator</h1>
  
  <textarea id="data-input" placeholder="Paste your data here (CSV, JSON, or plain text)..."></textarea>
  <button id="generate-btn">Generate Report</button>
  
  <div id="progress-section" style="display:none">
    <p id="status-text">Processing...</p>
    <div class="progress"><div class="progress-bar" id="progress-bar" style="width:0%"></div></div>
  </div>
  
  <div id="report"></div>

  <script>
    const generateBtn = document.getElementById("generate-btn");
    const dataInput = document.getElementById("data-input");
    const progressSection = document.getElementById("progress-section");
    const statusText = document.getElementById("status-text");
    const progressBar = document.getElementById("progress-bar");
    const reportDiv = document.getElementById("report");

    generateBtn.addEventListener("click", async () => {
      const inputData = dataInput.value.trim();
      if (!inputData) return;

      // Save input data
      await window.Magic.fs.writeFile("data/input.json", JSON.stringify({
        content: inputData,
        requestedAt: Date.now()
      }, null, 2));

      // Initialize status
      await window.Magic.fs.writeFile("data/status.json", JSON.stringify({
        state: "queued", progress: 0, message: "Starting...", updatedAt: Date.now()
      }, null, 2));

      // Show progress, disable button
      progressSection.style.display = "block";
      generateBtn.disabled = true;

      // Trigger the companion skill
      window.Magic.setInputMessage(
        "New report request. Read data/input.json, analyze the data, and write the report to data/report.json. Update data/status.json with progress."
      );
    });

    // Watch status for progress updates
    window.Magic.fs.watchFile("data/status.json", async () => {
      try {
        const status = JSON.parse(await window.Magic.fs.readFile("data/status.json"));
        statusText.textContent = status.message;
        progressBar.style.width = status.progress + "%";
        
        if (status.state === "complete") {
          generateBtn.disabled = false;
        }
      } catch (e) { /* ignore parse errors during writes */ }
    });

    // Watch report for final results
    window.Magic.fs.watchFile("data/report.json", async () => {
      try {
        const report = JSON.parse(await window.Magic.fs.readFile("data/report.json"));
        if (report.content) {
          reportDiv.textContent = report.content;
          progressSection.style.display = "none";
        }
      } catch (e) { /* ignore */ }
    });
  </script>
</body>
</html>
```

**skills/report_writer/SKILL.md:**
```markdown
---
name: report_writer
description: "Analyzes input data and generates comprehensive reports. Use when the HTML app sends a message about generating a report from data/input.json."
---

# Report Writer

## Purpose

Reads raw data uploaded by the user, performs multi-step analysis, and generates a structured report.

## Workflow

1. Read `data/input.json` to get the raw user data
2. Update `data/status.json` with `{ state: "processing", progress: 25, message: "Analyzing data structure..." }`
3. Analyze the data: identify patterns, calculate statistics, find insights
4. Update status to `{ progress: 50, message: "Generating insights..." }`
5. Write a comprehensive report combining analysis and recommendations
6. Update status to `{ progress: 75, message: "Formatting report..." }`
7. Write final report to `data/report.json`:
   ```json
   {
     "content": "<full report text>",
     "summary": "<2-3 sentence summary>",
     "generatedAt": <timestamp>,
     "updatedAt": <timestamp>
   }
   ```
8. Update status to `{ state: "complete", progress: 100, message: "Report ready" }`

## Constraints

- Always include `updatedAt` in written files
- Report should be well-structured with sections
- Handle edge cases: empty data, malformed input
- Do not write partial JSON — complete the full object before writing
```

---

## Pattern 3: Complex (Multi-Agent Orchestration)

**Characteristics:** HTML acts as a control panel dispatching tasks to different agents, tracking multiple concurrent workflows.

### Example: Content Creation Studio

**Architecture:**
```
content-studio/
├── index.html                    (control panel: task creation, agent dispatch, status)
├── data/
│   ├── tasks.json                (task queue with status per task)
│   ├── agents.json               (cached agent list)
│   └── outputs/
│       ├── task-001-research.md
│       └── task-001-draft.md
└── skills/
    └── content_pipeline/
        └── SKILL.md              (orchestration: assign tasks to agents)
```

**Key HTML patterns for multi-agent:**

```javascript
// 1. Discover available agents on load
async function loadAgents() {
  const agents = await window.Magic.agent.getAgents();
  await window.Magic.fs.writeFile("data/agents.json", JSON.stringify(agents, null, 2));
  renderAgentSelector(agents);
}

// 2. Dispatch task to specific agent via new topic (use tiptap JSON for file references)
async function dispatchToAgent(agentId, taskDescription, taskId) {
  // Update task status
  const tasks = JSON.parse(await window.Magic.fs.readFile("data/tasks.json"));
  const task = tasks.find(t => t.id === taskId);
  task.status = "dispatched";
  task.assignedTo = agentId;
  task.dispatchedAt = Date.now();
  await window.Magic.fs.writeFile("data/tasks.json", JSON.stringify(tasks, null, 2));

  // Create topic and send to the specific agent (tiptap JSON preferred for file paths)
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
  }, { agentId: agentId, model: "auto" });

  // Store topic ID for tracking
  task.topicId = topicId;
  await window.Magic.fs.writeFile("data/tasks.json", JSON.stringify(tasks, null, 2));
}

// 3. Monitor outputs via watchFile
async function watchTaskOutputs() {
  const tasks = JSON.parse(await window.Magic.fs.readFile("data/tasks.json"));
  for (const task of tasks.filter(t => t.status === "dispatched")) {
    const outputPath = `data/outputs/task-${task.id}-result.md`;
    window.Magic.fs.watchFile(outputPath, async () => {
      const content = await window.Magic.fs.readFile(outputPath);
      task.status = "complete";
      task.result = content;
      task.completedAt = Date.now();
      const allTasks = JSON.parse(await window.Magic.fs.readFile("data/tasks.json"));
      const idx = allTasks.findIndex(t => t.id === task.id);
      allTasks[idx] = task;
      await window.Magic.fs.writeFile("data/tasks.json", JSON.stringify(allTasks, null, 2));
      renderTaskList(allTasks);
    });
  }
}

// 4. Pipeline: chain multiple agents sequentially
async function runPipeline(topic, steps) {
  // steps = [{ agentId, prompt_template }, ...]
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const prevOutput = i > 0 
      ? await window.Magic.fs.readFile(`data/outputs/pipeline-step-${i-1}.md`)
      : "";
    
    const prompt = step.prompt_template.replace("{{previous_output}}", prevOutput);
    
    await window.Magic.project.createTopicAndSend({
      type: "doc",
      content: [{
        type: "paragraph",
        content: [
          { type: "text", text: prompt + "\n\nWrite output to: " },
          { type: "mention", attrs: {
            type: "project_file",
            data: { file_id: `step_${i}`, file_name: `pipeline-step-${i}.md`, file_path: `data/outputs/pipeline-step-${i}.md`, file_extension: "md" }
          }}
        ]
      }]
    }, { agentId: step.agentId, model: "auto" });
    
    // Wait for output (poll via watchFile)
    await waitForFile(`data/outputs/pipeline-step-${i}.md`);
  }
}

// Helper: wait for a file to appear/update
function waitForFile(path) {
  return new Promise((resolve) => {
    const check = async () => {
      try {
        await window.Magic.fs.readFile(path);
        resolve();
      } catch {
        // File doesn't exist yet, watchFile will catch it
      }
    };
    const unwatch = window.Magic.fs.watchFile(path, () => {
      unwatch();
      resolve();
    });
    check(); // Check immediately in case file already exists
  });
}
```

**data/tasks.json schema:**
```json
[
  {
    "id": "task-001",
    "title": "Research AI trends 2024",
    "description": "Find the latest AI trends and summarize key developments",
    "status": "complete",
    "assignedTo": "research_agent",
    "topicId": "topic_abc123",
    "createdAt": 1706000000000,
    "dispatchedAt": 1706000001000,
    "completedAt": 1706000060000,
    "result": "..."
  }
]
```

---

## Pattern Selection Cheat Sheet

| User Request | Pattern | Key APIs Used |
|--------------|---------|---------------|
| "做一个计算器" | Simple | (no Magic API needed, pure JS) |
| "做一个 todolist" | Simple | `fs.readFile`, `fs.writeFile` |
| "做一个 AI 聊天界面" | Simple | `llm.stream`, `llm.getModels` |
| "做一个数据分析工具" | Medium | `fs.*`, `setInputMessage`, companion skill |
| "做一个自动化报告生成器" | Medium | `fs.*`, `setInputMessage`, `llm.*`, companion skill |
| "做一个多人协作的内容工作台" | Complex | `project.createTopicAndSend`, `agent.getAgents`, `fs.watchFile` |
| "做一个项目管理系统，自动分配任务给不同员工" | Complex | Full API suite + multiple companion skills |

---

## Data Initialization

Always create initial data files when generating the app:

```javascript
// In the HTML, initialize data on first load
async function initializeData() {
  try {
    await window.Magic.fs.readFile("data/config.json");
    // Already initialized
  } catch {
    // First run — create default data
    await window.Magic.fs.writeFile("data/config.json", JSON.stringify({
      appName: "My App",
      version: "1.0.0",
      createdAt: Date.now()
    }, null, 2));
    await window.Magic.fs.writeFile("data/items.json", "[]");
  }
}
```

Or generate the initial data files alongside the HTML:
```
app-dir/
├── index.html
└── data/
    ├── config.json      ← generated with defaults
    └── items.json       ← generated as empty array []
```

---

## Responsive Design Template

Base template for all micro-apps:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App Name</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      line-height: 1.6; color: #1a1a1a; background: #ffffff;
      max-width: 1200px; margin: 0 auto; padding: 16px;
    }
    @media (max-width: 768px) { body { padding: 12px; } }
    
    /* Utility classes */
    .card { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 16px; margin: 12px 0; }
    .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .btn-primary { background: #2563eb; color: white; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  </style>
</head>
<body>
  <header><h1>App Name</h1></header>
  <main id="app">
    <!-- App content here -->
  </main>
  <script>
    // App logic here
  </script>
</body>
</html>
```
