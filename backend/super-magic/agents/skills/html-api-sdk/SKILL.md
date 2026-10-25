---
name: html-api-sdk
description: "Complete API reference for window.Magic.* in SuperMagic HTML micro-apps (HTML 微应用). Read this skill when you need exact method signatures, parameters, return types, or usage examples for: fs (readFile/writeFile/listFiles/listDir/getFileUrl/deleteFile/deleteDir/moveFile/renameFile/watchFile/watchDir), llm (chat/stream/getModels), agent (getAgents/selectAgent), project (createTopicAndSend/sendMessage/uploadFiles/downloadFiles), user (getInfo with app.json userInfo scopes), getAppBasePath, setInputMessage, reload. Also covers file-per-record data storage, list projection file names, tiptap JSON message format, @file and @skill mention structures, model selector UI rules, user info authorization, error handling patterns, and backward compatibility table. Trigger phrases: 'window.Magic API', 'readFile writeFile', 'listDir watchDir', 'getFileUrl', 'get file url', '文件 URL', '获取文件链接', 'deleteFile deleteDir', 'moveFile renameFile', 'watchFile callback', 'watchDir callback', 'llm.stream', 'llm.chat', 'createTopicAndSend format', 'tiptap JSON mention', '@file mention structure', '@skill mention', 'getAppBasePath usage', 'model selector UI', 'user.getInfo', 'get user info', 'user avatar', 'userInfo scopes', 'app.json permissions', 'Magic API 用法', 'fs 读写文件 API', 'fs 获取文件链接', 'fs 删除文件', 'fs 移动重命名', '目录监听', '文件监听回调', '话题消息格式', 'mention 结构', '模型选择器', '用户信息', '用户授权', '获取头像'."
---

# window.Magic API — HTML Micro-App Guide

## How to Use This Document

- API signatures & constraints → this document
- App manifest & permission declarations → `app.json`
- TiptapJSON & @mention structures → [references/tiptap-json-format.md](references/tiptap-json-format.md)
- Complete HTML examples → [references/complete-examples.md](references/complete-examples.md)

## Important Constraints

1. All `window.Magic.*` APIs are **pre-injected** — no imports needed. External CDN allowed.
2. File paths are relative to **app root** (`index.html` dir) by default. `../` is forbidden. Use leading-slash paths such as `"/shared/data.json"` to access project-root files. Writing, deleting, moving, or renaming files outside the app root triggers host confirmation.
3. `window.Magic.llm` tokens hosted; no `api_key` in HTML.
4. **No inline event handlers** — use `addEventListener`. For buttons rendered by `innerHTML`, bind one delegated listener on a stable container and use `data-action`/`data-id`.
5. **LLM and Agent calls must include model selector UI** unless the user specifies a fixed model. Load the available models with `window.Magic.llm.getModels()`, render them in the page, and preselect the first available model. Do not guide users to use `"auto"` as the default selection.
6. **Complex file-based AI** → use `createTopicAndSend` with the task; published micro-app previews automatically provide `@micro_app` context so the Agent can inspect companion skills. Use an explicit `@file` only when selecting one exact skill. Simple → `readFile` + `llm.chat/stream`.
7. **High-risk APIs are permission-gated** — new HTML micro-apps must declare requested scopes in `app.json.permissions.scopes`. The host asks the user to approve high-risk runtime calls for a limited duration.
8. **User info is privacy-gated** — `window.Magic.user.getInfo()` returns only `name` and `avatar` by default. Sensitive fields require a matching permission declaration, a runtime `getInfo({ scopes, reason })` request, and user confirmation.
9. **Use `app.json` as the micro-app manifest** — every new HTML micro-app folder should include `app.json` next to `index.html`. Put `type`, `name`, `entry`, `anonymous`, file aliases, watch hints, and permissions there. Also generate a minimal `magic.project.js` display bridge that mirrors `version/name/entry/icon`; new bridges use `type: "html-app"`, while existing `type: "micro-app"` bridges remain compatible. Do not put `anonymous`, permissions, files, watch, or business state in `magic.project.js`.

   ```json
   {
     "version": "1.0.0",
     "type": "micro-app",
     "name": "App Name",
     "entry": "index.html",
     "anonymous": false,
     "files": {},
     "watch": [],
     "permissions": {
       "scopes": [],
       "reason": ""
     }
   }
   ```

10. **Administrator page access is runtime-controlled** — when an app has administrator-only pages, put `window.MagicAppConfig.admin_pages` in the shared `app.js` and call `window.Magic.db.getProjectAdminAccess()` before loading each listed page. The result is based on the real logged-in user; a share token is only an access proof and is never a user identity.

---

## HTML Interaction Safety

