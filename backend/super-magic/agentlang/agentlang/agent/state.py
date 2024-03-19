# 定义代理状态枚举
import enum


class AgentState(enum.Enum):
    """Agent状态枚举"""

    IDLE = "idle"  # 空闲状态
    RUNNING = "running"  # 运行中
    WAITING_FOR_USER = "waiting_for_user"  # 等待用户回复状态
    FINISHED = "finished"  # 顺利完成状态
    ERROR = "error"  # 错误状态
    SUSPENDED = "suspended"  # 暂停状态（如积分不足）
