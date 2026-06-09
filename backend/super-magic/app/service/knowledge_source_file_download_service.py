import asyncio
import json
import os
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import quote

import aiohttp

from agentlang.logger import get_logger
from app.api.http_dto.knowledge_source_file_download_dto import (
    KnowledgeSourceFileDownloadItem,
    KnowledgeSourceFileDownloadResponse,
    KnowledgeSourceFileDownloadResult,
)
from app.core.context.agent_context import AgentContext
from app.infrastructure.magic_service.config import MagicServiceConfigLoader
from app.infrastructure.storage.base import AbstractStorage
from app.infrastructure.storage.factory import StorageFactory
from app.path_manager import PathManager
from app.utils.init_client_message_util import InitClientMessageUtil
from app.utils.path_utils import get_workspace_dir as get_remote_workspace_dir

logger = get_logger(__name__)

DOWNLOAD_TIMEOUT_SECONDS = 120


@dataclass(frozen=True, slots=True)
class DownloadedProjectFile:
    workspace_file_key: str
    project_file_id: str
    relative_path: str


class KnowledgeSourceFileDownloadService:
    """
    知识库源文件下载服务。
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

            logger.info("知识库源文件下载服务：存储服务初始化完成")

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
        try:
            resolved_path.relative_to(workspace_resolved)
        except ValueError:
            raise ValueError(f"路径 '{location}' 超出工作区范围，拒绝写入")

        return resolved_path

    async def download_source_file(
        self,
        file_key: str,
        location: str,
        knowledge_code: str,
        document_code: str,
    ) -> KnowledgeSourceFileDownloadResult:
        """
        下载知识库源文件到工作区。
        """
        try:
            await self._ensure_storage_service()

            # 1. 验证并获取安全的目标路径
            target_path = self._get_safe_target_path(location)

            # 2. 通过 magic-service 校验知识库访问权限并换取临时下载地址
            source_file = await self.get_knowledge_source_file_link(
                knowledge_code=knowledge_code,
                document_code=document_code,
                file_key=file_key,
            )
            download_url = str(source_file["url"])
            logger.info(
                "开始下载知识库源文件: "
                f"knowledge_code={knowledge_code}, document_code={document_code}, "
                f"file_key={file_key} -> {target_path}"
            )

            # 3. 下载到本地工作区，再注册到项目文件区
            target_path.parent.mkdir(parents=True, exist_ok=True)
            file_size = await self.download_url_to_path(download_url, target_path)
            logger.info(f"知识库源文件下载完成: {target_path} ({file_size} 字节)")

            return await self.build_success_result(
                file_key=file_key,
                location=location,
                target_path=target_path,
                file_size=file_size,
            )

        except Exception as e:
            logger.error(f"下载知识库源文件失败 {file_key}: {e}")
            return KnowledgeSourceFileDownloadResult(
                file_key=file_key,
                location=location,
                success=False,
                error_message=str(e)
            )

    async def get_knowledge_source_file_link(
        self,
        knowledge_code: str,
        document_code: str,
        file_key: str,
    ) -> dict[str, Any]:
        for field_name, value in {
            "knowledge_code": knowledge_code,
            "document_code": document_code,
            "file_key": file_key,
        }.items():
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{field_name} 不能为空")

        config = MagicServiceConfigLoader.load_with_fallback()
        knowledge_code = knowledge_code.strip()
        document_code = document_code.strip()
        file_key = file_key.strip()
        api_url = (
            f"{config.api_base_url.rstrip('/')}/go/api/v1/knowledge-bases/"
            f"{quote(knowledge_code, safe='')}/documents/{quote(document_code, safe='')}/source-file-link"
        )
        body = await self.request_magic_service_json(
            "POST",
            api_url,
            {
                "file_key": file_key,
            },
        )
        data = self.extract_response_data(body)
        if not data.get("available"):
            raise RuntimeError("知识库源文件不可用")
        download_url = str(data.get("url") or "").strip()
        if not download_url:
            raise RuntimeError("知识库源文件链接缺少 url")
        verified_file_key = str(data.get("file_key") or "").strip()
        if verified_file_key != file_key:
            raise RuntimeError("知识库源文件校验失败")
        data["url"] = download_url
        data["file_key"] = verified_file_key
        return data

    async def request_magic_service_json(
        self,
        method: str,
        api_url: str,
        payload: dict | None = None,
    ) -> dict:
        headers = self.build_magic_service_headers()

        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.request(method, api_url, json=payload, headers=headers) as response:
                response_text = await response.text()
                if response.status != 200:
                    raise RuntimeError(f"获取文件下载链接失败: HTTP {response.status}: {response_text[:200]}")

        try:
            body = json.loads(response_text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"获取文件下载链接失败: 响应不是 JSON: {response_text[:200]}") from exc

        if body.get("code") != 1000:
            message = body.get("message") or "unknown error"
            raise RuntimeError(f"获取文件下载链接失败: {message}")

        return body

    def build_magic_service_headers(self) -> dict:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "KnowledgeSourceFileDownloadService/1.0",
        }
        try:
            config = InitClientMessageUtil.get_full_config()
        except Exception as e:
            logger.warning(f"读取 init_client_message 失败，无法附加 magic-service 认证头: {e}")
            return headers

        message_headers = (config.get("message_subscription_config") or {}).get("headers") or {}
        token = message_headers.get("token")
        if token:
            headers["token"] = str(token)

        metadata = config.get("metadata") or {}
        organization_code = metadata.get("organization_code") or metadata.get("organizationCode")
        if organization_code:
            headers["Organization-Code"] = str(organization_code)
        user_id = metadata.get("user_id")
        if user_id:
            headers["user-id"] = str(user_id)
        user_authorization = metadata.get("authorization")
        if user_authorization:
            authorization = str(user_authorization)
            headers["user-authorization"] = authorization
            headers["Authorization"] = authorization
        return headers

    @staticmethod
    async def download_url_to_path(download_url: str, target_path: Path) -> int:
        temp_file_path = None
        try:
            temp_file = tempfile.NamedTemporaryFile(
                delete=False,
                dir=target_path.parent,
                prefix=f".{target_path.name}.",
                suffix=".download",
            )
            temp_file_path = temp_file.name
            temp_file.close()

            timeout = aiohttp.ClientTimeout(total=DOWNLOAD_TIMEOUT_SECONDS)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(download_url) as response:
                    if response.status != 200:
                        response_text = await response.text()
                        raise RuntimeError(f"下载知识库源文件失败: HTTP {response.status}: {response_text[:200]}")

                    with open(temp_file_path, "wb") as file:
                        async for chunk in response.content.iter_chunked(1024 * 1024):
                            if chunk:
                                file.write(chunk)

            file_size = os.path.getsize(temp_file_path)
            shutil.move(temp_file_path, target_path)
            temp_file_path = None
            return file_size
        finally:
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                except Exception as cleanup_error:
                    logger.warning(f"清理临时下载文件失败: {cleanup_error}")

    async def build_success_result(
        self,
        file_key: str,
        location: str,
        target_path: Path,
        file_size: int,
    ) -> KnowledgeSourceFileDownloadResult:
        result = KnowledgeSourceFileDownloadResult(
            file_key=file_key,
            location=location,
            success=True,
            file_size=file_size,
        )

        try:
            project_file = await self.register_downloaded_workspace_file(location, target_path, file_size)
        except Exception as exc:
            logger.error(f"注册下载文件到项目文件区失败 {location}: {exc}")
            return KnowledgeSourceFileDownloadResult(
                file_key=file_key,
                location=location,
                success=False,
                file_size=file_size,
                error_message=f"文件已下载到工作区本地，但注册到项目文件区失败: {exc}",
            )

        if project_file is not None:
            result.workspace_file_key = project_file.workspace_file_key
            result.project_file_id = project_file.project_file_id
            result.registered_relative_path = project_file.relative_path

        return result

    async def register_downloaded_workspace_file(
        self,
        location: str,
        target_path: Path,
        file_size: int,
    ) -> DownloadedProjectFile | None:
        """
        将下载后的知识库源文件纳入 MagicCrew 项目文件区。

        本地桌面验证环境没有 magicfs xattr，单纯写入 .workspace 不会出现在项目文件树里。
        这里显式上传到当前项目 workspace 对象目录，再调用 magic-service 保存目录/文件节点。
        """
        try:
            metadata = self.agent_context.get_metadata()
        except Exception as exc:
            logger.info(f"无法读取 agent metadata，跳过项目文件注册: {exc}")
            return None
        project_id = str(metadata.get("project_id") or "")
        if not project_id:
            logger.info("缺少 project_id，跳过项目文件注册")
            return None

        await self._ensure_storage_service()

        parts = self.split_workspace_location(location)
        if not parts:
            raise ValueError("下载目标路径为空，无法注册项目文件")

        remote_workspace_dir = get_remote_workspace_dir(self.storage_service.credentials)
        if not remote_workspace_dir:
            logger.info("缺少远端 workspace 目录，跳过项目文件注册")
            return None
        if not remote_workspace_dir.endswith("/"):
            remote_workspace_dir += "/"

        relative_path = "/".join(parts)
        workspace_file_key = f"{remote_workspace_dir}{relative_path}"
        logger.info(f"上传知识库源文件到项目 workspace 存储: {target_path} -> {workspace_file_key}")
        await self.storage_service.upload(file=str(target_path), key=workspace_file_key)

        api_base_url = MagicServiceConfigLoader.load_with_fallback().api_base_url.rstrip("/")
        parent_id = await self.ensure_project_directories(api_base_url, project_id, parts[:-1])
        saved_file = await self.save_project_file(
            api_base_url=api_base_url,
            project_id=project_id,
            parent_id=parent_id,
            file_name=parts[-1],
            workspace_file_key=workspace_file_key,
            file_size=file_size,
            relative_path=relative_path,
            metadata=metadata,
        )

        project_file_id = str(saved_file.get("file_id") or "")
        registered_relative_path = str(saved_file.get("relative_file_path") or relative_path)
        logger.info(
            "项目文件注册完成: "
            f"file_id={project_file_id}, relative_path={registered_relative_path}, file_key={workspace_file_key}"
        )

        return DownloadedProjectFile(
            workspace_file_key=workspace_file_key,
            project_file_id=project_file_id,
            relative_path=registered_relative_path,
        )

    @staticmethod
    def split_workspace_location(location: str) -> list[str]:
        normalized = location.replace("\\", "/").strip().lstrip("/")
        parts = [part for part in PurePosixPath(normalized).parts if part not in {"", "."}]
        if any(part == ".." for part in parts):
            raise ValueError(f"路径 '{location}' 包含不安全的路径段")
        return parts

    async def ensure_project_directories(
        self,
        api_base_url: str,
        project_id: str,
        directory_parts: list[str],
    ) -> str:
        parent_id = ""
        for directory_name in directory_parts:
            body = await self.request_magic_service_json(
                "POST",
                f"{api_base_url}/api/v1/super-agent/file",
                {
                    "project_id": project_id,
                    "parent_id": parent_id,
                    "file_name": directory_name,
                    "is_directory": True,
                    "ignore_duplicate": True,
                    "pre_file_id": -1,
                },
            )
            data = self.extract_response_data(body)
            parent_id = str(data.get("file_id") or "")
            if not parent_id:
                raise RuntimeError(f"创建项目目录失败: {directory_name}")
        return parent_id

    async def save_project_file(
        self,
        api_base_url: str,
        project_id: str,
        parent_id: str,
        file_name: str,
        workspace_file_key: str,
        file_size: int,
        relative_path: str,
        metadata: dict[str, Any],
    ) -> dict[str, Any]:
        body = await self.request_magic_service_json(
            "POST",
            f"{api_base_url}/api/v1/super-agent/file/project/save",
            {
                "project_id": project_id,
                "topic_id": str(metadata.get("topic_id") or ""),
                "task_id": str(metadata.get("super_magic_task_id") or ""),
                "file_key": workspace_file_key,
                "file_name": file_name,
                "file_size": file_size,
                "file_type": "user_upload",
                "is_directory": False,
                "parent_id": parent_id,
                "storage_type": "workspace",
                "source": 3,
                "pre_file_id": "-1",
            },
        )
        data = self.extract_response_data(body)
        if not data.get("file_id"):
            raise RuntimeError(f"保存项目文件失败: {relative_path}")
        return data

    @staticmethod
    def extract_response_data(body: dict[str, Any]) -> dict[str, Any]:
        data = body.get("data")
        if isinstance(data, dict):
            return data
        raise RuntimeError("magic-service 响应缺少 data")

    async def download_source_files_batch(
        self,
        files: list[KnowledgeSourceFileDownloadItem],
    ) -> KnowledgeSourceFileDownloadResponse:
        """
        批量下载知识库源文件，使用并发控制避免过多同时下载。
        """
        logger.info(f"开始批量下载 {len(files)} 个知识库源文件")

        semaphore = asyncio.Semaphore(self.max_concurrent_downloads)

        async def download_with_semaphore(file_item: KnowledgeSourceFileDownloadItem) -> KnowledgeSourceFileDownloadResult:
            async with semaphore:
                return await self.download_source_file(
                    file_item.file_key,
                    file_item.location,
                    file_item.knowledge_code,
                    file_item.document_code,
                )

        # 并发下载所有文件
        tasks = [download_with_semaphore(file_item) for file_item in files]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 处理结果，将异常转换为失败结果
        final_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                final_results.append(KnowledgeSourceFileDownloadResult(
                    file_key=files[i].file_key,
                    location=files[i].location,
                    success=False,
                    error_message=f"下载异常: {result!s}"
                ))
            else:
                final_results.append(result)

        # 统计结果
        total_count = len(final_results)
        success_count = sum(1 for r in final_results if r.success)
        failed_count = total_count - success_count

        logger.info(f"知识库源文件批量下载完成: 总数 {total_count}, 成功 {success_count}, 失败 {failed_count}")

        return KnowledgeSourceFileDownloadResponse(
            total_count=total_count,
            success_count=success_count,
            failed_count=failed_count,
            results=final_results
        )
