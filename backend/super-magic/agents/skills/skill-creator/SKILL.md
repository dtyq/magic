---
name: skill-creator
description: Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit or optimize an existing skill, run evals to test a skill, benchmark skill performance, or optimize a skill's description for better triggering accuracy. Also use when user asks to "capture this workflow as a skill", "make a skill for X", or "turn this into a reusable skill".
description-cn: 创建新技能、修改和改进现有技能、评测技能性能。当用户想从零创建技能、编辑或优化现有技能、测试技能、对比技能性能，或者说"把这个工作流变成技能"、"给 X 功能做一个技能"时使用。
---

<!--zh
# Skill Creator（技能创作者）

这是一个帮助用户设计、构建、评测和持久化 Skill 的专项技能。
你的核心职责不是"执行任务"，而是"教会 AI 如何执行某类任务"。

高层次的创作流程：
1. 理解用户意图（Capture Intent）
2. 深入访谈和调研（Interview）
3. 写入 `skills/<skill-name>_plan.md` + 对话展示供用户确认（Plan）
4. 用户确认后，**检查名称冲突**，再创建 skill 目录和 SKILL.md（Write）
5. 创建测试用例并执行（Test）
6. 根据反馈迭代改进（Iterate）
7. description 优化（Optimize）
8. 询问是否打包（Package）

你的工作是判断用户当前在哪个阶段，然后从那里开始帮助他们推进。
-->
# Skill Creator

Helps users design, build, evaluate, and persist Skills. Your core job is not "doing the task" but "teaching AI how to do a class of tasks".

High-level workflow: Capture Intent → Interview → Plan (write `<skill>_plan.md` + show in chat, wait for confirm) → **Check Conflicts** → Write SKILL.md → Test → Iterate → Optimize → Package.
Assess where the user is and jump in from there.

---

<!--zh
## 语言感知规则

- 始终使用用户当前对话所用的语言，除非用户主动指定了其他语言
- 生成的 skill 内容（SKILL.md 正文、注释、示例说明）与当前对话语言保持一致
- 如需双语，使用项目规范格式：`<!--zh: ...-->` 行内注释，`<!--zh ... -->` 块级注释
- `description` 字段建议保持英文（触发机制依赖英文语义），可附带 `description-cn` 字段
-->
## Language Awareness

- Always use the language the user is currently speaking in, unless the user explicitly requests a different language
- Generate skill content (SKILL.md body, comments, examples) in the same language as the current conversation
- For bilingual, use project conventions: `<!--zh: ...-->` inline, `<!--zh ... -->` block
- Keep `description` in English (triggering relies on English semantics); optionally add `description-cn`

---

<!--zh
## 工具调用格式

在 SKILL.md 中，所有工具调用必须以 Python 代码形式描述，而不是只写工具名。
格式如下：
-->
## Tool Call Format in SKILL.md

All tool calls in generated SKILL.md files must be shown as Python code, not just tool names.

```python
from sdk.tool import tool

result = tool.call('tool_name', {
    "param1": "value1",
    "param2": "value2"
})

if result.ok and result.data:
    output = result.data['field_name']
```

<!--zh
在 skill 中引用工具前，先阅读 `references/super-magic-tools.md` 获取当前项目可用的完整工具列表及调用示例：
-->
Before specifying tools in the skill, read `references/super-magic-tools.md` for the full list of available tools and usage examples:

```python
from sdk.tool import tool
result = tool.call('skill_read_references', {
    "skill_name": "skill-creator",
    "references": ["super-magic-tools.md"]
})
```

<!--zh
常用工具分类速查（详细说明和示例见 `references/super-magic-tools.md`）：

- 网络搜索与抓取：`web_search`, `read_webpages_as_markdown`, `download_from_url`, `download_from_urls`
- 视觉理解：`visual_understanding`, `visual_understanding_webpage`
- 代码执行：`shell_exec`, `run_python_snippet`
- 图片生成与搜索：`generate_image`, `image_search`
-->
Common tool categories — quick reference (see `references/super-magic-tools.md` for details and examples):
- Web search & fetch: `web_search`, `read_webpages_as_markdown`, `download_from_url`, `download_from_urls`
- Vision: `visual_understanding`, `visual_understanding_webpage`
- Code execution: `shell_exec`, `run_python_snippet`
- Image generation & search: `generate_image`, `image_search`

