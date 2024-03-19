<!--zh
# 深度调研执行流
-->
# Deep Research Workflow

<!--zh
> 本文档适用于两种场景：新建调研报告，以及对已有内容进行深化。Phase 5 为可选，仅在输出 HTML 报告时执行。
-->
> This document applies to both scenarios: new research reports and deepening existing content. Phase 5 is optional — only execute when the output is an HTML report.

---

<!--zh
## Phase 0：输入澄清（计划前）

将用户原始问题转换为以下结构：
- 研究目标（要回答什么）
- 决策场景（用户拿报告做什么）
- 约束条件（时间、地域、行业、对象）
- 输出偏好（结论深度、风格、篇幅）

若用户信息不足，不直接开工，先进入启动问答卡流程。
-->
## Phase 0: Input Clarification (Before Plan)

Convert the raw request into:
- research objective
- decision context
- constraints (time, geography, industry, entities)
- output preferences (depth, style, length)

If information is insufficient, do not start heavy execution; go to kickoff Q&A first.

---

<!--zh
## Phase 1：调研计划草案（先给用户看）

计划应包含：
1. 研究边界（in-scope / out-of-scope）
2. 问题拆解（3-7 个关键问题）——格式化为编号 TODO 列表，这些问题即调研执行的核心任务，Phase 3 每一步都要对照它们，所有关键 TODO 被覆盖后才能进入 Phase 4
3. 来源策略（至少覆盖 3 类来源）
4. 方法说明（如何检索、筛选、比对、归纳）
5. 交付结构（若输出 HTML 报告，必须按顺序包含以下章节）：
   - TL;DR / 核心结论：一段式主结论 + 可信度标注
   - 执行摘要：关键指标（数字计数动画）、趋势图、战略影响
   - 调研范围：目标、来源数量、约束条件
   - 现实核查：误区揭穿卡（观点 vs 现实）+ 极性光谱
   - 深度分析：长文叙述 + 内联引用、关键驱动力卡片、利益相关者影响矩阵
   - 市场版图：生态系统树或关系图
   - 对比分析：雷达图（多选项比较）
   - SWOT 分析：四象限网格
   - 证据矩阵：结论 / 来源 / 数据点 / 可信度 表格
   - 时间线：演变路线图
   - 案例研究：2 个以上真实案例（挑战 / 解决方案 / 结果）
   - 战略裁定：强观点陈述 + 前瞻信号（红黄绿）+ 角色视角
   - 研究方法：调研漏斗图（桑基图）+ 方法说明
   - 来源与参考：可追溯列表 + 悬浮预览
-->
## Phase 1: Research Plan Draft (Show User First)

Plan should include:
1. scope boundary (in-scope / out-of-scope)
2. question breakdown (3-7 key questions) — format as a numbered TODO list; these questions are the execution contract for Phase 3: every search round must be driven by unchecked TODOs, and Phase 4 only begins once all critical TODOs have at least one citable source
3. source strategy (at least 3 source categories)
4. method (retrieve, filter, compare, synthesize)
5. deliverable structure (if output is HTML report, must include these sections in order):
   - TL;DR / Core Conclusion: one-paragraph verdict, high-confidence label
   - Executive Summary: key metrics (count-up numbers), adoption trend chart, strategic implications
   - Research Scope: goal, sources count, constraints
   - Reality Check: myth-buster cards (claim vs. reality) + polarity spectrum
   - Deep Analysis: long-form prose with inline citations, key-driver cards, stakeholder impact matrix
   - Market Landscape: ecosystem tree or relationship chart
   - Comparative Analysis: radar chart for multi-option comparison
   - SWOT Analysis: four-quadrant grid
   - Evidence Matrix: table with claim / source / data point / confidence
   - Timeline: evolution roadmap
   - Case Studies: 2+ real-world examples with challenge / solution / result
   - Strategic Verdict: strong conviction statement + forward-looking signals + role-based perspectives
   - Methodology: research funnel (Sankey chart) + method description
   - Sources & References: traceable list with hover-preview tooltips

---

<!--zh
## Phase 2：低输入启动确认

