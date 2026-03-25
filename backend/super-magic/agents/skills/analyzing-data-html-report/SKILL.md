---
name: analyzing-data-html-report
description: Data analysis report development skill. Use when users need to develop data analysis reports, create analysis report projects, build static HTML analysis documents, or produce one-time analysis reports with visualization.

name-cn: 数据分析报告开发技能
description-cn: 数据分析报告开发技能。当用户需要开发数据分析报告、创建分析报告项目、构建静态HTML分析文档、产出一次性分析报告时使用。
---

# 数据分析报告开发技能 / Data Analysis Report Development Skill

<!--zh
提供数据分析报告开发能力，包括创建分析报告项目、生成静态 HTML 分析报告、集成可视化图表等完整开发流程。
-->

Provides data analysis report development capabilities, including creating analysis report projects, generating static HTML analysis reports, integrating visualization charts, and complete development workflows.

---

## 如何使用本文档 / How to Use This Document

<!--zh
本文档提供快速指引和核心工具说明。需要了解细节时，可阅读以下 reference 文档：
- **完整代码示例** → references/report-workflow.md
- **ECharts 5.6.0 规范** → references/report-echarts-v5.md
-->

This document provides quick guidance and core tool descriptions. For details, refer to the following reference documents:

- **Complete code examples** → references/report-workflow.md
- **ECharts 5.6.0 specification** → references/report-echarts-v5.md

---

## 代码执行方式 / Code Execution Method

<!--zh
Python 分析脚本通过 Shell 工具执行（如 `python analyze.py`）。
-->

Python analysis scripts are executed via Shell tool (e.g., `python analyze.py`).

---

## 快速开始 / Quick Start

<!--zh
**重要提示**：在执行以下步骤前，建议先阅读对应的 reference 文档以了解详细规范：
- 开始报告开发前 → 阅读 `reference/report-workflow.md` 了解完整开发流程和代码示例
- 配置图表时 → 阅读 `reference/report-echarts-v5.md` 了解 ECharts 5.6.0 使用规范
-->

**Important**: Before executing the following steps, it's recommended to read the corresponding reference documents to understand detailed specifications:
- Before starting report development → Read `reference/report-workflow.md` for complete workflow and code examples
- When configuring charts → Read `reference/report-echarts-v5.md` for ECharts 5.6.0 usage specification

<!--zh
**开发报告项目：创建报告工作目录并执行分析：**
-->

**Develop report project: Create report working directory and execute analysis:**

```python
# Step 1: 创建报告目录（目录名体现分析内容）/ Create report directory (name reflects analysis content)
import os
os.makedirs('销售数据分析', exist_ok=True)  # or 'Sales Data Analysis' for English

# Step 2: 编写分析脚本 / Write analysis script
# 脚本读取数据源，执行分析，输出 data.json
```

<!--zh
**开发 HTML 报告：**
-->

**Develop HTML report:**

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/echarts/5.6.0/echarts.min.js"></script>
  </head>
  <body>
    <div id="chart" style="width:800px;height:400px;"></div>
    <script data-type="report">
      var reportData = {"total": 12345, "chart": [...]};
    </script>
    <script>
      var chart = echarts.init(document.getElementById('chart'));
      chart.setOption({...});
    </script>
  </body>
