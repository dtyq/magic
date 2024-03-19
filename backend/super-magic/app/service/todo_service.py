"""
Todo持久化服务

负责todo数据的文件持久化操作
"""
import json
from typing import List
from datetime import datetime

from app.core.entity.todo import TodoItem, TodoFile
from app.paths import PathManager
from agentlang.logger import get_logger

logger = get_logger(__name__)


class TodoService:
    """Todo持久化服务"""

    @staticmethod
    async def load_todos() -> List[TodoItem]:
        """
        从文件加载todo列表

        Returns:
            List[TodoItem]: todo列表,如果文件不存在则返回空列表
        """
        try:
            todo_file = PathManager.get_todos_file()

            if not todo_file.exists():
                logger.debug(f"Todo文件不存在: {todo_file}, 返回空列表")
                return []

            # 读取文件
            with open(todo_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # 解析为TodoFile对象
            todo_file_obj = TodoFile(**data)

            logger.info(f"成功加载 {len(todo_file_obj.todos)} 个todo项")
            return todo_file_obj.todos

        except Exception as e:
            logger.error(f"加载todo文件失败: {e}", exc_info=True)
            return []

    @staticmethod
    async def save_todos(todos: List[TodoItem]) -> bool:
        """
        保存todo列表到文件

        Args:
            todos: todo列表

        Returns:
            bool: 是否保存成功
        """
        try:
            todo_file = PathManager.get_todos_file()

            # 尝试加载现有文件以获取created_at
            created_at = datetime.now()
            if todo_file.exists():
                try:
                    with open(todo_file, 'r', encoding='utf-8') as f:
                        existing_data = json.load(f)
                        if 'created_at' in existing_data:
                            created_at = datetime.fromisoformat(existing_data['created_at'])
                except Exception as e:
                    logger.warning(f"无法读取现有文件的created_at: {e}")

            # 创建TodoFile对象
            todo_file_obj = TodoFile(
                created_at=created_at,
                updated_at=datetime.now(),
                todos=todos
            )

            # 序列化并保存
            with open(todo_file, 'w', encoding='utf-8') as f:
                # 使用model_dump()转为字典,然后json.dump保存
                data = todo_file_obj.model_dump()
                # 处理datetime对象序列化
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)

            logger.info(f"成功保存 {len(todos)} 个todo项到文件")
            return True

        except Exception as e:
            logger.error(f"保存todo文件失败: {e}", exc_info=True)
            return False

    @staticmethod
    def format_todos_simple(todos: List[TodoItem]) -> str:
        """
        格式化 todo 列表为简单的文本格式

        格式: [{status}] {id}: {content}

        Args:
            todos: todo 列表

        Returns:
            str: 格式化后的文本
        """
        # 如果没有任务
        if not todos:
            return "当前没有待办任务。"

        lines = ["Format: [status] id: content", ""]
        for todo in todos:
            lines.append(f"[{todo.status}] {todo.id}: {todo.content}")

        return "\n".join(lines)
