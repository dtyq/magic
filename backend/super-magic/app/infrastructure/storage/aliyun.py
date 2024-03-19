"""
Aliyun OSS upload implementation with multipart upload support for files > 2MB.
"""

import asyncio
import io
import os
import time
from typing import BinaryIO, Dict, Optional

import aiohttp
from loguru import logger
import oss2
from oss2 import SizedFileAdapter, determine_part_size
from oss2.models import PartInfo

from .base import AbstractStorage, BaseFileProcessor, with_refreshed_credentials
from .exceptions import (
    DownloadException,
    DownloadExceptionCode,
    InitException,
    InitExceptionCode,
    UploadException,
    UploadExceptionCode,
)
from .types import AliyunCredentials, BaseStorageCredentials, FileContent, Options, PlatformType, StorageResponse


class AliyunOSSUploader(AbstractStorage, BaseFileProcessor):
    """Aliyun OSS uploader implementation with multipart upload support."""

    # 文件大小阈值，超过此大小使用分片上传
    MULTIPART_THRESHOLD = 1 * 1024 * 1024  # 1MB，适合测试环境小带宽

    # 分片大小配置
    PART_SIZE = 1 * 1024 * 1024  # 1MB，阿里云OSS推荐的默认分片大小，适合小带宽
    MAX_PART_SIZE = 5 * 1024 * 1024 * 1024  # 5GB
    MIN_PART_SIZE = 100 * 1024  # 100KB，阿里云OSS最小分片要求

    # 超时配置
    CONNECT_TIMEOUT = 120  # 连接超时增加到120秒
    READ_TIMEOUT = 300  # 读取超时增加到300秒

    # 重试配置
    MAX_RETRIES = 3
    RETRY_DELAY = 1  # 初始重试延迟1秒，指数退避

    def set_credentials(self, credentials: BaseStorageCredentials):
        """设置存储凭证"""
        if not isinstance(credentials, AliyunCredentials):
            if isinstance(credentials, dict):
                try:
                    # 现在可以直接实例化，Pydantic模型内部的验证器会处理结构转换
                    parsed_credentials = AliyunCredentials(**credentials)
                except Exception as e:
                    # 捕获Pydantic验证错误或任何其他初始化错误
                    logger.error(f"Error parsing Aliyun credentials: {e}\nInput data: {credentials}") # Log input data for debugging
                    raise ValueError(f"无效的凭证格式或转换失败: {e}")
                self.credentials = parsed_credentials # 使用成功解析和转换后的凭证
            else:
                raise ValueError(f"期望AliyunCredentials或dict类型，得到{type(credentials)}")
        else:
            self.credentials = credentials # It's already an AliyunCredentials instance

    def _should_refresh_credentials_impl(self) -> bool:
        """检查是否应该刷新凭证的特定逻辑"""
        if not self.credentials:
            return True

        if not isinstance(self.credentials, AliyunCredentials):
            return True

        credentials: AliyunCredentials = self.credentials
        if credentials.expire is None:
            return False

        # 提前180秒刷新
        return time.time() > credentials.expire - 180

    async def _refresh_credentials_impl(self):
        """执行刷新凭证操作"""
        logger.info("开始获取阿里云OSS STS Token")

        # 前提条件检查已经在 _should_refresh_credentials 中完成
        if not self.sts_refresh_config:
            logger.error("STS refresh config is not available")
            return

        json_data = {}
        if self.metadata:
            json_data["metadata"] = self.metadata

        timeout = aiohttp.ClientTimeout(
            total=self.READ_TIMEOUT,
            connect=self.CONNECT_TIMEOUT
        )

        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.request(
                method=self.sts_refresh_config.method,
                url=self.sts_refresh_config.url,
                headers=self._get_sts_refresh_headers(),
                json=json_data
            ) as response:
                response.raise_for_status()
                responseBody = await response.json()

                actual_credential_data_wrapper = responseBody.get("data", {})
                if not actual_credential_data_wrapper:
                    logger.error("STS refresh response missing 'data' field or 'data' field is empty.")
                    # Consider raising an exception here if this is a critical failure
                    return

                try:
                    # 直接使用 actual_credential_data_wrapper，Pydantic模型内部的验证器会处理
                    self.credentials = AliyunCredentials(**actual_credential_data_wrapper)
                    logger.info("阿里云OSS STS Token获取成功 (通过Pydantic模型转换)")
                except Exception as e:
                    logger.error(f"解析刷新后的STS凭证失败: {e}\nInput data from STS: {actual_credential_data_wrapper}") # Log input for debugging
                    # 根据需要进行错误处理，例如 raise e
                    return

    def _get_bucket_client(self):
        """获取OSS Bucket客户端"""
        if not self.credentials:
            raise ValueError("未设置凭证")

        if not isinstance(self.credentials, AliyunCredentials):
            raise ValueError("凭证类型错误")

        credentials: AliyunCredentials = self.credentials
        oss_creds = credentials.credentials

        # 创建OSS身份验证对象
        auth = oss2.StsAuth(
            oss_creds.AccessKeyId,
            oss_creds.AccessKeySecret,
            oss_creds.SecurityToken
        )

        # 创建OSS Bucket对象
        bucket = oss2.Bucket(auth, credentials.endpoint, credentials.bucket)

        return bucket

    async def _simple_upload(self, file_obj, key: str, file_size: int):
        """简单上传，适用于小文件"""
        logger.info(f"使用简单上传方式，文件大小: {file_size} bytes")

        bucket = self._get_bucket_client()

        try:
            # 使用异步方式执行上传操作
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: bucket.put_object(key, file_obj)
            )

            return result

        except Exception as e:
            logger.error(f"简单上传失败: {e}")
            raise

    async def _multipart_upload(self, file_obj, key: str, file_size: int):
        """分片上传，适用于大文件"""
        logger.info(f"使用分片上传方式，文件大小: {file_size} bytes")

        bucket = self._get_bucket_client()

        # 计算分片大小
        part_size = determine_part_size(file_size, preferred_size=self.PART_SIZE)
        logger.info(f"计算出的分片大小: {part_size} bytes")

        # 初始化分片上传
        loop = asyncio.get_event_loop()
        upload_id = await loop.run_in_executor(
            None,
            lambda: bucket.init_multipart_upload(key).upload_id
        )

        logger.info(f"初始化分片上传成功，upload_id: {upload_id}")

        parts = []
        part_number = 1
        offset = 0

        try:
            while offset < file_size:
                # 计算当前分片的大小
                num_to_upload = min(part_size, file_size - offset)

                # 创建分片数据适配器
                file_obj.seek(offset)
                part_data = SizedFileAdapter(file_obj, num_to_upload)

                # 上传分片，带重试机制
                retry_count = 0
                while retry_count < self.MAX_RETRIES:
                    try:
                        logger.info(f"上传分片 {part_number}, 偏移量: {offset}, 大小: {num_to_upload}")

                        result = await loop.run_in_executor(
                            None,
                            lambda: bucket.upload_part(key, upload_id, part_number, part_data)
                        )

                        parts.append(PartInfo(part_number, result.etag))
                        logger.info(f"分片 {part_number} 上传成功，ETag: {result.etag}")
                        break

                    except Exception as e:
                        retry_count += 1
                        if retry_count >= self.MAX_RETRIES:
                            logger.error(f"分片 {part_number} 上传失败，已重试 {self.MAX_RETRIES} 次: {e}")
                            raise

                        wait_time = self.RETRY_DELAY * (2 ** (retry_count - 1))  # 指数退避
                        logger.warning(f"分片 {part_number} 上传失败，{wait_time}秒后重试 (第{retry_count}次): {e}")
                        await asyncio.sleep(wait_time)

                        # 重新创建分片数据适配器
                        file_obj.seek(offset)
                        part_data = SizedFileAdapter(file_obj, num_to_upload)

                offset += num_to_upload
                part_number += 1

            # 完成分片上传
            logger.info(f"所有分片上传完成，开始合并，总共 {len(parts)} 个分片")

            result = await loop.run_in_executor(
                None,
                lambda: bucket.complete_multipart_upload(key, upload_id, parts)
            )

            logger.info(f"分片上传合并完成，ETag: {result.etag}")
            return result

        except Exception as e:
            # 如果上传过程中出现错误，取消分片上传
            logger.error(f"分片上传过程中发生错误: {e}")
            try:
                await loop.run_in_executor(
                    None,
                    lambda: bucket.abort_multipart_upload(key, upload_id)
                )
                logger.info(f"已取消分片上传，upload_id: {upload_id}")
            except Exception as abort_error:
                logger.warning(f"取消分片上传失败: {abort_error}")

            raise

    @with_refreshed_credentials
    async def upload(
        self,
        file: FileContent,
        key: str,
        options: Optional[Options] = None
    ) -> StorageResponse:
        """
        异步使用OSS SDK上传文件到阿里云对象存储。
        对于大于2MB的文件自动使用分片上传。

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
        # 此时凭证已经由装饰器刷新过，直接使用self.credentials
        if options is None:
            options = {}

        # 处理文件
        try:
            file_obj, file_size = self.process_file(file)

            # 文件大小限制检查
            if file_size > 48.8 * 1024 * 1024 * 1024 * 1024:  # 48.8TB
                if isinstance(file, str):
                    file_obj.close()
                raise InitException(
                    InitExceptionCode.FILE_TOO_LARGE,
                    "aliyun",
                    file_name=key
                )

            try:
                # 根据文件大小选择上传方式
                if file_size > self.MULTIPART_THRESHOLD:
                    result = await self._multipart_upload(file_obj, key, file_size)
                else:
                    result = await self._simple_upload(file_obj, key, file_size)

                # 关闭文件（如果是我们打开的）
                if isinstance(file, str):
                    file_obj.close()

                # 获取响应头
                headers = {}
                if hasattr(result, 'headers'):
                    headers = dict(result.headers)

                # 返回标准响应
                return StorageResponse(
                    key=key,
                    platform=PlatformType.aliyun,
                    headers=headers,
                    url=None  # 添加默认值
                )

            except Exception as e:
                logger.error(f"OSS error during async upload: {e}")
                if isinstance(file, str):
                    file_obj.close()
                raise UploadException(UploadExceptionCode.NETWORK_ERROR, str(e))

        except Exception as e:
            # 确保文件被关闭
            if 'file_obj' in locals() and isinstance(file, str):
                try:
                    file_obj.close()
                except:
                    pass

            if not isinstance(e, (InitException, UploadException)):
                logger.error(f"Unexpected error during async upload: {e}")
                raise UploadException(UploadExceptionCode.NETWORK_ERROR, str(e))
            raise

    @with_refreshed_credentials
    async def download(
        self,
        key: str,
        options: Optional[Options] = None
    ) -> BinaryIO:
        """
        异步从阿里云对象存储下载文件。

        Args:
            key: 文件名/路径
            options: 可选配置

        Returns:
            BinaryIO: 文件内容的二进制流

        Raises:
            DownloadException: 如果下载失败
            ValueError: 如果凭证类型不正确或未设置元数据
        """
        # 此时凭证已经由装饰器刷新过，直接使用self.credentials

        if options is None:
            options = {}

        try:
            bucket = self._get_bucket_client()

            try:
                # 异步获取对象
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    None,
                    lambda: bucket.get_object(key)
                )

                # 读取内容到内存
                content = result.read()
                # 创建内存流
                if isinstance(content, bytes):
                    file_stream = io.BytesIO(content)
                else:
                    file_stream = io.BytesIO(content.encode('utf-8') if content else b'')
                return file_stream

            except Exception as e:
                logger.error(f"Error during async download: {e}")
                raise DownloadException(DownloadExceptionCode.NETWORK_ERROR, str(e))

        except Exception as e:
            if not isinstance(e, DownloadException):
                logger.error(f"Unexpected error during async download: {e}")
                raise DownloadException(DownloadExceptionCode.NETWORK_ERROR, str(e))
            raise

    @with_refreshed_credentials
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
        if not self.credentials:
            raise ValueError("未设置凭证")

        if not isinstance(self.credentials, AliyunCredentials):
            raise ValueError("凭证类型错误")

        credentials: AliyunCredentials = self.credentials

        if options is None:
            options = {}

        try:
            bucket = self._get_bucket_client()

            try:
                # 异步检查对象是否存在
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(
                    None,
                    lambda: bucket.head_object(key)
                )
                return True
            except Exception as e:
                # 对象不存在，或者发生了其他错误
                logger.error(f"Error during head_object for key '{key}': {type(e).__name__} - {e}")
                return False

        except Exception as e:
            logger.error(f"Error checking file existence: {e}")
            return False

    @with_refreshed_credentials
    async def generate_presigned_url(
        self,
        key: str,
        expires_in: int = 3600,
        options: Optional[Options] = None
    ) -> str:
        """
        生成预签名URL，用于直接访问文件。

        Args:
            key: 文件名/路径
            expires_in: URL过期时间（秒），默认1小时
            options: 可选配置

        Returns:
            str: 预签名URL

        Raises:
            ValueError: 如果凭证类型错误或未设置元数据
        """
        if not self.credentials:
            raise ValueError("未设置凭证")

        if not isinstance(self.credentials, AliyunCredentials):
            raise ValueError("凭证类型错误")

        credentials: AliyunCredentials = self.credentials

        if options is None:
            options = {}

        try:
            bucket = self._get_bucket_client()

            try:
                # 异步生成预签名URL
                loop = asyncio.get_event_loop()
                presigned_url = await loop.run_in_executor(
                    None,
                    lambda: bucket.sign_url('GET', key, expires_in)
                )

                logger.info(f"Generated presigned URL for {key}, expires in {expires_in} seconds")
                return presigned_url

            except Exception as e:
                logger.error(f"Error generating presigned URL: {e}")
                raise

        except Exception as e:
            logger.error(f"Unexpected error generating presigned URL: {e}")
            raise

    async def get_download_url(
        self,
        key: str,
        expires_in: int = 3600,
        options: Optional[Options] = None
    ) -> str:
        """
        通过STS token获取指定文件的临时下载链接 - 阿里云OSS实现。

        阿里云OSS使用V4签名的预签名URL机制提供安全的文件下载访问。
        该方法会自动处理STS凭证刷新，并支持阿里云OSS特有的配置参数。

        Args:
            key: 文件名/路径，例如 'folder/filename.txt'
            expires_in: URL过期时间（秒），默认1小时（3600秒）
                       阿里云OSS V4签名最大有效期为7天（604800秒）
            options: 可选配置参数，可包含：
                    - headers: 自定义HTTP请求头，例如 Content-Type
                    - params: URL查询参数，支持：
                      - x-oss-traffic-limit: 限速（bit/s），例如 '1048576'（1MB/s）
                      - x-oss-ac-source-ip: 指定IP地址或IP地址段
                      - x-oss-ac-subnet-mask: 子网掩码中1的个数
                      - x-oss-ac-vpc-id: VPC ID
                      - x-oss-ac-forward-allow: 是否允许转发请求
                    - slash_safe: 是否对路径中的斜杠进行转义，默认True

        Returns:
            str: 临时下载链接URL，可直接用于GET请求下载文件

        Raises:
            InitException: 如果STS凭证未设置或已过期
            ValueError: 如果文件key格式无效或凭证类型错误
            UploadException: 如果网络请求失败或服务端返回错误

        Example:
            ```python
            # 基本用法
            download_url = await aliyun_storage.get_download_url(
                key="documents/report.pdf",
                expires_in=1800  # 30分钟有效期
            )

            # 带限速和自定义头部
            download_url = await aliyun_storage.get_download_url(
                key="videos/large_file.mp4",
                expires_in=3600,
                options={
                    "headers": {"Content-Type": "video/mp4"},
                    "params": {
                        "x-oss-traffic-limit": str(1024 * 1024 * 8)  # 1MB/s限速
                    }
                }
            )
            ```
        """
        logger.info(f"开始获取阿里云OSS文件下载链接: {key}")

        # 限制最大有效期为7天
        max_expires = 7 * 24 * 3600  # 7天
        if expires_in > max_expires:
            logger.warning(f"过期时间超过阿里云OSS V4签名最大限制，调整为7天: {expires_in} -> {max_expires}")
            expires_in = max_expires

        if not self.credentials:
            raise ValueError("未设置凭证")

        if not isinstance(self.credentials, AliyunCredentials):
            raise ValueError("凭证类型错误")

        credentials: AliyunCredentials = self.credentials

        if options is None:
            options = {}

        try:
            bucket = self._get_bucket_client()

            # 提取阿里云OSS特有的参数
            headers = options.get('headers', {})
            params = options.get('params', {})
            slash_safe = options.get('slash_safe', True)  # 默认不转义斜杠

            try:
                # 异步生成预签名URL，支持阿里云OSS特有参数
                loop = asyncio.get_event_loop()
                download_url = await loop.run_in_executor(
                    None,
                    lambda: bucket.sign_url(
                        'GET',
                        key,
                        expires_in,
                        slash_safe=slash_safe,
                        headers=headers if headers else None,
                        params=params if params else None
                    )
                )

                logger.info(f"成功生成阿里云OSS下载链接: {key}, 有效期: {expires_in}秒")
                return download_url

            except Exception as e:
                logger.error(f"生成阿里云OSS预签名URL失败: {e}")
                raise

        except Exception as e:
            logger.error(f"生成阿里云OSS下载链接失败: {key}, 错误: {e}")
            raise
