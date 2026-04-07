"""Webview共享工具模块

统一处理所有网页内容相关的重复逻辑，包括：
- 参数验证和模型
- 文件保存和管理
- 内容净化和总结
- 智能文件名生成
"""

import asyncio
import os
import datetime
import re
import random
import string
from pathlib import Path
from typing import Dict, Optional, Literal, Union
from urllib.parse import urlparse, quote

import aiofiles
from pydantic import BaseModel, Field, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.utils.file import generate_safe_filename_with_timestamp
from agentlang.llms.factory import LLMFactory
from app.path_manager import PathManager

logger = get_logger(__name__)

# ====================
# 常量定义
# ====================

# NOTE: The following directory constants are preserved for potential future use.
# Currently, webpage content is no longer saved to .webview-reports directory.
MARKDOWN_RECORDS_DIR_NAME = ".webview-reports"
MARKDOWN_RECORDS_DIR = PathManager.get_workspace_dir() / MARKDOWN_RECORDS_DIR_NAME

# 搜索引擎 Referer 配置（用于人类行为模拟）
SEARCH_ENGINE_REFERERS = [
    "google",
    "bing",
    "baidu",
]

# 模拟人类行为的完整 HTTP 头部配置（网页访问）
HUMAN_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Sec-Ch-Ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
}

# 专用于图片下载的 HTTP 头部配置
IMAGE_DOWNLOAD_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Sec-Ch-Ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
    'Sec-Fetch-Dest': 'image',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'cross-site',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
}

# Referer 缓存，避免同一域名频繁变化
_referer_cache: Dict[str, str] = {}

# ====================
# 共享参数模型
# ====================

class WebviewContentParams(BaseModel):
    """统一的网页内容处理参数"""
    scope: Literal["viewport", "all"] = Field("viewport", description="内容范围: viewport (当前视口) 或 all (整个页面)")
    purify: Union[bool, str] = Field(True, description="是否净化网页内容以及使用的标准。False: 不净化；True: 使用通用标准净化；字符串: 使用该字符串作为自定义净化标准。净化会尝试移除广告、导航等无关信息，但可能误删部分有效内容。推荐在提取文章/新闻正文时使用。")
    summarize: bool = Field(False, description="是否开启总结模式，自动读取整个页面内容并总结，损失一定的信息但极大提升信息阅读效率。注意：无法在viewport模式下使用，且启用后purify会自动关闭")

    @model_validator(mode='after')
    def validate_summarize_mode(self):
        if self.summarize:
            if self.scope == "viewport":
                raise ValueError("总结模式不支持视口模式，请使用scope='all'")
            # 总结模式下强制关闭purify并设置scope为all
            self.purify = False
            self.scope = "all"
        return self

# ====================
# 人类行为模拟
# ====================

def _generate_random_hex(length: int = 16) -> str:
    """生成随机十六进制字符串"""
    return ''.join(random.choices('0123456789abcdef', k=length))

def _generate_random_base64_like(length: int = 20) -> str:
    """生成类似base64的随机字符串"""
    chars = string.ascii_letters + string.digits + '+/'
    return ''.join(random.choices(chars, k=length))

def _generate_baidu_url(keyword: str) -> str:
    """生成真实的百度搜索URL"""
    encoded_keyword = quote(keyword)

    # 生成随机参数
    rsv_pq = "0x" + _generate_random_hex(16)
    rsv_t = _generate_random_base64_like(50) + "%2B" + _generate_random_base64_like(20)
    input_time = str(random.randint(200, 2000))
    rsv_sug4 = str(random.randint(200, 2000))
    rsv_bp = random.choice([1, 2])
    rsv_idx = random.choice([1, 2, 3])
    fenlei = random.choice([256, 512, 1024])
    rsv_sug3 = random.randint(1, 10)
    rsv_sug1 = random.randint(1, 5)
    rsv_sug7 = random.choice([100, 200, 300])
    rsp = random.randint(1, 15)

    url = (f"https://www.baidu.com/s?ie=utf-8&f=8&rsv_bp={rsv_bp}&rsv_idx={rsv_idx}&"
           f"tn=baidu&wd={encoded_keyword}&fenlei={fenlei}&rsv_pq={rsv_pq}&"
           f"rsv_t={rsv_t}&rqlang=en&rsv_dl=tb&rsv_enter=1&"
           f"rsv_sug3={rsv_sug3}&rsv_sug1={rsv_sug1}&rsv_sug7={rsv_sug7}&rsv_sug2=0&"
           f"rsv_btype=i&prefixsug={encoded_keyword}&rsp={rsp}&inputT={input_time}&rsv_sug4={rsv_sug4}")
    return url

