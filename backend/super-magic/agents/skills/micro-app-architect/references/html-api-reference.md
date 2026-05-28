# window.Magic API — Quick Reference

This is a condensed API reference for all `window.Magic.*` APIs available in SuperMagic HTML micro-apps. For edge cases or advanced usage, read the full `html-api-sdk` skill via `read_files`.

---

## Important Constraints (Must Follow)

1. APIs are **only available inside HTML files opened in a SuperMagic workspace**
2. All `window.Magic.fs.*` paths are relative to the **app root directory** (containing `index.html`). **`../` traversal is forbidden**
3. **Inline event handlers are forbidden** — use `addEventListener` only
4. **`model` field is always required** in LLM calls — default to `"auto"`
5. **`@file` mention paths must be workspace-root-relative** — use `getAppBasePath()` to prefix app data file paths

---

## 0. App Base Path (`window.Magic.getAppBasePath`)

### getAppBasePath() → Promise\<string\>
```javascript
const basePath = await window.Magic.getAppBasePath();
// e.g. "个人财务记账/" or "" (if app is at workspace root)
```
- Returns the workspace-relative directory path of the current app
- Use to build `file_path` values for `@file` mentions in tiptap JSON
- `.magic/` paths need no prefix (already at workspace root)

---

## 1. File System (`window.Magic.fs`)

### readFile(path) → Promise\<string\>
```javascript
const raw = await window.Magic.fs.readFile("data/users.json");
const users = JSON.parse(raw);
```
- Max 5 MB per file; rejects if file doesn't exist

### writeFile(path, content) → Promise\<void\>
```javascript
await window.Magic.fs.writeFile("data/users.json", JSON.stringify(data, null, 2));
// Also supports Blob/ArrayBuffer for binary (up to 500 MB)
await window.Magic.fs.writeFile("data/large.bin", blob);
```
- `string`: max 5 MB | `Blob`/`ArrayBuffer`: max 500 MB
- Overwrites if exists; auto-creates directories
- Paths relative to directory containing `index.html`

### listFiles(dir?) → Promise\<string[]\>
```javascript
const files = await window.Magic.fs.listFiles("data/");
```
- Returns file names without path prefix

### watchFile(path, callback) → () => void
```javascript
const unwatch = window.Magic.fs.watchFile("data/orders.json", async (event) => {
  const fresh = JSON.parse(await window.Magic.fs.readFile("data/orders.json"));
  renderTable(fresh);
});
// Stop watching: unwatch()
```
- Polls ~3 seconds; max **10 watched paths** per app
- Callback receives `{ path: string; timestamp: number }`

---

## 2. LLM (`window.Magic.llm`)