</html>
```

---

## 主要流程 / Main Workflow

<!--zh
1. **创建报告工作目录**：任务开始时**必须**创建专属目录，目录名必须体现分析内容（如"销售数据分析"），所有报告相关文件（analyze.py、data.json、index.html、README.md）均置于该目录内
2. **执行数据分析**：通过 Python 脚本获取准确的分析结果并输出 data.json 文件
3. **开发 HTML 报告**：创建 index.html 文件，包含 ECharts 可视化，数据通过内联 script 标签嵌入
4. **文档化**：编写 README.md 说明文档
5. **完成交付**：提供报告总结
-->

1. **Create report working directory**: Must create dedicated directory at task start. Directory name must reflect analysis content (e.g., "Sales Data Analysis"). Place all report files (analyze.py, data.json, index.html, README.md) in this directory
2. **Execute data analysis**: Use Python script to get accurate analysis results and output data.json file
3. **Develop HTML report**: Create index.html file with ECharts visualization, data embedded via inline script tag
4. **Documentation**: Write README.md documentation
5. **Complete delivery**: Provide report summary

---

## 文件命名规范 / File Naming Rules

<!--zh
**目录命名**：必须体现分析内容和业务领域，根据用户偏好语言智能确定，例如：
- 用户偏好语言为中文："销售数据分析"、"2024年财务报告"、"用户行为分析"
- 用户偏好语言为英文："Sales Data Analysis"、"2024 Financial Report"、"User Behavior Analysis"

**文件命名**：在目录内使用标准名称，例如：
- HTML 报告：`index.html`（主报告文件）
- 数据文件：`data.json`（分析结果数据）
- 分析脚本：`analyze.py`（数据分析脚本）
- 说明文档：`README.md`（项目说明）

**完整示例**：
- 中文项目：`销售数据分析/index.html`、`销售数据分析/data.json`
- 英文项目：`Sales Data Analysis/index.html`、`Sales Data Analysis/data.json`
-->

**Directory Naming**: Must reflect analysis content and business domain, intelligently determined by user preferred language, e.g.:

- User preferred language is Chinese: "销售数据分析", "2024年财务报告", "用户行为分析"
- User preferred language is English: "Sales Data Analysis", "2024 Financial Report", "User Behavior Analysis"

**File Naming**: Use standard names within directory, e.g.:

- HTML report: `index.html` (main report file)
- Data file: `data.json` (analysis result data)
- Analysis script: `analyze.py` (data analysis script)
- Documentation: `README.md` (project documentation)

**Complete Examples**:

- Chinese project: `销售数据分析/index.html`, `销售数据分析/data.json`
- English project: `Sales Data Analysis/index.html`, `Sales Data Analysis/data.json`

---

## 关键规则 / Key Rules

<!--zh
### 静态化原则
- 单 HTML 文件，所有数据内联，零异步加载
- 数据通过 `<script data-type="report">` 标签嵌入：`var reportData = {...};`

### 技术约束
- 仅使用 ECharts 5.6.0 规范
- Python 脚本仅用于数据分析获取准确结果，不用于生成图片
- 图表必须用 ECharts，严禁 Python 生成图片
-->

### Staticization Principle

- Single HTML file, all data inline, zero async loading
- Data embedded via `<script data-type="report">` tag: `var reportData = {...};`

### Technical Constraints

- Use ECharts 5.6.0 specification only
- Python scripts for data analysis to get accurate results only, not for generating images
- Charts must use ECharts, strictly prohibited to generate images via Python

---

## 决策树 / Decision Tree

<!--zh
需要生成分析报告？
├─ 是 → 报告类型？
│   ├─ 静态 HTML 单页报告 → 本技能
│   └─ 可交互 Dashboard → analyzing-data-dashboard 技能
└─ 否 → 仅需即时数值回答 → data-qa 技能

图表类型选择？
├─ 折线/柱状/饼图等 → ECharts 5.6.0
├─ 纯表格 → HTML table
└─ 混合展示 → ECharts + table
-->

Need analysis report?
├─ Yes → Report type?
│ ├─ Static HTML single-page report → This skill
│ └─ Interactive Dashboard → analyzing-data-dashboard skill
└─ No → Only instant numeric answer → data-qa skill

Chart type?
├─ Line/Bar/Pie etc → ECharts 5.6.0
├─ Table only → HTML table
└─ Mixed → ECharts + table

---

## 技术栈 / Tech Stack

<!--zh
CDN 资源：
-->

CDN Resources:

- TailwindCSS: https://cdn.tailwindcss.com/3.4.17
- ECharts: https://cdnjs.cloudflare.com/ajax/libs/echarts/5.6.0/echarts.min.js
- FontAwesome: https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css
- Tabler Icons: https://cdnjs.cloudflare.com/ajax/libs/tabler-icons/3.34.1/tabler-icons.min.css
- Google Fonts: https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap

---

## 参考文档 / Reference

<!--zh
详细用法请查阅 reference 目录：
- `report-workflow.md` - 完整开发流程和代码示例
- `report-echarts-v5.md` - ECharts 5.6.0 使用规范
-->

For detailed usage, refer to the reference directory:

- `report-workflow.md` - Complete workflow and code examples
- `report-echarts-v5.md` - ECharts 5.6.0 usage specification
