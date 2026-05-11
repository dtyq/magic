"""视频理解 LLM 请求工具：负责构建消息和调用 LLM，支持 URL 失败时 fallback 到 base64。"""

import asyncio
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from agentlang.llms.factory import LLMFactory
from agentlang.llms.processors.processor_config import ProcessorConfig
from agentlang.logger import get_logger
from app.i18n import i18n
from app.tools.media_utils import DISABLE_THINKING_BODY, BatchMediaResolveResults, MediaResolveResult

logger = get_logger(__name__)

# 视频理解系统提示
DEFAULT_SYSTEM_PROMPT = """你是一个专业的视频理解助手，擅长依据用户需求，准确地分析和解释视频内容。
若用户传入了多段视频并要求你给出每段视频的分析结果而非整体分析结果，你需要确保分析结果与每段视频的对应关系清晰明确。
用最少的字表达最多的内容，但不丢失任何细节，尽最大努力提高你回答的信息密度。
当前时间：{current_time}"""

# 各模型视频文件大小上限（MB），key 为模型 ID 前缀（小写），URL 模式和 base64 模式均受此限制
MODEL_VIDEO_SIZE_LIMITS_MB: Dict[str, float] = {
    "doubao": 50.0,    # doubao 系列：最大 50MB
    "qwen": 2048.0,    # qwen 系列：最大 2GB
}

# 匹配视频大小超限错误的正则模式列表
_SIZE_LIMIT_ERROR_PATTERNS = [
    re.compile(r"size of the input video.*exceeds the limit", re.IGNORECASE),
    re.compile(r"413", re.IGNORECASE),
    re.compile(r"Request Entity Too Large", re.IGNORECASE),
    re.compile(r"video.*size.*limit", re.IGNORECASE),
]


def get_model_video_size_limit_mb(model_id: str) -> Optional[float]:
    """根据模型 ID 获取视频文件大小上限（MB）。

    Args:
        model_id: 模型 ID，如 doubao-seed-2.0-mini

    Returns:
        大小上限（MB），未找到对应配置时返回 None
    """
    model_lower = model_id.lower()
    for prefix, limit_mb in MODEL_VIDEO_SIZE_LIMITS_MB.items():
        if model_lower.startswith(prefix):
            return limit_mb
    return None


def is_size_limit_error(exc: Exception) -> bool:
    """判断异常是否为视频文件大小超限错误。

    Args:
        exc: 捕获到的异常

    Returns:
        True 表示是大小超限错误
    """
    msg = str(exc)
    return any(pattern.search(msg) for pattern in _SIZE_LIMIT_ERROR_PATTERNS)


