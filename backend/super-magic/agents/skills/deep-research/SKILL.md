---
name: deep-research
description: |
  Read this skill when the user asks for a research report, deep research, industry report, analysis report, whitepaper, or any substantive document deliverable; or when the topic requires multi-source retrieval and cross-validation (competitive analysis, market analysis, industry research, deep dive, landscape survey); or when the user is unsatisfied with the depth of an existing answer. Keyword signals: research, deep research, deep dive, analysis, investigate, report, survey, industry analysis, competitive analysis, market analysis. Trigger when: (1) the user wants to produce a formal report or research document as the deliverable; (2) the topic requires current, verifiable data from multiple sources — news, market analysis, competitive landscape, industry research; (3) the user is unsatisfied with the depth of an existing answer. Skip when a single search or model recall suffices and no document output is needed.

name-cn: 深度调研技能
description-cn: |
  当用户要求产出研报、深度研报、行业研报、调研报告、深度报告、解读报告、深度分析、深度解读、白皮书等正式文档，或话题涉及竞品分析、市场分析、行业研究、深挖、盘点等需要多来源检索与交叉验证的内容，或对现有回答的深度不满意时，需要阅读这个 Skill。关键词信号：研报、深度研报、行业研报、调研报告、深度报告、深度分析、解读报告、深度解读、深度调研、竞品分析、市场分析、盘点、深挖、行业分析、白皮书。触发条件：(1) 用户的目标是产出一份有分量的研报/报告文档；(2) 话题需要来自多个来源的当前可验证数据，如时事、市场分析、竞品格局、行业研究；(3) 用户对已有回答的深度不满意。不需要产出文档、且单次搜索或模型已知知识能解决时不触发。
---

<!--zh
# 深度调研技能
-->
# Deep Research Skill

<!--zh
用于将模糊问题转化为可验证、可落地、有证据链的调研结论，默认产出高质量 HTML 调研报告。
-->
Turn vague questions into verifiable, actionable, evidence-backed research outcomes, with polished HTML report as default deliverable.

---

<!--zh
## 按需读取的参考文件

每个文件对应一个独立条件，按需组合加载：
- 新调研或深化现有内容时 -> [reference/research-workflow.md](reference/research-workflow.md)（完整调研流程，含深化场景的缺口诊断）
- 交付物是 HTML 报告时 -> [reference/report-template.html](reference/report-template.html)（无论新建还是重构）
-->
## References (Read On Demand)

Each file maps to an independent condition — combine as needed:
- New research or deepening existing content -> [reference/research-workflow.md](reference/research-workflow.md) (full workflow, including gap diagnosis for deepening)
- Delivering an HTML report -> [reference/report-template.html](reference/report-template.html) (whether new or restructured)

---

<!--zh
## 核心约束（必须遵守）

1. 先确认再执行重调研：读取本技能后，先输出计划草案 + 启动问答卡，等待用户确认，确认前不执行大规模检索。
2. 降低用户输入成本：提供可直接选择的选项与默认值，允许 开始 或 `B A A A C` 极短回复启动。
3. 报告必须有证据链：所有关键结论可追溯来源，必须含反方证据或不确定性说明。
4. 默认输出为 HTML 调研报告：结构、引用方式、视觉规范遵循报告模板。
-->
## Non-Negotiable Rules

1. Plan and confirm before heavy execution: after loading, output plan draft + kickoff Q&A, wait for confirmation. No heavy retrieval before user confirms.
2. Minimize user typing: provide selectable options with defaults; allow start or `B A A A C` (one letter per question).
3. Every major claim needs evidence: traceable to sources; include counter-evidence or uncertainty notes.
4. Default deliverable is HTML report: follow template rules for structure, citations, and visual quality.

---

<!--zh
## 触发后立即执行的动作

### Step 1：快速预检索
用 web_search 一次批量发 2-3 个不同角度的 query（如"是什么"+"当前争议"+"应用场景"），了解主题基本轮廓和关注点。不需要深读，只是为了让计划和提问更有针对性。

### Step 2：输出调研计划草案
至少包含：目标与边界、关键问题拆解（3-7 个）、来源策略、交付结构、预计深度级别。

### Step 3：发送启动问答卡
问答卡分两层：

**确认问题（≤3 个）**：影响调研边界的核心问题，基于预检索定制，不要每次都问同一套。
参考维度（按需选用）：深度/时间范围/地域/信源偏好/关注角度。

**顺手可加（恰好 3 个）**：预检索中发现的跨领域延伸视角——这些内容在常规调研范围之外，用户可能没想到但会觉得有价值。不要把本来就该调研的内容放在这里。

确认词与用户语言一致——中文用"开始"，英文用"start"。

> 注意：深度调研比普通回答耗时更长，需要多轮检索和交叉验证。

