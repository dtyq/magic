import asyncio
import os
import shutil
import tempfile
from pathlib import Path
from typing import List

# 使用 aiofiles 进行异步文件I/O
try:
    import aiofiles
except ImportError:
    # 如果没有安装 aiofiles，使用同步方式作为降级方案
    aiofiles = None

# 注释：简化版本不再依赖存储相关模块
# from app.core.context.agent_context import AgentContext
# from app.infrastructure.storage.base import AbstractStorage
# from app.infrastructure.storage.factory import StorageFactory
from app.paths import PathManager
from app.api.http_dto.file_save_dto import FileEditItem, FileEditResult, FileEditResponse
from agentlang.logger import get_logger
from agentlang.utils.shadow_code import ShadowCode

logger = get_logger(__name__)


class FileSaveService:
    """
    文件保存服务（简化版本）
    支持文本文件的保存、加密内容处理，仅保存到本地工作区
    """

    def __init__(self):
        # 注释：简化版本不再依赖 AgentContext 和存储服务
        # self.agent_context = agent_context
        # self.storage_service: AbstractStorage = None
        # 设置最大并发编辑数，避免过多并发影响系统性能
        self.max_concurrent_edits = 5

    # 注释：简化版本不需要存储服务
    # async def _ensure_storage_service(self):
    #     """
    #     确保存储服务已初始化
    #     复用现有的存储服务获取逻辑
    #     """
    #     if not self.storage_service:
    #         # 获取配置信息（复用现有逻辑）
    #         sts_token_refresh = self.agent_context.get_init_client_message_sts_token_refresh()
    #         metadata = self.agent_context.get_metadata()
    #         platform_type = self.agent_context.get_init_client_message_platform_type()

    #         self.storage_service = await StorageFactory.get_storage(
    #             sts_token_refresh=sts_token_refresh,
    #             metadata=metadata,
    #             platform=platform_type
    #         )

    #         logger.info("文件编辑服务：存储服务初始化完成")

    def _get_safe_target_path(self, file_path: str) -> Path:
        """
        获取安全的目标路径
        确保文件只能在 .workspace 目录内操作
        增强的安全检查
        """
        # 获取工作区目录（复用现有逻辑）
        workspace_dir = PathManager.get_workspace_dir()

        # 清理用户输入的路径
        clean_path = file_path.strip().lstrip('/')

        # 增强的安全检查
        self._validate_path_security(clean_path)

        # 构建目标路径
        target_path = workspace_dir / clean_path

        # 解析路径（处理 ../ 等）
        resolved_path = target_path.resolve()

        # 确保路径在工作区内（安全检查）
        workspace_resolved = workspace_dir.resolve()
        if not str(resolved_path).startswith(str(workspace_resolved)):
            raise ValueError(f"路径 '{file_path}' 超出工作区范围，拒绝操作")

        # 检查文件名安全性
        self._validate_filename_security(resolved_path.name)

        return resolved_path

    def _validate_path_security(self, path: str):
        """
        验证路径安全性
        """
        # 禁止的路径模式
        dangerous_patterns = [
            '../', '..\\',  # 路径遍历
            '~/',           # 用户目录
            '/etc/', '/usr/', '/var/', '/bin/', '/sys/',  # 系统目录
            'C:\\Windows\\', 'C:\\Program Files\\',  # Windows系统目录
        ]

        for pattern in dangerous_patterns:
            if pattern.lower() in path.lower():
                raise ValueError(f"路径包含危险模式: {pattern}")

        # 禁止特殊字符（在某些系统中可能有安全风险）
        # Note: Removed '[' and ']' as they are common and safe in filenames
        dangerous_chars = ['|', '&', ';', '$', '`']
        for char in dangerous_chars:
            if char in path:
                raise ValueError(f"路径包含危险字符: {char}")

        # 检查路径长度（防止过长路径攻击）
        if len(path) > 255:
            raise ValueError("路径长度超出限制")

    def _validate_filename_security(self, filename: str):
        """
        验证文件名安全性
        """
        # 禁止的文件名
        forbidden_names = [
            'con', 'prn', 'aux', 'nul',  # Windows保留名
            'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
            'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
        ]

        base_name = filename.lower().split('.')[0]
        if base_name in forbidden_names:
            raise ValueError(f"文件名使用了系统保留名: {filename}")

        # 禁止以点开头的隐藏文件（除非明确允许）
        if filename.startswith('.') and filename not in ['.gitignore', '.env.example']:
            logger.warning(f"创建隐藏文件: {filename}")

        # 检查文件名长度
        if len(filename) > 100:
            raise ValueError("文件名长度超出限制")

    async def process_file_content(self, content: str, is_encrypted: bool = False) -> str:
        """
        处理文件内容，支持解密
        使用 ShadowCode 进行内容解密
        """
        if is_encrypted:
            # 使用 ShadowCode 解密
            logger.debug("检测到加密内容，使用 ShadowCode 解密")
            return await self.decrypt_content(content)
        else:
            # 直接返回原内容
            return content

    async def decrypt_content(self, encrypted_content: str) -> str:
        """
        解密内容
        使用 ShadowCode.unshadow 方法进行解密
        """
        try:
            # 使用 ShadowCode 进行解密
            decrypted_content = ShadowCode.unshadow(encrypted_content)

            # 记录解密信息
            if ShadowCode.is_shadowed(encrypted_content):
                logger.info(f"成功解密 ShadowCode 内容，原长度: {len(encrypted_content)}, 解密后长度: {len(decrypted_content)}")
            else:
                logger.debug("内容不是 ShadowCode 格式，直接返回原内容")

            return decrypted_content

        except Exception as e:
            logger.error(f"ShadowCode 解密失败: {e}")
            # 解密失败时返回原内容，避免数据丢失
            logger.warning("解密失败，返回原始内容")
            return encrypted_content

    def _check_disk_space(self, target_path: Path, content_size: int):
        """
        检查磁盘空间是否足够
        """
        try:
            # 获取目标目录的磁盘使用情况
            stats = shutil.disk_usage(target_path.parent)
            free_space = stats.free

            # 预留100MB作为安全缓冲
            required_space = content_size + (100 * 1024 * 1024)

            if free_space < required_space:
                raise ValueError(f"磁盘空间不足，需要 {required_space} 字节，可用 {free_space} 字节")

        except Exception as e:
            logger.warning(f"检查磁盘空间失败: {e}")

    def _check_write_permission(self, target_path: Path):
        """
        检查写权限
        """
        try:
            # 检查父目录的写权限
            parent_dir = target_path.parent
            if not os.access(parent_dir, os.W_OK):
                raise PermissionError(f"没有写权限: {parent_dir}")

            # 如果文件已存在，检查文件的写权限
            if target_path.exists() and not os.access(target_path, os.W_OK):
                raise PermissionError(f"没有文件写权限: {target_path}")

        except Exception as e:
            logger.error(f"权限检查失败: {e}")
            raise

    async def safe_write_text_file(self, target_path: Path, content: str) -> int:
        """
        安全的文本文件写入（原子操作）
        返回写入的字节数
        """
        # 计算内容大小
        content_bytes = content.encode('utf-8')
        content_size = len(content_bytes)

        # 确保父目录存在
        target_path.parent.mkdir(parents=True, exist_ok=True)

        # 安全检查
        self._check_disk_space(target_path, content_size)
        self._check_write_permission(target_path)

        # 使用临时文件进行原子写入
        temp_path = target_path.with_suffix(target_path.suffix + '.tmp')

        try:
            if aiofiles:
                # 使用异步文件I/O
                async with aiofiles.open(temp_path, 'w', encoding='utf-8') as f:
                    await f.write(content)
            else:
                # 降级到同步方式
                with open(temp_path, 'w', encoding='utf-8') as f:
                    f.write(content)

            # 原子移动
            temp_path.replace(target_path)

            # 返回文件大小
            return target_path.stat().st_size

        except Exception:
            # 清理临时文件
            if temp_path.exists():
                temp_path.unlink()
            raise

    # 注释：简化版本不再上传到存储
    # async def upload_to_storage(self, local_path: Path, file_key: str) -> dict:
    #     """
    #     上传文件到存储
    #     复用现有的上传逻辑
    #     """
    #     try:
    #         await self._ensure_storage_service()

    #         # 使用存储服务上传文件
    #         upload_result = await self.storage_service.upload(
    #             file=str(local_path),
    #             key=file_key,
    #             options=None
    #         )

    #         logger.info(f"文件上传成功: {file_key}")

    #         # 生成预签名URL（可选）
    #         try:
    #             presigned_url = await self.storage_service.generate_presigned_url(
    #                 key=file_key,
    #                 expires_in=3600  # 1小时有效期
    #             )
    #             upload_result.url = presigned_url
    #         except Exception as e:
    #             logger.warning(f"生成预签名URL失败: {e}")
    #             upload_result.presigned_url = None

    #         return {
    #             "success": True,
    #             "url": getattr(upload_result, 'presigned_url', None),
    #             "size": local_path.stat().st_size,
    #             "platform": self.storage_service.get_platform_name()
    #         }

    #     except Exception as e:
    #         logger.error(f"上传文件失败 {file_key}: {e}")
    #         return {
    #             "success": False,
    #             "error": str(e)
    #         }

    async def edit_single_file(self, file_key: str, file_path: str, content: str,
                              is_encrypted: bool = False) -> FileEditResult:
        """
        编辑单个文件
        支持创建新文件和覆盖现有文件
        """
        try:
            # 1. 验证并获取安全的目标路径
            target_path = self._get_safe_target_path(file_path)

            # 2. 处理文件内容（解密等）
            processed_content = await self.process_file_content(content, is_encrypted)

            # 3. 确定操作类型
            operation_type = "overwrite" if target_path.exists() else "create"

            logger.info(f"开始{operation_type}文件: {target_path}")

            # 4. 安全地写入文件
            file_size = await self.safe_write_text_file(target_path, processed_content)

            logger.info(f"文件写入完成: {target_path} ({file_size} 字节)")

            # 注释：简化版本不再上传到存储
            # upload_result = await self.upload_to_storage(target_path, file_key)

            return FileEditResult(
                file_key=file_key,
                file_path=file_path,
                success=True,
                file_size=file_size,
                # 注释：简化版本不返回上传相关字段
                # upload_success=upload_result.get("success", False),
                # upload_url=upload_result.get("url"),
                operation_type=operation_type
            )

        except Exception as e:
            logger.error(f"编辑文件失败 {file_key}: {e}")
            return FileEditResult(
                file_key=file_key,
                file_path=file_path,
                success=False,
                error_message=str(e)
                # 注释：简化版本不返回上传相关字段
                # upload_success=False
            )

    async def edit_files_batch(self, files: List[FileEditItem]) -> FileEditResponse:
        """
        批量编辑文件
        使用并发控制和分批处理提高性能
        """
        logger.info(f"开始批量编辑 {len(files)} 个文件")

        # 如果文件数量很大，分批处理
        batch_size = 10  # 每批处理10个文件
        all_results = []

        for i in range(0, len(files), batch_size):
            batch = files[i:i + batch_size]
            logger.info(f"处理第 {i//batch_size + 1} 批，包含 {len(batch)} 个文件")

            batch_results = await self._process_file_batch(batch)
            all_results.extend(batch_results)

            # 批次间短暂休息，避免系统过载
            if i + batch_size < len(files):
                await asyncio.sleep(0.1)

        # 统计结果
        total_count = len(all_results)
        success_count = sum(1 for r in all_results if r.success)
        failed_count = total_count - success_count
        # 注释：简化版本不统计上传成功数
        # upload_success_count = sum(1 for r in all_results if r.upload_success)

        logger.info(f"批量编辑完成: 总数 {total_count}, 成功 {success_count}, 失败 {failed_count}")

        return FileEditResponse(
            total_count=total_count,
            success_count=success_count,
            failed_count=failed_count,
            # 注释：简化版本不返回上传相关统计
            # upload_success_count=upload_success_count,
            results=all_results
        )

    async def _process_file_batch(self, batch: List[FileEditItem]) -> List[FileEditResult]:
        """
        处理单个批次的文件
        使用并发控制提高性能
        """
        # 创建信号量控制并发数
        semaphore = asyncio.Semaphore(self.max_concurrent_edits)

        async def edit_with_semaphore(file_item: FileEditItem) -> FileEditResult:
            """带并发控制的编辑"""
            async with semaphore:
                return await self.edit_single_file(
                    file_key=file_item.file_key,
                    file_path=file_item.file_path,
                    content=file_item.content,
                    is_encrypted=file_item.is_encrypted
                )

        # 并发编辑批次中的所有文件
        tasks = [edit_with_semaphore(file_item) for file_item in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 处理结果，将异常转换为失败结果
        final_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"文件编辑异常: {batch[i].file_key} - {str(result)}")
                final_results.append(FileEditResult(
                    file_key=batch[i].file_key,
                    file_path=batch[i].file_path,
                    success=False,
                    error_message=f"编辑异常: {str(result)}"
                    # 注释：简化版本不返回上传相关字段
                    # upload_success=False
                ))
            else:
                final_results.append(result)

        return final_results
