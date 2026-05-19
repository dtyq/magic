---
name: develop-data-analysis-dashboard
description: Data analysis dashboard (instrument panel) development skill. Use when users need to develop data dashboards, create/edit Dashboard projects, build large-screen data boards, or perform dashboard data cleaning. Includes dashboard project creation, card plan, data cleaning (data_cleaning.py), card management tools (create_dashboard_cards, update_dashboard_cards, delete_dashboard_cards, query_dashboard_cards), map download tool (download_dashboard_maps), dashboard development, and validation.
---

# Data Analysis Dashboard Development Skill

Provides full data analysis dashboard (instrument panel) development capabilities—project creation, card plan, data cleaning, dashboard development, validation, and delivery—as one end-to-end workflow. Data cleaning is an important part of dashboard development.

---

## Code Execution Method

All tool calls via `from sdk.tool import tool` in this skill must be executed by passing code to `run_sdk_snippet`'s `python_code` parameter.

When a skill snippet calls tools through the SDK, always use `result.ok` to determine success and read failure details from `result.content`. Do not read or call `result.error`, because SDK `Result` stores failure text in `content`.

---

## Quick Start

**Important**: Detailed rules are inlined later in this document; while executing steps, consult Workflow Summary, Project Setup, Dashboard Development, and Dashboard Data Cleaning Guide.

**Runtime base files**: Do not modify, overwrite, or delete `index.html`, `dashboard.js`, or `index.css`; violations make the data dashboard unusable.

**Default card counts for new dashboards — MANDATORY unless the user explicitly requests a reduced scope:**

| Card type | Required count | Notes                                                                        |
| --------- | -------------- | ---------------------------------------------------------------------------- |
| metric    | **≥ 6**        | Key KPI overview cards                                                       |
| echarts   | **26 – 30**    | Core of the dashboard; pad with same-type charts across different dimensions |
| table     | **2 – 3**      | At least 1 must be a detail-level table                                      |
| markdown  | 0              | Omit unless the user asks for notes/commentary                               |
| **Total** | **34 – 39**    | Self-check before delivery                                                   |

**Enforcement rules (non-negotiable):**

- You **must** list every card in `cards_plan` before calling `create_dashboard_project`; do not defer cards to later.
- `card_id` in `cards_plan` must exactly match the `id` used in subsequent `create_dashboard_cards` calls.
- If echarts count falls short, add same-type charts covering different dimensions or time ranges — do **not** lower the floor.
- Before delivery, call `query_dashboard_cards` and count by `type`; if any type is below the required count, create the missing cards before proceeding.
- These counts are overridden **only** when the user explicitly states they want a smaller dashboard.

---

## Workflow Summary

**Path overview**

- **New dashboard**: Planning prep (brainstorm + read sources) → Create dashboard project → Data cleaning → Dashboard development → Validate → Complete delivery
- **Edit dashboard**: Project identification → Data cleaning (as needed) → Dashboard editing and card-tool maintenance → Validate → Complete delivery

**Step details**

- **Project identification**: Understand user needs and identify the target project (edit scenarios)
- **Planning prep (new dashboards)**: Before `create_dashboard_project`, brainstorm questions and angles; **read sources in depth** (fields, grain, definitions, time, distributions, missingness, comparable dimensions), then author `cards_plan` strictly following the **mandatory counts in Quick Start** (metric ≥6, echarts 26–30, table 2–3, total 34–39)—**every card must be listed before project creation**; a handful of representative charts is not acceptable
- **Create project**: Must call `create_dashboard_project` with the required `cards_plan` in the same call; the tool writes `cards_plan.md` from it; plan card identifiers must match `id` in later `create_dashboard_cards`
- **Data cleaning**: From `cards_plan.md` and data goals, create and run `data_cleaning.py` in the project to supply data for the dashboard
- **Dashboard editing**: Change allowed files as needed (e.g. data_cleaning.py, cleaned_data/, config.js; never modify or delete index.html, dashboard.js, index.css) (edit scenarios)
- **Dashboard development**: Per `cards_plan.md`, use card tools (create_dashboard_cards, update_dashboard_cards, delete_dashboard_cards, query_dashboard_cards) to create or maintain cards
- **Validate dashboard**: Call `validate_dashboard(project_path="PROJECT_NAME")`; fix errors and re-run until passing (do not delete cards to pass validation)
- **Complete delivery**: Summarize the project and analysis results, then close the task

