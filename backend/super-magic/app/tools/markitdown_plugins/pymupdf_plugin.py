"""PyMuPDF PDF 解析插件实现

使用 PyMuPDF (fitz) 替换 PyPDF2，提供更稳定和强大的 PDF 解析能力
"""

import re
from datetime import datetime
from pathlib import Path
from typing import Any, BinaryIO, Optional
import tempfile
import asyncio
import warnings

# 全局抑制 PyMuPDF (SWIG) 相关的所有 DeprecationWarning
# PyMuPDF 使用 SWIG 生成 Python 绑定，SWIG 生成的内建类型（SwigPyPacked、SwigPyObject、swigvarlink）
# 缺少 __module__ 属性，这会在较新版本的 Python 中产生 DeprecationWarning
# 这些警告不影响功能，但会产生噪音，所以在此模块范围内抑制
# 参考: https://github.com/pymupdf/PyMuPDF/issues/3931
warnings.filterwarnings("ignore", category=DeprecationWarning,
                       message=".*SwigPyPacked.*__module__.*")
warnings.filterwarnings("ignore", category=DeprecationWarning,
                       message=".*SwigPyObject.*__module__.*")
warnings.filterwarnings("ignore", category=DeprecationWarning,
                       message=".*swigvarlink.*__module__.*")

# 现在安全地导入 PyMuPDF
import fitz  # PyMuPDF

from markitdown import (
    MarkItDown,
    DocumentConverter,
    DocumentConverterResult,
    StreamInfo,
)

__plugin_interface_version__ = 1  # 插件接口版本

ACCEPTED_MIME_TYPE_PREFIXES = [
    "application/pdf",
]

ACCEPTED_FILE_EXTENSIONS = [".pdf"]

