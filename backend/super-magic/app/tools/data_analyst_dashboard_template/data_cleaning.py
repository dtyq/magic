import os
import pandas as pd

# 必需语句（严格按照此格式）
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "cleaned_data")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 数据源定义（如果有文件数据源）
FILE_DATA_SOURCES = {
    'main_data': os.path.join(PROJECT_ROOT, "..", "数据源.csv"),
    # 'additional_data': os.path.join(PROJECT_ROOT, "..", "附加数据.csv")
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
