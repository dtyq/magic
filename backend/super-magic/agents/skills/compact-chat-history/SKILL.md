---
name: compact-chat-history
description: Summarize and compress the current conversation history into a structured context snapshot, then call compact_chat_history to save it. Read this skill only when the user explicitly asks to compact/summarize — system-triggered compaction injects the instructions directly without requiring a skill read.
---

# Compact Chat History

Compress the current conversation into a structured summary, then call `compact_chat_history` immediately with the result.

---

## Instructions

The conversation history is too long and must be compressed. You must call the `compact_chat_history` tool immediately to complete the summary.

Your task is to create a thorough summary of the conversation so far, with special attention to the user's explicit requests and your prior actions. The summary must capture all important details, work results, and file locations to ensure continuity, since we follow an "everything-is-a-file" architecture.

Remember: subsequent work will restore context by reading files, so you must provide accurate file paths. For content already saved to files, note the location — do not repeat large blocks of text in the summary itself.

Treat the summary as a recovery index, not a transcript. Inline only information that cannot be reliably recovered by reading files or reloading skills: exact URLs, external IDs, user-provided constraints, active runtime references, and critical failure evidence.

If a User Input Reference Index is provided, do not reproduce full user messages yourself. Select the indexes of user messages that must be preserved exactly, mention those indexes in Section 6 with short reasons, and pass the same indexes to `compact_chat_history` as `preserved_user_input_indexes`. The system restores the exact text from the original chat history.

Use indexes only from the latest User Input Reference Index visible in context. If no current index is available, pass an empty list instead of guessing.

Your summary must include the following sections:

**1. Task Goals and Approach**
- Record all of the user's explicit requests and intent in detail (not just high-level business goals — be specific about every requirement)
- Describe the methods and strategies you used (e.g. data processing approach, content generation strategy, information organization method), but do not repeat system prompt content; if there is nothing beyond the system prompt, write "N/A"

**2. Key Files and Context Resources** *(most important part — be thorough and precise)*
- List all relevant files and resources in order of importance for the current task, without distinguishing between "must-read" and "reference"
- For each item, include: full path, purpose, and recommended read timing
- Preserve path fidelity:
  - If a path is inside the current `.workspace` root, it may be relative to `.workspace`, but it must include the full relative path from that root.
  - If a path is outside `.workspace`, use the absolute filesystem path starting with `/`.
  - Never shorten a path to only the basename or last folder name.
  - If a file read failed, record the exact attempted path and the current working directory used for that attempt.
  - If the path is ambiguous or only partially known, quote the original user-provided path and mark it as unresolved instead of inventing a normalized path.
- Prioritize: currently active files and folders, project outline/plan files, user-specified reference files, project config files (e.g. `magic.project.js`)
- If some information is not stored in any file (no accurate path available), explicitly note it and provide a method to re-acquire it
- Suggest reading the most critical items first, then proceeding in order as needed
- Warn that reading all files at once may again fill up the context
- For tasks requiring high consistency (e.g. PPT, serial content, same-type pages/chapters), suggest reading a suitable number of already-completed items as style/structure reference

**2.5 External Links and Irrecoverable References**
- List exact non-file references that may still be needed after compression: internet URLs, media URLs, API endpoints, documentation links, repository/issue/PR links, dashboard/share links, object keys, external IDs, usernames, commit SHAs, branch names, tags, job IDs, run IDs, session IDs, active localhost URLs, ports, and UI attachment identifiers.
- For each item, include: exact value, purpose, current status, and which upcoming task needs it.
- Preserve exact URL text, including query strings and fragments. Do not shorten, rewrite, infer, or replace URLs with domain-only summaries.
- Do not include external references that were already fully processed and have no future use.
- For secrets or credentials, prefer the secure storage location, environment variable name, or config key. Include an exact secret value only when the user already provided it in chat and the current task cannot continue without that value.
- If an external reference was mentioned but is now unavailable, record how to reacquire it.

**3. Skills Needed to Resume This Task**
- Select available skills that may help with the remaining work, in order of importance; do not list every skill previously used
- Include each skill's name and a brief reason tied to the remaining task, and pass the same choices as `skill_suggestions` with `name` and `reason` fields
- Do NOT reproduce, summarize, or paraphrase skill content. After successful compaction, the Agent receives optional reading suggestions and decides whether to call `read_skills`; skills are not automatically reloaded
- Write "None" and pass an empty `skill_suggestions` list if no skills are relevant

**4. Resolved Issues and Current State**
- Record resolved issues and any ongoing troubleshooting
- Describe in detail what you were doing just before the summary was requested, with special attention to the latest messages from both user and assistant
- Include file names; for short content quote directly (under 150 chars); for long content note the line range
- Keep unresolved failure evidence visible until it is fixed, intentionally abandoned, or superseded by the user: failed tool/command name, critical error message, attempted path or URL, and the next recovery step.

