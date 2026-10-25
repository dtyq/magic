---
name: crew-creator
description: |
    Manage and optimize custom crew definition files (IDENTITY.md, AGENTS.md, SOUL.md, TOOLS.md).
    Also handles first-time employee initialization when .magic/ has no IDENTITY.md, including
    guiding setup and generating the crew definition.
    Use when users want to edit crew identity, modify workflow instructions, adjust personality,
    add/remove tools, optimize prompts, or initialize a new employee from scratch.
    Trigger signals: 'modify prompt', 'change identity', 'add tool', 'remove tool', 'optimize workflow',
    'adjust personality', 'initialize employee', 'create employee'.
    Do NOT use for: skill creation (use skill-creator), skill searching (use find_skills tool).
---

# Crew Definition Manager

Manages the 4 core employee definition files under `.magic/`, helping users view, edit, and optimize their employee's identity, instructions, personality, and tool configuration.
Also handles first-time employee initialization when the workspace has no definition files.

## Language Generation Strategy

Determine the output language in this order:

1. If the user explicitly specifies an output language in the current request, use that language.
2. Otherwise, call `get_user_language` before generating or editing employee files:

```
get_user_language()
```

Read the selected language from `data.language`.

When the user has not specified a language, use the returned `language` as the primary language when writing prompts and employee files. The system-injected `<user_preferred_language>` is not the source of truth for this decision.

**Default single-language mode**: Generate all content in the selected language. YAML header uses single-language fields only.

Always generate single-language output. Do not ask for, generate, or maintain translations or language-specific duplicate sections.

## Employee Initialization Flow

When `.magic/IDENTITY.md` does not exist, the workspace has no employee yet and you should guide the user through initialization.

### Detection

Use `list_dir` to check `.magic/`. If `IDENTITY.md` is missing, enter the initialization flow.

### Information Gathering (ask the user conversationally)

Collect information in rounds; you may combine questions but don't overwhelm the user.

When collecting information with `ask_user`, prioritize clickable choices instead of rendering every question as a free-text field:

- Combine questions from the same round into one `ask_user` call when practical.
- Use `confirm` for yes/no decisions, especially the Round 4 skill-decomposition decision.
- Use `select` whenever 2-8 useful candidate answers can be offered, and `multi_select` when multiple answers may apply.
- Use `multi_select` for core functions and traits. Professional capabilities (use `multi_select`), Professional domains and specialties, and Working style should prioritize clickable options; do not ask the user to rewrite the same information as free text.
- Use `input` only for the employee name, values the user must enter precisely, and genuinely open-ended descriptions that cannot be usefully enumerated.
- For employee role, work focus, communication style, and workflow type, derive 3-6 concrete options from the name and requirements already provided instead of defaulting to `input`.
- Give each option a short explanation that makes the tradeoff clear; do not provide bare abstract labels.

**Before gathering, determine the language using the priority above**. Communicate and collect information in the selected language.

**Round 1 (required)**:
1. **Employee name**: Ask in the selected language (e.g., for English users: "What name would you like to give your employee?")
2. **Employee role**: (e.g., "What role will this employee take on?")
3. **One-line description**: What does this employee mainly do?

Do not ask for translations or offer multilingual output.

**Round 2 (recommended but optional)**:
4. **Role definition**: A richer description of capabilities, expertise, and working style (goes into IDENTITY.md body)
5. **Personality and communication style**: What personality should the employee have? (e.g. rigorous, lively, concise) (goes into SOUL.md)

**Round 3 (required)**:
6. **Workflow / rules**: What workflow should this employee follow? What special rules apply? (goes into AGENTS.md)

Workflows must be split into clear, independently executable processes. Each process should be designed to call one independent skill; do not pile multiple complex workflows into AGENTS.md.

**Round 4 (required decision)**:
7. **Skill decomposition decision**: After collecting the workflow, explicitly ask whether the independent processes should be created as separate skills. Do not infer consent from silence, and do not finish initialization before receiving a clear yes/no answer.
8. If the user chooses yes, summarize the proposed skill boundaries, then load `skill-creator` and follow its plan, confirmation, conflict-check, creation, and validation workflow once for each independent process.
9. If the user chooses no, record that decision in the initialization summary and keep the workflow in `AGENTS.md`. If the user is unsure, explain the tradeoff and ask again; do not silently choose.