启动问答卡模板已内嵌在 SKILL.md 中，随计划草案一起展示给用户。
在用户明确"开始"前，不进行大规模检索。
-->
## Phase 2: Low-Input Kickoff Confirmation

The kickoff Q&A template is embedded in SKILL.md — present it alongside the plan draft.
Do not run heavy retrieval until user confirms start.

---

<!--zh
## Phase 3：检索与证据收集

### 执行原则：TODO 驱动，先广后深

每轮搜索前，先对照 Phase 1 的 TODO 列表：哪些问题还没有可引用的证据？以此决定本轮搜索的方向和 query。读完页面后，标记哪些 TODO 已被覆盖、哪些仍有缺口。

进入 Phase 4 的条件：所有关键 TODO 都有至少一条可引用证据，而不是"搜了几轮"。

何时继续：TODO 中仍有未覆盖的关键问题、反方证据尚未出现、数据来源过于单一时，继续。

何时停止：所有关键 TODO 已覆盖，达到深度阈值来源数量，继续搜索大概率只会返回重复内容时，停止。不要为了搜索而搜索。

每次搜索后必须精读：`web_search` 返回的是摘要，不是证据。从结果中选最相关的 URL，用 `read_webpages_as_markdown` 读取正文全文，才算完成一次有效检索。跳过精读等于没有调研。

控制搜索成本：搜索按次计费，每次调用可将结果数设到 20 以提高单次收益；query 要差异化，避免返回重叠内容；宁可多读几个高质量页面，也不要盲目增加搜索次数。

### 工具组合
- `web_search`（limit 可设到 20）：定位候选 URL
- `read_webpages_as_markdown`：读取页面正文（每轮必须执行）
- 必要时读取本地文件作为补充证据

### 证据卡（每条关键结论至少 1 条）
每条证据至少记录：
- claim_id
- claim_text
- source_title
- source_url
- publish_date（如可得）
- evidence_quote（关键原文）
- confidence（high/medium/low）
-->
## Phase 3: Retrieval and Evidence Collection

### Execution principle: TODO-driven, broad before deep

Before each search round, check the TODO list from Phase 1: which questions still lack citable evidence? Use that to decide the direction and queries for this round. After reading pages, mark which TODOs are now covered and which still have gaps.

Gate to Phase 4: all critical TODOs have at least one citable source — not "enough rounds have been run."

When to keep searching: TODOs still have uncovered key questions; counterpoints or dissenting data are missing; sources are too homogeneous.

When to stop: all critical TODOs are covered, the source count threshold is met, further searches would likely return duplicates. Don't search for the sake of searching.

Full-page reading is mandatory after every search: `web_search` returns snippets, not evidence. From each result set, pick the most relevant URLs and read them in full with `read_webpages_as_markdown`. Skipping this step means the research has not actually been done.

Control search cost: each search call costs money — set limit to 20 to maximize yield per call; keep queries differentiated to avoid overlapping results; prefer reading fewer high-quality pages deeply over running more searches blindly.

### Tool combination
- `web_search` (limit up to 20): locate candidate URLs
- `read_webpages_as_markdown`: read full page content (mandatory every round)
- local file reading when needed for supplemental evidence

### Evidence card (required for major claims)
Record at least:
- claim_id
- claim_text
- source_title
- source_url
- publish_date (if available)
- evidence_quote
- confidence (high/medium/low)

---

<!--zh
## Phase 4：分析与综合

必须为所有结论章节产出内容。深度要求：每个子议题至少 3 段论述，每段围绕一个论点展开（现象 → 原因 → 影响），不得用要点列表代替段落，引用数据后必须说明其意义。核心要求：

1. 核心结论 —— 一句高置信度的主判断
2. 关键指标 —— 2-4 个量化数据点，每条附说明
3. 现实核查 —— 识别 3-4 个常见误区，每条"真实情况"不能只写一句反驳，必须包含：
   说清楚为什么错（机制/原理）、用类比让读者一下就懂（如"它像操作系统，不是库"）、告诉读者该怎么做或该避免什么；同时在 2-4 个极性轴上标注主题当前位置（如"实验阶段 -- 当前位置 -- 生产就绪"），每条轴附一句说明
