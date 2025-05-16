import asyncio
import hashlib
import json
import os
import time
import traceback
from pathlib import Path
from typing import Optional, Dict

import typer
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent

from app.infrastructure.storage.factory import StorageFactory
from app.infrastructure.storage.types import PlatformType, BaseStorageCredentials
from app.infrastructure.storage.base import AbstractStorage
from app.infrastructure.storage.exceptions import InitException, UploadException
from agentlang.logger import get_logger, setup_logger
from app.paths import PathManager

cli_app = typer.Typer(name="storage-uploader", help="Storage Uploader Tool for various backends.", no_args_is_help=True)
logger = get_logger(__name__)


class FileHashCache:
    """封装文件对象键到其内容哈希的缓存逻辑。"""
    def __init__(self):
        self._cache: Dict[str, str] = {}

    def get_hash(self, object_key: str) -> Optional[str]:
        """根据对象键获取缓存的文件哈希。如果未找到则返回None。"""
        return self._cache.get(object_key)

    def set_hash(self, object_key: str, file_hash: str) -> None:
        """设置或更新对象键的文件哈希。"""
        self._cache[object_key] = file_hash

    def clear(self) -> None:
        """清空整个缓存。"""
        self._cache.clear()

    def __len__(self) -> int:
        return len(self._cache)