def _generate_google_url(keyword: str) -> str:
    """生成真实的Google搜索URL"""
    encoded_keyword = quote(keyword)

    # 生成随机参数
    gs_lcrp = _generate_random_base64_like(80)

    url = (f"https://www.google.com/search?q={encoded_keyword}&oq={encoded_keyword}&"
           f"gs_lcrp={gs_lcrp}&sourceid=chrome&ie=UTF-8")
    return url

def _generate_bing_url(keyword: str) -> str:
    """生成真实的Bing搜索URL"""
    encoded_keyword = quote(keyword)

    # 生成随机参数
    cvid = _generate_random_hex(32).upper()
    sp = random.choice([-1, 0, 1])
    sc_num1 = random.randint(10, 20)
    sc_num2 = random.randint(1, 10)
    sc = f"{sc_num1}-{sc_num2}"
    form_types = ["BESBTB", "BESTHA", "BESTHP", "QBLH"]
    form = random.choice(form_types)

    url = (f"https://www.bing.com/search?q={encoded_keyword}&FORM={form}&sp={sp}&"
           f"lq=0&pq={encoded_keyword}&sc={sc}&qs=n&sk=&cvid={cvid}&ensearch=1")
    return url

def _generate_realistic_search_url(engine: str, keyword: str) -> str:
    """根据搜索引擎类型生成真实的搜索URL"""
    if engine == "baidu":
        return _generate_baidu_url(keyword)
    elif engine == "google":
        return _generate_google_url(keyword)
    elif engine == "bing":
        return _generate_bing_url(keyword)
    else:
        # 默认回退到Google
        return _generate_google_url(keyword)

def _extract_search_keyword_from_domain(domain: str) -> str:
    """从域名中提取自然的搜索关键词

    Args:
        domain: 域名 (如 news.bbc.com, www.github.com)

    Returns:
        str: 搜索关键词 (如 'bbc', 'github')
    """
    try:
        # 移除 www. 前缀
        if domain.startswith('www.'):
            domain = domain[4:]

        # 分割域名部分
        parts = domain.split('.')
        if len(parts) < 2:
            return domain  # 如果格式不对，直接返回

        # 获取主域名（去掉.com, .org等后缀）
        main_domain = parts[-2]  # 倒数第二部分通常是主域名
        return main_domain

    except Exception as e:
        logger.warning(f"提取搜索关键词失败: {e}, 使用原域名")
        return domain

def generate_search_engine_referer(target_url: str) -> str:
    """根据目标URL生成搜索引擎 referer，模拟人类搜索行为

    Args:
        target_url: 目标网站URL

    Returns:
        str: 生成的搜索引擎 referer URL
    """
    try:
        # 解析目标URL获取域名
        parsed_url = urlparse(target_url)
        domain = parsed_url.netloc

        if not domain:
            domain = target_url  # 如果解析失败，使用原URL

        # 检查缓存，同一域名在短时间内使用相同的referer
        if domain in _referer_cache:
            cached_referer = _referer_cache[domain]
            logger.debug(f"使用缓存的referer: {domain} -> {cached_referer}")
            return cached_referer

        # 从域名提取自然的搜索关键词
        search_keyword = _extract_search_keyword_from_domain(domain)

        # 随机选择一个搜索引擎
        search_engine = random.choice(SEARCH_ENGINE_REFERERS)

        # 生成真实的搜索引擎URL
        referer = _generate_realistic_search_url(search_engine, search_keyword)

        # 缓存结果（简单的LRU，限制缓存大小）
        if len(_referer_cache) >= 100:
            # 清理一半缓存
            keys_to_remove = list(_referer_cache.keys())[:50]
            for key in keys_to_remove:
                del _referer_cache[key]

        _referer_cache[domain] = referer
        logger.info(f"生成{search_engine}搜索referer: {domain} -> 关键词: '{search_keyword}'")
        logger.debug(f"完整referer URL: {referer}")
        return referer

    except Exception as e:
        logger.warning(f"生成referer时发生错误: {e}, 使用默认Google搜索")
        return _generate_google_url("search")