4. 关键驱动力 —— 主要发现背后的供给侧与需求侧力量，每股力量单独成段展开
5. 利益相关者影响矩阵 —— 不同角色受到的影响（正/负/量级）
6. 结论-证据映射 —— 每个主要结论都有 [SN] 引用锚点
7. 反方观点 —— 至少一处挑战主叙述的内容，须充分展开，不能只是一句话
8. 局限性 —— 数据范围、时间窗口、样本偏差
9. 案例研究 —— 至少 2 个真实案例，每个案例须包含：背景、挑战、行动、结果、可复用的经验
10. 战略裁定 —— 有强观点和信念语气的立场陈述；包含 3-5 个前瞻信号（绿/黄/红）和 3 个角色视角，分别描述不同影响
-->
## Phase 4: Analysis and Synthesis

Must produce content for all conclusion sections. Depth requirement: each sub-topic needs at least 3 paragraphs of prose, each built around one argument (observation → cause → implication). Do not substitute bullet lists for paragraphs; always explain the significance of cited data. Key requirements:

1. Core conclusion — one clear, high-confidence verdict sentence
2. Key metrics — 2-4 quantitative data points, each with a brief explanation of what it means
3. Reality Check — identify 3-4 common myths. For each, the "Truth" must go beyond a one-liner: explain *why* the myth is wrong (the underlying mechanism), add a concrete analogy to make it click (e.g. "it's an OS, not a library"), and state what the reader should do or avoid as a result. Also place the subject on 2-4 polarity axes (e.g. "Experimental -- current position -- Production-ready"), each with a one-sentence annotation
4. Key drivers — supply-side and demand-side forces behind the main finding; each force developed in its own paragraph
5. Stakeholder impact matrix — how different roles are affected (positive / negative / magnitude)
6. Claim-to-evidence mapping — every major claim traceable to a citation [SN]
7. Counterpoints — at least one section challenging the main narrative, fully developed — not just a single sentence
8. Limitations — data scope, time window, sample bias
9. Case studies — at least 2 real-world examples, each covering: background, challenge, actions taken, results, reusable lessons
10. Strategic verdict — strong opinionated stance with conviction language; include 3-5 forward-looking signals (green/yellow/red) and 3 role-based perspectives describing distinct implications

---

<!--zh
## Phase 5：HTML 报告生成（可选，仅输出 HTML 时执行）

核心原则：以 report-template.html 为结构和交互规范，生成一份内容完全替换为真实调研数据的 HTML 报告。

报告篇幅较长，分至少 3 次输出，每次控制在 500 行 / 30000 字以内，超出会导致连接超时：
- 第 1 次：输出完整骨架——`<head>`、全部 CSS、所有 section 容器（仅留标题和 `<!-- ANCHOR: section-name -->` 占位，不填正文）、全部 JavaScript
- 第 2、3、... 次：用 edit_file 按锚点填充内容，自行判断在哪里切分，确保每次不超 500 行 / 30000 字

执行要求：
1. 参考已读取的 report-template.html，了解其 HTML 结构、CSS 规范和全部 JavaScript 交互逻辑；若尚未读取则先读取。
   **主题身份标识（必填，严禁保留模板默认值）**：
   - `<title>`：`[主题名称] — 深度调研 [年份]`，例如 `OpenClaw — 深度调研 2026`
   - 导航图标（`fa-solid fa-*`）：选择与主题语义匹配的图标，例如 AI Agent 用 `fa-robot`，市场分析用 `fa-chart-line`，安全用 `fa-shield-halved`，生物科技用 `fa-flask`
   - 导航标签：主题关键词，不超过 15 个字符，如 `OpenAI`、`电动汽车`、`碳中和`、`苹果Vision Pro`，**严禁**保留 `Deep Research`