class StorageUploaderTool:
    """通用存储上传工具"""

    def __init__(self,
                 credentials_file: Optional[str] = None,
                 sandbox_id: Optional[str] = None,
                 task_id: Optional[str] = None,
                 organization_code: Optional[str] = None):
        """
        初始化上传工具

        Args:
            credentials_file: 凭证文件路径
            sandbox_id: 沙盒ID
            task_id: 任务ID (基本已弃用，主要由API层面处理)
            organization_code: 组织编码
        """
        self.credentials_file = credentials_file
        self.sandbox_id = sandbox_id
        self.task_id = task_id
        self.organization_code = organization_code

        self.storage_service: Optional[AbstractStorage] = None
        self.platform: Optional[PlatformType] = None
        self.uploaded_files_cache = FileHashCache()
        self.uploaded_files_for_registration: list = []
        self.last_upload_time = time.time()  # 记录最后一次上传时间

        self.api_base_url = os.getenv("MAGIC_API_SERVICE_BASE_URL")
        if self.api_base_url:
            if not self.api_base_url.startswith(("http://", "https://")):
                self.api_base_url = f"https://{self.api_base_url}"
            if not self.api_base_url.endswith("/"):
                self.api_base_url += "/"
            logger.info(f"Uploader Tool: API服务URL: {self.api_base_url}")
        else:
            logger.warning("Uploader Tool: 未设置MAGIC_API_SERVICE_BASE_URL环境变量，将无法进行文件注册")

    async def _load_credentials(self) -> bool:
        """
        加载凭证文件，确定平台，并初始化/更新存储服务及其凭证。
        """
        try:
            default_creds_paths = []
            if PathManager._initialized:
                project_root = PathManager.get_project_root()
                default_creds_paths.append(project_root / ".credentials" / "upload_credentials.json")
                default_creds_paths.append(project_root / "config" / "upload_credentials.json")
            else:
                logger.warning("PathManager not initialized. Relying on CWD for default credential paths.")
                default_creds_paths.append(Path(".credentials/upload_credentials.json").resolve())
                default_creds_paths.append(Path("config/upload_credentials.json").resolve())


            credentials_path_to_load = None
            if self.credentials_file and Path(self.credentials_file).exists():
                credentials_path_to_load = Path(self.credentials_file)
                logger.info(f"使用指定的凭证文件: {credentials_path_to_load}")
            else:
                for p in default_creds_paths:
                    if p.exists():
                        credentials_path_to_load = p
                        logger.info(f"使用默认凭证文件: {credentials_path_to_load}")
                        break
            
            if not credentials_path_to_load:
                logger.error("未找到任何可用的凭证文件 (检查了指定路径和默认路径)")
                return False

            with open(credentials_path_to_load, "r") as f:
                credentials_data = json.load(f)

            upload_config_dict = credentials_data.get("upload_config")
            if not upload_config_dict:
                logger.error(f"凭证文件 {credentials_path_to_load} 中未找到 'upload_config' 键")
                return False
            
            if self.sandbox_id is None and "sandbox_id" in credentials_data:
                self.sandbox_id = credentials_data.get("sandbox_id")
                logger.info(f"从凭证文件加载了 sandbox_id: {self.sandbox_id}")
            if self.organization_code is None and "organization_code" in credentials_data:
                self.organization_code = credentials_data.get("organization_code")
                logger.info(f"从凭证文件加载了 organization_code: {self.organization_code}")

            # 每次重新加载凭证后也重新初始化存储服务
            self.storage_service = await StorageFactory.get_storage(
                sts_token_refresh=None,
                metadata=None
            )

            self.storage_service.set_credentials(upload_config_dict)
            
            if hasattr(self.storage_service.credentials, 'platform') and isinstance(self.storage_service.credentials.platform, PlatformType):
                self.platform = self.storage_service.credentials.platform
            else:
                current_service_platform_name = self.storage_service.get_platform_name()
                try:
                    self.platform = PlatformType(current_service_platform_name)
                    logger.info(f"StorageFactory 初始化了基于 '{current_service_platform_name}' (环境变量/默认) 的服务.")
                except ValueError:
                    logger.warning(f"无法从存储服务确定的平台名称 '{current_service_platform_name}' 转换为 PlatformType 枚举")
                    self.platform = None

            logger.info(f"凭证加载和存储服务准备完成，实际使用平台: {self.platform.value if self.platform else '未知'}")
            return True

        except InitException as e:
            logger.error(f"存储服务初始化失败: {e}")
            return False
        except ValueError as e:
            logger.error(f"加载或设置凭证失败 (格式错误): {e}")
            return False
        except Exception as e:
            logger.error(f"加载凭证或初始化存储服务时发生未知错误: {e}", exc_info=True)
            logger.error(traceback.format_exc())
            return False

    def _get_file_hash(self, file_path: Path) -> str:
        md5_hash = hashlib.md5()
        try:
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    md5_hash.update(chunk)
            return md5_hash.hexdigest()
        except Exception as e:
            logger.error(f"计算文件哈希失败 ({file_path}): {e}")
            return ""

    async def upload_file(self, file_path: Path, workspace_dir: Path) -> bool:
        # 每次都重新加载凭证以确保使用最新的凭证
        await self._load_credentials()
        
        try:
            if not file_path.exists():
                logger.warning(f"文件不存在，无法上传: {file_path}")
                return False

            file_hash = self._get_file_hash(file_path)
            if not file_hash: return False

            try:
                relative_path_str = file_path.relative_to(workspace_dir).as_posix()
            except ValueError:
                relative_path_str = file_path.name

            base_dir = self.storage_service.credentials.get_dir()
            
            object_key_parts = []
            if base_dir: object_key_parts.append(base_dir.strip('/'))
            if self.sandbox_id: object_key_parts.append(self.sandbox_id.strip('/'))
            object_key_parts.append(relative_path_str.strip('/'))
            
            object_key = "/".join(filter(None, object_key_parts))


            cached_hash = self.uploaded_files_cache.get_hash(object_key)
            if cached_hash == file_hash:
                logger.info(f"文件内容未变化，跳过上传: {relative_path_str} (平台: {self.platform.value if self.platform else 'N/A'})")
                return True

            logger.info(f"开始上传文件到平台 {self.platform.value if self.platform else 'N/A'}: {relative_path_str}, 存储键: {object_key}")
            
            await self.storage_service.upload(file=str(file_path), key=object_key)
            self.uploaded_files_cache.set_hash(object_key, file_hash)
            # 更新最后上传时间
            self.last_upload_time = time.time()
            logger.info(f"文件上传成功: {relative_path_str}, 存储键: {object_key}")

            if self.sandbox_id:
                file_ext = file_path.suffix.lstrip('.')
                external_url = None
                base_url = self.storage_service.credentials.get_public_access_base_url()
                if base_url:
                    external_url = f"{base_url.strip('/')}/{object_key.lstrip('/')}"
                else:
                    logger.warning(f"平台 {self.platform.value if self.platform else 'N/A'} 的凭证无法生成公共访问基础URL for {object_key}")

                self.uploaded_files_for_registration.append({
                    "file_key": object_key,
                    "file_extension": file_ext,
                    "filename": file_path.name,
                    "file_size": file_path.stat().st_size,
                    "external_url": external_url,
                    "sandbox_id": self.sandbox_id
                })
                logger.debug(f"文件已添加到待注册列表, 当前列表大小: {len(self.uploaded_files_for_registration)}")

            return True
        except (InitException, UploadException) as e:
            logger.error(f"文件上传失败 ({relative_path_str if 'relative_path_str' in locals() else file_path}): {e}")
            return False
        except Exception as e:
            logger.error(f"上传过程中发生未知错误 ({relative_path_str if 'relative_path_str' in locals() else file_path}): {e}", exc_info=True)
            logger.error(traceback.format_exc())
            return False

    async def register_uploaded_files(self) -> bool:
        if not self.sandbox_id:
            logger.info("未设置沙盒ID，无法注册文件")
            return True
        
        if not self.uploaded_files_for_registration:
            logger.info("没有需要注册的新文件，跳过注册")
            return True

        if not self.api_base_url:
            logger.error("API基础URL未设置 (MAGIC_API_SERVICE_BASE_URL)，无法注册文件")
            return False

        api_url = f"{self.api_base_url.strip('/')}/api/v1/super-agent/file/process-attachments"
        
        request_data = {
            "attachments": self.uploaded_files_for_registration,
            "sandbox_id": self.sandbox_id
        }
        # 添加组织编码（如果有）
        if self.organization_code:
            request_data["organization_code"] = self.organization_code
        
        # 如果有task_id也加上（虽然较少使用）
        if self.task_id:
            request_data["task_id"] = self.task_id
            
        headers = {"Content-Type": "application/json", "User-Agent": "StorageUploaderTool/2.0"}
        
        logger.info(f"========= 文件注册请求信息 =========")
        logger.info(f"准备向API注册 {len(self.uploaded_files_for_registration)} 个文件 (沙盒ID: {self.sandbox_id}) ...")
        logger.info(f"请求URL: {api_url}")
        logger.debug(f"请求头: {json.dumps(headers, ensure_ascii=False, indent=2)}")
        logger.debug(f"请求体: {json.dumps(request_data, ensure_ascii=False, indent=2)}")
        logger.info(f"===================================")

        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.post(api_url, json=request_data, headers=headers) as response:
                    response_text = await response.text()
                    logger.info(f"文件注册API响应状态码: {response.status}")
                    logger.debug(f"文件注册API响应内容: {response_text}")
                    if response.status == 200:
                        try:
                            result = json.loads(response_text)
                            if result.get("code") == 1000:
                                logger.info(f"文件注册API调用成功，总数: {result.get('data', {}).get('total', 0)}, "
                                          f"成功: {result.get('data', {}).get('success', 0)}, "
                                          f"跳过: {result.get('data', {}).get('skipped', 0)}")
                                self.uploaded_files_for_registration.clear()
                                return True
                            else:
                                logger.error(f"文件注册API返回业务错误: {result.get('message', '未知错误')}")
                        except json.JSONDecodeError:
                            logger.error(f"文件注册API响应不是有效的JSON格式: {response_text[:200]}...")
                    else:
                        logger.error(f"文件注册API请求失败，状态码: {response.status}, 响应: {response_text[:200]}...")
            return False
        except Exception as e:
            logger.error(f"注册上传文件时发生严重错误: {e}", exc_info=True)
            logger.error(traceback.format_exc())
            return False

    async def scan_existing_files(self, workspace_dir: Path, refresh: bool = False):
        if refresh:
            self.uploaded_files_cache.clear()
            logger.info("强制刷新模式：已清空本地文件哈希缓存。")
        
        logger.info(f"开始扫描已存在文件于目录: {workspace_dir}")
        for item in workspace_dir.rglob('*'):
            if item.is_file():
                await self.upload_file(item, workspace_dir)
        logger.info("现有文件扫描完成。")
        # 添加条件判断，与原TOSUploader保持一致
        if self.sandbox_id and self.uploaded_files_for_registration:
            await self.register_uploaded_files()

    async def _periodic_register(self):
        """周期性检查并注册上传的文件"""
        while True:
            try:
                # 等待30秒后尝试注册
                await asyncio.sleep(30)
                
                # 如果有上传的文件且距上次上传超过20秒，则注册
                current_time = time.time()
                if (self.uploaded_files_for_registration and 
                    self.sandbox_id and
                    current_time - self.last_upload_time > 20):
                    logger.info("检测到30秒内无新上传，开始注册已上传文件")
                    await self.register_uploaded_files()
            except Exception as e:
                logger.error(f"定期注册任务异常: {e}")
                logger.error(traceback.format_exc())
                # 继续循环，不因异常中断

    async def watch_command(self, workspace_dir: Path, once: bool, refresh: bool):
        if not await self._load_credentials():
            logger.error("初始化凭证和存储服务失败，监控命令无法启动。")
            return

        logger.info(f"监控命令启动，监控目录: {workspace_dir}, 一次性扫描: {once}, 强制刷新: {refresh}")
        
        await self.scan_existing_files(workspace_dir, refresh)
        if once:
            logger.info("已完成一次性扫描，程序退出。")
            return

        # 启动周期性注册任务
        asyncio.create_task(self._periodic_register())
        logger.info("已启动周期性文件注册任务（每30秒检查一次）")

        event_handler = FileChangeEventHandler(tool_instance=self, workspace_dir_to_watch=workspace_dir)
        observer = Observer()
        observer.schedule(event_handler, str(workspace_dir), recursive=True)
        observer.start()
        logger.info(f"已开始监控目录: {workspace_dir} 的文件变化...")
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("收到中断信号，停止监控。")
        finally:
            observer.stop()
            observer.join()
            logger.info("文件监控已停止。")
            if self.uploaded_files_for_registration:
                logger.info("程序退出前，尝试注册最后批次的已上传文件...")
                await self.register_uploaded_files()


