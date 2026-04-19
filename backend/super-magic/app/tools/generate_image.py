"""
图片生成和编辑工具
该模块提供文本到图片生成和图片编辑功能。
模型通过 GenerateImageParams 的 model 参数指定，不再从环境变量读取。
生成/编辑的图片将保存到 .workspace/generate_image 或 .workspace/edited_image 目录，并可在前端预览。

支持的模型响应格式：
- Magic-service API（新格式）：{"created": ..., "data": [{"url": "...", "size": "..."}], "usage": {...}, "provider": "..."}
- Magic-service API（旧格式）：[{"success": true, "data": {...}}]
- Gemini 模型：imageData 字段
- Qwen 模型：output.results 或 output.choices 结构
- Doubao 模型：data.data 数组，包含 url 字段（例如：doubao-seedream-4-0-250828）
- VolcEngine 模型：data.image_urls 数组
"""

import json
import os
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import aiofiles
import aiohttp
import httpx
from pydantic import Field

from agentlang.config.config import config
from agentlang.config.dynamic_config import dynamic_config
from agentlang.context.tool_context import ToolContext
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from agentlang.path_manager import PathManager
from agentlang.tools.tool_result import ToolResult
from agentlang.utils.file import generate_safe_filename
from agentlang.utils.metadata import MetadataUtil
from agentlang.utils.retry import retry_with_exponential_backoff
from app.core.context.agent_context import AgentContext
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.core.entity.tool.tool_result_types import ImageToolResult
from app.i18n import i18n
from app.service.media_generation_service import (
    AI_IMAGE_GENERATION_SOURCE,
    generate_presigned_url_for_file,
    notify_generated_media_file,
)
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.visual_understanding_utils.image_compress_utils import compress_if_needed
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_exists, async_mkdir, async_stat, async_unlink
from app.utils.credential_utils import sanitize_headers

logger = get_logger(__name__)


class GenerateImageParams(BaseToolParams):
    prompt: str = Field(
        ...,
        description="""<!--zh: 图片生成/编辑提示词。应包含主体、风格、构图、光线、色调等细节，描述越具体生成质量越高。禁止包含色情、暴力、种族歧视等风险内容。-->
Image generation/editing prompt. Include subject, style, composition, lighting, and color tone. More specific prompts produce better results. Prohibited: pornography, violence, racism.""",
    )
    mode: str = Field(
        ...,
        description="""<!--zh
操作模式：
- generate：从文本描述生成新图片；提供 image_paths 时，以其为风格/内容参考生成新图
- edit：直接对 image_paths 中的图片进行像素级修改（必须提供 image_paths）
选择依据："以这张图为参考生成" → generate + image_paths；"修改/编辑这张图" → edit + image_paths
-->
Operation mode:
- generate: Create new images from text; with image_paths, uses them as style/content reference
- edit: Directly modify images in image_paths at pixel level (image_paths required)
Decision: "generate based on this image" → generate + image_paths; "modify/edit this image" → edit + image_paths""",
    )
    image_count: int = Field(
        1,
        description="""<!--zh: 生成图片数量（仅 generate 模式），默认 1，最大 4。用户需要多张或一组图时设为 4。-->
Number of images to generate (generate mode only). Default 1, max 4. Set to 4 when user requests multiple or a set of images.""",
    )
    size: str = Field(
        "2048x2048",
        description="""<!--zh: 图片尺寸。支持两种格式（不可同时用）：WxH（如 '2048x2048'、'2560x1440'、'1440x2560'、'2304x1728'、'1728x2304'）或宽高比（如 '1:1'、'16:9'、'9:16'、'4:3'、'3:2'）。编辑模式时应与原图尺寸保持一致。-->
Image dimensions. Two formats supported (not both): WxH (e.g. '2048x2048', '2560x1440', '1440x2560', '2304x1728', '1728x2304') or aspect ratio (e.g. '1:1', '16:9', '9:16', '4:3', '3:2'). In edit mode, match the source image dimensions.""",
    )
    image_name: str = Field(
        "",
        description="""<!--zh: 文件名，根据用户语言命名：中文用户用中文（如 '可爱小猫'），英文用户用英文（如 'cute_cat'）。3-5 词，下划线连接，避免 / \\ : * ? ' < > | 字符。-->
Filename based on user's language: Chinese users use Chinese (e.g. '可爱小猫'), English users use English (e.g. 'cute_cat'). 3-5 words, underscore-connected. Avoid / \\ : * ? ' < > | characters.""",
    )
    output_path: str = Field(
        "",
        description="""<!--zh: 保存目录，留空则自动确定。中文用户用中文路径（如 '图片目录'），否则用英文（如 'images'）。-->
Save directory. Auto-determined when empty. Chinese users use Chinese path (e.g. '图片目录'), otherwise use English (e.g. 'images').""",
    )
    image_paths: List[str] = Field(
        default_factory=list,
        description="""<!--zh: 参考图或待编辑图片的工作区相对路径列表（如 ['uploads/image.png']）。generate 模式下作为风格/内容参考；edit 模式下作为待修改原图（必须提供）。用户上传了图片且需要参考时必须传入。-->
Workspace-relative paths of reference or source images (e.g. ['uploads/image.png']). In generate mode: style/content reference. In edit mode: source images to modify (required). Must provide when the user has uploaded images to build upon.""",
    )
    override: bool = Field(
        False,
        description="""<!--zh: 是否覆盖现有文件-->
Whether to override existing files""",
    )
    model: str = Field(
        "",
        description="""<!--zh
用户指定时使用指定模型；未指定时默认使用 doubao-seedream-4-0-250828。
可用模型：
- doubao-seedream-4-0-250828（默认，中文文字渲染最佳，支持生成和编辑）
- qwen-image（文本生成图片）
- qwen-image-edit（图片编辑）
- high_aes_general_v21_L（通用生成）
-->
Use the user-specified model when provided; otherwise default to doubao-seedream-4-0-250828.
Available models:
- doubao-seedream-4-0-250828 (default; best Chinese text rendering; supports generate and edit)
- qwen-image (text-to-image)
- qwen-image-edit (image editing)
- high_aes_general_v21_L (general generation)""",
    )


