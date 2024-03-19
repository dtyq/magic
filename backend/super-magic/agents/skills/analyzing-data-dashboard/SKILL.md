---
name: analyzing-data-dashboard
description: Data analysis dashboard development skill. Use when users need to develop data dashboards, create/edit dashboard projects, build data visualization boards, or perform data cleaning for dashboards. Includes dashboard project creation (with sources parameter for auto-marking data sources), card planning, data cleaning (data_cleaning.py), card management tools (create_dashboard_cards, update_dashboard_cards, delete_dashboard_cards, query_dashboard_cards), map download tool (download_dashboard_maps), dashboard development, validation, and data source marking (magic.project.js sources array).

name-cn: 数据分析看板开发技能
description-cn: 数据分析看板(仪表板)开发技能。当用户需要开发数据看板、创建/编辑Dashboard项目、构建数据大屏或进行看板数据清洗时使用。包含看板项目创建(支持sources参数自动标记数据源)、卡片规划、数据清洗(data_cleaning.py)、卡片管理工具(create_dashboard_cards、update_dashboard_cards、delete_dashboard_cards、query_dashboard_cards)、地图下载工具(download_dashboard_maps)、看板开发、校验、以及标记数据源(magic.project.js中的sources数组)。
---

# 数据分析看板开发技能 / Data Analysis Dashboard Development Skill

<!--zh
提供完整的数据分析看板(仪表板)开发能力，包括看板项目创建、卡片规划、数据清洗、看板开发、校验交付等全流程开发能力。数据清洗是看板开发的重要环节。标记数据源使用 magic.project.js 的 sources 数组。
-->

Provides complete data analysis dashboard (仪表板) development capabilities, including dashboard project creation, card planning, data cleaning, dashboard development, validation delivery, and full development workflow. Data cleaning is an important part of dashboard development. Data source marking uses magic.project.js sources array.

---

## 如何使用本文档 / How to Use This Document

<!--zh
本文档提供快速指引和核心工具说明。当需要了解细节时，阅读对应的 reference 文档（使用 skill_read_references 工具）：
- **项目准备** → reference/project-setup.md（数据源、卡片规划、项目结构、模板工具）
- **看板开发** → reference/dashboard-development.md（卡片 DSL、外观排版、ECharts v6、卡片管理工具）
- **数据清洗** → reference/dashboard-data-cleaning.md
- **完整工作流程** → reference/dashboard-workflow.md
-->

This document provides quick guidance and core tool descriptions. When needing details, read the corresponding reference document (use skill_read_references tool):

- **Project setup** → reference/project-setup.md (data sources, card planning, project structure, template tools)
- **Dashboard development** → reference/dashboard-development.md (card DSL, appearance, ECharts v6, card management tools)
- **Data cleaning** → reference/dashboard-data-cleaning.md
- **Full workflow** → reference/dashboard-workflow.md

---

## 代码执行方式 / Code Execution Method

<!--zh
本技能中所有通过 `from sdk.tool import tool` 调用的工具，必须通过 `run_skills_snippet` 的 `python_code` 参数传入执行。
-->

All tool calls via `from sdk.tool import tool` in this skill must be executed by passing code to `run_skills_snippet`'s `python_code` parameter.

---

## 快速开始 / Quick Start

<!--zh
**重要提示**：在执行以下步骤前，建议先阅读对应的 reference 文档以了解详细规范：
- 开始看板开发前 → 阅读 `reference/dashboard-workflow.md` 了解完整工作流程
- 创建项目后 → 阅读 `reference/project-setup.md` 了解项目结构、数据源、卡片规划
- 数据清洗时 → 阅读 `reference/dashboard-data-cleaning.md` 了解数据清洗规范
- 开发卡片时 → 阅读 `reference/dashboard-development.md` 了解卡片 DSL、外观、ECharts v6、卡片管理工具
-->

**Important**: Before executing the following steps, it's recommended to read the corresponding reference documents to understand detailed specifications:

