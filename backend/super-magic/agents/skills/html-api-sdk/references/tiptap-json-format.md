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

|Field|Required|Description|
|---|---|---|
|`file_id`|Yes|File unique ID|
|`file_name`|Yes|Filename with extension|
|`file_path`|Yes|Workspace-root-relative path|
|`file_extension`|Yes|Extension without `.`|
|`file_size`|No|Bytes|

### `project_directory`
```javascript
{type: "mention", attrs: {type: "project_directory", data: {
  directory_id: "dir_456",
  directory_name: "docs",
  directory_path: "docs",
  directory_metadata: {version: "1", type: "folder", name: "docs"}
}}}
```

|Field|Required|Description|
|---|---|---|
|`directory_id`|Yes|Directory unique ID|
|`directory_name`|Yes|Directory name|
|`directory_path`|Yes|Workspace-root-relative path|
|`directory_metadata`|Yes|Object with `version?`, `type?`, `name?`|

### `skill`
```javascript
{type: "mention", attrs: {type: "skill", data: {
  id: "skill_unique_id",
  name: "网页搜索",
  icon: "https://...",
  description: "搜索互联网获取信息",
  mention_source: "system",  // optional: "system"|"agent"|"mine"
}}}
```

|Field|Required|Description|
|---|---|---|
|`id`|Yes|Platform-assigned skill ID|
|`name`|Yes|Display name|
|`icon`|Yes|Icon URL|
|`description`|Yes|Description text|
|`mention_source`|No|`"system"`, `"agent"`, or `"mine"`|

## `@skill` vs `@file .magic/SKILL.md`
- `@skill` → platform-registered skill, resolved by platform
- `@file` with `.magic/<name>/SKILL.md` → workspace companion skill, agent reads as instructions

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