2. 尽可能包含 Phase 1 中列出的所有章节，仅在主题确实无法适配时才可省略对应章节
3. 以下 JavaScript 交互组件须逐字保留（与主题无关，直接复用）：
   - 引用悬浮预览（citation tooltip）：这是一个独立的 `<script>` 块，使用 `DOMContentLoaded`（与 ECharts 的 `window.onload` 块分开）。逐字复制，不要合并进其他脚本——它负责创建 `.citation-tooltip` div、读取来源名称和标题、定位悬浮卡片。定位常见错误：`top` 用 `scrollTop`，`left` 用 `scrollLeft`，不能混用，否则悬浮卡片会向右漂移
   - CountUp 数字动画：使用 IntersectionObserver 触发 `.count-up` 元素的数值动画
   - 打字机效果：对 `#core-conclusion` 元素，在 1.5 秒内逐字显示文本，保留原有 HTML 节点结构和样式
4. ECharts 图表须根据真实数据生成（树图、雷达图、桑基图等），不得使用 mock 数值。图表渲染规范：echarts.init() 必须在 window.onload 内调用（不能用 DOMContentLoaded）；监听 window.resize 并对所有图表实例调用 resize()；预留足够边距确保标签不被裁切。
   **图表位置规定**：架构图、关系图、生态系统图、桑基图等宽幅复杂图表，必须内联放置在主内容流中，使用全宽容器（`w-full`），严禁放入侧边栏（4/12 列）——侧边栏宽度会导致标签被截断、图表不可读。侧边栏仅适合放置简单紧凑型图表（小型柱状图、散点图等）
5. 分析章节须有完整段落论述，遵循 Phase 4 的深度标准（每个子议题至少 3 段，现象→原因→影响），叙述性章节禁止用要点列表代替段落
6. 所有关键结论须带 [SN] 引用锚点，来源卡片须包含真实 URL 和对应 id 属性

若输出格式不是 HTML，跳过本阶段，以用户指定格式交付 Phase 4 的分析结果。
-->
## Phase 5: HTML Report Generation (Optional — only when output is HTML)

Core principle: use report-template.html as the structural and interactive specification, then generate a fully original HTML report with all mock content replaced by real research data.

The report is long — split into at least 3 passes, each under 500 lines / 30,000 characters, to avoid connection timeouts from oversized single outputs:
- Pass 1: output the complete skeleton — `<head>`, all CSS, all section containers (titles and `<!-- ANCHOR: section-name -->` placeholders only, no prose), all JavaScript
- Passes 2, 3, …: use edit_file to fill content by anchor; decide split points yourself based on actual content volume, keeping each pass under 500 lines / 30,000 characters

Execution requirements:
1. Reference report-template.html (already read) for its HTML structure, CSS conventions, and all JavaScript interaction logic; read it now if not yet in context.
   **Topic identity (mandatory, never use generic defaults)**:
   - `<title>`: `[Topic Name] — Deep Research [Year]`, e.g. `OpenClaw — Deep Research 2026`
   - Nav icon (`fa-solid fa-*`): choose one that semantically matches the topic (e.g. `fa-robot` for AI agents, `fa-chart-line` for markets, `fa-shield-halved` for security, `fa-flask` for biotech, `fa-landmark` for policy)
   - Nav label: short topic keyword ≤15 chars, e.g. `OpenAI`, `EV Market`, `Carbon Neutral`, `Apple Vision Pro` — **never** leave as `Deep Research`
2. Include as many sections from Phase 1 as the topic allows — omit only sections that genuinely do not apply to the subject matter.
3. The following JavaScript components must be reproduced verbatim (they are topic-agnostic and reusable as-is):
   - Citation hover-preview: this is a standalone `<script>` block using `DOMContentLoaded` (separate from the ECharts `window.onload` block). Copy it verbatim — it creates the `.citation-tooltip` div, reads source name/title from the target element, and positions the tooltip on hover. Positioning pitfall: `top` uses `scrollTop`, `left` uses `scrollLeft` — never mix them or the tooltip will drift sideways.
   - CountUp animation: use IntersectionObserver to trigger number animations on `.count-up` elements.
   - Typewriter effect: animate `#core-conclusion` text character-by-character over 1.5 seconds, preserving original HTML node structure and styles.
