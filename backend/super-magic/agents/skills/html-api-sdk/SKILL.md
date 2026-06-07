---
name: html-api-sdk
description: "Complete API reference for window.Magic.* in SuperMagic HTML micro-apps (HTML 微应用). Read this skill when you need exact method signatures, parameters, return types, or usage examples for: fs (readFile/writeFile/listFiles/deleteFile/deleteDir/moveFile/renameFile/watchFile), llm (chat/stream/getModels), agent (getAgents/selectAgent), project (createTopicAndSend/sendMessage/uploadFiles/downloadFiles), user (getInfo with app.json userInfo scopes), getAppBasePath, setInputMessage, reload. Also covers tiptap JSON message format, @file and @skill mention structures, model selector UI rules, user info authorization, error handling patterns, and backward compatibility table. Trigger phrases: 'window.Magic API', 'readFile writeFile', 'deleteFile deleteDir', 'moveFile renameFile', 'watchFile callback', 'llm.stream', 'llm.chat', 'createTopicAndSend format', 'tiptap JSON mention', '@file mention structure', '@skill mention', 'getAppBasePath usage', 'model selector UI', 'user.getInfo', 'get user info', 'user avatar', 'userInfo scopes', 'app.json permissions', 'Magic API 用法', 'fs 读写文件 API', 'fs 删除文件', 'fs 移动重命名', '流式调用参数', '文件监听回调', '话题消息格式', 'mention 结构', '模型选择器', '用户信息', '用户授权', '获取头像'."
---

# window.Magic API — HTML Micro-App Guide

## How to Use This Document

- API signatures & constraints → this document
- App manifest & permission declarations → `app.json`
- TiptapJSON & @mention structures → [references/tiptap-json-format.md](references/tiptap-json-format.md)
- Complete HTML examples → [references/complete-examples.md](references/complete-examples.md)

## Important Constraints

