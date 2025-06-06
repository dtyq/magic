"""
沙箱服务核心逻辑
"""
import asyncio
import json
import logging
import time
import uuid
import os
from typing import Dict, List, Optional, Tuple, cast

import docker
import websockets
import aiohttp
from docker.errors import DockerException, ImageNotFound
from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from websockets.legacy.client import WebSocketClientProtocol
from dotenv import dotenv_values

from app.config import (
    SANDBOX_LABEL,
    AGENT_LABEL_PREFIX,
    QDRANT_LABEL,
    QDRANT_LABEL_PREFIX,
    WS_MESSAGE_TYPE_ERROR,
    settings
)
from app.config.constants import AGENT_LABEL
from app.models.sandbox import ContainerInfo, SandboxInfo
from app.utils.exceptions import (
    ContainerOperationError,
    SandboxNotFoundError,
    handle_exceptions,
    async_handle_exceptions
)

logger = logging.getLogger("sandbox_gateway")


class SandboxService:
    """沙箱服务，负责管理Docker容器和WebSocket通信"""

    def __init__(self):
        """初始化沙箱服务"""
        try:
            self.docker_client = docker.from_env()
            self.image_name = settings.super_magic_image_name
            self.qdrant_image_name = settings.qdrant_image_name
            self.running_container_expire_time = settings.running_container_expire_time
            self.exited_container_expire_time = settings.exited_container_expire_time
            self.container_ws_port = settings.container_ws_port
            self.qdrant_port = settings.qdrant_port
            self.qdrant_grpc_port = settings.qdrant_grpc_port
            # 获取网络配置，默认使用'bridge'
            self.network_name = os.environ.get('SANDBOX_NETWORK', 'bridge')
            logger.info(
                f"Docker客户端初始化成功，使用镜像: {self.image_name}, "
                f"运行中容器超时时间: {self.running_container_expire_time}秒, "
                f"已退出容器过期时间: {self.exited_container_expire_time}秒, "
                f"网络: {self.network_name}, "
                f"Qdrant镜像: {self.qdrant_image_name}"
            )
        except Exception as e:
            logger.error(f"Docker客户端初始化失败: {e}")
            raise

    def _get_agent_container_by_sandbox_id(self, sandbox_id: str) -> Optional[docker.models.containers.Container]:
        """
        通过沙箱ID获取对应的容器

        Args:
            sandbox_id: 沙箱ID

        Returns:
            Container: 容器对象，如果未找到则返回None
        """
        try:
            # 通过标签查找容器
            containers = self.docker_client.containers.list(
                all=True,
                filters={"label": f"{AGENT_LABEL}={sandbox_id}"}
            )
            return containers[0] if containers else None
        except Exception as e:
            logger.error(f"查询容器时出错: {e}")
            return None

    def _get_qdrant_container_by_sandbox_id(self, sandbox_id: str) -> Optional[docker.models.containers.Container]:
        """
        通过Qdrant ID获取对应的容器

        Args:
            qdrant_id: Qdrant ID

        Returns:
            Container: 容器对象，如果未找到则返回None
        """
        try:
            # 通过标签查找容器
            containers = self.docker_client.containers.list(
                all=True,
                filters={"label": f"{QDRANT_LABEL}={sandbox_id}"}
            )
            return containers[0] if containers else None
        except Exception as e:
            logger.error(f"查询Qdrant容器时出错: {e}")
            return None

    def _get_container_info(self, container: docker.models.containers.Container) -> ContainerInfo:
        """
        获取容器的详细信息

        Args:
            container: Docker容器对象

        Returns:
            ContainerInfo: 容器信息
        """
        container.reload()

        # 获取容器信息和网络设置
        network_settings = container.attrs['NetworkSettings']
        networks_data = network_settings['Networks']

        # 获取IP地址
        container_ip = None
        for net_name, net_config in networks_data.items():
            container_ip = net_config['IPAddress']
            if container_ip:
                break

        # 获取创建时间
        created_at = time.mktime(time.strptime(
            container.attrs['Created'].split('.')[0],
            '%Y-%m-%dT%H:%M:%S'
        ))

        # 将UTC时间转换为本地时间
        created_at = time.time() - (time.mktime(time.gmtime()) - created_at)

        # 获取状态
        status = container.status

        # 获取容器启动时间
        started_at = None
        if 'State' in container.attrs and 'StartedAt' in container.attrs['State']:
            started_at_str = container.attrs['State']['StartedAt'].split('.')[0]
            # 检查是否是"0001-01-01T00:00:00Z"（表示容器未启动）
            if started_at_str != "0001-01-01T00:00:00":
                try:
                    # 将字符串时间转换为时间戳
                    started_at_time = time.mktime(time.strptime(
                        started_at_str,
                        '%Y-%m-%dT%H:%M:%S'
                    ))
                    # 将UTC时间转换为本地时间
                    started_at = time.time() - (time.mktime(time.gmtime()) - started_at_time)
                    logger.debug(f"容器 {container.name} 启动时间: {started_at}")
                except Exception as e:
                    logger.error(f"解析容器启动时间出错: {e}, 原始值: {container.attrs['State']['StartedAt']}")

        # 获取退出时间（如果容器已退出）
        exited_at = None
        if status == "exited" and 'State' in container.attrs and 'FinishedAt' in container.attrs['State']:
            finished_at_str = container.attrs['State']['FinishedAt'].split('.')[0]
            # 检查是否是"0001-01-01T00:00:00Z"（表示容器未结束）
            if finished_at_str != "0001-01-01T00:00:00":
                try:
                    # 将字符串时间转换为时间戳
                    finished_at = time.mktime(time.strptime(
                        finished_at_str,
                        '%Y-%m-%dT%H:%M:%S'
                    ))
                    # 将UTC时间转换为本地时间
                    exited_at = time.time() - (time.mktime(time.gmtime()) - finished_at)
                    logger.debug(f"容器 {container.name} 退出时间: {exited_at}")
                except Exception as e:
                    logger.error(f"解析容器退出时间出错: {e}, 原始值: {container.attrs['State']['FinishedAt']}")

        return ContainerInfo(
            id=container.id,
            ip=container_ip,
            ws_port=self.container_ws_port,
            created_at=created_at,
            started_at=started_at,
            status=status,
            exited_at=exited_at
        )

    def _get_container_logs(self, container: docker.models.containers.Container, tail: int = 100) -> str:
        """
        获取容器的日志

        Args:
            container: Docker容器对象
            tail: 返回的日志行数，默认为100行

        Returns:
            str: 容器日志内容
        """
        try:
            logs = container.logs(tail=tail, timestamps=True, stream=False).decode('utf-8')
            return logs
        except Exception as e:
            logger.error(f"获取时出错: {e}")
            return f"无法获取: {e}"

    @async_handle_exceptions
    async def _get_auth_token(self) -> Optional[str]:
        """
        向认证服务发送请求获取认证 token，如果 MAGIC_GATEWAY_BASE_URL 环境变量未设置，则返回 None

        Returns:
            Optional[str]: 认证 token，如果 MAGIC_GATEWAY_BASE_URL 环境变量未设置则返回 None

        Raises:
            ContainerOperationError: 当请求失败、响应格式不符合预期或 MAGIC_GATEWAY_API_KEY 未设置时
        """
        magic_gateway_url = os.environ.get("MAGIC_GATEWAY_BASE_URL")

        if not magic_gateway_url:
            logger.info("MAGIC_GATEWAY_BASE_URL 环境变量未设置，跳过认证步骤")
            return None

        magic_gateway_api_key = os.environ.get("MAGIC_GATEWAY_API_KEY")
        if not magic_gateway_api_key:
            error_msg = "MAGIC_GATEWAY_API_KEY 环境变量未设置，无法进行认证"
            logger.error(error_msg)
            raise ContainerOperationError(error_msg)

        try:
            headers = {
                "X-USER-ID": "user",
                "X-Gateway-API-Key": magic_gateway_api_key
            }

            auth_url = f"{magic_gateway_url}/auth"
            logger.info(f"正在请求认证服务: {auth_url}")

            async with aiohttp.ClientSession() as session:
                async with session.post(auth_url, headers=headers) as response:
                    if response.status != 200:
                        raise ContainerOperationError(f"认证服务请求失败，状态码: {response.status}")

                    auth_data = await response.json()

                    if "token" not in auth_data:
                        raise ContainerOperationError("认证服务响应格式不符合预期，缺少 token 字段")

                    return auth_data["token"]

        except aiohttp.ClientError as e:
            error_msg = f"请求认证服务失败: {e}"
            logger.error(error_msg)
            raise ContainerOperationError(error_msg)

    @async_handle_exceptions
    async def _create_agent_container(self, sandbox_id: str) -> str:
        """
        创建新的沙箱容器并执行健康检查

        Args:
            container_id: 容器ID

        Returns:
            str: Docker容器ID

        Raises:
            ContainerOperationError: 容器操作失败
        """
        try:
            # 检查是否已存在处于退出状态的容器
            container = self._get_agent_container_by_sandbox_id(sandbox_id)

            if container:
                if container.status == "running":
                    logger.info(f"Agent容器已存在: {container.name}，关联沙箱ID: {sandbox_id}")
                elif container.status == "exited":
                    logger.info(f"发现处于退出状态的Agent容器: {container.name}，尝试重新启动")
                    # 启动已有容器
                    container.start()
                else:
                    raise ContainerOperationError(f"Agent容器状态异常: {container.status}")
            else:
                # 检查镜像是否存在
                try:
                    self.docker_client.images.get(self.image_name)
                    logger.info(f"使用镜像: {self.image_name}")
                except ImageNotFound:
                    raise ContainerOperationError(f"镜像不存在: {self.image_name}")

                # 准备容器环境变量
                environment = {
                    "QDRANT_BASE_URI": f"http://{QDRANT_LABEL_PREFIX}{sandbox_id}:{self.qdrant_port}",
                    "SANDBOX_ID": sandbox_id,
                    "APP_ENV": settings.app_env,
                }

                token = await self._get_auth_token()
                if token:
                    environment["MAGIC_AUTHORIZATION"] = token
                    logger.info("已成功获取认证 token 并添加到容器环境变量中")

                # 读取Agent环境文件变量(文件必定存在，因为settings加载时已检查)
                env_vars = dotenv_values(settings.agent_env_file_path)
                if env_vars:
                    # 合并环境变量，允许环境文件中的变量覆盖默认值
                    environment.update(env_vars)
                    logger.info(f"已从Agent环境文件{settings.agent_env_file_path}添加{len(env_vars)}个环境变量")
                else:
                    logger.warning(f"Agent环境文件{settings.agent_env_file_path}存在但未读取到任何环境变量")

                # 创建并启动容器
                # 挂载配置文件,判断/app/config/config.yaml是否存在
                config_file_path = os.environ.get("SUPER_MAGIC_CONFIG_FILE_PATH")
                if config_file_path:
                    volumes = {
                        config_file_path: {
                            'bind': '/app/config/config.yaml',
                            'mode': 'rw'
                        }
                    }
                    logger.info(f"使用配置文件: {config_file_path}")
                else:
                    logger.warning(f"SUPER_MAGIC_CONFIG_FILE_PATH 配置文件不存在: {config_file_path}")
                    volumes = {}

                # 挂载配置文件
                container = self.docker_client.containers.run(
                    self.image_name,
                    detach=True,
                    environment=environment,
                    name=f"{AGENT_LABEL_PREFIX}{sandbox_id}",
                    labels={
                        AGENT_LABEL: sandbox_id,
                        SANDBOX_LABEL: sandbox_id
                    },
                    network=self.network_name,  # 使用与网关相同的网络
                    volumes=volumes
                )
                logger.info(f"容器已创建: {container.name}，使用网络: {self.network_name}")

            # 无论是启动已有容器还是创建新容器，以下代码都是一样的
            # 等待容器启动
            container.reload()

            # 获取容器信息
            container_info = self._get_container_info(container)

            # 使用健康检查端点确认容器是否准备就绪
            container_ready = await self._wait_for_container_ready(container_info)
            if not container_ready:
                # 获取容器日志
                container_logs = self._get_container_logs(container)
                error_msg = "容器启动超时，健康检查失败"
                logger.error(f"{error_msg}\n容器日志:\n{container_logs}")
                # 清理容器
                try:
                    container.stop()
                    container.remove()
                except Exception as e:
                    logger.error(f"清理失败的容器时出错: {e}")
                raise ContainerOperationError(f"{error_msg}，详细错误信息请查看日志")

            if not container_info.ip:
                # 获取容器日志
                container_logs = self._get_container_logs(container)
                error_msg = "无法获取容器IP地址"
                logger.error(f"{error_msg}\n容器日志:\n{container_logs}")
                # 清理容器
                try:
                    container.stop()
                    container.remove()
                except Exception as e:
                    logger.error(f"清理失败的容器时出错: {e}")
                raise ContainerOperationError(error_msg)

            # 打印沙箱容器的ip
            is_restarted = container and container.status == "exited"
            if is_restarted:
                logger.info(f"已重启沙箱容器name: {container.name}, 沙箱容器ip: {container_info.ip}")
            else:
                logger.info(f"沙箱容器name: {container.name}, 沙箱容器ip: {container_info.ip}")

            # 返回容器ID
            return container.id

        except ContainerOperationError:
            # 重新抛出容器操作异常
            raise
        except DockerException as e:
            error_msg = f"Docker操作失败: {e}"
            logger.error(error_msg)
            raise ContainerOperationError(error_msg)
        except Exception as e:
            error_msg = f"创建沙箱容器出错: {e}"
            logger.error(error_msg)
            raise ContainerOperationError(error_msg)

    @async_handle_exceptions
    async def create_sandbox(self, sandbox_id: Optional[str] = None) -> str:
        """
        创建新的沙箱容器

        Args:
            sandbox_id: 可选的沙箱ID，如果未提供则自动生成

        Returns:
            str: 沙箱容器ID

        Raises:
            ContainerOperationError: 容器操作失败
        """
        # 如果没有传入sandbox_id，则生成一个随机ID
        if not sandbox_id:
            sandbox_id = str(uuid.uuid4())[:8]

        try:
            await self._create_qdrant_container(sandbox_id)
            logger.info(f"Qdrant容器已创建，关联沙箱ID: {sandbox_id}")

            await self._create_agent_container(sandbox_id)
            logger.info(f"Agent容器已创建，关联沙箱ID: {sandbox_id}")

            return sandbox_id

        except ContainerOperationError:
            raise
        except DockerException as e:
            error_msg = f"Docker操作失败: {e}"
            logger.error(error_msg)
            raise ContainerOperationError(error_msg)
        except Exception as e:
            error_msg = f"创建沙箱出错: {e}"
            logger.error(error_msg)
            raise ContainerOperationError(error_msg)

    @async_handle_exceptions
    async def _create_qdrant_container(self, sandbox_id: str) -> str:
        """
        为沙箱创建对应的Qdrant容器

        Args:
            sandbox_id: 沙箱ID，用于关联Qdrant容器

        Returns:
            str: Qdrant容器ID

        Raises:
            ContainerOperationError: 容器操作失败
        """
        try:
            # 检查是否已存在处于退出状态的Qdrant容器
            qdrant_container = self._get_qdrant_container_by_sandbox_id(sandbox_id)

            if qdrant_container:
                if qdrant_container.status == "running":
                    logger.info(f"Qdrant容器已存在: {qdrant_container.name}，关联沙箱ID: {sandbox_id}")
                    return qdrant_container.id
                elif qdrant_container.status == "exited":
                    logger.info(f"发现处于退出状态的Qdrant容器: {qdrant_container.name}，尝试重新启动")
                    # 启动已有容器
                    qdrant_container.start()
                else:
                    raise ContainerOperationError(f"Qdrant容器状态异常: {qdrant_container.status}")
            else:
                # 检查Qdrant镜像是否存在
                try:
                    self.docker_client.images.get(self.qdrant_image_name)
                    logger.info(f"使用Qdrant镜像: {self.qdrant_image_name}")
                except ImageNotFound:
                    raise ContainerOperationError(f"Qdrant镜像不存在: {self.qdrant_image_name}")

                # 设置容器名称和标签
                qdrant_name = f"{QDRANT_LABEL_PREFIX}{sandbox_id}"

                # 创建并启动Qdrant容器
                qdrant_container = self.docker_client.containers.run(
                    self.qdrant_image_name,
                    detach=True,
                    environment={},
                    name=qdrant_name,
                    labels={
                        QDRANT_LABEL: sandbox_id,  # 使用相同的sandbox_id作为关联
                        SANDBOX_LABEL: sandbox_id
                    },
                    network=self.network_name  # 使用与沙箱容器相同的网络
                )
                logger.info(f"Qdrant容器已创建: {qdrant_container.name}，关联沙箱ID: {sandbox_id}，使用网络: {self.network_name}")

            # 无论是启动已有容器还是创建新容器，以下代码都是一样的
            # 等待容器启动
            qdrant_container.reload()

            # 获取容器信息
            container_info = self._get_container_info(qdrant_container)

            # 检查Qdrant容器是否准备就绪
            qdrant_ready = await self._wait_for_qdrant_ready(container_info)
            if not qdrant_ready:
                # 获取容器日志
                container_logs = self._get_container_logs(qdrant_container)
                error_msg = "Qdrant容器启动超时，健康检查失败"
                logger.error(f"{error_msg}\n容器日志:\n{container_logs}")
                # 清理容器
                try:
                    qdrant_container.stop()
                    qdrant_container.remove()
                except Exception as e:
                    logger.error(f"清理失败的Qdrant容器时出错: {e}")
                raise ContainerOperationError(f"{error_msg}，详细错误信息请查看日志")

            # 记录容器状态
            is_restarted = qdrant_container and qdrant_container.status == "exited"
            if is_restarted:
                logger.info(f"已重启Qdrant容器: {qdrant_container.name}，关联沙箱ID: {sandbox_id}")

            return qdrant_container.id

        except ContainerOperationError:
            # 重新抛出容器操作异常
            raise
        except DockerException as e:
            error_msg = f"Docker操作失败: {e}"
            logger.error(error_msg)
            raise ContainerOperationError(error_msg)
        except Exception as e:
            error_msg = f"创建Qdrant容器出错: {e}"
            logger.error(error_msg)
            raise ContainerOperationError(error_msg)

    async def _wait_for_qdrant_ready(self, container_info: ContainerInfo, max_attempts: int = 30, sleep_time: int = 1) -> bool:
        """
        通过请求Qdrant健康检查端点确定Qdrant容器是否已完全启动

        Args:
            container_info: 容器信息
            max_attempts: 最大尝试次数
            sleep_time: 每次尝试间隔时间(秒)

        Returns:
            bool: 容器是否准备就绪
        """
        if not container_info.ip:
            return False

        health_url = f"http://{container_info.ip}:{self.qdrant_port}"
        logger.info(f"等待Qdrant容器健康检查: {health_url}, 最大尝试次数: {max_attempts}")

        for attempt in range(1, max_attempts + 1):
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(health_url, timeout=2) as response:
                        if response.status == 200:
                            logger.info(f"Qdrant容器健康检查成功，尝试次数: {attempt}")
                            return True
            except Exception as e:
                logger.debug(f"Qdrant健康检查尝试 {attempt}/{max_attempts} 失败: {e}")

            await asyncio.sleep(sleep_time)

        logger.warning(f"Qdrant容器健康检查失败，已达到最大尝试次数: {max_attempts}")
        return False

    @handle_exceptions
    def get_agent_container(self, sandbox_id: str) -> Optional[SandboxInfo]:
        """
        获取沙箱信息

        Args:
            sandbox_id: 沙箱ID

        Returns:
            SandboxInfo: 沙箱信息，如果沙箱不存在则返回None
        """
        container = self._get_agent_container_by_sandbox_id(sandbox_id)

        if not container:
            return None

        container_info = self._get_container_info(container)

        return SandboxInfo(
            sandbox_id=sandbox_id,
            status=container_info.status,
            created_at=container_info.created_at,
            started_at=container_info.started_at,
            ip_address=container_info.ip
        )

    @handle_exceptions
    def list_sandboxes(self) -> List[SandboxInfo]:
        """
        列出所有沙箱容器

        Returns:
            List[SandboxInfo]: 沙箱信息列表
        """
        result = []
        try:
            # 获取所有带有沙箱标签的容器
            containers = self.docker_client.containers.list(
                all=True,
                filters={"label": [f"{SANDBOX_LABEL}"]}
            )

            for container in containers:
                sandbox_id = container.labels.get(SANDBOX_LABEL)
                # 排除Qdrant容器
                if sandbox_id and container.name.startswith(AGENT_LABEL_PREFIX):
                    container_info = self._get_container_info(container)
                    result.append(SandboxInfo(
                        sandbox_id=sandbox_id,
                        status=container_info.status,
                        created_at=container_info.created_at,
                        started_at=container_info.started_at,
                        ip_address=container_info.ip
                    ))
        except Exception as e:
            logger.error(f"列出沙箱容器时出错: {e}")

        return result

    @handle_exceptions
    def delete_sandbox(self, sandbox_id: str) -> bool:
        """
        删除沙箱容器

        Args:
            sandbox_id: 沙箱ID

        Returns:
            bool: 是否成功删除

        Raises:
            SandboxNotFoundError: 沙箱不存在
            ContainerOperationError: 容器操作失败
        """
        container = self._get_agent_container_by_sandbox_id(sandbox_id)

        if not container:
            raise SandboxNotFoundError(sandbox_id)

        try:
            # 先删除对应的Qdrant容器
            qdrant_container = self._get_qdrant_container_by_sandbox_id(sandbox_id)
            if qdrant_container:
                try:
                    qdrant_container.stop()
                    qdrant_container.remove()
                    logger.info(f"Qdrant容器已删除，关联沙箱ID: {sandbox_id}")
                except Exception as e:
                    logger.error(f"删除Qdrant容器 {sandbox_id} 时出错: {e}")

            # 删除沙箱容器
            container.stop()
            container.remove()
            logger.info(f"沙箱容器已删除: {sandbox_id}")
            return True
        except Exception as e:
            error_msg = f"删除沙箱容器 {sandbox_id} 时出错: {e}"
            logger.error(error_msg)
            raise ContainerOperationError(error_msg)

    @async_handle_exceptions
    async def handle_websocket(self, websocket: WebSocket, sandbox_id: str) -> None:
        """
        处理WebSocket连接，连接到指定的沙箱容器

        Args:
            websocket: WebSocket连接
            sandbox_id: 要连接的沙箱ID

        Raises:
            SandboxNotFoundError: 沙箱不存在
            ContainerOperationError: 容器操作失败
        """
        await websocket.accept()
        logger.info(f"沙箱WebSocket连接已接受，连接到沙箱: {sandbox_id}")

        # 检查沙箱是否存在
        container = self._get_agent_container_by_sandbox_id(sandbox_id)

        if not container:
            error_msg = f"沙箱 {sandbox_id} 不存在或已过期"
            logger.error(error_msg)
            await websocket.send_text(json.dumps({
                "type": WS_MESSAGE_TYPE_ERROR,
                "error": error_msg
            }))
            await websocket.close()
            return

        try:
            # 获取容器信息
            container_info = self._get_container_info(container)
            container_ip = container_info.ip
            ws_port = container_info.ws_port

            # 连接到容器的WebSocket服务
            container_ws_url = f"ws://{container_ip}:{ws_port}/ws"
            logger.info(f"连接到容器 WebSocket: {container_ws_url}, 沙箱ID: {sandbox_id}")

            # 创建到容器WebSocket服务的连接
            try:
                async with websockets.connect(container_ws_url, ping_interval=None) as container_ws:
                    logger.info(f"已连接到容器 WebSocket: {container_ws_url}, 沙箱ID: {sandbox_id}")

                    # 双向转发消息
                    await self._proxy_websocket(websocket, container_ws, sandbox_id)

            except websockets.exceptions.InvalidStatusCode as e:
                error_msg = f"无法连接到容器WebSocket: {e}, 沙箱ID: {sandbox_id}"
                logger.error(error_msg)
                await websocket.send_text(json.dumps({"type": WS_MESSAGE_TYPE_ERROR, "error": error_msg}))
            except Exception as e:
                error_msg = f"WebSocket代理出错: {e}, 沙箱ID: {sandbox_id}"
                logger.error(error_msg)
                await websocket.send_text(json.dumps({"type": WS_MESSAGE_TYPE_ERROR, "error": error_msg}))

        except Exception as e:
            error_msg = f"连接沙箱出错: {e}, 沙箱ID: {sandbox_id}"
            logger.error(error_msg)
            await websocket.send_text(json.dumps({
                "type": WS_MESSAGE_TYPE_ERROR,
                "error": error_msg
            }))
        finally:
            # 关闭WebSocket连接
            if websocket.client_state != WebSocketState.DISCONNECTED:
                await websocket.close()
            logger.info(f"WebSocket连接已关闭，沙箱ID: {sandbox_id}")

    async def _proxy_websocket(
        self,
        client_ws: WebSocket,
        container_ws: WebSocketClientProtocol,
        sandbox_id: str
    ) -> None:
        """
        代理WebSocket连接

        Args:
            client_ws: 客户端WebSocket连接
            container_ws: 容器WebSocket连接
            sandbox_id: 容器ID
        """
        async def forward_to_container() -> None:
            """将消息从客户端转发到容器"""
            try:
                while True:
                    data = await client_ws.receive_text()
                    try:
                        # 尝试解析接收到的JSON
                        json_data = json.loads(data)
                        # 重新格式化为缩进格式的JSON
                        formatted_data = json.dumps(json_data, ensure_ascii=False, indent=2)
                        logger.debug(f"转发到容器 {sandbox_id}: {formatted_data}")
                        await container_ws.send(data)  # 发送原始数据而不是格式化的数据
                    except json.JSONDecodeError:
                        # 如果不是有效的JSON，直接传递原始数据
                        logger.debug(f"转发到容器 {sandbox_id}: {data}")
                        await container_ws.send(data)
            except WebSocketDisconnect:
                logger.info(f"客户端WebSocket断开连接 {sandbox_id}")
            except Exception as e:
                logger.error(f"转发到容器时出错 {sandbox_id}: {e}")

        async def forward_to_client() -> None:
            """将消息从容器转发到客户端"""
            try:
                while True:
                    try:
                        # 使用配置的超时时间
                        data = await asyncio.wait_for(
                            container_ws.recv(),
                            timeout=settings.ws_receive_timeout
                        )
                        try:
                            # 尝试解析接收到的JSON (仅用于日志)
                            json_data = json.loads(data)
                            # 重新格式化为缩进格式的JSON (仅用于日志)
                            formatted_data = json.dumps(json_data, ensure_ascii=False, indent=2)
                            logger.debug(f"转发到客户端 {sandbox_id}: {formatted_data}")
                        except json.JSONDecodeError:
                            # 如果不是有效的JSON，直接记录原始数据
                            logger.debug(f"转发到客户端 {sandbox_id}: {data}")

                        # 始终发送原始数据
                        await client_ws.send_text(data)
                    except asyncio.TimeoutError:
                        logger.warning(f"容器 {sandbox_id} 接收消息超时，关闭连接")
                        return
            except websockets.exceptions.ConnectionClosed:
                logger.info(f"容器WebSocket断开连接 {sandbox_id}")
            except Exception as e:
                logger.error(f"转发到客户端时出错 {sandbox_id}: {e}")

        # 并发运行两个转发任务
        client_task = asyncio.create_task(forward_to_container())
        container_task = asyncio.create_task(forward_to_client())

        # 等待任一任务完成
        done, pending = await asyncio.wait(
            [client_task, container_task],
            return_when=asyncio.FIRST_COMPLETED
        )

        # 取消未完成的任务
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    async def _check_container_health(self, container_id: str) -> Tuple[bool, str]:
        """
        检查容器健康状态

        Args:
            container_id: 容器ID

        Returns:
            Tuple[bool, str]: (是否健康, 状态信息)
        """
        container = self._get_agent_container_by_sandbox_id(container_id)
        if not container:
            return False, "容器不存在"

        try:
            container.reload()

            # 检查容器是否在运行
            if container.status != "running":
                # 获取容器日志以了解故障原因
                container_logs = self._get_container_logs(container)
                logger.error(f"容器状态异常: {container.status}\n容器日志:\n{container_logs}")
                return False, f"容器状态: {container.status}"

            # 获取容器信息
            container_info = self._get_container_info(container)

            # 尝试连接容器WebSocket服务
            container_ws_url = f"ws://{container_info.ip}:{container_info.ws_port}/ws"

            try:
                # 尝试连接但不等待，只验证连接是否成功
                async with websockets.connect(container_ws_url, close_timeout=2, ping_interval=None):
                    return True, "容器健康"
            except Exception as e:
                # 获取容器日志以了解WebSocket服务未能启动的原因
                container_logs = self._get_container_logs(container)
                logger.error(f"WebSocket连接失败: {e}\n容器日志:\n{container_logs}")
                return False, f"WebSocket连接失败: {e}"

        except Exception as e:
            # 尝试获取容器日志，即使在健康检查过程中发生了异常
            try:
                container_logs = self._get_container_logs(container)
                logger.error(f"健康检查失败: {e}\n容器日志:\n{container_logs}")
            except Exception as log_error:
                logger.error(f"健康检查失败: {e}，且无法获取容器日志: {log_error}")
            return False, f"健康检查失败: {e}"

    async def _cleanup_running_containers(self, current_time: float) -> None:
        """
        清理运行时间过长的容器（停止操作）

        Args:
            current_time: 当前时间戳
        """
        try:
            # 获取所有运行中带有沙箱标签的容器
            running_containers = self.docker_client.containers.list(
                filters={"label": [f"{SANDBOX_LABEL}"], "status": "running"}
            )

            for container in running_containers:
                try:
                    container_info = self._get_container_info(container)

                    # 使用启动时间代替创建时间
                    started_at = container_info.started_at
                    if not started_at:
                        logger.warning(f"容器 {container.name} 没有有效的启动时间，使用创建时间代替")
                        started_at = container_info.created_at

                    running_seconds = (current_time - started_at)

                    # 记录容器状态和运行时间
                    logger.info(
                        f"运行中容器 {container.name} 已运行: {running_seconds:.2f}秒, "
                        f"启动时间: {started_at}, 当前时间: {current_time}"
                    )

                    # 检查是否超过运行时间限制
                    if running_seconds > self.running_container_expire_time:
                        logger.info(f"开始暂停过期容器: {container.name}，已运行时间: {running_seconds:.2f}秒")
                        container.stop()
                        logger.info(f"成功暂停容器: {container.name}")
                except Exception as e:
                    logger.error(f"暂停容器时出错: {container.name}, {e}")
        except Exception as e:
            logger.error(f"暂停容器过程中出错: {e}")

    async def _cleanup_exited_containers(self, current_time: float) -> None:
        """
        清理已退出的过期容器（删除操作）

        Args:
            current_time: 当前时间戳
        """
        try:
            # 获取所有已退出带有沙箱标签的容器
            exited_containers = self.docker_client.containers.list(
                all=True,  # 包含所有状态的容器
                filters={"label": [f"{SANDBOX_LABEL}"], "status": "exited"}
            )

            for container in exited_containers:
                try:
                    container_info = self._get_container_info(container)
                    created_at = container_info.created_at
                    exited_at = container_info.exited_at

                    # 使用退出时间计算已经退出的时间
                    idle_seconds = (current_time - exited_at)
                    logger.info(
                        f"已退出容器 {container.name} 已退出: {idle_seconds:.2f}秒, "
                        f"创建时间: {created_at}, 退出时间: {exited_at}"
                    )

                    # 检查是否超过退出容器保留时间
                    if idle_seconds > self.exited_container_expire_time:
                        logger.info(f"开始删除已退出的过期容器: {container.name}，已退出时间: {idle_seconds:.2f}秒")
                        container.remove()
                        logger.info(f"成功删除已退出的容器: {container.name}")
                except Exception as e:
                    logger.error(f"处理已退出容器时出错: {container.name} - {e}")
        except Exception as e:
            logger.error(f"清理已退出容器过程中出错: {e}")

    async def cleanup_idle_containers(self) -> None:
        """定期清理长时间运行的容器和已退出的容器"""
        while True:
            try:
                current_time = time.time()

                # 暂停运行中的容器
                await self._cleanup_running_containers(current_time)

                # 清理已退出的容器
                # await self._cleanup_exited_containers(current_time)

                await asyncio.sleep(settings.cleanup_interval)
            except Exception as e:
                logger.error(f"清理容器过程中出错: {e}")
                await asyncio.sleep(60)

    async def _wait_for_container_ready(self, container_info: ContainerInfo, max_attempts: int = 30, sleep_time: int = 1) -> bool:
        """
        通过请求容器的健康检查端点确定容器是否已完全启动

        Args:
            container_info: 容器信息
            max_attempts: 最大尝试次数
            sleep_time: 每次尝试间隔时间(秒)

        Returns:
            bool: 容器是否准备就绪
        """
        if not container_info.ip:
            return False

        health_url = f"http://{container_info.ip}:{container_info.ws_port}/api/health"
        logger.info(f"等待容器健康检查: {health_url}, 最大尝试次数: {max_attempts}")

        for attempt in range(1, max_attempts + 1):
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(health_url, timeout=2) as response:
                        if response.status == 200:
                            logger.info(f"容器健康检查成功，尝试次数: {attempt}")
                            return True
            except Exception as e:
                logger.debug(f"健康检查尝试 {attempt}/{max_attempts} 失败: {e}")

            await asyncio.sleep(sleep_time)

        logger.warning(f"容器健康检查失败，已达到最大尝试次数: {max_attempts}")
        return False


# 创建全局沙箱服务实例
sandbox_service = SandboxService()
