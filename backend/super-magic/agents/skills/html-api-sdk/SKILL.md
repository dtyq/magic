---
name: html-api-sdk
description: "Guide for using window.Magic.* APIs in SuperMagic HTML micro-apps (HTML 微应用). Use this skill whenever the user wants to build ANY application, system, tool, page, or interactive experience that will run as HTML in the workspace — regardless of domain or complexity. Also use when user needs to read/write workspace files from HTML, call LLM models, stream AI responses, listen for file changes, communicate with the Agent, upload/download files, create topics, send messages to agents, or select agents programmatically. Covers: file system API (fs 文件系统读写), LLM calls (llm 大模型调用 单次/流式), Agent interaction (Agent 交互), project/topic management (项目与话题管理), and agent dispatch (员工调度). Trigger phrases: 'make an app', 'build a tool', 'create a system', 'develop an application', 'create a dashboard', 'write a page', 'make an HTML app', 'build a web tool', 'develop a micro-app', 'write an interactive page', 'build a form app', 'create a chat interface', 'read workspace files in HTML', 'call LLM from HTML', 'stream AI output', 'notify Agent from HTML', '做一个应用', '做一个系统', '做一个工具', '做一个页面', '创建HTML微应用', '开发网页工具', '数据看板', '交互式页面', '读写工作区文件', '调用大模型', '流式输出', '上传下载文件', '新建话题', '选择员工'."
---

# window.Magic API — HTML Micro-App Development Guide

This skill guides the correct usage of `window.Magic.*` APIs when developing HTML micro-apps in a SuperMagic workspace.

---

## Important Constraints (Must Follow)

1. These APIs are **only available inside HTML files opened in a SuperMagic workspace**; no external scripts need to be imported.
2. All file paths are relative to the **app root directory** (the directory containing `index.html`). **Using `../` to traverse to parent directories is forbidden**.
3. `window.Magic.llm` tokens are managed by the host; you cannot directly obtain an `api_key` in HTML — just call the methods directly.
4. **Inline event handlers are forbidden** (`onclick` attributes, etc.). All event bindings must use `addEventListener` in JS.
5. **When generating code that calls LLM APIs (`stream` / `chat`), must also provide a model selector UI in the interface**, unless the user explicitly specifies a particular `model_id`. The selector should call `getModels()` to populate options, default to `"auto"`, and display model `icon` + `label` when available.

---

## 1. File System API (`window.Magic.fs`)

### Read File `readFile(path)`

```javascript
const raw = await window.Magic.fs.readFile("data/users.json");
const users = JSON.parse(raw);

const markdown = await window.Magic.fs.readFile("README.md");
```

- **Parameter**: `path: string` — path relative to the app root directory
- **Returns**: `Promise<string>` — file text content
- **Limits**: max 5 MB per file; rejects if file does not exist

### Write File `writeFile(path, content)`

```javascript
await window.Magic.fs.writeFile(
  "data/users.json",
  JSON.stringify(data, null, 2),
);
await window.Magic.fs.writeFile("output/report.md", markdownContent);

// Write large files: pass Blob or ArrayBuffer directly (no string conversion needed, supports binary, up to 500 MB)
const response = await fetch("https://example.com/large-data.bin");
const blob = await response.blob();
await window.Magic.fs.writeFile("data/large-data.bin", blob);

// Using ArrayBuffer
const buffer = await response.arrayBuffer();
await window.Magic.fs.writeFile("data/large-data.bin", buffer);
```

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | Path relative to the app root directory (supports `"dir/file.txt"` or `"./dir/file.txt"`) |
| `content` | `string \| Blob \| ArrayBuffer` | File content |

- **Returns**: `Promise<void>`
- **Limits**:
  - `string` content: max 5 MB
  - `Blob` / `ArrayBuffer` content: max 500 MB (transferred via postMessage structured clone with no extra encoding overhead)
