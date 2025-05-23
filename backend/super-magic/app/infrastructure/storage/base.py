"""
Base classes and utilities for storage SDK.
"""

import io
import os
import functools
import time
import json
import uuid
from pathlib import Path
from abc import ABC, abstractmethod
from typing import BinaryIO, Dict, Optional, Callable, TypeVar, Any

from loguru import logger

from app.core.config.communication_config import STSTokenRefreshConfig
from app.paths import PathManager
from .types import BaseStorageCredentials, FileContent, Options, StorageResponse, PlatformType


T = TypeVar('T')

def with_refreshed_credentials(method: Callable[..., T]) -> Callable[..., T]:
    """
    装饰器：确保使用最新的凭证执行存储操作

    自动处理凭证刷新
    """
    @functools.wraps(method)
    async def wrapper(self, *args, **kwargs):
        await self.refresh_credentials()

        return await method(self, *args, **kwargs)

    return wrapper


class AbstractStorage(ABC):
    """抽象存储类，定义存储操作的接口。"""

    def __init__(self):
        self.credentials: Optional[BaseStorageCredentials] = None
        self.sts_refresh_config: Optional[STSTokenRefreshConfig] = None
        self.metadata: Optional[Dict] = None

    def set_credentials(self, credentials: BaseStorageCredentials):
        """设置存储凭证"""
        self.credentials = credentials

    def set_sts_refresh_config(self, config: Optional[STSTokenRefreshConfig]):
        """设置STS Token刷新配置"""
        self.sts_refresh_config = config

    def set_metadata(self, metadata: Optional[Dict]):
        """设置元数据，用于凭证刷新"""
        self.metadata = metadata

    def get_platform_name(self) -> str:
        """
        获取当前存储服务的平台名称。
        如果凭证中有平台信息，则返回该平台名称，否则返回 'unknown'。

        Returns:
            str: 存储平台名称
        """
        if self.credentials and hasattr(self.credentials, 'platform'):
            if isinstance(self.credentials.platform, PlatformType):
                return self.credentials.platform.value
            return str(self.credentials.platform)
        return "unknown"

    def get_platform_type(self) -> Optional[PlatformType]:
        """
        获取当前存储服务的平台类型。
        如果凭证中有平台信息且类型为 PlatformType，则返回该平台类型，否则返回 None。

        Returns:
            Optional[PlatformType]: 存储平台类型，如果无法确定则返回 None
        """
        if self.credentials and hasattr(self.credentials, 'platform'):
            if isinstance(self.credentials.platform, PlatformType):
                return self.credentials.platform
            try:
                return PlatformType(str(self.credentials.platform))
            except (ValueError, TypeError):
                pass
        return None

    async def refresh_credentials(self):
        """
        如果需要则刷新凭证 - 模板方法
        """
        if self._should_refresh_credentials():
            logger.info("开始刷新凭证")

            # 调用子类实现的刷新方法
            await self._refresh_credentials_impl()

            logger.info("凭证刷新完成")

            # 刷新后自动保存到文件
            if self.credentials:
                await self._save_credentials_to_file()

    def _should_refresh_credentials(self) -> bool:
        """
        判断是否需要刷新凭证 - 模板方法
        """
        # 基础检查：如果没有刷新配置或元数据，不需要刷新
        if not self.sts_refresh_config or self.metadata is None:
            return False

        # 子类特定的检查逻辑
        return self._should_refresh_credentials_impl()

    def _should_refresh_credentials_impl(self) -> bool:
        """
        子类特定的凭证刷新检查逻辑，由子类实现
        """
        raise NotImplementedError("子类必须实现此方法")

    @abstractmethod
    async def _refresh_credentials_impl(self):
        """
        实际执行刷新凭证的操作，由子类实现
        """
        raise NotImplementedError("子类必须实现此方法")

    async def _save_credentials_to_file(self):
        """
        将凭证保存到本地文件
        """
        project_dir = PathManager.get_project_root()
        credentials_dir = Path(project_dir) / ".credentials"
        os.makedirs(credentials_dir, exist_ok=True)
        file_path = credentials_dir / "upload_credentials.json"
        credentials_data = self.credentials.model_dump()

        # 创建带有批次ID的凭证数据
        wrapped_data = {
            "upload_config": credentials_data,
            "batch_id": str(uuid.uuid4())  # 添加随机批次ID
        }

        with open(file_path, "w") as f:
            json.dump(wrapped_data, f, indent=2)

        logger.info(f"成功保存凭证到文件: {file_path}, 批次ID: {wrapped_data['batch_id']}")

    @abstractmethod
    async def upload(
        self,
        file: FileContent,
        key: str,
        options: Optional[Options] = None
    ) -> StorageResponse:
        """
        异步上传文件到存储平台。

        Args:
            file: 文件内容（可以是文件路径、字节数据或文件对象）
            key: 文件名/路径
            options: 可选配置（如进度回调、HTTP头等）

        Returns:
            StorageResponse: 标准化的上传响应

        Raises:
            InitException: 如果初始化参数缺失或文件过大
            UploadException: 如果上传失败（凭证过期或网络问题）
            ValueError: 如果文件类型不支持或凭证类型错误或未设置元数据
        """
        raise NotImplementedError("子类必须实现此方法")

    @abstractmethod
    async def download(
        self,
        key: str,
        options: Optional[Options] = None
    ) -> BinaryIO:
        """
        异步从存储平台下载文件。

        Args:
            key: 文件名/路径
            options: 可选配置（如进度回调、HTTP头等）

        Returns:
            BinaryIO: 文件内容的二进制流

        Raises:
            InitException: 如果初始化参数缺失
            DownloadException: 如果下载失败（凭证过期或网络问题）
            ValueError: 如果凭证类型错误或未设置元数据
        """
        raise NotImplementedError("子类必须实现此方法")

    @abstractmethod
    async def exists(
        self,
        key: str,
        options: Optional[Options] = None
    ) -> bool:
        """
        异步检查存储平台上是否存在指定的文件。

        Args:
            key: 文件名/路径
            options: 可选配置

        Returns:
            bool: 如果文件存在则为True，否则为False

        Raises:
            InitException: 如果初始化参数缺失
            ValueError: 如果凭证类型错误或未设置元数据
        """
        raise NotImplementedError("子类必须实现此方法")

