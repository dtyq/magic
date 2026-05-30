---
name: html-api-sdk
description: "Complete API reference for window.Magic.* in SuperMagic HTML micro-apps (HTML 微应用). Read this skill when you need exact method signatures, parameters, return types, or usage examples for: fs (readFile/writeFile/listFiles/watchFile), llm (chat/stream/getModels), agent (getAgents/selectAgent), project (createTopicAndSend/sendMessage/uploadFiles/downloadFiles), user (getInfo), getAppBasePath, setInputMessage, reload. Also covers tiptap JSON message format, @file and @skill mention structures, model selector UI rules, error handling patterns, and backward compatibility table. Trigger phrases: 'window.Magic API', 'readFile writeFile', 'watchFile callback', 'llm.stream', 'llm.chat', 'createTopicAndSend format', 'tiptap JSON mention', '@file mention structure', '@skill mention', 'getAppBasePath usage', 'model selector UI', 'user.getInfo', 'get user info', 'user avatar', 'Magic API 用法', 'fs 读写文件 API', '流式调用参数', '文件监听回调', '话题消息格式', 'mention 结构', '模型选择器', '用户信息', '获取头像'."
---

# window.Magic API — HTML Micro-App Guide

## How to Use This Document

- API signatures & constraints → this document
- TiptapJSON & @mention structures → [references/tiptap-json-format.md](references/tiptap-json-format.md)
- Complete HTML examples → [references/complete-examples.md](references/complete-examples.md)

## Important Constraints

1. All `window.Magic.*` APIs are **pre-injected** — no imports needed. External CDN allowed.
2. File paths relative to **app root** (`index.html` dir). `../` forbidden.
3. `window.Magic.llm` tokens hosted; no `api_key` in HTML.
4. **No inline event handlers** — use `addEventListener`.
5. **LLM calls must include model selector UI** unless user specifies model. Default `"auto"`.
6. **Complex file-based AI** → use `createTopicAndSend` + `@file` + companion skill. Simple → `readFile` + `llm.chat/stream`.
7. **Every micro-app folder must contain `magic.project.js`** — this enables click-to-open behavior (clicking folder opens `index.html` instead of expanding file tree). Format:
   ```javascript
   window.magicProjectConfig = {
     version: "1.0.0",
     type: "micro-app",
     name: "App Name",
   };
   window.magicProjectConfigure(window.magicProjectConfig);
   ```

---

## 1. File System (`window.Magic.fs`)

### `readFile(path)` → `Promise<string>`

```javascript
const raw = await window.Magic.fs.readFile("data/users.json");
const users = JSON.parse(raw);
```

- `path: string` — relative to app root. Max 5 MB; rejects if not found.

### `writeFile(path, content)` → `Promise<void>`

```javascript
await window.Magic.fs.writeFile(
  "data/users.json",
  JSON.stringify(data, null, 2),
);
// Binary (up to 500 MB):
await window.Magic.fs.writeFile("data/large.bin", blob);
```

- `content: string | Blob | ArrayBuffer`. String max 5 MB. Auto-creates dirs. `../` blocked.

> ⚠️ Paths relative to `index.html` dir, NOT workspace root.

### `listFiles(dir?)` → `Promise<string[]>`

```javascript
const files = await window.Magic.fs.listFiles("data/");
```

### `watchFile(path, cb)` → `() => void`

```javascript
const unwatch = window.Magic.fs.watchFile("data/orders.json", async (e) => {
  const fresh = JSON.parse(await window.Magic.fs.readFile("data/orders.json"));
  renderTable(fresh);
});
```

- Polls ~3s; max 10 watched paths per app. Call returned fn to stop.

### Concurrent Reads

```javascript
const [users, orders] = await Promise.all([
  window.Magic.fs.readFile("data/users.json").then(JSON.parse),
  window.Magic.fs.readFile("data/orders.json").then(JSON.parse),
]);
```

---

## 1.5 `getAppBasePath()` → `Promise<string>`

```javascript
const basePath = await window.Magic.getAppBasePath();
// "个人财务记账/" or "" (workspace root)
```

- `fs.*` paths → relative to app root: `"data/file.json"`
- `@file` mention `file_path` → prefix: `basePath + "data/file.json"`
- `.magic/` paths → use as-is (already workspace root)

---

## 2. LLM API (`window.Magic.llm`)

### `getModels()` → `Promise<Model[]>`

```javascript
const models = await window.Magic.llm.getModels();
// [{id, object?, owned_by?, icon?, label?, info?}]
```

> ⚠️ `model` field **required** — default `"auto"`. Empty string forbidden.
> Model selector UI must have "Auto Select" as first/default item.

### `chat(messages, options?)` → `Promise<string>`

```javascript
const reply = await window.Magic.llm.chat(
  [{ role: "user", content: "How many planets?" }],
  { model: "auto" },
);
```

Options: `model` (required), `temperature?` (0-2), `maxTokens?`, `systemPrompt?`. Timeout: 120s.

### `stream(messages, onChunk, options?)` → `() => void`

```javascript
let text = "";
const cancel = window.Magic.llm.stream(
  [{ role: "user", content: "Write about AI." }],
  (delta, done) => {
    text += delta;
    if (done) console.log("Done");
  },
  { model: "auto", maxTokens: 1000 },
);
```

`onChunk: (delta: string, done: boolean) => void`. Returns cancel fn.

---

## 3. Agent Interaction

### `setInputMessage(msg)` → `void`

```javascript
window.Magic.setInputMessage("Analysis complete. Please generate charts.");
```

### `reload()` → `void`

```javascript
window.Magic.reload();
```

---

## 4. Agent Namespace (`window.Magic.agent`)

### `getAgents()` → `Promise<AgentInfo[]>`

