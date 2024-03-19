"""Image format conversion utilities."""
import os
import base64
import tempfile
import asyncio
from pathlib import Path
from typing import Optional
from agentlang.logger import get_logger
from app.utils.async_file_utils import async_read_bytes, async_stat, async_mkdir

logger = get_logger(__name__)

# 尝试注册 pillow-heif 以支持 AVIF/HEIC/HEIF 格式
# 在模块导入时注册一次，后续所有 Image.open 都会自动支持这些格式
try:
    import pillow_heif
    # 注册 HEIF/HEIC 支持
    pillow_heif.register_heif_opener()
    import pillow_heif.AvifImagePlugin  # noqa: F401
    logger.info("pillow-heif 已注册，支持 AVIF/HEIC/HEIF 格式")
except ImportError:
    logger.warning("pillow-heif 未安装，AVIF/HEIC/HEIF 格式可能无法转换")
except Exception as e:
    logger.warning(f"注册 pillow-heif 时出错（可忽略）: {e}")


async def convert_unsupported_format_to_jpeg(
    file_path: str,
    output_dir: str
) -> Optional[str]:
    """将不支持的图片格式转换为 JPEG 格式

    支持转换：AVIF、HEIC、HEIF、TIFF 等格式

    Args:
        file_path: 原始文件路径
        output_dir: 输出目录（通常是 .visual 目录）

    Returns:
        Optional[str]: 转换后的文件路径，转换失败返回 None
    """
    try:
        from PIL import Image
        from .format_utils import format_file_size

        # 确保输出目录存在
        await async_mkdir(output_dir, parents=True, exist_ok=True)

        # 生成输出文件名（保持原文件名，但扩展名改为 .jpg）
        original_name = Path(file_path).stem
        output_path = str(Path(output_dir) / f"{original_name}_converted.jpg")

        logger.info(f"开始转换图片格式: {Path(file_path).name} → JPEG")

        # 在线程中执行同步的图片转换操作
        def _convert_sync():
            import time

            # 打开图片并加载数据
            img = Image.open(file_path)
            img.load()  # 确保图片数据完全加载到内存

            try:
                # 转换为 RGB 模式（JPEG 不支持透明度）
                if img.mode in ('RGBA', 'LA', 'P'):
                    # 创建白色背景
                    rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    rgb_img.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                    img = rgb_img
                elif img.mode != 'RGB':
                    img = img.convert('RGB')

                # 保存为 JPEG，带重试机制（文件系统可能会有延迟或失败）
                max_retries = 3
                retry_delay = 0.2  # 秒

                for attempt in range(1, max_retries + 1):
                    logger.debug(f"尝试保存 JPEG 文件 (第 {attempt}/{max_retries} 次): {output_path}")
                    img.save(output_path, 'JPEG', quality=85, optimize=True)

                    # 给文件系统一点时间刷新
                    time.sleep(0.1)

                    # 验证文件是否成功写入（大小 > 0）
                    if os.path.exists(output_path):
                        file_size = os.path.getsize(output_path)
                        if file_size > 0:
                            logger.info(f"文件保存成功 (尝试 {attempt}/{max_retries})，大小: {file_size} bytes")
                            return output_path
                        else:
                            logger.warning(f"文件保存后大小为 0 (尝试 {attempt}/{max_retries})")
                            if attempt < max_retries:
                                time.sleep(retry_delay)
                    else:
                        logger.warning(f"文件保存后不存在 (尝试 {attempt}/{max_retries})")
                        if attempt < max_retries:
                            time.sleep(retry_delay)

                # 所有重试都失败
                logger.error(f"文件保存失败: 重试 {max_retries} 次后仍然失败")
                raise IOError(f"文件写入失败，重试 {max_retries} 次后文件大小仍为 0 或文件不存在: {output_path}")

            finally:
                img.close()

        result_path = await asyncio.to_thread(_convert_sync)

        # 获取转换后的文件大小
        stat_result = await async_stat(result_path)
        converted_size = stat_result.st_size

        logger.info(f"图片格式转换成功: {Path(result_path).name}, 大小: {format_file_size(converted_size)}")
        return result_path

    except Exception as e:
        error_msg = str(e)
        # 检查是否是因为 PIL 不支持该格式
        if 'cannot identify image file' in error_msg.lower() or 'image file is truncated' in error_msg.lower():
            logger.error(f"转换图片格式失败: PIL 无法识别图片格式，请确保已安装 pillow-heif (pip install pillow-heif): {Path(file_path).name}, 错误: {e}")
        else:
            logger.error(f"转换图片格式失败: {Path(file_path).name}, 错误: {e}")
        return None


