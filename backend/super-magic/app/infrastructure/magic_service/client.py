"""
Magic Service Client Module

Handles Magic Service API interactions including file registration.
"""

import json
import os
import traceback
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional

import aiohttp
from agentlang.logger import get_logger
from agentlang.config.config import config
from agentlang.utils.metadata import MetadataUtil
from app.core.entity.file import File

from app.utils.credential_utils import sanitize_headers

from .config import MagicServiceConfig, MagicServiceConfigLoader
from .constants import FileEditType
from .exceptions import ApiError, ConnectionError

logger = get_logger(__name__)


class MagicServiceClient:
    """Client for interacting with Magic Service APIs"""

    def __init__(self, config: MagicServiceConfig):
        """
        Initialize Magic Service client

        Args:
            config: Magic Service configuration
        """
        self.config = config
        self.session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession()
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
                    logger.info(f"File notification API response status: {response.status}")
                    logger.debug(f"File notification API response: {response_text}")

                    if response.status == 200:
                        try:
                            result = json.loads(response_text)
                            if result.get("code") == 1000:
                                data = result.get("data", {})
                                logger.info(f"File notification sent successfully: {data}")
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

    def _get_memory_api_token(self, token: str = None) -> Optional[str]:
        """
        获取记忆API的认证token

        Args:
            token: 可选的外部提供token

        Returns:
            Optional[str]: 认证token，如果获取失败返回None
        """
        if token:
            logger.info(f"使用外部提供的token: {token[:3]}****")
            return token

        try:
            config_file_path = ".credentials/init_client_message.json"
            logger.info(f"开始从配置文件加载token: {config_file_path}")

            # 添加路径检查
            from pathlib import Path
            current_dir = Path.cwd()
            config_path_obj = Path(config_file_path)

            config = MagicServiceConfigLoader.load_config_data(config_file_path)
            logger.info(f"✅ 配置文件加载成功，包含键: {list(config.keys())}")

            subscription_config = config.get("message_subscription_config", {})

            subscription_headers = subscription_config.get("headers", {})
            if "token" in subscription_headers:
                token_value = subscription_headers["token"]
                logger.info(f"从配置文件加载token成功，token前3位: {token_value[:3] if token_value else 'None'}****")
                return token_value
            else:
                logger.warning("配置文件中的 headers 不包含 token 字段")

        except Exception as e:
            logger.error(f"从配置文件加载token失败: {e}")
            import traceback
            logger.error(f"详细错误信息: {traceback.format_exc()}")

        logger.warning("最终未能获取到任何token")
        return None

    def _build_memory_api_headers(self, token: str = None) -> Dict[str, str]:
        """
        构建记忆API的请求头

        Args:
            token: 可选的认证token

        Returns:
            Dict[str, str]: 请求头字典
        """
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "MagicServiceClient/1.0"
        }

        api_token = self._get_memory_api_token(token)
        if api_token:
            headers["token"] = api_token
            logger.info(f"✅ 成功添加token到请求头，token前8位: {api_token[:8]}****")
        else:
            logger.warning("❌ 未能获取到token，请求头中不包含认证信息")

        # 添加 Magic-Authorization 与 User-Authorization 请求头
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        return headers

    async def _execute_memory_api_request(
        self,
        method: str,
        url: str,
        headers: Dict[str, str],
        request_data: Optional[Dict[str, Any]] = None,
        operation_name: str = "记忆操作"
    ) -> Dict[str, Any]:
        """
        执行记忆API请求的通用方法

        Args:
            method: HTTP方法 (GET, POST, PUT, DELETE)
            url: 请求URL
            headers: 请求头
            request_data: 请求数据 (可选)
            operation_name: 操作名称，用于日志

        Returns:
            Dict[str, Any]: API响应结果

        Raises:
            ApiError: API请求失败
            ConnectionError: 连接失败
        """
        logger.info(f"========= {operation_name} Request =========")
        logger.info(f"Request URL: {url}")
        # 显示请求头，特别注意 token 字段
        if "token" in headers:
            logger.info(f"✅ 请求头包含token: {headers['token'][:8]}****")
        else:
            logger.warning("❌ 请求头不包含token字段")
        logger.info(f"Request headers: {json.dumps(sanitize_headers(headers), ensure_ascii=False, indent=2)}")
        if request_data:
            logger.info(f"Request body: {json.dumps(request_data, ensure_ascii=False, indent=2)}")
        logger.info(f"==========================================")

        try:
            session_to_use = self.session or aiohttp.ClientSession()
            should_close_session = self.session is None

            try:
                # 根据HTTP方法选择合适的请求方式
                if method.upper() == "POST":
                    async with session_to_use.post(url, json=request_data, headers=headers) as response:
                        return await self._process_memory_api_response(response, operation_name)
                elif method.upper() == "PUT":
                    async with session_to_use.put(url, json=request_data, headers=headers) as response:
                        return await self._process_memory_api_response(response, operation_name)
                elif method.upper() == "DELETE":
                    async with session_to_use.delete(url, json=request_data, headers=headers) as response:
                        return await self._process_memory_api_response(response, operation_name)
                else:
                    raise ApiError(f"不支持的HTTP方法: {method}")

            finally:
                if should_close_session:
                    await session_to_use.close()

        except aiohttp.ClientError as e:
            logger.error(f"{operation_name}连接错误: {e}")
            raise ConnectionError(f"Failed to connect to Magic Service: {e}")
        except Exception as e:
            logger.error(f"{operation_name}意外错误: {e}")
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

        session_to_use = self.session or aiohttp.ClientSession()
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

            logger.info(f"创建文件版本: {file_key}, edit_type: {edit_type}")

            async with session_to_use.post(url, json=request_data, headers=headers, timeout=30) as response:
                response_text = await response.text()
                logger.debug(f"File version API response status: {response.status}")
                logger.debug(f"File version API response: {response_text}")

                if response.status == 200:
                    try:
                        result = json.loads(response_text)
                        # 使用标准响应处理方法
                        data = self._process_api_response(result, f"创建文件版本({file_key})")
                        return {"file_key": file_key, "success": True, "data": data}
                    except json.JSONDecodeError:
                        raise ApiError(f"Invalid JSON response: {response_text[:200]}...", response.status)
                    except ApiError:
                        # API 业务错误，重新抛出
                        raise
                else:
                    raise ApiError(f"HTTP error: {response.status}", response.status, {"response": response_text})
        finally:
            if should_close_session:
                await session_to_use.close()

    async def _process_memory_api_response(self, response, operation_name: str) -> Dict[str, Any]:
        """
        处理记忆API响应的通用方法

        Args:
            response: HTTP响应对象
            operation_name: 操作名称，用于日志

        Returns:
            Dict[str, Any]: 处理后的响应结果

        Raises:
            ApiError: API返回错误时抛出
        """
        response_text = await response.text()
        logger.info(f"{operation_name} API response status: {response.status}")
        logger.debug(f"{operation_name} API response: {response_text}")

        if response.status == 200:
            try:
                result = json.loads(response_text)

                # 检查标准的API响应格式 {code: 1000, message: "ok", data: {...}}
                if result.get("code") == 1000:
                    data = result.get("data", {})
                    logger.info(f"{operation_name}成功")

                    # 记录Memory ID（如果存在）
                    if data.get("memory_id"):
                        logger.info(f"Memory ID: {data.get('memory_id')}")

                    # 直接返回data部分的内容
                    return data

                else:
                    # API返回了错误
                    error_code = result.get("code", "unknown")
                    error_msg = result.get("message", "Unknown API error")
                    logger.warning(f"API返回错误 - Code: {error_code}, Message: {error_msg}")
                    api_error = ApiError(f"API business error: {error_msg}", response.status, result)
                    api_error.response_data = result
                    raise api_error

            except json.JSONDecodeError:
                raise ApiError(f"Invalid JSON response: {response_text[:200]}...", response.status)
        else:
            raise ApiError(f"HTTP error: {response.status}", response.status, {"response": response_text})

    def _extract_project_id_from_metadata(self, metadata: Dict[str, Any]) -> Optional[str]:
        """
        从 metadata 中提取项目ID

        Args:
            metadata: 元数据字典

        Returns:
            Optional[str]: 项目ID，如果不存在则返回None
        """
        if not isinstance(metadata, dict):
            return None

        # 只从 project_id 字段获取
        project_id = metadata.get("project_id")
        if isinstance(project_id, str) and project_id.strip():
            return project_id.strip()

        return None

    async def create_memory(self, memory: str, tags: List[str], explanation: str, requires_confirmation: bool, metadata: Dict[str, Any], memory_type: str = "user", token: str = None) -> Dict[str, Any]:
        """
        Create a new memory

        Args:
            memory: The main content of the memory
            tags: Array of tags related to the memory
            explanation: Explanation of why this memory is worth recording
            requires_confirmation: Whether this memory requires user confirmation
            metadata: Message metadata object containing user_id, organization_code, etc.
            memory_type: Memory type - "user" for user memory (cross-project), "project" for project memory (project-scoped)
            token: Authentication token (optional, will be loaded from config if not provided)

        Returns:
            Dict containing creation results with memory_id

        Raises:
            ApiError: If API request fails
            ConnectionError: If connection fails
        """
        # Use retry mechanism for API calls that might return code 51203
        return await self._retry_on_specific_code(self._create_memory_internal, memory, tags, explanation, requires_confirmation, metadata, memory_type, token)

    async def _create_memory_internal(self, memory: str, tags: List[str], explanation: str, requires_confirmation: bool, metadata: Dict[str, Any], memory_type: str = "user", token: str = None) -> Dict[str, Any]:
        """
        Internal method for creating memory (without retry logic)
        """
        # 参数验证
        if not memory:
            raise ApiError("Memory content is required")
        if not explanation:
            raise ApiError("Memory explanation is required")
        if not metadata:
            raise ApiError("Metadata is required")

        # 转换新参数为后端API期望的格式
        immediate_effect = not requires_confirmation  # requires_confirmation为true时，immediate_effect为false
        project_related = memory_type == "project"   # memory_type为"project"时，project_related为true

        # 准备请求数据（使用后端API期望的参数名）
        request_data = {
            "memory": memory,
            "tags": tags or [],
            "explanation": explanation,
            "immediate_effect": immediate_effect,
            "metadata": metadata
        }

        # 可选参数：项目相关性
        # 始终包含该字段
        request_data["project_related"] = project_related

        # 当与项目相关时，尝试从 metadata 中提取 project_id 并附加
        if project_related:
            project_id = self._extract_project_id_from_metadata(metadata)
            if project_id:
                request_data["project_id"] = project_id
                logger.info(f"Detected memory_type='project', attached project_id: {project_id}")
            else:
                logger.warning("memory_type 为 'project'，但未能从 metadata 提取到 project_id")

        # 构建API URL和请求头
        api_url = f"{self.config.api_base_url.rstrip('/')}/api/v1/super-agent/memories"
        headers = self._build_memory_api_headers(token)

        # 添加详细日志
        logger.info(f"Creating memory with content length: {len(memory)}")
        logger.info(f"Tags: {tags}")
        logger.info(f"Requires confirmation: {requires_confirmation} -> Immediate effect: {immediate_effect}")
        logger.info(f"Memory type: {memory_type} -> Project related: {project_related}")
        logger.info(f"Explanation: {explanation[:100]}{'...' if len(explanation) > 100 else ''}")

        # 执行API请求
        return await self._execute_memory_api_request("POST", api_url, headers, request_data, "创建记忆")

    async def update_memory(self, memory_id: str, memory: str, tags: List[str], explanation: str, metadata: Dict[str, Any], memory_type: str = "user", token: str = None) -> Dict[str, Any]:
        """
        Update an existing memory

        Args:
            memory_id: The unique identifier of the memory to update
            memory: The new memory content
            tags: Updated array of tags
            explanation: Explanation of why this memory is being updated
            metadata: Message metadata object containing user_id, organization_code, etc.
            memory_type: Memory type. "user" for user memories (cross-project), "project" for project memories (current project only). Default: "user"
            token: Authentication token (optional, will be loaded from config if not provided)

        Returns:
            Dict containing update results

        Raises:
            ApiError: If API request fails
            ConnectionError: If connection fails
        """
        # Use retry mechanism for API calls that might return code 51203
        return await self._retry_on_specific_code(self._update_memory_internal, memory_id, memory, tags, explanation, metadata, memory_type, token)

    async def _update_memory_internal(self, memory_id: str, memory: str, tags: List[str], explanation: str, metadata: Dict[str, Any], memory_type: str = "user", token: str = None) -> Dict[str, Any]:
        """
        Internal method for updating memory (without retry logic)
        """
        # 参数验证
        if not memory_id:
            raise ApiError("Memory ID is required for updating")
        if not memory:
            raise ApiError("Memory content is required")
        if not explanation:
            raise ApiError("Memory explanation is required")
        if not metadata:
            raise ApiError("Metadata is required")

        # 转换 memory_type 为后端API期望的格式（与 create_memory 保持一致）
        project_related = memory_type == "project"   # memory_type为"project"时，project_related为true

        # 准备请求数据
        request_data = {
            "memory": memory,
            "tags": tags or [],
            "explanation": explanation,
            "metadata": metadata,
            "project_related": project_related  # 添加项目相关性字段
        }

        # 当与项目相关时，尝试从 metadata 中提取 project_id 并附加（与 create_memory 保持一致）
        if project_related:
            project_id = metadata.get("project_id")
            if project_id:
                request_data["project_id"] = project_id
                logger.info(f"Adding project_id to update request: {project_id}")
            else:
                logger.warning("memory_type 为 'project'，但未能从 metadata 提取到 project_id")

        # 构建API URL和请求头
        api_url = f"{self.config.api_base_url.rstrip('/')}/api/v1/super-agent/memories/{memory_id}"
        headers = self._build_memory_api_headers(token)

        # 添加详细日志
        logger.info(f"Updating memory ID: {memory_id}")
        logger.info(f"New content length: {len(memory)}")
        logger.info(f"New tags: {tags}")
        logger.info(f"Memory type: {memory_type} -> Project related: {project_related}")
        logger.info(f"Update explanation: {explanation[:100]}{'...' if len(explanation) > 100 else ''}")

        # 执行API请求
        return await self._execute_memory_api_request("PUT", api_url, headers, request_data, "更新记忆")

    async def delete_memory(self, memory_id: str, metadata: Dict[str, Any], token: str = None) -> Dict[str, Any]:
        """
        Delete a memory

        Args:
            memory_id: The unique identifier of the memory to delete
            metadata: Message metadata object containing user_id, organization_code, etc.
            token: Authentication token (optional, will be loaded from config if not provided)

        Returns:
            Dict containing deletion results

        Raises:
            ApiError: If API request fails
            ConnectionError: If connection fails
        """
        # Use retry mechanism for API calls that might return code 51203
        return await self._retry_on_specific_code(self._delete_memory_internal, memory_id, metadata, token)

    async def _delete_memory_internal(self, memory_id: str, metadata: Dict[str, Any], token: str = None) -> Dict[str, Any]:
        """
        Internal method for deleting memory (without retry logic)
        """
        # 参数验证
        if not memory_id:
            raise ApiError("Memory ID is required for deletion")
        if not metadata:
            raise ApiError("Metadata is required")

        # 构建API URL和请求头
        api_url = f"{self.config.api_base_url.rstrip('/')}/api/v1/super-agent/memories/{memory_id}"
        headers = self._build_memory_api_headers(token)

        # 准备请求数据 (删除操作需要在请求体中传递metadata)
        request_data = {
            "metadata": metadata
        }

        # 添加详细日志
        logger.info(f"Deleting memory ID: {memory_id}")

        # 执行API请求
        return await self._execute_memory_api_request("DELETE", api_url, headers, request_data, "删除记忆")