```javascript
const agents = await window.Magic.agent.getAgents();
// [{id, name, icon, color, type: "official"|"custom"|"public"}]
```

---

## 5. Project Namespace (`window.Magic.project`)

### 5.1 `uploadFiles(files)` → `Promise<unknown>`

> Prefer `fs.writeFile(path, blob)` for single files.

```javascript
await window.Magic.project.uploadFiles(
  files.map((f) => ({ file: f, path: `./${f.name}`, filename: f.name })),
);
```

Max 500 MB per file.

### 5.2 `downloadFiles(paths)` → `Promise<unknown>`

```javascript
await window.Magic.project.downloadFiles(["output/report.pdf"]);
```

### 5.3 `addFilesToMessage(filePaths, agentMode?)` → `Promise<unknown>`

```javascript
await window.Magic.project.addFilesToMessage(["data/report.csv"]);
```

### 5.4 `createTopicAndSend(message, options?)` → `Promise<{topicId}>`

Creates new topic. `message`: plain text or tiptap JSON (see [tiptap ref](references/tiptap-json-format.md)).

```javascript
// Plain text
const { topicId } = await window.Magic.project.createTopicAndSend(
  "Analyze this",
  { model: "auto" },
);

// Tiptap JSON with @file mention (trigger companion skill)
const { topicId: t2 } = await window.Magic.project.createTopicAndSend(
  {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "请阅读技能文件并执行：" },
          {
            type: "mention",
            attrs: {
              type: "project_file",
              data: {
                file_id: "skill_ref",
                file_name: "SKILL.md",
                file_path: ".magic/report_writer/SKILL.md",
                file_extension: "md",
              },
            },
          },
          { type: "text", text: "\n\n任务：生成报告" },
        ],
      },
    ],
  },
  { model: "auto" },
);
```

Options: `agentId?` (defaults general mode), `model?` (default `"auto"`). Timeout: 30s.

### 5.5 `sendMessage(message, options?)` → `Promise<void>`

```javascript
await window.Magic.project.sendMessage("Continue analyzing", { model: "auto" });
```

Options: `model?`. Timeout: 15s.

---

## 6. User Info (`window.Magic.user`)

### `getInfo()` → `Promise<UserInfo>`

```javascript
const user = await window.Magic.user.getInfo();
// {user_id, magic_id, nickname, real_name, name, avatar, organization_code}
document.getElementById("avatar").src = user.avatar;
```

| Field | Type | Description |
| --- | --- | --- |
| `user_id` | `string` | User ID in current org |
| `magic_id` | `string` | Global unique ID |
| `nickname` | `string` | Nickname |
| `real_name` | `string` | Real name (may be empty) |
| `name` | `string` | Display name (real_name > nickname) |
| `avatar` | `string` | Avatar URL |
| `organization_code` | `string` | Current org code |

Timeout: 15s.

---

## 7. Backward Compatibility

| Deprecated | New Path |
| --- | --- |
| `window.Magic.getAgents()` | `window.Magic.agent.getAgents()` |
| `window.Magic.uploadFiles(files)` | `window.Magic.project.uploadFiles(files)` |
| `window.Magic.downloadFiles(paths)` | `window.Magic.project.downloadFiles(paths)` |
| `window.Magic.addFilesToMessage(files)` | `window.Magic.project.addFilesToMessage(files)` |
| `window.Magic.createTopicAndSend(msg, opts?)` | `window.Magic.project.createTopicAndSend(msg, opts?)` |
| `window.Magic.sendMessage(msg, opts?)` | `window.Magic.project.sendMessage(msg, opts?)` |

---

## 8. Error Handling

```javascript
// fs: file not found
try {
  return JSON.parse(await window.Magic.fs.readFile("data/config.json"));
} catch (err) {
  if (err.message.includes("not found")) return { theme: "light" };
  throw err;
}

// llm: timeout
try {
  return await window.Magic.llm.chat(messages, { model: "auto" });
} catch (err) {
  if (err.message.includes("timed out")) return "Request timed out.";
  return "Failed: " + err.message;
}

// stream: done=true signals end (including errors)
window.Magic.llm.stream(
  messages,
  (delta, done) => {
    buffer += delta;
    if (done) finalize(buffer);
  },
  { model: "auto" },
);
```

---

## 9. API Quick Reference

| API | Returns |
| --- | --- |
| `window.Magic.getAppBasePath()` | `Promise<string>` |
| `window.Magic.fs.readFile(path)` | `Promise<string>` |
| `window.Magic.fs.writeFile(path, content)` | `Promise<void>` |
| `window.Magic.fs.listFiles(dir?)` | `Promise<string[]>` |
| `window.Magic.fs.watchFile(path, cb)` | `() => void` |
| `window.Magic.llm.getModels()` | `Promise<Model[]>` |
| `window.Magic.llm.chat(msgs, opts?)` | `Promise<string>` |
| `window.Magic.llm.stream(msgs, onChunk, opts?)` | `() => void` |
| `window.Magic.setInputMessage(msg)` | `void` |
| `window.Magic.reload()` | `void` |
| `window.Magic.agent.getAgents()` | `Promise<AgentInfo[]>` |
| `window.Magic.project.uploadFiles(files)` | `Promise<unknown>` |
| `window.Magic.project.downloadFiles(paths)` | `Promise<unknown>` |
| `window.Magic.project.addFilesToMessage(files)` | `Promise<unknown>` |
| `window.Magic.project.createTopicAndSend(msg, opts?)` | `Promise<{topicId}>` |
| `window.Magic.project.sendMessage(msg, opts?)` | `Promise<void>` |
| `window.Magic.user.getInfo()` | `Promise<UserInfo>` |