class FileChangeEventHandler(FileSystemEventHandler):
    def __init__(self, tool_instance: StorageUploaderTool, workspace_dir_to_watch: Path):
        super().__init__()
        self.tool = tool_instance
        self.workspace_dir = workspace_dir_to_watch
        self.upload_queue = asyncio.Queue()
        self.loop = asyncio.get_event_loop()
        asyncio.create_task(self._process_upload_queue())

    async def _process_upload_queue(self):
        while True:
            file_path_to_upload = await self.upload_queue.get()
            try:
                # 延迟1秒，等待文件操作完成（与原TOSUploader一致）
                await asyncio.sleep(1) 
                logger.info(f"队列处理器: 开始处理文件 {file_path_to_upload}")
                success = await self.tool.upload_file(file_path_to_upload, self.workspace_dir)
                
                # 更加精确的立即注册逻辑判断，与原TOSUploader保持一致
                if success and self.tool.uploaded_files_for_registration and self.tool.sandbox_id:
                    logger.info(f"文件上传成功，尝试立即注册，已上传文件数: {len(self.tool.uploaded_files_for_registration)}")
                    await self.tool.register_uploaded_files()

            except Exception as e:
                logger.error(f"处理上传队列中的文件 {file_path_to_upload} 失败: {e}", exc_info=True)
                logger.error(traceback.format_exc())
            finally:
                self.upload_queue.task_done()

    def _schedule_upload(self, file_path_str: str):
        file_path = Path(file_path_str)
        if not file_path.is_absolute():
             file_path = self.workspace_dir / file_path
        
        asyncio.run_coroutine_threadsafe(self.upload_queue.put(file_path), self.loop)
        logger.debug(f"已将文件 {file_path} 添加到上传队列。")

    def on_created(self, event):
        if not event.is_directory:
            logger.info(f"检测到文件创建: {event.src_path}")
            self._schedule_upload(event.src_path)

    def on_modified(self, event):
        if not event.is_directory:
            logger.info(f"检测到文件修改: {event.src_path}")
            self._schedule_upload(event.src_path)

    def on_deleted(self, event):
        if not event.is_directory:
            logger.info(f"检测到文件删除: {event.src_path}")
            # 目前仅记录删除事件，不执行操作
            # TODO: 未来可能需要实现从存储中删除文件的功能

    def on_moved(self, event):
        if not event.is_directory:
            logger.info(f"检测到文件移动: {event.src_path} -> {event.dest_path}")
            # 将移动视为删除原文件并创建新文件
            self._schedule_upload(event.dest_path)


