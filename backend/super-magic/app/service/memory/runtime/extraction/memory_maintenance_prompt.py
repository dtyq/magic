"""构造 after-run 的主文件用量事实；维护策略由 memory Skill 提供。"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from app.service.memory.policies.memory_file_budget import (
    MemoryFileReadStatus, MemoryFileTokenUsage, MemoryMdBudget, inspect_memory_file,
)
from app.service.memory.policies.memory_scope import MemoryScopeKind, resolve_memory_scopes

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext


class MemoryMaintenancePromptBuilder:
    """并发测量适用的主文件，不读取 notes、不根据数字生成语义整改指令。"""

    async def inspect(
        self, agent_context: "AgentContext", *, scope_kind: MemoryScopeKind | None = None,
    ) -> tuple[MemoryFileTokenUsage, ...]:
        """
        MOCK DEMO：全局 12K、项目 18K -> 两份分别报告，只有项目触发重组 reference。
        Claw 主文件使用同一预算，但归档位置仍遵守自身工作区规则。
        通用 Skill 不可用时只测量 Claw 作用域，不读取全局记忆。
        """
        scopes = tuple(
            scope for scope in resolve_memory_scopes(agent_context)
            if scope_kind is None or scope.kind == scope_kind
        )
        usages = await asyncio.gather(*(
            inspect_memory_file(scope.memory_file, agent_context.get_interruption_event()) for scope in scopes
        ))
        # 计数结果仍需属于当前项目；自动开关不参与目录归属判断。
        current = resolve_memory_scopes(agent_context)
        return tuple(usage for scope, usage in zip(scopes, usages) if scope in current)

    @staticmethod
    def render_usage(usages: tuple[MemoryFileTokenUsage, ...], budget: MemoryMdBudget | None) -> str:
        """
        这份初始用量供模型直接使用，之后接续写工具的前后统计，不要求写完再专门计数。
        数字可以提示「从 80K 变成 1K 值得检查」，不能推断究竟丢了哪项理由或规则。
        缺少主文件、计数失败、预算缺失分别表达，避免把技术异常说成需要删除内容。
        例：预算 target=10,000/max=16,000，两个主文件测得以下用量，实际输出为：
        Initial MEMORY.md usage; counts are estimates, and each file is evaluated separately:
        - /home/user/.magic/memory/global/MEMORY.md: 12,000 estimated tokens; 48,000 bytes; target 10,000; maximum 16,000; over maximum: no.
        - /home/user/.magic/memory/projects/p_demo/MEMORY.md: 18,000 estimated tokens; 72,000 bytes; target 10,000; maximum 16,000; over maximum: yes.
        Reuse these initial counts and subsequent writing-tool feedback; do not recount merely because a write succeeded.
        若项目文件在计数中改变，其对应行改为（不会报告 0 tokens）：
        - /home/user/.magic/memory/projects/p_demo/MEMORY.md: current count unavailable (unstable); preserve existing content until it can be inspected.
        12,000 已超过 target，但未超过 maximum，不能与 18,000 那份一起判为超限。
        """
        lines = ["Initial MEMORY.md usage; counts are estimates, and each file is evaluated separately:"]
        for usage in usages:
            if usage.status == MemoryFileReadStatus.MISSING:
                lines.append(f"- {usage.path}: no file currently exists.")
            elif usage.status != MemoryFileReadStatus.OK:
                lines.append(f"- {usage.path}: current count unavailable ({usage.status.value}); preserve existing content until it can be inspected.")
            else:
                allowance = (
                    f"target {budget.target_tokens:,}; maximum {budget.max_tokens:,}; "
                    f"over maximum: {'yes' if budget.is_over_budget(usage.estimated_tokens) else 'no'}"
                    if budget is not None and usage.estimated_tokens is not None else "configured budget unavailable"
                )
                lines.append(f"- {usage.path}: {usage.estimated_tokens:,} estimated tokens; {usage.size_bytes:,} bytes; {allowance}.")
        if not usages:
            lines.append("No MEMORY.md usage is available in this scope.")
        lines.append("Reuse these initial counts and subsequent writing-tool feedback; do not recount merely because a write succeeded.")
        return "\n".join(lines)


__all__ = ["MemoryMaintenancePromptBuilder"]
