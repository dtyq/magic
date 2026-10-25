"""Mention context builder"""
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from app.service.image_ref_normalizer import ImageRefNormalizer
from app.service.mention.base import BaseMentionHandler
from app.service.mention.utils.micro_app_prompt import (
    extract_micro_app_mentions,
    sync_micro_app_scope_from_mentions,
)
from app.service.mention.handlers import (
    AgentHandler,
    MicroAppHandler,
    AssistantHandler,
    DesignMarkerHandler,
    FileHandler,
    MCPHandler,
    ProjectDirectoryHandler,
    ProjectHandler,
    SkillHandler,
    ToolHandler,
)

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext


class MentionContextBuilder:
    """构建mentions的系统上下文信息"""

    # 文件类型的mention类型列表
    FILE_TYPES = ['file', 'project_file', 'upload_file', 'user_file']

    def _create_handlers(self) -> Dict[str, BaseMentionHandler]:
        """为当前构建创建独立的 mention handler，避免并发请求共享聚合状态。"""
        handlers: Dict[str, BaseMentionHandler] = {}

        # 文件处理器处理多种文件类型
        file_handler = FileHandler()
        for file_type in self.FILE_TYPES:
            handlers[file_type] = file_handler

        # 其他处理器
        handlers['mcp'] = MCPHandler()
        handlers['agent'] = AgentHandler()
        handlers['micro_app'] = MicroAppHandler()
        handlers['assistant'] = AssistantHandler()
        handlers['tool'] = ToolHandler()
        handlers['design_marker'] = DesignMarkerHandler()
        handlers['project_directory'] = ProjectDirectoryHandler()
        handlers['user_directory'] = handlers['project_directory']
        handlers['project'] = ProjectHandler()
        handlers['skill'] = SkillHandler()
        return handlers

    async def build(self, mentions: List[Dict[str, Any]], agent_context: Optional["AgentContext"] = None) -> str:
        """构建mentions的系统上下文信息（异步）

        Args:
            mentions: mentions字段中的信息列表
            agent_context: 可选的 AgentContext 实例，传给 handler 以支持 horizon 通知注入

        Returns:
            str: 格式化的mentions上下文信息
        """
        if not mentions:
            return ""

        handlers = self._create_handlers()
        micro_app_mentions = extract_micro_app_mentions(mentions)
        bound_scopes = await sync_micro_app_scope_from_mentions(mentions)

        # 初始化上下文行
        context_lines = [
            "<mentions>",
            "Referenced files and resources:",
        ]

        # 收集所有 tip 文本（保留顺序，后续去重）
        tip_texts = []
        mentioned_app_ids = [
            str(mention.get("app_id") or mention.get("id") or "").strip()
            for mention in micro_app_mentions
        ]
        mentioned_app_ids = [app_id for app_id in mentioned_app_ids if app_id]
        unresolved_app_ids = [
            app_id for app_id in mentioned_app_ids if app_id not in bound_scopes
        ]
        if unresolved_app_ids:
            unresolved = ", ".join(unresolved_app_ids)
            tip_texts.append(
                f"Micro-app '{unresolved}' could not be resolved. "
                "Pass app_id for a resolved micro-app. Do not call MagicBase for unresolved apps."
            )
        elif len(micro_app_mentions) == 1 and not bound_scopes:
            app_id = mentioned_app_ids[0] if mentioned_app_ids else "unknown"
            tip_texts.append(
                f"Micro-app '{app_id}' could not be resolved. Do not call MagicBase."
            )
        used_handlers = []
        used_handler_ids = set()

        # 处理每个mention（异步）
        for i, mention in enumerate(mentions, 1):
            mention = self._normalize_file_reference_input(mention)
            mention_type = mention.get('type', 'unknown')

            # 使用对应的handler处理mention（异步）
            handler = handlers.get(mention_type)
            if handler:
                handler_id = id(handler)
                if handler_id not in used_handler_ids:
                    used_handler_ids.add(handler_id)
                    used_handlers.append(handler)

                # 收集 tip 文本，将 agent_context 传给 handler 以支持 horizon push_notification
                tip_text = await handler.get_tip(mention, agent_context)
                if tip_text:  # 只添加非空的 tip
                    tip_texts.append(tip_text)

                # 处理 mention 内容
                lines = await handler.handle(mention, i, agent_context)
                context_lines.extend(lines)
            else:
                # 未知类型的mention
                context_lines.append(f"{i}. reference: {mention}")

        extra_index = len(mentions) + 1
        extra_bound = [
            (app_id, entry)
            for app_id, entry in bound_scopes.items()
            if app_id not in mentioned_app_ids
        ]
        if extra_bound:
            handler = handlers["micro_app"]
            handler_id = id(handler)
            if handler_id not in used_handler_ids:
                used_handler_ids.add(handler_id)
                used_handlers.append(handler)
            for app_id, entry in extra_bound:
                synthetic = {
                    "type": "micro_app",
                    "app_id": app_id,
                    "app_name": str(entry.get("app_name") or app_id).strip(),
                    "project_id": str(entry.get("project_id") or "").strip(),
                }
                tip_text = await handler.get_tip(synthetic, agent_context)
                if tip_text:
                    tip_texts.append(tip_text)
                context_lines.extend(
                    await handler.handle(synthetic, extra_index, agent_context)
                )
                extra_index += 1

        # handler 完成本轮所有 mention 后，收集需要统一生成的提示文本
        for handler in used_handlers:
            final_tip_text = await handler.get_final_tip(agent_context)
            if final_tip_text:
                tip_texts.append(final_tip_text)

        # 添加结束标签
        context_lines.append("")
        context_lines.append("</mentions>")

        # 去重并保留顺序的 tips
        tips = self._deduplicate_tips(tip_texts)
        if tips:
            context_lines.append("")
            context_lines.append("Before proceeding: " + " ".join(tips))

        return "\n".join(context_lines)

    async def extract_image_refs(
        self,
        mentions: List[Dict[str, Any]],
        agent_context: "AgentContext",
    ) -> List[str]:
        """提取并规范化可直接传给 Agent 的原生视觉图片引用。

        Args:
            mentions: mentions 字段中的信息列表
            agent_context: AgentContext 实例，用于确定当前工作区边界

        Returns:
            List[str]: 已校验、规范化并按 mention 出现顺序去重的图片路径列表
        """
        if not mentions:
            return []

        handlers = self._create_handlers()
        raw_image_refs: List[str] = []

        for mention in mentions:
            if not isinstance(mention, dict):
                continue
            mention = self._normalize_file_reference_input(mention)
            mention_type = self._resolve_mention_type(mention)
            handler = handlers.get(mention_type)
            if handler is None:
                continue

            raw_image_refs.extend(await handler.extract_image_refs(mention, agent_context))

        normalized_refs = await ImageRefNormalizer(
            agent_context.get_workspace_dir()
        ).normalize(raw_image_refs)
        return self._deduplicate_image_refs(normalized_refs)

    @staticmethod
    def _normalize_file_reference_input(mention: dict[str, object]) -> dict[str, object]:
        """旧记忆类型只在输入边界转换，用户文件不携带项目或复制字段。"""
        mention_type = MentionContextBuilder._resolve_mention_type(mention)
        user_type = {
            "memory_file": "user_file",
            "memory_directory": "user_directory",
            "user_file": "user_file",
            "user_directory": "user_directory",
        }.get(mention_type)
        if user_type is None:
            return mention
        data = mention
        if mention.get("type") == "mention":
            attrs = mention.get("attrs")
            nested_data = attrs.get("data") if isinstance(attrs, dict) else None
            data = nested_data if isinstance(nested_data, dict) else {}
        return {
            **{
                key: value for key, value in data.items()
                if key not in {"project_id", "pending_project_copy"} and not key.startswith("source_")
            },
            "type": user_type,
        }

    @staticmethod
    def _deduplicate_image_refs(image_refs: List[str]) -> List[str]:
        """对规范化后的图片引用去重，并保留首次出现顺序。"""
        return list(dict.fromkeys(image_refs))

    @staticmethod
    def _resolve_mention_type(mention: Dict[str, Any]) -> str:
        """解析扁平 mention 或 Tiptap mention 节点中的业务类型。"""
        mention_type = mention.get("type", "unknown")
        if mention_type != "mention":
            return mention_type if isinstance(mention_type, str) else "unknown"

        attrs = mention.get("attrs", {})
        if not isinstance(attrs, dict):
            return "unknown"
        nested_type = attrs.get("type", "unknown")
        return nested_type if isinstance(nested_type, str) else "unknown"

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
