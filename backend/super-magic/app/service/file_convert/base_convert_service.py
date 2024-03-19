"""
基础转换服务类

提供PDF和PPTX转换服务的共同基础功能
"""

import asyncio
import hashlib
import json
import os
import re
import socket
import tempfile
import time
import traceback
import urllib.parse
import zipfile
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, TypedDict
from urllib.parse import quote

import aiofiles
import aiohttp
import markdown
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from loguru import logger
from playwright.async_api import async_playwright
from pydantic import BaseModel, Field

from app.command.storage_uploader_tool import StorageUploaderTool
from app.core.context.agent_context import AgentContext
from app.core.entity.aigc_metadata import AigcMetadataParams
from app.core.entity.message.client_message import InitClientMessage
from app.infrastructure.magic_service.config import MagicServiceConfigLoader
from app.paths import PathManager
from app.service.convert_task_manager import task_manager
from app.utils.metadata_utils import AigcMetadataUtil
from app.utils.path_utils import get_workspace_dir
from magic_use.magic_browser_config import MagicBrowserConfig
from magic_use.server_health_checker import wait_for_browser_server


@dataclass
class FileKeyItem:
    """文件Key项数据结构"""

    file_key: str


class STSTemporaryCredential(BaseModel):
    """STS临时凭证完整结构 - 支持不同平台的灵活结构"""

    platform: str = Field(description="平台类型，如 'aliyun', 'tos' 等")
    temporary_credential: Dict[str, Any] = Field(description="临时凭证信息，不同平台结构不同")
    expires: Optional[int] = Field(default=None, description="过期时间")
    magic_service_host: Optional[str] = Field(default=None, description="魔法服务主机地址")


class ViewportSize(TypedDict):
    """视口尺寸类型定义"""

    width: int
    height: int


