---
name: crew-creator
description: |
  Manage and optimize custom agent definition files (IDENTITY.md, AGENTS.md, SOUL.md, TOOLS.md).
  Use when users want to edit agent identity, modify workflow instructions, adjust personality,
  add/remove tools, or optimize prompts.
  Trigger signals: 'modify prompt', 'change identity', 'add tool', 'remove tool', 'optimize workflow',
  'adjust personality', '修改提示词', '改身份', '加工具', '去掉工具', '优化能力', '调性格'.
  Do NOT use for: skill creation (use skill-creator), skill listing (use find-skill).
description-cn: |
  管理和优化自定义员工的定义文件（IDENTITY.md, AGENTS.md, SOUL.md, TOOLS.md）。
  当用户要编辑员工身份、修改工作流指令、调整性格、添加/移除工具、优化提示词时使用。
  不用于：技能创建（用 skill-creator）、技能查找（用 find-skill）。
---

<!--zh
# Agent Prompt Manager（员工提示词管理器）

管理 `.workspace/` 下的 4 个核心员工定义文件，帮助用户查看、编辑和优化员工的身份、指令、性格和工具配置。

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
2. **加载质量指南**：通过 `skill_read_references` 加载 `prompt-engineering-guide` 参考文档
3. **加载格式规范**：通过 `skill_read_references` 加载 `crew-file-format` 参考文档
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

使用 `skill_read_references` 工具加载详细指南：

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
2. **Load quality guide**: Load `prompt-engineering-guide` reference via `skill_read_references`
3. **Load format spec**: Load `crew-file-format` reference via `skill_read_references`
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

Use `skill_read_references` to load detailed guides:

- **crew-file-format** — Complete format specs and examples for each definition file
- **prompt-engineering-guide** — Prompt engineering best practices (structure templates, quality checklists, anti-pattern detection)
- **available-tools** — Tool combination recommendations by function (fallback reference; prefer `scripts/tools.py` for dynamic queries)
