---
name: crew-creator
description: |
  Manage and optimize custom agent definition files (IDENTITY.md, AGENTS.md, SOUL.md, TOOLS.md).
  Also handles first-time employee initialization when .workspace/ has no IDENTITY.md.
  Use when users want to edit agent identity, modify workflow instructions, adjust personality,
  add/remove tools, optimize prompts, or initialize a new employee from scratch.
  Trigger signals: 'modify prompt', 'change identity', 'add tool', 'remove tool', 'optimize workflow',
  'adjust personality', 'initialize employee', '修改提示词', '改身份', '加工具', '去掉工具',
  '优化能力', '调性格', '初始化员工', '创建员工'.
  Do NOT use for: skill creation (use skill-creator), skill listing (use find-skill).
description-cn: |
  管理和优化自定义员工的定义文件（IDENTITY.md, AGENTS.md, SOUL.md, TOOLS.md）。
  也负责首次员工初始化（当 .workspace/ 下没有 IDENTITY.md 时）。
  当用户要编辑员工身份、修改工作流指令、调整性格、添加/移除工具、优化提示词或从零初始化员工时使用。
  不用于：技能创建（用 skill-creator）、技能查找（用 find-skill）。
---

<!--zh
# Agent Prompt Manager（员工提示词管理器）

管理 `.workspace/` 下的 4 个核心员工定义文件，帮助用户查看、编辑和优化员工的身份、指令、性格和工具配置。
当工作区尚无员工定义文件时，还负责引导用户完成首次初始化。

## 员工初始化流程

当 `.workspace/IDENTITY.md` 不存在时，说明工作区尚未创建员工，需要引导用户初始化。

### 检测条件

使用 `list_dir` 检查 `.workspace/` 目录。若 `IDENTITY.md` 不存在，进入初始化流程。

### 信息采集（通过对话向用户提问）

按以下顺序向用户收集信息，每次可合并多个问题，但不要一次问太多：

**第一轮（必填信息）**：
1. **员工名称**：中文名和英文名（如：研究助手 / Research Assistant）
2. **员工角色/职能**：中文和英文（如：学术研究员 / Academic Researcher）
3. **一句话描述**：这个员工主要做什么？（中英文）

**第二轮（推荐但可选）**：
4. **角色定义**：更详细地描述这个员工的能力、专长、工作方式（会写入 IDENTITY.md 正文）
5. **主要工作流程/规则**：这个员工应该遵循什么样的工作流程？有什么特殊规则？（会写入 AGENTS.md）

**第三轮（可选，用户可跳过）**：
6. **性格和沟通风格**：希望员工有什么样的性格？（如：严谨、活泼、简洁等）（会写入 SOUL.md）

若用户表示"先这样"、"后面再说"等跳过意图，立即使用已收集的信息进行初始化，无需强制收集所有字段。

### 生成文件

收集完信息后，将配置写入 JSON 文件，调用初始化脚本生成员工定义文件：

```python
# 1. 将收集到的信息写入 JSON 配置
write_file(
    path=".crew_init_config.json",
    content='{"name": "Research Assistant", "name_cn": "研究助手", "role": "Academic Researcher", "role_cn": "学术研究员", "description": "...", "description_cn": "...", "role_body": "...", "role_body_cn": "...", "instructions": "...", "instructions_cn": "...", "personality": "...", "personality_cn": "..."}'
)

# 2. 调用初始化脚本
shell_exec(
    command="python scripts/init_crew.py --config .workspace/.crew_init_config.json"
)
```

脚本根据配置生成以下文件（TOOLS.md 和 SKILLS.md 不生成，系统使用默认值）：
- `IDENTITY.md` — 始终生成（YAML header + 角色定义正文）
- `AGENTS.md` — 若提供了工作流指令则生成
- `SOUL.md` — 若提供了性格定义则生成

### 初始化后

1. 用 `read_files` 向用户展示生成的文件内容
2. 询问用户是否需要调整
3. 清理临时配置文件：`delete_files(path=".crew_init_config.json")`
4. 告知用户：未生成 TOOLS.md 和 SKILLS.md 表示使用系统默认配置，后续可随时通过员工管理来添加

-->
# Agent Prompt Manager

Manages the 4 core employee definition files under `.workspace/`, helping users view, edit, and optimize their employee's identity, instructions, personality, and tool configuration.
Also handles first-time employee initialization when the workspace has no definition files.

## Employee Initialization Flow

When `.workspace/IDENTITY.md` does not exist, the workspace has no employee yet and you should guide the user through initialization.

### Detection

Use `list_dir` to check `.workspace/`. If `IDENTITY.md` is missing, enter the initialization flow.

### Information Gathering (ask the user conversationally)

Collect information in rounds; you may combine questions but don't overwhelm the user:

**Round 1 (required)**:
1. **Employee name**: Chinese and English (e.g. 研究助手 / Research Assistant)
2. **Employee role**: Chinese and English (e.g. 学术研究员 / Academic Researcher)
3. **One-line description**: What does this employee mainly do? (bilingual)

