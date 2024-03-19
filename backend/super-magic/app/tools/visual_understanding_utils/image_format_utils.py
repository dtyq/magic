"""Image format validation and detection utilities."""
from pathlib import Path
from agentlang.logger import get_logger
from app.utils.async_file_utils import async_read_bytes

logger = get_logger(__name__)

# 需要转换为 JPEG 的格式列表（这些格式兼容性较差或文件较大）
FORMATS_NEED_CONVERSION = [
    'image/avif',
    'image/heic',
    'image/heif',
    'image/tiff',
]

def validate_image_signature(content: bytes) -> bool:
    """验证图片文件签名

    Args:
        content: 文件头字节内容

    Returns:
        bool: 是否为有效的图片格式
    """
    image_signatures = [
        b'\xFF\xD8\xFF',  # JPEG
        b'\x89PNG\r\n\x1A\n',  # PNG
        b'GIF87a',  # GIF87a
        b'GIF89a',  # GIF89a
        b'RIFF',  # WebP (starts with RIFF)
        b'BM',  # BMP
        b'II*\x00',  # TIFF (little-endian)
        b'MM\x00*',  # TIFF (big-endian)
    ]

    has_valid_signature = any(content.startswith(sig) for sig in image_signatures)

    # WebP额外检查 (RIFF容器)
    if content.startswith(b'RIFF') and len(content) > 12:
        has_valid_signature = b'WEBP' in content[8:12]

    # AVIF/HEIC/HEIF格式检查 (ftyp容器，类似MP4)
    # 这些文件通常以 ftyp 开头，然后包含特定的品牌标识
    if len(content) > 12:
        # 检查是否包含 ftyp 标识
        if b'ftyp' in content[4:12]:
            # 检查是否包含相关格式标识
            # AVIF: avif, avis
            # HEIC: heic, heix, hevc, hevx
            # HEIF: mif1, msf1
            format_markers = [
                b'avif', b'avis',  # AVIF
                b'heic', b'heix', b'hevc', b'hevx',  # HEIC
                b'mif1', b'msf1',  # HEIF
            ]
            # 检查前64字节中是否包含这些标识
            for marker in format_markers:
                if marker in content[:64]:
                    has_valid_signature = True
                    break

    return has_valid_signature


async def detect_content_type_from_file(file_path: str) -> str:
    """从文件内容检测真实的内容类型

    Args:
        file_path: 文件路径

    Returns:
        str: 检测到的 content type，如果无法检测则返回空字符串
    """
    try:
        # 读取前64字节（AVIF/HEIC/HEIF需要更多字节来检测）
        header = await async_read_bytes(file_path, size=64)

        # 检测各种图片格式
        if header.startswith(b'\xFF\xD8\xFF'):
            return 'image/jpeg'
        elif header.startswith(b'\x89PNG\r\n\x1A\n'):
            return 'image/png'
        elif header.startswith(b'GIF87a') or header.startswith(b'GIF89a'):
            return 'image/gif'
        elif header.startswith(b'RIFF') and len(header) > 12 and b'WEBP' in header[8:12]:
            return 'image/webp'
        elif header.startswith(b'BM'):
            return 'image/bmp'
        elif header.startswith(b'II*\x00') or header.startswith(b'MM\x00*'):
            return 'image/tiff'
        # ftyp容器格式检测（AVIF/HEIC/HEIF）
        elif b'ftyp' in header[4:12]:
            # AVIF格式
            if b'avif' in header or b'avis' in header:
                return 'image/avif'
            # HEIC格式
            elif any(marker in header for marker in [b'heic', b'heix', b'hevc', b'hevx']):
                return 'image/heic'
            # HEIF格式
            elif any(marker in header for marker in [b'mif1', b'msf1']):
                return 'image/heif'
            else:
                logger.debug(f"检测到 ftyp 容器但未识别具体类型，文件头: {header[:32].hex()}")
                return 'image/jpeg'
        else:
            logger.debug(f"无法检测文件类型，文件头: {header[:32].hex()}，返回市场份额最大的 jpeg 类型")
            return 'image/jpeg'
    except Exception as e:
        logger.warning(f"检测文件类型失败: {e}")
        return ''


async def get_content_type_for_local_file(file_path: str) -> str:
    """获取本地文件的内容类型

    直接从文件内容检测类型，更简单、更可靠

    Args:
        file_path: 文件路径

    Returns:
        str: 内容类型（如 'image/jpeg', 'image/png'）
    """
    return await detect_content_type_from_file(file_path)
