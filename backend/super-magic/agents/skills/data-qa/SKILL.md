---
name: data-qa
description: Data Q&A skill for immediate numeric answers and conclusions. Use when users ask "what is xx metric?", "which xx is best?", "how is xx growth rate?" or need instant numeric answers/conclusions from data. Answers based on Python script calculation only.

name-cn: 数据问答技能
description-cn: 数据问答技能。当用户需要即时获得数据答案，如"xx指标是多少"、"哪个最好"、"xx增长率怎么样"等具体数值或结论时使用。仅通过 Python 脚本计算后回答。
---

# 数据问答技能 / Data Q&A Skill

<!--zh
通过 Python 脚本精确计算数据，提供即时准确的数值答案和业务解释。直接读取数据会产生幻觉，必须通过脚本完整计算。
-->

Precisely calculate data through Python scripts, provide immediate accurate numeric answers and business explanations. Directly reading data produces hallucinations; must use script complete calculation.

---

## 代码执行方式 / Code Execution Method

<!--zh
数据分析代码必须通过 `run_python_snippet` 工具执行。
-->

Data analysis code must be executed via `run_python_snippet` tool.

---

## 核心步骤 / Core Steps

<!--zh
1. 编写脚本：编写 Python 处理完整数据，输出 JSON 等结构化结果
2. 执行计算：run_python_snippet(python_code=..., script_path=..., cwd=...)
3. 解析结果：从 result.content 提取 answer、explanation
4. 回答用户：用自然语言给出数值和业务解释
5. 结束任务
-->

1. Write script: Python processes full data, outputs JSON or structured result
2. Execute: run_python_snippet(python_code=..., script_path=..., cwd=...)
3. Parse: Extract answer, explanation from result.content
4. Answer: Natural language response with numeric result and business explanation
5. End task

---

## 完整工作流示例 / Complete Workflow Example

```python
# Step 1: 使用 run_python_snippet 执行 Python 代码
run_python_snippet(
    python_code="""
import json
import pandas as pd

df = pd.read_csv('path/to/data.csv')
metric = df['column'].sum()  # 完整计算，勿仅读取片段
print(json.dumps({'answer': metric, 'explanation': '...'}))
""",
    script_path="temp_data_qa.py",
    cwd="工作区根目录"
)

# Step 2: 解析 result.content 获取计算结果
# Step 3: 基于计算结果用自然语言回答用户问题
```

<!--zh
关键：脚本必须处理完整数据并输出结构化结果（如 JSON），禁止直接读取文件片段回答。
-->

Key: Script must process complete data and output structured result (e.g. JSON). Strictly prohibited to answer by directly reading file snippets.

---

## 核心原则 / Core Principle

<!--zh
直接读取数据会产生幻觉，误导决策。必须通过脚本完整计算才能得出准确结果。
-->

Directly reading data produces hallucinations, misleading decisions. Only through script complete calculation can accurate results be obtained.

---

## 工具选择决策树 / Tool Selection Decision Tree

<!--zh
需要回答数据相关数值问题？
├─ 是 → 编写 run_python_snippet 脚本计算
└─ 否 → 不使用本技能

数据格式？
├─ CSV/Excel → pandas 读取，完整计算后 print(json.dumps(...))
├─ JSON → json.load + 处理逻辑
└─ 其他 → 参见下方数据处理规范
-->

User asks numeric data question?
├─ Yes → Write run_python_snippet script to calculate
└─ No → Do not use this skill

Data format?
├─ CSV/Excel → pandas read, full calculation, print(json.dumps(...))
├─ JSON → json.load + processing logic
└─ Other → See data processing instructions below

---

## 数据处理规范 / Data Processing Instructions

<!--zh
当涉及需要数据分析处理的场景时，可以编写Python脚本进行数据分析：
- Python脚本仅帮助进行数据分析处理，而不是数据可视化，数据可视化需要使用Echarts实现，禁止在Python脚本中编写绘制图表的代码
- 对于Excel、CSV等数据类文件，可以使用read_files工具读取文件的前10行了解结构，然后使用Python脚本进行数据分析处理
- 对于有多sheet或体积较大的Excel文件，始终使用Python脚本进行数据分析处理，先通过脚本查看数据结构与sheet结构，再使用脚本进行数据分析处理，脚本只返回少量结果数据，避免阅读大量无效数据
- Python脚本的处理结果应当精炼，脚本的作用是计算和提炼核心数据，而不是返回大量过程数据，通常在百字到千字级别，最多不超过5000字
- 遵循最新的Python主流编程实践，确保代码健壮性，尽可能一次性运行成功
-->

When scenarios involve data analysis, write Python scripts for analysis:

- Python scripts are solely for data analysis processing, not data visualization. Use ECharts for visualization. Strictly prohibited to write chart rendering code in Python scripts.
- For data files like Excel, CSV, use read_files to read first 10 lines to understand structure, then use Python scripts for data analysis.
- For Excel files with multiple sheets or large size, always use Python scripts for analysis. First use script to view data structure and sheet structure, then perform analysis. Scripts should return only small amount of result data, avoid reading large volumes of useless data.
- Python script processing results should be refined. Script's role is to calculate and distill core data, not return large amounts of process data. Typically hundreds to thousands of characters, max 5000 characters.
- Follow latest mainstream Python programming practices. Ensure code robustness, aim for one-time successful execution.
