# 项目准备 / Project Setup

<!--zh
本文档包含看板项目准备阶段所需规范：数据源、卡片规划、项目结构、文件权限、模板文件管理工具。
-->

This document covers specifications for the dashboard project setup phase: data sources, card planning, project structure, file permissions, and template file management tools.

---

## 数据源规范 / Data Sources

<!--zh
数据源作用：为数据分析看板开发提供基础数据支持
支持类型举例：Excel、CSV、JSON、文本、PDF、网络数据、MCP工具数据
操作原则：严禁改动用户上传的数据源文件，仅允许读取

数据源识别与验证：
1. 理解用户需求，识别数据源类型和内容
2. 如果是网络/MCP工具获取的数据必须保存到JSON数据文件后再进行分析
3. 数据源检查（发现以下情况必须立即进入异常处理流程）：数据源无法读取/数据源格式不支持/数据源为空模板/只有表头/无有效业务数据/数据质量糟糕
4. 异常处理流程：告知用户原因并结束任务

标记数据源(magic.project.js中的sources数组)：
- sources：原始数据源配置，记录看板项目关联的原始数据源
- 示例：[{ "type": "file", "name": "sales.csv", "url": "../sales.csv" }]
- 用途：数据溯源、文档化、便于数据更新时重新执行清洗脚本
- 更新时机：创建项目时通过create_dashboard_project的sources参数传入，自动写入；编辑现有项目时需手动更新magic.project.js中的sources数组
-->

Data Source Role: Provide fundamental data support for data analysis dashboard development
Supported types examples: Excel, CSV, JSON, text, PDF, web data, MCP tool data
Operation principle: Strictly prohibited to modify user-uploaded data source files, only allow reading

Data Source Identification and Validation:

1. Understand user needs, identify data source type and content
2. If data obtained from web/MCP tools, must save to JSON data file before analysis
3. Data source check (immediately enter exception handling if following situations found): Data source cannot be read/data source format not supported/data source is empty template/only headers/no valid business data/data quality terrible
4. Exception handling: Inform user of reason and end task

Mark Data Source (sources array in magic.project.js):

- sources: Original data source config, record dashboard project associated original data sources
- Example: [{ "type": "file", "name": "sales.csv", "url": "../sales.csv" }]
- Purpose: Data provenance, documentation, facilitate re-executing cleaning scripts when data updates
- Update timing: When creating project pass sources to create_dashboard_project (auto-written); when editing existing project manually update sources array in magic.project.js

---

## 卡片规划文档 / Card Planning Document

<!--zh
卡片规划文档：
- 文件名：cards_todo.md
- 格式：`- 卡片名称 [卡片ID] (类型) - 数据细节描述`
- 示例：```markdown
- 总销售额 [total_sales] (metric) - 销售金额求和
- 月度销售趋势 [monthly_trend] (echarts) - 按月统计销售额
```

核心原则：为数据清洗和看板开发提供明确的数据需求指导
-->

Card Planning Document:

- Filename: cards_todo.md
- Format: `- Card Name [Card ID] (Type) - Data detail description`
- Example:

```markdown
- Total Sales [total_sales] (metric) - Sum of sales amount
- Monthly Sales Trend [monthly_trend] (echarts) - Statistics of sales amount by month
```

Core principle: Provide clear data requirement guidance for data cleaning and dashboard development

---

## 项目文件结构 / Project File Structure

<!--zh
看板项目包含以下文件和目录：

```
项目目录/
├── geo/                    # 地图数据文件目录
├── cleaned_data/           # 清洗后的数据文件(CSV格式)
├── data_cleaning.py        # 数据清洗脚本
├── data.js                 # 卡片数据配置(DASHBOARD_CARDS数组)
├── config.js               # 全局配置(颜色、主题等)
├── index.html              # 页面文件
├── index.css               # 样式文件
├── dashboard.js            # 看板核心代码
└── magic.project.js        # 项目配置文件
```
-->

Dashboard projects contain the following files and directories:

```
Project Directory/
├── geo/                    # Map data files directory
├── cleaned_data/           # Cleaned data files (CSV format)
├── data_cleaning.py        # Data cleaning script
├── data.js                 # Card data config (DASHBOARD_CARDS array)
├── config.js               # Global config (colors, themes, etc.)
├── index.html              # Page file
├── index.css               # Style file
├── dashboard.js            # Dashboard core code
└── magic.project.js        # Project config file
```