async def goto_external_website_with_referer(browser, url: str, page_id: Optional[str] = None, wait_until: str = "domcontentloaded"):
    """访问外部网站并设置搜索引擎 referer，模拟人类浏览行为

    Args:
        browser: MagicBrowser 实例
        url: 目标网站URL
        page_id: 页面ID，如果为None则创建新页面
        wait_until: 等待页面加载状态

    Returns:
        MagicBrowserResult: 导航结果
    """
    try:
        # 生成智能 referer
        referer = generate_search_engine_referer(url)

        # 获取或创建页面
        if page_id is None:
            # 创建新页面
            page_id = await browser.new_page()

        # 获取页面对象
        page = await browser.get_page_by_id(page_id)
        if not page:
            logger.error(f"无法获取页面: {page_id}")
            return await browser.goto(page_id, url, wait_until)

        # 设置 referer 头
        await page.set_extra_http_headers({"Referer": referer})
        logger.info(f"已为页面 {page_id} 设置referer: {referer}")

        # 执行导航
        result = await browser.goto(page_id, url, wait_until)
        return result

    except Exception as e:
        logger.warning(f"设置人类行为模拟失败，回退到普通导航: {e}")
        # 如果设置referer失败，回退到普通导航
        return await browser.goto(page_id, url, wait_until)

# ====================
# 文件管理（保留用于未来可能的其他用途）
# ====================
# NOTE: The following file management functions are preserved for potential future use.
# Currently, webpage content is no longer saved to disk (removed to improve performance
# as 99.9% of saved files were never used in practice).

async def get_or_create_markdown_records_dir() -> Path:
    """确保markdown记录目录存在并返回该目录路径

    Returns:
        Path: markdown记录目录的路径
    """
    # 使用异步方式创建目录
    await asyncio.to_thread(MARKDOWN_RECORDS_DIR.mkdir, exist_ok=True)
    return MARKDOWN_RECORDS_DIR

async def async_write_file(file_path: Path, content: str, encoding: str = "utf-8") -> None:
    """异步写入文件内容

    Args:
        file_path: 文件路径
        content: 要写入的内容
        encoding: 文件编码
    """
    try:
        async with aiofiles.open(file_path, "w", encoding=encoding) as f:
            await f.write(content)
        logger.debug(f"异步写入文件成功: {file_path}")
    except Exception as e:
        logger.error(f"异步写入文件失败 {file_path}: {e}")
        raise

def add_markdown_metadata(content: str, title: str, url: str, scope: str, current_screen: Optional[int] = None, summary: Optional[str] = None, agent_name: str = "超级麦吉") -> str:
    """向Markdown内容添加元数据头

    Args:
        content: 原始Markdown内容
        title: 网页标题
        url: 网页URL
        scope: 读取范围 ('viewport' 或 'all')
        current_screen: 当前屏幕编号 (仅当 scope 为 'viewport' 时有效)
        summary: 网页内容摘要 (可选)
        agent_name: Agent 名称 (可选，默认为"超级麦吉")

    Returns:
        str: 添加了元数据头的Markdown内容
    """
    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # 构建元数据头，摘要部分设为可选
    header_lines = [
        f"# {title}",
        "",
        f"> 此 Markdown 文件由{agent_name}从网页内容转换生成",
        f"> 转换时间: {now}",
        f"> 网页链接: [{url}]({url})",
        f"> 内容范围: {scope}{f' (第 {current_screen} 屏)' if scope == 'viewport' and current_screen is not None else ''}"
    ]
    if summary:  # 仅在提供了摘要时添加摘要行
        header_lines.append(f"> 内容摘要: {summary}")
    header_lines.extend([
        "",
        "## 原始内容",
        ""
    ])

    header = "\n".join(header_lines)
    return header + content

# ====================
# 智能文件名生成（保留用于未来可能的其他用途）
# ====================
# NOTE: Smart filename generation functions are preserved for potential future use.
# Currently not used for webpage content saving (removed to improve performance).

# 智能文件名缓存，避免相同标题生成不同的文件名
_smart_filename_cache: Dict[str, str] = {}

