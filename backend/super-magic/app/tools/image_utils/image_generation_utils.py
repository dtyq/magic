"""图片生成共享工具函数

提供 generate_images 等工具复用的原子能力：
- 模型解析
- 参考图本地路径转预签名 URL（含图片压缩）
- 图片下载（多策略 + 指数退避重试）
- 文件保存（自动追加序号避免覆盖）
"""

from pathlib import Path
from typing import Dict, List, Optional, Tuple

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.path_manager import PathManager
from app.service.media_generation_service import generate_presigned_url_for_file
from app.tools.visual_understanding_utils.image_compress_utils import compress_if_needed
from app.utils.async_file_utils import async_exists, async_mkdir, async_unlink

logger = get_logger(__name__)

async def resolve_image_model(tool_context: Optional[ToolContext]) -> str:
    """
    获取图片生成模型 ID，来源：agent_context.get_dynamic_image_model_id()
    （内部已包含 dynamic_config.yaml 读取）。未配置时抛出异常。
    """
    from app.core.context.agent_context import AgentContext

    agent_context = (
        tool_context.get_extension_typed("agent_context", AgentContext)
        if tool_context
        else None
    )
    if agent_context:
        resolved = agent_context.get_dynamic_image_model_id()
        if resolved:
            logger.info(f"从 agent_context 获取图片模型: {resolved}")
            return resolved

    raise ValueError(
        "Image generation is not available because no model has been configured. "
        "Please ask the administrator to enable image generation in the configuration."
    )

async def local_image_to_presigned_url(
    image_source: str,
    visual_dir: str,
) -> Tuple[str, List[str]]:
    """
    将本地图片路径转换为预签名 URL。
    超过大小限制时先压缩到 visual_dir 再生成 URL。

    Returns:
        (url, temp_files): url 是预签名 URL，temp_files 是压缩产生的临时文件（调用方负责清理）

    Raises:
        ValueError: 文件不存在或 URL 生成失败
    """
    temp_files: List[str] = []
    image_path = image_source.lstrip("/")

    if not await async_exists(image_path):
        raise ValueError(
            f"Reference image '{image_source}' not found. "
            f"Verify the path is relative to the workspace root and the file exists."
        )

    await async_mkdir(visual_dir, parents=True, exist_ok=True)
    compressed_path = await compress_if_needed(image_path, output_dir=visual_dir)

    if compressed_path != image_path and await async_exists(compressed_path):
        logger.info(f"参考图超过大小限制，已压缩: {image_path} -> {compressed_path}")
        temp_files.append(compressed_path)
        workspace_dir = PathManager.get_workspace_dir()
        try:
            rel_path = str(Path(compressed_path).relative_to(workspace_dir))
        except ValueError:
            rel_path = Path(compressed_path).name
        url = await generate_presigned_url_for_file(rel_path)
    else:
        file_path = Path(image_path)
        if file_path.is_absolute():
            try:
                workspace_dir = PathManager.get_workspace_dir()
                file_path_str = str(file_path.relative_to(workspace_dir))
            except ValueError:
                file_path_str = file_path.name
        else:
            file_path_str = str(file_path)
        url = await generate_presigned_url_for_file(file_path_str)

    if not url:
        raise ValueError(
            f"Reference image '{image_source}' could not be converted to an accessible URL. "
            f"Check that the path is correct and the file exists in the workspace."
        )

    logger.info(f"参考图已转换为 URL: {image_source} -> {url}")
    return url, temp_files


async def resolve_reference_images_to_urls(
    image_paths: List[str],
    base_dir: Path,
) -> Tuple[List[str], List[str]]:
    """
    将参考图列表（本地路径或 URL）统一转换为可访问的 URL 列表。

    Returns:
        (urls, temp_files): urls 是结果 URL 列表，temp_files 是所有压缩临时文件（调用方负责清理）
    """
    urls: List[str] = []
    all_temp_files: List[str] = []
    visual_dir = str(base_dir / ".visual")

    for image_source in image_paths:
        if image_source.startswith(("http://", "https://")):
            urls.append(image_source)
            continue
        url, temp_files = await local_image_to_presigned_url(image_source, visual_dir)
        urls.append(url)
        all_temp_files.extend(temp_files)

    return urls, all_temp_files


async def resolve_size_from_references(
    reference_images: List[str],
    base_dir: Path,
) -> Optional[str]:
    """
    从参考图列表中读取各图片尺寸，返回面积最大的那张的 'WxH' 字符串。
    所有图片都无法读取时返回 None。
    """
    import asyncio
    from PIL import Image

    best_area = -1
    best_size: Optional[str] = None

    for ref_path in reference_images:
        path_obj = Path(ref_path)
        if not path_obj.is_absolute():
            path_obj = base_dir / ref_path

        try:
            def _read(p: Path):
                with Image.open(p) as img:
                    return img.size

            w, h = await asyncio.to_thread(_read, path_obj)
            area = w * h
            if area > best_area:
                best_area = area
                best_size = f"{w}x{h}"
        except Exception as e:
            logger.warning(f"读取参考图尺寸失败 {path_obj}: {e}")

    return best_size


async def resolve_safe_save_path(save_dir: Path, filename_stem: str) -> Path:
    """
    确定不冲突的保存路径，同名文件自动追加数字序号。
    调用方需已确保 save_dir 存在。
    """
    candidate = save_dir / f"{filename_stem}.jpg"
    if not await async_exists(candidate):
        return candidate

    counter = 1
    while True:
        candidate = save_dir / f"{filename_stem}_{counter}.jpg"
        if not await async_exists(candidate):
            return candidate
        counter += 1


async def cleanup_temp_files(temp_files: List[str]) -> None:
    """清理压缩等过程中产生的临时文件。"""
    for path in temp_files:
        try:
            if await async_exists(path):
                await async_unlink(path)
                logger.debug(f"已清理临时文件: {path}")
        except Exception as e:
            logger.warning(f"清理临时文件失败: {path}, 错误: {e}")