- Before starting dashboard development → Read `reference/dashboard-workflow.md` for complete workflow
- After creating project → Read `reference/project-setup.md` for project structure, data sources, card planning
- When cleaning data → Read `reference/dashboard-data-cleaning.md` for data cleaning specifications
- When developing cards → Read `reference/dashboard-development.md` for card DSL, appearance, ECharts v6, card management tools

### 创建看板项目 / Create Dashboard Project

```python
from sdk.tool import tool

result = tool.call('create_dashboard_project', {
    "name": "销售数据分析看板",
    "sources": [{"type": "file", "name": "sales.csv", "url": "../sales.csv"}]
})

if result.ok:
    # 后续在该项目目录内进行卡片规划、数据清洗、看板开发
    # sources 参数会自动写入 magic.project.js 的 sources 数组
    pass
```

### 校验看板 / Validate Dashboard

```python
from sdk.tool import tool

result = tool.call('validate_dashboard', {
    "project_path": "销售数据分析看板"
})

if result.ok:
    # 无错误和警告方可交付
    pass
```

---

## 核心工具 / Core Tools

### create_dashboard_project - 创建看板项目

| 参数      | 必填 | 类型                 | 说明                                                                                                                                                            |
| --------- | ---- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`    | 是   | string               | 项目名称，看板将创建在工作区下此目录                                                                                                                            |
| `sources` | 否   | List[Dict[str, str]] | 原始数据源配置列表，将自动写入 magic.project.js 的 sources 数组。每项需含 type、name、url，示例：[{"type": "file", "name": "sales.csv", "url": "../sales.csv"}] |

**返回 (result)**：成功时 `result.ok` 为 true，`result.content` 含创建路径等信息；失败时 `result.ok` 为 false，`result.error` 含错误信息（如目录已存在）。

**数据源标记**：创建项目时通过 `sources` 参数传入，会自动写入 magic.project.js 的 sources 数组；编辑现有项目时需手动更新 magic.project.js 中的 sources 数组。

### validate_dashboard - 校验看板

| 参数           | 必填 | 类型   | 说明                                 |
| -------------- | ---- | ------ | ------------------------------------ |
| `project_path` | 是   | string | 看板项目目录路径，相对于工作区根目录 |

**返回 (result)**：成功时 `result.ok` 为 true，无错误和警告；失败时 `result.ok` 为 false，`result.error` 含校验失败原因。**交付前必须校验通过，否则页面无法正常访问。**

### update_dashboard_template - 更新模板文件

| 参数                  | 必填 | 类型    | 说明                              |
| --------------------- | ---- | ------- | --------------------------------- |
| `target_project`      | 是   | string  | 要更新的看板项目目录名称          |
| `update_dashboard_js` | 否   | boolean | 是否更新 dashboard.js，默认 false |
| `update_index_css`    | 否   | boolean | 是否更新 index.css，默认 false    |
| `update_index_html`   | 否   | boolean | 是否更新 index.html，默认 false   |
| `update_config_js`    | 否   | boolean | 是否更新 config.js，默认 false    |

**返回 (result)**：成功时 `result.ok` 为 true；失败时 `result.error` 含错误信息。

### backup_dashboard_template - 恢复模板备份

| 参数                   | 必填 | 类型    | 说明                         |
| ---------------------- | ---- | ------- | ---------------------------- |
| `target_project`       | 是   | string  | 要恢复备份的看板项目目录名称 |
| `restore_dashboard_js` | 否   | boolean | 是否恢复 dashboard.js 备份   |
| `restore_index_css`    | 否   | boolean | 是否恢复 index.css 备份      |
| `restore_index_html`   | 否   | boolean | 是否恢复 index.html 备份     |
| `restore_config_js`    | 否   | boolean | 是否恢复 config.js 备份      |

**返回 (result)**：成功时 `result.ok` 为 true；失败时 `result.error` 含错误信息。

### download_dashboard_maps - 手动下载地图数据

<!--zh
手动下载 Dashboard 地图 GeoJSON 工具。通常无需手动下载，因为 create_dashboard_cards、update_dashboard_cards、validate_dashboard 时会自动下载地图。

**调用时机**：创建/更新地图卡片前，或 validate_dashboard 未自动下载到所需地图时

**主要用途**：按地区名称显式下载 GeoJSON，适用于：
- 计划创建地图卡片但尚未写入 data.js 时预先下载
- 补充自动检测遗漏的地区
- 网络环境导致自动下载失败后重试
-->

Manual download Dashboard map GeoJSON tool. Usually no need to download manually, as maps are auto-downloaded by create_dashboard_cards, update_dashboard_cards, and validate_dashboard.

**When to use**: Before creating map cards, or when validate_dashboard didn't download needed maps.

| 参数           | 必填 | 类型      | 说明                                                                                                                      |
| -------------- | ---- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| `project_path` | 是   | string    | 看板项目路径，相对于工作区根目录                                                                                          |
| `area_names`   | 是   | List[str] | 要下载的地区名称列表（1-10个），支持：中国、provinces（如广东省、北京市）、major_city（如深圳市、广州市）。需使用精确名称 |

**返回 (result)**：成功时 `result.ok` 为 true，`result.extra_info` 包含下载统计信息；失败时 `result.ok` 为 false，`result.error` 含错误信息。

### 卡片管理工具 / Card Management Tools

<!--zh
必须使用卡片管理工具操作 data.js，严禁直接编辑。详见 reference/dashboard-cards-management.md。
-->

Must use card management tools to operate data.js, strictly prohibited to edit directly. See reference/dashboard-development.md for details.

| 工具                   | 说明                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| create_dashboard_cards | 批量创建卡片，支持 auto_layout 参数自动生成铺满布局（可省略 layout） |
| update_dashboard_cards | 批量更新卡片，支持单字段编辑                                         |
| delete_dashboard_cards | 批量删除卡片，自动压缩布局                                           |
| query_dashboard_cards  | 查询卡片信息，支持查询所有/指定卡片，支持字段过滤                     |

### create_dashboard_cards - 创建卡片

<!--zh
**auto_layout 参数**（默认 false）：设为 true 时可省略每张卡片的 layout，由工具按类型顺序自动生成铺满无空隙的布局，可避免 validate 反复失败。建议新建看板时使用 auto_layout=true。
-->

**auto_layout parameter** (default false): When true, omit layout per card; the tool auto-generates gap-free layout by type order to avoid repeated validate failures. Recommend auto_layout=true when creating new dashboards.

| 参数           | 必填 | 类型    | 说明                                                                 |
| -------------- | ---- | ------- | -------------------------------------------------------------------- |
| `project_path` | 是   | string  | 看板项目路径                                                         |
| `cards`       | 是   | List    | 卡片列表，每项含 id、type、source、getCardData；auto_layout=true 时可省略 layout |
| `auto_layout` | 否   | boolean | 是否自动计算布局，默认 false；为 true 时省略 layout 由工具铺满       |

---

## 工具使用示例 / Tool Usage Example

```python
# 创建项目后检查 result.ok
# 识别数据源后传入 sources 参数，会自动写入 magic.project.js
result = tool.call('create_dashboard_project', {
    "name": "销售数据分析看板",
    "sources": [{"type": "file", "name": "sales.csv", "url": "../sales.csv"}]
})