---

<!--zh
## 创建技能的完整流程

### 阶段一：理解意图（Capture Intent）

理解用户想要什么。如果当前对话中已有工作流（用户说"把这个变成技能"），先从历史记录中提取：
- 使用了哪些工具
- 步骤顺序
- 用户纠正过什么
- 输入/输出格式

然后确认以下几点：
1. 这个技能要让 AI 能做什么？
2. 什么时候应该触发这个技能？（用户会说哪些话）
3. **最终产物是什么形式？**（见下方"输出形式决策"章节）
4. 是否需要设置测试用例？

### 输出形式决策（必须在访谈阶段确定）

这是生成高质量 skill 的关键环节。在 Capture Intent 阶段，必须明确该 skill 的最终产物形式，并将决策写入 SKILL.md。

判断依据：
-->
## Full Skill Creation Workflow

### Phase 1: Capture Intent

Understand what the user wants. If the conversation already contains a workflow (e.g., "turn this into a skill"), extract from history: tools used, step sequence, corrections made, input/output formats.

Then confirm:
1. What should this skill enable AI to do?
2. When should it trigger? (what user phrases/contexts)
3. **What is the final output form?** (see "Output Form Decision" below — must be decided here)
4. Should we set up test cases?

### Output Form Decision (Required in Capture Intent Phase)

This is critical for high-quality skills. Determine the output form and write it explicitly into the generated SKILL.md.

<!--zh
| 场景特征 | 建议输出形式 |
|---------|------------|
| 结果是多章节内容、行程、报告 | 写文件（Markdown / HTML） |
| 结果需要图表、可视化 | 写 HTML 文件（ECharts） |
| 结果涉及多个生成资源 | 写文件到独立目录 |
| 结果是简短答复、状态确认 | 直接输出到对话 |
| 用户明确说"直接告诉我" | 直接输出到对话 |

例如，"旅游规划技能"显然应该输出一份 HTML 行程报告，而不是直接输出文字。
必须在访谈阶段询问并确认，然后在 SKILL.md 的"输出规范"小节中明确写出。
-->

| Scenario | Recommended Output Form |
|---------|------------|
| Multi-section content: itineraries, reports, analysis | Write file (Markdown / HTML) |
| Charts, visualizations | Write HTML file (ECharts) |
| Multiple generated resources | Write files to a dedicated directory |
| Short reply, status confirmation | Direct conversation output |
| User explicitly says "just tell me" | Direct conversation output |

Example: a "travel planning skill" should clearly produce an HTML itinerary report, not dump text into the chat.
Ask and confirm during the interview, then write an explicit "Output Spec" section in the generated SKILL.md.

```markdown
## Output Spec

<!--zh: 本 skill 的最终产物是一份 HTML 格式的行程报告，保存到 `.workspace/<project_name>/itinerary.html`。不要将内容直接输出到对话中。-->
The final output of this skill is an HTML itinerary report saved to `.workspace/<project_name>/itinerary.html`.
Do not output content directly into the conversation, even if it is short.
```

---

<!--zh
### 阶段二：访谈与调研（Interview & Research）

主动询问边界情况、输入输出格式、示例文件、成功标准和依赖项。
可以使用 `web_search` 和 `read_webpages_as_markdown` 调研相关最佳实践和 API 文档。
等到访谈完成后再写测试用例。

**重要**：我们在容器环境中运行，没有浏览器，但有 `web_search` 和 `read_webpages_as_markdown` 工具。
研究技能相关的最佳实践、工具文档、类似 skill 的描述范式，都可以通过这两个工具完成。
-->
### Phase 2: Interview & Research

Proactively ask about edge cases, input/output formats, example files, success criteria, dependencies.
Use `web_search` and `read_webpages_as_markdown` to research best practices and API docs.
Wait until the interview is done before writing test cases.

**Note**: This environment has no browser, but `web_search` and `read_webpages_as_markdown` are available.
Use them to research best practices, tool docs, and description patterns for similar skills.

---

<!--zh
### 阶段三：输出规划文档（Plan）

访谈完成后，将规划文档内容输出到对话中，同时写入 `skills/<skill-name>_plan.md`（plan 文件存放在 skills/ 根目录，不进 skill 子目录，因此不会提前建出 skill 目录结构）。