Round 2 may be skipped. If the user has not provided workflow / rules for Round 3, initialization cannot be completed and the conversation must continue until they provide them. Round 4 is a required decision gate even when the user ultimately chooses no.

### Generating Files

After collecting info, write a JSON config and call the init script:

**Single-language mode (default)**:

Use the selected language for all generated values. Do not add `_en`/`_cn` translation fields.

```python
# Write collected info as JSON config using only the selected language.
write_file(
    path=".crew_init_config.json",
    content='{"name": "Research Assistant", "role": "Academic Researcher", "description": "A professional research assistant", "role_body": "You are an academic researcher...", "instructions": "...", "personality": "..."}'
)

# 2. Call the init script only after the skill-decomposition decision is recorded.
shell_exec(
    command="python '<skill_dir>/scripts/init_crew.py' --config .crew_init_config.json"
)
```

The init script first checks the current directory, then the project's `.workspace` directory and project root for a relative config path. The command does not require copying the config into the skill directory.

The script generates files based on the config (TOOLS.md and SKILLS.md are intentionally not created by the initialization script — the system uses defaults):
- `IDENTITY.md` — always generated (YAML header + role definition body)
- `AGENTS.md` — generated if workflow instructions were provided
- `SOUL.md` — generated if personality was provided

### Employee Logo Generation

After `init_crew.py` completes successfully and employee definition files are ready, generate the employee Logo (Avatar):

1. **Extract Identity and Personality**:
   - Read `.magic/IDENTITY.md` to extract name, role, description, and capability characteristics.
   - Read `.magic/SOUL.md` (if present) to extract personality traits, aesthetic preferences, and communication style.
2. **Assemble Generation Prompt**:
   - Refer to `references/avatar-generation-guide.md`.
   - Assemble a prompt combining style prefix, character identity (must depict a close-up face/head avatar of a person, never pure objects, tools, or logos), professional visual elements (as subtle attire collar or styling), personality temperament, background color scheme, and quality suffix.
3. **Generate Image and Save Locally**:
   - Call `generate_images` with `size="1024x1024"` to generate 1 square image.
   - Save directly to `.magic/logo.png` (or `.magic/logo.jpg`) under workspace `.magic/` root (never prepend `.workspace/`, never place in `assets/`).
   - Update `.magic/IDENTITY.md` YAML frontmatter to set `icon: .magic/logo.png` (or `.magic/logo.jpg`).
   - Validate that the image is square and its size does not exceed `500KB` (convert to high-quality JPG if necessary).
   - Preserve existing custom logos if user already provided one and did not request replacement.

### Mandatory Initialization Completion Gate

Creating or validating definition files is not the end of initialization. After the files and any requested skills are ready, execute this sequence before cleanup or the final response:

1. Generate the employee Logo based on `.magic/IDENTITY.md` and `.magic/SOUL.md` (if present) and save directly to `.magic/logo.png` (or `.magic/logo.jpg`). Ensure `icon: .magic/logo.png` is written into `.magic/IDENTITY.md`.
2. Run the verification script:
```python
shell_exec(
    command="python '<skill_dir>/scripts/check_crew.py'"
)
```
3. Verify that `check_crew.py` returns `"ok": true`. If any error is returned, fix the issues immediately before proceeding.

**Do not delete `.crew_init_config.json`, announce completion, or return the final initialization summary until definition files, Logo generation, and `check_crew.py` verification have passed.**

If the user chooses skill decomposition in Round 4, after initialization call `skill-creator` once for each independent workflow. Follow `skill-creator`'s plan, confirmation, creation, and validation process; do not write `SKILL.md` manually.

### After Initialization