class PyMuPDFConverter(DocumentConverter):
    """基于 PyMuPDF 的 PDF 文件转换器"""

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
        """转换 PDF 文件为 Markdown"""
        try:
            result_text = []

            file_name = "PDF Document"
            if hasattr(file_stream, 'name') and file_stream.name:
                file_name = Path(file_stream.name).stem

            result_text.append(f"# {file_name}")
            result_text.append("")

            # 读取 PDF 文件内容到内存
            file_stream.seek(0)
            pdf_data = file_stream.read()

            # 使用 PyMuPDF 打开 PDF
            doc = fitz.open(stream=pdf_data, filetype="pdf")

            # 提取文档信息
            doc_info = []

            # 获取页数
            num_pages = doc.page_count
            doc_info.append(f"- 页数: {num_pages}")

            # 提取文档元数据
            metadata = doc.metadata
            if metadata:
                if metadata.get('title'):
                    doc_info.append(f"- 标题: {metadata['title']}")
                if metadata.get('author'):
                    doc_info.append(f"- 作者: {metadata['author']}")
                if metadata.get('subject'):
                    doc_info.append(f"- 主题: {metadata['subject']}")
                if metadata.get('creator'):
                    doc_info.append(f"- 创建工具: {metadata['creator']}")
                if metadata.get('creationDate'):
                    doc_info.append(f"- 创建日期: {metadata['creationDate']}")

            # 添加文档信息区块
            if doc_info:
                result_text.append("## 文档信息")
                result_text.append("")
                result_text.extend(doc_info)
                result_text.append("")

            # 获取 offset 和 limit 参数
            offset = kwargs.get('offset', 0)
            limit = kwargs.get('limit', None)

            # 计算要读取的页面范围
            start_page = max(0, offset)
            end_page = num_pages if limit is None or limit <= 0 else min(num_pages, start_page + limit)

            # 如果是部分读取，添加页码范围提示
            if start_page > 0 or (end_page < num_pages and limit is not None and limit > 0):
                result_text.append(f"## 显示第 {start_page + 1} 页到第 {end_page} 页（共 {num_pages} 页）")
                result_text.append("")

            # 逐页提取内容
            for page_num in range(start_page, end_page):
                page = doc[page_num]

                # 添加页码标题
                result_text.append(f"## 第 {page_num + 1} 页")

                # 提取文本
                try:
                    text = page.get_text()
                    image_list = page.get_images()

                    if text and text.strip():
                        # 有文本内容的页面
                        # 检测可能的表格
                        table_detected = self._detect_table(text)
                        if table_detected:
                            text = self._process_potential_table(text)

                        # 检测图片区域
                        text = self._mark_potential_images(text)

                        # 格式化文本
                        text = self._format_text(text)

                        # 添加格式化后的文本
                        result_text.append(text)

                        # 如果页面既有文本又有图片，根据参数决定是否提取图片
                        if image_list:
                            # 获取有文本页面的图片提取数量参数
                            text_page_image_extract_count = kwargs.get('text_page_image_extract_count', 0)

                            if text_page_image_extract_count > 0:
                                # 限制提取指定数量的图片
                                images_to_extract = image_list[:text_page_image_extract_count]
                                extracted_images = self._extract_page_images(doc, page, images_to_extract, page_num + 1)

                                if extracted_images:
                                    result_text.append(f"\n*此页还包含 {len(image_list)} 个图片，已提取前 {len(extracted_images)} 个进行分析*")
                                    # 添加图片路径信息到结果中，供后续工具使用
                                    for i, img_path in enumerate(extracted_images):
                                        result_text.append(f"- 图片 {i+1}: {img_path}")
                                else:
                                    # 如果图片提取失败，回退到原有提示
                                    result_text.append(f"\n*此页还包含 {len(image_list)} 个图片*")
                            else:
                                # 默认行为：只提示图片存在，不提取
                                result_text.append(f"\n*此页还包含 {len(image_list)} 个图片*")
                    else:
                                                                        # 无文本内容的页面
                        if image_list:
                            # 提取并保存图片用于后续分析
                            extracted_images = self._extract_page_images(doc, page, image_list, page_num + 1)
                            if extracted_images:
                                result_text.append(f"[此页主要为图片内容，包含 {len(image_list)} 个图片，已提取用于分析]")
                                # 添加图片路径信息到结果中，供后续工具使用
                                for i, img_path in enumerate(extracted_images):
                                    result_text.append(f"- 图片 {i+1}: {img_path}")
                            else:
                                # 如果图片提取失败，回退到基本信息
                                result_text.append(f"[此页主要为图片内容，包含 {len(image_list)} 个图片]")

                                # 尝试获取图片的基本信息
                                for i, img in enumerate(image_list[:3]):  # 最多显示前3个图片的信息
                                    try:
                                        xref = img[0]
                                        pix = fitz.Pixmap(doc, xref)
                                        result_text.append(f"- 图片 {i+1}: {pix.width}x{pix.height} 像素")
                                        pix = None  # 释放内存
                                    except:
                                        result_text.append(f"- 图片 {i+1}: 无法获取详细信息")

                                if len(image_list) > 3:
                                    result_text.append(f"- ... 还有 {len(image_list) - 3} 个图片")
                        else:
                            result_text.append("[此页为空白页面或无可提取内容]")

                except Exception as e:
                    result_text.append(f"[提取文本失败: {str(e)}]")

                # 添加页面分隔符
                result_text.append("")

            # 关闭文档
            doc.close()

            # 添加前后页面提示
            if start_page > 0:
                result_text.insert(len(doc_info) + 5 if doc_info else 3, f"*注意：前 {start_page} 页未显示，可以通过设置 offset=0 查看*\n")

            if end_page < num_pages:
                result_text.append(f"*注意：还有 {num_pages - end_page} 页未显示，可以通过增加 limit 参数或调整 offset 查看*")

            return DocumentConverterResult(
                title=None,
                markdown="\n".join(result_text),
            )

        except Exception as e:
            return DocumentConverterResult(
                title=None,
                markdown=f"解析 PDF 失败: {str(e)}",
            )

    def _format_text(self, text: str) -> str:
        """格式化文本内容"""
        # 移除多余的空行
        text = re.sub(r'\n{3,}', '\n\n', text)

        # 格式化列表项
        text = re.sub(r'(?m)^(\s*)\*(\s+)', r'\1-\2', text)
        text = re.sub(r'(?m)^(\s*)(\d+)\.(\s+)', r'\1\2.\3', text)
        text = re.sub(r'(?m)^(\s*)>(\s+)', r'\1>\2', text)

        # 检测标题
        text = self._detect_headings(text)

        return text

    def _detect_table(self, text: str) -> bool:
        """检测文本中是否包含表格"""
        lines = text.split('\n')
        if len(lines) < 3:
            return False

        # 简化的表格检测逻辑
        space_patterns = []
        for line in lines:
            if len(line.strip()) < 5:
                continue

            # 计算空格块的数量
            space_blocks = len(re.findall(r'\s{2,}', line))
            space_patterns.append(space_blocks)

        # 如果有多行都有相似的空格模式，可能是表格
        if len(space_patterns) >= 3:
            avg_spaces = sum(space_patterns) / len(space_patterns)
            similar_count = sum(1 for s in space_patterns if abs(s - avg_spaces) <= 1)
            return similar_count >= len(space_patterns) * 0.6

        return False

    def _process_potential_table(self, text: str) -> str:
        """处理可能的表格文本为 markdown 表格格式"""
        lines = text.split('\n')
        result_lines = []

        i = 0
        while i < len(lines):
            line = lines[i]

            if (i + 2 < len(lines) and
                self._is_potential_table_row(line) and
                self._is_potential_table_row(lines[i+1])):

                table_lines = []
                header = line
                table_lines.append(header)

                # 创建分隔符
                separator = "|"
                for col in self._split_table_columns(header):
                    separator += " --- |"
                table_lines.append(separator)

                # 收集表格行
                j = i + 1
                while j < len(lines) and self._is_potential_table_row(lines[j]):
                    table_lines.append(lines[j])
                    j += 1

                # 转换为 markdown 表格
                markdown_table = []
                for table_line in table_lines:
                    if table_line.startswith("|"):  # 已经是表格格式
                        markdown_table.append(table_line)
                    else:
                        md_line = "|"
                        for col in self._split_table_columns(table_line):
                            md_line += f" {col.strip()} |"
                        markdown_table.append(md_line)

                result_lines.append("\n*检测到可能的表格内容:*\n")
                result_lines.extend(markdown_table)
                result_lines.append("\n*注意: 上述表格是基于文本分析自动生成的，可能不准确*\n")

                i = j
            else:
                result_lines.append(line)
                i += 1

        return '\n'.join(result_lines)

    def _is_potential_table_row(self, line: str) -> bool:
        """检查一行是否可能是表格的一部分"""
        if len(line.strip()) < 10:
            return False

        # 检查是否有多个空格分隔的字段
        space_blocks = len(re.findall(r'\s{2,}', line))
        return space_blocks >= 2 and len(re.sub(r'\s+', '', line)) > 5

    def _split_table_columns(self, line: str) -> list:
        """将表格行分割为列"""
        return re.split(r'\s{2,}', line.strip())

    def _mark_potential_images(self, text: str) -> str:
        """标记可能的图片区域"""
        patterns = [
            r'图\s*\d+[\s\.:：]',
            r'figure\s*\d+[\s\.:：]',
            r'fig\.\s*\d+[\s\.:：]',
            r'image\s*\d+[\s\.:：]',
            r'photo\s*\d+[\s\.:：]',
            r'illustration\s*\d+[\s\.:：]'
        ]

        for pattern in patterns:
            text = re.sub(
                pattern=f'({pattern})(.*?)($|\n\n)',
                repl=r'\1\2\n\n*[图片占位符: 此处可能包含图片内容]*\n\3',
                string=text,
                flags=re.DOTALL | re.IGNORECASE
            )

        return text

    def _detect_headings(self, text: str) -> str:
        """检测并格式化标题"""
        lines = text.split('\n')
        result_lines = []

        for i, line in enumerate(lines):
            line_stripped = line.strip()

            # 跳过空行
            if not line_stripped:
                result_lines.append(line)
                continue

            # 检测可能的标题模式
            is_heading = False

            # 模式1: 全大写且较短
            if (line_stripped.isupper() and
                len(line_stripped) < 50 and
                len(line_stripped) > 3):
                is_heading = True

            # 模式2: 数字编号开头
            elif re.match(r'^\d+[\.\s]', line_stripped):
                is_heading = True

            # 模式3: 中文章节标题
            elif re.match(r'^[第一二三四五六七八九十\d]+[章节部分条款]\s', line_stripped):
                is_heading = True

            # 模式4: 独立成行且前后有空行
            elif (len(line_stripped) < 80 and
                  i > 0 and i < len(lines) - 1 and
                  not lines[i-1].strip() and
                  not lines[i+1].strip()):
                is_heading = True

            if is_heading and not line_stripped.startswith('#'):
                # 根据内容判断标题级别
                if len(line_stripped) < 20:
                    result_lines.append(f"### {line_stripped}")
                else:
                    result_lines.append(f"## {line_stripped}")
            else:
                result_lines.append(line)

        return '\n'.join(result_lines)

    def _extract_page_images(self, doc, page, image_list, page_num):
        """提取页面中的图片并保存到临时文件

        Args:
            doc: PyMuPDF 文档对象
            page: 页面对象
            image_list: 图片列表
            page_num: 页码

        Returns:
            List[str]: 提取的图片文件路径列表
        """
        extracted_images = []

        try:
            # 创建基于进程ID的持久临时目录，确保在整个转换过程中文件都存在
            import os
            process_id = os.getpid()
            temp_dir = Path(tempfile.gettempdir()) / f"pdf_extracted_images_{process_id}"
            temp_dir.mkdir(exist_ok=True)

            for i, img in enumerate(image_list):
                try:
                    # 获取图片数据
                    xref = img[0]
                    pix = fitz.Pixmap(doc, xref)

                    # 跳过过小的图片（可能是装饰性图片）
                    if pix.width < 50 or pix.height < 50:
                        pix = None
                        continue

                    # 保存图片，使用时间戳确保文件名唯一
                    import time
                    timestamp = int(time.time() * 1000)  # 毫秒级时间戳
                    img_filename = f"page_{page_num}_img_{i+1}_{timestamp}.png"
                    img_path = temp_dir / img_filename
                    pix.save(str(img_path))
                    extracted_images.append(str(img_path))

                    pix = None  # 释放内存

                except Exception as e:
                    print(f"提取图片失败: {e}")
                    continue

        except Exception as e:
            print(f"创建临时目录失败: {e}")
            return []

        return extracted_images
