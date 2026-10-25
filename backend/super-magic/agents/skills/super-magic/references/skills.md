# Skill projects and publication

Use this workflow when a user wants to turn the current conversation into a reusable skill, publish it, or edit a skill from another topic. A Skill owns a dedicated project containing editable source files. Each release is a fixed snapshot. The current conversation stays in its original project.

## Discover or create

- `list_skills(keyword="", scope="created", page=1, page_size=20)` finds skill projects. `scope="collaborated"` finds collaborations. Ordinary `list_projects` excludes skill projects; an empty ordinary project list does not mean the skill is missing.
- `get_skill(code=...)` reads a known skill; `get_skill(project_id=...)` resolves an @ project or file reference to its skill. Supply exactly one identifier. Check the returned role and real `project_id`; installed market skills do not grant access to the author's source project.
- `create_skill(name, description)` creates a private draft and binds its dedicated project. It does not publish or install. Use the returned exact `skill_code` and `project_id`, even when another skill has the same display name. On an uncertain response, retry with the returned `request_id` within 24 hours instead of creating another draft. `existing_skill_code` explicitly repairs a missing binding for a skill the user owns; it never replaces an existing project.

Read `skill-creator` for authoring and validation. Extract reusable procedures, inputs, corrections, output requirements, and supporting resources from the conversation; do not publish a transcript, private credentials, or unrelated conversation data. Read topic history only when needed to fill the current conversation's gaps.

Access the returned project through the referenced-project mount described in [Files](files.md). Never create a substitute local mount directory. Write source files directly there:

```text
.magic/skills/skill_config.yaml   # skill: {dir: <directory>}
.magic/skills/<directory>/SKILL.md
.magic/skills/<directory>/references|scripts|assets/
```

For updates, read the existing config and files first. Preserve the same skill code, project, and package directory unless the user requests a package rename. Edit in place, never delete the whole skill directory or re-import a ZIP to simulate an update. A request only to modify saves the draft without publishing.

## Prepare, review, confirm, publish

1. Validate source with `skill-creator/scripts/quick_validate.py`. Keep temporary packages and review material in `.runtime/skill-publish/`, not the project's persistent files.
2. Call `prepare_skill_publish(code, name=None, description=None, publish_target_type=None, version=None)`. First release defaults to PRIVATE; updates retain the currently effective scope. Supported explicit scopes are PRIVATE, ORGANIZATION, MARKET. An existing MEMBER release requires the user to choose a supported scope explicitly. Do not guess a version number; omit it to use the server suggestion. If status is processing, resume with the returned `publish_task_id`; other supplied fields do not alter that preparation.
3. Read `skill-vetter` and review every file in the returned `snapshot_path`, including scripts and references. These bytes match the exported package's manifest. Resolve problems in the source project and prepare again. The runtime review snapshot is not the editable source and must not be edited to "fix" a release.
4. Show the name, description, target scope, version, useful source-file preview, and a short account of the actual changes. Then call `ask_user(prepared_tool_call_id=...)`; omit `questions`. The runtime supplies the exact bound confirmation. Allow the user to change name, description, scope, or content: make those changes and prepare again. A remark requesting changes, refusal, timeout, or cancellation is not approval. A cancelled release leaves the private draft intact.
5. After explicit approval, call `publish_skill(prepared_tool_call_id=...)` using the same preparation ID. The runtime reads its bound human approval; no confirmation ID or boolean approval is needed from the model. While the confirmation card is pending, wait for its answer instead of preparing or asking again.
6. Read the result. PRIVATE is published immediately; ORGANIZATION and MARKET are submitted for review. Report that distinction and the exact skill/project/version. Do not install automatically. Product users can find their draft in My Skills and reference its project or files through `@ → other projects/files → My Skills`.

```python
from sdk.tool import tool

prepared = tool.call("prepare_skill_publish", {"code": "<verified-skill-code>"})
print(prepared.content)
# Review the fixed snapshot with skill-vetter, then ask the human in a separate step.
```

Call the direct `ask_user` tool with `prepared_tool_call_id="<ID returned by preparation>"` and omit `questions`. After that card is explicitly approved, run a new snippet:

```python
from sdk.tool import tool

published = tool.call("publish_skill", {"prepared_tool_call_id": "<same preparation ID>"})
print(published.content)
```

If publication is interrupted or the response is lost, call `get_skill_publish_result(code, publish_task_id=<prepare-token>)` before retrying. Retrying `publish_skill` uses the same confirmed token and recovers an existing release. Without a task ID, the result tool lists recent versions; a recent version alone does not prove that an uncertain request succeeded. Preparations expire after 24 hours; expired, changed-source, changed-permission, or version-conflict results require another preparation and confirmation. Only the already confirmed package is published; later edits remain draft changes.

Retry according to the actual failure. `processing` means continue the same task with pauses. Unavailable source files require checking the exact project's configured mount and access permissions first; once restored, resume the same preparation. A source-content or version conflict requires a new preparation after fixing the source. For an unexpected error, retain the task ID and report the blocker; repeated polling or exporting the unchanged skill cannot fix a local runtime failure. Do not recreate the skill, switch publication scopes, or repeatedly rewrite valid source files to work around an infrastructure error.