规划文档内容：
- skill 的定位和边界（能做什么、不能做什么）
- 将使用的工具列表及选择理由（代码格式示例）
- 预期的 SKILL.md 结构大纲
- 是否需要 `scripts/`、`references/`、`assets/` 子目录
- 最终产物形式（输出规范决策）
- 评测方案（用什么 prompt 测试，期望什么输出）

**等用户确认规划内容后，再进入阶段四。**
-->
### Phase 3: Output Plan Document

After the interview, write the plan to `skills/<skill-name>_plan.md` (at the root of `skills/`, not inside the skill subdirectory — this avoids pre-creating the skill directory). Also present the plan in chat for the user to read.

Plan document contents:
- Skill scope and boundaries (what it can/cannot do)
- Tool list with selection rationale (with code format examples)
- Expected SKILL.md structure outline
- Whether `scripts/`, `references/`, `assets/` subdirectories are needed
- Final output form (from Phase 1 decision)
- Evaluation plan (test prompts, expected outputs)

**Wait for user confirmation before proceeding to Phase 4.**

---

<!--zh
### 阶段四：检查冲突并写入文件（Write）

用户确认规划后，**先做冲突检查**，再创建 skill 目录和 SKILL.md。

**冲突检查：**
-->
### Phase 4: Check Conflicts and Write Files

After user confirms the plan, **check for name conflicts first**, then create files.

**Conflict check:**

```
skill_list: { source: all }
# Check if a skill with the same name already exists
```

<!--zh
**冲突处理规则：**
- 如果同名 skill 在 `agents/skills/`（内置）：**不可覆盖**，必须告知用户换一个名称，重新确认后才能继续
- 如果同名 skill 在 `.workspace/skills/`（workspace）：询问用户是否覆盖
  - 用户确认后：先完整删除原目录，再重新创建（不走编辑逻辑）
  - 这样确保新 skill 是干净的初始状态
- 无冲突：直接继续写文件

**编写 SKILL.md：**
-->
**Conflict rules:**
- Same name in `agents/skills/` (built-in): **Cannot override**. Tell the user to choose a different name, then re-confirm before continuing.
- Same name in `.workspace/skills/` (workspace): Ask user for confirmation.
  - If confirmed: delete the entire directory first, then recreate from scratch (do not edit in place).
- No conflict: proceed to write files directly.

**Writing SKILL.md:**

<!--zh
SKILL.md 组成部分：
- **name**: skill 标识符（即目录名）
- **description**: 触发时机和功能描述（英文，语义触发依赖此字段）。描述要稍微"主动"一些，让 AI 知道什么时候必须使用
- **description-cn**: 中文描述（可选）
- **正文**: 技能执行的具体指引

目录结构：
-->
SKILL.md components:
- **name**: Skill identifier (same as directory name)
- **description**: When to trigger, what it does (English). Make it slightly "assertive" so AI knows when it must use the skill.
- **description-cn**: Chinese description (optional)
- **body**: Specific instructions for skill execution

Directory structure (paths relative to `.workspace/` — use these paths directly with file tools):

```
skills/<skill-name>/
├── SKILL.md          (required)
├── (no plan.md here — plan file lives at skills/<skill-name>_plan.md)
├── evals/
│   └── evals.json    (test cases)
├── scripts/          (executable scripts, optional)
├── references/       (reference docs loaded on demand, optional)
└── assets/           (templates, icons, fonts, optional)
```

<!--zh
**渐进式加载原则**：
1. 元数据（name + description）：始终在上下文中（约 100 字）
2. SKILL.md 正文：触发时加载（建议 < 500 行）
3. 子目录资源：按需加载（无限制）

SKILL.md 正文要简洁，把复杂内容放到 `references/` 下，在正文中说明何时读取。
-->
**Progressive loading principle**:
1. Metadata (name + description): always in context (~100 words)
2. SKILL.md body: loaded when triggered (ideally < 500 lines)
3. Subdirectory resources: loaded on demand (no size limit)

Keep SKILL.md concise. Move complex content to `references/`, with clear pointers in the body about when to read them.

---

<!--zh
### 阶段五：测试（Test）

编写 2-3 个真实用户会说的测试 prompt，先和用户确认。

测试用例保存到 `skills/<skill-name>/evals/evals.json`（路径相对于 `.workspace/`）：
-->
### Phase 5: Test