1. Before writing, read the `AGENTS.md` section of `references/crew-file-format.md` and `references/prompt-engineering-guide.md`, then validate the drafted workflow against their specifications: overview, ordered SOP steps, inputs, outputs, tool/skill calls, failure branches, completion checks, and the mandatory baseline security constraints must be present. User-requested security or other special rules extend the baseline and must not weaken or replace it.
2. If validation fails, revise the workflow content and validate it again; do not initialize with a plain unstructured checklist or omit the mandatory baseline security constraints.
3. Show the generated files to the user via `read_files`.
4. If the user chose skill decomposition, call `skill-creator` for each independent skill and validate the results before reporting completion.
5. Complete the mandatory initialization completion gate above (including `check_crew.py`).
6. Verify the generated files and the employee directory structure.
7. Present the complete **Employee Initialization & Verification Checklist** to the user (see format below), explicitly verifying definition files and Logo generation.
8. Ask if the user wants any adjustments.
9. Clean up the temp config only after initialization has completed: `delete_files(path=".crew_init_config.json")`.
10. Inform the user: TOOLS.md and SKILLS.md were not generated by the initialization script (system defaults apply); custom skills are created under `.magic/skills/` and can be adjusted later through employee management.

### Employee Initialization & Verification Checklist Format

After employee initialization completes, you MUST present the following checklist to the user to confirm each step was executed and verified:

```markdown
## Employee Initialization & Verification Checklist

| Check Item | Status | Verification Details |
|------------|--------|----------------------|
| Definition files created | pass | IDENTITY.md, AGENTS.md, SOUL.md created under .magic/ |
| Skill decomposition decision | pass | Recorded user decision ('yes'/'no') |
| Logo generated | pass / skipped / failed | Generated .magic/logo.png and icon recorded in IDENTITY.md |
| Check crew verification | pass | check_crew.py verification passed with 0 errors |
```

## File Responsibility Mapping

| File | Dimension | Responsibility | Required |
|------|-----------|----------------|----------|
| `IDENTITY.md` | WHO — Identity | Name, role, description, icon + role definition body | **Required** |
| `AGENTS.md` | WHAT — Instructions | Workflow, rules, special directives | Recommended |
| `SOUL.md` | HOW — Personality | Core personality, communication style, behavior guidelines | Optional |
| `TOOLS.md` | WITH WHAT — Tools | Tool whitelist (YAML) + usage preferences | Optional |
| `.magic/logo.png` | VISUAL — Logo | Default employee Logo directly under .magic/ | Optional |

## Editing Workflow

### General Flow (applies to all files)

1. **Read current content**: Use `read_files` to read the target file's existing content
2. **Load quality guide**: Read reference file `references/prompt-engineering-guide.md`
3. **Load format spec**: Read reference file `references/crew-file-format.md`
4. **Write/modify content**: Edit following the format spec and quality guide
5. **Show quality assessment**: Present the modified content with a quality assessment summary
6. **Write after confirmation**: After user confirms, use `write_file` or `edit_file` to save

## Pre-completion packaging-scope check

Before concluding an employee-creation or employee-editing session—especially when the user says it is finished or asks to deliver, publish, or package the employee—run a final workspace check:

1. Call `list_dir` with `path="."` to inspect the workspace root.
2. The digital employee package root is `.magic/`; only files and directories under `.magic/` are packaged as employee content.
3. Find files and directories outside `.magic/` and report their workspace-relative paths. Include root-level files and directories outside `.magic/`; do not silently discard them.
4. Tell the user that reported external items are not packaged by default. Some may be intentionally workspace-level files, while others may be employee-related content left outside `.magic/`.
5. If an external item looks like an employee definition, skill, asset, or configuration, suggest a destination under `.magic/` and let the user move/copy it. Do not perform the move/copy/delete automatically.
6. If there are no user files outside `.magic/`, state that the check is clear.

This check is a completion safeguard and does not replace the required startup inspection of `.magic/IDENTITY.md` and the other employee definition files.

### Quality Assessment Summary Format

After each edit, present:

```
## Quality Assessment

| Check Item | Status | Notes |
|------------|--------|-------|
| Role clarity | pass | ... |
| Instruction specificity | pass | ... |
| Language consistency | pass | All generated content uses the selected language. |
| Format compliance | pass | ... |
| ... | ... | ... |
```

