import json
import time
import asyncio
import aiofiles
from pathlib import Path
from typing import Dict, Optional, Tuple, Union

from agentlang.logger import get_logger
from app.path_manager import PathManager
from .file_utils import calculate_file_hash, get_fresh_file_stat

logger = get_logger(__name__)

# Network filesystem mtime buffer (in seconds)
# Some network-mounted filesystems (like in sandboxes) may have delayed mtime updates
# This buffer is added to the timestamp to account for potential mtime drift
# Set to 0 to disable the buffer, or increase if you experience "file modified" errors
# Default: 1.0 second to provide sufficient buffer for most network filesystems
NETWORK_FS_MTIME_BUFFER = 1.0

# File size threshold for hash-based detection (in bytes)
# Files smaller than this threshold will use content hash for modification detection
# Files larger than this threshold will use timestamp-based detection
# Default: 5MB = 5 * 1024 * 1024 bytes
HASH_DETECTION_THRESHOLD = 5 * 1024 * 1024
VALIDATION_ERROR_NOT_READ = "File must be read before editing. Please read the file first."
VALIDATION_ERROR_CHANGED = "File changed since last read. Please read the file again."


class FileTimestampManager:
    """
    文件时间戳和哈希管理器

    用于管理文件读取时间戳和哈希值，确保文件编辑的安全性和一致性。
    实现"先读后写"的工作流程，防止并发修改冲突。

    功能特性：
    - 双路径检测机制，兼顾准确性和性能：
      1. 小文件（≤5MB）：文件哈希精确检测
      2. 大文件（>5MB）：时间戳高效检测
    - 数据持久化存储到JSON文件中，支持多次对话状态保持
    - 兼容旧版本数据格式，自动升级
    """

    def __init__(self, storage_file: Optional[str] = None):
        """
        初始化时间戳管理器

        Args:
            storage_file: 存储文件路径，默认使用路径管理器获取 chat_history 目录下的 file_timestamps.json
        """
        # 设置存储文件路径
        if storage_file is None:
            # 使用路径管理器获取 chat_history 目录
            chat_history_dir = PathManager.get_chat_history_dir()
            storage_file = chat_history_dir / "file_timestamps.json"
        self._storage_file = Path(storage_file)

        # 确保存储目录存在
        self._storage_file.parent.mkdir(parents=True, exist_ok=True)

        # 延迟加载标记
        self._loaded = False
        # 时间戳存储：路径 -> 时间戳（毫秒）
        self._timestamps: Dict[str, float] = {}
        # 哈希值存储：路径 -> 文件哈希值
        self._hashs: Dict[str, str] = {}
        # 元数据存储：路径 -> 转换/处理结果的元数据
        self._metadatas: Dict[str, Dict] = {}

    async def _load_timestamps(self) -> None:
        """从文件加载时间戳、哈希值和元数据"""
        if self._loaded:
            return

        try:
            if self._storage_file.exists():
                async with aiofiles.open(self._storage_file, 'r', encoding='utf-8') as f:
                    content = await f.read()
                    data = json.loads(content)

                    # 加载时间戳数据
                    self._timestamps = data.get('timestamps', {})
                    # 加载哈希数据（新字段，可能不存在）
                    self._hashs = data.get('hashs', {})
                    # 加载元数据（新字段，可能不存在）
                    self._metadatas = data.get('metadatas', {})

                    logger.debug(f"从文件加载数据: {len(self._timestamps)} 个时间戳, {len(self._hashs)} 个哈希值, {len(self._metadatas)} 个元数据")
            else:
                self._timestamps = {}
                self._hashs = {}
                self._metadatas = {}
                logger.debug("存储文件不存在，初始化为空")
        except Exception as e:
            logger.warning(f"加载存储文件失败，使用空数据: {e}")
            self._timestamps = {}
            self._hashs = {}
            self._metadatas = {}

        self._loaded = True

    async def _save_timestamps(self) -> None:
        """保存时间戳、哈希值和元数据到文件"""
        try:
            data = {
                'timestamps': self._timestamps,
                'hashs': self._hashs,
                'metadatas': self._metadatas
            }

            # 原子写入：先写入临时文件，再重命名
            temp_file = self._storage_file.with_suffix('.tmp')
            async with aiofiles.open(temp_file, 'w', encoding='utf-8') as f:
                content = json.dumps(data, indent=2, ensure_ascii=False)
                await f.write(content)

            # 原子重命名（使用 asyncio 的线程池执行器）
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, temp_file.replace, self._storage_file)
            logger.debug(f"保存数据到文件: {len(self._timestamps)} 个时间戳, {len(self._hashs)} 个哈希值, {len(self._metadatas)} 个元数据")

        except Exception as e:
            logger.error(f"保存数据文件失败: {e}")

    async def update_timestamp(self, file_path: Union[str, Path], metadata: Optional[Dict] = None) -> None:
        """
        更新文件时间戳和哈希值（如果适用），可同时设置元数据

        根据文件大小自动选择存储策略：
        - 小文件（≤5MB）：额外存储文件哈希值，使用哈希进行精确检测
        - 大文件（>5MB）：仅使用时间戳进行高效检测

        时间戳选择逻辑：
        - 自动选择文件 mtime 和当前时间中的较大值，并添加缓冲时间
        - 这确保时间戳总是向前推进，适应各种场景：
          * 读取旧文件：使用当前时间
          * 刚写入文件：使用 mtime（通常等于或接近当前时间）
          * 网络延迟：使用当前时间避免延迟问题

        Args:
            file_path: 文件路径（str 或 Path 对象，会被规范化为绝对路径）
            metadata: 可选的元数据字典，同时设置文件的元数据
        """
        # 规范化路径为绝对路径
        abs_path = str(Path(file_path).resolve())

        # 获取当前时间和文件 mtime，取较大值
        current_time = time.time() * 1000  # 毫秒
        fresh_file_stat = None
        try:
            # 单次 open + fstat 获取最新 mtime/size，避免多次系统调用带来的不一致
            fresh_file_stat = await get_fresh_file_stat(abs_path)
            file_mtime = fresh_file_stat.mtime * 1000  # 毫秒
            # 使用较新的时间，确保时间戳总是向前
            timestamp = max(current_time, file_mtime)
            logger.debug(f"时间戳选择: current={current_time:.0f}, mtime={file_mtime:.0f}, using={timestamp:.0f}")
        except FileNotFoundError:
            # 文件不存在时使用当前时间
            timestamp = current_time
            logger.warning(f"文件不存在，使用当前时间: {abs_path}")
        except Exception as e:
            # 获取 mtime 失败时使用当前时间
            timestamp = current_time
            logger.warning(f"获取 mtime 失败，使用当前时间: {abs_path}, error={e}")

        # 添加缓冲时间以应对网络文件系统的延迟
        if NETWORK_FS_MTIME_BUFFER > 0:
            buffer_ms = NETWORK_FS_MTIME_BUFFER * 1000  # 转换为毫秒
            timestamp = timestamp + buffer_ms
            logger.debug(f"添加 {NETWORK_FS_MTIME_BUFFER}s 网络文件系统缓冲时间")

        await self._load_timestamps()
        self._timestamps[abs_path] = timestamp

        # 根据文件大小决定是否计算并存储哈希值
        try:
            # 优先复用上面一次 open 得到的 size，避免重复读取
            file_size = fresh_file_stat.size if fresh_file_stat is not None else None
            if file_size is None:
                fresh_file_stat = await get_fresh_file_stat(abs_path)
                file_size = fresh_file_stat.size

            if file_size <= HASH_DETECTION_THRESHOLD:
                # 小文件：计算并存储哈希值
                file_hash = await calculate_file_hash(abs_path)
                self._hashs[abs_path] = file_hash
                logger.debug(f"小文件使用哈希检测: size={file_size}, hash={file_hash[:16]}...")
            else:
                # 大文件：移除可能存在的哈希值（如果文件变大了）
                if abs_path in self._hashs:
                    del self._hashs[abs_path]
                logger.debug(f"大文件使用时间戳检测: size={file_size}")
        except FileNotFoundError:
            if abs_path in self._hashs:
                del self._hashs[abs_path]
            logger.debug(f"文件不存在，跳过哈希更新: {abs_path}")
        except Exception as e:
            logger.warning(f"处理文件哈希时出错: {abs_path}, error={e}")
            # 出错时确保至少有时间戳

        # 如果提供了元数据，合并到现有元数据中
        if metadata is not None:
            current_metadata = self._metadatas.get(abs_path, {})
            current_metadata.update(metadata)
            self._metadatas[abs_path] = current_metadata
            logger.debug(f"同时设置文件元数据: {abs_path}")

        await self._save_timestamps()
        logger.debug(f"更新文件时间戳: {abs_path} -> {timestamp}")

    async def _get_timestamp(self, file_path: Union[str, Path]) -> Optional[float]:
        """
        获取文件的读取时间戳（内部方法）

        Args:
            file_path: 文件路径

        Returns:
            时间戳（毫秒），如果不存在则返回None
        """
        abs_path = str(Path(file_path).resolve())

        await self._load_timestamps()
        return self._timestamps.get(abs_path)

    async def _get_hash(self, file_path: Union[str, Path]) -> Optional[str]:
        """
        获取文件的哈希值（内部方法）

        Args:
            file_path: 文件路径

        Returns:
            文件哈希值，如果不存在则返回None
        """
        abs_path = str(Path(file_path).resolve())

        await self._load_timestamps()
        return self._hashs.get(abs_path)

    async def validate_file_not_modified(self, file_path: Union[str, Path]) -> Tuple[bool, str]:
        """
        验证文件在读取后是否被修改

        根据文件大小选择验证方式：
        - 小文件（≤5MB）：文件哈希精确验证
        - 大文件（>5MB）：时间戳快速验证

        Args:
            file_path: 文件路径（str 或 Path 对象）

        Returns:
            (is_valid, error_message): 验证结果和错误信息
        """
        abs_path = str(Path(file_path).resolve())

        # 检查是否已读取文件
        read_timestamp = await self._get_timestamp(file_path)
        if read_timestamp is None:
            logger.warning(f"文件验证失败 - 文件未读取: {abs_path}")
            return False, VALIDATION_ERROR_NOT_READ

        try:
            # 单次 open + fstat 获取最新 mtime/size
            fresh_file_stat = await get_fresh_file_stat(abs_path)
            current_file_size = fresh_file_stat.size
            current_file_mtime_ms = fresh_file_stat.mtime * 1000
            if current_file_size <= HASH_DETECTION_THRESHOLD:
                # 小文件：使用哈希验证
                return await self._validate_by_hash(abs_path, file_path)
            else:
                # 大文件：使用时间戳验证
                return await self._validate_by_timestamp(abs_path, read_timestamp, current_file_mtime_ms)
        except FileNotFoundError:
            return False, VALIDATION_ERROR_CHANGED
        except Exception as e:
            logger.exception(f"验证文件时出错: {abs_path}")
            return False, VALIDATION_ERROR_CHANGED

    async def _validate_by_hash(self, abs_path: str, file_path: Union[str, Path]) -> Tuple[bool, str]:
        """
        使用哈希值验证文件是否被修改

        Args:
            abs_path: 绝对路径
            file_path: 原始路径

        Returns:
            (is_valid, error_message): 验证结果和错误信息
        """
        stored_hash = await self._get_hash(file_path)
        if stored_hash is None:
            logger.warning(f"小文件哈希验证失败 - 哈希值缺失: {abs_path}")
            return False, VALIDATION_ERROR_CHANGED

        # 计算当前文件哈希值
        current_hash = await calculate_file_hash(abs_path)

        if current_hash != stored_hash:
            logger.warning(f"哈希验证失败: {abs_path} (存储: {stored_hash[:16]}..., 当前: {current_hash[:16]}...)")
            return False, VALIDATION_ERROR_CHANGED

        logger.debug(f"哈希验证通过: {abs_path} (hash: {current_hash[:16]}...)")
        return True, ""

    async def _validate_by_timestamp(self, abs_path: str, read_timestamp: float, file_mtime_ms: float) -> Tuple[bool, str]:
        """
        使用时间戳验证文件是否被修改

        Args:
            abs_path: 绝对路径
            read_timestamp: 读取时的时间戳
            file_mtime_ms: 当前文件最新修改时间（毫秒）

        Returns:
            (is_valid, error_message): 验证结果和错误信息
        """
        # 比较时间戳
        if file_mtime_ms > read_timestamp:
            return False, VALIDATION_ERROR_CHANGED

        logger.debug(f"时间戳验证通过: {abs_path} (读取时间: {read_timestamp}, 修改时间: {file_mtime_ms})")
        return True, ""

    async def get_metadata(self, file_path: Union[str, Path]) -> Optional[Dict]:
        """
        获取文件的元数据

        Args:
            file_path: 文件路径

        Returns:
            文件的元数据字典，如果不存在则返回None
        """
        abs_path = str(Path(file_path).resolve())

        await self._load_timestamps()
        return self._metadatas.get(abs_path)

    # === 元数据便捷方法 ===

    async def get_metadata_field(self, file_path: Union[str, Path], field_name: str) -> Optional[any]:
        """
        获取文件元数据中的特定字段

        Args:
            file_path: 文件路径
            field_name: 字段名称

        Returns:
            字段值，如果不存在则返回None
        """
        metadata = await self.get_metadata(file_path)
        if not metadata:
            return None
        return metadata.get(field_name)


    async def reset_all_timestamps(self) -> None:
        """
        重置所有文件数据（时间戳、哈希值和元数据）

        清空内存中的时间戳、哈希值和元数据并删除存储文件。
        通常在聊天历史压缩后调用，强制所有文件重新读取。
        """
        try:
            # 直接清空内存数据，无需先加载
            self._timestamps.clear()
            self._hashs.clear()
            self._metadatas.clear()
            self._loaded = False  # 重置加载标记

            # 删除存储文件
            if self._storage_file.exists():
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, self._storage_file.unlink)
                logger.info(f"已删除存储文件: {self._storage_file}")

            logger.info("已重置所有文件数据，所有文件需重新读取")

        except Exception as e:
            logger.error(f"重置文件数据失败: {e}")
            # 即使删除文件失败，也要清空内存数据
            self._timestamps.clear()
            self._hashs.clear()
            self._metadatas.clear()
            self._loaded = False


# 全局时间戳管理器实例
_global_timestamp_manager: Optional[FileTimestampManager] = None


def get_global_timestamp_manager() -> FileTimestampManager:
    """
    获取全局时间戳管理器实例

    Returns:
        全局时间戳管理器
    """
    global _global_timestamp_manager
    if _global_timestamp_manager is None:
        _global_timestamp_manager = FileTimestampManager()
    return _global_timestamp_manager
