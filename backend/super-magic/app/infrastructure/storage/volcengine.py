"""
VolcEngine TOS upload implementation with multipart upload support for files > 2MB.
"""

import asyncio
import io
import time
from typing import BinaryIO, Dict, Optional

import aiohttp
from loguru import logger
from tos import TosClientV2, HttpMethodType
from tos.exceptions import TosServerError
from tos.models2 import CompletePart

from .base import AbstractStorage, BaseFileProcessor, with_refreshed_credentials
from .exceptions import (
    DownloadException,
    DownloadExceptionCode,
    InitException,
    InitExceptionCode,
    UploadException,
    UploadExceptionCode,
)
from .types import BaseStorageCredentials, FileContent, Options, PlatformType, StorageResponse, VolcEngineCredentials


class VolcEngineUploader(AbstractStorage, BaseFileProcessor):
    """VolcEngine TOS uploader implementation with multipart upload support."""

    # 文件大小阈值，超过此大小使用分片上传
    MULTIPART_THRESHOLD = 4 * 1024 * 1024  # 4MB，超过4MB使用分片上传

    # 分片大小配置
    PART_SIZE = 4 * 1024 * 1024  # 4MB，火山引擎TOS分片上传最小要求
    MAX_PART_SIZE = 5 * 1024 * 1024 * 1024  # 5GB
    MIN_PART_SIZE = 4 * 1024 * 1024  # 4MB，火山引擎TOS分片上传最小要求

    # 超时配置
    CONNECT_TIMEOUT = 120  # 连接超时增加到120秒
    READ_TIMEOUT = 300  # 读取超时增加到300秒

    # 重试配置
    MAX_RETRIES = 3
    RETRY_DELAY = 1  # 初始重试延迟1秒，指数退避

    def set_credentials(self, credentials: BaseStorageCredentials):
        """设置存储凭证"""
        if not isinstance(credentials, VolcEngineCredentials):
            if isinstance(credentials, dict):
                try:
                    credentials = VolcEngineCredentials(**credentials)
                except Exception as e:
                    raise ValueError(f"无效的凭证格式: {e}")
            else:
                raise ValueError(f"期望VolcEngineCredentials类型，得到{type(credentials)}")
        self.credentials = credentials

    def _should_refresh_credentials_impl(self) -> bool:
        """检查是否应该刷新凭证的特定逻辑"""
        if not self.credentials:
            return True

        if not isinstance(self.credentials, VolcEngineCredentials):
            return True

        credentials: VolcEngineCredentials = self.credentials
        if credentials.expires is None:
            return False

        # 提前300秒刷新
        return time.time() > credentials.expires - 300

    async def _refresh_credentials_impl(self):
        """执行刷新凭证操作"""
        logger.info("开始获取火山引擎TOS STS Token")

        # 前提条件检查已经在 _should_refresh_credentials 中完成
        if not self.sts_refresh_config:
            logger.error("STS refresh config is not available")
            return

        json_data = {}
        if self.metadata:
            json_data["metadata"] = self.metadata

        timeout = aiohttp.ClientTimeout(total=self.READ_TIMEOUT, connect=self.CONNECT_TIMEOUT)

        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.request(
                method=self.sts_refresh_config.method,
                url=self.sts_refresh_config.url,
                headers=self._get_sts_refresh_headers(),
                json=json_data,
            ) as response:
                response.raise_for_status()
                response_body = await response.json()

                # 检查响应码
                code = response_body.get("code")
                message = response_body.get("message", "")

                if code != 1000:
                    logger.error(f"STS refresh failed: {response_body}")
                    return

                actual_credential_data_wrapper = response_body.get("data", {})
                if not actual_credential_data_wrapper:
                    logger.error("STS refresh response missing 'data' field or 'data' field is empty.")
                    return

                try:
                    # 直接使用 actual_credential_data_wrapper，Pydantic模型内部的验证器会处理
                    self.credentials = VolcEngineCredentials(**actual_credential_data_wrapper)
                    logger.info("火山引擎TOS STS Token获取成功 (通过Pydantic模型转换)")
                except Exception as e:
                    logger.error(f"解析刷新后的STS凭证失败: {e}\nInput data from STS: {actual_credential_data_wrapper}")
                    # 根据需要进行错误处理
                    raise

    def _calculate_part_size(self, file_size: int) -> int:
        """计算分片大小"""
        # 确保分片数量不超过10000个（TOS限制）
        max_parts = 10000

        # 计算最小分片大小以保证分片数量不超过限制
        min_part_size_for_limit = (file_size + max_parts - 1) // max_parts

        # 在用户设置的分片大小和计算出的最小分片大小之间取较大值
        part_size = max(self.PART_SIZE, min_part_size_for_limit)

        # 确保分片大小不超过最大限制
        part_size = min(part_size, self.MAX_PART_SIZE)

        # 确保分片大小不小于最小限制
        part_size = max(part_size, self.MIN_PART_SIZE)

        return part_size

    def _get_tos_client(self):
        """获取TOS客户端"""
        if not self.credentials:
            raise ValueError("未设置凭证")

        if not isinstance(self.credentials, VolcEngineCredentials):
            raise ValueError("凭证类型错误")

        credentials: VolcEngineCredentials = self.credentials
        tc = credentials.temporary_credential

        # 创建TOS客户端
        tos_client = TosClientV2(
            ak=tc.credentials.AccessKeyId,
            sk=tc.credentials.SecretAccessKey,
            endpoint=tc.endpoint,
            region=tc.region,
            security_token=tc.credentials.SessionToken,
        )

        return tos_client

    async def _simple_upload(self, file_obj, key: str, file_size: int, bucket_name: str):
        """简单上传，适用于小文件"""
        logger.info(f"使用简单上传方式，文件大小: {file_size} bytes")

        tos_client = self._get_tos_client()

        try:
            # 使用异步方式执行上传操作
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, lambda: tos_client.put_object(bucket=bucket_name, key=key, content=file_obj)
            )

            return result

        except Exception as e:
            logger.error(f"简单上传失败: {e}")
            raise

    async def _multipart_upload(self, file_obj, key: str, file_size: int, bucket_name: str):
        """分片上传，适用于大文件"""
        logger.info(f"使用分片上传方式，文件大小: {file_size} bytes")

        tos_client = self._get_tos_client()

        # 计算分片大小
        part_size = self._calculate_part_size(file_size)
        logger.info(f"计算出的分片大小: {part_size} bytes")

        # 初始化分片上传
        loop = asyncio.get_event_loop()
        multipart_upload = await loop.run_in_executor(
            None, lambda: tos_client.create_multipart_upload(bucket=bucket_name, key=key)
        )

        upload_id = multipart_upload.upload_id
        if not upload_id:
            raise UploadException(UploadExceptionCode.NETWORK_ERROR, "初始化分片上传失败：未获取到upload_id")

        logger.info(f"初始化分片上传成功，upload_id: {upload_id}")

        parts = []
        part_number = 1
        offset = 0

        try:
            while offset < file_size:
                # 计算当前分片的大小
                part_size_current = min(part_size, file_size - offset)

                # 读取分片数据
                file_obj.seek(offset)
                part_data = file_obj.read(part_size_current)

                # 上传分片，带重试机制
                retry_count = 0
                while retry_count < self.MAX_RETRIES:
                    try:
                        logger.info(f"上传分片 {part_number}, 偏移量: {offset}, 大小: {part_size_current}")

                        part_result = await loop.run_in_executor(
                            None,
                            lambda: tos_client.upload_part(
                                bucket=bucket_name,
                                key=key,
                                upload_id=upload_id,
                                part_number=part_number,
                                content=part_data,
                            ),
                        )

                        # 创建CompletePart对象
                        parts.append(CompletePart(etag=part_result.etag, part_number=part_number))
                        logger.info(f"分片 {part_number} 上传成功，ETag: {part_result.etag}")
                        break

                    except Exception as e:
                        retry_count += 1
                        if retry_count >= self.MAX_RETRIES:
                            logger.error(f"分片 {part_number} 上传失败，已重试 {self.MAX_RETRIES} 次: {e}")
                            raise

                        wait_time = self.RETRY_DELAY * (2 ** (retry_count - 1))  # 指数退避
                        logger.warning(f"分片 {part_number} 上传失败，{wait_time}秒后重试 (第{retry_count}次): {e}")
                        await asyncio.sleep(wait_time)

                offset += part_size_current
                part_number += 1

            # 完成分片上传
            logger.info(f"所有分片上传完成，开始合并，总共 {len(parts)} 个分片")

            result = await loop.run_in_executor(
                None,
                lambda: tos_client.complete_multipart_upload(
                    bucket=bucket_name, key=key, upload_id=upload_id, parts=parts
                ),
            )

            logger.info(f"分片上传合并完成，ETag: {result.etag}")
            return result

        except Exception as e:
            # 如果上传过程中出现错误，取消分片上传
            logger.error(f"分片上传过程中发生错误: {e}")
            try:
                await loop.run_in_executor(
                    None, lambda: tos_client.abort_multipart_upload(bucket=bucket_name, key=key, upload_id=upload_id)
                )
                logger.info(f"已取消分片上传，upload_id: {upload_id}")
            except Exception as abort_error:
                logger.warning(f"取消分片上传失败: {abort_error}")

            raise

    @with_refreshed_credentials
    async def upload(self, file: FileContent, key: str, options: Optional[Options] = None) -> StorageResponse:
        """
        异步使用TOS SDK上传文件到火山引擎对象存储。
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
            if file_size > 5 * 1024 * 1024 * 1024:  # 5GB
                if isinstance(file, str):
                    file_obj.close()
                raise InitException(InitExceptionCode.FILE_TOO_LARGE, "volcEngine", file_name=key)

            # 获取凭证信息
            if not isinstance(self.credentials, VolcEngineCredentials):
                raise ValueError("凭证类型错误")

            credentials: VolcEngineCredentials = self.credentials
            tc = credentials.temporary_credential

            try:
                # 根据文件大小选择上传方式
                if file_size > self.MULTIPART_THRESHOLD:
                    result = await self._multipart_upload(file_obj, key, file_size, tc.bucket)
                else:
                    result = await self._simple_upload(file_obj, key, file_size, tc.bucket)

                # 关闭文件（如果是我们打开的）
                if isinstance(file, str):
                    file_obj.close()

                # 获取响应头
                headers = {}
                # TOS SDK的响应对象可能没有headers属性，使用空字典

                # 返回标准响应
                return StorageResponse(
                    key=key,
                    platform=PlatformType.tos,
                    headers=headers,
                    url=None,  # 添加默认值
                )

            except Exception as e:
                logger.error(f"TOS error during async upload: {e}")
                if isinstance(file, str):
                    file_obj.close()
                raise UploadException(UploadExceptionCode.NETWORK_ERROR, str(e))

        except Exception as e:
            # 确保文件被关闭
            if "file_obj" in locals() and isinstance(file, str):
                try:
                    file_obj.close()
                except:
                    pass

            if not isinstance(e, (InitException, UploadException)):
                logger.error(f"Unexpected error during async upload: {e}")
                raise UploadException(UploadExceptionCode.NETWORK_ERROR, str(e))
            raise

    @with_refreshed_credentials
    async def download(self, key: str, options: Optional[Options] = None) -> BinaryIO:
        """
        异步从火山引擎对象存储下载文件。

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
            # 获取凭证信息
            if not isinstance(self.credentials, VolcEngineCredentials):
                raise ValueError("凭证类型错误")

            credentials: VolcEngineCredentials = self.credentials
            tc = credentials.temporary_credential

            # 创建TOS客户端
            tos_client = self._get_tos_client()

            try:
                # 异步获取对象
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, lambda: tos_client.get_object(bucket=tc.bucket, key=key))

                # 读取内容到内存
                content = result.read()
                # 创建内存流
                if isinstance(content, bytes):
                    file_stream = io.BytesIO(content)
                else:
                    file_stream = io.BytesIO(content.encode("utf-8") if content else b"")
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
    async def download_file_by_stream(
        self,
        key: str,
        dest_path: str,
        options: Optional[Options] = None,
        chunk_size: int = 4 * 1024 * 1024,
    ) -> int:
        """
        以流式方式从火山引擎 TOS 下载文件并写入本地路径。

        TOS SDK 的 ``get_object`` 返回 file-like 对象，调用 ``read(size)`` 即按需从底层
        socket 读取分块，不会一次性把整个对象读进内存。

        Args:
            key: 文件名/路径
            dest_path: 本地目标文件绝对路径
            options: 可选配置
            chunk_size: 每次读取的字节数，默认 4MiB

        Returns:
            int: 写入到 ``dest_path`` 的字节总数

        Raises:
            DownloadException: 如果下载失败
            ValueError: 如果凭证类型不正确或未设置元数据
        """
        if options is None:
            options = {}

        try:
            if not isinstance(self.credentials, VolcEngineCredentials):
                raise ValueError("凭证类型错误")

            credentials: VolcEngineCredentials = self.credentials
            tc = credentials.temporary_credential

            tos_client = self._get_tos_client()

            try:
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    None, lambda: tos_client.get_object(bucket=tc.bucket, key=key)
                )

                def _stream_to_file() -> int:
                    written = 0
                    with open(dest_path, "wb") as f:
                        while True:
                            chunk = result.read(chunk_size)
                            if not chunk:
                                break
                            f.write(chunk)
                            written += len(chunk)
                    return written

                total_bytes = await loop.run_in_executor(None, _stream_to_file)
                return total_bytes

            except Exception as e:
                logger.error(f"Error during streaming download: {e}")
                raise DownloadException(DownloadExceptionCode.NETWORK_ERROR, str(e))

        except Exception as e:
            if not isinstance(e, DownloadException):
                logger.error(f"Unexpected error during streaming download: {e}")
                raise DownloadException(DownloadExceptionCode.NETWORK_ERROR, str(e))
            raise

    @with_refreshed_credentials
    async def exists(self, key: str, options: Optional[Options] = None) -> bool:
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

        if not isinstance(self.credentials, VolcEngineCredentials):
            raise ValueError("凭证类型错误")

        credentials: VolcEngineCredentials = self.credentials

        if options is None:
            options = {}

        try:
            # 获取凭证信息
            tc = credentials.temporary_credential

            # 创建TOS客户端
            tos_client = self._get_tos_client()

            try:
                # 异步检查对象是否存在
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, lambda: tos_client.head_object(bucket=tc.bucket, key=key))
                return True
            except TosServerError as e:
                if e.status_code == 404:
                    logger.warning(f"Object not found (404) for key '{key}'")
                else:
                    logger.error(f"Error during head_object for key '{key}': {type(e).__name__} - {e}")
                return False
            except Exception as e:
                logger.error(f"Error during head_object for key '{key}': {type(e).__name__} - {e}")
                return False

        except Exception as e:
            logger.error(f"Error checking file existence: {e}")
            return False

    @with_refreshed_credentials
    async def generate_presigned_url(self, key: str, expires_in: int = 3600, options: Optional[Options] = None) -> str:
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

        if not isinstance(self.credentials, VolcEngineCredentials):
            raise ValueError("凭证类型错误")

        credentials: VolcEngineCredentials = self.credentials

        if options is None:
            options = {}

        try:
            # 获取凭证信息
            tc = credentials.temporary_credential

            # 创建TOS客户端
            tos_client = self._get_tos_client()

            try:
                # Extract query parameters from options if provided
                query_params = None
                if options and "params" in options:
                    query_params = options["params"]
                    logger.info(f"Adding query params to presigned URL: {query_params}")

                # 异步生成预签名URL with query parameters
                loop = asyncio.get_event_loop()
                presigned_url_result = await loop.run_in_executor(
                    None,
                    lambda: tos_client.pre_signed_url(
                        http_method=HttpMethodType.Http_Method_Get,
                        bucket=tc.bucket,
                        key=key,
                        expires=expires_in,
                        query=query_params,  # Pass query params to SDK for signature calculation
                    ),
                )

                # 从结果对象中提取URL
                presigned_url = presigned_url_result.signed_url

                logger.info(f"Generated presigned URL for {key}, expires in {expires_in} seconds")
                return presigned_url

            except Exception as e:
                logger.error(f"Error generating presigned URL: {e}")
                raise

        except Exception as e:
            logger.error(f"Unexpected error generating presigned URL: {e}")
            raise

    async def get_download_url(self, key: str, expires_in: int = 3600, options: Optional[Options] = None) -> str:
        """
        通过STS token获取指定文件的临时下载链接 - 火山云TOS实现。

        火山云TOS使用预签名URL机制提供安全的文件下载访问。
        该方法会自动处理STS凭证刷新，确保生成的下载链接有效。

        Args:
            key: 文件名/路径，例如 'folder/filename.txt'
            expires_in: URL过期时间（秒），默认1小时（3600秒）
                       火山云TOS支持的最大有效期根据平台设置而定
            options: 可选配置参数，可包含：
                    - method: HTTP方法，默认GET
                    - headers: 自定义HTTP请求头
                    - params: 额外的查询参数

        Returns:
            str: 临时下载链接URL，可直接用于GET请求下载文件

        Raises:
            InitException: 如果STS凭证未设置或已过期
            ValueError: 如果文件key格式无效或凭证类型错误
            UploadException: 如果网络请求失败或服务端返回错误

        Example:
            ```python
            # 获取文件下载链接
            download_url = await volcengine_storage.get_download_url(
                key="documents/report.pdf",
                expires_in=1800  # 30分钟有效期
            )

            # 使用curl下载文件
            # curl -O "download_url"
            ```
        """
        logger.info(f"开始获取火山云TOS文件下载链接: {key}")

        try:
            # 调用现有的预签名URL生成方法
            download_url = await self.generate_presigned_url(key=key, expires_in=expires_in, options=options)

            logger.info(f"成功生成火山云TOS下载链接: {key}, 有效期: {expires_in}秒")
            return download_url

        except Exception as e:
            logger.error(f"生成火山云TOS下载链接失败: {key}, 错误: {e}")
            raise