@tool()
class GenerateImage(AbstractFileTool[GenerateImageParams], WorkspaceTool[GenerateImageParams]):
    """<!--zh: 图片生成和编辑工具，支持文本到图片生成和像素级图片编辑，两种模式均支持通过 image_paths 传入参考图。-->
    Generate or edit images from text descriptions. Both generate and edit modes accept reference images via image_paths.
    When the user uploads images and wants to build upon them, always pass image_paths regardless of mode.
    """

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
调用 generate_image 的场景：用户想创建、生成、编辑图片时。
关键规则：
- 用户上传了图片且希望参考/编辑时，必须将路径传入 image_paths
- generate + image_paths：以参考图为风格/内容基础生成新图
- edit + image_paths：对原图进行像素级修改
-->
Call generate_image when the user wants to create, generate, or edit images.
Key rules:
- When reference images exist, always pass their paths via image_paths. Never use visual_understanding to describe the image first.
- generate + image_paths: generate a new image using the reference as style/content basis
- edit + image_paths: directly modify the source image at pixel level
"""

    # 跟踪每个对话的生成计数
    _generation_counts = defaultdict(int)
    MAX_IMAGES_PER_CONVERSATION = 30
    MAX_EDITS_PER_CONVERSATION = 20

    def __init__(self, **data):
        """
        初始化图片生成/编辑工具
        """
        # 设置基础目录为工作区目录
        if "base_dir" not in data:
            data["base_dir"] = PathManager.get_workspace_dir()

        super().__init__(**data)

        # 延迟初始化，避免在构建环境中因缺少配置而失败
        self.visual_service = None
        self._initialized = False
        # 初始化用于 URL 生成的文件服务 - 临时禁用以修复循环导入
        self._file_service = None

    def _initialize_service(self):
        """延迟服务初始化，仅在需要时执行"""
        if self._initialized:
            return

        try:
            # 仅支持 magic-service 平台
            self.visual_service = None

            # 验证 magic-service 配置
            api_base_url = config.get("image_generator.text_to_image_api_base_url")
            access_key = config.get("image_generator.text_to_image_access_key")

            if not api_base_url or not access_key:
                raise ValueError("magic-service platform not configured with API address or access credentials")

            self._initialized = True
            logger.info("GenerateImage 工具服务初始化成功")

        except Exception as e:
            logger.warning(f"GenerateImage 工具服务初始化失败: {e}")
            raise

    def is_available(self) -> bool:
        """
        检查工具是否可用，验证所需配置是否存在

        Returns:
            bool: 工具是否可用
        """
        try:
            # 仅支持 magic-service 平台
            # 验证 magic-service 配置
            api_base_url = config.get("image_generator.text_to_image_api_base_url")
            access_key = config.get("image_generator.text_to_image_access_key")
            return bool(api_base_url and access_key)

        except Exception as e:
            logger.warning(f"检查 GenerateImage 工具可用性失败: {e}")
            return False

    def _get_workspace_path(self) -> Path:
        """使用 PathManager 获取工作区目录路径"""
        workspace_dir = PathManager.get_workspace_dir()
        logger.debug(f"使用 PathManager 获取工作区目录: {workspace_dir}")
        return workspace_dir

    def _is_file_in_workspace(self, file_path: str) -> bool:
        """检查文件是否在工作区目录内"""
        workspace_path = self._get_workspace_path()
        file_abs_path = Path(file_path).resolve()
        workspace_abs_path = workspace_path.resolve()

        # 检查文件是否在工作区目录内
        try:
            file_abs_path.relative_to(workspace_abs_path)
            logger.debug(f"文件在工作区内: {file_path}")
            return True
        except ValueError:
            logger.debug(f"文件不在工作区内: {file_path}")
            return False

    async def _generate_presigned_url_for_file(self, file_path: str) -> Optional[str]:
        return await generate_presigned_url_for_file(file_path)

    async def generate_presigned_url_for_file(self, file_path: str) -> Optional[str]:
        return await self._generate_presigned_url_for_file(file_path)

    async def _convert_local_image_to_url(self, image_path: str, output_path: str) -> Optional[str]:
        """将本地图片文件转换为可访问的预签名 URL"""
        try:
            image_path = image_path.lstrip('/')

            # 检查文件是否存在
            if not await async_exists(image_path):
                logger.error(f"图片文件不存在: {image_path}")
                image_path = output_path + "/" + image_path
                if not await async_exists(image_path):
                    raise ValueError(f"Image file does not exist: {image_path}")

            logger.info(f"将本地图片转换为 URL: {image_path}")

            # 构造存储系统中的完整 file_path
            file_path = Path(image_path)
            # 如果 image_path 是绝对路径，需要转换为相对路径
            if file_path.is_absolute():
                # 尝试获取相对于工作区的路径
                try:
                    workspace_dir = PathManager.get_workspace_dir()
                    file_path = str(file_path.relative_to(workspace_dir))
                except ValueError:
                    # 如果不在工作区内，使用文件名
                    file_path = file_path.name
            else:
                # 已经是相对路径，转换为字符串
                file_path = str(file_path)

            logger.info(f"为存储生成 image_path: {file_path}")

            # 生成预签名 URL
            presigned_url = await self._generate_presigned_url_for_file(file_path)
            if not presigned_url:
                logger.error(f"生成预签名 URL 失败: {file_path}")
                return None

            logger.info(f"本地图片已转换为 URL: {file_path} -> {presigned_url}")
            return presigned_url

        except Exception as e:
            logger.error(f"将本地图片转换为 URL 失败: {file_path}，错误: {e}")
            return None

    async def _generate_image_via_magic_service(self, params: GenerateImageParams, tool_context: Optional[ToolContext] = None) -> List[str]:
        """通过 magic-service 平台生成图片"""
        compressed_temp_files: List[str] = []
        try:
            # 获取 magic-service 相关配置
            api_base_url = config.get("image_generator.text_to_image_api_base_url")
            access_key = config.get("image_generator.text_to_image_access_key")

            if not api_base_url or not access_key:
                raise ValueError("magic-service API address or access credentials not configured")

            # 构建请求 URL
            url = f"{api_base_url.rstrip('/')}/images/generations"

            # 优先从 agent context 获取图片模型（含回落到 dynamic_config.yaml）
            model = params.model
            try:
                agent_context = tool_context.get_extension_typed("agent_context", AgentContext) if tool_context else None
                if agent_context:
                    resolved = agent_context.get_dynamic_image_model_id()
                    if resolved:
                        model = resolved
                        logger.info(f"使用图片模型: {model}")
                else:
                    config_data = dynamic_config.read_dynamic_config()
                    if config_data:
                        image_model_config = config_data.get("image_model", {})
                        if isinstance(image_model_config, dict):
                            model_id = image_model_config.get("model_id")
                            if model_id and isinstance(model_id, str) and model_id.strip():
                                model = model_id.strip()
                                logger.info(f"从 dynamic_config.yaml 的 image_model.model_id 获取模型: {model}")
            except Exception as e:
                logger.debug(f"获取图片模型失败，使用 params.model: {e}")

            # 如果 model 仍然为空，使用兜底默认模型
            if not model or not model.strip():
                model = "doubao-seedream-4-0-250828"
                logger.info(f"未指定模型且配置文件未设置，使用默认模型: {model}")

            # 验证模型是否在不许的列表中，如果是则使用兜底模型
            not_allowed_models = ["qwen-image-edit", "auto"]
            # 如果模型在不允许的列表中，并且image_paths为空，则使用兜底模型
            if model in not_allowed_models and params.image_paths == []:
                logger.warning(f"模型 {model} 在不允许的列表中 {not_allowed_models}，使用兜底模型 qwen-image")
                model = "doubao-seedream-4-0-250828"

            if model == "qwen-image":
                params.size = "1328x1328"

            # Convert local reference image paths to presigned URLs so the API can access them
            reference_image_urls: List[str] = []
            if params.image_paths:
                visual_dir = os.path.join(str(self.base_dir), ".visual")
                for image_source in params.image_paths:
                    image_url = image_source
                    if not image_source.startswith(("http://", "https://")):
                        logger.info(f"将参考图本地路径转换为 URL: {image_source}")
                        await async_mkdir(visual_dir, parents=True, exist_ok=True)
                        compressed_path = await compress_if_needed(image_source, output_dir=visual_dir)
                        if compressed_path != image_source and await async_exists(compressed_path):
                            logger.info(f"参考图超过大小限制，已压缩: {image_source} -> {compressed_path}")
                            compressed_temp_files.append(compressed_path)
                            workspace_dir = PathManager.get_workspace_dir()
                            try:
                                rel_path = str(Path(compressed_path).relative_to(workspace_dir))
                            except ValueError:
                                rel_path = Path(compressed_path).name
                            image_url = await self._generate_presigned_url_for_file(rel_path)
                        else:
                            image_url = await self._convert_local_image_to_url(image_source, params.output_path)
                        if not image_url:
                            raise ValueError(f"Failed to convert local reference image to accessible URL: {image_source}")
                        logger.info(f"参考图已转换为 URL: {image_source} -> {image_url}")
                    reference_image_urls.append(image_url)

            # 构建请求参数
            payload = {
                "model": model,
                "prompt": params.prompt,
                "size": params.size if params.size else "2048x2048",
                "images": reference_image_urls,
                "n": params.image_count,
                "sequential_image_generation": "auto",
            }

            # 使用 Magic 元数据构建请求头
            headers = self._build_api_headers(access_key)

            logger.info(f"调用 magic-service API: {url}")
            logger.info(f"请求参数: {payload}")

            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers, timeout=240) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise Exception(f"API request failed, status code: {response.status}, error: {error_text}")

                    response_data = await response.json()
                    logger.info(f"magic-service API response: {response_data}")

                    # 处理新的 magic-service 响应格式
                    # 新格式：{"created": ..., "data": [...], "usage": {...}, "provider": "..."}
                    # 旧格式：[{"success": true, "data": {...}}]
                    if isinstance(response_data, dict) and "data" in response_data:
                        # 新格式 - 直接从 data 数组中提取 URL
                        data_array = response_data.get("data", [])
                        image_urls = []
                        for item in data_array:
                            if isinstance(item, dict) and "url" in item:
                                image_urls.append(item["url"])
                                logger.debug(f"新格式：找到图片 URL: {item['url']}")

                        if not image_urls:
                            logger.warning(f"新格式：响应中未找到图片 URL: {response_data}")
                            raise Exception("No valid image URLs returned from magic-service")

                        logger.info(f"新格式：成功解析 {len(image_urls)} 个图片 URL")
                    else:
                        # 旧格式 - 使用现有解析器策略
                        parser = ResponseParserFactory.get_parser(model)
                        image_urls = parser.parse(response_data, model)

                    # 如果返回的图片数量超过请求数量，仅返回请求的数量
                    return image_urls[: params.image_count]

        except Exception as e:
            logger.error(f"magic-service 图片生成失败: {e}")
            raise
        finally:
            for temp_file in compressed_temp_files:
                try:
                    if await async_exists(temp_file):
                        await async_unlink(temp_file)
                        logger.debug(f"已清理临时压缩文件: {temp_file}")
                except Exception as cleanup_e:
                    logger.warning(f"清理临时压缩文件失败: {temp_file}, 错误: {cleanup_e}")

    async def _edit_image_via_magic_service(self, params: GenerateImageParams, tool_context: Optional[ToolContext] = None) -> List[str]:
        """通过 magic-service 平台编辑图片"""
        # 记录本次调用中压缩产生的临时文件，用于最终清理
        compressed_temp_files: List[str] = []
        try:
            # 获取 magic-service 相关配置
            api_base_url = config.get("image_generator.text_to_image_api_base_url")
            access_key = config.get("image_generator.text_to_image_access_key")

            if not api_base_url or not access_key:
                raise ValueError("magic-service API address or access credentials not configured")

            # 构建请求 URL
            url = f"{api_base_url.rstrip('/')}/images/edits"

            # 优先从 agent context 获取图片模型（含回落到 dynamic_config.yaml）
            model = params.model
            try:
                agent_context = tool_context.get_extension_typed("agent_context", AgentContext) if tool_context else None
                if agent_context:
                    resolved = agent_context.get_dynamic_image_model_id()
                    if resolved:
                        model = resolved
                        logger.info(f"使用图片模型: {model}")
                else:
                    config_data = dynamic_config.read_dynamic_config()
                    if config_data:
                        image_model_config = config_data.get("image_model", {})
                        if isinstance(image_model_config, dict):
                            model_id = image_model_config.get("model_id")
                            if model_id and isinstance(model_id, str) and model_id.strip():
                                model = model_id.strip()
                                logger.info(f"从 dynamic_config.yaml 的 image_model.model_id 获取模型: {model}")
            except Exception as e:
                logger.debug(f"获取图片模型失败，使用 params.model: {e}")

            # 如果 model 仍然为空，使用兜底默认模型
            if not model or not model.strip():
                model = "doubao-seedream-4-0-250828"
                logger.info(f"未指定模型且配置文件未设置，使用默认模型: {model}")

            # 验证模型是否在不允许的列表中，如果是则使用兜底模型
            not_allowed_models = ["Midjourney-turbo", "qwen-image", "high_aes_general_v21_L", "auto"]
            if model in not_allowed_models:
                logger.warning(f"模型 {model} 在不允许的列表中 {not_allowed_models}，使用兜底模型 qwen-image-edit")
                model = "doubao-seedream-4-0-250828"

            # 验证 image_paths 参数
            if not params.image_paths:
                raise ValueError("Must provide at least one image path or URL for editing")

            # 如果需要，将本地图片转换为 URL（超过 10MB 的图片先压缩）
            image_urls = []
            visual_dir = os.path.join(str(self.base_dir), ".visual")
            for image_source in params.image_paths:
                image_url = image_source

                # 检查是否为本地文件（不是 URL）
                if not image_source.startswith(("http://", "https://")):
                    # 处理本地文件路径
                    logger.info(f"将本地图片转换为 URL: {image_source}")

                    # 超过 10MB 时先压缩到 .visual 目录，再生成预签名 URL
                    effective_path = image_source
                    await async_mkdir(visual_dir, parents=True, exist_ok=True)
                    compressed_path = await compress_if_needed(image_source, output_dir=visual_dir)
                    if compressed_path != image_source and await async_exists(compressed_path):
                        logger.info(f"原图超过大小限制，已压缩: {image_source} -> {compressed_path}")
                        compressed_temp_files.append(compressed_path)
                        effective_path = compressed_path

                    # 压缩后的文件使用绝对路径直接转相对路径生成预签名 URL，
                    # 避免 _convert_local_image_to_url 对绝对路径 lstrip('/') 的处理问题
                    if effective_path != image_source:
                        workspace_dir = PathManager.get_workspace_dir()
                        try:
                            rel_path = str(Path(effective_path).relative_to(workspace_dir))
                        except ValueError:
                            rel_path = Path(effective_path).name
                        image_url = await self._generate_presigned_url_for_file(rel_path)
                    else:
                        image_url = await self._convert_local_image_to_url(image_source, params.output_path)

                    if not image_url:
                        raise ValueError(f"Failed to convert local image to accessible URL: {image_source}")
                    logger.info(f"本地图片已转换为 URL: {image_source} -> {image_url}")

                image_urls.append(image_url)

            logger.info(f"正在处理 {len(image_urls)} 张图片进行编辑")

            # 构建请求参数
            payload = {
                "model": model,
                "images": image_urls,
                "prompt": params.prompt,
                "n": params.image_count,
                "size": params.size,
                "sequential_image_generation": "auto",
            }

            # 使用 Magic 元数据构建请求头
            headers = self._build_api_headers(access_key)

            logger.info(f"调用 magic-service API: {url}")
            logger.info(f"请求参数: {payload}")

            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers, timeout=240) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise Exception(f"API request failed, status code: {response.status}, error: {error_text}")

                    response_data = await response.json()
                    logger.info(f"magic-service API response: {response_data}")

                    # 处理新的 magic-service 响应格式
                    # 新格式：{"created": ..., "data": [...], "usage": {...}, "provider": "..."}
                    # 旧格式：[{"success": true, "data": {...}}]
                    if isinstance(response_data, dict) and "data" in response_data:
                        # 新格式 - 直接从 data 数组中提取 URL
                        data_array = response_data.get("data", [])
                        image_urls = []
                        for item in data_array:
                            if isinstance(item, dict) and "url" in item:
                                image_urls.append(item["url"])
                                logger.debug(f"新格式：找到图片 URL: {item['url']}")

                        if not image_urls:
                            logger.warning(f"新格式：响应中未找到图片 URL: {response_data}")
                            raise Exception("No valid image URLs returned from magic-service")

                        logger.info(f"新格式：成功解析 {len(image_urls)} 个图片 URL")
                    else:
                        # 旧格式 - 使用现有解析器策略
                        parser = ResponseParserFactory.get_parser(model)
                        image_urls = parser.parse(response_data, model)

                    return image_urls

        except Exception as e:
            logger.error(f"magic-service 图片编辑失败: {e}")
            raise
        finally:
            # API 调用完成后清理压缩产生的临时文件
            for temp_file in compressed_temp_files:
                try:
                    if await async_exists(temp_file):
                        await async_unlink(temp_file)
                        logger.debug(f"已清理临时压缩文件: {temp_file}")
                except Exception as cleanup_e:
                    logger.warning(f"清理临时压缩文件失败: {temp_file}, 错误: {cleanup_e}")

    def _process_url(self, url: str) -> str:
        """处理 URL，保留签名参数的原始编码"""
        try:
            parsed = urlparse(url)
            if not parsed.query:
                return url

            # 解析查询参数
            query_params = parse_qs(parsed.query)
            signature_params = ["x-signature", "signature", "sig"]
            processed_params = {}

            for key, values in query_params.items():
                # 保留签名参数的原始值，不进行额外编码
                processed_params[key] = values[0]

            # 重建 URL
            encoded_query = urlencode(processed_params)
            return urlunparse(
                (parsed.scheme, parsed.netloc, parsed.path, parsed.params, encoded_query, parsed.fragment)
            )
        except Exception as e:
            logger.warning(f"URL 解析失败，使用原始 URL: {e}")
            return url

    def _get_headers_strategies(self) -> List[Dict[str, str]]:
        """获取不同的请求头策略"""
        return [
            {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Referer": "https://www.google.com/",
                "Origin": "https://www.google.com",
            },
            {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "image/*,*/*;q=0.8",
                "Referer": "https://www.google.com/",
            },
            {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
        ]

    async def _try_download_with_strategy(
        self,
        client: httpx.AsyncClient,
        url: str,
        headers: Dict[str, str],
        strategy_idx: int,
    ) -> bytes:
        """使用指定策略尝试下载图片"""
        logger.debug(f"使用请求头策略 {strategy_idx + 1} 下载")
        response = await client.get(url, headers=headers)

        if response.status_code != 200:
            if response.status_code == 403:
                logger.warning(f"策略 {strategy_idx + 1} 返回 403")
            raise Exception(f"Download failed with status code: {response.status_code}")

        content_type = response.headers.get("Content-Type", "")
        if not content_type.startswith("image/"):
            logger.warning(f"响应可能不是图片类型: {content_type}")

        image_data = response.content
        file_size = len(image_data)

        if file_size == 0:
            raise Exception("Downloaded image data is empty (size = 0)")

        return image_data

    async def _download_with_single_strategy(
        self,
        client: httpx.AsyncClient,
        url: str,
        headers: Dict[str, str],
        strategy_idx: int,
    ) -> bytes:
        """使用单个策略下载，带指数退避重试（最多3次）"""
        return await retry_with_exponential_backoff(
            self._try_download_with_strategy,
            client,
            url,
            headers,
            strategy_idx,
            max_retries=2,  # 初始尝试 + 2次重试 = 共3次
            initial_delay=1.0,
            exponential_base=2.0,
            jitter=True,
        )

    async def _download_image_data(self, url: str) -> bytes:
        """下载图片数据，使用多种策略和指数退避重试机制"""
        processed_url = self._process_url(url)
        logger.debug(f"处理后的 URL: {processed_url}")

        headers_strategies = self._get_headers_strategies()
        last_exception = None

        async with httpx.AsyncClient(verify=False, follow_redirects=True, timeout=240.0) as client:
            for strategy_idx, headers in enumerate(headers_strategies):
                try:
                    # 使用指数退避重试下载（每个策略最多3次尝试）
                    image_data = await self._download_with_single_strategy(
                        client, processed_url, headers, strategy_idx
                    )
                    logger.info(f"异步下载成功，大小: {len(image_data)} 字节")
                    return image_data

                except Exception as e:
                    last_exception = e
                    # 如果不是最后一个策略，尝试下一个
                    if strategy_idx < len(headers_strategies) - 1:
                        logger.warning(f"策略 {strategy_idx + 1} 所有重试均失败: {e}，尝试下一个策略")
                        continue
                    # 最后一个策略也失败了
                    logger.error(f"所有下载策略均失败，最后错误: {e}")
                    raise

        # 所有策略都失败
        if last_exception:
            raise last_exception
        raise Exception("All download strategies failed")

    async def _download_image(
        self,
        url: str,
        save_dir: str,
        custom_filename: str,
        should_override: bool = False,
        tool_context: ToolContext = None,
    ) -> tuple[str, bool]:
        """下载并保存图片到指定目录"""
        if not url or not url.startswith(("http://", "https://")):
            raise ValueError(f"Invalid URL format: {url}")

        # 清理 URL
        url = url.strip("\"'")
        logger.debug(f"下载图片 URL: {url}")

        # 验证 URL 格式
        try:
            parsed_url = urlparse(url)
            if not parsed_url.scheme or not parsed_url.netloc:
                raise ValueError(f"Invalid URL format: {url}")
        except Exception as e:
            logger.error(f"URL 解析失败: {e}")
            raise ValueError(f"Invalid URL format: {url}")

        # 准备保存路径
        save_path_str = os.path.join(save_dir, f"{custom_filename}.jpg")
        save_path = self.resolve_path(save_path_str)
        await async_mkdir(save_path.parent, parents=True, exist_ok=True)

        # 处理文件名冲突
        if await async_exists(save_path) and not should_override:
            counter = 1
            while True:
                new_filename = f"{custom_filename}_{counter}.jpg"
                new_path_str = os.path.join(save_dir, new_filename)
                new_path = self.resolve_path(new_path_str)
                if not await async_exists(new_path):
                    save_path = new_path
                    break
                counter += 1

        # 使用 versioning context 处理事件
        async with self._file_versioning_context(tool_context, save_path, update_timestamp=False) as file_existed_before:
            logger.info("使用异步 httpx 下载图片")
            try:
                # 下载图片数据
                image_data = await self._download_image_data(url)
                file_size = len(image_data)

                # 保存图片
                async with aiofiles.open(save_path, "wb") as f:
                    await f.write(image_data)
                    await f.flush()

                # 发送文件通知
                try:
                    await self._send_file_notification(str(save_path), file_existed_before, file_size)
                except Exception as e:
                    logger.warning(f"发送文件通知失败: {e}")

                return str(save_path), file_existed_before

            except Exception as e:
                logger.error(f"图片下载失败: {e}")
                raise

    def _build_api_headers(self, access_key: str) -> Dict[str, str]:
        """使用 Magic 元数据构建 API 请求头，遵循 factory.py 的模式"""
        # 构建默认请求头
        headers = {"Content-Type": "application/json", "api-key": f"{access_key}"}

        # 添加 Magic-Authorization 与 User-Authorization
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        # 如果 MetadataUtil 已初始化，添加 Magic 元数据请求头
        if MetadataUtil.is_initialized():
            # 将 task_id 添加到请求头
            task_id = MetadataUtil.get_metadata().get("super_magic_task_id")
            if task_id:
                headers["Magic-Task-Id"] = task_id

            # 将 topic_id 添加到请求头
            topic_id = MetadataUtil.get_metadata().get("topic_id")
            if topic_id:
                headers["Magic-Topic-Id"] = topic_id

            # 将 chat_topic_id 添加到请求头
            chat_topic_id = MetadataUtil.get_metadata().get("chat_topic_id")
            if chat_topic_id:
                headers["Magic-Chat-Topic-Id"] = chat_topic_id

            # 将 language 添加到请求头
            language = MetadataUtil.get_metadata().get("language")
            if language:
                headers["Magic-Language"] = language

        logger.info(f"构建的 API 请求头: {json.dumps(sanitize_headers(headers), ensure_ascii=False, indent=2)}")
        return headers

    def _get_conversation_id_from_context(self, tool_context: ToolContext) -> str:
        """从工具上下文中获取对话 ID"""
        if hasattr(tool_context, "agent_context") and tool_context.get_extension_typed("agent_context", AgentContext):
            agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
            if agent_context:
                chat_msg = agent_context.get_chat_client_message()
                if chat_msg and hasattr(chat_msg, "message_id"):
                    return chat_msg.message_id
        return ""

    async def _dispatch_file_event(self, tool_context: ToolContext, file_path: str, event_type: EventType) -> None:
        """分发文件创建/更新事件"""
        # 使用父类的通用方法，传递 source=5 (AI generated)
        await super()._dispatch_file_event(tool_context, file_path, event_type, is_screenshot=False, source=5)

    async def _send_file_notification(self, file_path: str, file_existed: bool, file_size: Optional[int] = None) -> None:
        """图片下载后发送文件变更通知"""
        await notify_generated_media_file(
            file_path=file_path,
            base_dir=self.base_dir,
            file_existed=file_existed,
            file_size=file_size,
            source=AI_IMAGE_GENERATION_SOURCE,
        )

    async def send_file_notification(self, file_path: str, file_existed: bool, file_size: Optional[int] = None) -> None:
        await self._send_file_notification(file_path, file_existed, file_size)

    async def execute(self, tool_context: ToolContext, params: GenerateImageParams) -> ImageToolResult:
        """执行图片生成或编辑（工具系统入口）"""
        return await self.execute_purely(tool_context, params, skip_limit_check=False)

    async def execute_purely(
        self,
        tool_context: ToolContext,
        params: GenerateImageParams,
        skip_limit_check: bool = False
    ) -> ImageToolResult:
        """执行图片生成或编辑（纯执行方法，可选择跳过限制检查）

        Args:
            tool_context: 工具上下文
            params: 图片生成参数
            skip_limit_check: 是否跳过对话级别的限制检查（默认 False）
                当设置为 True 时，将跳过 MAX_IMAGES_PER_CONVERSATION 和 MAX_EDITS_PER_CONVERSATION 的检查
                适用于内部工具调用场景（如 generate_canvas_images）

        Returns:
            ImageToolResult: 图片生成结果
        """
        try:
            # 延迟服务初始化
            self._initialize_service()

            # 获取对话ID（即使跳过限制检查，仍需要用于后续计数更新）
            conversation_id = self._get_conversation_id_from_context(tool_context)

            # 验证模式和参数
            if params.mode not in ["generate", "edit"]:
                raise ValueError("Mode must be 'generate' or 'edit'")

            # 如果未指定，自动确定输出路径
            if not params.output_path:
                params.output_path = "图片目录"

            if params.mode == "edit":
                # 图片编辑模式
                # 只有在不跳过限制检查时才进行限制验证
                if not skip_limit_check and self._generation_counts[conversation_id] >= self.MAX_EDITS_PER_CONVERSATION:
                    raise ValueError(
                        f"Reached conversation image editing limit ({self.MAX_EDITS_PER_CONVERSATION} edits)"
                    )

                # 验证编辑参数
                if not params.image_paths:
                    raise ValueError("Must provide at least one image path or URL for editing")

                # 编辑图片
                image_urls = await self._edit_image_via_magic_service(params, tool_context)
                operation_type = "edit"
                message_codes = {
                    "success": "edit_image.success",
                    "success_with_files": "edit_image.success_with_files",
                    "error": "edit_image.error",
                    "multiple": "edit_image.multiple",
                    "no_images": "edit_image.no_images",
                    "file_names": "edit_image.file_names",
                    "saved_to": "edit_image.saved_to",
                }
            else:
                # 图片生成模式
                # 只有在不跳过限制检查时才进行限制验证
                if not skip_limit_check and self._generation_counts[conversation_id] >= self.MAX_IMAGES_PER_CONVERSATION:
                    raise ValueError(
                        f"Reached conversation image generation limit ({self.MAX_IMAGES_PER_CONVERSATION} images)"
                    )

                # 验证生成参数
                if params.image_count <= 0:
                    raise ValueError("Number of images to generate must be greater than 0")
                if params.image_count > 4:
                    raise ValueError("Maximum 4 images can be generated at once")

                # 生成图片（使用 params.model 指定的模型，仅支持 magic-service 平台）
                image_urls = await self._generate_image_via_magic_service(params, tool_context)

                operation_type = "generate"
                message_codes = {
                    "success": "generate_image.success",
                    "success_with_files": "generate_image.success_with_files",
                    "error": "generate_image.error",
                    "multiple": "generate_image.multiple",
                    "no_images": "generate_image.no_images",
                    "file_names": "generate_image.file_names",
                    "saved_to": "generate_image.saved_to",
                }
            if not image_urls:
                raise ValueError(f"Image {operation_type} failed")

            # 保存图片
            save_dir = os.path.join(self.base_dir, params.output_path)
            base_filename = params.image_name if params.image_name else generate_safe_filename(params.prompt)
            saved_paths = []
            relative_paths = []

            for idx, url in enumerate(image_urls):
                try:
                    # 如果有多张图片，在文件名中添加序号
                    custom_filename = f"{base_filename}_{idx + 1}" if len(image_urls) > 1 else base_filename
                    saved_path, file_existed = await self._download_image(
                        url, save_dir, custom_filename, params.override, tool_context
                    )
                    saved_paths.append(saved_path)
                    # 将绝对路径转换为相对路径用于文件事件
                    relative_path = Path(saved_path).relative_to(self.base_dir)
                    relative_paths.append(str(relative_path))
                    logger.info(f"图片已保存: {relative_path}")
                except Exception as e:
                    logger.error(f"保存图片失败: {e}")
                    continue

            if not saved_paths:
                raise ValueError("All image saves failed")

            # 更新生成计数
            self._generation_counts[conversation_id] += len(saved_paths)

            # 使用文件名构建内容信息
            file_names = [os.path.basename(path) for path in saved_paths]
            content_with_files = i18n.translate(message_codes["success_with_files"], category="tool.messages", count=len(saved_paths), file_names=", ".join(file_names)
            )

            extra_info = {
                "saved_images": saved_paths,
                "file_names": file_names,
                "relative_paths": relative_paths,
                "prompt": params.prompt,
                "mode": params.mode,
                "image_count": len(saved_paths),
            }

            if params.mode == "generate":
                # 从 size 参数解析宽度和高度用于 extra_info
                try:
                    if "x" in params.size:
                        width_str, height_str = params.size.split("x", 1)
                        width = int(width_str.strip())
                        height = int(height_str.strip())
                    else:
                        width = height = 512
                except (ValueError, AttributeError):
                    width = height = 512

                extra_info.update({"width": width, "height": height, "size": params.size})
            else:
                extra_info.update({"original_images": params.image_paths if params.image_paths else []})

            return ImageToolResult(
                ok=True,
                content=content_with_files,
                images=saved_paths,
                extra_info=extra_info,
            )

        except Exception as e:
            logger.error(f"图片{params.mode if hasattr(params, 'mode') else '操作'}失败: {e}")

            # 根据模式确定消息代码
            if hasattr(params, "mode") and params.mode == "edit":
                error_code = "edit_image.error"
            else:
                error_code = "generate_image.error"

            return ImageToolResult(
                ok=False,
                content=i18n.translate(error_code, category="tool.messages", error=str(e)),
                images=[],
                extra_info={
                    "error": str(e),
                    "prompt": params.prompt,
                    "mode": getattr(params, "mode", "unknown"),
                    "original_images": getattr(params, "image_paths", []) if hasattr(params, "image_paths") else [],
                },
            )

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        """
        获取工具详情用于前端预览

        Args:
            tool_context: 工具上下文
            result: 工具执行结果
            arguments: 工具参数

        Returns:
            Optional[ToolDetail]: 图片预览的工具详情，如果不可用则返回 None
        """
        # 检查结果是否成功且类型正确
        if not result.ok or not isinstance(result, ImageToolResult):
            logger.debug("工具结果不成功或不是 ImageToolResult 类型")
            return None

        # 从结果中获取已保存的图片
        saved_images = result.extra_info.get("saved_images", []) if result.extra_info else []
        if not saved_images:
            logger.warning("工具结果中未找到已保存的图片")
            return None

        # 使用第一张图片进行预览
        first_image_path = saved_images[0]

        # 使用安全路径检查验证文件路径
        try:
            safe_path = self.resolve_path(first_image_path)
            # 检查图片文件是否实际存在
            if not await async_exists(safe_path):
                logger.warning(f"图片文件不存在: {safe_path}")
                return None

            # 验证它确实是图片文件
            if safe_path.suffix.lower() not in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
                logger.warning(f"文件不是识别的图片格式: {safe_path}")
                return None

            # 文件大小的额外检查（基本验证）
            try:
                file_stat = await async_stat(safe_path)
                file_size = file_stat.st_size
                if file_size == 0:
                    logger.warning(f"图片文件为空: {safe_path}")
                    return None
                elif file_size < 100:  # 非常小的文件可能已损坏
                    logger.warning(f"图片文件异常小 ({file_size} 字节): {safe_path}")
                    return None
            except OSError as e:
                logger.error(f"检查图片文件大小出错: {e}")
                return None

        except Exception as e:
            logger.error(f"验证图片路径出错 {first_image_path}: {e}")
            return None

        # 获取用于显示的文件名
        file_name = os.path.basename(first_image_path)
        # prompt = arguments.get("prompt", "") if arguments else ""
        logger.info(f"为图片创建工具详情: {file_name}")

        # 以 markdown 格式返回图片内容
        return ToolDetail(type=DisplayType.IMAGE, data=FileContent(file_name=file_name, content=file_name))

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if isinstance(result, ImageToolResult) and result.extra_info:
            saved_images = result.extra_info.get("saved_images", [])
            image_count = len(saved_images)
            mode = result.extra_info.get("mode", "generate")

            if image_count == 1:
                return os.path.basename(saved_images[0])
            elif image_count > 1:
                if mode == "edit":
                    return i18n.translate("edit_image.multiple", category="tool.messages", count=image_count)
                else:
                    return i18n.translate("generate_image.multiple", category="tool.messages", count=image_count)
            else:
                if mode == "edit":
                    return i18n.translate("edit_image.failed", category="tool.messages")
                else:
                    return i18n.translate("generate_image.failed", category="tool.messages")

        return i18n.translate("generate_image.processing", category="tool.messages")

    async def get_after_tool_call_friendly_content(
        self, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None
    ) -> str:
        """工具执行后获取友好的输出内容"""
        if not result.ok:
            # 根据模式确定错误消息
            mode = arguments.get("mode", "generate") if arguments else "generate"
            if mode == "edit":
                return i18n.translate("edit_image.error", category="tool.messages", error=result.content)
            else:
                return i18n.translate("generate_image.error", category="tool.messages", error=result.content)

        if isinstance(result, ImageToolResult):
            image_count = len(result.images) if result.images else 0
            saved_images = result.extra_info.get("saved_images", []) if result.extra_info else []
            file_names = result.extra_info.get("file_names", []) if result.extra_info else []
            relative_paths = result.extra_info.get("relative_paths", []) if result.extra_info else []
            mode = result.extra_info.get("mode", "generate") if result.extra_info else "generate"

            # 如果图片数量为 0，操作失败
            if image_count == 0:
                if mode == "edit":
                    return i18n.translate("edit_image.error", category="tool.messages", error=i18n.translate("edit_image.no_images", category="tool.messages")
                    )
                else:
                    return i18n.translate("generate_image.error", category="tool.messages", error=i18n.translate("generate_image.no_images", category="tool.messages"),
                    )

            # 如果可用，使用相对路径，否则使用文件名
            if saved_images and relative_paths:
                if mode == "edit":
                    file_info = i18n.translate("edit_image.file_names", category="tool.messages", file_names=", ".join(relative_paths)
                    )
                    return i18n.translate("edit_image.success", category="tool.messages") + f"，{file_info}"
                else:
                    file_info = i18n.translate("generate_image.file_names", category="tool.messages", file_names=", ".join(relative_paths)
                    )
                    return i18n.translate("generate_image.success", category="tool.messages") + f"，{file_info}"
            elif saved_images and file_names:
                if mode == "edit":
                    file_info = i18n.translate("edit_image.file_names", category="tool.messages", file_names=", ".join(file_names)
                    )
                    return i18n.translate("edit_image.success", category="tool.messages") + f"，{file_info}"
                else:
                    file_info = i18n.translate("generate_image.file_names", category="tool.messages", file_names=", ".join(file_names)
                    )
                    return i18n.translate("generate_image.success", category="tool.messages") + f"，{file_info}"
            elif saved_images:
                if mode == "edit":
                    return (
                        i18n.translate("edit_image.success", category="tool.messages")
                        + f"，{i18n.translate("edit_image.saved_to", category="tool.messages", paths=', '.join(saved_images))}"
                    )
                else:
                    return (
                        i18n.translate("generate_image.success", category="tool.messages")
                        + f"，{i18n.translate("generate_image.saved_to", category="tool.messages", paths=', '.join(saved_images))}"
                    )

            if mode == "edit":
                return i18n.translate("edit_image.success", category="tool.messages", count=image_count)
            else:
                return i18n.translate("generate_image.success", category="tool.messages", count=image_count)

        return i18n.translate("generate_image.success", category="tool.messages")

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        """工具执行后获取友好的操作和备注"""
        # 确定模式和相应的操作/消息代码
        mode = arguments.get("mode", "generate") if arguments else "generate"
        action_code = self.name
        if mode == "edit":
            error_message_code = "edit_image.error"
            multiple_message_code = "edit_image.multiple"
        else:
            error_message_code = "generate_image.error"
            multiple_message_code = "generate_image.multiple"

        if not result.ok:
            return {
                "action": i18n.translate(action_code, category="tool.actions"),
                "remark": i18n.translate(error_message_code, category="tool.messages", error=result.content),
            }

        if isinstance(result, ImageToolResult) and result.extra_info:
            saved_images = result.extra_info.get("saved_images", [])
            image_count = len(saved_images)

            if image_count == 1:
                return {"action": i18n.translate(action_code, category="tool.actions"), "remark": os.path.basename(saved_images[0])}
            else:
                return {
                    "action": i18n.translate(action_code, category="tool.actions"),
                    "remark": i18n.translate(multiple_message_code, category="tool.messages", count=image_count),
                }

        return {"action": i18n.translate(action_code, category="tool.actions"), "remark": self._get_remark_content(result, arguments)}
class ResponseParser:
    """解析 API 响应的基类"""

    def parse(self, response_data: List[Dict], model: str) -> List[str]:
        """解析响应数据并提取图片 URL"""
        raise NotImplementedError


class GeminiResponseParser(ResponseParser):
    """Gemini 模型的解析器（gemini-2.5-flash-image-preview 等）"""

    def parse(self, response_data: List[Dict], model: str) -> List[str]:
        """解析 Gemini 模型响应"""
        if not isinstance(response_data, list) or len(response_data) == 0:
            raise Exception("Invalid API response format")

        image_urls = []
        for item in response_data:
            if isinstance(item, dict):
                # Gemini 模型通常直接返回 imageData
                if item.get("imageData"):
                    image_urls.append(item.get("imageData"))
                    logger.debug(f"Gemini 解析器：找到 imageData URL: {item.get('imageData')}")

        if not image_urls:
            logger.warning(f"Gemini 解析器：响应中未找到图片 URL: {response_data}")
            raise Exception("No valid image URLs returned from Gemini model")

        logger.info(f"Gemini 解析器：成功解析 {len(image_urls)} 个图片 URL")
        return image_urls


class QwenResponseParser(ResponseParser):
    """Qwen 模型的解析器（qwen-image、qwen-image-edit 等）"""

    def parse(self, response_data: List[Dict], model: str) -> List[str]:
        """解析 Qwen 模型响应"""
        if not isinstance(response_data, list) or len(response_data) == 0:
            raise Exception("Invalid API response format")

        image_urls = []
        for item in response_data:
            if isinstance(item, dict) and item.get("success"):
                output = item.get("output", {})

                # 处理 qwen-image 生成响应格式（output.results）
                if "qwen-image" in model and output:
                    results = output.get("results", [])
                    for result in results:
                        url = result.get("url")
                        if url:
                            image_urls.append(url)
                            logger.debug(f"Qwen 解析器：找到 qwen-image URL: {url}")

                # 处理其他 qwen 模型格式（如编辑的 choices 结构）
                else:
                    choices = output.get("choices", [])
                    for choice in choices:
                        message = choice.get("message", {})
                        content = message.get("content", [])
                        for content_item in content:
                            image_url = content_item.get("image")
                            if image_url:
                                image_urls.append(image_url)
                                logger.debug(f"Qwen 解析器：找到 choice 图片 URL: {image_url}")

        if not image_urls:
            logger.warning(f"Qwen 解析器：响应中未找到图片 URL: {response_data}")
            raise Exception("No valid image URLs returned from Qwen model")

        logger.info(f"Qwen 解析器：成功解析 {len(image_urls)} 个图片 URL")
        return image_urls


class VolcEngineResponseParser(ResponseParser):
    """VolcEngine 模型的解析器（high_aes_general_v21_L、high_aes_general_v30l 等）"""

    def parse(self, response_data: List[Dict], model: str) -> List[str]:
        """解析 VolcEngine 模型响应"""
        if not isinstance(response_data, list) or len(response_data) == 0:
            raise Exception("Invalid API response format")

        image_urls = []
        for item in response_data:
            if isinstance(item, dict) and item.get("success"):
                # VolcEngine 模型使用 data.image_urls 格式
                if item.get("data"):
                    data = item.get("data", {})
                    if data.get("status") == "done" and data.get("image_urls"):
                        for url in data.get("image_urls", []):
                            image_urls.append(url)
                            logger.debug(f"VolcEngine 解析器：找到图片 URL: {url}")

                        # 记录额外的 VolcEngine 特定信息
                        if data.get("resp_data"):
                            try:
                                import json

                                resp_data = json.loads(data.get("resp_data", "{}"))
                                request_id = resp_data.get("request_id", "")
                                llm_result = resp_data.get("llm_result", "")
                                if request_id:
                                    logger.debug(f"VolcEngine 解析器：请求 ID: {request_id}")
                                if llm_result:
                                    logger.debug(f"VolcEngine 解析器：LLM 结果: {llm_result[:100]}...")
                            except json.JSONDecodeError:
                                logger.debug("VolcEngine 解析器：无法解析 resp_data JSON")

        if not image_urls:
            logger.warning(f"VolcEngine 解析器：响应中未找到图片 URL: {response_data}")
            raise Exception("No valid image URLs returned from VolcEngine model")

        logger.info(f"VolcEngine 解析器：成功解析模型 {model} 的 {len(image_urls)} 个图片 URL")
        return image_urls


class DoubaoResponseParser(ResponseParser):
    """Doubao 模型的解析器（doubao-seedream-4-0-250828 等）"""

    def parse(self, response_data: List[Dict], model: str) -> List[str]:
        """解析 Doubao 模型响应"""
        if not isinstance(response_data, list) or len(response_data) == 0:
            raise Exception("Invalid API response format")

        image_urls = []
        for item in response_data:
            if isinstance(item, dict) and item.get("success"):
                # Doubao 模型使用 data.data 格式
                data = item.get("data", {})
                if data:
                    # 从 data.data 数组中提取图片 URL
                    data_array = data.get("data", [])
                    for data_item in data_array:
                        url = data_item.get("url")
                        if url:
                            image_urls.append(url)
                            logger.debug(f"Doubao 解析器：找到图片 URL: {url}")

                    # 记录额外的 Doubao 特定信息
                    model_name = data.get("model", "")
                    created = data.get("created", "")
                    usage = data.get("usage", {})
                    if model_name:
                        logger.debug(f"Doubao 解析器：模型: {model_name}")
                    if created:
                        logger.debug(f"Doubao 解析器：创建时间: {created}")
                    if usage:
                        generated_images = usage.get("generated_images", 0)
                        output_tokens = usage.get("output_tokens", 0)
                        total_tokens = usage.get("total_tokens", 0)
                        logger.debug(
                            f"Doubao 解析器：使用情况 - 生成图片数: {generated_images}, 输出 tokens: {output_tokens}, 总 tokens: {total_tokens}"
                        )

        if not image_urls:
            logger.warning(f"Doubao 解析器：响应中未找到图片 URL: {response_data}")
            raise Exception("No valid image URLs returned from Doubao model")

        logger.info(f"Doubao 解析器：成功解析模型 {model} 的 {len(image_urls)} 个图片 URL")
        return image_urls


class ResponseParserFactory:
    """根据模型创建相应响应解析器的工厂类"""

    @staticmethod
    def get_parser(model: str) -> ResponseParser:
        """根据模型名称获取相应的解析器"""
        model_lower = model.lower()

        if "gemini" in model_lower:
            logger.info(f"识别到 Gemini 模型 '{model}'，使用 Gemini 解析器")
            return GeminiResponseParser()
        elif "qwen" in model_lower:
            logger.info(f"识别到 Qwen 模型 '{model}'，使用 Qwen 解析器")
            return QwenResponseParser()
        elif "doubao" in model_lower or "seedream" in model_lower:
            # 像 doubao-seedream-4-0-250828 这样的 Doubao 模型使用专用的 Doubao 解析器
            logger.info(f"识别到 Doubao 模型 '{model}'，使用 Doubao 解析器")
            return DoubaoResponseParser()
        elif any(keyword in model_lower for keyword in ["high_aes", "volcengine", "general", "v21", "v30"]):
            # 像 high_aes_general_v21_L 这样的 VolcEngine 模型使用专用的 VolcEngine 解析器
            logger.info(f"识别到 VolcEngine 模型 '{model}'，使用 VolcEngine 解析器")
            return VolcEngineResponseParser()
        else:
            # 对于未知模型，默认使用 VolcEngine 解析器（大多数 magic-service 模型使用此格式）
            logger.warning(f"未知模型 '{model}'，默认使用 VolcEngine 解析器")
            return VolcEngineResponseParser()
