"""Word document (.docx/.doc) converter with intelligent caching"""

import hashlib
import os
import time
from pathlib import Path
from typing import Any, BinaryIO, Optional

from markitdown import DocumentConverter, DocumentConverterResult, StreamInfo
from agentlang.logger import get_logger

logger = get_logger(__name__)

# Plugin interface version
__plugin_interface_version__ = 1

# Supported file types (only .docx, not .doc)
ACCEPTED_MIME_TYPE_PREFIXES = [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
    # Note: .doc (application/msword) is NOT supported by mammoth library
]
ACCEPTED_FILE_EXTENSIONS = [".docx"]  # Only .docx is supported, not .doc

# Configuration constants
DOCX_MAX_LINES = 1000
CACHE_MAX_AGE_DAYS = 30
CLEANUP_INTERVAL = 100

class DocxConverter(DocumentConverter):
    """Word document (.docx) converter with intelligent caching and pagination support

    Note: Only supports .docx format. .doc files are not supported by the mammoth library.
    """

    def __init__(self):
        self._conversion_count = 0

    def accepts(self, file_stream: BinaryIO, stream_info: StreamInfo, **kwargs: Any) -> bool:
        """Check if this converter can handle the file type"""
        mimetype = (stream_info.mimetype or "").lower()
        extension = (stream_info.extension or "").lower()

        # Check by file extension
        if extension in ACCEPTED_FILE_EXTENSIONS:
            return True

        # Check by MIME type
        for prefix in ACCEPTED_MIME_TYPE_PREFIXES:
            if mimetype.startswith(prefix):
                return True

        return False

    def convert(self, file_stream: BinaryIO, stream_info: StreamInfo, **kwargs: Any) -> DocumentConverterResult:
        """Convert DOCX file to Markdown with intelligent caching"""
        try:
            # Get file path for caching
            file_path = self._get_file_path(file_stream)

            # Try cache first if we have a file path
            if file_path:
                cached_content = self._try_load_from_cache(file_path)
                if cached_content:
                    logger.info(f"Cache hit for Word document: {file_path.name}")
                    return self._apply_pagination(cached_content, file_path.name, kwargs)

            # Cache miss or no file path - perform conversion
            logger.info(f"Converting Word document: {file_path.name if file_path else 'stream'}")
            markdown_content = self._convert_docx_to_markdown(file_stream)

            # Save to cache if we have a file path
            if file_path:
                self._save_to_cache(file_path, markdown_content)

            # Apply pagination and return result
            file_name = file_path.name if file_path else "DOCX Document"
            return self._apply_pagination(markdown_content, file_name, kwargs)

        except Exception as e:
            logger.exception(f"DOCX conversion failed: {e}")
            return DocumentConverterResult(
                title=None,
                markdown=f"DOCX conversion failed: {str(e)}"
            )
        finally:
            # Periodic cache cleanup
            self._maybe_cleanup_cache()

    def _get_file_path(self, file_stream: BinaryIO) -> Optional[Path]:
        """Extract file path from stream if available"""
        if hasattr(file_stream, 'name') and file_stream.name:
            return Path(file_stream.name)
        return None

    def _try_load_from_cache(self, source_file: Path) -> Optional[str]:
        """Try to load content from cache if valid"""
        try:
            cache_path = self._get_cache_path(source_file)

            if self._is_cache_valid(source_file, cache_path):
                return cache_path.read_text(encoding='utf-8')

        except Exception as e:
            logger.warning(f"Cache read failed: {e}")

        return None

    def _is_cache_valid(self, source_file: Path, cache_path: Path) -> bool:
        """Check if cache is valid based on modification time"""
        if not cache_path.exists():
            return False

        try:
            source_mtime = source_file.stat().st_mtime
            cache_mtime = cache_path.stat().st_mtime

            # Cache is valid if source file hasn't been modified after cache creation
            return source_mtime <= cache_mtime

        except OSError:
            return False

    def _get_cache_path(self, source_file: Path) -> Path:
        """Generate unique cache file path"""
        from agentlang.paths import PathManager

        # Create unique identifier to avoid path conflicts
        file_hash = hashlib.md5(str(source_file).encode()).hexdigest()[:8]
        cache_name = f"{source_file.stem}_{file_hash}.md"

        # Ensure cache directory exists
        cache_dir = PathManager.get_cache_dir() / "docx_conversions"
        cache_dir.mkdir(parents=True, exist_ok=True)

        return cache_dir / cache_name

    def _convert_docx_to_markdown(self, file_stream: BinaryIO) -> str:
        """将Word文档(.docx)转换为Markdown格式，使用mammoth库

        转换流程：
        1. 使用mammoth库将docx转换为HTML (图片→base64)
        2. 使用html2text将HTML转换为Markdown (设置ignore_images=True避免base64)
        3. 调用_process_image_references处理图片，添加简洁占位符

        注意：只支持.docx格式，不支持旧版.doc格式
        """
        try:
            import mammoth
            import html2text
        except ImportError as e:
            raise ImportError(f"Required dependency missing: {e}. Install with: pip install mammoth html2text")

        # Step 1: DOCX → HTML (mammoth库转换，图片变为base64)
        file_stream.seek(0)  # Ensure we're at the beginning
        result = mammoth.convert_to_html(file_stream)
        html_content = result.value  # HTML内容，包含<img src="data:image/png;base64,...">

        if not html_content:
            return "<!-- Empty DOCX document -->"

        # Step 2: HTML → Markdown (html2text转换)
        h = html2text.HTML2Text()
        h.body_width = 0          # 不自动换行
        h.protect_links = True    # 保护链接格式
        h.ignore_images = True    # 关键：忽略图片，避免base64数据进入markdown

        markdown_content = h.handle(html_content)  # 纯文本markdown，无图片base64数据

        # Step 3: 后处理 - 分析HTML中的图片，添加简洁占位符到markdown
        markdown_content = self._process_image_references(html_content, markdown_content)

        return markdown_content.strip()

    def _process_image_references(self, html_content: str, markdown_content: str) -> str:
        """处理图片引用，将base64图片数据替换为简洁占位符，节省token消耗

        转换流程说明：
        1. docx文件 → mammoth库 → HTML (图片被转换为base64 data:image/png;base64,xxx...)
        2. HTML → html2text → Markdown (base64数据会保留在markdown中)
        3. 本方法：分析HTML中的<img>标签，提取alt属性，生成简洁占位符替代巨大的base64数据

        目的：
        - 避免base64图片数据（几千字符）浪费大量token
        - 保留图片的语义信息（通过alt文本和数量统计）
        - 让AI能高效理解文档结构，而不被无意义的base64数据干扰

        Args:
            html_content: mammoth转换产生的HTML内容（包含<img>标签和base64数据）
            markdown_content: html2text转换后的markdown（已设置ignore_images=True忽略图片）

        Returns:
            优化后的markdown内容：包含图片摘要和占位符，无base64数据
        """
        import re

        # 从HTML中找到所有<img>标签，提取alt属性文本
        # 正则说明：匹配<img...alt="文本"...>，提取alt值作为图片描述
        img_pattern = r'<img[^>]*?(?:alt=["\']([^"\']*)["\'])?[^>]*?/?>'
        images = re.findall(img_pattern, html_content, re.IGNORECASE)

        # 统计图片总数（包括没有alt属性的图片）
        image_count = len(re.findall(r'<img[^>]*?/?>', html_content, re.IGNORECASE))

        if image_count > 0:
            # 在文档开头添加图片数量摘要
            image_summary = f"\n> **文档包含 {image_count} 张图片** (已省略显示以节省空间)\n\n"

            enhanced_content = markdown_content

            # 为有alt描述的图片添加占位符
            for i, alt_text in enumerate(images):
                if alt_text and alt_text.strip():
                    placeholder = f"\n[图片 {i+1}: {alt_text.strip()}]\n"
                    # 尝试上下文插入，失败则追加到末尾
                    if not self._try_insert_contextually(enhanced_content, placeholder, alt_text):
                        enhanced_content += placeholder

            # 为没有alt描述的图片添加通用占位符
            remaining_images = image_count - len([alt for alt in images if alt and alt.strip()])
            if remaining_images > 0:
                for i in range(remaining_images):
                    enhanced_content += f"\n[图片 {len(images) + i + 1}: 无描述文本]\n"

            # 返回：图片摘要 + 原文本内容 + 图片占位符
            return image_summary + enhanced_content

        return markdown_content

    def _try_insert_contextually(self, content: str, placeholder: str, alt_text: str) -> bool:
        """尝试将图片占位符插入到相关文本上下文附近

        目前是简单实现，总是返回False让占位符追加到末尾。
        未来可以实现更智能的定位逻辑。

        Args:
            content: markdown文本内容
            placeholder: 图片占位符文本
            alt_text: 图片的alt描述文本

        Returns:
            bool: 是否成功插入（当前总是False）
        """
        # 简单启发式：查找alt文本在内容中的位置
        alt_words = alt_text.lower().split()[:3]  # 取前几个词

        for word in alt_words:
            if len(word) > 3 and word in content.lower():
                # 找到相关上下文，但为简单起见，暂时仍追加到末尾
                # 更复杂的定位逻辑可以后续实现
                return False

        return False

    def _save_to_cache(self, source_file: Path, content: str):
        """Save converted content to cache"""
        try:
            cache_path = self._get_cache_path(source_file)
            cache_path.write_text(content, encoding='utf-8')

            # Set cache file timestamp to current time
            current_time = time.time()
            os.utime(cache_path, (current_time, current_time))

            logger.info(f"Cached Word document conversion: {cache_path}")

        except Exception as e:
            logger.warning(f"Cache save failed: {e}")

    def _apply_pagination(self, markdown_content: str, file_name: str, kwargs: dict) -> DocumentConverterResult:
        """Apply pagination logic consistent with other plugins"""
        offset = kwargs.get('offset', 0)
        limit = kwargs.get('limit', None)

        # Split content into lines
        all_lines = markdown_content.split('\n')
        total_lines = len(all_lines)

        # Calculate line range
        start_line = max(0, offset)
        read_limit = DOCX_MAX_LINES if limit is None or limit <= 0 else limit
        end_line = min(total_lines, start_line + read_limit)

        # Extract selected lines
        selected_lines = all_lines[start_line:end_line]

        # Format output
        result_lines = []
        # Remove metadata headers - just return clean content
        result_lines.extend(selected_lines)

        # No pagination notes - keep output clean

        return DocumentConverterResult(
            title=None,
            markdown="\n".join(result_lines)
        )

    def _maybe_cleanup_cache(self):
        """Periodically clean up old cache files"""
        self._conversion_count += 1

        if self._conversion_count % CLEANUP_INTERVAL == 0:
            self._cleanup_old_cache()

    def _cleanup_old_cache(self):
        """Remove cache files older than CACHE_MAX_AGE_DAYS"""
        try:
            from agentlang.paths import PathManager

            cache_dir = PathManager.get_cache_dir() / "docx_conversions"
            if not cache_dir.exists():
                return

            current_time = time.time()
            max_age = CACHE_MAX_AGE_DAYS * 24 * 3600
            cleaned_count = 0

            for cache_file in cache_dir.glob("*.md"):
                try:
                    file_age = current_time - cache_file.stat().st_mtime
                    if file_age > max_age:
                        cache_file.unlink()
                        cleaned_count += 1
                except OSError:
                    continue

            if cleaned_count > 0:
                logger.info(f"Cleaned up {cleaned_count} old DOCX cache files")

        except Exception as e:
            logger.warning(f"Cache cleanup failed: {e}")