4. ECharts charts must use real research data (tree map, radar chart, Sankey diagram, etc.) — no mock values. Chart rendering rules: always call echarts.init() inside window.onload (not DOMContentLoaded); listen to window.resize and call resize() on all chart instances; reserve sufficient margin so labels are never clipped.
   **Chart placement rule**: complex wide charts (architecture tree, relationship graph, ecosystem map, Sankey) must be placed inline in the main content flow with a full-width container (`w-full`). Never place them in the sidebar (4/12-col column) — labels will be truncated and the chart becomes unreadable. The sidebar is only suitable for simple, compact charts like small bar or scatter charts.
5. Analysis sections must have substantial paragraph-level prose — follow the depth standard in Phase 4 (at least 3 paragraphs per sub-topic, observation → cause → implication). Never substitute bullets for prose in narrative sections.
6. All major claims must include [SN] citation anchors; source cards must have real URLs and matching id attributes.

If output format is not HTML, skip this phase and deliver Phase 4 analysis in the user's preferred format.

---

<!--zh
## Phase 6：质量闸门（交付前全部通过）

### 交付前检查
1. 问题覆盖：计划中的关键问题，均有对应结论或明确"暂无充分证据"说明
2. 证据完备：所有关键结论有来源引用；至少 1 组反方证据或不确定性说明
3. 来源质量：来源结构不过度单一，避免只来自同类渠道
4. 建议可执行：建议具备优先级、实施条件、潜在风险
5. 结构可读：章节完整、逻辑顺序清晰、术语一致
6. HTML 完整性（如适用）：14 个章节全部存在；ECharts 图表、CountUp 动画、打字机效果、引用悬浮预览脚本均完整可运行

未通过时，回到 Phase 3/4 补齐。

### 深度级别最低标准

| 模式 | 来源数量 | 证据密度 | 适用场景 |
|---|---|---|---|
| Quick | >= 10 | 关键结论覆盖 | 快速但非浅显的回答 |
| Standard | >= 15 | 关键 + 支撑结论覆盖 | 默认决策支持 |
| Expert | >= 25 | 完整结论图谱 + 反方 | 高风险或战略决策 |

### 深化场景：缺口诊断与修复

当任务是对已有内容进行深化时，先诊断缺口，再针对性修复：
- A. 证据密度不足 -> 增加检索轮次、多样化来源
- B. 结论不够具体 -> 改为"条件 + 结论 + 影响"结构
- C. 缺少反方视角 -> 增加反例章节
- D. 建议不可执行 -> 补齐"优先级 / 前提 / 风险"

仅重写有缺口的章节，避免无关重写。
-->
## Phase 6: Quality Gates (All Must Pass Before Delivery)

### Pre-Delivery Gates
1. Question coverage: every planned key question has a conclusion or explicit "insufficient evidence" note
2. Evidence completeness: all major claims have source citations; at least one counterpoint or uncertainty note
3. Source diversity: sources are not overly concentrated in one channel type
4. Actionable recommendations: include priority, preconditions, and risks
5. Readable structure: sections complete, logic clear, terminology consistent
6. HTML completeness (if applicable): all 14 sections present; all ECharts, CountUp, typewriter, and citation-tooltip scripts are intact and functional

If any gate fails, loop back to Phase 3/4 to deepen.

### Depth Mode Thresholds

| Mode | Sources | Evidence Density | Typical Use |
|---|---|---|---|
| Quick | >= 10 | Key claims covered | Fast but non-shallow answer |
| Standard | >= 15 | Key + supporting claims | Default decision support |
| Expert | >= 25 | Full claim map + counterpoints | High-stakes or strategic decisions |

### Deepening Scenario: Gap Diagnosis and Fix

When the task is to deepen existing content, diagnose gaps first, then fix targeted sections:
- A. Insufficient evidence density -> more retrieval rounds, diversify sources
- B. Conclusions too generic -> rewrite as "condition + conclusion + implication"
- C. Missing counterpoints -> add counterpoint section
- D. Recommendations not actionable -> add priority, prerequisites, risks

Rewrite impacted sections only; avoid unrelated changes.