- **Notes**: Overwrites if file exists; directories in path are created automatically; `../` traversal outside app root is blocked

> **⚠️ Path Reference (Common Pitfall)**
>
> `writeFile` paths are **relative to the directory containing `index.html`**, not the workspace root.
>
> | HTML File Location  | Write Path         | Actual Save Location (Workspace) |
> | ------------------- | ------------------ | -------------------------------- |
> | `my-app/index.html` | `report.md`        | `my-app/report.md`               |
> | `my-app/index.html` | `output/report.md` | `my-app/output/report.md`        |
> | `index.html` (root) | `report.md`        | `report.md`                      |
>
> **Using `../` to traverse to parent directories is forbidden** (will be intercepted). If you want files at the workspace root, place `index.html` at the root as well, or note the actual save location in your prompt (e.g., `Saved to my-app/report.md`).

### List Directory Files `listFiles(dir?)`

```javascript
const rootFiles = await window.Magic.fs.listFiles(); // root directory
const dataFiles = await window.Magic.fs.listFiles("data/"); // subdirectory
```

- **Parameter**: `dir?: string` — defaults to `"./"`
- **Returns**: `Promise<string[]>` — list of file names (without path prefix)

### Watch File Changes `watchFile(path, callback)`

```javascript
const unwatch = window.Magic.fs.watchFile("data/orders.json", async (event) => {
  console.log("File updated:", event.path, event.timestamp);
  const fresh = JSON.parse(await window.Magic.fs.readFile("data/orders.json"));
  renderTable(fresh);
});
// Stop watching: unwatch()
```

- **Parameters**: `path: string`, `callback: (e: { path: string; timestamp: number }) => void`
- **Returns**: `() => void` — call to stop watching
- **Notes**: Host polls approximately every 3 seconds; max **10 watched paths** per app

### Concurrent Reads (Recommended)

```javascript
const [users, orders, settings] = await Promise.all([
  window.Magic.fs.readFile("data/users.json").then(JSON.parse),
  window.Magic.fs.readFile("data/orders.json").then(JSON.parse),
  window.Magic.fs.readFile("config/settings.json").then(JSON.parse),
]);
```

---

## 2. LLM API (`window.Magic.llm`)

### Get Available Models `getModels()`

```javascript
const models = await window.Magic.llm.getModels();
// → [{ id: "gpt-4o", object: "model", owned_by: "openai", icon: "https://...", label: "GPT-4o", info: {...} }, ...]
const modelIds = models.map((m) => m.id);
```

- **Returns**: `Promise<Array<{ id: string; object?: string; owned_by?: string; icon?: string; label?: string; info?: object }>>`

| Field      | Type     | Description                          |
| ---------- | -------- | ------------------------------------ |
| `id`       | `string` | Model unique identifier              |
| `object`   | `string?`| Object type (usually "model")        |
| `owned_by` | `string?`| Model provider                       |
| `icon`     | `string?`| Model icon URL                       |
| `label`    | `string?`| Model display name (may differ from id) |
| `info`     | `object?`| Raw model metadata (attributes + options), contains capabilities and token limits. Use `info.options.chat`, `info.options.multi_modal` etc. to filter models by capability |

> **⚠️ The `model` field is required — default to `"auto"`**
>
> The `model` parameter **cannot be omitted or be an empty string**. If the user has not selected a model, you must explicitly pass `"auto"`, and the system will automatically choose an appropriate model:
>
> ```javascript
> // ✅ Correct: explicitly pass "auto" when no model is selected
> const modelId = selectedModel || "auto"; // must never be empty string or undefined
> window.Magic.llm.stream(messages, onChunk, { model: modelId });
> window.Magic.llm.chat(messages, { model: modelId });
>
> // ❌ Wrong: omitting model field or passing empty value
> window.Magic.llm.stream(messages, onChunk, { maxTokens: 1500 }); // forbidden
> window.Magic.llm.chat(messages, { model: "" }); // forbidden
> ```
>
> In model selection UI, **must** place "Auto Select" as the first item and select it by default:
>
> ```javascript
> // After loading model list, insert default option at top
> const autoItem = { id: "auto", label: "Auto Select (Recommended)" };
> [autoItem, ...models].forEach((m) => renderModelItem(m.id, m.label || m.id, m.icon));
> // Ensure select initial value is "auto"
> document.getElementById("model-select").value = "auto";
> ```

