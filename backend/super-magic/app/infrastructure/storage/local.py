"""
Local file storage implementation.
"""

import asyncio
import io
import os
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, BinaryIO, Dict, Optional, Tuple

import aiohttp
from loguru import logger

from .base import AbstractStorage, BaseFileProcessor, with_refreshed_credentials
from .exceptions import (
    DownloadException,
    DownloadExceptionCode,
    InitException,
    InitExceptionCode,
    UploadException,
    UploadExceptionCode,
)
from .types import BaseStorageCredentials, FileContent, LocalCredentials, Options, PlatformType, StorageResponse


class LocalStorage(AbstractStorage, BaseFileProcessor):
    """Local storage implementation for file operations."""

    # 从环境变量读取配置，提供默认值
    DEFAULT_HOST = os.environ.get('LOCAL_STORAGE_HOST', "")
    DEFAULT_DIR = os.environ.get('LOCAL_STORAGE_DIR', ".workspace")
    DEFAULT_READ_HOST = os.environ.get('LOCAL_STORAGE_READ_HOST', "")
    DEFAULT_EXPIRY_DURATION = int(os.environ.get('LOCAL_STORAGE_EXPIRY', "3600"))  # 默认凭证有效期（秒）
    DEFAULT_TIMEOUT = int(os.environ.get('LOCAL_STORAGE_TIMEOUT', "10"))  # 默认请求超时时间（秒）
    MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024  # 5GB 最大文件大小

    def set_credentials(self, credentials: BaseStorageCredentials) -> None:
        """
        设置存储凭证
        
        Args:
            credentials: 存储凭证对象或字典
            
        Raises:
            ValueError: 如果凭证格式无效或类型不正确
        """
        if not isinstance(credentials, LocalCredentials):
            if isinstance(credentials, dict):
                try:
                    credentials = LocalCredentials(**credentials)
                except Exception as e:
                    logger.error(f"解析本地存储凭证失败: {e}")
                    raise ValueError(f"无效的凭证格式: {e}")
            else:
                raise ValueError(f"期望LocalCredentials类型，得到{type(credentials)}")
        self.credentials = credentials

    def _should_refresh_credentials_impl(self) -> bool:
        """
        检查是否应该刷新凭证的特定逻辑
        
        Returns:
            bool: 如果凭证需要刷新则为True，否则为False
        """
        if not self.credentials:
            return True

        credentials: LocalCredentials = self.credentials
        if credentials.expires is None:
            return False

        # 提前180秒刷新
        return time.time() > credentials.expires - 180

    def _create_default_credentials(self) -> LocalCredentials:
        """
        创建默认的本地存储凭证
        
        Returns:
            LocalCredentials: 默认的本地存储凭证对象
        """
        default_credential_id = f"local_credential:default_{int(time.time())}"
        default_data = {
            "platform": "local",
            "temporary_credential": {
                "host": self.DEFAULT_HOST,
                "dir": self.DEFAULT_DIR,
                "read_host": self.DEFAULT_READ_HOST,
                "credential": default_credential_id
            },
            "expires": int(time.time()) + self.DEFAULT_EXPIRY_DURATION
        }
        return LocalCredentials(**default_data)

    async def _refresh_credentials_impl(self) -> None:
        """
        执行刷新凭证操作
        
        Raises:
            InitException: 如果无法获取有效凭证
        """
        logger.info("开始获取本地存储凭证")

        # 如果没有配置 STS 刷新，抛出异常
        if not self.sts_refresh_config:
            error_msg = "未配置STS刷新，无法获取本地存储凭证"
            logger.error(error_msg)
            raise InitException(InitExceptionCode.CREDENTIAL_ERROR, error_msg)

        # 准备JSON数据
        json_data = {"metadata": self.metadata} if self.metadata else {}

        try:
            async with self._create_client_session() as session:
                try:
                    async with session.request(
                        method=self.sts_refresh_config.method,
                        url=self.sts_refresh_config.url,
                        headers=self.sts_refresh_config.headers,
                        json=json_data,
                        timeout=self.DEFAULT_TIMEOUT
                    ) as response:
                        response.raise_for_status()
                        response_body = await response.json()

                        # 检查响应数据
                        credential_data = response_body.get("data")
                        if not credential_data:
                            error_msg = "获取本地存储凭证响应中缺少data字段"
                            logger.error(error_msg)
                            raise InitException(InitExceptionCode.CREDENTIAL_ERROR, error_msg)

                        try:
                            self.credentials = LocalCredentials(**credential_data)

                            # 验证必要字段
                            if not self.credentials.temporary_credential or not self.credentials.temporary_credential.dir:
                                error_msg = "凭证中缺少必要的dir字段"
                                logger.error(error_msg)
                                raise InitException(InitExceptionCode.CREDENTIAL_ERROR, error_msg)

                            logger.info("本地存储凭证获取成功")
                        except Exception as e:
                            error_msg = f"解析凭证数据失败: {e}"
                            logger.error(error_msg)
                            raise InitException(InitExceptionCode.CREDENTIAL_ERROR, error_msg)
                except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                    error_msg = f"请求本地存储凭证API失败: {e}"
                    logger.error(error_msg)
                    raise InitException(InitExceptionCode.CREDENTIAL_ERROR, error_msg)
        except InitException:
            # 直接传递InitException
            raise
        except Exception as e:
            error_msg = f"获取本地存储凭证失败: {e}"
            logger.error(error_msg)
            raise InitException(InitExceptionCode.CREDENTIAL_ERROR, error_msg)

    @asynccontextmanager
    async def _create_client_session(self) -> AsyncGenerator[aiohttp.ClientSession, None]:
        """
        创建HTTP客户端会话的上下文管理器
        
        Yields:
            aiohttp.ClientSession: HTTP客户端会话
        """
        session = aiohttp.ClientSession()
        try:
            yield session
        finally:
            await session.close()

    @with_refreshed_credentials
    async def upload(
        self,
        file: FileContent,
        key: str,
        options: Optional[Options] = None
    ) -> StorageResponse:
        """
        异步使用HTTP POST上传文件到本地存储接口。
        
        Args:
            file: 文件对象，文件路径或文件内容
            key: 文件名/路径
            options: 可选配置，包括headers和progress回调
        
        Returns:
            StorageResponse: 标准化的响应对象
        
        Raises:
            InitException: 如果必要参数缺失或文件过大
            UploadException: 如果上传失败（凭证过期或网络问题）
            ValueError: 如果文件类型不支持或凭证类型错误或未设置元数据
        """
        # 处理文件并确保最终关闭
        file_obj = None
        try:
            # 验证凭证
            credentials = self._validate_credentials()

            # 处理文件
            file_obj, file_size = self.process_file(file)
            self._check_file_size(file_obj, file_size, key, is_path=isinstance(file, str))

            # 获取上传URL和凭证
            upload_url, credential = self._get_upload_details(credentials)

            # 准备请求数据
            data, headers = self._prepare_upload_request(file_obj, key, credential, options or {})

            # 发送上传请求并处理响应
            return await self._send_upload_request(upload_url, data, headers, key, credentials)

        except Exception as e:
            self._handle_upload_exception(e)
        finally:
            # 确保关闭文件（如果是我们打开的）
            if file_obj and isinstance(file, str):
                try:
                    file_obj.close()
                except Exception as e:
                    logger.debug(f"关闭文件时出错 (可忽略): {e}")

    def _validate_credentials(self) -> LocalCredentials:
        """
        验证凭证是否有效
        
        Returns:
            LocalCredentials: 验证通过的凭证
            
        Raises:
            UploadException: 如果凭证无效
        """
        credentials: LocalCredentials = self.credentials
        if not credentials or not credentials.temporary_credential:
            error_msg = "凭证无效或临时凭证缺失"
            logger.error(error_msg)
            raise UploadException(UploadExceptionCode.CREDENTIALS_EXPIRED, error_msg)
        return credentials

    def _check_file_size(self, file_obj: BinaryIO, file_size: int, key: str, is_path: bool) -> None:
        """
        检查文件大小是否超过限制
        
        Args:
            file_obj: 文件对象
            file_size: 文件大小
            key: 文件键
            is_path: 是否为文件路径
            
        Raises:
            InitException: 如果文件过大
        """
        if file_size > self.MAX_FILE_SIZE:
            if is_path:
                file_obj.close()
            raise InitException(
                InitExceptionCode.FILE_TOO_LARGE,
                "local",
                file_name=key
            )

    def _get_upload_details(self, credentials: LocalCredentials) -> Tuple[str, str]:
        """
        获取上传URL和凭证
        
        Args:
            credentials: 凭证对象
            
        Returns:
            Tuple[str, str]: 上传URL和凭证ID
            
        Raises:
            UploadException: 如果上传URL无效
        """
        tc = credentials.temporary_credential
        upload_url = tc.host
        credential = tc.credential

        if not upload_url:
            error_msg = "上传URL不能为空"
            logger.error(error_msg)
            raise UploadException(UploadExceptionCode.CREDENTIALS_EXPIRED, error_msg)

        return upload_url, credential

    def _prepare_upload_request(
        self, 
        file_obj: BinaryIO, 
        key: str, 
        credential: str, 
        options: Dict[str, Any]
    ) -> Tuple[aiohttp.FormData, Dict[str, str]]:
        """
        准备上传请求的FormData和headers
        
        Args:
            file_obj: 文件对象
            key: 文件键
            credential: 凭证ID
            options: 可选配置
            
        Returns:
            Tuple[aiohttp.FormData, Dict[str, str]]: 表单数据和请求头
            
        Raises:
            ValueError: 如果文件对象类型不支持
        """
        # 准备headers
        headers = {
            'Accept': '*/*',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
        }

        # 添加可选headers
        if custom_headers := options.get('headers'):
            headers.update(custom_headers)

        # 准备表单数据
        data = aiohttp.FormData()

        # 添加key参数 - 文件路径/名称
        data.add_field('key', key)

        # 添加credential参数
        if credential:
            data.add_field('credential', credential)
        else:
            generated_credential = f"local_credential:default_{int(time.time())}"
            data.add_field('credential', generated_credential)
            logger.warning(f"凭证中缺少credential字段，使用生成的默认值: {generated_credential}")

        # 添加文件内容
        if hasattr(file_obj, 'read'):
            # 保存当前位置
            current_pos = file_obj.tell()
            # 重置到文件开始
            file_obj.seek(0)
            # 读取文件内容
            file_content = file_obj.read()
            # 重置到原始位置
            file_obj.seek(current_pos)

            # 添加到表单
            filename = os.path.basename(key)
            data.add_field('file', file_content, filename=filename)
        else:
            # 这种情况不应该发生，因为process_file已经转换为文件对象
            raise ValueError("无法处理的文件对象类型")

        return data, headers

    async def _send_upload_request(
        self, 
        upload_url: str, 
        data: aiohttp.FormData, 
        headers: Dict[str, str],
        key: str, 
        credentials: LocalCredentials
    ) -> StorageResponse:
        """
        发送上传请求并处理响应
        
        Args:
            upload_url: 上传URL
            data: 表单数据
            headers: 请求头
            key: 文件键
            credentials: 凭证对象
            
        Returns:
            StorageResponse: 上传响应
            
        Raises:
            UploadException: 如果上传失败或响应无效
        """
        async with self._create_client_session() as session:
            async with session.post(
                upload_url, 
                data=data, 
                headers=headers, 
                timeout=self.DEFAULT_TIMEOUT
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise UploadException(
                        UploadExceptionCode.NETWORK_ERROR, 
                        f"上传失败，服务器返回状态码: {response.status}, 错误: {error_text}"
                    )

                # 解析响应
                response_data = await self._parse_response(response)

                # 验证响应数据
                self._validate_response(response_data)

                # 获取上传后的key和URL
                uploaded_key = response_data["data"]["key"]
                url = self._build_file_url(credentials, uploaded_key)

                # 返回标准响应
                return StorageResponse(
                    key=uploaded_key,
                    platform=PlatformType.local,
                    headers=dict(response.headers) if response.headers else {},
                    url=url
                )

    async def _parse_response(self, response: aiohttp.ClientResponse) -> Dict[str, Any]:
        """
        解析响应JSON数据
        
        Args:
            response: 响应对象
            
        Returns:
            Dict[str, Any]: 解析后的响应数据
            
        Raises:
            UploadException: 如果解析失败
        """
        try:
            response_data = await response.json()
            logger.debug(f"本地存储上传响应: {response_data}")
            return response_data
        except Exception as e:
            logger.error(f"解析响应JSON失败: {e}")
            raise UploadException(
                UploadExceptionCode.INVALID_RESPONSE,
                f"解析响应JSON失败: {e}"
            )

    def _validate_response(self, response_data: Dict[str, Any]) -> None:
        """
        验证响应数据是否有效
        
        Args:
            response_data: 响应数据
            
        Raises:
            UploadException: 如果响应数据无效
        """
        if not response_data or "data" not in response_data:
            logger.error(f"响应中缺少data字段: {response_data}")
            raise UploadException(
                UploadExceptionCode.INVALID_RESPONSE,
                f"响应中缺少data字段: {response_data}"
            )

        if "key" not in response_data.get("data", {}):
            logger.error(f"响应data中缺少key字段: {response_data}")
            raise UploadException(
                UploadExceptionCode.INVALID_RESPONSE,
                f"响应data中缺少key字段: {response_data}"
            )

    def _build_file_url(self, credentials: LocalCredentials, key: str) -> Optional[str]:
        """
        构建文件URL
        
        Args:
            credentials: 凭证对象
            key: 文件键
            
        Returns:
            Optional[str]: 文件URL，如果无法构建则为None
        """
        base_url = credentials.get_public_access_base_url()
        return f"{base_url}/{key}" if base_url else None

    def _handle_upload_exception(self, exception: Exception) -> None:
        """
        处理上传过程中的异常
        
        Args:
            exception: 异常对象
            
        Raises:
            UploadException: 转换后的上传异常
            Exception: 原始异常（如果已经是特定异常类型）
        """
        if isinstance(exception, (InitException, UploadException)):
            raise exception
        logger.error(f"上传过程中发生意外错误: {exception}")
        raise UploadException(UploadExceptionCode.NETWORK_ERROR, str(exception))

    @with_refreshed_credentials
    async def download(
        self,
        key: str,
        options: Optional[Options] = None
    ) -> BinaryIO:
        """
        异步从本地存储下载文件。

        Args:
            key: 文件名/路径
            options: 可选配置

        Returns:
            BinaryIO: 文件内容的二进制流

        Raises:
            DownloadException: 如果下载失败
            ValueError: 如果凭证类型不正确或未设置元数据
        """
        options = options or {}
        credentials: LocalCredentials = self.credentials

        # 构建下载URL
        download_url = self._build_download_url(credentials, key)

        # 准备请求头
        headers = options.get('headers', {})

        try:
            async with self._create_client_session() as session:
                async with session.get(
                    download_url, 
                    headers=headers,
                    timeout=self.DEFAULT_TIMEOUT
                ) as response:
                    await self._handle_download_response(response, key)
                    # 读取文件内容
                    content = await response.read()
                    return io.BytesIO(content)
        except aiohttp.ClientError as e:
            logger.error(f"下载时发生网络错误: {e}")
            raise DownloadException(DownloadExceptionCode.NETWORK_ERROR, str(e))
        except Exception as e:
            if not isinstance(e, DownloadException):
                logger.error(f"下载时发生意外错误: {e}")
                raise DownloadException(DownloadExceptionCode.NETWORK_ERROR, str(e))
            raise

    def _build_download_url(self, credentials: LocalCredentials, key: str) -> str:
        """
        构建下载URL
        
        Args:
            credentials: 凭证对象
            key: 文件键
            
        Returns:
            str: 下载URL
            
        Raises:
            DownloadException: 如果无法构建URL
        """
        base_url = credentials.get_public_access_base_url()
        if not base_url:
            raise DownloadException(
                DownloadExceptionCode.INVALID_RESPONSE,
                "无法构建下载URL，缺少 read_host"
            )
        return f"{base_url}/{key}"

    async def _handle_download_response(
        self, 
        response: aiohttp.ClientResponse, 
        key: str
    ) -> None:
        """
        处理下载响应
        
        Args:
            response: 响应对象
            key: 文件键
            
        Raises:
            DownloadException: 如果响应状态码不为200
        """
        if response.status != 200:
            error_text = await response.text()
            if response.status == 404:
                raise DownloadException(
                    DownloadExceptionCode.FILE_NOT_FOUND,
                    f"文件不存在: {key}"
                )
            else:
                raise DownloadException(
                    DownloadExceptionCode.NETWORK_ERROR,
                    f"下载失败，服务器返回状态码: {response.status}, 错误: {error_text}"
                )

    @with_refreshed_credentials
    async def exists(
        self,
        key: str,
        options: Optional[Options] = None
    ) -> bool:
        """
        异步检查本地存储中是否存在指定的文件。

        Args:
            key: 文件名/路径
            options: 可选配置

        Returns:
            bool: 如果文件存在则为True，否则为False
        """
        options = options or {}
        credentials: LocalCredentials = self.credentials

        # 构建URL
        base_url = credentials.get_public_access_base_url()
        if not base_url:
            logger.warning("无法构建URL检查文件是否存在，缺少 read_host")
            return False

        url = f"{base_url}/{key}"
        headers = options.get('headers', {})

        try:
            async with self._create_client_session() as session:
                async with session.head(
                    url, 
                    headers=headers,
                    timeout=self.DEFAULT_TIMEOUT
                ) as response:
                    return response.status == 200
        except Exception as e:
            logger.error(f"检查文件存在性时发生错误: {e}")
            return False 
