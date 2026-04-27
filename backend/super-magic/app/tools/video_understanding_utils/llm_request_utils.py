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

        try:
            messages = VideoLLMRequestHandler.build_messages(query, successful, system_content)
            logger.info(f"第一次 LLM 调用，视频数量: {len(successful)}, 超时: {timeout}s")
            return await LLMFactory.call_with_tool_support(
                model_id=model_id,
                messages=messages,
                extra_body=DISABLE_THINKING_BODY,
                processor_config=processor_config,
            )
        except Exception as first_error:
            logger.warning(f"第一次 LLM 调用失败: {first_error}")

        # 检查是否有 HTTP URL 可以 fallback 到 base64
        url_results = [
            r for r in successful
            if r.resolved_url and re.match(r'^https?://', r.resolved_url)
        ]
        if not url_results:
            raise first_error

        logger.info(f"检测到 {len(url_results)} 个 HTTP URL 视频，尝试下载并编码为 base64")
        processor = VideoProcessor()
        try:
            fallback_tasks = [
                processor.download_and_encode_base64(r.resolved_url, timeout)
                for r in url_results
            ]
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
            raise first_error