class VideoLLMRequestHandler:
    """视频理解 LLM 请求处理器。"""

    @staticmethod
    def get_system_prompt(current_time: Optional[str] = None) -> str:
        """获取格式化后的系统提示。

        Args:
            current_time: 当前时间字符串，不传时自动生成

        Returns:
            str: 格式化后的系统提示
        """
        if current_time is None:
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return DEFAULT_SYSTEM_PROMPT.format(current_time=current_time)

    @staticmethod
    def build_messages(
        query: str,
        resolved_results: List[MediaResolveResult],
        system_content: str,
    ) -> List[Dict]:
        """构建发送给 LLM 的消息列表。

        Args:
            query: 用户查询文本
            resolved_results: 已解析成功的视频结果列表
            system_content: 系统提示内容

        Returns:
            List[Dict]: 消息列表
        """
        prompt_text = query
        if i18n.is_language_manually_set():
            lang = i18n.get_language_display_name()
            prompt_text = f"{query}\n\nPlease reply in {lang}."

        content: List[Dict] = [{"type": "text", "text": prompt_text}]
        for r in resolved_results:
            content.append({
                "type": "video_url",
                "video_url": {"url": r.resolved_url}
            })

        return [
            {"role": "system", "content": system_content},
            {"role": "user", "content": content},
        ]

    @staticmethod
    async def call_with_fallback(
        model_id: str,
        query: str,
        batch: BatchMediaResolveResults,
        timeout: int = 600,
    ) -> Any:
        """调用 LLM 进行视频理解，URL 失败时 fallback 到 base64 模式。

        策略：
        - 第一次调用：直接传入已解析的 URL（可能是 HTTP URL 或预签名 URL 或 base64）
        - 若失败且存在 HTTP URL：并发下载所有 HTTP URL 视频编码为 base64，再发起第二次调用
        - 两次均失败：抛出第一次的原始异常

        Args:
            model_id: 模型 ID
            query: 用户查询
            batch: 批量视频解析结果
            timeout: LLM 非流式请求超时时间（秒）

        Returns:
            LLM 响应对象
        """
        # 延迟导入避免循环依赖
        from app.tools.video_understanding_utils.video_processor import VideoProcessor

        system_content = VideoLLMRequestHandler.get_system_prompt()
        processor_config = ProcessorConfig(non_stream_timeout_seconds=timeout)
        successful = batch.successful
        first_error: Optional[Exception] = None

        try:
            messages = VideoLLMRequestHandler.build_messages(query, successful, system_content)
            logger.info(f"第一次 LLM 调用，视频数量: {len(successful)}, 超时: {timeout}s")
            return await LLMFactory.call_with_tool_support(
                model_id=model_id,
                messages=messages,
                extra_body=DISABLE_THINKING_BODY,
                processor_config=processor_config,
            )
        except Exception as exc:
            first_error = exc
            logger.warning(f"第一次 LLM 调用失败: {exc}")

        # 大小超限错误直接抛出，不进行 base64 fallback（base64 模式同样会因体积过大被拒绝）
        if first_error is not None and is_size_limit_error(first_error):
            logger.warning("检测到视频文件大小超限错误，跳过 base64 fallback")
            raise first_error

        # 检查是否有可以 fallback 到 base64 的视频
        # - 本地文件（source 非 http）：直接读取本地文件编码，无需下载预签名 URL
        # - HTTP URL 来源：下载远程 URL 编码
        url_results = [
            r for r in successful
            if r.resolved_url and re.match(r'^https?://', r.resolved_url)
        ]
        if not url_results:
            if first_error is not None:
                raise first_error
            raise RuntimeError("第一次 LLM 调用失败但未记录异常")

        logger.info(f"检测到 {len(url_results)} 个视频需要 fallback 到 base64")
        processor = VideoProcessor()
        try:
            fallback_tasks = []
            for r in url_results:
                if re.match(r'^https?://', r.source):
                    # 来源本身就是 HTTP URL，下载远程文件
                    fallback_tasks.append(processor.download_and_encode_base64(r.resolved_url, timeout))
                else:
                    # 来源是本地文件，直接读取本地文件编码，避免下载预签名 URL
                    logger.info(f"本地文件 fallback 到 base64: {r.source}")
                    fallback_tasks.append(processor.local_file_to_base64(r.source))
            b64_urls = await asyncio.gather(*fallback_tasks)

            url_set = {r.resolved_url for r in url_results}
            fallback_results: List[MediaResolveResult] = []
            url_iter = iter(b64_urls)
            for r in successful:
                if r.resolved_url in url_set:
                    fallback_results.append(
                        MediaResolveResult(source=r.source, resolved_url=next(url_iter))
                    )
                else:
                    fallback_results.append(r)

            messages = VideoLLMRequestHandler.build_messages(query, fallback_results, system_content)
            logger.info(f"第二次 LLM 调用（base64 模式），视频数量: {len(fallback_results)}, 超时: {timeout}s")
            return await LLMFactory.call_with_tool_support(
                model_id=model_id,
                messages=messages,
                extra_body=DISABLE_THINKING_BODY,
                processor_config=processor_config,
            )
        except Exception as b64_error:
            logger.error(f"base64 fallback 也失败: {b64_error}")
            if first_error is not None:
                raise first_error
            raise b64_error