**Core principles**

Follow the steps in order; validation must pass before delivery or the page will not work.
Never modify, overwrite, or delete `index.html`, `dashboard.js`, or `index.css`, or the data dashboard becomes unusable (maintain allowed files such as `data.js` only via card tools and other permitted paths).

**Preferences**

- New dashboards: **planning prep** first, then `cards_plan`; **strictly follow the mandatory card counts table in Quick Start** — metric ≥6, echarts 26–30, table 2–3, total 34–39; self-check with `query_dashboard_cards` before delivery
- Prefer setting `title` on cards (skip on metric cards when it would duplicate the metric `label`)
- Prefer ECharts; many charts → same-type charts across dimensions
- Card standard size examples (24-column grid): metric `{w:4,h:3}`, chart `{w:8,h:8}`, table `{w:12,h:8}`, Markdown `{w:12,h:(calculate height based on content)}`

---

## Decision Tree

New or edit dashboard?
├─ New → Planning prep (brainstorm, read sources) → Author cards_plan [metric ≥6, echarts 26–30, table 2–3, total 34–39, ALL cards listed] → create_dashboard_project → Data cleaning → Dashboard development → Validate → Complete delivery
└─ Edit → Identify existing dashboard project → Data cleaning (as needed) → Dashboard development/editing → Validate → Complete delivery

Need data cleaning?
├─ New dashboard → Must execute data_cleaning.py
├─ Edit dashboard with data/requirement changes → Execute as needed
└─ Edit dashboard without changes → Can skip

Card count check before delivery?
├─ call query_dashboard_cards → count by type
├─ metric < 6 or echarts < 26 or table < 2 → create missing cards first
└─ counts met → proceed to validate

Validation failed? → Fix issues and re-run validate_dashboard until result.ok with no errors

---

## Core Tools

### create_dashboard_project — Create Dashboard Project

