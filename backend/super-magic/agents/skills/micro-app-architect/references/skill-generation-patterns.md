# Companion Skill Generation Patterns

This document defines how to generate workspace skills that serve as the "backend" for micro-apps.

---

## When to Generate a Companion Skill

Generate a companion skill when:
- The app requires multi-step Agent workflows (research → analyze → generate)
- Backend logic is too complex for inline JavaScript
- The app needs to leverage Agent capabilities (web search, file processing, code execution)
- The app dispatches tasks via `createTopicAndSend()` to a new topic

Do NOT generate a companion skill when:
- All logic can be handled by `window.Magic.llm` (simple chat, summarization)
- The app only does CRUD on local files
- No Agent interaction beyond the HTML is needed

---

## Generation Approach: Delegate to skill-creator

**Do NOT manually write SKILL.md.** Instead, delegate to the `skill-creator` capability:

1. Describe the skill requirements clearly:
   - Name (lowercase + underscores, reflects app domain)
   - Purpose and trigger conditions
   - Input/output files
   - Workflow steps
2. skill-creator generates the SKILL.md with proper format, naming, and validation
3. The generated skill is placed in `.magic/<skill_name>/SKILL.md` at the workspace root

---

## Directory Structure

Companion skills are stored at the **workspace root** in `.magic/`, separate from the app directory:

```
<workspace-root>/
├── .magic/
│   └── <skill_name>/
│       ├── SKILL.md               (required — skill definition)
│       └── references/            (optional — additional docs)
│           └── *.md
└── <app-directory>/
    ├── index.html                 (frontend)
    └── data/                      (data layer)
        └── *.json
```

**Naming conventions:**

| Rule | Example |
|------|---------|
| Lowercase + underscores only | `sales_analyzer`, `content_writer` |
| Reflect the app's domain | Not `backend_skill` but `report_generator` |
| 2–64 characters | Keep it concise |
| Start with a letter | Not `123_app` |
| No hyphens, no consecutive underscores | Not `sales-analyzer`, not `sales__analyzer` |
| Name must exactly match directory name | `.magic/sales_analyzer/` → `name: sales_analyzer` |

---

## Runtime Trigger Design

The companion skill is triggered at runtime by creating a **new topic** via `createTopicAndSend`, attaching the SKILL.md as an `@file` mention, and including the user's task.

### Basic Trigger (most common)
```javascript
// HTML triggers the companion skill by creating a new topic
async function triggerSkill(userTask, selectedAgentId, selectedModel) {
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
  }, {
    agentId: selectedAgentId || undefined,  // undefined → general mode
    model: selectedModel || "auto"
  });
  return topicId;
}
```

**Key points:**
- `agentId`: undefined (不选员工) → defaults to general mode (通用模式, `topic_pattern: "general"`)
- `model`: `"auto"` unless user selects a specific model
- The skill file is attached via @file mention so the agent reads it as context/instructions
- Each invocation creates a new topic — ensures task isolation

### Trigger with Additional Context Files
```javascript
// When the skill needs to process specific data files
async function triggerWithData(userTask, dataFilePath) {
  const { topicId } = await window.Magic.project.createTopicAndSend({
    type: "doc",
    content: [{
      type: "paragraph",
      content: [
        { type: "text", text: "请阅读技能文件 " },
        { type: "mention", attrs: {
          type: "project_file",
          data: { file_id: "skill_ref", file_name: "SKILL.md", file_path: ".magic/data_analyzer/SKILL.md", file_extension: "md" }
        }},
        { type: "text", text: " 并处理以下数据文件：" },
        { type: "mention", attrs: {
          type: "project_file",
          data: { file_id: "data_ref", file_name: dataFilePath.split("/").pop(), file_path: dataFilePath, file_extension: dataFilePath.split(".").pop() }
        }},
        { type: "text", text: "\n\n" + userTask }
      ]
    }]
  }, { model: "auto" });
  return topicId;
}
```

---

## State Management

### Pattern: Status File
The skill writes a status file that the HTML watches:

```json
// data/status.json
{
  "state": "processing",
  "progress": 45,
  "message": "Analyzing records...",
  "updatedAt": 1706000000000
}
```

HTML watches this for real-time progress:
```javascript
window.Magic.fs.watchFile("data/status.json", async () => {
  const status = JSON.parse(await window.Magic.fs.readFile("data/status.json"));
  updateProgressBar(status.progress);
  updateStatusText(status.message);
});
```

### Pattern: Result File
The skill writes final results for HTML to consume:

```json
// data/results.json
{
  "success": true,
  "data": { ... },
  "updatedAt": 1706000000000
}
```

---

## UI Requirements for Skill Dispatch

When the HTML app dispatches companion skills, it **must** provide:

1. **Agent selector (员工选择器)** — populated via `getAgents()`, default: none selected (general mode)
2. **Model selector (模型选择器)** — populated via `getModels()`, default: `"auto"`
3. **Task input** — user describes what they want done

```javascript
// Initialize selectors
async function initSelectors() {
  const agents = await window.Magic.agent.getAgents();
  const models = await window.Magic.llm.getModels();
  
  // Agent selector: first item is "通用模式 (默认)" with value ""
  renderAgentSelector([{ id: "", name: "通用模式 (默认)" }, ...agents]);
  
  // Model selector: first item is "auto"
  const autoItem = { id: "auto", label: "自动选择 (推荐)" };
  renderModelSelector([autoItem, ...models]);
}
```

Selectors may be omitted only if the user explicitly specifies a fixed agent or model in the app requirements.

---

## Validation

After skill-creator generates the companion skill, verify:

1. **SKILL.md has valid frontmatter** — `name` and `description` fields present
2. **Name matches directory** — `.magic/sales_analyzer/SKILL.md` has `name: sales_analyzer`
3. **Description includes trigger conditions** — "Use when..." clause present
4. **Workflow is concrete** — step-by-step, references specific file paths
5. **Output is defined** — what files the skill writes, what format

If the `skill-creator` skill's `scripts/quick_validate.py` is available:
```bash
python <skill-creator-path>/scripts/quick_validate.py <skill-directory-path>
```

---

## Anti-Patterns

| Don't | Do |
|-------|----|
| Vague instructions ("process the data") | Specific steps ("read data/input.json, extract the 'orders' array, calculate totals per category") |
| Assume file existence | Always handle missing files gracefully |
| Write partial JSON | Write complete, valid JSON atomically |
| Forget timestamps | Include `updatedAt` for watchFile detection |
| Overly broad scope | Keep each skill focused on one workflow |
| Mix concerns | Separate data processing skill from report generation skill |
| Use `setInputMessage` to trigger skills | Use `createTopicAndSend` + @file SKILL.md |
