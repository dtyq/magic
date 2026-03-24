"""
浏览器服务端健康检查模块

提供浏览器服务端的健康检查功能，确保在连接前服务端已就绪。
"""

import asyncio
from typing import Optional

import aiohttp
from agentlang.logger import get_logger

# 设置日志
logger = get_logger(__name__)


class BrowserServerHealthChecker:
    """浏览器服务端健康检查器"""

    def __init__(
        self,
        ws_url: str,
        timeout: int = 60,
        check_interval: float = 1.0
    ):
        """
        初始化健康检查器

        Args:
            ws_url: WebSocket URL（例如：ws://127.0.0.1:3000）
            timeout: 健康检查超时时间（秒）
            check_interval: 检查间隔时间（秒）
        """
        self.ws_url = ws_url
        self.timeout = timeout
        self.check_interval = check_interval

        # 将 WebSocket URL 转换为 HTTP URL 用于健康检查
        self.http_url = self._convert_ws_to_http(ws_url)

    def _convert_ws_to_http(self, ws_url: str) -> str:
        """
        将 WebSocket URL 转换为 HTTP URL

        Args:
            ws_url: WebSocket URL

        Returns:
            HTTP URL
        """
        if ws_url.startswith('ws://'):
            return ws_url.replace('ws://', 'http://')
        elif ws_url.startswith('wss://'):
            return ws_url.replace('wss://', 'https://')
        else:
            raise ValueError(f"无效的 WebSocket URL: {ws_url}")

    async def wait_until_ready(self) -> bool:
        """
        等待服务端就绪

        Returns:
            bool: 服务端是否就绪

        Raises:
            TimeoutError: 等待超时
            Exception: 其他异常
        """
        logger.info(f"开始等待浏览器服务端就绪: {self.ws_url}")
        logger.debug(f"健康检查配置 - 超时: {self.timeout}秒, 检查间隔: {self.check_interval}秒")

        start_time = asyncio.get_event_loop().time()
        attempt = 0

        while True:
            attempt += 1
            elapsed = asyncio.get_event_loop().time() - start_time

            # 检查是否超时
            if elapsed >= self.timeout:
                error_msg = (
                    f"等待浏览器服务端就绪超时 "
                    f"(超时时间: {self.timeout}秒, 尝试次数: {attempt}, URL: {self.ws_url})"
                )
                logger.error(error_msg)
                raise TimeoutError(error_msg)

            try:
                # 尝试连接服务端
                logger.debug(f"第 {attempt} 次尝试连接服务端: {self.http_url}")

                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        self.http_url,
                        timeout=aiohttp.ClientTimeout(total=5)
                    ) as response:
                        if response.status == 200:
                            logger.info(
                                f"浏览器服务端已就绪 "
                                f"(耗时: {elapsed:.2f}秒, 尝试次数: {attempt}, URL: {self.ws_url})"
                            )
                            return True
                        else:
                            logger.debug(
                                f"服务端返回非200状态码: {response.status}, "
                                f"继续等待... (已等待 {elapsed:.2f}秒)"
                            )

            except aiohttp.ClientError as e:
                logger.debug(
                    f"连接服务端失败 (ClientError): {e}, "
                    f"继续等待... (已等待 {elapsed:.2f}秒)"
                )
            except asyncio.TimeoutError:
                logger.debug(
                    f"连接服务端超时, "
                    f"继续等待... (已等待 {elapsed:.2f}秒)"
                )
            except Exception as e:
                logger.warning(
                    f"健康检查遇到意外错误: {type(e).__name__}: {e}, "
                    f"继续等待... (已等待 {elapsed:.2f}秒)"
                )

            # 等待一段时间后重试
            await asyncio.sleep(self.check_interval)

    async def check_once(self) -> bool:
        """
        执行一次健康检查（不等待）

        Returns:
            bool: 服务端是否可用
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    self.http_url,
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    return response.status == 200
        except Exception as e:
            logger.debug(f"健康检查失败: {e}")
            return False


async def wait_for_browser_server(
    ws_url: str,
    timeout: int = 60,
    check_interval: float = 1.0
) -> bool:
    """
    等待浏览器服务端就绪（便捷函数）

    Args:
        ws_url: WebSocket URL
        timeout: 超时时间（秒）
        check_interval: 检查间隔（秒）

    Returns:
        bool: 服务端是否就绪

    Raises:
        TimeoutError: 等待超时
    """
    checker = BrowserServerHealthChecker(
        ws_url=ws_url,
        timeout=timeout,
        check_interval=check_interval
    )
    return await checker.wait_until_ready()


async def check_browser_server(ws_url: str) -> bool:
    """
    检查浏览器服务端是否可用（便捷函数，不等待）

    Args:
        ws_url: WebSocket URL

    Returns:
        bool: 服务端是否可用
    """
    checker = BrowserServerHealthChecker(ws_url=ws_url)
    return await checker.check_once()
