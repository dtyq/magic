"""LLM request utilities for visual understanding."""
import re
from pathlib import Path
from typing import List, Dict, Optional, Any
from datetime import datetime
from agentlang.logger import get_logger
from agentlang.llms.factory import LLMFactory
from app.i18n import i18n
from app.utils.async_file_utils import async_exists
from .models import BatchImageProcessingResults, SingleImageResult
from .image_conversion_utils import local_file_to_base64
from .image_format_utils import get_content_type_for_local_file

logger = get_logger(__name__)


# 系统提示模板
DEFAULT_SYSTEM_PROMPT = """你是一个专业的视觉理解助手，擅长依据用户需求，准确地分析和解释图片内容。
若用户传入了多张图片并要求你给出每张图片的分析结果而非整体分析结果，你需要确保分析结果与每张图片的对应关系清晰明确。
用最少的字表达最多的内容，但不丢失任何细节，尽最大努力提高你回答的信息密度。
当前时间：{current_time}"""


class LLMRequestHandler:
    """处理LLM请求的工具类"""

    def __init__(self):
        """初始化LLM请求处理器"""
        pass

    @staticmethod
    def get_system_prompt(current_time: Optional[str] = None) -> str:
        """获取系统提示

        Args:
            current_time: 当前时间字符串，如果不提供则自动生成

        Returns:
            格式化后的系统提示
        """
        if current_time is None:
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        return DEFAULT_SYSTEM_PROMPT.format(current_time=current_time)

    @staticmethod
    async def build_messages(
        user_prompt: str,
        batch_results: BatchImageProcessingResults,
        use_base64: bool = False
    ) -> List[Dict]:
        """构建LLM消息

        Args:
            user_prompt: 用户提示文本
            batch_results: 批量图片处理结果
            use_base64: 是否使用base64模式（用于fallback）

        Returns:
            消息列表
        """
        # 自动获取系统提示（包含当前时间）
        system_content = LLMRequestHandler.get_system_prompt()

        # 构建用户消息内容，语言已设置时追加语言要求
        prompt_text = user_prompt
        if i18n.is_language_manually_set():
            lang = i18n.get_language_display_name()
            prompt_text = f"{user_prompt}\n\nPlease reply in {lang}."
        content = [{"type": "text", "text": prompt_text}]

        # 添加图片内容（只添加成功的图片）
        for result in batch_results.successful_results:
            if result.image_data:
                if use_base64:
                    # 使用 image_conversion_utils 中的函数转换为base64
                    image_url = await LLMRequestHandler._convert_to_base64_async(result)
                else:
                    # 使用原始URL
                    image_url = result.image_data.url

                content.append({
                    "type": "image_url",
                    "image_url": {"url": image_url}
                })

        # 构建消息列表
        messages = [
            {
                "role": "system",
                "content": system_content
            },
            {
                "role": "user",
                "content": content
            }
        ]

        return messages

    @staticmethod
    async def call_with_fallback(
        model_id: str,
        user_prompt: str,
        batch_results: BatchImageProcessingResults
    ) -> Any:
        """调用LLM，支持URL失败时回退到base64模式

        Args:
            model_id: 模型ID
            user_prompt: 用户提示文本
            batch_results: 批量图片处理结果

        Returns:
            LLM响应结果
        """
        # 构建消息（内部自动生成系统提示）
        messages = await LLMRequestHandler.build_messages(
            user_prompt,
            batch_results,
            use_base64=False
        )

        try:
            # 第一次尝试：使用当前模式（可能包含URL）
            logger.info(f"第一次尝试LLM调用")
            response = await LLMFactory.call_with_tool_support(
                model_id=model_id,
                messages=messages,
            )
            return response

        except Exception as llm_error:
            # 记录具体的 LLM 调用错误
            logger.warning(f"LLM 第一次调用失败 (模型: {model_id}): {llm_error}")

            # 检查是否有URL模式的图片可以回退
            # 通过 image_data.url 是否以 http 开头判断
            url_images = [
                r for r in batch_results.successful_results
                if r.image_data and r.image_data.url.startswith('http')
            ]

            if url_images:
                logger.info(f"检测到{len(url_images)}张URL模式图片，尝试回退到base64模式")

                try:
                    # 回退到base64模式：重新构建消息
                    fallback_messages = await LLMRequestHandler.build_messages(
                        user_prompt,
                        batch_results,
                        use_base64=True
                    )

                    logger.info(f"第二次尝试LLM调用，使用base64模式")
                    response = await LLMFactory.call_with_tool_support(
                        model_id=model_id,
                        messages=fallback_messages,
                    )
                    return response

                except Exception as fallback_error:
                    logger.error(f"base64模式回退也失败: {fallback_error}")
                    raise fallback_error
            else:
                # 没有URL模式图片可回退，直接抛出原始错误
                raise llm_error

    @staticmethod
    async def _convert_to_base64_async(result: SingleImageResult) -> str:
        """转换图片为base64（用于消息构建）

        使用 image_conversion_utils 中的 local_file_to_base64 函数

        Args:
            result: 单个图片处理结果

        Returns:
            base64编码的URL或原始URL
        """
        try:
            # 获取原始图片路径
            # 优先使用 copied_file_info.original_path，其次使用 result.source
            original_path = None
            if result.copied_file_info:
                original_path = result.copied_file_info.original_path
            elif result.source:
                # 对于工作区内不需要复制的文件，使用 source 作为路径
                # 检查是否为本地文件路径（非 URL）
                if not re.match(r'^https?://', result.source):
                    # 转换为绝对路径（处理相对路径的情况）
                    original_path = str(Path(result.source).resolve())
                    logger.debug(f"使用 result.source 作为原始路径: {result.source} -> {original_path}")

            if original_path and await async_exists(original_path):
                # 获取 content_type（从文件内容检测）
                content_type = await get_content_type_for_local_file(original_path)

                # 使用 image_conversion_utils 中的函数转换
                base64_url = await local_file_to_base64(original_path, content_type, compress_threshold_mb=3.0)
                logger.info(f"成功将图片转换为base64: {original_path}")
                return base64_url
            else:
                # 无法获取文件路径，Base64 转换失败
                error_msg = f"无法获取图片路径或文件不存在: original_path={original_path}, source={result.source}, copied_file_info={result.copied_file_info is not None}"
                logger.error(error_msg)
                raise ValueError(error_msg)

        except ValueError:
            # 重新抛出 ValueError（文件不存在等）
            raise
        except Exception as e:
            # 其他异常也抛出，不要返回原始 URL
            logger.error(f"转换图片到base64失败: {e}")
            raise RuntimeError(f"Base64转换失败: {str(e)}") from e