Generated micro-app controls must be wired through real JavaScript listeners, not HTML event attributes.

- Do not generate `onclick`, `onchange`, `oninput`, `onsubmit`, or other inline event attributes.
- For lists, cards, table rows, and menus rendered with `innerHTML`, use event delegation: `container.addEventListener("click", handler)` and buttons such as `<button data-action="edit" data-id="...">`.
- Do not attach action functions to `window` just to make inline event handlers work.
- If using `new FormData(form)`, every value read with `formData.get("field")` must have a matching `name="field"` on the input/select/textarea. Having only `id="field"` is not enough.
- Before calling `.trim()`, normalize possibly missing form values, for example `String(formData.get("title") || "").trim()`.
- If a form is read by DOM IDs instead, use `.value` consistently and do not mix it with `FormData.get()` for unnamed controls.

## 1. File System (`window.Magic.fs`)

### `readFile(path)` → `Promise<string>`

```javascript
const raw = await window.Magic.fs.readFile("data/tasks/20260624153000__open__a8f3k2__follow-up.json");
const task = JSON.parse(raw);
```

- `path: string` — relative to app root. Max 5 MB; rejects if not found.

### `writeFile(path, content)` → `Promise<void>`

```javascript
await window.Magic.fs.writeFile(
  "data/tasks/20260624153000__open__a8f3k2__follow-up.json",
  JSON.stringify(record, null, 2),
);
// Binary (up to 500 MB):
await window.Magic.fs.writeFile("data/large.bin", blob);
```

- `content: string | Blob | ArrayBuffer`. String max 5 MB. Auto-creates dirs. `../` blocked.

> ⚠️ Paths relative to `index.html` dir, NOT workspace root.

### File Paths and Project-Root Access

By default, relative `window.Magic.fs.*` paths resolve inside the app folder next to `index.html`. Use a leading slash for project-root paths. Project-root reads require `fs.project.read`; project-root writes/deletes/moves/renames require `fs.project.write` plus a host path confirmation for each destructive operation.

Path rules:

- `"data/config.json"` -> app root, e.g. `my-app/data/config.json`.
- `"/shared/config.json"` -> project root.
- `"/"` lists project-root entries.
- `../` remains blocked in all scopes.
- Reading project-root file contents or temporary URLs requires `fs.project.read`.
- Writing, deleting, moving, or renaming files outside the app root requires `fs.project.write`, then triggers host path confirmation and may be rejected by the user.
- `listFiles("/")` and `listDir("/")` are not gated in the current version, but do not depend on them for sensitive directory discovery.

### `listFiles(dir?)` → `Promise<string[]>`

```javascript
const files = await window.Magic.fs.listFiles("data/");
```

- Compatibility API. It returns direct child names only. Prefer `listDir()` for new list UIs.

### `listDir(dir?)` → `Promise<Array<{name,path,isDirectory,updatedAt?}>>`

```javascript
const entries = await window.Magic.fs.listDir("data/tasks/");
entries
  .map((entry) => parseRecordFileName(entry.name))
  .filter(Boolean)
  .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
```

- Returns direct children only. It does not read file contents.
- Use it for list pages. Read the JSON detail only when the user opens, edits, or analyzes one record.
- `path` is usable with `readFile`, `writeFile`, `deleteFile`, `moveFile`, and `renameFile`.

### `getFileUrl(path)` → `Promise<string>`

```javascript
const imageUrl = await window.Magic.fs.getFileUrl("assets/chart.png");
document.getElementById("preview").src = imageUrl;
```

- Returns a temporary browser-accessible URL for an existing workspace file.
- Use it for previews, `<img>`, `<audio>`, `<video>`, download links, or libraries that need a URL instead of file text.
- It does not download the file by itself. Use `window.Magic.project.downloadFiles(paths)` when the user action should trigger a browser download.
- Rejects if the file is missing or the path is invalid. `../` blocked.

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

### `watchDir(dir, cb)` → `() => void`

```javascript
const unwatch = window.Magic.fs.watchDir("data/tasks/", (event) => {
  // renameFile that changes projection appears as removed + added.
  // Use parseRecordFileName(name).shortId to match the same record.
  renderList(event.entries);
});
```

- Not a real-time filesystem watcher. It compares refreshed host attachment snapshots after the existing attachment polling or `Update_Attachments` refresh.
- Watches direct child additions and removals only. File content changes continue to use `watchFile()`.
- Callback payload: `{ dir, timestamp, added, removed, entries }`.

### Concurrent Reads

```javascript
const [config, selectedTask] = await Promise.all([
  window.Magic.fs.readFile("data/config.json").then(JSON.parse),
  window.Magic.fs.readFile(selectedEntry.path).then(JSON.parse),
]);
```

