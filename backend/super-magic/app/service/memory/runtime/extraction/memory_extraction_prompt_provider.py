"""复用来源 Agent 的 Skill 配置，向 after-run 提供完整维护说明和当前用量。"""

from __future__ import annotations

import html
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from agentlang.agent.define import parse_agent_file
from agentlang.environment import Environment
from agentlang.logger import get_logger
from agentlang.skills.loader import SkillLoader
from app.core.agent_definition_normalizer import normalize_agent_definition
from app.core.models.agent_runtime import AgentProviderType, AgentTarget
from app.core.skill_manager import resolve_skills_metadata
from app.core.skill_utils.runtime_policy import resolve_runtime_skills
from app.path_manager import PathManager
from app.service.memory.policies.memory_file_budget import get_memory_md_budget
from app.service.memory.policies.memory_scope import MemoryScopeKind, build_memory_runtime_context
from app.service.memory.policies.memory_skill_policy import MEMORY_SKILL_NAME, is_memory_skill_available
from app.service.memory.runtime.extraction.memory_maintenance_prompt import MemoryMaintenancePromptBuilder
from app.utils.async_file_utils import async_read_text

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext
    from app.core.horizon.models import SuperMagicProductContextState
    from app.service.agent_context_snapshot_service import AgentContextSnapshot

logger = get_logger(__name__)


