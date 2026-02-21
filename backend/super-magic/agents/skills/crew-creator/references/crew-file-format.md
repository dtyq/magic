<!--zh
# Crew Agent 文件格式规范

本文档定义了自定义员工（Crew Agent）各定义文件的格式、字段说明和示例。
编辑员工配置时，必须严格遵循这些格式规范。
-->
# Crew Agent File Format Specification

This document defines the format, field descriptions, and examples for each custom employee (Crew Agent) definition file.
When editing employee configuration, you must strictly follow these format specifications.

---

<!--zh
## 1. IDENTITY.md — 身份定义（入口文件，必填）

YAML header 承载 agent 级元数据，正文部分定义角色描述。
-->
## 1. IDENTITY.md — Identity Definition (Entry file, Required)

YAML header carries agent-level metadata; the body defines the role description.

<!--zh
### YAML Header 字段
-->
### YAML Header Fields

| Field | Description | Maps to |
|-------|-------------|---------|
| `name` | Employee name (English) | `AgentProfile.name` |
| `name_cn` | Employee name (Chinese) | `AgentProfile.name` (when lang=zh_CN) |
| `role` | Employee role (English) | `AgentProfile.role` |
| `role_cn` | Employee role (Chinese) | `AgentProfile.role` (when lang=zh_CN) |
| `description` | Employee description (English) | `AgentProfile.description` |
| `description_cn` | Employee description (Chinese) | `AgentProfile.description` (when lang=zh_CN) |

<!--zh
### AgentProfile 渲染规则

- 有 role 时：`"你叫{name}，是一名{role}。{description}"`
- 无 role 时：`"你叫{name}。{description}"`

### 完整示例
-->
### AgentProfile Rendering Rules

- With role: `"你叫{name}，是一名{role}。{description}"`
- Without role: `"你叫{name}。{description}"`

### Full Example

```markdown
---
name: Research Assistant
name_cn: 研究助手
role: Academic Researcher
role_cn: 学术研究员
description: A professional research assistant for academic work
description_cn: 专业学术研究助手
---

<!--zh
你是一位专业的学术研究助手，擅长文献检索、数据分析和报告撰写。
你具有严谨的学术态度和批判性思维能力。
-->
You are a professional academic research assistant, skilled in
literature search, data analysis, and report writing.
You have a rigorous academic attitude and critical thinking ability.
```

<!--zh
### 编译后位置

正文内容编译后注入 `.agent` 文件的 `<role>` 段。
-->
### Compilation Target

Body content is injected into the `<role>` section of the compiled `.agent` file.

---

<!--zh
## 2. AGENTS.md — 核心操作指令（推荐）

此员工特有的工作方式和规则。**无 YAML header**，纯 Markdown 内容。
-->
## 2. AGENTS.md — Core Operation Instructions (Recommended)

This employee's specific workflow and rules. **No YAML header**, pure Markdown content.

### Example

```markdown
<!--zh
## 工作流程
1. 收到研究任务后，先进行文献检索（至少3组关键词）
2. 对检索结果进行筛选和分析
3. 生成结构化的研究报告，必须包含引用来源

## 特殊规则
- 所有引用必须标注来源
- 数据分析优先使用 Python
- 报告默认输出为 HTML 格式
-->
## Workflow
1. Upon receiving a research task, first conduct literature search (at least 3 keyword sets)
2. Filter and analyze search results
3. Generate a structured research report with citations

## Special Rules
- All citations must include sources
- Prefer Python for data analysis
- Reports default to HTML format
```

<!--zh
### 编写要点

- 按优先级排列指令（最重要的在前）
- 使用编号列表，每条指令独立、可验证
- 包含决策逻辑（if/then/else），说明优先级冲突时的处理方式
- 定义输出格式和质量要求

### 编译后位置

编译后注入 `.agent` 文件的 `<user_custom_instructions>` 段，自动包裹安全提醒。
-->
### Writing Guidelines

- Prioritize instructions (most important first)
- Use numbered lists; each instruction should be independent and verifiable
- Include decision logic (if/then/else); specify priority conflict resolution
- Define output formats and quality requirements

### Compilation Target

Injected into the `<user_custom_instructions>` section of the compiled `.agent` file, automatically wrapped with security reminders.

---

<!--zh
## 3. SOUL.md — 性格与行为准则（可选）

定义员工的灵魂和行为准则。**无 YAML header**，纯 Markdown 内容。
-->
## 3. SOUL.md — Personality and Behavior Guidelines (Optional)

Defines the employee's personality and behavior guidelines. **No YAML header**, pure Markdown content.

### Example

```markdown
<!--zh
## 核心性格
- 严谨：所有结论必须有数据支撑
- 坦诚：不确定时说"我不确定"
- 简洁：不说废话，用数据说话

## 沟通风格
- 学术专业，但不晦涩
- 主动提出研究局限性
-->
## Core Personality
- Rigorous: All conclusions must be data-backed
- Honest: Say "I'm not sure" when uncertain
- Concise: No filler, let data speak

## Communication Style
- Academic and professional, but accessible
- Proactively point out research limitations
```

<!--zh
### 编写要点

- 核心性格特征用 3-5 个关键词概括，每个附带具体行为说明
- 沟通风格要可操作（如"语气正式但不晦涩"优于"友好"）
- 行为准则明确边界和禁区

### 编译后位置

编译后注入 `.agent` 文件的 `<personality>` 段。
-->
### Writing Guidelines

- Summarize core personality with 3-5 keywords, each with concrete behavioral descriptions
- Communication style must be actionable ("formal but accessible" over "friendly")
- Behavior guidelines should clearly define boundaries and forbidden zones

### Compilation Target

