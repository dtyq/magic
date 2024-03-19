"""
附件排序工具类

提供各种附件排序和过滤策略，用于处理 Agent 产生的附件列表。
支持按 finish_task 优先级排序、时间戳排序、文件存在性检查等功能。

==============================================================================
未来优化方向：让 AI 主动指定交付物文件顺序
==============================================================================

当前实现：
- 如果 AI 调用了 finish_task 工具并传入 files 参数，则按该列表顺序排序
- 否则回退到时间戳排序（最新修改的在前），并硬编码 index 文件优先

存在的问题：
- finish_task 工具的语义是"结束任务"，但实际上它的主要作用是指定文件展示顺序，这导致工具职责不清晰，且名字有误导性
- 大模型不能很好地理解调用 finish_task 之后会退出 Agent 循环这个事情，大模型会以为自己在调用该工具之后还能继续输出，并且使用 Prompt 引导的效果并不理想。

已讨论但未采纳的替代方案：

方案 1：新建独立工具 mark_deliverables 或 set_output_files
  - 优点：语义清晰，职责单一，与 finish_task 解耦
  - 优点：AI 可以在任何时候标记交付物
  - 缺点：多一轮工具调用，增加延迟
  - 缺点：需要在 prompt 中引导 AI 何时调用
  - 未采纳原因：时间戳排序 + index 优先已经能覆盖大部分场景，额外工具调用的成本暂时不值得

方案 2：在 AI 回复中解析特殊标记（如 <!-- DELIVERABLES: file1, file2 -->）
  - 优点：不需要额外工具调用
  - 缺点：依赖文本解析，不可靠，AI 可能忘记或格式错误
  - 未采纳原因：可靠性差，维护成本高

方案 3：保留 finish_task 但改为可选，调整为"标记交付物"的语义
  - 优点：最小改动
  - 缺点：finish_task 的名字暗示"结束"，改语义会造成更大混淆
  - 未采纳原因：不如直接废弃 finish_task，简化系统

推荐的未来方向：
- 如果发现时间戳排序 + index 优先无法满足需求（如多文件项目需要精确控制顺序）
- 可以实现方案 1：创建轻量级工具 set_output_files
- 设计为可选工具：AI 只在需要精确控制顺序时才调用
- 工具描述应明确说明："如果只有一个主要输出文件或顺序不重要，无需调用此工具"

相关代码位置：
- 保存交付物列表：app/tools/finish_task.py (已废弃)
- 读取并排序：本文件 _get_finish_task_ordered_attachments()
- 使用排序结果：app/core/entity/factory/task_message_factory.py:233-237
- 字段定义：app/core/context/agent_context.py:140

==============================================================================
"""

import os
from typing import List, Dict, Optional
from agentlang.logger import get_logger
from app.core.entity.attachment import Attachment, AttachmentTag
from app.core.context.agent_context import AgentContext

logger = get_logger(__name__)


