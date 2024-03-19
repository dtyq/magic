"""Excel 解析插件实现"""

import os
from datetime import datetime
from pathlib import Path
from typing import Any, BinaryIO, Optional

import pandas as pd
from markitdown import (DocumentConverter, DocumentConverterResult, MarkItDown,
                        StreamInfo)

__plugin_interface_version__ = 1  # 插件接口版本

ACCEPTED_MIME_TYPE_PREFIXES = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
]

ACCEPTED_FILE_EXTENSIONS = [".xlsx", ".xls"]

# Excel处理的最大行数限制
EXCEL_MAX_ROWS = 1000
EXCEL_MAX_PREVIEW_ROWS = 50

class ExcelConverter(DocumentConverter):
    """Excel 文件转换器"""

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
        """转换 Excel 文件为 Markdown"""
        try:
            # 获取文件路径
            file_path = Path(file_stream.name) if hasattr(file_stream, 'name') and file_stream.name else None
            if not file_path:
                return DocumentConverterResult(
                    title=None,
                    markdown="错误: 无法获取文件路径",
                )

            # 获取 offset、limit 和 display_limit 参数
            offset = kwargs.get('offset', 0)
            limit = kwargs.get('limit', None)
            display_limit = kwargs.get('display_limit', None)  # None表示不限制显示行数

            # 处理不同的limit值
            if limit == -1:
                read_limit = None  # -1 表示读取全部数据，不限制行数
            elif limit is None or limit == 0:
                read_limit = EXCEL_MAX_ROWS  # 未指定或0时使用默认限制
            else:
                read_limit = limit  # 使用指定的正数限制

            # 提供pandas安装提示
            try:
                import openpyxl  # 仅用于尝试导入确认是否已安装
            except ImportError:
                return DocumentConverterResult(
                    title=None,
                    markdown="错误: 需要安装openpyxl库才能读取Excel文件: pip install openpyxl pandas",
                )

            # 获取所有工作表名称
            excel_file = pd.ExcelFile(file_path)
            sheet_names = excel_file.sheet_names

            result_text = []
            result_text.append(f"### Excel文件: {file_path.name}")
            result_text.append(f"> 包含 {len(sheet_names)} 个工作表: {', '.join(sheet_names)}\n")

            # 为每个工作表提取数据
            for sheet_name in sheet_names:
                # 获取工作表的实际总行数
                try:
                    # 先读取整个工作表来获取总行数
                    df_full = pd.read_excel(file_path, sheet_name=sheet_name)
                    total_rows = len(df_full)
                    col_count = len(df_full.columns)

                    # 读取指定范围的数据
                    df = pd.read_excel(
                        file_path,
                        sheet_name=sheet_name,
                        skiprows=offset,
                        nrows=read_limit  # None表示读取全部
                    )
                except Exception:
                    # 如果无法读取完整数据，则回退到原来的方式
                    df_info = pd.read_excel(file_path, sheet_name=sheet_name, nrows=0)
                    col_count = len(df_info.columns)
                    total_rows = None

                    df = pd.read_excel(
                        file_path,
                        sheet_name=sheet_name,
                        skiprows=offset,
                        nrows=read_limit  # None表示读取全部
                    )

                # 获取当前读取的行数
                row_count = len(df)

                # 添加工作表信息
                result_text.append(f"## 工作表: {sheet_name}")
                result_text.append(f"* 列数: {col_count}")
                if total_rows is not None:
                    result_text.append(f"* 总数据行数: {total_rows}")
                    result_text.append(f"* 当前读取行数: {row_count}")
                else:
                    result_text.append(f"* 当前读取行数: {row_count}")

                # 显示数据内容
                if row_count == 0:
                    result_text.append("\n* 工作表为空或指定范围内没有数据")
                    continue

                # 确定显示的数据和行数
                if display_limit is None:
                    # 不限制显示行数，显示全部数据
                    display_df = df
                    displayed_rows = row_count
                elif display_limit == 0:
                    # 使用默认限制
                    display_df = df.head(EXCEL_MAX_PREVIEW_ROWS) if row_count > EXCEL_MAX_PREVIEW_ROWS else df
                    displayed_rows = min(row_count, EXCEL_MAX_PREVIEW_ROWS)
                else:
                    # 使用指定的显示限制
                    display_df = df.head(display_limit) if row_count > display_limit else df
                    displayed_rows = min(row_count, display_limit)

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

                result_text.append("\n")

            return DocumentConverterResult(
                title=None,
                markdown="\n".join(result_text),
            )
        except Exception as e:
            return DocumentConverterResult(
                title=None,
                markdown=f"解析 Excel 失败: {str(e)}",
            )