## File-Specific Editing Guides

### IDENTITY.md — Identity Definition

Contains YAML header (metadata) and body (role definition).

**YAML header fields**: `name`, `role`, and `description` in the selected language. Do not add language-suffixed variants.

**Body**: Write directly in the selected language.

**Key points**:
- Role definition must be specific; avoid vague descriptions like "you are an AI assistant"
- Define expertise domains, target users, and usage scenarios

### AGENTS.md — Workflow Reference Guide

Pure Markdown, no YAML header. Defines this employee's standard operating procedures (SOPs) and rules. The workflow should be concise and clear, explicitly describing the action, input, output, and tool or skill call for every step.

**Key points**:
- Start with a concise workflow overview, purpose, applicable scenarios, and overall sequence.
- Use SOP steps in execution order; every step must state what to do, what the input is, what the output is, and which tool or skill to call.
- Cover real input sources such as user text, uploaded images, uploaded files, workspace files, and outputs from previous steps.
- Make output formats explicit, such as Markdown files, HTML files, structured data, execution commands, or directly viewable results.
- Put tool and skill calls in the steps where they are used instead of listing tool names generically.
- Use if/then/else logic for missing inputs, unsupported formats, and execution failures.
- Define verifiable completion conditions for every step, along with rules and output quality requirements.

**Image generation in workflows**: When a workflow step requires generating images, always instruct the agent to use the canvas tools rather than `generate_images` directly:
1. Call `create_canvas` to initialize a canvas project (e.g., `project_path="<topic>/design"`)
2. Call `generate_canvas_images` with the task list to generate images into the canvas

Reserve `generate_images` only for utility/internal use (e.g., logo generation during initialization). All user-facing image generation tasks in AGENTS.md workflows must go through the canvas tools.

### SOUL.md — Personality and Behavior

Pure Markdown, no YAML header. Defines the employee's personality and behavior guidelines.

**Key points**: Core traits (3-5 keywords + behavioral descriptions), aesthetic preferences including presentation, expression, and creative style, actionable communication style, and behavior boundaries.

### TOOLS.md — Tool Management

Contains YAML header (tool whitelist) and optional body (tool usage preferences).

**Key points**:
- Tools can only be selected from the project's available tool list — use `scripts/tools.py` to query dynamically
- Recommend tool combinations based on employee function
- Special tool usage preferences go in the body section
- **For employees with image generation needs**: add `create_canvas` and `generate_canvas_images` to the tool list (not `generate_images`), so the AGENTS.md canvas workflow is executable

For employees creating images, videos, or Canvas content, configure the `canvas-manager` system skill in `SKILLS.md` and keep code execution enabled. Load that skill, then use `initialize_canvas` and the generation workflow through `run_sdk_snippet`. Canvas tools are Code Mode only; do not put them in `TOOLS.md`. The runtime provides `run_sdk_snippet` automatically. See `references/available-tools.md` for the skill configuration.

## Tool Management Workflow

When users want to add or remove tools:

1. **Query available tools**: Use the script to dynamically scan (see "Tool Query Script" section)
2. Read current TOOLS.md tool list
3. Evaluate tool needs based on employee function
4. Present tool change comparison to user
5. Write to TOOLS.md after user confirmation

## Tool Query Script

Use `scripts/tools.py` to dynamically scan all registered tools in the project (data source: `config/tool_definitions.json`).

### List all available tools

```python
shell_exec(
    command="python scripts/tools.py list"
)
```

### View details of a specific tool (parameters, description)

```python
shell_exec(
    command="python scripts/tools.py detail web_search"
)
```

### Search tools by keyword

```python
shell_exec(
    command="python scripts/tools.py search image"
)
```

## Reference Documents

Reference documents with detailed guides:

- **crew-file-format** — Complete format specs and examples for each definition file
- **prompt-engineering-guide** — Prompt engineering best practices (structure templates, quality checklists, anti-pattern detection)
- **available-tools** — Tool combination recommendations by function (fallback reference; prefer `scripts/tools.py` for dynamic queries)
