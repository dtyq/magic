"""
ASR 上下文 Diff 服务

负责为录音纪要聊天模式生成智能的上下文注入内容：
- 根据文件大小决定首轮注入策略（全量/摘要/仅统计）
- 后续轮次基于快照计算增量 Diff
- 无变化时返回空字符串（不注入）
"""

import asyncio
import difflib
import hashlib
import json
import os
import time
import traceback
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Optional, Tuple

from filelock import FileLock
from loguru import logger

from app.path_manager import PathManager
from app.service.asr.asr_merge_task_manager import AsrMergeTaskManager
from app.service.asr.asr_size_config import asr_size_config
from app.service.asr.asr_base import AsrServiceBase


# 配置常量
class DiffConfig:
    """Diff 配置常量"""

    # 文件大小阈值（使用统一配置）
    SMALL_FILE_THRESHOLD = asr_size_config.SMALL_FILE_THRESHOLD  # 50KB - 全量注入
    MEDIUM_FILE_THRESHOLD = asr_size_config.MEDIUM_FILE_THRESHOLD  # 200KB - 预览模式

    # 行数阈值（辅助判断，使用统一配置）
    SMALL_FILE_LINES = asr_size_config.SMALL_FILE_LINES
    MEDIUM_FILE_LINES = asr_size_config.MEDIUM_FILE_LINES

    # Diff 截断配置
    DIFF_LINE_LIMIT = 3000
    DIFF_PREVIEW_HEAD = 1000
    DIFF_PREVIEW_TAIL = 1000

    # 首轮预览行数
    INITIAL_PREVIEW_HEAD = 30
    INITIAL_PREVIEW_TAIL = 30


