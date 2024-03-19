"""
Shell命令解析器

用于解析shell命令中的文件操作，识别需要dispatch的文件事件
"""
from pathlib import Path
from typing import List, Optional, Tuple

from agentlang.event.event import EventType
from agentlang.logger import get_logger

logger = get_logger(__name__)


class ShellCommandParser:
    """Shell命令解析器，用于识别文件操作命令"""

    @staticmethod
    def parse_file_operations(command: str, work_dir: Path) -> Tuple[List[Tuple[str, EventType]], List[Tuple[str, EventType]]]:
        """
        解析命令中的文件操作，返回执行前后需要dispatch的事件

        Args:
            command: shell命令
            work_dir: 工作目录

        Returns:
            Tuple[List[Tuple[str, EventType]], List[Tuple[str, EventType]]]:
            (执行前事件列表, 执行后事件列表)，每个元组包含(文件路径, 事件类型)
        """
        before_events = []
        after_events = []

        # 移除多余的空格并分割命令
        cmd_parts = command.strip().split()
        if not cmd_parts:
            return before_events, after_events

        cmd = cmd_parts[0]

        try:
            # 文件创建命令
            if cmd == 'touch':
                # touch file1 file2 ...
                for file_path in cmd_parts[1:]:
                    if not file_path.startswith('-'):  # 跳过选项参数
                        abs_path = ShellCommandParser._resolve_path(file_path, work_dir)
                        if abs_path:
                            file_exists = abs_path.exists()
                            before_event = EventType.BEFORE_FILE_UPDATED if file_exists else EventType.BEFORE_FILE_CREATED
                            after_event = EventType.FILE_UPDATED if file_exists else EventType.FILE_CREATED
                            before_events.append((str(abs_path), before_event))
                            after_events.append((str(abs_path), after_event))

            elif cmd == 'mkdir':
                # mkdir dir1 dir2 ...
                for dir_path in cmd_parts[1:]:
                    if not dir_path.startswith('-'):  # 跳过选项参数
                        abs_path = ShellCommandParser._resolve_path(dir_path, work_dir)
                        if abs_path:
                            before_events.append((str(abs_path), EventType.BEFORE_FILE_CREATED))
                            after_events.append((str(abs_path), EventType.FILE_CREATED))

            elif cmd == 'cp':
                # cp source dest 或 cp source1 source2 ... dest_dir
                if len(cmd_parts) >= 3:
                    dest = cmd_parts[-1]
                    dest_path = ShellCommandParser._resolve_path(dest, work_dir)
                    if dest_path:
                        # 如果目标是目录，则为每个源文件创建事件
                        if dest_path.is_dir() or (not dest_path.exists() and len(cmd_parts) > 3):
                            for src in cmd_parts[1:-1]:
                                if not src.startswith('-'):
                                    src_name = Path(src).name
                                    target_file = dest_path / src_name
                                    file_exists = target_file.exists()
                                    before_event = EventType.BEFORE_FILE_UPDATED if file_exists else EventType.BEFORE_FILE_CREATED
                                    after_event = EventType.FILE_UPDATED if file_exists else EventType.FILE_CREATED
                                    before_events.append((str(target_file), before_event))
                                    after_events.append((str(target_file), after_event))
                        else:
                            # 单文件复制
                            file_exists = dest_path.exists()
                            before_event = EventType.BEFORE_FILE_UPDATED if file_exists else EventType.BEFORE_FILE_CREATED
                            after_event = EventType.FILE_UPDATED if file_exists else EventType.FILE_CREATED
                            before_events.append((str(dest_path), before_event))
                            after_events.append((str(dest_path), after_event))

            elif cmd == 'mv':
                # mv source dest 或 mv source1 source2 ... dest_dir
                if len(cmd_parts) >= 3:
                    sources = cmd_parts[1:-1]
                    dest = cmd_parts[-1]
                    dest_path = ShellCommandParser._resolve_path(dest, work_dir)

                    if dest_path:
                        for src in sources:
                            if not src.startswith('-'):
                                src_path = ShellCommandParser._resolve_path(src, work_dir)
                                if src_path and src_path.exists():
                                    # 删除源文件事件
                                    before_events.append((str(src_path), EventType.BEFORE_FILE_DELETED))
                                    after_events.append((str(src_path), EventType.FILE_DELETED))

                                    # 创建目标文件事件
                                    if dest_path.is_dir():
                                        target_file = dest_path / src_path.name
                                    else:
                                        target_file = dest_path

                                    file_exists = target_file.exists()
                                    before_event = EventType.BEFORE_FILE_UPDATED if file_exists else EventType.BEFORE_FILE_CREATED
                                    after_event = EventType.FILE_UPDATED if file_exists else EventType.FILE_CREATED
                                    before_events.append((str(target_file), before_event))
                                    after_events.append((str(target_file), after_event))

            elif cmd == 'rm':
                # rm file1 file2 ... 或 rm -rf dir
                for file_path in cmd_parts[1:]:
                    if not file_path.startswith('-'):  # 跳过选项参数
                        abs_path = ShellCommandParser._resolve_path(file_path, work_dir)
                        if abs_path and abs_path.exists():
                            before_events.append((str(abs_path), EventType.BEFORE_FILE_DELETED))
                            after_events.append((str(abs_path), EventType.FILE_DELETED))

            elif cmd == 'rmdir':
                # rmdir dir1 dir2 ...
                for dir_path in cmd_parts[1:]:
                    if not dir_path.startswith('-'):  # 跳过选项参数
                        abs_path = ShellCommandParser._resolve_path(dir_path, work_dir)
                        if abs_path and abs_path.exists():
                            before_events.append((str(abs_path), EventType.BEFORE_FILE_DELETED))
                            after_events.append((str(abs_path), EventType.FILE_DELETED))

        except Exception as e:
            logger.warning(f"解析文件操作命令时出错: {e}")

        return before_events, after_events

    @staticmethod
    def _resolve_path(path_str: str, work_dir: Path) -> Optional[Path]:
        """
        解析路径，返回绝对路径

        Args:
            path_str: 路径字符串
            work_dir: 工作目录

        Returns:
            Optional[Path]: 解析后的绝对路径，如果路径无效则返回None
        """
        try:
            path = Path(path_str)
            if path.is_absolute():
                return path
            else:
                return work_dir / path
        except Exception:
            return None
