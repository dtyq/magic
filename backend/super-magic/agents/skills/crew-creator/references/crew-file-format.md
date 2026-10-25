# Crew Agent File Format Specification (Authoritative Reference)

This document defines the format, field descriptions, and examples for each custom employee (Crew Agent) definition file.
When editing employee configuration, you must strictly follow these format specifications.

---

## 1. IDENTITY.md — Identity Definition (Entry file, Required)

YAML header carries agent-level metadata; the body defines the role description.

### YAML Header Fields

| Field | Description | Maps to | Required |
|-------|-------------|---------|----------|
| `name` | Employee name | `AgentProfile.name` | **Yes** |
| `role` | Employee role | `AgentProfile.role` | **Yes** |
| `description` | Employee description | `AgentProfile.description` | **Yes** |
| `icon` | Employee logo path (e.g. `.magic/logo.png` or `.magic/logo.jpg`) | `AgentProfile.icon` | Optional |

### Strict Header Rules & Prohibitions

- **Standard fields ONLY**: Use strictly `name`, `role`, `description`, `icon`. Absolutely DO NOT generate any multilingual or translated field variants such as `name_cn`, `name_en`, `role_cn`, `role_en`, `description_cn`, `description_en`, `name-cn`, etc.
- **Fixed avatar location**: When `icon` is specified, it must point directly to `.magic/logo.png` or `.magic/logo.jpg`. Never use arbitrary directory paths (e.g., `assets/`, `images/`) or custom filenames.

### AgentProfile Rendering Rules

- With role: `"Your name is {name}, you are a {role}. {description}"`
- Without role: `"Your name is {name}. {description}"`

### Full Example

```markdown
---
name: Research Assistant
role: Academic Researcher
description: A professional research assistant for academic work
icon: .magic/logo.png
---

You are a professional academic research assistant, skilled in
literature search, data analysis, and report writing.
You have a rigorous academic attitude and critical thinking ability.
```

### Compilation Target

Body content is injected into the `<identity>` section of the compiled `.agent` file.

---

## 2. AGENTS.md — Workflow Reference Guide (Authoritative Specification)

Defines this employee's standard operating procedures (SOPs) and rules. **No YAML header**, pure Markdown content. The workflow must clearly state what to do, what the input is, what the output is, and which tool or skill to call for every step.

### Writing Guidelines

- Start with a concise overview of the workflow's purpose, applicable scenarios, and overall sequence.
- Organize the workflow as SOP steps in execution order; every step must state what to do, its input, its output, and the tool or skill to call.
- Specify input sources and types, including user text, uploaded images, uploaded files, existing workspace files, and outputs from previous steps.
- Specify output types and formats, such as Markdown files, HTML files, structured data, execution commands, or directly viewable results.
- Put tool or skill calls in the steps where they are used; do not provide only a generic list at the end.
- Include if/then/else decision logic for missing inputs, unsupported formats, and tool failures.
- Define a verifiable completion condition for every step, along with rules and output quality requirements.

### Compilation Target

Injected into the `<agents>` section of the compiled `.agent` file.

---

## 3. SOUL.md — Personality, Aesthetic, and Behavior Guidelines (Optional)

Defines the employee's personality, aesthetic preferences, and behavior guidelines. **No YAML header**, pure Markdown content.

### Example

```markdown
## Core Personality
- Rigorous: All conclusions must be data-backed
- Honest: Say "I'm not sure" when uncertain
- Concise: No filler, let data speak

## Communication Style
- Academic and professional, but accessible
- Proactively point out research limitations
```

### Writing Guidelines

- Summarize core personality with 3-5 keywords, each with concrete behavioral descriptions
- Define the employee's aesthetic preferences, including presentation, expression, and creative style
- Communication style must be actionable ("formal but accessible" over "friendly")
- Behavior guidelines should clearly define boundaries and forbidden zones

### Compilation Target

Injected into the `<soul>` section of the compiled `.agent` file.

---

## 4. TOOLS.md — Tool Configuration (Optional)

YAML header defines extra tools and exclusions from the template baseline. `run_python_snippet`, `run_sdk_snippet`, and `compact_chat_history` are runtime-managed and must not be listed in `tools`.

### Example

```markdown
---
tools:
  - web_search
  - read_webpages_as_markdown
  - visual_understanding
  - video_understanding
  - list_dir
  - file_search
  - read_files
  - grep_search
  - shell_exec
  - write_file
  - edit_file
  - find_file_ranges
  - edit_file_ranges
  - delete_files
---

## Tool Usage Preferences

- Prefer `run_python_snippet` for data processing
- Prefer `grep_search` over `file_search` for file searching
```