| Param        | Required | Type   | Description                                                                                                                                                       |
| ------------ | -------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`       | Yes      | string | Project name; the dashboard is created under this directory in the workspace                                                                                      |
| `cards_plan` | Yes      | array  | Card plan list (at least one item); the tool generates `cards_plan.md` from this; field definitions and how to author entries are in the tool usage example below |

Finish **Planning prep**, then author `cards_plan`. For new dashboards, the mandatory per-type counts are defined in Quick Start under **Default card counts for new dashboards** (metric ≥6, echarts 26–30, table 2–3, total 34–39). **You must list every card in `cards_plan` before calling this tool — partial plans are not allowed.** Only if the user explicitly requests a reduced dashboard may you go below these counts; otherwise every card must be listed upfront. You may call `create_dashboard_cards` in batches after project creation. This tool does not validate counts — it is your responsibility to meet them.

**Return (`result`)**: On success `result.ok` is true and `result.content` includes the created path and related information; on failure `result.ok` is false and `result.content` contains the error (e.g. "Directory already exists").

### validate_dashboard — Validate Dashboard

| Param          | Required | Type   | Description                                                  |
| -------------- | -------- | ------ | ------------------------------------------------------------ |
| `project_path` | Yes      | string | Dashboard project directory path, relative to workspace root |

**Return (`result`)**: On success `result.ok` is true with no errors; on failure `result.ok` is false and `result.content` contains validation failure reasons. **Validation must pass before delivery; otherwise the page will not be accessible.**

### Card Management Tools

You must use the card management tools to work on `data.js`; direct editing is strictly prohibited. Card fields and CardData are defined under Card Data DSL below; layout workflow and validation are under Dashboard Development.

| Tool                   | Description                                                                |
| ---------------------- | -------------------------------------------------------------------------- |
| create_dashboard_cards | Batch create; prefer ≤6 `cards`/call; `auto_layout` (may omit `layout`)    |
| update_dashboard_cards | Batch update; 1–10 `updates`/call, prefer ≤6; single-field edits supported |
| delete_dashboard_cards | Batch delete; `card_ids` 1–20; auto-compacts layout after delete           |
| query_dashboard_cards  | Query all or by id; optional `fields` to filter returned properties        |

**create_dashboard_cards**

`auto_layout` (default false): When true, omit per-card `layout`; the tool generates gap-free layout by type order to reduce validate churn. Recommend `auto_layout=true` for new dashboards. Prefer about 6 or fewer `cards` per call when feasible (not a hard cap).

| Param          | Required | Type    | Description                                                                                            |
| -------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `project_path` | Yes      | string  | Dashboard project path                                                                                 |
| `cards`        | Yes      | List    | Card list; each item has id, type, source, getCardData; when auto_layout=true, `layout` may be omitted |
| `auto_layout`  | No       | boolean | When true, omit `layout` and let the tool fill the grid                                                |

**update_dashboard_cards**

Each update must include `id` and at least one other field to change (type, source, title, titleAlign, layout, getCardData, etc.). `layout` accepts partial objects (e.g. only `y`).

| Param          | Required | Type   | Description                                    |
| -------------- | -------- | ------ | ---------------------------------------------- |
| `project_path` | Yes      | string | Dashboard project path                         |
| `updates`      | Yes      | List   | Update objects, 1–10 items; prefer ≤6 per call |

**delete_dashboard_cards**

| Param          | Required | Type      | Description                              |
| -------------- | -------- | --------- | ---------------------------------------- |
| `project_path` | Yes      | string    | Dashboard project path                   |
| `card_ids`     | Yes      | List[str] | IDs to delete, 1–20 items, no duplicates |

**query_dashboard_cards**

| Param          | Required | Type      | Description                                                                                    |
| -------------- | -------- | --------- | ---------------------------------------------------------------------------------------------- |
| `project_path` | Yes      | string    | Dashboard project path                                                                         |
| `card_ids`     | No       | List[str] | Omit for all cards; if set, 1–20 IDs                                                           |
| `fields`       | No       | List[str] | Omit for all fields; else a subset of id, type, title, source, layout, titleAlign, getCardData |

---

## Tool Usage Example

```python
# Create dashboard project (see structure below)
# Abbreviated example: shows one cards_plan row shape; real new dashboards must list the full per-type plan per the skill.
result = tool.call('create_dashboard_project', {
    "name": "Sales Data Dashboard",
    "cards_plan": [
        {
            "display_name": "Total Sales",
            "card_id": "total_sales",
            "type": "metric",
            "data_detail": "Sum of sales amount",
        },
        {
            "display_name": "Monthly Sales Trend",
            "card_id": "monthly_trend",
            "type": "echarts",
            "data_detail": "Sales by month",
        },
    ],
})

if result.ok:
    # Read project path and other info from result.content
    pass
else:
    # result.content explains failure, e.g. "Directory already exists"
    pass

# create_dashboard_cards: auto_layout=True; prefer ≤6 cards/call
result = tool.call('create_dashboard_cards', {
    "project_path": "Sales Data Dashboard",
    "auto_layout": True,
    "cards": [...]
})

# query_dashboard_cards: omit card_ids for all cards; optional fields, card_ids (1–20)
result = tool.call('query_dashboard_cards', {
    "project_path": "Sales Data Dashboard",
})

# update_dashboard_cards: each update needs id and ≥1 other field; prefer ≤6 updates/call
result = tool.call('update_dashboard_cards', {
    "project_path": "Sales Data Dashboard",
    "updates": [...]
})

