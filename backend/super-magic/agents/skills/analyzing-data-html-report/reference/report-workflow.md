# 数据分析报告开发流程 / Data Analysis Report Workflow

<!--zh
本文档提供完整的开发流程和代码示例。
-->

This document provides complete workflow and code examples.

---

## 主要流程 / Main Workflow

<!--zh
1. **创建报告工作目录**：任务开始时必须创建专属目录，所有报告相关文件（分析脚本、JSON、HTML、README）均置于此目录内
2. **执行数据分析**：开发 Python 分析脚本，执行数据分析并输出 JSON 结果文件（脚本可配置、可复用，支持数据源更新后重新执行）
3. **构建 HTML 报告**：构建 HTML 文件，采用数据视图分离架构，数据通过内联 script 标签注入
4. **文档化**：编辑 Markdown 说明文档（报告目的、数据来源、计算逻辑、结果摘要）
5. **完成交付**：提供报告总结并结束任务
-->

1. **Create report working directory**: Must create dedicated directory at task start. Place all report files (analysis script, JSON, HTML, README) in this directory
2. **Execute data analysis**: Develop Python analysis script, execute data analysis and output JSON result file (script configurable, reusable, supports re-execution after data source update)
3. **Build HTML report**: Build HTML file, adopt data-view separation architecture, data injected via inline script tag
4. **Documentation**: Edit Markdown documentation (report purpose, data sources, calculation logic, result summary)
5. **Complete delivery**: Provide report summary and end task

---

## 技术栈 / Tech Stack

<!--zh
CDN 资源：
-->

CDN Resources:

- TailwindCSS: https://cdn.tailwindcss.com/3.4.17 (JIT mode, need script tag)
- ECharts: https://cdnjs.cloudflare.com/ajax/libs/echarts/5.6.0/echarts.min.js
- FontAwesome: https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css
- Tabler Icons: https://cdnjs.cloudflare.com/ajax/libs/tabler-icons/3.34.1/tabler-icons.min.css
- Google Fonts: https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap

---

## 技术约束 / Technical Constraints

<!--zh
- **静态化**：单 HTML 文件，所有数据内联，零异步加载
- **版本隔离**：仅使用 ECharts 5.6.0 规范
- **生命周期**：ECharts 初始化必须在 window.onload 后执行；若通过 script 动态插入 DOM 节点，必须在 requestAnimationFrame 回调中初始化 ECharts；监听 window.resize 触发 chart.resize()
- **坐标轴配置**：数值轴必须设置 `alignTicks: true`
- **主题一致性**：ECharts 主题与页面主题保持统一
-->

- **Staticization**: Single HTML file, all data inline, zero async loading
- **Version isolation**: Use ECharts 5.6.0 specification only
- **Lifecycle**: ECharts initialization must execute after window.onload; if DOM nodes dynamically inserted via script, must initialize ECharts in requestAnimationFrame callback; listen to window.resize to trigger chart.resize()
- **Axis configuration**: Numeric axis must set `alignTicks: true`
- **Theme consistency**: ECharts theme remains consistent with page theme

---

## 核心原则 / Core Principles

<!--zh
- **计算驱动**：基于脚本完整计算数据，获得准确结果
- **自包含部署**：零依赖外部数据文件，支持离线访问
-->

- **Calculation-driven**: Complete calculation of data based on scripts, obtain accurate results
- **Self-contained deployment**: Zero dependency on external data files, supports offline access

---

## 完整代码示例 / Complete Code Example

<!--zh
**Step 1**：创建分析脚本 `analyze.py`，读取数据源，执行分析，输出 `report_data.json`
-->

**Step 1**: Create analysis script `analyze.py`, read data source, execute analysis, output `report_data.json`

```python
# analyze.py
import pandas as pd
import json

# 读取数据源
df = pd.read_csv('sales.csv')

# 执行分析，获取准确结果
total_sales = float(df['amount'].sum())
monthly_data = df.groupby('month')['amount'].sum().to_dict()

# 输出 JSON
result = {
    "total": total_sales,
    "monthly": monthly_data,
    "chart_data": list(monthly_data.values())
}

with open('report_data.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
```

<!--zh
**Step 2**：执行分析脚本
-->

**Step 2**: Execute analysis script

```python
shell_exec(command="python analyze.py", cwd="report_dir")
```

<!--zh
**Step 3**：构建 HTML 报告，数据通过内联 script 标签嵌入
-->

**Step 3**: Build HTML report, data embedded via inline script tag

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <script src="https://cdn.tailwindcss.com/3.4.17"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/echarts/5.6.0/echarts.min.js"></script>
  </head>
  <body class="bg-gray-50 p-8">
    <div class="max-w-6xl mx-auto bg-white rounded-lg shadow p-6">
      <h1 class="text-2xl font-bold mb-4">销售分析报告</h1>
      <div id="chart" style="width:100%;height:400px;"></div>
    </div>

    <script data-type="report">
      // 数据内联嵌入
      var reportData = {
        total: 12345.67,
        monthly: { Jan: 1000, Feb: 1200, Mar: 1100 },
        chart_data: [1000, 1200, 1100],
      };
    </script>

    <script>
      // 初始化图表
      window.onload = function () {
        var chart = echarts.init(document.getElementById("chart"));
        chart.setOption({
          xAxis: { type: "category", data: Object.keys(reportData.monthly) },
          yAxis: { type: "value", alignTicks: true },
          series: [{ type: "bar", data: reportData.chart_data }],
        });

        window.addEventListener("resize", () => chart.resize());
      };
    </script>
  </body>
</html>
```

---

## 提示细节 / Implementation Details

<!--zh
### 数据验证
在分析脚本中处理数据验证：
- 过滤异常值（NaN、Infinity）
- 确保数据类型正确（使用 float()、int() 转换）
- 验证计算结果完整性
-->

### Data Validation

Handle data validation in analysis script:

- Filter outliers (NaN, Infinity)
- Ensure correct data types (use float(), int() conversion)
- Validate calculation result completeness

```python
# 数据验证示例
import numpy as np

# 过滤 NaN 和 Infinity
df = df.replace([np.inf, -np.inf], np.nan).dropna()

# 确保数据类型
total = float(df['amount'].sum())
```

<!--zh
### 数据注入方式
推荐直接在 HTML 中嵌入数据，无需额外的注入脚本：
-->

### Data Injection Method

Recommended to embed data directly in HTML, no need for separate injection script:

```html
<script data-type="report">
  var reportData = { key: "value" };
</script>
```

<!--zh
如需动态更新，可选择创建注入脚本：
-->

If dynamic update needed, optionally create injection script:

```python
# inject_data.py (可选)
import re, json

with open('report_data.json') as f:
    data = json.load(f)

with open('report.html') as f:
    html = f.read()

# 替换数据
html = re.sub(
    r'var reportData = \{.*?\};',
    f'var reportData = {json.dumps(data, ensure_ascii=False)};',
    html,
    flags=re.DOTALL
)

with open('report.html', 'w', encoding='utf-8') as f:
    f.write(html)
```
