"""Mention context builder"""
from typing import Dict, List, Any
from app.service.mention.base import BaseMentionHandler
from app.service.mention.handlers import (
    FileHandler,
    MCPHandler,
    AgentHandler,
    DesignMarkerHandler,
    ProjectDirectoryHandler,
    SkillHandler,
)


class MentionContextBuilder:
    """构建mentions的系统上下文信息"""

    # 文件类型的mention类型列表
    FILE_TYPES = ['file', 'project_file', 'upload_file']

    def __init__(self):
        """初始化builder，注册所有handlers"""
        self._handlers: Dict[str, BaseMentionHandler] = {}
        self._register_handlers()

    def _register_handlers(self):
        """注册所有mention处理器"""
        # 文件处理器处理多种文件类型
        file_handler = FileHandler()
        for file_type in self.FILE_TYPES:
            self._handlers[file_type] = file_handler

        # 其他处理器
        self._handlers['mcp'] = MCPHandler()
        self._handlers['agent'] = AgentHandler()
        self._handlers['design_marker'] = DesignMarkerHandler()
        self._handlers['project_directory'] = ProjectDirectoryHandler()
        self._handlers['skill'] = SkillHandler()

    async def build(self, mentions: List[Dict[str, Any]]) -> str:
        """构建mentions的系统上下文信息（异步）

        Args:
            mentions: mentions字段中的信息列表

        Returns:
            str: 格式化的mentions上下文信息
        """
        if not mentions:
            return ""

        # 初始化上下文行
        context_lines = [
            "<mentions>",
            "All paths below are relative to the workspace root:",
        ]

        # 收集所有 tip 文本（保留顺序，后续去重）
        tip_texts = []

        # 处理每个mention（异步）
        for i, mention in enumerate(mentions, 1):
            mention_type = mention.get('type', 'unknown')

            # 使用对应的handler处理mention（异步）
            handler = self._handlers.get(mention_type)
            if handler:
                # 收集 tip 文本
                tip_text = await handler.get_tip(mention)
                if tip_text:  # 只添加非空的 tip
                    tip_texts.append(tip_text)

                # 处理 mention 内容
                lines = await handler.handle(mention, i)
                context_lines.extend(lines)
            else:
                # 未知类型的mention
                context_lines.append(f"{i}. reference: {mention}")

        # 添加结束标签
        context_lines.append("")
        context_lines.append("</mentions>")

        # 去重并保留顺序的 tips
        tips = self._deduplicate_tips(tip_texts)
        if tips:
            context_lines.append("")
            context_lines.append("Before proceeding: " + " ".join(tips))

        return "\n".join(context_lines)

    @staticmethod
    def _deduplicate_tips(tip_texts: List[str]) -> List[str]:
        """去重 tip 文本，保留首次出现的顺序

        Args:
            tip_texts: tip 文本列表

        Returns:
            List[str]: 去重后的 tip 文本列表
        """
        seen = set()
        result = []
        for tip in tip_texts:
            if tip not in seen:
                seen.add(tip)
                result.append(tip)
        return result
