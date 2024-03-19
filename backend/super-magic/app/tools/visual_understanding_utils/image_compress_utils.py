"""Image compression utilities for visual understanding."""
import os
import asyncio
from pathlib import Path
from typing import Optional
from PIL import Image
from agentlang.logger import get_logger
from app.utils.async_file_utils import async_exists, async_stat, async_mkdir

logger = get_logger(__name__)

# 压缩配置常量
COMPRESS_THRESHOLD_MB = 10  # 超过10MB需要压缩
COMPRESS_TARGET_MB = 5  # 目标压缩到5MB以内
MAX_IMAGE_DIMENSION = 1920  # 最大单边尺寸
MAX_TOTAL_PIXELS = 32_000_000  # 最大总像素数（留有安全余量，模型限制为36M）


async def should_compress_image(image_path: str, threshold_mb: Optional[float] = None) -> bool:
    """判断图片是否需要压缩（基于文件大小或像素总数）

    Args:
        image_path: 图片文件路径
        threshold_mb: 压缩阈值（单位：MB），默认使用 COMPRESS_THRESHOLD_MB (10MB)

    Returns:
        bool: 是否需要压缩
    """
    try:
        if not await async_exists(image_path):
            return False

        # 检查文件大小
        size_threshold = threshold_mb if threshold_mb is not None else COMPRESS_THRESHOLD_MB
        stat_result = await async_stat(image_path)
        file_size_mb = stat_result.st_size / (1024 * 1024)

        if file_size_mb > size_threshold:
            logger.info(f"图片大小 {file_size_mb:.2f}MB 超过阈值 {size_threshold}MB，需要压缩: {image_path}")
            return True

        # 检查像素总数（使用轻量级方式获取尺寸，不加载完整图片数据）
        try:
            def _get_dimensions():
                img = Image.open(image_path)
                size = img.size
                img.close()
                return size

            width, height = await asyncio.to_thread(_get_dimensions)
            total_pixels = width * height

            if total_pixels > MAX_TOTAL_PIXELS:
                logger.info(f"图片像素总数 {total_pixels:,} ({width}x{height}) 超过限制 {MAX_TOTAL_PIXELS:,}，需要压缩: {image_path}")
                return True
        except Exception as e:
            logger.warning(f"检查图片像素总数失败: {e}，跳过像素检查")

        return False

    except Exception as e:
        logger.warning(f"检查图片是否需要压缩失败: {e}")
        return False