# delete_dashboard_cards: card_ids 1–20; do not delete to pass validation
result = tool.call('delete_dashboard_cards', {
    "project_path": "Sales Data Dashboard",
    "card_ids": [...]
})

# validate_dashboard: delivery requires result.ok with no errors
result = tool.call('validate_dashboard', {"project_path": "Sales Data Dashboard"})
if not result.ok:
    # Fix issues from result.content, then validate again
    pass

# download_dashboard_maps (when needed)
result = tool.call('download_dashboard_maps', {
    "project_path": "Sales Data Dashboard",
    "area_names": ["中国", "广东省", "深圳市"]
})
```

---

## File Naming Rules

File and directory naming intelligently determined based on file content, business domain, and user preferred language, e.g.:

- User preferred language is Chinese: "销售数据分析看板", "销售数据.csv"
- User preferred language is English: "Sales Data Dashboard", "Sales Data.csv"

---

## Key Constraints

- Do not generate any images with Python scripts (matplotlib, seaborn, plotly, etc.); implement all charts with ECharts
- Do not modify data source files; read-only access only
- You must use the card management tools (create_dashboard_cards, update_dashboard_cards, delete_dashboard_cards) for those operations
- Temporary files start with temp\_, must delete before task end
- File naming determined by content, business domain, user preferred language
- `data.js` must be maintained only through those card tools; direct edits or overwriting `data.js` are prohibited
- Never modify, overwrite, or delete `index.html`, `dashboard.js`, or `index.css`; any change or removal makes the data dashboard unusable

---

### Data Sources

Data source role: Provide foundational data support for data analysis dashboard development.
Supported type examples: Excel, CSV, JSON, plain text, PDF, web-sourced data, MCP tool data.
Operating rule: Do not change user-uploaded source files; read-only.

Data source identification and validation:

1. Understand the request; identify the source type and content.
2. If data comes from the web or MCP tools, persist it to a JSON file before analysis.
3. Source inspection—if any of the following applies, enter the exception-handling flow immediately: unreadable source; unsupported format; empty template; headers only; no valid business data; unacceptably poor data quality.
4. Exception-handling flow: Tell the user why and end the task.

---

### Project Structure, Files, and Editing Rules

The tree matches the table: path, purpose, and editing rules for each item.

```
Project Directory/
├── geo/                    # Map GeoJSON data
├── cleaned_data/           # Cleaned data (CSV)
├── data_cleaning.py        # Data cleaning script
├── data.js                 # Card config (DASHBOARD_CARDS)
├── config.js               # Global config (colors, themes, etc.)
├── index.html              # Page markup (system-managed; do not modify or delete)
├── index.css               # Styles (system-managed; do not modify or delete)
├── dashboard.js            # Dashboard runtime (system-managed; do not modify or delete)
└── magic.project.js        # Project configuration file
```

| Path             | Purpose                            | Editing rules                                                                                            |
| ---------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| geo/             | GeoJSON for maps                   | System-managed; do not edit                                                                              |
| cleaned_data/    | Cleaned CSV for card data sources  | Editable: add or modify files                                                                            |
| data_cleaning.py | Raw data → cleaned_data/           | Editable: adjust cleaning logic as needed                                                                |
| data.js          | DASHBOARD_CARDS definitions        | Tools only: create_dashboard_cards, update_dashboard_cards, delete_dashboard_cards; no direct file edits |
| config.js        | Global colors, themes, fonts, etc. | Restricted: field values only; do not add, remove, rename fields, or change structure                    |
| index.html       | Page HTML                          | System-managed; do not edit, delete, or overwrite or the data dashboard becomes unusable                 |
| index.css        | Visual styling                     | System-managed; do not edit, delete, or overwrite or the data dashboard becomes unusable                 |
| dashboard.js     | Rendering, loading, charts         | System-managed; do not edit, delete, or overwrite or the data dashboard becomes unusable                 |
| magic.project.js | Project metadata                   | Prohibited: system-managed                                                                               |

---

### Card Data DSL

Card Basic Structure:

- id: String, card unique identifier (required)
- type: Card type, strictly follow CardType types (required)
- source: String, data source path, e.g. "./cleaned_data/filename.csv" (required)
- layout: react-grid-layout layout object, contains {x: integer, y: integer, w: integer, h: integer} (required)
- getCardData: Async function, used to load data and process card data, returns CardData (required)
- title: Optional string, card title
- titleAlign: Optional string, title alignment ("left"|"center"|"right")

CardType Card Types:

- metric: Single metric card, displays metric value
- table: Data table card, displays structured data
- markdown: Markdown document card
- echarts: ECharts chart card

CardData Data Structure Specification:

- MetricCard (Metric card):
  - label: String, metric name (required)
  - value: String or number, metric value (required)
  - change: Optional string, change value or percentage
  - unit: Optional string, unit
  - icon: Optional string, use icon name from tabler-icon, e.g., "ti-chart-bar"
  - iconColor: Optional string, icon color; required whenever `icon` is set
- TableCard (Table card):
  - columns: Column config array, each item contains:
    - title: String, column title
    - dataIndex: String, data field name
    - dataType: Optional, data type ("string"|"number"|"date"|"time"), default "string"
    - width: Optional, column width (string or number)
    - formatter: Optional, column formatter function to customize how a cell is shown; parameter `value` is the current cell value as a string; return value must be a string; plain text only
    - sortable: Optional, boolean, whether to enable sorting
    - filterable: Optional, boolean, whether to enable filtering
  - data: Data array, each item is object containing each column's data (use raw data as much as possible, then format via formatter function)
- MarkdownCard (Markdown card):
  - content: String, Markdown format text content (required)
- echarts (Chart card): ECharts Options (version: v6.0.0) config

getCardData Data Loading Function:

- Async function, parameter is csv object, returns data conforming to CardData specification
- Core methods:
  - `csv.load("filename")` loads CSV file in cleaned_data directory (without .csv extension)
  - Returns: `{data: row array, fields: column name array, name: filename, url: path}`
- Key specifications:
  - Field access: Use `row["field_name"]`, avoid special character issues
  - Data conversion: `parseFloat(row["field_name"])` converts string to number, CSV data defaults to string
  - Numeric processing: Avoid floating point precision issues, use `Math.round()` or `.toFixed()` when necessary; percentages use `.toFixed(2)`, amounts use `.toLocaleString()`
  - Theme config access: Before using `window.DASHBOARD_CONFIG`, read `config.js` to confirm real key names and value types; example: `window.DASHBOARD_CONFIG.COLORS_PRIMARY`

#### Examples

```javascript
// MetricCard example
getCardData: async (csv) => {
  const result = await csv.load("sales_data");
  const totalSales = result.data.reduce((sum, row) => {
    return sum + parseFloat(row["sales_amount"]);
  }, 0);
  return {
    label: "Total Sales",
    value: totalSales,
    unit: "USD",
    icon: "ti-currency-dollar",
  };
};