if result.ok:
    # 在 result.content 中可获取项目路径等信息
    # sources 已自动写入 magic.project.js
    pass
else:
    # result.error 含失败原因，如 "Directory already exists"
    pass

# 创建卡片：建议 auto_layout=True 省略 layout，由工具自动铺满
result = tool.call('create_dashboard_cards', {
    "project_path": "销售数据分析看板",
    "auto_layout": True,
    "cards": [...]
})

# 校验看板：必须 result.ok 且无错误无警告才能交付
result = tool.call('validate_dashboard', {"project_path": "销售数据分析看板"})
if not result.ok:
    # 根据 result.error 修复问题后重新校验
    pass

# 手动下载地图（如需要）
result = tool.call('download_dashboard_maps', {
    "project_path": "销售数据分析看板",
    "area_names": ["中国", "广东省", "深圳市"]
})
```

---

## 决策树 / Decision Tree

<!--zh
新建 or 编辑看板？
├─ 新建 → create_dashboard_project(sources=[...]) → 卡片规划 → 数据清洗 → 看板开发 → 校验 → 完成交付（数据源已自动标记）
└─ 编辑 → 识别现有看板项目 → 数据清洗(按需) → 看板开发编辑 → 校验 → 标记数据源(按需) → 完成交付

需要数据清洗？
├─ 新建看板 → 必须执行 data_cleaning.py
├─ 编辑看板且数据/需求变更 → 按需执行
└─ 编辑看板且无变更 → 可跳过

校验失败？→ 修复后重新 validate_dashboard，直至 result.ok 且无错误无警告

数据源标记？
├─ 创建项目时 → 通过 create_dashboard_project 的 sources 参数传入，自动写入 magic.project.js
└─ 编辑项目时 → 手动更新 magic.project.js 中的 sources 数组
-->

New or edit dashboard?
├─ New → create_dashboard_project(sources=[...]) → Card planning → Data cleaning → Dashboard development → Validate → Complete delivery (data source auto-marked)
└─ Edit → Identify existing dashboard project → Data cleaning (as needed) → Dashboard development/editing → Validate → Mark data source (as needed) → Complete delivery

Need data cleaning?
├─ New dashboard → Must execute data_cleaning.py
├─ Edit dashboard with data/requirement changes → Execute as needed
└─ Edit dashboard without changes → Can skip

Validation failed? → Fix issues and re-run validate_dashboard until result.ok with no errors or warnings

Data source marking?
├─ When creating project → Pass via create_dashboard_project sources param, auto-written to magic.project.js
└─ When editing project → Manually update sources array in magic.project.js

---

## 文件命名规范 / File Naming Rules

<!--zh
文件、目录命名根据文件内容和业务领域以及用户偏好语言智能确定，例如：
- 用户偏好语言为中文："销售数据分析看板"、"销售数据.csv"
- 用户偏好语言为英文："Sales Data Dashboard"、"Sales Data.csv"
-->

File and directory naming intelligently determined based on file content, business domain, and user preferred language, e.g.:

- User preferred language is Chinese: "销售数据分析看板", "销售数据.csv"
- User preferred language is English: "Sales Data Dashboard", "Sales Data.csv"

---

## 关键约束 / Key Constraints

<!--zh
- 严禁通过 Python 脚本生成任何图片（matplotlib、seaborn、plotly 等），所有图表必须使用 ECharts 实现
- 数据源文件严禁修改，仅允许读取
- 创建项目时通过 create_dashboard_project 的 sources 参数传入，自动写入 magic.project.js；编辑现有项目时需手动更新 magic.project.js 中的 sources 数组
- 必须使用卡片管理工具（create_dashboard_cards、update_dashboard_cards、delete_dashboard_cards）进行操作
- 临时文件以 temp_ 开头，任务结束前必须删除
- 文件命名根据内容、业务领域、用户偏好语言智能确定
-->

- Strictly prohibited to generate any images through Python scripts (matplotlib, seaborn, plotly, etc.), all charts must use ECharts
- Data source files strictly prohibited to modify, only allow reading
- When creating project, pass sources via create_dashboard_project param (auto-written to magic.project.js); when editing existing project, manually update sources array in magic.project.js
- Must use card management tools (create_dashboard_cards, update_dashboard_cards, delete_dashboard_cards) to perform operations
- Temporary files start with temp\_, must delete before task end
- File naming determined by content, business domain, user preferred language

---

## 工作流程概要 / Workflow Summary

<!--zh
**新建看板**：创建看板项目（传入 sources 参数，自动标记数据源）→ 卡片规划 → 数据清洗 → 看板开发 → 校验看板 → 完成交付
**编辑看板**：识别看板项目 → 数据清洗(按需) → 看板开发编辑 → 校验看板 → 标记数据源(按需) → 完成交付
-->

**New dashboard**: Create dashboard project (pass sources param, auto-mark data source) → Card planning → Data cleaning → Dashboard development → Validate → Complete delivery
**Edit dashboard**: Identify dashboard project → Data cleaning (as needed) → Dashboard development/editing → Validate → Mark data source (as needed) → Complete delivery