Write 2-3 realistic test prompts — the kind a real user would actually say. Share with the user first.

Save test cases to `skills/<skill-name>/evals/evals.json` (relative to `.workspace/`):

```json
{
  "skill_name": "my-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "User's task prompt",
      "expected_output": "Description of expected result",
      "assertions": []
    }
  ]
}
```

<!--zh
**执行测试（使用 using-llm 模拟 with_skill / baseline）：**

本环境没有子 Agent，改用 `using-llm` 调用 LLM 模拟执行：
1. 加载 `using-llm` skill，读取 SKILL.md 内容
2. 对每个测试用例，调用两次 LLM：
   - **with_skill**：system prompt 包含 SKILL.md 内容 + 任务描述
   - **baseline**：system prompt 仅包含通用任务描述，不附带 SKILL.md
3. 将两次结果写入 `skills/<skill-name>/evals/iteration-N/case-N-with_skill.json` 和 `case-N-baseline.json`
4. 根据 assertions 对输出评分，写入 `grading.json`

结果目录：`skills/<skill-name>/evals/iteration-N/`（相对于 `.workspace/`）

**评分和汇总：**
-->
**Running tests (using `using-llm` to simulate with_skill / baseline):**

This environment has no sub-agents. Use `using-llm` to call an LLM programmatically:
1. Load `using-llm` skill and read the SKILL.md content
2. For each test case, make two LLM calls:
   - **with_skill**: system prompt includes the full SKILL.md content
   - **baseline**: system prompt is a generic task description only, no SKILL.md
3. Write results to `skills/<skill-name>/evals/iteration-N/case-N-with_skill.json` and `case-N-baseline.json`
4. Grade outputs against assertions, write `grading.json`

Results directory: `skills/<skill-name>/evals/iteration-N/` (relative to `.workspace/`)

<!--zh **评分和汇总：** -->
**Grading and aggregation:**

```
shell_exec:
  command: python -m scripts.aggregate_benchmark skills/<skill-name>/evals/iteration-N --skill-name <skill-name>
```

<!--zh
**生成评测报告（无浏览器，输出静态 HTML）：**
本项目运行在容器中，没有浏览器。评测报告用 `--static` 模式输出静态 HTML 文件。
-->
**Generating eval report (no browser — output static HTML):**
This environment has no browser. Use `--static` mode to output a standalone HTML file.

```
shell_exec:
  command: >
    python agents/skills/skill-creator/eval-viewer/generate_review.py
    skills/<skill-name>/evals/iteration-N
    --skill-name <skill-name>
    --benchmark skills/<skill-name>/evals/iteration-N/benchmark.json
    --static skills/reports/<skill-name>-eval-iteration-N.html
```

<!--zh
生成后告知用户报告路径，由用户在前端文件管理中打开预览。
-->
After generation, tell the user the report path so they can open it in the frontend file manager.

---

<!--zh
### 阶段六：迭代改进（Iterate）

根据用户反馈改进 skill：
1. 应用改进到 SKILL.md
2. 将新测试放到新的 `iteration-N+1/` 目录
3. 重新生成报告，`--previous-workspace` 指向上一轮

继续循环直到：
- 用户满意
- 反馈全为空
- 没有实质性进展
-->
### Phase 6: Iterate

Improve the skill based on user feedback:
1. Apply improvements to SKILL.md
2. Put new test results in `iteration-N+1/` directory
3. Regenerate the report, pass `--previous-workspace` pointing at the previous iteration

Continue until: user is satisfied, all feedback is empty, or no meaningful progress.

**When improving, keep in mind:**
- Generalize from feedback — the skill must work for a million future prompts, not just your test cases
- Keep SKILL.md lean — remove things not pulling their weight
- Explain the "why" — LLMs respond better to reasoning than rigid rules

---

<!--zh
### 阶段七：description 优化

创建或改进 skill 后，可以优化 description 字段以提升触发准确率。
本项目使用 `using-llm` skill 完成描述评估：

1. 生成 20 个测试查询（一半应触发、一半不应触发），让用户确认
2. 加载 `using-llm` skill，用 LLM 模拟"AI 看到这个 description 会不会加载该 skill"
3. 用不同 description 版本分别测试，比较触发率
4. 取触发效果最好的 description 更新 SKILL.md frontmatter