async def _compress_for_base64_if_needed(
    file_path: str,
    compress_threshold_mb: float
) -> str:
    """如果文件超过阈值则压缩（用于 Base64 编码前的预处理）

    检查文件大小和像素总数，如果任意一项超限则进行压缩
    压缩文件保存在系统临时目录，由系统自动管理，无需手动清理

    Args:
        file_path: 原始文件路径
        compress_threshold_mb: 压缩阈值（单位：MB）

    Returns:
        str: 实际要使用的文件路径（原始路径或压缩后的路径）
    """
    # 延迟导入避免循环依赖
    from .image_compress_utils import compress_image, should_compress_image
    from .format_utils import format_file_size

    # 使用 should_compress_image 统一检查（包括文件大小和像素总数）
    needs_compress = await should_compress_image(file_path, threshold_mb=compress_threshold_mb)

    if needs_compress:
        # 压缩到临时目录
        # 目标大小设置为 3MB，这样 Base64 编码后约 4MB
        temp_dir = tempfile.gettempdir()
        compressed_path = await compress_image(file_path, output_dir=temp_dir, target_size_mb=3.0)

        if compressed_path:
            logger.info(f"图片已压缩: {file_path} → {compressed_path}")

            # 获取压缩后的文件大小
            compressed_stat = await async_stat(compressed_path)
            compressed_size = compressed_stat.st_size
            logger.debug(f"压缩后文件大小: {format_file_size(compressed_size)}")

            return compressed_path
        else:
            logger.warning(f"图片压缩失败，使用原图")

    return file_path


async def local_file_to_base64(
    file_path: str,
    content_type: str = "",
    compress_threshold_mb: Optional[float] = None
) -> str:
    """将本地文件转换为base64编码

    Args:
        file_path: 本地文件路径
        content_type: HTTP Content-Type，如果提供则优先使用
        compress_threshold_mb: 压缩阈值（单位：MB），如果文件大小超过此值则自动压缩到系统临时目录。
                               默认为 None 表示不压缩。

    Returns:
        str: base64编码后的图片数据，包含mime类型前缀

    Note:
        压缩文件保存在系统临时目录，由系统自动管理，无需手动清理
    """
    # 确保文件路径是绝对路径
    if not os.path.isabs(file_path):
        file_path = os.path.abspath(file_path)

    # 记录传入的参数
    logger.debug(f"local_file_to_base64 - file_path: {file_path}, content_type: '{content_type}', compress_threshold_mb: {compress_threshold_mb}")

    # 如果设置了压缩阈值，检查文件大小并在必要时压缩
    actual_file_path = file_path
    if compress_threshold_mb is not None and compress_threshold_mb > 0:
        actual_file_path = await _compress_for_base64_if_needed(file_path, compress_threshold_mb)

    # 确定 MIME 类型：优先使用传入的 content_type，否则根据文件扩展名判断
    if content_type and content_type.startswith('image/'):
        mime_type = content_type.split(';')[0]  # 去掉可能的参数，如 charset
        logger.debug(f"使用传入的 content_type，mime_type: {mime_type}")
    else:
        # 从文件扩展名推测 MIME 类型（兜底方案）
        # 注意：如果进行了压缩，使用压缩后的文件路径来判断扩展名
        file_ext = Path(actual_file_path).suffix.lower().lstrip('.')
        mime_types = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'bmp': 'image/bmp',
            'avif': 'image/avif',
        }
        mime_type = mime_types.get(file_ext, 'image/jpeg')
        logger.debug(f"从文件扩展名推测，file_ext: {file_ext}, mime_type: {mime_type}")

    # 读取文件并转换为base64
    file_content = await async_read_bytes(actual_file_path)
    base64_data = base64.b64encode(file_content).decode('utf-8')

    # 返回带有mime类型前缀的base64数据
    result = f"data:{mime_type};base64,{base64_data}"
    logger.debug(f"local_file_to_base64 - 最终 data URL 前缀: data:{mime_type};base64,...")
    return result
