"""网页抓取内容处理工具集

负责：噪音清理（base64/Data URI）、反爬检测、按需提炼
"""

import re
from typing import Optional, Tuple

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from app.tools.webview_utils import WebviewContentParams, process_webview_content

logger = get_logger(__name__)

# Base64 检测阈值（超过这个长度的连续字母数字字符串被认为是 base64）
BASE64_DETECTION_THRESHOLD = 1000


def clean_noise_content(content: str, url: str) -> str:
    """检测并清理内容中的噪音数据（base64、Data URI 等）

    Args:
        content: 待检测的内容
        url: 原始 URL（用于判断文件类型）

    Returns:
        str: 处理后的内容，噪音数据已替换为友好提示
    """
    if not content or len(content) < BASE64_DETECTION_THRESHOLD:
        return content

    # 检测 Data URI（需要先检测，因为包含 base64）
    data_uri_pattern = r'data:(image|application|audio|video)/([^;,]+);base64,([A-Za-z0-9+/=]{500,})'

    # 检测 PDF base64 特征（以 JVBERi 开头，这是 "%PDF-" 的 base64 编码）
    pdf_pattern = r'JVBERi[0-9a-zA-Z+/=]{100,}'

    # 检测通用 base64 特征（长串连续的字母数字加上 +/= 字符）
    general_base64_pattern = r'[A-Za-z0-9+/]{1000,}={0,2}'

    # 判断文件类型
    is_pdf = url.lower().endswith('.pdf')

    def replace_data_uri(match):
        mime_type = match.group(1)
        sub_type = match.group(2)
        base64_data = match.group(3)
        size_kb = len(base64_data) / 1024
        logger.info(f"检测到并替换了 Data URI: URL={url}, 类型={mime_type}/{sub_type}, 大小={size_kb:.1f}KB")
        return f"**[内嵌 {mime_type.upper()}/{sub_type.upper()} 文件，约 {size_kb:.1f} KB，已省略]**"

    def replace_base64(match):
        matched_text = match.group(0)
        size_kb = len(matched_text) / 1024

        if is_pdf:
            replacement = f"\n\n---\n\n⚠️ **检测到大型 PDF 文件内容** (约 {size_kb:.1f} KB)\n\n"
            replacement += "此 URL 指向一个 PDF 文件，但返回了 base64 编码的原始数据。\n\n"
            replacement += "**建议操作**：\n"
            replacement += "1. 先使用 `download_from_url` 工具下载 PDF 文件到本地\n"
            replacement += "2. 然后使用 `convert_to_markdown` 工具转换为 Markdown：\n"
            replacement += "   ```\n"
            replacement += "   {\n"
            replacement += '     "input_path": "downloads/your-file.pdf",\n'
            replacement += '     "output_path": "converted/your-file.md"\n'
            replacement += "   }\n"
            replacement += "   ```\n\n"
            replacement += "原始 base64 数据过大，已省略显示。\n\n---\n\n"
        else:
            replacement = f"\n\n---\n\n⚠️ **检测到 Base64 编码内容** (约 {size_kb:.1f} KB)\n\n"
            replacement += "此内容包含大量 base64 编码数据（可能是嵌入的图片或其他二进制文件）。\n\n"
            replacement += "为避免传输大量无意义数据，已省略显示。如需处理此文件，请考虑：\n"
            replacement += "1. 使用 `download_from_url` 工具先下载文件到本地\n"
            replacement += "2. 使用 `convert_to_markdown` 工具处理已下载的文件\n\n---\n\n"

        logger.info(f"检测到并替换了 base64 内容: URL={url}, 大小={size_kb:.1f}KB, 类型={'PDF' if is_pdf else '未知'}")
        return replacement

    # 1. 先检测并替换 Data URI（最具体的模式）
    data_uri_matches = list(re.finditer(data_uri_pattern, content))
    if data_uri_matches:
        logger.warning(f"检测到 {len(data_uri_matches)} 个 Data URI: {url}")
        content = re.sub(data_uri_pattern, replace_data_uri, content)

    # 2. 检测 PDF 特征
    if re.search(pdf_pattern, content):
        logger.warning(f"检测到 PDF base64 内容: {url}")
        content = re.sub(pdf_pattern, replace_base64, content)

    # 3. 再检测通用 base64 特征
    matches = list(re.finditer(general_base64_pattern, content))
    if matches:
        logger.warning(f"检测到 {len(matches)} 个大型 base64 片段: {url}")
        content = re.sub(general_base64_pattern, replace_base64, content)

    return content


async def detect_anti_crawl(
    content: str,
    title: str,
    url: str,
    tool_context: Optional[ToolContext] = None
) -> Tuple[str, bool]:
    """通过 LLM 处理检测内容是否存在反爬特征

    Args:
        content: 网页内容
        title: 网页标题
        url: 网页 URL
        tool_context: 工具上下文

    Returns:
        Tuple[str, bool]: (处理后的内容, 是否检测到反爬)
    """
    base_params = WebviewContentParams(scope="all", purify=False, summarize=False)
    base_processed = await process_webview_content(
        content=content,
        title=title,
        url=url,
        params=base_params,
        tool_context=tool_context,
        original_content=content
    )
    return base_processed.content, base_processed.is_anti_crawl_detected


async def process_content_by_requirements(
    content: str,
    title: str,
    url: str,
    requirements: str,
    tool_context: Optional[ToolContext] = None
) -> Tuple[str, bool]:
    """根据 requirements 处理内容，同时检测反爬特征。

    规则：
    - requirements 为空：返回原文 + 反爬检测结果
    - requirements 非空：按 requirements 提炼 + 反爬检测结果

    Returns:
        Tuple[str, bool]: (处理后的内容, 是否检测到反爬)
    """
    processed_content, is_anti_crawl = await detect_anti_crawl(
        content=content,
        title=title,
        url=url,
        tool_context=tool_context
    )

    clean_requirements = requirements.strip()
    if not clean_requirements:
        return processed_content, is_anti_crawl

    from app.tools.summarize import Summarize

    enhanced_requirements = (
        "请仅围绕以下需求提炼信息，保持高信息密度，用最少的字表达最多的内容，在有限字数内确保需求相关关键信息完整不遗漏：\n"
        "若原文存在可能与需求相关的图片，请保留图片（使用 Markdown 图片语法），由你自行判断并保留可能相关的图片。\n"
        f"{clean_requirements}"
    )

    try:
        summarized_content = await Summarize().summarize_content(
            content=processed_content,
            title=title,
            requirements=enhanced_requirements,
            target_length=1000,
        )
        if summarized_content:
            return summarized_content, is_anti_crawl
        logger.warning(f"按要求提炼失败，回退原文: {url}")
        return processed_content, is_anti_crawl
    except Exception as e:
        logger.warning(f"按要求提炼出错，回退原文: {url}, 错误: {e}")
        return processed_content, is_anti_crawl