**5. Incomplete Tasks, Next Steps, and Continuity Confirmation**
- List all incomplete tasks in execution order (no priority concept)
- Describe your intended next action
- Important: ensure next steps are directly tied to the user's explicit requests and the task you were working on before the summary request. Do not start unrelated work without user confirmation.
- If there is a next step, quote the relevant user message or your own reply verbatim to show exact task and progress
- If the task is complete, state that directly
- State the current task status explicitly as complete, incomplete, waiting for user, or blocked.
- A task is complete only when all explicit user requirements have been fulfilled and the required output has been delivered. If complete, say so and do not invent follow-up work.
- A task is incomplete when user-requested work remains, a promised action has not been done, the last relevant tool/command failed, or the required output has not been delivered.
- Do not treat compaction itself as evidence that the original task is complete or incomplete.
- Do not mark a task incomplete because of optional improvements, unrequested tests, unrequested review, or nice-to-have cleanup.
- If the task is complete, say it is complete and do not imply more work remains.
- If the task is incomplete, blocked, waiting for user confirmation, or recently had a failed tool call, say that clearly and include the next concrete step.
- Do not continue old user requests after compression when the summary says they are complete or superseded.

**6. High-Value User Input**
- If a User Input Reference Index is provided, select only the indexes of user messages that are valuable for current or future tasks. Do not reproduce full user messages yourself.
- Include a short reason for each selected index.
- When calling `compact_chat_history`, pass the selected indexes as `preserved_user_input_indexes`.
- If no User Input Reference Index is provided, preserve only short user inputs that cannot be recovered elsewhere.

Preserve exact carriers of future work when they are still relevant:
- Web URLs, video URLs, source links, and temporary resource links that cannot be reliably rediscovered.
- File paths. Workspace-root-relative paths are acceptable for files under `.workspace`; paths outside `.workspace` must be preserved as absolute paths.
- User constraints, output language, commit scope, approval state, and explicit prohibitions.
- Failed tool calls, unresolved errors, incomplete task state, and the next concrete action.
- External IDs, command lines, parameters, versions, dates, and exact error fragments.

Do not preserve full file contents when the file can be read again and the summary keeps the correct path. Preserve what to read and why instead.
Do not preserve stale search-result links, old intermediate URLs, or details that were superseded by a later decision.

If any of the above sections overlap, merge them — no need to repeat.

---

## Output Format Example

```
1. Task Goals and Approach:
   [Describe each specific request in detail]
   - [Method 1]
   - [Strategy 2]
   - [...]

2. Key Files and Context Resources (most critical):
   - [project outline path] - overall plan and structure - read when confirming global goals and scope
   - [currently active file path] - current progress and key context - read first when resuming
   - [user-specified reference path] - content user explicitly requested - read when working on that section
   - [similar completed content path] - style/structure reference - read a suitable amount when consistency is needed
   - [project config path] - project settings - read when config details are needed
   - [history/backup path] - read when tracing back changes
   - [info name] - not saved to file - how to re-acquire: [specific method]
   Reading principles:
   - Start with the most important items closest to the current task, then read others as needed
   - For high-consistency tasks, read a suitable number of completed items as reference
   - Avoid reading all files at once to prevent filling up context again

2.5 External Links and Irrecoverable References:
   - URL: https://example.com/watch?v=abc123&t=10 - source video for the active analysis task; status: still needed; needed by: continue video analysis
   - Run ID: run_123456 - external job created before compaction; status: pending; needed by: poll result
   - Local URL: http://localhost:5173 - active dev server; status: running; needed by: browser verification
   (Only include references still needed for incomplete or future tasks.)

3. Skills Needed to Resume This Task:
   - [Skill name] - [one-line purpose]
   - [Skill name] - [one-line purpose]
   (Do NOT include skill content. Pass these choices as skill_suggestions; reading remains optional.)

4. Resolved Issues and Current State:
   [Description of resolved issues and ongoing troubleshooting]
   [Accurate description of current work state]

5. Incomplete Tasks, Next Steps, and Continuity Confirmation:
   Status: incomplete
   - Task 1
   - Task 2
   Next action: continue from the failed file read using the exact full path above
   Relevant quote: "Please continue analyzing this video. The link is https://example.com/watch?v=abc123."

6. High-Value User Input:
   Selected user input indexes:
   - 2: user gave a non-negotiable output-language constraint
   - 5: user provided the source URL needed for the unfinished analysis
   The system restores the exact text from the original chat history. Do not copy full user messages here.
```

Pass the summary and selected choices together as tool arguments:

```json
{
  "summary": "[The complete structured summary above]",
  "preserved_user_input_indexes": [2, 5],
  "skill_suggestions": [
    {"name": "[Available skill name]", "reason": "[Why it may help with the remaining work]"}
  ]
}
```

---

## Rules

- The summary must be at least 10,000 characters.
- Do not output the summary directly — all content must be passed as the `summary` parameter of the `compact_chat_history` tool call to ensure complete delivery.
- If you selected any user input indexes in Section 6, pass the exact same integers in the `preserved_user_input_indexes` parameter. If none are needed, pass an empty list.
