"""
Type definitions for storage SDK.
"""

from abc import abstractmethod
from enum import Enum
from typing import Any, BinaryIO, Callable, Dict, Literal, Optional, Protocol, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator
import time


class PlatformType(str, Enum):
    """Storage platform types."""

    tos = "tos"
    aliyun = "aliyun"  # 阿里云 OSS
    local = "local"    # 本地存储
    minio = "minio"    # minio对象存储


class BaseStorageCredentials(BaseModel):
    """Base storage credentials model."""

    platform: PlatformType = Field(..., description="Storage platform type")

    model_config = ConfigDict(populate_by_name=True)

    @abstractmethod
    def get_dir(self) -> str:
        """上传目录路径"""
        pass

    @abstractmethod
    def get_public_access_base_url(self) -> Optional[str]:
        """获取用于构建公共访问URL的基础部分 (例如 https://bucket.endpoint 或 https://host)
        如果平台不支持或无法生成公共URL，则返回 None。
        """
        pass


class TemporaryCredentialData(BaseModel):
    """STS临时凭证中的credentials字段结构"""
    AccessKeyId: str = Field(..., description="临时访问密钥ID")
    SecretAccessKey: str = Field(..., description="临时访问密钥")
    SessionToken: str = Field(..., description="安全令牌")
    ExpiredTime: str = Field(..., description="过期时间")
    CurrentTime: str = Field(..., description="当前时间")

    model_config = ConfigDict(populate_by_name=True)


class TemporaryCredentials(BaseModel):
    """STS临时凭证结构"""
    host: str = Field(..., description="存储服务主机URL")
    region: str = Field(..., description="TOS区域")
    endpoint: str = Field(..., description="TOS终端节点URL")
    credentials: TemporaryCredentialData = Field(..., description="STS凭证详情")
    bucket: str = Field(..., description="TOS存储桶名称")
    dir: str = Field(..., description="上传目录路径")
    expires: int = Field(..., description="过期时间(秒)")
    callback: str = Field("", description="回调URL")

    model_config = ConfigDict(populate_by_name=True)


class VolcEngineCredentials(BaseStorageCredentials):
    """VolcEngine TOS credentials model with STS support."""

    platform: Literal[PlatformType.tos] = Field(PlatformType.tos, description="存储平台类型")
    temporary_credential: TemporaryCredentials = Field(..., description="STS临时凭证")
    expires: Optional[int] = Field(None, description="过期时间戳别名")

    def get_dir(self) -> str:
        """上传目录路径"""
        return self.temporary_credential.dir

    def get_public_access_base_url(self) -> Optional[str]:
        """获取TOS公共访问基础URL (基于 temporary_credential.host)"""
        host = self.temporary_credential.host
        if not host:
            return None
        # 确保返回包含协议的完整基础URL
        if not host.startswith(("http://", "https://")):
             # 默认使用 https，或根据实际情况调整
             host = f"https://{host}"
        # 移除末尾的斜杠，如果有的话
        if host.endswith('/'):
            host = host[:-1]
        return host


# AWS S3 临时凭证数据
class S3TemporaryCredentialData(BaseModel):
    """AWS S3 STS临时凭证中的credentials字段结构"""
    access_key_id: str = Field(..., alias="AccessKeyId", description="临时访问密钥ID")
    secret_access_key: str = Field(..., alias="SecretAccessKey", description="临时访问密钥")
    session_token: str = Field(..., alias="SessionToken", description="安全令牌")
    expiration: str = Field(..., alias="Expiration", description="过期时间")

    model_config = ConfigDict(populate_by_name=True)