async def _run_storage_uploader_watch_async(
    tool: StorageUploaderTool,
    workspace_dir: Path,
    once: bool,
    refresh: bool
):
    await tool.watch_command(
        workspace_dir=workspace_dir,
        once=once,
        refresh=refresh
    )

@cli_app.command("watch")
def start_storage_uploader_watcher(
    sandbox_id: Optional[str] = typer.Option(None, "--sandbox", help="用于构建上传路径和文件注册的沙盒ID。", envvar="SUPER_MAGIC_SANDBOX_ID"),
    workspace_dir: str = typer.Option(".workspace", "--dir", help="要监控文件变化的工作空间目录路径。", envvar="SUPER_MAGIC_WORKSPACE_DIR", show_default=True),
    once: bool = typer.Option(False, "--once", help="执行一次文件扫描和上传后即退出，不持续监控目录变化。"),
    refresh: bool = typer.Option(False, "--refresh", help="强制重新上传所有文件，忽略本地文件哈希缓存的记录。"),
    credentials_file: Optional[str] = typer.Option(None, "--credentials", "-c", help="指定凭证文件的路径。若提供，则此选项优先于'--use-context'和默认查找逻辑。", envvar="SUPER_MAGIC_CREDENTIALS_FILE"),
    use_context: bool = typer.Option(False, "--use-context", help="若未通过'--credentials'指定文件，则尝试使用项目下'config/upload_credentials.json'作为凭证文件。"),
    task_id: Optional[str] = typer.Option(None, "--task-id", help="用于文件上传成功后在后端系统中注册的任务ID。"),
    organization_code: Optional[str] = typer.Option(None, "--organization-code", help="组织编码，可用于多租户场景下的文件注册或路径构建。", envvar="SUPER_MAGIC_ORGANIZATION_CODE"),
    log_level: str = typer.Option("INFO", "--log-level", help="设置工具的日志输出级别 (DEBUG, INFO, WARNING, ERROR)。")
):
    setup_logger(log_name="app", console_level=log_level.upper())
    cmd_logger = get_logger("StorageUploaderToolCommand")

    cmd_logger.info(f"Uploader Watch CLI invoked. Current STORAGE_PLATFORM env: {os.environ.get('STORAGE_PLATFORM', 'Not set, default to tos')}")
    cmd_logger.info(f"  Sandbox ID: {sandbox_id or 'Not set'}")
    cmd_logger.info(f"  Workspace Dir: {workspace_dir}")
    cmd_logger.info(f"  Once: {once}")
    cmd_logger.info(f"  Refresh: {refresh}")
    cmd_logger.info(f"  Use Context Flag: {use_context}")
    cmd_logger.info(f"  Credentials File (CLI arg): {credentials_file}")
    cmd_logger.info(f"  Task ID: {task_id or 'Not set'}")
    cmd_logger.info(f"  Organization Code: {organization_code or 'Not set'}")
    cmd_logger.info(f"  Log Level: {log_level.upper()}")

    final_credentials_file = credentials_file
    if use_context and not final_credentials_file:
        if PathManager._initialized:
            context_creds_path = PathManager.get_project_root() / "config" / "upload_credentials.json"
            if context_creds_path.exists():
                final_credentials_file = str(context_creds_path)
                cmd_logger.info(f"'--use-context' is True and no --credentials provided. Using context credentials: {final_credentials_file}")
            else:
                cmd_logger.warning(f"'--use-context' is True, but context credentials file not found at: {context_creds_path}")
        else:
            cmd_logger.warning("PathManager not initialized. Cannot resolve context credentials path for '--use-context'.")
    
    cmd_logger.info(f"Final credentials file to be used by StorageUploaderTool: {final_credentials_file or 'Default lookup in StorageUploaderTool'}")

    try:
        tool_instance = StorageUploaderTool(
            credentials_file=final_credentials_file,
            sandbox_id=sandbox_id,
            task_id=task_id,
            organization_code=organization_code
        )
        
        asyncio.run(
            _run_storage_uploader_watch_async(
                tool=tool_instance,
                workspace_dir=Path(workspace_dir).resolve(),
                once=once,
                refresh=refresh
            )
        )
    except Exception as e:
        cmd_logger.error(f"Error in storage uploader watcher command: {e}", exc_info=True)
        cmd_logger.error(traceback.format_exc())
        raise typer.Exit(code=1)

if __name__ == "__main__":
    current_file_path = Path(__file__).resolve()
    project_root_for_direct_run = current_file_path.parent.parent.parent
    if not PathManager._initialized:
        PathManager.set_project_root(project_root_for_direct_run)
        print(f"PathManager initialized for direct run with root: {project_root_for_direct_run}")
    else:
        print(f"PathManager already initialized. Project root: {PathManager.get_project_root()}")

    cli_app() 