### getModels() → Promise\<Array\<{id, object?, owned_by?, icon?, label?, info?}\>\>
```javascript
const models = await window.Magic.llm.getModels();
// → [{ id: "gpt-4o", object: "model", owned_by: "openai", icon: "https://...", label: "GPT-4o", info: {...} }, ...]
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Model unique identifier |
| `object` | `string?` | Object type (usually "model") |
| `owned_by` | `string?` | Model provider |
| `icon` | `string?` | Model icon URL |
| `label` | `string?` | Model display name (may differ from id) |
| `info` | `object?` | Raw model metadata — see [references/model-info-schema.md](model-info-schema.md) for full structure |

**Quick filtering patterns:**
```javascript
// Only chat models (exclude embedding-only)
const chatModels = models.filter(m => m.info?.options?.chat !== false);
// Multi-modal capable
const mmModels = models.filter(m => m.info?.options?.multi_modal === true);
```

### chat(messages, options?) → Promise\<string\>
```javascript
const reply = await window.Magic.llm.chat(
  [{ role: "user", content: "Summarize this data..." }],
  { model: "auto" }
);
```
**options**: `{ model: string (required), temperature?: number, maxTokens?: number, systemPrompt?: string }`
- Timeout: auto-rejects after 120s
- Do NOT set `maxTokens` unless explicitly needed; omit to let the model decide

### stream(messages, onChunk, options?) → () => void
```javascript
let text = "";
const cancel = window.Magic.llm.stream(
  [{ role: "user", content: "Write an article..." }],
  (delta, done) => {
    text += delta;
    outputEl.textContent = text;
    if (done) console.log("Complete");
  },
  { model: "auto" }
);
// Cancel: cancel()
```
- Returns cancel function
- `onChunk(delta: string, done: boolean)` — `done=true` means complete
- Do NOT set `maxTokens` by default; only specify when the user explicitly requires a token limit

### Model Selection UI Rule
Always place "Auto Select" as first/default option:
```javascript
const autoItem = { id: "auto", label: "Auto Select (Recommended)" };
// Default value must be "auto"
```

---

## 3. Agent Interaction

### setInputMessage(msg) → void
Fills message into input box and auto-sends in the **current topic**. Use for simple one-off instructions only — **do NOT use for triggering companion skills** (use `createTopicAndSend` instead).
```javascript
window.Magic.setInputMessage("Please summarize the data in data/results.json");
```

### reload() → void
Notifies Agent to refresh/re-execute current task.
```javascript
window.Magic.reload();
```

---

## 4. Agent Namespace (`window.Magic.agent`)

### getAgents() → Promise\<Array\<{id, name, icon, color, type}\>\>
```javascript
const agents = await window.Magic.agent.getAgents();
// type: "official" | "custom" | "public"
```

### selectAgent(agentId) → void
Switches the active agent.

---

## 5. Project Namespace (`window.Magic.project`)

### uploadFiles(files) → Promise\<unknown\>
```javascript
await window.Magic.project.uploadFiles([
  { file: fileObj, path: "./uploads/doc.pdf", filename: "doc.pdf" }
]);
```
- Max 500 MB per file. For single files, prefer `fs.writeFile(name, blob)` instead.

### downloadFiles(paths) → Promise
```javascript
await window.Magic.project.downloadFiles(["output/report.pdf"]);
```

### addFilesToMessage(filePaths, agentMode?) → Promise
```javascript
await window.Magic.project.addFilesToMessage(["data/report.csv"]);
```

### createTopicAndSend(message, options?) → Promise\<{topicId}\>
Creates a new topic and sends message. Supports plain text or tiptap JSON.
**When the message references file paths, prefer tiptap JSON with @file mentions** for better Agent parsing:
```javascript
// Plain text (simple messages without file references)
const { topicId } = await window.Magic.project.createTopicAndSend(
  "Please analyze this data",
  { agentId: "data_analysis", model: "auto" }
);

// Tiptap JSON (preferred when referencing files)
const { topicId: tid2 } = await window.Magic.project.createTopicAndSend({
  type: "doc",
  content: [{
    type: "paragraph",
    content: [
      { type: "text", text: "Please analyze " },
      { type: "mention", attrs: {
        type: "project_file",
        data: { file_id: "abc", file_name: "sales.csv", file_path: "data/sales.csv", file_extension: "csv" }
      }},
      { type: "text", text: " and generate a report" }
    ]
  }]
}, { agentId: "data_analysis", model: "auto" });
```
**options**: `{ agentId?: string, model?: string }`
- Timeout: 30s

### sendMessage(message, options?) → Promise\<void\>
Sends message in current topic. **Prefer tiptap JSON when the message references file paths.**
```javascript
// Plain text
await window.Magic.project.sendMessage("Continue with part 2", { model: "auto" });

