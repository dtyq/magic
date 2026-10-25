"""Canvas 布局命令模型。"""

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class LayoutCommand:
    """描述一个 Element 的命名布局请求。"""

    strategy: Literal["row_incremental", "dependency_flow", "explicit_position"]
    position: tuple[float, float] | None = None