class BaseConvertService(ABC):
    """基础转换服务类"""

    # 页面操作超时时间常量（毫秒）- 参考优秀实践，大幅增加超时确保完整性
    PAGE_OPERATION_TIMEOUT = 30000  # 30秒，确保复杂页面和外部资源完整加载
    PAGE_LOAD_TIMEOUT = 30000  # 30秒，页面加载超时，与脚本实践保持一致
    SCREENSHOT_TIMEOUT = 30000  # 30秒，截图超时，确保高质量截图生成

    # 并发处理配置
    MAX_CONCURRENT_WORKERS = 6  # 最大并发工作线程数

    # 浏览器配置常量
    PDF_BROWSER_ARGS = [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-features=TranslateUI",
        "--disable-ipc-flooding-protection",
        # 字体和文本渲染优化参数 - 修复乱码
        "--font-render-hinting=full",
        "--enable-font-antialiasing",
        "--disable-lcd-text",
        "--force-color-profile=srgb",
        "--disable-features=VizDisplayCompositor",
        # 编码和语言设置
        "--accept-lang=zh-CN,zh,en-US,en",
        "--default-encoding=utf-8",
        # 字体回退和加载优化
        "--disable-font-loading-timeout",
        "--font-cache-shared-handle",
    ]

    SCREENSHOT_BROWSER_ARGS = [
        "--force-device-scale-factor=2",
        "--high-dpi-support=1",
        "--force-color-profile=srgb",
        "--disable-low-res-tiling",
        "--disable-backgrounding-occluded-windows",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-features=TranslateUI",
        "--disable-ipc-flooding-protection",
        # 字体和文本渲染优化参数 - 修复截图乱码
        "--font-render-hinting=full",
        "--enable-font-antialiasing",
        "--disable-lcd-text",
        "--disable-features=VizDisplayCompositor",
        # 编码和语言设置
        "--accept-lang=zh-CN,zh,en-US,en",
        "--default-encoding=utf-8",
        # 字体回退和加载优化
        "--disable-font-loading-timeout",
        "--font-cache-shared-handle",
    ]

    def __init__(self, service_name: str):
        """
        初始化基础转换服务

        Args:
            service_name: 服务名称，用于日志和目录命名
        """
        self.service_name = service_name
        self.agent_context: Optional[AgentContext] = None
        self.storage_service = None

        # 按需启动的静态文件服务器相关
        self._static_server_task: Optional[asyncio.Task] = None
        self._static_server_port = 8003
        self._static_server_running = False

        # localCdn 日志去重（服务存活期间）
        self._local_cdn_logged_hits: Set[str] = set()
        self._local_cdn_logged_misses: Set[str] = set()

        logger.info(f"{service_name}转换服务初始化完成")

    # === 工具方法：减少代码冗余 ===

    @staticmethod
    def _is_html_file(file_path: Path) -> bool:
        """
        检查文件是否为HTML类型

        Args:
            file_path: 文件路径

        Returns:
            是否为HTML文件
        """
        return file_path.suffix.lower() in [".html", ".htm"]

    def _calculate_conversion_concurrency(self, file_type_counts: Dict[str, int]) -> int:
        """
        根据文件数量动态计算转换并发数
        转换主要受CPU和内存限制，特别是浏览器实例开销很大

        Args:
            file_type_counts: 文件类型及其数量的字典，例如 {'html': 5, 'md': 3}

        Returns:
            转换并发数
        """
        total_files = sum(file_type_counts.values())

        # 防止除零错误
        if total_files == 0:
            return 1

        # 根据文件数量计算理想并发数
        if total_files <= 2:
            ideal_concurrency = 1
        elif total_files <= 10:
            # 少量文件，使用适中并发数
            ideal_concurrency = 2
        elif total_files <= 20:
            # 中等数量文件，使用较高并发数
            ideal_concurrency = 4
        elif total_files <= 30:
            # 较多文件，使用高并发数
            ideal_concurrency = 6
        else:
            # 大量文件，使用最大转换并发数
            ideal_concurrency = self.MAX_CONCURRENT_WORKERS

        # 🎯 关键优化：确保并发数不超过实际文件数量
        concurrency = min(ideal_concurrency, total_files)

        logger.debug(
            f"转换并发数计算: 文件类型={file_type_counts}, "
            f"总文件数={total_files}, 理想并发数={ideal_concurrency}, "
            f"实际并发数={concurrency}"
        )

        return concurrency

    async def _init_agent_context(self) -> bool:
        """
        初始化AgentContext

        Returns:
            bool: 初始化是否成功
        """
        try:
            # 从.credentials文件加载配置
            credentials_file_path = ".credentials/init_client_message.json"
            if not os.path.exists(credentials_file_path):
                logger.info(f"凭证文件不存在: {credentials_file_path}，将在有STS凭证时动态初始化")
                return False

            config_data = MagicServiceConfigLoader.load_config_data(credentials_file_path)
            if not config_data:
                logger.info(f"无法加载凭证文件: {credentials_file_path}，将在有STS凭证时动态初始化")
                return False

            # 创建AgentContext
            self.agent_context = AgentContext()

            # init_client_message 已经在文件中，无需加载到内存
            # 直接从文件中读取需要的字段
            init_client_message = InitClientMessage(**config_data)
            if init_client_message.metadata:
                if init_client_message.metadata.sandbox_id:
                    self.agent_context.set_sandbox_id(init_client_message.metadata.sandbox_id)
                if init_client_message.metadata.organization_code:
                    self.agent_context.set_organization_code(init_client_message.metadata.organization_code)

            logger.info(f"已从文件加载AgentContext配置: {credentials_file_path}")

            # 重置 agent idle 时间 - AgentContext初始化成功时
            self.update_agent_activity("AgentContext初始化成功")

            return True

        except Exception as e:
            logger.info(f"创建AgentContext失败: {e}，将在有STS凭证时动态初始化")
            return False

    @staticmethod
    async def embed_image_metadata(image_path: str, aigc_params: Optional[AigcMetadataParams] = None) -> bool:
        """
        为图片嵌入签名元数据

        Args:
            image_path: 图片文件路径
            aigc_params: AIGC元数据参数对象

        Returns:
            bool: 是否成功嵌入元数据

        Raises:
            MagicGatewayException: 如果签名过程中发生错误
        """
        # 创建包含签名的元数据
        metadata_json = await AigcMetadataUtil.create_signed_metadata(image_path, aigc_params)
        logger.info(f"为图片 {image_path} 嵌入签名元数据")

        # 嵌入元数据
        return AigcMetadataUtil.embed_image_metadata(image_path, metadata_json)

    @staticmethod
    async def embed_pptx_metadata(pptx_path: str, aigc_params: Optional[AigcMetadataParams] = None) -> None:
        """
        为PPTX文件嵌入AIGC签名元数据的便捷方法

        Args:
            pptx_path: PPTX文件路径
            aigc_params: AIGC元数据参数对象

        Raises:
            Exception: 元数据嵌入失败时抛出异常
        """
        await AigcMetadataUtil.embed_pptx_metadata(pptx_path, aigc_params)
        logger.info(f"为PPTX文件 {pptx_path} 嵌入签名元数据")

    @staticmethod
    async def embed_pdf_metadata(pdf_path: str, aigc_params: Optional[AigcMetadataParams] = None) -> None:
        """
        为PDF文件嵌入AIGC签名元数据的便捷方法

        Args:
            pdf_path: PDF文件路径
            aigc_params: AIGC元数据参数对象

        Raises:
            Exception: 元数据嵌入失败时抛出异常
        """
        await AigcMetadataUtil.embed_pdf_metadata(pdf_path, aigc_params)
        logger.info(f"为PDF文件 {pdf_path} 嵌入签名元数据")

    @staticmethod
    def _generate_batch_id_from_list(items: List[Any]) -> str:
        """根据输入列表（file_keys或FileKeyItem）生成唯一的批次ID，包含时间戳确保每次都重新生成"""
        # 将输入项转换为字符串列表以便处理
        string_items = []
        for item in items:
            if isinstance(item, str):
                string_items.append(item)
            elif isinstance(item, FileKeyItem):
                string_items.append(item.file_key)
            elif isinstance(item, dict) and "file_key" in item:
                string_items.append(item["file_key"])
            else:
                # 尝试转换为字符串
                string_items.append(str(item))

        # 生成时间戳确保唯一性
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        microseconds = int(time.time() * 1000000) % 1000000  # 微秒部分

        if not string_items:
            return f"{timestamp}_{microseconds}"

        # 结合文件key和时间戳生成唯一ID
        sorted_items = sorted(string_items)
        concatenated_string = "".join(sorted_items) + f"_{timestamp}_{microseconds}"
        sha256_hash = hashlib.sha256(concatenated_string.encode("utf-8")).hexdigest()

        logger.info(f"生成批次ID: {sha256_hash} (基于{len(string_items)}个文件key + 时间戳)")
        return sha256_hash

    @staticmethod
    def parse_file_key_to_workspace_path(file_key: str) -> Path:
        """
        将file_key解析为workspace中的文件路径

        file_key现在直接就是.workspace的相对路径，无需复杂解析

        例如：
        输入: "ai-funding-report/index.html"
        输出: ".workspace/ai-funding-report/index.html"

        Args:
            file_key: workspace相对路径

        Returns:
            workspace中的文件路径
        """
        try:
            # file_key现在直接就是workspace的相对路径，直接拼接即可
            workspace_path = Path(".workspace") / file_key
            # 文件解析的详细信息降级为调试级别
            return workspace_path

        except Exception as e:
            logger.error(f"解析file_key到workspace路径失败 {file_key}: {e}")
            # 出现异常时，尝试处理路径分隔符问题
            try:
                # 确保使用正确的路径分隔符
                normalized_key = file_key.replace("\\", "/")
                workspace_path = Path(".workspace") / normalized_key
                # 路径标准化的详细信息降级为调试级别
                return workspace_path
            except Exception as e2:
                logger.error(f"路径标准化后仍然失败 {file_key}: {e2}")
                # 最终回退：提取文件名
                filename = file_key.split("/")[-1] if "/" in file_key else file_key
                return Path(".workspace") / filename

    @staticmethod
    def get_project_directory_from_file_key(file_key: str) -> Optional[str]:
        """
        从file_key中提取项目目录名

        file_key现在直接就是workspace的相对路径，项目目录名是路径的第一部分
        如果文件直接在workspace根目录下（无子目录），则返回None

        例如：
        输入: "ai-funding-report/index.html"  -> 输出: "ai-funding-report"
        输入: "index.html"                   -> 输出: None （无目录结构）

        Args:
            file_key: workspace相对路径

        Returns:
            项目目录名，如果文件直接在workspace根目录或无法解析则返回None
        """
        try:
            # file_key现在是workspace相对路径，直接取第一级目录作为项目目录
            path_parts = file_key.strip("/").split("/")
            if len(path_parts) > 1 and path_parts[0]:
                # 有多个路径部分，第一部分是目录名
                project_dir = path_parts[0]
                # 项目目录提取的详细信息降级为调试级别
                return project_dir
            elif len(path_parts) == 1:
                # 只有一个路径部分，说明文件直接在workspace根目录下
                # 根目录文件的信息降级为调试级别
                return None

            return None

        except Exception as e:
            logger.error(f"从file_key提取项目目录失败 {file_key}: {e}")
            return None

    async def resolve_file_keys_to_workspace_paths(self, file_keys: List[Dict[str, str]]) -> Dict[str, Path]:
        """
        将文件key列表解析为workspace中的文件路径映射

        Args:
            file_keys: 文件key列表，每个元素包含file_key

        Returns:
            Dict[str, Path]: file_key -> workspace文件路径的映射

        Raises:
            RuntimeError: 当没有找到任何有效文件时抛出
        """
        file_path_mapping = {}
        missing_files = []

        logger.info(f"开始解析 {len(file_keys)} 个文件key到workspace路径...")

        for item in file_keys:
            file_key = item.get("file_key", "")
            if not file_key:
                logger.warning("发现空的file_key，跳过")
                continue

            try:
                # 解析文件key到workspace路径
                workspace_path = self.parse_file_key_to_workspace_path(file_key)

                # 检查文件是否存在
                if workspace_path.exists() and workspace_path.is_file():
                    file_path_mapping[file_key] = workspace_path
                    # 成功找到文件的日志降级为调试级别
                else:
                    missing_files.append(f"{file_key} -> {workspace_path}")
                    logger.warning(f"workspace中文件不存在: {workspace_path}")

            except Exception as e:
                logger.error(f"解析file_key失败 {file_key}: {e}")
                missing_files.append(f"{file_key}: 解析失败 - {str(e)}")

        logger.info(f"文件key解析完成: 成功 {len(file_path_mapping)}/{len(file_keys)} 个")

        # 如果有缺失的文件，记录详细信息
        if missing_files:
            logger.warning(f"缺失或无法解析的文件 ({len(missing_files)} 个):")
            for missing_file in missing_files:
                logger.warning(f"  - {missing_file}")

        # 如果没有找到任何有效文件，抛出异常
        if not file_path_mapping:
            error_details = "; ".join(missing_files) if missing_files else "未知错误"
            raise RuntimeError(f"没有找到任何有效的workspace文件。错误详情: {error_details}")

        return file_path_mapping

    def create_runtime_convert_dir(self, batch_id: str) -> Path:
        """
        创建转换临时目录

        Args:
            batch_id: 批次ID

        Returns:
            转换临时目录路径
        """
        runtime_dir = Path(".tmp") / "convert" / f"{self.service_name.lower()}_{batch_id}"
        runtime_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"创建转换目录: {runtime_dir}")
        return runtime_dir

    @staticmethod
    def _parse_sts_credential(sts_data: Dict[str, Any]) -> STSTemporaryCredential:
        """
        解析STS临时凭证数据为STSTemporaryCredential对象
        支持不同平台的灵活结构，只验证核心字段

        Args:
            sts_data: STS凭证数据字典

        Returns:
            STSTemporaryCredential对象

        Raises:
            ValueError: 当STS凭证数据格式不正确时抛出
        """
        try:
            # 验证核心必需字段
            if not sts_data.get("platform"):
                raise ValueError("STS凭证中缺少platform字段")

            temp_cred_data = sts_data.get("temporary_credential")
            if temp_cred_data is None:
                raise ValueError("STS凭证中缺少temporary_credential字段")

            # 创建STSTemporaryCredential对象，temporary_credential保持原始结构
            return STSTemporaryCredential(
                platform=sts_data.get("platform", ""),
                temporary_credential=temp_cred_data,  # 保持原始字典结构，不强制验证内部字段
                expires=sts_data.get("expires"),
                magic_service_host=sts_data.get("magic_service_host"),
            )

        except Exception as e:
            logger.error(f"解析STS凭证失败: {e}")
            raise ValueError(f"无效的STS凭证数据: {str(e)}")

    async def _prepare_conversion_context(
        self, file_keys: List[Dict[str, str]], sts_credential: Optional[Dict[str, Any]] = None
    ) -> tuple[Optional[STSTemporaryCredential], str, Path]:
        """
        转换前置通用处理：解析STS凭证、校验file_keys、初始化AgentContext、创建批次目录

        Args:
            file_keys: 文件key列表
            sts_credential: STS临时凭证

        Returns:
            (sts_cred_obj, batch_id, batch_dir)
        """
        # 解析STS凭证
        sts_cred_obj = None
        if sts_credential:
            sts_cred_obj = self._parse_sts_credential(sts_credential)

        logger.info(f"{self.service_name} 文件key转换服务开始处理: {len(file_keys)} 个文件")

        if not file_keys:
            raise ValueError("文件key列表不能为空")

        # 验证文件keys
        for i, file_key_item in enumerate(file_keys):
            if not file_key_item.get("file_key"):
                raise ValueError(f"第 {i + 1} 个文件的 file_key 不能为空")

        # 初始化AgentContext（如果可能）
        try:
            if not self.agent_context:
                agent_context_available = await self._init_agent_context()
            else:
                agent_context_available = True
        except Exception as e:
            logger.info(f"初始化AgentContext失败: {e}")
            agent_context_available = False

        # 如果没有AgentContext且也没有STS凭证，则无法进行转换
        if not agent_context_available and not sts_cred_obj:
            raise RuntimeError("无法初始化AgentContext且未提供STS凭证，无法进行转换")

        if not agent_context_available and sts_cred_obj:
            logger.info("使用STS凭证进行转换，跳过AgentContext初始化")
        elif agent_context_available:
            logger.info("使用AgentContext进行转换")

        batch_id = self._generate_batch_id_from_list(file_keys)
        batch_dir = self.create_runtime_convert_dir(batch_id)

        return sts_cred_obj, batch_id, batch_dir

    async def _upload_file_with_storage_uploader_tool(
        self, file_path: Path, sts_credential: Optional[STSTemporaryCredential] = None
    ) -> tuple[Optional[str], Optional[str]]:
        """
        使用 storage_uploader_tool 上传文件

        Args:
            file_path: 本地文件路径
            sts_credential: STS临时凭证，如果为None则使用默认凭证

        Returns:
            (预签名URL, 对象键名) 或 (None, None)

        Raises:
            ValueError: 当输入参数无效时抛出
            RuntimeError: 当上传过程中发生不可恢复的错误时抛出
        """
        try:
            # 验证输入参数
            if not file_path or not file_path.exists():
                raise ValueError(f"文件不存在: {file_path}")

            temp_credentials_file = None

            # 如果提供了STS凭证，创建临时凭证文件
            if sts_credential:
                # 创建临时凭证文件
                with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as temp_file:
                    # 构建凭证文件内容 - 支持不同平台的灵活结构
                    credentials_data = {
                        "upload_config": {
                            "platform": sts_credential.platform,
                            "temporary_credential": sts_credential.temporary_credential,  # 直接使用原始字典结构
                            "expires": sts_credential.expires,
                        },
                        "batch_id": f"convert_{int(time.time())}",
                    }

                    json.dump(credentials_data, temp_file, indent=2)
                    temp_credentials_file = temp_file.name

            try:
                # 创建 StorageUploaderTool 实例
                uploader_tool = StorageUploaderTool(
                    credentials_file=temp_credentials_file,  # 如果为None，StorageUploaderTool会使用默认查找逻辑
                    sandbox_id=None,  # 文件转换不需要sandbox_id
                    task_id=None,
                    organization_code=None,
                )

                # 获取工作空间目录（用于计算相对路径）
                workspace_dir = Path(".workspace")  # 默认工作空间目录
                if self.agent_context:
                    agent_workspace = self.agent_context.get_workspace_dir()
                    if agent_workspace:
                        workspace_dir = Path(agent_workspace)

                # 上传文件
                upload_success = await uploader_tool.upload_file(file_path, workspace_dir)

                if upload_success:
                    # 构建存储键（与 StorageUploaderTool 中的逻辑一致）
                    try:
                        relative_path_str = file_path.relative_to(workspace_dir).as_posix()
                    except ValueError:
                        relative_path_str = file_path.name

                    base_dir = get_workspace_dir(uploader_tool.storage_service.credentials)
                    object_key = f"{base_dir}{relative_path_str}"

                    logger.info(f"StorageUploaderTool 上传成功: {file_path} -> {object_key}")

                    # 返回 None 作为预签名URL（因为我们已经移除了这个字段），object_key 作为存储键
                    return None, object_key
                else:
                    raise RuntimeError("StorageUploaderTool 上传失败")

            finally:
                # 清理临时凭证文件
                if temp_credentials_file:
                    try:
                        os.unlink(temp_credentials_file)
                    except Exception as e:
                        logger.warning(f"清理临时凭证文件失败: {e}")

        except ValueError as e:
            logger.error(f"StorageUploaderTool 上传参数错误: {e}")
            raise

        except RuntimeError as e:
            logger.error(f"StorageUploaderTool 上传运行时错误: {e}")
            raise

        except Exception as e:
            logger.error(f"StorageUploaderTool 上传发生未知错误: {e}")
            logger.error(traceback.format_exc())
            raise RuntimeError(f"StorageUploaderTool 上传过程中发生未知错误: {str(e)}")

        # 理论上不会执行到此处，兜底返回避免类型告警
        return None, None

    async def _upload_file_to_storage(
        self, file_path: Path, sts_credential: Optional[STSTemporaryCredential] = None
    ) -> tuple[Optional[str], Optional[str]]:
        """
        上传文件到对象存储，支持使用STS临时凭证

        Args:
            file_path: 本地文件路径
            sts_credential: STS临时凭证，如果提供则使用此凭证上传

        Returns:
            (预签名URL, 对象键名) 或 (None, None)

        Raises:
            RuntimeError: 当上传过程中发生不可恢复的错误时抛出
        """
        try:
            # 验证文件路径
            if not file_path or not file_path.exists():
                raise ValueError(f"文件不存在: {file_path}")

            # 统一使用 StorageUploaderTool 进行上传
            presigned_url, oss_key = await self._upload_file_with_storage_uploader_tool(file_path, sts_credential)
            return presigned_url, oss_key

        except Exception as e:
            logger.error(f"文件上传失败: {e}")
            # 对于关键错误，重新抛出
            if isinstance(e, (ValueError, RuntimeError)):
                raise
            # 对于其他错误，转换为RuntimeError
            raise RuntimeError(f"文件上传过程中发生错误: {str(e)}")

    @staticmethod
    async def _create_zip_file(
        files_to_zip: List[Path], batch_dir: Path, project_name: str = "", timestamp: Optional[str] = None
    ) -> Optional[Path]:
        """
        创建ZIP文件

        Args:
            files_to_zip: 要压缩的文件列表
            batch_dir: 批次目录
            project_name: 项目名称，用于生成文件名
            timestamp: 可选的时间戳，如果不提供则自动生成

        Returns:
            ZIP文件路径，失败时返回None
        """
        try:
            # 使用项目名称和时间戳生成ZIP文件名
            if project_name:
                zip_filename = BaseConvertService._generate_timestamped_filename(project_name, "zip", timestamp)
            else:
                # 如果没有项目名称，使用简洁的默认名称（不包含服务类型）
                fallback_name = "converted"
                zip_filename = BaseConvertService._generate_timestamped_filename(fallback_name, "zip", timestamp)

            zip_file_path = batch_dir / zip_filename
            with zipfile.ZipFile(zip_file_path, "w", zipfile.ZIP_DEFLATED) as zipf:
                for file_path in files_to_zip:
                    # 使用原始文件名（不带路径）作为压缩包内的文件名
                    zipf.write(file_path, file_path.name)

            logger.info(f"ZIP压缩包创建成功: {zip_file_path}")

            # 不再使用SHA256重命名，保持原始文件名
            return zip_file_path

        except Exception as e:
            logger.error(f"创建ZIP文件失败: {e}")
            return None

    async def detect_ppt_entry_file(self, html_file_path: Path) -> tuple[bool, List[str]]:
        """
        检测HTML文件是否是PPT入口文件

        检测规则（按优先级）：
        1. HTML具备入口特征或文件名为index.html，且同层级有magic.project.js，且window.magicProjectConfig.type是'slide'（静态分析）
        2. HTML具备入口特征或文件名为index.html时，浏览器运行时检测（备用方案，处理复杂JS逻辑）
        3. 文件名为index.html时兜底判定为入口（无slides时按单页处理）

        Args:
            html_file_path: HTML文件路径

        Returns:
            (是否是PPT入口文件, slides列表)
        """
        try:
            # 验证文件存在且为HTML文件
            if not html_file_path.exists() or not self._is_html_file(html_file_path):
                return False, []

            # 读取HTML文件内容
            async with aiofiles.open(html_file_path, "r", encoding="utf-8") as f:
                html_content = await f.read()

            # 1. HTML具备入口特征或文件名为index.html时，检查同层级magic.project.js（静态分析）
            is_index_html = html_file_path.name.lower() == "index.html"
            html_is_entry_candidate = self._is_likely_ppt_entry_html(html_content) or is_index_html
            if not html_is_entry_candidate:
                return False, []

            magic_project_js = html_file_path.parent / "magic.project.js"
            if magic_project_js.exists():
                is_slide_project, slides_from_js = await self._check_magic_project_config(magic_project_js)
                if is_slide_project and slides_from_js:
                    logger.info(f"检测到PPT入口文件（magic.project.js）: {html_file_path.name}")
                    return True, slides_from_js
                if is_slide_project and not slides_from_js:
                    logger.warning(f"magic.project.js 已标记为slide项目但未解析到slides: {html_file_path.parent}")

            # 2. 备用方案：浏览器运行时检测（处理复杂JS逻辑）
            logger.debug(f"静态检测未找到slides，尝试浏览器运行时检测: {html_file_path.name}")
            is_ppt, slides_from_runtime = await self._detect_slides_by_browser_runtime(html_file_path)
            if is_ppt and slides_from_runtime:
                logger.info(f"检测到PPT入口文件（浏览器运行时）: {html_file_path.name}")
                return True, slides_from_runtime

            # 3. 兜底：index.html 直接作为入口，按单页处理
            if is_index_html:
                logger.info(f"检测到PPT入口文件（index.html兜底）: {html_file_path.name}")
                return True, [html_file_path.name]

            # 非PPT入口文件的调试信息降级
            return False, []

        except Exception as e:
            logger.error(f"检测PPT入口文件失败 {html_file_path}: {e}")
            return False, []

    @staticmethod
    def _is_likely_ppt_entry_html(html_content: str) -> bool:
        """
        基于HTML内容判断是否可能为PPT入口文件

        入口文件特征：
        - 引入 magic.project.js
        - 定义 magicProjectConfigure / slideApp 等入口初始化逻辑
        """
        if not html_content:
            return False

        entry_markers = [
            "magic.project.js",
            "magicProjectConfigure",
            "slideApp",
            "window.slideApp",
        ]
        return any(marker in html_content for marker in entry_markers)

    async def _detect_slides_by_browser_runtime(self, html_file_path: Path) -> tuple[bool, List[str]]:
        """
        通过浏览器运行时环境检测 slides（备用方案）

        适用场景：
        - 复杂的 JS 逻辑生成 slides
        - 动态加载配置文件
        - 静态分析无法识别的格式

        Args:
            html_file_path: HTML文件路径

        Returns:
            (是否检测到slides, slides列表)
        """
        playwright_instance = None
        browser = None
        context = None
        page = None

        try:
            logger.debug(f"启动浏览器运行时检测: {html_file_path}")

            # 启动轻量级浏览器实例（支持服务端模式）
            playwright_instance, browser, context = await self._create_shared_browser_context(
                browser_type="pdf",
                viewport=ViewportSize(width=1280, height=720),
                device_scale_factor=1.0,
                context_options={
                    "locale": "zh-CN",
                    "timezone_id": "Asia/Shanghai",
                    "extra_http_headers": {
                        "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
                        "Accept-Charset": "utf-8,*;q=0.5",
                    },
                },
            )
            page = await context.new_page()
            self._bind_page_console_logger(page, debug_info="运行时检测slides")

            # 设置较短的超时时间（5秒），避免影响性能
            page.set_default_timeout(5000)

            # 使用 HTTP 服务器加载页面（如果可用）
            protocol, file_url = await self._choose_file_protocol(html_file_path, debug_info="运行时检测")

            # 加载页面
            await page.goto(file_url, wait_until="networkidle", timeout=5000)

            # 额外等待 JS 执行
            await asyncio.sleep(1.0)

            # 从浏览器运行时环境中提取 slides 配置
            slides_config = await page.evaluate("""
                () => {
                    // 策略1: window.slideApp.config.slides（标准格式）
                    if (window.slideApp && window.slideApp.config && window.slideApp.config.slides) {
                        return {
                            source: 'window.slideApp.config.slides',
                            slides: window.slideApp.config.slides
                        };
                    }

                    // 策略2: window.magicProjectConfig.slides
                    if (window.magicProjectConfig && window.magicProjectConfig.slides) {
                        return {
                            source: 'window.magicProjectConfig.slides',
                            slides: window.magicProjectConfig.slides
                        };
                    }

                    // 策略3: window.slides（直接定义）
                    if (window.slides && Array.isArray(window.slides)) {
                        return {
                            source: 'window.slides',
                            slides: window.slides
                        };
                    }

                    // 策略4: window.projectConfig.slides
                    if (window.projectConfig && window.projectConfig.slides) {
                        return {
                            source: 'window.projectConfig.slides',
                            slides: window.projectConfig.slides
                        };
                    }

                    // 策略5: 全局搜索任何名为 slides 的数组
                    for (let key in window) {
                        if (key.toLowerCase().includes('slide') && Array.isArray(window[key])) {
                            return {
                                source: `window.${key}`,
                                slides: window[key]
                            };
                        }
                    }

                    return null;
                }
            """)

            if slides_config and slides_config.get("slides"):
                slides = slides_config["slides"]
                source = slides_config.get("source", "unknown")

                # 处理 slides 数组
                slide_files = []
                for slide in slides:
                    if isinstance(slide, str):
                        slide_files.append(slide)
                    elif isinstance(slide, dict):
                        # 支持对象格式
                        for key in ["file", "path", "url", "src", "href", "name"]:
                            if key in slide and isinstance(slide[key], str):
                                slide_files.append(slide[key])
                                break

                if slide_files:
                    logger.info(f"浏览器运行时检测成功: 从 {source} 提取到 {len(slide_files)} 个slides")
                    return True, slide_files

            logger.debug(f"浏览器运行时未检测到slides配置")
            return False, []

        except asyncio.TimeoutError:
            logger.debug(f"浏览器运行时检测超时（页面加载或JS执行过慢）: {html_file_path}")
            return False, []
        except Exception as e:
            logger.debug(f"浏览器运行时检测异常: {e}")
            return False, []
        finally:
            # 确保清理资源
            try:
                if page:
                    await page.close()
            finally:
                await self._close_shared_browser_context(
                    playwright_instance, browser, context, log_prefix="运行时检测slides"
                )

    async def _check_magic_project_config(self, magic_project_js_path: Path) -> tuple[bool, List[str]]:
        """
        检查magic.project.js文件中的配置（增强版，支持多种格式）

        Args:
            magic_project_js_path: magic.project.js文件路径

        Returns:
            (是否是slide类型的项目, slides列表)
        """
        try:
            if not magic_project_js_path.exists():
                return False, []

            # 读取JS文件内容
            async with aiofiles.open(magic_project_js_path, "r", encoding="utf-8") as f:
                js_content = await f.read()

            # 策略1: 优先检测标准格式 window.magicProjectConfig
            standard_patterns = [
                r"window\.magicProjectConfig\s*=\s*(\{[\s\S]*?\});",
                r"magicProjectConfig\s*=\s*(\{[\s\S]*?\});",
            ]

            for pattern in standard_patterns:
                matches = re.finditer(pattern, js_content, re.MULTILINE | re.DOTALL)
                for match in matches:
                    try:
                        config_json = match.group(1)
                        # 尝试解析JSON
                        try:
                            config_data = json.loads(config_json)
                        except json.JSONDecodeError:
                            config_data = self._parse_js_object_simple(config_json)

                        if isinstance(config_data, dict):
                            project_type = config_data.get("type", "")
                            if project_type == "slide":
                                slides = config_data.get("slides", [])
                                if not isinstance(slides, list):
                                    slides = []
                                logger.info(f"检测到标准格式PPT配置 (magicProjectConfig): {len(slides)} 个slides")
                                return True, slides

                    except Exception as parse_error:
                        logger.debug(f"解析标准格式配置失败: {parse_error}")
                        continue

            # 策略2: 检测 window.slides 直接定义（兼容格式）
            # 增强：支持无分号、尾逗号、方括号访问等极端场景
            slides_array_patterns = [
                # 标准格式（有分号）
                r"window\.slides\s*=\s*(\[[\s\S]*?\]);",
                r"(?:const|var|let)\s+slides\s*=\s*(\[[\s\S]*?\]);",
                r"slides\s*=\s*(\[[\s\S]*?\]);",
                # 无分号格式（遇到换行或文件结束）
                r"window\.slides\s*=\s*(\[[\s\S]*?\])(?=\s*(?:\n|$|//))",
                r"(?:const|var|let)\s+slides\s*=\s*(\[[\s\S]*?\])(?=\s*(?:\n|$|//))",
                # 方括号访问格式
                r'window\[[\'"]\s*slides\s*[\'"]\]\s*=\s*(\[[\s\S]*?\])[;,\n]?',
            ]

            for pattern in slides_array_patterns:
                matches = re.finditer(pattern, js_content, re.MULTILINE | re.DOTALL)
                for match in matches:
                    try:
                        slides_json = match.group(1)

                        # 增强：预处理 JSON，移除注释和尾逗号
                        # 1. 移除单行注释 //
                        slides_json_cleaned = re.sub(r"//[^\n]*", "", slides_json)
                        # 2. 移除多行注释 /* */
                        slides_json_cleaned = re.sub(r"/\*[\s\S]*?\*/", "", slides_json_cleaned)
                        # 3. 移除尾逗号（数组或对象最后元素后的逗号）
                        slides_json_cleaned = re.sub(r",(\s*[}\]])", r"\1", slides_json_cleaned)

                        slides_data = json.loads(slides_json_cleaned)
                        if isinstance(slides_data, list) and slides_data:
                            # 提取slides中的文件路径
                            slide_files = []
                            for slide in slides_data:
                                if isinstance(slide, str):
                                    slide_files.append(slide)
                                elif isinstance(slide, dict):
                                    for key in ["file", "path", "url", "src", "href"]:
                                        if key in slide and isinstance(slide[key], str):
                                            slide_files.append(slide[key])
                                            break

                            if slide_files:
                                logger.info(f"检测到独立slides数组定义: {len(slide_files)} 个slides")
                                return True, slide_files

                    except json.JSONDecodeError:
                        # JSON解析失败，尝试字符串匹配
                        slides_content = match.group(1)
                        string_pattern = r'["\']([^"\']+\.html?)["\']'
                        string_matches = re.findall(string_pattern, slides_content)
                        if string_matches:
                            logger.info(f"检测到独立slides数组（字符串提取）: {len(string_matches)} 个slides")
                            return True, string_matches
                    except Exception as e:
                        logger.debug(f"解析独立slides数组失败: {e}")
                        continue

            # 策略3: 检测其他配置对象（如 projectConfig）中的 slides
            other_config_patterns = [
                r"window\.projectConfig\s*=\s*(\{[\s\S]*?\});",
                r"window\.config\s*=\s*(\{[\s\S]*?\});",
                r"projectConfig\s*=\s*(\{[\s\S]*?\});",
            ]

            for pattern in other_config_patterns:
                matches = re.finditer(pattern, js_content, re.MULTILINE | re.DOTALL)
                for match in matches:
                    try:
                        config_json = match.group(1)
                        # 尝试解析
                        try:
                            config_data = json.loads(config_json)
                        except json.JSONDecodeError:
                            config_data = self._parse_js_object_simple(config_json)

                        if isinstance(config_data, dict):
                            # 检查是否包含 slides 数组
                            slides = config_data.get("slides", [])
                            if isinstance(slides, list) and len(slides) > 0:
                                logger.info(f"检测到其他配置对象中的slides: {len(slides)} 个slides")
                                return True, slides

                    except Exception as parse_error:
                        logger.debug(f"解析其他配置对象失败: {parse_error}")
                        continue

            # 未找到任何 slides 配置
            logger.debug(f"magic.project.js 中未找到有效的slides配置")
            return False, []

        except Exception as e:
            logger.error(f"检查magic.project.js配置失败 {magic_project_js_path}: {e}")
            return False, []

    @staticmethod
    def _parse_js_object_simple(js_object_str: str) -> dict:
        """
        简单解析JavaScript对象字符串为Python字典（增强版）

        Args:
            js_object_str: JavaScript对象字符串

        Returns:
            解析后的字典
        """
        try:
            result = {}

            # 查找type字段（多种格式）
            type_patterns = [
                r'["\']?type["\']?\s*:\s*["\']([^"\']+)["\']',  # 匹配 type 为 "slide"
                r'["\']?type["\']?\s*:\s*([a-zA-Z]+)',  # 匹配 type 为 slide（无引号）
            ]
            for type_pattern in type_patterns:
                type_match = re.search(type_pattern, js_object_str)
                if type_match:
                    result["type"] = type_match.group(1)
                    break

            # 查找slides数组（增强匹配）
            slides_pattern = r'["\']?slides["\']?\s*:\s*(\[[\s\S]*?\](?=\s*[,}\n]))'
            slides_match = re.search(slides_pattern, js_object_str)
            if slides_match:
                try:
                    slides_json = slides_match.group(1)
                    slides_data = json.loads(slides_json)
                    if isinstance(slides_data, list):
                        # 处理数组元素
                        slide_files = []
                        for item in slides_data:
                            if isinstance(item, str):
                                slide_files.append(item)
                            elif isinstance(item, dict):
                                # 支持对象格式
                                for key in ["file", "path", "url", "src", "href", "name"]:
                                    if key in item and isinstance(item[key], str):
                                        slide_files.append(item[key])
                                        break
                        if slide_files:
                            result["slides"] = slide_files
                        else:
                            result["slides"] = slides_data
                except:
                    # 如果JSON解析失败，尝试提取字符串
                    slides_content = slides_match.group(1)
                    string_pattern = r'["\']([^"\']+\.html?)["\']'
                    string_matches = re.findall(string_pattern, slides_content)
                    if string_matches:
                        result["slides"] = string_matches

            return result

        except Exception as e:
            logger.error(f"简单解析JS对象失败: {e}")
            return {}

    @staticmethod
    async def resolve_slide_files_to_paths(base_path: Path, slide_files: List[str]) -> List[Path]:
        """
        将slides中的文件路径解析为绝对路径

        Args:
            base_path: HTML入口文件所在目录
            slide_files: slides文件列表

        Returns:
            解析后的文件路径列表
        """
        resolved_paths = []

        for slide_file in slide_files:
            try:
                # 处理相对路径
                if slide_file.startswith("./"):
                    slide_file = slide_file[2:]
                elif slide_file.startswith("../"):
                    # 暂不处理上级目录引用的slide文件，直接跳过
                    logger.warning(f"跳过上级目录引用的slide文件: {slide_file}")
                    continue

                # 构建绝对路径
                slide_path = base_path / slide_file

                # 检查文件是否存在
                if slide_path.exists() and slide_path.is_file():
                    resolved_paths.append(slide_path)
                    # 找到slide文件的详细信息降级为调试级别
                else:
                    logger.warning(f"slide文件不存在: {slide_path}")

            except Exception as e:
                logger.error(f"解析slide文件路径失败 {slide_file}: {e}")
                continue

        logger.info(f"解析slide文件完成: {len(resolved_paths)}/{len(slide_files)} 个有效")
        return resolved_paths

    def _resolve_project_dir_and_root(self, file_key: str, file_path: Path) -> tuple[str, Path]:
        project_dir_from_key = self.get_project_directory_from_file_key(file_key)
        project_root = Path(".workspace") / project_dir_from_key if project_dir_from_key else file_path.parent
        if project_dir_from_key:
            return project_dir_from_key, project_root

        parent_name = file_path.parent.name.lower()
        if parent_name == "workspace" or parent_name == ".workspace":
            return file_path.stem, project_root

        return file_path.parent.name, project_root

    async def _get_magic_project_slides_with_cache(
        self, project_root: Path, cache: Dict[Path, tuple[bool, List[str]]]
    ) -> tuple[bool, List[str]]:
        cached = cache.get(project_root)
        if cached is not None:
            return cached

        magic_project_js = project_root / "magic.project.js"
        if not magic_project_js.exists():
            cache[project_root] = (False, [])
            return False, []

        is_slide_project, slides = await self._check_magic_project_config(magic_project_js)
        cache[project_root] = (is_slide_project, slides)
        return is_slide_project, slides

    async def _resolve_ppt_slide_sources(
        self, file_path: Path, is_html_file: bool, project_root: Path, magic_slides: List[str]
    ) -> tuple[bool, List[str], List[Path]]:
        is_ppt_entry = False
        slides_from_entry: List[str] = []
        if is_html_file:
            is_ppt_entry, slides_from_entry = await self.detect_ppt_entry_file(file_path)

        if magic_slides:
            slide_files = await self.resolve_slide_files_to_paths(project_root, magic_slides)
            if slide_files:
                return is_ppt_entry, magic_slides, slide_files

        if slides_from_entry:
            slide_files = await self.resolve_slide_files_to_paths(file_path.parent, slides_from_entry)
            return is_ppt_entry, slides_from_entry, slide_files

        return is_ppt_entry, [], []

    @staticmethod
    def _build_ppt_project_files(
        is_ppt_entry: bool,
        entry_file_in_input: bool,
        entry_file_in_slides: bool,
        entry_file_path: Path,
        slide_files: List[Path],
        input_file_set: set[Path],
    ) -> List[Path]:
        if is_ppt_entry and entry_file_in_input:
            ppt_project_files = []
            if entry_file_in_slides:
                ppt_project_files.append(entry_file_path)
            else:
                logger.info(f"入口文件 {entry_file_path.name} 不在slides中，跳过转换")

            ppt_project_files.extend(slide_files)
            return ppt_project_files

        return [slide_file for slide_file in slide_files if slide_file in input_file_set]

    @staticmethod
    def _add_or_merge_ppt_project(
        projects: Dict[str, Dict[str, Any]],
        project_name: str,
        ppt_project_files: List[Path],
        slide_files: List[Path],
        entry_file: Optional[Path],
    ) -> None:
        if project_name in projects and not projects[project_name]["is_ppt_entry"]:
            existing_files = projects[project_name]["files"]
            ppt_project_files.extend(existing_files)
            logger.info(f"将现有项目 '{project_name}' 转换为PPT项目，合并 {len(existing_files)} 个现有文件")

        projects[project_name] = {
            "files": ppt_project_files,
            "is_ppt_entry": True,
            "slides": slide_files,
            "entry_file": entry_file,
        }

    @staticmethod
    def _add_regular_project_file(
        project_dir: str,
        projects: Dict[str, Dict[str, Any]],
        file_path: Path,
        processed_files: set[str],
        file_key: str,
    ) -> None:
        project_info = projects.get(project_dir)
        if not project_info:
            project_info = {"files": [], "is_ppt_entry": False, "slides": [], "entry_file": None}
            projects[project_dir] = project_info

        if project_info["is_ppt_entry"]:
            processed_files.add(file_key)
            return

        project_info["files"].append(file_path)
        processed_files.add(file_key)

    async def analyze_and_group_files(
        self, file_path_mapping: Dict[str, Path], supported_extensions: List[str], service_type: str = "转换"
    ) -> Dict[str, Dict[str, Any]]:
        """
        分析文件并按项目分组（通用方法）

        Args:
            file_path_mapping: 文件key到路径的映射
            supported_extensions: 支持的文件扩展名列表，如 ['.html', '.htm'] 或 ['.html', '.htm', '.md']
            service_type: 服务类型名称，用于日志显示

        Returns:
            项目字典，格式为：{项目名: {files: [文件路径列表], is_ppt_entry: bool, slides: [slide文件列表]}}
        """
        projects = {}
        processed_files = set()
        input_file_set = set(file_path_mapping.values())
        file_path_to_key = {file_path: file_key for file_key, file_path in file_path_mapping.items()}
        magic_project_cache: Dict[Path, tuple[bool, List[str]]] = {}

        logger.info(f"开始分析文件并检测PPT入口（{service_type}模式）...")

        for file_key, file_path in file_path_mapping.items():
            if file_key in processed_files:
                continue

            # 只处理支持的文件类型
            file_suffix = file_path.suffix.lower()
            if file_suffix not in supported_extensions:
                # 跳过文件的详细信息降级为调试级别
                continue

            try:
                project_dir, project_root = self._resolve_project_dir_and_root(file_key, file_path)
                is_slide_project, magic_slides = await self._get_magic_project_slides_with_cache(
                    project_root, magic_project_cache
                )
                slide_sources_input = magic_slides if is_slide_project else []

                is_html_file = self._is_html_file(file_path)
                is_ppt_entry, slide_sources, slide_files = await self._resolve_ppt_slide_sources(
                    file_path, is_html_file, project_root, slide_sources_input
                )

                if is_html_file and slide_files:
                    if is_ppt_entry:
                        logger.info(f"检测到PPT入口文件: {file_path}, slides: {slide_sources}")

                    entry_file_in_input = file_path in input_file_set
                    entry_filename = file_path.name
                    entry_file_in_slides = entry_file_in_input and any(
                        slide_path.endswith(entry_filename) or slide_path == entry_filename
                        for slide_path in slide_sources
                    )

                    ppt_project_files = self._build_ppt_project_files(
                        is_ppt_entry,
                        entry_file_in_input,
                        entry_file_in_slides,
                        file_path,
                        slide_files,
                        input_file_set,
                    )

                    if ppt_project_files:
                        project_name = project_dir
                        entry_file = file_path if is_ppt_entry else None
                        self._add_or_merge_ppt_project(
                            projects, project_name, ppt_project_files, slide_files, entry_file
                        )
                        for ppt_file in ppt_project_files:
                            ppt_file_key = file_path_to_key.get(ppt_file)
                            if ppt_file_key:
                                processed_files.add(ppt_file_key)
                        if entry_file_in_input:
                            processed_files.add(file_key)
                        logger.info(f"PPT项目 '{project_name}' 创建完成，包含 {len(slide_files)} 个slides文件")
                        continue

                self._add_regular_project_file(project_dir, projects, file_path, processed_files, file_key)

            except Exception as e:
                logger.error(f"分析文件失败 {file_path}: {e}")
                continue

        # 移除空的项目
        projects = {name: info for name, info in projects.items() if info["files"]}

        logger.info(f"文件分析完成，共创建 {len(projects)} 个{service_type}项目")
        return projects

    @staticmethod
    def prepare_ordered_files_for_project(project_info: Dict[str, Any]) -> List[Path]:
        """
        为项目准备有序的文件列表

        Args:
            project_info: 项目信息字典

        Returns:
            有序的文件路径列表
        """
        files_to_convert = project_info["files"]

        # 如果是PPT入口项目，按slides顺序转换
        if project_info["is_ppt_entry"] and project_info["slides"]:
            # 准备有序文件列表：入口文件（如果存在）+ slides文件
            ordered_files = []

            # 如果entry_file存在且在实际文件列表中，放在最前面
            if project_info["entry_file"] and project_info["entry_file"] in files_to_convert:
                ordered_files.append(project_info["entry_file"])

            # 添加slides文件（按slides定义的顺序）
            for slide_file in project_info["slides"]:
                if slide_file in files_to_convert:
                    ordered_files.append(slide_file)

            # 去重并保持顺序
            seen = set()
            files_to_convert = []
            for f in ordered_files:
                if f not in seen:
                    files_to_convert.append(f)
                    seen.add(f)

            # PPT项目排序的详细信息降级为调试级别

        return files_to_convert

    def calculate_file_statistics_and_concurrency(
        self, projects: Dict[str, Dict[str, Any]], supported_extensions: List[str], service_type: str = "转换"
    ) -> tuple[int, Dict[str, int], int]:
        """
        计算文件统计信息和最优并发数（通用方法）

        Args:
            projects: 项目字典
            supported_extensions: 支持的文件扩展名列表，如 ['.html', '.htm', '.md']
            service_type: 服务类型名称，用于日志显示

        Returns:
            tuple: (valid_files_count, file_type_counts, optimal_concurrency)
        """
        # 统计实际要转换的文件类型分布
        valid_files_count = sum(len(project["files"]) for project in projects.values())
        file_type_counts = {}

        for project_info in projects.values():
            for file_path in project_info["files"]:
                file_suffix = file_path.suffix.lower()

                # 检查是否在支持的扩展名中
                if file_suffix in supported_extensions:
                    normalized_extension = file_suffix.lstrip(".")
                    file_type_category = "html" if normalized_extension in ["html", "htm"] else normalized_extension
                    file_type_counts[file_type_category] = file_type_counts.get(file_type_category, 0) + 1

        # 计算最优并发数
        optimal_concurrency = self._calculate_conversion_concurrency(file_type_counts)

        # 输出统计日志
        logger.info(f"{service_type}文件统计: 有效文件 {valid_files_count} 个")
        logger.info(f"{service_type}文件类型分布: {file_type_counts}")
        logger.info(
            f"{service_type}使用并发数: {optimal_concurrency} "
            f"(基于实际文件类型分布，实际转换文件数: {valid_files_count})"
        )

        return valid_files_count, file_type_counts, optimal_concurrency

    async def _process_conversion_result(
        self,
        converted_files: List[Path],
        batch_id: str,
        batch_dir: Path,
        valid_files_count: int,
        task_key: Optional[str] = None,
        sts_cred_obj: Optional[Any] = None,
        service_specific_data: Optional[Dict[str, Any]] = None,
        conversion_errors: Optional[List[str]] = None,
        actual_processed_files_count: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        通用的转换结果处理方法

        Args:
            converted_files: 转换后的文件列表
            batch_id: 批次ID
            batch_dir: 批次目录
            valid_files_count: 有效文件数量
            task_key: 任务标识符
            sts_cred_obj: STS凭证对象
            service_specific_data: 服务特定的数据（如total_urls, ppt_projects等）
            conversion_errors: 转换错误列表
            actual_processed_files_count: 实际成功处理的输入文件数量（如果不提供，使用len(converted_files)）

        Returns:
            处理后的结果字典
        """
        # 🎯 使用正确的成功处理文件数量：实际处理的输入文件数量，而不是输出文件数量
        actual_success_count = (
            actual_processed_files_count if actual_processed_files_count is not None else len(converted_files)
        )

        # 构建基础结果字典
        result = {
            "batch_id": batch_id,
            "valid_files_count": valid_files_count,
            "success_count": actual_success_count,
            "conversion_rate": 100.0,  # 转换完成即设置为100%
            "files": [],
        }

        # 添加服务特定数据
        if service_specific_data:
            result.update(service_specific_data)

        # 如果有task_key，添加到结果中
        if task_key:
            result["task_key"] = task_key

        if not converted_files:
            return result

        upload_success = False
        task_mgr = task_manager if task_key else None

        # 生成输出文件并上传
        if converted_files:
            # 情况A：仅一个文件，直接返回单文件（不打包）
            if len(converted_files) == 1 and converted_files[0] is not None:
                single_file = converted_files[0]
                file_ext = single_file.suffix.lstrip(".").lower() or "file"
                single_info = {"filename": single_file.stem, "local_path": str(single_file), "type": file_ext}

                # 尝试上传单文件
                try:
                    _, oss_key = await self._upload_file_to_storage(single_file, sts_cred_obj)
                    if oss_key:
                        single_info["oss_key"] = oss_key
                        upload_success = True
                        logger.info(f"输出文件上传成功，存储键: {oss_key}")
                    else:
                        logger.warning("输出文件上传失败，仅返回本地路径")
                except Exception as e:
                    logger.error(f"上传文件到OSS失败: {e}")
                    # 上传失败不中断流程

                result["files"].append(single_info)
                logger.info(f"单文件输出生成完成，转换率设置为100%: {single_file}")

            # 情况B：多个文件，打包为ZIP
            else:
                # 从第一个文件中提取项目名称，或使用服务名称作为默认值
                project_name = ""
                if converted_files and converted_files[0]:
                    # 尝试从文件名中提取项目名称（去掉时间戳部分）
                    filename = converted_files[0].stem
                    parts = filename.split("_")
                    if len(parts) >= 2:
                        # 假设格式是项目名_其他部分，取第一部分作为项目名
                        extracted_name = parts[0]
                        # 特殊处理：如果提取到的是workspace目录名，且只有单个文件，应该使用更合适的名称
                        if extracted_name.lower() in [".workspace", "workspace"] and len(converted_files) == 1:
                            logger.warning(f"检测到workspace根目录单文件情况，文件名: {filename}")
                            project_name = extracted_name
                        else:
                            project_name = extracted_name
                    else:
                        project_name = filename

                zip_file = await self._create_zip_file(converted_files, batch_dir, project_name)
                if zip_file:
                    zip_info = {"filename": zip_file.stem, "local_path": str(zip_file), "type": "zip"}

                    # 尝试上传
                    try:
                        _, oss_key = await self._upload_file_to_storage(zip_file, sts_cred_obj)
                        if oss_key:
                            zip_info["oss_key"] = oss_key
                            upload_success = True
                            logger.info(f"ZIP文件上传成功，存储键: {oss_key}")
                        else:
                            logger.warning("ZIP文件上传失败，仅返回本地路径")
                    except Exception as e:
                        logger.error(f"上传文件到OSS失败: {e}")
                        # 上传失败不中断流程

                    result["files"].append(zip_info)
                    logger.info(f"ZIP文件生成完成，转换率设置为100%: {zip_file}")

        # 后续处理（如果有ZIP文件）
        if result["files"]:
            # 重置agent idle时间
            self.update_agent_activity("输出文件生成成功")

            # 记录内存使用情况
            # self._log_memory_usage("ZIP生成完成", task_key, actual_success_count, valid_files_count)  # 注释掉内存监控日志

            # 更新最终进度到100%
            if task_mgr and task_key:
                logger.info(
                    f"{self.service_name}转换全部完成，更新最终进度: {actual_success_count}/{valid_files_count} -> 100.0%"
                )
                await task_mgr.update_conversion_rate(task_key, 100.0, actual_success_count, valid_files_count)
                logger.debug(f"{self.service_name}最终进度更新调用完成: Task {task_key}")

                # 记录上传状态（仅用于日志）
                if upload_success:
                    logger.info(f"{self.service_name}文件上传成功，可通过oss_key访问")
                else:
                    logger.warning(f"{self.service_name}文件上传失败，仅本地可用，外部可通过oss_key字段判断")

        # 处理转换错误（如果有）
        if conversion_errors:
            result["conversion_errors"] = conversion_errors
            result["partial_success"] = True

        # 🧹 清理：停止按需启动的静态文件服务器
        try:
            await self._stop_static_file_server()
        except Exception as e:
            logger.warning(f"停止静态文件服务器时出现错误: {e}")

        return result

    async def _create_shared_browser_context(
        self,
        browser_type: str = "pdf",
        viewport: Optional[ViewportSize] = None,
        device_scale_factor: float = 1.0,
        user_agent: Optional[str] = None,
        context_options: Optional[Dict[str, Any]] = None,
    ):
        """
        创建共享浏览器实例和上下文

        Args:
            browser_type: 浏览器类型，"pdf" 或 "screenshot"
            viewport: 视口尺寸配置 (浏览器可见区域)
            device_scale_factor: 设备像素比
            user_agent: 用户代理
            context_options: 额外的上下文配置

        Returns:
            (playwright_instance, browser, context)
        """
        playwright_instance = None
        browser = None
        try:
            playwright_instance = await async_playwright().start()

            # 读取浏览器配置（复用 magic_use 的服务端模式逻辑）
            config = MagicBrowserConfig.create_for_scraping()

            # PDF/PPTX 转换仅支持 Chromium
            if config.browser_type and config.browser_type.lower() != "chromium":
                logger.info(
                    f"{self.service_name}转换：检测到浏览器类型配置为 {config.browser_type}，已强制使用 chromium"
                )
            browser_type_obj = playwright_instance.chromium

            # 根据类型选择启动参数
            if browser_type == "pdf":
                args = self.PDF_BROWSER_ARGS
                default_viewport = {"width": 1920, "height": 1080}
                default_user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            else:  # screenshot
                args = self.SCREENSHOT_BROWSER_ARGS
                default_viewport = {"width": 1920, "height": 1080}
                default_user_agent = None

            # 根据配置选择服务端/本地模式
            if config.use_server_mode:
                ws_url = config.browser_server_url
                if not ws_url:
                    raise RuntimeError("启用浏览器服务端模式但未配置 browser_server_url")
                if not ws_url.startswith(("ws://", "wss://")):
                    raise RuntimeError(f"browser_server_url 必须以 ws:// 或 wss:// 开头，当前值: {ws_url}")

                logger.info(f"{self.service_name}转换：使用服务端模式连接浏览器 {ws_url}")
                await wait_for_browser_server(
                    ws_url=ws_url,
                    timeout=config.server_health_check_timeout,
                    check_interval=config.server_health_check_interval,
                )
                browser = await browser_type_obj.connect(ws_url, timeout=config.server_connect_timeout)
            else:
                logger.info(f"{self.service_name}转换：使用本地模式启动浏览器 ({browser_type}模式)")
                browser = await browser_type_obj.launch(headless=True, args=args)

            # 构建上下文配置
            context_config: Dict[str, Any] = {
                "viewport": viewport or default_viewport,
                "device_scale_factor": device_scale_factor,
            }

            if default_user_agent:
                context_config["user_agent"] = user_agent or default_user_agent

            if context_options:
                context_config.update(context_options)

            context = await browser.new_context(**context_config)

            logger.info(f"{self.service_name}转换：共享浏览器和上下文创建完成")
            return playwright_instance, browser, context

        except Exception:
            if browser:
                try:
                    await browser.close()
                except Exception:
                    pass
            if playwright_instance:
                try:
                    await playwright_instance.stop()
                except Exception:
                    pass
            raise

    async def _close_shared_browser_context(self, playwright_instance, browser, context, log_prefix: str = "") -> None:
        """
        关闭浏览器实例和上下文

        Args:
            playwright_instance: Playwright实例
            browser: 浏览器实例
            context: 浏览器上下文
            log_prefix: 日志前缀
        """
        prefix = log_prefix or f"{self.service_name}转换"
        try:
            if context:
                await context.close()
            if browser:
                await browser.close()
            if playwright_instance:
                await playwright_instance.stop()
            logger.info(f"{prefix}共享浏览器资源已清理完成")
        except Exception as cleanup_error:
            logger.warning(f"{prefix}清理浏览器资源时发生错误: {cleanup_error}")

    @staticmethod
    async def _scroll_to_trigger_lazy_loading(page, debug_info: str = "") -> bool:
        """
        滚动页面到底部以触发懒加载内容

        Args:
            page: Playwright页面对象
            debug_info: 调试信息前缀

        Returns:
            bool: 是否成功完成滚动操作
        """
        try:
            # 懒加载滚动开始的详细信息降级为调试级别

            # 1. 获取页面初始高度
            initial_height = await page.evaluate("document.body.scrollHeight")

            # 2. 逐步滚动到底部，给懒加载时间响应
            scroll_step = 500  # 每次滚动500px
            current_position = 0
            max_scrolls = 30  # 最多滚动30次，支持很长的页面
            scroll_count = 0
            stable_height_count = 0  # 连续高度稳定次数
            last_height = initial_height

            while scroll_count < max_scrolls:
                # 获取当前页面高度
                page_height = await page.evaluate("document.body.scrollHeight")

                # 检测页面高度是否稳定（连续3次高度不变表示懒加载可能完成）
                if page_height == last_height:
                    stable_height_count += 1
                else:
                    stable_height_count = 0
                    last_height = page_height

                # 如果已经滚动到底部，退出
                if current_position >= page_height - 1000:  # 留1000px余量
                    # 滚动到底部的详细信息降级为调试级别
                    break

                # 如果页面高度连续稳定且滚动了一定距离，可能懒加载已完成
                if stable_height_count >= 3 and scroll_count > 5:
                    # 懒加载完成检测的详细信息降级为调试级别
                    break

                # 滚动到下一个位置
                current_position = min(current_position + scroll_step, page_height)
                await page.evaluate(f"window.scrollTo(0, {current_position})")

                # 等待懒加载响应，对于图片较多的页面给更多时间
                await page.wait_for_timeout(400)  # 400ms等待懒加载
                scroll_count += 1

                # 滚动进度的详细信息降级，减少噪音

            # 3. 最终滚动到绝对底部，再等待一下确保所有懒加载完成
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await page.wait_for_timeout(1500)  # 等待1.5秒让最后的懒加载完成

            # 额外检查是否有新的内容加载
            await page.wait_for_timeout(500)

            # 4. 检测滚动后的页面变化
            final_height = await page.evaluate("document.body.scrollHeight")
            height_increase = final_height - initial_height

            # 只在页面高度有显著变化时才输出日志
            if height_increase > 200:  # 只有高度增长超过200px才算显著
                logger.info(f"{debug_info}: 懒加载生效，页面高度增长 {height_increase}px")
            # 其他情况的详细信息全部降级为调试级别

            # 5. 滚动回到顶部（PDF转换通常从顶部开始）
            await page.evaluate("window.scrollTo(0, 0)")
            await page.wait_for_timeout(500)  # 等待滚动完成

            # 滚动回顶部的详细信息降级为调试级别

            return True

        except Exception as e:
            logger.warning(f"{debug_info}: 滚动触发懒加载失败: {e}")
            # 即使滚动失败，也尝试滚动回顶部
            try:
                await page.evaluate("window.scrollTo(0, 0)")
                await page.wait_for_timeout(500)
            except:
                pass
            return False

    @staticmethod
    async def _wait_for_fonts_optimized(page, timeout: int = 20000, debug_info: str = "") -> bool:
        """
        专门优化字体加载等待策略

        特别针对：
        1. Google Fonts (fonts.googlefonts.cn、fonts.googleapis.com)
        2. FontAwesome字体文件
        3. 自定义字体加载检测
        4. 字体渲染稳定性检测

        Args:
            page: Playwright页面对象
            timeout: 超时时间（毫秒）
            debug_info: 调试信息前缀

        Returns:
            bool: 字体是否加载成功
        """
        try:
            logger.debug(f"{debug_info}: 开始专门的字体加载优化检测...")

            # 1. 检测页面中是否有Google Fonts和其他字体资源
            font_resources = await page.evaluate("""
                () => {
                    const googleFonts = [];
                    const otherFonts = [];
                    const fontFaceRules = [];

                    // 检测Google Fonts链接
                    const links = document.querySelectorAll('link[href*="fonts.google"], link[href*="googleapis.com"], link[href*="googlefonts.cn"]');
                    links.forEach(link => {
                        googleFonts.push({
                            href: link.href,
                            loaded: link.sheet !== null
                        });
                    });

                    // 检测其他字体相关的CSS链接（排除 preconnect 和 Google Fonts 域名）
                    const fontLinks = document.querySelectorAll('link[href*="font"], link[href*="Font"]');
                    fontLinks.forEach(link => {
                        // 排除 preconnect 链接和 Google Fonts 专用域名
                        const isPreconnect = link.rel === 'preconnect' || link.rel === 'dns-prefetch';
                        const isGoogleFonts = link.href.includes('fonts.googleapis.com') ||
                                             link.href.includes('fonts.googlefonts.cn') ||
                                             link.href.includes('fonts.gstatic.com') ||
                                             link.href.includes('fonts.gstatic.cn');

                        if (!isPreconnect && !isGoogleFonts && link.rel === 'stylesheet') {
                            otherFonts.push({
                                href: link.href,
                                loaded: link.sheet !== null
                            });
                        }
                    });

                    // 检测@font-face规则
                    try {
                        for (let i = 0; i < document.styleSheets.length; i++) {
                            const sheet = document.styleSheets[i];
                            if (sheet.cssRules || sheet.rules) {
                                const rules = sheet.cssRules || sheet.rules;
                                for (let j = 0; j < rules.length; j++) {
                                    const rule = rules[j];
                                    if (rule.type === CSSRule.FONT_FACE_RULE) {
                                        fontFaceRules.push({
                                            fontFamily: rule.style.fontFamily,
                                            src: rule.style.src
                                        });
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        // 忽略跨域样式表错误
                    }

                    return {
                        googleFonts,
                        otherFonts,
                        fontFaceRules,
                        totalFontResources: googleFonts.length + otherFonts.length + fontFaceRules.length
                    };
                }
            """)

            logger.info(
                f"{debug_info}: 检测到字体资源 - Google Fonts: {len(font_resources['googleFonts'])}, "
                f"其他字体: {len(font_resources['otherFonts'])}, @font-face规则: {len(font_resources['fontFaceRules'])}"
            )

            # 记录Google Fonts资源
            for gfont in font_resources["googleFonts"]:
                logger.debug(f"{debug_info}: Google Fonts - {gfont['href']} (loaded: {gfont['loaded']})")

            # 记录其他字体资源（用于调试误判）
            for ofont in font_resources["otherFonts"]:
                logger.debug(f"{debug_info}: 其他字体 - {ofont['href']} (loaded: {ofont['loaded']})")

            # 2. 如果检测到字体资源，进行专门的等待和检测
            if font_resources["totalFontResources"] > 0:
                logger.info(f"{debug_info}: 检测到 {font_resources['totalFontResources']} 个字体资源，开始专门等待...")

                # 2.1 等待字体相关CSS加载完成
                # Google Fonts 跳过 link.sheet 检查，直接依赖 document.fonts API
                has_non_google_fonts = font_resources["totalFontResources"] > len(font_resources["googleFonts"])

                if has_non_google_fonts:
                    # 只有非 Google Fonts 时才等待 link.sheet
                    try:
                        await page.wait_for_function(
                            """
                            () => {
                                const links = document.querySelectorAll('link[href*="font"], link[href*="Font"]');
                                let allLoaded = true;
                                links.forEach(link => {
                                    const href = link && link.href ? link.href : '';
                                    const isGoogle = href.includes('googleapis') || href.includes('googlefonts') || href.includes('fonts.google');
                                    // 只检查非 Google 字体的 link.sheet
                                    if (!isGoogle && !link.sheet) {
                                        allLoaded = false;
                                    }
                                });
                                return allLoaded;
                            }
                        """,
                            timeout=min(timeout, 8000),
                        )
                        logger.debug(f"{debug_info}: 非Google字体CSS加载完成")
                    except Exception as font_css_error:
                        logger.warning(f"{debug_info}: 非Google字体CSS等待超时: {font_css_error}")
                else:
                    # 纯 Google Fonts，跳过 link.sheet 检查，避免浪费 8 秒
                    logger.debug(f"{debug_info}: 仅有Google Fonts，跳过CSS link.sheet检查，直接使用fonts API")

                # 2.2 使用document.fonts API等待字体文件下载完成
                try:
                    # 先检查fonts API是否可用
                    fonts_api_available = await page.evaluate("""
                        () => {
                            return !!(document.fonts && document.fonts.ready && document.fonts.load);
                        }
                    """)

                    if fonts_api_available:
                        logger.debug(f"{debug_info}: 使用document.fonts API检测字体加载状态...")

                        # 等待所有字体加载完成
                        await page.evaluate("""
                            async () => {
                                if (document.fonts && document.fonts.ready) {
                                    await document.fonts.ready;
                                }
                            }
                        """)

                        # 验证字体确实已加载
                        await page.wait_for_function(
                            """
                            () => {
                                if (!document.fonts) return true;

                                // 检查字体加载状态
                                const status = document.fonts.status;
                                const size = document.fonts.size;

                                // 如果有字体，确保状态为loaded
                                if (size > 0) {
                                    return status === 'loaded';
                                }

                                return true; // 没有字体时认为已完成
                            }
                        """,
                            timeout=min(timeout, 25000),
                        )  # 字体文件下载给25秒

                        fonts_info = await page.evaluate("""
                            () => {
                                if (!document.fonts) return { status: 'unavailable', size: 0 };
                                return {
                                    status: document.fonts.status,
                                    size: document.fonts.size
                                };
                            }
                        """)
                        logger.debug(
                            f"{debug_info}: 字体API检测完成 - 状态: {fonts_info['status']}, 数量: {fonts_info['size']}"
                        )

                    else:
                        logger.debug(f"{debug_info}: document.fonts API不可用，使用固定等待策略")
                        await asyncio.sleep(4.0)  # 给Google Fonts等更充裕的加载时间

                except Exception as fonts_api_error:
                    logger.warning(f"{debug_info}: 字体API检测异常: {fonts_api_error}")
                    await asyncio.sleep(3.0)  # 降级到固定等待

                # 2.3 字体渲染稳定性检测 - 特别针对中文字体
                logger.debug(f"{debug_info}: 进行字体渲染稳定性检测...")
                try:
                    # 检测关键字体族是否正确应用
                    await page.evaluate("""
                        () => {
                            // 创建测试元素来检查字体是否正确渲染
                            const testElement = document.createElement('div');
                            testElement.style.fontFamily = 'Noto Sans SC, sans-serif';
                            testElement.style.fontSize = '16px';
                            testElement.textContent = '测试字体渲染';
                            testElement.style.position = 'absolute';
                            testElement.style.left = '-9999px';
                            testElement.style.top = '-9999px';
                            document.body.appendChild(testElement);

                            // 获取计算样式
                            const computedStyle = window.getComputedStyle(testElement);
                            const actualFontFamily = computedStyle.fontFamily;

                            // 清理测试元素
                            document.body.removeChild(testElement);

                            return {
                                fontFamily: actualFontFamily,
                                rendered: true
                            };
                        }
                    """)

                    # 给字体渲染一些额外的稳定时间
                    await asyncio.sleep(1.5)

                except Exception as render_test_error:
                    logger.debug(f"{debug_info}: 字体渲染测试异常: {render_test_error}")

            else:
                logger.debug(f"{debug_info}: 未检测到特殊字体资源，使用标准等待")
                await asyncio.sleep(1.0)

            logger.info(f"{debug_info}: 字体加载优化完成")
            return True

        except Exception as e:
            logger.error(f"{debug_info}: 字体加载优化过程中发生错误: {e}")
            # 确保即使出错也给基本的字体加载时间
            await asyncio.sleep(2.0)
            return False

    @staticmethod
    async def _load_external_resources_with_retry(
        page, max_retries: int = 3, timeout_per_attempt: int = 15000, debug_info: str = ""
    ) -> bool:
        """
        带重试机制的外部资源加载

        提供：
        1. 多次重试机制
        2. 逐步增加超时时间
        3. 部分资源失败的优雅降级
        4. 详细的失败诊断信息

        Args:
            page: Playwright页面对象
            max_retries: 最大重试次数
            timeout_per_attempt: 每次尝试的超时时间（毫秒）
            debug_info: 调试信息前缀

        Returns:
            bool: 资源加载是否成功（部分成功也返回True）
        """
        for attempt in range(max_retries):
            try:
                # 🎯 优化超时策略：第一次30秒充足时间，后续重试使用10秒
                if attempt == 0:
                    current_timeout = timeout_per_attempt  # 第一次使用完整的30秒
                else:
                    current_timeout = 10000  # 重试时使用10秒（已有缓存，加载应该更快）

                logger.info(
                    f"{debug_info}: 尝试加载外部资源 (第 {attempt + 1}/{max_retries} 次, 超时: {current_timeout / 1000}s)"
                )

                # 检测当前失败的资源
                resource_status = await page.evaluate("""
                    () => {
                        const failedResources = [];
                        const successResources = [];

                        // 检查CSS资源状态
                        const cssLinks = document.querySelectorAll('link[rel="stylesheet"][href]');
                        cssLinks.forEach(link => {
                            const href = link.href;
                            if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                                if (!link.sheet) {
                                    failedResources.push({ type: 'CSS', url: href, element: link });
                                } else {
                                    successResources.push({ type: 'CSS', url: href });
                                }
                            }
                        });

                        // 检查JavaScript资源状态
                        const scripts = document.querySelectorAll('script[src]');
                        scripts.forEach(script => {
                            const src = script.src;
                            if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
                                const isLoaded = !script.readyState || script.readyState === 'complete' || script.readyState === 'loaded';
                                if (!isLoaded) {
                                    failedResources.push({ type: 'JS', url: src, element: script });
                                } else {
                                    successResources.push({ type: 'JS', url: src });
                                }
                            }
                        });

                        return {
                            failed: failedResources.map(r => ({ type: r.type, url: r.url })),
                            success: successResources,
                            totalExternal: failedResources.length + successResources.length,
                            allLoaded: failedResources.length === 0
                        };
                    }
                """)

                logger.debug(
                    f"{debug_info}: 资源状态检查 - 成功: {len(resource_status['success'])}, "
                    f"失败: {len(resource_status['failed'])}, 总计: {resource_status['totalExternal']}"
                )

                # 如果所有资源都已加载成功，直接返回
                if resource_status["allLoaded"] or resource_status["totalExternal"] == 0:
                    logger.info(f"{debug_info}: 所有外部资源加载成功")
                    return True

                # 记录失败的资源
                failed_resources = resource_status["failed"]
                for failed in failed_resources:
                    logger.warning(f"{debug_info}: 资源加载失败 [{failed['type']}]: {failed['url']}")

                # 尝试等待失败的资源加载完成
                if len(failed_resources) > 0:
                    logger.info(f"{debug_info}: 等待 {len(failed_resources)} 个失败资源重新加载...")

                    try:
                        # 等待资源加载完成或超时
                        await page.wait_for_function(
                            """
                            () => {
                                // 检查所有外部CSS
                                const cssLinks = document.querySelectorAll('link[rel="stylesheet"][href]');
                                let allCssLoaded = true;
                                cssLinks.forEach(link => {
                                    const href = link.href;
                                    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                                        if (!link.sheet) {
                                            allCssLoaded = false;
                                        }
                                    }
                                });

                                // 检查所有外部JavaScript
                                const scripts = document.querySelectorAll('script[src]');
                                let allJsLoaded = true;
                                scripts.forEach(script => {
                                    const src = script.src;
                                    if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
                                        if (script.readyState && script.readyState !== 'complete' && script.readyState !== 'loaded') {
                                            allJsLoaded = false;
                                        }
                                    }
                                });

                                return allCssLoaded && allJsLoaded;
                            }
                        """,
                            timeout=current_timeout,
                        )

                        logger.info(f"{debug_info}: 资源重新加载成功 (第 {attempt + 1} 次尝试)")
                        return True

                    except Exception as wait_error:
                        logger.warning(f"{debug_info}: 第 {attempt + 1} 次资源加载等待超时: {wait_error}")

                        # 如果不是最后一次尝试，考虑页面刷新策略
                        if attempt < max_retries - 1:
                            retry_delay = (attempt + 1) * 2  # 递增延迟: 2s, 4s, 6s...

                            # 🎯 新策略：第2次重试时刷新页面，利用缓存和网络优化
                            if attempt == 1:  # 第2次尝试时（索引为1）
                                logger.info(f"{debug_info}: 第2次重试采用页面刷新策略，利用浏览器缓存提高成功率...")
                                try:
                                    # 刷新页面，利用已缓存的外部资源
                                    await page.reload(wait_until="domcontentloaded", timeout=20000)
                                    logger.debug(f"{debug_info}: 页面刷新完成，外部资源可能已缓存")

                                    # 等待网络空闲
                                    await page.wait_for_load_state("networkidle")
                                    logger.debug(f"{debug_info}: 刷新后网络空闲状态达成")

                                    # 给刷新后的资源一些加载时间
                                    await asyncio.sleep(2.0)

                                    # 检测刷新后的缓存效果
                                    cache_status = await page.evaluate("""
                                        () => {
                                            const externalResources = document.querySelectorAll('link[href^="http"], script[src^="http"]');
                                            let cached = 0, total = 0;

                                            externalResources.forEach(element => {
                                                total++;
                                                // CSS链接检查
                                                if (element.tagName === 'LINK' && element.rel === 'stylesheet') {
                                                    if (element.sheet) cached++;
                                                }
                                                // JavaScript检查
                                                else if (element.tagName === 'SCRIPT') {
                                                    const isLoaded = !element.readyState || element.readyState === 'complete' || element.readyState === 'loaded';
                                                    if (isLoaded) cached++;
                                                }
                                            });

                                            return { cached, total, cacheRate: total > 0 ? (cached / total * 100) : 100 };
                                        }
                                    """)

                                    logger.info(
                                        f"{debug_info}: 页面刷新后缓存效果 - "
                                        f"已缓存: {cache_status['cached']}/{cache_status['total']} "
                                        f"({cache_status['cacheRate']:.1f}%)"
                                    )

                                    # 跳过普通的重试延迟，直接进入下一次检测
                                    continue

                                except Exception as refresh_error:
                                    logger.warning(f"{debug_info}: 页面刷新失败，使用常规重试: {refresh_error}")
                                    # 刷新失败，回退到常规重试策略

                            logger.info(f"{debug_info}: {retry_delay}秒后进行第 {attempt + 2} 次尝试...")
                            await asyncio.sleep(retry_delay)
                            continue

            except Exception as attempt_error:
                logger.error(f"{debug_info}: 第 {attempt + 1} 次资源加载尝试发生异常: {attempt_error}")

                if attempt < max_retries - 1:
                    await asyncio.sleep((attempt + 1) * 2)
                    continue

        # 所有重试都失败后的降级处理
        logger.warning(f"{debug_info}: 外部资源加载经过 {max_retries} 次尝试后仍有失败，启用降级模式")

        # 统计最终的资源状态
        try:
            final_status = await page.evaluate("""
                () => {
                    const external = document.querySelectorAll('link[href^="http"], script[src^="http"]').length;
                    const loaded = document.querySelectorAll('link[href^="http"][rel="stylesheet"]').length +
                                  document.querySelectorAll('script[src^="http"]').length;
                    return { external, loaded };
                }
            """)

            success_rate = (
                (final_status["loaded"] / final_status["external"] * 100) if final_status["external"] > 0 else 100
            )
            logger.info(
                f"{debug_info}: 最终资源加载成功率: {success_rate:.1f}% ({final_status['loaded']}/{final_status['external']})"
            )

            # 如果成功率超过70%，认为可以接受
            if success_rate >= 70:
                logger.info(f"{debug_info}: 资源加载成功率可接受，继续处理")
                return True
            else:
                logger.warning(f"{debug_info}: 资源加载成功率偏低，但仍继续处理")
                return True  # 即使资源加载不完整，也继续处理，避免完全失败

        except Exception as status_error:
            logger.error(f"{debug_info}: 无法获取最终资源状态: {status_error}")
            return True  # 降级到继续处理

    @staticmethod
    def _find_closest_version(base_dir: Path, requested_version: str) -> Optional[Path]:
        """
        查找最接近的版本目录（用于 CDN 资源版本回退）

        匹配策略（按优先级）:
        1. 精确匹配（例如 5.6.0 -> 5.6.0）
        2. 主+次版本匹配，选最新修订号（例如 5.6.0 -> 5.6.2）
        3. 仅主版本匹配，选最新版本（例如 5.6.0 -> 5.8.1）
        4. 完全不匹配，返回所有版本中的最新版

        Args:
            base_dir: 版本目录（如 static/js/echarts/）
            requested_version: 请求的版本号（如 "5.6.0"）

        Returns:
            最匹配的版本目录路径，未找到返回 None
        """
        if not base_dir.exists():
            return None

        try:
            # 解析请求版本号为元组（性能优化：使用元组比列表更快）
            req_parts = tuple(int(x) for x in requested_version.split("."))
            req_major = req_parts[0]
            req_minor = req_parts[1] if len(req_parts) > 1 else 0

            # 一次遍历收集所有候选版本（避免多次遍历）
            versions = []
            for item in base_dir.iterdir():
                if not item.is_dir():
                    continue
                try:
                    ver_parts = tuple(int(x) for x in item.name.split("."))
                    versions.append((ver_parts, item))
                except (ValueError, AttributeError):
                    continue

            if not versions:
                return None

            # 单次遍历完成所有优先级匹配
            major_minor_matches = []  # 主+次版本匹配
            major_matches = []  # 仅主版本匹配

            for ver_parts, ver_path in versions:
                # 1. 精确匹配（立即返回）
                if ver_parts == req_parts:
                    return ver_path

                ver_major = ver_parts[0]
                ver_minor = ver_parts[1] if len(ver_parts) > 1 else 0

                # 2-3. 收集候选版本
                if ver_major == req_major:
                    if ver_minor == req_minor:
                        major_minor_matches.append((ver_parts, ver_path))
                    else:
                        major_matches.append((ver_parts, ver_path))

            # 按优先级返回
            if major_minor_matches:
                # 主+次版本匹配，返回最新修订号
                return max(major_minor_matches, key=lambda x: x[0])[1]

            if major_matches:
                # 仅主版本匹配，返回最新版本
                return max(major_matches, key=lambda x: x[0])[1]

            # 都不匹配，返回全局最新版本
            return max(versions, key=lambda x: x[0])[1]

        except Exception as e:
            logger.debug(f"版本查找失败 {base_dir}/{requested_version}: {e}")
            return None

    @staticmethod
    def _get_mime_type(file_path: Path) -> str:
        """
        根据文件扩展名获取 MIME 类型

        Args:
            file_path: 文件路径

        Returns:
            MIME 类型字符串
        """
        suffix = file_path.suffix.lower()
        mime_types = {
            ".js": "application/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".woff2": "font/woff2",
            ".woff": "font/woff",
            ".ttf": "font/ttf",
            ".otf": "font/otf",
            ".eot": "application/vnd.ms-fontobject",
        }
        return mime_types.get(suffix, "application/octet-stream")

    @staticmethod
    def _resolve_cdnjs_path(lib_name: str, version: str, filename: str, static_dir: Path) -> Path:
        """
        解析 CDNJS 资源到本地路径（支持版本回退）

        Args:
            lib_name: 库名称
            version: 版本号
            filename: 文件名
            static_dir: static 根目录

        Returns:
            本地文件路径
        """
        # 特殊处理：Font Awesome webfonts
        if lib_name == "font-awesome" and filename.startswith("webfonts/"):
            base_path = static_dir / lib_name / version / filename
            if not base_path.exists():
                version_dir = BaseConvertService._find_closest_version(static_dir / lib_name, version)
                if version_dir:
                    base_path = version_dir / filename
            return base_path

        # 根据文件类型确定路径
        if filename.endswith(".css"):
            base_dir = static_dir / "css" / lib_name
        elif filename.endswith(".js"):
            base_dir = static_dir / "js" / lib_name
        else:
            base_dir = static_dir / lib_name

        base_path = base_dir / version / filename

        # 版本回退
        if not base_path.exists():
            version_dir = BaseConvertService._find_closest_version(base_dir, version)
            if version_dir:
                base_path = version_dir / filename

        return base_path

    @staticmethod
    def _resolve_google_fonts_css_path(url: str, static_dir: Path) -> Optional[Path]:
        """
        解析 Google Fonts CSS 到本地路径

        Args:
            url: Google Fonts CSS URL
            static_dir: static 根目录

        Returns:
            本地文件路径（如果找到）
        """
        # URL 规范化（.cn -> .com）
        normalized_url = url.replace("fonts.googlefonts.cn", "fonts.googleapis.com")
        url_hash = hashlib.md5(normalized_url.encode()).hexdigest()[:16]
        hash_path = static_dir / "fonts" / "googleapis" / f"{url_hash}.css"

        if hash_path.exists():
            return hash_path

        # 回退：尝试 family 名称映射
        try:
            query_string = urllib.parse.urlparse(url).query
            params = urllib.parse.parse_qs(query_string)
            family_param = params.get("family", [None])[0]

            if family_param:
                # 提取并规范化 family 名称
                family_name = family_param.split(":", 1)[0].replace("+", "-").lower()
                family_path = static_dir / "fonts" / "googleapis" / f"{family_name}.css"
                if family_path.exists():
                    return family_path
        except Exception:
            pass

        return hash_path  # 返回哈希路径（即使不存在，也让调用者决定）

    @staticmethod
    def _resolve_jsdelivr_npm_path(url: str, static_dir: Path) -> Optional[Path]:
        """
        解析 jsDelivr npm 资源到本地路径（支持 scoped package）

        典型 URL:
        - https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js
        - https://cdn.jsdelivr.net/npm/@tabler/icons-react@3.35.0/tabler-icons-react.min.js

        本地映射（按文件类型分流）:
        - JS  -> static/js/<pkg>/<version>/<path>
        - CSS -> static/css/<pkg>/<version>/<path>
        - 其他 -> static/<pkg>/<version>/<path>

        Args:
            url: jsDelivr npm URL
            static_dir: static 根目录

        Returns:
            本地文件路径（若无法解析则返回 None）
        """
        try:
            parsed = urllib.parse.urlparse(url)
            path = parsed.path or ""
            npm_idx = path.find("/npm/")
            if npm_idx < 0:
                return None

            npm_path = path[npm_idx + len("/npm/") :]
            segments = [s for s in npm_path.split("/") if s]
            if not segments:
                return None

            package_parts: list[str]
            version: str
            rest_segments: list[str]

            # scoped: /npm/@scope/name@version/...
            if segments[0].startswith("@"):
                if len(segments) < 3:
                    return None
                scope = segments[0]
                name_ver = segments[1]
                if "@" not in name_ver:
                    return None
                name, version = name_ver.rsplit("@", 1)
                package_parts = [scope, name]
                rest_segments = segments[2:]
            else:
                # non-scoped: /npm/name@version/...
                name_ver = segments[0]
                if "@" not in name_ver:
                    return None
                name, version = name_ver.rsplit("@", 1)
                package_parts = [name]
                rest_segments = segments[1:]

            if not rest_segments:
                return None

            rel_path = Path(*rest_segments)
            rel_str = rel_path.as_posix().lower()

            if rel_str.endswith(".css"):
                base_dir = static_dir / "css" / Path(*package_parts)
            elif rel_str.endswith(".js"):
                base_dir = static_dir / "js" / Path(*package_parts)
            else:
                base_dir = static_dir / Path(*package_parts)

            local_path = base_dir / version / rel_path

            # 版本回退（尽力而为）
            if not local_path.exists():
                version_dir = BaseConvertService._find_closest_version(base_dir, version)
                if version_dir:
                    local_path = version_dir / rel_path

            return local_path
        except Exception:
            return None

    @staticmethod
    def _resolve_unpkg_path(url: str, static_dir: Path) -> Optional[Path]:
        """
        解析 unpkg 资源到本地路径（支持 scoped package）

        典型 URL:
        - https://unpkg.com/simple-mind-map@0.10.2/dist/simpleMindMap.esm.css
        - https://unpkg.com/simple-mind-map@0.10.2/dist/simpleMindMap.umd.min.js

        本地映射（按文件类型分流）:
        - JS  -> static/js/<pkg>/<version>/<path>
        - CSS -> static/css/<pkg>/<version>/<path>
        - 其他 -> static/<pkg>/<version>/<path>

        Args:
            url: unpkg URL
            static_dir: static 根目录

        Returns:
            本地文件路径（若无法解析则返回 None）
        """
        try:
            parsed = urllib.parse.urlparse(url)
            host = (parsed.netloc or "").lower()
            if "unpkg.com" not in host:
                return None

            path = parsed.path or ""
            segments = [s for s in path.split("/") if s]
            if not segments:
                return None

            package_parts: list[str]
            version: str
            rest_segments: list[str]

            # scoped: /@scope/name@version/...
            if segments[0].startswith("@"):
                if len(segments) < 3:
                    return None
                scope = segments[0]
                name_ver = segments[1]
                if "@" not in name_ver:
                    return None
                name, version = name_ver.rsplit("@", 1)
                package_parts = [scope, name]
                rest_segments = segments[2:]
            else:
                # non-scoped: /name@version/...
                name_ver = segments[0]
                if "@" not in name_ver:
                    return None
                name, version = name_ver.rsplit("@", 1)
                package_parts = [name]
                rest_segments = segments[1:]

            if not rest_segments:
                return None

            rel_path = Path(*rest_segments)
            rel_str = rel_path.as_posix().lower()

            if rel_str.endswith(".css"):
                base_dir = static_dir / "css" / Path(*package_parts)
            elif rel_str.endswith(".js"):
                base_dir = static_dir / "js" / Path(*package_parts)
            else:
                base_dir = static_dir / Path(*package_parts)

            local_path = base_dir / version / rel_path

            # 版本回退（尽力而为）
            if not local_path.exists():
                version_dir = BaseConvertService._find_closest_version(base_dir, version)
                if version_dir:
                    local_path = version_dir / rel_path

            return local_path
        except Exception:
            return None

    @staticmethod
    def _resolve_font_awesome_webfonts_path(url_path: str, static_dir: Path) -> Optional[Path]:
        """
        解析 Font Awesome webfonts 到本地路径。

        本项目存放规则：
        - static/font-awesome/<ver>/webfonts/<file>
        兼容 URL：
        - .../packages/font-awesome/<ver>/webfonts/<file>
        """
        try:
            match = re.search(r"font-awesome/([^/]+)/webfonts/(.+)$", url_path, re.IGNORECASE)
        except Exception:
            return None

        if not match:
            return None

        ver = match.group(1)
        rel = match.group(2)

        candidate = static_dir / "font-awesome" / ver / "webfonts" / rel
        if candidate.exists():
            return candidate

        # 兼容：部分字体被平铺在 static/css/webfonts/ 下（不带版本目录）
        fallback_name = Path(rel).name
        fallback = static_dir / "css" / "webfonts" / fallback_name
        if fallback.exists():
            return fallback

        return None

    @staticmethod
    def _resolve_keyword_local_path(url: str, static_dir: Path) -> Optional[Path]:
        """
        基于关键词的本地路径解析（不限制域名），支持本地/外部 URL。
        只要 URL 包含关键词即尝试本地映射，若本地不存在则后续继续走原网络流程。
        关键词覆盖：
        - tailwindcss / tailwind.min.js
        - font-awesome
        - googleapis
        - tabler-icons
        - countup.js
        - marked
        - papaparse
        - react / react-dom
        - react-grid-layout
        - echarts
        """
        lower_url = url.lower()
        parsed = urllib.parse.urlparse(url)
        path = parsed.path or ""

        # tailwindcss / tailwind.min.js
        if ("tailwindcss" in lower_url) or ("tailwind.min.js" in lower_url):
            fixed_tailwind = static_dir / "js" / "tailwindcss" / "3.4.17" / "tailwind.min.js"
            if fixed_tailwind.exists():
                return fixed_tailwind
            tail_sub = path.split("tailwindcss", 1)[-1].lstrip("/") if "tailwindcss" in lower_url else path.lstrip("/")
            if tail_sub:
                return static_dir / "js" / "tailwindcss" / tail_sub
            fallback_root = static_dir / "js" / "tailwind.min.js"
            if fallback_root.exists():
                return fallback_root

        # font-awesome -> 保持版本和子路径
        if "font-awesome" in lower_url:
            # 1) 优先处理 webfonts：本项目实际存放在 static/font-awesome/<ver>/webfonts/
            #    兼容 URL: .../packages/font-awesome/<ver>/webfonts/<file>
            fa_webfont = BaseConvertService._resolve_font_awesome_webfonts_path(path, static_dir)
            if fa_webfont:
                return fa_webfont

            # 2) 处理 CSS：static/css/font-awesome/<ver>/css/<file> 或 static/css/font-awesome/<ver>/<file>
            fa_sub = path.split("font-awesome", 1)[-1].lstrip("/")
            if fa_sub:
                return static_dir / "css" / "font-awesome" / fa_sub

        # googleapis -> 映射到 static/fonts/googleapis
        if "googleapis" in lower_url:
            ga_sub = path.split("googleapis", 1)[-1].lstrip("/")
            # 兼容 Magic CDN 的目录结构：.../packages/googleapis/fonts/<file>.css
            if ga_sub.startswith("fonts/"):
                ga_sub = ga_sub[len("fonts/") :]
            if ga_sub:
                candidate = static_dir / "fonts" / "googleapis" / ga_sub
                if candidate.exists():
                    return candidate
            index_css = static_dir / "fonts" / "googleapis" / "index.css"
            if index_css.exists():
                return index_css

        # tabler-icons
        if "tabler-icons" in lower_url:
            ti_sub = path.split("tabler-icons", 1)[-1].lstrip("/")
            if ti_sub:
                return static_dir / "css" / "tabler-icons" / ti_sub
            default_ti = static_dir / "css" / "tabler-icons" / "3.34.1" / "tabler-icons.min.css"
            return default_ti

        # countup.js
        if "countup.js" in lower_url:
            cu_sub = path.split("countup.js", 1)[-1].lstrip("/")
            if cu_sub:
                return static_dir / "js" / "countup.js" / cu_sub
            return static_dir / "js" / "countup.js" / "2.8.0" / "countUp.min.js"

        # marked
        if "marked" in lower_url:
            mk_sub = path.split("marked", 1)[-1].lstrip("/")
            if mk_sub:
                return static_dir / "js" / "marked" / mk_sub
            # 选用较新的版本
            return static_dir / "js" / "marked" / "16.1.1" / "marked.umd.min.js"

        # papaparse
        if "papaparse" in lower_url:
            pp_sub = path.split("papaparse", 1)[-1].lstrip("/")
            if pp_sub:
                return static_dir / "js" / "papaparse" / pp_sub
            return static_dir / "js" / "papaparse" / "5.4.1" / "papaparse.min.js"

        # react / react-dom
        if "react-dom" in lower_url:
            rd_sub = path.split("react-dom", 1)[-1].lstrip("/")
            if rd_sub:
                return static_dir / "js" / "react-dom" / rd_sub
            return static_dir / "js" / "react-dom" / "18.3.1" / "umd" / "react-dom.production.min.js"
        if "react" in lower_url:
            r_sub = path.split("react", 1)[-1].lstrip("/")
            if r_sub:
                return static_dir / "js" / "react" / r_sub
            return static_dir / "js" / "react" / "18.3.1" / "umd" / "react.production.min.js"

        # react-grid-layout
        if "react-grid-layout" in lower_url:
            rgl_sub = path.split("react-grid-layout", 1)[-1].lstrip("/")
            if rgl_sub:
                return static_dir / "js" / "react-grid-layout" / rgl_sub
            return static_dir / "js" / "react-grid-layout" / "1.5.2" / "react-grid-layout.min.js"

        # echarts
        if "echarts" in lower_url:
            ec_sub = path.split("echarts", 1)[-1].lstrip("/")
            if ec_sub:
                return static_dir / "js" / "echarts" / ec_sub
            return static_dir / "js" / "echarts" / "6.0.0" / "echarts.min.js"

        return None

    @staticmethod
    def _resolve_cdn_local_path(url: str, static_dir: Path) -> Optional[Path]:
        """
        将 CDN URL 解析为本地文件路径

        Args:
            url: CDN 资源 URL
            static_dir: static 目录路径

        Returns:
            本地文件路径，如果无法解析则返回 None
        """
        # 优先：关键词拦截（即使是本地或其他域名）
        keyword_path = BaseConvertService._resolve_keyword_local_path(url, static_dir)
        if keyword_path:
            return keyword_path

        # 1. cdn.letsmagic.cn/__assets__ -> static/
        if "cdn.letsmagic.cn/__assets__" in url or "cdn.letsmagic.cn:8080/__assets__" in url:
            match = re.search(r"/__assets__/(.*?)(\?|$)", url)
            if match:
                return static_dir / match.group(1)

        # 2. cdnjs.cloudflare.com / cdn.bootcdn.net -> static/css/, static/js/
        elif "cdnjs.cloudflare.com" in url or "cdn.bootcdn.net" in url:
            match = re.search(
                r"(?:cdnjs\.cloudflare\.com|cdn\.bootcdn\.net)/ajax/libs/([^/]+)/([^/]+)/(.*?)(\?|$)", url
            )
            if match:
                lib_name, version, filename = match.groups()[:3]
                return BaseConvertService._resolve_cdnjs_path(lib_name, version, filename, static_dir)

        # 3. cdn.tailwindcss.com -> 固定版本 3.4.17
        elif "cdn.tailwindcss.com" in url:
            return static_dir / "js" / "tailwindcss" / "3.4.17" / "tailwind.min.js"

        # 4. cdn.jsdelivr.net
        elif "cdn.jsdelivr.net" in url:
            # 4.1 ECharts（历史兼容：固定指向本地 6.0.0）
            if "echarts" in url and "echarts.min.js" in url:
                return static_dir / "js" / "echarts" / "6.0.0" / "echarts.min.js"

            # 4.2 jsDelivr npm 资源（/npm/<pkg>@<version>/<path>）
            npm_path = BaseConvertService._resolve_jsdelivr_npm_path(url, static_dir)
            if npm_path:
                return npm_path

        # 5. unpkg.com（npm 包分发）
        elif "unpkg.com" in url:
            unpkg_path = BaseConvertService._resolve_unpkg_path(url, static_dir)
            if unpkg_path:
                return unpkg_path

        # 6. Google Fonts CSS
        elif "fonts.googleapis.com" in url or "fonts.googlefonts.cn" in url:
            return BaseConvertService._resolve_google_fonts_css_path(url, static_dir)

        # 7. Google Fonts 字体文件
        elif "fonts.gstatic.com" in url or "fonts.gstatic.cn" in url:
            match = re.search(r"fonts\.gstatic\.(?:com|cn)/(.*)", url)
            if match:
                return static_dir / "fonts" / "gstatic" / match.group(1)

        return None

    def _log_local_cdn_hit_once(self, url: str, message: str) -> None:
        """
        仅首次记录 localCdn 命中日志，避免重复刷屏
        """
        if url in self._local_cdn_logged_hits:
            return
        self._local_cdn_logged_hits.add(url)
        logger.info(message)

    def _log_local_cdn_miss_once(self, url: str, message: str) -> None:
        """
        仅首次记录 localCdn miss 日志，避免重复刷屏
        """
        if url in self._local_cdn_logged_misses:
            return
        self._local_cdn_logged_misses.add(url)
        logger.warning(message)

    @staticmethod
    def _bind_page_console_logger(page, debug_info: str = "") -> None:
        """
        监听浏览器控制台，仅打印 error 级别日志。
        可以用 browserConsole 搜索到日志。
        """
        try:
            if page is None:
                return

            context_label = f"[{debug_info}]" if debug_info else ""

            def _handle_console(msg):
                try:
                    if msg.type != "error":
                        return
                    location = msg.location or {}
                    location_url = location.get("url") or ""
                    line_no = location.get("lineNumber")
                    col_no = location.get("columnNumber")

                    location_suffix = ""
                    if line_no is not None:
                        location_suffix = f":{line_no}"
                        if col_no is not None:
                            location_suffix = f"{location_suffix}:{col_no}"

                    try:
                        page_url = page.url
                    except Exception:
                        page_url = ""

                    logger.error(
                        f"browserConsole(error){context_label}: {msg.text} @ {location_url}{location_suffix} page={page_url}"
                    )
                except Exception as inner:
                    logger.debug(f"处理浏览器控制台消息失败: {inner}")

            page.on("console", _handle_console)
        except Exception as e:
            logger.debug(f"绑定浏览器控制台日志失败: {e}")

    async def _serve_local_file(
        self, route, local_file: Path, hit_count: dict, debug_info: str, static_dir: Path
    ) -> bool:
        """
        从本地文件系统提供文件服务

        Args:
            route: Playwright 路由对象
            local_file: 本地文件路径
            hit_count: 命中计数器（字典引用）
            debug_info: 调试信息前缀
            static_dir: static 目录路径

        Returns:
            是否成功提供文件服务
        """
        try:
            url = route.request.url
            with open(local_file, "rb") as f:
                content = f.read()

            await route.fulfill(
                status=200,
                body=content,
                headers={
                    "Content-Type": self._get_mime_type(local_file),
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=31536000",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "*",
                },
            )

            hit_count["count"] += 1
            relative_path = local_file.relative_to(static_dir) if local_file.is_relative_to(static_dir) else local_file
            self._log_local_cdn_hit_once(
                url, f"localCdn: hit {debug_info} count={hit_count['count']} url={url} path={relative_path}"
            )
            return True

        except Exception as e:
            logger.warning(
                f"localCdn: error {debug_info} url={getattr(route.request, 'url', '')} path={local_file} error={e}"
            )
            return False

    async def _handle_google_fonts_dynamic(self, route, url: str, hit_count: dict, debug_info: str) -> bool:
        """
        处理 Google Fonts CSS 的动态生成

        Args:
            route: Playwright 路由对象
            url: Google Fonts CSS URL
            hit_count: 命中计数器
            debug_info: 调试信息前缀

        Returns:
            是否成功处理（返回 True 表示已处理，False 表示需要继续网络请求）
        """
        project_root = PathManager.get_project_root()
        static_dir = project_root / "static"

        generated_css = self._generate_google_fonts_css(url, static_dir)

        if generated_css:
            await route.fulfill(
                status=200,
                body=generated_css,
                headers={
                    "Content-Type": "text/css; charset=utf-8",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=31536000",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "*",
                },
            )
            hit_count["count"] += 1
            self._log_local_cdn_hit_once(
                url,
                f"localCdn: hit {debug_info} count={hit_count['count']} url={url} path=fonts/googleapis (generated)",
            )
            return True
        else:
            # 提供空 CSS 避免阻塞
            await route.fulfill(
                status=200,
                body=b"/* google fonts local fallback: empty css to mark loaded */\n",
                headers={
                    "Content-Type": "text/css; charset=utf-8",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=300",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "*",
                },
            )
            hit_count["count"] += 1
            self._log_local_cdn_hit_once(
                url,
                f"localCdn: hit {debug_info} count={hit_count['count']} url={url} path=fonts/googleapis (fallbackEmpty)",
            )
            return True

    @staticmethod
    def _generate_google_fonts_css(url: str, static_dir: Path) -> Optional[bytes]:
        """
        基于请求的 Google Fonts css2 URL 动态生成本地 CSS 内容

        逻辑：
        - 解析 family 参数（可能有多个 family）
        - 尝试从 static/fonts/googleapis/{family}.css 读取已下载的单字体 CSS
        - 合并为一个 CSS，并将其中的字体 URL 重写为相对本地路径 ../gstatic/...

        Args:
            url: 原始 Google Fonts css2 请求 URL
            static_dir: static 根目录

        Returns:
            合成后的 CSS 字节内容，若无法生成返回 None
        """
        try:
            parsed = urllib.parse.urlparse(url)
            query = urllib.parse.parse_qs(parsed.query)
            families: list[str] = query.get("family", [])

            if not families:
                return None

            merged_css_parts: list[str] = []
            for family_entry in families:
                # 提取 family 名称（去掉权重部分），与本地命名规则对齐
                base_name = family_entry.split(":", 1)[0].replace("+", "-").lower()
                family_css_path = static_dir / "fonts" / "googleapis" / f"{base_name}.css"
                if not family_css_path.exists():
                    # 若缺失，跳过该 family（尽力而为）
                    continue
                try:
                    css_text = family_css_path.read_text(encoding="utf-8")
                except Exception:
                    continue

                # 保持 gstatic 绝对 URL，交由路由拦截映射至本地 static/fonts/gstatic/
                # 如需规范化，可统一为 .com 域名
                css_text = css_text.replace("https://fonts.gstatic.cn/", "https://fonts.gstatic.com/")

                merged_css_parts.append(css_text)

            if not merged_css_parts:
                return None

            merged_css = "\n".join(merged_css_parts)
            return merged_css.encode("utf-8")

        except Exception:
            return None

    async def _setup_local_cdn_route(self, page, debug_info: str = "") -> bool:
        """
        设置统一的 CDN 路由拦截
        拦截所有常用 CDN 域名的请求并映射到本地 static/ 目录

        支持的 CDN:
        - cdn.letsmagic.cn/__assets__
        - cdnjs.cloudflare.com / cdn.bootcdn.net（官方 + 国内镜像）
        - cdn.tailwindcss.com
        - cdn.jsdelivr.net（支持 echarts 固定映射 + /npm/ 资源）
        - unpkg.com（npm 包分发）
        - fonts.googleapis.com / fonts.googlefonts.cn（官方 + 国内镜像）
        - fonts.gstatic.com / fonts.gstatic.cn（官方 + 国内镜像）

        Args:
            page: Playwright页面对象
            debug_info: 调试信息前缀

        Returns:
            是否成功设置路由
        """
        try:
            # 获取 static 目录路径
            project_root = PathManager.get_project_root()
            static_dir = project_root / "static"
            if not static_dir.exists():
                logger.warning(f"{debug_info}: static目录不存在: {static_dir}")
                return False

            logger.info(f"{debug_info}: 设置统一CDN路由拦截 -> {static_dir}")

            # 统计命中次数
            hit_count = {"count": 0}

            async def route_handler(route):
                """统一的路由处理器"""
                url = route.request.url
                is_keyword_supported = (
                    ("googleapis" in url)
                    or ("font-awesome" in url)
                    or ("tailwindcss" in url)
                    or ("tailwind.min.js" in url)
                    or ("tabler-icons" in url)
                    or ("countup.js" in url)
                    or ("marked" in url)
                    or ("papaparse" in url)
                    or ("react-grid-layout" in url)
                    or ("react-dom" in url)
                    or ("react" in url)
                    or ("echarts" in url)
                )
                is_supported_cdn = (
                    ("cdn.letsmagic.cn" in url)
                    or ("cdnjs.cloudflare.com" in url)
                    or ("cdn.bootcdn.net" in url)
                    or ("cdn.tailwindcss.com" in url)
                    or ("cdn.jsdelivr.net" in url)
                    or ("unpkg.com" in url)
                    or ("fonts.googleapis.com" in url)
                    or ("fonts.googlefonts.cn" in url)
                    or ("fonts.gstatic.com" in url)
                    or ("fonts.gstatic.cn" in url)
                    or is_keyword_supported
                )

                # 1. 解析 CDN URL 到本地路径
                local_file = self._resolve_cdn_local_path(url, static_dir)

                # 2. 如果是 Google Fonts CSS 且本地无文件，尝试动态生成
                is_google_fonts_css = "fonts.googleapis.com" in url or "fonts.googlefonts.cn" in url
                if is_google_fonts_css and (not local_file or not local_file.exists()):
                    handled = await self._handle_google_fonts_dynamic(route, url, hit_count, debug_info)
                    if handled:
                        return

                # 3. 如果本地文件存在，提供文件服务
                if local_file and local_file.exists():
                    served = await self._serve_local_file(route, local_file, hit_count, debug_info, static_dir)
                    if served:
                        return

                # 4. 应该命中但未命中：对支持的 CDN 域名输出 miss 日志（对同一 URL 去重，避免刷屏）
                if is_supported_cdn:
                    miss_reason: Optional[str] = None
                    miss_path: Optional[Path] = None

                    if local_file is None:
                        miss_reason = "resolveLocalPathFailed"
                    elif not local_file.exists():
                        miss_reason = "localFileNotFound"
                        miss_path = (
                            local_file.relative_to(static_dir) if local_file.is_relative_to(static_dir) else local_file
                        )

                    if miss_reason:
                        if miss_path:
                            self._log_local_cdn_miss_once(
                                url, f"localCdn: miss {debug_info} url={url} path={miss_path} reason={miss_reason}"
                            )
                        else:
                            self._log_local_cdn_miss_once(
                                url, f"localCdn: miss {debug_info} url={url} reason={miss_reason}"
                            )

                # 5. 继续正常网络请求
                await route.continue_()

            # 设置路由拦截（拦截所有请求）
            await page.route("**/*", route_handler)

            logger.info(
                f"{debug_info}: 统一CDN路由已设置，拦截: cdnjs.cloudflare.com, cdn.bootcdn.net, cdn.tailwindcss.com, cdn.jsdelivr.net(/npm), unpkg.com, cdn.letsmagic.cn, fonts.googleapis.com/fonts.googlefonts.cn, fonts.gstatic.com/fonts.gstatic.cn"
            )
            return True

        except Exception as e:
            logger.warning(f"{debug_info}: 设置CDN路由失败: {e}")
            return False

    async def _load_html_page_standard(self, page, file_path: Path, debug_info: str = "") -> bool:
        """
        标准HTML页面加载流程 - 增强版，智能等待外部资源，优先使用HTTP协议

        Args:
            page: Playwright页面对象
            file_path: HTML文件路径
            debug_info: 调试信息前缀

        Returns:
            bool: 是否加载成功
        """
        try:
            logger.debug(f"{debug_info}: 开始加载HTML文件: {file_path}")

            # 🎯 设置本地 CDN 路由（在页面加载前）
            await self._setup_local_cdn_route(page, debug_info)

            # 🎯 新增：智能选择文件协议（HTTP优先，降级到file://）
            protocol, file_url = await self._choose_file_protocol(file_path, debug_info)

            # 1. 等待DOM加载完成（若超时则降级为commit，避免阻塞）
            try:
                await page.goto(file_url, wait_until="domcontentloaded", timeout=self.PAGE_LOAD_TIMEOUT)
                logger.debug(f"{debug_info}: DOM加载完成 ({protocol}): {file_path}")
            except Exception as goto_error:
                logger.warning(f"{debug_info}: DOM加载等待超时/失败，降级为commit继续: {goto_error}")
                try:
                    await page.goto(file_url, wait_until="commit", timeout=10000)
                    logger.debug(f"{debug_info}: commit 阶段已完成，继续后续资源优化: {file_path}")
                except Exception as commit_error:
                    logger.error(f"{debug_info}: commit 阶段仍失败: {commit_error}")
                    return False

            # 2. 等待网络空闲 - 基础网络资源加载（失败不中断）
            try:
                await page.wait_for_load_state("networkidle", timeout=30000)
                logger.debug(f"{debug_info}: 网络空闲状态达成 ({protocol}): {file_path}")
            except Exception as e:
                logger.warning(f"{debug_info}: 网络空闲等待超时，但继续处理（可能有外部资源加载缓慢）: {e}")

            # 3. 🎯 带重试机制的外部资源加载优化
            # 外部资源加载失败不中断流程，采用降级策略继续
            try:
                await self._load_external_resources_with_retry(
                    page, max_retries=3, timeout_per_attempt=15000, debug_info=debug_info
                )
            except Exception as e:
                logger.warning(f"{debug_info}: 外部资源加载失败，但继续转换（降级处理）: {e}")

            # 4. 🎯 专门的字体加载优化 - 确保Google Fonts等完全加载
            # 字体加载失败也不中断流程
            try:
                await self._wait_for_fonts_optimized(page, timeout=20000, debug_info=debug_info)
            except Exception as e:
                logger.warning(f"{debug_info}: 字体加载优化失败，但继续转换（降级处理）: {e}")

            # 5. 最终确认渲染完成 - 给复杂页面额外的渲染时间
            await asyncio.sleep(1.0)
            logger.debug(f"{debug_info}: HTML页面渲染完全完成: {file_path}")

            return True

        except Exception as e:
            logger.error(f"{debug_info}: 页面加载失败 {file_path}: {str(e)}")
            return False

    @abstractmethod
    async def _convert_projects(
        self,
        projects: Dict[str, Dict[str, Any]],
        output_dir: Path,
        options: Optional[Dict[str, Any]] = None,
        task_mgr=None,
        task_key: Optional[str] = None,
        valid_files_count: int = 0,
        optimal_concurrency: int = 1,
        aigc_params: Optional[AigcMetadataParams] = None,
    ) -> tuple[List[Path], List[str]]:
        """
        抽象方法：执行项目转换

        子类需要实现此方法来执行具体的转换逻辑

        Args:
            projects: 项目字典
            output_dir: 输出目录
            options: 转换选项
            task_mgr: 任务管理器
            task_key: 任务键
            valid_files_count: 有效文件数量
            optimal_concurrency: 最优并发数
            aigc_params: AIGC元数据参数对象

        Returns:
            (转换后的文件列表, 错误信息列表)
        """
        pass

    @abstractmethod
    async def _get_service_specific_result_data(
        self, file_keys: List[Dict[str, str]], projects: Dict[str, Dict[str, Any]], converted_files: List[Path]
    ) -> Dict[str, Any]:
        """
        抽象方法：获取服务特定的结果数据

        子类需要实现此方法来提供服务特定的结果字段

        Args:
            file_keys: 原始文件键列表
            projects: 项目字典
            converted_files: 转换后的文件列表

        Returns:
            服务特定的结果数据字典
        """
        pass

    def update_agent_activity(self, operation: str = "转换操作"):
        """
        更新agent活动时间并检查超时状态

        Args:
            operation: 操作描述
        """
        if self.agent_context:
            self.agent_context.update_activity_time()
            is_idle = self.agent_context.is_idle_timeout()
            # 获取超时时间配置
            idle_timeout_seconds = self.agent_context.shared_context.idle_timeout.total_seconds()
            logger.info(
                f"已重置 agent idle 时间 - {self.service_name} {operation}，当前是否超时: {is_idle}，超时时间设置: {idle_timeout_seconds}秒"
            )

    def _is_http_server_running(self, host: str = "127.0.0.1", port: Optional[int] = None) -> bool:
        """
        检测HTTP服务器是否正在运行

        Args:
            host: 服务器主机地址
            port: 服务器端口（默认使用静态文件服务器端口）

        Returns:
            bool: 服务器是否正在运行
        """
        if port is None:
            port = self._static_server_port

        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(1.0)  # 1秒超时
                result = sock.connect_ex((host, port))
                return result == 0
        except Exception as e:
            logger.debug(f"检测HTTP服务器连接失败: {e}")
            return False

    @staticmethod
    async def _verify_http_server_workspace_access(base_url: str) -> bool:
        """
        验证HTTP静态文件服务器是否可以访问.workspace目录

        Args:
            base_url: HTTP静态文件服务器的基础URL

        Returns:
            bool: 是否可以访问workspace目录
        """
        try:
            # 尝试访问静态文件服务器的健康检查
            health_check_url = f"{base_url}/__health__"
            logger.debug(f"健康检查URL: {health_check_url}")
            async with aiohttp.ClientSession() as session:
                async with session.get(health_check_url, timeout=aiohttp.ClientTimeout(total=5)) as response:
                    logger.debug(f"健康检查响应状态: {response.status}")
                    if response.status == 200:
                        data = await response.json()
                        logger.debug(f"健康检查响应数据: {data}")
                        is_healthy = (
                            data.get("status") == "healthy" and data.get("service") == "workspace-static-server"
                        )
                        logger.debug(f"健康检查结果: {is_healthy}")
                        return is_healthy
            return False
        except Exception as e:
            logger.debug(f"验证HTTP静态文件服务器访问失败: {e}")
            return False

    @staticmethod
    def _get_http_url_for_workspace_file(file_path: Path, base_url: str = "http://127.0.0.1:8003") -> Optional[str]:
        """
        将.workspace目录下的文件路径转换为HTTP URL

        Args:
            file_path: .workspace目录下的文件路径
            base_url: HTTP静态文件服务器的基础URL (默认127.0.0.1:8003)

        Returns:
            HTTP URL字符串，如果文件不在.workspace目录下则返回None
        """
        try:
            # 确保文件路径是绝对路径
            abs_file_path = file_path.resolve()
            workspace_dir = Path(".workspace").resolve()

            # 检查文件是否在.workspace目录下
            try:
                relative_path = abs_file_path.relative_to(workspace_dir)
                # 构建HTTP URL，静态文件直接挂载在根路径，使用POSIX路径分隔符
                # 对中文文件名和路径进行URL编码
                encoded_path = quote(relative_path.as_posix(), safe="/")
                http_url = f"{base_url}/{encoded_path}"
                # 详细的路径转换信息降级，减少日志噪音
                return http_url
            except ValueError:
                logger.warning(f"文件不在.workspace目录下: {file_path}")
                return None

        except Exception as e:
            logger.error(f"生成HTTP URL失败: {e}")
            return None

    async def _start_static_file_server_on_demand(self) -> bool:
        """
        按需启动.workspace静态文件服务器

        Returns:
            bool: 是否启动成功
        """
        # 先检查当前实例是否已标记为运行中
        if self._static_server_running:
            # 服务器状态检查的详细信息降级为调试级别
            return True

        # 检查端口是否实际被占用（可能是其他实例启动的）
        if self._is_http_server_running(port=self._static_server_port):
            # 服务器复用信息适当简化
            logger.info(f"静态文件服务器已运行，端口{self._static_server_port}")
            # 标记当前实例也认为服务器在运行，避免后续重复检查
            self._static_server_running = True
            return True

        try:
            # 创建专用的静态文件应用
            workspace_dir = Path(".workspace")
            if not workspace_dir.exists() or not workspace_dir.is_dir():
                logger.warning(f"⚠️  .workspace目录不存在，无法启动静态文件服务器: {workspace_dir.absolute()}")
                return False

            static_app = FastAPI(
                title="On-Demand Workspace Static Server",
                description="按需启动的.workspace目录静态文件服务",
                version="1.0.0",
            )

            # 健康检查端点
            @static_app.get("/__health__")
            async def static_server_health():
                return {"status": "healthy", "service": "workspace-static-server"}

            # 在根路径挂载静态文件 - 确保健康检查端点先定义
            static_app.mount("/", StaticFiles(directory=str(workspace_dir)), name="workspace")

            # 配置服务器，只监听127.0.0.1
            config = uvicorn.Config(
                static_app,
                host="127.0.0.1",
                port=self._static_server_port,
                log_level="warning",
                access_log=False,
            )

            server = uvicorn.Server(config)

            # 启动服务器任务
            self._static_server_task = asyncio.create_task(server.serve())
            self._static_server_running = True

            logger.info(f"🔒 按需启动.workspace静态文件服务器：127.0.0.1:{self._static_server_port}")

            # 等待服务器启动 - 更长时间和重试机制
            for attempt in range(10):  # 最多尝试10次，每次500ms
                await asyncio.sleep(0.5)
                if self._is_http_server_running(port=self._static_server_port):
                    logger.info(f"✅ 静态文件服务器启动成功 (尝试 {attempt + 1} 次)")
                    # 额外等待一点时间确保服务完全就绪
                    await asyncio.sleep(0.5)
                    return True

            logger.error(f"❌ 静态文件服务器启动失败，经过5秒重试")
            self._static_server_running = False
            return False

        except Exception as e:
            logger.error(f"❌ 启动按需静态文件服务器失败: {e}")
            self._static_server_running = False
            return False

    async def _stop_static_file_server(self) -> None:
        """
        停止静态文件服务器
        """
        if not self._static_server_running or not self._static_server_task:
            return

        try:
            logger.info(f"🔄 正在停止静态文件服务器 (端口{self._static_server_port})")

            # 取消服务器任务
            self._static_server_task.cancel()

            try:
                # 等待任务完成
                await self._static_server_task
            except asyncio.CancelledError:
                pass  # 预期的取消错误
            except Exception as e:
                logger.warning(f"停止静态文件服务器时出现错误: {e}")

            self._static_server_task = None
            self._static_server_running = False

            logger.info(f"✅ 静态文件服务器已停止")

        except Exception as e:
            logger.error(f"❌ 停止静态文件服务器失败: {e}")

    async def _choose_file_protocol(self, file_path: Path, debug_info: str = "") -> tuple[str, str]:
        """
        智能选择文件加载协议（HTTP优先，降级到file://）

        Args:
            file_path: 文件路径
            debug_info: 调试信息前缀

        Returns:
            tuple: (协议类型, 文件URL)
        """
        # 🎯 按需启动静态文件服务器
        server_started = await self._start_static_file_server_on_demand()
        logger.debug(f"{debug_info}: 静态文件服务器启动结果: {server_started}")

        if server_started:
            base_url = f"http://127.0.0.1:{self._static_server_port}"
            logger.debug(f"{debug_info}: 使用静态文件服务器URL: {base_url}")

            # 验证HTTP静态文件服务器是否可访问
            server_accessible = await self._verify_http_server_workspace_access(base_url)
            logger.debug(f"{debug_info}: 静态文件服务器可访问性: {server_accessible}")

            if server_accessible:
                http_url = self._get_http_url_for_workspace_file(file_path, base_url)
                logger.debug(f"{debug_info}: 生成的HTTP URL: {http_url}")

                if http_url:
                    # 进一步验证文件是否可通过HTTP访问
                    try:
                        async with aiohttp.ClientSession() as session:
                            async with session.head(http_url, timeout=aiohttp.ClientTimeout(total=3)) as response:
                                logger.debug(f"{debug_info}: HTTP文件访问状态码: {response.status}")
                                if response.status == 200:
                                    logger.info(
                                        f"{debug_info}: 🔒 使用按需启动的HTTP静态文件服务器加载文件: {http_url}"
                                    )
                                    return "http", http_url
                                else:
                                    logger.warning(
                                        f"{debug_info}: HTTP文件不可访问 (状态码: {response.status}): {http_url}"
                                    )
                    except Exception as e:
                        logger.warning(f"{debug_info}: HTTP文件访问测试失败: {e}")
                else:
                    logger.warning(f"{debug_info}: 无法生成HTTP URL，文件可能不在.workspace目录下")
            else:
                logger.warning(f"{debug_info}: 静态文件服务器健康检查失败")
        else:
            logger.warning(f"{debug_info}: 静态文件服务器启动失败")

        # 降级到file://协议
        file_url = f"file://{file_path.resolve()}"
        logger.info(f"{debug_info}: ⬇️ 降级使用file://协议加载文件: {file_url}")
        return "file", file_url

    @staticmethod
    async def _process_markdown_content(md_file_path: Path) -> str:
        """
        处理Markdown文件，转换为HTML内容

        Args:
            md_file_path: Markdown文件路径

        Returns:
            HTML内容字符串

        Raises:
            RuntimeError: 如果Markdown处理失败
        """
        try:
            async with aiofiles.open(md_file_path, "r", encoding="utf-8") as f:
                md_text = await f.read()

            if not md_text.strip():
                raise RuntimeError(f"Markdown文件内容为空: {md_file_path}")

            html_content = markdown.markdown(md_text, extensions=["fenced_code", "tables", "toc", "nl2br"])

            # 包装为完整的HTML文档
            html_with_style = f"""
            <!DOCTYPE html><html><head><meta charset="UTF-8"><style>
            @page {{ size: A4; margin: 2cm; }}
            body {{
                font-family: sans-serif;
                font-size: 16px;
                line-height: 1.8;
                max-width: 800px;
                margin: 0 auto;
                padding: 40px 20px;
            }}
            h1, h2, h3, h4, h5, h6 {{
                margin: 1.2em 0 0.6em;
                line-height: 1.35;
                font-weight: 700;
                page-break-after: avoid;
            }}
            h1 {{ font-size: 2.0rem; border-bottom: 2px solid #e5e7eb; padding-bottom: .3em; }}
            h2 {{ font-size: 1.6rem; border-bottom: 1px solid #e5e7eb; padding-bottom: .25em; }}
            h3 {{ font-size: 1.35rem; font-weight: 600; }}
            h4 {{ font-size: 1.2rem; font-weight: 600; }}
            h5 {{ font-size: 1.05rem; font-weight: 600; }}
            h6 {{ font-size: 1.0rem; font-weight: 600; }}
            pre, code {{
                background: #f4f4f4;
                padding: 1em;
                border-radius: 6px;
            }}
            img {{
                max-width: 100%;
                height: auto;
                display: block;
                margin: 1em 0;
            }}
            </style></head><body>{html_content}</body></html>"""

            return html_with_style

        except Exception as e:
            raise RuntimeError(f"Markdown处理失败 {md_file_path}: {str(e)}")

    @staticmethod
    def _get_default_print_css() -> str:
        """
        返回一套默认打印CSS（增强打印可读性，尽量不破坏页面原样式）。
        """
        return (
            "@page { margin: 20mm; }\n"
            "@media print {\n"
            "  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n"
            "  h1,h2,h3,h4,h5,h6 { page-break-after: avoid; }\n"
            "  p, ul, ol, pre, blockquote, table, img { page-break-inside: avoid; break-inside: avoid-page; }\n"
            "  img { max-width: 100%; height: auto; }\n"
            "  pre { white-space: pre-wrap; word-break: normal; overflow-wrap: anywhere; }\n"
            "  code, pre, code * { background: #f6f8fa; }\n"
            "}\n"
        )

    @staticmethod
    async def _inject_print_css(page) -> None:
        """
        向页面注入默认打印CSS。
        """
        try:
            css = BaseConvertService._get_default_print_css()
            await page.add_style_tag(content=css)
        except Exception as e:
            logger.debug(f"注入打印CSS失败: {e}")

    @staticmethod
    def _generate_timestamp() -> str:
        """
        生成当前时间的时间戳字符串（YmdHis格式）

        Returns:
            时间戳字符串，格式为 YYYYMMDD_HHMMSS
        """
        return datetime.now().strftime("%Y%m%d_%H%M%S")

    @staticmethod
    def _generate_timestamped_filename(project_name: str, file_extension: str, timestamp: Optional[str] = None) -> str:
        """
        生成带时间戳的文件名，格式为：项目名_YmdHis.扩展名

        Args:
            project_name: 项目名称
            file_extension: 文件扩展名（不含点号）
            timestamp: 可选的时间戳，如果不提供则自动生成

        Returns:
            带时间戳的文件名
        """
        if timestamp is None:
            timestamp = BaseConvertService._generate_timestamp()

        if not file_extension.startswith("."):
            file_extension = f".{file_extension}"

        return f"{project_name}_{timestamp}{file_extension}"

    async def _handle_page_content_by_type(self, page, file_path: Path, debug_info: str = "") -> bool:
        """
        根据文件类型处理页面内容

        Args:
            page: Playwright页面对象
            file_path: 文件路径
            debug_info: 调试信息前缀

        Returns:
            是否处理成功
        """
        file_suffix = file_path.suffix.lower()

        if file_suffix in [".html", ".htm"]:
            # HTML文件：直接加载
            return await self._load_html_page_standard(page, file_path, debug_info)

        elif file_suffix == ".md":
            # Markdown文件：转换为HTML后加载
            try:
                html_content = await self._process_markdown_content(file_path)
                await page.set_content(html_content, wait_until="networkidle", timeout=self.PAGE_OPERATION_TIMEOUT)
                logger.debug(f"{debug_info}: Markdown内容设置完成: {file_path}")
                return True
            except Exception as e:
                logger.error(f"{debug_info}: Markdown页面内容设置失败 {file_path}: {str(e)}")
                return False
        else:
            logger.error(f"{debug_info}: 不支持的文件类型: {file_path}")
            return False