class BaseFileProcessor:
    """Base class for file processing operations."""

    @staticmethod
    def process_file(file: FileContent) -> tuple[BinaryIO, int]:
        """
        Process file input and return file object and size.

        Args:
            file: File content in various formats (path, bytes, or file object)

        Returns:
            tuple: (file_object, file_size)

        Raises:
            ValueError: If file type is not supported
        """
        try:
            if isinstance(file, str) and os.path.isfile(file):
                # If file is a file path
                file_size = os.path.getsize(file)
                file_obj = open(file, 'rb')
            elif hasattr(file, 'read') and callable(file.read):
                # If file is a file object
                if hasattr(file, 'seek') and callable(file.seek) and hasattr(file, 'tell') and callable(file.tell):
                    current_pos = file.tell()
                    file.seek(0, os.SEEK_END)
                    file_size = file.tell()
                    file.seek(current_pos)
                else:
                    file_size = 0  # Cannot determine size
                file_obj = file
            elif isinstance(file, bytes):
                # If file is bytes data
                file_size = len(file)
                file_obj = io.BytesIO(file)
            else:
                raise ValueError("Unsupported file type. Must be a file path, file object, or bytes")

            return file_obj, file_size

        except Exception as e:
            logger.error(f"Error processing file: {e}")
            raise

    @staticmethod
    def combine_path(dir_path: str, file_path: str) -> str:
        """
        Combine directory path and file path ensuring only one separator between them.

        Args:
            dir_path: Directory path
            file_path: File path or key

        Returns:
            str: Combined path with a single separator
        """
        clean_dir = dir_path.rstrip('/')  # 移除目录末尾的斜杠
        clean_file = file_path.lstrip('/')  # 移除文件路径开头的斜杠
        return f"{clean_dir}/{clean_file}"

class ProgressTracker:
    """Base progress tracker for file upload."""
    def __init__(self, callback: callable):
        """
        Initialize progress tracker.

        Args:
            callback: Function to call with progress updates
        """
        self.callback = callback
        self.total_size = 0
        self.uploaded = 0

    def __call__(self, monitor):
        """
        Update progress based on monitor data.

        Args:
            monitor: Upload monitor object with bytes_read and len attributes
        """
        self.uploaded = monitor.bytes_read
        if monitor.len and monitor.len > 0:
            progress = (self.uploaded / monitor.len) * 100
            self.callback(min(progress, 100.0))