class S3TemporaryCredentials(BaseModel):
    """AWS S3 STS临时凭证结构"""
    endpoint: str = Field(..., description="S3服务终端节点URL")
    region: str = Field(..., description="S3区域")
    bucket: str = Field(..., description="S3存储桶名称")
    dir: str = Field(..., description="上传目录路径")
    credentials: S3TemporaryCredentialData = Field(..., description="STS凭证详情")
    expires: int = Field(..., description="过期时间(Unix时间戳)")

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode='before')
    @classmethod
    def _normalize_input(cls, data: Any) -> Any:
        """标准化输入数据，处理不同的字段名称"""
        if not isinstance(data, dict):
            return data

        input_data = data.copy()

        # 处理嵌套的 temporary_credential 字段
        temp_cred = input_data.pop('temporary_credential', None)
        if temp_cred and isinstance(temp_cred, dict):
            # 提取凭证信息
            if 'credentials' not in input_data:
                input_data['credentials'] = temp_cred

            # 提取其他字段
            for field in ['endpoint', 'region', 'bucket', 'dir', 'expires']:
                if field not in input_data and field in temp_cred:
                    input_data[field] = temp_cred[field]

        return input_data


# 阿里云OSS临时凭证数据
class AliyunTemporaryCredentialData(BaseModel):
    """阿里云STS临时凭证中的credentials字段结构"""
    AccessKeyId: str = Field(..., description="临时访问密钥ID")
    AccessKeySecret: str = Field(..., description="临时访问密钥")
    SecurityToken: str = Field(..., description="安全令牌")
    Expiration: str = Field(..., description="过期时间")

    model_config = ConfigDict(populate_by_name=True)