async def generate_smart_filename(title: str, url: str = "") -> str:
    """使用 LLM 生成智能的短文件名

    Args:
        title: 网页标题
        url: 网页URL（可选），用于提取网站名称

    Returns:
        str: 生成的智能文件名（小写英文与减号组成）
    """
    # 检查缓存
    if title in _smart_filename_cache:
        logger.debug(f"使用缓存的智能文件名: '{title}' -> '{_smart_filename_cache[title]}'")
        return _smart_filename_cache[title]

    try:
        # 准备已生成文件名列表，供模型参考避重
        existing_filenames = list(_smart_filename_cache.values())
        existing_info = ""
        if existing_filenames:
            existing_info = f"\n\n已生成的文件名（请避免重复）: {', '.join(existing_filenames[-10:])}"  # 只显示最近10个

        # 准备网站信息
        url_info = ""
        if url:
            url_info = f"\n网页URL: {url}"

        # 构建提示语
        prompt = f"""请将以下网页标题转换为英文文件名，要求：
1. 使用小写英文字母、数字和减号连接
2. 建议3-5个单词长度，体现核心含义
3. 可以根据网站URL添加网站名称后缀（如baidu、sohu等）
4. 避免与已有文件名重复
5. 直接返回文件名，不要解释

网页标题: {title}{url_info}{existing_info}

请生成文件名:"""

        # 构建消息
        messages = [
            {
                "role": "system",
                "content": "你是一个专业的文件名生成助手，擅长将复杂标题转换为简洁易懂的英文文件名。"
            },
            {
                "role": "user",
                "content": prompt
            }
        ]

        # Get model_id from configuration
        from app.core.ai_abilities import AIAbility, get_ability_config
        model_id = get_ability_config(
            AIAbility.SMART_FILENAME,
            "model_id",
            default="deepseek-chat"
        )

        # 请求模型
        response = await LLMFactory.call_with_tool_support(
            model_id=model_id,
            messages=messages,
            tools=None,
            stop=None,
        )

        # 处理响应
        if not response or not response.choices or len(response.choices) == 0:
            logger.warning("LLM 未返回有效响应，使用回退方案")
            return _fallback_filename(title)

        # 获取生成的文件名
        smart_filename = response.choices[0].message.content
        if smart_filename:
            # 简单清理：转小写，基本格式检查
            smart_filename = smart_filename.strip().lower()
            # 保留字母、数字、减号和下划线，将其他字符替换为减号
            smart_filename = re.sub(r'[^a-z0-9_-]', '-', smart_filename)
            # 清理多余的连字符
            smart_filename = re.sub(r'-+', '-', smart_filename).strip('-')

            if smart_filename and len(smart_filename) >= 3:
                # 缓存结果
                _smart_filename_cache[title] = smart_filename
                logger.info(f"生成智能文件名: '{title}' -> '{smart_filename}'")
                return smart_filename

        logger.warning("LLM 生成的文件名格式不符合要求，使用回退方案")
        return _fallback_filename(title)

    except Exception as e:
        logger.warning(f"生成智能文件名时发生异常: {e!s}，使用回退方案")
        return _fallback_filename(title)

def _fallback_filename(title: str) -> str:
    """回退文件名生成方案

    Args:
        title: 原始标题

    Returns:
        str: 回退生成的文件名
    """
    # 简单的回退策略：取标题前几个字符并转换
    fallback = re.sub(r'[^\w\s]', '', title.lower())[:10]
    fallback = re.sub(r'\s+', '-', fallback.strip())
    if not fallback or len(fallback) < 3:
        fallback = "webpage"

    # 缓存回退结果
    _smart_filename_cache[title] = fallback
    logger.info(f"使用回退方案生成文件名: '{title}' -> '{fallback}'")
    return fallback

# ====================
# 内容处理器
# ====================

def _is_anti_crawl_detected(content: str) -> bool:
    """检测内容是否存在反爬特征

    Args:
        content: 网页内容

    Returns:
        bool: True 表示检测到反爬特征，需要使用 API 模式兜底
    """
    if not content:
        return True

    # 1. 检测内容是否异常短（可能是登录页、验证页等）
    if len(content.strip()) < 200:
        logger.warning(f"内容异常短（{len(content)} 字符），可能被反爬")
        return True

    # 2. 检测 summarize.py 返回的"未精炼"特征（表示原文太短）
    if "原文内容已足够简洁，未进行精炼" in content or "原文内容已足够简洁,未进行精炼" in content:
        logger.warning("检测到内容未被精炼（原文过短），可能被反爬")
        return True
    return False