### Shared Data Storage Rules

For generated CRUD micro-apps, assume multiple users may share the same app.

- Config or single current state may use one overwritable file, such as `data/config.json`.
- User-created business records must default to one file per record, such as `data/tasks/<record-file>.json`.
- List pages must render from `listDir()` entries and file-name projection; do not batch `readFile()` every record just to draw a list.
- Event logs and history should be append-only multi-file records, such as `data/events/<timestamp>__<id>.json`.
- Reports, analysis output, and caches may be overwritten because they are derived artifacts.
- For more than 500 expected records, bucket by month or business status, such as `data/tasks/2026-06/` or `data/tasks/open/`, and use pagination or virtual scrolling.

Record file names are list projections only:

```text
<sortKey>__<status>__<shortId>__<titleSlug>.json
```

Required helpers in generated apps:

- `buildRecordFileName(record)`
- `parseRecordFileName(name)`
- `slugifyTitle(title)` — lowercase English letters, digits, hyphens only; return `record` when unsafe or not representable.
- `truncateUtf8Bytes(input, maxBytes)`

File-name limits:

- Hard limit: 255 bytes.
- Generation target: 120 bytes including `.json`.
- `titleSlug`: max 40 bytes by default.
- Forbidden: `/`, `\`, `<`, `>`, `:`, `"`, `|`, `?`, `*`, control chars, `..`, leading/trailing spaces.
- Never put phone numbers, addresses, notes, detailed amounts, private fields, or long text in file names.
- Always include stable `shortId`. Never use only the title.
- Sort lists by parsed `sortKey`, not by backend return order.

Update safety:

- Create: generate stable `id/shortId`, build the file name, then create the record file. If the target file exists in the same dir, regenerate `shortId`.
- Update non-projection fields: write JSON only.
- Update title/status/date projection fields: write JSON first, then `renameFile()`, preserving `shortId`.
- Before rename, call `listDir()` and block the rename if the target name already exists with a different `shortId`.
- If JSON and file-name projection disagree, list uses file name, detail uses JSON. Try a background rename repair only when it cannot overwrite another file.
- Complex filters across more than two detail fields, amount ranges, tag combinations, owners, or similar query needs require an index file or backend query capability.

---

## 1.5 `getAppBasePath()` → `Promise<string>`

```javascript
const basePath = await window.Magic.getAppBasePath();
// "personal-finance/" or "" (workspace root)
```

- `fs.*` paths → relative to app root by default: `"data/file.json"`; project-root paths use a leading slash such as `"/shared/file.json"`.
- `@file` mention `file_path` → prefix: `basePath + "data/file.json"`
- `.magic/` paths → use as-is (already workspace root)

---

## 2. LLM API (`window.Magic.llm`)

### `getModels()` → `Promise<Model[]>`

```javascript
const models = await window.Magic.llm.getModels();
// [{id, object?, owned_by?, icon?, label?, info?}]
```

The `model` field is required for LLM calls. The page model selector should display the returned models and preselect the first available model. Handle an empty model list before sending a request; do not use `"auto"` as the default selector value.

### `chat(messages, options?)` → `Promise<string>`

```javascript
const reply = await window.Magic.llm.chat(
  [{ role: "user", content: "How many planets?" }],
  // selectedModelId comes from the page model selector (default: first model)
  { model: selectedModelId },
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
  // selectedModelId comes from the page model selector (default: first model)
  { model: selectedModelId, maxTokens: 1000 },
);
```

`onChunk: (delta: string, done: boolean) => void`. Returns cancel fn.

`chat` and `stream` require `llm.use` in `app.json.permissions.scopes`.

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

Requires `project.files.upload` in `app.json.permissions.scopes`.

### 5.2 `downloadFiles(paths)` → `Promise<unknown>`

```javascript
await window.Magic.project.downloadFiles(["output/report.pdf"]);
```

Requires `project.files.download` in `app.json.permissions.scopes`.

### 5.3 `addFilesToMessage(filePaths, agentMode?)` → `Promise<unknown>`

```javascript
await window.Magic.project.addFilesToMessage(["data/report.csv"]);
```

Requires `project.message.write` in `app.json.permissions.scopes`.

### 5.4 `createTopicAndSend(message, options?)` → `Promise<{topicId}>`

Creates new topic. `message`: plain text or tiptap JSON (see [tiptap ref](references/tiptap-json-format.md)).

