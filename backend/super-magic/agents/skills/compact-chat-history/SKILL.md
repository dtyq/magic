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

Your summary must include the following sections:

**1. Task Goals and Approach**
- Record all of the user's explicit requests and intent in detail (not just high-level business goals — be specific about every requirement)
- Describe the methods and strategies you used (e.g. data processing approach, content generation strategy, information organization method), but do not repeat system prompt content; if there is nothing beyond the system prompt, write "N/A"

**2. Key Files and Context Resources** *(most important part — be thorough and precise)*
- List all relevant files and resources in order of importance for the current task, without distinguishing between "must-read" and "reference"
- For each item, include: full path, purpose, and recommended read timing
- Prioritize: currently active files and folders, project outline/plan files, user-specified reference files, project config files (e.g. `magic.project.js`)
- If some information is not stored in any file (no accurate path available), explicitly note it and provide a method to re-acquire it
- Suggest reading the most critical items first, then proceeding in order as needed
- Warn that reading all files at once may again fill up the context
- For tasks requiring high consistency (e.g. PPT, serial content, same-type pages/chapters), suggest reading a suitable number of already-completed items as style/structure reference

**3. Skills Needed to Resume This Task**
- List skills that are helpful or relevant to continuing the current task, in order of importance
- Include skill name and purpose
- Write "None" if there are no relevant skills

**4. Resolved Issues and Current State**
- Record resolved issues and any ongoing troubleshooting
- Describe in detail what you were doing just before the summary was requested, with special attention to the latest messages from both user and assistant
- Include file names; for short content quote directly (under 150 chars); for long content note the line range

**5. Incomplete Tasks, Next Steps, and Continuity Confirmation**
- List all incomplete tasks in execution order (no priority concept)
- Describe your intended next action
- Important: ensure next steps are directly tied to the user's explicit requests and the task you were working on before the summary request. Do not start unrelated work without user confirmation.
- If there is a next step, quote the relevant user message or your own reply verbatim to show exact task and progress
- If the task is complete, state that directly

**6. High-Value User Input**
- Verbatim quotes of user messages that are valuable for the current or future tasks — must be complete and unaltered; do not paraphrase or omit details the user expressed

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

3. Skills Needed to Resume This Task:
   - [High] [Skill name] - [purpose]
   - [Medium] [Skill name] - [purpose]
   - [Low] [Skill name] - [purpose]

4. Resolved Issues and Current State:
   [Description of resolved issues and ongoing troubleshooting]
   [Accurate description of current work state]

5. Incomplete Tasks, Next Steps, and Continuity Confirmation:
   - Task 1
   - Task 2
   - [...]
   [Optional next action plan]
   [Current task and progress, or task completion notice]

6. High-Value User Input:
   Verbatim quotes of user messages that are valuable — complete and unaltered
```

---

## Rules

- The summary must be at least 10,000 characters.
- Do not output the summary directly — all content must be passed as the `summary` parameter of the `compact_chat_history` tool call to ensure complete delivery.
