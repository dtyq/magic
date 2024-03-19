# 看板数据清洗指南 / Dashboard Data Cleaning Guide

<!--zh
- 脚本文件：data_cleaning.py
- 脚本示例：
```python
import os
import pandas as pd

# 必需语句（严格按照此格式）
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "cleaned_data")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 数据源定义（如果有文件数据源）
FILE_DATA_SOURCES = {
  'main_data': os.path.join(PROJECT_ROOT, "..", "数据源.csv"),
  'additional_data': os.path.join(PROJECT_ROOT, "..", "附加数据.csv")
}

def main():
    # 1. 数据加载
    df = pd.read_csv(FILE_DATA_SOURCES['main_data'])

    # 2. 数据清洗：缺失值处理、重复值去除、类型转换、异常值处理

    # 3. 数据拆分：按业务逻辑、时间维度、地理区域等拆分为多个专题文件

    # 4. 指标计算：描述统计、分组聚合、衍生指标、高级分析

    # 5. 数据输出：CSV格式到cleaned_data目录
    df.to_csv(os.path.join(OUTPUT_DIR, "清洗数据.csv"), index=False, encoding='utf-8')

if __name__ == "__main__":
    main()
```

数据清洗核心原则：
* 仅能通过执行data_cleaning.py脚本输出CSV格式到cleaned_data目录
* 基于全量数据进行数据清洗
-->

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

Data Cleaning Core Principles:

- Only output CSV format to cleaned_data directory by executing data_cleaning.py script
- Perform data cleaning based on full data
