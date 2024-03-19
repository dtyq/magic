# 看板开发 / Dashboard Development

<!--zh
本文档包含看板开发所需规范：卡片 DSL、外观排版、ECharts v6 配置、卡片管理工具。
-->

This document covers specifications for dashboard development: card DSL, appearance and layout, ECharts v6 configuration, and card management tools.

---

## 卡片数据 DSL / Card Data DSL

<!--zh
卡片基础结构：
- id: 字符串，卡片唯一标识符（必需）
- type: 卡片类型，严格按照CardType中的类型（必需）
- source: 字符串，数据源路径，例如："./cleaned_data/文件名.csv"（必需）
- layout: react-grid-layout布局对象，包含 {x: 整数, y: 整数, w: 整数, h: 整数}（必需）
- getCardData: 异步函数，用于加载数据和处理卡片数据，返回CardData数据（必需）
- title: 可选字符串，卡片标题
- titleAlign: 可选字符串，标题对齐方式（"left"|"center"|"right"）

CardType卡片类型：
- metric: 单指标卡片，展示指标数值
- table: 数据表格卡片，展示结构化数据
- markdown: Markdown文档卡片
- echarts: ECharts图表卡片

CardData数据结构规范：
- MetricCard（指标卡片）：
  - label: 字符串，指标名称（必需）
  - value: 字符串或数字，指标值（必需）
  - change: 可选字符串，变化值或百分比
  - unit: 可选字符串，单位
  - icon: 可选字符串，使用tabler-icon中的图标名称，例如："ti-chart-bar"
  - iconColor: 可选字符串，图标颜色，如果配置了icon，则必须配置iconColor
- TableCard（表格卡片）：
  - columns: 列配置数组，每项包含：
    - title: 字符串，列标题
    - dataIndex: 字符串，数据字段名
    - dataType: 可选，数据类型（"string"|"number"|"date"|"time"），默认为"string"
    - width: 可选，列宽度（字符串或数字）
    - formatter: 可选，列格式化函数，用于自定义列数据显示格式，参数为value(当前行字符串类型的数据)，返回值为字符串类型的数据，只支持纯文本
    - sortable: 可选，布尔值，是否启用排序功能
    - filterable: 可选，布尔值，是否启用筛选功能
  - data: 数据数组，每项为包含各列数据的对象(尽可能使用原始数据，再通过formatter函数进行格式化展示)
- MarkdownCard（Markdown卡片）：
  - content: 字符串，Markdown格式的文本内容（必需）
- echarts（图表卡片）：ECharts Options(版本：v6.0.0)配置

getCardData数据加载函数：
- 异步函数，参数为csv对象，返回符合CardData规范的数据
- 核心方法：
  - `csv.load("文件名")` 加载cleaned_data目录下的CSV文件(不含.csv后缀)
  - 返回：`{data: 行数组, fields: 列名数组, name: 文件名, url: 路径}`
- 关键规范：
  - 字段访问：使用`row["字段名"]`，避免特殊字符问题
  - 数据转换：`parseFloat(row["字段名"])`把字符串转换为数字，CSV数据默认为字符串
  - 数值处理：避免浮点运算精度问题，必要时使用`Math.round()`或`.toFixed()`处理；百分比用`.toFixed(2)`，金额用`.toLocaleString()`
  - 主题配置访问：支持通过`window.DASHBOARD_CONFIG`访问config.js主题配置，例如：`window.DASHBOARD_CONFIG.COLORS_PRIMARY`
-->

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
  - iconColor: Optional string, icon color, if icon configured, must configure iconColor
- TableCard (Table card):
  - columns: Column config array, each item contains:
    - title: String, column title
    - dataIndex: String, data field name
    - dataType: Optional, data type ("string"|"number"|"date"|"time"), default "string"
    - width: Optional, column width (string or number)
    - formatter: Optional, column formatter function, used to customize column data display format, parameter is value (current row string type data), returns string type data, only supports plain text
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
  - Theme config access: Support accessing config.js theme configuration through `window.DASHBOARD_CONFIG`, e.g., `window.DASHBOARD_CONFIG.COLORS_PRIMARY`

### 示例 / Examples

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
    content: `## Sales Analysis Report\n\n**Total Sales**: ${totalSales.toLocaleString()} USD\n**Top Product**: ${topProduct["product_name"]}`,
  };
};
```

Data processing example:

```javascript
// CSV file: sales_data.csv
// Content:
// region,sales,customers
// East,120000,150
// South,95000,120