### Single Chat `chat(messages, options?)`

```javascript
// Basic usage
const reply = await window.Magic.llm.chat([
  {
    role: "user",
    content:
      "Summarize in one sentence: how many planets are in the solar system?",
  },
]);

// With system prompt and history context
const reply2 = await window.Magic.llm.chat([
  {
    role: "system",
    content: "You are a data analysis expert. Answer concisely.",
  },
  {
    role: "user",
    content: "Sales grew 15% year-over-year last month. What does this imply?",
  },
]);

// Specify model and parameters
const reply3 = await window.Magic.llm.chat(
  [{ role: "user", content: "Write a haiku about autumn." }],
  { model: "gpt-4o", temperature: 0.9, maxTokens: 200 },
);
```

**options parameter:**

| Parameter      | Type      | Description                                                         |
| -------------- | --------- | ------------------------------------------------------------------- |
| `model`        | `string`  | **Required**. Model ID; pass `"auto"` if none selected              |
| `temperature`  | `number?` | Temperature (0–2, higher = more random)                             |
| `maxTokens`    | `number?` | Maximum output tokens                                               |
| `systemPrompt` | `string?` | Equivalent to inserting a `system` message at the start of the list |

- **Returns**: `Promise<string>` — model reply content (plain text)
- **Timeout**: auto-rejects after 120 seconds with no response

### Streaming Chat `stream(messages, onChunk, options?)`

Receives tokens incrementally; suitable for long text generation with real-time output.

```javascript
let fullText = "";
const outputEl = document.getElementById("output");

const cancel = window.Magic.llm.stream(
  [{ role: "user", content: "Write a 500-word article about AI development." }],
  (delta, done) => {
    fullText += delta;
    outputEl.textContent = fullText;
    if (done) console.log("Generation complete,", fullText.length, "chars");
  },
  { model: "gpt-4o", maxTokens: 1000 },
);

// Cancel streaming output
document.getElementById("cancel-btn").addEventListener("click", () => cancel());
```

- **`onChunk`**: `(delta: string, done: boolean) => void` — `done=true` indicates completion
- **Returns**: `() => void` — cancel function; stops receiving immediately when called

---

## 3. Agent Interaction API

### Send Message to Agent `setInputMessage(msg)`

Fills the message into the input box and auto-sends, triggering the Agent to continue execution.

```javascript
await window.Magic.fs.writeFile("output/analysis.json", JSON.stringify(result));
window.Magic.setInputMessage(
  "Data analysis complete. Please generate visualizations based on output/analysis.json",
);
```

### Trigger Refresh `reload()`

Notifies the Agent to refresh or re-execute the current task.

```javascript
window.Magic.reload();
```

---

## 4. Agent Namespace (`window.Magic.agent`)

### Get Agent List `getAgents()`

Retrieves the list of currently available Agents.

```javascript
const agents = await window.Magic.agent.getAgents();
// → [
//   { id: "general", name: "General Assistant", icon: "https://...", color: "#4A90D9", type: "official" },
//   { id: "data_analysis", name: "Data Analyst", icon: "https://...", color: "#52C41A", type: "official" },
//   { id: "my_custom_agent", name: "My Custom Agent", icon: "https://...", color: "#FF6B6B", type: "custom" },
// ]

// Display available agent list
agents.forEach((agent) => {
  console.log(`${agent.name} (${agent.type}) - ${agent.id}`);
});
```