### Compilation Rules

- `tools` from `crew.template.agent` → builtin tool baseline
- YAML `tools` list → appends extra tools
- YAML `exclude_builtin_tools` list → removes specific tools from the builtin baseline
- No TOOLS.md provided → uses default tool set from `crew.template.agent`

Range editing uses `find_file_ranges` and `edit_file_ranges` together. Excluding either removes both from the builtin baseline. Explicit entries in `tools` are added after exclusions: `edit_file_ranges` includes its required finder, while `find_file_ranges` alone remains read-only.

### Notes

- Tool names must exactly match registered tools in the project
- Refer to the `available-tools` reference document for the complete tool list

---

## 5. SKILLS.md — Skill Configuration (Optional)

YAML header defines skill configuration using the following fields:

- `skills`: crew-specific skills (overwrites template `crew_skills`), searched in `crews/{code}/skills/` or installed skills
- `system_skills`: appended (deduplicated) to the template's default `system_skills`, searched in `agents/skills/`
- `preload`: embeds the specified skill's file content **directly into the system prompt**; pre-loaded skills are not shown in the available skills list — the model can use them directly without additional file reads; skills listed here do not need to be declared again in `system_skills`/`skills`, as preload will auto-locate and load them
- `excluded_skills`: removes loaded skills by name (applies to system, crew, and workspace sources); `compact-chat-history` is always mounted and cannot be excluded

All four fields are independent and can be combined as needed.

### Example: Crew-specific skills only

```markdown
---
skills:
  - my-custom-skill
  - another-skill
---
```

### Example: Appending system skills

```markdown
---
system_skills:
  - deep-research
  - creating-slides
---
```

### Example: Both fields together

```markdown
---
skills:
  - my-custom-skill
  - another-skill
system_skills:
  - deep-research
  - creating-slides
---
```

### Example: With `preload` field (embed skill content directly into system prompt)

```markdown
---
skills:
  - my-custom-skill
system_skills:
  - deep-research
preload:
  - deep-research             # shorthand: loads SKILL.md by default
  - name: my-custom-skill
    files:
      - SKILL.md
      - QUICK-REF.md          # load additional reference files
---
```

### Example: Excluding unwanted skills with `excluded_skills`

```markdown
---
excluded_skills:
  - using-mcp      # This crew does not need MCP capabilities; remove from loaded list
---
```

### Compilation Rules

- `skills` list → overwrites `crew_skills` in the compiled `.agent` frontmatter; searched in `crews/{code}/skills/` at runtime
- `system_skills` list → appended (deduplicated) to the template's default `system_skills`; searched in `agents/skills/` at runtime
- `preload` list → appended to the `preload` field in the compiled `.agent` frontmatter; at runtime, file content is embedded directly into the system prompt and the skill is removed from the available skills list; no need to declare again in `system_skills`/`skills`
- `excluded_skills` list → overwrites `excluded_skills`; applies to system, crew, and workspace sources; `compact-chat-history` is always mounted and is not affected
- No SKILLS.md provided → uses default skill set from `crew.template.agent`, no preloads

---

## 6. skills/ — Custom Skill Directory (Optional)

Reuses the existing SKILL.md format. Each skill is an independent directory containing SKILL.md and optional subdirectories.

```
skills/
└── my-skill/
    ├── SKILL.md          (required)
    ├── references/       (optional, on-demand reference docs)
    ├── scripts/          (optional, executable scripts)
    └── assets/           (optional, templates, icons, etc.)
```

SKILL.md must start with YAML frontmatter:

```yaml
---
name: my-skill
description: "English description of what this skill does and when to trigger"
---
```

Write definition files in one selected language. Do not create translations, language-specific duplicate sections, or HTML comment annotations for translations.

Example:

```markdown
## English

English content.

## Chinese

Chinese content.
```

---

## 8. Behavior When Files Are Missing

| File | Behavior When Missing |
|------|----------------------|
| `IDENTITY.md` | **Invalid** — without this file, the crew agent is not considered valid |
| `AGENTS.md` | No specific instructions; equivalent to default magic.agent + custom identity |
| `SOUL.md` | No extra personality; uses default style |
| `TOOLS.md` | Uses default tool set from crew.template.agent |
| `SKILLS.md` | Uses default skill set from crew.template.agent |
| `skills/` | No custom skills |
