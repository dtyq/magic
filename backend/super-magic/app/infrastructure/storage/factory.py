"""
Storage factory module.
"""

import os
from typing import Dict, Type, Optional

from loguru import logger

from .base import AbstractStorage
from .types import PlatformType, BaseStorageCredentials
from .volcengine import VolcEngineUploader
from .local import LocalStorage
from .aliyun import AliyunOSSUploader
from .s3 import S3Uploader
from app.core.entity.message.client_message import STSTokenRefreshConfig

class StorageFactory:
    """存储工厂类，用于创建不同平台的存储实例。"""

    _instances: Dict[PlatformType, AbstractStorage] = {}
    _implementations: Dict[PlatformType, Type[AbstractStorage]] = {
        PlatformType.tos: VolcEngineUploader,
        PlatformType.aliyun: AliyunOSSUploader,
        PlatformType.local: LocalStorage,
        PlatformType.minio: S3Uploader,
        # 在这里添加其他平台的实现
    }

    @classmethod
    async def get_storage(
        cls,
        sts_token_refresh: Optional[STSTokenRefreshConfig] = None,
        metadata: Optional[Dict] = None,
        platform: Optional[PlatformType] = None
    ) -> AbstractStorage:
        """
        获取指定平台的存储实例。
        使用单例模式，确保每个平台只创建一个实例。

        优先使用 platform 参数来确定存储平台类型，仅当该参数未提供时，
        才会从环境变量 STORAGE_PLATFORM 中获取，若环境变量也未设置则默认使用 'tos'。

        Args:
            sts_token_refresh: STS Token刷新配置（可选）
            metadata: 元数据，用于凭证刷新（可选）
            platform: 指定使用的存储平台类型（可选）。优先级高于环境变量。

        Returns:
            AbstractStorage: 存储平台的实例

        Raises:
            ValueError: 如果指定的平台类型不支持或无效
        """
        # 如果未指定平台，则从环境变量获取
        if platform is None:
            platform_str = os.environ.get('STORAGE_PLATFORM', 'tos').lower()
            try:
                platform = PlatformType(platform_str)
            except ValueError:
                raise ValueError(f"环境变量 STORAGE_PLATFORM 中指定的平台名称 '{platform_str}' 无效或不支持。请检查配置。")

        # 确保我们使用正确的平台类型（防止在metadata或凭证中可能存在的不匹配）
        logger.info(f"获取存储服务实例: 平台类型={platform.value}")

        # 如果平台的实例不存在，创建新实例
        if platform not in cls._instances:
            if platform not in cls._implementations:
                raise ValueError(f"不支持的存储平台: {platform.value}")

            implementation = cls._implementations[platform]
            cls._instances[platform] = implementation()
            logger.info(f"为平台 {platform.value} 创建了新的存储服务实例")

        storage_service = cls._instances[platform]

        # 设置刷新配置和元数据
        storage_service.set_sts_refresh_config(sts_token_refresh)
        storage_service.set_metadata(metadata)

        # refresh_credentials() 确保在获取服务实例时，凭证是最新的 (尤其对于STS)
        # 如果有凭证刷新配置，则刷新凭证
        if sts_token_refresh:
            try:
                await storage_service.refresh_credentials()
                logger.info(f"已成功刷新 {platform.value} 平台的存储凭证")
            except Exception as e:
                logger.error(f"刷新 {platform.value} 平台凭证时发生错误: {e}")
                # 这里可以选择继续或者抛出异常，取决于业务需求

        return storage_service

    @classmethod
    def register_implementation(
        cls,
        platform: PlatformType,
        implementation: Type[AbstractStorage]
    ) -> None:
        """
        注册新的存储平台实现。

        Args:
            platform: 存储平台类型
            implementation: 存储平台的实现类

        Raises:
            ValueError: 如果实现类不是 AbstractStorage 的子类
        """
        if not issubclass(implementation, AbstractStorage):
            raise ValueError(
                f"Implementation must be a subclass of AbstractStorage, got {implementation}"
            )

        cls._implementations[platform] = implementation
        # 清除已存在的实例，以便使用新的实现
        if platform in cls._instances:
            del cls._instances[platform]