1. All `window.Magic.*` APIs are **pre-injected** — no imports needed. External CDN allowed.
2. File paths are relative to **app root** (`index.html` dir) by default. `../` is forbidden. To access project-root files, declare `app.json.permissions.files.scope = "project"` and use leading-slash paths such as `"/shared/data.json"`.
3. `window.Magic.llm` tokens hosted; no `api_key` in HTML.
4. **No inline event handlers** — use `addEventListener`.
5. **LLM calls must include model selector UI** unless user specifies model. Default `"auto"`.
6. **Complex file-based AI** → use `createTopicAndSend` + `@file` + companion skill. Simple → `readFile` + `llm.chat/stream`.
7. **User info is privacy-gated** — `window.Magic.user.getInfo()` returns only `name` and `avatar` by default. Sensitive fields require `app.json.permissions.userInfo.scopes`, a matching runtime `getInfo({ scopes, reason })` request, and user confirmation.
8. **Use `app.json` as the micro-app manifest** — every new HTML micro-app folder should include `app.json` next to `index.html`. Put `type`, `name`, `entry`, file aliases, watch hints, and permissions there. Do not generate `magic.project.js` for new HTML micro-apps.
   ```json
   {
     "version": "1.0.0",
     "type": "micro-app",
     "name": "App Name",
     "entry": "index.html",
     "files": {},
     "watch": [],
    "permissions": {
      "files": {"scope": "app"}
    }
   }
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

### File Scope (`app.json.permissions.files.scope`)

Default scope is `"app"`: all `window.Magic.fs.*` paths resolve inside the app folder next to `index.html`.

Use `"project"` only when the app genuinely needs project-root files outside its own folder:

```json
{
  "name": "Project File Manager",
  "entry": "index.html",
  "permissions": {
    "files": {
      "scope": "project"
    }
  }
}
```

Path rules:

- `"data/config.json"` -> app root, e.g. `my-app/data/config.json`.
- `"/shared/config.json"` -> project root, only when `scope` is `"project"`.
- `"/"` lists project-root entries when project scope is declared.
- `../` remains blocked in all scopes.
- Deleting, moving, or renaming files outside the app root triggers host confirmation and may be rejected by the user.

### `listFiles(dir?)` → `Promise<string[]>`

```javascript
const files = await window.Magic.fs.listFiles("data/");
```

### `deleteFile(path)` → `Promise<void>`

```javascript
await window.Magic.fs.deleteFile("data/temp.json");
```

- Rejects if file not found. `../` blocked.

### `deleteDir(path)` → `Promise<void>`

```javascript
await window.Magic.fs.deleteDir("temp/");
```

- Recursively deletes all files and subdirectories. Cannot delete app root or project root. Rejects if dir not found. `../` blocked.

### `moveFile(path, targetDir)` → `Promise<void>`

```javascript
await window.Magic.fs.moveFile("data/old.json", "archive/");
```

- Moves a file or directory to the specified target parent directory. Rejects if source file or target directory not found. `../` blocked.

### `renameFile(path, newName)` → `Promise<void>`

```javascript
await window.Magic.fs.renameFile("data/draft.txt", "final.txt");
```

- Renames a file or directory. `newName` is just the new name (no path separators). Rejects if file not found. `../` blocked.

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

- `fs.*` paths → relative to app root by default: `"data/file.json"`; project-root paths require `permissions.files.scope = "project"` and a leading slash.
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

### `getInfo(options?)` → `Promise<UserInfo>`

Default call returns only display-safe fields:

```javascript
const user = await window.Magic.user.getInfo();
// {name, avatar}
document.getElementById("avatar").src = user.avatar;
```

Sensitive fields require permission declaration in `app.json` in the same folder as `index.html`. `app.json` is the declarative manifest read by the host before authorization checks; do not declare user info scopes in `magic.project.js`.

```json
{
  "name": "Profile Card",
  "permissions": {
    "userInfo": {
      "scopes": ["user.profile.name", "user.profile.identity"],
      "reason": "Display the current user's profile"
    }
  }
}
```

Then request the declared scopes at runtime:

```javascript
try {
  const user = await window.Magic.user.getInfo({
    scopes: ["user.profile.name", "user.profile.identity"],
    reason: "Display the current user's profile",
  });
  // {name, avatar, nickname, real_name, user_id, magic_id}
} catch (err) {
  // Rejected when scopes are undeclared or the user denies authorization.
}
```

| Scope | Returned fields | Authorization |
| --- | --- | --- |
| `user.profile.display` | `name`, `avatar` | No prompt; default |
| `user.profile.name` | `nickname`, `real_name` | Requires declaration and user confirmation |
| `user.profile.identity` | `user_id`, `magic_id` | Requires declaration and user confirmation |
| `user.profile.organization` | `organization_code` | Requires declaration and user confirmation |

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` | Display name (real_name > nickname) |
| `avatar` | `string` | Avatar URL |
| `nickname` | `string` | Nickname; only with `user.profile.name` |
| `real_name` | `string` | Real name; only with `user.profile.name` |
| `user_id` | `string` | User ID in current org; only with `user.profile.identity` |
| `magic_id` | `string` | Global unique ID; only with `user.profile.identity` |
| `organization_code` | `string` | Current org code; only with `user.profile.organization` |

Notes:

- Sensitive scopes must be present in both `app.json.permissions.userInfo.scopes` and the runtime `getInfo({ scopes })` call.
- `magic.project.js` is legacy for older HTML micro-apps and still used by other project types such as slides/design/media. It is not the HTML micro-app manifest.
- `reason` should explain why the app needs these fields; runtime `reason` overrides the `app.json` reason in the confirmation dialog.
- Approved sensitive scopes are cached only for the current iframe session.
- Never assume identity or organization fields are available from a bare `getInfo()` call.

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
| `window.Magic.fs.deleteFile(path)` | `Promise<void>` |
| `window.Magic.fs.deleteDir(path)` | `Promise<void>` |
| `window.Magic.fs.moveFile(path, targetDir)` | `Promise<void>` |
| `window.Magic.fs.renameFile(path, newName)` | `Promise<void>` |
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
| `window.Magic.user.getInfo(options?)` | `Promise<UserInfo>` |