// TableCard example
getCardData: async (csv) => {
  const result = await csv.load("sales_data");
  return {
    columns: [
      {
        title: "Region",
        dataIndex: "region",
        dataType: "string",
        sortable: false,
        filterable: false,
      },
      {
        title: "Sales",
        dataIndex: "sales",
        dataType: "number",
        sortable: true,
        filterable: false,
        formatter: (value) => `$${parseFloat(value).toLocaleString()}`,
      },
      {
        title: "Customers",
        dataIndex: "customers",
        dataType: "number",
        sortable: true,
        filterable: false,
      },
    ],
    data: result.data,
  };
};

// ECharts chart example
getCardData: async (csv) => {
  const result = await csv.load("sales_data");
  return {
    grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false },
    tooltip: {
      trigger: "axis",
      formatter: function (params) {
        return (
          params[0].name + ": " + params[0].value.toLocaleString() + " USD"
        );
      },
    },
    xAxis: {
      type: "category",
      data: result.data.map((row) => row["region"]),
    },
    yAxis: {
      type: "value",
      axisLabel: { formatter: (value) => value.toLocaleString() },
    },
    series: [
      {
        type: "bar",
        data: result.data.map((row) => parseFloat(row["sales"])),
        label: {
          show: true,
          formatter: (params) => params.value.toLocaleString(),
        },
      },
    ],
  };
};

