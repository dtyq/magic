"""
AIGC元数据处理工具类

用于在图片中嵌入和提取AIGC相关的元数据信息
"""

import json
from datetime import datetime
from typing import Dict, Optional, Any
from pathlib import Path

from PIL import Image, PngImagePlugin, ExifTags
from PIL.ExifTags import TAGS
from loguru import logger
from pptx import Presentation

from app.core.entity.aigc_metadata import AigcMetadataParams
from .signature_utils import SignatureUtil

import fitz  # PyMuPDF

class AigcMetadataUtil:
    """AIGC元数据处理工具类"""

    METADATA_KEY = "Aigc"
    VERSION = "1.0"
    SOURCE = "super-magic"

    @staticmethod
    async def create_signed_metadata(file_path: str, aigc_params: Optional[AigcMetadataParams] = None) -> str:
        """
        创建包含签名的AIGC元数据JSON字符串

        Args:
            file_path: 文件路径（必须提供）
            aigc_params: AIGC元数据参数对象

        Returns:
            str: 包含签名的JSON格式元数据字符串

        Raises:
            MagicGatewayException: 如果签名过程中发生错误
        """
        metadata_dict = await SignatureUtil.create_signed_metadata(file_path, aigc_params)
        return json.dumps(metadata_dict, ensure_ascii=False)

    @staticmethod
    def embed_image_metadata(image_path: str, metadata_json: str) -> bool:
        """
        在图片中嵌入元数据（支持PNG和JPEG格式）

        Args:
            image_path: 图片文件路径
            metadata_json: 要嵌入的JSON格式元数据字符串

        Returns:
            bool: 是否成功嵌入元数据
        """
        try:
            image_path = Path(image_path)
            if not image_path.exists():
                logger.error(f"图片文件不存在: {image_path}")
                return False

            with Image.open(image_path) as img:
                image_format = img.format

                if image_format == 'PNG':
                    return AigcMetadataUtil._embed_metadata_png(img, image_path, metadata_json)
                elif image_format in ['JPEG', 'JPG']:
                    return AigcMetadataUtil._embed_metadata_jpeg(img, image_path, metadata_json)
                else:
                    logger.warning(f"不支持的图片格式: {image_format}，支持PNG和JPEG格式")
                    return False

        except Exception as e:
            logger.error(f"嵌入元数据失败 {image_path}: {e}")
            return False

    @staticmethod
    def _embed_metadata_png(img: Image.Image, image_path: Path, metadata_json: str) -> bool:
        """在PNG图片中嵌入元数据"""
        try:
            # 创建PNG信息对象
            pnginfo = PngImagePlugin.PngInfo()

            # 保留现有元数据
            if hasattr(img, 'info') and img.info:
                for key, value in img.info.items():
                    if key != AigcMetadataUtil.METADATA_KEY:
                        pnginfo.add_text(key, str(value))

            # 添加AIGC元数据
            pnginfo.add_text(AigcMetadataUtil.METADATA_KEY, metadata_json)

            # 保存图片
            img.save(str(image_path), pnginfo=pnginfo)
            logger.debug(f"成功嵌入PNG元数据到图片: {image_path}")
            return True

        except Exception as e:
            logger.error(f"PNG元数据嵌入失败: {e}")
            return False

    @staticmethod
    def _embed_metadata_jpeg(img: Image.Image, image_path: Path, metadata_json: str) -> bool:
        """在JPEG图片中嵌入元数据"""
        try:
            # 获取现有的EXIF数据
            exif_dict = img.getexif()

            # 添加AIGC元数据到EXIF的ImageDescription字段
            # ImageDescription对应的EXIF标签是270
            exif_dict[270] = f"{AigcMetadataUtil.METADATA_KEY}: {metadata_json}"

            # 保存图片时包含EXIF数据
            img.save(str(image_path), exif=exif_dict, quality=95, optimize=True)
            logger.debug(f"成功嵌入JPEG元数据到图片: {image_path}")
            return True

        except Exception as e:
            logger.error(f"JPEG元数据嵌入失败: {e}")
            return False

    @staticmethod
    async def embed_pptx_metadata(pptx_path: str, aigc_params: Optional[AigcMetadataParams] = None) -> None:
        """
        在PPTX文件中嵌入AIGC签名元数据

        Args:
            pptx_path: PPTX文件路径
            aigc_params: AIGC元数据参数对象

        Raises:
            FileNotFoundError: PPTX文件不存在
            Exception: 元数据嵌入过程中发生的任何错误
        """
        pptx_path = Path(pptx_path)
        if not pptx_path.exists():
            raise FileNotFoundError(f"PPTX文件不存在: {pptx_path}")

        # 使用现有的create_signed_metadata方法创建包含签名的完整元数据
        metadata_json = await AigcMetadataUtil.create_signed_metadata(
            str(pptx_path), aigc_params
        )

        # 打开PPTX文件
        prs = Presentation(str(pptx_path))

        # 获取核心属性
        core_props = prs.core_properties

        # 将签名元数据存储在subject字段，格式：Aigc: {JSON字符串}
        core_props.subject = f"Aigc: {metadata_json}"

        # 保存PPTX文件
        prs.save(str(pptx_path))
        logger.info(f"成功嵌入PPTX元数据到文件: {pptx_path}")

    @staticmethod
    async def embed_pdf_metadata(pdf_path: str, aigc_params: Optional[AigcMetadataParams] = None) -> None:
        """
        在PDF文件中嵌入AIGC签名元数据

        Args:
            pdf_path: PDF文件路径
            aigc_params: AIGC元数据参数对象

        Raises:
            FileNotFoundError: PDF文件不存在
            ImportError: PyMuPDF库未安装
            Exception: 元数据嵌入过程中发生的任何错误
        """

        pdf_path = Path(pdf_path)
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF文件不存在: {pdf_path}")

        # 使用现有的create_signed_metadata方法创建包含签名的完整元数据
        metadata_json = await AigcMetadataUtil.create_signed_metadata(
            str(pdf_path), aigc_params
        )

        # 打开PDF文件
        doc = fitz.open(str(pdf_path))

        # 获取现有的元数据
        metadata = doc.metadata

        # 将签名元数据存储在自定义字段中，格式与PPTX保持一致：Aigc: {JSON字符串}
        # 使用subject字段存储AIGC元数据，因为它通常有足够的空间且不会与其他应用冲突
        metadata["subject"] = f"Aigc: {metadata_json}"

        # 设置更新后的元数据
        doc.set_metadata(metadata)

        # 保存PDF文件 - 创建临时文件然后替换原文件
        temp_path = str(pdf_path) + ".tmp"
        doc.save(temp_path)
        doc.close()

        # 替换原文件
        import shutil
        shutil.move(temp_path, str(pdf_path))

        logger.info(f"成功嵌入PDF元数据到文件: {pdf_path}")
