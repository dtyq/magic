import asyncio
import os
import shutil
import tempfile
from pathlib import Path
from typing import List

from app.core.context.agent_context import AgentContext
from app.infrastructure.storage.base import AbstractStorage, BaseFileProcessor
from app.infrastructure.storage.factory import StorageFactory
from app.paths import PathManager
from app.api.http_dto.file_download_dto import FileDownloadItem, FileDownloadResult, FileDownloadResponse
from agentlang.logger import get_logger

logger = get_logger(__name__)


class FileDownloadService:
    """
    文件下载服务
    基于现有的存储下载逻辑实现文件下载到工作区功能
    """

    def __init__(self, agent_context: AgentContext):
        self.agent_context = agent_context
        self.storage_service: AbstractStorage = None
        # 设置最大并发下载数，避免过多并发影响系统性能
        self.max_concurrent_downloads = 5

    async def _ensure_storage_service(self):
        """
        确保存储服务已初始化
        完全复用现有的存储服务获取逻辑 (参考 agent_service.py:L131-135)
        """
        if not self.storage_service:
            # 获取配置信息（复用现有逻辑）
            sts_token_refresh = self.agent_context.get_init_client_message_sts_token_refresh()
            metadata = self.agent_context.get_metadata()
            platform_type = self.agent_context.get_init_client_message_platform_type()

            self.storage_service = await StorageFactory.get_storage(
                sts_token_refresh=sts_token_refresh,
                metadata=metadata,
                platform=platform_type
            )

            logger.info("文件下载服务：存储服务初始化完成")

    def _get_safe_target_path(self, location: str) -> Path:
        """
        获取安全的目标路径
        参考解压逻辑的路径处理 (agent_service.py:L358)
        """
        # 获取工作区目录（复用现有逻辑）
        workspace_dir = PathManager.get_workspace_dir()

        # 清理用户输入的路径
        clean_location = location.strip().lstrip('/')

        # 构建目标路径
        target_path = workspace_dir / clean_location

        # 解析路径（处理 ../ 等）
        resolved_path = target_path.resolve()

        # 确保路径在工作区内（安全检查）
        workspace_resolved = workspace_dir.resolve()
        if not str(resolved_path).startswith(str(workspace_resolved)):
            raise ValueError(f"路径 '{location}' 超出工作区范围，拒绝写入")

        return resolved_path

    async def download_single_file(self, file_key: str, location: str) -> FileDownloadResult:
        """
        下载单个文件到工作区
        参考 agent_service.py 的下载逻辑
        """
        try:
            await self._ensure_storage_service()

            # 1. 验证并获取安全的目标路径
            target_path = self._get_safe_target_path(location)

            # 2. 检查文件是否存在（参考现有逻辑）
            if not await self.storage_service.exists(file_key):
                return FileDownloadResult(
                    file_key=file_key,
                    location=location,
                    success=False,
                    error_message=f"文件在存储中不存在: {file_key}"
                )

            # 3. 下载文件（参考工作区归档下载逻辑 L318-335）
            logger.info(f"开始下载文件: {file_key} -> {target_path}")

            file_stream = await self.storage_service.download(
                key=file_key,
                options=None
            )

            if not file_stream:
                return FileDownloadResult(
                    file_key=file_key,
                    location=location,
                    success=False,
                    error_message="下载返回的文件流为空"
                )

            # 4. 读取内容并写入目标文件（参考现有逻辑）
            file_content = file_stream.read()

            # 确保目标目录存在（参考解压逻辑 L359）
            target_path.parent.mkdir(parents=True, exist_ok=True)

            # 写入文件
            with open(target_path, 'wb') as f:
                f.write(file_content)

            # 验证文件大小
            actual_size = target_path.stat().st_size
            logger.info(f"文件下载完成: {target_path} ({actual_size} 字节)")

            return FileDownloadResult(
                file_key=file_key,
                location=location,
                success=True,
                file_size=actual_size
            )

        except Exception as e:
            logger.error(f"下载文件失败 {file_key}: {e}")
            return FileDownloadResult(
                file_key=file_key,
                location=location,
                success=False,
                error_message=str(e)
            )

    async def download_single_file_large(self, file_key: str, location: str) -> FileDownloadResult:
        """
        大文件下载版本，使用临时文件方式
        参考聊天历史下载逻辑 (agent_service.py:L434-442)
        """
        temp_file_path = None
        try:
            await self._ensure_storage_service()

            target_path = self._get_safe_target_path(location)

            # 检查文件是否存在
            if not await self.storage_service.exists(file_key):
                return FileDownloadResult(
                    file_key=file_key,
                    location=location,
                    success=False,
                    error_message=f"文件在存储中不存在: {file_key}"
                )

            # 使用临时文件下载（参考聊天历史下载）
            logger.info(f"开始下载大文件: {file_key}")

            file_stream = await self.storage_service.download(
                    key=file_key,
                    options=None
                )

            if not file_stream:
                return FileDownloadResponse(
                    success=False,
                    error_message=f"下载文件失败: 返回的文件流为空"
                )

            # Save to temporary file
            temp_file = tempfile.NamedTemporaryFile(delete=False)
            temp_file_path = temp_file.name
            temp_file.close()

            file_content = file_stream.read()

            with open(temp_file_path, 'wb') as f:
                f.write(file_content)

                file_size = os.path.getsize(temp_file_path)
                logger.info(f"文件下载到临时位置: {temp_file_path} ({file_size} 字节)")

            # 确保目标目录存在
            target_path.parent.mkdir(parents=True, exist_ok=True)

            # 移动到目标位置
            shutil.move(temp_file_path, target_path)
            logger.info(f"大文件下载完成: {target_path} ({file_size} 字节)")

            return FileDownloadResult(
                file_key=file_key,
                location=location,
                success=True,
                file_size=file_size
            )

        except Exception as e:
            logger.error(f"下载大文件失败 {file_key}: {e}")

            # 清理临时文件
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                    logger.debug(f"已清理临时文件: {temp_file_path}")
                except Exception as cleanup_error:
                    logger.warning(f"清理临时文件失败: {cleanup_error}")

            return FileDownloadResult(
                file_key=file_key,
                location=location,
                success=False,
                error_message=str(e)
            )

    async def download_files_batch(self, files: List[FileDownloadItem]) -> FileDownloadResponse:
        """
        批量下载文件
        使用并发控制避免过多同时下载
        """
        logger.info(f"开始批量下载 {len(files)} 个文件")

        # 创建信号量控制并发数
        semaphore = asyncio.Semaphore(self.max_concurrent_downloads)

        async def download_with_semaphore(file_item: FileDownloadItem) -> FileDownloadResult:
            """带并发控制的下载"""
            async with semaphore:
                # 简单的文件大小判断：根据文件扩展名决定使用哪种下载方式
                # 可以后续优化为根据实际文件大小判断
                large_file_extensions = {'.zip', '.tar', '.gz', '.mp4', '.avi', '.iso', '.dmg'}
                file_ext = Path(file_item.location).suffix.lower()

                if file_ext in large_file_extensions:
                    return await self.download_single_file_large(file_item.file_key, file_item.location)
                else:
                    return await self.download_single_file(file_item.file_key, file_item.location)

        # 并发下载所有文件
        tasks = [download_with_semaphore(file_item) for file_item in files]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 处理结果，将异常转换为失败结果
        final_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                final_results.append(FileDownloadResult(
                    file_key=files[i].file_key,
                    location=files[i].location,
                    success=False,
                    error_message=f"下载异常: {str(result)}"
                ))
            else:
                final_results.append(result)

        # 统计结果
        total_count = len(final_results)
        success_count = sum(1 for r in final_results if r.success)
        failed_count = total_count - success_count

        logger.info(f"批量下载完成: 总数 {total_count}, 成功 {success_count}, 失败 {failed_count}")

        return FileDownloadResponse(
            total_count=total_count,
            success_count=success_count,
            failed_count=failed_count,
            results=final_results
        )