**Returns**: `Promise<Array<{ id: string; name: string; icon: string; color: string; type: "official" | "custom" | "public" }>>`

| Field   | Type     | Description                                        |
| ------- | -------- | -------------------------------------------------- |
| `id`    | `string` | Agent unique identifier (mode.identifier)          |
| `name`  | `string` | Agent name                                         |
| `icon`  | `string` | Agent icon URL                                     |
| `color` | `string` | Agent icon color                                   |
| `type`  | `string` | Agent type: `"official"` / `"custom"` / `"public"` |

---

## 5. Project Namespace (`window.Magic.project`)

### 5.1 Upload Files to Workspace `uploadFiles(files)`

> **Recommended**: For writing files within the app root directory, prefer `window.Magic.fs.writeFile(path, blob)`.
> It's simpler (no need to construct arrays), supports 500 MB, and auto-creates directories.
> `uploadFiles` is suitable for batch uploading multiple files or when custom target paths are needed.

```javascript
// ✅ Recommended: use writeFile directly for single files
const input = document.createElement("input");
input.type = "file";
input.addEventListener("change", async () => {
  const file = input.files[0];
  await window.Magic.fs.writeFile(file.name, file);
});
input.click();

// Use uploadFiles for batch uploading multiple files
const input2 = document.createElement("input");
input2.type = "file";
input2.multiple = true;
input2.addEventListener("change", async () => {
  await window.Magic.project.uploadFiles(
    Array.from(input2.files).map((f) => ({
      file: f,
      path: `./${f.name}`,
      filename: f.name,
    })),
  );
});
input2.click();
```

- **Parameter**: `files: Array<{ file: File, path: string, filename: string }>` — each item contains a File object, target path, and filename
- **Returns**: `Promise<unknown>`
- **Limits**: max 500 MB per file

### 5.2 Download Workspace Files `downloadFiles(paths)`

```javascript
await window.Magic.project.downloadFiles([
  "output/report.pdf",
  "data/export.csv",
]);
```

### 5.3 Attach Files to Message Input `addFilesToMessage(filePaths, agentMode?)`

```javascript
await window.Magic.project.addFilesToMessage([
  "data/report.csv",
  "output/chart.png",
]);
```

### 5.4 Create Topic and Send Message `createTopicAndSend(message, options?)`

Creates a new topic and sends the specified message in it, optionally specifying an agent and model.
`message` supports plain text strings or tiptap JSON document structures (can inline `@` mentions and other rich text nodes).

```javascript
// Basic usage: create new topic and send plain text message
const { topicId } = await window.Magic.project.createTopicAndSend(
  "Please help me analyze this data",
);

// Send with specified agent
const { topicId: tid2 } = await window.Magic.project.createTopicAndSend(
  "Please write a web scraper in Python",
  { agentId: "general" },
);

// Specify agent + model
const { topicId: tid3 } = await window.Magic.project.createTopicAndSend(
  "Please generate a report for me",
  {
    agentId: "data_analysis",
    model: "gpt-4o",
  },
);

// Send rich text message with @file reference (tiptap JSON)
const { topicId: tid4 } = await window.Magic.project.createTopicAndSend({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Please generate a chart based on " },
        {
          type: "mention",
          attrs: {
            type: "project_file",
            data: {
              file_id: "file_abc123",
              file_name: "report.csv",
              file_path: "data/report.csv",
              file_extension: "csv",
            },
          },
        },
      ],
    },
  ],
});
```

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | `string \| TiptapJSONContent` | Plain text message or tiptap JSON document (can contain mention nodes) |
| `options.agentId` | `string?` | Agent ID (from `getAgents()`). When omitted, defaults to general mode (通用模式) |
| `options.model` | `string?` | Model ID. Default `"auto"` |

- **Returns**: `Promise<{ topicId: string }>` — the newly created topic ID
- **Timeout**: auto-rejects after 30 seconds with no response