class MemoryExtractionPromptProvider:
    """
    高频主文由 fork 初始化预加载，本请求在维护任务旁再次提供完整主文、after-run 和必要的重组 reference。

    这里是共享记忆能力的后台使用入口，不能将整理能力限定为 after-run 专属。
    主 Agent 需要整体整理时也能通过 Skill 读取同一份 reorganize.md；后台只补一条记忆
    时也无需加载它。完整场景表见 app/service/memory/__init__.py。
    本类提供任务和运行时事实，分类、归档或冲突取舍仍由 Agent 根据 Skill 判断。

    后台模型的任务上下文：预加载的主 Skill + 原对话及已有状态 + 本次 User 任务。
    User 任务再次提供完整主 Skill 并要求按 after-run.md 保存新增信息；初始超限才附加 reorganize.md。
    仅在组装本次任务时重复主文，不在每轮模型调用前追加，也不要求模型再发起读文件调用。
    仅给一份规则文档不足以发起任务，所以规则与「现在执行什么」在这里分别提供。
    """


    def __init__(self, maintenance_prompt_builder: MemoryMaintenancePromptBuilder | None = None) -> None:
        self._maintenance_prompt_builder = maintenance_prompt_builder or MemoryMaintenancePromptBuilder()

    async def load(self, snapshot: "AgentContextSnapshot", agent_context: "AgentContext") -> str:
        try:
            request = await self._load_memory_request(snapshot.source.target, agent_context=agent_context)
        except Exception as error:
            """
            读取中 Skill 或 reference 消失，也不能取消 Claw 独立的工作区维护。
            CancelledError 不在 Exception 内，用户中断不会触发这条降级。
            """
            if not agent_context.is_magiclaw():
                raise
            logger.warning(f"通用 memory 说明不可用，Claw 仅维护自身工作区记忆: {error}")
            request = await self._unavailable_request(agent_context)
        """
        快照中的话题是来源模型当时已见的产品话题，不是本次后台 Agent 的运行 ID。
        只复用已有信息；来源缺失不新增失败条件，也不再捕获快照或查询话题接口。
        """
        source_context = self._format_source_context(snapshot.horizon_state.super_magic_product_context)
        """
        最终追加到 fork 的 User 消息结构如下；方括号表示此例省略的正文，不是实际输出：
        Source conversation captured for this memory task:
        Project: Reports &amp; exports (ID: project-demo)
        Topic: Channel A (ID: topic-demo)

        <memory_after_run>
        [本次维护任务、可用记忆目录、当前时钟和初始用量]

        <reference path="/app/agents/skills/memory/SKILL.md">
        [与预加载使用相同加载方式的完整主文，按 XML 文本转义]
        </reference>

        <reference path="/app/agents/skills/memory/references/after-run.md">
        [after-run.md 的完整正文，按 XML 文本转义]
        </reference>

        <reference path="/app/agents/skills/memory/references/reorganize.md">
        [仅初始存在超限主文件时附加；前文另列具体超限路径]
        </reference>

        </memory_after_run>
        上例假定 Skill 来自 /app/agents/skills/memory，项目名称含 &，因此输出为 &amp;。
        快照缺少产品上下文时，头部改为下面这一行，维护请求仍保留：
        Source project and topic: unavailable in the captured context.
        """
        return f"{source_context}\n\n{request}"

    @staticmethod
    def _format_source_context(context: "SuperMagicProductContextState | None") -> str:
        """
        这里只说明本次 fork 来自哪个产品话题，不要求每条记忆复制项目和话题字段。
        例：本次来自话题 B，读到话题 A 的笔记后做了整理，原有内容仍应保留 A 的来源。
        轻量括注、是否需要 topics 笔记由 Skill 指导，Python 不替模型决定内容组织。
        """
        if context is None:
            return "Source project and topic: unavailable in the captured context."
        return (
            "Source conversation captured for this memory task:\n"
            f"Project: {html.escape(context.project.name)} (ID: {html.escape(context.project.id)})\n"
            f"Topic: {html.escape(context.topic.name)} (ID: {html.escape(context.topic.id)})"
        )

    async def _load_memory_request(self, target: AgentTarget, *, agent_context: "AgentContext") -> str:
        """
        复用编译后的来源定义、归一化和同一 Skill 发现顺序，避免后台读到另一来源的同名 Skill。
        MOCK DEMO：只有项目主文件超过 max -> 注入重组 reference，范围仍只针对该文件；
        Claw 排除通用 memory -> 仍执行原工作区维护，不能把排除 Skill 当成取消 Claw 记忆。
        """
        if not is_memory_skill_available(agent_context):
            return await self._unavailable_request(agent_context)
        definition_text = await async_read_text(PathManager.get_compiled_agent_file(target.agent_name))
        definition, _ = parse_agent_file(definition_text)
        if target.provider_type != AgentProviderType.BUILTIN:
            definition = normalize_agent_definition(target.agent_name, definition)
        runtime = resolve_runtime_skills(definition.skills_config)
        if MEMORY_SKILL_NAME in runtime.skills_config.excluded_skills:
            return await self._unavailable_request(agent_context)
        sources = await resolve_skills_metadata(runtime.skills_config, target.agent_name)
        metadata = next((item for item in sources.metadata if item.name == MEMORY_SKILL_NAME), None)
        if metadata is None or metadata.skill_dir is None:
            return await self._unavailable_request(agent_context)
        loaded = await SkillLoader().load_from_file(metadata.skill_file or metadata.skill_dir / "SKILL.md")
        if not loaded.content.strip() or not loaded.enabled or (Environment.is_mainland() and loaded.region == "international"):
            return await self._unavailable_request(agent_context)

        budget = get_memory_md_budget()
        usages = await self._maintenance_prompt_builder.inspect(agent_context)
        over_budget_files = [
            usage.path for usage in usages
            if budget is not None and usage.estimated_tokens is not None
            and budget.is_over_budget(usage.estimated_tokens)
        ]
        references = ["after-run.md"]
        if over_budget_files:
            # 例：全局 12K、项目 18K，只要求整理项目主文件；另一份不会被连带重写。
            references.append("reorganize.md")
        """
        Skill 提供维护规则；这条 User 消息明确发起本次任务，不能仅提供说明和用量。
        同一超限结果同时决定整理目标和 reference 注入，写后超限仍按 Skill 按需读取。
        """
        parts = [
            "<memory_after_run>",
            "Perform this internal after-run memory task now. Follow the supplied memory SKILL.md and "
            "after-run.md rules to maintain the permitted scopes from the source conversation available "
            "in this fork. Save missing useful information, fill gaps in existing entries, and apply confirmed "
            "corrections and forget requests. Do not resume the source business task.",
            "The complete memory SKILL.md is supplied again below for this maintenance task. "
            "Use it directly; no tool call is needed to reload it.",
            build_memory_runtime_context(agent_context),
            self._format_time_context(agent_context),
            self._maintenance_prompt_builder.render_usage(usages, budget),
        ]
        if over_budget_files:
            parts.append(
                "Also reorganize the following over-budget MEMORY.md files under the supplied reorganize.md "
                "rules, preserving useful information and bringing each within its stated maximum:\n"
                + "\n".join(f"- {html.escape(str(path))}" for path in over_budget_files)
            )
        # 复用上方已读取的完整主文，使维护规则靠近本次任务；不维护摘要副本，也不伪造工具调用。
        parts.append(
            f'<reference path="{html.escape(str(loaded.skill_file), quote=True)}">\n'
            f"{html.escape(loaded.content, quote=False)}\n</reference>"
        )
        for filename in references:
            path = metadata.skill_dir / "references" / filename
            content = await async_read_text(path)
            if not content.strip():
                raise ValueError(f"Required memory reference is empty: {path}")
            parts.append(f'<reference path="{html.escape(str(path), quote=True)}">\n{html.escape(content, quote=False)}\n</reference>')
        parts.append("</memory_after_run>")
        return "\n\n".join(parts)

    async def _unavailable_request(self, agent_context: "AgentContext") -> str:
        """
        通用 Skill 缺失时普通 Agent 无法启动这项维护；Claw 还继承了自己的工作区规则。
        因此 Claw 降级任务只维护自有记忆，不把缺少通用 Skill 误解为取消所有记忆能力。
        """
        if not agent_context.is_magiclaw():
            raise RuntimeError("Long-term memory maintenance is unavailable or excluded")
        # 沿现有降级入口提供容量任务；不加载被排除的 Skill，也不读取全局主文件。
        budget = get_memory_md_budget()
        usages = await self._maintenance_prompt_builder.inspect(
            agent_context, scope_kind=MemoryScopeKind.CLAW_WORKSPACE,
        )
        parts = [(
            "Internal after-run task: maintain this Claw's own workspace memory according to the inherited "
            "AGENTS.md, workspace rules, and claw_memory path. Its workspace memory replaces ordinary project "
            "memory; do not create ordinary project memory. User-global memory maintenance is unavailable "
            "in this run. Do not resume the source business task or repeat already successful memory writes."
        ), self._format_time_context(agent_context), self._maintenance_prompt_builder.render_usage(usages, budget)]
        over_budget_files = [
            usage.path for usage in usages
            if budget is not None and usage.estimated_tokens is not None
            and budget.is_over_budget(usage.estimated_tokens)
        ]
        parts.append(
            "Apply the stated per-file budget to this Claw's MEMORY.md, including after new writes. "
            "If it exceeds the maximum, reorganize it toward the target using its existing workspace layout. "
            "Read and process source sections in bounded ranges. Save useful less frequently needed details "
            "to appropriate existing memory files and read back those destinations before shortening the source. "
            "Keep user preferences, constraints, frequently needed facts, and relevant recent work directly usable "
            "in MEMORY.md; add exact paths and reading conditions for archived details. Do not delete useful "
            "information merely to meet the budget. Preserve unread or unprocessed source sections on failure, "
            "cancellation, unavailable budget or count, or concurrent changes, and report partial completion. "
            "Do not create ordinary project memory or maintain user-global memory."
        )
        if over_budget_files:
            parts.append(
                "Reorganize these over-budget Claw MEMORY.md files now under those preservation rules:\n"
                + "\n".join(f"- {html.escape(str(path))}" for path in over_budget_files)
            )
        return "\n\n".join(parts)

    @staticmethod
    def _format_time_context(agent_context: "AgentContext") -> str:
        source_timezone = agent_context.shared_context.get_field("user_timezone")
        zone = timezone.utc
        timezone_label = "unknown; UTC is used for the current clock"
        if isinstance(source_timezone, str) and source_timezone:
            try:
                zone = ZoneInfo(source_timezone)
                timezone_label = source_timezone
            except (ZoneInfoNotFoundError, ValueError):
                pass
        now = datetime.now(timezone.utc).astimezone(zone)
        # 维护时钟只解释「现在」；不能用它填补历史事件缺失的日期或时区。
        return (
            f"Current maintenance time: {now.strftime('%Y-%m-%d %H:%M:%S %Z')} (UTC offset {now.strftime('%z')}). "
            f"User timezone: {timezone_label}. Date historical events from their source messages, not this clock."
        )


__all__ = ["MemoryExtractionPromptProvider"]