When this API is called from a published micro-app preview, the host automatically prepends the current micro-app as a trusted `@micro_app` mention. The referenced project is mounted read-only. Name the companion skill in the task message, for example `createTopicAndSend("Use the inventory_manager Skill to find low-stock products and generate replenishment suggestions.", { model: selectedModelId })`, where `selectedModelId` is chosen by the page model selector and defaults to the first available model. The Agent loads that companion skill with `read_skills(skill_names=["inventory_manager"], project_id=...)` using the mention's `project_id` on the first attempt for that skill; the current runtime-project workspace is not the skill source. System skills omit `project_id`. When a task needs one exact skill file, the app may still include an explicit `@file` mention.

```javascript
// Plain text
const { topicId } = await window.Magic.project.createTopicAndSend(
  "Analyze this",
  { model: selectedModelId },
);

// Tiptap JSON with @file mention (trigger companion skill)
const { topicId: t2 } = await window.Magic.project.createTopicAndSend(
  {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Read the skill file and execute it: " },
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
          { type: "text", text: "\n\nTask: generate a report" },
        ],
      },
    ],
  },
  { model: selectedModelId },
);
```

Options: `agentId?` (defaults general mode), `model?` (pass the model selected in the page model selector; default to the first available model). Timeout: 30s.

Requires `project.message.write` in `app.json.permissions.scopes`.

### 5.5 `sendMessage(message, options?)` → `Promise<void>`

```javascript
await window.Magic.project.sendMessage("Continue analyzing", { model: selectedModelId });
```

`selectedModelId` should come from the page model selector, which displays `getModels()` results and defaults to the first available model. Timeout: 15s.

Requires `project.message.write` in `app.json.permissions.scopes`.

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
    "scopes": ["user.profile.name", "user.profile.identity"],
    "reason": "Display the current user's profile"
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

- Sensitive scopes must be present in both `app.json.permissions.scopes` and the runtime `getInfo({ scopes })` call.
- `magic.project.js` is legacy for older HTML micro-apps and still used by other project types such as slides/design/media. It is not the HTML micro-app manifest.
- `reason` should explain why the app needs these fields; runtime `reason` overrides the `app.json` reason in the confirmation dialog.
- Approved sensitive scopes use the same host authorization store as other high-risk APIs. They remain valid only in the current browser tab for the duration selected by the user, and the user can revoke them from the HTML app authorization manager.
- Never assume identity or organization fields are available from a bare `getInfo()` call.

Timeout: 15s.

---

## 6.5 Permission Declaration

New HTML micro-apps must declare every high-risk scope they may request:

```json
{
  "version": "1.0.0",
  "type": "micro-app",
  "name": "Report Assistant",
  "entry": "index.html",
  "permissions": {
    "scopes": [
      "llm.use",
      "fs.project.read",
      "fs.project.write",
      "project.files.download",
      "project.message.write"
    ],
    "reason": "Read selected project files, call AI, and write generated reports back to the project"
  }
}
```

High-risk scopes:

| Scope | Required for |
| --- | --- |
| `llm.use` | `window.Magic.llm.chat`, `window.Magic.llm.stream` |
| `fs.project.read` | Project-root `fs.readFile("/...")`, `fs.getFileUrl("/...")` |
| `fs.project.write` | Project-root `fs.writeFile`, `deleteFile`, `deleteDir`, `moveFile`, `renameFile` |
| `project.files.upload` | `window.Magic.project.uploadFiles` |
| `project.files.download` | `window.Magic.project.downloadFiles` |
| `project.message.write` | `addFilesToMessage`, `createTopicAndSend`, `sendMessage` |
| `user.profile.name` | `user.getInfo({ scopes: ["user.profile.name"] })` |
| `user.profile.identity` | `user.getInfo({ scopes: ["user.profile.identity"] })` |
| `user.profile.organization` | `user.getInfo({ scopes: ["user.profile.organization"] })` |

Historical apps without `app.json` can still request high-risk APIs, but the host treats them as legacy apps: the user must approve the request, the approval duration is shorter, and the dialog warns that the app has no permission declaration. New apps should not rely on legacy behavior.

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
  return await window.Magic.llm.chat(messages, { model: selectedModelId });
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
  { model: selectedModelId },
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
| `window.Magic.fs.listDir(dir?)` | `Promise<DirEntry[]>` |
| `window.Magic.fs.getFileUrl(path)` | `Promise<string>` |
| `window.Magic.fs.deleteFile(path)` | `Promise<void>` |
| `window.Magic.fs.deleteDir(path)` | `Promise<void>` |
| `window.Magic.fs.moveFile(path, targetDir)` | `Promise<void>` |
| `window.Magic.fs.renameFile(path, newName)` | `Promise<void>` |
| `window.Magic.fs.watchFile(path, cb)` | `() => void` |
| `window.Magic.fs.watchDir(dir, cb)` | `() => void` |
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