**Typical use case: Trigger a companion skill stored in `.magic/` directory:**
```javascript
// Attach the skill file as @file mention and include the user's task
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
      { type: "text", text: "\n\n用户任务：分析当前数据并生成报告" }
    ]
  }]
}, { model: "auto" });
// No agentId → general mode; agent reads the SKILL.md as instructions
```

### 5.5 Send Message in Current Topic `sendMessage(message, options?)`

Sends a message directly in the currently active topic, optionally specifying a model.
`message` supports plain text strings or tiptap JSON document structures (can inline `@` mentions and other rich text nodes).

```javascript
// Basic usage: send plain text message directly
await window.Magic.project.sendMessage(
  "Please continue analyzing the second part of the data",
);

// Send with specified model
await window.Magic.project.sendMessage("Please explain in more detail", {
  model: "gpt-4o",
});

// Send rich text message with @file reference
await window.Magic.project.sendMessage({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Please analyze the trends in " },
        {
          type: "mention",
          attrs: {
            type: "project_file",
            data: {
              file_id: "file_xyz789",
              file_name: "sales.csv",
              file_path: "data/sales.csv",
              file_extension: "csv",
            },
          },
        },
      ],
    },
  ],
});
```

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | `string \| TiptapJSONContent` | Plain text message or tiptap JSON document (can contain mention nodes) |
| `options.model` | `string?` | Model ID |

- **Returns**: `Promise<void>`
- **Timeout**: auto-rejects after 15 seconds with no response

### 5.6 TiptapJSONContent Data Structure

The `message` parameter of `createTopicAndSend` and `sendMessage` supports tiptap JSON format, which can inline `@` mention nodes to reference workspace files.

#### Basic Structure

```typescript
interface TiptapJSONContent {
  type: string; // Node type, e.g. "doc", "paragraph", "text", "mention"
  attrs?: Record<string, unknown>; // Node attributes
  content?: TiptapJSONContent[]; // Child nodes
  text?: string; // Text node content
}
```

#### Mention Node Format

Two mention types are supported: `project_file` (file) and `project_directory` (directory).

**File mention (`project_file`):**

```javascript
{
  type: "mention",
  attrs: {
    type: "project_file",
    data: {
      file_id: "file_abc123",       // File unique identifier
      file_name: "report.csv",      // Filename (with extension)
      file_path: "data/report.csv", // Relative path (from workspace root)
      file_extension: "csv",        // File extension
      file_size: 1024,              // Optional, file size in bytes
    }
  }
}
```

**Directory mention (`project_directory`):**

```javascript
{
  type: "mention",
  attrs: {
    type: "project_directory",
    data: {
      directory_id: "dir_456",      // Directory unique identifier
      directory_name: "docs",       // Directory name
      directory_path: "docs",       // Relative path (from workspace root)
      directory_metadata: {         // Directory metadata
        version: "1",
        type: "folder",
        name: "docs",
      }
    }
  }
}
```

#### attrs Field Reference

**`project_file` data fields:**

| Field            | Type     | Required | Description                         |
| ---------------- | -------- | -------- | ----------------------------------- |
| `file_id`        | `string` | Yes      | File unique identifier              |
| `file_name`      | `string` | Yes      | Filename (with extension)           |
| `file_path`      | `string` | Yes      | Relative path (from workspace root) |
| `file_extension` | `string` | Yes      | File extension (without `.`)        |
| `file_size`      | `number` | No       | File size in bytes                  |

**`project_directory` data fields:**

| Field                | Type     | Required | Description                                                |
| -------------------- | -------- | -------- | ---------------------------------------------------------- |
| `directory_id`       | `string` | Yes      | Directory unique identifier                                |
| `directory_name`     | `string` | Yes      | Directory name                                             |
| `directory_path`     | `string` | Yes      | Relative path (from workspace root)                        |
| `directory_metadata` | `object` | Yes      | Directory metadata (contains `version?`, `type?`, `name?`) |

