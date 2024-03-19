"""
TOS上传工具命令模块 - 监控目录文件变化并自动上传到火山引擎TOS
"""
import asyncio
import hashlib
import json
import os
import time
from pathlib import Path
from typing import Optional

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent

from app.infrastructure.storage.factory import StorageFactory
from app.infrastructure.storage.types import VolcEngineCredentials, PlatformType
from app.infrastructure.storage.exceptions import InitException, UploadException
from app.utils.credential_utils import sanitize_headers
from agentlang.logger import get_logger

# 获取日志记录器
logger = get_logger(__name__)


class TOSUploader:
    """TOS上传工具"""

    def __init__(self, sandbox_id: str, workspace_dir: str, credentials_file: str = None,
                task_id: str = None, organization_code: str = None):
        """
        初始化TOS上传工具

        Args:
            sandbox_id: 沙盒ID，用于生成上传路径
            workspace_dir: 工作空间目录
            credentials_file: TOS凭证文件路径
            task_id: 任务ID，用于上传后注册文件（已弃用，保留参数兼容旧代码）
            organization_code: 组织编码，用于上传后注册文件
        """
        self.sandbox_id = sandbox_id
        self.workspace_dir = Path(workspace_dir).resolve()
        self.credentials_file = credentials_file
        self.credentials = None
        self.storage_service = None
        self.file_hashes = {}  # 用于存储文件哈希，避免重复上传相同内容
        self.task_id = None  # 不再使用task_id
        self.organization_code = organization_code
        self.uploaded_files = []  # 存储上传成功的文件信息，用于批量注册

        # 从环境变量获取API基础URL
        self.api_base_url = os.getenv("MAGIC_API_SERVICE_BASE_URL")

        if not self.api_base_url:
            logger.warning("未设置MAGIC_API_SERVICE_BASE_URL环境变量，将无法进行文件注册")
        else:
            # 检查是否包含http://或https://前缀，如果没有则添加https://
            if not self.api_base_url.startswith(("http://", "https://")):
                self.api_base_url = f"https://{self.api_base_url}"
                logger.info(f"API URL未包含协议前缀，已自动添加https://")

            # 确保URL以/结尾
            if not self.api_base_url.endswith("/"):
                self.api_base_url += "/"

        if self.api_base_url:
            logger.info(f"使用API服务URL: {self.api_base_url}")

    async def initialize(self) -> bool:
        """
        初始化TOS上传工具

        Returns:
            bool: 初始化是否成功
        """
        # 从文件加载凭证
        if not await self._load_credentials():
            logger.error("无法加载TOS凭证")
            return False

        # _load_credentials中已经包含了存储服务的初始化，这里不再需要重复初始化
        return True

    async def _load_credentials(self) -> bool:
        """
        加载TOS凭证

        Returns:
            bool: 加载是否成功
        """
        try:
            # 优先使用默认凭证文件
            default_file = Path(".credentials/upload_credentials.json")

            # 如果指定了凭证文件，使用指定的文件
            if self.credentials_file and os.path.exists(self.credentials_file):
                credentials_path = self.credentials_file
                logger.info(f"使用指定的凭证文件: {self.credentials_file}")
            elif default_file.exists():
                credentials_path = default_file
                logger.info(f"使用默认凭证文件: {default_file}")
            else:
                logger.error("未找到任何可用的TOS凭证文件")
                return False

            # 读取凭证文件
            with open(credentials_path, "r") as f:
                credentials_data = json.load(f)

            # 检查凭证格式
            if not credentials_data.get("upload_config"):
                logger.error(f"凭证文件 {credentials_path} 中未找到 upload_config")
                return False

            # 检查sandbox_id是否存在（仅当未通过命令行指定时才检查）
            if not self.sandbox_id and not credentials_data.get("sandbox_id"):
                logger.error(f"凭证文件 {credentials_path} 中缺少必需的 sandbox_id，且未通过命令行参数指定")
                return False

            # 获取sandbox_id和organization_code
            # 如果命令行中没有指定沙盒ID，则使用凭证文件中的沙盒ID
            if not self.sandbox_id:
                self.sandbox_id = credentials_data.get("sandbox_id")

            # 如果命令行未指定组织编码，从文件读取
            if not self.organization_code:
                self.organization_code = credentials_data.get("organization_code")

            # 创建新的凭证对象
            self.credentials = VolcEngineCredentials(**credentials_data["upload_config"])
            logger.debug(f"已从文件 {credentials_path} 加载最新TOS凭证")

            # 每次重新加载凭证后也重新初始化存储服务
            try:
                # 从凭证中获取平台类型
                platform_type = None
                if "platform" in credentials_data["upload_config"]:
                    try:
                        platform_type = PlatformType(credentials_data["upload_config"]["platform"])
                        logger.debug(f"从凭证中获取平台类型: {platform_type.value}")
                    except (ValueError, TypeError):
                        logger.warning(f"无法从凭证中的平台值转换为PlatformType枚举")

                self.storage_service = await StorageFactory.get_storage(platform=platform_type)
                logger.debug("成功重新初始化TOS上传服务")
            except Exception as e:
                logger.error(f"重新初始化TOS上传服务失败: {e}")
                return False

            return True

        except Exception as e:
            logger.error(f"加载TOS凭证失败: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False

    def get_file_hash(self, file_path: str) -> str:
        """
        计算文件MD5哈希

        Args:
            file_path: 文件路径

        Returns:
            str: 文件MD5哈希
        """
        try:
            md5_hash = hashlib.md5()
            with open(file_path, "rb") as f:
                # 分块读取文件以处理大文件
                for chunk in iter(lambda: f.read(4096), b""):
                    md5_hash.update(chunk)
            return md5_hash.hexdigest()
        except Exception as e:
            logger.error(f"计算文件哈希失败: {e}")
            return ""

    async def upload_file(self, file_path: str) -> bool:
        """
        上传文件到TOS

        Args:
            file_path: 文件路径

        Returns:
            bool: 上传是否成功
        """
        # 每次上传前重新加载凭证，确保使用最新的
        if not await self._load_credentials():
            logger.error("上传前重新加载TOS凭证失败")
            return False

        if not self.storage_service or not self.credentials:
            logger.error("TOS上传服务未初始化")
            return False

        try:
            # 检查文件是否存在
            file_path = str(file_path)
            if not os.path.exists(file_path):
                logger.warning(f"文件不存在，无法上传: {file_path}")
                return False

            # 计算文件哈希
            file_hash = self.get_file_hash(file_path)
            if not file_hash:
                return False
            # 获取相对路径
            try:
                rel_path = os.path.relpath(file_path, str(self.workspace_dir))
            except ValueError:
                # 如果文件不在工作空间内，使用文件名
                rel_path = os.path.basename(file_path)

            # 构建存储键 - 使用凭证中的目录和相对路径，不添加沙盒ID
            from app.utils.path_utils import get_workspace_dir
            base_dir = get_workspace_dir(self.credentials)
            # 直接使用base_dir和rel_path构建key
            key = f"{base_dir}{rel_path}"

            # 检查文件是否已上传且内容相同
            if key in self.file_hashes and self.file_hashes[key] == file_hash:
                logger.info(f"文件内容未变化，跳过上传: {rel_path}")
                return True
            self.storage_service.set_credentials(self.credentials)

            # 上传文件
            logger.info(f"开始上传文件: {rel_path}, 存储键: {key}")
            response = await self.storage_service.upload(
                file=file_path,
                key=key
            )
            # 保存文件哈希
            self.file_hashes[key] = file_hash

            # 记录上传成功的文件信息，用于后续注册
            if self.sandbox_id:
                file_ext = os.path.splitext(file_path)[1].lstrip('.')
                # 从凭证中获取host，构建完整的访问URL
                host = self.credentials.temporary_credential.host if hasattr(self.credentials, 'temporary_credential') else None
                if host:
                    # 确保host不以/结尾，key不以/开头
                    if host.endswith('/'):
                        host = host[:-1]
                    file_key = key if not key.startswith('/') else key[1:]
                    external_url = f"{host}/{file_key}"
                else:
                    external_url = None

                self.uploaded_files.append({
                    "file_key": key,
                    "file_extension": file_ext,
                    "filename": os.path.basename(file_path),
                    "file_size": os.path.getsize(file_path),
                    "external_url": external_url,
                    "sandbox_id": self.sandbox_id
                })
                logger.info(f"文件已添加到待注册列表，当前列表大小: {len(self.uploaded_files)}")
            else:
                logger.warning("未设置沙盒ID，文件已上传但不会注册")

            logger.info(f"文件上传成功: {rel_path}, 存储键: {key}")
            return True

        except (InitException, UploadException) as e:
            logger.error(f"文件上传失败: {e}")
            return False
        except Exception as e:
            logger.error(f"上传过程中发生未知错误: {e}")
            return False

    async def register_uploaded_files(self) -> bool:
        """
        向API注册上传的文件

        Returns:
            bool: 注册是否成功
        """
        if not self.sandbox_id:
            logger.error("未设置沙盒ID，无法注册文件")
            return False

        if not self.uploaded_files:
            logger.info("没有需要注册的文件，跳过注册")
            return True

        logger.info(f"准备注册文件到API，当前列表大小: {len(self.uploaded_files)}，沙盒ID: {self.sandbox_id}")

        api_url_env = os.getenv("MAGIC_API_SERVICE_BASE_URL", "未设置")

        try:
            import aiohttp

            # 检查API基础URL是否存在
            if not self.api_base_url:
                logger.error("未设置MAGIC_API_SERVICE_BASE_URL环境变量，无法注册文件")
                return False

            # API地址
            api_url = f"{self.api_base_url}api/v1/super-agent/file/process-attachments"

            # 准备请求数据
            request_data = {
                "attachments": self.uploaded_files,
                "sandbox_id": self.sandbox_id
            }

            # 添加组织编码（如果有）
            if self.organization_code:
                request_data["organization_code"] = self.organization_code

            # 准备请求头
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "TOS-Uploader/1.0"
            }

            # 打印请求详情
            logger.info(f"========= 文件注册请求信息 =========")
            logger.info(f"请求URL: {api_url}")
            logger.info(f"请求头: {json.dumps(sanitize_headers(headers), ensure_ascii=False, indent=2)}")
            logger.info(f"请求体: {json.dumps(request_data, ensure_ascii=False, indent=2)}")
            logger.info(f"===================================")

            # 发送请求
            logger.info(f"开始向API注册上传的文件，沙盒ID: {self.sandbox_id}, 文件数量: {len(self.uploaded_files)}")
            async with aiohttp.ClientSession() as session:
                async with session.post(api_url, json=request_data, headers=headers) as response:
                    response_text = await response.text()
                    logger.info(f"响应状态码: {response.status}")
                    logger.info(f"响应内容: {response_text}")

                    if response.status == 200:
                        try:
                            result = json.loads(response_text)
                            if result.get("code") == 1000:
                                logger.info(f"文件注册API调用成功，总数: {result.get('data', {}).get('total', 0)}, "
                                          f"成功: {result.get('data', {}).get('success', 0)}, "
                                          f"跳过: {result.get('data', {}).get('skipped', 0)}")
                                # 注册成功后清空列表
                                self.uploaded_files = []
                                return True
                            else:
                                logger.error(f"文件注册API返回错误: {result.get('message')}")
                        except json.JSONDecodeError:
                            logger.error(f"响应不是有效的JSON格式")
                    else:
                        logger.error(f"文件注册请求失败，状态码: {response.status}")

            return False
        except Exception as e:
            logger.error(f"注册上传文件时发生错误: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False

    async def scan_existing_files(self, refresh: bool = False) -> None:
        """
        扫描并上传已存在的文件

        Args:
            refresh: 是否强制刷新所有文件
        """
        if refresh:
            self.file_hashes.clear()

        logger.info(f"开始扫描目录: {self.workspace_dir}")

        # 递归扫描目录
        for root, _, files in os.walk(str(self.workspace_dir)):
            for file in files:
                file_path = os.path.join(root, file)
                await self.upload_file(file_path)

        logger.info("目录扫描完成")

        # 如果设置了沙盒ID，则注册上传的文件
        if self.sandbox_id and self.uploaded_files:
            await self.register_uploaded_files()

    async def watch_command(self, sandbox_id: str, workspace_dir: str, once: bool = False,
                          refresh: bool = False, credentials_file: str = None,
                          task_id: str = None, organization_code: str = None) -> None:
        """
        监控命令实现

        Args:
            sandbox_id: 沙盒ID
            workspace_dir: 工作空间目录
            once: 是否只扫描一次已有文件
            refresh: 是否强制刷新所有文件
            credentials_file: TOS凭证文件路径
            task_id: 任务ID（已弃用，保留参数兼容旧代码）
            organization_code: 组织编码
        """
        # 重新设置参数
        self.sandbox_id = sandbox_id
        self.workspace_dir = Path(workspace_dir).resolve()
        self.credentials_file = credentials_file
        # self.task_id = task_id  # 不再使用task_id
        self.organization_code = organization_code

        # 初始化
        if not await self.initialize():
            logger.error("初始化失败，退出命令")
            return

        # 扫描现有文件
        await self.scan_existing_files(refresh)

        # 如果只扫描一次，则结束
        if once:
            logger.info("已完成一次性扫描，退出")
            return

        # 设置文件系统事件处理器
        event_handler = TOSFileEventHandler(self)

        # 获取当前事件循环并传递给事件处理器
        loop = asyncio.get_running_loop()
        event_handler.set_loop(loop)

        # 创建观察者
        observer = Observer()
        observer.schedule(event_handler, str(self.workspace_dir), recursive=True)

        # 启动观察者
        observer.start()
        logger.info(f"已开始监控目录: {self.workspace_dir}")

        try:
            # 保持程序运行
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("收到中断信号，停止监控")
        finally:
            # 停止观察者
            observer.stop()
            observer.join()


class TOSFileEventHandler(FileSystemEventHandler):
    """TOS文件事件处理器"""

    def __init__(self, uploader: TOSUploader):
        """
        初始化事件处理器

        Args:
            uploader: TOS上传器实例
        """
        super().__init__()
        self.uploader = uploader
        self._tasks = set()
        self._upload_queue = asyncio.Queue()
        self._main_loop = None
        self._register_timer = None
        self._last_upload_time = time.time()

    def set_loop(self, loop):
        """设置主事件循环"""
        self._main_loop = loop
        # 启动消费者任务
        asyncio.run_coroutine_threadsafe(self._process_queue(), loop)
        # 如果设置了任务ID，则启动定期注册任务
        if self.uploader.task_id:
            asyncio.run_coroutine_threadsafe(self._periodic_register(), loop)

    async def _process_queue(self):
        """处理上传队列中的任务"""
        while True:
            file_path = await self._upload_queue.get()
            try:
                # 延迟1秒，等待文件操作完成
                await asyncio.sleep(1)
                # 上传文件前已经会重新加载凭证，这里不需要额外调用
                uploaded = await self.uploader.upload_file(file_path)
                # 更新最后上传时间
                self._last_upload_time = time.time()

                # 检查是否有上传成功的文件，并立即尝试注册
                if uploaded and self.uploader.uploaded_files and self.uploader.sandbox_id:
                    logger.info(f"文件上传成功，尝试立即注册，已上传文件数: {len(self.uploader.uploaded_files)}")
                    asyncio.create_task(self.uploader.register_uploaded_files())

            except Exception as e:
                logger.error(f"处理文件上传任务失败: {e}")
            finally:
                self._upload_queue.task_done()

    async def _periodic_register(self):
        """定期注册上传的文件"""
        while True:
            try:
                # 等待30秒后尝试注册
                await asyncio.sleep(30)

                # 如果有上传的文件且距上次上传超过20秒，则注册
                current_time = time.time()
                if (self.uploader.uploaded_files and
                    self.uploader.sandbox_id and
                    current_time - self._last_upload_time > 20):
                    logger.info("检测到30秒内无新上传，开始注册已上传文件")
                    await self.uploader.register_uploaded_files()
            except Exception as e:
                logger.error(f"定期注册任务异常: {e}")
                # 继续循环，不因异常中断

    def on_created(self, event: FileSystemEvent) -> None:
        """
        处理文件创建事件

        Args:
            event: 文件系统事件
        """
        if event.is_directory:
            return

        logger.info(f"检测到文件创建: {event.src_path}")
        self._schedule_upload(event.src_path)

    def on_modified(self, event: FileSystemEvent) -> None:
        """
        处理文件修改事件

        Args:
            event: 文件系统事件
        """
        if event.is_directory:
            return

        logger.info(f"检测到文件修改: {event.src_path}")
        self._schedule_upload(event.src_path)

    def on_deleted(self, event: FileSystemEvent) -> None:
        """
        处理文件删除事件

        Args:
            event: 文件系统事件
        """
        if event.is_directory:
            return

        logger.info(f"检测到文件删除: {event.src_path}")
        # 目前仅记录删除事件，不执行操作
        # TODO: 未来可能需要实现从TOS中删除文件的功能

    def on_moved(self, event: FileSystemEvent) -> None:
        """
        处理文件移动事件

        Args:
            event: 文件系统事件
        """
        if event.is_directory:
            return

        logger.info(f"检测到文件移动: {event.src_path} -> {event.dest_path}")
        # 将移动视为删除原文件并创建新文件
        # TODO: 未来可能需要实现从TOS中移动文件的功能
        self._schedule_upload(event.dest_path)

    def _schedule_upload(self, file_path: str) -> None:
        """
        安排上传任务

        Args:
            file_path: 文件路径
        """
        if not self._main_loop:
            logger.error("主事件循环未设置，无法安排上传任务")
            return

        # 使用线程安全的方式将任务添加到队列
        asyncio.run_coroutine_threadsafe(
            self._upload_queue.put(file_path),
            self._main_loop
        )


async def _run_tos_uploader_watch(sandbox_id: str = "default",
                            workspace_dir: str = ".workspace",
                            once: bool = False,
                            refresh: bool = False,
                            credentials_file: str = None,
                            task_id: str = None,
                            organization_code: str = None):
    """运行TOS上传工具的监控功能（内部异步函数）

    Args:
        sandbox_id: 沙盒ID，用于生成上传路径
        workspace_dir: 工作空间目录
        once: 只扫描一次已有文件
        refresh: 强制刷新所有文件
        credentials_file: TOS凭证文件路径
        task_id: 任务ID（已弃用，保留参数兼容旧代码）
        organization_code: 组织编码
    """
    # 处理凭证文件路径
    context_creds = "config/upload_credentials.json"
    if os.path.exists(context_creds) and not credentials_file:
        credentials_file = context_creds
        logger.info(f"使用上下文凭证文件: {context_creds}")

    # 打印实际使用的凭证文件路径
    logger.info(f"凭证文件路径: {credentials_file or '未指定'}")

    # 检查凭证文件是否存在
    if credentials_file:
        if os.path.exists(credentials_file):
            logger.info(f"凭证文件存在: {credentials_file}")
        else:
            logger.warning(f"指定的凭证文件不存在: {credentials_file}")

    tos_uploader = TOSUploader(
        sandbox_id,
        workspace_dir,
        credentials_file,
        task_id,
        organization_code
    )

    await tos_uploader.watch_command(
        sandbox_id,
        workspace_dir,
        once,
        refresh,
        credentials_file,
        task_id,
        organization_code
    )

def start_tos_uploader_watcher(sandbox_id: str = "default",
                 workspace_dir: str = ".workspace",
                 once: bool = False,
                 refresh: bool = False,
                 credentials_file: str = None,
                 use_context: bool = False,
                 task_id: str = None,
                 organization_code: str = None):
    """监控目录变化并自动上传到TOS的命令入口

    Args:
        sandbox_id: 沙盒ID，用于生成上传路径
        workspace_dir: 工作空间目录
        once: 只扫描一次已有文件
        refresh: 强制刷新所有文件
        credentials_file: TOS凭证文件路径
        use_context: 是否使用上下文凭证
        task_id: 任务ID
        organization_code: 组织编码
    """
    # 处理凭证文件路径
    creds_file = credentials_file

    # 如果指定了使用上下文，优先使用config中的凭证
    if use_context and not creds_file:
        context_creds = "config/upload_credentials.json"
        if os.path.exists(context_creds):
            creds_file = context_creds
            logger.info(f"使用上下文凭证文件: {context_creds}")

    # 运行异步任务
    asyncio.run(_run_tos_uploader_watch(
        sandbox_id=sandbox_id,
        workspace_dir=workspace_dir,
        once=once,
        refresh=refresh,
        credentials_file=creds_file,
        task_id=task_id,
        organization_code=organization_code
    ))