---

## 文件说明 / File Descriptions

### geo/

<!--zh
存储地图可视化所需的 GeoJSON 数据文件。由系统自动管理，无需关注和编辑。
-->

Stores GeoJSON data files required for map visualization. Automatically managed by system, no need to concern or edit.

### cleaned_data/

<!--zh
存储数据清洗后的 CSV 文件，供看板卡片使用。可以添加、修改清洗后的数据文件。
-->

Stores cleaned CSV files for dashboard cards. Can add and modify cleaned data files.

### data_cleaning.py

<!--zh
数据清洗脚本，用于处理原始数据并生成 cleaned_data/ 中的文件。可以根据需求编辑清洗逻辑。
-->

Data cleaning script for processing raw data and generating files in cleaned_data/. Can edit cleaning logic as needed.

### data.js

<!--zh
卡片数据配置文件，包含 DASHBOARD_CARDS 数组，定义所有卡片的配置。
- **必须使用工具修改**：使用 create_dashboard_cards、update_dashboard_cards、delete_dashboard_cards 等卡片管理工具进行操作
-->

Card data config file containing DASHBOARD_CARDS array defining all card configurations.

- **Must use tools to modify**: Use card management tools (create_dashboard_cards, update_dashboard_cards, delete_dashboard_cards) to perform operations

### config.js

<!--zh
全局配置文件，定义颜色、主题、字体等全局样式。
- **可编辑**：字段的值
- **严禁增删改**：字段名称和语法结构，否则看板无法正常渲染
-->

Global config file defining colors, themes, fonts, and other global styles.

- **Editable**: Field values
- **Strictly prohibited**: Add/delete/modify field names and syntax structure, otherwise dashboard cannot render

### index.html

<!--zh
页面文件，定义看板的 HTML 结构。
- **仅允许编辑**：ECharts 主题配置的 script 标签内容
- **严禁改动**：HTML 结构和其他 script 代码
-->

Page file defining dashboard HTML structure.

- **Only allow editing**: ECharts theme config script tag content
- **Strictly prohibited**: Change HTML structure and other script code

### index.css

<!--zh
样式文件，定义看板的视觉样式。由系统管理，严禁修改编辑。
-->

Style file defining dashboard visual styles. Managed by system, strictly prohibited to modify or edit.

### dashboard.js

<!--zh
看板核心代码，实现卡片渲染、数据加载、图表绘制等核心功能。由系统管理，严禁修改编辑。
-->

Dashboard core code implementing card rendering, data loading, chart drawing, and other core functions. Managed by system, strictly prohibited to modify or edit.

### magic.project.js

<!--zh
项目配置文件，包含项目元数据和数据源标记。
- **仅允许编辑**：sources 数组字段（标记数据源）
- **严禁修改**：其他结构
-->

Project config file containing project metadata and data source marking.

- **Only allow editing**: sources array field (mark data sources)
- **Strictly prohibited**: Modify other structures

---

## 文件编辑权限总结 / File Editing Permissions Summary

<!--zh
| 文件/目录 | 权限 | 说明 |
|-----------|------|------|
| cleaned_data/ | ✅ 可编辑 | 添加、修改清洗后的数据文件 |
| data_cleaning.py | ✅ 可编辑 | 编辑数据清洗逻辑 |
| data.js | ⚠️ 必须用工具 | 使用卡片管理工具操作，严禁直接编辑 |
| config.js | ⚠️ 限制编辑 | 仅修改字段值，不可改字段名和结构 |
| index.html | ⚠️ 限制编辑 | 仅修改 ECharts 主题 script 标签 |
| magic.project.js | ⚠️ 限制编辑 | 仅编辑 sources 数组 |
| dashboard.js | ❌ 严禁编辑 | 系统管理的核心代码 |
| index.css | ❌ 严禁编辑 | 系统管理的样式文件 |
| geo/ | ❌ 无需关注 | 系统自动管理 |
-->