**Round 2 (recommended but optional)**:
4. **Role definition**: A richer description of capabilities, expertise, and working style (goes into IDENTITY.md body)
5. **Workflow / rules**: What workflow should this employee follow? Any special rules? (goes into AGENTS.md)

**Round 3 (optional, user may skip)**:
6. **Personality and communication style**: What personality should the employee have? (e.g. rigorous, lively, concise) (goes into SOUL.md)

If the user signals intent to skip ("先这样", "later", etc.), proceed immediately with whatever has been collected.

### Generating Files

After collecting info, write a JSON config and call the init script:

```python
# 1. Write collected info as JSON config
write_file(
    path=".crew_init_config.json",
    content='{"name": "Research Assistant", "name_cn": "研究助手", "role": "Academic Researcher", "role_cn": "学术研究员", "description": "...", "description_cn": "...", "role_body": "...", "role_body_cn": "...", "instructions": "...", "instructions_cn": "...", "personality": "...", "personality_cn": "..."}'
)

# 2. Call the init script
shell_exec(
    command="python scripts/init_crew.py --config .workspace/.crew_init_config.json"
)
```

The script generates files based on the config (TOOLS.md and SKILLS.md are intentionally not created — the system uses defaults):
- `IDENTITY.md` — always generated (YAML header + role definition body)
- `AGENTS.md` — generated if workflow instructions were provided
- `SOUL.md` — generated if personality was provided

### After Initialization

1. Show the generated files to the user via `read_files`
2. Ask if they want any adjustments
3. Clean up the temp config: `delete_files(path=".crew_init_config.json")`
4. Inform the user: TOOLS.md and SKILLS.md were not generated (system defaults apply); they can be added later through employee management

## 文件职责映射

| 文件 | 维度 | 职责 | 是否必填 |
|------|------|------|----------|
| `IDENTITY.md` | WHO — 身份 | 名称、角色、描述 + 角色定义正文 | **必填** |
| `AGENTS.md` | WHAT — 指令 | 工作流程、规则、特殊指令 | 推荐 |
| `SOUL.md` | HOW — 性格 | 核心性格、沟通风格、行为准则 | 可选 |
| `TOOLS.md` | WITH WHAT — 工具 | 工具白名单（YAML）+ 使用偏好 | 可选 |

## 编辑工作流

### 通用流程（适用于所有文件）

1. **读取当前内容**：使用 `read_files` 读取目标文件的现有内容
2. **加载质量指南**：读取 reference 文件 `references/prompt-engineering-guide.md`
3. **加载格式规范**：读取 reference 文件 `references/crew-file-format.md`
4. **编写/修改内容**：遵循格式规范和质量指南进行编辑
5. **展示质量评估**：向用户展示修改后的内容和质量评估摘要
6. **用户确认后写入**：用户确认无误后，使用 `write_file` 或 `edit_file` 写入文件

### 质量评估摘要格式

每次完成编辑后，展示以下格式的摘要：

```
## 质量评估

| 检查项 | 状态 | 备注 |
|--------|------|------|
| 角色明确性 | ✅ | ... |
| 指令具体性 | ✅ | ... |
| 双语完整性 | ✅ | ... |
| 格式规范性 | ✅ | ... |
| ... | ... | ... |
```

## 各文件编辑指南

### IDENTITY.md — 身份定义

IDENTITY.md 包含 YAML header（元数据）和正文（角色定义）两部分。

**YAML header 字段**：
- `name` / `name_cn` — 员工名称（英文/中文）
- `role` / `role_cn` — 员工角色（英文/中文）
- `description` / `description_cn` — 员工描述（英文/中文）

**正文部分**：使用 `<!--zh ... -->` 块级注释格式编写中英双语角色定义。

**编辑要点**：
- 角色定义要具体，避免空泛描述（如"你是一个 AI 助手"）
- 明确专长领域、目标用户和使用场景
- 中英文内容必须语义对等，不可简化或遗漏

### AGENTS.md — 工作流指令

纯 Markdown 文件，无 YAML header。定义此员工特有的工作方式和规则。

**编辑要点**：
- 按优先级排列指令
- 使用编号列表，每条指令独立、可操作
- 包含决策逻辑（if/then/else）
- 定义输出格式和质量要求

### SOUL.md — 性格与行为准则

纯 Markdown 文件，无 YAML header。定义员工的灵魂和行为准则。

**编辑要点**：
- 核心性格特征（3-5 个关键词 + 具体行为说明）
- 沟通风格（语气、详略、主动性）
- 行为准则（边界和禁区）

### TOOLS.md — 工具管理

TOOLS.md 包含 YAML header（工具白名单）和可选正文（工具使用偏好）。

**YAML header 格式**：
```yaml
---
tools:
  - web_search
  - read_files
  - write_file
  - ...
---
```

**编辑要点**：
- 工具只能从项目可用工具列表中选取，使用 `scripts/tools.py` 脚本动态查询
- 根据员工职能推荐合适的工具组合
- 如有特殊的工具使用偏好，写入正文部分

## 工具管理专项流程

当用户要添加或移除工具时：