@dataclass
class FileSnapshot:
    """文件快照信息"""

    path: str
    content_hash: str
    mtime: float
    size_bytes: int
    line_count: int
    content: str = ""  # 保存文件内容用于生成Diff

    def to_dict(self) -> dict:
        return {
            "path": self.path,
            "content_hash": self.content_hash,
            "mtime": self.mtime,
            "size_bytes": self.size_bytes,
            "line_count": self.line_count,
            "content": self.content,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "FileSnapshot":
        return cls(
            path=data["path"],
            content_hash=data["content_hash"],
            mtime=data["mtime"],
            size_bytes=data["size_bytes"],
            line_count=data["line_count"],
            content=data.get("content", ""),  # 兼容旧快照
        )


@dataclass
class ChatSnapshot:
    """聊天快照（包含转写和笔记）"""

    task_key: str
    timestamp: float
    transcript_file: Optional[FileSnapshot] = None
    note_file: Optional[FileSnapshot] = None

    def to_dict(self) -> dict:
        return {
            "task_key": self.task_key,
            "timestamp": self.timestamp,
            "transcript_file": self.transcript_file.to_dict() if self.transcript_file else None,
            "note_file": self.note_file.to_dict() if self.note_file else None,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ChatSnapshot":
        return cls(
            task_key=data["task_key"],
            timestamp=data["timestamp"],
            transcript_file=FileSnapshot.from_dict(data["transcript_file"]) if data.get("transcript_file") else None,
            note_file=FileSnapshot.from_dict(data["note_file"]) if data.get("note_file") else None,
        )


@dataclass
class DiffResult:
    """Diff 计算结果"""

    has_changes: bool
    added_lines: int
    removed_lines: int
    total_lines: int
    diff_text: str
    is_truncated: bool = False


class AsrContextDiffService(AsrServiceBase):
    """
    ASR 上下文 Diff 服务

    文件同步机制：
    - 使用 filelock 实现独占锁（读写都独占）
    - 适用于低频读写、无需并发读取的场景
    - API 更简洁，自动管理锁文件清理
    """

    def __init__(self):
        """初始化服务"""
        self._snapshots_dir = PathManager.get_asr_states_dir() / ".chat_snapshots"
        self._snapshots_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"{self.LOG_PREFIX} 初始化完成，快照目录: {self._snapshots_dir}")

    def _get_snapshot_path(self, task_key: str) -> Path:
        """获取快照文件路径"""
        return self._snapshots_dir / f"{task_key}.json"

    def _find_file_in_dir(self, directory: Path, keywords: list[str], label: str) -> Optional[Path]:
        """
        在目录中查找匹配关键词的 .md 文件

        Args:
            directory: 目录路径
            keywords: 关键词列表（用于文件名匹配）
            label: 文件标签（用于日志）

        Returns:
            匹配的文件路径，未找到返回 None

        查找策略:
            1. 优先匹配包含任一关键词的文件
            2. 降级到第一个 .md 文件
            3. 如果目录不存在或无文件，返回 None
        """
        if not directory.exists():
            logger.debug(f"{self.LOG_PREFIX} 目录不存在: {directory}")
            return None

        # 策略1: 查找包含关键词的文件
        for md_file in directory.glob("*.md"):
            filename_lower = md_file.name.lower()
            if any(keyword in filename_lower for keyword in keywords):
                logger.debug(f"{self.LOG_PREFIX} 找到{label}文件（关键词匹配）: {md_file.name}")
                return md_file

        # 策略2: 降级到第一个 .md 文件
        md_files = list(directory.glob("*.md"))
        if md_files:
            logger.debug(f"{self.LOG_PREFIX} 使用第一个 .md 作为{label}文件: {md_files[0].name}")
            return md_files[0]

        logger.debug(f"{self.LOG_PREFIX} 未找到{label}文件: {directory}")
        return None

    @staticmethod
    def _build_context_wrapper(
        task_key: str, _transcript_path: Optional[Path], _note_path: Optional[Path], asr_update_content: str
    ) -> str:
        """
        构建 asr_context 包装器

        Args:
            task_key: 任务键
            _transcript_path: 转写文件路径（如果存在，保留参数以兼容调用）
            _note_path: 笔记文件路径（如果存在，保留参数以兼容调用）
            asr_update_content: asr_update 块内容

        Returns:
            完整的 asr_context 块
        """
        lines = ["<asr_context>", f"  <asr_task_key>{task_key}</asr_task_key>"]

        # 直接添加 asr_update 块（缩进两个空格）
        indented_update = "\n".join(f"  {line}" if line else "  " for line in asr_update_content.split("\n"))
        lines.append(indented_update)

        lines.append("</asr_context>")

        return "\n".join(lines)

    async def _read_file_with_meta(self, file_path: Path) -> Optional[Tuple[str, FileSnapshot]]:
        """
        读取文件内容并计算元数据

        Returns:
            (content, snapshot) or None if file doesn't exist
        """

        def _sync_read():
            if not file_path.exists():
                return None

            try:
                # 读取内容
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                # 计算元数据
                content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
                mtime = file_path.stat().st_mtime
                size_bytes = len(content.encode("utf-8"))
                line_count = content.count("\n") + 1 if content else 0

                snapshot = FileSnapshot(
                    path=str(file_path),
                    content_hash=content_hash,
                    mtime=mtime,
                    size_bytes=size_bytes,
                    line_count=line_count,
                    content=content,  # 保存内容用于后续Diff
                )

                return content, snapshot
            except Exception as e:
                logger.error(f"{self.LOG_PREFIX} 读取文件失败: {file_path}, 错误: {e}")
                return None

        return await asyncio.to_thread(_sync_read)

    async def _load_snapshot(self, task_key: str) -> Optional[ChatSnapshot]:
        """加载快照（带文件锁保护）"""

        def _sync_load():
            snapshot_path = self._get_snapshot_path(task_key)
            lock_path = snapshot_path.with_suffix(".lock")

            try:
                # 获取文件锁（与写入使用相同的锁文件）
                lock = FileLock(str(lock_path), timeout=5)
                with lock:
                    # 在锁的保护下检查文件是否存在
                    if not snapshot_path.exists():
                        return None

                    # 读取文件
                    with open(snapshot_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    return ChatSnapshot.from_dict(data)

            except FileNotFoundError:
                # 文件不存在（可能在等锁期间被删除）
                return None
            except Exception as e:
                logger.error(f"{self.LOG_PREFIX} 加载快照失败: {task_key}, 错误: {e}")
                return None

        return await asyncio.to_thread(_sync_load)

    async def _persist_snapshot(self, snapshot: ChatSnapshot) -> bool:
        """持久化快照（原子写入 + 文件锁）"""

        def _sync_persist():
            snapshot_path = self._get_snapshot_path(snapshot.task_key)
            lock_path = snapshot_path.with_suffix(".lock")
            temp_path = snapshot_path.with_suffix(".tmp")

            try:
                # 获取文件锁（超时 5 秒）
                lock = FileLock(str(lock_path), timeout=5)
                with lock:
                    # 写入临时文件
                    with open(temp_path, "w", encoding="utf-8") as f:
                        json.dump(snapshot.to_dict(), f, ensure_ascii=False, indent=2)

                    # 原子替换（直接覆盖，只保留最新一次）
                    os.replace(str(temp_path), str(snapshot_path))

                # 清理锁文件
                if lock_path.exists():
                    lock_path.unlink()

                return True
            except Exception as e:
                logger.error(f"{self.LOG_PREFIX} 持久化快照失败: {snapshot.task_key}, 错误: {e}")
                if temp_path.exists():
                    temp_path.unlink()
                return False

        return await asyncio.to_thread(_sync_persist)

    @staticmethod
    def _format_timestamp(dt: datetime) -> str:
        """格式化时间戳为 'YYYY-MM-DD HH:MM:SS'"""
        return dt.strftime("%Y-%m-%d %H:%M:%S")

    @staticmethod
    def _compute_diff(old_content: str, new_content: str, file_label: str) -> DiffResult:
        """
        计算 Diff

        Args:
            old_content: 旧内容
            new_content: 新内容
            file_label: 文件标签（用于日志）

        Returns:
            DiffResult
        """
        old_lines = old_content.splitlines(keepends=True)
        new_lines = new_content.splitlines(keepends=True)

        # 计算统一 Diff
        diff_lines = list(
            difflib.unified_diff(
                old_lines, new_lines, fromfile=f"{file_label} (上次)", tofile=f"{file_label} (当前)", lineterm=""
            )
        )

        if not diff_lines:
            return DiffResult(
                has_changes=False, added_lines=0, removed_lines=0, total_lines=len(new_lines), diff_text=""
            )

        # 统计变更
        added = sum(1 for line in diff_lines if line.startswith("+") and not line.startswith("+++"))
        removed = sum(1 for line in diff_lines if line.startswith("-") and not line.startswith("---"))

        # 检查是否需要截断
        is_truncated = False
        if len(diff_lines) > DiffConfig.DIFF_LINE_LIMIT:
            is_truncated = True
            # 保留头尾
            head = diff_lines[: DiffConfig.DIFF_PREVIEW_HEAD]
            tail = diff_lines[-DiffConfig.DIFF_PREVIEW_TAIL :]
            omitted = len(diff_lines) - len(head) - len(tail)
            diff_lines = head + [f"\n[省略 {omitted} 行变更...]\n"] + tail

        diff_text = "\n".join(diff_lines)

        return DiffResult(
            has_changes=True,
            added_lines=added,
            removed_lines=removed,
            total_lines=len(new_lines),
            diff_text=diff_text,
            is_truncated=is_truncated,
        )

    @staticmethod
    def _format_initial_content(content: str, snapshot: FileSnapshot, file_label: str) -> str:
        """
        格式化首轮内容（根据大小决定策略）

        Returns:
            格式化后的内容块
        """
        lines = content.splitlines()
        line_count = len(lines)
        size_bytes = snapshot.size_bytes
        size_kb = size_bytes / 1024

        # 策略1: 小文件 - 全量注入
        if size_bytes < DiffConfig.SMALL_FILE_THRESHOLD and line_count < DiffConfig.SMALL_FILE_LINES:
            return f"[{file_label}] 完整内容 ({line_count}行, {size_kb:.1f}KB)\n{content}"

        # 策略2: 大文件 - 仅统计
        if size_bytes > DiffConfig.MEDIUM_FILE_THRESHOLD or line_count > DiffConfig.MEDIUM_FILE_LINES:
            return (
                f"[{file_label}] 统计信息 ({line_count}行, {size_kb:.1f}KB, path={snapshot.path})\n\n"
                f"💡 文件过大，仅显示统计信息。请根据需要自行读取文件内容。"
            )

        # 策略3: 中等文件 - 头尾预览
        head_lines = lines[: DiffConfig.INITIAL_PREVIEW_HEAD]
        tail_lines = lines[-DiffConfig.INITIAL_PREVIEW_TAIL :]
        omitted = line_count - len(head_lines) - len(tail_lines)

        preview = "\n".join(head_lines)
        preview += f"\n\n[省略中间 {omitted} 行...]\n\n"
        preview += "\n".join(tail_lines)

        return (
            f"[{file_label}] 预览 (前{len(head_lines)}行 + 后{len(tail_lines)}行, 共{line_count}行, {size_kb:.1f}KB)\n"
            f"{preview}\n\n"
            f"💡 文件较大，仅显示预览。如需完整内容，可使用 read_files 工具读取：\n"
            f"   path={snapshot.path}"
        )

    @staticmethod
    def _format_diff_content(diff_result: DiffResult, file_label: str, _file_path: str) -> str:
        """格式化 Diff 内容（增强版）"""
        if not diff_result.has_changes:
            return ""

        # 构建标题
        header = f"[{file_label}] +{diff_result.added_lines} -{diff_result.removed_lines}"

        # 截断提示
        if diff_result.is_truncated:
            header += " (Diff 已截断，显示部分变更)"

        # 变更量级提示
        total_changes = diff_result.added_lines + diff_result.removed_lines
        if total_changes <= 5:
            header += " [小幅更新]"
        elif total_changes >= 50:
            header += " [大量变更]"

        return f"{header}\n{diff_result.diff_text}"

    async def build_diff_block(self, task_key: str) -> str:
        """
        构建 ASR 上下文 Diff 块（带性能监控）

        Returns:
            格式化的 <ASR-UPDATE> 块，如果无变化或出错则返回空字符串
        """
        start_time = time.time()

        try:
            # 记录各步骤耗时
            timings = {}

            # 1. 读取任务状态
            step_start = time.time()
            task_state = await AsrMergeTaskManager.instance().get_task(task_key)
            timings["read_task"] = time.time() - step_start

            if not task_state:
                logger.warning(f"{self.LOG_PREFIX} 任务不存在: {task_key}")
                return ""

            # 2. 动态解析文件路径
            step_start = time.time()
            workspace_dir = PathManager.get_workspace_dir()

            transcript_path = None
            note_path = None

            # 2.1 笔记路径解析（三层优先级）
            # 优先级1: start 阶段传入的配置（最准确）
            if task_state.note_file_config and task_state.note_file_config.get("source_path"):
                note_relative = task_state.note_file_config["source_path"]
                note_path = workspace_dir / note_relative
                logger.debug(f"{self.LOG_PREFIX} 从 note_file_config 读取笔记路径: {note_path}")
            # 优先级2: finalize 后的 files 字段
            elif task_state.files and "note_file" in task_state.files:
                note_relative = task_state.files["note_file"].get("path")
                if note_relative:
                    note_path = workspace_dir / note_relative
                    logger.debug(f"{self.LOG_PREFIX} 从 task_state.files 读取笔记路径: {note_path}")
            # 优先级3: 降级策略 - 从 target_dir 关键词查找
            elif task_state.target_dir:
                note_path = self._find_file_in_dir(
                    workspace_dir / task_state.target_dir, keywords=["笔记", "note", "notes"], label="笔记"
                )

            # 2.2 转写文件路径解析（三层优先级）
            # 优先级1: start 阶段传入的配置（最准确）
            if task_state.transcript_file_config and task_state.transcript_file_config.get("source_path"):
                transcript_relative = task_state.transcript_file_config["source_path"]
                transcript_path = workspace_dir / transcript_relative
                logger.debug(f"{self.LOG_PREFIX} 从 transcript_file_config 读取转写路径: {transcript_path}")
            # 优先级2: 降级策略 - 从 source_dir 关键词查找
            elif task_state.source_dir:
                transcript_path = self._find_file_in_dir(
                    workspace_dir / task_state.source_dir,
                    keywords=["识别", "转写", "transcript", "transcription"],
                    label="转写",
                )

            timings["resolve_paths"] = time.time() - step_start

            # 3. 读取当前文件内容
            step_start = time.time()
            transcript_data = None
            note_data = None

            if transcript_path:
                transcript_data = await self._read_file_with_meta(transcript_path)
            if note_path:
                note_data = await self._read_file_with_meta(note_path)

            timings["read_files"] = time.time() - step_start

            if not transcript_data and not note_data:
                logger.debug(f"{self.LOG_PREFIX} {task_key}: 未找到任何文件")
                return ""

            # 4. 加载快照
            step_start = time.time()
            old_snapshot = await self._load_snapshot(task_key)
            timings["load_snapshot"] = time.time() - step_start

            # 5. 首轮：无快照
            if not old_snapshot:
                logger.info(f"{self.LOG_PREFIX} {task_key}: 首轮聊天，生成初始上下文")

                content_blocks = []

                if transcript_data:
                    content, snapshot = transcript_data
                    content_blocks.append(self._format_initial_content(content, snapshot, "流式转写"))

                if note_data:
                    content, snapshot = note_data
                    content_blocks.append(self._format_initial_content(content, snapshot, "笔记"))

                # 保存快照
                step_start = time.time()
                new_snapshot = ChatSnapshot(
                    task_key=task_key,
                    timestamp=datetime.now().timestamp(),
                    transcript_file=transcript_data[1] if transcript_data else None,
                    note_file=note_data[1] if note_data else None,
                )
                await self._persist_snapshot(new_snapshot)
                timings["persist_snapshot"] = time.time() - step_start

                # 记录总耗时
                total_time = time.time() - start_time
                logger.info(
                    f"{self.LOG_PREFIX} {task_key} 首轮完成，耗时 {total_time:.3f}s "
                    f"(任务 {timings['read_task']:.3f}s, "
                    f"路径 {timings['resolve_paths']:.3f}s, "
                    f"文件 {timings['read_files']:.3f}s, "
                    f"快照 {timings['load_snapshot']:.3f}s, "
                    f"保存 {timings['persist_snapshot']:.3f}s)"
                )

                timestamp_str = self._format_timestamp(datetime.now())
                asr_update = (
                    f'<asr_update type="initial" user_message_time="{timestamp_str}">\n'
                    + "\n\n".join(content_blocks)
                    + "\n</asr_update>"
                )
                return self._build_context_wrapper(task_key, transcript_path, note_path, asr_update)

            # 6. 后续轮次：计算 Diff
            step_start = time.time()
            diff_blocks = []

            # 转写 Diff
            if transcript_data:
                new_content, new_snapshot = transcript_data

                # 检查是否有旧快照且内容发生变化
                if old_snapshot.transcript_file:
                    if old_snapshot.transcript_file.content_hash != new_snapshot.content_hash:
                        # 从快照中读取旧内容
                        old_content = old_snapshot.transcript_file.content
                        diff_result = self._compute_diff(old_content, new_content, "流式转写")
                        if diff_result.has_changes:
                            diff_blocks.append(self._format_diff_content(diff_result, "流式转写", str(transcript_path)))
                else:
                    # 旧快照中没有转写文件，这是新文件
                    # 将整个内容视为新增
                    diff_result = DiffResult(
                        has_changes=True,
                        added_lines=new_snapshot.line_count,
                        removed_lines=0,
                        total_lines=new_snapshot.line_count,
                        diff_text=f"+++ 新文件\n{new_content}",
                        is_truncated=False,
                    )
                    diff_blocks.append(self._format_diff_content(diff_result, "流式转写", str(transcript_path)))

            # 笔记 Diff
            if note_data:
                new_content, new_snapshot = note_data

                # 检查是否有旧快照且内容发生变化
                if old_snapshot.note_file:
                    if old_snapshot.note_file.content_hash != new_snapshot.content_hash:
                        # 从快照中读取旧内容
                        old_content = old_snapshot.note_file.content
                        diff_result = self._compute_diff(old_content, new_content, "笔记")
                        if diff_result.has_changes:
                            diff_blocks.append(self._format_diff_content(diff_result, "笔记", str(note_path)))
                else:
                    # 旧快照中没有笔记文件，这是新文件
                    diff_result = DiffResult(
                        has_changes=True,
                        added_lines=new_snapshot.line_count,
                        removed_lines=0,
                        total_lines=new_snapshot.line_count,
                        diff_text=f"+++ 新文件\n{new_content}",
                        is_truncated=False,
                    )
                    diff_blocks.append(self._format_diff_content(diff_result, "笔记", str(note_path)))

            timings["compute_diff"] = time.time() - step_start

            # 7. 无变化：生成"无变化"通知块
            if not diff_blocks:
                logger.debug(f"{self.LOG_PREFIX} {task_key}: 内容无变化，生成无变化通知块")

                # 记录总耗时
                total_time = time.time() - start_time
                logger.info(
                    f"{self.LOG_PREFIX} {task_key} 无变化完成，耗时 {total_time:.3f}s "
                    f"(任务 {timings['read_task']:.3f}s, "
                    f"路径 {timings['resolve_paths']:.3f}s, "
                    f"文件 {timings['read_files']:.3f}s, "
                    f"快照 {timings['load_snapshot']:.3f}s, "
                    f"Diff {timings['compute_diff']:.3f}s)"
                )

                timestamp_str = self._format_timestamp(datetime.now())
                since_str = self._format_timestamp(datetime.fromtimestamp(old_snapshot.timestamp))
                asr_update = f'<asr_update type="no-change" user_message_time="{timestamp_str}" last_message_time="{since_str}">\n录音内容和笔记均无变化\n</asr_update>'
                return self._build_context_wrapper(task_key, transcript_path, note_path, asr_update)

            # 8. 保存新快照
            step_start = time.time()
            new_snapshot = ChatSnapshot(
                task_key=task_key,
                timestamp=datetime.now().timestamp(),
                transcript_file=transcript_data[1] if transcript_data else old_snapshot.transcript_file,
                note_file=note_data[1] if note_data else old_snapshot.note_file,
            )
            await self._persist_snapshot(new_snapshot)
            timings["persist_snapshot"] = time.time() - step_start

            # 记录总耗时
            total_time = time.time() - start_time
            logger.info(
                f"{self.LOG_PREFIX} {task_key} Diff完成，耗时 {total_time:.3f}s "
                f"(任务 {timings['read_task']:.3f}s, "
                f"路径 {timings['resolve_paths']:.3f}s, "
                f"文件 {timings['read_files']:.3f}s, "
                f"快照 {timings['load_snapshot']:.3f}s, "
                f"Diff {timings['compute_diff']:.3f}s, "
                f"保存 {timings['persist_snapshot']:.3f}s)"
            )

            # 9. 返回 Diff 块
            timestamp_str = self._format_timestamp(datetime.now())
            since_str = self._format_timestamp(datetime.fromtimestamp(old_snapshot.timestamp))
            asr_update = (
                f'<asr_update type="diff" user_message_time="{timestamp_str}" last_message_time="{since_str}">\n'
                + "\n\n".join(diff_blocks)
                + "\n</asr_update>"
            )

            return self._build_context_wrapper(task_key, transcript_path, note_path, asr_update)

        except Exception as e:
            total_time = time.time() - start_time
            logger.error(f"{self.LOG_PREFIX} 失败，耗时 {total_time:.3f}s, 错误: {e}")
            logger.error(traceback.format_exc())
            return ""

    @classmethod
    @lru_cache
    def instance(cls) -> "AsrContextDiffService":
        """获取ASR上下文Diff服务单例（懒加载）"""
        return cls()
