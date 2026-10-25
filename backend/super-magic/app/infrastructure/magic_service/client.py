"""
Magic Service Client Module

Handles Magic Service API interactions including file registration.
"""

import json
import os
import re
import traceback
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional, cast
from urllib.parse import quote, urlparse

import aiohttp
from agentlang.logger import get_logger
from agentlang.config.config import config
from agentlang.utils.metadata import MetadataUtil
from app.core.entity.file import File

from app.utils.credential_utils import sanitize_headers
from app.utils.async_file_utils import async_unlink, async_write_bytes_iter

from .config import MagicServiceConfig, MagicServiceConfigLoader
from .constants import FileEditType
from .exceptions import ApiError, ConnectionError
from .file_version_trace import FileVersionRequestTrace, create_file_version_trace_config
from .sandbox_types import (
    SandboxInfoData,
    SandboxRebuildData,
    SandboxVersionData,
)

logger = get_logger(__name__)

SANDBOX_REBUILD_TIMEOUT_SECONDS = 900
_SANDBOX_REBUILD_TIMEOUT = aiohttp.ClientTimeout(total=SANDBOX_REBUILD_TIMEOUT_SECONDS)


class MagicServiceClient:
    """Client for interacting with Magic Service APIs"""

    def __init__(self, config: Optional[MagicServiceConfig] = None):
        """
        Initialize Magic Service client

        Args:
            config: Magic Service configuration
        """
        self.config = config or MagicServiceConfigLoader.load_with_fallback()
        self.session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession(trace_configs=[create_file_version_trace_config()])
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()

    async def _retry_on_specific_code(self, func, *args, max_retries=3, retry_delay=2, **kwargs):
        """
        Retry mechanism for API calls that fail with specific error codes

        Args:
            func: The async function to retry
            *args: Positional arguments for the function
            max_retries: Maximum number of retry attempts
            retry_delay: Delay between retries in seconds
            **kwargs: Keyword arguments for the function

        Returns:
            Function result or raises the last exception
        """
        last_exception = None

        for attempt in range(max_retries + 1):  # +1 for initial attempt
            try:
                return await func(*args, **kwargs)
            except ApiError as e:
                # Check if this is a retryable error code
                if hasattr(e, 'response_data') and isinstance(e.response_data, dict):
                    error_code = e.response_data.get('code')
                    if error_code == 51203:
                        last_exception = e
                        if attempt < max_retries:
                            logger.warning(f"API returned code 51203, retrying in {retry_delay}s (attempt {attempt + 1}/{max_retries + 1})")
                            await asyncio.sleep(retry_delay)
                            continue
                        else:
                            logger.error(f"API returned code 51203, max retries ({max_retries}) exceeded")
                            break
                # For non-retryable errors, raise immediately
                raise e
            except Exception as e:
                # For other exceptions, don't retry
                raise e

        # If we get here, we've exhausted retries
        raise last_exception if last_exception else Exception("Retry mechanism failed")

    async def register_files(self, file_attachments: List[Dict[str, Any]], sandbox_id: str, organization_code: str, task_id: str) -> Dict[str, Any]:
        """
        Register uploaded files with Magic Service

        Args:
            file_attachments: List of file attachment information

        Returns:
            Dict containing registration results

        Raises:
            ApiError: If API request fails
            ConnectionError: If connection fails
        """
        # Use retry mechanism for API calls that might return code 51203
        return await self._retry_on_specific_code(self._register_files_internal, file_attachments, sandbox_id, organization_code, task_id)

    async def _register_files_internal(self, file_attachments: List[Dict[str, Any]], sandbox_id: str, organization_code: str, task_id: str) -> Dict[str, Any]:
        """
        Internal method for registering files with Magic Service (without retry logic)
        """
        if not file_attachments:
            logger.info("No files to register, skipping registration")
            return {"total": 0, "success": 0, "skipped": 0}

        if not sandbox_id:
            raise ApiError("Sandbox ID is required for file registration")

        # Prepare request data
        request_data = {
            "attachments": file_attachments,
            "sandbox_id": sandbox_id
        }

        # Add optional parameters
        if organization_code:
            request_data["organization_code"] = organization_code

        if task_id:
            request_data["task_id"] = task_id
        file_registration_url = self.config.file_registration_url

        logger.info(f"file_registration_url: {file_registration_url}")
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "MagicServiceClient/1.0"
        }
        # 添加 Magic-Authorization 与 User-Authorization 请求头
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        try:
            session_to_use = self.session or aiohttp.ClientSession()
            should_close_session = self.session is None

            try:
                async with session_to_use.post(
                    file_registration_url,
                    json=request_data,
                    headers=headers
                ) as response:
                    response_text = await response.text()
                    logger.info(f"File registration API response status: {response.status}")
                    logger.debug(f"File registration API response: {response_text}")

                    if response.status == 200:
                        try:
                            result = json.loads(response_text)
                            if result.get("code") == 1000:
                                data = result.get("data", {})
                                logger.info(f"File registration success - Total: {data.get('total', 0)}, "
                                          f"Success: {data.get('success', 0)}, "
                                          f"Skipped: {data.get('skipped', 0)}")
                                return data
                            else:
                                error_code = result.get("code")
                                error_msg = result.get("message", "Unknown API error")
                                logger.warning(f"API returned error code {error_code}: {error_msg}")
                                api_error = ApiError(f"API business error: {error_msg}", response.status, result)
                                api_error.response_data = result  # Store response data for retry logic
                                raise api_error
                        except json.JSONDecodeError:
                            raise ApiError(f"Invalid JSON response: {response_text[:200]}...", response.status)
                    else:
                        raise ApiError(f"HTTP error: {response.status}", response.status, {"response": response_text})

            finally:
                if should_close_session:
                    await session_to_use.close()

        except aiohttp.ClientError as e:
            logger.error(f"Connection error during file registration: {e}")
            raise ConnectionError(f"Failed to connect to Magic Service: {e}")
        except Exception as e:
            logger.error(f"Unexpected error during file registration: {e}")
            logger.error(traceback.format_exc())
            raise ApiError(f"Unexpected error: {e}")

    async def health_check(self) -> bool:
        """
        Perform a health check against Magic Service

        Returns:
            bool: True if service is healthy, False otherwise
        """
        try:
            health_url = f"{self.config.api_base_url.rstrip('/')}/health"

            session_to_use = self.session or aiohttp.ClientSession()
            should_close_session = self.session is None

            try:
                async with session_to_use.get(health_url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status == 200:
                        logger.info("Magic Service health check passed")
                        return True
                    else:
                        logger.warning(f"Magic Service health check failed with status: {response.status}")
                        return False
            finally:
                if should_close_session:
                    await session_to_use.close()

        except Exception as e:
            logger.warning(f"Magic Service health check failed: {e}")
            return False

    async def generate_design_video(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Submit a design video generation task."""
        return await self._request_json(
            "POST",
            "/api/v1/design/generate-video",
            payload,
            operation_name="设计视频生成",
        )

    async def query_video_generation_result(
        self,
        project_id: str,
        video_id: str,
    ) -> Dict[str, Any]:
        """查询设计视频生成结果。"""
        return await self._request_json(
            "GET",
            "/api/v1/design/video-generation-result",
            operation_name="设计视频生成结果查询",
            params={"project_id": project_id, "video_id": video_id},
        )

    async def download_url_to_path(
        self,
        download_url: str,
        target_path: Path,
        interruption_event: Optional[asyncio.Event] = None,
    ) -> None:
        """把远程文件流式下载到指定本地路径。"""
        session_to_use = self.session or aiohttp.ClientSession()
        should_close_session = self.session is None
        try:
            async with session_to_use.get(
                download_url,
                timeout=aiohttp.ClientTimeout(total=900),
            ) as response:
                if response.status < 200 or response.status >= 300:
                    body = await response.text()
                    raise ApiError(
                        f"视频文件下载失败，HTTP {response.status}: {body[:200]}"
                    )
                async def chunks():
                    async for chunk in response.content.iter_chunked(1024 * 1024):
                        if interruption_event is not None and interruption_event.is_set():
                            raise asyncio.CancelledError
                        yield chunk

                await async_write_bytes_iter(target_path, chunks())
        except BaseException:
            await async_unlink(target_path)
            raise
        finally:
            if should_close_session:
                await session_to_use.close()

    async def estimate_design_video_points(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Estimate points for a design video generation task."""
        return await self._request_json(
            "POST",
            "/api/v1/design/estimate-video-points",
            payload,
            operation_name="设计视频积分预估",
        )

    async def ensure_project_directories(
        self,
        project_id: str,
        directory_parts: List[str],
    ) -> str:
        """Ensure a project directory hierarchy exists in the Magic Service file tree."""
        parent_id = ""
        for directory_name in directory_parts:
            result = await self._request_json(
                "POST",
                "/api/v1/super-agent/file",
                {
                    "project_id": project_id,
                    "parent_id": parent_id,
                    "file_name": directory_name,
                    "is_directory": True,
                    "ignore_duplicate": True,
                    "pre_file_id": -1,
                },
                operation_name="创建项目目录",
            )
            parent_id = str(result.get("file_id") or "")
            if not parent_id:
                raise ApiError(f"创建项目目录失败: {directory_name}")
        return parent_id

    async def get_slides_template_file_url(
        self,
        code: str,
        access_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Resolve a slides template code into its signed package URL."""
        normalized_code = code.strip() if isinstance(code, str) else ""
        if not normalized_code:
            raise ApiError("slides template code is required")

        escaped_code = quote(normalized_code, safe="")
        return await self._request_json(
            "GET",
            f"/api/v1/open-api/slides-templates/{escaped_code}/file-url",
            operation_name="幻灯片模板文件链接获取",
            params=self._filter_query_params(access_context),
        )

    async def get_slides_template_taxonomy(
        self,
        access_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Fetch enabled official slide template categories, groups, and tags."""
        return await self._request_json(
            "GET",
            "/api/v1/open-api/slides-templates/taxonomy",
            operation_name="幻灯片模板分类标签获取",
            params=self._filter_query_params(access_context),
        )

    async def get_persona_avatar_catalog(
        self,
        access_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Fetch the compact catalog of official persona avatars: {"items": [{"id", "tags"}]}."""
        return await self._request_json(
            "GET",
            "/api/v1/open-api/persona-avatars",
            operation_name="人设头像清单获取",
            params=self._filter_query_params(access_context),
        )

    async def get_persona_avatar_file_url(
        self,
        avatar_id: str,
        access_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Resolve one persona avatar into its signed download URL: {"id", "file_url", "expires_at"}."""
        normalized_id = avatar_id.strip() if isinstance(avatar_id, str) else ""
        if not normalized_id:
            raise ApiError("persona avatar id is required")
        return await self._request_json(
            "GET",
            f"/api/v1/open-api/persona-avatars/{quote(normalized_id, safe='')}/file-url",
            operation_name="人设头像文件链接获取",
            params=self._filter_query_params(access_context),
        )

    async def download_url_bytes(self, download_url: str, max_bytes: int) -> bytes:
        """把小文件下载到内存；超过 max_bytes 立即中止，不落盘。"""
        session_to_use = self.session or aiohttp.ClientSession()
        should_close_session = self.session is None
        try:
            async with session_to_use.get(download_url, timeout=aiohttp.ClientTimeout(total=60)) as response:
                if response.status < 200 or response.status >= 300:
                    raise ApiError(f"文件下载失败，HTTP {response.status}")
                chunks: list[bytes] = []
                total = 0
                async for chunk in response.content.iter_chunked(64 * 1024):
                    total += len(chunk)
                    if total > max_bytes:
                        raise ApiError(f"文件超过 {max_bytes} 字节上限")
                    chunks.append(chunk)
                return b"".join(chunks)
        finally:
            if should_close_session:
                await session_to_use.close()

    async def _request_json(
        self,
        method: str,
        path: str,
        payload: Optional[Dict[str, Any]] = None,
        operation_name: str = "Magic Service API",
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        url = f"{self._api_base_url()}{path}"
        headers = self._build_json_headers()
        session_to_use = self.session or aiohttp.ClientSession()
        should_close_session = self.session is None

        try:
            async with session_to_use.request(
                method,
                url,
                json=payload,
                headers=headers,
                params=params,
            ) as response:
                response_text = await response.text()
                try:
                    body = json.loads(response_text) if response_text else {}
                except json.JSONDecodeError as exc:
                    raise ApiError(f"Invalid JSON response: {response_text[:200]}...") from exc

                if response.status < 200 or response.status >= 300:
                    raise self._build_api_error(body, f"{operation_name} HTTP {response.status}")

                return self._extract_response_data(body, operation_name)
        except aiohttp.ClientError as exc:
            raise ConnectionError(f"Failed to connect to Magic Service: {exc}") from exc
        finally:
            if should_close_session:
                await session_to_use.close()

    def _api_base_url(self) -> str:
        base_url = self.config.api_base_url.rstrip("/")
        for suffix in ("/api/v1", "/v1"):
            if base_url.endswith(suffix):
                return base_url[: -len(suffix)]
        return base_url

    async def query_workspace_file(self, file_id: str) -> dict[str, object]:
        """按稳定 file_id 获取实际名称和父目录，供改名后复查身份。"""
        data = await self._request_json(
            "POST", f"/api/v1/open-api/magicfs/files/{quote(file_id, safe='')}/queries",
            operation_name="Query workspace file",
        )
        file = data.get("file")
        if not isinstance(file, dict):
            raise ApiError("Workspace file metadata is unavailable")
        return file

    async def check_workspace_file_write_access(self, file_id: str) -> None:
        """在文件操作前复用挂载端的 EDITOR 权限预检。"""
        await self._request_json(
            "POST", f"/api/v1/open-api/magicfs/files/{quote(file_id, safe='')}/check-access",
            operation_name="Check workspace file write access",
        )

    async def rename_workspace_file_checked(self, file_id: str, target_name: str) -> dict[str, object]:
        """复用手动重命名接口，同目录同名拒绝，不走 POSIX 覆盖语义。"""
        return await self._request_json(
            "POST", f"/api/v1/super-agent/file/{quote(file_id, safe='')}/rename",
            {"target_name": target_name}, operation_name="Rename workspace file",
        )

    def _build_json_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "MagicServiceClient/1.0",
        }
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        MetadataUtil.add_magic_and_user_authorization_headers(headers)
        headers.update(MetadataUtil.get_llm_request_headers())

        try:
            metadata = MetadataUtil.get_metadata()
        except Exception:
            metadata = {}
        organization_code = metadata.get("organization_code")
        if organization_code:
            headers["organization-code"] = str(organization_code)
        return headers

    @staticmethod
    def _filter_query_params(params: Optional[Dict[str, Any]]) -> Optional[Dict[str, str]]:
        if not params:
            return None

        filtered = {}
        for key, value in params.items():
            if value is None:
                continue
            normalized_value = str(value).strip()
            if normalized_value:
                filtered[key] = normalized_value
        return filtered or None

    def _extract_response_data(self, body: Dict[str, Any], operation_name: str) -> Dict[str, Any]:
        if "code" not in body:
            return body

        code = str(body.get("code") or "")
        if code in {"0", "1000"}:
            data = body.get("data")
            return data if isinstance(data, dict) else {}

        raise self._build_api_error(body, f"{operation_name}业务错误")

    @staticmethod
    def _build_api_error(body: Dict[str, Any], fallback_message: str) -> ApiError:
        error = body.get("error") if isinstance(body.get("error"), dict) else {}
        code = str(error.get("code") or body.get("code") or "")
        message = str(error.get("message") or body.get("message") or fallback_message)
        request_id = str(error.get("request_id") or body.get("request_id") or "")
        suffix_parts = []
        if code:
            suffix_parts.append(f"code={code}")
        if request_id:
            suffix_parts.append(f"request_id={request_id}")
        if suffix_parts:
            message = f"{message} ({', '.join(suffix_parts)})"
        api_error = ApiError(message, response_data=body)
        api_error.response_data = body
        return api_error

    async def get_file_tree(
        self,
        sandbox_id: str,
        topic_id: str,
        depth: Optional[int] = None
    ) -> File:
        """
        获取文件目录树

        Args:
            sandbox_id: Sandbox ID
            topic_id: Topic ID
            depth: 目录树深度,可选。控制返回的层级数量
                - None 或 -1: 返回完整的树结构(所有层级)
                - 1: 只返回根节点及其直接子节点
                - 2: 返回两层
                - n: 返回 n 层

        Returns:
            File: 结构化的文件树对象

        Raises:
            ApiError: If API request fails
            ConnectionError: If connection fails
        """
        # 构建 API URL
        api_url = f"{self.config.api_base_url.rstrip('/')}/api/v1/open-api/sandbox/file/tree"

        # 准备请求数据
        request_data = {
            "sandbox_id": sandbox_id,
            "topic_id": topic_id
        }
        if depth is not None:
            request_data["depth"] = depth

        # 准备请求头
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "MagicServiceClient/1.0"
        }

        # 添加 Magic-Authorization 与 User-Authorization 请求头
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        logger.info(f"========= Get File Tree Request =========")
        logger.info(f"Sandbox ID: {sandbox_id}")
        logger.info(f"Topic ID: {topic_id}")
        if depth is not None:
            logger.info(f"Depth: {depth}")
        logger.info(f"Request URL: {api_url}")
        logger.info(f"Request body: {json.dumps(request_data, ensure_ascii=False)}")
        logger.debug(f"Request headers: {json.dumps(sanitize_headers(headers), ensure_ascii=False, indent=2)}")
        logger.info(f"==========================================")

        try:
            session_to_use = self.session or aiohttp.ClientSession()
            should_close_session = self.session is None

            try:
                async with session_to_use.post(
                    api_url,
                    json=request_data,
                    headers=headers
                ) as response:
                    response_text = await response.text()
                    logger.info(f"File tree API response status: {response.status}")
                    logger.debug(f"File tree API response: {response_text}")

                    if response.status == 200:
                        try:
                            result = json.loads(response_text)
                            if result.get("code") == 1000:
                                data = result.get("data", {})
                                logger.info(f"File tree retrieved successfully")

                                # 使用 File 模型解析数据结构
                                try:
                                    file_tree = File(**data)
                                    logger.debug(f"File tree structure validated and parsed successfully")
                                    return file_tree
                                except Exception as e:
                                    logger.error(f"File tree data validation failed: {e}")
                                    raise ApiError(f"Failed to parse file tree structure: {e}")
                            else:
                                error_code = result.get("code")
                                error_msg = result.get("message", "Unknown API error")
                                logger.warning(f"API returned error code {error_code}: {error_msg}")
                                raise ApiError(f"API business error: {error_msg}", response.status, result)
                        except json.JSONDecodeError:
                            raise ApiError(f"Invalid JSON response: {response_text[:200]}...", response.status)
                    else:
                        raise ApiError(f"HTTP error: {response.status}", response.status, {"response": response_text})

            finally:
                if should_close_session:
                    await session_to_use.close()

        except aiohttp.ClientError as e:
            logger.error(f"Connection error during file tree retrieval: {e}")
            raise ConnectionError(f"Failed to connect to Magic Service: {e}")
        except Exception as e:
            logger.error(f"Unexpected error during file tree retrieval: {e}")
            logger.error(traceback.format_exc())
            raise ApiError(f"Unexpected error: {e}")

    async def get_sandbox_info(self, sandbox_id: str) -> SandboxInfoData:
        """Get status and Agent image information for the current sandbox."""
        if not sandbox_id:
            raise ApiError("sandbox_id is required")

        api_url = f"{self.config.api_base_url.rstrip('/')}/api/v1/open-api/sandbox/info"
        params = {"sandbox_id": sandbox_id}

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "MagicServiceClient/1.0"
        }
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        logger.info(f"Getting sandbox info, sandbox_id: {sandbox_id}")
        logger.info(f"Request URL: {api_url}")

        try:
            session_to_use = self.session or aiohttp.ClientSession()
            should_close_session = self.session is None

            try:
                async with session_to_use.get(
                    api_url,
                    params=params,
                    headers=headers
                ) as response:
                    response_text = await response.text()
                    logger.info(f"Sandbox info API response status: {response.status}")
                    logger.debug(f"Sandbox info API response: {response_text}")

                    if response.status == 200:
                        try:
                            result = json.loads(response_text)
                            data = self._process_api_response(result, f"获取沙箱信息({sandbox_id})")
                            return cast(SandboxInfoData, data)
                        except json.JSONDecodeError:
                            raise ApiError(f"Invalid JSON response: {response_text[:200]}...", response.status)
                    raise ApiError(f"HTTP error: {response.status}", response.status, {"response": response_text})
            finally:
                if should_close_session:
                    await session_to_use.close()

        except aiohttp.ClientError as e:
            logger.error(f"Connection error during sandbox info retrieval: {e}")
            raise ConnectionError(f"Failed to connect to Magic Service: {e}")
        except Exception as e:
            logger.error(f"Unexpected error during sandbox info retrieval: {e}")
            logger.error(traceback.format_exc())
            raise ApiError(f"Unexpected error: {e}")

    async def upgrade_sandbox(self, sandbox_id: str) -> SandboxRebuildData:
        """
        请求当前沙箱升级到最新 Agent 镜像并返回同步重建结果。

        Args:
            sandbox_id: 当前运行环境的真实沙箱 ID

        Returns:
            Dictionary containing the sandbox ID returned by the rebuild operation.

        Raises:
            ApiError: If API request fails
            ConnectionError: If connection fails
        """
        if not sandbox_id:
            raise ApiError("sandbox_id is required")

        api_url = f"{self.config.api_base_url.rstrip('/')}/api/v1/open-api/sandbox/upgrade"
        request_data = {"sandbox_id": sandbox_id}

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "MagicServiceClient/1.0"
        }
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        logger.info(f"Requesting sandbox upgrade, sandbox_id: {sandbox_id}")
        logger.info(f"Request URL: {api_url}")

        try:
            session_to_use = self.session or aiohttp.ClientSession()
            should_close_session = self.session is None

            try:
                async with session_to_use.put(
                    api_url,
                    json=request_data,
                    headers=headers,
                    timeout=_SANDBOX_REBUILD_TIMEOUT,
                ) as response:
                    response_text = await response.text()
                    logger.info(f"Upgrade sandbox API response status: {response.status}")
                    logger.debug(f"Upgrade sandbox API response: {response_text}")

                    if response.status == 200:
                        try:
                            result = json.loads(response_text)
                            data = self._process_api_response(result, f"升级沙箱({sandbox_id})")
                            return cast(SandboxRebuildData, data)
                        except json.JSONDecodeError:
                            raise ApiError(f"Invalid JSON response: {response_text[:200]}...", response.status)
                    else:
                        raise ApiError(f"HTTP error: {response.status}", response.status, {"response": response_text})
            finally:
                if should_close_session:
                    await session_to_use.close()

        except aiohttp.ClientError as e:
            logger.error(f"Connection error during sandbox upgrade: {e}")
            raise ConnectionError(f"Failed to connect to Magic Service: {e}")
        except Exception as e:
            logger.error(f"Unexpected error during sandbox upgrade: {e}")
            logger.error(traceback.format_exc())
            raise ApiError(f"Unexpected error: {e}")

    async def restart_sandbox(self, sandbox_id: str) -> SandboxRebuildData:
        """Restart the current sandbox and return the sandbox ID from the operation."""
        if not sandbox_id:
            raise ApiError("sandbox_id is required")

        api_url = f"{self.config.api_base_url.rstrip('/')}/api/v1/open-api/sandbox/restart"
        request_data = {"sandbox_id": sandbox_id}

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "MagicServiceClient/1.0"
        }
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        logger.info(f"Requesting sandbox restart, sandbox_id: {sandbox_id}")
        logger.info(f"Request URL: {api_url}")

        try:
            session_to_use = self.session or aiohttp.ClientSession()
            should_close_session = self.session is None

            try:
                async with session_to_use.put(
                    api_url,
                    json=request_data,
                    headers=headers,
                    timeout=_SANDBOX_REBUILD_TIMEOUT,
                ) as response:
                    response_text = await response.text()
                    logger.info(f"Restart sandbox API response status: {response.status}")
                    logger.debug(f"Restart sandbox API response: {response_text}")

                    if response.status == 200:
                        try:
                            result = json.loads(response_text)
                            data = self._process_api_response(result, f"重启沙箱({sandbox_id})")
                            return cast(SandboxRebuildData, data)
                        except json.JSONDecodeError:
                            raise ApiError(f"Invalid JSON response: {response_text[:200]}...", response.status)
                    raise ApiError(f"HTTP error: {response.status}", response.status, {"response": response_text})
            finally:
                if should_close_session:
                    await session_to_use.close()

        except aiohttp.ClientError as e:
            logger.error(f"Connection error during sandbox restart: {e}")
            raise ConnectionError(f"Failed to connect to Magic Service: {e}")
        except Exception as e:
            logger.error(f"Unexpected error during sandbox restart: {e}")
            logger.error(traceback.format_exc())
            raise ApiError(f"Unexpected error: {e}")

    async def check_sandbox_version(self, sandbox_id: str) -> SandboxVersionData:
        """
        检查沙箱镜像版本（当前版本与最新版本对比，是否需要升级）

        对应 Magic 开放接口：GET /api/v1/open-api/sandbox/version-check

        Args:
            sandbox_id: 当前运行环境的真实沙箱 ID

        Returns:
            包含 current_version、latest_version、needs_update 的字典

        Raises:
            ApiError: If API request fails
            ConnectionError: If connection fails
        """
        if not sandbox_id:
            raise ApiError("sandbox_id is required")

        api_url = f"{self.config.api_base_url.rstrip('/')}/api/v1/open-api/sandbox/version-check"
        params = {"sandbox_id": sandbox_id}

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "MagicServiceClient/1.0"
        }
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        logger.info(f"Checking sandbox version, sandbox_id: {sandbox_id}")
        logger.info(f"Request URL: {api_url}")

        try:
            session_to_use = self.session or aiohttp.ClientSession()
            should_close_session = self.session is None

            try:
                async with session_to_use.get(
                    api_url,
                    params=params,
                    headers=headers
                ) as response:
                    response_text = await response.text()
                    logger.info(f"Sandbox version-check API response status: {response.status}")
                    logger.debug(f"Sandbox version-check API response: {response_text}")

                    if response.status == 200:
                        try:
                            result = json.loads(response_text)
                            data = self._process_api_response(result, f"检查沙箱版本({sandbox_id})")
                            return cast(SandboxVersionData, data)
                        except json.JSONDecodeError:
                            raise ApiError(f"Invalid JSON response: {response_text[:200]}...", response.status)
                    else:
                        raise ApiError(f"HTTP error: {response.status}", response.status, {"response": response_text})
            finally:
                if should_close_session:
                    await session_to_use.close()

        except aiohttp.ClientError as e:
            logger.error(f"Connection error during sandbox version check: {e}")
            raise ConnectionError(f"Failed to connect to Magic Service: {e}")
        except Exception as e:
            logger.error(f"Unexpected error during sandbox version check: {e}")
            logger.error(traceback.format_exc())
            raise ApiError(f"Unexpected error: {e}")

    def _traverse_directory(self, path: str) -> List[str]:
        """
        Traverse directory recursively and collect all files and directories

        Args:
            path: Directory path to traverse

        Returns:
            List of relative paths (files and directories)
        """
        result = []
        path_obj = Path(path)

        # If path is relative, try to resolve it from project root
        if not path_obj.is_absolute():
            # Try to find project root using the config module's method
            try:
                from .config import MagicServiceConfigLoader
                project_root = MagicServiceConfigLoader._find_project_root(Path.cwd())
                if project_root:
                    absolute_path = project_root / path
                    if absolute_path.exists():
                        path_obj = absolute_path
                        logger.debug(f"Using absolute path from project root: {path_obj}")
            except Exception as e:
                logger.debug(f"Failed to find project root: {e}")

        if not path_obj.exists():
            logger.warning(f"Directory does not exist: {path}")
            return result

        if not path_obj.is_dir():
            logger.warning(f"Path is not a directory: {path}")
            return result

        try:
            # Walk through directory recursively using the resolved path
            for root, dirs, files in os.walk(str(path_obj)):
                # Skip .git directories and other common ignore patterns
                dirs[:] = [d for d in dirs if d not in ['.git', '__pycache__', '.pytest_cache', 'node_modules']]

                # Get relative path from the base directory
                rel_root = os.path.relpath(root, str(path_obj))

                # Add directories (except root directory)
                if rel_root != '.':
                    result.append(rel_root)

                # Add files (skip common temporary/cache files)
                for file in files:
                    # Skip common temporary and cache files
                    if file.startswith('.') and file.endswith(('.tmp', '.cache', '.log')):
                        continue
                    if file.endswith(('.pyc', '.pyo', '.pyd')):
                        continue

                    if rel_root == '.':
                        result.append(file)
                    else:
                        result.append(os.path.join(rel_root, file))

        except Exception as e:
            logger.error(f"Error traversing directory {path}: {e}")

        return result

    async def register_workspace_attachments(
        self,
        topic_id: str,
        commit_hash: str,
        sandbox_id: str,
        folder: str
    ) -> Dict[str, Any]:
        """
        Register workspace attachments with Magic Service

        Args:
            topic_id: Topic ID for the attachment
            commit_hash: Git commit hash
            sandbox_id: Sandbox ID
            folder: Directory folder to traverse and register

        Returns:
            Dict containing registration results

        Raises:
            ApiError: If API request fails
            ConnectionError: If connection fails
        """
        # Use retry mechanism for API calls that might return code 51203
        return await self._retry_on_specific_code(
            self._register_workspace_attachments_internal,
            topic_id, commit_hash, sandbox_id, folder
        )

    async def _register_workspace_attachments_internal(
        self,
        topic_id: str,
        commit_hash: str,
        sandbox_id: str,
        folder: str
    ) -> Dict[str, Any]:
        """
        Internal method for registering workspace attachments (without retry logic)
        """
        # Add 1-second delay before each request to avoid overwhelming the server
        logger.debug("Adding 1-second delay before workspace attachments request")
        await asyncio.sleep(0.5)

        # Traverse directory to get file and directory list
        dir_contents = self._traverse_directory(folder)
        if not dir_contents:
            logger.warning(f"No files found in directory: {folder}")
            return

        # Prepare request data
        request_data = {
            "topic_id": topic_id,
            "commit_hash": commit_hash,
            "sandbox_id": sandbox_id,
            "folder": folder,
            "dir": dir_contents
        }

        logger.info(f"request_data: {request_data}")

        # Construct API URL
        api_url = f"{self.config.api_base_url.rstrip('/')}/api/v1/super-agent/file/workspace-attachments"

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "MagicServiceClient/1.0"
        }
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        # 添加 Magic-Authorization 与 User-Authorization 请求头
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        logger.info(f"========= Workspace Attachments Registration =========")
        logger.info(f"Registering workspace attachments for folder: {folder}")
        logger.info(f"Topic ID: {topic_id}, Commit Hash: {commit_hash}")
        logger.info(f"Sandbox ID: {sandbox_id}")
        logger.info(f"Found {len(dir_contents)} items in directory")
        logger.info(f"Request URL: {api_url}")
        logger.info(f"Request headers: {json.dumps(sanitize_headers(headers), ensure_ascii=False, indent=2)}")
        logger.info(f"Request body: {json.dumps(request_data, ensure_ascii=False, indent=2)}")
        logger.info(f"====================================================")

        try:
            session_to_use = self.session or aiohttp.ClientSession()
            should_close_session = self.session is None

            try:
                async with session_to_use.post(
                    api_url,
                    json=request_data,
                    headers=headers
                ) as response:
                    response_text = await response.text()
                    logger.info(f"Workspace attachments API response status: {response.status}")
                    logger.debug(f"Workspace attachments API response: {response_text}")

                    if response.status == 200:
                        try:
                            result = json.loads(response_text)
                            if result.get("code") == 1000:
                                data = result.get("data", {})
                                logger.info(f"Workspace attachments registration success: {data}")
                                return data
                            else:
                                error_code = result.get("code")
                                error_msg = result.get("message", "Unknown API error")
                                logger.warning(f"API returned error code {error_code}: {error_msg}")
                                api_error = ApiError(f"API business error: {error_msg}", response.status, result)
                                api_error.response_data = result  # Store response data for retry logic
                                raise api_error
                        except json.JSONDecodeError:
                            raise ApiError(f"Invalid JSON response: {response_text[:200]}...", response.status)
                    else:
                        raise ApiError(f"HTTP error: {response.status}", response.status, {"response": response_text})

            finally:
                if should_close_session:
                    await session_to_use.close()

        except aiohttp.ClientError as e:
            logger.error(f"Connection error during workspace attachments registration: {e}")
            raise ConnectionError(f"Failed to connect to Magic Service: {e}")
        except Exception as e:
            logger.error(f"Unexpected error during workspace attachments registration: {e}")
            logger.error(traceback.format_exc())
            raise ApiError(f"Unexpected error: {e}")

    async def register_batch_workspace_attachments(
        self,
        commit_results: Dict[str, Any],
        sandbox_id: str,
        topic_id: str
    ) -> None:
        """
        Register workspace attachments for multiple directories based on commit results

        Args:
            commit_results: Dictionary containing Git commit results with commit hashes and directories
            sandbox_id: Sandbox ID from agent context
            topic_id: Topic ID from agent context metadata

        Raises:
            ApiError: If API request fails
            ConnectionError: If connection fails
        """
        if not sandbox_id:
            logger.warning("Sandbox ID not provided, skipping workspace attachments registration")
            return

        if not topic_id:
            logger.warning("Topic ID not provided, skipping workspace attachments registration")
            return

        # Register attachments for each successfully committed directory
        successful_directories = [
            (directory, result_info) for directory, result_info in commit_results.items()
            if isinstance(result_info, dict) and result_info.get("success")
        ]

        for index, (directory, result_info) in enumerate(successful_directories):
            commit_hash = result_info.get("commit_hash")
            if commit_hash:
                try:
                    logger.info(f"Registering workspace attachments for directory: {directory}")
                    await self.register_workspace_attachments(
                        topic_id=topic_id,
                        commit_hash=commit_hash,
                        sandbox_id=sandbox_id,
                        folder=directory
                    )
                    logger.info(f"Successfully registered workspace attachments for {directory}")

                    # Add additional delay between batch requests (except for the last one)
                    if index < len(successful_directories) - 1:
                        logger.debug(f"Adding additional 1-second delay between batch requests")
                        await asyncio.sleep(1)

                except Exception as e:
                    logger.error(f"Failed to register workspace attachments for {directory}: {e}")
            else:
                logger.warning(f"No commit hash available for directory {directory}")

        # Log skipped directories
        for directory, result_info in commit_results.items():
            if isinstance(result_info, dict) and not result_info.get("success"):
                logger.warning(f"Skipping failed commit directory registration: {directory}")

    @staticmethod
    async def register_workspace_attachments_from_agent_context(
        commit_results: Dict[str, Any],
        agent_context
    ) -> None:
        """
        Complete workflow for registering workspace attachments from agent context

        This is a high-level convenience method that handles the entire workflow:
        - Extract sandbox_id and topic_id from agent context
        - Load Magic Service configuration
        - Register workspace attachments for all successful commits
        - Handle all errors gracefully

        Args:
            commit_results: Dictionary containing Git commit results with commit hashes and directories
            agent_context: Agent context containing sandbox_id and topic_id

        Note:
            This method handles all errors internally and will not raise exceptions.
            All errors are logged appropriately.
        """
        try:
            # Import here to avoid circular imports
            from app.core.context.agent_context import AgentContext

            # Type check for agent_context
            if not isinstance(agent_context, AgentContext):
                logger.error("Invalid agent_context type provided")
                return

            # Extract required information from agent context
            sandbox_id = agent_context.get_sandbox_id()
            topic_id = agent_context.get_metadata().get("chat_topic_id")

            # Load Magic Service configuration
            try:
                config = MagicServiceConfigLoader.load_with_fallback()
                logger.info(f"Magic Service配置加载成功: {config.api_base_url}")
            except Exception as e:
                logger.error(f"Magic Service配置加载失败: {e}")
                logger.warning("跳过工作空间附件注册")
                return

            # Register workspace attachments using Magic Service client
            async with MagicServiceClient(config) as client:
                await client.register_batch_workspace_attachments(
                    commit_results=commit_results,
                    sandbox_id=sandbox_id,
                    topic_id=topic_id
                )

        except Exception as e:
            logger.error(f"工作空间附件注册过程中发生错误: {e}")

    async def send_file_notification(self, metadata: Dict[str, Any], notification_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send a file change notification to the Magic Service

        Args:
            metadata: Metadata from init client message configuration
            notification_data: File notification data including timestamp, operation, file_path, file_size

        Returns:
            Dict containing API response

        Raises:
            ApiError: If API request fails
            ConnectionError: If connection fails
        """
        # Use retry mechanism for API calls that might return code 51203
        return await self._retry_on_specific_code(
            self._send_file_notification_internal,
            metadata, notification_data
        )

    async def _send_file_notification_internal(self, metadata: Dict[str, Any], notification_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Internal method for sending file notifications (without retry logic)
        """
        # Construct API URL
        api_url = f"{self.config.api_base_url.rstrip('/')}/api/v1/super-agent/file/sandbox/notifications"

        # Prepare request data
        request_data = {
            "metadata": metadata,
            "data": notification_data
        }

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "MagicServiceClient/1.0"
        }

        # 添加 Magic-Authorization 与 User-Authorization 请求头
        MetadataUtil.add_magic_and_user_authorization_headers(headers)


        try:
            session_to_use = self.session or aiohttp.ClientSession()
            should_close_session = self.session is None

            try:
                async with session_to_use.post(
                    api_url,
                    json=request_data,
                    headers=headers
                ) as response:
                    response_text = await response.text()
                    logger.debug(f"File notification API response status: {response.status}")
                    logger.debug(f"File notification API response: {response_text}")

                    if response.status == 200:
                        try:
                            result = json.loads(response_text)
                            if result.get("code") == 1000:
                                data = result.get("data", {})
                                logger.debug(f"File notification sent successfully: {data}")
                                return result
                            else:
                                error_code = result.get("code")
                                error_msg = result.get("message", "Unknown API error")
                                logger.warning(f"API returned error code {error_code}: {error_msg}")
                                api_error = ApiError(f"API business error: {error_msg}", response.status, result)
                                api_error.response_data = result  # Store response data for retry logic
                                raise api_error
                        except json.JSONDecodeError:
                            raise ApiError(f"Invalid JSON response: {response_text[:200]}...", response.status)
                    else:
                        raise ApiError(f"HTTP error: {response.status}", response.status, {"response": response_text})

            finally:
                if should_close_session:
                    await session_to_use.close()

        except aiohttp.ClientError as e:
            logger.error(f"Connection error during file notification: {e}")
            raise ConnectionError(f"Failed to connect to Magic Service: {e}")
        except Exception as e:
            logger.error(f"Unexpected error during file notification: {e}")
            logger.error(traceback.format_exc())
            raise ApiError(f"Unexpected error: {e}")

    def _process_api_response(self, result: Dict[str, Any], operation_name: str) -> Dict[str, Any]:
        """
        处理标准API响应的通用方法

        Args:
            result: 解析后的JSON响应
            operation_name: 操作名称，用于日志

        Returns:
            Dict[str, Any]: 处理后的响应结果

        Raises:
            ApiError: API返回错误时抛出
        """
        if result.get("code") == 1000:
            data = result.get("data", {})
            logger.info(f"{operation_name}成功")
            return data
        else:
            error_code = result.get("code")
            error_msg = result.get("message", "Unknown API error")
            logger.warning(f"{operation_name}失败 - Code: {error_code}, Message: {error_msg}")
            api_error = ApiError(f"API business error: {error_msg}", 200, result)
            api_error.response_data = result
            raise api_error

    async def create_file_version(self, file_key: str, edit_type: int = FileEditType.AI) -> Dict[str, Any]:
        """
        创建单个文件版本信息

        Args:
            file_key: 需要创建版本的文件键
            edit_type: 编辑类型，FileEditType.MANUAL表示人工编辑，FileEditType.AI表示AI编辑，默认为AI编辑

        Returns:
            Dict containing API response result with success status

        Raises:
            ApiError: If API request fails
            ConnectionError: If connection fails
        """
        if not file_key:
            raise ApiError("file_key is required")

        if edit_type not in [FileEditType.MANUAL, FileEditType.AI]:
            raise ApiError(f"edit_type must be {FileEditType.MANUAL} (manual) or {FileEditType.AI} (AI)")

        url = f"{self.config.api_base_url.rstrip('/')}/open/internal-api/super-agent/file/versions"
        request_data = {"file_key": file_key, "edit_type": edit_type}

        request_trace = FileVersionRequestTrace()
        session_to_use = self.session or aiohttp.ClientSession(
            trace_configs=[create_file_version_trace_config()],
        )
        should_close_session = self.session is None

        try:
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "MagicServiceClient/1.0"
            }
            if self.config.api_key:
                headers["Authorization"] = f"Bearer {self.config.api_key}"
            # 添加 Magic-Authorization 与 User-Authorization 请求头
            MetadataUtil.add_magic_and_user_authorization_headers(headers)

            logger.info(
                f"创建文件版本: {file_key}, edit_type: {edit_type}, "
                f"diagnostic_id={request_trace.diagnostic_id}"
            )

            async with session_to_use.post(
                url, json=request_data, headers=headers, timeout=30,
                trace_request_ctx=request_trace,
            ) as response:
                request_trace.http_status = response.status
                request_trace.response_request_id = response.headers.get("X-Request-ID")
                request_trace.response_log_id = response.headers.get("X-Tt-Logid")
                request_trace.mark("response_headers_received", "reading_response_body")
                response_text = await response.text()
                request_trace.mark("response_body_received", "processing_response")
                logger.debug(f"File version API response status: {response.status}")
                logger.debug(f"File version API response: {response_text}")

                if response.status == 200:
                    try:
                        result = json.loads(response_text)
                        # 使用标准响应处理方法
                        data = self._process_api_response(result, f"创建文件版本({file_key})")
                        request_trace.mark("completed", "completed")
                        logger.info(f"文件版本请求完成: file_key={file_key}, trace={request_trace.summary()}")
                        return {"file_key": file_key, "success": True, "data": data}
                    except json.JSONDecodeError:
                        raise ApiError(f"Invalid JSON response: {response_text[:200]}...", response.status)
                    except ApiError:
                        # API 业务错误，重新抛出
                        raise
                else:
                    raise ApiError(f"HTTP error: {response.status}", response.status, {"response": response_text})
        except Exception as exc:
            logger.error(
                f"文件版本请求失败: file_key={file_key}, "
                f"error_type={type(exc).__name__}, error={exc!r}, trace={request_trace.summary()}\n"
                f"{traceback.format_exc()}"
            )
            raise
        finally:
            if should_close_session:
                await session_to_use.close()

    async def get_file_metadata(self, file_id: str) -> Dict[str, Any]:
        """读取 MagicFS 元数据；version 是保存 CAS 使用的 metadata_version。"""
        if not file_id.isdecimal() or int(file_id) <= 0:
            raise ApiError("A synchronized file ID is required")
        result = await self._request_user_file_json(
            "POST", f"/api/v1/open-api/magicfs/files/{file_id}/queries", {}
        )
        metadata = result.get("file")
        if not isinstance(metadata, dict):
            raise ApiError("The file service did not return file metadata")
        return metadata

    async def save_file_content(
        self, file_id: str, content: str, expected_revision: int
    ) -> Dict[str, Any]:
        """复用文件锁及编辑权限校验；不重试有副作用的请求。"""
        if not file_id.isdecimal() or int(file_id) <= 0:
            raise ApiError("A synchronized file ID is required")
        if type(expected_revision) is not int or expected_revision < 0:
            raise ApiError("A metadata revision is required for saving")
        return await self._request_user_file_json(
            "POST", "/api/v1/super-agent/file/save",
            [{"file_id": file_id, "content": content, "expected_revision": expected_revision}],
        )

    async def _request_user_file_json(self, method: str, path: str, payload: Any) -> Dict[str, Any]:
        # 凭据读取使用线程封装文件 I/O。WebUserGuard 优先读取 User-Authorization，
        # 不能把 API key 或 Magic-Authorization 当作文件所有者的授权。
        headers = await asyncio.to_thread(self._build_json_headers)
        if not headers.get("User-Authorization"):
            raise ApiError("User authorization is unavailable; no file write was attempted", status_code=401)
        session = self.session or aiohttp.ClientSession()
        try:
            async with session.request(
                method, f"{self._api_base_url()}{path}", json=payload,
                headers=headers, timeout=aiohttp.ClientTimeout(total=20),
            ) as response:
                body = await response.json(content_type=None)
                if not isinstance(body, dict):
                    raise ApiError("Invalid file service response")
                if response.status < 200 or response.status >= 300:
                    raise ApiError("File service request rejected", response.status, body)
                return self._extract_response_data(body, "File service")
        finally:
            if self.session is None:
                await session.close()

    async def get_file_latest_version(self, file_id: str) -> Dict[str, Any]:
        """
        Get the latest content version number for a file.

        Args:
            file_id: The file ID (magic_super_agent_task_files.file_id), must be a positive integer string.

        Returns:
            Dict with keys: file_id (str), latest_version (int)

        Raises:
            ApiError: If the API request fails or returns a business error
            ConnectionError: If connection fails
        """
        if not file_id:
            raise ApiError("file_id is required")

        url = f"{self.config.api_base_url.rstrip('/')}/open/internal-api/super-agent/file/{file_id}/versions/latest"

        session_to_use = self.session or aiohttp.ClientSession()
        should_close_session = self.session is None

        try:
            headers = {
                "User-Agent": "MagicServiceClient/1.0"
            }
            if self.config.api_key:
                headers["Authorization"] = f"Bearer {self.config.api_key}"
            MetadataUtil.add_magic_and_user_authorization_headers(headers)

            logger.info(f"Getting latest file version: file_id={file_id}")

            async with session_to_use.get(url, headers=headers, timeout=30) as response:
                response_text = await response.text()
                logger.debug(f"Get latest file version API response status: {response.status}")
                logger.debug(f"Get latest file version API response: {response_text}")

                if response.status == 200:
                    try:
                        result = json.loads(response_text)
                        data = self._process_api_response(result, f"获取文件最新版本({file_id})")
                        return data
                    except json.JSONDecodeError:
                        raise ApiError(f"Invalid JSON response: {response_text[:200]}...", response.status)
                    except ApiError:
                        raise
                else:
                    raise ApiError(f"HTTP error: {response.status}", response.status, {"response": response_text})
        finally:
            if should_close_session:
                await session_to_use.close()

    async def create_video(
        self,
        payload: Dict[str, Any],
        request_id: str = "",
    ) -> Dict[str, Any]:
        """Create a regular video generation task."""
        return await self._request_video_json(
            "POST",
            "/videos",
            payload,
            request_id=request_id,
        )

    async def estimate_video_points(
        self,
        payload: Dict[str, Any],
        request_id: str = "",
    ) -> Dict[str, Any]:
        """Estimate points for a regular video request without creating it."""
        return await self._request_video_json(
            "POST",
            "/videos/estimate-points",
            payload,
            request_id=request_id,
        )

    async def get_video_operation(
        self,
        operation_id: str,
        request_id: str = "",
    ) -> Dict[str, Any]:
        """Get a regular video generation operation."""
        normalized_id = (
            operation_id.strip() if isinstance(operation_id, str) else ""
        )
        if not normalized_id:
            raise ValueError("operation_id is required")
        escaped_id = quote(normalized_id, safe="")
        return await self._request_video_json(
            "GET",
            f"/videos/{escaped_id}",
            request_id=request_id,
        )

    async def _request_video_json(
        self,
        method: str,
        path: str,
        payload: Optional[Dict[str, Any]] = None,
        request_id: str = "",
    ) -> Dict[str, Any]:
        """Request a regular video endpoint and preserve the raw operation JSON."""
        url = f"{self._video_api_base_url()}{path}"
        headers = self._build_json_headers()
        if request_id:
            headers["request-id"] = request_id
        session_to_use = self.session or aiohttp.ClientSession()
        should_close_session = self.session is None

        try:
            async with session_to_use.request(
                method,
                url,
                json=payload,
                headers=headers,
                timeout=600,
            ) as response:
                response_text = await response.text()
                content_type = response.headers.get("Content-Type", "")
                context = self._video_response_context(
                    method,
                    path,
                    response.status,
                    content_type,
                    response_text,
                )
                if response.status < 200 or response.status >= 300:
                    body = self._parse_json_object(response_text)
                    message = self._video_error_message(body)
                    suffix = f"; service error: {message}" if message else ""
                    raise ApiError(
                        f"Video API request failed: HTTP {response.status}; "
                        f"{context}{suffix}",
                        status_code=response.status,
                        response_data=body or {"response": response_text},
                    )
                if not response_text.strip():
                    raise ApiError(
                        f"Video API returned an empty response; {context}",
                        status_code=response.status,
                        response_data={"response": response_text},
                    )
                try:
                    body = json.loads(response_text)
                except json.JSONDecodeError as exc:
                    raise ApiError(
                        f"Video API returned invalid JSON; {context}",
                        status_code=response.status,
                        response_data={"response": response_text},
                        cause=exc,
                    ) from exc
                if not isinstance(body, dict):
                    raise ApiError(
                        f"Video API response must be a JSON object; {context}",
                        status_code=response.status,
                        response_data={"response": body},
                    )
                return body
        except aiohttp.ClientError as exc:
            raise ConnectionError(
                f"Failed to connect to Magic Service: {exc}",
                cause=exc,
            ) from exc
        finally:
            if should_close_session:
                await session_to_use.close()

    def _video_api_base_url(self) -> str:
        """Build the versioned base URL for regular video endpoints."""
        parsed = urlparse(self.config.api_base_url.strip().rstrip("/"))
        path = re.sub(r"/v\d+$", "", parsed.path.rstrip("/"))
        return parsed._replace(path=f"{path}/v1").geturl().rstrip("/")

    @staticmethod
    def _parse_json_object(response_text: str) -> Optional[Dict[str, Any]]:
        """Parse a JSON object response when possible."""
        if not response_text.strip():
            return None
        try:
            body = json.loads(response_text)
        except json.JSONDecodeError:
            return None
        return body if isinstance(body, dict) else None

    @staticmethod
    def _video_error_message(body: Optional[Dict[str, Any]]) -> str:
        """Extract a readable error message from a video response."""
        if not body:
            return ""
        error = body.get("error")
        if isinstance(error, dict):
            return str(error.get("message") or error.get("detail") or "")
        return str(error or body.get("message") or "")

    @staticmethod
    def _video_response_context(
        method: str,
        path: str,
        status: int,
        content_type: str,
        body: str,
    ) -> str:
        """Summarize a video response for error diagnostics."""
        summary = " ".join(body.split())[:300] or "<empty>"
        return (
            f"method={method} path={path} status={status} "
            f"content_type={content_type or '<missing>'} body={summary!r}"
        )
