"""区分自动记忆设置、Skill 可用性和后台维护资格。"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext

MEMORY_SKILL_NAME = "memory"


def is_auto_memory_enabled(agent_context: "AgentContext") -> bool:
    """
    普通 Agent 的长期记忆开关只控制自动行为，不改变 Skill 知识或文件访问权限。
    | 内容                               | 开关关闭后                         |
    | 自动读取、提取、保存和整理记忆       | 停止自动执行                       |
    | Memory Skill：在哪里、如何查看整理  | 仍然可以发现并读取                 |
    | 用户明确要求查看、记住、整理或删除   | 仍按请求执行，遵守原有权限          |
    Claw 的自有工作区记忆沿用原生命周期；通用记忆继续与它共存。
    """
    return agent_context.is_magiclaw() or agent_context.get_personal_preferences().long_term_memory_enabled


def is_memory_skill_available(agent_context: "AgentContext") -> bool:
    """
    loaded_skills 已经过来源发现、显式排除和必需预加载检查，不再用自动开关推断。
    例：配置写了 memory，但 SKILL.md 没加载成功，此时不能让后台在缺少规则时自行整理。
    """
    return agent_context.has_skill(MEMORY_SKILL_NAME)


def is_memory_maintenance_enabled(agent_context: "AgentContext") -> bool:
    """
    普通 Agent 需要自动设置与可用 Skill；Claw 排除通用 Skill 后仍维护自身记忆。
    主 Agent 结束一次任务后才能触发；fork 出来的记忆 Agent 不再触发下一层记忆 Agent。
    这是后台调度资格，不是文件权限校验，不能拿它拦截用户主动调用的记忆工具。
    """
    return agent_context.is_main_agent_context() and (
        agent_context.is_magiclaw()
        or (is_auto_memory_enabled(agent_context) and is_memory_skill_available(agent_context))
    )