| File/Directory   | Permission        | Description                                                     |
| ---------------- | ----------------- | --------------------------------------------------------------- |
| cleaned_data/    | ✅ Editable       | Add, modify cleaned data files                                  |
| data_cleaning.py | ✅ Editable       | Edit data cleaning logic                                        |
| data.js          | ⚠️ Tools required | Use card management tools, strictly prohibited to edit directly |
| config.js        | ⚠️ Restricted     | Only modify field values, not names/structure                   |
| index.html       | ⚠️ Restricted     | Only modify ECharts theme script tag                            |
| magic.project.js | ⚠️ Restricted     | Only edit sources array                                         |
| dashboard.js     | ❌ Prohibited     | System-managed core code                                        |
| index.css        | ❌ Prohibited     | System-managed style file                                       |
| geo/             | ❌ No concern     | Automatically managed by system                                 |

---

## 模板文件管理工具 / Template File Management Tools

<!--zh
当模板文件需要更新或恢复时，使用以下工具：
-->

When template files need updating or restoring, use the following tools:

### 支持的文件 / Supported Files

- dashboard.js
- index.css
- index.html
- config.js

### 备份格式 / Backup Format

<!--zh
备份文件以 `.{文件名}.backup` 格式命名，例如 `.dashboard.js.backup`
-->

Backup files are named in `.{filename}.backup` format, e.g., `.dashboard.js.backup`

### update_dashboard_template - 更新模板文件

<!--zh
**调用条件**：仅在用户明确要求更新模板文件时使用

**参数**：
- `target_project`（必需）：项目目录名称
- `update_dashboard_js`（可选，默认 False）：是否更新 dashboard.js
- `update_index_css`（可选，默认 False）：是否更新 index.css
- `update_index_html`（可选，默认 False）：是否更新 index.html
- `update_config_js`（可选，默认 False）：是否更新 config.js

**行为**：
- 更新前自动备份原文件
- 用户未指定文件时，默认更新全部四个文件

**示例**：
```python
tool.call('update_dashboard_template', {
    "target_project": "销售数据分析看板",
    "update_dashboard_js": True,
    "update_index_html": True
})
```
-->

**Invocation condition**: Only use when user explicitly requests updating template files

**Parameters**:

- `target_project` (required): Project directory name
- `update_dashboard_js` (optional, default False): Whether to update dashboard.js
- `update_index_css` (optional, default False): Whether to update index.css
- `update_index_html` (optional, default False): Whether to update index.html
- `update_config_js` (optional, default False): Whether to update config.js

**Behavior**:

- Auto-backup original file before update
- When user doesn't specify files, default update all four files

**Example**:

```python
tool.call('update_dashboard_template', {
    "target_project": "Sales Data Dashboard",
    "update_dashboard_js": True,
    "update_index_html": True
})
```

### backup_dashboard_template - 恢复模板备份

<!--zh
**调用条件**：仅在用户明确要求恢复模板文件时使用

**参数**：
- `target_project`（必需）：项目目录名称
- `restore_dashboard_js`（可选，默认 False）：是否恢复 dashboard.js
- `restore_index_css`（可选，默认 False）：是否恢复 index.css
- `restore_index_html`（可选，默认 False）：是否恢复 index.html
- `restore_config_js`（可选，默认 False）：是否恢复 config.js

**行为**：
- 当前文件与备份文件互换
- 可反复切换
- 需明确指定要恢复的文件

**示例**：
```python
tool.call('backup_dashboard_template', {
    "target_project": "销售数据分析看板",
    "restore_dashboard_js": True
})
```
-->

**Invocation condition**: Only use when user explicitly requests restoring template files

**Parameters**:

- `target_project` (required): Project directory name
- `restore_dashboard_js` (optional, default False): Whether to restore dashboard.js
- `restore_index_css` (optional, default False): Whether to restore index.css
- `restore_index_html` (optional, default False): Whether to restore index.html
- `restore_config_js` (optional, default False): Whether to restore config.js

**Behavior**:

- Current file and backup file swap
- Can repeatedly switch
- Need to explicitly specify files to restore

**Example**:

```python
tool.call('backup_dashboard_template', {
    "target_project": "Sales Data Dashboard",
    "restore_dashboard_js": True
})
```

---

## JavaScript 文件编辑规范 / JavaScript File Editing Standards

<!--zh
严禁使用模块化开发的 import、export 等代码。所有 JavaScript 代码必须使用传统的全局变量和函数声明方式。
-->

Strictly prohibited to use modular development import, export and other code. All JavaScript code must use traditional global variables and function declarations.