Injected into the `<personality>` section of the compiled `.agent` file.

---

<!--zh
## 4. TOOLS.md — 工具配置（可选）

YAML header 定义工具白名单。**列出来的就是要加载的，没列出来的不加载。**
-->
## 4. TOOLS.md — Tool Configuration (Optional)

YAML header defines the tool whitelist. **Listed tools are loaded; unlisted tools are not.**

### Example

```markdown
---
tools:
  - web_search
  - read_webpages_as_markdown
  - visual_understanding
  - convert_to_markdown
  - list_dir
  - file_search
  - read_files
  - grep_search
  - run_python_snippet
  - shell_exec
  - write_file
  - edit_file
  - edit_file_range
  - delete_files
  - create_memory
  - update_memory
  - delete_memory
  - compact_chat_history
---

<!--zh
## 工具使用偏好

- 优先使用 `run_python_snippet` 进行数据处理
- 文件搜索优先使用 `grep_search` 而非 `file_search`
-->
## Tool Usage Preferences

- Prefer `run_python_snippet` for data processing
- Prefer `grep_search` over `file_search` for file searching
```

<!--zh
### 编译规则

- YAML `tools` 列表 → 直接生成 `<!-- tools: ... -->` 行
- 正文内容（如有）→ 注入 `<tool_preferences>` 段
- 不提供 TOOLS.md → 使用 `crew.agent.template` 中的默认工具集

### 注意事项

- 工具名称必须与项目中已注册的工具完全匹配
- 建议参考 `available-tools` 参考文档获取完整的工具列表
-->
### Compilation Rules

- YAML `tools` list → generates `<!-- tools: ... -->` line directly
- Body content (if any) → injected into `<tool_preferences>` section
- No TOOLS.md provided → uses default tool set from `crew.agent.template`

### Notes

- Tool names must exactly match registered tools in the project
- Refer to the `available-tools` reference document for the complete tool list

---

<!--zh
## 5. SKILLS.md — 技能配置（可选）

YAML header 定义技能列表。**列出来的就是要加载的，没列出来的不加载。**
-->
## 5. SKILLS.md — Skill Configuration (Optional)

YAML header defines the skill list. **Listed skills are loaded; unlisted skills are not.**

### Example

```markdown
---
skills:
  - find-skill
  - using-mcp
  - env-manager
  - deep-research
---
```

<!--zh
### 编译规则

- YAML `skills` 列表 → 直接生成 `<!-- skills: ... -->` 行
- 不提供 SKILLS.md → 使用 `crew.agent.template` 中的默认技能集
-->
### Compilation Rules

- YAML `skills` list → generates `<!-- skills: ... -->` line directly
- No SKILLS.md provided → uses default skill set from `crew.agent.template`

---

<!--zh
## 6. skills/ — 自定义技能目录（可选）

复用现有 SKILL.md 格式。每个技能是一个独立目录，包含 SKILL.md 和可选的子目录。

```
skills/
└── my-skill/
    ├── SKILL.md          (必须)
    ├── references/       (可选，按需加载的参考文档)
    ├── scripts/          (可选，可执行脚本)
    └── assets/           (可选，模板、图标等)
```

技能的 SKILL.md 必须以 YAML frontmatter 开头：

```yaml
---
name: my-skill
description: "English description of what this skill does and when to trigger"
description-cn: "中文描述"
---
```
-->
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
description-cn: "Chinese description"
---
```

---

<!--zh
## 7. 双语内容规范

所有定义文件中的内容必须遵循中英双语格式：

**块格式**（推荐，用于多行内容）：
```markdown
<!--zh
中文内容
可以多行
-->
English content
Can be multiple lines
```

**行内格式**（用于短内容）：
```markdown
<!--zh: 中文内容-->
English content
```

### 关键原则

1. 按逻辑段落分块，不逐行对照
2. 中文在上（HTML 注释内），英文在下
3. 中文有的信息，英文必须有；不能因为"英文太长"就省略内容
4. 保持结构一致：中文有列表，英文也要有；中文有示例，英文也要有
-->
## 7. Bilingual Content Standard

All content in definition files must follow the bilingual format:

**Block format** (recommended for multi-line content):
```markdown
<!--zh
Chinese content
Multiple lines allowed
-->
English content
Multiple lines allowed
```

**Inline format** (for short content):
```markdown
<!--zh: Chinese content-->
English content
```

### Key Principles

1. Group by logical paragraphs, not line-by-line
2. Chinese above (in HTML comment), English below
3. Information in Chinese must be present in English; do not omit due to length
4. Maintain structural consistency: if Chinese has lists, English should too

---

<!--zh
## 8. 文件缺失时的行为

| 文件 | 缺失时的行为 |
|------|-------------|
| `IDENTITY.md` | **不合法** — 没有此文件则不认为是合法的 crew agent |
| `AGENTS.md` | 无特定指令，等同于默认 magic.agent + 自定义身份 |
| `SOUL.md` | 无额外性格定义，使用默认风格 |
| `TOOLS.md` | 使用 crew.agent.template 中的默认工具集 |
| `SKILLS.md` | 使用 crew.agent.template 中的默认技能集 |
| `skills/` | 无自定义技能 |
-->
## 8. Behavior When Files Are Missing

| File | Behavior When Missing |
|------|----------------------|
| `IDENTITY.md` | **Invalid** — without this file, the crew agent is not considered valid |
| `AGENTS.md` | No specific instructions; equivalent to default magic.agent + custom identity |
| `SOUL.md` | No extra personality; uses default style |
| `TOOLS.md` | Uses default tool set from crew.agent.template |
| `SKILLS.md` | Uses default skill set from crew.agent.template |
| `skills/` | No custom skills |