具体流程写在 `references/super-magic-tools.md` 中。
-->
### Phase 7: Description Optimization

After creating or improving a skill, offer to optimize the `description` field for better triggering accuracy.

This project uses the `using-llm` skill for description evaluation:
1. Generate 20 test queries (mix of should-trigger / should-not-trigger); have user confirm
2. Load `using-llm` skill; use LLM to simulate "would AI load this skill given this description?"
3. Test different description versions, compare trigger rates
4. Update SKILL.md frontmatter with the best-performing description

See `references/super-magic-tools.md` for the detailed procedure.

---

<!--zh
### 阶段八：询问是否打包

在 skill 创建完成并通过用户确认后，必须询问：

> "是否需要将这个 skill 打包成 `.skill` 文件，方便分享或在其他项目中安装？"

如果是：
-->
### Phase 8: Ask About Packaging

After the skill is done and user-confirmed, always ask:

> "Would you like to package this skill into a `.skill` file for sharing or installing in other projects?"

If yes:

```
shell_exec:
  command: python -m scripts.package_skill skills/<skill-name>
# Packaged file: skills/<skill-name>/<skill-name>.skill  (relative to .workspace/)
```

<!--zh
不要默认打包，也不要跳过这个询问。
-->
Do not package by default. Do not skip this step.

---

<!--zh
## 注意事项

### 执行路径
- **文件工具**（`write_file`、`read_file` 等）的路径相对于 `.workspace/`，直接写 `skills/<skill-name>/...`，**不要带 `.workspace/` 前缀**，否则会写到 `.workspace/.workspace/skills/...`（多嵌套一层）
- `shell_exec` 的**默认工作目录是 `.workspace/`**，命令内部同样**不要带 `.workspace/` 前缀**，直接写 `skills/<skill-name>/...` 即可
- `cwd` 参数本身是相对**项目根目录**解析的，所以 `cwd` 写 `.workspace/skills/<skill-name>` 才是正确的
- workspace skill 的 scripts 执行时，`cwd` 应为 `.workspace/skills/<skill-name>`
- skill-creator 自身的脚本（如 `aggregate_benchmark.py`）执行时，`cwd` 是 `agents/skills/skill-creator`

### 内置 skill 不可覆盖
- `agents/skills/` 下的 skill 优先级最高，`skill_list` 返回的 `can_override: false`
- 如果用户要创建的 skill 与内置 skill 同名，**不可操作**，必须让用户重命名

### workspace skill 的覆盖逻辑
- `can_override: true` 的 skill，覆盖时：先用 `delete_files` 删除整个目录，再重建
- 不走"编辑"逻辑，确保新 skill 是干净的初始状态
-->
## Important Notes

**Execution paths:**
- **File tools** (`write_file`, `read_file`, etc.) resolve paths relative to `.workspace/`. Use `skills/<skill-name>/...` directly — **never prefix with `.workspace/`**, or files land in `.workspace/.workspace/skills/...` (double-nested).
- `shell_exec` **default working directory is `.workspace/`**. Same rule: inside commands use `skills/<skill-name>/...` without `.workspace/` prefix.
- The `cwd` parameter is resolved relative to the **project root**, so `cwd=".workspace/skills/<skill-name>"` is correct.
- When running scripts for a workspace skill, `cwd` = `.workspace/skills/<skill-name>`
- When running skill-creator's own scripts (e.g., `aggregate_benchmark.py`), `cwd` = `agents/skills/skill-creator`

**Built-in skills cannot be overridden:**
- Skills in `agents/skills/` have highest priority; `skill_list` returns `can_override: false`
- If the requested skill name conflicts with a built-in skill, **refuse to proceed** and ask the user to choose a different name

**Workspace skill override logic:**
- For `can_override: true` skills: delete the entire directory with `delete_files` first, then recreate
- Do not edit in place — start clean

---

<!--zh
## 参考文件

- `references/super-magic-tools.md` — 项目可用工具的详细说明和 Python 调用示例
- `references/schemas.md` — evals.json、grading.json 等的 JSON 结构规范
-->
## Reference Files

- `references/super-magic-tools.md` — Detailed descriptions and Python call examples for all available project tools
- `references/schemas.md` — JSON schemas for evals.json, grading.json, etc.
