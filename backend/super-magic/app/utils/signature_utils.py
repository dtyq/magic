"""
签名工具类

用于计算图片MD5哈希和调用Magic Gateway签名API的统一工具类
"""

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Optional, Dict, Any
from loguru import logger

from app.core.entity.aigc_metadata import AigcMetadataParams
from app.infrastructure.sdk.magic_gateway import get_magic_gateway_sdk, SignParameter
from app.infrastructure.sdk.magic_gateway.exceptions import MagicGatewayException


class SignatureUtil:
    """签名工具类"""

    @staticmethod
    def calculate_file_md5(file_path: str) -> str:
        """
        计算文件的MD5哈希值

        Args:
            file_path: 文件路径

        Returns:
            str: MD5哈希值（十六进制字符串）

        Raises:
            FileNotFoundError: 如果文件不存在
            Exception: 如果计算过程中发生错误
        """
        try:
            file_path = Path(file_path)
            if not file_path.exists():
                raise FileNotFoundError(f"文件不存在: {file_path}")

            md5_hash = hashlib.md5()
            with open(file_path, 'rb') as f:
                # 分块读取文件，避免大文件占用过多内存
                for chunk in iter(lambda: f.read(4096), b""):
                    md5_hash.update(chunk)

            hash_value = md5_hash.hexdigest()
            logger.debug(f"计算文件MD5成功: {file_path} -> {hash_value}")
            return hash_value

        except FileNotFoundError:
            raise
        except Exception as e:
            logger.error(f"计算文件MD5失败 {file_path}: {e}")
            raise

    @staticmethod
    async def sign_data(data: str) -> str:
        """
        对数据进行签名

        Args:
            data: 要签名的数据字符串

        Returns:
            str: 签名结果

        Raises:
            MagicGatewayException: 如果签名过程中发生错误
        """
        # 获取Magic Gateway SDK实例
        gateway = get_magic_gateway_sdk()

        # 创建签名参数
        param = SignParameter(data)

        # 执行签名
        result = await gateway.sign.sign_async(param)
        signature = result.get_signature()

        logger.debug(f"数据签名成功: {data[:50]}... -> {signature[:20]}...")
        return signature

    @staticmethod
    async def sign_file(file_path: str) -> str:
        """
        对文件进行签名（先计算MD5，再对MD5进行签名）

        Args:
            file_path: 文件路径

        Returns:
            str: 签名结果

        Raises:
            FileNotFoundError: 如果文件不存在
            MagicGatewayException: 如果签名过程中发生错误
        """
        # 1. 计算文件MD5
        md5_hash = SignatureUtil.calculate_file_md5(file_path)

        # 2. 对MD5进行签名
        signature = await SignatureUtil.sign_data(md5_hash)

        logger.info(f"文件签名成功: {file_path} -> MD5: {md5_hash} -> 签名: {signature[:20]}...")
        return signature

    @staticmethod
    async def sign_metadata(metadata: Dict[str, Any]) -> str:
        """
        对元数据进行签名

        Args:
            metadata: 元数据字典

        Returns:
            str: 签名结果

        Raises:
            MagicGatewayException: 如果签名过程中发生错误
        """
        # 将元数据转换为JSON字符串
        metadata_json = json.dumps(metadata, ensure_ascii=False, sort_keys=True)

        # 对JSON字符串进行签名
        signature = await SignatureUtil.sign_data(metadata_json)

        logger.info(f"元数据签名成功: {len(metadata_json)}字符 -> 签名: {signature[:20]}...")
        return signature

    @staticmethod
    async def create_signed_metadata(
        file_path: str,
        aigc_params: Optional[AigcMetadataParams] = None
    ) -> Dict[str, Any]:
        """
        创建包含签名的元数据

        Args:
            file_path: 文件路径（必须提供）
            aigc_params: AIGC元数据参数对象

        Returns:
            Dict: 包含签名的元数据字典

        Raises:
            MagicGatewayException: 如果签名过程中发生错误
        """
        # 如果没有提供参数，使用空对象
        if aigc_params is None:
            aigc_params = AigcMetadataParams()

        # 从环境变量获取 ContentProducter
        content_producer = os.getenv("CONTENT_PRODUCER", "001191440300MA5HTEC8X100000")
        created_at = str(int(time.time()))

        # 创建基础元数据
        metadata = {
            "Label": "2",
            "ContentProducter": content_producer,
            "ProduceID": f"{aigc_params.user_id}+{aigc_params.organization_code}+{aigc_params.topic_id}+{created_at}"
        }

        # 计算元数据签名
        metadata_sign = await SignatureUtil.sign_metadata(metadata)

        # 计算文件签名（暂时不需要文件内容签名）
        # file_sign = await SignatureUtil.sign_file(file_path)

        # 添加签名字段到元数据（只使用元数据签名，不需要文件内容签名）
        # metadata["ReservedCode1"] = f"{metadata_sign}+{file_sign}"
        metadata["ReservedCode1"] = metadata_sign

        logger.info(f"创建签名元数据成功: 文件={file_path}, 用户={aigc_params.user_id}, 组织={aigc_params.organization_code}, 话题={aigc_params.topic_id}")
        return metadata
