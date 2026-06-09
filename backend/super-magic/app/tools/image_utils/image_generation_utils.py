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
from app.service.file_service import FileService, WorkspaceFileURLError
from app.tools.visual_understanding_utils.image_compress_utils import compress_if_needed
from app.utils.async_file_utils import async_exists, async_mkdir, async_unlink

logger = get_logger(__name__)

async def resolve_image_model(tool_context: Optional[ToolContext]) -> str:
    """
    获取图片生成模型 ID，来源于 AgentContext.model_context。未配置时抛出异常。
    """
    agent_context = tool_context.get_extension("agent_context") if tool_context else None
    if agent_context:
        resolved = agent_context.model_context.image_model_id
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
    workspace_dir = Path(PathManager.get_workspace_dir())

    try:
        resolved_path = await _resolve_local_image_path(image_source, workspace_dir)

        await async_mkdir(visual_dir, parents=True, exist_ok=True)
        compressed_path = await compress_if_needed(str(resolved_path), output_dir=visual_dir)

        presigned_target = resolved_path
        if compressed_path != str(resolved_path) and await async_exists(compressed_path):
            logger.info(f"参考图超过大小限制，已压缩: {resolved_path} -> {compressed_path}")
            temp_files.append(compressed_path)
            presigned_target = Path(compressed_path).expanduser().resolve()

        url = await FileService().get_workspace_file_url(presigned_target)
    except FileNotFoundError as e:
        raise ValueError(
            f"Reference image '{image_source}' not found. "
            f"Verify the path is relative to the workspace root and the file exists."
        ) from e
    except WorkspaceFileURLError as e:
        raise ValueError(
            f"Reference image '{image_source}' could not be converted to an accessible URL. "
            f"Check that the path is correct and the file exists in the workspace."
        ) from e

    if not url:
        raise ValueError(
            f"Reference image '{image_source}' could not be converted to an accessible URL. "
            f"Check that the path is correct and the file exists in the workspace."
        )

    logger.info(f"参考图已转换为 URL: {image_source} -> {url}")
    return url, temp_files


async def _resolve_local_image_path(image_source: str, workspace_dir: Path) -> Path:
    """将参考图路径解析为绝对路径。

    兼容三种写法：绝对路径、相对 workspace 根目录、相对当前工作目录的旧写法。
    解析顺序优先 workspace 根目录，避免把 workspace 相对路径误判为当前进程 cwd 相对路径。
    """
    normalized_input = Path(image_source).expanduser()
    candidates: List[Path] = []

    if normalized_input.is_absolute():
        candidates.append(normalized_input)
    else:
        candidates.append(workspace_dir / normalized_input)
        candidates.append(normalized_input)

    for candidate in candidates:
        if await async_exists(candidate):
            return candidate.resolve()

    raise FileNotFoundError(f"Image file does not exist: {image_source}")


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


async def detect_image_file_extension(file_path: str) -> str:
    """根据图片真实内容推断保存扩展名，失败时回退到文件后缀。"""
    import asyncio
    from PIL import Image

    extension_map = {
        "JPEG": ".jpg",
        "PNG": ".png",
        "WEBP": ".webp",
        "GIF": ".gif",
        "BMP": ".bmp",
    }

    try:
        def _detect(path: str) -> Optional[str]:
            with Image.open(path) as img:
                return extension_map.get((img.format or "").upper())

        detected = await asyncio.to_thread(_detect, file_path)
        if detected:
            return detected
    except Exception as e:
        logger.warning(f"检测生成图片格式失败 {file_path}: {e}")

    suffix = Path(file_path).suffix.lower()
    return suffix if suffix else ".jpg"


async def resolve_safe_save_path(save_dir: Path, filename_stem: str, extension: str = ".jpg") -> Path:
    """
    确定不冲突的保存路径，同名文件自动追加数字序号。
    调用方需已确保 save_dir 存在。
    """
    normalized_extension = extension if extension.startswith(".") else f".{extension}"
    candidate = save_dir / f"{filename_stem}{normalized_extension}"
    if not await async_exists(candidate):
        return candidate

    counter = 1
    while True:
        candidate = save_dir / f"{filename_stem}_{counter}{normalized_extension}"
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