async def compress_image(
    image_path: str,
    output_dir: Optional[str] = None,
    target_size_mb: Optional[float] = None
) -> Optional[str]:
    """压缩图片为 JPEG 格式

    Args:
        image_path: 原始图片路径
        output_dir: 输出目录，如果不指定则使用原图片目录
        target_size_mb: 目标压缩大小（单位：MB），默认为 COMPRESS_TARGET_MB (5MB)

    Returns:
        Optional[str]: 压缩后的图片路径，失败时返回 None
    """
    try:
        # 使用传入的目标大小，如果没有则使用默认值
        compress_target = target_size_mb if target_size_mb is not None else COMPRESS_TARGET_MB
        logger.info(f"开始压缩图片: {image_path}，目标大小: {compress_target}MB")

        # 准备输出目录
        image_path_obj = Path(image_path)
        if output_dir:
            await async_mkdir(output_dir, parents=True, exist_ok=True)
            target_dir = output_dir
        else:
            target_dir = str(image_path_obj.parent)

        # 生成压缩后的文件路径
        original_name = image_path_obj.stem
        compressed_path = str(Path(target_dir) / f"{original_name}_compressed.jpg")

        # 在线程中执行压缩操作（PIL没有异步版本）
        def _compress_sync():
            import time

            # 打开图片（不立即加载完整数据）
            img = Image.open(image_path)

            try:
                # 计算压缩后的尺寸（在加载数据前先计算，避免加载超大图片）
                original_size = img.size
                width, height = original_size
                total_pixels = width * height

                # 计算最终需要的尺寸
                needs_resize = False
                final_width, final_height = width, height

                # 优先检查总像素数是否超限
                if total_pixels > MAX_TOTAL_PIXELS:
                    # 根据像素总数计算缩放比例
                    pixel_ratio = (MAX_TOTAL_PIXELS / total_pixels) ** 0.5
                    final_width = int(width * pixel_ratio)
                    final_height = int(height * pixel_ratio)
                    needs_resize = True
                    logger.info(f"图片像素总数超限: {original_size} ({total_pixels:,}像素) → 需要缩放到 ({final_width}x{final_height})")

                # 再检查单边尺寸是否超限
                if max(final_width, final_height) > MAX_IMAGE_DIMENSION:
                    # 按比例缩放
                    ratio = MAX_IMAGE_DIMENSION / max(final_width, final_height)
                    final_width = int(final_width * ratio)
                    final_height = int(final_height * ratio)
                    needs_resize = True
                    logger.debug(f"图片单边尺寸超限，最终缩放到: ({final_width}x{final_height})")

                # 如果需要缩放，使用 thumbnail 方法（原地修改，更高效）
                if needs_resize:
                    try:
                        # 对于 JPEG，draft 可以加速解码
                        img.draft('RGB', (final_width, final_height))
                    except:
                        pass
                    # thumbnail 会保持宽高比，原地修改图片
                    img.thumbnail((final_width, final_height), Image.Resampling.LANCZOS)
                    logger.info(f"图片已缩放: {original_size} → {img.size}")

                # 转换为 RGB 模式（JPEG 不支持透明度）
                if img.mode in ('RGBA', 'LA', 'P'):
                    # 创建白色背景
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')

                # 尝试不同的质量等级，目标是压缩到指定大小以内
                target_size_bytes = compress_target * 1024 * 1024
                best_quality = None

                for q in [85, 75, 65, 50, 35, 20]:
                    # 带重试机制的保存操作
                    max_retries = 3
                    retry_delay = 0.2
                    save_success = False

                    for attempt in range(1, max_retries + 1):
                        img.save(compressed_path, 'JPEG', quality=q, optimize=True)
                        best_quality = q

                        # 给文件系统一点时间刷新
                        time.sleep(0.1)

                        # 检查文件是否成功写入（大小 > 0）
                        if os.path.exists(compressed_path):
                            current_size = os.path.getsize(compressed_path)
                            if current_size > 0:
                                save_success = True
                                logger.debug(f"文件保存成功 (质量={q}, 尝试 {attempt}/{max_retries})，大小: {current_size} bytes")

                                # 检查是否满足目标大小
                                if current_size <= target_size_bytes:
                                    return compressed_path, current_size, q, True
                                break  # 保存成功但未满足目标，继续下一个质量等级
                            else:
                                logger.warning(f"压缩文件大小为 0 (质量={q}, 尝试 {attempt}/{max_retries})")
                                if attempt < max_retries:
                                    time.sleep(retry_delay)
                        else:
                            logger.warning(f"压缩文件不存在 (质量={q}, 尝试 {attempt}/{max_retries})")
                            if attempt < max_retries:
                                time.sleep(retry_delay)

                    if not save_success:
                        raise IOError(f"文件写入失败，重试 {max_retries} 次后仍然失败: {compressed_path}")

                # 如果所有质量等级都无法满足要求，返回最低质量的版本
                last_size = os.path.getsize(compressed_path)
                return compressed_path, last_size, best_quality, False

            finally:
                img.close()

        # 异步执行压缩
        result = await asyncio.to_thread(_compress_sync)
        result_path, result_size, result_quality, meet_target = result

        # 使用异步方式获取最终文件大小验证
        stat_result = await async_stat(result_path)
        final_size_mb = stat_result.st_size / (1024 * 1024)

        if meet_target:
            logger.info(f"压缩成功: {image_path} → {result_path}, "
                       f"质量={result_quality}, 大小={final_size_mb:.2f}MB")
        else:
            logger.warning(f"即使最低质量也无法满足大小要求，使用质量={result_quality}的版本，"
                         f"最终大小={final_size_mb:.2f}MB")

        return result_path

    except Exception as e:
        logger.error(f"压缩图片失败: {image_path}, 错误: {e}", exc_info=True)
        return None


async def compress_if_needed(
    image_path: str,
    output_dir: Optional[str] = None,
    target_size_mb: Optional[float] = None
) -> str:
    """如果需要则压缩图片

    Args:
        image_path: 原始图片路径
        output_dir: 输出目录，如果不指定则使用原图片目录
        target_size_mb: 目标压缩大小（单位：MB），默认为 COMPRESS_TARGET_MB (5MB)

    Returns:
        str: 处理后的图片路径（可能是原路径或压缩后的路径）
    """
    # 检查是否需要压缩
    if await should_compress_image(image_path):
        compressed_path = await compress_image(image_path, output_dir, target_size_mb)
        if compressed_path:
            return compressed_path
        else:
            logger.warning(f"压缩失败，使用原图片: {image_path}")
            return image_path
    else:
        return image_path
