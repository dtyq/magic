"""Connection 策略变更计划。"""

from dataclasses import dataclass

from app.tools.canvas.domain.models import CanvasConnection, CanvasDocument


@dataclass(frozen=True)
class ConnectionMutationPlan:
    """封装一条已经校验的 Connection 及其幂等状态。"""

    connection: CanvasConnection
    already_exists: bool = False

    def apply(self, canvas: CanvasDocument) -> CanvasConnection:
        """把新连线加入内存 Canvas，重复关系保持幂等。"""
        if self.already_exists:
            return self.connection
        if not any(item.connection_id == self.connection.connection_id for item in canvas.connections):
            canvas.connections.append(self.connection)
        return self.connection