// MarkdownCard example
getCardData: async (csv) => {
  const salesData = await csv.load("sales_base_data");
  const productData = await csv.load("product_sales_ranking");
  const totalSales = salesData.data.reduce(
    (sum, row) => sum + parseFloat(row["sales_amount"]),
    0,
  );
  const topProduct = productData.data.sort(
    (a, b) => parseFloat(b["sales_amount"]) - parseFloat(a["sales_amount"]),
  )[0];
  return {
    content: `### Sales Analysis Report\n\n**Total Sales**: ${totalSales.toLocaleString()} USD\n**Top Product**: ${topProduct["product_name"]}`,
  };
};
```

Data processing example (same CSV shape as the English examples above):

```javascript
// CSV file: sales_data.csv
// Example content:
// region,sales,customers
// East,120000,150
// South,95000,120

const parsedData = [
  { region: "East", sales: "120000", customers: "150" },
  { region: "South", sales: "95000", customers: "120" },
];
const parsedFields = ["region", "sales", "customers"];
```

---

### Appearance and Layout

Card Actual Size Calculation Logic:

- Width: Based on GRID_COLS column grid system in config.js
- Height: Card height = card rows × card row height (GRID_DEFAULT_ROW_HEIGHT in config.js)

UI theme customization (only when the user explicitly asks): `config.js` (global theme).

Card Layout:

- Hierarchical arrangement: Metric cards (top overview) → Chart cards (core analysis) → Table cards (detailed data) → Markdown cards (notes)
- Layout principles: Must fully utilize (GRID_COLS value in config.js) column grid system, horizontal-vertical complementary fill, compact continuous filling with no gaps, coordinated width-height ratio

---

### ECharts v6.0.0 Configuration

**Dashboard development only**

ECharts v6.0.0 key settings:

- Map: series.map uses Chinese names, examples: "中国", "广东省", "深圳市"; series.nameProperty is "fullname"
- grid:
  - Mandatory config: `{ left: 0, right: 0, top: 0, bottom: 0, containLabel: false }`, in v6.0.0 this config already allows axis and axis labels to display fully edge-aligned, so no need to reserve any space for XY axis labels or axis titles
  - outerBounds:
    - Use case: Reserve space for legend, visualMap components
    - Use condition: Only need to set when legend, visualMap components configured
    - Core principle: outerBounds direction must match component position direction
    - Config examples:
      - Bottom horizontal legend: `{ grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false, outerBounds: { bottom: 30 } }, legend: { type: "scroll", bottom: 0 } }`
      - Left vertical legend: `{ grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false, outerBounds: { left: 50 } }, legend: { type: "scroll", orient: "vertical", left: 0 } }`
      - Bottom horizontal visualMap: `{ grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false, outerBounds: { bottom: 50 } }, visualMap: { orient: "horizontal", bottom: 0, left: "center" } }`
      - Left bottom vertical visualMap: `{ grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false, outerBounds: { left: 50 } }, visualMap: { orient: "vertical", left: 0, bottom: 0 } }`
    - Wrong examples:
      - `outerBounds: { right: 120 }, legend: { orient: "vertical", right: 0 }` (legend should be on left)
      - `outerBounds: { left: 60 }` but no left component configured (meaningless space reservation)
      - `outerBounds: { top: 30 }` but component at bottom (direction mismatch)
- legend:
  - Use condition: Only configure when multi-series or pie charts need legend, single-series charts don't need legend
  - Recommended config: Horizontal legend use `{ bottom: 0, type: "scroll" }`, vertical legend use `{ left: 0, orient: "vertical", type: "scroll" }`
  - Avoid using right, top positions, prioritize bottom, left positions
- visualMap:
  - visualMap recommended config: Horizontal use `{ orient: "horizontal", bottom: 0, left: "center" }`, vertical use `{ orient: "vertical", left: 0, bottom: 0 }`
  - Map visualMap suggest using vertical direction: `{ orient: "vertical", left: 0, bottom: 0 }` + `outerBounds: { left: 50 }`
- tooltip: Configure a tooltip for every graphic/series where it helps
- dataZoom: Strictly do not configure `dataZoom`; ECharts `dataZoom` is visually poor and its use is not recommended here
- label: `label.formatter` receives a `params` object; use `params.value` for the numeric value; set `labelLayout.hideOverlap: true` where needed to reduce overlap; consider font stroke for readability
- title: Do not set an ECharts `title` in options (duplicates the card title)
- axis: Prefer a `name` on numeric value axes; avoid `name` on category axes. Prefer the vertical layout pattern: Y = value axis, X = category axis
- Use the chart area fully; avoid unnecessary empty margins
- Formatter arguments: `label.formatter` and `tooltip.formatter` take `params`; `axisLabel.formatter` takes `value`
- Keep theming consistent with `config.js`; read `config.js` before using `window.DASHBOARD_CONFIG` to confirm key names and value types

---

### Card Management Tools — Quick Reference

Parameter tables, `auto_layout`, and batch limits are under Core Tools, Card Management Tools above. Typical usage (pick as needed):

- Create: `create_dashboard_cards`; ≤6/call, `auto_layout=True`
- Edit: `update_dashboard_cards`; ≤6 updates/call; partial fields OK (e.g. title, `layout.y`)
- Delete: `delete_dashboard_cards`; do not delete to pass validation
- Browse: `query_dashboard_cards` without `card_ids` (and optional `fields`) for a quick full summary
- Detail: same tool with `card_ids` for full config including getCardData
- Trim payload: `query_dashboard_cards` with `fields` (e.g. id, type, layout only)

---

## Dashboard Data Cleaning Guide

- Script file: data_cleaning.py
- Script example:

```python
import os
import pandas as pd

