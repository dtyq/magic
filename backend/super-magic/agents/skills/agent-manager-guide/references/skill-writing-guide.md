# 技能编写规范与最佳实践 / Skill Writing Standards & Best Practices

## 1. SKILL.md 标准格式

每个技能必须包含一个 `SKILL.md` 文件，格式如下：

```yaml
---
name: skill-name-in-kebab-case
description: |
  One-paragraph English description that clearly defines:
  1. WHAT this skill does
  2. WHEN to trigger (specific signal words/scenarios)
  3. WHEN NOT to trigger (exclusion conditions)

name-cn: 中文技能名称
description-cn: |
  一段式中文描述，明确定义：
  1. 这个技能做什么
  2. 何时触发（具体信号词/场景）
  3. 何时不触发（排除条件）
---

# 技能标题

## 概述
[技能的核心功能和适用场景，2-3句话]

## 使用条件
[列出触发条件和排除条件]

## 执行步骤
[清晰的步骤列表，每步独立可操作]

## 输出规范
[定义输出格式和质量要求]

## 注意事项
[边界情况处理和常见问题]
```

## 2. Frontmatter 规则

### 必填字段
| 字段 | 格式 | 说明 |
|------|------|------|
| `name` | kebab-case | 技能唯一标识，仅小写字母、数字、连字符 |
| `description` | 多行文本 | 英文描述，必须说明触发条件 |
| `name-cn` | 中文字符串 | 中文名称 |
| `description-cn` | 多行文本 | 中文描述，必须说明触发条件 |

### 可选字段
| 字段 | 格式 | 说明 |
|------|------|------|
| `allowed-tools` | CSV 或列表 | 限制技能可使用的工具 |
| `version` | 语义版本号 | 技能版本 |
| `author` | 字符串 | 作者信息 |
| `tags` | 列表 | 分类标签 |
| `dependencies` | 列表 | 依赖的其他技能 |

### Frontmatter 注意事项
- 使用 `---` 分隔符包裹
- 多行文本使用 `|` 块标量语法
- description 中的 `|` 会保留换行，适合多句描述
- 不要使用 `>` 折叠标量（会丢失换行）

## 3. 描述（Description）编写规范

### 关键原则：描述决定触发

description 是 Agent 判断是否加载技能的**唯一依据**，因此必须：

1. **首句说功能**：用一句话概括技能能做什么
2. **紧跟触发条件**：列出触发加载的关键信号词/场景
3. **明确排除条件**：列出不应触发的场景

### 好的描述示例

```yaml
description: |
  Web scraping and content extraction skill. Use when the user asks to
  extract content from specific URLs, scrape web pages, or collect data
  from websites. Trigger signals: "抓取", "爬取", "提取网页内容",
  "scrape", "extract from URL". Do NOT use for: simple web search
  (use web_search tool), reading documentation (use read_file), or
  browser automation tasks (use browser-agent).
```

### 差的描述示例（避免）

```yaml
# ❌ 太模糊，无法判断何时触发
description: A useful skill for web tasks.

# ❌ 没有排除条件
description: Extract content from web pages and URLs.

# ❌ 太长，核心信息被淹没
description: |
  This is a comprehensive web scraping skill that can handle
  various types of web pages including static HTML, dynamic
  JavaScript-rendered content, single-page applications...
  [200+ words without clear trigger signals]
```

## 4. Markdown 正文规范

### 结构建议

```markdown
# 技能标题

## 概述
[2-3句核心功能描述]

## 使用条件
- ✅ 适用：[场景1]
- ✅ 适用：[场景2]
- ❌ 不适用：[场景3]

## 执行步骤
1. [步骤1]
2. [步骤2]
3. [步骤3]

## 输出规范
[定义期望的输出格式]

## 注意事项
- [注意1]
- [注意2]
```

### 双语支持

使用 HTML 注释实现双语：

```markdown
<!--zh
## 概述
提供数据分析能力。
-->
## Overview
Provides data analysis capabilities.
```

### 内容体积控制
- SKILL.md 主体控制在 **3000 tokens 以内**
- 详细代码示例、完整参考文档放 `references/` 目录
- 使用 `skill_read_references` 工具按需加载 reference

## 5. Reference 文件规范

### 目录结构

```
skills/{skill-name}/
├── SKILL.md              # 核心指引（必须）
└── references/           # 详细参考（可选）
    ├── topic-guide.md    # 按主题组织
    └── examples.md       # 示例集合
```

### Reference 文件命名
- 使用 kebab-case
- 名称应描述文件内容（如 `api-reference.md`、`error-handling.md`）
- 避免使用 `ref1.md` 等无意义名称

### Reference vs SKILL.md 分离原则
| 放 SKILL.md | 放 references/ |
|-------------|----------------|
| 核心功能概述 | 详细 API 文档 |
| 触发/排除条件 | 完整代码示例 |
| 3-5 步执行步骤 | 复杂流程图解 |
| 简要输出格式 | 完整输出模板 |

## 6. 质量检查清单

### 技能质量自检（创建/编辑后必须对照）

- [ ] **名称规范**：使用 kebab-case，简洁准确
- [ ] **触发描述**：description 中包含明确的触发信号词
- [ ] **排除条件**：description 中包含"when NOT to use"说明
- [ ] **双语完整**：name/name-cn、description/description-cn 均已填写
- [ ] **结构清晰**：使用层级标题组织内容
- [ ] **边界明确**：定义了"做什么"和"不做什么"
- [ ] **体积控制**：SKILL.md 主体不超过 3000 tokens
- [ ] **可解析性**：frontmatter 格式正确，可被 SkillLoader 解析
- [ ] **步骤可操作**：每个执行步骤独立且可操作
- [ ] **无冗余**：没有与 reference 重复的内容

## 7. 常见错误

### ❌ Frontmatter 格式错误
```yaml
# 错误：缺少分隔符
name: my-skill
description: something

# 正确
---
name: my-skill
description: something
---
```

### ❌ description 中使用特殊 YAML 字符未转义
```yaml
# 错误：冒号会导致 YAML 解析错误
description: Use for: web scraping

# 正确：使用块标量
description: |
  Use for: web scraping
```

### ❌ 技能名称不规范
```yaml
# 错误
name: MySkill
name: my_skill
name: My Skill

# 正确
name: my-skill
```