1. **查询可用工具**：使用脚本动态扫描（见下方"工具查询脚本"章节）
2. 读取当前 TOOLS.md 的已配置工具列表
3. 根据员工职能评估工具需求：
   - 需要联网搜索？→ 加 `web_search`, `read_webpages_as_markdown`
   - 需要文件处理？→ 加 `read_files`, `write_file`, `edit_file` 等
   - 需要代码执行？→ 加 `run_python_snippet`, `shell_exec`
   - 需要视觉理解？→ 加 `visual_understanding`
   - 需要图片生成？→ 加 `generate_image`
4. 向用户展示工具变更对比
5. 用户确认后写入 TOOLS.md

## 工具查询脚本

使用 `scripts/tools.py` 动态扫描项目中所有已注册的工具（数据来源：`config/tool_definitions.json`）。

### 列出所有可用工具

```python
shell_exec(
    command="python scripts/tools.py list"
)
```

### 查看某个工具的详细信息（参数、描述）

```python
shell_exec(
    command="python scripts/tools.py detail web_search"
)
```

### 按关键词搜索工具

```python
shell_exec(
    command="python scripts/tools.py search image"
)
```

## 双语规范

所有编辑内容必须遵循中英双语规范：

```markdown
<!--zh
中文内容
可以多行
-->
English content
Can be multiple lines
```

- 中文在上（HTML 注释内），英文在下
- 按逻辑段落分块，不逐行对照
- 中文有的信息，英文必须有，不可简化或遗漏

## 参考文档

可阅读以下 reference 文档获取详细指南：

- **crew-file-format** — 各定义文件的完整格式规范和示例
- **prompt-engineering-guide** — 提示词工程最佳实践（结构模板、质量检查清单、反模式检测）
- **available-tools** — 按职能分类的工具组合推荐（备用参考，优先使用 `scripts/tools.py` 动态查询）
-->
# Agent Prompt Manager

Manages the 4 core employee definition files under `.workspace/`, helping users view, edit, and optimize their employee's identity, instructions, personality, and tool configuration.

## File Responsibility Mapping

| File | Dimension | Responsibility | Required |
|------|-----------|----------------|----------|
| `IDENTITY.md` | WHO — Identity | Name, role, description + role definition body | **Required** |
| `AGENTS.md` | WHAT — Instructions | Workflow, rules, special directives | Recommended |
| `SOUL.md` | HOW — Personality | Core personality, communication style, behavior guidelines | Optional |
| `TOOLS.md` | WITH WHAT — Tools | Tool whitelist (YAML) + usage preferences | Optional |

## Editing Workflow

### General Flow (applies to all files)

1. **Read current content**: Use `read_files` to read the target file's existing content
2. **Load quality guide**: Read reference file `references/prompt-engineering-guide.md`
3. **Load format spec**: Read reference file `references/crew-file-format.md`
4. **Write/modify content**: Edit following the format spec and quality guide
5. **Show quality assessment**: Present the modified content with a quality assessment summary
6. **Write after confirmation**: After user confirms, use `write_file` or `edit_file` to save

### Quality Assessment Summary Format

After each edit, present:

```
## Quality Assessment

| Check Item | Status | Notes |
|------------|--------|-------|
| Role clarity | pass | ... |
| Instruction specificity | pass | ... |
| Bilingual completeness | pass | ... |
| Format compliance | pass | ... |
| ... | ... | ... |
```

## File-Specific Editing Guides

### IDENTITY.md — Identity Definition

Contains YAML header (metadata) and body (role definition).

**YAML header fields**: `name`/`name_cn`, `role`/`role_cn`, `description`/`description_cn`

**Body**: Use `<!--zh ... -->` block comment format for bilingual role definition.

**Key points**:
- Role definition must be specific; avoid vague descriptions like "you are an AI assistant"
- Define expertise domains, target users, and usage scenarios
- Chinese and English content must be semantically equivalent

### AGENTS.md — Workflow Instructions

Pure Markdown, no YAML header. Defines this employee's specific workflow and rules.

**Key points**: Prioritized instructions, numbered lists, decision logic (if/then/else), output format specs.

### SOUL.md — Personality and Behavior

Pure Markdown, no YAML header. Defines the employee's personality and behavior guidelines.

**Key points**: Core traits (3-5 keywords + behavioral descriptions), communication style, behavior boundaries.

### TOOLS.md — Tool Management

Contains YAML header (tool whitelist) and optional body (tool usage preferences).

**Key points**:
- Tools can only be selected from the project's available tool list — use `scripts/tools.py` to query dynamically
- Recommend tool combinations based on employee function
- Special tool usage preferences go in the body section

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

## Bilingual Standard

All edited content must follow the bilingual convention:

```markdown
<!--zh
Chinese content
Multiple lines allowed
-->
English content
Multiple lines allowed
```

## Reference Documents

Reference documents with detailed guides:

- **crew-file-format** — Complete format specs and examples for each definition file
- **prompt-engineering-guide** — Prompt engineering best practices (structure templates, quality checklists, anti-pattern detection)
- **available-tools** — Tool combination recommendations by function (fallback reference; prefer `scripts/tools.py` for dynamic queries)
