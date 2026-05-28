# Companion Skill Generation Patterns

This document defines how to generate workspace skills that serve as the "backend" for micro-apps.

---

## When to Generate a Companion Skill

Generate a companion skill when:
- The app requires multi-step Agent workflows (research → analyze → generate)
- Backend logic is too complex for inline JavaScript
- The app needs to leverage Agent capabilities (web search, file processing, code execution)
- The app dispatches tasks to the current Agent via `setInputMessage()`

Do NOT generate a companion skill when:
- All logic can be handled by `window.Magic.llm` (simple chat, summarization)
- The app only does CRUD on local files
- No Agent interaction beyond the HTML is needed

---

## Directory Structure

```
<app-directory>/
├── index.html                     (frontend)
├── data/                          (data layer)
│   └── *.json
└── skills/
    └── <skill_name>/
        ├── SKILL.md               (required — skill definition)
        └── references/            (optional — additional docs)
            └── *.md
```

---

## SKILL.md Template

```markdown
---
name: <skill_name>
description: "<Capability summary>. Use when <trigger condition — what the HTML app will ask for>. Also use when user says '<example trigger phrases>'."
---

# <Skill Title>

## Purpose

<1-2 sentences: what this skill enables the Agent to do when triggered by the micro-app>

## Input

The HTML frontend triggers this skill by sending a message via `setInputMessage()`.

**Expected message format:**
<describe what the HTML will send — could be a command string, JSON instruction, etc.>

## Workflow

<Step-by-step instructions for the Agent:>

1. Read input data from `data/<input-file>.json`
2. Process/analyze/generate based on the input
3. Write results to `data/<output-file>.json`
4. (Optional) Write human-readable output to `output/<name>.md`

## Output

| File | Format | Description |
|------|--------|-------------|
| `data/results.json` | JSON | Structured results for HTML to render |
| `output/report.md` | Markdown | Human-readable report (optional) |

## Constraints

- Always read the latest data from files before processing
- Write results atomically (complete JSON, not partial)
- Include `updatedAt` timestamp in output files for watchFile to detect changes
- Do not modify files outside the app directory
```

---

## Naming Conventions

| Rule | Example |
|------|---------|  
| Lowercase + underscores only | `sales_analyzer`, `content_writer` |
| Reflect the app's domain | Not `backend_skill` but `report_generator` |
| 2–64 characters | Keep it concise |
| Start with a letter | Not `123_app` |
| No hyphens, no consecutive underscores | Not `sales-analyzer`, not `sales__analyzer` |
| Name must exactly match directory name | `skills/sales_analyzer/` → `name: sales_analyzer` |

---

## Trigger Design

The companion skill is triggered when the HTML sends a message via `setInputMessage()`. Design the trigger carefully:

### Simple Trigger (single action)
```javascript
// HTML side — plain text is fine when no file paths are referenced
window.Magic.setInputMessage("Please analyze the sales data and write results to the output file");
```

### Structured Trigger with File References (prefer tiptap JSON)
```javascript
// When the message references specific file paths, use tiptap JSON with @file mentions
await window.Magic.project.sendMessage({
  type: "doc",
  content: [{
    type: "paragraph",
    content: [
      { type: "text", text: "Please analyze " },
      { type: "mention", attrs: {
        type: "project_file",
        data: { file_id: "sales_001", file_name: "sales.json", file_path: "data/sales.json", file_extension: "json" }
      }},
      { type: "text", text: " and write results to " },
      { type: "mention", attrs: {
        type: "project_file",
        data: { file_id: "analysis_001", file_name: "analysis.json", file_path: "data/analysis.json", file_extension: "json" }
      }}
    ]
  }]
});
```

### Structured Trigger (multiple actions, JSON command)
```javascript
// For complex commands with action types, JSON in setInputMessage works well
window.Magic.setInputMessage(JSON.stringify({
  action: "analyze",
  input: "data/sales.json",
  output: "data/analysis.json",
  options: { period: "monthly", metrics: ["revenue", "growth"] }
}));
```

### In the SKILL.md, describe how to parse:
```markdown
## Input Parsing

Messages from the HTML app may be:
1. **Plain text instructions** — follow them directly
2. **JSON commands** — parse and execute the specified action:
   - `action: "analyze"` → run analysis workflow
   - `action: "generate"` → run generation workflow
   - `action: "refresh"` → re-read data and update outputs
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

## Validation

After generating a companion skill, verify:

1. **SKILL.md has valid frontmatter** — `name` and `description` fields present
2. **Name matches directory** — `skills/sales_analyzer/SKILL.md` has `name: sales_analyzer`
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
