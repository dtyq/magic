# TiptapJSONContent Reference

`createTopicAndSend` and `sendMessage` accept tiptap JSON with `@` mention nodes.

## Structure

```typescript
interface TiptapJSONContent {
  type: string;          // "doc", "paragraph", "text", "mention"
  attrs?: Record<string, unknown>;
  content?: TiptapJSONContent[];
  text?: string;
}
```

## Mention Types

### `micro_app` (host-injected)

Published micro-app previews automatically receive a leading `micro_app` mention from the host when calling Agent APIs. Micro-app code must not provide `app_id`, `project_id`, or a new API option for this context.

```javascript
{type: "mention", attrs: {type: "micro_app", data: {
  app_id: "published_app_id",
  app_name: "Inventory Assistant"
}}}
```

The referenced project is mounted read-only for Agent-side companion skills. The host resolves and validates the project; iframe code must not forge this mention.

### `project_file`

```javascript
{type: "mention", attrs: {type: "project_file", data: {
  file_id: "file_abc123",
  file_name: "report.csv",
  file_path: "data/report.csv",  // workspace-root-relative
  file_extension: "csv",
  file_size: 1024,               // optional
}}}
```

| Field            | Required | Description                  |
| ---------------- | -------- | ---------------------------- |
| `file_id`        | Yes      | File unique ID               |
| `file_name`      | Yes      | Filename with extension      |
| `file_path`      | Yes      | Workspace-root-relative path |
| `file_extension` | Yes      | Extension without `.`        |
| `file_size`      | No       | Bytes                        |

### `project_directory`

```javascript
{type: "mention", attrs: {type: "project_directory", data: {
  directory_id: "dir_456",
  directory_name: "docs",
  directory_path: "docs",
  directory_metadata: {version: "1", type: "folder", name: "docs"}
}}}
```

| Field                | Required | Description                              |
| -------------------- | -------- | ---------------------------------------- |
| `directory_id`       | Yes      | Directory unique ID                      |
| `directory_name`     | Yes      | Directory name                           |
| `directory_path`     | Yes      | Workspace-root-relative path             |
| `directory_metadata` | Yes      | Object with `version?`, `type?`, `name?` |

### `skill`

```javascript
{type: "mention", attrs: {type: "skill", data: {
  id: "skill_unique_id",
  name: "Web Search",
  icon: "https://...",
  description: "Search the internet for information",
  mention_source: "system",  // optional: "system"|"agent"|"mine"
}}}
```

| Field            | Required | Description                        |
| ---------------- | -------- | ---------------------------------- |
| `id`             | Yes      | Platform-assigned skill ID         |
| `name`           | Yes      | Display name                       |
| `icon`           | Yes      | Icon URL                           |
| `description`    | Yes      | Description text                   |
| `mention_source` | No       | `"system"`, `"agent"`, or `"mine"` |

## `@skill` vs `@file .magic/skills/<name>/SKILL.md`

- `@skill` → platform-registered skill, resolved by platform
- `@file` with `.magic/skills/<name>/SKILL.md` → workspace companion skill, agent reads as instructions
- Host-prepended `@micro_app` is the identity for published-app tasks; companion skills on the source project are loaded with `read_skills(..., project_id=...)` from that mention, not via `@skill` and not from the current runtime-project workspace

## Example

```javascript
const basePath = await window.Magic.getAppBasePath();
await window.Magic.project.sendMessage({
  type: "doc",
  content: [{type: "paragraph", content: [
    {type: "text", text: "Compare "},
    {type: "mention", attrs: {type: "project_file", data: {
      file_id: "f1", file_name: "sales.csv",
      file_path: basePath + "data/sales.csv", file_extension: "csv"
    }}},
    {type: "text", text: " with "},
    {type: "mention", attrs: {type: "project_directory", data: {
      directory_id: "d1", directory_name: "reports",
      directory_path: "output/reports",
      directory_metadata: {type: "folder", name: "reports"}
    }}}
  ]}]
});
```
