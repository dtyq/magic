import aiofiles
from pathlib import Path
import io # 导入 io 模块
from markitdown import MarkItDown, StreamInfo
from app.tools.markitdown_plugins.pymupdf_plugin import PyMuPDFConverter
from agentlang.logger import get_logger

logger = get_logger(__name__)

# Initialize MarkItDown instance here to reuse it
md = MarkItDown()
md.register_converter(PyMuPDFConverter()) # Register PyMuPDF converter for this util

async def convert_pdf_locally(pdf_path: Path) -> str | None:
    """
    使用 MarkItDown 将本地 PDF 文件转换为 Markdown 文本。

    不再负责文件写入。

    Args:
        pdf_path: 指向源 PDF 文件的 Path 对象。

    Returns:
        转换后的 Markdown 文本字符串，如果转换失败则返回 None。
    """
    logger.info(f"开始本地 PDF 到文本转换: {pdf_path}")

    try:
        # 1. 异步读取整个 PDF 文件内容到内存
        async with aiofiles.open(pdf_path, "rb") as f:
            pdf_content_bytes = await f.read()

        # 2. 将内存中的 bytes 包装成 BytesIO 对象
        pdf_stream = io.BytesIO(pdf_content_bytes)

        # 3. 将 BytesIO 对象传递给 MarkItDown 进行转换
        # MarkItDown/Magika 需要同步的 BinaryIO
        result = md.convert(
            pdf_stream,
            stream_info=StreamInfo(extension='.pdf', mimetype='application/pdf'),
            offset=0,
            limit=-1
        )

        if not result or not result.markdown:
            logger.error(f"本地 PDF 转换失败（MarkItDown 未返回内容）: {pdf_path}")
            return None

        logger.info(f"本地 PDF 到文本转换成功: {pdf_path}")
        return result.markdown # 直接返回文本内容

    except FileNotFoundError:
        logger.error(f"本地 PDF 到文本转换失败：源文件未找到 {pdf_path}")
        return None
    except Exception as e:
        logger.exception(f"本地 PDF 到文本转换过程中发生意外错误 ({pdf_path}): {e!s}")
        return None

# Ensure the directory exists for the module if needed
# (usually handled by Python's import system, but good practice if creating dynamically)
# Example: Path(__file__).parent.mkdir(parents=True, exist_ok=True)