class ProcessedContentResult:
    """内容处理结果"""
    def __init__(self,
                 content: str,
                 title: str,
                 url: str,
                 is_purified: bool = False,
                 purification_criteria: Optional[str] = None,
                 summary: Optional[str] = None,
                 current_screen: Optional[int] = None,
                 is_anti_crawl_detected: bool = False):
        self.content = content
        self.title = title
        self.url = url
        self.is_purified = is_purified
        self.purification_criteria = purification_criteria
        self.summary = summary
        self.current_screen = current_screen
        self.is_anti_crawl_detected = is_anti_crawl_detected

async def process_webview_content(
    content: str,
    title: str,
    url: str,
    params: WebviewContentParams,
    tool_context: Optional[ToolContext] = None,
    current_screen: Optional[int] = None,
    original_content: Optional[str] = None
) -> ProcessedContentResult:
    """统一的网页内容处理函数

    处理流程：参数验证 → 净化 → 总结 → 文件保存 → 返回结果

    Args:
        content: 网页原始内容
        title: 网页标题
        url: 网页URL
        params: 内容处理参数
        tool_context: 工具上下文（用于调用其他工具）
        current_screen: 当前屏幕编号（可选）
        original_content: 原始内容（总结模式下用于保存原文）

    Returns:
        ProcessedContentResult: 处理结果
    """
    processed_content = content
    is_purified = False
    purification_criteria = None
    summary = None

    # 如果没有提供原始内容，则使用当前内容作为原始内容
    if original_content is None:
        original_content = content

    try:
        # 1. 净化处理
        if params.purify is not False and not params.summarize:  # 总结模式下不进行净化
            from app.tools.purify import Purify

            if isinstance(params.purify, str):
                purification_criteria = params.purify
                logger.info(f"请求使用自定义标准净化内容: '{purification_criteria}'")
            else:  # params.purify is True
                logger.info("请求使用通用标准净化内容...")

            try:
                purifier = Purify()
                # 直接调用净化方法
                purified_content = await purifier.purify_content(
                    original_content=processed_content,
                    criteria=purification_criteria,
                )
                if purified_content is not None and purified_content != processed_content:
                    processed_content = purified_content
                    is_purified = True
                    logger.info("内容已净化。")
                else:
                    logger.info("内容无需净化或净化失败/未改变，使用原始内容。")
            except Exception as purify_exc:
                logger.warning(f"净化内容时发生错误: {purify_exc!s}. 将使用原始文本。", exc_info=True)
        else:
            logger.info("跳过内容净化步骤 (purify=False 或为总结模式)。")

        # 2. 总结处理
        if params.summarize:
            from app.tools.summarize import Summarize

            logger.info("开启总结模式，开始对内容进行总结...")
            original_length = len(processed_content)
            target_length = max(min(int(original_length * 0.3), 3000), 1000)
            logger.info(f"原始内容长度: {original_length} 字符，目标总结长度: {target_length} 字符")

            try:
                summarizer = Summarize()
                summarized_content = await summarizer.summarize_content(
                    content=processed_content,
                    title=title,
                    target_length=target_length,
                )

                if summarized_content:
                    processed_content = summarized_content
                    logger.info(f"总结完成，总结后长度: {len(processed_content)} 字符")
                else:
                    logger.warning("总结失败，将使用原始内容")
            except Exception as summarize_e:
                logger.warning(f"总结内容时发生错误: {summarize_e!s}. 将使用原始文本。", exc_info=True)

        # 检测是否存在反爬特征
        is_anti_crawl = _is_anti_crawl_detected(processed_content)

        return ProcessedContentResult(
            content=processed_content,
            title=title,
            url=url,
            is_purified=is_purified,
            purification_criteria=purification_criteria,
            summary=summary,
            current_screen=current_screen,
            is_anti_crawl_detected=is_anti_crawl
        )

    except Exception as e:
        logger.error(f"处理网页内容时发生意外错误: {e!s}", exc_info=True)
        # 返回原始内容作为fallback，同时检测反爬特征
        is_anti_crawl = _is_anti_crawl_detected(content)
        return ProcessedContentResult(
            content=content,
            title=title,
            url=url,
            is_purified=False,
            is_anti_crawl_detected=is_anti_crawl
        )