### Step 4：等待用户确认
支持：开始（全部默认）、字母组合选项、自由文本补充后开始。

### 低输入交互规则
1. 回复"开始"：直接按默认参数开始，不再追问。
2. 回复字母组合：解析后开始。
3. 拒绝回答：使用默认参数，标注默认假设后开始。
4. 输入含糊：仅补问 1 个最关键的问题。
-->
## Immediate Actions After Trigger

### Step 1: Quick pre-search
Run one web_search call with 2-3 queries in parallel from different angles (e.g. "what is X" + "X current debates" + "X use cases"). No deep reading — just enough to understand the topic's shape and key concerns so the plan and questions are sharper.

### Step 2: Output the research plan draft
Include at least: objective and boundary, key question breakdown (3-7), source strategy, deliverable outline, expected depth mode.

### Step 3: Send kickoff Q&A card
The card has two tiers:

**Confirm questions (≤3)**: scope-defining questions that genuinely affect this research — customized from the pre-search, not a fixed template. Reference dimensions (pick what applies): depth / time range / geography / source preference / angle of focus.

**Optional add-ons (exactly 3)**: cross-domain or adjacent angles surfaced by the pre-search — things outside the natural research scope that the user likely didn't think to ask for but would find valuable. Do not put things that obviously belong in the core research here.

Adapt the confirmation word to the user's language — "开始" for Chinese, "start" for English.

> Heads up: deep research takes longer than a quick answer — expect multiple search rounds and cross-checking.

### Step 4: Wait for user confirmation
Support: start (all defaults), letter-combo options, free-text constraints followed by start.

### Low-Input Interaction Rules
1. If user replies start: begin immediately with default settings.
2. If user replies option combo: parse and begin.
3. If user declines questions: begin with defaults, state assumptions explicitly.
4. If input is still ambiguous: ask only the single most critical follow-up.

---

<!--zh
## 当用户反馈"太浅显/证据不足"时（场景 B：深化现有内容）

这是深化场景，不是新建报告。进入深化模式，不可做措辞润色。

先判断现有内容的类型：
- 若现有内容是 HTML 报告（无论谁生成的），主动询问：是否需要按 deep-research 报告模板重构为结构完整的版本？
  - 用户同意 -> 读 deepen-guide.md + report-template.html，按模板重构
  - 用户不同意 -> 只读 deepen-guide.md，在原有格式上深化
- 若现有内容不是 HTML 报告（文本、Markdown 等）-> 只读 deepen-guide.md，输出格式跟随现有内容
-->
## When User Says "Too Shallow" / "Lacks Evidence" (Scenario B: Deepen Existing Content)

This is deepening mode, not a new report. Enter deepening mode instead of superficial rewriting.

First, assess the type of existing content:
- If the existing content is an HTML report (regardless of origin), proactively ask: "Would you like to restructure this into a full deep-research report using our template?"
  - User agrees -> read deepen-guide.md + report-template.html, restructure to template
  - User declines -> read deepen-guide.md only, deepen within the existing format
- If the existing content is not an HTML report (plain text, Markdown, etc.) -> read deepen-guide.md only, output format follows existing content

<!--zh
明白，我来加强一下。

直接回 `好的` 就按默认加强，或者告诉我哪里最不满意：

**1) 最大的问题是？**
- A. 证据太少
- B. 结论太笼统
- C. 没有反方观点
- D. 建议没法落地

**2) 重点深化哪块？**
- A. 数据和事实
- B. 推理和方法论
- C. 行业案例和对比
-->

Got it, I'll dig deeper.

Just reply `ok` to go with default settings, or tell me what bothered you most:

**1) Biggest gap?**
- A. Not enough evidence
- B. Conclusions too vague
- C. No counterpoints
- D. Recommendations can't be acted on

**2) Where to focus?**
- A. Data and facts
- B. Reasoning and methodology
- C. Industry cases and comparisons

---

<!--zh
## 最小执行伪流程
-->
## Minimal Execution Pseudoflow

```text
read this skill first
read research-workflow.md
if output is HTML report: read report-template.html

if task is new research:
    draft plan + send kickoff Q&A -> wait for confirmation
    execute full workflow -> deliver

if task is deepening existing content:
    diagnose gaps (Phase 6 of research-workflow.md) -> re-run retrieval on weak areas
    rewrite affected sections only -> deliver
```

---

<!--zh
## 输出风格要求

- 计划和问答阶段：简洁、友好、可快速决策
- 报告阶段：结论先行，证据透明，方法可复现
- 交互阶段：优先少打字启动，必要时再加问
-->
## Output Style

- Planning and kickoff: concise, friendly, decision-ready
- Report phase: conclusion-first, evidence-transparent, method-reproducible
- Interaction: prioritize low-typing start, ask more only when needed
