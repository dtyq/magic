"""CSV 解析插件实现"""

import os
from datetime import datetime
from pathlib import Path
from typing import Any, BinaryIO, Optional

import pandas as pd
from markitdown import (DocumentConverter, DocumentConverterResult, MarkItDown,
                        StreamInfo)

__plugin_interface_version__ = 1  # 插件接口版本

ACCEPTED_MIME_TYPE_PREFIXES = [
    "text/csv",
]

ACCEPTED_FILE_EXTENSIONS = [".csv"]

# CSV处理的最大行数限制
CSV_MAX_ROWS = 1000
CSV_MAX_PREVIEW_ROWS = 50

class CSVConverter(DocumentConverter):
    """CSV 文件转换器"""

    def accepts(
        self,
        file_stream: BinaryIO,
        stream_info: StreamInfo,
        **kwargs: Any,
    ) -> bool:
        """检查是否接受该文件类型"""
        mimetype = (stream_info.mimetype or "").lower()
        extension = (stream_info.extension or "").lower()

        if extension in ACCEPTED_FILE_EXTENSIONS:
            return True

        for prefix in ACCEPTED_MIME_TYPE_PREFIXES:
            if mimetype.startswith(prefix):
                return True

        return False

    def convert(
        self,
        file_stream: BinaryIO,
        stream_info: StreamInfo,
        **kwargs: Any,
    ) -> DocumentConverterResult:
        """转换 CSV 文件为 Markdown"""
        try:
            # 获取文件路径
            file_path = Path(file_stream.name) if hasattr(file_stream, 'name') and file_stream.name else None
            if not file_path:
                return DocumentConverterResult(
                    title=None,
                    markdown="错误: 无法获取文件路径",
                )

            # 获取 offset 和 limit 参数
            offset = kwargs.get('offset', 0)
            limit = kwargs.get('limit', None)

            # 处理不同的limit值
            if limit == -1:
                read_limit = None  # -1 表示读取全部数据，不限制行数
            elif limit is None or limit == 0:
                read_limit = CSV_MAX_ROWS  # 未指定或0时使用默认限制
            else:
                read_limit = limit  # 使用指定的正数限制

            # 提供pandas安装提示
            try:
                import pandas as pd
            except ImportError:
                return DocumentConverterResult(
                    title=None,
                    markdown="错误: 需要安装pandas库才能读取CSV文件: pip install pandas",
                )

            # 尝试不同的编码读取CSV
            encodings = ['utf-8', 'gbk', 'gb2312', 'latin1']
            df = None
            used_encoding = None

            for encoding in encodings:
                try:
                    if offset > 0:
                        df = pd.read_csv(
                            file_path,
                            encoding=encoding,
                            skiprows=range(1, offset + 1),  # 保留header行，但跳过其他行
                            nrows=read_limit  # None表示读取全部
                        )
                    else:
                        df = pd.read_csv(
                            file_path,
                            encoding=encoding,
                            nrows=read_limit  # None表示读取全部
                        )
                    used_encoding = encoding
                    break
                except UnicodeDecodeError:
                    continue
                except Exception as e:
                    return DocumentConverterResult(
                        title=None,
                        markdown=f"使用编码 {encoding} 读取CSV失败: {str(e)}",
                    )

            if df is None:
                return DocumentConverterResult(
                    title=None,
                    markdown=f"错误: 无法用常见编码(utf-8, gbk等)读取CSV文件: {file_path.name}",
                )

            # 获取文件总行数（数据行，不含 header）
            try:
                # 快速计算文件总行数，减去 header 行
                with open(file_path, 'r', encoding=used_encoding) as f:
                    total_file_rows = sum(1 for _ in f)
                    total_rows = max(0, total_file_rows - 1)  # 减去 header 行
            except Exception:
                total_rows = None

            # 获取当前读取的行列信息
            row_count = len(df)
            col_count = len(df.columns)

            result_text = []
            result_text.append(f"### CSV文件: {file_path.name}")
            result_text.append(f"* 使用编码: {used_encoding}")
            result_text.append(f"* 列数: {col_count}")
            if total_rows is not None:
                result_text.append(f"* 总数据行数: {total_rows}")
                result_text.append(f"* 当前读取行数: {row_count}")
            else:
                result_text.append(f"* 当前读取行数: {row_count}")

            # 显示数据内容
            if row_count == 0:
                result_text.append("\n* CSV文件为空或指定范围内没有数据")
            else:
                # 确定显示的数据和行数
                display_df = df.head(CSV_MAX_PREVIEW_ROWS) if row_count > CSV_MAX_PREVIEW_ROWS else df
                displayed_rows = min(row_count, CSV_MAX_PREVIEW_ROWS)

                # 判断是否被截断（数据不完整或显示行数受限）
                is_truncated = (
                    (total_rows and row_count < total_rows) or
                    (read_limit is not None and row_count >= read_limit) or
                    displayed_rows < row_count
                )

                # 显示警告（如果数据被截断）
                if is_truncated:
                    result_text.append("")
                    result_text.append("⚠️ **警告：此为预览数据，禁止直接用于回答数据查询问题！**")
                    result_text.append("**必须：编写Python脚本，基于全量数据处理 → 执行获取结果 → 删除临时文件 → 基于脚本结果回答**")

                # 显示数据
                total_info = f"/{total_rows}" if total_rows else ""
                if is_truncated:
                    title_suffix = f" (显示: {displayed_rows}{total_info} 行，不完整，完整数据请使用代码处理)"
                else:
                    title_suffix = f" (显示: {displayed_rows}{total_info} 行)"
                result_text.append(f"\n#### 数据内容{title_suffix}:")
                result_text.append("```")
                result_text.append(display_df.to_string(index=False))
                if is_truncated:
                    result_text.append("...")
                result_text.append("```")

            return DocumentConverterResult(
                title=None,
                markdown="\n".join(result_text),
            )
        except Exception as e:
            return DocumentConverterResult(
                title=None,
                markdown=f"解析CSV失败: {str(e)}",
            )
