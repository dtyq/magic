from typing import Generic, TypeVar, Union, Dict, Any
import os
from pathlib import Path
from contextlib import asynccontextmanager

from app.core.context.agent_context import AgentContext
from agentlang.context.tool_context import ToolContext
from app.core.entity.event.file_event import FileEventData
from agentlang.event.event import EventType
from app.core.entity.message.server_message import DisplayType
from agentlang.logger import get_logger
from app.tools.core.base_tool import BaseTool
from app.tools.core.base_tool_params import BaseToolParams

logger = get_logger(__name__)

# 定义参数类型变量
T = TypeVar('T', bound=BaseToolParams)


class AbstractFileTool(BaseTool[T], Generic[T]):
    """
    抽象文件工具基类

    为文件操作工具提供通用的文件事件分发功能
    """

    async def _dispatch_file_event(self, tool_context: ToolContext, filepath: str, event_type: EventType, is_screenshot: bool = False, source: int = 3) -> None:
        """
        分发文件事件

        Args:
            tool_context: 工具上下文
            filepath: 文件路径
            event_type: 事件类型（FILE_CREATED, FILE_UPDATED 或 FILE_DELETED）
            is_screenshot: 是否是截图
            source: 文件来源，默认为3（容器生成）
        """
        if tool_context is None:
            logger.warning(f"tool_context 为 None，跳过文件事件分发: {event_type} - {filepath}")
            return

        # 创建事件数据，包含 tool_context
        event_data = FileEventData(
            filepath=filepath,
            source=source,
            event_type=event_type,
            tool_context=tool_context,
            is_screenshot=is_screenshot
        )

        try:
            agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
            if agent_context:
                await agent_context.dispatch_event(event_type, event_data)
                logger.info(f"已分发文件事件: {event_type} - {filepath}")
            else:
                logger.error("未从 ToolContext 中找到 AgentContext 扩展")
        except Exception as e:
            # 打印调用栈信息以便于调试
            import traceback
            stack_trace = traceback.format_exc()
            logger.error(f"分发文件事件失败: {e}，调用栈信息:\n{stack_trace}")

    @asynccontextmanager
    async def _file_versioning_context(
        self,
        tool_context: ToolContext,
        file_path: Union[str, Path],
        update_timestamp: bool = True
    ):
        """
        文件版本控制上下文管理器

        自动处理文件操作的版本控制事件流程：
        1. 进入时：检查文件是否存在，触发 BEFORE_FILE_CREATED/UPDATED 事件
        2. 退出时：可选更新时间戳，触发 FILE_CREATED/UPDATED 事件

        Args:
            tool_context: 工具上下文
            file_path: 文件路径
            update_timestamp: 是否更新时间戳（默认 True）
                            - True: 主模型参与的文件操作（如 write_file, edit_file）
                            - False: 工具自动生成的文件（如 analyze_audio_project 生成的分析文件）

        Yields:
            bool: 文件操作前是否存在（True=更新，False=创建）

        Example:
            # 主模型编辑文件（需要 timestamp）
            async with self._file_versioning_context(tool_context, file_path) as file_exists:
                await async_write_text(file_path, content)

            # 工具自动生成文件（不需要 timestamp）
            async with self._file_versioning_context(tool_context, file_path, update_timestamp=False):
                await async_write_text(file_path, auto_generated_content)
        """
        from app.utils.async_file_utils import async_exists

        path_str = str(file_path)
        file_exists = await async_exists(path_str)

        # 触发 BEFORE 事件
        before_event = EventType.BEFORE_FILE_UPDATED if file_exists else EventType.BEFORE_FILE_CREATED
        await self._dispatch_file_event(tool_context, path_str, before_event)

        try:
            yield file_exists
        finally:
            # 可选更新时间戳
            if update_timestamp:
                try:
                    await self.get_horizon(tool_context).update_timestamp(Path(path_str))
                except Exception as _e:
                    logger.warning(f"[AbstractFileTool] update_timestamp 失败: {_e}")

            # 触发 AFTER 事件
            after_event = EventType.FILE_UPDATED if file_exists else EventType.FILE_CREATED
            await self._dispatch_file_event(tool_context, path_str, after_event)

    async def _write_text_with_versioning(
        self,
        tool_context: ToolContext,
        file_path: Union[str, Path],
        content: str,
        encoding: str = 'utf-8',
        update_timestamp: bool = True
    ) -> bool:
        """
        带版本控制的文本写入

        Args:
            tool_context: 工具上下文
            file_path: 文件路径
            content: 文本内容
            encoding: 编码格式
            update_timestamp: 是否更新时间戳（默认 True）

        Returns:
            bool: 文件操作前是否存在（True=更新，False=创建）
        """
        from app.utils.async_file_utils import async_write_text

        async with self._file_versioning_context(tool_context, file_path, update_timestamp) as file_exists:
            await async_write_text(file_path, content, encoding)
            return file_exists

    async def _write_json_with_versioning(
        self,
        tool_context: ToolContext,
        file_path: Union[str, Path],
        data: Dict[str, Any],
        update_timestamp: bool = True,
        **kwargs
    ) -> bool:
        """
        带版本控制的 JSON 写入

        Args:
            tool_context: 工具上下文
            file_path: 文件路径
            data: JSON 数据
            update_timestamp: 是否更新时间戳（默认 True）
            **kwargs: json.dumps 额外参数

        Returns:
            bool: 文件操作前是否存在（True=更新，False=创建）
        """
        from app.utils.async_file_utils import async_write_json

        async with self._file_versioning_context(tool_context, file_path, update_timestamp) as file_exists:
            await async_write_json(file_path, data, **kwargs)
            return file_exists

    async def _copy_file_with_versioning(
        self,
        tool_context: ToolContext,
        src_path: Union[str, Path],
        dst_path: Union[str, Path],
        update_timestamp: bool = True
    ) -> bool:
        """
        带版本控制的文件复制

        Args:
            tool_context: 工具上下文
            src_path: 源文件路径
            dst_path: 目标文件路径
            update_timestamp: 是否更新时间戳（默认 True）

        Returns:
            bool: 目标文件操作前是否存在（True=更新，False=创建）
        """
        from app.utils.async_file_utils import async_copy2

        async with self._file_versioning_context(tool_context, dst_path, update_timestamp) as file_exists:
            await async_copy2(src_path, dst_path)
            return file_exists

    def get_display_type_by_extension(self, file_path: str) -> DisplayType:
        """
        根据文件扩展名获取适当的 DisplayType

        Args:
            file_path: 文件路径

        Returns:
            DisplayType: 展示类型
        """
        file_name = os.path.basename(file_path)
        file_extension = os.path.splitext(file_name)[1].lower()

        display_type = DisplayType.TEXT
        if file_extension in ['.md', '.markdown']:
            display_type = DisplayType.MD
        elif file_extension in ['.html', '.htm']:
            display_type = DisplayType.HTML
        elif file_extension in ['.php', '.py', '.js', '.ts', '.java', '.c', '.cpp', '.h', '.hpp', '.json', '.yaml', '.yml', '.toml', '.ini', '.sh']:
            display_type = DisplayType.CODE
        elif file_extension in ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']:
            display_type = DisplayType.IMAGE
        return display_type