// Parsed result.data:
[
  { region: "East", sales: "120000", customers: "150" },
  { region: "South", sales: "95000", customers: "120" },
][
  // Parsed result.fields:
  ("region", "sales", "customers")
];
```

---

## 外观与排版 / Appearance and Layout

<!--zh
卡片真实尺寸计算逻辑：
- 宽度：基于config.js中GRID_COLS列栅格系统
- 高度：卡片高度 = 卡片行数乘以卡片行高(config.js中GRID_DEFAULT_ROW_HEIGHT)

UI主题定制(仅在用户明确要求时)：config.js(全局主题)、index.html中script标签(ECharts主题)

卡片排版：
- 层次排列：指标卡片(顶部概览)→图表卡片(核心分析)→表格卡片(详细数据)→Markdown卡片(备注说明)
- 布局原则：必须充分利用(config.js中GRID_COLS的值)列栅格系统、横纵互补铺满、排版紧凑连续填充且无空隙、宽高比例协调
-->

Card Actual Size Calculation Logic:

- Width: Based on GRID_COLS column grid system in config.js
- Height: Card height = card rows × card row height (GRID_DEFAULT_ROW_HEIGHT in config.js)

UI Theme Customization (only when user explicitly requests):

- Config files: config.js (global theme), script tag in index.html (ECharts theme)

Card Layout:

- Hierarchical arrangement: Metric cards (top overview) → Chart cards (core analysis) → Table cards (detailed data) → Markdown cards (notes)
- Layout principles: Must fully utilize (GRID_COLS value in config.js) column grid system, horizontal-vertical complementary fill, compact continuous filling with no gaps, coordinated width-height ratio

---

## ECharts v6.0.0 配置 / ECharts v6 Options

**仅适用于看板开发 / Only for dashboard development**

<!--zh
ECharts v6.0.0 关键配置(**仅适用于看板开发**)：
* 地图: series.map使用中文名称，示例："中国"、"广东省"、"深圳市"；series.nameProperty为"fullname"
* grid:
  * 强制要求配置：`{ left: 0, right: 0, top: 0, bottom: 0, containLabel: false }`，在v6.0.0版本中该配置已经可以让坐标轴和坐标轴标签完整贴边显示，所以不再需要为XY坐标轴标签、坐标轴标题预留任何空间
  - outerBounds：
    - 使用场景：为legend、visualMap、dataZoom等组件预留空间
    - 使用条件：仅当配置了legend、visualMap、dataZoom组件时才需要设置
    - 核心原则：outerBounds的方向必须与组件位置方向一致
    - 配置示例：
      - 底部水平legend：`{ grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false, outerBounds: { bottom: 30 } }, legend: { type: "scroll", bottom: 0 } }`
      - 左侧垂直legend：`{ grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false, outerBounds: { left: 50 } }, legend: { type: "scroll", orient: "vertical", left: 0 } }`
      - 底部水平visualMap：`{ grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false, outerBounds: { bottom: 50 } }, visualMap: { orient: "horizontal", bottom: 0, left: "center" } }`
      - 左侧底部垂直visualMap：`{ grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false, outerBounds: { left: 50 } }, visualMap: { orient: "vertical", left: 0, bottom: 0 } }`
      - 底部水平dataZoom：`{ grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false, outerBounds: { bottom: 70 } }, dataZoom: [{ type: "slider", orient: "horizontal", bottom: 0, left: "center" }] }`
      - 左侧垂直dataZoom：`{ grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false, outerBounds: { left: 50 } }, dataZoom: [{ type: "slider", orient: "vertical", left: 0, bottom: 0 }] }`
    - 错误示例：
      - `outerBounds: { right: 120 }, legend: { orient: "vertical", right: 0 }` （legend应该在左侧）
      - `outerBounds: { left: 60 }` 但没有配置左侧组件（无意义的空间预留）
      - `outerBounds: { top: 30 }` 但组件在底部（方向不匹配）
- legend:
  - 使用条件：仅在多series或饼图等需要图例说明时配置，单series图表无需legend
  - 推荐配置：水平legend用`{ bottom: 0, type: "scroll" }`，垂直legend用`{ left: 0, orient: "vertical", type: "scroll" }`
  - 避免使用right、top位置，优先使用bottom、left位置
- visualMap:
  - visualMap推荐配置：水平用`{ orient: "horizontal", bottom: 0, left: "center" }`，垂直用`{ orient: "vertical", left: 0, bottom: 0 }`
  - 地图visualMap建议使用垂直方向：`{ orient: "vertical", left: 0, bottom: 0 }` + `outerBounds: { left: 50 }`
- tooltip：每个图形都建议配置tooltip
- dataZoom：严禁配置dataZoom，echarts的dataZoom很丑，不建议使用
- label：label.formatter参数为params对象，使用params.value获取数值；建议配置`labelLayout.hideOverlap:true`避免标签重叠；建议配置字体描边；
- title：严禁设置echarts options title，避免与卡片标题重复
- axis: 数值坐标轴建议设置name，分类坐标轴不建议设置name；优先使用垂直坐标轴布局（Y轴为数值轴，X轴为分类轴）
- 完全利用空间，不要留白
* formatter参数规范：label.formatter和tooltip.formatter参数为params对象，axisLabel.formatter参数为value
* 主题必须保持与config.js中的主题一致，可以通过window.DASHBOARD_CONFIG访问config.js主题配置
-->

ECharts v6.0.0 Key Configurations (**only for dashboard development**):

- Map: series.map uses Chinese names, examples: "中国", "广东省", "深圳市"; series.nameProperty is "fullname"
- grid:
  - Mandatory config: `{ left: 0, right: 0, top: 0, bottom: 0, containLabel: false }`, in v6.0.0 this config already allows axis and axis labels to display fully edge-aligned, so no need to reserve any space for XY axis labels or axis titles
  - outerBounds:
    - Use case: Reserve space for legend, visualMap, dataZoom components
    - Use condition: Only need to set when legend, visualMap, dataZoom components configured
    - Core principle: outerBounds direction must match component position direction
    - Config examples:
      - Bottom horizontal legend: `{ grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false, outerBounds: { bottom: 30 } }, legend: { type: "scroll", bottom: 0 } }`
      - Left vertical legend: `{ grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false, outerBounds: { left: 50 } }, legend: { type: "scroll", orient: "vertical", left: 0 } }`
      - Bottom horizontal visualMap: `{ grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false, outerBounds: { bottom: 50 } }, visualMap: { orient: "horizontal", bottom: 0, left: "center" } }`
      - Left bottom vertical visualMap: `{ grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false, outerBounds: { left: 50 } }, visualMap: { orient: "vertical", left: 0, bottom: 0 } }`
      - Bottom horizontal dataZoom: `{ grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false, outerBounds: { bottom: 70 } }, dataZoom: [{ type: "slider", orient: "horizontal", bottom: 0, left: "center" }] }`
      - Left vertical dataZoom: `{ grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false, outerBounds: { left: 50 } }, dataZoom: [{ type: "slider", orient: "vertical", left: 0, bottom: 0 }] }`
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
- tooltip: Suggest configuring tooltip for every chart
- dataZoom: Strictly prohibited to configure dataZoom, echarts dataZoom is ugly, not recommended
- label: label.formatter parameter is params object, use params.value to get numeric value; suggest configuring `labelLayout.hideOverlap:true` to avoid label overlap; suggest configuring font stroke;
- title: Strictly prohibited to set echarts options title, avoid duplication with card title
- axis: Numeric axis suggest setting name, category axis not suggest setting name; prioritize vertical axis layout (Y-axis as numeric axis, X-axis as category axis)
- Fully utilize space, no whitespace
- formatter parameter specification: label.formatter and tooltip.formatter parameters are params objects, axisLabel.formatter parameter is value
- Theme must remain consistent with theme in config.js, can access config.js theme config through window.DASHBOARD_CONFIG

---

## 卡片管理工具 / Card Management Tools

<!--zh
卡片管理工具：提供卡片增删改查功能，简化看板开发和维护

工具列表：
* create_dashboard_cards：批量创建卡片
* update_dashboard_cards：批量更新卡片，支持单字段编辑
* delete_dashboard_cards：批量删除卡片
* query_dashboard_cards：查询卡片信息，支持查询所有卡片或指定卡片，支持字段过滤

使用场景：
* 创建卡片：使用create_dashboard_cards批量创建新卡片；建议 auto_layout=True 省略 layout，由工具自动生成铺满布局
* 编辑卡片：使用update_dashboard_cards修改卡片配置，支持只更新部分字段（如只修改title或layout.y）
* 删除卡片：使用delete_dashboard_cards批量删除卡片
* 浏览卡片：使用query_dashboard_cards（不指定card_ids和fields）快速查看所有卡片的基本信息
* 查看详情：使用query_dashboard_cards（指定card_ids）获取指定卡片的完整配置（包括getCardData函数代码）
* 字段过滤：使用query_dashboard_cards的fields参数只返回需要的字段（如只要id、type、layout）
-->

Card Management Tools: Provide card CRUD functionality to simplify dashboard development and maintenance

Tool List:

- create_dashboard_cards: Batch create cards
- update_dashboard_cards: Batch update cards with single-field editing support
- delete_dashboard_cards: Batch delete cards
- query_dashboard_cards: Query card information, supports querying all cards or specific cards, supports field filtering

Usage Scenarios:

- Create cards: Use create_dashboard_cards to batch create new cards; recommend auto_layout=True to omit layout for auto gap-free layout
- Edit cards: Use update_dashboard_cards to modify card configuration, supports updating only partial fields (e.g., only modify title or layout.y)
- Delete cards: Use delete_dashboard_cards to batch delete cards
- Browse cards: Use query_dashboard_cards (without card_ids and fields) to quickly view basic information of all cards
- View details: Use query_dashboard_cards (with card_ids) to get complete configuration of specified cards (including getCardData function code)
- Field filtering: Use query_dashboard_cards fields parameter to return only needed fields (e.g., only id, type, layout)