---

## 6. Backward Compatibility

The following legacy paths still work but migration to the new namespaces is recommended:

| Legacy Path (deprecated)                      | New Path                                              |
| --------------------------------------------- | ----------------------------------------------------- |
| `window.Magic.getAgents()`                    | `window.Magic.agent.getAgents()`                      |
| `window.Magic.uploadFiles(files)`             | `window.Magic.project.uploadFiles(files)`             |
| `window.Magic.downloadFiles(paths)`           | `window.Magic.project.downloadFiles(paths)`           |
| `window.Magic.addFilesToMessage(files)`       | `window.Magic.project.addFilesToMessage(files)`       |
| `window.Magic.createTopicAndSend(msg, opts?)` | `window.Magic.project.createTopicAndSend(msg, opts?)` |
| `window.Magic.sendMessage(msg, opts?)`        | `window.Magic.project.sendMessage(msg, opts?)`        |

---

## 7. Error Handling Best Practices

```javascript
// fs error handling
try {
  const content = await window.Magic.fs.readFile("data/config.json");
  return JSON.parse(content);
} catch (err) {
  if (err.message.includes("not found")) {
    return { theme: "light", lang: "en" }; // File not found, use defaults
  }
  console.error("Failed to read config:", err);
  throw err;
}

// llm timeout/failure handling
try {
  const reply = await window.Magic.llm.chat(messages, { maxTokens: 500 });
  return reply;
} catch (err) {
  if (err.message.includes("timed out"))
    return "Request timed out. Please retry.";
  return "Call failed: " + err.message;
}

// stream error: onChunk notifies end with done=true (including error cases)
window.Magic.llm.stream(messages, (delta, done) => {
  buffer += delta;
  if (done) finalize(buffer);
});
```

---

## 8. Complete Example Templates

### Example A: Read Data → LLM Analysis → Write Results → Notify Agent

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Data Analysis Assistant</title>
  </head>
  <body>
    <button id="analyze">Start Analysis</button>
    <pre id="output">Waiting for analysis...</pre>

    <script>
      document.getElementById("analyze").addEventListener("click", async () => {
        const output = document.getElementById("output");
        output.textContent = "Reading data...";

        // 1. Concurrent data reads
        const [users, orders] = await Promise.all([
          window.Magic.fs.readFile("data/users.json").then(JSON.parse),
          window.Magic.fs.readFile("data/orders.json").then(JSON.parse),
        ]);

        output.textContent = "Calling LLM for analysis...";

        // 2. Stream LLM call
        let analysis = "";
        await new Promise((resolve) => {
          window.Magic.llm.stream(
            [
              {
                role: "user",
                content: `Analyze the following data and provide business recommendations:\nUsers: ${users.length}\nTotal order amount: ${orders.reduce((s, o) => s + o.amount, 0)}`,
              },
            ],
            (delta, done) => {
              analysis += delta;
              output.textContent = analysis;
              if (done) resolve(null);
            },
            { model: "auto", maxTokens: 500 },
          );
        });

        // 3. Write analysis results
        await window.Magic.fs.writeFile("output/analysis.md", analysis);

        // 4. Notify Agent
        window.Magic.setInputMessage(
          "Analysis complete. Results written to output/analysis.md. Please generate charts.",
        );
      });
    </script>
  </body>
</html>
```

### Example B: Watch Agent-Written Data and Auto-Refresh UI

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Real-Time Dashboard</title>
  </head>
  <body>
    <div id="dashboard">Loading...</div>

    <script>
      async function render() {
        const data = JSON.parse(
          await window.Magic.fs.readFile("data/metrics.json"),
        );
        document.getElementById("dashboard").innerHTML = `
        <h2>Real-Time Metrics</h2>
        <p>Total Users: ${data.totalUsers}</p>
        <p>Daily Active: ${data.dailyActive}</p>
        <p>Updated: ${new Date(data.updatedAt).toLocaleString()}</p>
      `;
      }

      render().catch(console.error);

      // Watch for Agent updates to the data file
      window.Magic.fs.watchFile("data/metrics.json", () => {
        render().catch(console.error);
      });
    </script>
  </body>
</html>
```