// Tiptap JSON with file reference (preferred for file paths)
await window.Magic.project.sendMessage({
  type: "doc",
  content: [{
    type: "paragraph",
    content: [
      { type: "text", text: "Please analyze trends in " },
      { type: "mention", attrs: {
        type: "project_file",
        data: { file_id: "xyz", file_name: "sales.csv", file_path: "data/sales.csv", file_extension: "csv" }
      }}
    ]
  }]
}, { model: "auto" });
```
**options**: `{ model?: string }`
- Timeout: 15s

### TiptapJSONContent (Rich Text Messages)
Both `createTopicAndSend` and `sendMessage` accept tiptap JSON for rich text with @mentions:
```javascript
await window.Magic.project.createTopicAndSend({
  type: "doc",
  content: [{
    type: "paragraph",
    content: [
      { type: "text", text: "Please analyze " },
      { type: "mention", attrs: {
        type: "project_file",
        data: { file_id: "abc", file_name: "data.csv", file_path: "data/data.csv", file_extension: "csv" }
      }}
    ]
  }]
});
```

**Mention types:**
- `project_file`: `{ file_id, file_name, file_path, file_extension, file_size? }`
- `project_directory`: `{ directory_id, directory_name, directory_path, directory_metadata }`
- `skill`: `{ id, name, icon, description, mention_source? }`

### @skill Mention Structure

When the app wants to invoke a **platform/system built-in skill** (e.g. web search, image generation), use `type: "skill"` mention:

```javascript
const basePath = await window.Magic.getAppBasePath();
await window.Magic.project.createTopicAndSend({
  type: "doc",
  content: [{
    type: "paragraph",
    content: [
      { type: "mention", attrs: {
        type: "skill",
        data: {
          id: "skill_unique_id",           // skill 唯一标识（从平台获取）
          name: "网页搜索",                  // skill 显示名称
          icon: "https://...",              // skill 图标 URL
          description: "搜索互联网获取信息",  // skill 描述
          mention_source: "system"          // "system" | "agent" | "mine"
        }
      }},
      { type: "text", text: " 请搜索以下关键词：React 最新版本" }
    ]
  }]
}, { model: "auto" });
```

**`mention_source` values:**
| Value | Description |
|-------|-------------|
| `"system"` | 平台内置技能（系统级） |
| `"agent"` | 当前员工（Agent）挂载的技能 |
| `"mine"` | 用户自己创建/安装的技能 |

**vs `@file` for `.magic/` skills:**
- `@skill` mention → invoke a **platform-registered** skill by its `id` (the platform resolves it)
- `@file` mention with `.magic/SKILL.md` → invoke a **workspace companion skill** (agent reads the file as instructions)

---

## 6. Backward Compatibility

| Legacy (deprecated) | New Path |
|---------------------|----------|
| `window.Magic.getAgents()` | `window.Magic.agent.getAgents()` |
| `window.Magic.uploadFiles()` | `window.Magic.project.uploadFiles()` |
| `window.Magic.downloadFiles()` | `window.Magic.project.downloadFiles()` |
| `window.Magic.addFilesToMessage()` | `window.Magic.project.addFilesToMessage()` |
| `window.Magic.createTopicAndSend()` | `window.Magic.project.createTopicAndSend()` |
| `window.Magic.sendMessage()` | `window.Magic.project.sendMessage()` |

---

## 7. Error Handling Patterns

```javascript
// fs: file not found fallback
try {
  const content = await window.Magic.fs.readFile("data/config.json");
  return JSON.parse(content);
} catch (err) {
  if (err.message.includes("not found")) return { theme: "light" }; // defaults
  throw err;
}

// llm: timeout handling
try {
  const reply = await window.Magic.llm.chat(messages, { model: "auto" });
} catch (err) {
  if (err.message.includes("timed out")) showError("Request timed out, please retry.");
}

// Concurrent reads (recommended for initialization)
const [users, orders, config] = await Promise.all([
  window.Magic.fs.readFile("data/users.json").then(JSON.parse),
  window.Magic.fs.readFile("data/orders.json").then(JSON.parse),
  window.Magic.fs.readFile("data/config.json").then(JSON.parse),
]);
```

---

## 8. Common Pitfalls

| Pitfall | Correct approach |
|---------|-----------------|
| Omitting `model` in LLM calls | Always pass `model: "auto"` at minimum |
| Using `onclick="..."` in HTML | Use `element.addEventListener("click", handler)` |
| Importing external scripts | All APIs are pre-injected, no imports needed |
| Using `../` in file paths | Paths must stay within app root |
| Not handling stream cancellation | Store and expose the cancel function |
| Forgetting to `JSON.parse` readFile results | readFile returns string, parse manually |
| Writing large strings (>5MB) | Use Blob or ArrayBuffer for large content |