# 阿里云OSS凭证
class AliyunCredentials(BaseStorageCredentials):
    """阿里云OSS凭证模型，支持STS"""

    platform: Literal[PlatformType.aliyun] = Field(PlatformType.aliyun, description="存储平台类型")
    endpoint: str = Field(default=..., description="OSS终端节点URL")
    region: str = Field(..., description="OSS区域")
    bucket: str = Field(..., description="OSS存储桶名称")
    dir: str = Field(..., description="上传目录路径")
    credentials: AliyunTemporaryCredentialData = Field(..., description="STS临时凭证")
    expire: Optional[int] = Field(None, description="过期时间戳")

    @model_validator(mode='before')
    @classmethod
    def _normalize_input(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        input_data = data.copy()
        temp_cred_dict = input_data.pop('temporary_credential', None)

        if temp_cred_dict and isinstance(temp_cred_dict, dict):
            bucket = temp_cred_dict.get('bucket')
            region = temp_cred_dict.get('region')
            workdir = temp_cred_dict.get('dir', '')
            endpoint = f"https://{region}.aliyuncs.com"

            input_data.setdefault('endpoint', endpoint)
            input_data.setdefault('region', region)
            input_data.setdefault('bucket', bucket)
            input_data.setdefault('dir', workdir)

            if 'credentials' not in input_data:
                input_data['credentials'] = {
                    'AccessKeyId': temp_cred_dict.get('access_key_id'),
                    'AccessKeySecret': temp_cred_dict.get('access_key_secret'),
                    'SecurityToken': temp_cred_dict.get('sts_token'),
                    'Expiration': input_data.get('expire_time', '2099-12-31T23:59:59Z')
                }

        # 处理过期时间戳：使用API响应中的expires字段，如果没有则默认1小时
        if 'expires' in input_data:
            input_data['expire'] = input_data['expires']
        else:
            # 默认1小时有效期（生产环境）
            input_data['expire'] = int(time.time()) + 3600  # 1小时 = 3600秒

        return input_data

    def get_dir(self) -> str:
        """上传目录路径"""
        return self.dir

    def get_public_access_base_url(self) -> Optional[str]:
        """获取阿里云OSS公共访问基础URL (格式: https://bucket.endpoint)"""
        if not self.bucket or not self.endpoint:
            return None

        # 清理 endpoint，移除可能存在的协议头
        endpoint = self.endpoint
        if endpoint.startswith("http://"):
            endpoint = endpoint[len("http://"):]
        if endpoint.startswith("https://"):
            endpoint = endpoint[len("https://"):]

        # 移除末尾的斜杠 (尽管 endpoint 通常不带)
        if endpoint.endswith('/'):
            endpoint = endpoint[:-1]

        # 总是使用 https 协议
        return f"https://{self.bucket}.{endpoint}"


# Type aliases
FileContent = Union[str, bytes, BinaryIO]
ProgressCallback = Callable[[float], None]
Headers = Dict[str, str]
Options = Dict[str, Any]


class StorageResponse(BaseModel):
    """Standard storage operation response."""

    key: str = Field(..., description="Full path/key of the file")
    platform: PlatformType = Field(..., description="Storage platform identifier")
    headers: Headers = Field(..., description="Response headers from the server")
    url: Optional[str] = Field(None, description="Public URL of the file if available")


class StorageUploader(Protocol):
    """Protocol for storage upload operations."""

    def upload(
        self, file: FileContent, key: str, credentials: BaseStorageCredentials, options: Optional[Options] = None
    ) -> StorageResponse:
        """Upload file to storage platform."""
        ...


# 本地存储凭证
class LocalTemporaryCredential(BaseModel):
    """本地存储临时凭证模型"""
    host: str = Field(..., description="上传接口URL")
    dir: str = Field(..., description="上传目录路径")
    read_host: str = Field(..., description="文件读取基础URL")
    credential: str = Field("", description="凭证标识符")

    model_config = ConfigDict(populate_by_name=True)


class LocalCredentials(BaseStorageCredentials):
    """本地存储凭证模型"""

    platform: Literal[PlatformType.local] = Field(PlatformType.local, description="存储平台类型")
    temporary_credential: LocalTemporaryCredential = Field(..., description="本地存储临时凭证")
    expires: Optional[int] = Field(None, description="过期时间戳")

    def get_dir(self) -> str:
        """上传目录路径"""
        return self.temporary_credential.dir

    def get_public_access_base_url(self) -> Optional[str]:
        """获取本地存储公共访问基础URL"""
        read_host = self.temporary_credential.read_host
        if not read_host:
            return None

        # 确保返回包含协议的完整基础URL
        if not read_host.startswith(("http://", "https://")):
            read_host = f"http://{read_host}"

        # 移除末尾的斜杠，如果有的话
        if read_host.endswith('/'):
            read_host = read_host[:-1]

        return read_host


# AWS S3 凭证
class S3Credentials(BaseStorageCredentials):
    """AWS S3 凭证模型，支持STS临时凭证"""

    platform: Literal[PlatformType.minio] = Field(PlatformType.minio, description="存储平台类型")
    temporary_credential: S3TemporaryCredentials = Field(..., description="STS临时凭证")
    expires: Optional[int] = Field(None, description="过期时间戳")

    @model_validator(mode='before')
    @classmethod
    def _normalize_input(cls, data: Any) -> Any:
        """标准化输入数据，兼容多种格式"""
        if not isinstance(data, dict):
            return data

        input_data = data.copy()

        # 如果直接提供了 temporary_credential 字段
        temp_cred_dict = input_data.get('temporary_credential', {})

        if temp_cred_dict and isinstance(temp_cred_dict, dict):
            # 如果临时凭证中有 expires，同步到顶层
            if 'expires' in temp_cred_dict and 'expires' not in input_data:
                input_data['expires'] = temp_cred_dict['expires']

        # 如果没有 expires，设置默认值（当前时间 + 1小时）
        if 'expires' not in input_data:
            input_data['expires'] = int(time.time()) + 3600

        return input_data

    def get_dir(self) -> str:
        """上传目录路径"""
        return self.temporary_credential.dir

    def get_public_access_base_url(self) -> Optional[str]:
        """获取S3公共访问基础URL (格式: https://bucket.s3.region.amazonaws.com)"""
        if not self.temporary_credential.bucket or not self.temporary_credential.region:
            return None

        endpoint = self.temporary_credential.endpoint

        # 如果提供了自定义endpoint，直接使用
        if endpoint and not endpoint.startswith('s3.'):
            # 清理 endpoint，移除可能存在的协议头
            if endpoint.startswith("http://"):
                endpoint = endpoint[len("http://"):]
            if endpoint.startswith("https://"):
                endpoint = endpoint[len("https://"):]

            # 移除末尾的斜杠
            if endpoint.endswith('/'):
                endpoint = endpoint[:-1]

            return f"https://{endpoint}/{self.temporary_credential.bucket}"

        # 使用 AWS S3 标准格式
        # 格式: https://bucket.s3.region.amazonaws.com
        return f"https://{self.temporary_credential.bucket}.s3.{self.temporary_credential.region}.amazonaws.com"