class AttachmentSorter:
    """附件排序工具类"""

    @classmethod
    def get_processed_attachments(cls, agent_context: AgentContext) -> List[Attachment]:
        """
        获取处理后的附件列表，支持 finish_task 优先级和回退策略

        Args:
            agent_context: Agent 上下文，包含附件信息

        Returns:
            List[Attachment]: 处理后的附件列表，按正确顺序排列
        """
        # Step 1: 获取有效附件（过滤浏览器附件和隐藏文件）
        valid_attachments = cls._get_valid_attachments(agent_context)

        # Step 2: 尝试按 finish_task 优先级排序
        finish_task_ordered = cls._get_finish_task_ordered_attachments(agent_context, valid_attachments)
        if finish_task_ordered:
            logger.info(f"Using {len(finish_task_ordered)} attachments from finish_task order")
            return cls._filter_existing_files(finish_task_ordered, agent_context)

        # Step 3: 回退到时间戳排序
        logger.info("No finish_task files found, using timestamp-based fallback")
        timestamp_ordered = cls._get_timestamp_ordered_attachments(valid_attachments)
        return cls._filter_existing_files(timestamp_ordered, agent_context)

    @classmethod
    def _get_valid_attachments(cls, agent_context: AgentContext) -> List[Attachment]:
        """
        获取有效附件，过滤掉浏览器附件和隐藏文件

        Args:
            agent_context: Agent 上下文

        Returns:
            List[Attachment]: 有效附件列表
        """
        all_attachments = agent_context.get_attachments()

        if all_attachments:
            for att in all_attachments:
                is_hidden = cls._is_hidden_file(att.filename)
                logger.info(f"  - filename: {att.filename}, file_tag: {att.file_tag}, is_hidden: {is_hidden}")

        # 过滤浏览器附件和隐藏文件
        valid_attachments = [
            att for att in all_attachments
            if att.file_tag != AttachmentTag.BROWSER and not cls._is_hidden_file(att.filename)
        ]

        return valid_attachments

    @classmethod
    def _is_hidden_file(cls, filename: str) -> bool:
        """检查文件是否为隐藏文件（以点开头）"""
        basename = filename.split('/')[-1]
        return basename.startswith('.')

    @classmethod
    def _get_finish_task_ordered_attachments(cls, agent_context: AgentContext, valid_attachments: List[Attachment]) -> Optional[List[Attachment]]:
        """
        按 finish_task 文件优先级排序附件

        Args:
            agent_context: Agent 上下文
            valid_attachments: 有效附件列表

        Returns:
            Optional[List[Attachment]]: 如果存在 finish_task 文件则返回排序后的附件，否则返回 None
        """
        # 检查是否存在 finish_task 文件配置
        if not agent_context.shared_context.has_field("finish_task_files"):
            return None

        finish_task_files = agent_context.shared_context.get_field("finish_task_files")

        if not finish_task_files:
            return None

        # 创建文件名到附件的映射，提高查找效率
        attachment_map = {att.filename: att for att in valid_attachments}
        ordered_attachments = []

        # 处理每个 finish_task 文件/目录
        for file_path in finish_task_files:
            if file_path.endswith('/'):
                # 处理目录：查找目录下的所有附件
                dir_attachments = cls._find_directory_attachments(file_path, valid_attachments)
                ordered_attachments.extend(dir_attachments)
            else:
                # 处理文件：查找对应的附件
                matched_attachment = cls._find_file_attachment(file_path, attachment_map)
                if matched_attachment:
                    ordered_attachments.append(matched_attachment)

        return ordered_attachments if ordered_attachments else None

    @classmethod
    def _find_directory_attachments(cls, dir_path: str, valid_attachments: List[Attachment]) -> List[Attachment]:
        """
        查找指定目录下的所有附件

        Args:
            dir_path: 目录路径
            valid_attachments: 有效附件列表

        Returns:
            List[Attachment]: 目录下的附件列表，按文件名排序
        """
        dir_attachments = [
            att for att in valid_attachments
            if att.filename.startswith(dir_path)
        ]
        dir_attachments.sort(key=lambda att: att.filename)
        return dir_attachments

    @classmethod
    def _find_file_attachment(cls, file_path: str, attachment_map: Dict[str, Attachment]) -> Optional[Attachment]:
        """
        查找文件对应的附件，支持精确匹配和基本文件名匹配

        Args:
            file_path: 要查找的文件路径
            attachment_map: 文件名到附件的映射

        Returns:
            Optional[Attachment]: 找到的附件，如果未找到则返回 None
        """
        # 1. 尝试精确匹配
        if file_path in attachment_map:
            return attachment_map[file_path]

        # 2. 尝试基本文件名匹配
        file_basename = os.path.basename(file_path)
        for att_filename, attachment in attachment_map.items():
            if os.path.basename(att_filename) == file_basename:
                logger.debug(f"Matched file '{file_path}' to attachment '{att_filename}' by basename")
                return attachment

        return None

    @classmethod
    def _get_timestamp_ordered_attachments(cls, valid_attachments: List[Attachment]) -> List[Attachment]:
        """
        按时间戳排序附件（最新的在前），并确保 index 文件优先

        硬编码规则：
        - 如果存在文件名包含 "index" 的文件（不区分大小写），将其放在第一位
        - 其余文件按时间戳排序（最新的在前）

        Args:
            valid_attachments: 有效附件列表

        Returns:
            List[Attachment]: 按时间戳排序的附件列表，index 文件在最前
        """
        if not valid_attachments:
            return []

        # Step 1: 按时间戳排序（最新的在前）
        result = sorted(valid_attachments, key=lambda att: att.timestamp, reverse=True)

        # Step 2: 查找 index 文件（硬编码优先逻辑）
        index_file_idx = None
        for idx, att in enumerate(result):
            # 提取文件名（不含路径和扩展名）
            basename = os.path.basename(att.filename)
            filename_without_ext = os.path.splitext(basename)[0].lower()

            if 'index' in filename_without_ext:
                index_file_idx = idx
                logger.info(f"Found index file: {att.filename}, moving to first position")
                break

        # Step 3: 如果找到 index 文件，将其移到第一位
        if index_file_idx is not None and index_file_idx > 0:
            index_file = result.pop(index_file_idx)
            result.insert(0, index_file)

        logger.info(f"Using fallback: {len(result)} attachments sorted by timestamp (index file prioritized)")
        return result

    @classmethod
    def _filter_existing_files(cls, attachments: List[Attachment], agent_context: AgentContext) -> List[Attachment]:
        """
        过滤掉文件不存在的附件

        Args:
            attachments: 要检查的附件列表
            agent_context: Agent 上下文，用于获取工作空间信息

        Returns:
            List[Attachment]: 过滤后的附件列表，只包含文件存在的附件
        """
        if not attachments:
            return attachments

        workspace_dir = agent_context.get_workspace_dir()
        if not workspace_dir:
            logger.warning("Unable to get workspace directory, skipping file existence check")
            return attachments

        # 将 workspace_dir 转换为字符串（如果是 Path 对象）
        if hasattr(workspace_dir, '__fspath__'):
            workspace_dir = str(workspace_dir)

        valid_attachments = []
        removed_count = 0

        for attachment in attachments:
            # 直接使用附件的 filepath 字段
            file_path = attachment.filepath

            # 检查文件是否存在
            if os.path.exists(file_path):
                valid_attachments.append(attachment)
                logger.debug(f"File exists, keeping attachment: {attachment.filename}")
            else:
                removed_count += 1
                logger.warning(f"File no longer exists, removing attachment: {attachment.filename} (path: {file_path})")

        if removed_count > 0:
            logger.info(f"Removed {removed_count} attachments for non-existent files. Remaining: {len(valid_attachments)}")

        return valid_attachments

    @classmethod
    def get_attachments_by_tag(cls, attachments: List[Attachment], tag: AttachmentTag) -> List[Attachment]:
        """
        根据标签过滤附件

        Args:
            attachments: 附件列表
            tag: 要筛选的附件标签

        Returns:
            List[Attachment]: 匹配标签的附件列表
        """
        return [att for att in attachments if att.file_tag == tag]

    @classmethod
    def get_attachments_by_extension(cls, attachments: List[Attachment], extensions: List[str]) -> List[Attachment]:
        """
        根据文件扩展名过滤附件

        Args:
            attachments: 附件列表
            extensions: 要筛选的文件扩展名列表（不包含点号）

        Returns:
            List[Attachment]: 匹配扩展名的附件列表
        """
        return [att for att in attachments if att.file_extension in extensions]

    @classmethod
    def sort_by_size(cls, attachments: List[Attachment], descending: bool = True) -> List[Attachment]:
        """
        按文件大小排序附件

        Args:
            attachments: 附件列表
            descending: 是否降序排列（大文件在前）

        Returns:
            List[Attachment]: 按大小排序的附件列表
        """
        return sorted(attachments, key=lambda att: att.file_size, reverse=descending)
