"""
附件下载服务

负责处理聊天消息中的附件下载
"""

import asyncio
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

from app.core.context.agent_context import AgentContext
from agentlang.logger import get_logger

# 配置日志
logger = get_logger(__name__)


class AttachmentService:
    """附件下载服务类"""

    def __init__(self, agent_context: AgentContext):
        """
        初始化附件下载服务

        Args:
            agent_context: 代理上下文，包含存储凭证
        """
        self.agent_context = agent_context

        # 记录初始化信息
        logger.info("正在初始化附件下载服务")

        # 设置附件下载目录
        self.attachments_dir = self._get_attachments_dir()
        # 确保目录存在
        os.makedirs(self.attachments_dir, exist_ok=True)
        logger.info(f"附件下载目录: {self.attachments_dir}")

    def _get_attachments_dir(self) -> Path:
        """
        获取附件下载目录

        直接使用代理工作目录

        Returns:
            Path: 附件下载目录
        """
        # 直接使用代理上下文的工作目录
        workspace_dir = self.agent_context.get_workspace_dir()
        attachments_dir = Path(workspace_dir)
        return attachments_dir

    async def download_attachment(self, attachment: Dict[str, Any]) -> Optional[str]:
        """
        下载单个附件

        Args:
            attachment: 附件信息，包含file_url、file_tag、filename和relative_file_path等字段

        Returns:
            下载后的本地文件路径，如果下载失败或文件已存在则返回None
        """
        try:
            logger.info(f"开始处理附件: {json.dumps(attachment, ensure_ascii=False)}")

            # 获取必要字段
            file_url = attachment.get('file_url')
            filename = attachment.get('filename')
            file_tag = attachment.get('file_tag')
            file_key = attachment.get('file_key')
            file_size = attachment.get('file_size', 0)
            relative_file_path = attachment.get('relative_file_path')

            if not file_url or not filename:
                logger.error(f"附件信息不完整: {attachment}")
                return None

            # 确保是HTTP URL
            if not file_url.startswith(('http://', 'https://')):
                logger.error(f"不支持的URL格式: {file_url}，只支持HTTP或HTTPS")
                return None

            logger.info(f"附件标签: {file_tag}, URL: {file_url}, 文件名: {filename}, 大小: {file_size}, 文件键: {file_key}")

            # 确定文件保存路径
            if relative_file_path:
                # 使用relative_file_path指定的路径，确保它是相对路径
                # 移除开头的斜杠以确保是相对路径
                clean_relative_path = relative_file_path.lstrip('/')
                local_path = self.attachments_dir / clean_relative_path
                logger.info(f"使用relative_file_path指定的路径: {relative_file_path} -> {clean_relative_path}")
            else:
                # 处理文件名，确保安全
                safe_name = self._get_safe_filename(filename)
                logger.debug(f"处理后的安全文件名: {safe_name}")
                local_path = self.attachments_dir / safe_name

            logger.info(f"附件保存路径: {local_path}")

            # 检查文件是否已存在
            if local_path.exists():
                logger.info(f"文件已存在，跳过下载: {local_path}")
                return None  # 文件已存在，返回None表示未下载新文件

            # 处理HTTP(S)链接
            logger.info(f"开始下载HTTP文件: {file_url}")
            async with httpx.AsyncClient() as client:
                logger.debug(f"开始HTTP请求: {file_url}")
                try:
                    response = await client.get(file_url)
                    if response.status_code == 200:
                        logger.info(f"HTTP请求成功, 状态码: {response.status_code}, 内容长度: {len(response.content)} 字节")
                        # 确保父目录存在
                        os.makedirs(os.path.dirname(local_path), exist_ok=True)
                        # 写入文件
                        with open(local_path, 'wb') as f:
                            f.write(response.content)
                        logger.info(f"附件下载成功并保存到: {local_path}")
                        return str(local_path)
                    else:
                        logger.error(f"HTTP下载失败: 状态码 {response.status_code}, 响应: {response.text[:100]}...")
                        return None
                except Exception as e:
                    logger.error(f"HTTP请求异常: {e}")
                    return None

        except Exception as e:
            import traceback
            logger.error(f"下载附件发生错误: {e}")
            logger.error(traceback.format_exc())
            return None

    async def download_attachments(self, attachments: List[Dict[str, Any]]) -> List[str]:
        """
        下载消息中的所有附件

        Args:
            attachments: 附件列表

        Returns:
            成功下载的附件本地路径列表（仅包括新下载的文件）
        """
        if not attachments:
            logger.info("没有找到附件，无需下载")
            return []

        logger.info(f"开始处理 {len(attachments)} 个附件")

        # 并发下载所有附件
        download_tasks = [self.download_attachment(attachment) for attachment in attachments]
        results = await asyncio.gather(*download_tasks)

        # 过滤掉下载失败的附件和已存在的文件
        successful_downloads = [path for path in results if path]

        logger.info(f"成功下载 {len(successful_downloads)} 个新附件，跳过 {len(attachments) - len(successful_downloads)} 个已存在或失败的文件")

        # 记录每个成功下载的文件
        for i, path in enumerate(successful_downloads, 1):
            logger.info(f"新下载的附件 {i}: {path}")

        return successful_downloads

    def _get_safe_filename(self, filename: str) -> str:
        """
        处理文件名，确保文件名安全且唯一

        Args:
            filename: 原始文件名

        Returns:
            安全处理后的文件名
        """
        # 移除路径分隔符和其他不安全字符
        safe_name = "".join(c for c in filename if c.isalnum() or c in "._- ")
        logger.debug(f"安全化文件名: {filename} -> {safe_name}")

        return safe_name