### Example C: Let User Select Model and Stream Chat

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Model Chat</title>
  </head>
  <body>
    <select id="model-select">
      <option>Loading...</option>
    </select>
    <textarea id="input" placeholder="Type a message..."></textarea>
    <button id="send">Send</button>
    <button id="cancel" disabled>Cancel</button>
    <div id="output"></div>

    <script>
      let cancelStream = null;

      window.Magic.llm.getModels().then((models) => {
        const sel = document.getElementById("model-select");
        // Insert "Auto Select" at the top as default option
        const autoOpt = `<option value="auto" selected>Auto Select (Recommended)</option>`;
        sel.innerHTML =
          autoOpt +
          models
            .map((m) => `<option value="${m.id}">${m.id}</option>`)
            .join("");
      });

      document.getElementById("send").addEventListener("click", async () => {
        const content = document.getElementById("input").value.trim();
        if (!content) return;

        const output = document.getElementById("output");
        output.textContent = "";
        document.getElementById("cancel").disabled = false;

        const model = document.getElementById("model-select").value || "auto"; // ensure not empty
        cancelStream = window.Magic.llm.stream(
          [{ role: "user", content }],
          (delta, done) => {
            output.textContent += delta;
            if (done) {
              document.getElementById("cancel").disabled = true;
              cancelStream = null;
            }
          },
          { model },
        );
      });

      document.getElementById("cancel").addEventListener("click", () => {
        cancelStream?.();
        cancelStream = null;
        document.getElementById("cancel").disabled = true;
      });
    </script>
  </body>
</html>
```

---

## 9. API Quick Reference

| API                                                   | Description                                                      | Returns                  |
| ----------------------------------------------------- | ---------------------------------------------------------------- | ------------------------ |
| `window.Magic.fs.readFile(path)`                      | Read file text                                                   | `Promise<string>`        |
| `window.Magic.fs.writeFile(path, content)`            | Write/create file (content: string/Blob/ArrayBuffer, max 500 MB) | `Promise<void>`          |
| `window.Magic.fs.listFiles(dir?)`                     | List directory files                                             | `Promise<string[]>`      |
| `window.Magic.fs.watchFile(path, cb)`                 | Watch file changes                                               | `() => void` (cancel fn) |
| `window.Magic.llm.getModels()`                        | Get available models (with icon/label)                           | `Promise<Model[]>`       |
| `window.Magic.llm.chat(msgs, opts?)`                  | Single chat                                                      | `Promise<string>`        |
| `window.Magic.llm.stream(msgs, onChunk, opts?)`       | Streaming chat                                                   | `() => void` (cancel fn) |
| `window.Magic.setInputMessage(msg)`                   | Send message to Agent                                            | `void`                   |
| `window.Magic.reload()`                               | Trigger Agent refresh                                            | `void`                   |
| `window.Magic.agent.getAgents()`                      | Get available agent list                                         | `Promise<AgentInfo[]>`   |
| `window.Magic.project.uploadFiles(files)`             | Upload files to workspace                                        | `Promise<unknown>`       |
| `window.Magic.project.downloadFiles(paths)`           | Download workspace files                                         | `Promise<unknown>`       |
| `window.Magic.project.addFilesToMessage(files)`       | Attach files to input box                                        | `Promise<unknown>`       |
| `window.Magic.project.createTopicAndSend(msg, opts?)` | Create topic and send message (msg: string or tiptap JSON)       | `Promise<{ topicId }>`   |
| `window.Magic.project.sendMessage(msg, opts?)`        | Send message in current topic (msg: string or tiptap JSON)       | `Promise<void>`          |
