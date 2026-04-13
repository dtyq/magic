# Skill 概念与加载链路

本文面向快速理解：什么是 Skill、它在当前项目中如何加载、模型怎么用它。
开发规范详见 [SKILLS_DEVELOPMENT_GUIDE.md](SKILLS_DEVELOPMENT_GUIDE.md)。

---

## 什么是 Skill

Skill 是一个文件夹，包含帮助 Agent 完成某类任务的说明文档，核心是 `SKILL.md`。

```
my-skill/
├── SKILL.md          # 主文档：任务说明、工具用法、示例代码
└── reference/        # 可选：需要时按需读取的补充文档
    └── detail.md
```

**Skill 解决的是"按需加载知识"的问题**：Agent 不需要把所有领域知识常驻在上下文里，只在识别到某类任务时才加载对应 Skill。

---

## Skill 如何进入模型上下文

有两种方式，行为完全不同：

### 1. 可用列表（available_skills）— 按需读取

模型的系统提示词里有一个 `<available_skills>` 块，列出所有可用 Skill 的名称和 description。模型看到列表，自己判断要不要加载，需要时调用 `read_skills` 工具：

```json
{"skill_names": ["skill-name"]}
```

读取后，SKILL.md 正文进入上下文。如需 reference 文件，再用 `read_files` 工具读取具体路径。

### 2. Preload — 启动时注入

在 `.agent` 文件的 `skills.preload` 里配置的 Skill，其指定文件内容会在 Agent 启动时直接写入系统提示词，**无需模型主动读取，始终可见**。

```yaml
skills:
  preload:
    - name: canvas-designer
      files:
        - SKILL.md
        - reference/image-search.md   # reference 文件也可以 preload
```

被 preload 的 Skill **不再出现**在 `available_skills` 列表中。

---

## Skill 的来源

`.agent` 文件的 `skills` 字段声明从哪些来源加载 Skill：

```yaml
skills:
  system_skills:      # 内置 Skill，位于 agents/skills/
    - name: find-skill
    - name: using-mcp
  crew_skills: "*"    # 当前 Agent 私有 Skill（"*" 表示全部扫描）
  workspace_skills: "*" # 用户安装/创建的 Skill
  excluded_skills:    # 从 system_skills 中排除
    - some-skill
  preload:            # 预加载（可来自任意来源）
    - name: canvas-designer
      files:
        - SKILL.md
```

| 来源 | 存储位置 | 说明 |
|------|---------|------|
| `system_skills` | `agents/skills/` | 内置，随项目发布 |
| `crew_skills` | `agents/<agent-name>/skills/` | 当前 Agent 私有 |
| `workspace_skills` | 工作区 skills 目录 | 用户安装/创建，或从外部安装后落地的位置 |
| `preload` | 任意来源均可 | 启动时注入，不进列表 |

**外部安装**：Agent 可通过 `find-skill` 从外部获取并安装 Skill，安装完成后统一落在 workspace_skills 目录。来源有三条：

| 外部来源 | 获取方式 |
|---------|---------|
| 平台技能市场 | `skillhub install-platform-me <code>` 或 `install-platform-market <code>` |
| skillhub 社区 | `skillhub install <slug>`（先 `skillhub search <keyword>` 检索） |
| GitHub | `skillhub install-github <repo-url>` 或仓库内子目录 |

安装后通过 `read_skills` 加载使用，安装前建议先用 `skill-vetter` 进行安全审查。

---

## 完整加载链路

```
.agent 文件 frontmatter（skills 配置）
        │
        ▼
  系统提示词组装阶段
  ├── 收集 system / crew / workspace skills 元数据
  ├── 排除 excluded_skills
  ├── 构建 <available_skills> 块（name + description，供模型选读）
  └── 构建 <preloaded_skills> 块（指定文件正文，直接注入）
        │
        ▼
  模型收到系统提示词
  ├── <available_skills>：看到列表，按需 read_skills
  └── <preloaded_skills>：直接读取，无需任何操作
        │
        ▼
  模型读取 Skill 后
  ├── 执行任务（Code Mode、CLI、步骤指引等）
  └── 如需 reference 文件：read_files(绝对路径)
```

---

## 模型使用 Skill 的规则

- **读取**：调用 `read_skills` 工具，参数 `{"skill_names": ["skill-name"]}`
- **读 reference 文件**：用 SKILL.md 里给出的相对路径 + `<skill_dir>` 标签拼成绝对路径，再调 `read_files`；禁止猜测路径或使用相对路径
- **preload 的不用再读**：`<preloaded_skills>` 块里的内容已经在上下文，直接用，不需要再调 `read_skills`
- **外部 Skill 先审查**：来自外部来源的 Skill 安装前先加载 `skill-vetter`；用户明确表示无需审查时可跳过