# Required statements (strictly follow this format)
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "cleaned_data")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Data source definition (if file data sources exist)
FILE_DATA_SOURCES = {
  'main_data': os.path.join(PROJECT_ROOT, "..", "data_source.csv"),
  'additional_data': os.path.join(PROJECT_ROOT, "..", "additional_data.csv")
}

def main():
    # 1. Data loading
    df = pd.read_csv(FILE_DATA_SOURCES['main_data'])

    # 2. Data cleaning: Handle missing values, remove duplicates, type conversion, outlier treatment

    # 3. Data splitting: Split into multiple thematic files by business logic, time dimension, geographic region, etc.

    # 4. Metric calculation: Descriptive statistics, group aggregation, derived metrics, advanced analysis

    # 5. Data output: CSV format to cleaned_data directory
    df.to_csv(os.path.join(OUTPUT_DIR, "cleaned_data.csv"), index=False, encoding='utf-8')

if __name__ == "__main__":
    main()
```

Data cleaning core principles:

- You may write CSV into `cleaned_data` only by executing the `data_cleaning.py` script
- Run cleaning on the full dataset
- Do not modify or overwrite user-uploaded source files; read-only access only
- All output files must use UTF-8 encoding and CSV format
- Handle missing values explicitly (fill, drop, or flag as appropriate)
- Convert data types as needed (e.g. strings to numeric, date parsing)
- Remove duplicate rows before output
- Split data into multiple thematic files by business logic where beneficial; each file serves one or more cards
- Derived metrics (ratios, growth rates, rankings) should be computed in this script
